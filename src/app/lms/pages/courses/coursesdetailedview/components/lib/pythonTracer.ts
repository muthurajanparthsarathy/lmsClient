// Python execution tracer — the PythonTutor-style visualizer engine.
//
// The instrumented program is run on the Pyodide INTERACTIVE engine (a Web
// Worker), so it behaves exactly like pythontutor.com:
//   • Every executed line/call/return/exception is emitted as ONE streamed JSON
//     line (prefixed with @@PTSTEP@@) the instant it happens.
//   • When the program reaches input(), the worker BLOCKS — the visualizer asks
//     the student for that value, then execution (and the step stream) resumes.
//     So inputs are collected as you step, not all up front.
//   • At the end a @@PTEND@@ line carries the truncated flag.
//
// The frontend grows the step array live and lets you step through it (green
// arrow = line just executed, red arrow = next line to execute).
//
// The trace schema is intentionally language-agnostic (see TraceStep): a future
// JS/Java/C++/Go tracer can emit the same shape and reuse the whole UI.

// ─── Normalized trace schema (shared across all languages) ──────────────────

export type TraceValue =
  | { kind: "prim"; type: string; value: string }
  | { kind: "ref"; id: string }

export interface HeapObject {
  type: "list" | "tuple" | "set" | "dict" | "instance" | "function" | "module" | "object"
  elements?: TraceValue[]
  entries?: [TraceValue, TraceValue][]
  attrs?: Record<string, TraceValue>
  className?: string
  name?: string
  repr?: string
  n?: number
}

export interface TraceFrame {
  name: string
  line: number
  locals: Record<string, TraceValue>
  isGlobal?: boolean
}

export interface TraceStep {
  step: number
  event: "line" | "call" | "return" | "exception"
  line: number
  function: string
  stackDepth: number
  stack: TraceFrame[]
  heap: Record<string, HeapObject>
  stdout: string
  returnValue?: TraceValue
  exception?: { type: string; message: string }
}

export interface ExecutionTrace {
  version: number
  language: string
  steps: TraceStep[]
  truncated: boolean
  stdout: string
}

// Streamed-line markers.
export const STREAM_STEP = "@@PTSTEP@@"
export const STREAM_END = "@@PTEND@@"

