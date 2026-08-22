"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { X, AlertTriangle, Loader2 } from "lucide-react"
import type { TraceStep, TraceValue, HeapObject } from "@/lib/pythonTracer"

interface TraceVisualizerProps {
  source: string
  steps: TraceStep[]
  complete: boolean
  building: boolean
  truncated?: boolean
  awaitingInput: boolean
  inputPrompt: string
  inputs: string[]
  onSubmitInput: (text: string) => void
  onClose?: () => void
}

// ─── value rendering ─────────────────────────────────────────────────────────
function ValueChip({ v }: { v: TraceValue }) {
  if (v.kind === "prim") {
    const color =
      v.type === "str" ? "#16a34a" :
      v.type === "NoneType" ? "#9ca3af" :
      v.type === "bool" ? "#9333ea" : "#2563eb"
    return <span style={{ color, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{v.type === "str" ? `"${v.value}"` : v.value}</span>
  }
  // A reference renders as a small anchor dot; a real arrow is drawn from here
  // to the target object box by the overlay (see the SVG connector layer).
  return (
    <span data-ref-src={v.id} style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#5b6bd6", border: "2px solid #c7d2fe", display: "inline-block" }} />
    </span>
  )
}

function HeapBox({ id, obj }: { id: string; obj: HeapObject }) {
  const header = (label: string, extra?: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
      {label} #{id.slice(-4)}{extra ? ` ${extra}` : ""}
    </div>
  )
  const cell: React.CSSProperties = { minWidth: 26, padding: "3px 6px", border: "1px solid #e5e7eb", background: "#fff", fontSize: 11.5, fontFamily: "ui-monospace, monospace", textAlign: "center" }
  const wrap: React.CSSProperties = { border: "1px solid #c7d2fe", borderRadius: 8, padding: 8, background: "#f8faff", display: "inline-block" }

  if (obj.type === "list" || obj.type === "tuple" || obj.type === "set") {
    const open = obj.type === "tuple" ? "(" : obj.type === "set" ? "{" : "["
    const close = obj.type === "tuple" ? ")" : obj.type === "set" ? "}" : "]"
    return (
      <div data-ref-id={id} style={wrap}>
        {header(obj.type)}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", marginRight: 2 }}>{open}</span>
          {(obj.elements || []).map((el, i) => (
            <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
              {obj.type !== "set" && <span style={{ fontSize: 8, color: "#9ca3af" }}>{i}</span>}
              <span style={cell}><ValueChip v={el} /></span>
            </span>
          ))}
          <span style={{ color: "#9ca3af", marginLeft: 2 }}>{close}</span>
          {obj.n != null && obj.elements && obj.n > obj.elements.length && (
            <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 4 }}>+{obj.n - obj.elements.length} more</span>
          )}
        </div>
      </div>
    )
  }
  if (obj.type === "dict") {
    return (
      <div data-ref-id={id} style={wrap}>
        {header("dict")}
        <table style={{ borderCollapse: "collapse" }}><tbody>
          {(obj.entries || []).map(([k, val], i) => (
            <tr key={i}><td style={{ ...cell, background: "#eef2ff" }}><ValueChip v={k} /></td><td style={{ ...cell, textAlign: "left" }}><ValueChip v={val} /></td></tr>
          ))}
        </tbody></table>
      </div>
    )
  }
  if (obj.type === "instance") {
    return (
      <div data-ref-id={id} style={wrap}>
        {header("object", obj.className)}
        <table style={{ borderCollapse: "collapse" }}><tbody>
          {Object.entries(obj.attrs || {}).map(([k, val]) => (
            <tr key={k}><td style={{ ...cell, background: "#f1f5f9", textAlign: "left" }}>{k}</td><td style={{ ...cell, textAlign: "left" }}><ValueChip v={val} /></td></tr>
          ))}
        </tbody></table>
      </div>
    )
  }
  if (obj.type === "function" || obj.type === "module") {
    return <div style={wrap}>{header(obj.type)}<span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#374151" }}>{obj.name}{obj.type === "function" ? "()" : ""}</span></div>
  }
  return <div style={wrap}>{header(obj.type, obj.className)}<span style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", color: "#374151" }}>{obj.repr}</span></div>
}

