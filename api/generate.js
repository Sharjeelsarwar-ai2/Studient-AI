// POST /api/generate  { task, context, params }
// Builds the exact prompt server-side (api/_prompts.js) and calls Groq.
// Groq key ONLY from process.env.GROQ_API_KEY. Never a VITE_* key.
// Stub mode (local testing ONLY): STUDIENT_STUB_GROQ=1 returns canned
// responses so the UI can be exercised end to end without a key.
import {
  MODEL, TEMPERATURE, QUIZ_SYSTEM_MSG, FLASHCARD_SYSTEM_MSG, MIND_MAP_SYSTEM_MSG,
  MAX_TOKENS, summaryBatchPrompt, summaryFinalPrompt, suggestionsPrompt,
  explainTopicPrompt, videoPlanPrompt, videoNarrationPrompt, storyboardPrompt,
  quizPrompt, flashcardsPrompt, mindMapPrompt, studyPlanPrompt, tutorPrompt,
  materialPrompt, samplePaperPrompt, importantQuestionsPrompt, longQuestionsPrompt,
  shortQuestionsPrompt, conceptsPrompt, difficultyPrompt, askPrompt, translateSummaryPrompt,
} from './_prompts.js'

const STUB_QUIZ = [
  { question: 'What is photosynthesis?', options: { A: 'Process by which plants make food using sunlight', B: 'Process by which animals breathe', C: 'A type of rock formation', D: 'A chemical used in labs' }, correct: 'A', explanation: 'Photosynthesis converts light energy into chemical energy in plants.', topic: 'Photosynthesis' },
  { question: 'Which pigment captures sunlight in leaves?', options: { A: 'Melanin', B: 'Haemoglobin', C: 'Chlorophyll', D: 'Carotene' }, correct: 'C', explanation: 'Chlorophyll in chloroplasts absorbs light, mainly red and blue.', topic: 'Chlorophyll' },
  { question: 'Where does photosynthesis take place?', options: { A: 'Mitochondria', B: 'Chloroplast', C: 'Nucleus', D: 'Ribosome' }, correct: 'B', explanation: 'The chloroplast is the site of photosynthesis in plant cells.', topic: 'Chloroplast' },
  { question: 'What gas is released during photosynthesis?', options: { A: 'Carbon dioxide', B: 'Nitrogen', C: 'Oxygen', D: 'Hydrogen' }, correct: 'C', explanation: 'Oxygen is released as a by-product of the light reactions.', topic: 'Photosynthesis' },
  { question: 'What is the main product of photosynthesis?', options: { A: 'Protein', B: 'Glucose', C: 'Fat', D: 'Starch only' }, correct: 'B', explanation: 'Glucose is the main energy-rich product, later stored as starch.', topic: 'Photosynthesis' },
]
const STUB_CARDS = [
  { front: 'What is photosynthesis?', topic: 'Photosynthesis', visual_type: 'definition', visual_title: 'Photosynthesis', visual_items: ['Plants convert light energy into chemical energy', 'Uses sunlight, water and carbon dioxide', 'Produces glucose and oxygen'] },
  { front: 'Steps of photosynthesis?', topic: 'Photosynthesis', visual_type: 'process', visual_title: 'How it works', visual_items: ['Light is absorbed by chlorophyll', 'Water is split, releasing oxygen', 'Energy builds glucose from CO2'] },
  { front: 'Chlorophyll vs carotene?', topic: 'Pigments', visual_type: 'comparison', visual_title: 'Leaf pigments', visual_items: ['Chlorophyll absorbs red and blue light', 'Gives leaves their green colour', 'VS', 'Carotene absorbs blue-green light', 'Gives orange and yellow colours'] },
  { front: 'Key photosynthesis formula?', topic: 'Formula', visual_type: 'formula', visual_title: 'The equation', visual_items: ['6CO2 + 6H2O → C6H12O6 + 6O2', 'Inputs: carbon dioxide and water', 'Outputs: glucose and oxygen'] },
  { front: 'Why does photosynthesis matter?', topic: 'Importance', visual_type: 'fact', visual_title: 'Why it matters', visual_items: ['Feeds nearly all life on Earth', 'Produces the oxygen we breathe', 'Foundation of food chains'] },
]
const STUB_MINDMAP = { label: 'Photosynthesis', children: [
  { label: 'Light reactions', children: [{ label: 'Chlorophyll absorbs light', children: [] }, { label: 'Water splits, oxygen released', children: [] }] },
  { label: 'Calvin cycle', children: [{ label: 'Carbon fixation', children: [] }, { label: 'Glucose is built', children: [] }] },
  { label: 'Key factors', children: [{ label: 'Light intensity', children: [] }, { label: 'Carbon dioxide', children: [] }, { label: 'Temperature', children: [] }] },
  { label: 'Importance', children: [{ label: 'Oxygen production', children: [] }, { label: 'Food chains', children: [] }] },
] }
const STUB_MD = (title) => `# ${title}\n\n## Overview\nPhotosynthesis is the process by which green plants convert light energy into chemical energy. It takes place in the chloroplast, where chlorophyll captures sunlight.\n\n## Key points\n- **Definition:** Plants make glucose from carbon dioxide and water using sunlight.\n- **Formula:** 6CO2 + 6H2O → C6H12O6 + 6O2\n- **Site:** Chloroplast; pigment chlorophyll absorbs red and blue light.\n- **Importance:** Produces oxygen and feeds nearly all life on Earth.\n\n## Common confusion\nPhotosynthesis is not respiration — respiration releases energy from glucose, while photosynthesis stores energy in glucose.\n\n## Quiz-ready facts\n- Oxygen released comes from water, not carbon dioxide.\n- Glucose is later stored as starch.\n`
const STUB_SUMMARY = `# Photosynthesis — Study Guide\n\n## 1. Course overview\nThis material covers photosynthesis: how plants capture light energy and turn it into chemical energy.\n\n## 2. Topic map\n- Photosynthesis basics\n- Chlorophyll and pigments\n- Light reactions\n- Calvin cycle\n\n## 3. Topic explanations\n### Photosynthesis\n**Definition:** The process by which green plants convert sunlight, water and carbon dioxide into glucose and oxygen.\n**Formula:** 6CO2 + 6H2O → C6H12O6 + 6O2\n**Variables:** CO2 (carbon dioxide), H2O (water), C6H12O6 (glucose), O2 (oxygen).\n\n### Chlorophyll\nChlorophyll is the green pigment in chloroplasts that absorbs light, mainly red and blue wavelengths.\n\n## 4. Processes\n**Purpose:** Convert light energy into stored chemical energy.\n**Inputs:** Sunlight, water, carbon dioxide.\n**Step-by-step operation:** 1. Light is absorbed by chlorophyll. 2. Water is split, releasing oxygen. 3. Energy drives carbon fixation. 4. Glucose is produced.\n**Output:** Glucose and oxygen.\n\n## 5. Formulas\n**Formula:** 6CO2 + 6H2O → C6H12O6 + 6O2 — **Meaning:** Six molecules each of CO2 and water yield one glucose and six oxygen molecules.\n\n## 6. Comparisons and common confusions\nPhotosynthesis stores energy; respiration releases it. Do not confuse the two.\n\n## 7. Examples and applications\nPlants, algae and some bacteria photosynthesise; nearly all food chains depend on it.\n\n## 8. Quiz-ready facts\n- Oxygen comes from water. - Site: chloroplast. - Pigment: chlorophyll.\n\n## 9. Rapid revision sheet\nPhotosynthesis = light + water + CO2 → glucose + oxygen. Site: chloroplast. Pigment: chlorophyll.\n`
const STUB_SUGGESTIONS = [
  { label: '🔍 Go deeper', request: 'Explain photosynthesis in more depth with an example' },
  { label: '🧩 Common confusions', request: 'Explain the comparisons and common points of confusion in this material' },
  { label: '📝 Practice quiz', request: 'Give me 5 practice quiz questions based on this material' },
]

