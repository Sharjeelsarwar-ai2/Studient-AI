// localStorage-backed history / review state / privacy (replaces app.py local JSON files).
// No server storage exists: documents live only in browser memory; history,
// attempts and flashcard review state live in localStorage, honouring
// private-session mode and retention.

import { stripMarkdown } from './text.js'

const K = {
  history: 'studient.history.v1',
  summaries: 'studient.summaries.v1',
  review: 'studient.review.v1',
  settings: 'studient.settings.v1',
}

export function loadJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full/blocked */ } }

export function loadHistory() { return loadJson(K.history, []) }
export function loadSummaries() { return loadJson(K.summaries, []) }
export function loadReviewState() { return loadJson(K.review, {}) }
export function saveReviewState(s) { saveJson(K.review, s) }
export function loadSettings() {
  return loadJson(K.settings, {
    theme: 'System', reducedMotion: false, highContrast: false, fontScale: 'Default',
    workspaceName: 'My Study Workspace', privacyMode: false, retentionDays: 0,
    questionCount: 5, difficulty: 'Medium', testCategory: 'Mixed',
    timedMode: false, testTimeLimit: 10, negativeMarking: false,
  })
}
export function saveSettings(s) { saveJson(K.settings, s) }

export function saveAttempt(documentName, score, total, topicResults, startedAt, privacyMode) {
  if (privacyMode) return []
  const history = loadHistory()
  history.push({
    timestamp: new Date().toISOString().slice(0, 19),
    document: documentName, score, total, topics: topicResults,
    duration_minutes: startedAt ? Math.round(Math.max(0, (Date.now() - startedAt) / 60000) * 10) / 10 : 0,
  })
  saveJson(K.history, history)
  return history
}

export function saveSummary(documentName, summary, privacyMode) {
  if (privacyMode) return
  const history = loadSummaries()
  const plain = stripMarkdown(summary).slice(0, 280)
  history.push({ timestamp: new Date().toISOString().slice(0, 19), document: documentName, preview: plain.slice(0, 280) })
  saveJson(K.summaries, history.slice(-20))
}

export function applyRetention(days) {
  if (!days) return
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  saveJson(K.history, loadHistory().filter((i) => (i.timestamp || '') >= cutoff))
  saveJson(K.summaries, loadSummaries().filter((i) => (i.timestamp || '') >= cutoff))
}

export function deleteLocalData() {
  Object.values(K).forEach((k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } })
}

export function reviewKey(card, documentName) {
  // Synchronous 16-hex-char key (app.py used SHA-1 truncated to 16 chars;
  // a stable FNV-style hash is equivalent here — keys only identify local review state).
  const raw = `${card.front || ''}|${card.topic || ''}|${documentName || ''}`
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < raw.length; i++) {
    h1 = Math.imul(h1 ^ raw.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ raw.charCodeAt(raw.length - 1 - i), 0x85ebca6b) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16)
}

// Leitner intervals copied from app.py rate_review_card.
const INTERVALS = { Again: [0, 0, 1, 1, 1], Hard: [1, 1, 2, 3, 4], Good: [1, 2, 4, 7, 14], Easy: [2, 4, 7, 14, 30] }
export function getReviewCard(state, card, documentName) {
  const key = reviewKey(card, documentName)
  if (!state[key]) state[key] = { box: 1, due: new Date().toISOString().slice(0, 10), history: [], last_rating: 'New' }
  return state[key]
}
export function rateReviewCard(state, card, documentName, rating) {
  const s = getReviewCard(state, card, documentName)
  if (rating === 'Again') s.box = 1
  else if (rating === 'Hard') s.box = Math.max(1, s.box || 1)
  else if (rating === 'Good') s.box = Math.min(5, (s.box || 1) + 1)
  else if (rating === 'Easy') s.box = Math.min(5, (s.box || 1) + 2)
  const days = INTERVALS[rating][Math.min(s.box - 1, 4)]
  const due = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  s.due = due; s.last_rating = rating
  s.history = [...(s.history || []), { date: new Date().toISOString().slice(0, 10), rating, box: s.box }].slice(-30)
  saveReviewState(state)
  return s
}
export function dueReviewCards(state, cards, documentName) {
  const today = new Date().toISOString().slice(0, 10)
  return (cards || []).filter((c) => (getReviewCard(state, c, documentName).due || today) <= today)
}

