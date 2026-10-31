import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractFile } from './lib/extract.js'
import { generate, checkHealth, friendlyError } from './lib/api.js'
import { getRelevantChunks, sourceSections, cleanText, makeFormulasReadable, removeNonacademicTopicRows, cleanSpeechText, wordCount, sectionCount, stripMarkdown } from './lib/text.js'
import { loadHistory, loadSummaries, loadReviewState, saveReviewState, loadSettings, saveSettings, saveAttempt, saveSummary, applyRetention, deleteLocalData, getReviewCard, rateReviewCard, dueReviewCards, analyticsSnapshot, dashboardSnapshot } from './lib/store.js'
import { exportPdf, exportQuestionsDocx, exportFlashcardsCsv, exportFlashcardsPdf, exportStudyPack, exportUserData } from './lib/exports.js'
import { downloadText } from './lib/util.js'
import Markdown from './components/Markdown.jsx'
import { LineChart, BarChart } from './components/Charts.jsx'
import MindMap from './components/MindMap.jsx'
import Flashcard from './components/Flashcards.jsx'
import VideoPlayer from './components/VideoPlayer.jsx'

const SECTIONS = [
  { id: 'desk', label: '📚 Study Desk', accent: 'teal', sub: 'Read, ask, and understand your workspace', tabs: [
    { id: 'summary', label: '📚 Summary', desc: 'A complete exam-ready learning guide from your documents.' },
    { id: 'concepts', label: '🔍 Key Concepts', desc: 'The ideas you must know before your exam, explained.' },
    { id: 'ask', label: '💬 Ask Workspace', desc: 'Ask anything — grounded in your PDF, or with general knowledge.' },
  ]},
  { id: 'studio', label: '🎨 AI Studio', accent: 'coral', sub: 'Create, practice, and track progress', tabs: [
    { id: 'flashcards', label: '🎴 Flashcards', desc: 'Visual flip cards with Leitner spaced review.' },
    { id: 'mcqs', label: '❓ MCQs', desc: 'Exam-style multiple choice with answers and explanations.' },
    { id: 'questions', label: '📝 Questions', desc: 'The most important likely exam questions.' },
    { id: 'long', label: '📖 Long Questions', desc: 'Detailed explain, discuss and compare questions.' },
    { id: 'short', label: '🎯 Short Questions', desc: 'Definitions and fact-based short answers.' },
    { id: 'difficulty', label: '📊 Difficulty', desc: 'Which topics need the most preparation.' },
    { id: 'test', label: '🧪 Practice Test', desc: 'A timed, graded mock test with negative marking.' },
    { id: 'analytics', label: '📈 Analytics', desc: 'Your scores, trends and weakest topics over time.' },
    { id: 'mindmap', label: '🧠 Mind Map', desc: 'A visual, collapsible map of your key ideas.' },
  ]},
  { id: 'learning', label: '🧠 AI Learning', accent: 'gold', sub: 'Plan, tutor, and generate exam-ready materials', tabs: [
    { id: 'plan', label: '🗓️ Study Plan', desc: 'A daily plan built around your exam date and goals.' },
    { id: 'tutor', label: '🧑‍🏫 AI Tutor', desc: 'Learn through guided questions and hints.' },
    { id: 'materials', label: '🧰 Study Materials', desc: 'Cheat sheets, glossaries, timelines and more.' },
    { id: 'paper', label: '📝 Sample Paper', desc: 'A full university-style paper with an answer key.' },
    { id: 'video', label: '🎥 Video Overview', desc: 'A narrated slide presentation of your course.' },
  ]},
]

const FALLBACK_SUGGESTIONS = [
  { label: '🔍 Go deeper', request: 'Pick the single most important topic in this material and explain it in more depth with an example' },
  { label: '🧩 Common confusions', request: 'Explain the comparisons and common points of confusion in this material' },
  { label: '📝 Practice quiz', request: 'Give me 5 practice quiz questions based on this material' },
]

const VIDEO_STYLES = ['Clean academic slides', 'Animated network diagrams', 'Studient glassmorphism', 'Whiteboard teaching', 'Dark lecture style', 'Minimal revision cards']
const VIDEO_FORMATS = ['Explainer lesson', 'Quick revision', 'Exam-cram overview', 'Process walkthrough', 'Topic comparison', 'Quiz video']
const MATERIAL_TYPES = ['Cheat sheet', 'Formula sheet', 'Glossary', 'Concept comparison table', 'Timeline summary', 'Case studies', 'Lab-viva questions', 'Oral examination questions']