// ─── main component ──────────────────────────────────────────────────────────
export default function TraceVisualizer(props: TraceVisualizerProps) {
  const { source, steps, complete, building, truncated, awaitingInput, inputPrompt, inputs, onSubmitInput, onClose } = props
  const [idx, setIdx] = useState(0)
  const [liveValue, setLiveValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const codeScrollRef = useRef<HTMLDivElement>(null)

  const sourceLines = useMemo(() => source.replace(/\n$/, "").split("\n"), [source])
  const atFrontier = idx >= steps.length - 1
  const clampedIdx = Math.min(idx, Math.max(0, steps.length - 1))
  const step: TraceStep | undefined = steps[clampedIdx]

  const redLine = step ? step.line : -1
  const greenLine = clampedIdx > 0 ? steps[clampedIdx - 1].line : -1

  // Do NOT auto-jump to the frontier — the student starts at Step 1 and drives
  // forward with Next. The input box only appears once they actually step to the
  // line that calls input() (see `awaitingInput && atFrontier` below), so it
  // never looks like execution "ran ahead" before any input was given.

  // Focus the input field only when we're parked ON the input line.
  useEffect(() => { if (awaitingInput && atFrontier) inputRef.current?.focus() }, [awaitingInput, atFrontier])

  useEffect(() => {
    if (redLine > 0) {
      const el = codeScrollRef.current?.querySelector(`[data-line="${redLine}"]`) as HTMLElement | null
      el?.scrollIntoView({ block: "nearest" })
    }
  }, [redLine])

  const go = useCallback((n: number) => setIdx(() => Math.max(0, Math.min(steps.length - 1, n))), [steps.length])

  const visibleHeap = useMemo(() => {
    if (!step) return [] as Array<{ id: string; obj: HeapObject }>
    const seen = new Set<string>(); const order: string[] = []
    const walkVal = (v: TraceValue) => {
      if (v.kind === "ref" && !seen.has(v.id)) { seen.add(v.id); order.push(v.id); const o = step.heap[v.id]; if (o) walkObj(o) }
    }
    const walkObj = (o: HeapObject) => {
      o.elements?.forEach(walkVal)
      o.entries?.forEach(([k, val]) => { walkVal(k); walkVal(val) })
      if (o.attrs) Object.values(o.attrs).forEach(walkVal)
    }
    step.stack.forEach((f) => Object.values(f.locals).forEach(walkVal))
    return order.map((id) => ({ id, obj: step.heap[id] })).filter((x) => x.obj)
  }, [step])

  // ── Connector arrows: variable/element ref → object box ──────────────────────
  const refLayerRef = useRef<HTMLDivElement>(null)
  const [arrows, setArrows] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; key: string }>>([])

  const recomputeArrows = useCallback(() => {
    const layer = refLayerRef.current
    if (!layer) return
    const base = layer.getBoundingClientRect()
    const sources = Array.from(layer.querySelectorAll("[data-ref-src]")) as HTMLElement[]
    const next: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = []
    sources.forEach((src, i) => {
      const id = src.dataset.refSrc
      if (!id) return
      // Quoted attribute selector — only quotes/backslashes need escaping (NOT
      // CSS.escape, which is for unquoted identifiers and would mangle numeric ids).
      const sel = `[data-ref-id="${id.replace(/["\\]/g, "\\$&")}"]`
      const target = layer.querySelector(sel) as HTMLElement | null
      if (!target) return
      const s = src.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      next.push({
        x1: s.right - base.left,
        y1: s.top + s.height / 2 - base.top,
        x2: t.left - base.left,
        y2: t.top + 14 - base.top,
        key: `${id}-${i}`,
      })
    })
    setArrows(next)
  }, [])

  // Recompute after every render that can move boxes (step change, heap change),
  // and on scroll/resize of the panels.
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(recomputeArrows)
    return () => cancelAnimationFrame(raf)
  }, [recomputeArrows, clampedIdx, visibleHeap, steps.length, awaitingInput])

  useEffect(() => {
    const onChange = () => recomputeArrows()
    window.addEventListener("resize", onChange)
    const layer = refLayerRef.current
    const scrollers = layer ? Array.from(layer.querySelectorAll("div")) : []
    scrollers.forEach((d) => d.addEventListener("scroll", onChange, { passive: true }))
    return () => {
      window.removeEventListener("resize", onChange)
      scrollers.forEach((d) => d.removeEventListener("scroll", onChange))
    }
  }, [recomputeArrows, clampedIdx])

  const submitInput = () => { onSubmitInput(liveValue); setLiveValue("") }

  const stepBtn: React.CSSProperties = {
    padding: "5px 12px", border: "1px solid #c7c7c7", borderRadius: 4, background: "#f3f4f6",
    fontSize: 12.5, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "'Poppins', sans-serif",
  }
  const stepBtnDisabled: React.CSSProperties = { ...stepBtn, color: "#bcbcbc", cursor: "not-allowed", background: "#f9fafb" }
  const ARROW_COL = 26

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: "'Poppins', sans-serif", background: "#fff" }}>
      {/* Slim top bar with close */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0" style={{ borderColor: "#e5e7eb" }}>
        <span className="text-xs font-bold text-gray-700">Python Execution Visualizer</span>
        <div className="flex items-center gap-2">
          {building && !complete && <span className="flex items-center gap-1 text-2xs text-indigo-500"><Loader2 size={12} className="animate-spin" /> running…</span>}
          {onClose && <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={15} className="text-gray-500" /></button>}
        </div>
      </div>

      {/* TWO COLUMNS (left = code + controls + input, right = output + frames + objects) */}
      <div className="flex-1 min-h-0 flex">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col min-h-0 border-r" style={{ width: "52%", borderColor: "#e5e7eb" }}>
          <div className="text-center py-1.5 flex-shrink-0">
            <div className="text-sm text-gray-700">Python 3.11</div>
          </div>

          {/* Code with arrows */}
          <div ref={codeScrollRef} className="flex-1 overflow-auto border-y" style={{ background: "#fbfbfd", borderColor: "#e5e7eb" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 13 }}>
              <tbody>
                {sourceLines.map((ln, i) => {
                  const n = i + 1
                  const isRed = n === redLine
                  const isGreen = n === greenLine
                  return (
                    <tr key={n} data-line={n} style={{ background: isRed ? "rgba(245,160,170,0.45)" : isGreen ? "rgba(186,236,193,0.6)" : "transparent" }}>
                      <td style={{ width: ARROW_COL, textAlign: "center", verticalAlign: "top", userSelect: "none" }}>
                        {isRed ? <span style={{ color: "#e11d48", fontWeight: 900 }}>➡</span> : isGreen ? <span style={{ color: "#22c55e", fontWeight: 900 }}>➡</span> : null}
                      </td>
                      <td style={{ width: 34, textAlign: "right", paddingRight: 8, color: "#9ca3af", userSelect: "none", verticalAlign: "top" }}>{n}</td>
                      <td style={{ whiteSpace: "pre", color: "#1e293b", paddingRight: 12, verticalAlign: "top" }}>{ln || " "}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-0.5 px-3 py-1.5 flex-shrink-0 text-2xs" style={{ color: "#6b7280" }}>
            <span className="flex items-center gap-1.5"><span style={{ color: "#22c55e", fontWeight: 900 }}>➡</span> line that just executed</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "#e11d48", fontWeight: 900 }}>➡</span> next line to execute</span>
          </div>

          {/* Scrubber */}
          <div className="px-3 flex-shrink-0">
            <input type="range" min={0} max={Math.max(0, steps.length - 1)} value={clampedIdx} onChange={(e) => go(Number(e.target.value))} style={{ width: "100%" }} />
          </div>

          {/* Step buttons — Next/Last stay disabled at the frontier (e.g. while
              the program is waiting for input). First/Prev let you step back. */}
          <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
            <button style={clampedIdx === 0 ? stepBtnDisabled : stepBtn} disabled={clampedIdx === 0} onClick={() => go(0)}>&lt;&lt; First</button>
            <button style={clampedIdx === 0 ? stepBtnDisabled : stepBtn} disabled={clampedIdx === 0} onClick={() => go(clampedIdx - 1)}>&lt; Prev</button>
            <button
              style={atFrontier ? stepBtnDisabled : stepBtn}
              disabled={atFrontier}
              title={awaitingInput ? "Enter the requested input below to continue" : undefined}
              onClick={() => go(clampedIdx + 1)}
            >Next &gt;</button>
            <button style={atFrontier ? stepBtnDisabled : stepBtn} disabled={atFrontier} onClick={() => go(steps.length - 1)}>Last &gt;&gt;</button>
          </div>

          {/* Why Next is disabled, when we're paused on input() */}
          {awaitingInput && atFrontier && (
            <div className="text-center text-2xs flex-shrink-0 pb-1" style={{ color: "#be185d" }}>
              ⤓ waiting for input — enter a value below to continue
            </div>
          )}

          {/* Step counter */}
          <div className="text-center text-2xs text-gray-500 pb-1 flex-shrink-0">
            Step {steps.length ? clampedIdx + 1 : 0} of {steps.length}{!complete && " …"}
            {step && <span className="ml-2 px-1.5 py-0.5 rounded text-2xs font-semibold" style={{ background: "#eef2ff", color: "#4338ca" }}>{step.event}</span>}
            {truncated && <span className="ml-2 text-amber-600">truncated</span>}
          </div>

          {/* Enter user input — shown only when stepped onto the input line */}
          {awaitingInput && atFrontier && (
            <div className="flex-shrink-0 mx-3 mb-3 rounded" style={{ border: "2px solid #f472b6", padding: "10px 12px" }}>
              <div className="text-center text-sm font-bold mb-2" style={{ color: "#be185d" }}>Enter user input:</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm" style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>{inputPrompt?.trim() ? inputPrompt : "input:"}</span>
                <input
                  ref={inputRef}
                  value={liveValue}
                  onChange={(e) => setLiveValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitInput() } }}
                  className="rounded px-2 py-1 text-sm outline-none"
                  style={{ border: "1px solid #9ca3af", fontFamily: "ui-monospace, monospace", width: 180 }}
                  autoFocus
                />
                <button onClick={submitInput} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: "#e5e7eb", border: "1px solid #c7c7c7", color: "#374151" }}>Submit</button>
              </div>
            </div>
          )}

          {/* Collected inputs */}
          {inputs.length > 0 && (
            <div className="flex-shrink-0 px-3 pb-2 text-center">
              <span className="text-2xs font-bold uppercase tracking-wide" style={{ color: "#be185d" }}>User inputs: </span>
              <span className="text-2xs text-gray-600" style={{ fontFamily: "ui-monospace, monospace" }}>{inputs.map((v, i) => `${i + 1}. ${v}`).join("   ")}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col min-h-0 flex-1">
          {/* Print output (resizable) */}
          <div className="flex-shrink-0 px-3 pt-2">
            <div className="text-2xs text-gray-500 mb-1">Print output <span className="text-gray-400">(drag lower right corner to resize)</span></div>
            <textarea
              readOnly
              value={step?.stdout || ""}
              className="w-full text-sm rounded px-2 py-1.5"
              style={{ border: "1px solid #d1d5db", background: "#fff", color: "#0f172a", fontFamily: "ui-monospace, monospace", resize: "vertical", minHeight: 70, height: 90 }}
            />
          </div>

          {step?.exception && (
            <div className="flex items-center gap-2 mx-3 mt-2 px-2 py-1.5 text-2xs flex-shrink-0 rounded" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              <AlertTriangle size={13} /> {step.exception.type}: {step.exception.message}
            </div>
          )}

          {/* Frames | Objects with SVG connector arrows overlaid */}
          <div ref={refLayerRef} className="flex-1 min-h-0 grid pt-2 relative" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 5 }}>
              <defs>
                <marker id="ptArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L7,3 L0,6 Z" fill="#7c83a6" />
                </marker>
              </defs>
              {arrows.map((a) => {
                const dx = Math.max(28, Math.abs(a.x2 - a.x1) / 2)
                return (
                  <path
                    key={a.key}
                    d={`M ${a.x1} ${a.y1} C ${a.x1 + dx} ${a.y1}, ${a.x2 - dx} ${a.y2}, ${a.x2} ${a.y2}`}
                    fill="none" stroke="#7c83a6" strokeWidth={1.4} markerEnd="url(#ptArrow)"
                  />
                )
              })}
            </svg>
            <div className="overflow-auto px-3">
              <div className="text-center text-sm text-gray-600 mb-2">Frames</div>
              {step?.stack.map((frame, i) => {
                const isTop = i === step.stack.length - 1
                return (
                  <div key={i} className="mb-2 border" style={{ borderColor: isTop ? "#a5a5e0" : "#e5e7eb", background: isTop ? "#eef0fb" : "#fafafa" }}>
                    <div className="px-2 py-1 text-xs font-semibold" style={{ color: "#374151" }}>
                      {frame.isGlobal ? "Global frame" : `${frame.name}`}
                    </div>
                    <div className="p-1.5">
                      {Object.keys(frame.locals).length === 0 ? (
                        <div className="text-2xs text-gray-400 px-1">—</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                          {Object.entries(frame.locals).map(([name, val]) => (
                            <tr key={name}>
                              <td style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", padding: "2px 6px", textAlign: "right", whiteSpace: "nowrap", background: "#e9e9f3", border: "1px solid #d6d6e6" }}>{name}</td>
                              <td style={{ padding: "2px 6px", border: "1px solid #d6d6e6", background: "#fff" }}><ValueChip v={val} /></td>
                            </tr>
                          ))}
                        </tbody></table>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="overflow-auto px-3">
              <div className="text-center text-sm text-gray-600 mb-2">Objects</div>
              {visibleHeap.length === 0 ? (
                <div className="text-2xs text-gray-400 text-center">—</div>
              ) : (
                <div className="flex flex-col gap-2 items-start">{visibleHeap.map(({ id, obj }) => <HeapBox key={id} id={id} obj={obj} />)}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
