// Interactive concept-map tree — ported from the Streamlit version
// (_render_mind_map_nodes): glass node pills joined by connector lines,
// a gradient root node, +/- toggle badges on branches, click a branch to
// collapse/expand it, click a leaf to focus it. Expand/collapse-all added
// in the toolbar. Same data model (label + children) and same exports.
import React, { useState, useEffect, useCallback } from 'react'

function collectPaths(node, path, out) {
  out.push(path)
  ;(node.children || []).forEach((c, i) => collectPaths(c, `${path}/${i}`, out))
  return out
}

function Node({ node, path, depth, openSet, toggle, selected, onSelect }) {
  const hasKids = node.children?.length > 0
  const open = openSet.has(path)
  const isRoot = depth === 0
  return (
    <li className={isRoot ? 'mm-root' : ''}>
      {hasKids ? (
        <>
          <button type="button" className={`mm-node ${selected === path ? 'selected' : ''}`} onClick={() => { toggle(path); onSelect(path) }} title="Click to collapse or expand this branch" aria-expanded={open}>
            <span className="mm-toggle" aria-hidden="true">{open ? '−' : '+'}</span><span className="mm-dot" aria-hidden="true" /><span>{node.label}</span>
          </button>
          {open && (
            <ul className="mm-children">
              {node.children.map((c, i) => (
                <Node key={i} node={c} path={`${path}/${i}`} depth={depth + 1} openSet={openSet} toggle={toggle} selected={selected} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <button type="button" className={`mm-node mm-leaf ${selected === path ? 'selected' : ''}`} onClick={() => onSelect(path)} title="Leaf concept — click to focus">
          <span className="mm-dot" aria-hidden="true" /><span>{node.label}</span>
        </button>
      )}
    </li>
  )
}

export default function MindMap({ map, svgRef }) {
  const [openSet, setOpenSet] = useState(() => new Set(collectPaths(map, '0', [])))
  const [selected, setSelected] = useState(null)
  // A freshly generated map re-opens every branch.
  useEffect(() => {
    setOpenSet(new Set(collectPaths(map, '0', [])))
    setSelected(null)
  }, [map])
  const toggle = useCallback((path) => {
    setOpenSet((prev) => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next })
  }, [])
  const expandAll = () => setOpenSet(new Set(collectPaths(map, '0', [])))
  const collapseAll = () => setOpenSet(new Set(['0']))
  // Defensive guard: an invalid map must never render as a single unlabeled
  // node. The tab validates before setting state, so this is a last resort.
  const mapValid = map && typeof map === 'object' && typeof map.label === 'string' && map.label.trim()
  if (!mapValid) return <div className="card"><p>Couldn&apos;t build the mind map — try again.</p></div>
  return (
    <div className="mm-shell" ref={svgRef}>
      <div className="mm-toolbar">
        <div><b>Interactive concept map</b><div className="muted small">Follow a branch, then collapse it to focus your revision.</div></div>
        <div className="mm-toolbar-actions">
          <button type="button" className="btn small" onClick={expandAll}>Expand all</button>
          <button type="button" className="btn small" onClick={collapseAll}>Collapse all</button>
        </div>
      </div>
      <div className="muted small mm-toolbar-note">Click any branch label to collapse or expand • click a leaf to focus it • scroll horizontally on smaller screens</div>
      <ul className="mm-tree"><Node node={map} path="0" depth={0} openSet={openSet} toggle={toggle} selected={selected} onSelect={setSelected} /></ul>
    </div>
  )
}
