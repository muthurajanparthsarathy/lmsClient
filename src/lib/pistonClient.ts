// Piston execution client — multi-file aware.
//
// Replaces the old code-server "run inside the container" model. Every run ships
// the WHOLE project to Piston in one request: the entry-point file is sent first
// (Piston compiles/executes files[0]), and every other file is included with its
// path preserved so cross-file imports resolve. Batch model — one shot, returns
// final stdout/stderr. No live stepping (see pythonTracer for the visualizer).

import {
  LANGUAGE_CONFIG,
  detectLanguageFromFilename,
  type SupportedLanguage,
} from "@/lib/codeLanguages"

// Piston runs are proxied through our own server (server/routes/executionRoutes.js)
// so every call is auth-gated, per-user rate-limited, and shares the same
// runtime pins the codeJudge uses. The response shape is preserved 1-for-1
// with what Piston returns natively, so nothing else in this file needs
// to change beyond the URL. The old direct-to-Piston env var still wins if
// set — useful for local dev that wants to bypass auth.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com"
export const PISTON_API_URL =
  process.env.NEXT_PUBLIC_PISTON_URL || `${API_BASE}/api/run/piston`

// Pinned Piston runtimes (same versions the single-file editor uses).
const PISTON_RUNTIME: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  go: { language: "go", version: "1.16.2" },
}

export const getPistonRuntime = (lang: string) =>
  PISTON_RUNTIME[lang.toLowerCase()] || PISTON_RUNTIME.python

export interface RunFile {
  // Path relative to the project root, e.g. "/main.py" or "/utils/helpers.py".
  path: string
  content: string
  // Marks the file Piston should execute. Exactly one file should be the entry.
  isEntryPoint?: boolean
}

export interface RunResult {
  stdout: string
  stderr: string
  output: string // combined stdout + stderr, as Piston returns it
  code: number | null // process exit code
  signal: string | null
  time?: number // wall-clock ms reported by Piston (run stage)
  compileError?: string // populated when the compile stage failed
  raw?: any
}

// Java needs the filename to match the public class. Everything else keeps its
// own name. Piston accepts a path-like `name`, so nested folders round-trip.
const pistonFileName = (path: string, content: string, lang: SupportedLanguage): string => {
  const clean = path.replace(/^\/+/, "")
  if (lang === "java") {
    const m = content.match(/public\s+class\s+(\w+)/)
    if (m) {
      const dir = clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/") + 1) : ""
      return `${dir}${m[1]}.java`
    }
  }
  return clean
}

// Choose the entry file: explicit isEntryPoint wins; else the conventional main
// file for the language; else the first file that matches the language; else [0].
const pickEntryIndex = (files: RunFile[], lang: SupportedLanguage): number => {
  const explicit = files.findIndex((f) => f.isEntryPoint)
  if (explicit >= 0) return explicit
  const conventional = LANGUAGE_CONFIG[lang]?.filename?.toLowerCase()
  if (conventional) {
    const byName = files.findIndex((f) => f.path.split("/").pop()?.toLowerCase() === conventional)
    if (byName >= 0) return byName
  }
  const byLang = files.findIndex((f) => detectLanguageFromFilename(f.path) === lang)
  return byLang >= 0 ? byLang : 0
}

export interface RunOptions {
  language: SupportedLanguage
  files: RunFile[]
  stdin?: string
  signal?: AbortSignal
  // Override the executed source of the entry file (used by the tracer to run
  // instrumented code) without mutating the student's saved files.
  entryContentOverride?: string
}

export async function runOnPiston(opts: RunOptions): Promise<RunResult> {
  const { language, files, stdin = "", signal, entryContentOverride } = opts
  if (!files.length) {
    return { stdout: "", stderr: "No files to run.", output: "No files to run.", code: null, signal: null }
  }

  const runtime = getPistonRuntime(language)
  const entryIdx = pickEntryIndex(files, language)

  // Order matters: Piston executes files[0]. Put the entry file first.
  const ordered = [files[entryIdx], ...files.filter((_, i) => i !== entryIdx)]

  const pistonFiles = ordered.map((f, i) => ({
    name: pistonFileName(f.path, f.content, language),
    content: i === 0 && entryContentOverride != null ? entryContentOverride : f.content,
  }))

  const body = {
    language: runtime.language,
    version: runtime.version,
    files: pistonFiles,
    stdin,
    args: [],
    compile_timeout: 10000,
    run_timeout: 3000, // self-hosted Piston caps run_timeout at 3000
    compile_memory_limit: -1,
    run_memory_limit: -1,
  }

  // The proxy endpoint on our server enforces auth + per-user rate limits.
  // Attach the same bearer token the rest of the client uses; the direct
  // Piston fallback path (PISTON_URL points at emkc / self-hosted) just
  // ignores the header.
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("smartcliff_token")
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(PISTON_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Piston HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`)
  }

  const data = await res.json()
  const run = data.run || {}
  const compile = data.compile || null

  return {
    stdout: run.stdout ?? "",
    stderr: run.stderr ?? "",
    output: run.output ?? "",
    code: typeof run.code === "number" ? run.code : null,
    signal: run.signal ?? null,
    time: run.time,
    compileError: compile && (compile.code ? (compile.stderr || compile.output || "") : "") || undefined,
    raw: data,
  }
}
