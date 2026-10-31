// Client-side exports: MD/TXT/JSON/CSV via Blob, PDF via jsPDF,
// DOCX via the docx package, study-pack / user-data ZIP via JSZip,
// mind-map PNG via serializing the rendered SVG to canvas.
import { jsPDF } from 'jspdf'
import { Document as DocxDoc, Packer, Paragraph, HeadingLevel } from 'docx'
import JSZip from 'jszip'
import { downloadBlob, downloadText } from './util.js'

function stripMd(text) {
  return (text || '').replace(/[#*_`>|]/g, '').replace(/\n{3,}/g, '\n\n')
}

export function exportPdf(title, sections, filename) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 42
  const width = doc.internal.pageSize.getWidth() - margin * 2
  let y = 48
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(6, 78, 59)
  doc.text(doc.splitTextToSize(title, width), margin, y); y += 28
  doc.setDrawColor(16, 185, 129); doc.setLineWidth(1.5); doc.line(margin, y, margin + width, y); y += 20
  for (const [heading, body] of sections) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(11, 110, 79)
    for (const line of doc.splitTextToSize(String(heading), width)) {
      if (y > 740) { doc.addPage(); y = 48 }
      doc.text(line, margin, y); y += 18
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(28, 43, 38)
    for (const para of String(body).split('\n')) {
      if (!para.trim()) { y += 6; continue }
      for (const line of doc.splitTextToSize(stripMd(para.trim()), width)) {
        if (y > 740) { doc.addPage(); y = 48 }
        doc.text(line, margin, y); y += 15
      }
      y += 4
    }
    y += 10
  }
  doc.save(filename)
}

export async function exportQuestionsDocx(questions, title, filename) {
  const children = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })]
  questions.forEach((q, i) => {
    children.push(new Paragraph({ text: `Question ${i + 1}`, heading: HeadingLevel.HEADING_2 }))
    if (q && typeof q === 'object' && q.question) {
      children.push(new Paragraph(q.question))
      for (const [letter, opt] of Object.entries(q.options || {})) children.push(new Paragraph(`${letter}) ${opt}`))
      children.push(new Paragraph(`Answer: ${q.correct || ''}`))
      children.push(new Paragraph(`Explanation: ${q.explanation || ''}`))
    } else {
      children.push(new Paragraph(String(q)))
    }
  })
  const blob = await Packer.toBlob(new DocxDoc({ sections: [{ children }] }))
  downloadBlob(blob, filename)
}

export function exportFlashcardsCsv(cards, reviewState, documentName, getReview) {
  const rows = [['Front', 'Topic', 'Visual type', 'Visual title', 'Visual items', 'Last rating', 'Due date', 'Leitner box']]
  cards.forEach((card) => {
    const r = getReview(card)
    rows.push([card.front, card.topic, card.visual_type, card.visual_title, (card.visual_items || []).join(' | '), r.last_rating || 'New', r.due || '', r.box || 1])
  })
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadText(csv, 'studient-flashcards.csv', 'text/csv')
}

export function exportFlashcardsPdf(cards) {
  const sections = cards.map((c, i) => [`Card ${i + 1}: ${c.front}`, `Topic: ${c.topic}\n${c.visual_title}\n${(c.visual_items || []).join('\n')}`])
  exportPdf('Studient AI Flashcards', sections, 'studient-flashcards.pdf')
}

export async function exportMindMapPng(svgElement, filename = 'studient-mind-map.png') {
  const svg = svgElement.cloneNode(true)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const xml = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
  const canvas = document.createElement('canvas')
  canvas.width = img.width || 1200; canvas.height = img.height || 800
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FBF7EE'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  canvas.toBlob((b) => b && downloadBlob(b, filename), 'image/png')
}

export async function exportStudyPack({ workspaceText, summary, flashcards, mindMap, history }) {
  const zip = new JSZip()
  zip.file('workspace.txt', workspaceText || '')
  if (summary) zip.file('summary.md', summary)
  if (flashcards?.length) {
    const rows = [['Front', 'Topic', 'Visual type', 'Visual title', 'Visual items']]
    flashcards.forEach((c) => rows.push([c.front, c.topic, c.visual_type, c.visual_title, (c.visual_items || []).join(' | ')]))
    zip.file('flashcards.csv', rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))
  }
  if (mindMap) zip.file('mind-map.json', JSON.stringify(mindMap, null, 2))
  zip.file('study-history.json', JSON.stringify(history || [], null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, 'studient-study-pack.zip')
}

export async function exportUserData({ workspaceText, history, summaries, reviewState, summary, studyPlan }) {
  const zip = new JSZip()
  zip.file('workspace.txt', workspaceText || '')
  zip.file('study-history.json', JSON.stringify(history || [], null, 2))
  zip.file('summary-history.json', JSON.stringify(summaries || [], null, 2))
  zip.file('flashcard-review-state.json', JSON.stringify(reviewState || {}, null, 2))
  if (summary) zip.file('current-summary.md', summary)
  if (studyPlan) zip.file('study-plan.md', studyPlan)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, 'studient-data-export.zip')
}
