// Turns a traced program's output (as it streams in from the compiler service) into the
// TraceStep list the visualizer draws. Everything between @@PTS@@ … @@PTE@@
// is one step (see runtimes.ts); everything else is the program's own output.
//
// The runtimes only report the CURRENT function's variables plus a stack
// depth, so the call stack is rebuilt here: a deeper step pushes a frame, a
// shallower one pops back to its caller, which keeps the values it had when
// it made the call.

import type { HeapObject, TraceStep, TraceValue } from '@/app/lms/pages/courses/coursesdetailedview/components/lib/pythonTracer'

type RawVal = { t?: string; v?: string; r?: string; o?: RawObj }
type RawObj = { k: string; n?: number; e?: RawVal[]; m?: [RawVal, RawVal][]; c?: string; a?: [string, RawVal][]; s?: string }
type RawStep = { l: number; f: string; d: number; v: [string, RawVal][] }
type Frame = { d: number; name: string; line: number; locals: Record<string, TraceValue>; heap: Record<string, HeapObject> }

const START = '@@PTS@@'
const END = '@@PTE@@'
const LIMIT = '@@PTX@@'
const GLOBAL_NAMES = new Set(['<global>', '<main>'])

export class TraceStream {
    steps: TraceStep[] = []
    stdout = ''
    truncated = false
    private buf = ''
    private frames: Frame[] = []
    private known: Record<string, HeapObject> = {}

    /** Feed a chunk of program output; returns how many steps it added. */
    feed(text: string): number {
        this.buf += text
        let added = 0
        for (;;) {
            const at = this.buf.indexOf('@@PT')
            if (at === -1) {
                // Keep a possible half-marker ("@@P") for the next chunk.
                const keep = partialMarker(this.buf)
                this.stdout += this.buf.slice(0, this.buf.length - keep)
                this.buf = this.buf.slice(this.buf.length - keep)
                break
            }
            this.stdout += this.buf.slice(0, at)
            this.buf = this.buf.slice(at)
            if (this.buf.length < START.length) break
            if (this.buf.startsWith(LIMIT)) { this.truncated = true; this.buf = this.buf.slice(LIMIT.length); continue }
            if (this.buf.startsWith(START)) {
                const end = this.buf.indexOf(END)
                if (end === -1) break // rest of the step is still on its way
                const json = this.buf.slice(START.length, end)
                this.buf = this.buf.slice(end + END.length)
                try { this.addStep(JSON.parse(json) as RawStep); added++ } catch { /* a garbled step is skipped */ }
                continue
            }
            this.stdout += this.buf[0]
            this.buf = this.buf.slice(1)
        }
        return added
    }

    /** Typed input isn't echoed by the program, so add it to the output like a terminal does. */
    addInput(text: string) { this.stdout += text + '\n' }

    /** Close the run: flush leftover text and add a last step showing the final output. */
    finish() {
        this.stdout += this.buf
        this.buf = ''
        const last = this.steps[this.steps.length - 1]
        if (!last) return
        // The program is over: only the outermost frame is left.
        const stack = last.stack.slice(0, 1)
        const heap: Record<string, HeapObject> = { ...(this.frames[0]?.heap || {}) }
        this.steps.push({ ...last, step: this.steps.length + 1, event: 'return', line: stack[0]?.line ?? last.line, function: stack[0]?.name ?? last.function, stackDepth: stack.length, stack, heap, stdout: this.stdout })
    }

    private addStep(raw: RawStep) {
        const heap: Record<string, HeapObject> = {}
        const locals: Record<string, TraceValue> = {}
        for (const [name, v] of raw.v || []) locals[name] = this.value(v, heap)
        while (this.frames.length && this.frames[this.frames.length - 1].d > raw.d) this.frames.pop()
        const frame: Frame = { d: raw.d, name: raw.f, line: raw.l, locals, heap }
        const top = this.frames[this.frames.length - 1]
        if (top && top.d === raw.d) this.frames[this.frames.length - 1] = frame
        else this.frames.push(frame)
        const merged: Record<string, HeapObject> = {}
        for (const f of this.frames) Object.assign(merged, f.heap)
        this.steps.push({
            step: this.steps.length + 1,
            event: 'line',
            line: raw.l,
            function: raw.f,
            stackDepth: this.frames.length,
            stack: this.frames.map((f) => ({ name: f.name, line: f.line, locals: f.locals, isGlobal: GLOBAL_NAMES.has(f.name) })),
            heap: merged,
            stdout: this.stdout,
        })
    }

    private value(v: RawVal, heap: Record<string, HeapObject>): TraceValue {
        if (v && v.r !== undefined) {
            const id = String(v.r)
            if (v.o) { heap[id] = this.object(v.o, heap); this.known[id] = heap[id] }
            else if (!heap[id]) heap[id] = this.known[id] || { type: 'object', className: 'object', repr: '…' }
            return { kind: 'ref', id }
        }
        return { kind: 'prim', type: String(v?.t ?? '?'), value: String(v?.v ?? '') }
    }

    private object(o: RawObj, heap: Record<string, HeapObject>): HeapObject {
        const sub = (x: RawVal) => this.value(x, heap)
        switch (o.k) {
            case 'list': case 'set': case 'tuple':
                return { type: o.k, n: o.n, elements: (o.e || []).map(sub) }
            case 'dict':
                return { type: 'dict', n: o.n, entries: (o.m || []).map(([a, b]) => [sub(a), sub(b)] as [TraceValue, TraceValue]) }
            case 'instance':
                return { type: 'instance', className: o.c, attrs: Object.fromEntries((o.a || []).map(([k, x]) => [k, sub(x)])) }
            case 'function':
                return { type: 'function', name: o.c }
            default:
                return { type: 'object', className: o.c, repr: o.s ?? '' }
        }
    }
}

// Length of the longest end of `s` that could be the start of a marker.
function partialMarker(s: string): number {
    for (let k = Math.min(s.length, START.length - 1); k > 0; k--) {
        const tail = s.slice(s.length - k)
        if (START.startsWith(tail) || LIMIT.startsWith(tail)) return k
    }
    return 0
}