function summaryBatches(text, detailLevel) {
  const sections = sourceSections(text)
  const isSlides = sections.some((s) => s.includes('[SLIDE '))
  const batchSize = isSlides ? (detailLevel === 'Brief' ? 18 : detailLevel === 'Exam-focused' ? 12 : 8) : 4
  const batches = []
  for (let i = 0; i < sections.length; i += batchSize) batches.push(sections.slice(i, i + batchSize).join('\n\n'))
  return batches
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [health, setHealth] = useState({ configured: true, stub: false })
  const [docs, setDocs] = useState({}) // name -> {type, text, size, stats}
  const [docText, setDocText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [section, setSection] = useState('desk')
  const [tab, setTab] = useState('summary')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [view, setView] = useState('home') // 'home' (dashboard + launchpad) | 'tool'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switcherQuery, setSwitcherQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('studient-sidebar-collapsed') === '1' } catch { return false } })
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [expandedFamily, setExpandedFamily] = useState('desk')

  const [summary, setSummary] = useState('')
  const [summaryDetail, setSummaryDetail] = useState('Detailed')
  const [summaryFocus, setSummaryFocus] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [topicExplanation, setTopicExplanation] = useState('')
  const [followupRequest, setFollowupRequest] = useState('')
  const [speechLang, setSpeechLang] = useState('English')
  const [speaking, setSpeaking] = useState(false)

  const [concepts, setConcepts] = useState('')
  const [difficultyText, setDifficultyText] = useState('')
  const [importantQs, setImportantQs] = useState(null)
  const [mcqs, setMcqs] = useState(null)
  const [longQs, setLongQs] = useState('')
  const [shortQs, setShortQs] = useState('')
  const [flashcards, setFlashcards] = useState(null)
  const [reviewState, setReviewState] = useState(loadReviewState)
  const [mindMap, setMindMap] = useState(null)
  const [studyPlan, setStudyPlan] = useState('')
  const [tutorMessages, setTutorMessages] = useState([])
  const [material, setMaterial] = useState('')
  const [materialType, setMaterialType] = useState('')
  const [samplePaper, setSamplePaper] = useState('')
  const [videoPlan, setVideoPlan] = useState('')
  const [videoConfig, setVideoConfig] = useState({ format: 'Explainer lesson', language: 'English', topic: 'Full course', customTopic: '', visualStyle: 'Clean academic slides', rate: 1.0 })
  const [videoSlides, setVideoSlides] = useState(null)
  const [videoNarration, setVideoNarration] = useState('')
  const [askAnswer, setAskAnswer] = useState('')
  const [askGeneral, setAskGeneral] = useState(false)
  const [askQuestion, setAskQuestion] = useState('')

  // Practice test
  const [quiz, setQuiz] = useState(null)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizLocked, setQuizLocked] = useState(false)
  const [quizFinished, setQuizFinished] = useState(false)
  const [choice, setChoice] = useState('')
  const [testStartedAt, setTestStartedAt] = useState(null)
  const [testTimedOut, setTestTimedOut] = useState(false)
  const [incorrectQs, setIncorrectQs] = useState([])
  const [remaining, setRemaining] = useState(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  const docName = settings.workspaceName || 'My Study Workspace'
  const mmRef = useRef(null)

  useEffect(() => { checkHealth().then(setHealth) }, [])
  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => { saveReviewState(reviewState) }, [reviewState])
  // System (Auto) theme: follow the OS setting and react live if it changes while the app is open
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    const dark = settings.theme === 'Dark' || (settings.theme === 'System' && systemDark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.font = settings.fontScale
    document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
  }, [settings, systemDark])

  // Quick switcher: Ctrl/Cmd+K opens or closes, Escape closes
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!switcherOpen) setSwitcherQuery('')
        setSwitcherOpen(!switcherOpen)
      } else if (e.key === 'Escape' && switcherOpen) {
        setSwitcherOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [switcherOpen])

  // Practice-test countdown (1s tick, same behaviour as st_autorefresh heartbeat)
  useEffect(() => {
    if (!quiz || quizFinished || !settings.timedMode || !testStartedAt) { setRemaining(null); return }
    const tick = () => {
      const left = Math.max(0, settings.testTimeLimit * 60 - Math.floor((Date.now() - testStartedAt) / 1000))
      setRemaining(left)
      if (left === 0) { setTestTimedOut(true); setQuizFinished(true) }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [quiz, quizFinished, settings.timedMode, settings.testTimeLimit, testStartedAt])

  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }))

  const handleFiles = async (files) => {
    if (!files.length) return
    setUploadError('')
    const total = files.reduce((n, f) => n + f.size, 0)
    if (total > 50 * 1024 * 1024) { setUploadError('This workspace is larger than 50 MB. Please upload a smaller set of documents.'); return }
    setUploading(true)
    try {
      const next = {}
      for (const file of files) {
        const { text, stats } = await extractFile(file)
        next[file.name] = { type: (file.name.split('.').pop() || '').toLowerCase(), text, size: file.size, stats }
      }
      const combined = Object.entries(next).filter(([, d]) => d.text).map(([n, d]) => `\n[DOCUMENT: ${n}]\n${d.text}`).join('\n\n')
      setDocs(next); setDocText(combined)
      setSummary(''); setTopicExplanation(''); setFollowupRequest(''); setFlashcards(null); setMindMap(null)
      resetQuiz()
      setView('home')
    } catch (err) {
      setUploadError(err.message || 'Could not read the uploaded files.')
    } finally { setUploading(false) }
  }

  const onFiles = (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    handleFiles(files)
  }

  const onDropFiles = (e) => {
    const files = [...(e.dataTransfer?.files || [])]
    if (files.length) handleFiles(files)
  }

  function resetQuiz() {
    setQuiz(null); setQuizIndex(0); setQuizAnswers([]); setQuizLocked(false); setQuizFinished(false)
    setChoice(''); setTestStartedAt(null); setTestTimedOut(false)
  }

  const run = useCallback(async (label, fn) => {
    setBusy(label); setError('')
    try { await fn() } catch (err) { setError(friendlyError(err)) } finally { setBusy('') }
  }, [])

  const genSummary = () => run('Analyzing your material…', async () => {
    const batches = summaryBatches(docText, summaryDetail)
    const data = await generate('summary', '', { batches, detailLevel: summaryDetail, focus: summaryFocus })
    const result = removeNonacademicTopicRows(makeFormulasReadable(data.result || ''))
    setSummary(result)
    saveSummary(docName, result, settings.privacyMode)
    setTopicExplanation(''); setFollowupRequest('')
    // Suggestions load in the background after the summary lands — the
    // generating popup must close with the summary, not linger over it.
    generate('suggestions', '', { summaryText: result }).then((s) => {
      setSuggestions(Array.isArray(s.result) ? s.result : FALLBACK_SUGGESTIONS)
    }).catch(() => setSuggestions(FALLBACK_SUGGESTIONS))
  })

  const explainTopic = (request) => run('Preparing your focused study response…', async () => {
    const ctx = getRelevantChunks(docText, request, 6, 12000)
    const data = await generate('explain-topic', ctx, { topic: request })
    setTopicExplanation(removeNonacademicTopicRows(makeFormulasReadable(data.result || '')))
    setFollowupRequest(request)
  })

  const genQuiz = async (questions, category) => {
    const ctx = getRelevantChunks(docText, category === 'Mixed' ? 'important exam concepts facts definitions processes' : category, 10, 12000)
    const data = await generate('quiz', ctx, { count: settings.questionCount, difficulty: settings.difficulty, category })
    return data.result
  }

  const startTest = () => run('Preparing your practice test…', async () => {
    const qs = await genQuiz(settings.questionCount, settings.testCategory)
    if (qs?.length) {
      setQuiz(qs); setQuizIndex(0); setQuizAnswers([]); setQuizLocked(false); setQuizFinished(false)
      setChoice(''); setTestStartedAt(Date.now()); setTestTimedOut(false)
    } else setError('I could not generate the test. Please try again.')
  })

  const submitAnswer = () => {
    if (!choice || !quiz) return
    const q = quiz[quizIndex]
    const isCorrect = choice === q.correct
    setQuizAnswers((a) => [...a, { topic: q.topic, correct: isCorrect, chosen: choice, answer: q.correct, question: q }])
    setQuizLocked(true)
  }

  const finishTest = () => {
    setQuizFinished(true)
    const answers = quizAnswers
    const score = answers.filter((a) => a.correct).length
    const topics = {}
    answers.forEach((a) => { topics[a.topic] = topics[a.topic] || { correct: 0, wrong: 0 }; topics[a.topic][a.correct ? 'correct' : 'wrong']++ })
    saveAttempt(docName, score, answers.length, topics, testStartedAt, settings.privacyMode)
    setIncorrectQs(answers.filter((a) => !a.correct).map((a) => a.question))
    setHistoryVersion((v) => v + 1)
  }

  const testResult = useMemo(() => {
    if (!quizFinished) return null
    const score = quizAnswers.filter((a) => a.correct).length
    const total = quizAnswers.length
    const penalty = settings.negativeMarking ? quizAnswers.filter((a) => !a.correct).length * 0.25 : 0
    const points = Math.max(0, score - penalty)
    const pct = total ? Math.round((points / total) * 100) : 0
    const topics = {}
    quizAnswers.forEach((a) => { topics[a.topic] = topics[a.topic] || { correct: 0, wrong: 0 }; topics[a.topic][a.correct ? 'correct' : 'wrong']++ })
    return { score, total, penalty, points, pct, topics,
      weak: Object.keys(topics).filter((t) => topics[t].wrong > topics[t].correct),
      strong: Object.keys(topics).filter((t) => topics[t].correct > topics[t].wrong),
      verdict: pct >= 80 ? 'Excellent! 🔥' : pct >= 60 ? 'Good work 👍' : 'Keep practicing 💪',
      adaptive: pct >= 85 ? 'Try a harder difficulty next time.' : pct < 60 ? 'Review missed concepts before your next test.' : 'Stay at this difficulty and build consistency.' }
  }, [quizFinished, quizAnswers, settings.negativeMarking])

  const readAloud = async () => {
    if (!('speechSynthesis' in window)) { setError('Your browser does not support speech narration (Web Speech API).'); return }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    let text = cleanSpeechText(summary)
    if (speechLang !== 'English') {
      try {
        const data = await generate('translate-summary', '', { text, languageName: speechLang })
        text = cleanSpeechText(data.result || text)
      } catch { /* fall back to English text */ }
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = { English: 'en-US', Hindi: 'hi-IN', Urdu: 'ur-PK', Spanish: 'es-ES', French: 'fr-FR' }[speechLang] || 'en-US'
    u.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  const dash = useMemo(() => dashboardSnapshot(docName, !!summary, flashcards, reviewState), [docName, summary, flashcards, reviewState, historyVersion])
  const analytics = useMemo(() => analyticsSnapshot(docName, flashcards, reviewState), [docName, flashcards, reviewState, historyVersion])
  const docHistory = useMemo(() => loadHistory().filter((h) => h.document === docName), [docName, historyVersion])
  const videoTopics = useMemo(() => {
    const out = []
    for (const line of (summary || '').split('\n')) {
      const m = line.match(/^\s*#{2,4}\s*(?:\d+[.)]\s*)?(?:[^\w\s]+\s*)*(.+?)\s*$/)
      if (m) {
        const name = m[1].replace(/[*_`]/g, '').trim()
        if (name.length >= 3 && name.length <= 70 && !out.includes(name) && !/overview|topic map|formulas|quiz-ready|revision|comparisons|examples|purpose|explanations|protocols|source batch/i.test(name)) out.push(name)
      }
    }
    return out.slice(0, 8)
  }, [summary])

  const words = wordCount(docText)
  const sections = sectionCount(docText)
  const pptStats = Object.values(docs).map((d) => d.stats).filter((s) => s?.slide_count)
  const totalSlides = pptStats.reduce((n, s) => n + (s.slide_count || 0), 0)
  const readableSlides = pptStats.reduce((n, s) => n + (s.slides_with_text || 0), 0)
  const coverage = totalSlides ? Math.round((readableSlides / totalSlides) * 100) : 0

  const currentSection = SECTIONS.find((s) => s.id === section)

  const openTool = (sectionId, tabId) => {
    setSection(sectionId); setTab(tabId); setView('tool')
    window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' })
  }
  const goHome = () => {
    setView('home')
    window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' })
  }
  const goFamily = (sectionId) => {
    setSection(sectionId); setView('home')
    document.getElementById('launchpad')?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }
  const toggleSidebar = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { localStorage.setItem('studient-sidebar-collapsed', next ? '1' : '0') } catch {}
  }
  useEffect(() => { setExpandedFamily(section) }, [section])

  const Sidebar = () => (
    <aside className={`sidebar ${sidebarCollapsed ? 'rail' : ''} ${sidebarMobileOpen ? 'mobile-open' : ''}`} aria-label="Study navigation">
      <div className="sidebar-head">
        <span className="brand-mark">🧠</span>
        <b>Studient</b>
        {sidebarMobileOpen ? (
          <button className="icon-btn sidebar-toggle" onClick={() => setSidebarMobileOpen(false)} aria-label="Close navigation menu">✕</button>
        ) : (
          <button className="icon-btn sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar to icon rail'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse to icon rail'}>{sidebarCollapsed ? '»' : '«'}</button>
        )}
      </div>
      <div className="side-sec">
        <div className="side-label">Workspace</div>
        {docText ? (
          <div className="side-ws"><b>{docName}</b><span className="muted small">{Object.keys(docs).length} document(s) · {words.toLocaleString()} words</span>
            <label className="btn small" htmlFor="studient-file-input">＋ Add more</label>
          </div>
        ) : (
          <div className="side-ws"><b>No workspace yet</b><span className="muted small">Upload a document to start studying.</span>
            <label className="btn small" htmlFor="studient-file-input">📁 Upload</label>
          </div>
        )}
      </div>
      <div className="side-sec">
        <div className="side-label">Tools</div>
        {SECTIONS.map((s) => (
          <div key={s.id} className="side-fam" data-accent={s.accent}>
            <button className={`side-fam-head ${section === s.id ? 'current' : ''}`} onClick={() => {
              if (sidebarCollapsed) { setSidebarCollapsed(false); setExpandedFamily(s.id) }
              else setExpandedFamily(expandedFamily === s.id ? '' : s.id)
            }} aria-expanded={expandedFamily === s.id}>
              <span className="side-ic">{s.label.split(' ')[0]}</span>
              <span className="side-fam-name">{s.label.replace(/^[^\s]+\s/, '')}</span>
              <span className="side-caret">{expandedFamily === s.id ? '▾' : '▸'}</span>
            </button>
            {expandedFamily === s.id && (
              <div className="side-tools">
                {s.tabs.map((t) => (
                  <button key={t.id} className={`side-tool ${tab === t.id && section === s.id && view === 'tool' ? 'current' : ''}`} onClick={() => {
                    setSidebarMobileOpen(false)
                    if (!docText) {
                      setError('Upload a document first — pick a tool after your study material is loaded.')
                      document.getElementById('upload-card')?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'center' })
                      return
                    }
                    openTool(s.id, t.id)
                  }}>
                    <span className="side-ic">{t.label.split(' ')[0]}</span><span>{t.label.replace(/^[^\s]+\s/, '')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="side-foot">
        <button className="side-settings" onClick={() => { setDrawerOpen(true); setSidebarMobileOpen(false) }}><span>⚙️</span><span>Settings</span></button>
      </div>
    </aside>
  )

  const WorkspaceBar = () => (
    <>
              <div className="doc-bar"><div className="doc-name">📄 {docName} <span className="doc-type">WORKSPACE</span></div><div className="muted small">Ready for active learning</div></div>
              <button className="btn ghost" onClick={() => setShowPreview(!showPreview)}>📄 {showPreview ? 'Hide' : 'Preview'} extracted document text</button>
              {showPreview && (
                <div className="card">
                  {pptStats.length > 0 && <div className="alert info">PowerPoint extraction audit: <b>{readableSlides}/{totalSlides} slides contain readable text ({coverage}% text coverage)</b>. The AI summary uses all extracted slide sections, not only this preview.</div>}
                  {coverage < 100 && totalSlides > 0 && <div className="alert warn">Some slides are visual-only. Their text cannot be recovered; export the deck to PDF and upload it for OCR if those slides contain important diagrams or screenshots.</div>}
                  <textarea readOnly value={docText} rows={14} className="preview-text" aria-label="Complete extracted content" />
                  <button className="btn" onClick={() => downloadText(docText, `${docName.replace(/\.[^.]+$/, '')}.txt`)}>⬇️ Download extracted text</button>
                </div>
              )}
              <div className="metrics">
                <div className="metric"><span className="chip">📖</span><span>Words</span><b>{words.toLocaleString()}</b></div>
                <div className="metric"><span className="chip">🔤</span><span>Characters</span><b>{docText.length.toLocaleString()}</b></div>
                <div className="metric"><span className="chip">🎯</span><span>Difficulty</span><b>{settings.difficulty}</b></div>
              </div>
    </>
  )

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn hamburger" onClick={() => { setSidebarCollapsed(false); setSidebarMobileOpen(true) }} aria-label="Open navigation menu">☰</button>
        <button className="brand" onClick={goHome} aria-label="Studient AI — back to home">
          <span className="brand-mark">🧠</span>
          <span className="brand-text">
            <span className="brand-name"><span>Studient</span> AI</span>
            <span className="brand-sub">Personal study assistant</span>
          </span>
        </button>
        <nav className="nav-pills" aria-label="Study sections">
          {SECTIONS.map((s) => (
            <button key={s.id} data-accent={s.accent} className={section === s.id && docText ? 'nav-pill active' : 'nav-pill'} onClick={() => goFamily(s.id)}>{s.label}</button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="switcher-btn" onClick={() => { setSwitcherQuery(''); setSwitcherOpen(true) }} aria-expanded={switcherOpen} aria-label="Quick switcher — jump to any tool" title="Jump to any tool (Ctrl+K)">🧭 Tools <kbd>Ctrl K</kbd></button>
          <label className="upload-mini" htmlFor="studient-file-input">📁 Upload</label>
          <div className={`key-badge ${health.configured ? 'ok' : 'bad'}`}>
            {health.stub ? '🧪 Stub mode (local test)' : health.configured ? '● AI ready' : '● API key not configured'}
          </div>
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open settings" title="Settings">⚙️</button>
        </div>
      </header>
      <input id="studient-file-input" type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md" onChange={onFiles} hidden />

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div><div className="kicker">Tune your experience</div><h2>⚙️ Settings</h2></div>
              <button className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close settings">✕</button>
            </div>
            <div className="drawer-body">
              <label className="field">Appearance
                <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value })}><option value="Light">Light</option><option value="Dark">Dark</option><option value="System">System (follows device)</option></select>
              </label>
              <label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} /> Reduce animations</label>
              <label className="check"><input type="checkbox" checked={settings.highContrast} onChange={(e) => updateSettings({ highContrast: e.target.checked })} /> High contrast</label>
              <label className="field">Text size
                <select value={settings.fontScale} onChange={(e) => updateSettings({ fontScale: e.target.value })}><option>Small</option><option>Default</option><option>Large</option><option>Extra large</option></select>
              </label>
          {Object.keys(docs).length > 0 && (
            <details className="side-files"><summary>📚 Workspace files</summary>
              {Object.entries(docs).map(([name, d]) => (
                <div key={name} className="side-file"><b>{name}</b><span>{d.type.toUpperCase()} · {wordCount(d.text).toLocaleString()} words{d.stats?.slide_count ? ` · ${d.stats.slides_with_text}/${d.stats.slide_count} slides readable` : ''}</span>
                  {(d.stats?.warnings || []).map((w, i) => <div key={i} className="alert warn small">{w}</div>)}
                </div>
              ))}
            </details>
          )}
          <details className="privacy">
            <summary>🔐 Privacy &amp; data controls</summary>
            <label className="check"><input type="checkbox" checked={settings.privacyMode} onChange={(e) => updateSettings({ privacyMode: e.target.checked })} /> Private session mode <span className="muted small">(do not save new test attempts or summaries to local history)</span></label>
            <label className="field">History retention
              <select value={settings.retentionDays} onChange={(e) => { const v = parseInt(e.target.value, 10); updateSettings({ retentionDays: v }); applyRetention(v) }}>
                <option value={0}>Keep forever</option><option value={7}>Keep 7 days</option><option value={30}>Keep 30 days</option><option value={90}>Keep 90 days</option>
              </select>
            </label>
            <button className="btn" onClick={() => exportUserData({ workspaceText: docText, history: loadHistory(), summaries: loadSummaries(), reviewState, summary, studyPlan })}>⬇️ Export my study data</button>
            <label className="check"><input type="checkbox" id="confirmDelete" /> I understand this permanently deletes local study data</label>
            <button className="btn danger" onClick={() => {
              if (!document.getElementById('confirmDelete')?.checked) { setError('Tick the confirmation box first — deleting local data is permanent.'); return }
              deleteLocalData(); setReviewState({}); setHistoryVersion((v) => v + 1); setError('')
            }}>🗑️ Securely delete local data</button>
            <p className="muted small">No server storage exists in this app. Documents live only in your browser; history and review state live in localStorage on this device. The Groq API key is read only from the server environment and is never included in exports.</p>
          </details>
          <hr />
          <h3>⚙️ Study Settings</h3>
          <label className="field">Number of questions: <b>{settings.questionCount}</b>
            <input type="range" min="3" max="15" value={settings.questionCount} onChange={(e) => updateSettings({ questionCount: parseInt(e.target.value, 10) })} />
          </label>
          <label className="field">Difficulty
            <select value={settings.difficulty} onChange={(e) => updateSettings({ difficulty: e.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option><option>University Exam</option></select>
          </label>
          <h4>🧪 Practice test options</h4>
          <label className="field">Test category
            <select value={settings.testCategory} onChange={(e) => updateSettings({ testCategory: e.target.value })}><option>Mixed</option><option>Definitions</option><option>Processes</option><option>Comparisons</option><option>Facts</option><option>Exam-focused</option></select>
          </label>
          <label className="check"><input type="checkbox" checked={settings.timedMode} onChange={(e) => updateSettings({ timedMode: e.target.checked })} /> Timed mode</label>
          {settings.timedMode && (
            <label className="field">Time limit
              <select value={settings.testTimeLimit} onChange={(e) => updateSettings({ testTimeLimit: parseInt(e.target.value, 10) })}>{[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select>
            </label>
          )}
          <label className="check wrap"><input type="checkbox" checked={settings.negativeMarking} onChange={(e) => updateSettings({ negativeMarking: e.target.checked })} /> <span className="lbl">Negative marking</span> <span className="muted small">(wrong answers −0.25)</span></label>
          <button className="btn" onClick={resetQuiz}>🔄 Reset Test</button>
          <div className="tip">💡 <b>Study Tip</b><br />For best results, upload clear lecture notes, Word documents, or presentation slides.</div>
            </div>
          </aside>
        </div>
      )}

      {sidebarMobileOpen && <div className="sidebar-backdrop" onClick={() => setSidebarMobileOpen(false)} />}

      <div className="shell">
      <Sidebar />
      <main className="main">
        <section className={docText ? 'hero compact' : 'hero'}>
          <div className="blob b1" aria-hidden="true" /><div className="blob b2" aria-hidden="true" /><div className="blob b3" aria-hidden="true" /><div className="blob b4" aria-hidden="true" />
          <div className="hero-inner">
            <div className="eyebrow">✦ Your intelligent study companion</div>
            <div className="hero-icon">🧠</div>
            <h1><span className="grad">Studient</span> AI</h1>
            <p className="sub">Your Personal AI-Powered Study Assistant</p>
            <p className="desc">Turn your notes, documents, and presentations into clear, exam-ready learning — then practice, reflect, and improve with confidence.</p>
            <div className={`upload-card ${dragOver ? 'drag' : ''}`} id="upload-card"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropFiles}>
              <div className="upload-card-head">
                <b>{docText ? 'Add more study materials' : 'Build your study space'}</b>
                <span className="muted small">Upload a source and let Studient AI turn it into active revision material.</span>
              </div>
              <div className="file-types">
                <span className="ft-teal">PDF</span><span className="ft-coral">WORD</span><span className="ft-gold">PPTX</span><span className="ft-rose">TXT</span><span className="ft-teal">MD</span>
              </div>
              <label className="upload-btn" htmlFor="studient-file-input">📁 {dragOver ? 'Drop your files here' : 'Choose study materials'}</label>
              <p className="muted small center">or drag &amp; drop files onto this card · up to 50 MB total</p>
              <label className="field">Workspace name
                <input type="text" value={settings.workspaceName} onChange={(e) => updateSettings({ workspaceName: e.target.value })} placeholder="Name this course workspace" />
              </label>
              {uploading && <p className="muted">Reading your workspace documents…</p>}
              {uploadError && <div className="alert error">{uploadError}</div>}
              {docText && <div className="alert ok">✓ Workspace ready · {Object.keys(docs).length} document(s) · {words.toLocaleString()} words</div>}
              <p className="muted small center">🔒 Documents never leave your device except the selected text sent to Groq.</p>
            </div>
          </div>
        </section>

        {!health.configured && !health.stub && (
          <div className="alert warn big key-banner">⚠️ <b>API key not configured</b> — add <code>GROQ_API_KEY</code> in Vercel Settings → Environment Variables, then redeploy. You can still upload documents and explore the interface, but AI generation will not run.</div>
        )}
        {switcherOpen && (
        <div className="switcher-overlay" onClick={() => setSwitcherOpen(false)}>
          <div className="switcher" role="dialog" aria-modal="true" aria-label="Jump to a tool" onClick={(e) => e.stopPropagation()}>
            <div className="switcher-search">
              <span aria-hidden="true">🔍</span>
              <input autoFocus value={switcherQuery} onChange={(e) => setSwitcherQuery(e.target.value)} placeholder="Jump to a tool — try “flashcards” or “test”…" aria-label="Search tools" />
              <button className="icon-btn switcher-close" onClick={() => setSwitcherOpen(false)} aria-label="Close quick switcher">✕</button>
            </div>
            <div className="switcher-list">
              {SECTIONS.map((s) => {
                const q = switcherQuery.trim().toLowerCase()
                const items = s.tabs.filter((t) => !q || (t.label + ' ' + t.desc).toLowerCase().includes(q))
                if (!items.length) return null
                return (
                  <div key={s.id} className="switcher-fam" data-accent={s.accent}>
                    <div className="switcher-fam-label">{s.label} <span>· {items.length} tool{items.length === 1 ? '' : 's'}</span></div>
                    {items.map((t) => {
                      const current = view === 'tool' && section === s.id && tab === t.id
                      return (
                        <button key={t.id} className={current ? 'switcher-item current' : 'switcher-item'} onClick={() => {
                          setSwitcherOpen(false)
                          if (!docText) {
                            setError('Upload a document first — pick a tool after your study material is loaded.')
                            document.getElementById('upload-card')?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'center' })
                            return
                          }
                          openTool(s.id, t.id)
                        }}>
                          <span className="switcher-icon">{t.label.split(' ')[0]}</span>
                          <span className="switcher-text"><b>{t.label.replace(/^[^\s]+\s/, '')}</b><small>{t.desc}</small></span>
                          {current && <span className="switcher-current">● Current</span>}
                          <span className="switcher-arrow" aria-hidden="true">→</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {SECTIONS.every((s) => !s.tabs.some((t) => (t.label + ' ' + t.desc).toLowerCase().includes(switcherQuery.trim().toLowerCase()))) && (
                <div className="switcher-empty">No tools match “{switcherQuery}”.</div>
              )}
            </div>
            <div className="switcher-foot"><span><kbd>Ctrl K</kbd> to open</span><span><kbd>Esc</kbd> to close</span><span>17 tools · 3 families</span></div>
          </div>
        </div>
      )}

      {health.stub && <div className="alert warn big">🧪 Stub mode is on (STUDIENT_STUB_GROQ=1) — responses are canned test data, not real AI output. Turn it off for real use.</div>}
        {error && <div className="alert error big">{error}</div>}

        {!docText ? (
          <>
            <div className="features">
              {SECTIONS.map((s, i) => (
                <button key={s.id} data-accent={s.accent} className="feature anim-rise" style={{ animationDelay: `${0.1 + i * 0.08}s` }} onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'center' })}>
                  <div className="icon">{s.label.split(' ')[0]}</div>
                  <div className="title">{s.label.replace(/^[^\s]+\s/, '')}</div>
                  <div className="text">{s.sub}</div>
                  <div className="feature-cta">Upload a document to begin →</div>
                </button>
              ))}
            </div>
            <Dashboard data={dash} />
            <div className="alert info">📌 <b>OCR supported</b><br />Scanned PDFs are read with on-device OCR (tesseract.js) when no selectable text is available. If a page yields no text and OCR is unavailable, the page is flagged clearly.</div>
          </>
        ) : view === 'home' ? (
          <>
            <WorkspaceBar />
            <Dashboard data={dash} />
            <Launchpad sections={SECTIONS} onOpen={openTool} />
          </>
        ) : (
          <>
            <WorkspaceBar />
            <div className="crumbs">
              <button className="btn ghost" onClick={goHome}>← All tools</button>
              <span className="crumb-sep">/</span>
              <b className="crumb-fam" data-accent={currentSection.accent}>{currentSection.label}</b>
              <span className="crumb-tab">{currentSection.tabs.find((t) => t.id === tab)?.label}</span>
            </div>
            <nav className="tabs" data-accent={currentSection.accent} aria-label="Tabs">
              {currentSection.tabs.map((t) => <button key={t.id} className={tab === t.id ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab(t.id)}>{t.label}</button>)}
            </nav>
            <div className="tab-body" key={tab} data-accent={currentSection.accent}>
                {tab === 'summary' && <SummaryTab {...{ summary, summaryDetail, setSummaryDetail, summaryFocus, setSummaryFocus, genSummary, busy, suggestions, explainTopic, topicExplanation, followupRequest, speechLang, setSpeechLang, readAloud, speaking, docText, docName, flashcards, mindMap, studyPlan }} />}
                {tab === 'concepts' && <SimpleGenTab title="🔍 Key Concepts" caption="Extract the concepts you should know before your exam." button="✨ Extract Key Concepts" value={concepts} onGenerate={() => run('Identifying key concepts…', async () => {
                  const ctx = getRelevantChunks(docText, 'main concepts important ideas definitions topics', 8)
                  const d = await generate('concepts', ctx, {})
                  setConcepts(removeNonacademicTopicRows(makeFormulasReadable(d.result || '')))
                })} busy={busy} />}
                {tab === 'ask' && <AskTab {...{ askQuestion, setAskQuestion, askGeneral, setAskGeneral, askAnswer, setAskAnswer, docText, run, busy }} />}
                {tab === 'flashcards' && <FlashcardsTab {...{ flashcards, setFlashcards, docText, settings, run, busy, reviewState, setReviewState, docName }} />}
                {tab === 'mcqs' && <McqTab {...{ mcqs, setMcqs, docText, settings, run, busy }} />}
                {tab === 'questions' && <QuestionsTab {...{ importantQs, setImportantQs, docText, settings, run, busy }} />}
                {tab === 'long' && <TextGenTab title="📖 Long Questions" caption="Prepare detailed university examination questions." button="✨ Generate Long Questions" value={longQs} filename="studient-long-questions.docx" onGenerate={() => run('Generating long questions…', async () => {
                  const ctx = getRelevantChunks(docText, 'process explain discuss compare analyze describe', 8)
                  const d = await generate('long-questions', ctx, { count: settings.questionCount, difficulty: settings.difficulty })
                  setLongQs(d.result || '')
                })} busy={busy} />}
                {tab === 'short' && <TextGenTab title="🎯 Short Questions" caption="Practice definitions, facts and short conceptual questions." button="✨ Generate Short Questions" value={shortQs} filename="studient-short-questions.docx" onGenerate={() => run('Generating short questions…', async () => {
                  const ctx = getRelevantChunks(docText, 'definitions facts terms concepts differences', 8)
                  const d = await generate('short-questions', ctx, { count: settings.questionCount })
                  setShortQs(d.result || '')
                })} busy={busy} />}
                {tab === 'difficulty' && <SimpleGenTab title="📊 Difficulty Analysis" caption="Find the topics that may require the most preparation." button="✨ Analyze Difficulty" value={difficultyText} onGenerate={() => run('Analyzing difficulty…', async () => {
                  const ctx = getRelevantChunks(docText, 'complex difficult advanced conceptual process', 8)
                  const d = await generate('difficulty', ctx, {})
                  setDifficultyText(removeNonacademicTopicRows(makeFormulasReadable(d.result || '')))
                })} busy={busy} />}
                {tab === 'test' && <PracticeTestTab {...{ quiz, quizIndex, setQuizIndex, quizAnswers, quizLocked, setQuizLocked, quizFinished, choice, setChoice, startTest, submitAnswer, finishTest, resetQuiz, incorrectQs, setQuiz, setQuizAnswers, setQuizFinished, setTestStartedAt, setTestTimedOut, remaining, settings, testResult, testTimedOut, docName, busy }} />}
                {tab === 'analytics' && <AnalyticsTab data={analytics} history={docHistory} />}
                {tab === 'mindmap' && <MindMapTab {...{ mindMap, setMindMap, docText, run, busy, mmRef }} />}
                {tab === 'plan' && <PlanTab {...{ studyPlan, setStudyPlan, docText, run, busy }} />}
                {tab === 'tutor' && <TutorTab {...{ tutorMessages, setTutorMessages, docText, run, busy }} />}
                {tab === 'materials' && <MaterialsTab {...{ material, setMaterial, materialType, setMaterialType, docText, run, busy }} />}
                {tab === 'paper' && <PaperTab {...{ samplePaper, setSamplePaper, docText, run, busy }} />}
                {tab === 'video' && <VideoTab {...{ videoPlan, setVideoPlan, videoConfig, setVideoConfig, videoSlides, setVideoSlides, videoNarration, setVideoNarration, docText, summary, videoTopics, run, busy }} />}
              {/* Loading skeleton lives in the results area (below the form /
                Generate button, where the result will land) — never above the
                form, so generating never pushes the form down. */}
              {busy && (
                <div className="skeleton" aria-hidden="true">
                  <div className="skel-line w70" /><div className="skel-line w90" /><div className="skel-line w55" /><div className="skel-card" />
                </div>
              )}
            </div>
          </>
        )}

        <footer className="footer">🧠 StudientAI — All rights reserved to Sharjeelsarwar-ai2</footer>
      </main>
      </div>
    </div>
  )
}

function CountUp({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const v = Number(value) || 0
    if (document.documentElement.dataset.motion === 'reduced') { setN(v); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t) => { const p = Math.min(1, (t - t0) / 900); setN(Math.round(v * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n.toLocaleString()}</>
}

function Dashboard({ data }) {
  return (
    <section className="dashboard">
      <div className="dash-head"><div><div className="kicker">Personal learning command center</div><h2>Welcome back to your study space</h2><p className="muted">Track your momentum, pick up where you left off, and make every session count.</p></div>
        <div className="dash-next"><span>Next best step</span><b>✨ {data.recommended}</b></div></div>
      <div className="dash-grid">
        <div className="dash-gauge" data-accent="teal"><div className="orb" style={{ '--p': data.readiness }}><div className="orb-in"><span className="orb-n">{data.readiness}%</span><span className="orb-l">readiness</span></div></div>
          <div><div className="kicker">EXAM READINESS</div><b>Build confident recall</b><p className="muted small">Your readiness grows as you summarize, practice, and review.</p></div></div>
        <div className="dash-stat anim-rise" data-accent="rose" style={{ animationDelay: '0.05s' }}><span>🔥</span><b><CountUp value={data.streak} /> day</b><small>study streak</small></div>
        <div className="dash-stat anim-rise" data-accent="gold" style={{ animationDelay: '0.1s' }}><span>✅</span><b><CountUp value={data.totalQuestions} /></b><small>questions completed</small></div>
        <div className="dash-stat anim-rise" data-accent="coral" style={{ animationDelay: '0.15s' }}><span>🎴</span><b><CountUp value={data.mastered} />/<CountUp value={data.currentCards} /></b><small>flashcards mastered</small></div>
        <div className="dash-stat anim-rise" data-accent="teal" style={{ animationDelay: '0.2s' }}><span>🏆</span><b><CountUp value={data.bestScore} />%</b><small>best test score</small></div>
      </div>
      <div className="dash-insights">
        <span data-accent="teal">Average score <b><CountUp value={data.average} />%</b></span>
        <span data-accent="coral">Trend <b className={data.improvement >= 0 ? 'pos' : 'neg'}>{data.improvement >= 0 ? '+' : ''}{data.improvement}%</b></span>
        <span data-accent="gold">Study sessions <b>{data.sessions}</b></span>
        <span data-accent="rose">Due today <b>{data.dueToday}</b></span>
        <span data-accent="teal">Focus next <b>{data.weakest}</b></span>
      </div>
      <div className="dash-cols">
        <div data-accent="teal"><div className="dash-sec">Recent documents</div>
          {data.recentDocs.length ? data.recentDocs.map(([n, s]) => <div key={n} className="dash-row"><span>📄 {n}</span><span>{(s || '').slice(0, 10) || 'Recently'}</span></div>) : <div className="muted">Upload a document to begin your study journey.</div>}
        </div>
        <div data-accent="coral"><div className="dash-sec">Recently generated summaries</div>
          {data.recentSummaries.length ? data.recentSummaries.map((s, i) => <div key={i} className="dash-sum"><b>{s.document}</b><span>{stripMarkdown(s.preview)}</span></div>) : <div className="muted">Your generated summaries will appear here.</div>}
        </div>
      </div>
    </section>
  )
}

function Launchpad({ sections, onOpen }) {
  return (
    <div className="launchpad" id="launchpad">
      <div className="launch-head">
        <div><div className="kicker">Your AI toolkit</div><h2>What do you want to do next?</h2></div>
        <p className="muted">Seventeen tools, grouped by how you study. Pick one — everything runs on the documents in your workspace.</p>
      </div>
      {sections.map((s, si) => (
        <section key={s.id} className="fam-panel anim-rise" data-accent={s.accent} style={{ animationDelay: `${si * 0.08}s` }}>
          <header className="fam-head">
            <span className="fam-icon">{s.label.split(' ')[0]}</span>
            <div><h3>{s.label.replace(/^[^\s]+\s/, '')}</h3><p className="muted small">{s.sub}</p></div>
            <span className="fam-count">{s.tabs.length} tools</span>
          </header>
          <div className="tool-grid">
            {s.tabs.map((t, ti) => (
              <button key={t.id} className="tool-card anim-rise" style={{ animationDelay: `${0.05 + (si * 3 + ti) * 0.04}s` }} onClick={() => onOpen(s.id, t.id)}>
                <span className="tool-icon">{t.label.split(' ')[0]}</span>
                <span className="tool-title">{t.label.replace(/^[^\s]+\s/, '')}</span>
                <span className="tool-desc">{t.desc}</span>
                <span className="tool-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/* ChatGPT-style generating indicator: a rounded strip with animated three
   dots, rendered directly below the executing button. Replaces the old
   centred modal. Renders only while a generation is running; the form
   above the button never moves. */
function GenStrip({ busy }) {
  if (!busy) return null
  const label = busy.charAt(0).toLowerCase() + busy.slice(1)
  return (
    <div className="gen-strip" role="status" aria-live="polite">
      <span className="gen-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>Studient is {label}</span>
    </div>
  )
}

function SummaryTab(p) {
  return (
    <div>
      <h2>📚 Chapter Summary</h2>
      <p className="muted">Generate a complete learning guide from every extracted slide, page, or document section.</p>
      <div className="grid2">
        <label className="field">Summary depth
          <select value={p.summaryDetail} onChange={(e) => p.setSummaryDetail(e.target.value)}><option>Brief</option><option>Detailed</option><option>Exam-focused</option></select>
        </label>
        <label className="field">Optional focus
          <input type="text" value={p.summaryFocus} onChange={(e) => p.setSummaryFocus(e.target.value)} placeholder="e.g. a specific chapter, topic, or formula to emphasize" />
        </label>
      </div>
      <button className="btn primary" onClick={p.genSummary} disabled={!!p.busy}>✨ Generate Summary</button>
      <GenStrip busy={p.busy} />
      {p.summary && (
        <>
          <div className="answer-head">📚 AI Study Summary</div>
          <Markdown text={p.summary} />
          <div className="btn-row">
            <button className="btn" onClick={() => downloadText(p.summary, 'studient-summary.md', 'text/markdown')}>⬇️ Download summary as Markdown</button>
            <button className="btn" onClick={() => exportPdf('Studient AI Study Summary', [[p.docName, p.summary]], 'studient-summary.pdf')}>⬇️ Download summary as PDF</button>
            <button className="btn" onClick={() => exportStudyPack({ workspaceText: p.docText, summary: p.summary, flashcards: p.flashcards, mindMap: p.mindMap, history: loadHistory() })}>📦 Download complete study pack</button>
          </div>
          <div className="card"><h3>🧭 What should we explore next?</h3><p className="muted">Start with this brief map, then choose one topic for a deeper NotebookLM-style explanation.</p>
            <div className="btn-row">
              {(p.suggestions || FALLBACK_SUGGESTIONS).slice(0, 3).map((s) => (
                <button key={s.label} className="btn" onClick={() => p.explainTopic(s.request)} disabled={!!p.busy}>{s.label}</button>
              ))}
            </div>
          </div>
          {p.topicExplanation && (
            <>
              <div className="answer-head">🧑‍🏫 Focused topic explanation</div>
              {p.followupRequest && <p className="muted small">Selected study prompt: {p.followupRequest}</p>}
              <Markdown text={p.topicExplanation} />
            </>
          )}
          <div className="audio-panel">
            <div className="audio-title">🔊 Listen to your study summary</div>
            <p className="muted small">Choose a language and let Studient AI read the summary aloud while you revise. Read aloud uses your browser's Web Speech API — no MP3 file is generated or downloaded (the Streamlit audio-download button has no equivalent here).</p>
            <div className="grid2">
              <label className="field">Reading language
                <select value={p.speechLang} onChange={(e) => p.setSpeechLang(e.target.value)}><option>English</option><option>Hindi</option><option>Urdu</option><option>Spanish</option><option>French</option></select>
              </label>
              <div><button className="btn primary" onClick={p.readAloud}>{p.speaking ? '⏹ Stop reading' : '🎧 Read summary aloud'}</button></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SimpleGenTab({ title, caption, button, value, onGenerate, busy }) {
  return (
    <div>
      <h2>{title}</h2><p className="muted">{caption}</p>
      <button className="btn primary" onClick={onGenerate} disabled={!!busy}>{button}</button>
      <GenStrip busy={busy} />
      {value && <Markdown text={value} />}
    </div>
  )
}

function TextGenTab({ title, caption, button, value, filename, onGenerate, busy }) {
  return (
    <div>
      <h2>{title}</h2><p className="muted">{caption}</p>
      <button className="btn primary" onClick={onGenerate} disabled={!!busy}>{button}</button>
      <GenStrip busy={busy} />
      {value && <>
        <Markdown text={value} />
        <button className="btn" onClick={() => exportQuestionsDocx(value.split('\n').filter((l) => l.trim()), title.replace(/^[^\s]+\s/, ''), filename)}>⬇️ Export as DOCX</button>
      </>}
    </div>
  )
}

function AskTab(p) {
  return (
    <div>
      <h2>💬 Ask Workspace / Outside Knowledge</h2>
      <p className="muted">Ask questions grounded in your uploaded workspace, or optionally let Studient AI add clearly labeled general knowledge.</p>
      <label className="check"><input type="checkbox" checked={p.askGeneral} onChange={(e) => p.setAskGeneral(e.target.checked)} /> 💡 Include outside / general knowledge <span className="muted small">Off = strict, hallucination-safe answers grounded only in your PDF. On = the PDF is used as context, but the AI can add its own knowledge — answers clearly separate what came from your document vs. general knowledge.</span></label>
      <label className="field">Your question
        <input type="text" value={p.askQuestion} onChange={(e) => p.setAskQuestion(e.target.value)} placeholder="e.g. Explain the process of stellar evolution." />
      </label>
      <button className="btn primary" onClick={() => p.run('Searching your PDF and thinking…', async () => {
        if (!p.askQuestion.trim()) { return }
        const ctx = getRelevantChunks(p.docText, p.askQuestion, 7)
        const d = await generate('ask', ctx, { question: p.askQuestion, useGeneralKnowledge: p.askGeneral })
        p.setAskAnswer(d.result || '')
      })} disabled={!!p.busy}>🤖 Ask Studient</button>
      <GenStrip busy={p.busy} />
      {p.askAnswer && <><div className="answer-head">{p.askGeneral ? '🤖 StudientAI Answer (PDF + general knowledge)' : '🤖 StudientAI Answer'}</div><Markdown text={p.askAnswer} /></>}
    </div>
  )
}

function FlashcardsTab(p) {
  const due = p.flashcards ? dueReviewCards(p.reviewState, p.flashcards, p.docName) : []
  const mastered = p.flashcards ? p.flashcards.filter((c) => getReviewCard(p.reviewState, c, p.docName).box >= 5).length : 0
  return (
    <div>
      <h2>🎴 Visual Flashcards</h2>
      <p className="muted">Click a card to flip it and reveal a visual explanation of the concept.</p>
      <button className="btn primary" onClick={() => p.run('Creating your visual flashcards…', async () => {
        const ctx = getRelevantChunks(p.docText, 'definitions concepts important terms facts explanations processes', 8, 12000)
        const d = await generate('flashcards', ctx, { count: p.settings.questionCount, difficulty: p.settings.difficulty })
        if (d.result?.length) { p.setFlashcards(d.result) } else { throw new Error('GENERATION_FAILED') }
      })} disabled={!!p.busy}>✨ Generate Visual Flashcards</button>
      <GenStrip busy={p.busy} />
      {p.flashcards && (
        <>
          <p className="alert ok">Created {p.flashcards.length} visual flashcards!</p>
          <div className="fc-grid">
            {p.flashcards.map((c, i) => (
              <Flashcard key={i} card={c} index={i} review={getReviewCard(p.reviewState, c, p.docName)} onRate={(card, rating) => {
                const next = { ...p.reviewState }
                rateReviewCard(next, card, p.docName, rating)
                p.setReviewState(next)
              }} />
            ))}
          </div>
          <h3>Daily review queue · <b>{due.length} due today</b></h3>
          <p className="muted small">Mastered {mastered}/{p.flashcards.length} cards · Rate each card after reviewing it to schedule the next session (Leitner boxes 1–5).</p>
          <div className="btn-row">
            <button className="btn" onClick={() => exportFlashcardsCsv(p.flashcards, p.reviewState, p.docName, (c) => getReviewCard(p.reviewState, c, p.docName))}>⬇️ Export flashcards as CSV</button>
            <button className="btn" onClick={() => exportFlashcardsPdf(p.flashcards)}>⬇️ Export flashcards as PDF</button>
          </div>
        </>
      )}
    </div>
  )
}

function McqTab(p) {
  return (
    <div>
      <h2>❓ Multiple Choice Questions</h2>
      <p className="muted">Generate exam-style MCQs with answers and explanations.</p>
      <button className="btn primary" onClick={() => p.run('Generating your MCQs…', async () => {
        const ctx = getRelevantChunks(p.docText, 'important exam concepts facts definitions processes', 10, 12000)
        const d = await generate('quiz', ctx, { count: p.settings.questionCount, difficulty: p.settings.difficulty, category: 'Mixed' })
        if (d.result?.length) p.setMcqs(d.result)
      })} disabled={!!p.busy}>✨ Generate MCQs</button>
      <GenStrip busy={p.busy} />
      {p.mcqs && p.mcqs.map((q, i) => (
        <details key={i} className="mcq"><summary>Q{i + 1}. {q.question}</summary>
          {Object.entries(q.options).map(([l, t]) => <p key={l}><b>{l})</b> {t}</p>)}
          <p className="alert ok">Correct Answer: {q.correct} — {q.explanation}</p>
        </details>
      ))}
      {p.mcqs && <button className="btn" onClick={() => exportQuestionsDocx(p.mcqs, 'Studient AI MCQs', 'studient-mcqs.docx')}>⬇️ Export MCQs as DOCX</button>}
    </div>
  )
}

function QuestionsTab(p) {
  return (
    <div>
      <h2>📝 Important Exam Questions</h2>
      <p className="muted">Generate questions based strictly on your uploaded material.</p>
      <button className="btn primary" onClick={() => p.run('Finding the most important questions…', async () => {
        const ctx = getRelevantChunks(p.docText, 'important concepts topics definitions processes exam', 8)
        const d = await generate('important-questions', ctx, { count: p.settings.questionCount, difficulty: p.settings.difficulty })
        const lines = (d.result || '').split('\n').map((l) => l.trim()).filter(Boolean)
        p.setImportantQs(lines.slice(0, p.settings.questionCount))
      })} disabled={!!p.busy}>✨ Generate Important Questions</button>
      <GenStrip busy={p.busy} />
      {p.importantQs && p.importantQs.map((q, i) => <div key={i} className="question-row"><div className="label">Question {i + 1}</div><p>{q}</p></div>)}
      {p.importantQs && <button className="btn" onClick={() => exportQuestionsDocx(p.importantQs, 'Important Exam Questions', 'studient-important-questions.docx')}>⬇️ Export questions as DOCX</button>}
    </div>
  )
}

function PracticeTestTab(p) {
  if (!p.quiz) {
    return (
      <div>
        <h2>🧪 Practice Test</h2>
        <p className="muted">Answers are hidden until you submit each question — no peeking.</p>
        {p.incorrectQs.length > 0 && <button className="btn" onClick={() => { p.setQuiz(p.incorrectQs); p.setQuizIndex(0); p.setQuizAnswers([]); p.setQuizLocked(false); p.setQuizFinished(false); p.setChoice(''); p.setTestStartedAt(Date.now()); p.setTestTimedOut(false) }}>🔁 Retake Incorrect Questions</button>}
        <button className="btn primary rose" onClick={p.startTest}>🚀 Start New Test</button>
        <GenStrip busy={p.busy} />
      </div>
    )
  }
  if (!p.quizFinished) {
    const q = p.quiz[p.quizIndex]
    const last = p.quizAnswers[p.quizAnswers.length - 1]
    return (
      <div>
        <h2>🧪 Practice Test</h2>
        <p className="muted">Answers are hidden until you submit each question — no peeking.</p>
        {p.settings.timedMode && p.remaining !== null && (
          <div className="timer"><div className="timer-bar" style={{ width: `${(p.remaining / (p.settings.testTimeLimit * 60)) * 100}%` }} /><span>Time remaining: {String(Math.floor(p.remaining / 60)).padStart(2, '0')}:{String(p.remaining % 60).padStart(2, '0')}</span></div>
        )}
        <div className="quiz-progress">Question {p.quizIndex + 1} of {p.quiz.length}</div>
        <div className="quiz-topic">{q.topic}</div>
        <div className="quiz-q">{q.question}</div>
        <div className="options" role="radiogroup">
          {Object.entries(q.options).map(([letter, text]) => (
            <label key={letter} className={`option ${p.choice === letter ? 'selected' : ''} ${p.quizLocked ? 'disabled' : ''}`}>
              <input type="radio" name="quiz-choice" value={letter} checked={p.choice === letter} disabled={p.quizLocked} onChange={() => p.setChoice(letter)} />
              {letter}) {text}
            </label>
          ))}
        </div>
        {!p.quizLocked ? (
          <button className="btn primary rose" onClick={p.submitAnswer} disabled={!p.choice}>✅ Submit Answer</button>
        ) : (
          <>
            {last?.correct ? <p className="result-correct">✔ Correct!</p> : <p className="result-wrong">✘ Not quite — correct answer: {q.correct}</p>}
            <p className="muted">{q.explanation}</p>
            {p.quizIndex + 1 < p.quiz.length ? (
              <button className="btn primary rose" onClick={() => { p.setQuizIndex(p.quizIndex + 1); p.setQuizLocked(false); p.setChoice('') }}>➡️ Next Question</button>
            ) : (
              <button className="btn primary rose" onClick={p.finishTest}>🏁 Finish Test</button>
            )}
          </>
        )}
      </div>
    )
  }
  const r = p.testResult
  return (
    <div>
      <h2>🧪 Practice Test — Results</h2>
      <div className="score-hero">
        <div className="big">{r.points % 1 === 0 ? r.points : r.points.toFixed(2)}/{r.total}</div>
        <div className="pct">{r.pct}% — {r.verdict}{p.testTimedOut ? ' Time expired.' : ''}</div>
        <div className="muted small">{r.adaptive}</div>
      </div>
      {p.settings.negativeMarking && <p className="muted small">Negative marking enabled: {r.penalty.toFixed(2)} point(s) deducted.</p>}
      {p.incorrectQs.length > 0 && <p><b>{p.incorrectQs.length} incorrect question(s)</b> are ready for a focused retake.</p>}
      {p.quizAnswers.filter((a) => !a.correct).map((a, i) => (
        <details key={i} className="mcq"><summary>Review incorrect answer: {a.question.question}</summary>
          <p>Correct answer: <b>{a.question.correct}</b></p><p className="muted">{a.question.explanation}</p>
        </details>
      ))}
      <button className="btn" onClick={() => exportPdf(`Studient AI Practice Test — ${r.pct}%`, p.quizAnswers.map((a, i) => [`Question ${i + 1}: ${a.question.question}`, `Your answer: ${a.chosen || 'Not answered'}\nCorrect answer: ${a.question.correct}\nExplanation: ${a.question.explanation}`]), 'studient-practice-test.pdf')}>⬇️ Export practice test as PDF</button>
      <div className="grid2">
        <div><b>Weak topics</b><div className="tags">{r.weak.length ? r.weak.map((t) => <span key={t} className="tag-weak">{t}</span>) : <i>None — nice.</i>}</div></div>
        <div><b>Strong topics</b><div className="tags">{r.strong.length ? r.strong.map((t) => <span key={t} className="tag-strong">{t}</span>) : <i>None yet.</i>}</div></div>
      </div>
      <button className="btn primary rose" onClick={p.resetQuiz}>🔄 Take Another Test</button>
    </div>
  )
}

function AnalyticsTab({ data, history }) {
  if (!history.length) return <div><h2>📈 Study Analytics</h2><div className="card"><p>No test attempts yet for this document. Take a Practice Test to see your analytics here.</p></div></div>
  const masteryPct = data.cards ? Math.round((data.mastered / data.cards) * 100) : 0
  return (
    <div>
      <h2>📈 Study Analytics</h2>
      <div className="metrics5">
        <div className="metric"><span>Average score</span><b>{data.average}%</b></div>
        <div className="metric"><span>Improvement</span><b>{data.improvement >= 0 ? '+' : ''}{data.improvement}%</b></div>
        <div className="metric"><span>Questions</span><b>{data.questions}</b></div>
        <div className="metric"><span>Sessions</span><b>{data.sessions}</b></div>
        <div className="metric"><span>Study time</span><b>{data.studyTime.toFixed(1)} min</b></div>
      </div>
      <h3>Score improvement over time</h3>
      <LineChart values={data.scores} />
      <p className="muted small">Accessible chart description: each point represents your percentage score for a completed practice test, ordered from oldest to newest.</p>
      {data.improvement > 0 ? <p className="alert ok">Your score improved by {data.improvement}% across your recorded attempts.</p>
        : data.improvement < 0 ? <p className="alert info">Your score changed by {data.improvement}%. Review the weakest concepts before retaking the test.</p> : null}
      <h3>Topic-level accuracy</h3>
      <BarChart data={data.topicAccuracy} />
      <p className="muted small">Accessible chart description: topic accuracy from lowest to highest. {Object.entries(data.topicAccuracy).sort((a, b) => a[1] - b[1]).map(([t, a]) => `${t}: ${a}%`).join(' · ')}</p>
      <h3>Flashcard mastery</h3>
      <div className="progress"><div style={{ width: `${masteryPct}%` }} /></div>
      <p className="muted small">{data.mastered}/{data.cards} mastered · {masteryPct}%</p>
      <h3>Recommended next topic</h3>
      <p className="alert info">Review <b>{data.weakest}</b> next, then practice the related flashcards before your next test.</p>
      <p className="muted small">Analytics are stored locally in this browser and reset if local data is deleted.</p>
    </div>
  )
}

// A usable mind map is an object with a non-empty root label and at least
// one labelled branch. Anything else (raw string, {title, children: []},
// empty label) must never reach the tree — it renders as a single
// unlabeled node, which looks like a successful empty map.
function isValidMindMap(m) {
  return !!(m && typeof m === 'object' && typeof m.label === 'string' && m.label.trim()
    && Array.isArray(m.children) && m.children.length > 0
    && m.children.some((c) => c && typeof c.label === 'string' && c.label.trim()))
}
function emptyMindMapError() {
  const e = new Error('EMPTY_MINDMAP'); e.code = 'EMPTY_MINDMAP'; return e
}

function MindMapTab(p) {
  return (
    <div>
      <h2>🧠 Interactive Mind Map</h2>
      <p className="muted">Turn your uploaded material into a visual, collapsible concept hierarchy.</p>
      <button className="btn primary" onClick={() => p.run('Mapping the key ideas in your document…', async () => {
        const ctx = getRelevantChunks(p.docText, 'main topics concepts definitions processes examples relationships causes effects overview', 10, 14000)
        const fetchMap = async () => {
          const d = await generate('mindmap', ctx, {})
          if (!isValidMindMap(d.result)) throw emptyMindMapError()
          return d.result
        }
        let map = null
        try { map = await fetchMap() }
        catch (e) {
          // One automatic retry for an empty/invalid map only — then the
          // error below is shown with the Generate button as the retry.
          if (e.code === 'EMPTY_MINDMAP') map = await fetchMap()
          else throw e
        }
        p.setMindMap(map)
      })} disabled={!!p.busy}>✨ Generate Interactive Mind Map</button>
      <GenStrip busy={p.busy} />
      {p.mindMap && (
        <>
          <MindMap map={p.mindMap} svgRef={p.mmRef} />
          <div className="btn-row">
            <button className="btn" onClick={() => downloadText(JSON.stringify(p.mindMap, null, 2), 'studient-mind-map.json', 'application/json')}>⬇️ Export mind map as JSON</button>
            <button className="btn" onClick={async () => {
              const { exportMindMapPng } = await import('./lib/exports.js')
              // PNG is rendered from the tree as an SVG snapshot via canvas:
              const el = p.mmRef.current
              if (!el) return
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
              svg.setAttribute('width', '1200'); svg.setAttribute('height', '800')
              const lines = []
              const walk = (n, d = 0) => { lines.push('  '.repeat(d) + (d ? '• ' : '') + n.label); (n.children || []).forEach((c) => walk(c, d + 1)) }
              walk(p.mindMap)
              const text = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text')
              text.setAttribute('x', '40'); text.setAttribute('y', '40'); text.setAttribute('font-size', '18'); text.setAttribute('fill', '#1C2B26')
              lines.forEach((l, i) => { const t = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan'); t.setAttribute('x', '40'); t.setAttribute('dy', i === 0 ? '0' : '30'); t.textContent = l.slice(0, 110); text.appendChild(t) })
              svg.appendChild(text)
              await exportMindMapPng(svg)
            }}>⬇️ Export mind map as PNG</button>
          </div>
        </>
      )}
      {!p.mindMap && <div className="card"><p>Generate a mind map to explore your document visually. Each branch is grounded in the uploaded material.</p></div>}
    </div>
  )
}

function PlanTab(p) {
  const [examDate, setExamDate] = useState(() => { const d = new Date(Date.now() + 14 * 86400000); return d.toISOString().slice(0, 10) })
  const [grade, setGrade] = useState('B / Good')
  const [hours, setHours] = useState(2)
  const [weak, setWeak] = useState('')
  const [schedule, setSchedule] = useState(['Evening', 'Weekdays'])
  return (
    <div>
      <h2>🗓️ Personalized Study Plan</h2>
      <p className="muted">Turn your exam date, goals, availability, and weak topics into a practical daily plan grounded in your workspace.</p>
      <div className="grid2">
        <label className="field">Exam date<input type="date" value={examDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} /></label>
        <label className="field">Target grade
          <select value={grade} onChange={(e) => setGrade(e.target.value)}><option>Pass</option><option>B / Good</option><option>A / Excellent</option><option>A+ / Distinction</option></select>
        </label>
        <label className="field">Available hours per day<input type="number" min="0.5" max="12" step="0.5" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 2)} /></label>
        <label className="field">Weak subjects or topics<textarea value={weak} onChange={(e) => setWeak(e.target.value)} placeholder="e.g. cellular respiration, processes, formulas" rows={2} /></label>
      </div>
      <fieldset className="field"><legend>Preferred study schedule</legend>
        {['Morning', 'Afternoon', 'Evening', 'Weekdays', 'Weekends', 'Short focused sessions'].map((s) => (
          <label key={s} className="check"><input type="checkbox" checked={schedule.includes(s)} onChange={() => setSchedule(schedule.includes(s) ? schedule.filter((x) => x !== s) : [...schedule, s])} /> {s}</label>
        ))}
      </fieldset>
      <button className="btn primary" onClick={() => p.run('Designing your personalized plan…', async () => {
        const daysLeft = Math.max(1, Math.round((new Date(examDate) - new Date()) / 86400000))
        const ctx = getRelevantChunks(p.docText, weak || 'all major topics', 8)
        const d = await generate('study-plan', ctx, { examDate, daysLeft, targetGrade: grade, hoursPerDay: hours, weakSubjects: weak, schedule: schedule.join(', ') })
        p.setStudyPlan(d.result || '')
      })} disabled={!!p.busy}>✨ Generate my study plan</button>
      <GenStrip busy={p.busy} />
      {p.studyPlan && <><div className="answer-head">🗓️ Your personalized study plan</div><Markdown text={p.studyPlan} />
        <button className="btn" onClick={() => downloadText(p.studyPlan, 'studient-study-plan.md', 'text/markdown')}>⬇️ Download study plan</button></>}
    </div>
  )
}

function TutorTab(p) {
  const [level, setLevel] = useState('Intermediate')
  const [mode, setMode] = useState('Socratic questions')
  const [question, setQuestion] = useState('')
  return (
    <div>
      <h2>🧑‍🏫 AI Tutor</h2>
      <p className="muted">Learn through guided questions, progressive hints, and explanations grounded in your workspace.</p>
      <div className="grid2">
        <label className="field">Your level
          <select value={level} onChange={(e) => setLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>University exam</option></select>
        </label>
        <label className="field">Tutor mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}><option>Socratic questions</option><option>Progressive hints</option><option>Explain with analogies</option></select>
        </label>
      </div>
      <div className="chat">
        {p.tutorMessages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}><b>{m.role === 'user' ? 'You' : 'Tutor'}</b><Markdown text={m.content} /></div>
        ))}
      </div>
      <label className="field">Ask your tutor
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="I don't understand how this process works..." rows={3} />
      </label>
      <div className="btn-row">
        <button className="btn primary" onClick={() => p.run('Thinking through your question…', async () => {
          if (!question.trim()) return
          const ctx = getRelevantChunks(p.docText, question, 7)
          const previous = p.tutorMessages.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')
          const d = await generate('tutor', ctx, { question, level, mode, previous })
          if (d.result) { p.setTutorMessages([...p.tutorMessages, { role: 'user', content: question }, { role: 'assistant', content: d.result }]); setQuestion('') }
        })} disabled={!!p.busy}>🧑‍🏫 Ask tutor</button>
        {p.tutorMessages.length > 0 && <button className="btn" onClick={() => p.setTutorMessages([])}>🧹 Clear tutor conversation</button>}
      </div>
      <GenStrip busy={p.busy} />
    </div>
  )
}

function MaterialsTab(p) {
  const [focus, setFocus] = useState('')
  const [depth, setDepth] = useState('Quick revision')
  const [type, setType] = useState('Cheat sheet')
  return (
    <div>
      <h2>🧰 Study Materials Lab</h2>
      <p className="muted">Generate focused revision assets only when you need them, keeping large workspaces fast and uncluttered.</p>
      <label className="field">Material type
        <select value={type} onChange={(e) => setType(e.target.value)}>{MATERIAL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <label className="field">Focus topic (optional)<input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. photosynthesis, Chapter 3, or all major concepts" /></label>
      <label className="field">Depth
        <select value={depth} onChange={(e) => setDepth(e.target.value)}><option>Quick revision</option><option>Exam-ready</option><option>Deep study</option></select>
      </label>
      <button className="btn primary" onClick={() => p.run(`Creating your ${type.toLowerCase()}…`, async () => {
        const ctx = getRelevantChunks(p.docText, focus || 'all important topics', 8, 10000)
        const d = await generate('material', ctx, { materialType: type, focus, difficulty: depth })
        p.setMaterial(d.result || ''); p.setMaterialType(type)
      })} disabled={!!p.busy}>✨ Generate study material</button>
      <GenStrip busy={p.busy} />
      {p.material && <><div className="answer-head">🧰 {p.materialType}</div><Markdown text={p.material} />
        <button className="btn" onClick={() => downloadText(p.material, `studient-${p.materialType.toLowerCase().replace(/ /g, '-')}.md`, 'text/markdown')}>⬇️ Download study material</button></>}
    </div>
  )
}

function PaperTab(p) {
  const [duration, setDuration] = useState(120)
  const [marks, setMarks] = useState(100)
  const [difficulty, setDifficulty] = useState('Balanced university level')
  const [sections, setSections] = useState(['MCQs', 'Short answers', 'Long answers'])
  const [instructions, setInstructions] = useState('')
  return (
    <div>
      <h2>📝 University Sample Paper</h2>
      <p className="muted">Generate a complete exam-style paper from important questions across your entire study workspace, including a model-answer key.</p>
      <div className="grid2">
        <label className="field">Exam duration (minutes)<input type="number" min="30" max="300" step="15" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 120)} /></label>
        <label className="field">Total marks<input type="number" min="20" max="200" step="10" value={marks} onChange={(e) => setMarks(parseInt(e.target.value, 10) || 100)} /></label>
        <label className="field">Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option>Balanced university level</option><option>Challenging</option><option>Revision-friendly</option><option>Final exam level</option></select>
        </label>
      </div>
      <fieldset className="field"><legend>Section mix</legend>
        {['MCQs', 'Short answers', 'Long answers', 'Problems / calculations', 'Case analysis', 'Essay questions'].map((s) => (
          <label key={s} className="check"><input type="checkbox" checked={sections.includes(s)} onChange={() => setSections(sections.includes(s) ? sections.filter((x) => x !== s) : [...sections, s])} /> {s}</label>
        ))}
      </fieldset>
      <label className="field">Additional exam instructions<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Include questions from every chapter and emphasize processes." rows={2} /></label>
      <button className="btn primary" onClick={() => p.run('Building your university-style sample paper…', async () => {
        const ctx = getRelevantChunks(p.docText, 'all important exam questions concepts definitions processes formulas examples', 18, 24000)
        const d = await generate('sample-paper', ctx, { durationMinutes: duration, totalMarks: marks, difficulty, sectionMix: sections.join(', '), instructions })
        p.setSamplePaper(d.result || '')
      })} disabled={!!p.busy}>✨ Generate full sample paper</button>
      <GenStrip busy={p.busy} />
      {p.samplePaper && <><div className="answer-head">📝 University sample paper with model answers</div><Markdown text={p.samplePaper} />
        <button className="btn" onClick={() => downloadText(p.samplePaper, 'studient-university-sample-paper.md', 'text/markdown')}>⬇️ Download sample paper</button></>}
    </div>
  )
}

function VideoTab(p) {
  const topicChoices = ['Full course', ...p.videoTopics, 'Custom topic']
  const vc = p.videoConfig
  const setVc = (patch) => p.setVideoConfig({ ...vc, ...patch })
  const topic = vc.topic === 'Custom topic' && vc.customTopic.trim() ? vc.customTopic.trim() : vc.topic
  return (
    <div>
      <h2>🎥 AI Video Overview</h2>
      <p className="muted">Create a NotebookLM-style narrated storyboard from your workspace, then present it as a narrated slide show in your browser.</p>
      <div className="grid2">
        <label className="field">Video format
          <select value={vc.format} onChange={(e) => setVc({ format: e.target.value })}>{VIDEO_FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
        <label className="field">Narration language
          <select value={vc.language} onChange={(e) => setVc({ language: e.target.value })}><option>English</option><option>Urdu</option><option>Urdu-English mix</option><option>Hindi</option></select>
        </label>
        <label className="field">Topic
          <select value={vc.topic} onChange={(e) => setVc({ topic: e.target.value })}>{topicChoices.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="field">Custom topic
          <input type="text" value={vc.customTopic} disabled={vc.topic !== 'Custom topic'} onChange={(e) => setVc({ customTopic: e.target.value })} placeholder="Used when Topic is Custom topic" />
        </label>
        <label className="field">Visual style
          <select value={vc.visualStyle} onChange={(e) => setVc({ visualStyle: e.target.value })}>{VIDEO_STYLES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="field">Speaking rate: <b>{vc.rate.toFixed(2)}×</b>
          <input type="range" min="0.75" max="1.25" step="0.05" value={vc.rate} onChange={(e) => setVc({ rate: parseFloat(e.target.value) })} />
        </label>
      </div>
      <p className="muted small">Voice: clear male university instructor · technical terms are spoken slowly and clearly</p>
      <div className="alert info">First generate and review the grounded narration plan, then present it as a narrated slide show in your browser. No MP4 file is rendered — serverless video rendering (ffmpeg) is not available on Vercel.</div>
      <button className="btn primary" onClick={() => p.run('Designing your educational video overview…', async () => {
        if (vc.topic === 'Custom topic' && !vc.customTopic.trim()) return
        const query = topic === 'Full course' ? 'all major academic topics definitions processes formulas in this material' : topic
        const ctx = getRelevantChunks(p.docText, query, 12, 18000)
        const d = await generate('video-plan', ctx, { format: vc.format, language: vc.language, topic, visualStyle: vc.visualStyle })
        p.setVideoPlan(removeNonacademicTopicRows(makeFormulasReadable(d.result || '')))
        p.setVideoSlides(null); p.setVideoNarration('')
      })} disabled={!!p.busy}>🎬 Generate Video Overview Plan</button>
      <GenStrip busy={p.busy} />
      {p.videoPlan && (
        <>
          <div className="answer-head">🎬 Your Video Overview Storyboard</div>
          <Markdown text={p.videoPlan} />
          <div className="btn-row">
            <button className="btn" onClick={() => downloadText(p.videoPlan, 'studient-video-overview.md', 'text/markdown')}>⬇️ Download video overview script</button>
            <button className="btn primary" onClick={() => p.run('Building your narrated slide presentation…', async () => {
              const n = await generate('video-narration', '', { plan: p.videoPlan, language: vc.language })
              const narration = (n.result || '').trim()
              p.setVideoNarration(narration)
              try {
                const s = await generate('video-slides', '', { spoken: narration, topic, language: vc.language, contentCount: 5 })
                const arr = Array.isArray(s.result) ? s.result : null
                if (arr?.length) {
                  const agendaTitle = { English: "What we'll cover", Urdu: 'آج کیا پڑھیں گے', 'Urdu-English mix': 'آج کیا پڑھیں گے', Hindi: 'आज क्या सीखेंगे' }[vc.language] || "What we'll cover"
                  p.setVideoSlides([{ title: agendaTitle, bullets: arr.map((x) => x.title).slice(0, 6) }, ...arr])
                } else throw new Error('no slides')
              } catch {
                // Fallback: build slides from narration sentences (same rule as app.py _fallback_bullet_slides).
                const sentences = narration.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
                const per = Math.max(1, Math.round(sentences.length / 5))
                const groups = []
                for (let i = 0; i < sentences.length; i += per) groups.push(sentences.slice(i, i + per))
                const slides = groups.slice(0, 5).map((g, i) => ({
                  title: i === 0 ? topic : g[0].split(' ').slice(0, 7).join(' '),
                  bullets: g.slice(0, 4).map((s) => (s.length > 70 ? s.slice(0, 70) + '…' : s)),
                }))
                const agendaTitle = { English: "What we'll cover", Urdu: 'آج کیا پڑھیں گے', 'Urdu-English mix': 'آج کیا پڑھیں گے', Hindi: 'आज क्या सीखेंगे' }[vc.language] || "What we'll cover"
                p.setVideoSlides([{ title: agendaTitle, bullets: slides.map((s) => s.title) }, ...slides])
              }
            })} disabled={!!p.busy}>🎞️ Present as narrated slides</button>
          </div>
          <GenStrip busy={p.busy} />
          {p.videoSlides && <VideoPlayer slides={p.videoSlides} narration={p.videoNarration} language={vc.language} rate={vc.rate} onRateChange={(r) => setVc({ rate: r })} topic={topic} />}
        </>
      )}
    </div>
  )
}
