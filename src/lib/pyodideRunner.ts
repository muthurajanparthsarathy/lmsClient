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

export type RunMode = "worker" | "prompt"

export interface RunCallbacks {
  onStdout: (text: string) => void
  onStderr: (text: string) => void
  // Called when the program is waiting for a line of input (worker mode only).
  onInputRequest: (prompt: string) => void
  onReady?: (mode: RunMode) => void
  onDone: (error?: string) => void
}

// Each project file written to Pyodide's filesystem before running so multi-file
// imports work (e.g. `from utils.helper import foo`).
export interface PyFile {
  path: string
  content: string
}

export interface InteractiveRunOptions {
  files?: PyFile[]
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
function runWorker(code: string, cb: RunCallbacks, files: PyFile[]): InteractiveHandle {
  const sab = new SharedArrayBuffer(16 + DATA_BYTES)
  const control = new Int32Array(sab, 0, 4)
  const data = new Uint8Array(sab, 16)
  const worker = new Worker("/pyodide-worker.js")
  let finished = false

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
    Atomics.store(control, 0, 2) // cancel
    Atomics.notify(control, 0)
    worker.terminate()
    cb.onDone("Execution stopped.")
  }

  worker.onmessage = (e) => {
    const m = e.data || {}
    switch (m.type) {
      case "ready":
        cb.onReady?.("worker")
        worker.postMessage({ type: "run", code, files })
        break
      case "stdout": cb.onStdout(m.text); break
      case "stderr": cb.onStderr(m.text); break
      case "input": cb.onInputRequest(m.prompt || ""); break
      case "done":
        if (!finished) { finished = true; cb.onDone(m.error) }
        worker.terminate()
        break
      case "fatal":
        if (!finished) { finished = true; cb.onDone(m.error) }
        worker.terminate()
        break
    }
  }
  worker.onerror = (err) => {
    if (!finished) { finished = true; cb.onDone(`Worker error: ${err.message || err}`) }
    worker.terminate()
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

// Same recursive cleanup + project-write logic as the worker, on the main-thread
// Pyodide instance.
function syncProjectFilesMain(pyodide: any, files: PyFile[]) {
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
  rmrf(PROJECT_ROOT)
  try { pyodide.FS.mkdirTree(PROJECT_ROOT) } catch { /* ignore */ }
  for (const f of files) {
    const rel = String(f.path || "").replace(/^\/+/, "")
    if (!rel) continue
    const full = PROJECT_ROOT + "/" + rel
    const dir = full.slice(0, full.lastIndexOf("/"))
    try { pyodide.FS.mkdirTree(dir) } catch { /* ignore */ }
    try { pyodide.FS.writeFile(full, String(f.content || "")) } catch { /* ignore */ }
  }
}

async function runPrompt(code: string, cb: RunCallbacks, files: PyFile[]): Promise<InteractiveHandle> {
  let stopped = false
  try {
    const pyodide = await getMainPyodide()
    cb.onReady?.("prompt")
    pyodide.setStdout({ batched: (s: string) => cb.onStdout(s) })
    pyodide.setStderr({ batched: (s: string) => cb.onStderr(s) })

    syncProjectFilesMain(pyodide, files)

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

    pyodide
      .runPythonAsync(code)
      .then(() => { if (!stopped) cb.onDone() })
      .catch((e: any) => {
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
    try { return runWorker(code, cb, files) }
    catch { /* fall through to prompt mode on worker construction failure */ }
  }
  return runPrompt(code, cb, files)
}
