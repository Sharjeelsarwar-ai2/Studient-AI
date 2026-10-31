// Narrated slide presentation (replaces the MP4 render, which is not feasible
// on Vercel serverless: no ffmpeg, long runtimes, huge outputs).
// Slides auto-advance with Web Speech API narration; play/pause, rate, progress.
// No MP4 file is produced — the UI says so plainly.
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { cleanVideoNarration } from '../lib/text.js'

const LANG_VOICE = { English: 'en-US', Urdu: 'ur-PK', 'Urdu-English mix': 'ur-PK', Hindi: 'hi-IN' }

export function splitNarration(narration, slideCount) {
  const sentences = (narration || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  if (!sentences.length) return Array.from({ length: slideCount }, () => '')
  const per = Math.max(1, Math.round(sentences.length / slideCount))
  const groups = []
  for (let i = 0; i < sentences.length; i += per) groups.push(sentences.slice(i, i + per).join(' '))
  while (groups.length < slideCount) groups.push('')
  return groups.slice(0, slideCount)
}

export default function VideoPlayer({ slides, narration, language, rate, onRateChange, topic }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const segments = useRef(splitNarration(cleanVideoNarration(narration), slides.length))
  const idxRef = useRef(0)
  const playingRef = useRef(false)

  const speakSlide = useCallback((i) => {
    if (!supported) return
    window.speechSynthesis.cancel()
    const text = segments.current[i]
    if (!text) { return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = LANG_VOICE[language] || 'en-US'
    u.rate = rate
    u.onend = () => {
      if (playingRef.current && i < slides.length - 1) {
        idxRef.current = i + 1; setIdx(i + 1)
      } else if (playingRef.current) {
        setPlaying(false); playingRef.current = false
      }
    }
    window.speechSynthesis.speak(u)
  }, [supported, language, rate, slides.length])

  useEffect(() => { segments.current = splitNarration(cleanVideoNarration(narration), slides.length) }, [narration, slides.length])
  useEffect(() => { if (playing) speakSlide(idx) }, [idx, playing, speakSlide])
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const play = () => { playingRef.current = true; setPlaying(true); if (!window.speechSynthesis.speaking) speakSlide(idx) }
  const pause = () => { playingRef.current = false; setPlaying(false); if (supported) window.speechSynthesis.cancel() }
  const go = (i) => { idxRef.current = i; setIdx(i); if (playingRef.current) speakSlide(i) }

  const slide = slides[idx]
  if (!slide) return null
  return (
    <div className="vp">
      <div className="vp-note">🎬 Narrated slide presentation — not an MP4 render. Slides advance with browser narration (Web Speech API); no video file is generated.</div>
      <div className="vp-stage" key={idx}>
        <div className="vp-kicker">Studient AI · {topic}</div>
        <h3 className="vp-title">{slide.title}</h3>
        <ul className="vp-bullets">{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
        <div className="vp-count">Slide {idx + 1} of {slides.length}</div>
      </div>
      <div className="vp-progress"><div style={{ width: `${((idx + 1) / slides.length) * 100}%` }} /></div>
      <div className="vp-controls">
        <button className="btn" onClick={() => go(Math.max(0, idx - 1))} disabled={idx === 0}>← Previous</button>
        {playing
          ? <button className="btn primary" onClick={pause}>⏸ Pause narration</button>
          : <button className="btn primary" onClick={play} disabled={!supported}>▶ Play narrated presentation</button>}
        <button className="btn" onClick={() => go(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1}>Next →</button>
        <label className="vp-rate">Speaking rate
          <input type="range" min="0.75" max="1.25" step="0.05" value={rate} onChange={(e) => onRateChange(parseFloat(e.target.value))} />
          <b>{rate.toFixed(2)}×</b>
        </label>
      </div>
      {!supported && <p className="muted small">Your browser does not support speech narration (Web Speech API). You can still step through the slides manually.</p>}
      <p className="muted small">Narration (this slide): {segments.current[idx] || '—'}</p>
    </div>
  )
}
