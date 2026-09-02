"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Native multi-file code editor (code-server FREE).
//
// Previous version embedded code-server (VS Code in Docker) in an iframe and
// proxied file ops through /api/workspace + a Railway agent. This rewrite drops
// all of that and runs the editor natively in React:
//   • Left  : custom file/folder Explorer (nested folders + drag-to-move)
//   • Center: tabbed Monaco editor
//   • Bottom: terminal (Piston output + stdin)
//   • Run   : executes the whole project on Piston (entry file first)
//   • Visualizer: PythonTutor-style step-through built on a sys.settrace trace
//                 run through Piston (see lib/pythonTracer.ts)
//
// Persistence uses the existing LMS backend:
//   • Auto-save  → POST /draft/save           (files + folders)
//   • Restore    → GET  /draft/load  then  /courses/answers/previous-submission
//   • Submit     → POST /courses/answers/submit-multiple-files
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import ExerciseInfoModals, { ExerciseInfoButtons } from "./ExerciseInfoModals"
// Evaluation Method — the multi-file editor honours Manual and AI. Test Case
// falls back to Manual (posts score:0) with a log line, because the
// per-project test-case harness (input-per-file / stdin routing across a
// multi-file layout) isn't built yet. Wiring that harness is a separate,
// larger change that would need its own design pass.
import { resolveEvaluationMethod } from "@/lib/resolveEvaluationMethod"
import { hostOf } from "@/lib/frameEmbed"
import { evaluateWithAi } from "@/lib/aiEvaluator"
import axios from "axios"
import toast from "react-hot-toast"
import {
  Loader2, CheckCircle, X, ChevronRight, ChevronLeft,
  Award, Clock, Menu, Search, ArrowUpDown, X as XIcon, FileCode,
  Maximize2, Minimize2, FileText, Eye, Play, Square,
  Terminal as TerminalIcon, AlertCircle,
  AlertTriangle, MinusCircle, CloudUpload, Check,
  NotebookPen,
} from "lucide-react"
import {
  LANGUAGE_CONFIG, LANGUAGE_ORDER, STARTER_CODE,
  normalizeLanguage, detectLanguageFromFilename,
  type SupportedLanguage,
} from "@/lib/codeLanguages"
import { runOnPiston, type RunFile } from "@/lib/pistonClient"
import { runInteractivePython, isInteractiveTerminalSupported, type InteractiveHandle } from "@/lib/pyodideRunner"
import {
  buildTracedPython, parseStreamLine, type TraceStep,
} from "@/lib/pythonTracer"
import {
  type FileNode, type FolderNode, uid, normPath, basename, parentOf, joinPath,
} from "./multi-file/types"
import FileTree, { type DragItem } from "./multi-file/FileTree"
import SearchPanel from "./multi-file/SearchPanel"
import { Files as FilesIcon, Search as SearchIcon } from "lucide-react"
import MonacoTabs from "./multi-file/MonacoTabs"
import { type TermLine } from "./multi-file/RunTerminal"
import BottomPanel, { type SubmitStatus, type TestResultCase, type TestResultState } from "./multi-file/BottomPanel"
import TraceVisualizer from "./multi-file/TraceVisualizer"

// Backend base URL.
//   • In local dev → https://lmsserver-yeve.onrender.com (matches server/server.js PORT 5533).
//   • In production / non-localhost hosts → the Render-hosted backend.
//   • Override either with NEXT_PUBLIC_API_URL.
const API = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/+$/, "")
  if (typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) {
    return "https://lmsserver-yeve.onrender.com"
  }
  return "https://lms-server-3-wedg.onrender.com"
})()
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif"

// ─── Props ──────────────────────────────────────────────────────────────────
interface MultiFileCodeEditorProps {
  exercise?: any
  theme?: "light" | "dark"
  courseId?: string
  nodeId?: string
  nodeName?: string
  nodeType?: string
  subcategory?: string
  category?: string
  onBack?: () => void
  onCloseExercise?: () => void
  onNavigateToBreadcrumb?: (level: "course" | "hierarchy" | "category") => void
  courseName?: string
  hierarchy?: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getToken = (): string =>
  (typeof window !== "undefined" &&
    (localStorage.getItem("smartcliff_token") || localStorage.getItem("token"))) || ""

const authHeaders = (): Record<string, string> => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const formatExerciseTime = (seconds: number | null): string => {
  if (seconds === null) return "--:--"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

const getQuestionHtml = (q: any): string => {
  if (!q) return ""
  if (typeof q.description === "string") return q.description
  if (q.description?.text) return q.description.text
  return ""
}

// Build a FileNode from a {path, content} draft/submission record.
const fileFromRecord = (r: any): FileNode => {
  const path = normPath(r.path || `/${r.filename || r.name || "main.txt"}`)
  const name = basename(path)
  return {
    id: uid("file"),
    filename: name,
    content: String(r.content ?? ""),
    language: (r.language as any) || detectLanguageFromFilename(name),
    path,
    folderPath: parentOf(path),
    isEntryPoint: !!r.isEntryPoint,
    lastModified: new Date(),
  }
}

// Reconstruct the full folder set: explicit folders + any implied by file paths.
const deriveFolders = (files: FileNode[], explicit: any[] = []): FolderNode[] => {
  const paths = new Set<string>()
  explicit.forEach((f) => { if (f?.path) paths.add(normPath(f.path)) })
  files.forEach((f) => {
    let p = f.folderPath
    while (p && p !== "/") { paths.add(p); p = parentOf(p) }
  })
  return Array.from(paths).map((p) => ({
    id: uid("folder"), name: basename(p), path: p, parentPath: parentOf(p),
  }))
}

// Seed a single starter file for a language.
// Content is intentionally BLANK per the workspace redesign — students see
// an empty editor and write their own solution instead of a language-agnostic
// "hello world" template. STARTER_CODE stays in the lib in case any other
// caller still wants it.
const seedFiles = (lang: SupportedLanguage): FileNode[] => {
  const cfg = LANGUAGE_CONFIG[lang]
  return [{
    id: uid("file"), filename: cfg.filename, content: "",
    language: lang, path: `/${cfg.filename}`, folderPath: "/",
    isEntryPoint: true, lastModified: new Date(),
  }]
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MultiFileCodeEditor({
  exercise,
  theme = "light",
  courseId,
  nodeId = "",
  nodeName = "",
  nodeType = "",
  subcategory = "",
  category = "",
  onBack,
  onCloseExercise,
  onNavigateToBreadcrumb,
  courseName,
  hierarchy = [],
}: MultiFileCodeEditorProps) {
  // ─── Core editor state ──────────────────────────────────────────────────────
  const [files, setFiles] = useState<FileNode[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("python")
  const [ready, setReady] = useState(false)

  const [questionWidth, setQuestionWidth] = useState(360)
  const [treeWidth, setTreeWidth] = useState(220)
  // VS Code-like Activity Bar: which side view is open. `null` collapses the
  // side panel entirely (only the icon rail stays visible).
  const [sideView, setSideView] = useState<"explorer" | "search" | null>("explorer")
  const [isFull, setIsFull] = useState(false)
  const [showQDrawer, setShowQDrawer] = useState(false)

  // ─── Run / terminal state ───────────────────────────────────────────────────
  const [termLines, setTermLines] = useState<TermLine[]>([])
  const [stdin, setStdin] = useState("")
  const [running, setRunning] = useState(false)
  const [lastRuntime, setLastRuntime] = useState<number | null>(null)
  const [showTerminal, setShowTerminal] = useState(true)
  // Bottom-panel tabs — the ONE panel now hosts both the interactive
  // Terminal (Run output) and the Test Result view (Submit answer result).
  // Run activates 'terminal'; Submit activates 'test-result'. Neither clears
  // the other's state — flipping tabs is cheap navigation. Types are
  // exported from BottomPanel so both files share the shape.
  const [bottomTab, setBottomTab] = useState<'terminal' | 'test-result'>('terminal')
  const [testResult, setTestResult] = useState<TestResultState | null>(null)
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0)
  const runAbortRef = useRef<AbortController | null>(null)
  // Monotonic counter bumped on every question switch AND on component
  // unmount, so any in-flight run's late continuations (Piston fetch that
  // rejects with AbortError after the switch, Pyodide worker whose stop()
  // was called before its handle had even been assigned, etc.) can compare
  // the generation they were STARTED under to the current one and drop
  // their log()/setRunning() calls when superseded. Without this, aborting
  // is not enough — the catch handler still fires a microtask later and
  // appends "Run cancelled." into the NEXT question's terminal.
  const runGenRef = useRef(0)

  // ─── Interactive (Pyodide) run state ────────────────────────────────────────
  const [interactiveActive, setInteractiveActive] = useState(false) // an interactive run is in progress
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [inputPrompt, setInputPrompt] = useState("")
  const interactiveHandleRef = useRef<InteractiveHandle | null>(null)
  const inputPromptRef = useRef("")

  // ─── Visualizer state (PythonTutor-style streaming trace) ───────────────────
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [vizLoading, setVizLoading] = useState(false)
  const [vizRunning, setVizRunning] = useState(false)
  const [vizSteps, setVizSteps] = useState<TraceStep[]>([])
  const [vizSource, setVizSource] = useState("")
  const [vizComplete, setVizComplete] = useState(false)
  const [vizTruncated, setVizTruncated] = useState(false)
  const [vizInputs, setVizInputs] = useState<string[]>([])
  const [vizAwait, setVizAwait] = useState(false)
  const [vizPrompt, setVizPrompt] = useState("")
  const vizBufRef = useRef("")

  // ─── Question / exercise state ──────────────────────────────────────────────
  const questions = useMemo(() => exercise?.questions ?? [], [exercise])
  // Category-aware noun for student-facing CTAs. Trainers author one
  // "Exercise" doc but attach it under We_Do (student practices → treated
  // as an assignment) or You_Do (student is graded → treated as an
  // assessment). Using the neutral "exercise" everywhere read as generic
  // and lost the pedagogy signal, so we resolve the noun from category.
  // I_Do (instructor demo) stays "exercise".
  const activityNoun: 'assignment' | 'assessment' | 'exercise' =
    category === 'We_Do' ? 'assignment'
    : category === 'You_Do' ? 'assessment'
    : 'exercise'
  const ActivityNoun = activityNoun.charAt(0).toUpperCase() + activityNoun.slice(1)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const currentQuestion = questions[currentQuestionIndex] || null

  // Problems sidebar is CLOSED by default so the workspace opens focused on
  // the current question + code. The hamburger in the Problem details
  // toolbar toggles it whenever the student wants the full list.
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all")
  const [sortBy, setSortBy] = useState<"default" | "difficulty" | "title">("default")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [solvedQuestions, setSolvedQuestions] = useState<Set<number>>(new Set())
  // Track which questions the student has started (typed real content into
  // any file). Drives the Finish modal's Completed / Incomplete / Not
  // attempted split so the counts are honest, not guesses. Filled by
  // onEditorChange for the current question, and pre-hydrated on load
  // when a draft or previous submission already carries non-empty files.
  const [attemptedQuestions, setAttemptedQuestions] = useState<Set<number>>(new Set())

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  const isSubmitGuardRef = useRef(false)
  const isSubmitQuestionGuardRef = useRef(false)

  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  // Notes panel — a lightweight per-exercise scratchpad. Toggled from the
  // Notes tab on the left nav rail; body autosaves to localStorage
  // (keyed by exercise + question so switching questions swaps context).
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  const [notesText, setNotesText] = useState<string>("")
  const [pendingNavLevel, setPendingNavLevel] = useState<null | "course" | "hierarchy" | "category">(null)

  const [fullExercise, setFullExercise] = useState<any>(exercise || null)
  const [exerciseTimeLeft, setExerciseTimeLeft] = useState<number | null>(null)

  // Resize state captured on mouseDown so the mouseMove math is a pure
  // delta from the click point — no bounding-rect assumptions about the
  // Problems sidebar / activity bar widths. Fixes drag-jump-to-min when
  // those offsets don't match the old formula.
  type ResizeKind =
    | { kind: 'question'; startX: number; startWidth: number }
    | { kind: 'tree';     startX: number; startWidth: number }
    | { kind: 'bottom';   startY: number; startHeight: number }
  const resizing = useRef<null | ResizeKind>(null)
  // Bottom-panel (Terminal + Test Result) height. Drag grip on the top
  // edge updates this; clamped to a sensible min/max so the editor never
  // vanishes and the terminal never becomes too tiny to read.
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(240)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Re-fetch full exercise (totalMarks etc.) ───────────────────────────────
  useEffect(() => {
    setFullExercise(exercise || null)
    if (!exercise?._id) return
    fetch(`${API}/exercise/${exercise._id}`, { headers: { ...authHeaders(), "Content-Type": "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const full = data.data || data.exercise || data
        if (full?._id) setFullExercise({ ...full, questions: exercise.questions ?? full.questions })
      })
      .catch(() => {})
  }, [exercise?._id])
  const exData = fullExercise ?? exercise

  // ─── Available languages from exercise ──────────────────────────────────────
  const availableLanguages = useMemo<SupportedLanguage[]>(() => {
    const raw = exData?.programmingSettings?.selectedLanguages ?? exercise?.programmingSettings?.selectedLanguages ?? []
    const normalized = (raw as string[]).map(normalizeLanguage).filter((l): l is SupportedLanguage => !!l)
    const unique = LANGUAGE_ORDER.filter((l) => normalized.includes(l))
    return unique.length > 0 ? unique : (["python"] as SupportedLanguage[])
  }, [exData, exercise])

  // ─── Terminal logging helper ────────────────────────────────────────────────
  const log = useCallback((kind: TermLine["kind"], text: string) => {
    if (!text) return
    setTermLines((prev) => [...prev, { id: uid("t"), kind, text }])
  }, [])

  // ─── Active / entry file helpers ────────────────────────────────────────────
  const activeFile = files.find((f) => f.id === activeFileId) || null
  const openFileObjs = useMemo(
    () => openTabs.map((id) => files.find((f) => f.id === id)).filter(Boolean) as FileNode[],
    [openTabs, files],
  )

  const openFile = useCallback((id: string) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveFileId(id)
  }, [])

  const closeTab = useCallback((id: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== id)
      setActiveFileId((cur) => (cur === id ? (next[next.length - 1] ?? null) : cur))
      return next
    })
  }, [])