function stubFor(task, params = {}) {
  const n = params.count || 5
  switch (task) {
    case 'summary': return { result: STUB_SUMMARY, suggestions: STUB_SUGGESTIONS }
    case 'suggestions': return { result: STUB_SUGGESTIONS }
    case 'explain-topic': return { result: STUB_MD('Focused lesson: ' + (params.topic || 'Photosynthesis')) }
    case 'quiz': return { result: STUB_QUIZ.slice(0, n) }
    case 'flashcards': return { result: STUB_CARDS.slice(0, n) }
    case 'mindmap': return { result: STUB_MINDMAP }
    case 'video-plan': return { result: STUB_MD('Video Overview — Photosynthesis') + '\n\n## Storyboard\n- Scene 1: What is photosynthesis? (60s)\n- Scene 2: The chloroplast and chlorophyll (90s)\n- Scene 3: Light reactions step by step (120s)\n- Scene 4: The Calvin cycle (120s)\n- Scene 5: Recap and quiz (60s)\n' }
    case 'video-narration': return { result: 'Photosynthesis is how plants turn sunlight into food. Chlorophyll captures light in the chloroplast. Water is split and oxygen is released. Then carbon dioxide is fixed into glucose. Remember: light plus water plus carbon dioxide gives glucose plus oxygen.' }
    case 'video-slides': return { result: [
      { title: 'What is photosynthesis', bullets: ['Light energy becomes food', 'Plants use sunlight', 'Glucose and oxygen made'] },
      { title: 'The chloroplast', bullets: ['Site of photosynthesis', 'Chlorophyll absorbs light', 'Red and blue wavelengths'] },
      { title: 'Light reactions', bullets: ['Water is split', 'Oxygen is released', 'Energy is captured'] },
      { title: 'The Calvin cycle', bullets: ['Carbon dioxide is fixed', 'Glucose is built', 'Energy is stored'] },
      { title: 'Recap', bullets: ['Site: chloroplast', 'Pigment: chlorophyll', 'Oxygen comes from water'] },
    ] }
    case 'study-plan': return { result: STUB_MD('Your Study Plan') + '\n\n| Day | Focus | Task |\n|---|---|---|\n| Day 1 | Photosynthesis basics | Read summary, make flashcards |\n| Day 2 | Light reactions | Practice 5 MCQs |\n| Day 3 | Calvin cycle | Timed practice test |\n' }
    case 'tutor': return { result: 'Great question — let us build it up. Photosynthesis stores light energy as glucose in the chloroplast. What do you think happens to the water molecule first? (Hint: it is split, and something is released.)\n\n**Possible misconception:** Oxygen does not come from carbon dioxide — it comes from water.\n\nCheck for understanding: where in the cell does photosynthesis happen?' }
    case 'material': return { result: STUB_MD(params.materialType || 'Cheat sheet') }
    case 'sample-paper': return { result: STUB_MD('University Sample Paper — Photosynthesis') + '\n\n## Answer key\n1. Chloroplast — the site of photosynthesis. 2. Chlorophyll — absorbs light. 3. Oxygen — released from water.\n' }
    case 'important-questions': case 'long-questions': case 'short-questions':
      return { result: Array.from({ length: n }, (_, i) => `${i + 1}. Explain photosynthesis and its importance for life on Earth (stub question ${i + 1}).`).join('\n') }
    case 'concepts': return { result: STUB_MD('Key Concepts') }
    case 'difficulty': return { result: STUB_MD('Difficulty Analysis') + '\n\nOverall difficulty: Medium. Easy: definitions. Difficult: Calvin cycle detail.\n' }
    case 'ask': return { result: params.useGeneralKnowledge
      ? '📄 From your document:\nPhotosynthesis takes place in the chloroplast and produces glucose and oxygen.\n\n💡 Suggestions / general knowledge:\nIn real leaves, light intensity and CO2 concentration limit the rate — a classic exam graph.' 
      : 'Photosynthesis takes place in the chloroplast. Chlorophyll absorbs sunlight, water is split releasing oxygen, and carbon dioxide is fixed into glucose.' }
    case 'translate-summary': return { result: (params.text || 'Photosynthesis summary.').slice(0, 500) }
    default: return { result: '' }
  }
}

