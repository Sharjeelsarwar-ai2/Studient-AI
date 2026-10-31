// Collapsible mind-map tree (ported render: root + branches, click to collapse).
import React, { useState, useRef } from 'react'

function Node({ node, depth = 0 }) {
  const [open, setOpen] = useState(true)
  const hasKids = node.children?.length > 0
  return (
    <li className={depth === 0 ? 'mm-root' : ''}>
      {hasKids ? (
        <details open={open} className="mm-details">
          <summary className="mm-node" onClick={(e) => { e.preventDefault(); setOpen(!open) }} title="Click to collapse or expand this branch">
            <span className="mm-toggle">{open ? '−' : '+'}</span><span className="mm-dot" /><span>{node.label}</span>
          </summary>
          <ul className="mm-children">{node.children.map((c, i) => <Node key={i} node={c} depth={depth + 1} />)}</ul>
        </details>
      ) : (
        <div className="mm-node" title="Leaf concept"><span className="mm-dot" /><span>{node.label}</span></div>
      )}
    </li>
  )
}

export default function MindMap({ map, svgRef }) {
  return (
    <div className="mm-shell" ref={svgRef}>
      <div className="mm-toolbar">
        <div><b>Interactive concept map</b><div className="muted small">Follow a branch, then collapse it to focus your revision.</div></div>
        <div className="muted small">Click any branch label to focus · scroll horizontally on smaller screens</div>
      </div>
      <ul className="mm-tree"><Node node={map} /></ul>
    </div>
  )
}
