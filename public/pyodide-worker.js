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
 *         (2 sticks: every later input() raises KeyboardInterrupt too)
 *     [1] byte length of the input line in `data`
 *     [2] Pyodide interrupt buffer: the main thread writes 2 (SIGINT) to raise
 *         KeyboardInterrupt in running Python, so Stop can end a busy loop
 *         and still let the worker report the files the program wrote
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
      pyodide.setInterruptBuffer(new Int32Array(msg.sab, 8, 1))
      self.postMessage({ type: "ready" })
    } catch (err) {
      self.postMessage({ type: "fatal", error: String((err && err.message) || err) })
    }
    return
  }

  if (msg.type === "run") {
    await runCode(msg.code, msg.files || [], msg.options || {})
    return
  }
}

// Recursively delete a path in Pyodide's MEMFS (best-effort). lstat, so a
// symlink the program made is removed rather than followed.
function rmrf(path) {
  try {
    const stat = pyodide.FS.lstat(path)
    if (pyodide.FS.isDir(stat.mode)) {
      const entries = pyodide.FS.readdir(path).filter(function (n) { return n !== "." && n !== ".." })
      for (var i = 0; i < entries.length; i++) rmrf(path + "/" + entries[i])
      pyodide.FS.rmdir(path)
    } else {
      pyodide.FS.unlink(path)
    }
  } catch (e) { /* ignore */ }
}

const relPath = (p) => String(p || "").replace(/^\/+/, "")

// Write the WHOLE project into a fresh /home/pyodide/project directory and put
// it on sys.path so cross-file imports (e.g. `from gf.main2 import hello`) work.
// `preload` (files an earlier run created, saved on the server) goes in first,
// minus any that clash with a project path, so the project always wins.
const PROJECT_ROOT = "/home/pyodide/project"
function writeTree(files) {
  for (var i = 0; i < files.length; i++) {
    var f = files[i]
    var rel = relPath(f.path)
    if (!rel) continue
    var full = PROJECT_ROOT + "/" + rel
    var dir = full.slice(0, full.lastIndexOf("/"))
    try { pyodide.FS.mkdirTree(dir) } catch (e) {}
    try {
      pyodide.FS.writeFile(full, f.encoding === "base64" ? base64ToBytes(f.content) : String(f.content || ""))
    } catch (e) {}
  }
}
// Drop saved files at a project file's path, at one of its folders, or under
// a path that is a project file ("data" vs "data/x.txt").
function withoutClashes(preload, files) {
  const own = new Set()
  const ownDirs = new Set()
  for (var i = 0; i < files.length; i++) {
    var parts = relPath(files[i].path).split("/")
    own.add(parts.join("/"))
    for (var j = 1; j < parts.length; j++) ownDirs.add(parts.slice(0, j).join("/"))
  }
  return preload.filter(function (f) {
    var parts = relPath(f.path).split("/")
    var p = parts.join("/")
    if (!p || own.has(p) || ownDirs.has(p)) return false
    for (var j = 1; j < parts.length; j++) if (own.has(parts.slice(0, j).join("/"))) return false
    return true
  })
}
function syncProjectFiles(files, preload) {
  rmrf(PROJECT_ROOT)
  try { pyodide.FS.mkdirTree(PROJECT_ROOT) } catch (e) {}
  writeTree(withoutClashes(preload || [], files))
  writeTree(files)
}