  // ═════════════════════════════════════════════════════════════════════════════
  // Reset the terminal + any in-flight run when the student switches question.
  //
  // The terminal is a singleton owned by this component (parent-owned
  // `termLines`, `running`, `interactiveActive`, `awaitingInput`, `inputPrompt`,
  // `lastRuntime`, plus the AbortController and Pyodide worker handles). None of
  // those get reset by the hydrate effect below, so without this teardown the
  // previous question's stdout/stderr, the "N ms" chip, and any live
  // `input()` prompt from a paused Pyodide worker all bleed into the next
  // question — exactly the bug being fixed. An in-flight Piston fetch or a
  // running Pyodide worker also keeps pumping output into `termLines` after
  // the switch (its onStdout/onStderr closures were captured against the
  // OLD question), so we must ABORT/STOP them first, not just wipe the array.
  //
  // The first render (initial mount) is deliberately skipped: nothing is
  // running yet and we don't want to noisily overwrite the initial state
  // that hasn't been touched.
  const didInitTerminalReset = useRef(false)
  useEffect(() => {
    if (!didInitTerminalReset.current) {
      didInitTerminalReset.current = true
      return
    }
    // Bump the run generation FIRST. Every in-flight run's continuations
    // (see runCode/runInteractive/visualize below) compare this against the
    // value they captured at start and no-op if the generation moved on —
    // so a Piston fetch whose AbortError catch runs a microtask later, or
    // a Pyodide handle that resolves several seconds after a cold-load
    // Next click, cannot leak into the new question's terminal.
    runGenRef.current += 1
    // Abort any pending non-Python (Piston) run so its late response can't
    // append into the next question's terminal.
    try { runAbortRef.current?.abort() } catch { /* noop */ }
    runAbortRef.current = null
    // Tear down any active Pyodide interactive run — this terminates the
    // Web Worker (see pyodideRunner.stop) so its onStdout/onStderr/onDone
    // callbacks stop firing.
    try { interactiveHandleRef.current?.stop() } catch { /* noop */ }
    interactiveHandleRef.current = null

    // Fresh terminal state.
    setTermLines([])
    setRunning(false)
    setLastRuntime(null)
    setStdin("")
    setInteractiveActive(false)
    setAwaitingInput(false)
    setInputPrompt("")
    inputPromptRef.current = ""

    // The visualizer is a modal peer of the terminal that hangs off the same
    // execution engine — resetting it here keeps the guarantee "fresh state
    // for the next question" honest (an open trace stepping through Q1's
    // program would be confusing on Q2).
    setShowVisualizer(false)
    setVizLoading(false)
    setVizRunning(false)
    setVizSteps([])
    setVizSource("")
    setVizComplete(false)
    setVizTruncated(false)
    setVizInputs([])
    setVizAwait(false)
    setVizPrompt("")
    vizBufRef.current = ""

    // Bottom-panel reset for the new question. The Test Result is tied to
    // the previous question's submission — showing it above the new
    // question would look like the new one had already been graded
    // (that's the bug the user reported). Reset the panel back to the
    // Terminal tab too, since Terminal state itself was already cleared
    // above.
    setTestResult(null)
    setSelectedCaseIndex(0)
    setBottomTab('terminal')

    // Load per-question notes from localStorage for the freshly-selected
    // question. Miss = blank scratchpad. Storage key includes both
    // exercise + question ids so the same student's notes on different
    // questions don't collide.
    try {
      const key = `lms_notes_${exercise?._id || 'ex'}_${currentQuestion?._id || 'q'}`
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      setNotesText(raw ?? "")
    } catch { setNotesText("") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?._id])

  // Autosave notes on change (debounced 500ms) so the student's
  // scratchpad survives a reload without a Save button. Same key rule as
  // the load — question-scoped.
  useEffect(() => {
    if (!currentQuestion?._id) return
    const key = `lms_notes_${exercise?._id || 'ex'}_${currentQuestion._id}`
    const t = setTimeout(() => {
      try { localStorage.setItem(key, notesText) } catch { /* quota */ }
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesText, currentQuestion?._id])

  // Component-unmount teardown of the SAME run handles. Without this, a user
  // who clicks Back / closes the tab while a Pyodide run is still executing
  // leaves the Web Worker alive until the browser GCs it, and its onmessage
  // handler keeps calling setState on the unmounted tree (React 18 warns in
  // dev; silent in prod). Kept minimal — file drafts are handled elsewhere.
  useEffect(() => {
    return () => {
      runGenRef.current += 1
      try { runAbortRef.current?.abort() } catch { /* noop */ }
      try { interactiveHandleRef.current?.stop() } catch { /* noop */ }
      runAbortRef.current = null
      interactiveHandleRef.current = null
    }
  }, [])

  // ═════════════════════════════════════════════════════════════════════════════
  // Load (draft → previous submission → starter) on question/exercise change
  // ═════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false
    const primary = availableLanguages[0] || "python"
    setReady(false)
    setSelectedLanguage((prev) => (availableLanguages.includes(prev) ? prev : primary))

    // The question can carry an author-provided Starter Code (Code Setup
    // section on ProgrammingQuestionForm). Read it here so the entry file
    // can seed with it when no draft/submission wins. Old records used
    // `solutions.startedCode` (and even the misspelled `staetedCode`) —
    // the single-file editor consults both, and we match that.
    const cq: any = currentQuestion || {}
    const authoredStarter: string = (
      typeof cq.starterCode === "string" ? cq.starterCode :
      typeof cq?.solutions?.startedCode === "string" ? cq.solutions.startedCode :
      typeof cq?.solutions?.staetedCode === "string" ? cq.solutions.staetedCode : ""
    )

    // seedFiles() creates one empty entry file; if the question shipped a
    // Starter Code, drop it into that file's content so the student opens
    // to the author's scaffold instead of a blank editor.
    const seedWithAuthorStarter = (lang: SupportedLanguage): FileNode[] => {
      const seed = seedFiles(lang)
      if (authoredStarter && seed[0]) seed[0].content = authoredStarter
      return seed
    }

    const hydrate = (fileRecords: any[], folderRecords: any[], lang: SupportedLanguage) => {
      if (cancelled) return
      const fs = fileRecords.map(fileFromRecord)
      const hydratedFromExistingWork = fs.length > 0
      if (fs.length === 0) { fs.push(...seedWithAuthorStarter(lang)) }
      if (!fs.some((f) => f.isEntryPoint)) {
        const entry = fs.find((f) => f.language === lang) || fs[0]
        if (entry) entry.isEntryPoint = true
      }
      const fol = deriveFolders(fs, folderRecords)
      setFiles(fs)
      setFolders(fol)
      const first = fs.find((f) => f.isEntryPoint) || fs[0]
      setOpenTabs(first ? [first.id] : [])
      setActiveFileId(first ? first.id : null)
      setSelectedLanguage(lang)
      setReady(true)
      // A load that came from an existing draft or previous submission
      // (rather than a fresh seed) means the student already worked on
      // this question — mark it attempted so the Finish modal shows it
      // as Incomplete (not Not-Attempted) even if they don't type again
      // this session.
      if (hydratedFromExistingWork && fs.some((f) => (f.content || '').trim().length > 0)) {
        setAttemptedQuestions((prev) => prev.has(currentQuestionIndex) ? prev : new Set(prev).add(currentQuestionIndex))
      }
    }

    ;(async () => {
      const exerciseId = exercise?._id
      const questionId = currentQuestion?._id

      // 1) draft — a draft whose only file is a pristine template (an old
      // library STARTER_CODE snapshot from before the workspace went blank,
      // or the question's own authored starter with no student edits) is
      // treated as "no work yet" so we fall through and re-seed from the
      // authored starter. Without this, once a student first opened the
      // question the autosaved starter would be locked in forever.
      const isPristineStarter = (files: any[]): boolean => {
        if (!files || files.length !== 1) return false
        const only = files[0]
        const body = (only?.content ?? "").toString()
        if (body.trim() === "") return true
        if (authoredStarter && body === authoredStarter) return true
        return Object.values(STARTER_CODE).some((tpl) => tpl === body)
      }
      if (exerciseId && questionId) {
        try {
          const r = await fetch(`${API}/draft/load?exerciseId=${exerciseId}&questionId=${questionId}`, { headers: authHeaders(), cache: "no-store" })
          const data = await r.json()
          const d = data?.draft
          if (d && Array.isArray(d.files) && d.files.length > 0 && !isPristineStarter(d.files)) {
            const lang = (normalizeLanguage(d.language) && availableLanguages.includes(normalizeLanguage(d.language)!))
              ? normalizeLanguage(d.language)! : primary
            hydrate(d.files, d.folders || [], lang)
            return
          }
        } catch { /* fall through */ }
      }

      // 2) previous submission
      if (exerciseId && questionId && courseId && category) {
        try {
          const r = await fetch(`${API}/courses/answers/previous-submission?courseId=${courseId}&exerciseId=${exerciseId}&questionId=${questionId}&category=${category}`, { headers: authHeaders() })
          if (r.ok) {
            const data = await r.json()
            if (data?.success && data?.data?.files?.length) {
              const savedLang = normalizeLanguage(data.data.selectedProgrammingLanguage || "")
              const lang = savedLang && availableLanguages.includes(savedLang) ? savedLang : primary
              hydrate(data.data.files, data.data.folders || [], lang)
              return
            }
          }
        } catch { /* fall through */ }
      }

      // 3) starter — falls through hydrate([], …) which now consults the
      // authored Starter Code first, and finally an empty file.
      hydrate([], [], primary)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?._id, currentQuestion?._id, availableLanguages.join(",")])

  // ═════════════════════════════════════════════════════════════════════════════
  // Auto-save draft (debounced on change + 15s heartbeat + final flush)
  // ═════════════════════════════════════════════════════════════════════════════
  const buildDraftPayload = useCallback(() => ({
    exerciseId: exercise?._id,
    questionId: currentQuestion?._id,
    language: selectedLanguage,
    files: files.map((f) => ({ path: f.path, content: f.content })),
    folders: folders.map((f) => ({ path: f.path })),
  }), [exercise?._id, currentQuestion?._id, selectedLanguage, files, folders])

  const draftRef = useRef(buildDraftPayload)
  useEffect(() => { draftRef.current = buildDraftPayload }, [buildDraftPayload])

  const saveDraft = useCallback(async (keepalive = false) => {
    const payload = draftRef.current()
    if (!payload.exerciseId || !payload.questionId || !ready) return
    try {
      await fetch(`${API}/draft/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
        keepalive,
      })
    } catch { /* best-effort */ }
  }, [ready])

  // debounce on content/tree change
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => { void saveDraft(false) }, 1500)
    return () => clearTimeout(t)
  }, [files, folders, ready, saveDraft])

  // 15s heartbeat + final flush
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => { void saveDraft(false) }, 15000)
    return () => { clearInterval(id); void saveDraft(true) }
  }, [ready, saveDraft])

  // ═════════════════════════════════════════════════════════════════════════════
  // File / folder operations
  // ═════════════════════════════════════════════════════════════════════════════
  const pathExists = useCallback((p: string) =>
    files.some((f) => f.path === p) || folders.some((f) => f.path === p), [files, folders])

  const createFile = useCallback((parentFolder: string, rawName: string) => {
    const name = rawName.trim().replace(/^\/+/, "")
    if (!name) return
    const path = joinPath(parentFolder, name)
    if (pathExists(path)) { toast.error(`${name} already exists.`); return }
    const node: FileNode = {
      id: uid("file"), filename: basename(path), content: "",
      language: detectLanguageFromFilename(basename(path)),
      path, folderPath: parentFolder, isEntryPoint: false, lastModified: new Date(),
    }
    setFiles((prev) => [...prev, node])
    setFolders((prev) => deriveFolders([...files, node], prev))
    openFile(node.id)
  }, [files, pathExists, openFile])

  const createFolder = useCallback((parentFolder: string, rawName: string) => {
    const name = rawName.trim().replace(/[\/\\]/g, "")
    if (!name) return
    const path = joinPath(parentFolder, name)
    if (pathExists(path)) { toast.error(`${name} already exists.`); return }
    setFolders((prev) => [...prev, { id: uid("folder"), name, path, parentPath: parentFolder }])
  }, [pathExists])

  const renameFile = useCallback((file: FileNode, rawName: string) => {
    const name = rawName.trim().replace(/^\/+/, "")
    if (!name || name === file.filename) return
    const path = joinPath(file.folderPath, name)
    if (pathExists(path)) { toast.error(`${name} already exists.`); return }
    setFiles((prev) => prev.map((f) => f.id === file.id
      ? { ...f, filename: name, path, language: detectLanguageFromFilename(name) } : f))
  }, [pathExists])

  const renameFolder = useCallback((folder: FolderNode, rawName: string) => {
    const name = rawName.trim().replace(/[\/\\]/g, "")
    if (!name || name === folder.name) return
    const newPath = joinPath(folder.parentPath, name)
    if (pathExists(newPath)) { toast.error(`${name} already exists.`); return }
    const oldP = folder.path
    setFiles((prev) => prev.map((f) => f.path.startsWith(oldP + "/") || f.folderPath === oldP
      ? { ...f, path: f.path.replace(oldP, newPath), folderPath: f.folderPath.replace(oldP, newPath) } : f))
    setFolders((prev) => prev.map((f) => f.path === oldP || f.path.startsWith(oldP + "/")
      ? { ...f, path: f.path.replace(oldP, newPath), name: f.path === oldP ? name : f.name, parentPath: f.parentPath.replace(oldP, newPath) } : f))
  }, [pathExists])

  const deleteFile = useCallback((file: FileNode) => {
    if (!window.confirm(`Delete ${file.filename}?`)) return
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
    closeTab(file.id)
  }, [closeTab])

  const deleteFolder = useCallback((folder: FolderNode) => {
    if (!window.confirm(`Delete folder ${folder.name} and everything inside?`)) return
    const p = folder.path
    const removedIds = files.filter((f) => f.folderPath === p || f.path.startsWith(p + "/")).map((f) => f.id)
    setFiles((prev) => prev.filter((f) => !(f.folderPath === p || f.path.startsWith(p + "/"))))
    setFolders((prev) => prev.filter((f) => !(f.path === p || f.path.startsWith(p + "/"))))
    setOpenTabs((prev) => prev.filter((id) => !removedIds.includes(id)))
    setActiveFileId((cur) => (cur && removedIds.includes(cur) ? null : cur))
  }, [files])

  const moveItem = useCallback((item: DragItem, targetFolder: string) => {
    if (item.kind === "file") {
      setFiles((prev) => prev.map((f) => {
        if (f.path !== item.path) return f
        const np = joinPath(targetFolder, f.filename)
        if (prev.some((o) => o.path === np && o.id !== f.id)) { toast.error("A file with that name already exists there."); return f }
        return { ...f, path: np, folderPath: targetFolder }
      }))
    } else {
      const oldP = normPath(item.path)
      const name = basename(oldP)
      const newP = joinPath(targetFolder, name)
      if (newP === oldP) return
      if (pathExists(newP)) { toast.error("A folder with that name already exists there."); return }
      setFiles((prev) => prev.map((f) => f.path.startsWith(oldP + "/") || f.folderPath === oldP
        ? { ...f, path: f.path.replace(oldP, newP), folderPath: f.folderPath.replace(oldP, newP) } : f))
      setFolders((prev) => prev.map((f) => f.path === oldP || f.path.startsWith(oldP + "/")
        ? { ...f, path: f.path.replace(oldP, newP), parentPath: f.path === oldP ? targetFolder : f.parentPath.replace(oldP, newP) } : f))
    }
  }, [pathExists])

  const onEditorChange = useCallback((id: string, value: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content: value, lastModified: new Date() } : f)))
    // Any keystroke on the current question marks it as attempted for
    // the Finish-modal split. `id` isn't tied to a question index, but
    // the editor is always scoped to the currently-selected question, so
    // recording `currentQuestionIndex` is accurate.
    if (value && value.trim().length > 0) {
      setAttemptedQuestions((prev) => prev.has(currentQuestionIndex) ? prev : new Set(prev).add(currentQuestionIndex))
    }
  }, [currentQuestionIndex])

  // ═════════════════════════════════════════════════════════════════════════════
  // Run on Piston
  // ═════════════════════════════════════════════════════════════════════════════
  const toRunFiles = (): RunFile[] =>
    files.map((f) => ({ path: f.path, content: f.content, isEntryPoint: f.isEntryPoint }))

  const runCode = useCallback(async () => {
    if (running || vizRunning || !files.length) return
    setRunning(true)
    // Run → always route to the Terminal tab. Test Result state is left
    // untouched so a prior submission is still there when the student flips
    // back to it.
    setBottomTab('terminal')
    setShowTerminal(true)
    setLastRuntime(null)
    log("system", `$ Running (${LANGUAGE_CONFIG[selectedLanguage].label}) …`)
    const ctrl = new AbortController()
    runAbortRef.current = ctrl
    // Capture the generation this run belongs to. If the student switches
    // question while the Piston fetch is in flight, the reset effect bumps
    // runGenRef and calls abort() — the fetch then rejects with AbortError
    // one microtask LATER, at which point this callback would otherwise
    // append "Run cancelled." to the next question's terminal. The
    // generation check drops every write on a superseded run.
    const myGen = runGenRef.current
    try {
      const res = await runOnPiston({ language: selectedLanguage, files: toRunFiles(), stdin, signal: ctrl.signal })
      if (runGenRef.current !== myGen) return
      if (res.compileError) log("stderr", res.compileError)
      if (res.stdout) log("stdout", res.stdout.replace(/\n$/, ""))
      if (res.stderr) log("stderr", res.stderr.replace(/\n$/, ""))
      if (!res.stdout && !res.stderr && !res.compileError) log("system", "(no output)")
      if (res.time != null) setLastRuntime(Math.round(res.time))
      log("success", `Process exited with code ${res.code ?? 0}.`)
    } catch (e: any) {
      if (runGenRef.current !== myGen) return
      if (e?.name === "AbortError") log("system", "Run cancelled.")
      else log("error", `Run failed: ${e?.message || e}`)
    } finally {
      // Only tear down state that still belongs to this generation —
      // otherwise a stale finally would clobber Q2's own running/abort ref.
      if (runGenRef.current === myGen) {
        setRunning(false)
        runAbortRef.current = null
      }
    }
  }, [running, vizRunning, files, selectedLanguage, stdin, log])

  const stopRun = useCallback(() => { runAbortRef.current?.abort() }, [])

  // ─── Interactive Python run (Pyodide, live input) ───────────────────────────
  const pickPythonEntry = useCallback((): FileNode | null => {
    if (activeFile && activeFile.language === "python") return activeFile
    return files.find((f) => f.isEntryPoint && detectLanguageFromFilename(f.filename) === "python")
      || files.find((f) => detectLanguageFromFilename(f.filename) === "python")
      || null
  }, [activeFile, files])

  const runInteractive = useCallback(async () => {
    if (interactiveActive || running) return
    const entry = pickPythonEntry()
    if (!entry || !entry.content.trim()) { toast("Write some Python first.", { icon: "ℹ️" }); return }

    // Same routing as batch Run — Terminal tab, panel expanded.
    setBottomTab('terminal')
    setShowTerminal(true)
    setInteractiveActive(true)
    setAwaitingInput(false)
    setInputPrompt("")
    inputPromptRef.current = ""
    const terminalMode = isInteractiveTerminalSupported()
    log("system", terminalMode
      ? "$ Interactive run (Python · live terminal input)"
      : "$ Interactive run (Python · input via popup)")

    // Capture the generation. Cold-load Pyodide can take several seconds
    // (getMainPyodide downloads ~10MB of wasm on first use), so a student
    // clicking Next during that await would return here with a handle
    // whose onStdout/onStderr closures still target Q1. Every callback
    // below checks the generation; if superseded, the write is dropped
    // and — for the handle-return branch — the handle is stopped without
    // being published to the shared ref.
    const myGen = runGenRef.current
    try {
      // Include EVERY file in the project so cross-file imports
      // (`from utils.helper import foo`) resolve against the real folder layout.
      const projectFiles = files.map((f) => ({ path: f.path, content: f.content }))
      const handle = await runInteractivePython(entry.content, {
        onReady: () => {},
        onStdout: (t) => { if (runGenRef.current === myGen) log("stdout", t) },
        onStderr: (t) => { if (runGenRef.current === myGen) log("stderr", t) },
        onInputRequest: (prompt) => {
          if (runGenRef.current !== myGen) return
          inputPromptRef.current = prompt
          setInputPrompt(prompt)
          setAwaitingInput(true)
        },
        onDone: (err) => {
          if (runGenRef.current !== myGen) return
          setAwaitingInput(false)
          setInteractiveActive(false)
          interactiveHandleRef.current = null
          if (err) log(err === "Execution stopped." ? "system" : "error", err)
          else log("success", "Process finished.")
        },
      }, { files: projectFiles })
      if (runGenRef.current !== myGen) {
        // Question switched while we were awaiting the runner. The reset
        // effect's stop() was a no-op because the handle didn't exist
        // yet — stop it now, and DON'T publish it to the shared ref
        // (that ref may already point at Q2's fresh run).
        try { handle.stop() } catch { /* noop */ }
        return
      }
      interactiveHandleRef.current = handle
    } catch (e: any) {
      if (runGenRef.current !== myGen) return
      setInteractiveActive(false)
      log("error", `Interactive run failed: ${e?.message || e}`)
    }
  }, [interactiveActive, running, pickPythonEntry, files, log])

  const submitInteractiveInput = useCallback((text: string) => {
    const handle = interactiveHandleRef.current
    if (!handle) return
    // Echo the prompt + typed value so the transcript reads like a real console.
    log("stdout", `${inputPromptRef.current || ""}${text}`)
    setAwaitingInput(false)
    setInputPrompt("")
    handle.provideInput(text)
  }, [log])

  const stopInteractive = useCallback(() => {
    interactiveHandleRef.current?.stop()
    interactiveHandleRef.current = null
    setAwaitingInput(false)
    setInteractiveActive(false)
  }, [])

  // ═════════════════════════════════════════════════════════════════════════════
  // Visualize (Python only) — PythonTutor-style.
  //
  // The instrumented (sys.settrace) program is run on the Pyodide interactive
  // engine, NOT Piston. That means when the program reaches input() the trace
  // build PAUSES and asks the student for the value (in the terminal, or a popup
  // when not cross-origin isolated) — exactly like pythontutor.com. Once every
  // input is supplied the full trace is produced and the stepper appears.
  // ═════════════════════════════════════════════════════════════════════════════
  // Parse streamed trace lines out of the worker's stdout as they arrive, and
  // grow the step array live so the student can step while it is still running.
  const ingestTraceChunk = useCallback((t: string) => {
    let buf = vizBufRef.current + t
    const newSteps: TraceStep[] = []
    const consume = (line: string): boolean => {
      const r = parseStreamLine(line)
      if (r?.kind === "step") newSteps.push(r.step)
      else if (r?.kind === "end") setVizTruncated(r.truncated)
      return !!r
    }
    let nl: number
    while ((nl = buf.indexOf("\n")) !== -1) { consume(buf.slice(0, nl)); buf = buf.slice(nl + 1) }
    // Pyodide's batched stdout may drop the trailing newline — try the remainder.
    if (buf && consume(buf)) buf = ""
    vizBufRef.current = buf
    if (newSteps.length) { setVizLoading(false); setVizSteps((prev) => [...prev, ...newSteps]) }
  }, [])

  const visualize = useCallback(async () => {
    if (selectedLanguage !== "python") {
      toast(`The step-through visualizer currently supports Python only.`, { icon: "ℹ️" })
      return
    }
    if (interactiveActive || running || vizRunning) { toast("Stop the current run first.", { icon: "ℹ️" }); return }
    const entry = pickPythonEntry()
    if (!entry || !entry.content.trim()) {
      toast("Write some Python first, then click Visualize.", { icon: "ℹ️" })
      return
    }

    vizBufRef.current = ""
    setVizSteps([]); setVizInputs([]); setVizComplete(false); setVizTruncated(false)
    setVizAwait(false); setVizPrompt(""); setVizSource(entry.content)
    setVizRunning(true); setVizLoading(true); setShowVisualizer(true)
    openFile(entry.id)

    // Same generation-guard pattern as runInteractive/runCode — the trace
    // build runs on the Pyodide engine too, so a mid-trace question switch
    // could otherwise pump trace chunks into Q2's visualizer state.
    const myGen = runGenRef.current
    try {
      // The entry file's source is replaced by the instrumented harness, but
      // every OTHER file ships unmodified so imports work during the trace.
      const projectFiles = files.map((f) => ({
        path: f.path,
        content: f.id === entry.id ? buildTracedPython(entry.content) : f.content,
      }))
      const handle = await runInteractivePython(buildTracedPython(entry.content), {
        onReady: () => {},
        onStdout: (t) => { if (runGenRef.current === myGen) ingestTraceChunk(t) },
        onStderr: (t) => { if (runGenRef.current === myGen) log("stderr", t) },
        onInputRequest: (prompt) => {
          if (runGenRef.current !== myGen) return
          setVizPrompt(prompt); setVizAwait(true)
        },
        onDone: (err) => {
          if (runGenRef.current !== myGen) return
          setVizRunning(false); setVizLoading(false); setVizComplete(true); setVizAwait(false)
          interactiveHandleRef.current = null
          if (err && err !== "Execution stopped." && vizSteps.length === 0 && vizBufRef.current.indexOf("@@PTSTEP@@") === -1) {
            setShowVisualizer(false)
            toast.error(`Could not build the visualization. ${err.slice(0, 160)}`)
          }
        },
      }, { files: projectFiles })
      if (runGenRef.current !== myGen) {
        try { handle.stop() } catch { /* noop */ }
        return
      }
      interactiveHandleRef.current = handle
    } catch (e: any) {
      if (runGenRef.current !== myGen) return
      setVizRunning(false); setVizLoading(false); setShowVisualizer(false)
      toast.error(`Visualizer error: ${e?.message || e}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, interactiveActive, running, vizRunning, pickPythonEntry, files, openFile, log, ingestTraceChunk])

  const submitVizInput = useCallback((text: string) => {
    setVizInputs((prev) => [...prev, text])
    setVizAwait(false); setVizPrompt("")
    interactiveHandleRef.current?.provideInput(text)
  }, [])

  const closeVisualizer = useCallback(() => {
    if (vizRunning) { interactiveHandleRef.current?.stop(); interactiveHandleRef.current = null }
    setShowVisualizer(false); setVizRunning(false); setVizAwait(false); setVizLoading(false)
  }, [vizRunning])

  // ═════════════════════════════════════════════════════════════════════════════
  // Submit
  // ═════════════════════════════════════════════════════════════════════════════
  const postSubmission = async (isTestSubmission: boolean): Promise<{ ok: boolean; message?: string }> => {
    const exerciseId = exercise?._id
    const questionId = currentQuestion?._id
    if (!exerciseId || !questionId || !courseId) return { ok: false, message: "Missing exercise context." }

    // Route the bottom panel to Test Result the moment Submit answer fires,
    // and paint an "Evaluating…" loading state. The Terminal tab keeps its
    // Run output — only the tab activation swaps. The previous test result
    // stays visible until the new one lands (marked evaluating so students
    // know it's outdated).
    setBottomTab('test-result')
    setShowTerminal(true)
    setSelectedCaseIndex(0)
    setTestResult((prev) => ({
      ...(prev || { cases: [] }),
      status: 'evaluating',
      message: 'Evaluating your answer…',
    }))

    // Link questions: solved on the external site — no project files exist.
    // Submit a single marker file naming the link and skip auto-evaluation.
    const _lq: any = currentQuestion as any
    const isLinkQ = !!(_lq?.isLinkQuestion && _lq?.questionLink)

    // Backend (answer.js submitMultipleFiles) strictly validates extensions for
    // a fixed set of language labels: html/css/javascript/json/text/markdown/xml/sql.
    // A file with NO extension (e.g. "ds") or an unknown one tagged "text" would
    // 400 with "extension does not match language text". Anything else slips past
    // the check, so we coerce mismatches to a neutral label.
    const langForSubmit = (filename: string, lang: string): string => {
      const ext = (filename.includes(".") ? filename.split(".").pop()! : "").toLowerCase()
      const strict: Record<string, string[]> = {
        html: ["html", "htm"], css: ["css"], javascript: ["js"], json: ["json"],
        text: ["txt", "md"], markdown: ["md", "markdown"], xml: ["xml"], sql: ["sql"],
      }
      if (lang === "text") {
        if (ext === "html" || ext === "htm") return "html"
        if (ext === "css") return "css"
        if (ext === "js") return "javascript"
        if (ext === "json") return "json"
        if (ext === "xml") return "xml"
        if (ext === "sql") return "sql"
        if (ext === "md" || ext === "markdown") return "markdown"
        if (ext === "txt") return "text"
        return "plaintext" // not in the strict map → validation skipped
      }
      // Anything else (python/java/cpp/...) bypasses the map already.
      return strict[lang] && !strict[lang].includes(ext) ? "plaintext" : lang
    }

    // Backend requires non-empty content per file — coerce empties to a newline.
    const submitFiles = isLinkQ
      ? [{
          id: "external-link", filename: "external-link.txt",
          content: `[Link question] Solved on external site: ${_lq.questionLink}\n`,
          language: "text", path: "external-link.txt", folderPath: "", isEntryPoint: true,
          lastModified: new Date(),
        }]
      : files.map((f) => ({
      id: f.id, filename: f.filename, content: f.content && f.content.length ? f.content : "\n",
      language: langForSubmit(f.filename, f.language as string),
      path: f.path, folderPath: f.folderPath, isEntryPoint: !!f.isEntryPoint,
      lastModified: f.lastModified || new Date(),
    }))
    const submitFolders = folders.map((f) => ({ name: f.name, path: f.path, parentPath: f.parentPath }))

    // ─── Evaluation Method branch (multi-file) ────────────────────────────
    // Manual / Test Case (falls back to Manual with a log) / AI. AI passes the
    // student's ENTRY file contents to Gemini (multi-file source concatenated
    // with filename headers so Gemini sees the project layout). This mirrors
    // the single-file editors, so a trainer using AI gets a consistent
    // breakdown regardless of whether the exercise is single- or multi-file.
    const { method, aiCriteria } = resolveEvaluationMethod(exercise, category)

    let submitScore = 0
    let submitStatus: "submitted" | "solved" = "submitted"
    let evaluationBreakdown: any = null

    if (isLinkQ) {
      // No auto-evaluation possible — the work lives on the external site;
      // the trainer reviews/marks it manually. No terminal log needed —
      // the Test Result panel carries the message now.
    } else if (method === "testcase") {
      // Server-side judge (Phase 1 P0). The submit endpoint re-runs the
      // project against the trainer's authoritative testCases — including
      // hidden ones the browser never sees — and returns the breakdown in
      // its response. The per-case pass/fail info lands in the Test Result
      // panel, not the terminal.
    } else if (method === "ai") {
      // AI evaluation runs client-side against Gemini; the Test Result panel
      // shows "Evaluating…" throughout. No terminal log.
      // Concatenate every file with a header so Gemini sees the whole project
      // layout at once — the same shape it sees for single-file code.
      const bundled = submitFiles
        .map((f) => `// ── ${f.path || f.filename} ──\n${f.content}`)
        .join("\n\n")
      const maxMarks = Number(currentQuestion?.score ?? currentQuestion?.points ?? 10) || 10
      // Per-question mode: pass the current question so the resolver picks
      // its `aiTestCasesCount` (falling back to the exercise's count).
      const { getAiTestCasesCountFor } = resolveEvaluationMethod(exercise, category)
      const aiTestCasesCount = getAiTestCasesCountFor(currentQuestion)
      const cachedGen = Array.isArray((currentQuestion as any)?.aiGeneratedTestCases)
        ? (currentQuestion as any).aiGeneratedTestCases : []
      const aiResult = await evaluateWithAi({
        code: bundled,
        language: selectedLanguage,
        question: {
          title: currentQuestion?.title || "",
          description:
            typeof currentQuestion?.description === "string"
              ? currentQuestion.description
              : (currentQuestion?.description as any)?.text || "",
          testCases: (currentQuestion as any)?.testCases || [],
        },
        criteria: aiCriteria,
        maxMarks,
        testCasesCount: aiTestCasesCount,
        cachedGeneratedTestCases: cachedGen,
      })
      submitScore = aiResult.totalScore
      evaluationBreakdown = aiResult.breakdown
      if (aiResult.newlyGeneratedTestCases && aiResult.newlyGeneratedTestCases.length > 0 && (currentQuestion as any)?._id) {
        const authToken = (authHeaders() as any)?.Authorization?.toString().replace(/^Bearer\s+/i, '') || ''
        fetch(`${API}/courses/answers/persist-ai-test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            exerciseId,
            questionId: (currentQuestion as any)._id,
            courseId,
            nodeId,
            nodeType,
            category: category || 'We_Do',
            subcategory,
            testCases: aiResult.newlyGeneratedTestCases,
            model: aiResult.breakdown.ai.model,
          }),
        }).catch(() => { /* silent */ })
      }
      if (aiResult.failed) {
        toast.error(
          aiResult.errorMessage ||
            "AI grader failed. Your code was saved — trainer will grade manually.",
        )
      }
      // AI success/failure is surfaced in the Test Result panel via the
      // final setTestResult call below; no terminal log needed.
    }
    // method === "manual" → score stays 0, no breakdown.

    const payload = {
      courseId, exerciseId, questionId,
      questionTitle: currentQuestion?.title || `Question ${currentQuestionIndex + 1}`,
      exerciseName: exercise?.exerciseInformation?.exerciseName,
      category, subcategory,
      selectedProgrammingLanguage: selectedLanguage,
      nodeId, nodeName, nodeType,
      files: submitFiles,
      folders: submitFolders,
      hasFolders: submitFolders.length > 0,
      folderCount: submitFolders.length,
      totalFiles: submitFiles.length,
      isMultiFile: true,
      status: submitStatus,
      score: submitScore,
      isTestSubmission,
      // Only send when the client actually produced a breakdown, so Manual
      // submissions don't stamp an empty object onto the answer.
      ...(evaluationBreakdown ? { evaluationBreakdown } : {}),
    }
    let res: any
    try {
      res = await axios.post(`${API}/courses/answers/submit-multiple-files`, payload, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      })
    } catch (netErr: any) {
      // Network / 5xx / auth failure. The answer was NOT evaluated — the
      // Test Result panel says so and offers Try again; no false "wrong".
      setTestResult({
        status: 'submission-failed',
        cases: [],
        message: 'Submission failed',
        errorDetail: netErr?.response?.data?.message || netErr?.message || 'Network error — your answer was not evaluated.',
      })
      return { ok: false, message: netErr?.message || "network error" }
    }

    // Build the TestResult state from the server-authored breakdown. The
    // client never invents cases — everything comes from the response,
    // including hidden flags. If the response has no breakdown (Manual eval),
    // the panel still shows the accepted/submitted summary.
    const serverBreakdown = res.data?.data?.evaluationBreakdown
    const serverScore: number | null = typeof res.data?.data?.score === 'number' ? res.data.data.score : null
    const serverStatus: string | null = res.data?.data?.status || null
    const maxMarks = Number(currentQuestion?.score ?? currentQuestion?.points ?? 10) || 10

    let nextResult: TestResultState
    if (serverBreakdown?.method === "testcase" && serverBreakdown.testcase) {
      const tc = serverBreakdown.testcase
      const rawCases: any[] = Array.isArray(tc.cases) ? tc.cases : []
      const cases: TestResultCase[] = rawCases.map((c) => ({
        index: c.index ?? 0,
        hidden: !!c.hidden,
        passed: !!c.passed,
        // Server marks hidden cases progressively as they unlock; anything
        // without the flag from an older response falls back to !hidden
        // (visible cases are always effectively unlocked).
        unlocked: typeof c.unlocked === 'boolean' ? c.unlocked : !c.hidden,
        input: c.input ?? "",
        expectedOutput: c.expectedOutput ?? "",
        actualOutput: c.actualOutput ?? "",
        errorMessage: c.errorMessage,
      }))
      const passed = typeof tc.passed === 'number' ? tc.passed : cases.filter(c => c.passed).length
      const total = typeof tc.total === 'number' ? tc.total : cases.length
      const status: SubmitStatus =
        passed === total && total > 0 ? 'accepted'
        : passed === 0 ? 'wrong-answer'
        : 'partial'
      nextResult = {
        status,
        cases,
        passedCount: passed,
        totalCount: total,
        runtimeMs: typeof tc.runtimeMs === 'number' ? tc.runtimeMs : null,
        memoryKb: typeof tc.memoryKb === 'number' ? tc.memoryKb : null,
        score: serverScore,
        maxMarks,
      }
    } else if (serverBreakdown?.method === "ai" && serverBreakdown.ai) {
      const ai = serverBreakdown.ai
      const passed = ai.passedTestCases ?? 0
      const total = ai.totalTestCases ?? 0
      const status: SubmitStatus =
        (serverStatus === 'solved') ? 'accepted'
        : (total > 0 && passed === 0) ? 'wrong-answer'
        : (total > 0 && passed < total) ? 'partial'
        : 'accepted'
      nextResult = {
        status,
        cases: [],
        passedCount: passed,
        totalCount: total,
        score: serverScore,
        maxMarks,
        message: `AI evaluation — ${ai.criteria?.length ?? 0} criteria`,
      }
    } else {
      // Manual / Link / no breakdown — just a submission acknowledgement.
      nextResult = {
        status: serverStatus === 'solved' ? 'accepted' : 'accepted',
        cases: [],
        score: serverScore,
        maxMarks,
        message: isLinkQ
          ? 'Link submission recorded. The trainer will review the external solution.'
          : 'Submission recorded. The trainer will grade this answer manually.',
      }
    }
    setTestResult(nextResult)
    setSelectedCaseIndex(0)

    return res.data?.success ? { ok: true } : { ok: false, message: res.data?.message || "unknown" }
  }

  const submitQuestion = async () => {
    if (isSubmitQuestionGuardRef.current) return
    isSubmitQuestionGuardRef.current = true
    setIsSubmittingQuestion(true)
    try {
      await saveDraft(false)
      const result = await postSubmission(false)
      if (result.ok) {
        log("success", `Question ${currentQuestionIndex + 1} saved.`)
        setSolvedQuestions((prev) => new Set(prev).add(currentQuestionIndex))
      } else log("error", `Save failed: ${result.message}`)
    } catch (e: any) {
      log("error", `Save error: ${e?.message || e}`)
    } finally {
      setIsSubmittingQuestion(false)
      isSubmitQuestionGuardRef.current = false
    }
  }

  const submitExercise = async (opts?: { auto?: boolean }) => {
    if (isSubmitGuardRef.current) return
    isSubmitGuardRef.current = true
    setIsSubmitting(true)
    try {
      // Fire the draft save in PARALLEL — it's a best-effort backup; the submit
      // payload itself carries the latest files, so we don't need its response
      // before submitting. Sequential awaiting was adding ~300–800 ms of dead time.
      void saveDraft(false)
      const result = await postSubmission(true)
      if (result.ok) {
        log("success", "Exercise submitted.")
        setSolvedQuestions((prev) => new Set(prev).add(currentQuestionIndex))
        if (exercise?._id) localStorage.removeItem("ex_in_progress_" + exercise._id)

        // Restore-on-redirect safety net: also persist these three keys so the
        // course detail page can fall back to them if the redirect URL is lost.
        try {
          const methodKey = category === "We_Do" ? "we-do" : category === "I_Do" ? "i-do" : "you-do"
          localStorage.setItem("lms_student_selected_method", methodKey)
          if (subcategory) localStorage.setItem("lms_student_selected_activity", subcategory)
          if (nodeId) localStorage.setItem("lms_student_selected_node_id", nodeId)
        } catch { /* localStorage may be unavailable in some embed contexts */ }

        const exName = exercise?.exerciseInformation?.exerciseName || "Exercise"
        toast.success(opts?.auto ? `Time's up! "${exName}" submitted successfully.` : `"${exName}" submitted successfully`)
        // Close the confirm modal (if open) and redirect immediately — no need
        // for the old 700 ms cosmetic delay; the toast survives the navigation
        // because react-hot-toast's Toaster lives at the page root.
        setShowSubmitConfirm(false)
        if (onCloseExercise) onCloseExercise(); else if (onBack) onBack()
      } else {
        log("error", `Submission failed: ${result.message}`)
        toast.error(`Submission failed: ${result.message || "unknown error"}`)
        if (opts?.auto) toast.error("Auto-submit failed. Please submit manually.")
        isSubmitGuardRef.current = false
      }
    } catch (e: any) {
      log("error", `Submission error: ${e?.message || e}`)
      toast.error(`Submission error: ${e?.message || e}`)
      if (opts?.auto) toast.error("Auto-submit failed. Please submit manually.")
      isSubmitGuardRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Auto-submit on time-up ─────────────────────────────────────────────────
  const autoSubmitRef = useRef<() => void>(() => {})
  useEffect(() => {
    autoSubmitRef.current = () => {
      if (isSubmitGuardRef.current || isSubmitting) return
      submitExercise({ auto: true })
    }
  })

  // ─── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const totalDuration = exData?.exerciseInformation?.totalDuration
    if (!totalDuration || totalDuration <= 0) { setExerciseTimeLeft(null); return }
    setExerciseTimeLeft(totalDuration * 60)
    const timer = setInterval(() => {
      setExerciseTimeLeft((prev) => {
        if (prev === null) return prev
        if (prev <= 1) { clearInterval(timer); autoSubmitRef.current(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [exData?.exerciseInformation?.totalDuration])

  // ─── Resize handler ──────────────────────────────────────────────────────────
  // Delta-based: each drag adjusts the width/height by (current pointer -
  // start pointer), so layout offsets (sidebar, activity bar, borders) are
  // invisible to the math and the clamp only fires at the true min/max.
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const r = resizing.current
      if (!r) return
      if (r.kind === "question") {
        setQuestionWidth(Math.max(220, Math.min(640, r.startWidth + (e.clientX - r.startX))))
      } else if (r.kind === "tree") {
        setTreeWidth(Math.max(150, Math.min(420, r.startWidth + (e.clientX - r.startX))))
      } else if (r.kind === "bottom") {
        const rect = containerRef.current?.getBoundingClientRect()
        const maxH = rect ? Math.max(160, rect.height - 200) : 800
        // Grip is on the panel's TOP edge, so dragging UP grows height —
        // startY - clientY yields positive delta on upward drags.
        setBottomPanelHeight(Math.max(120, Math.min(maxH, r.startHeight + (r.startY - e.clientY))))
      }
    }
    const handleUp = () => { resizing.current = null }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [])

  // ─── Question filtering / nav (unchanged behaviour) ─────────────────────────
  const difficultyMap = useMemo<Record<string, { firstIndex: number; count: number }>>(() => {
    const map: Record<string, { firstIndex: number; count: number }> = {}
    questions.forEach((q: any, i: number) => {
      const d = (q?.difficulty || "").toLowerCase()
      if (!d) return
      if (!map[d]) map[d] = { firstIndex: i, count: 0 }
      map[d].count += 1
    })
    return map
  }, [questions])
  const availableDifficulties = useMemo(() => (["easy", "medium", "hard"] as const).filter((d) => !!difficultyMap[d]), [difficultyMap])
  const jumpToDifficulty = (diff: string) => { const e = difficultyMap[diff]; if (e) setCurrentQuestionIndex(e.firstIndex) }
  const getFilteredAndSortedQuestions = useCallback(() => {
    let filtered = questions.map((q: any, i: number) => ({ ...q, _originalIndex: i }))
    if (filterDifficulty !== "all") filtered = filtered.filter((q: any) => (q.difficulty || "").toLowerCase() === filterDifficulty)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((q: any) => (q.title || "").toLowerCase().includes(query) || (typeof q.description === "string" && q.description.toLowerCase().includes(query)))
    }
    if (sortBy === "difficulty") {
      const order: Record<string, number> = { easy: 1, medium: 2, hard: 3 }
      filtered.sort((a: any, b: any) => (order[(a.difficulty || "").toLowerCase()] || 4) - (order[(b.difficulty || "").toLowerCase()] || 4))
    } else if (sortBy === "title") filtered.sort((a: any, b: any) => (a.title || "").localeCompare(b.title || ""))
    else filtered.sort((a: any, b: any) => a._originalIndex - b._originalIndex)
    return filtered
  }, [questions, filterDifficulty, searchQuery, sortBy])
  const cycleSortOption = () => { const opts: Array<"default" | "difficulty" | "title"> = ["default", "difficulty", "title"]; setSortBy(opts[(opts.indexOf(sortBy) + 1) % opts.length]) }
  const getSortIcon = () => (sortBy === "difficulty" ? "🟢🟡🔴" : sortBy === "title" ? "A-Z" : "123")
  const goPrev = () => { if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1) }
  const goNext = () => { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex((i) => i + 1) }
  const selectQuestion = (idx: number) => setCurrentQuestionIndex(idx)

  // ─── Reusable question UI ───────────────────────────────────────────────────
  // Prev / Next arrow buttons — plain square controls that flank the "Question
  // N of M" label in the Problem details toolbar. The label lives outside so
  // the arrows don't duplicate it.
  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 8,
    border: "1px solid #D9E1EA", background: "#fff",
    color: disabled ? "#C6D0DA" : "#172033",
    cursor: disabled ? "not-allowed" : "pointer",
    flexShrink: 0,
  })
  const questionNav = questions.length > 1 ? (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={goPrev}
        disabled={currentQuestionIndex === 0}
        aria-label="Previous question"
        title="Previous question"
        style={navBtnStyle(currentQuestionIndex === 0)}
      >
        <ChevronLeft style={{ width: 16, height: 16 }} />
      </button>
      <button
        onClick={goNext}
        disabled={currentQuestionIndex === questions.length - 1}
        aria-label="Next question"
        title="Next question"
        style={navBtnStyle(currentQuestionIndex === questions.length - 1)}
      >
        <ChevronRight style={{ width: 16, height: 16 }} />
      </button>
    </div>
  ) : null

  // Build examples list — fallback to handle any question shape:
  //   1. ALL non-hidden testCases (matches code-editor.tsx logic — the forms
  //      only flag the first case isSample, so preferring flagged samples
  //      collapsed a multi-case question to one example)
  //   2. Legacy sampleInput / sampleOutput strings
  const _tcs: any[] = (currentQuestion as any)?.testCases || []
  const _visibleTcs = _tcs.filter((tc: any) => tc.isHidden !== true)
  const examples: Array<{ input: string; output: string; explanation?: string }> = _visibleTcs.length > 0
    ? _visibleTcs
        .map((tc: any) => ({
          input: tc.input ?? tc.testInput ?? "",
          output: tc.expectedOutput ?? tc.output ?? tc.expected ?? "",
          explanation: tc.explanation || "Sample test case",
        }))
        .filter(e => e.input || e.output)
    : ((currentQuestion as any)?.sampleInput || (currentQuestion as any)?.sampleOutput)
      ? [{ input: (currentQuestion as any).sampleInput || "", output: (currentQuestion as any).sampleOutput || "", explanation: "Sample input and output" }]
      : []
  const hintsList: string[] = ((currentQuestion as any)?.hints || [])
    .filter((h: any) => h && (h.isPublic === undefined || h.isPublic === true))
    .map((h: any) => (typeof h === "string" ? h : (h.hintText || h.text || "")))
    .filter(Boolean)

  const questionContent = (
    <div className="flex flex-col gap-4">
      {/* Title + badges */}
      <div>
        <h2 className="text-sm font-bold mb-2 text-gray-900">{currentQuestion?.title || exercise?.exerciseInformation?.exerciseName || "Exercise"}</h2>
        {(currentQuestion?.difficulty || (exData?.isGraded !== false && (currentQuestion?.score ?? currentQuestion?.points) != null)) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {currentQuestion?.difficulty && (
              <span className={`inline-block text-2xs px-2 py-0.5 rounded font-semibold ${currentQuestion.difficulty === "easy" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : currentQuestion.difficulty === "medium" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {currentQuestion.difficulty.toUpperCase()}
              </span>
            )}
            {exData?.isGraded !== false && (() => {
              const qMark = currentQuestion?.score ?? currentQuestion?.points ?? null
              if (qMark == null) return null
              return <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#dcfce7", color: "#15803d", fontWeight: 700, border: "1px solid #bbf7d0" }}>{qMark} {qMark === 1 ? "mark" : "marks"}</span>
            })()}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5 text-orange-500" />
          <h3 className="text-xs font-semibold text-gray-900">Description</h3>
        </div>
        <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: getQuestionHtml(currentQuestion) || exercise?.exerciseInformation?.description || "<p>Solve the problem using the editor on the right.</p>" }} />
      </div>

      {/* Sample Input & Output */}
      {examples.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TerminalIcon className="w-3.5 h-3.5 text-green-500" />
            <h3 className="text-xs font-semibold text-gray-900">Sample Input &amp; Output</h3>
          </div>
          <div className="flex flex-col gap-3">
            {examples.map((ex, ei) => (
              <div key={ei}>
                <strong className="text-2xs text-gray-600">Example {ei + 1}</strong>
                {ex.input && (
                  <div className="mt-1">
                    <div className="text-2xs font-medium text-gray-700 mb-0.5">Input:</div>
                    <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-2xs overflow-x-auto whitespace-pre-wrap">{ex.input}</pre>
                  </div>
                )}
                {ex.output && (
                  <div className="mt-1.5">
                    <div className="text-2xs font-medium text-gray-700 mb-0.5">Output:</div>
                    <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-2xs overflow-x-auto whitespace-pre-wrap">{ex.output}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {currentQuestion?.constraints?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
            <h3 className="text-xs font-semibold text-gray-900">Constraints</h3>
          </div>
          <ul className="list-disc pl-4 text-2xs text-gray-700 leading-relaxed">
            {currentQuestion.constraints.map((c: string, i: number) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Hints */}
      {hintsList.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
            <h3 className="text-xs font-semibold text-gray-900">Hints</h3>
          </div>
          {hintsList.map((h, hi) => (
            <div key={hi} className="text-2xs px-2.5 py-1.5 rounded mb-1 bg-orange-50 text-orange-800 border border-orange-100">
              💡 {h}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  // Small helper used by the Finish modal — a single tone-tinted status
  // card (Completed / Incomplete / Not attempted). Kept local so it can
  // reference FONT without prop drilling.
  const StatusCard = ({ tone, Icon, label, value }: {
    tone: 'ok' | 'warn' | 'mute'; Icon: any; label: string; value: number
  }) => {
    const T = tone === 'ok'
      ? { fg: '#12A765', bg: '#ECFDF3', border: '#BBF7D0' }
      : tone === 'warn'
        ? { fg: '#B54708', bg: '#FFFAEB', border: '#FDE68A' }
        : { fg: '#B42318', bg: '#FEF2F2', border: '#FECACA' }
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 10,
        border: "1px solid #E4E7EC", background: "#fff",
      }}>
        <span aria-hidden="true" style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: T.bg, border: `1px solid ${T.border}`, color: T.fg,
        }}>
          <Icon size={14} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#667085" }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#101828", lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full" style={{ background: "#fff", color: "#111827", fontFamily: FONT, userSelect: resizing.current ? "none" : "auto" }}>
      {/* GLOBAL HEADER — one compact toolbar per the workspace redesign:
          left = green product glyph + hamburger sidebar toggle; centre =
          Previous / N of M / Next question paginator (real values, no
          hardcoding); right = Visualize / Run / Submit answer / Finish
          assignment (moved out of the old editor toolbar so a single
          row carries the primary actions). Old breadcrumb + timer +
          Exercise-info/Score chips dropped from here; the left nav rail
          hosts Score + Exercise info now. */}
      {exercise && !isFull && (() => {
        const total = questions.length || 1
        const cur   = Math.min(currentQuestionIndex + 1, total)
        return (
          <div style={{
            flexShrink: 0,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4E7EC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px", minHeight: 60,
            gap: 12,
          }}>
            {/* Left — glyph + hamburger + Previous/counter/Next paginator.
                Paginator moved to the LEFT end of the toolbar per the
                user; sits right after the sidebar toggle so the reading
                flow is "sidebar / current question / actions". */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span aria-hidden="true" style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "#0F9D94", color: "#fff",
              }}>
                <FileCode style={{ width: 18, height: 18 }} />
              </span>
              <button
                type="button"
                onClick={() => setShowSidebar(v => !v)}
                aria-label="Toggle problems sidebar"
                aria-pressed={showSidebar}
                title={showSidebar ? "Hide problems" : "Show problems"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 8,
                  border: "1px solid #D9E1EA", background: "#fff", color: "#172033",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                <Menu style={{ width: 18, height: 18 }} />
              </button>

              {/* Prev / N-of-M / Next — smaller text (12px), wider
                  padding, buttons at the two ends of the group with the
                  counter between. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                  disabled={currentQuestionIndex <= 0}
                  aria-label="Previous question"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    minWidth: 100, height: 32, padding: "0 16px", borderRadius: 8,
                    border: "1px solid #D9E1EA", background: "#fff",
                    color: currentQuestionIndex <= 0 ? "#C6D0DA" : "#172033",
                    fontSize: 12, fontWeight: 600, fontFamily: FONT,
                    cursor: currentQuestionIndex <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft style={{ width: 13, height: 13 }} />
                  Previous
                </button>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 44, height: 32, padding: "0 8px",
                  fontFamily: FONT, fontSize: 13, fontWeight: 700, color: "#101828",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {cur} / {total}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex(i => Math.min(total - 1, i + 1))}
                  disabled={currentQuestionIndex >= total - 1}
                  aria-label="Next question"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    minWidth: 100, height: 32, padding: "0 16px", borderRadius: 8,
                    border: "1px solid #D9E1EA", background: "#fff",
                    color: currentQuestionIndex >= total - 1 ? "#C6D0DA" : "#172033",
                    fontSize: 12, fontWeight: 600, fontFamily: FONT,
                    cursor: currentQuestionIndex >= total - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                  <ChevronRight style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>

            {/* Right — primary actions moved up from the editor toolbar. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifySelf: "end" }}>
              {/* All right-cluster actions matched to the paginator
                  rhythm — h-32, 12px labels, tight padding. Labels
                  simplified per user: "Submit answer" → "Submit" and
                  "Finish {activity}" → "Finish". Full intent still
                  reads via title / aria-label. */}
              <button
                onClick={visualize}
                disabled={vizLoading || !ready}
                title="Step through your Python code"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 32, padding: "0 12px", borderRadius: 8,
                  border: "1px solid #6957E5", background: "#fff", color: "#6957E5",
                  fontSize: 12, fontWeight: 600, fontFamily: FONT,
                  cursor: vizLoading ? "wait" : "pointer",
                  opacity: ready ? 1 : 0.5,
                }}
              >
                {vizLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                Visualize
              </button>

              {running ? (
                <button onClick={stopRun} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 32, padding: "0 12px", borderRadius: 8,
                  border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c",
                  fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
                }}>
                  <Square size={12} /> Stop
                </button>
              ) : interactiveActive ? (
                <button onClick={stopInteractive} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 32, padding: "0 12px", borderRadius: 8,
                  border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c",
                  fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
                }}>
                  <Square size={12} /> Stop
                </button>
              ) : (
                <button
                  onClick={() => { selectedLanguage === "python" ? runInteractive() : runCode() }}
                  disabled={!ready || vizRunning}
                  title={selectedLanguage === "python" ? "Run with live input" : "Run your program"}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 32, padding: "0 14px", borderRadius: 8,
                    border: "none", background: "#12A765", color: "#fff",
                    fontSize: 12, fontWeight: 700, fontFamily: FONT,
                    cursor: (ready && !vizRunning) ? "pointer" : "not-allowed",
                    opacity: (ready && !vizRunning) ? 1 : 0.5,
                  }}
                >
                  <Play size={12} /> Run
                </button>
              )}

              {exercise && (
                <button
                  onClick={submitQuestion}
                  disabled={isSubmittingQuestion || isSubmitting}
                  title="Submit your answer to this question"
                  aria-label="Submit answer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 32, padding: "0 14px", borderRadius: 8,
                    border: "none",
                    background: (isSubmittingQuestion || isSubmitting) ? "#94A3B8" : "#FF641A",
                    color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: FONT,
                    cursor: (isSubmittingQuestion || isSubmitting) ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmittingQuestion ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Submit
                </button>
              )}

              <button
                onClick={() => { if (!isSubmitting) setShowSubmitConfirm(true) }}
                disabled={isSubmitting}
                title={`Finish and submit the entire ${activityNoun}`}
                aria-label={`Finish ${activityNoun}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 32, padding: "0 14px", borderRadius: 8,
                  border: "none", background: "#12A765", color: "#fff",
                  fontSize: 12, fontWeight: 700, fontFamily: FONT,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting
                  ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                  : <CheckCircle style={{ width: 12, height: 12 }} />}
                Finish
              </button>
            </div>
          </div>
        )
      })()}

      {/* MAIN BODY */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT NAV RAIL — thin column that hosts Problem toggle + the
            utility chips (Score, Exercise info) moved out of the header.
            First in the flex row so it always sits flush-left. */}
        {exercise && !isFull && (
          <div style={{
            width: 72, background: "#F7F9FB",
            borderRight: "1px solid #E4E7EC",
            display: "flex", flexDirection: "column", alignItems: "stretch",
            padding: "12px 0", gap: 4, flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={() => setShowNotesPanel(v => !v)}
              aria-label="Notes"
              aria-pressed={showNotesPanel}
              title="Notes — private scratchpad for this question"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer",
                color: showNotesPanel ? "#0F5B5D" : "#667085",
                borderLeft: showNotesPanel ? "2px solid #0F5B5D" : "2px solid transparent",
              }}
            >
              <NotebookPen style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT }}>Notes</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOverviewModal(true)}
              aria-label={(exData?.isGraded !== false) ? "Score" : "Questions"}
              title={(exData?.isGraded !== false) ? "Score" : "Questions"}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer",
                color: showOverviewModal ? "#6957E5" : "#667085",
                borderLeft: showOverviewModal ? "2px solid #6957E5" : "2px solid transparent",
              }}
            >
              <Award style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT }}>
                {(exData?.isGraded !== false) ? "Score" : "Overview"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              aria-label="Exercise info"
              title="Exercise info"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer",
                color: showDetailsModal ? "#0F9D94" : "#667085",
                borderLeft: showDetailsModal ? "2px solid #0F9D94" : "2px solid transparent",
              }}
            >
              <AlertCircle style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: FONT, lineHeight: 1.2, textAlign: "center" }}>
                Exercise<br />info
              </span>
            </button>
          </div>
        )}

        {/* Notes panel — private per-question scratchpad. Slides in
            beside the rail; autosaves to localStorage on every
            keystroke so a reload never loses the student's own notes.
            Kept intentionally simple (plain textarea) so it never
            competes with the code editor for attention. */}
        {showNotesPanel && !isFull && (
          <div
            className="flex-shrink-0 flex flex-col border-r"
            style={{ width: 320, background: "#FFFDF7", borderColor: "#E4E7EC" }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderBottom: "1px solid #E4E7EC", background: "#FFFBF0",
            }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <NotebookPen size={14} style={{ color: "#0F5B5D" }} />
                <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: "#101828" }}>
                  Notes
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesPanel(false)}
                aria-label="Close notes"
                title="Close"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: 6, border: "none",
                  background: "transparent", color: "#667085", cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{
              padding: "6px 14px 4px",
              fontFamily: FONT, fontSize: 11.5, color: "#667085",
            }}>
              Private scratchpad for this question. Autosaved.
            </div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Jot ideas, edge cases, or pseudo-code here…"
              spellCheck={false}
              style={{
                flex: 1, resize: "none",
                margin: "6px 14px 14px", padding: "10px 12px",
                borderRadius: 8, border: "1px solid #E4E7EC", background: "#fff",
                fontFamily: FONT, fontSize: 13, color: "#101828", lineHeight: 1.55,
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0F5B5D" }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E4E7EC" }}
            />
          </div>
        )}

        {/* Problems sidebar */}
        {showSidebar && !isFull && (
          <div className="w-80 border-r overflow-hidden flex flex-col flex-shrink-0" style={{ borderColor: "#e5e7eb", background: "#fff" }}>
            <div className="p-3 border-b" style={{ borderColor: "#e5e7eb" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Problems ({getFilteredAndSortedQuestions().length}/{questions.length})</h3>
                <button onClick={() => setShowSearch(!showSearch)} className={`p-1 ml-1 rounded ${showSearch ? "bg-orange-500" : "hover:bg-gray-100 text-gray-600"}`}>{showSearch ? <XIcon className="w-3.5 h-3.5 text-white" /> : <Search className="w-3.5 h-3.5" />}</button>
              </div>
              {showSearch && (
                <div className="relative mb-3">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" placeholder="Search problems..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-6 py-1.5 text-xs border rounded border-gray-300 bg-gray-50 text-gray-900" autoFocus />
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value as any)} className="flex-1 text-xs border rounded px-2 py-1.5 bg-white border-gray-300 text-gray-900">
                  <option value="all">All Difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
                <button onClick={cycleSortOption} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded border-gray-300 hover:bg-gray-100"><ArrowUpDown className="w-3.5 h-3.5 text-gray-600" /><span className="font-medium text-gray-600">{getSortIcon()}</span></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {getFilteredAndSortedQuestions().map((q: any) => {
                const originalIndex = q._originalIndex
                const isActive = currentQuestionIndex === originalIndex
                const diff = (q.difficulty || "").toLowerCase()
                return (
                  <button key={originalIndex} onClick={() => selectQuestion(originalIndex)} className={`w-full p-3 text-left border-b border-gray-100 ${isActive ? "bg-orange-50 border-l-2 border-l-orange-500" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate flex-1 text-gray-900">{originalIndex + 1}. {q.title || `Question ${originalIndex + 1}`}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {diff && <span className={`text-2xs px-1.5 py-0.5 rounded font-semibold ${diff === "easy" ? "bg-green-100 text-green-800" : diff === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>}
                        {solvedQuestions.has(originalIndex) && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#dcfce7", color: "#166534", fontWeight: 600, border: "1px solid #86efac" }}>Submitted</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Link questions — the external site IS the question; a card with
            Open + Submit replaces the question panel and the whole editor. */}
        {(() => {
          const _lq: any = currentQuestion as any
          if (!(_lq?.isLinkQuestion && _lq?.questionLink)) return null
          const linkUrl: string = _lq.questionLink
          return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ background: "#f9fafb" }}>
              <div className="text-md font-bold text-gray-800">This question opens on {hostOf(linkUrl)}</div>
              <p className="text-xs text-gray-500 max-w-md">
                Open the problem in a new tab, solve it there, then come back and press <b>Submit answer</b>.
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => window.open(linkUrl, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#FB923C", border: "none", cursor: "pointer" }}
                >
                  Open the problem ↗
                </button>
                {exercise && (
                  <button
                    onClick={submitQuestion}
                    disabled={isSubmittingQuestion || isSubmitting}
                    className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-sm font-bold text-white"
                    style={{ background: (isSubmittingQuestion || isSubmitting) ? "#9ca3af" : "#22c55e", border: "none", cursor: "pointer" }}
                  >
                    {isSubmittingQuestion ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    {solvedQuestions.has(currentQuestionIndex) ? "Submitted ✓" : "Submit answer"}
                  </button>
                )}
              </div>
              <span className="text-2xs text-gray-400 break-all max-w-md">{linkUrl}</span>
            </div>
          )
        })()}
        {!((currentQuestion as any)?.isLinkQuestion && (currentQuestion as any)?.questionLink) && (<>
        {/* Question panel */}
        {!isFull && (
          <>
            <div className="flex flex-col flex-shrink-0 overflow-hidden border-r" style={{ width: questionWidth, background: "#fff", borderColor: "#D9E1EA" }}>
              {/* Problem details — hamburger + "Question N of M" removed
                  from this row: they already sit in the global header's
                  paginator group, so repeating them here was pure noise.
                  Question content sits flush with the panel edge now. */}
              <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed text-gray-800">{questionContent}</div>
            </div>
            <div onMouseDown={(e) => { resizing.current = { kind: "question", startX: e.clientX, startWidth: questionWidth } }} className="w-1 cursor-col-resize hover:bg-orange-400 flex-shrink-0" style={{ background: "#e5e7eb" }} />
          </>
        )}

        {/* EDITOR AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "#fff" }}>
          {/* Toolbar — active-file crumb + Saved status on the left, then
              language + Visualize (outlined violet) + Run (green) + Submit
              answer (orange primary) on the right. "Submit answer" submits
              only the currently selected question; the whole-exercise
              "Finish exercise" lives in the global header. */}
          <div className="flex items-center justify-between flex-shrink-0" style={{ background: "#fff", borderBottom: "1px solid #D9E1EA", minHeight: 44, padding: "0 12px" }}>
            <div className="flex items-center gap-3 min-w-0">
              {isFull && (
                <button
                  onClick={() => setShowQDrawer((v) => !v)}
                  className="flex items-center gap-1 h-7 px-2 rounded text-xs font-semibold"
                  style={{ background: showQDrawer ? "#0F9D94" : "#F3F6FA", color: showQDrawer ? "#fff" : "#172033", border: showQDrawer ? "none" : "1px solid #D9E1EA" }}
                >
                  <FileText size={13} /> Question
                </button>
              )}
              {activeFile && (
                <span title={activeFile.path} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: "ui-monospace, monospace", fontSize: 12.5, fontWeight: 600, color: "#172033",
                  padding: "4px 10px", background: "#F3F6FA", borderRadius: 6, border: "1px solid #E4E7EC",
                  maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  <FileText style={{ width: 12, height: 12, color: "#667085" }} />
                  {basename(activeFile.path)}
                </span>
              )}
              {/* Autosave indicator — the editor debounces to /draft/save
                  every 1.5s and heartbeats every 15s, so a static "Saved"
                  is accurate for a student who's not offline. Kept
                  non-animated per the spec. */}
              <span aria-live="polite" title="Your work is autosaved" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: FONT, fontSize: 12, color: "#12A765", fontWeight: 500,
              }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "#12A765", display: "inline-block" }} />
                Saved
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Language picker stays on the editor toolbar because it's
                  scoped to the active file. Run / Visualize / Submit
                  answer moved to the global header (single-toolbar rule);
                  a Stop button STILL surfaces here when a run is live so
                  the student can halt without scrolling their eye all the
                  way up. */}
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
                aria-label="Language"
                style={{
                  height: 32, padding: "0 10px", borderRadius: 8,
                  border: "1px solid #D9E1EA", background: "#fff",
                  color: "#172033", fontSize: 12.5, fontWeight: 600,
                  fontFamily: "ui-monospace, monospace", cursor: "pointer",
                }}
              >
                {availableLanguages.map((lang) => <option key={lang} value={lang}>{LANGUAGE_CONFIG[lang].label}</option>)}
              </select>

              {(running || interactiveActive) && (
                <button
                  onClick={running ? stopRun : stopInteractive}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 32, padding: "0 12px", borderRadius: 8,
                    border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c",
                    fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
                  }}
                >
                  <Square size={13} /> Stop
                </button>
              )}

              <button
                onClick={() => setShowTerminal((v) => !v)}
                aria-label="Toggle terminal"
                title="Toggle terminal"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid #D9E1EA", background: "#fff", color: "#667085",
                  cursor: "pointer",
                }}
              >
                <TerminalIcon size={14} />
              </button>

              <button
                onClick={() => { setShowQDrawer(false); setIsFull((v) => !v) }}
                aria-label={isFull ? "Exit full screen" : "Full screen"}
                title={isFull ? "Exit full screen" : "Full screen"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid #D9E1EA", background: "#fff", color: "#667085",
                  cursor: "pointer",
                }}
              >
                {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Explorer | (Editor + Visualizer) over Terminal */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Full-screen question drawer */}
            {isFull && showQDrawer && (
              <div className="absolute top-0 left-0 bottom-0 z-20 flex flex-col bg-white shadow-2xl" style={{ width: Math.min(questionWidth, 460), borderRight: "1px solid #e5e7eb" }}>
                <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ borderColor: "#e5e7eb" }}>
                  <div className="flex items-center gap-2 min-w-0"><button onClick={() => setShowQDrawer(false)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-700"><X className="w-4 h-4" /></button><span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Problem</span></div>
                  {questionNav}
                </div>
                <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed text-gray-800">{questionContent}</div>
              </div>
            )}

            {/* Activity Bar — light cool-gray rail (was slate #1e293b) per
                the workspace redesign: no dark full-panel surfaces on the
                student side. Same 44px icon rail, teal active state instead
                of white-on-slate. */}
            <div className="flex-shrink-0 flex flex-col items-stretch" style={{ width: 44, background: "#F3F6FA", borderRight: "1px solid #D9E1EA" }}>
              {([
                { key: "explorer" as const, icon: FilesIcon, label: "Explorer (files)" },
                { key: "search"   as const, icon: SearchIcon, label: "Search across files" },
              ]).map(({ key, icon: Icon, label }) => {
                const active = sideView === key
                return (
                  <button
                    key={key}
                    aria-label={label}
                    aria-pressed={active}
                    title={label}
                    onClick={() => setSideView((v) => (v === key ? null : key))}
                    className="flex items-center justify-center"
                    style={{
                      height: 44, position: "relative",
                      color: active ? "#0F9D94" : "#667085",
                      background: active ? "#fff" : "transparent",
                      borderLeft: active ? "2px solid #0F9D94" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>

            {/* Side panel — explorer / search / collapsed */}
            {sideView !== null && (
              <>
                <div className="flex-shrink-0 border-r overflow-hidden" style={{ width: treeWidth, borderColor: "#e5e7eb", background: "#fafafa" }}>
                  {sideView === "explorer" ? (
                    <FileTree
                      files={files} folders={folders} activeFileId={activeFileId} busy={!ready}
                      defaultTargetFolder={activeFile?.folderPath || "/"}
                      onOpenFile={openFile} onCreateFile={createFile} onCreateFolder={createFolder}
                      onRenameFile={renameFile} onRenameFolder={renameFolder}
                      onDeleteFile={deleteFile} onDeleteFolder={deleteFolder} onMove={moveItem}
                    />
                  ) : (
                    <SearchPanel files={files} onOpenFile={openFile} />
                  )}
                </div>
                {/* Explorer resize grip — mirrors the bottom-panel handle:
                    6px cool-gray strip with a centred left/right-arrow chip
                    so the drag affordance is unambiguous. */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize explorer"
                  onMouseDown={(e) => { resizing.current = { kind: "tree", startX: e.clientX, startWidth: treeWidth } }}
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 6, cursor: "col-resize",
                    background: "#F3F6FA", borderLeft: "1px solid #D9E1EA", borderRight: "1px solid #D9E1EA",
                  }}
                  title="Drag to resize the explorer"
                >
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 14, height: 34, borderRadius: 6,
                    background: "#fff", border: "1px solid #D9E1EA", color: "#667085",
                    pointerEvents: "none",
                  }}>
                    <ArrowUpDown size={11} style={{ transform: "rotate(90deg)" }} />
                  </span>
                </div>
              </>
            )}

            {/* Editor + terminal column */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex-1 flex min-h-0">
                {/* Monaco */}
                <div className="flex-1 min-w-0 min-h-0">
                  {!ready ? (
                    <div className="flex items-center justify-center h-full gap-2 text-sm text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Preparing your workspace…</div>
                  ) : (
                    <MonacoTabs
                      openFiles={openFileObjs} activeFileId={activeFileId} theme={theme}
                      onSelectTab={setActiveFileId} onCloseTab={closeTab} onChange={onEditorChange}
                    />
                  )}
                </div>
              </div>

              {/* Bottom panel — two tabs: Terminal (Run output) and Test
                  Result (Submit answer output). Height is drag-resizable via
                  the grip on its top border (two-arrow icon centred on the
                  divider). Flipping tabs preserves both panels' state. */}
              {showTerminal && (
                <>
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize bottom panel"
                    onMouseDown={(e) => { resizing.current = { kind: "bottom", startY: e.clientY, startHeight: bottomPanelHeight } }}
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      height: 6, cursor: "row-resize",
                      background: "#F3F6FA", borderTop: "1px solid #D9E1EA", borderBottom: "1px solid #D9E1EA",
                      position: "relative",
                    }}
                    title="Drag to resize the bottom panel"
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 34, height: 14, borderRadius: 6,
                      background: "#fff", border: "1px solid #D9E1EA", color: "#667085",
                      pointerEvents: "none",
                    }}>
                      <ArrowUpDown size={11} />
                    </span>
                  </div>
                  <div className="flex-shrink-0 flex flex-col" style={{ height: bottomPanelHeight, borderColor: "#D9E1EA", background: "#fff" }}>
                  <BottomPanel
                    activeTab={bottomTab}
                    onTabChange={setBottomTab}
                    testResult={testResult}
                    // Terminal props
                    termLines={termLines}
                    running={running || interactiveActive}
                    stdin={stdin}
                    lastRuntime={lastRuntime}
                    setStdin={setStdin}
                    onClearTerm={() => setTermLines([])}
                    interactive={interactiveActive}
                    awaitingInput={awaitingInput}
                    inputPrompt={inputPrompt}
                    onSubmitInput={submitInteractiveInput}
                    // TestResult props
                    selectedCaseIndex={selectedCaseIndex}
                    onSelectCase={setSelectedCaseIndex}
                    onRetrySubmit={submitQuestion}
                    isSubmitting={isSubmittingQuestion}
                  />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </>)}{/* end non-link question panel + editor */}
      </div>

      {/* MODALS */}
      {/* Finish confirmation — summary modal per the design mockup.
          Shows a live progress split (Completed / Incomplete / Not
          attempted) computed from solvedQuestions + attemptedQuestions,
          a "Needs your attention" list of the specific questions that
          are incomplete or not attempted, and a save-status panel. Two
          footer actions: Review questions (close the modal so the
          student can jump around) and Finish {activity} (real submit).
          The modal stays open during the network call so the button
          shows the in-flight spinner. */}
      {showSubmitConfirm && (() => {
        const total = questions.length || 0
        const completedList: number[] = []
        const incompleteList: number[] = []
        const notAttemptedList: number[] = []
        for (let i = 0; i < total; i++) {
          if (solvedQuestions.has(i)) completedList.push(i)
          else if (attemptedQuestions.has(i)) incompleteList.push(i)
          else notAttemptedList.push(i)
        }
        const completed = completedList.length
        const incomplete = incompleteList.length
        const notAttempted = notAttemptedList.length
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0
        const attention: Array<{ index: number; kind: 'incomplete' | 'not-attempted'; label: string }> = [
          ...incompleteList.map((i) => ({ index: i, kind: 'incomplete' as const, label: 'Answer is incomplete' })),
          ...notAttemptedList.map((i) => ({ index: i, kind: 'not-attempted' as const, label: 'Not attempted' })),
        ]
        const exerciseName = exercise?.exerciseInformation?.exerciseName || `this ${activityNoun}`
        const goToQuestion = (idx: number) => {
          setShowSubmitConfirm(false)
          setCurrentQuestionIndex(idx)
        }
        return (
          <div
            onClick={(e) => { if (!isSubmitting && e.target === e.currentTarget) setShowSubmitConfirm(false) }}
            style={{
              position: "fixed", inset: 0, zIndex: 99999,
              background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
              fontFamily: FONT,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="finish-modal-title"
              style={{
                background: "#fff", borderRadius: 14, width: "100%", maxWidth: 600,
                boxShadow: "0 24px 60px rgba(15,23,42,0.24)", border: "1px solid #E4E7EC",
                display: "flex", flexDirection: "column", overflow: "visible",
              }}
            >
              {/* Header — compact so the whole modal fits without inner scroll */}
              <div style={{ padding: "14px 20px 4px", display: "flex", alignItems: "center", gap: 12 }}>
                <span aria-hidden="true" style={{
                  width: 34, height: 34, borderRadius: 999, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "#FFF4EC", border: "1px solid #FFE0CC", color: "#FF641A",
                }}>
                  <CheckCircle style={{ width: 17, height: 17 }} />
                </span>
                <h2 id="finish-modal-title" style={{ fontSize: 17, fontWeight: 700, color: "#101828", margin: 0 }}>
                  {isSubmitting ? "Finishing…" : `Finish ${activityNoun}?`}
                </h2>
              </div>

              {/* Assignment name + progress */}
              <div style={{ padding: "4px 20px 0" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#101828", wordBreak: "break-word" }}>
                  {exerciseName}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#667085", marginTop: 4 }}>
                  <span>{completed} of {total} questions completed</span>
                  <span>{pct}% complete</span>
                </div>
                <div style={{ marginTop: 4, height: 5, borderRadius: 999, background: "#F1F1F3", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#FF641A", transition: "width .3s ease" }} />
                </div>
              </div>

              {/* Status cards */}
              <div style={{ padding: "10px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <StatusCard tone="ok"   Icon={Check}          label="Completed"     value={completed} />
                <StatusCard tone="warn" Icon={AlertTriangle}  label="Incomplete"    value={incomplete} />
                <StatusCard tone="mute" Icon={MinusCircle}    label="Not attempted" value={notAttempted} />
              </div>

              {/* Needs your attention */}
              {attention.length > 0 && (
                <div style={{
                  margin: "10px 20px 0", padding: "10px 12px",
                  border: "1px solid #E4E7EC", borderRadius: 10,
                  // Only the attention list scrolls if there are many
                  // incomplete/not-attempted rows. Everything else stays
                  // fixed so the modal itself never needs a scrollbar.
                  maxHeight: 150, overflowY: "auto",
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#101828", marginBottom: 4 }}>
                    Needs your attention
                  </div>
                  {attention.map((row, i) => {
                    const tone = row.kind === 'incomplete' ? 'warn' : 'mute'
                    const Icon = row.kind === 'incomplete' ? AlertTriangle : MinusCircle
                    return (
                      <button
                        key={row.index}
                        type="button"
                        onClick={() => goToQuestion(row.index)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "6px 0", background: "transparent", border: "none",
                          borderTop: i === 0 ? undefined : "1px solid #F1F1F3",
                          textAlign: "left", cursor: "pointer",
                        }}
                      >
                        <Icon size={15} style={{ color: tone === 'warn' ? '#B54708' : '#B42318', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: "#101828" }}>
                          Question {row.index + 1} <span style={{ color: "#667085" }}>— {row.label}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Save state panel */}
              <div style={{
                margin: "10px 20px 0", padding: "10px 12px",
                border: "1px solid #E4E7EC", borderRadius: 10,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span aria-hidden="true" style={{
                  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "#ECFDF3", border: "1px solid #BBF7D0", color: "#12A765",
                }}>
                  <CloudUpload size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#101828" }}>All responses saved</div>
                  <div style={{ fontSize: 11.5, color: "#667085", marginTop: 1 }}>
                    Submitting locks all questions from further edits.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                marginTop: 12, padding: "10px 16px 14px", borderTop: "1px solid #E4E7EC",
                display: "flex", justifyContent: "flex-end", gap: 8,
              }}>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  disabled={isSubmitting}
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 8,
                    border: "1px solid #D9E1EA", background: "#fff", color: "#101828",
                    fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                    cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  Review questions
                </button>
                <button
                  type="button"
                  onClick={() => submitExercise()}
                  disabled={isSubmitting}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 36, padding: "0 16px", borderRadius: 8,
                    border: "none", background: isSubmitting ? "#94A3B8" : "#FF641A", color: "#fff",
                    fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  {isSubmitting ? "Finishing…" : `Finish ${activityNoun}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {pendingNavLevel !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Leave Exercise?</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>Your progress is auto-saved as a draft, but you may want to submit first.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setPendingNavLevel(null)} style={{ fontSize: 13, fontWeight: 700, padding: "11px 16px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", cursor: "pointer" }}>Stay in Exercise</button>
              <button onClick={() => { onNavigateToBreadcrumb?.(pendingNavLevel); setPendingNavLevel(null) }} style={{ fontSize: 13, fontWeight: 500, padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "none", color: "#6b7280", cursor: "pointer" }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {exData && (
        <ExerciseInfoModals exercise={exData} showDetailsModal={showDetailsModal} setShowDetailsModal={setShowDetailsModal} showOverviewModal={showOverviewModal} setShowOverviewModal={setShowOverviewModal} solvedQuestions={solvedQuestions} />
      )}

      {/* Python execution visualizer (PythonTutor-style, streamed trace) */}
      {showVisualizer && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeVisualizer() }}
          style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)" }}
        >
          <div style={{ width: "min(1280px, 97vw)", height: "min(860px, 94vh)", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
            {vizLoading && vizSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#4338ca" }} />
                <div className="text-sm text-gray-600">Starting Python… (first run downloads Pyodide)</div>
                <button onClick={closeVisualizer} className="text-xs text-gray-400 hover:text-gray-600 underline">Cancel</button>
              </div>
            ) : (
              <TraceVisualizer
                source={vizSource}
                steps={vizSteps}
                complete={vizComplete}
                building={vizRunning}
                truncated={vizTruncated}
                awaitingInput={vizAwait}
                inputPrompt={vizPrompt}
                inputs={vizInputs}
                onSubmitInput={submitVizInput}
                onClose={closeVisualizer}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
