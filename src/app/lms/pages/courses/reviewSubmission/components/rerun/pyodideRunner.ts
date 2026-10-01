// Interactive Python runner (browser-side, via Pyodide).
//
// Gives a REAL console: input() prints its prompt, the program pauses, the
// student types a line in the terminal, and the program resumes — fully
// sequential and interleaved with print(), which Piston's one-shot sandbox
// cannot do.
//
// Two engines, chosen automatically:
//   • worker mode  — Pyodide in a Web Worker + SharedArrayBuffer/Atomics. The
//                    student types directly in the terminal panel. Requires the
//                    page to be cross-origin isolated (COOP/COEP headers).
//   • prompt mode  — fallback when not isolated: Pyodide on the main thread,
//                    each input() shown as a window.prompt() dialog. Works
//                    everywhere with no special headers.

const PYODIDE_VERSION = "v0.25.0"
const PYODIDE_JS = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`
const DATA_BYTES = 1024 * 1024 // 1 MB max per input line
// After Stop, how long the worker gets to raise KeyboardInterrupt and report
// the files the program wrote before it is killed outright.
const STOP_GRACE_MS = 1500
// Keep in step with public/pyodide-worker.js and server/services/codeFileStore.js.
const MAX_OUTPUT_FILES = 100
const MAX_OUTPUT_BYTES = 1024 * 1024
const MAX_OUTPUT_TOTAL = 5 * 1024 * 1024
const MAX_OUTPUT_DEPTH = 10
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export type RunMode = "worker" | "prompt"

export interface RunCallbacks {
  onStdout: (text: string) => void
  onStderr: (text: string) => void
  // Called when the program is waiting for a line of input (worker mode only).
  onInputRequest: (prompt: string) => void
  onReady?: (mode: RunMode) => void
  onDone: (error?: string) => void
  // With `collectOutputs`: the files the program left in the project folder
  // (everything except the editor's own files). Comes before onDone, except
  // after Stop, where onDone fires at once and this may follow.
  onFiles?: (files: OutputFile[], skipped: SkippedOutputFile[]) => void
  // With `collectOutputs`: Stop had to kill the program before it could
  // report its files (it did not stop in time).
  onFilesLost?: () => void
}

// Each project file written to Pyodide's filesystem before running so multi-file
// imports work (e.g. `from utils.helper import foo`).
export interface PyFile {
  path: string
  content: string
}

// A file created by the program. Plain text is sent as UTF-8, anything else
// base64.
export interface OutputFile {
  path: string
  content: string
  encoding: "utf8" | "base64"
  size: number
}

export interface SkippedOutputFile {
  path: string
  reason: string
}

export interface InteractiveRunOptions {
  files?: PyFile[]
  // Written before `files` (a project path always wins): files an earlier run
  // created, so the program can read them back.
  preloadFiles?: OutputFile[]
  // Report the program's files through onFiles when it ends.
  collectOutputs?: boolean
  // open() in read mode on a missing file inside the project creates it empty
  // instead of raising FileNotFoundError.
  autoCreateOnRead?: boolean
}

export interface InteractiveHandle {
  mode: RunMode
  provideInput: (text: string) => void // worker mode: deliver a typed line
  stop: () => void
  // Resolves once the run is completely over — after Stop too — and any file
  // report has been delivered through onFiles.
  settled: Promise<void>
}

// True when the terminal-typing (worker) engine is usable.
export const isInteractiveTerminalSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof SharedArrayBuffer !== "undefined" &&
  (window as any).crossOriginIsolated === true

// ─── Worker engine ───────────────────────────────────────────────────────────
function runWorker(code: string, cb: RunCallbacks, files: PyFile[], options: InteractiveRunOptions): InteractiveHandle {
  const sab = new SharedArrayBuffer(16 + DATA_BYTES)
  const control = new Int32Array(sab, 0, 4)
  const data = new Uint8Array(sab, 16)
  const worker = new Worker("/pyodide-worker.js")
  let finished = false
  let runSent = false
  let filesReported = false
  let killTimer: ReturnType<typeof setTimeout> | null = null
  let settle!: () => void
  const settled = new Promise<void>((resolve) => { settle = resolve })

  const terminate = () => {
    if (killTimer) { clearTimeout(killTimer); killTimer = null }
    worker.terminate()
    settle()
  }
  // Kill the worker after `ms` unless its "done" arrives first. If the run is
  // still open by then, end it with `timeoutError`.
  const killAfter = (ms: number, timeoutError?: string) => {
    if (killTimer) clearTimeout(killTimer)
    killTimer = setTimeout(() => {
      killTimer = null
      if (!finished && timeoutError) { finished = true; cb.onDone(timeoutError) }
      if (options.collectOutputs && runSent && !filesReported) cb.onFilesLost?.()
      terminate()
    }, ms)
  }

  const provideInput = (text: string) => {
    const bytes = new TextEncoder().encode(text)
    const len = Math.min(bytes.length, data.length)
    data.set(bytes.subarray(0, len), 0)
    Atomics.store(control, 1, len)
    Atomics.store(control, 0, 1) // input ready
    Atomics.notify(control, 0)
  }

  const stop = () => {
    if (finished) return
    finished = true
    Atomics.store(control, 0, 2) // cancel a pending (and any later) input()
    Atomics.notify(control, 0)
    if (options.collectOutputs) {
      // Interrupt running Python (SIGINT) so the worker can still report the
      // files written so far; kill it if it does not finish in time.
      Atomics.store(control, 2, 2)
      killAfter(STOP_GRACE_MS)
    } else {
      terminate()
    }
    cb.onDone("Execution stopped.")
  }

  worker.onmessage = (e) => {
    const m = e.data || {}
    switch (m.type) {
      case "ready":
        if (finished) break
        cb.onReady?.("worker")
        runSent = true
        worker.postMessage({
          type: "run",
          code,
          files,
          options: {
            preloadFiles: options.preloadFiles || [],
            collectOutputs: !!options.collectOutputs,
            autoCreateOnRead: !!options.autoCreateOnRead,
          },
        })
        break
      // After Stop only the file report still matters.
      case "stdout": if (!finished) cb.onStdout(m.text); break
      case "stderr": if (!finished) cb.onStderr(m.text); break
      case "input": if (!finished) cb.onInputRequest(m.prompt || ""); break
      case "files": filesReported = true; cb.onFiles?.(m.files || [], m.skipped || []); break
      case "done":
        if (!finished) { finished = true; cb.onDone(m.error) }
        terminate()
        break
      case "fatal":
        if (!finished) { finished = true; cb.onDone(m.error) }
        terminate()
        break
    }
  }
  worker.onerror = (err) => {
    const message = String(err.message || err)
    // KeyboardInterrupt (Stop) and SystemExit (exit(), sys.exit()) also escape
    // Pyodide's event loop as an uncaught error, yet the worker still ends the
    // run itself right after and reports the program's files — wait for that.
    // Only recognisable here: inside the worker the CDN-loaded Pyodide's error
    // reads just "Script error.".
    if (options.collectOutputs && /\b(KeyboardInterrupt|SystemExit)\b/.test(message)) {
      err.preventDefault()
      if (!killTimer) killAfter(STOP_GRACE_MS, `Worker error: ${message}`)
      return
    }
    if (!finished) { finished = true; cb.onDone(`Worker error: ${message}`); terminate() }
    // After Stop, the grace timer ends the worker — it may still report files.
    else if (!killTimer) terminate()
  }

  worker.postMessage({ type: "init", sab })
  return { mode: "worker", provideInput, stop, settled }
}

// ─── Prompt (main-thread) engine ─────────────────────────────────────────────
let mainPyodidePromise: Promise<any> | null = null

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-pyodide]`)) return resolve()
    const s = document.createElement("script")
    s.src = src
    s.dataset.pyodide = "1"
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Failed to load Pyodide script"))
    document.head.appendChild(s)
  })
}