// ─── The Python instrumentation harness ─────────────────────────────────────
const PY_HARNESS = String.raw`
import sys, json, base64, types
from io import StringIO

USER_SRC = base64.b64decode("__B64_SOURCE__").decode("utf-8")
FILENAME = "<student>"
MAX_STEPS = 1000
MAX_STRING = 200
MAX_ELEMS = 100

_real_stdout = sys.stdout
_cap = StringIO()
_nsteps = [0]

def _emit(line):
    _real_stdout.write(line + "\n")
    try:
        _real_stdout.flush()
    except Exception:
        pass

def _trunc(s):
    if len(s) > MAX_STRING:
        return s[:MAX_STRING] + "...(+%d chars)" % (len(s) - MAX_STRING)
    return s

def _is_prim(v):
    return v is None or isinstance(v, (int, float, bool, str))

def _prim(v):
    if v is None:
        return {"kind": "prim", "type": "NoneType", "value": "None"}
    if isinstance(v, bool):
        return {"kind": "prim", "type": "bool", "value": str(v)}
    if isinstance(v, str):
        return {"kind": "prim", "type": "str", "value": _trunc(v)}
    return {"kind": "prim", "type": type(v).__name__, "value": repr(v)}

def _encode(v, heap):
    if _is_prim(v):
        return _prim(v)
    key = str(id(v))
    if key not in heap:
        heap[key] = {"type": "object", "className": "...", "repr": "..."}
        heap[key] = _encode_obj(v, heap)
    return {"kind": "ref", "id": key}

def _encode_obj(v, heap):
    if isinstance(v, list):
        return {"type": "list", "n": len(v), "elements": [_encode(x, heap) for x in v[:MAX_ELEMS]]}
    if isinstance(v, tuple):
        return {"type": "tuple", "n": len(v), "elements": [_encode(x, heap) for x in v[:MAX_ELEMS]]}
    if isinstance(v, (set, frozenset)):
        return {"type": "set", "n": len(v), "elements": [_encode(x, heap) for x in list(v)[:MAX_ELEMS]]}
    if isinstance(v, dict):
        ents = []
        for k, val in list(v.items())[:MAX_ELEMS]:
            ents.append([_encode(k, heap), _encode(val, heap)])
        return {"type": "dict", "n": len(v), "entries": ents}
    if isinstance(v, types.ModuleType):
        return {"type": "module", "name": getattr(v, "__name__", "module")}
    if isinstance(v, (types.FunctionType, types.BuiltinFunctionType, types.LambdaType)):
        return {"type": "function", "name": getattr(v, "__name__", "<lambda>")}
    if hasattr(v, "__dict__"):
        attrs = {}
        for k, val in list(vars(v).items())[:MAX_ELEMS]:
            attrs[k] = _encode(val, heap)
        return {"type": "instance", "className": type(v).__name__, "attrs": attrs}
    return {"type": "object", "className": type(v).__name__, "repr": _trunc(repr(v))}

def _skip(name, val, is_global):
    if name.startswith("__") and name.endswith("__"):
        return True
    if isinstance(val, types.ModuleType):
        return True
    return False

def _snapshot(frame, event, arg):
    if _nsteps[0] >= MAX_STEPS:
        return
    heap = {}
    chain = []
    fr = frame
    while fr is not None:
        if fr.f_code.co_filename == FILENAME:
            chain.append(fr)
        fr = fr.f_back
    chain.reverse()
    stack = []
    for f in chain:
        cname = f.f_code.co_name
        is_global = (cname == "<module>")
        enc = {}
        for k, v in list(f.f_locals.items()):
            if _skip(k, v, is_global):
                continue
            enc[k] = _encode(v, heap)
        stack.append({
            "name": "<module>" if is_global else cname,
            "line": f.f_lineno,
            "locals": enc,
            "isGlobal": is_global,
        })
    _nsteps[0] += 1
    rec = {
        "step": _nsteps[0],
        "event": event,
        "line": frame.f_lineno,
        "function": frame.f_code.co_name,
        "stackDepth": len(stack),
        "stack": stack,
        "heap": heap,
        "stdout": _cap.getvalue()[-8000:],
    }
    if event == "return":
        rec["returnValue"] = _encode(arg, heap)
    if event == "exception" and arg:
        et, ev, _tb = arg
        rec["exception"] = {"type": getattr(et, "__name__", str(et)), "message": _trunc(str(ev))}
    _emit("@@PTSTEP@@" + json.dumps(rec))

def _tracer(frame, event, arg):
    if frame.f_code.co_filename != FILENAME:
        return _tracer
    if event in ("line", "call", "return", "exception"):
        try:
            _snapshot(frame, event, arg)
        except Exception:
            pass
    return _tracer

# Echo "<prompt><typed value>" into the program output, like pythontutor.com,
# so the Print output box reads e.g. "Enter first number: 2". Wraps whatever
# input() the runtime installed (the blocking worker input, or the popup input).
import builtins as _bi
_orig_input = _bi.input
def _traced_input(prompt=""):
    v = _orig_input(prompt)
    try:
        _cap.write(("" if prompt is None else str(prompt)) + ("" if v is None else str(v)) + "\n")
    except Exception:
        pass
    return v
_bi.input = _traced_input

_user_globals = {"__name__": "__main__", "__builtins__": __builtins__}
sys.stdout = _cap
_compiled = compile(USER_SRC, FILENAME, "exec")
sys.settrace(_tracer)
try:
    exec(_compiled, _user_globals)
except SystemExit:
    pass
except BaseException:
    pass
finally:
    sys.settrace(None)
    sys.stdout = _real_stdout

_emit("@@PTEND@@" + json.dumps({"truncated": _nsteps[0] >= MAX_STEPS}))
`

// Base64-encode a UTF-8 string in both browser and node-ish contexts.
const toBase64 = (s: string): string => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(s)
    let bin = ""
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return window.btoa(bin)
  }
  // @ts-ignore - Buffer exists in the Node runtime
  return Buffer.from(s, "utf-8").toString("base64")
}

// Wrap student Python so that running it streams a full execution trace.
export const buildTracedPython = (userSource: string): string =>
  PY_HARNESS.replace("__B64_SOURCE__", toBase64(userSource))

// Parse a single streamed line. Returns a step, an end marker, or null.
export const parseStreamLine = (line: string):
  | { kind: "step"; step: TraceStep }
  | { kind: "end"; truncated: boolean }
  | null => {
  const trimmed = line.trim()
  if (trimmed.startsWith(STREAM_STEP)) {
    try { return { kind: "step", step: JSON.parse(trimmed.slice(STREAM_STEP.length)) as TraceStep } }
    catch { return null }
  }
  if (trimmed.startsWith(STREAM_END)) {
    try { const m = JSON.parse(trimmed.slice(STREAM_END.length) || "{}"); return { kind: "end", truncated: !!m.truncated } }
    catch { return { kind: "end", truncated: false } }
  }
  return null
}

// Short human label for a value (used in stack/heap rendering).
export const formatValue = (v: TraceValue): string =>
  v.kind === "prim" ? (v.type === "str" ? JSON.stringify(v.value) : v.value) : `→ #${v.id}`
