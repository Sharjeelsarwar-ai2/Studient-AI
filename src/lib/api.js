// Client → /api/generate + /api/health
export async function checkHealth() {
  try {
    const r = await fetch('/api/health')
    return await r.json()
  } catch {
    return { ok: false, configured: false }
  }
}

export async function generate(task, context = '', params = {}) {
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context, params }),
  })
  const data = await r.json().catch(() => ({ ok: false, error: 'BAD_RESPONSE' }))
  if (!data.ok) {
    const err = new Error(data.error || 'GENERATION_FAILED')
    err.code = data.error
    err.detail = data.detail
    throw err
  }
  // Defensive: if a JSON-shaped task ever returns a raw string, parse it.
  if (typeof data.result === 'string' && ['quiz', 'flashcards', 'mindmap', 'video-slides', 'suggestions'].includes(task)) {
    try {
      const m = data.result.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
      data.result = JSON.parse(m ? m[0] : data.result)
    } catch { /* leave as-is; caller handles */ }
  }
  return data
}

export function friendlyError(err) {
  if (err.code === 'KEY_NOT_CONFIGURED') {
    return 'API key not configured — add GROQ_API_KEY in Vercel Settings → Environment Variables, then redeploy.'
  }
  if (err.code === 'EMPTY_MINDMAP') return "Couldn't build the mind map — try again."
  if (err.code === 'GROQ_ERROR') return 'The AI service returned an error. Please try again in a moment.'
  return 'Something went wrong generating this. Please try again.'
}
