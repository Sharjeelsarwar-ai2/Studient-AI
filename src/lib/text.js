// Ported from app.py: clean_text, make_formulas_readable,
// remove_nonacademic_topic_rows, chunk_text, get_relevant_chunks,
// source_sections, clean_speech_text, clean_video_narration.

export function cleanText(text) {
  if (!text) return ''
  text = text.replace(/\x00/g, ' ')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

export function makeFormulasReadable(text) {
  if (!text) return text
  text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)')
  text = text.replace(/\\text\{([^{}]+)\}/g, '$1')
  text = text.replace(/([A-Za-z])_\{([^{}]+)\}/g, '$1_$2')
  text = text.replace(/([A-Za-z])\^\{([^{}]+)\}/g, '$1^$2')
  text = text.replace(/\\times/g, ' × ').replace(/\\cdot/g, ' · ')
  text = text.replace(/\\leq/g, ' ≤ ').replace(/\\geq/g, ' ≥ ').replace(/\\rightarrow/g, ' → ')
  text = text.replace(/\\approx/g, ' ≈ ').replace(/\\Delta/g, 'Δ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
  text = text.replace(/\\/g, '')
  text = text.replace(/[ \t]+/g, ' ')
  return text.trim()
}

const BLOCKED_ROW = /slide[- ]use|copyright notice|copyright|chapter goal|chapter roadmap|lecture roadmap|publisher information|author information/i
export function removeNonacademicTopicRows(text) {
  return (text || '').split('\n').filter((line) => {
    if (BLOCKED_ROW.test(line) && (line.includes('|') || /^\s*(-|\*|\d+\.)/.test(line))) return false
    return true
  }).join('\n').trim()
}

export function chunkText(text, chunkSize = 7000) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const chunks = []
  let current = []
  let length = 0
  for (const w of words) {
    current.push(w)
    length += w.length + 1
    if (length >= chunkSize) {
      chunks.push(current.join(' '))
      current = []
      length = 0
    }
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

const IMPORTANT_TERMS = new Set(['definition', 'concept', 'important', 'process', 'theory', 'principle', 'example', 'formula', 'function', 'cause', 'effect', 'classification'])

export function getRelevantChunks(text, query, maxChunks = 8, maxContextChars = 12000) {
  const chunks = chunkText(text, 7000)
  if (!chunks.length) return ''
  const wordRe = /\b[a-zA-Z0-9]{3,}\b/g
  const queryWords = new Set((query.toLowerCase().match(wordRe) || []))
  const scored = chunks.map((chunk, i) => {
    const chunkWords = new Set((chunk.toLowerCase().match(wordRe) || []))
    let overlap = 0
    for (const w of queryWords) if (chunkWords.has(w)) overlap++
    let bonus = 0
    for (const t of IMPORTANT_TERMS) if (chunkWords.has(t)) bonus++
    return { score: overlap + bonus * 0.5, i, chunk }
  })
  scored.sort((a, b) => b.score - a.score)
  const selected = []
  let total = 0
  for (const { i, chunk } of scored.slice(0, maxChunks)) {
    const remaining = maxContextChars - total
    if (remaining <= 500) break
    if (chunk.length <= remaining) {
      selected.push([i, chunk]); total += chunk.length
    } else {
      selected.push([i, chunk.slice(0, remaining)]); total += remaining; break
    }
  }
  selected.sort((a, b) => a[0] - b[0])
  return selected.map(([, c]) => c).join('\n\n')
}

export function sourceSections(text) {
  const parts = (text || '').split(/(?=\[(?:SLIDE|PAGE|OCR PAGE|DOCUMENT):?\s*\d*[^\]]*\])/g)
  const sections = parts.map((s) => s.trim()).filter(Boolean)
  return sections.length ? sections : chunkText(text, 6500)
}

export function cleanSpeechText(text) {
  text = (text || '').replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '')
  text = text.replace(/^\s*[-*+]\s+/gm, '')
  text = text.replace(/^\s*\d+[.)]\s+/gm, '')
  text = text.replace(/\[\/?(?:PAGE|SLIDE|TABLE)[^\]]*\]/gi, ' ')
  text = text.replace(/https?:\/\/\S+/g, ' ')
  text = text.replace(/[*_`~]/g, '')
  text = text.replace(/\s+/g, ' ')
  return text.trim()
}

export function cleanVideoNarration(text) {
  text = cleanSpeechText(text)
  text = text.replace(/\b\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?\b/g, ' ')
  text = text.replace(/\b(?:video title|learning objective|approximate duration|target audience|scene-by-scene storyboard|visual treatment|transition|recap takeaways|formula cards)\s*:?/gi, ' ')
  text = text.replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
  text = text.replace(/—/g, ', ').replace(/–/g, '-')
  return text.replace(/\s+/g, ' ').trim()
}

export function wordCount(text) { return (text || '').split(/\s+/).filter(Boolean).length }
export function sectionCount(text) {
  return (['[PAGE ', '[OCR PAGE ', '[SLIDE ', '[DOCUMENT: ', '[TABLE '].reduce(
    (n, m) => n + ((text || '').split(m).length - 1), 0))
}
