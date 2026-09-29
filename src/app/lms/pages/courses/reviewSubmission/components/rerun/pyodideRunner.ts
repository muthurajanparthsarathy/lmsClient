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
}

// Each project file written to Pyodide's filesystem before running so multi-file
// imports work (e.g. `from utils.helper import foo`).
export interface PyFile {
  path: string
  content: string
}

// A file created by the program. Text is sent as UTF-8, anything else base64.
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
  // Written before `files` (a project file with the same path wins): files an
  // earlier run created, so the program can read them back.
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
  let killTimer: ReturnType<typeof setTimeout> | null = null

  const terminate = () => {
    if (killTimer) { clearTimeout(killTimer); killTimer = null }
    worker.terminate()
  }
  // Kill the worker after `ms` unless its "done" arrives first. If the run is
  // still open by then, end it with `timeoutError`.
  const killAfter = (ms: number, timeoutError?: string) => {
    if (killTimer) clearTimeout(killTimer)
    killTimer = setTimeout(() => {
      killTimer = null
      if (!finished && timeoutError) { finished = true; cb.onDone(timeoutError) }
      worker.terminate()
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
    Atomics.store(control, 0, 2) // cancel a pending input()
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
      case "files": cb.onFiles?.(m.files || [], m.skipped || []); break
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
  return { mode: "worker", provideInput, stop }
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

// Same recursive cleanup + project-write logic as the worker, on the main-thread
// Pyodide instance. `preload` goes in first so a project file with the same
// path wins.
function syncProjectFilesMain(pyodide: any, files: PyFile[], preload: OutputFile[]) {
  const rmrf = (path: string) => {
    try {
      const stat = pyodide.FS.stat(path)
      if (pyodide.FS.isDir(stat.mode)) {
        const entries: string[] = pyodide.FS.readdir(path).filter((n: string) => n !== "." && n !== "..")
        entries.forEach((e) => rmrf(path + "/" + e))
        pyodide.FS.rmdir(path)
      } else pyodide.FS.unlink(path)
    } catch { /* ignore */ }
  }
  const writeTree = (list: Array<PyFile | OutputFile>) => {
    for (const f of list) {
      const rel = String(f.path || "").replace(/^\/+/, "")
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
  writeTree(preload)
  writeTree(files)
}

// Same as collectOutputFiles in the worker: every non-project file under the
// project root.
function collectOutputFilesMain(pyodide: any, projectFiles: PyFile[]) {
  const own = new Set(projectFiles.map((f) => String(f.path || "").replace(/^\/+/, "")))
  const files: OutputFile[] = []
  const skipped: SkippedOutputFile[] = []
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  const walk = (dir: string, rel: string) => {
    let names: string[]
    try { names = pyodide.FS.readdir(dir) } catch { return }
    for (const n of [...names].sort()) {
      if (n === "." || n === ".." || n === "__pycache__") continue
      const full = dir + "/" + n
      const r = rel ? rel + "/" + n : n
      let st: any
      try { st = pyodide.FS.stat(full) } catch { continue }
      if (pyodide.FS.isDir(st.mode)) { walk(full, r); continue }
      if (!pyodide.FS.isFile(st.mode) || own.has(r)) continue
      if (st.size > MAX_OUTPUT_BYTES) { skipped.push({ path: r, reason: "larger than 1 MB" }); continue }
      if (files.length >= MAX_OUTPUT_FILES) { skipped.push({ path: r, reason: `more than ${MAX_OUTPUT_FILES} files` }); continue }
      let bytes: Uint8Array
      try { bytes = pyodide.FS.readFile(full) } catch { continue }
      try {
        files.push({ path: r, content: utf8.decode(bytes), encoding: "utf8", size: bytes.length })
      } catch {
        files.push({ path: r, content: bytesToBase64(bytes), encoding: "base64", size: bytes.length })
      }
    }
  }
  walk(PROJECT_ROOT, "")
  return { files, skipped }
}

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
  try {
    const pyodide = await getMainPyodide()
    cb.onReady?.("prompt")
    pyodide.setStdout({ batched: (s: string) => cb.onStdout(s) })
    pyodide.setStderr({ batched: (s: string) => cb.onStderr(s) })

    syncProjectFilesMain(pyodide, files, options.preloadFiles || [])

    pyodide.globals.set("__js_prompt_input", (prompt: string) => {
      if (stopped) throw new Error("__INTERRUPT__")
      const v = window.prompt(prompt && prompt.trim() ? prompt : "Program input:")
      if (v === null) throw new Error("__INTERRUPT__")
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
        "    return __js_prompt_input(prompt)",
        "builtins.input = __pi",
      ].join("\n"),
    )
    await pyodide.runPythonAsync(openSetupSource(!!options.autoCreateOnRead))

    // Files written before an error or Stop are real output too.
    const reportFiles = () => {
      if (!options.collectOutputs) return
      try {
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
        cb.onDone(m.indexOf("__INTERRUPT__") !== -1 ? "Execution stopped." : m)
      })
  } catch (e: any) {
    cb.onDone(`Could not start Python: ${e?.message || e}`)
  }

  return {
    mode: "prompt",
    provideInput: () => { /* not used in prompt mode */ },
    stop: () => { stopped = true },
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
