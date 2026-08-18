/* Pyodide interactive worker.
 *
 * Runs Python in a Web Worker so that input() can BLOCK the Python process while
 * the main thread collects a typed line — giving real, sequential, interleaved
 * input/print/input behaviour (a true console), which Piston's batch sandbox
 * cannot do.
 *
 * Blocking works via a SharedArrayBuffer: when Python calls input(), the worker
 * thread parks on Atomics.wait until the main thread writes the typed text and
 * notifies. The worker event loop is blocked during the wait, so input is
 * delivered through shared memory (not postMessage, which the parked worker
 * could not receive).
 *
 * SharedArrayBuffer layout:
 *   control = Int32Array(sab, 0, 4)
 *     [0] handshake: 0 = worker waiting, 1 = input ready, 2 = cancel/EOF
 *     [1] byte length of the input line in `data`
 *   data    = Uint8Array(sab, 16)   ← the UTF-8 encoded input line
 */

const PYODIDE_VERSION = "v0.25.0"
let pyodide = null
let control = null
let data = null

self.onmessage = async (e) => {
  const msg = e.data || {}

  if (msg.type === "init") {
    control = new Int32Array(msg.sab, 0, 4)
    data = new Uint8Array(msg.sab, 16)
    try {
      importScripts(`https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`)
      pyodide = await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/` })
      self.postMessage({ type: "ready" })
    } catch (err) {
      self.postMessage({ type: "fatal", error: String((err && err.message) || err) })
    }
    return
  }

  if (msg.type === "run") {
    await runCode(msg.code, msg.files || [])
    return
  }
}

// Recursively delete a path in Pyodide's MEMFS (best-effort).
function rmrf(path) {
  try {
    const stat = pyodide.FS.stat(path)
    if (pyodide.FS.isDir(stat.mode)) {
      const entries = pyodide.FS.readdir(path).filter(function (n) { return n !== "." && n !== ".." })
      for (var i = 0; i < entries.length; i++) rmrf(path + "/" + entries[i])
      pyodide.FS.rmdir(path)
    } else {
      pyodide.FS.unlink(path)
    }
  } catch (e) { /* ignore */ }
}

// Write the WHOLE project into a fresh /home/pyodide/project directory and put
// it on sys.path so cross-file imports (e.g. `from gf.main2 import hello`) work.
const PROJECT_ROOT = "/home/pyodide/project"
function syncProjectFiles(files) {
  rmrf(PROJECT_ROOT)
  try { pyodide.FS.mkdirTree(PROJECT_ROOT) } catch (e) {}
  for (var i = 0; i < files.length; i++) {
    var f = files[i]
    var rel = String(f.path || "").replace(/^\/+/, "")
    if (!rel) continue
    var full = PROJECT_ROOT + "/" + rel
    var dir = full.slice(0, full.lastIndexOf("/"))
    try { pyodide.FS.mkdirTree(dir) } catch (e) {}
    try { pyodide.FS.writeFile(full, String(f.content || "")) } catch (e) {}
  }
}

// Synchronously block the worker until the main thread supplies an input line.
function blockingInput(prompt) {
  // Reset the handshake BEFORE announcing, so a fast main thread can only ever
  // move it 0 -> 1 after we have armed it (no lost signal).
  Atomics.store(control, 0, 0)
  self.postMessage({ type: "input", prompt: prompt == null ? "" : String(prompt) })
  Atomics.wait(control, 0, 0)
  const status = Atomics.load(control, 0)
  if (status === 2) {
    // Cancelled / stop requested — surface as a Python KeyboardInterrupt.
    const err = new Error("__INTERRUPT__")
    throw err
  }
  const len = Atomics.load(control, 1)
  const bytes = data.slice(0, len)
  return new TextDecoder().decode(bytes)
}

async function runCode(code, files) {
  try {
    pyodide.setStdout({ batched: (s) => self.postMessage({ type: "stdout", text: s }) })
    pyodide.setStderr({ batched: (s) => self.postMessage({ type: "stderr", text: s }) })

    // Make every project file available on disk and put the project root on
    // sys.path so `from utils.helper import foo` resolves like a real Python
    // project — and ALSO add each immediate subfolder (e.g. /home/pyodide/project
    // is on sys.path so `import gf.main2` works; if the student imports
    // `main2` directly, importing from a folder needs that folder on path too).
    syncProjectFiles(files || [])
    pyodide.globals.set("__js_blocking_input", blockingInput)
    await pyodide.runPythonAsync(
      [
        "import os, sys, builtins",
        "os.chdir('" + PROJECT_ROOT + "')",
        "if '" + PROJECT_ROOT + "' not in sys.path:",
        "    sys.path.insert(0, '" + PROJECT_ROOT + "')",
        "def __interactive_input(prompt=''):",
        "    res = __js_blocking_input(prompt)",
        "    if res is None:",
        "        raise EOFError('No input provided')",
        "    return res",
        "builtins.input = __interactive_input",
      ].join("\n"),
    )

    await pyodide.runPythonAsync(code)
    self.postMessage({ type: "done" })
  } catch (err) {
    const m = String((err && err.message) || err)
    if (m.indexOf("__INTERRUPT__") !== -1) {
      self.postMessage({ type: "done", error: "Execution stopped." })
    } else {
      self.postMessage({ type: "done", error: m })
    }
  }
}