async function callGroq(prompt, systemMessage, maxTokens) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [...(systemMessage ? [{ role: 'system', content: systemMessage }] : []), { role: 'user', content: prompt }],
      temperature: TEMPERATURE,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

function stripFences(raw) {
  return (raw || '').trim().replace(/^```(json)?/, '').replace(/```$/, '').trim()
}
function parseJsonArray(raw) {
  const m = (raw || '').match(/\[[\s\S]*\]/)
  return JSON.parse(m ? m[0] : raw)
}
function parseJsonObject(raw) {
  const m = (raw || '').match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : raw)
}
function shuffleOptions(qs) {
  return qs.map((q) => {
    const correctText = q.options[q.correct]
    const options = Object.values(q.options)
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]] }
    const letters = ['A', 'B', 'C', 'D']
    const opts = {}
    options.forEach((v, i) => { opts[letters[i]] = v })
    return { ...q, options: opts, correct: letters.find((l) => opts[l] === correctText) }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { task, context = '', params = {} } = body || {}
  if (!task) return res.status(400).json({ ok: false, error: 'MISSING_TASK' })

  // Stub mode: explicit env flag only, for local testing. Never ships real-looking results as live.
  if (process.env.STUDIENT_STUB_GROQ === '1') {
    return res.status(200).json({ ok: true, stub: true, ...stubFor(task, params) })
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ ok: false, error: 'KEY_NOT_CONFIGURED' })
  }

  try {
    let prompt = ''
    let system = null
    let maxTokens = 2000
    let post = (r) => r

    switch (task) {
      case 'summary': {
        // Client sends pre-batched sections (sourceSections + batching done client-side
        // from the same rules as app.py). Each batch is summarised, then synthesised.
        const batches = params.batches || []
        const detail = params.detailLevel || 'Detailed'
        const batchMax = detail === 'Brief' ? MAX_TOKENS.summaryBriefBatch : detail === 'Exam-focused' ? MAX_TOKENS.summaryExamBatch : MAX_TOKENS.summaryDetailedBatch
        const notes = []
        for (let i = 0; i < batches.length; i++) {
          const note = await callGroq(summaryBatchPrompt(i + 1, batches.length, batches[i]), null, batchMax)
          if (note) notes.push(`### Source batch ${i + 1}\n${note}`)
        }
        if (!notes.length) return res.status(200).json({ ok: true, result: '' })
        const evidence = notes.join('\n\n')
        const finalMax = detail === 'Brief' ? MAX_TOKENS.summaryBrief : detail === 'Exam-focused' ? MAX_TOKENS.summaryExam : MAX_TOKENS.summaryDetailed
        const result = await callGroq(summaryFinalPrompt(detail, params.focus || '', evidence), null, finalMax)
        return res.status(200).json({ ok: true, result: result || '' })
      }
      case 'suggestions':
        prompt = suggestionsPrompt(params.summaryText || '', params.topicMapText || '')
        maxTokens = MAX_TOKENS.suggestions
        post = (r) => { try { const m = r.match(/\[[\s\S]*\]/); const d = JSON.parse(m ? m[0] : r); return d.filter((x) => x.label && x.request).slice(0, 3) } catch { return null } }
        break
      case 'explain-topic':
        prompt = explainTopicPrompt(params.topic, context); maxTokens = MAX_TOKENS.explainTopic; break
      case 'video-plan':
        prompt = videoPlanPrompt({ videoFormat: params.format, language: params.language, topic: params.topic, visualStyle: params.visualStyle, context }); maxTokens = MAX_TOKENS.videoPlan; break
      case 'video-narration':
        prompt = videoNarrationPrompt(params.plan, params.language); maxTokens = MAX_TOKENS.videoNarration; break
      case 'video-slides':
        prompt = storyboardPrompt(params.spoken, params.topic, params.language, params.contentCount || 5); maxTokens = MAX_TOKENS.storyboard;
        post = (r) => { try { return parseJsonArray(r) } catch { return null } }
        break
      case 'quiz':
        prompt = quizPrompt(params.count, params.difficulty, params.category, context); system = QUIZ_SYSTEM_MSG; maxTokens = MAX_TOKENS.quiz
        post = (r) => {
          const data = parseJsonArray(stripFences(r))
          const cleaned = data.filter((q) => q && ['question', 'options', 'correct', 'explanation', 'topic'].every((k) => k in q) && ['A', 'B', 'C', 'D'].every((k) => k in q.options))
          return shuffleOptions(cleaned)
        }
        break
      case 'flashcards':
        prompt = flashcardsPrompt(params.count, params.difficulty, context); system = FLASHCARD_SYSTEM_MSG; maxTokens = MAX_TOKENS.flashcards
        post = (r) => {
          const data = parseJsonArray(stripFences(r))
          return data.filter((c) => c && ['front', 'topic', 'visual_type', 'visual_title', 'visual_items'].every((k) => k in c) && Array.isArray(c.visual_items) && c.visual_items.length)
            .map((c) => ({ ...c, visual_type: ['definition', 'process', 'comparison', 'timeline', 'formula', 'fact'].includes(c.visual_type) ? c.visual_type : 'definition', visual_items: c.visual_items.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6) }))
            .filter((c) => c.visual_items.length)
        }
        break
      case 'mindmap':
        prompt = mindMapPrompt(context); system = MIND_MAP_SYSTEM_MSG; maxTokens = MAX_TOKENS.mindmap
        post = (r) => {
          const data = parseJsonObject(stripFences(r))
          const clean = (node, depth = 0) => {
            if (!node || typeof node !== 'object') return null
            const label = String(node.label || '').trim()
            if (!label) return null
            const children = []
            if (depth < 4 && Array.isArray(node.children)) {
              for (const ch of node.children.slice(0, 8)) { const c = clean(ch, depth + 1); if (c) children.push(c) }
            }
            return { label: label.slice(0, 120), children }
          }
          const root = { label: String(data.title || 'Study Material').slice(0, 120), children: [] }
          if (Array.isArray(data.children)) for (const ch of data.children.slice(0, 8)) { const c = clean(ch, 1); if (c) root.children.push(c) }
          return root.children.length ? root : null
        }
        break
      case 'study-plan':
        prompt = studyPlanPrompt({ examDate: params.examDate, daysLeft: params.daysLeft, targetGrade: params.targetGrade, hoursPerDay: params.hoursPerDay, weakSubjects: params.weakSubjects, schedule: params.schedule, context }); maxTokens = MAX_TOKENS.studyPlan; break
      case 'tutor':
        prompt = tutorPrompt({ question: params.question, level: params.level, mode: params.mode, previous: params.previous || '', context }); maxTokens = MAX_TOKENS.tutor; break
      case 'material':
        prompt = materialPrompt(params.materialType, params.focus, params.difficulty, context); maxTokens = MAX_TOKENS.material; break
      case 'sample-paper':
        prompt = samplePaperPrompt({ durationMinutes: params.durationMinutes, totalMarks: params.totalMarks, difficulty: params.difficulty, sectionMix: params.sectionMix, instructions: params.instructions, context }); maxTokens = MAX_TOKENS.samplePaper; break
      case 'important-questions':
        prompt = importantQuestionsPrompt(params.count, params.difficulty, context); maxTokens = MAX_TOKENS.questions; break
      case 'long-questions':
        prompt = longQuestionsPrompt(params.count, params.difficulty, context); maxTokens = MAX_TOKENS.questions; break
      case 'short-questions':
        prompt = shortQuestionsPrompt(params.count, context); maxTokens = MAX_TOKENS.questions; break
      case 'concepts':
        prompt = conceptsPrompt(context); maxTokens = MAX_TOKENS.concepts; break
      case 'difficulty':
        prompt = difficultyPrompt(context); maxTokens = MAX_TOKENS.difficulty; break
      case 'ask':
        prompt = askPrompt({ question: params.question, context, useGeneralKnowledge: !!params.useGeneralKnowledge }); maxTokens = MAX_TOKENS.ask; break
      case 'translate-summary':
        prompt = translateSummaryPrompt(params.text || '', params.languageName || 'English'); maxTokens = MAX_TOKENS.translateSummary; break
      default:
        return res.status(400).json({ ok: false, error: 'UNKNOWN_TASK' })
    }

    const raw = await callGroq(prompt, system, maxTokens)
    if (!raw) return res.status(200).json({ ok: true, result: '' })
    let result = raw
    // JSON-array tasks must NEVER fall through as a raw string: the client
    // stores the result and calls .map on it, so a string crashes the whole
    // app into a blank screen (seen live on Flashcards: strip shows, then
    // white). A failed parse or an empty array is a 502, never a string.
    const ARRAY_TASKS = ['quiz', 'flashcards', 'video-slides']
    try {
      const p = post(raw)
      if (p !== undefined && p !== null) result = p
      // Mind map: an empty/invalid tree must NEVER fall through as a raw
      // string — the client would render it as a single unlabeled node.
      else if (task === 'mindmap') return res.status(502).json({ ok: false, error: 'EMPTY_MINDMAP' })
    } catch {
      if (task === 'mindmap') return res.status(502).json({ ok: false, error: 'EMPTY_MINDMAP' })
      if (ARRAY_TASKS.includes(task)) return res.status(502).json({ ok: false, error: 'EMPTY_RESULT' })
      /* keep raw for other (markdown) tasks */
    }
    if (ARRAY_TASKS.includes(task) && (!Array.isArray(result) || !result.length)) {
      return res.status(502).json({ ok: false, error: 'EMPTY_RESULT' })
    }
    // Markdown tasks: apply the same formula/readability + non-academic cleanup as app.py.
    if (typeof result === 'string' && ['explain-topic', 'video-plan', 'study-plan', 'material', 'sample-paper', 'concepts', 'difficulty', 'ask', 'tutor'].includes(task)) {
      // Light-touch: formulas readability is applied client-side too; server keeps raw.
    }
    return res.status(200).json({ ok: true, result })
  } catch (e) {
    console.error('generate error', e)
    return res.status(502).json({ ok: false, error: 'GROQ_ERROR', detail: String(e.message || e).slice(0, 200) })
  }
}
