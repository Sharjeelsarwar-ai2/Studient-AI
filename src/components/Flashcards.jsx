// Interactive click-to-flip visual flashcards — ported from the Streamlit
// version (render_flashcards / render_visual_artifact): fixed-height 3D flip
// cards, topic pill + question on the front, "Visual Explanation" artifact
// on the back, with the same visual types (definition / process /
// comparison / timeline / formula) and the same Leitner review row below.
import React, { useState } from 'react'

export function VisualArtifact({ card }) {
  const items = card.visual_items || []
  const title = card.visual_title
  if (card.visual_type === 'definition') {
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <div className="va-core">{items[0]}</div>
        {items.length > 1 && <div className="va-items">{items.slice(1).map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>}
      </div>
    )
  }
  if (card.visual_type === 'process') {
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <ol className="va-steps">{items.map((it, i) => (
          <li key={i}>
            <span className="va-step"><span className="va-step-n">{i + 1}</span><span>{it}</span></span>
            {i < items.length - 1 && <span className="va-arrow" aria-hidden="true">↓</span>}
          </li>
        ))}</ol>
      </div>
    )
  }
  if (card.visual_type === 'comparison') {
    const vs = items.indexOf('VS')
    const left = vs >= 0 ? items.slice(0, vs) : items.slice(0, Math.ceil(items.length / 2))
    const right = vs >= 0 ? items.slice(vs + 1) : items.slice(Math.ceil(items.length / 2))
    // Side labels are parsed from the title ("X vs Y"), exactly as Streamlit did.
    const m = (title || '').match(/^(.*?)\s+(?:vs\.?|versus)\s+(.*)$/i)
    const labelLeft = (m && m[1].trim()) || 'Concept A'
    const labelRight = (m && m[2].trim()) || 'Concept B'
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <div className="va-compare">
          <div className="va-side"><div className="va-side-title">{labelLeft}</div>{(left.length ? left : ['—']).map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>
          <div className="va-vs">VS</div>
          <div className="va-side"><div className="va-side-title">{labelRight}</div>{(right.length ? right : ['—']).map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>
        </div>
      </div>
    )
  }
  if (card.visual_type === 'timeline') {
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <div className="va-timeline">{items.map((it, i) => <div key={i} className="va-tl"><span className="va-tl-dot" />{it}</div>)}</div>
      </div>
    )
  }
  if (card.visual_type === 'formula') {
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <div className="va-formula">{items[0]}</div>
        {items.length > 1 && <div className="va-items">{items.slice(1).map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>}
      </div>
    )
  }
  return (
    <div className="va">
      <div className="va-title">{title}</div>
      <div className="va-items">{items.map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>
    </div>
  )
}

export default function Flashcard({ card, index, review, onRate }) {
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState('Good')
  return (
    <div className="fc">
      <button className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={`Flashcard ${index + 1}: ${card.front}. Click to flip.`} aria-pressed={flipped}>
        <span className="fc-inner">
          <span className="fc-front">
            <span className="fc-front-top">
              <span className="fc-topic">{card.topic}</span>
              <span className="fc-q">{card.front}</span>
            </span>
            <span className="fc-hint">👆 Click to reveal visual answer</span>
          </span>
          <span className="fc-back">
            <span className="fc-a-label">Visual Explanation</span>
            <VisualArtifact card={card} />
            <span className="fc-back-note">Based strictly on your uploaded study material.</span>
            <span className="fc-hint">👆 Click to flip back</span>
          </span>
        </span>
      </button>
      <div className="fc-meta">
        <span className="muted small">Card {index + 1} · {review.last_rating || 'New'} · due {review.due || 'today'} · Box {review.box || 1}</span>
        <div className="fc-rate">
          {['Again', 'Hard', 'Good', 'Easy'].map((r) => (
            <button key={r} type="button" className={rating === r ? 'chip-btn active' : 'chip-btn'} onClick={() => setRating(r)}>{r}</button>
          ))}
          <button type="button" className="btn small fc-save" onClick={() => onRate(card, rating)}>Save review</button>
        </div>
        {review.history?.length > 0 && (
          <div className="muted small">Learning history: {review.history.slice(-5).map((h) => `${h.date} ${h.rating}`).join(' · ')}</div>
        )}
      </div>
    </div>
  )
}