function base64ToBytes(b64) {
  const bin = atob(String(b64 || ""))
  const bytes = new Uint8Array(bin.length)
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
function bytesToBase64(bytes) {
  var bin = ""
  for (var i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// Every file under the project root that is not one of the editor's own files:
// what the program created (plus preloaded files it kept). Plain text travels
// as UTF-8, anything else (including text with control characters, which JSON
// would blow up six-fold) as base64. Symlinks are not followed. A project file
// the program changed is reported as skipped — every Run starts from the
// editor's copy. Keep the limits in step with pyodideRunner.ts and
// server/services/codeFileStore.js.
const MAX_OUTPUT_FILES = 100
const MAX_OUTPUT_BYTES = 1024 * 1024
const MAX_OUTPUT_TOTAL = 5 * 1024 * 1024
const MAX_OUTPUT_DEPTH = 10
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
function collectOutputFiles(projectFiles) {
  const own = new Map()
  for (var i = 0; i < projectFiles.length; i++) own.set(relPath(projectFiles[i].path), String(projectFiles[i].content || ""))
  const files = []
  const skipped = []
  let total = 0
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  function walk(dir, rel, depth) {
    var names
    try { names = pyodide.FS.readdir(dir) } catch (e) { return }
    names.sort()
    for (var i = 0; i < names.length; i++) {
      var n = names[i]
      if (n === "." || n === ".." || n === "__pycache__") continue
      var full = dir + "/" + n
      var r = rel ? rel + "/" + n : n
      var st
      try { st = pyodide.FS.lstat(full) } catch (e) { continue }
      if (pyodide.FS.isLink(st.mode)) { skipped.push({ path: r, reason: "a link, not a file" }); continue }
      if (pyodide.FS.isDir(st.mode)) {
        if (depth >= MAX_OUTPUT_DEPTH) skipped.push({ path: r, reason: "folders nested too deep" })
        else walk(full, r, depth + 1)
        continue
      }
      if (!pyodide.FS.isFile(st.mode)) continue
      var bytes
      if (own.has(r)) {
        try { bytes = pyodide.FS.readFile(full) } catch (e) { continue }
        if (new TextDecoder().decode(bytes) !== own.get(r)) {
          skipped.push({ path: r, reason: "a project file — the program's changes are not kept; every Run starts from the editor's copy" })
        }
        continue
      }
      if (st.size > MAX_OUTPUT_BYTES) { skipped.push({ path: r, reason: "larger than 1 MB" }); continue }
      if (files.length >= MAX_OUTPUT_FILES) { skipped.push({ path: r, reason: "more than " + MAX_OUTPUT_FILES + " files" }); continue }
      if (total + st.size > MAX_OUTPUT_TOTAL) { skipped.push({ path: r, reason: "over the 5 MB limit for one question" }); continue }
      try { bytes = pyodide.FS.readFile(full) } catch (e) { continue }
      total += bytes.length
      var text = null
      try { text = utf8.decode(bytes) } catch (e) { /* not UTF-8 */ }
      if (text !== null && !CONTROL_CHARS.test(text)) {
        files.push({ path: r, content: text, encoding: "utf8", size: bytes.length })
      } else {
        files.push({ path: r, content: bytesToBase64(bytes), encoding: "base64", size: bytes.length })
      }
    }
  }
  walk(PROJECT_ROOT, "", 1)
  return { files: files, skipped: skipped }
}

// Flush every open file object before the files are read back: a program that
// never closed its file (`f = open(...); f.write(...)`) would otherwise lose
// what is still buffered — real Python flushes these when it exits.
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

// Python run before the student's code. Installs input() and, when asked,
// an open() that creates a missing file (empty) inside the project instead of
// raising FileNotFoundError. io.open is patched too because pathlib uses it.
// Only the student's own calls auto-create — the main file ("<exec>", or
// "<student>" under the Visualizer's tracer), a project module, or pathlib
// called from one of those; Python's own lookups (e.g. traceback reading
// source lines) keep the normal error.
// Stop while waiting for input raises a real KeyboardInterrupt (like Ctrl+C),
// which `except Exception` does not swallow.
function preludeSource(autoCreateOnRead) {
  return [
    "import os, sys, builtins, io",
    "os.chdir('" + PROJECT_ROOT + "')",
    "if '" + PROJECT_ROOT + "' not in sys.path:",
    "    sys.path.insert(0, '" + PROJECT_ROOT + "')",
    "def __interactive_input(prompt=''):",
    "    res = __js_blocking_input(prompt)",
    "    if res is None:",
    "        raise KeyboardInterrupt",
    "    return res",
    "builtins.input = __interactive_input",
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
    "__lms_setup_open('" + PROJECT_ROOT + "', " + (autoCreateOnRead ? "True" : "False") + ")",
    "del __lms_setup_open",
  ].join("\n")
}

// Synchronously block the worker until the main thread supplies an input line.
// Returns null when Stop cancelled the run (Python then raises
// KeyboardInterrupt).
function blockingInput(prompt) {
  // Arm the handshake (-> 0) BEFORE announcing, so a fast main thread can only
  // ever move it 0 -> 1 after we have armed it (no lost signal) — unless Stop
  // already cancelled: that must stick, or a program that caught the first
  // interrupt would park here with nobody left to wake it.
  for (;;) {
    const cur = Atomics.load(control, 0)
    if (cur === 2) return null
    if (Atomics.compareExchange(control, 0, cur, 0) === cur) break
  }
  self.postMessage({ type: "input", prompt: prompt == null ? "" : String(prompt) })
  Atomics.wait(control, 0, 0)
  if (Atomics.load(control, 0) === 2) return null
  const len = Atomics.load(control, 1)
  const bytes = data.slice(0, len)
  return new TextDecoder().decode(bytes)
}

async function runCode(code, files, options) {
  let error
  let started = false
  try {
    pyodide.setStdout({ batched: (s) => self.postMessage({ type: "stdout", text: s }) })
    pyodide.setStderr({ batched: (s) => self.postMessage({ type: "stderr", text: s }) })

    // Make every project file available on disk and put the project root on
    // sys.path so `from utils.helper import foo` resolves like a real Python
    // project.
    syncProjectFiles(files || [], options.preloadFiles)
    started = true
    pyodide.globals.set("__js_blocking_input", blockingInput)
    await pyodide.runPythonAsync(preludeSource(!!options.autoCreateOnRead))

    await pyodide.runPythonAsync(code)
  } catch (err) {
    const m = String((err && err.message) || err)
    const stopped = m.indexOf("__INTERRUPT__") !== -1 || (Atomics.load(control, 0) === 2 && /KeyboardInterrupt/.test(m))
    error = stopped ? "Execution stopped." : m
  }
  // Report what the program left on disk — also after an error or Stop, since
  // anything written before that point is real output.
  if (started && options.collectOutputs) {
    try {
      Atomics.store(control, 2, 0) // a pending Stop must not interrupt the flush
      try { pyodide.runPython(FLUSH_SOURCE) } catch (e) { /* best-effort */ }
      const out = collectOutputFiles(files || [])
      self.postMessage({ type: "files", files: out.files, skipped: out.skipped })
    } catch (e) { /* never block "done" on this */ }
  }
  self.postMessage({ type: "done", error: error })
}
