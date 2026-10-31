// Minimal safe markdown renderer (headings, bold/italic, lists, tables, code, links-as-text).
import React from 'react'

function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    return <React.Fragment key={i}>{p}</React.Fragment>
  })
}

export default function Markdown({ text }) {
  if (!text) return null
  const lines = String(text).split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*$/.test(line)) { i++; continue }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) { blocks.push(<div key={i} className={`md-h${h[1].length}`}>{inline(h[2])}</div>); i++; continue }
    if (/^\s*\|.*\|\s*$/.test(line) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = line.split('|').map((s) => s.trim()).filter(Boolean)
      const rows = []
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').map((s) => s.trim()).filter(Boolean)); i++
      }
      blocks.push(
        <div key={'t' + i} className="md-table-wrap"><table className="md-table">
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table></div>
      )
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      blocks.push(<ul key={'ul' + i} className="md-list">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
      blocks.push(<ol key={'ol' + i} className="md-list">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>)
      continue
    }
    if (/^```/.test(line)) {
      const code = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++ }
      i++
      blocks.push(<pre key={'pre' + i} className="md-code">{code.join('\n')}</pre>)
      continue
    }
    blocks.push(<p key={i} className="md-p">{inline(line)}</p>)
    i++
  }
  return <div className="md">{blocks}</div>
}
