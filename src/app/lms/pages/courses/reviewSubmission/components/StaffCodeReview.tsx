"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Code2, Play, Square, Trash2, Terminal as TerminalIcon,
  ChevronRight, ChevronDown, ChevronLeft, Folder as FolderIcon, FolderOpen, File as FileIcon,
  Sun, Moon, X, ChevronUp, Files as FilesIcon, FileText, Maximize2, Minimize2,
  ChevronsLeft, ChevronsRight, UserRound,
} from "lucide-react"
import MonacoTabs from "@/app/lms/component/student/multi-file/MonacoTabs"
import RunTerminal, { type TermLine } from "@/app/lms/component/student/multi-file/RunTerminal"
import { type FileNode, type FolderNode, normPath, uid } from "@/app/lms/component/student/multi-file/types"
import {
  detectLanguageFromFilename, normalizeLanguage,
  type SupportedLanguage, LANGUAGE_CONFIG,
} from "@/lib/codeLanguages"
import { runOnPiston, type RunFile } from "@/lib/pistonClient"
import { runInteractivePython, type InteractiveHandle } from "@/lib/pyodideRunner"

// ─── Prop shapes (unchanged from the old code-server version) ────────────────
interface FileEntry {
  id: string
  filename: string
  content: string
  language: string
  path: string
  folderPath: string
  isEntryPoint?: boolean
}

interface FolderEntry {
  id: string
  name: string
  path: string
  parentPath: string
  depth: number
}

interface StaffCodeReviewProps {
  files: FileEntry[]
  folders: FolderEntry[]
  questionTitle: string
  submittedAt?: string
  attemptCount?: number
  lateSubmission?: boolean
  lastTestSubmittedAt?: string
  /** Unique id for this submission — remounts the review when it changes. */
  submissionId?: string
  /** Languages allowed by the exercise (first one seeds the runtime). */
  selectedLanguages?: string[]
  /** Rich question detail (title, description, sample I/O, MCQ options, …)
   *  rendered in the sidebar "Problem" tab and the fullscreen drawer. Kept
   *  as a ReactNode so callers can compose whatever fields the exercise
   *  actually carries — the component just displays it in a scroll area.
   *  When absent, the Problem icon in the activity rail is hidden. */
  questionNode?: React.ReactNode
  /** Student nav — shown in the editor toolbar when provided. */
  currentStudentName?: string
  studentPosition?: string
  onPrevStudent?: () => void
  onNextStudent?: () => void
  hasPrevStudent?: boolean
  hasNextStudent?: boolean
  /** Question nav — shown in the editor toolbar when provided. */
  questionPosition?: string
  onPrevQuestion?: () => void
  onNextQuestion?: () => void
  hasPrevQuestion?: boolean
  hasNextQuestion?: boolean
}

