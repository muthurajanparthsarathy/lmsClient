"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal as TerminalIcon, Trash2, Clock, CornerDownLeft } from "lucide-react"

export interface TermLine {
  id: string
  kind: "stdout" | "stderr" | "system" | "error" | "success" | "info" | "stdin"
  text: string
}

interface RunTerminalProps {
  lines: TermLine[]
  running: boolean
  stdin: string
  lastRuntimeMs?: number | null
  onStdinChange: (v: string) => void
  onClear: () => void
  // ─ Interactive (Pyodide) mode ─
  // When `interactive` is on, the batch stdin box is replaced by a live input
  // line. `awaitingInput` means the running program is paused on input().
  interactive?: boolean
  awaitingInput?: boolean
  inputPrompt?: string
  onSubmitInput?: (text: string) => void
}

const colorFor = (kind: TermLine["kind"]): string => {
  switch (kind) {
    case "stderr":
    case "error": return "#f87171"
    case "success": return "#34d399"
    case "system":
    case "info": return "#93c5fd"
    case "stdin": return "#fbbf24"
    default: return "#e5e7eb"
  }
}

export default function RunTerminal(props: RunTerminalProps) {
  const {
    lines, running, stdin, lastRuntimeMs, onStdinChange, onClear,
    interactive, awaitingInput, inputPrompt, onSubmitInput,
  } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const liveInputRef = useRef<HTMLInputElement>(null)
  const [liveValue, setLiveValue] = useState("")

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines, awaitingInput])

  // Focus the live input the moment the program asks for it.
  useEffect(() => {
    if (interactive && awaitingInput) liveInputRef.current?.focus()
  }, [interactive, awaitingInput])

  const submitLive = () => {
    if (!awaitingInput) return
    onSubmitInput?.(liveValue)
    setLiveValue("")
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-b" style={{ borderColor: "#1e293b" }}>
        <div className="flex items-center gap-2">
          <TerminalIcon size={13} className="text-emerald-400" />
          <span className="text-2xs font-semibold uppercase tracking-wide text-gray-300">Terminal</span>
          {running && <span className="text-2xs text-amber-300 animate-pulse">running…</span>}
        </div>
        <div className="flex items-center gap-3">
          {lastRuntimeMs != null && (
            <span className="flex items-center gap-1 text-2xs text-gray-400"><Clock size={11} /> {lastRuntimeMs} ms</span>
          )}
          <button onClick={onClear} title="Clear" className="text-gray-400 hover:text-gray-200"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed">
        {lines.length === 0 ? (
          <div className="text-gray-500">Ready. Press Run to execute your program.</div>
        ) : (
          lines.map((l) => (
            <pre key={l.id} className="whitespace-pre-wrap break-words m-0" style={{ color: colorFor(l.kind) }}>
              {l.kind === "stdin" ? `❯ ${l.text}` : l.text}
            </pre>
          ))
        )}
      </div>

      {/* Live console input line — only rendered when the running program is
          actually waiting for input. The old batch stdin textarea was removed
          on user request; Python uses the live input above, other languages
          run without stdin (Piston still accepts an empty stdin). */}
      {interactive && (
        <div className="flex-shrink-0 border-t px-3 py-2" style={{ borderColor: "#1e293b" }}>
          <div
            className="flex items-center gap-2 rounded px-2 py-1.5"
            style={{ background: awaitingInput ? "#1e293b" : "#172033", border: `1px solid ${awaitingInput ? "#22c55e" : "#334155"}` }}
          >
            <span className="text-xs flex-shrink-0" style={{ color: awaitingInput ? "#fbbf24" : "#64748b", fontFamily: "ui-monospace, monospace" }}>
              {awaitingInput ? (inputPrompt?.trim() ? inputPrompt : "❯") : "waiting for program…"}
            </span>
            <input
              ref={liveInputRef}
              value={liveValue}
              disabled={!awaitingInput}
              onChange={(e) => setLiveValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitLive() } }}
              placeholder={awaitingInput ? "type your input and press Enter" : ""}
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: "#e5e7eb", fontFamily: "ui-monospace, monospace" }}
            />
            <CornerDownLeft size={12} style={{ color: awaitingInput ? "#22c55e" : "#475569" }} />
          </div>
        </div>
      )}
    </div>
  )
}