async function getMainPyodide(): Promise<any> {
  if (!mainPyodidePromise) {
    mainPyodidePromise = (async () => {
      await loadScriptOnce(PYODIDE_JS)
      // @ts-ignore - global injected by the script
      return await window.loadPyodide({ indexURL: PYODIDE_INDEX })
    })()
  }
  return mainPyodidePromise
}

const PROJECT_ROOT = "/home/pyodide/project"
const relPath = (p: string) => String(p || "").replace(/^\/+/, "")

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(String(b64 || ""))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  }
  return btoa(bin)
}

// Same as withoutClashes in the worker: drop saved files at a project file's
// path, at one of its folders, or under a path that is a project file.
export function withoutClashes(preload: OutputFile[], files: PyFile[]): OutputFile[] {
  const own = new Set<string>()
  const ownDirs = new Set<string>()
  for (const f of files) {
    const parts = relPath(f.path).split("/")
    own.add(parts.join("/"))
    for (let j = 1; j < parts.length; j++) ownDirs.add(parts.slice(0, j).join("/"))
  }
  return preload.filter((f) => {
    const parts = relPath(f.path).split("/")
    const p = parts.join("/")
    if (!p || own.has(p) || ownDirs.has(p)) return false
    for (let j = 1; j < parts.length; j++) if (own.has(parts.slice(0, j).join("/"))) return false
    return true
  })
}

