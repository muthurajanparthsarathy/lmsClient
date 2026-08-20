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
import RunTerminal, { type TermLine } from "./multi-file/RunTerminal"
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
const seedFiles = (lang: SupportedLanguage): FileNode[] => {
  const cfg = LANGUAGE_CONFIG[lang]
  return [{
    id: uid("file"), filename: cfg.filename, content: STARTER_CODE[lang],
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const currentQuestion = questions[currentQuestionIndex] || null

  const [showSidebar, setShowSidebar] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all")
  const [sortBy, setSortBy] = useState<"default" | "difficulty" | "title">("default")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [solvedQuestions, setSolvedQuestions] = useState<Set<number>>(new Set())

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  const isSubmitGuardRef = useRef(false)
  const isSubmitQuestionGuardRef = useRef(false)

  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [pendingNavLevel, setPendingNavLevel] = useState<null | "course" | "hierarchy" | "category">(null)

  const [fullExercise, setFullExercise] = useState<any>(exercise || null)
  const [exerciseTimeLeft, setExerciseTimeLeft] = useState<number | null>(null)

  const resizing = useRef<null | "question" | "tree">(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?._id])

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

    const hydrate = (fileRecords: any[], folderRecords: any[], lang: SupportedLanguage) => {
      if (cancelled) return
      const fs = fileRecords.map(fileFromRecord)
      if (fs.length === 0) { fs.push(...seedFiles(lang)) }
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
    }

    ;(async () => {
      const exerciseId = exercise?._id
      const questionId = currentQuestion?._id

      // 1) draft
      if (exerciseId && questionId) {
        try {
          const r = await fetch(`${API}/draft/load?exerciseId=${exerciseId}&questionId=${questionId}`, { headers: authHeaders(), cache: "no-store" })
          const data = await r.json()
          const d = data?.draft
          if (d && Array.isArray(d.files) && d.files.length > 0) {
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

      // 3) starter
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
  }, [])

  // ═════════════════════════════════════════════════════════════════════════════
  // Run on Piston
  // ═════════════════════════════════════════════════════════════════════════════
  const toRunFiles = (): RunFile[] =>
    files.map((f) => ({ path: f.path, content: f.content, isEntryPoint: f.isEntryPoint }))

  const runCode = useCallback(async () => {
    if (running || vizRunning || !files.length) return
    setRunning(true)
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
      // the trainer reviews/marks it manually.
      log("info", "🔗 Link question — submission recorded; the trainer reviews the external-site solution.")
    } else if (method === "testcase") {
      // Multi-file test-case harness. Piston already runs the whole project
      // in one shot (see runOnPiston in pistonClient.ts — the entry file goes
      // first and cross-file imports resolve), so we can feed each test case's
      // input as stdin, compare stdout, and derive the score the same way the
      // single-file editor does (score = passed / total × maxMarks). Previously
      // this branch just posted score:0 and asked the trainer to grade by hand.
      const cases: Array<{ input?: string; expectedOutput?: string; isHidden?: boolean }> =
        (currentQuestion as any)?.testCases || []
      const maxMarks = Number(currentQuestion?.score ?? currentQuestion?.points ?? 10) || 10

      if (cases.length === 0) {
        log("info", "⚠️ No test cases configured on this question — code saved without an auto-score.")
      } else {
        // Match the single-file editor: CRLF→LF, strip trailing whitespace per
        // line, trim leading/trailing blank lines. Keeps auto-scores from being
        // torpedoed by an extra newline or platform line endings.
        const norm = (s: string) =>
          (s || "").replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim()

        // pistonClient wants { path, content, isEntryPoint } — submitFiles
        // already carries all three, so just narrow the type.
        const runFiles = submitFiles.map((f) => ({
          path: f.path || `/${f.filename}`,
          content: f.content,
          isEntryPoint: !!f.isEntryPoint,
        }))

        log("system", `🧪 Running ${cases.length} test case${cases.length > 1 ? "s" : ""}…`)
        let passed = 0
        // input/expected/actual ride along so the Review page can show the
        // trainer WHICH cases failed, not just the count.
        const perCase: Array<{ index: number; passed: boolean; hidden: boolean; input: string; expectedOutput: string; actualOutput: string }> = []
        for (let i = 0; i < cases.length; i++) {
          const tc = cases[i]
          const label = tc.isHidden ? `Hidden test #${i + 1}` : `Test #${i + 1}`
          const base = { index: i, hidden: !!tc.isHidden, input: tc.input ?? "", expectedOutput: tc.expectedOutput ?? "" }
          try {
            const result = await runOnPiston({
              language: selectedLanguage as any,
              files: runFiles,
              stdin: tc.input ?? "",
            })
            if (result.compileError) {
              perCase.push({ ...base, passed: false, actualOutput: `compile: ${result.compileError.split("\n")[0]}` })
              log("error", `✗ ${label} failed — compile: ${result.compileError.split("\n")[0]}`)
            } else {
              const ok = norm(result.stdout) === norm(tc.expectedOutput ?? "")
              const actual = (result.stdout || "").trim() || result.stderr || ""
              perCase.push({ ...base, passed: ok, actualOutput: actual })
              if (ok) { passed++; log("success", `✓ ${label} passed`) }
              else if (tc.isHidden) log("error", `✗ ${label} failed`)
              else log(
                "error",
                `✗ ${label} failed — expected: ${tc.expectedOutput ?? ""} | got: ${actual || "(no output)"}`,
              )
            }
          } catch (e: any) {
            perCase.push({ ...base, passed: false, actualOutput: `(execution error: ${e?.message || e})` })
            log("error", `✗ ${label} failed (execution error: ${e?.message || e})`)
          }
          // Same soft rate-limit guard the single-file grader uses against the
          // public Piston API — cheap enough on self-hosted, matters on emkc.
          if (i < cases.length - 1) await new Promise((r) => setTimeout(r, 300))
        }
        submitScore = Math.round((passed / cases.length) * maxMarks * 100) / 100
        submitStatus = passed === cases.length ? "solved" : "submitted"
        evaluationBreakdown = { method: "testcase", testcase: { passed, total: cases.length, cases: perCase } }
        log(
          passed === cases.length ? "success" : "info",
          `🏁 Passed ${passed}/${cases.length} — Score: ${submitScore}/${maxMarks}`,
        )
      }
    } else if (method === "ai") {
      log("system", "🤖 Running AI evaluation…")
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
        log("error", `⚠️ ${aiResult.errorMessage || "AI grader failed."}`)
      } else {
        const b = aiResult.breakdown.ai
        log(
          "success",
          `🏁 AI score: ${submitScore}/${maxMarks} — ${b.passedTestCases}/${b.totalTestCases} test cases passed, ${b.criteria.length} criteria evaluated`,
        )
      }
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
    const res = await axios.post(`${API}/courses/answers/submit-multiple-files`, payload, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
    })
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
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizing.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (resizing.current === "question") setQuestionWidth(Math.max(220, Math.min(640, e.clientX - rect.left)))
      else if (resizing.current === "tree") {
        const base = rect.left + (isFull ? 0 : questionWidth)
        setTreeWidth(Math.max(150, Math.min(420, e.clientX - base)))
      }
    }
    const handleUp = () => { resizing.current = null }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [isFull, questionWidth])

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
  const questionNav = questions.length > 1 ? (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={goPrev} disabled={currentQuestionIndex === 0} className="px-2 h-6 flex items-center justify-center gap-0.5 border rounded text-[11px] font-medium border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50">
        <ChevronLeft className="w-3 h-3" /> Prev
      </button>
      <span className="text-[11px] font-semibold min-w-[34px] text-center text-emerald-600">{currentQuestionIndex + 1}/{questions.length}</span>
      <button onClick={goNext} disabled={currentQuestionIndex === questions.length - 1} className="px-2 h-6 flex items-center justify-center gap-0.5 border rounded text-[11px] font-medium border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:opacity-50">
        Next <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">Q {currentQuestionIndex + 1}/{questions.length || 1}</span>
  )

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
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold ${currentQuestion.difficulty === "easy" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : currentQuestion.difficulty === "medium" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
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
          <h3 className="text-[12px] font-semibold text-gray-900">Description</h3>
        </div>
        <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: getQuestionHtml(currentQuestion) || exercise?.exerciseInformation?.description || "<p>Solve the problem using the editor on the right.</p>" }} />
      </div>

      {/* Sample Input & Output */}
      {examples.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TerminalIcon className="w-3.5 h-3.5 text-green-500" />
            <h3 className="text-[12px] font-semibold text-gray-900">Sample Input &amp; Output</h3>
          </div>
          <div className="flex flex-col gap-3">
            {examples.map((ex, ei) => (
              <div key={ei}>
                <strong className="text-[11px] text-gray-600">Example {ei + 1}</strong>
                {ex.input && (
                  <div className="mt-1">
                    <div className="text-[10px] font-medium text-gray-700 mb-0.5">Input:</div>
                    <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-[11px] overflow-x-auto whitespace-pre-wrap">{ex.input}</pre>
                  </div>
                )}
                {ex.output && (
                  <div className="mt-1.5">
                    <div className="text-[10px] font-medium text-gray-700 mb-0.5">Output:</div>
                    <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-[11px] overflow-x-auto whitespace-pre-wrap">{ex.output}</pre>
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
            <h3 className="text-[12px] font-semibold text-gray-900">Constraints</h3>
          </div>
          <ul className="list-disc pl-4 text-[11px] text-gray-700 leading-relaxed">
            {currentQuestion.constraints.map((c: string, i: number) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Hints */}
      {hintsList.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
            <h3 className="text-[12px] font-semibold text-gray-900">Hints</h3>
          </div>
          {hintsList.map((h, hi) => (
            <div key={hi} className="text-[11px] px-2.5 py-1.5 rounded mb-1 bg-orange-50 text-orange-800 border border-orange-100">
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
  return (
    <div ref={containerRef} className="flex flex-col h-full w-full" style={{ background: "#fff", color: "#111827", fontFamily: FONT, userSelect: resizing.current ? "none" : "auto" }}>
      {/* TOP CHROME */}
      {exercise && !isFull && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 12px", gap: 8, borderBottom: "1px solid #f0f0f0", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
              <button onClick={() => setPendingNavLevel("course")} style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: "#f97316", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{courseName || "Course"}</button>
              {hierarchy.map((seg, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronRight style={{ width: 12, height: 12, color: "#c0c4cc" }} />
                  <button onClick={() => setPendingNavLevel("hierarchy")} style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: "#f97316", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{seg}</button>
                </span>
              ))}
              {category && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronRight style={{ width: 12, height: 12, color: "#c0c4cc" }} />
                  <button onClick={() => setPendingNavLevel("category")} style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: "#f97316", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{category === "We_Do" ? "We Do" : category === "I_Do" ? "I Do" : category === "You_Do" ? "You Do" : category}</button>
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight style={{ width: 12, height: 12, color: "#c0c4cc" }} />
                <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis" }}>{exercise?.exerciseInformation?.exerciseName || "Exercise"}</span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
              <button onClick={() => { if (!isSubmitting) setShowSubmitConfirm(true) }} disabled={isSubmitting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", background: isSubmitting ? "#6b7280" : "#10b981", color: "white", fontSize: 13, fontWeight: 500, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <CheckCircle style={{ width: 14, height: 14 }} />} Submit Exercise
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", background: "#ffffff", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {availableDifficulties.length > 0 && (
                <>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Difficulty</span>
                  <select value={selectedDifficulty} onChange={(e) => { setSelectedDifficulty(e.target.value); if (e.target.value !== "all") jumpToDifficulty(e.target.value) }} style={{ height: 28, padding: "0 10px", borderRadius: 99, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    <option value="all">All difficulties</option>
                    {availableDifficulties.map((diff) => <option key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)} ({difficultyMap[diff].count})</option>)}
                  </select>
                </>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 99, background: "#fff7ed" }}>
                <FileCode style={{ width: 12, height: 12, color: "#f97316" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316" }}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <ExerciseInfoButtons onDetailsClick={() => setShowDetailsModal(true)} onOverviewClick={() => setShowOverviewModal(true)} isGraded={exData?.isGraded !== false} detailsActive={showDetailsModal} overviewActive={showOverviewModal} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {exerciseTimeLeft !== null && (exData?.exerciseInformation?.totalDuration || 0) > 0 && (() => {
                const totalSecs = (exData?.exerciseInformation?.totalDuration || 0) * 60
                const pct = totalSecs > 0 ? Math.max(0, (exerciseTimeLeft / totalSecs) * 100) : 0
                const isDanger = exerciseTimeLeft < 60
                const tcol = isDanger ? "#ef4444" : exerciseTimeLeft < 300 ? "#f59e0b" : "#F27757"
                return (
                  <div style={{ minWidth: 130 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock style={{ width: 12, height: 12, color: tcol }} /><span style={{ fontSize: 11, color: "#9b9bae", fontWeight: 600 }}>Time Left</span></div>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 800, color: tcol }}>{formatExerciseTime(exerciseTimeLeft)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: "#f4f4f7", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: tcol, transition: "width 1s linear" }} /></div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MAIN BODY */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
                        {diff && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${diff === "easy" ? "bg-green-100 text-green-800" : diff === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>}
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
              <div className="text-[15px] font-bold text-gray-800">This question opens on {hostOf(linkUrl)}</div>
              <p className="text-[12px] text-gray-500 max-w-md">
                Open the problem in a new tab, solve it there, then come back and press <b>Submit Question</b>.
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => window.open(linkUrl, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-bold text-white"
                  style={{ background: "#FB923C", border: "none", cursor: "pointer" }}
                >
                  Open the problem ↗
                </button>
                {exercise && (
                  <button
                    onClick={submitQuestion}
                    disabled={isSubmittingQuestion || isSubmitting}
                    className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-bold text-white"
                    style={{ background: (isSubmittingQuestion || isSubmitting) ? "#9ca3af" : "#22c55e", border: "none", cursor: "pointer" }}
                  >
                    {isSubmittingQuestion ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    {solvedQuestions.has(currentQuestionIndex) ? "Submitted ✓" : "Submit Question"}
                  </button>
                )}
              </div>
              <span className="text-[11px] text-gray-400 break-all max-w-md">{linkUrl}</span>
            </div>
          )
        })()}
        {!((currentQuestion as any)?.isLinkQuestion && (currentQuestion as any)?.questionLink) && (<>
        {/* Question panel */}
        {!isFull && (
          <>
            <div className="flex flex-col flex-shrink-0 overflow-hidden border-r" style={{ width: questionWidth, background: "#fff", borderColor: "#e5e7eb" }}>
              <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ borderColor: "#e5e7eb" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setShowSidebar(!showSidebar)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-700" title={showSidebar ? "Hide problems" : "Show problems"}>{showSidebar ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}</button>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Problem</span>
                </div>
                {questionNav}
              </div>
              <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed text-gray-800">{questionContent}</div>
            </div>
            <div onMouseDown={() => { resizing.current = "question" }} className="w-1 cursor-col-resize hover:bg-orange-400 flex-shrink-0" style={{ background: "#e5e7eb" }} />
          </>
        )}

        {/* EDITOR AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "#fff" }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-shrink-0 px-3" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", minHeight: 40 }}>
            <div className="flex items-center gap-2">
              {isFull && (
                <button onClick={() => setShowQDrawer((v) => !v)} className="flex items-center gap-1 h-7 px-2 rounded text-[11px] font-semibold" style={{ background: showQDrawer ? "#f97316" : "#f3f4f6", color: showQDrawer ? "#fff" : "#374151", border: showQDrawer ? "none" : "1px solid #e5e7eb" }}><FileText size={13} /> Question</button>
              )}
              <span className="text-[11px] text-gray-600">Language</span>
              <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: `1px solid ${LANGUAGE_CONFIG[selectedLanguage]?.color || "#d1d5db"}`, background: "#fff", color: "#111827", fontSize: 12, fontWeight: 600, fontFamily: "ui-monospace, monospace", cursor: "pointer" }}>
                {availableLanguages.map((lang) => <option key={lang} value={lang}>{LANGUAGE_CONFIG[lang].label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pr-1 flex-shrink-0">
              {running ? (
                <button onClick={stopRun} className="flex items-center gap-1.5 h-7 px-3 rounded text-[12px] font-semibold" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}><Square size={12} /> Stop</button>
              ) : interactiveActive ? (
                <button onClick={stopInteractive} className="flex items-center gap-1.5 h-7 px-3 rounded text-[12px] font-semibold" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}><Square size={12} /> Stop</button>
              ) : (
                // Single Run button: Python runs interactively (live input);
                // other languages run on Piston (batch + stdin box).
                <button
                  onClick={() => { selectedLanguage === "python" ? runInteractive() : runCode() }}
                  disabled={!ready || vizRunning}
                  title={selectedLanguage === "python" ? "Run with live, interactive input()" : "Run your program"}
                  className="flex items-center gap-1.5 h-7 px-3 rounded text-[12px] font-semibold"
                  style={{ background: "#22c55e", color: "#fff", border: "none", opacity: (ready && !vizRunning) ? 1 : 0.5 }}
                ><Play size={12} /> Run</button>
              )}
              <button onClick={visualize} disabled={vizLoading || !ready} title="Step through your Python code (stack + heap)" className="flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-semibold" style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", cursor: vizLoading ? "wait" : "pointer", opacity: ready ? 1 : 0.5 }}>{vizLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Visualize</button>
              <button onClick={() => setShowTerminal((v) => !v)} className="flex items-center gap-1 h-7 px-2 rounded text-[11px] text-gray-600 hover:bg-gray-100" title="Toggle terminal">Terminal</button>
              {exercise && (
                <button onClick={submitQuestion} disabled={isSubmittingQuestion || isSubmitting} className="flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-semibold" style={{ border: "none", background: (isSubmittingQuestion || isSubmitting) ? "#9ca3af" : "#f97316", color: "#fff", cursor: "pointer" }}>{isSubmittingQuestion ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Submit Question</button>
              )}
              <button onClick={() => { setShowQDrawer(false); setIsFull((v) => !v) }} className="flex items-center justify-center w-7 h-7 rounded text-gray-600 hover:bg-gray-100" title={isFull ? "Exit full screen" : "Full screen"}>{isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
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

            {/* VS Code-style Activity Bar — always visible icon rail.
                Clicking the active icon collapses the side panel; clicking an
                inactive one switches to it. */}
            <div className="flex-shrink-0 flex flex-col items-stretch" style={{ width: 44, background: "#1e293b" }}>
              {([
                { key: "explorer" as const, icon: FilesIcon, label: "Explorer (files)" },
                { key: "search"   as const, icon: SearchIcon, label: "Search across files" },
              ]).map(({ key, icon: Icon, label }) => {
                const active = sideView === key
                return (
                  <button
                    key={key}
                    title={label}
                    onClick={() => setSideView((v) => (v === key ? null : key))}
                    className="flex items-center justify-center"
                    style={{ height: 44, position: "relative", color: active ? "#fff" : "#94a3b8", background: "transparent", cursor: "pointer" }}
                  >
                    {active && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, background: "#fff", borderRadius: 2 }} />}
                    <Icon size={20} />
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
                <div onMouseDown={() => { resizing.current = "tree" }} className="w-1 cursor-col-resize hover:bg-orange-400 flex-shrink-0" style={{ background: "#e5e7eb" }} />
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

              {/* Terminal */}
              {showTerminal && (
                <div className="flex-shrink-0 border-t" style={{ height: 200, borderColor: "#1e293b" }}>
                  <RunTerminal
                    lines={termLines} running={running || interactiveActive} stdin={stdin}
                    lastRuntimeMs={lastRuntime} onStdinChange={setStdin} onClear={() => setTermLines([])}
                    interactive={interactiveActive}
                    awaitingInput={awaitingInput}
                    inputPrompt={inputPrompt}
                    onSubmitInput={submitInteractiveInput}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        </>)}{/* end non-link question panel + editor */}
      </div>

      {/* MODALS */}
      {/* Submit Exercise confirmation — stays open during the network call so
          the spinner gives clear feedback. submitExercise() closes it on success. */}
      {showSubmitConfirm && (
        <div
          onClick={(e) => { if (!isSubmitting && e.target === e.currentTarget) setShowSubmitConfirm(false) }}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ background: "#fff", borderRadius: 12, width: 420, padding: "26px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle style={{ width: 18, height: 18, color: "#15803d" }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                {isSubmitting ? "Submitting…" : "Submit Exercise?"}
              </p>
            </div>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 22, lineHeight: 1.6 }}>
              {isSubmitting
                ? <>Uploading your code for <b>"{exercise?.exerciseInformation?.exerciseName || "this exercise"}"</b>… please wait.</>
                : <>Are you sure you want to submit <b>"{exercise?.exerciseInformation?.exerciseName || "this exercise"}"</b>? Once submitted you won't be able to edit your code for this question again.</>
              }
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmitting}
                style={{ fontSize: 13, fontWeight: 500, padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.5 : 1 }}
              >No</button>
              <button
                onClick={() => submitExercise()}
                disabled={isSubmitting}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "none", background: isSubmitting ? "#6b7280" : "#10b981", color: "#fff", cursor: isSubmitting ? "not-allowed" : "pointer" }}
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? "Submitting…" : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <button onClick={closeVisualizer} className="text-[12px] text-gray-400 hover:text-gray-600 underline">Cancel</button>
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
