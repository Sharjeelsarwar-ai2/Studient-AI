// Hand-rolled SVG charts (no chart library — keeps the bundle lean).
export function LineChart({ values, height = 180 }) {
  if (!values?.length) return <p className="muted">No data yet.</p>
  const w = 640, h = height, pad = 28
  const max = Math.max(100, ...values)
  const min = Math.min(0, ...values)
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1)
  const y = (v) => h - pad - ((v - min) / Math.max(1, max - min)) * (h - pad * 2)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label={`Score over time: ${values.join(', ')}`}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(27,42,46,.2)" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(27,42,46,.2)" />
      <polyline points={pts} fill="none" stroke="#0D9488" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="5" fill="#EA580C" stroke="#fff" strokeWidth="2" />
          <text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="12" fill="#1B2A2E">{v}%</text>
        </g>
      ))}
    </svg>
  )
}

export function BarChart({ data }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return <p className="muted">No topic data yet.</p>
  const w = 640, rowH = 34, h = entries.length * rowH + 20
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Topic accuracy">
      {entries.map(([topic, acc], i) => (
        <g key={topic}>
          <text x="0" y={i * rowH + 22} fontSize="13" fill="#1B2A2E">{topic}</text>
          <rect x="150" y={i * rowH + 8} width={Math.max(2, (acc / 100) * (w - 220))} height="18" rx="9" fill={acc >= 70 ? '#0D9488' : acc >= 50 ? '#CA8A04' : '#E11D48'} />
          <text x={Math.min(w - 40, 158 + (acc / 100) * (w - 220))} y={i * rowH + 22} fontSize="12" fill="#1B2A2E">{acc}%</text>
        </g>
      ))}
    </svg>
  )
}