// ═════════════════════════════════════════════════════════════════════════════
// Staff Core-Programming review — native, read-only, no code-server.
// A trainer sees the submitted folder tree in the left rail, opens any file
// into a Monaco tab, and runs the whole project via Piston. Output lands in a
// bottom terminal panel. Nothing is editable, so there is no save/write path.
// Replaces the old iframe that pointed at localhost:8080 / a code-server agent.
// ═════════════════════════════════════════════════════════════════════════════
export default function StaffCodeReview({
  files, folders, questionTitle,
  submittedAt, attemptCount, lateSubmission, lastTestSubmittedAt,
  submissionId, selectedLanguages,
  questionNode,
  currentStudentName, studentPosition,
  onPrevStudent, onNextStudent, hasPrevStudent, hasNextStudent,
  questionPosition,
  onPrevQuestion, onNextQuestion, hasPrevQuestion, hasNextQuestion,
}: StaffCodeReviewProps) {
  // ── Normalise inputs into the FileNode / FolderNode shape the multi-file
  // toolkit already uses on the student side, so MonacoTabs / detection all
  // read the same fields. `id` and `path` are preserved when present.
  const nodeFiles = useMemo<FileNode[]>(() => {
    return (files || []).map((f) => {
      const path = normPath(f.path || `/${f.filename}`)
      const filename = f.filename || path.split("/").pop() || "file"
      const detected = detectLanguageFromFilename(filename)
      return {
        id: f.id || uid("f"),
        filename,
        content: f.content ?? "",
        language: (detected as SupportedLanguage) || ("text" as any),
        path,
        folderPath: f.folderPath || (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) || "/" : "/"),
        isEntryPoint: !!f.isEntryPoint,
      }
    })
  }, [files])

  const nodeFolders = useMemo<FolderNode[]>(() => {
    // Trust the supplied folders when present; otherwise derive from file paths
    // so a submission that only sent files still renders a tree.
    if (folders && folders.length) {
      return folders.map((d) => ({
        id: d.id || uid("d"),
        name: d.name,
        path: normPath(d.path),
        parentPath: normPath(d.parentPath || "/"),
      }))
    }
    const seen = new Set<string>()
    const out: FolderNode[] = []
    for (const f of nodeFiles) {
      const parts = f.folderPath.split("/").filter(Boolean)
      let acc = ""
      for (const part of parts) {
        const parent = acc || "/"
        acc = `${acc}/${part}`
        const path = normPath(acc)
        if (seen.has(path)) continue
        seen.add(path)
        out.push({ id: uid("d"), name: part, path, parentPath: normPath(parent) })
      }
    }
    return out
  }, [folders, nodeFiles])

  // Pick the runtime language: prefer the exercise's declared list, else fall
  // back to the entry file's extension, else python.
  const runtimeLanguage = useMemo<SupportedLanguage>(() => {
    for (const raw of selectedLanguages || []) {
      const norm = normalizeLanguage(raw)
      if (norm) return norm
    }
    const entry = nodeFiles.find((f) => f.isEntryPoint) || nodeFiles[0]
    if (entry) {
      const lang = detectLanguageFromFilename(entry.filename)
      if (lang && lang !== "text") return lang as SupportedLanguage
    }
    return "python"
  }, [selectedLanguages, nodeFiles])

  // ── Tab / active-file state. Opens the entry file (or the first file) by
  // default so the trainer doesn't land on an empty pane.
  const [openTabIds, setOpenTabIds] = useState<string[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  useEffect(() => {
    const preferred = nodeFiles.find((f) => f.isEntryPoint) || nodeFiles[0]
    if (preferred) {
      setOpenTabIds([preferred.id])
      setActiveFileId(preferred.id)
    } else {
      setOpenTabIds([])
      setActiveFileId(null)
    }
  }, [submissionId, nodeFiles])

  const openFile = useCallback((id: string) => {
    setActiveFileId(id)
    setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const closeTab = useCallback((id: string) => {
    setOpenTabIds((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const next = prev.filter((x) => x !== id)
      if (activeFileId === id) {
        setActiveFileId(next[Math.max(0, idx - 1)] ?? null)
      }
      return next
    })
  }, [activeFileId])

  const openFiles = useMemo(
    () => openTabIds.map((id) => nodeFiles.find((f) => f.id === id)).filter(Boolean) as FileNode[],
    [openTabIds, nodeFiles],
  )

  // ── Run pipeline (Piston). Sends the whole project in one request; entry
  // file is picked by pistonClient (isEntryPoint > conventional name > first).
  const [lines, setLines] = useState<TermLine[]>([])
  const [running, setRunning] = useState(false)
  const [stdin, setStdin] = useState("")
  const [lastRuntimeMs, setLastRuntimeMs] = useState<number | null>(null)
  const [termOpen, setTermOpen] = useState(true)
  // Terminal height (px) — remembered while the terminal is closed so re-open
  // restores the same size. Bounds are clamped in the drag handler.
  const [termHeight, setTermHeight] = useState(240)
  const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light")
  // Sidebar model — VS Code-style. `sidebarView` picks which panel content is
  // shown; `null` collapses the panel and leaves only the activity rail.
  // "problem" only exists when the parent supplied a questionNode.
  const hasQuestionPanel = !!questionNode
  type SidebarView = "files" | "problem" | null
  const [sidebarView, setSidebarView] = useState<SidebarView>("files")
  // Editor fullscreen — detaches from the page.tsx chrome via position:fixed
  // and drops the activity rail + file tree. Problem panel stays available
  // in-flow beside the editor (toggleable), not as an overlay drawer.
  const [isFull, setIsFull] = useState(false)
  // Whether the Problem panel is visible in fullscreen. Defaults to true so
  // entering fullscreen shows the question next to the code straight away;
  // trainer can close it via the panel's X to give the editor the full width.
  const [fullProblemOpen, setFullProblemOpen] = useState(true)
  // Reset every time fullscreen is re-entered, so the "open by default"
  // promise re-applies rather than remembering a previous close.
  useEffect(() => { if (isFull) setFullProblemOpen(true) }, [isFull])

  // Per-submission cleanup — question navigation keeps the component mounted
  // (so isFull persists across empty questions), but we still need to stop
  // any in-flight run and clear the terminal so the previous question's
  // output doesn't bleed into the next. Fullscreen + theme deliberately
  // survive this reset.
  useEffect(() => {
    interactiveHandleRef.current?.stop()
    interactiveHandleRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    if (inputResolverRef.current) {
      inputResolverRef.current("")
      inputResolverRef.current = null
    }
    setRunning(false)
    setInteractiveActive(false)
    setAwaitingInput(false)
    setInputPrompt("")
    setLines([])
    setLastRuntimeMs(null)
    setStdin("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])
  // Two execution engines, chosen by language:
  //   • Python  → Pyodide (WASM in the browser) via runInteractivePython.
  //               Program pauses at every input() and we prompt live — same
  //               behaviour as the student's multi-file editor.
  //   • Others  → Piston (batch HTTP). Piston has no live stdin, so if the
  //               code reads input we collect it up-front line-by-line and
  //               hand the joined text to Piston as its `stdin`.
  // `awaitingInput` + `inputPrompt` drive the same RunTerminal live-input line
  // in both modes; the submit handler routes to whichever is active.
  const [interactiveActive, setInteractiveActive] = useState(false)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [inputPrompt, setInputPrompt] = useState<string>("")
  const abortRef = useRef<AbortController | null>(null)
  const inputResolverRef = useRef<((v: string) => void) | null>(null)
  const interactiveHandleRef = useRef<InteractiveHandle | null>(null)
  const inputPromptRef = useRef<string>("")

  const addLine = useCallback((kind: TermLine["kind"], text: string) => {
    setLines((prev) => [...prev, { id: uid("l"), kind, text }])
  }, [])

  const clearTerminal = useCallback(() => setLines([]), [])

  // Detect whether any of the submitted files reads from stdin. Skipping
  // string-literal / comment awareness keeps this cheap; the worst case is a
  // false positive (we prompt for stdin the code doesn't actually need) which
  // costs one extra Enter, not a broken run.
  const codeNeedsInput = useMemo(() => {
    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      python:     /\b(input|raw_input)\s*\(|sys\.stdin\b/,
      javascript: /\b(prompt|readline|readlineSync|readline-sync)\s*\(|process\.stdin\b/,
      typescript: /\b(prompt|readline|readlineSync|readline-sync)\s*\(|process\.stdin\b/,
      java:       /\b(Scanner|BufferedReader|System\.in)\b/,
      c:          /\b(scanf|getchar|gets|fgets)\s*\(/,
      cpp:        /\b(cin\b|getline\s*\(|scanf\s*\(|getchar\s*\()/,
      go:         /\b(bufio\.NewScanner\s*\(\s*os\.Stdin|fmt\.Scan(ln|f)?\s*\()/,
    }
    const rx = patterns[runtimeLanguage]
    if (!rx) return false
    return nodeFiles.some((f) => rx.test(f.content))
  }, [runtimeLanguage, nodeFiles])

  // A single submit handler that routes to whichever engine is currently
  // waiting for input — the Pyodide handle (live per-input) or the Piston
  // batch collector's promise.
  const submitInteractiveInput = useCallback((text: string) => {
    if (interactiveHandleRef.current) {
      // Live mode — echo prompt + typed value so the transcript reads like a
      // real console, then hand the line to the running program.
      addLine("stdout", `${inputPromptRef.current || ""}${text}`)
      setAwaitingInput(false)
      setInputPrompt("")
      interactiveHandleRef.current.provideInput(text)
      return
    }
    const resolve = inputResolverRef.current
    if (!resolve) return
    inputResolverRef.current = null
    if (text.length > 0) addLine("stdin", text)
    resolve(text)
  }, [addLine])

  const askOneInputLine = useCallback((prompt: string) => {
    setInputPrompt(prompt)
    setAwaitingInput(true)
    return new Promise<string>((resolve) => {
      inputResolverRef.current = resolve
    })
  }, [])

  // Pick the Python entry file for Pyodide — mirrors the student side.
  const pickPythonEntry = useCallback((): FileNode | null => {
    const active = nodeFiles.find((f) => f.id === activeFileId)
    if (active && detectLanguageFromFilename(active.filename) === "python") return active
    return (
      nodeFiles.find((f) => f.isEntryPoint && detectLanguageFromFilename(f.filename) === "python") ||
      nodeFiles.find((f) => detectLanguageFromFilename(f.filename) === "python") ||
      null
    )
  }, [nodeFiles, activeFileId])

  const runCode = useCallback(async () => {
    if (running || interactiveActive) return
    if (!nodeFiles.length) {
      addLine("error", "No files in this submission to run.")
      return
    }
    setTermOpen(true)
    setLastRuntimeMs(null)

    // ── Python branch: Pyodide, live input at every input() call. ──────────
    if (runtimeLanguage === "python") {
      const entry = pickPythonEntry()
      if (!entry || !entry.content.trim()) {
        addLine("error", "No Python entry file found in this submission.")
        return
      }
      setInteractiveActive(true)
      addLine("system", "$ Interactive run (Python · live input)")
      try {
        const projectFiles = nodeFiles.map((f) => ({ path: f.path, content: f.content }))
        const t0 = performance.now()
        const handle = await runInteractivePython(entry.content, {
          onReady: () => {},
          onStdout: (t) => addLine("stdout", t),
          onStderr: (t) => addLine("stderr", t),
          onInputRequest: (prompt) => {
            inputPromptRef.current = prompt
            setInputPrompt(prompt)
            setAwaitingInput(true)
          },
          onDone: (err) => {
            const dt = Math.round(performance.now() - t0)
            setLastRuntimeMs(dt)
            setAwaitingInput(false)
            setInputPrompt("")
            setInteractiveActive(false)
            interactiveHandleRef.current = null
            if (err) {
              addLine(err === "Execution stopped." ? "system" : "error", err)
            } else {
              addLine("success", `Finished in ${dt}ms`)
            }
          },
        }, { files: projectFiles })
        interactiveHandleRef.current = handle
      } catch (e: any) {
        setInteractiveActive(false)
        addLine("error", `Interactive run failed: ${e?.message || e}`)
      }
      return
    }

    // ── Other languages: Piston batch, collect stdin up front if needed. ───
    setRunning(true)
    let batchStdin = stdin
    if (codeNeedsInput) {
      addLine("system", "This submission reads input. Type each value, press Enter for the next line. Blank line = done.")
      const collected: string[] = []
      // Cap the loop so a stuck flow can't lock the UI forever.
      for (let i = 0; i < 100; i++) {
        const line = await askOneInputLine(collected.length === 0 ? "stdin ›" : "stdin › (blank = done)")
        if (line.length === 0) break
        collected.push(line)
      }
      setAwaitingInput(false)
      setInputPrompt("")
      batchStdin = collected.length ? collected.join("\n") + "\n" : ""
      addLine("system", `Input captured (${collected.length} line${collected.length === 1 ? "" : "s"}) — running…`)
    }

    addLine("system", `Running ${nodeFiles.length} file${nodeFiles.length > 1 ? "s" : ""} on Piston (${runtimeLanguage})…`)

    const ac = new AbortController()
    abortRef.current = ac

    const runFiles: RunFile[] = nodeFiles.map((f) => ({
      path: f.path,
      content: f.content,
      isEntryPoint: !!f.isEntryPoint,
    }))

    try {
      const t0 = performance.now()
      const result = await runOnPiston({
        language: runtimeLanguage,
        files: runFiles,
        stdin: batchStdin,
        signal: ac.signal,
      })
      const dt = Math.round(performance.now() - t0)
      setLastRuntimeMs(dt)
      if (result.compileError) addLine("stderr", result.compileError)
      if (result.stdout) addLine("stdout", result.stdout)
      if (result.stderr) addLine("stderr", result.stderr)
      const exitLabel = result.code == null ? "" : ` (exit ${result.code})`
      addLine(result.code === 0 || result.code == null ? "success" : "error",
        `Finished in ${result.time ?? dt}ms${exitLabel}`)
    } catch (err: any) {
      if (err?.name === "AbortError") addLine("system", "Run cancelled.")
      else addLine("error", err?.message || String(err))
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [running, interactiveActive, nodeFiles, runtimeLanguage, stdin, codeNeedsInput,
      addLine, askOneInputLine, pickPythonEntry])

  // Stop any live Pyodide worker on unmount so switching to another submission
  // doesn't leave a background Python interpreter running.
  useEffect(() => {
    return () => {
      interactiveHandleRef.current?.stop()
      interactiveHandleRef.current = null
      abortRef.current?.abort()
    }
  }, [])

  // Escape exits fullscreen — the expected keyboard gesture for a viewport
  // overlay. Only bound while `isFull` is true so it never swallows Escape
  // for other UI (e.g. Monaco's own popovers).
  useEffect(() => {
    if (!isFull) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setIsFull(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFull])

  // Drag-to-resize the terminal by grabbing its top edge. Bounds keep it from
  // collapsing to nothing or eating the whole editor. Clamps against a live
  // read of the container so tall/short viewports both stay usable.
  const startTermResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = termHeight
    const container = (e.currentTarget as HTMLElement).closest("[data-review-body]") as HTMLElement | null
    const maxH = container ? Math.max(120, container.getBoundingClientRect().height - 120) : 720
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(100, Math.min(maxH, startH + (startY - ev.clientY)))
      setTermHeight(next)
    }
    const onUp = () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [termHeight])

  const cancelRun = useCallback(() => {
    // Stop the Pyodide worker if a live Python run is in flight.
    if (interactiveHandleRef.current) {
      interactiveHandleRef.current.stop()
      interactiveHandleRef.current = null
      setInteractiveActive(false)
    }
    // Abort any in-flight Piston fetch.
    abortRef.current?.abort()
    // Unblock a pending batch-stdin prompt so Stop never leaves the UI stuck.
    if (inputResolverRef.current) {
      inputResolverRef.current("")
      inputResolverRef.current = null
    }
    setAwaitingInput(false)
    setInputPrompt("")
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  // In fullscreen we detach from the page.tsx layout and paint the whole
  // viewport ourselves via position: fixed + a high z-index. That way the
  // outer Assessment Questions rail and header don't crop the editor.
  const rootClass = isFull
    ? "fixed inset-0 z-[70] flex flex-col bg-white"
    : "flex flex-col h-full w-full bg-white"
  return (
    <div className={rootClass}>
      {/* Header strip — question title on the left, submission meta on the
          right. The old "Code Submission" badge was noise (it repeats what
          the whole pane already communicates) so it was removed. */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ background: "#f8f9fa", borderColor: "#e5e7eb" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Code2 size={14} className="text-orange-500 flex-shrink-0" />
          <div className="text-xs font-semibold text-gray-900 truncate">{questionTitle}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
          {isFull && (
            <span className="px-2 py-0.5 rounded font-semibold bg-orange-50 text-orange-600 border border-orange-200 flex items-center gap-1">
              <Maximize2 size={11} /> Full screen
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <TerminalIcon size={11} /> Read-only review · Run uses Piston
          </span>
          {attemptCount != null && (
            <span className="px-2 py-0.5 rounded font-semibold" style={{ background: "#f3f4f6", color: "#374151" }}>
              Attempt {attemptCount}
            </span>
          )}
          {submittedAt && (
            <span className="px-2 py-0.5 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>
              Submitted {new Date(submittedAt).toLocaleString()}
            </span>
          )}
          {lateSubmission && (
            <span
              className="px-2 py-0.5 rounded font-bold flex items-center gap-1 animate-pulse"
              style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}
              title={lastTestSubmittedAt ? `Submitted late at ${new Date(lastTestSubmittedAt).toLocaleString()}` : "Late submission"}
            >
              ⚠ LATE SUBMISSION
              {lastTestSubmittedAt && (
                <span className="font-medium ml-1" style={{ color: "#7f1d1d" }}>
                  {new Date(lastTestSubmittedAt).toLocaleString()}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar — sidebar toggle · student/question nav · Run/Stop · terminal · fullscreen · theme */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-slate-50 border-slate-200">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Sidebar collapse toggle — hidden in fullscreen mode. Shows a
              chevron pointing inward when the panel is open, outward when
              it's collapsed to just the activity rail. */}
          {!isFull && (
            <button
              onClick={() => setSidebarView((v) => (v ? null : "files"))}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"
              title={sidebarView ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarView ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Student and question nav ONLY in fullscreen. The outer page has
              its own Prev/Next student buttons and the question list sidebar,
              so duplicating them in normal mode was noise — fullscreen loses
              access to that outer chrome, so we surface it here instead. */}
          {/* Labelled nav — chevron + text so trainers can tell at a glance
              what the button does. Icon-only arrows read as "carousel" and
              are ambiguous when there are two nav clusters side by side. */}
          {isFull && (onPrevStudent || onNextStudent) && (
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-200">
              <button
                onClick={onPrevStudent}
                disabled={!hasPrevStudent}
                title="Previous student"
                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" /> Previous student
              </button>
              <span className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px] font-semibold text-slate-700 bg-slate-100 max-w-[180px]">
                <UserRound className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{currentStudentName || "Student"}</span>
                {studentPosition && <span className="text-slate-400 font-normal">· {studentPosition}</span>}
              </span>
              <button
                onClick={onNextStudent}
                disabled={!hasNextStudent}
                title="Next student"
                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next student <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {isFull && (onPrevQuestion || onNextQuestion) && (
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-200">
              <button
                onClick={onPrevQuestion}
                disabled={!hasPrevQuestion}
                title="Previous question"
                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" /> Previous question
              </button>
              <span className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px] font-semibold text-indigo-700 bg-indigo-50">
                <FileText className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{questionPosition || "Q"}</span>
              </span>
              <button
                onClick={onNextQuestion}
                disabled={!hasNextQuestion}
                title="Next question"
                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next question <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {running || interactiveActive ? (
            <button
              onClick={cancelRun}
              className="h-7 px-3 text-[10px] font-bold uppercase tracking-wide bg-rose-600 hover:bg-rose-500 text-white rounded-md inline-flex items-center gap-1.5"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          ) : (
            <button
              onClick={runCode}
              disabled={!nodeFiles.length}
              className="h-7 px-3 text-[10px] font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white rounded-md inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3 h-3" /> Run
            </button>
          )}
          <button
            onClick={clearTerminal}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-600 hover:text-rose-600 hover:bg-slate-200"
            title="Clear terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setTermOpen((v) => !v)}
            className={`h-7 w-7 flex items-center justify-center rounded-md ${
              termOpen ? "text-slate-600 hover:bg-slate-200" : "text-orange-600 hover:bg-orange-50"
            }`}
            title={termOpen ? "Hide terminal" : "Show terminal"}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFull((v) => !v)}
            className={`h-7 flex items-center justify-center rounded-md gap-1.5 text-[11px] font-semibold ${
              isFull
                ? "px-2 bg-orange-500 text-white hover:bg-orange-600"
                : "w-7 text-slate-600 hover:bg-slate-200"
            }`}
            title={isFull ? "Exit full screen (Esc)" : "Full screen editor"}
          >
            {isFull ? (
              <><Minimize2 className="w-3.5 h-3.5" /> Exit full</>
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setEditorTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"
            title={editorTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {editorTheme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body — normal mode: activity rail + panel + editor. Fullscreen mode:
          Problem panel in-flow (toggleable) + editor. In both modes the panel
          sits BESIDE the editor, never on top of it. */}
      <div className="flex-1 flex min-h-0">
        {!isFull && (
          <>
            {/* Activity bar — VS Code-style icon rail. Clicking the active
                icon collapses the panel; clicking an inactive one swaps it. */}
            <div className="flex-shrink-0 flex flex-col items-stretch border-r border-slate-800" style={{ width: 44, background: "#1e293b" }}>
              <RailBtn
                icon={<FilesIcon size={18} />}
                title="Explorer (files)"
                active={sidebarView === "files"}
                onClick={() => setSidebarView((v) => (v === "files" ? null : "files"))}
              />
              {hasQuestionPanel && (
                <RailBtn
                  icon={<FileText size={18} />}
                  title="Problem (question detail)"
                  active={sidebarView === "problem"}
                  onClick={() => setSidebarView((v) => (v === "problem" ? null : "problem"))}
                />
              )}
            </div>
            {/* Panel — swaps content based on the active rail icon. */}
            {sidebarView === "files" && (
              <ReadOnlyTree
                files={nodeFiles}
                folders={nodeFolders}
                activeFileId={activeFileId}
                onOpen={openFile}
              />
            )}
            {sidebarView === "problem" && hasQuestionPanel && (
              <QuestionPanel>{questionNode}</QuestionPanel>
            )}
          </>
        )}
        {/* Fullscreen: Problem panel is a normal flex child on the LEFT so
            the code editor takes the remaining width on the right. Panel
            has its own close button; when closed, a slim "Show problem"
            re-open strip appears on the far left of the editor area. */}
        {isFull && hasQuestionPanel && fullProblemOpen && (
          <QuestionPanel onClose={() => setFullProblemOpen(false)}>
            {questionNode}
          </QuestionPanel>
        )}
        {isFull && hasQuestionPanel && !fullProblemOpen && (
          <button
            onClick={() => setFullProblemOpen(true)}
            title="Show problem"
            className="flex-shrink-0 w-8 flex items-center justify-center bg-slate-100 hover:bg-orange-50 border-r border-slate-200 text-slate-600 hover:text-orange-600"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 flex flex-col min-w-0 relative" data-review-body>
          <div className="flex-1 min-h-0">
            {openFiles.length ? (
              <MonacoTabs
                openFiles={openFiles}
                activeFileId={activeFileId}
                theme={editorTheme}
                readOnly
                onSelectTab={setActiveFileId}
                onCloseTab={closeTab}
                onChange={() => {/* read-only: never called */}}
              />
            ) : nodeFiles.length === 0 ? (
              // Blank compiler screen — same dark backdrop as Monaco's dark
              // theme so navigating to a question with no submission feels
              // like the same editor with nothing loaded. Fullscreen and
              // sidebar / question panel all stay intact.
              <div
                className="h-full flex flex-col items-center justify-center text-center px-6 gap-3"
                style={{ background: editorTheme === "dark" ? "#1e1e1e" : "#f8f9fa" }}
              >
                <FileText className={`w-10 h-10 ${editorTheme === "dark" ? "text-slate-600" : "text-slate-300"}`} />
                <div>
                  <div className={`text-sm font-semibold ${editorTheme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                    No code submission for this question
                  </div>
                  <div className={`text-[12px] mt-1 ${editorTheme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                    {isFull
                      ? "Use the ‹ › arrows above to move to another question or student."
                      : "Use the outer question list or student nav to move on."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select a file from the tree to view its contents.
              </div>
            )}
          </div>
          {termOpen ? (
            <>
              {/* Combined drag handle + close bar. Drag anywhere on the bar to
                  resize; double-click resets. The X sits on the right where
                  it won't collide with RunTerminal's own Clear button below. */}
              <div
                className="group relative flex-shrink-0 flex items-center justify-end bg-slate-200 hover:bg-orange-100 transition-colors"
                style={{ height: 14 }}
              >
                <div
                  onMouseDown={startTermResize}
                  onDoubleClick={() => setTermHeight(240)}
                  title="Drag to resize · double-click to reset"
                  className="absolute inset-0 cursor-row-resize"
                />
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[3px] rounded-full bg-slate-400 group-hover:bg-orange-500" />
                <button
                  onClick={() => setTermOpen(false)}
                  className="relative z-10 mr-1 h-5 w-5 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700"
                  title="Close terminal"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-shrink-0" style={{ height: termHeight }}>
                <RunTerminal
                  lines={lines}
                  running={running || interactiveActive}
                  stdin={stdin}
                  lastRuntimeMs={lastRuntimeMs}
                  onStdinChange={setStdin}
                  onClear={clearTerminal}
                  // Interactive line shows whenever an engine could ask for
                  // input — live for Pyodide, one-shot batch for Piston.
                  interactive={interactiveActive || awaitingInput}
                  awaitingInput={awaitingInput}
                  inputPrompt={inputPrompt}
                  onSubmitInput={submitInteractiveInput}
                />
              </div>
            </>
          ) : (
            // Closed state: thin strip at the bottom that reopens the terminal.
            // Also surfaces running / awaitingInput state so a hidden terminal
            // never masks an in-flight run or an unanswered input prompt.
            <button
              onClick={() => setTermOpen(true)}
              className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-t bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
              title="Show terminal"
            >
              <span className="flex items-center gap-1.5">
                <TerminalIcon className="w-3 h-3" />
                Terminal
                {(running || interactiveActive) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 animate-pulse">
                    running…
                  </span>
                )}
                {awaitingInput && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                    waiting for input
                  </span>
                )}
              </span>
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only folder tree. Distinct from student-side FileTree (which handles
// create/rename/delete/drag-drop) — a trainer only needs to browse and open.
// ─────────────────────────────────────────────────────────────────────────────
interface ReadOnlyTreeProps {
  files: FileNode[]
  folders: FolderNode[]
  activeFileId: string | null
  onOpen: (fileId: string) => void
}

function ReadOnlyTree({ files, folders, activeFileId, onOpen }: ReadOnlyTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["/"]))

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Expand the folders that lead to the active file so it stays visible when
  // its container is nested. Runs once per active-file change.
  useEffect(() => {
    if (!activeFileId) return
    const active = files.find((f) => f.id === activeFileId)
    if (!active) return
    const parts = active.folderPath.split("/").filter(Boolean)
    let acc = ""
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add("/")
      for (const p of parts) {
        acc = `${acc}/${p}`
        next.add(normPath(acc))
      }
      return next
    })
  }, [activeFileId, files])

  const childFolders = (parent: string) =>
    folders
      .filter((d) => normPath(d.parentPath) === normPath(parent))
      .sort((a, b) => a.name.localeCompare(b.name))

  const childFiles = (parent: string) =>
    files
      .filter((f) => normPath(f.folderPath) === normPath(parent))
      .sort((a, b) => a.filename.localeCompare(b.filename))

  const renderFolder = (folder: FolderNode, depth: number) => {
    const isOpen = expanded.has(folder.path)
    return (
      <div key={folder.id}>
        <button
          className="w-full flex items-center gap-1 px-2 py-1 text-left text-[12px] text-slate-700 hover:bg-slate-100"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => toggle(folder.path)}
        >
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {isOpen ? <FolderOpen size={13} className="text-amber-500" /> : <FolderIcon size={13} className="text-amber-500" />}
          <span className="truncate">{folder.name}</span>
        </button>
        {isOpen && renderChildren(folder.path, depth + 1)}
      </div>
    )
  }

  const renderFile = (file: FileNode, depth: number) => {
    const isActive = file.id === activeFileId
    const color = file.language && file.language !== "text"
      ? LANGUAGE_CONFIG[file.language as SupportedLanguage]?.color || "#6b7280"
      : "#6b7280"
    return (
      <button
        key={file.id}
        onClick={() => onOpen(file.id)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-[12px] hover:bg-slate-100 ${
          isActive ? "bg-orange-50 text-orange-700 font-semibold" : "text-slate-700"
        }`}
        style={{ paddingLeft: 8 + depth * 12 + 14 /* align past chevron */ }}
        title={file.path}
      >
        <FileIcon size={12} style={{ color }} />
        <span className="truncate">{file.filename}</span>
        {file.isEntryPoint && (
          <span className="ml-auto px-1 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700">
            entry
          </span>
        )}
      </button>
    )
  }

  const renderChildren = (parent: string, depth: number) => (
    <>
      {childFolders(parent).map((d) => renderFolder(d, depth))}
      {childFiles(parent).map((f) => renderFile(f, depth))}
    </>
  )

  return (
    <div
      className="border-r border-slate-200 bg-slate-50 overflow-y-auto"
      style={{ width: 240, minWidth: 200 }}
    >
      <div className="py-1">
        {files.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-slate-400 italic">No files.</div>
        ) : (
          renderChildren("/", 0)
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity bar button — VS Code-style. Active state uses an inset orange bar
// on the left edge to match the brand.
// ─────────────────────────────────────────────────────────────────────────────
function RailBtn({
  icon, title, active, onClick,
}: { icon: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative h-11 w-11 flex items-center justify-center transition-colors ${
        active ? "text-white" : "text-slate-400 hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-orange-500 rounded-r" aria-hidden />
      )}
      {icon}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Problem/question panel — a scroll-area shell for whatever the caller
// composes. Content lives in page.tsx so it can pull every field the exercise
// carries (title, points, description, sample I/O, MCQ options, …) without
// this component having to know the question shape.
// ─────────────────────────────────────────────────────────────────────────────
function QuestionPanel({
  children, onClose,
}: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="border-r border-slate-200 bg-white overflow-hidden flex flex-col flex-shrink-0"
      style={{ width: 340, minWidth: 280 }}
    >
      <div className="px-3 py-2 border-b border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Problem
        </span>
        {onClose && (
          <button
            onClick={onClose}
            title="Close problem panel"
            className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
