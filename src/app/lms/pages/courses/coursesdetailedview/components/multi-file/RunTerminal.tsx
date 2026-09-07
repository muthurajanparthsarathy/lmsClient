"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, CornerDownLeft } from "lucide-react"

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

// Light-theme terminal — no dark surfaces on the student workspace per the
// redesign. Kinds get accessible foreground colors on a cool-gray background;
// nothing communicates status by color alone (each line still uses the same
// prefix marker for stdin and the row keeps its semantics).
const colorFor = (kind: TermLine["kind"]): string => {
  switch (kind) {
    case "stderr":
    case "error": return "#B42318"
    case "success": return "#12A765"
    case "system":
    case "info": return "#175CD3"
    case "stdin": return "#B54708"
    default: return "#172033"
  }
}

export default function RunTerminal(props: RunTerminalProps) {
  const {
    lines, running, lastRuntimeMs, onClear,
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
    <div className="flex flex-col h-full min-h-0" style={{ background: "#F3F6FA", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
      {/* Header — only the run status + runtime remain. The Terminal
          label and Clear control live on the outer BottomPanel tab strip,
          so a duplicate trash icon here was appearing twice. */}
      {(running || lastRuntimeMs != null) && (
        <div className="flex items-center justify-end gap-3 px-3 py-1.5 flex-shrink-0 border-b" style={{ borderColor: "#D9E1EA", background: "#fff" }}>
          {running && <span className="text-xs animate-pulse" style={{ color: "#B54708" }}>running…</span>}
          {lastRuntimeMs != null && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "#667085" }}>
              <Clock size={11} /> {lastRuntimeMs} ms
            </span>
          )}
        </div>
      )}

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed" style={{ color: "#172033" }}>
        {lines.length === 0 ? (
          <div style={{ color: "#667085", fontFamily: "'Poppins',sans-serif" }}>
            Ready — run your code to see output.
          </div>
        ) : (
          lines.map((l) => (
            <pre key={l.id} className="whitespace-pre-wrap break-words m-0" style={{ color: colorFor(l.kind) }}>
              {l.kind === "stdin" ? `❯ ${l.text}` : l.text}
            </pre>
          ))
        )}
      </div>

      {/* Live console input line — only rendered when the running program is
          actually waiting for input. Kept light-themed to match the workspace. */}
      {interactive && (
        <div className="flex-shrink-0 border-t px-3 py-2" style={{ borderColor: "#D9E1EA", background: "#fff" }}>
          <div
            className="flex items-center gap-2 rounded px-2 py-1.5"
            style={{
              background: awaitingInput ? "#F0FDF4" : "#F3F6FA",
              border: `1px solid ${awaitingInput ? "#12A765" : "#D9E1EA"}`,
            }}
          >
            <span className="text-xs flex-shrink-0" style={{ color: awaitingInput ? "#B54708" : "#94A3B8", fontFamily: "ui-monospace, monospace" }}>
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
              style={{ color: "#172033", fontFamily: "ui-monospace, monospace" }}
              aria-label="Program input"
            />
            <CornerDownLeft size={12} style={{ color: awaitingInput ? "#12A765" : "#94A3B8" }} />
          </div>
        </div>
      )}
    </div>
  )
}
