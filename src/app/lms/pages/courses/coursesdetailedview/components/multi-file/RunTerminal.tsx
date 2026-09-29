"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Clock, CornerDownLeft } from "lucide-react"

export interface TermLine {
  id: string
  kind: "stdout" | "stderr" | "system" | "error" | "success" | "info" | "stdin"
  text: string
  // Live terminal: program output / typed input that flows on from the
  // previous text (a prompt and its answer share a line). Other lines, such
  // as "$ Run …" and the exit message, always start on a line of their own.
  inline?: boolean
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
  // Live interactive compiler, VS Code-terminal style: output flows as one
  // console and the student types the answer right where the program's prompt
  // left the cursor — no separate input bar, no batch stdin box.
  live?: boolean
  // Live terminal: Ctrl+C stops the running program.
  onStop?: () => void
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
    stdin, onStdinChange,
    interactive, awaitingInput, inputPrompt, onSubmitInput, live = false, onStop,
  } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const liveInputRef = useRef<HTMLInputElement>(null)
  const [liveValue, setLiveValue] = useState("")
  // Live terminal: where the caret is in the typed text (drawn as a block
  // cursor), whether the terminal has focus, and earlier inputs for ↑/↓.
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const historyRef = useRef<string[]>([])
  const historyPosRef = useRef(-1)
  const accepting = !!(interactive && awaitingInput)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines, awaitingInput, liveValue])

  // Focus the live input the moment the program asks for it.
  useEffect(() => {
    if (interactive && awaitingInput) liveInputRef.current?.focus()
  }, [interactive, awaitingInput])

  const submitLive = () => {
    if (!awaitingInput) return
    onSubmitInput?.(liveValue)
    setLiveValue("")
  }

  if (live) {
    const setTyped = (value: string) => {
      setLiveValue(value)
      setCaret(value.length)
      requestAnimationFrame(() => liveInputRef.current?.setSelectionRange(value.length, value.length))
    }
    // Keys as in VS Code's terminal: Enter sends the line, ↑/↓ walk through
    // earlier inputs, Ctrl+C stops the program, Ctrl+L clears the screen.
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (!accepting) return
        onSubmitInput?.(liveValue)
        const history = historyRef.current
        if (liveValue.trim() && history[history.length - 1] !== liveValue) history.push(liveValue)
        historyPosRef.current = -1
        setTyped("")
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
        e.preventDefault()
        setTyped("")
        onStop?.()
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); onClear(); return }
      const history = historyRef.current
      if (e.key === "ArrowUp" && history.length) {
        e.preventDefault()
        const pos = historyPosRef.current === -1 ? history.length - 1 : Math.max(0, historyPosRef.current - 1)
        historyPosRef.current = pos
        setTyped(history[pos])
        return
      }
      if (e.key === "ArrowDown" && historyPosRef.current !== -1) {
        e.preventDefault()
        const pos = historyPosRef.current + 1
        historyPosRef.current = pos >= history.length ? -1 : pos
        setTyped(pos >= history.length ? "" : history[pos])
      }
    }
    const syncCaret = (el: HTMLInputElement) => setCaret(el.selectionStart ?? el.value.length)
    // Clicking the terminal puts the cursor back in it, unless the student
    // is selecting output to copy.
    const focusTerminal = () => { if (!window.getSelection()?.toString()) liveInputRef.current?.focus() }

    return (
      <div className="flex flex-col h-full min-h-0" style={{ background: "#F3F6FA", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
        <div
          ref={scrollRef}
          onMouseUp={focusTerminal}
          className="flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: "#172033", cursor: accepting ? "text" : "default" }}
        >
          {lines.length === 0 && !interactive ? (
            <span style={{ color: "#667085", fontFamily: "'Poppins',sans-serif" }}>
              Ready — press Run. When your program asks for input, type it right here and press Enter.
            </span>
          ) : (
            lines.map((l) => (
              <span key={l.id} style={{ display: l.inline ? "inline" : "block", color: colorFor(l.kind) }}>{l.text}</span>
            ))
          )}
          {/* What the student is typing, drawn where the program's output
              stopped, with a block cursor at the caret. */}
          {accepting && (
            <span style={{ color: colorFor("stdin") }}>
              {liveValue.slice(0, caret)}
              <span className={focused ? "rt-cursor" : "rt-cursor-idle"}>{liveValue[caret] ?? " "}</span>
              {liveValue.slice(caret + 1)}
            </span>
          )}
          {/* Takes the keystrokes; the text is drawn above. */}
          <input
            ref={liveInputRef}
            value={liveValue}
            onChange={(e) => { setLiveValue(e.target.value); syncCaret(e.target) }}
            onSelect={(e) => syncCaret(e.currentTarget)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={!accepting}
            aria-label="Program input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="pointer-events-none inline-block h-0 w-0 border-0 p-0 opacity-0"
          />
        </div>
        <style>{"@keyframes rt-blink{0%,49%{background:#172033;color:#F3F6FA}50%,100%{background:transparent;color:inherit}}.rt-cursor{animation:rt-blink 1.06s step-end infinite}.rt-cursor-idle{outline:1px solid #94A3B8;outline-offset:-1px}"}</style>
      </div>
    )
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

      {/* Batch stdin — the terminal's "test case input". Whatever sits here is
          piped to the program's stdin on Run, so a student can paste a test
          case, run, and read the raw output. Nothing is compared or scored:
          this is a console, not a judge. Replaced by the live input line
          during an interactive (Pyodide) run, where the program asks for
          input one line at a time instead. */}
      {!interactive && (
        <div className="flex-shrink-0 border-t px-3 py-2" style={{ borderColor: "#D9E1EA", background: "#fff" }}>
          <label
            htmlFor="run-terminal-stdin"
            style={{
              display: 'block', marginBottom: 4,
              fontFamily: "'Poppins',sans-serif", fontSize: 11, fontWeight: 600,
              color: '#667085', textTransform: 'uppercase', letterSpacing: 0.4,
            }}
          >
            Test case input (stdin)
          </label>
          <textarea
            id="run-terminal-stdin"
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="Paste the input for this run — it is piped straight to your program."
            className="w-full resize-y rounded outline-none"
            style={{
              padding: '6px 8px', border: '1px solid #D9E1EA', background: '#F3F6FA',
              color: '#172033', fontFamily: 'ui-monospace, monospace', fontSize: 12,
              minHeight: 40, maxHeight: 160,
            }}
          />
        </div>
      )}
    </div>
  )
}