// Same recursive cleanup + project-write logic as the worker, on the main-thread
// Pyodide instance. `preload` goes in first, minus clashes, so the project wins.
function syncProjectFilesMain(pyodide: any, files: PyFile[], preload: OutputFile[]) {
  const rmrf = (path: string) => {
    try {
      const stat = pyodide.FS.lstat(path)
      if (pyodide.FS.isDir(stat.mode)) {
        const entries: string[] = pyodide.FS.readdir(path).filter((n: string) => n !== "." && n !== "..")
        entries.forEach((e) => rmrf(path + "/" + e))
        pyodide.FS.rmdir(path)
      } else pyodide.FS.unlink(path)
    } catch { /* ignore */ }
  }
  const writeTree = (list: Array<PyFile | OutputFile>) => {
    for (const f of list) {
      const rel = relPath(f.path)
      if (!rel) continue
      const full = PROJECT_ROOT + "/" + rel
      const dir = full.slice(0, full.lastIndexOf("/"))
      try { pyodide.FS.mkdirTree(dir) } catch { /* ignore */ }
      try {
        const base64 = "encoding" in f && f.encoding === "base64"
        pyodide.FS.writeFile(full, base64 ? base64ToBytes(f.content) : String(f.content || ""))
      } catch { /* ignore */ }
    }
  }
  rmrf(PROJECT_ROOT)
  try { pyodide.FS.mkdirTree(PROJECT_ROOT) } catch { /* ignore */ }
  writeTree(withoutClashes(preload, files))
  writeTree(files)
}

// Same as collectOutputFiles in the worker.
function collectOutputFilesMain(pyodide: any, projectFiles: PyFile[]) {
  const own = new Map(projectFiles.map((f) => [relPath(f.path), String(f.content || "")]))
  const files: OutputFile[] = []
  const skipped: SkippedOutputFile[] = []
  let total = 0
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  const walk = (dir: string, rel: string, depth: number) => {
    let names: string[]
    try { names = pyodide.FS.readdir(dir) } catch { return }
    for (const n of [...names].sort()) {
      if (n === "." || n === ".." || n === "__pycache__") continue
      const full = dir + "/" + n
      const r = rel ? rel + "/" + n : n
      let st: any
      try { st = pyodide.FS.lstat(full) } catch { continue }
      if (pyodide.FS.isLink(st.mode)) { skipped.push({ path: r, reason: "a link, not a file" }); continue }
      if (pyodide.FS.isDir(st.mode)) {
        if (depth >= MAX_OUTPUT_DEPTH) skipped.push({ path: r, reason: "folders nested too deep" })
        else walk(full, r, depth + 1)
        continue
      }
      if (!pyodide.FS.isFile(st.mode)) continue
      let bytes: Uint8Array
      if (own.has(r)) {
        try { bytes = pyodide.FS.readFile(full) } catch { continue }
        if (new TextDecoder().decode(bytes) !== own.get(r)) {
          skipped.push({ path: r, reason: "a project file — the program's changes are not kept; every Run starts from the editor's copy" })
        }
        continue
      }
      if (st.size > MAX_OUTPUT_BYTES) { skipped.push({ path: r, reason: "larger than 1 MB" }); continue }
      if (files.length >= MAX_OUTPUT_FILES) { skipped.push({ path: r, reason: `more than ${MAX_OUTPUT_FILES} files` }); continue }
      if (total + st.size > MAX_OUTPUT_TOTAL) { skipped.push({ path: r, reason: "over the 5 MB limit for one question" }); continue }
      try { bytes = pyodide.FS.readFile(full) } catch { continue }
      total += bytes.length
      let text: string | null = null
      try { text = utf8.decode(bytes) } catch { /* not UTF-8 */ }
      if (text !== null && !CONTROL_CHARS.test(text)) {
        files.push({ path: r, content: text, encoding: "utf8", size: bytes.length })
      } else {
        files.push({ path: r, content: bytesToBase64(bytes), encoding: "base64", size: bytes.length })
      }
    }
  }
  walk(PROJECT_ROOT, "", 1)
  return { files, skipped }
}

// Same as FLUSH_SOURCE in the worker: flush open file objects so buffered
// writes reach the file system before it is read back.
const FLUSH_SOURCE = [
  "def __lms_flush_files():",
  "    import gc, io, sys",
  "    std = (sys.stdin, sys.stdout, sys.stderr, sys.__stdin__, sys.__stdout__, sys.__stderr__)",
  "    for o in gc.get_objects():",
  "        try:",
  "            if isinstance(o, io.IOBase) and not any(o is s for s in std) and not o.closed:",
  "                o.flush()",
  "        except Exception:",
  "            pass",
  "__lms_flush_files()",
  "del __lms_flush_files",
].join("\n")

