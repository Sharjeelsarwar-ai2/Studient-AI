// Browser-side document extraction (ported from app.py extract_*).
// PDF via pdf.js (text layer first, tesseract.js OCR fallback for scanned pages),
// DOCX via mammoth, PPTX via JSZip + XML, TXT/MD plain read.
// Output markers match app.py: [DOCUMENT: name], [PAGE n], [SLIDE n], [TABLE n].
import { cleanText } from './text.js'

export const SUPPORTED_TYPES = ['pdf', 'docx', 'pptx', 'txt', 'md']

export async function extractFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return extractPdf(file)
  if (ext === 'docx') return extractDocx(file)
  if (ext === 'pptx') return extractPptx(file)
  if (ext === 'txt' || ext === 'md') {
    const text = await file.text()
    return { text: cleanText(text), stats: { slide_count: 0, slides_with_text: 0, slides_without_text: 0, coverage: 100, warnings: [] } }
  }
  throw new Error('Unsupported document format. Please upload a PDF, Word document, or PowerPoint presentation.')
}

async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const pages = []
  let ocrUsed = false
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const tc = await page.getTextContent()
    const text = tc.items.map((it) => it.str).join(' ').trim()
    if (text) {
      pages.push(`\n[PAGE ${n}]\n${text}`)
    } else {
      // No text layer — try browser-side OCR (tesseract.js WASM).
      try {
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('eng')
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width; canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        const { data } = await worker.recognize(canvas)
        await worker.terminate()
        if (data.text.trim()) { pages.push(`\n[OCR PAGE ${n}]\n${data.text}`); ocrUsed = true }
        else pages.push(`\n[PAGE ${n}]\n[NO EXTRACTABLE TEXT ON THIS PAGE]`)
      } catch {
        pages.push(`\n[PAGE ${n}]\n[NO EXTRACTABLE TEXT ON THIS PAGE — scanned page; OCR unavailable in this browser]`)
      }
    }
  }
  const warnings = ocrUsed ? ['Some pages had no text layer and were read with on-device OCR (tesseract.js).'] : []
  return { text: cleanText(pages.join('')), stats: { slide_count: 0, slides_with_text: 0, slides_without_text: 0, coverage: 100, warnings } }
}

async function extractDocx(file) {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
  // mammoth raw text drops tables; re-extract tables via document.xml for [TABLE n] markers.
  let text = value || ''
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file('word/document.xml')?.async('text')
    if (xml) {
      const tables = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)]
      tables.forEach((m, i) => {
        const rows = [...m[0].matchAll(/<w:tr>[\s\S]*?<\/w:tr>/g)].map((r) =>
          [...r[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((c) => c[1]).join(' | '))
        if (rows.length) text += `\n[TABLE ${i + 1}]\n` + rows.join('\n')
      })
    }
  } catch { /* tables optional */ }
  return { text: cleanText(text), stats: { slide_count: 0, slides_with_text: 0, slides_without_text: 0, coverage: 100, warnings: [] } }
}

async function extractPptx(file) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideFiles = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10))
  const slides = []
  let withText = 0
  const warnings = []
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i]).async('text')
    const parts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean)
    // speaker notes
    const notesFile = slideFiles[i].replace('ppt/slides/slide', 'ppt/notesSlides/notesSlide')
    let notes = ''
    try {
      const notesXml = await zip.file(notesFile)?.async('text')
      if (notesXml) notes = [...notesXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean).join(' ')
    } catch { /* no notes */ }
    const deduped = [...new Set(parts)]
    if (notes) deduped.push('Speaker notes: ' + notes)
    if (deduped.length) { withText++; slides.push(`\n[SLIDE ${i + 1}]\n${deduped.join('\n')}`) }
    else slides.push(`\n[SLIDE ${i + 1}]\n[NO EXTRACTABLE TEXT ON THIS SLIDE]`)
  }
  const total = slideFiles.length
  const empty = total - withText
  if (empty) warnings.push(`${empty} slide(s) contain no machine-readable text; visual-only content may require OCR or manual review.`)
  return {
    text: cleanText(slides.join('')),
    stats: { slide_count: total, slides_with_text: withText, slides_without_text: empty, coverage: total ? Math.round((withText / total) * 100) : 0, warnings },
  }
}