export function analyticsSnapshot(documentName, flashcards, reviewState) {
  const history = loadHistory().filter((i) => i.document === documentName)
  const scores = history.filter((i) => i.total).map((i) => Math.round((i.score / i.total) * 100))
  const topicTotals = {}
  for (const a of history) for (const [t, s] of Object.entries(a.topics || {})) {
    topicTotals[t] = topicTotals[t] || { correct: 0, total: 0 }
    topicTotals[t].correct += s.correct || 0
    topicTotals[t].total += (s.correct || 0) + (s.wrong || 0)
  }
  const topicAccuracy = {}
  for (const [t, d] of Object.entries(topicTotals)) topicAccuracy[t] = d.total ? Math.round((d.correct / d.total) * 100) : 0
  const mastered = (flashcards || []).filter((c) => getReviewCard(reviewState, c, documentName).box >= 5).length
  const dates = new Set(history.map((i) => (i.timestamp || '').slice(0, 10)))
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const improvement = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0
  const weakest = Object.keys(topicAccuracy).length ? Object.keys(topicAccuracy).reduce((a, b) => (topicAccuracy[a] <= topicAccuracy[b] ? a : b)) : 'Complete a practice test'
  return {
    attempts: history.length, average: avg, scores, improvement, topicAccuracy,
    mastered, cards: (flashcards || []).length,
    questions: history.reduce((n, i) => n + (i.total || 0), 0),
    sessions: dates.size, weakest,
    studyTime: history.reduce((n, i) => n + (i.duration_minutes || 0), 0),
  }
}

export function dashboardSnapshot(documentName, hasSummary, flashcards, reviewState) {
  const attempts = loadHistory()
  const summaries = loadSummaries()
  const documents = {}
  for (const a of attempts) documents[a.document || 'Unknown document'] = a.timestamp || ''
  if (documentName) documents[documentName] = new Date().toISOString().slice(0, 19)
  const totalQuestions = attempts.reduce((n, i) => n + (i.total || 0), 0)
  const bestScore = attempts.reduce((m, i) => (i.total ? Math.max(m, Math.round((i.score / i.total) * 100)) : m), 0)
  const mastered = (flashcards || []).filter((c) => getReviewCard(reviewState, c, documentName).box >= 5).length
  const readiness = Math.min(100, Math.round(bestScore * 0.7 + (hasSummary ? 20 : 0) + ((flashcards || []).length ? 10 : 0)))
  const days = [...new Set(attempts.map((i) => (i.timestamp || '').slice(0, 10)).filter(Boolean))].sort().reverse()
  let streak = 0
  const today = new Date()
  for (let o = 0; o < days.length; o++) {
    const d = new Date(today.getTime() - o * 86400000).toISOString().slice(0, 10)
    if (days[o] === d) streak++
    else break
  }
  const analytics = documentName ? analyticsSnapshot(documentName, flashcards, reviewState) : { average: 0, improvement: 0, sessions: 0, weakest: 'Complete a practice test', questions: 0 }
  const dueToday = dueReviewCards(reviewState, flashcards || [], documentName).length
  const recommended = dueToday ? `Review ${dueToday} flashcards due today` : totalQuestions === 0 ? 'Take a practice test' : `Review ${analytics.weakest} concepts`
  return {
    totalQuestions, bestScore, mastered, currentCards: (flashcards || []).length, readiness, streak, recommended,
    recentDocs: Object.entries(documents).sort((a, b) => (b[1] || '').localeCompare(a[1] || '')).slice(0, 5),
    recentSummaries: [...summaries].reverse().slice(0, 4),
    average: analytics.average, improvement: analytics.improvement, sessions: analytics.sessions, weakest: analytics.weakest, dueToday,
  }
}