// open() setup shared by every run on the long-lived main-thread instance: the
// real open is kept once, so a run without autoCreateOnRead (e.g. staff review)
// gets it back after a run that patched it. Mirrors preludeSource in the worker,
// including the rule that only the student's own calls auto-create.
const openSetupSource = (autoCreateOnRead: boolean) =>
  [
    "import os, sys, builtins, io",
    "def __lms_setup_open(root, auto_create):",
    "    real = getattr(builtins, '_lms_real_open', None)",
    "    if real is None:",
    "        real = builtins.open",
    "        builtins._lms_real_open = real",
    "    if not auto_create:",
    "        builtins.open = io.open = real",
    "        return",
    "    def from_student(frame):",
    "        while frame is not None and frame.f_code.co_filename.endswith('/pathlib.py'):",
    "            frame = frame.f_back",
    "        name = frame.f_code.co_filename if frame is not None else ''",
    "        return name in ('<exec>', '<student>') or name.startswith(root + os.sep)",
    "    def open(file, mode='r', *args, **kwargs):",
    "        if isinstance(file, (str, bytes, os.PathLike)) and not any(c in str(mode) for c in 'wax') \\",
    "                and from_student(sys._getframe(1)):",
    "            try:",
    "                p = os.path.abspath(os.fsdecode(file))",
    "                if p.startswith(root + os.sep) and not os.path.exists(p):",
    "                    os.makedirs(os.path.dirname(p), exist_ok=True)",
    "                    real(p, 'w').close()",
    "            except Exception:",
    "                pass",
    "        return real(file, mode, *args, **kwargs)",
    "    open.__doc__ = real.__doc__",
    "    builtins.open = io.open = open",
    `__lms_setup_open('${PROJECT_ROOT}', ${autoCreateOnRead ? "True" : "False"})`,
    "del __lms_setup_open",
  ].join("\n")

async function runPrompt(code: string, cb: RunCallbacks, files: PyFile[], options: InteractiveRunOptions): Promise<InteractiveHandle> {
  let stopped = false
  let cancelled = false
  let settle!: () => void
  const settled = new Promise<void>((resolve) => { settle = resolve })
  try {
    const pyodide = await getMainPyodide()
    cb.onReady?.("prompt")
    pyodide.setStdout({ batched: (s: string) => cb.onStdout(s) })
    pyodide.setStderr({ batched: (s: string) => cb.onStderr(s) })

    syncProjectFilesMain(pyodide, files, options.preloadFiles || [])

    // null = Stop or Cancel: Python raises KeyboardInterrupt, like Ctrl+C, so
    // `except Exception` in the program cannot swallow it.
    pyodide.globals.set("__js_prompt_input", (prompt: string) => {
      if (stopped) return null
      const v = window.prompt(prompt && prompt.trim() ? prompt : "Program input:")
      if (v === null) { cancelled = true; return null }
      // Echo prompt + typed value to the terminal so the transcript reads naturally.
      cb.onStdout(`${prompt || ""}${v}`)
      return v
    })

    await pyodide.runPythonAsync(
      [
        "import os, sys, builtins",
        `os.chdir('${PROJECT_ROOT}')`,
        `if '${PROJECT_ROOT}' not in sys.path: sys.path.insert(0, '${PROJECT_ROOT}')`,
        "def __pi(prompt=''):",
        "    res = __js_prompt_input(prompt)",
        "    if res is None:",
        "        raise KeyboardInterrupt",
        "    return res",
        "builtins.input = __pi",
      ].join("\n"),
    )
    await pyodide.runPythonAsync(openSetupSource(!!options.autoCreateOnRead))

    // Files written before an error or Stop are real output too.
    const reportFiles = () => {
      if (!options.collectOutputs) return
      try {
        try { pyodide.runPython(FLUSH_SOURCE) } catch { /* best-effort */ }
        const out = collectOutputFilesMain(pyodide, files)
        cb.onFiles?.(out.files, out.skipped)
      } catch { /* never block onDone on this */ }
    }

    pyodide
      .runPythonAsync(code)
      .then(() => { reportFiles(); if (!stopped) cb.onDone() })
      .catch((e: any) => {
        reportFiles()
        const m = String((e && e.message) || e)
        const interrupted = m.indexOf("__INTERRUPT__") !== -1 || ((stopped || cancelled) && /KeyboardInterrupt/.test(m))
        cb.onDone(interrupted ? "Execution stopped." : m)
      })
      .finally(settle)
  } catch (e: any) {
    cb.onDone(`Could not start Python: ${e?.message || e}`)
    settle()
  }

  return {
    mode: "prompt",
    provideInput: () => { /* not used in prompt mode */ },
    stop: () => { stopped = true },
    settled,
  }
}

// ─── Public entry ────────────────────────────────────────────────────────────
export async function runInteractivePython(
  code: string,
  cb: RunCallbacks,
  options: InteractiveRunOptions = {},
): Promise<InteractiveHandle> {
  const files = options.files || []
  if (isInteractiveTerminalSupported()) {
    try { return runWorker(code, cb, files, options) }
    catch { /* fall through to prompt mode on worker construction failure */ }
  }
  return runPrompt(code, cb, files, options)
}
