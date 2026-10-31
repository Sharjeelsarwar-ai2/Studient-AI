// Visual flashcard artifact + flip card (ported from render_visual_artifact).
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
        <ol className="va-steps">{items.map((it, i) => <li key={i}><span className="va-step-n">{i + 1}</span>{it}</li>)}</ol>
      </div>
    )
  }
  if (card.visual_type === 'comparison') {
    const vs = items.indexOf('VS')
    const left = vs >= 0 ? items.slice(0, vs) : items.slice(0, Math.ceil(items.length / 2))
    const right = vs >= 0 ? items.slice(vs + 1) : items.slice(Math.ceil(items.length / 2))
    return (
      <div className="va">
        <div className="va-title">{title}</div>
        <div className="va-compare">
          <div className="va-side">{left.map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>
          <div className="va-vs">VS</div>
          <div className="va-side">{right.map((it, i) => <div key={i} className="va-item">• {it}</div>)}</div>
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
      <button className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={`Flashcard ${index + 1}: ${card.front}. Click to flip.`}>
        <span className="fc-topic">{card.topic}</span>
        {!flipped ? (
          <span className="fc-front">{card.front}<span className="fc-hint">Tap to reveal →</span></span>
        ) : (
          <span className="fc-back"><VisualArtifact card={card} /></span>
        )}
      </button>
      <div className="fc-meta">
        <span className="muted small">Card {index + 1} · {review.last_rating || 'New'} · due {review.due || 'today'} · Box {review.box || 1}</span>
        <div className="fc-rate">
          {['Again', 'Hard', 'Good', 'Easy'].map((r) => (
            <button key={r} className={rating === r ? 'chip-btn active' : 'chip-btn'} onClick={() => setRating(r)}>{r}</button>
          ))}
          <button className="btn small" onClick={() => onRate(card, rating)}>Save review</button>
        </div>
        {review.history?.length > 0 && (
          <div className="muted small">Learning history: {review.history.slice(-5).map((h) => `${h.date} ${h.rating}`).join(' · ')}</div>
        )}
      </div>
    </div>
  )
}
