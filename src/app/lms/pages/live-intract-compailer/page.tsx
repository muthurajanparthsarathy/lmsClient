"use client"

// Live Interactive Compiler: /lms/pages/live-intract-compailer
//
// A program that asks for input WAITS for it, and the reader types answers
// into the terminal while it runs, like a real console.
//
//   · Java, C, C++, C#: run on the LMS's own compiler service (warm Docker
//     workers, see compiler-service/ and server/compiler/). The page talks
//     to it over the app's Socket.IO connection (compilerSession.ts): output
//     streams in as the program prints it, each line typed in the terminal
//     goes straight to the program's stdin.
//   · Python: runs in the browser on Pyodide (a Web Worker whose input()
//     blocks until the reader answers), so it needs no server at all.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CircleStop, Eraser, Footprints, Loader2, Play, RotateCcw, SquareTerminal, Zap } from 'lucide-react'
// The step-through visualizer is the one the course code editor uses
// (multi-file-code-editor.tsx). Python is traced with sys.settrace and runs
// in the browser on Pyodide.
import TraceVisualizer from '@/app/lms/pages/courses/coursesdetailedview/components/multi-file/TraceVisualizer'
import { buildTracedPython, parseStreamLine, type TraceStep } from '@/app/lms/pages/courses/coursesdetailedview/components/lib/pythonTracer'
import { runInteractivePython, type InteractiveHandle } from '@/app/lms/pages/courses/reviewSubmission/components/rerun/pyodideRunner'
// Java/C/C++/C#: instrumented (visualizer/) and run on the compiler service.
import { buildTracedProgram, INPUT_LINE } from './visualizer/runtimes'
import { TraceStream } from './visualizer/traceStream'
import { startCompilerSession, CompilerStartError, type CompilerSession, type ServerLanguage } from './compilerSession'

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading editor…</div> })

type Lang = { id: 'python3' | ServerLanguage; label: string; monaco: string; engine: 'browser' | 'server'; starter: string }

const LANGUAGES: Lang[] = [
    { id: 'python3', label: 'Python 3', monaco: 'python', engine: 'browser', starter:
`name = input("Enter your name: ")
age = int(input("Enter your age: "))
print(f"Hello, {name}! Next year you will be {age + 1}.")
` },
    { id: 'java', label: 'Java', monaco: 'java', engine: 'server', starter:
`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = sc.nextLine();
        System.out.print("Enter a number: ");
        int n = sc.nextInt();
        System.out.println("Hello, " + name + "! " + n + " squared is " + (n * n) + ".");
    }
}
` },
    { id: 'c', label: 'C', monaco: 'c', engine: 'server', starter:
`#include <stdio.h>

int main(void) {
    char name[64];
    int n;
    printf("Enter your name: ");
    scanf("%63s", name);
    printf("Enter a number: ");
    scanf("%d", &n);
    printf("Hello, %s! %d squared is %d.\\n", name, n, n * n);
    return 0;
}
` },
    { id: 'cpp', label: 'C++ 17', monaco: 'cpp', engine: 'server', starter:
`#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int n;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Enter a number: ";
    cin >> n;
    cout << "Hello, " << name << "! " << n << " squared is " << n * n << "." << endl;
    return 0;
}
` },
    { id: 'csharp', label: 'C#', monaco: 'csharp', engine: 'server', starter:
`using System;

class Program {
    static void Main() {
        Console.Write("Enter your name: ");
        string name = Console.ReadLine();
        Console.Write("Enter a number: ");
        int n = int.Parse(Console.ReadLine());
        Console.WriteLine($"Hello, {name}! {n} squared is {n * n}.");
    }
}
` },
]

type Status = 'idle' | 'connecting' | 'queued' | 'starting' | 'compiling' | 'running' | 'stopping'
    | 'finished' | 'stopped' | 'timeout' | 'compile_error' | 'error'
type Line = { kind: 'out' | 'in' | 'sys' | 'err'; text: string }

const BUSY: Status[] = ['connecting', 'queued', 'starting', 'compiling', 'running', 'stopping']
const STATUS_UI: Record<Status, { label: string; cls: string }> = {
    idle: { label: 'Ready', cls: 'bg-slate-100 text-slate-600' },
    connecting: { label: 'Connecting…', cls: 'bg-amber-50 text-amber-700' },
    queued: { label: 'Queued…', cls: 'bg-amber-50 text-amber-700' },
    starting: { label: 'Starting environment…', cls: 'bg-amber-50 text-amber-700' },
    compiling: { label: 'Compiling…', cls: 'bg-amber-50 text-amber-700' },
    running: { label: 'Running: type input below', cls: 'bg-emerald-50 text-emerald-700' },
    stopping: { label: 'Stopping…', cls: 'bg-slate-100 text-slate-600' },
    finished: { label: 'Completed', cls: 'bg-blue-50 text-blue-700' },
    stopped: { label: 'Stopped', cls: 'bg-slate-100 text-slate-600' },
    timeout: { label: 'Timed out', cls: 'bg-red-50 text-red-700' },
    compile_error: { label: 'Compilation failed', cls: 'bg-red-50 text-red-700' },
    error: { label: 'Error', cls: 'bg-red-50 text-red-700' },
}

// What a failed start means for the reader.
function startErrorText(e: unknown): string {
    if (e instanceof CompilerStartError) {
        if (e.code === 'UNAUTHENTICATED') return 'Please sign in to the LMS first, then come back to run code.'
        return e.message
    }
    return (e as Error)?.message || 'Could not start the program.'
}

// Pyodide's traceback starts with its own internals; the reader's error is
// on the last lines.
const pythonErrorTail = (err: string) => err.trim().split('\n').filter((l) => !/_pyodide|<exec>|^\s*(await|coroutine)|\^{3,}/.test(l)).slice(-6).join('\n')

export default function LiveInteractiveCompilerPage() {
    const [langId, setLangId] = useState<Lang['id']>(LANGUAGES[0].id)
    const lang = LANGUAGES.find((l) => l.id === langId) || LANGUAGES[0]
    // Code is kept per language, so switching back doesn't lose work.
    const [codeByLang, setCodeByLang] = useState<Record<string, string>>(() => Object.fromEntries(LANGUAGES.map((l) => [l.id, l.starter])))
    const code = codeByLang[lang.id]

    const [status, setStatus] = useState<Status>('idle')
    const [queuePos, setQueuePos] = useState<number | null>(null)
    const [lines, setLines] = useState<Line[]>([])
    const [input, setInput] = useState('')
    // The run in progress: a compiler-service session, or Pyodide.
    const sessionRef = useRef<CompilerSession | null>(null)
    const pyRef = useRef<{ handle: InteractiveHandle | null; waiting: boolean; typedAhead: string[] } | null>(null)
    const runGenRef = useRef(0)
    // The live Monaco instance. Run reads the text straight from it: relying
    // on onChange → state alone let the page run the sample program while the
    // editor showed the reader's code, because Monaco's change callback did
    // not reach React state in this setup (reproduced on /dev/live-compiler).
    // What you see is now exactly what runs.
    const editorRef = useRef<{ getValue: () => string; setValue: (v: string) => void } | null>(null)
    const editorText = () => editorRef.current?.getValue() ?? code
    // Keep the per-language copy in step with the editor before anything
    // swaps the editor's content (language switch) or runs it.
    const saveEditor = () => {
        const text = editorRef.current?.getValue()
        if (text !== undefined) setCodeByLang((m) => (m[lang.id] === text ? m : { ...m, [lang.id]: text }))
    }
    const termRef = useRef<HTMLDivElement>(null)
    // Input is typed inline at the end of the output, like VS Code's
    // terminal: a hidden <input> takes the keystrokes and the terminal draws
    // the text plus a block cursor where the caret is.
    const inputRef = useRef<HTMLInputElement>(null)
    const [caret, setCaret] = useState(0)
    const [termFocused, setTermFocused] = useState(false)
    const historyRef = useRef<string[]>([])
    const historyPosRef = useRef(-1)
    const running = BUSY.includes(status)

    const push = useCallback((kind: Line['kind'], text: string) => {
        setLines((prev) => {
            // Program output arrives in chunks; join consecutive output so
            // a prompt and the text after it stay on one line.
            const last = prev[prev.length - 1]
            if (kind === 'out' && last?.kind === 'out') return [...prev.slice(0, -1), { kind, text: last.text + text }]
            return [...prev, { kind, text }]
        })
    }, [])

    useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight }) }, [lines, input])
    useEffect(() => { if (status === 'running') inputRef.current?.focus() }, [status])

    // Leaving the page ends the run (the server also ends it when the socket goes).
    useEffect(() => () => {
        sessionRef.current?.stop()
        sessionRef.current?.dispose()
        try { pyRef.current?.handle?.stop() } catch { /* already ended */ }
    }, [])

    const stop = () => {
        if (sessionRef.current) {
            setStatus('stopping')
            sessionRef.current.stop()
        } else if (pyRef.current?.handle) {
            try { pyRef.current.handle.stop() } catch { /* already ended */ }
        }
    }

    const run = async () => {
        if (running) return
        // Snapshot the editor NOW: this is the code that runs.
        const script = editorText()
        saveEditor()
        const gen = ++runGenRef.current
        sessionRef.current?.dispose()
        sessionRef.current = null
        setLines([])
        setQueuePos(null)
        setStatus('connecting')
        setInput('')
        setCaret(0)
        historyPosRef.current = -1
        // Name what is being run, so it's visible at a glance that the
        // editor's code (not a sample) went to the compiler.
        const firstLine = script.split('\n').find((l) => l.trim())?.trim() || ''
        const lineCount = script.split('\n').filter((l) => l.trim()).length
        push('sys', `▶ Running ${lang.label} (${lineCount} line${lineCount === 1 ? '' : 's'}): ${firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine}\n`)
        if (lang.engine === 'browser') return runPython(script, gen)

        const current = () => runGenRef.current === gen
        let announcedQueue = false
        const end = (next: Status, kind: Line['kind'], text: string) => {
            if (!current()) return
            push(kind, text)
            setStatus(next)
            setQueuePos(null)
            sessionRef.current = null
        }
        try {
            const session = await startCompilerSession(lang.id as ServerLanguage, script, {
                onQueued: (position) => {
                    if (!current()) return
                    setStatus('queued')
                    setQueuePos(position)
                    if (!announcedQueue) {
                        announcedQueue = true
                        push('sys', `⏳ All ${lang.label} workers are busy, so your program is waiting in the queue. It starts by itself.\n`)
                    }
                },
                onStarted: () => { if (current()) { setStatus('starting'); setQueuePos(null) } },
                onStatus: (phase) => { if (current()) setStatus(phase) },
                onStdout: (d) => { if (current()) push('out', d) },
                // Compiler warnings come in grey; the program's own stderr in red.
                onStderr: (d, source) => { if (current()) push(source === 'compiler' ? 'sys' : 'err', d) },
                onCompileError: (output) => end('compile_error', 'err', `✖ Compilation failed\n${output}\n`),
                onCompleted: ({ exitCode, signal, durationMs }) => end('finished', 'sys', exitCode === 0
                    ? `\n✔ Program finished (${(durationMs / 1000).toFixed(1)} s).`
                    : `\n✖ Program exited with code ${exitCode}${signal ? ` (${signal})` : ''}.`),
                onTimeout: ({ message }) => end('timeout', 'err', `\n⏱ ${message}`),
                onStopped: () => end('stopped', 'sys', '\n■ Stopped.'),
                onError: ({ message }) => end('error', 'err', `\n${message}`),
            })
            if (!current()) { session.stop(); session.dispose(); return }
            sessionRef.current = session
        } catch (e) {
            end('error', 'err', startErrorText(e))
        }
    }

    // Python: Pyodide in a Web Worker; input() blocks until the reader answers.
    const runPython = async (script: string, gen: number) => {
        const current = () => runGenRef.current === gen
        const py = { handle: null as InteractiveHandle | null, waiting: false, typedAhead: [] as string[] }
        pyRef.current = py
        try {
            py.handle = await runInteractivePython(script, {
                onReady: () => { if (current()) setStatus('running') },
                onStdout: (t) => { if (current()) push('out', t) },
                onStderr: (t) => { if (current()) push('err', t) },
                onInputRequest: (prompt) => {
                    if (!current()) return
                    if (prompt) push('out', prompt)
                    const ahead = py.typedAhead.shift()
                    if (ahead !== undefined) py.handle?.provideInput(ahead)
                    else py.waiting = true
                },
                onDone: (err) => {
                    if (!current()) return
                    pyRef.current = null
                    if (err === 'Execution stopped.') { push('sys', '\n■ Stopped.'); setStatus('stopped') }
                    else if (err) { push('err', `\n${pythonErrorTail(err)}`); setStatus('error') }
                    else { push('sys', '\n✔ Program finished.'); setStatus('finished') }
                },
            })
        } catch (e) {
            if (!current()) return
            pyRef.current = null
            push('err', `Could not start Python: ${(e as Error)?.message || e}`)
            setStatus('error')
        }
    }

    const sendInput = () => {
        if (status !== 'running') return
        const session = sessionRef.current
        const py = pyRef.current
        if (!session && !py) return
        push('in', input + '\n')
        if (session) session.send(input + '\n')
        else if (py) {
            if (py.waiting && py.handle) { py.waiting = false; py.handle.provideInput(input) } else py.typedAhead.push(input)
        }
        if (input.trim() && historyRef.current[historyRef.current.length - 1] !== input) historyRef.current.push(input)
        historyPosRef.current = -1
        setInput('')
        setCaret(0)
    }

    const setInputAndCaret = (value: string) => {
        setInput(value)
        setCaret(value.length)
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(value.length, value.length))
    }

    // Terminal keys, as in VS Code: Enter sends the line, ↑/↓ walk through
    // earlier inputs, Ctrl+C stops the program, Ctrl+L clears the screen.
    const onTermKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sendInput(); return }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
            e.preventDefault()
            push('in', input + '^C')
            setInputAndCaret('')
            stop()
            return
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setLines([]); return }
        const history = historyRef.current
        if (e.key === 'ArrowUp' && history.length) {
            e.preventDefault()
            const pos = historyPosRef.current === -1 ? history.length - 1 : Math.max(0, historyPosRef.current - 1)
            historyPosRef.current = pos
            setInputAndCaret(history[pos])
            return
        }
        if (e.key === 'ArrowDown' && historyPosRef.current !== -1) {
            e.preventDefault()
            const pos = historyPosRef.current + 1
            historyPosRef.current = pos >= history.length ? -1 : pos
            setInputAndCaret(pos >= history.length ? '' : history[pos])
        }
    }
    const syncCaret = (el: HTMLInputElement) => setCaret(el.selectionStart ?? el.value.length)
    // Clicking the terminal puts the cursor back in it, unless the reader
    // is selecting output to copy.
    const focusTerminal = () => { if (!window.getSelection()?.toString()) inputRef.current?.focus() }

    // ── Visualize ──
    // Python runs traced in the browser (Pyodide), the same engine as the
    // course code editor. Java/C/C++/C# are instrumented (visualizer/
    // instrument.ts + runtimes.ts) and run on the compiler service exactly
    // like Run, so programs that read input still pause and ask for it; the
    // steps stream back inside the program's output.
    const [showViz, setShowViz] = useState(false)
    const [vizLoading, setVizLoading] = useState(false)
    const [vizRunning, setVizRunning] = useState(false)
    const [vizSteps, setVizSteps] = useState<TraceStep[]>([])
    const [vizSource, setVizSource] = useState('')
    const [vizComplete, setVizComplete] = useState(false)
    const [vizTruncated, setVizTruncated] = useState(false)
    const [vizInputs, setVizInputs] = useState<string[]>([])
    const [vizAwait, setVizAwait] = useState(false)
    const [vizPrompt, setVizPrompt] = useState('')
    const [vizQueuePos, setVizQueuePos] = useState<number | null>(null)
    const vizBufRef = useRef('')
    const vizStepCountRef = useRef(0)
    const vizHandleRef = useRef<InteractiveHandle | null>(null)
    const vizGenRef = useRef(0)
    const vizSessionRef = useRef<CompilerSession | null>(null)
    const vizAwaitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const vizInputRef = useRef<((text: string) => void) | null>(null)
    const [vizLang, setVizLang] = useState<Lang>(LANGUAGES[0])

    // Trace lines stream out of the program's stdout; grow the step list as
    // they arrive so stepping can start while the program is still running.
    const ingestTraceChunk = useCallback((t: string) => {
        let buf = vizBufRef.current + t
        const newSteps: TraceStep[] = []
        const consume = (line: string): boolean => {
            const r = parseStreamLine(line)
            if (r?.kind === 'step') newSteps.push(r.step)
            else if (r?.kind === 'end') setVizTruncated(r.truncated)
            return !!r
        }
        let nl: number
        while ((nl = buf.indexOf('\n')) !== -1) { consume(buf.slice(0, nl)); buf = buf.slice(nl + 1) }
        // Pyodide's batched stdout may drop the trailing newline.
        if (buf && consume(buf)) buf = ''
        vizBufRef.current = buf
        if (newSteps.length) {
            vizStepCountRef.current += newSteps.length
            setVizLoading(false)
            setVizSteps((prev) => [...prev, ...newSteps])
        }
    }, [])

    const visualize = () => {
        if (running || vizRunning) return
        const source = editorText()
        saveEditor()
        if (!source.trim()) return
        setVizLang(lang)
        if (lang.engine === 'browser') void visualizePython(source)
        else void visualizeOnServer(source)
    }

    const visualizePython = async (source: string) => {
        const gen = ++vizGenRef.current
        vizBufRef.current = ''
        vizStepCountRef.current = 0
        setVizSteps([]); setVizInputs([]); setVizComplete(false); setVizTruncated(false)
        setVizAwait(false); setVizPrompt(''); setVizSource(source); setVizQueuePos(null)
        setVizRunning(true); setVizLoading(true); setShowViz(true)
        setLines([])
        try {
            const handle = await runInteractivePython(buildTracedPython(source), {
                onReady: () => {},
                onStdout: (t) => { if (vizGenRef.current === gen) ingestTraceChunk(t) },
                onStderr: (t) => { if (vizGenRef.current === gen) push('err', t) },
                onInputRequest: (prompt) => {
                    if (vizGenRef.current !== gen) return
                    setVizPrompt(prompt); setVizAwait(true)
                },
                onDone: (err) => {
                    if (vizGenRef.current !== gen) return
                    setVizRunning(false); setVizLoading(false); setVizComplete(true); setVizAwait(false)
                    vizHandleRef.current = null
                    if (err && err !== 'Execution stopped.' && vizStepCountRef.current === 0) {
                        setShowViz(false)
                        push('err', `Could not visualize: the program has an error.\n${pythonErrorTail(err)}\n`)
                    }
                },
            })
            if (vizGenRef.current !== gen) { try { handle.stop() } catch { /* noop */ } return }
            vizHandleRef.current = handle
        } catch (e: unknown) {
            if (vizGenRef.current !== gen) return
            setVizRunning(false); setVizLoading(false); setShowViz(false)
            push('err', `Visualizer error: ${(e as Error)?.message || e}\n`)
        }
    }

    const visualizeOnServer = async (source: string) => {
        const traced = buildTracedProgram(lang.id, source)
        if (!traced.ok) { setLines([]); push('err', `Could not visualize: ${traced.error}\n`); return }
        const gen = ++vizGenRef.current
        const runLang = lang
        const stream = new TraceStream()
        setVizSteps([]); setVizInputs([]); setVizComplete(false); setVizTruncated(false)
        setVizAwait(false); setVizPrompt(''); setVizSource(source); setVizQueuePos(null)
        setVizRunning(true); setVizLoading(true); setShowViz(true)
        setLines([])
        const srcLines = source.split('\n')
        let ended = false
        let lastActivity = Date.now()

        // The program doesn't announce that it waits for input. When output
        // goes quiet and the last step is on a line that reads input (scanf,
        // nextLine, cin >>, ReadLine…), that is what's happening: ask.
        const checkAwait = (delay: number) => {
            clearTimeout(vizAwaitTimer.current)
            vizAwaitTimer.current = setTimeout(() => {
                if (vizGenRef.current !== gen || ended) return
                if (Date.now() - lastActivity < delay - 20) return
                const last = stream.steps[stream.steps.length - 1]
                const re = INPUT_LINE[runLang.id]
                if (!last || !re || !re.test(srcLines[last.line - 1] || '')) return
                const tail = stream.stdout.slice(stream.stdout.lastIndexOf('\n') + 1)
                setVizPrompt(tail.slice(-80))
                setVizAwait(true)
            }, delay)
        }
        const publish = () => { setVizSteps([...stream.steps]); setVizTruncated(stream.truncated) }
        // `problem`: why the run ended early, if it did. With steps recorded
        // the visualizer stays open on them (e.g. an infinite loop that hit
        // the time limit) and the reason goes to the terminal.
        const finish = (problem?: string, compilerOutput?: string) => {
            if (ended || vizGenRef.current !== gen) return
            ended = true
            clearTimeout(vizAwaitTimer.current)
            stream.finish()
            vizSessionRef.current = null
            setVizRunning(false); setVizLoading(false); setVizAwait(false); setVizComplete(true); setVizQueuePos(null)
            if (problem) push('err', `${problem}\n`)
            if (stream.steps.length === 0) {
                // Nothing to step through: usually a compile error.
                setShowViz(false)
                const out = (compilerOutput ?? stream.stdout).trim()
                const ours = /__PT|__pt/.test(out)
                if (!problem) push('err', 'Could not visualize: the program did not start.\n')
                if (out) push('out', (ours ? out.replace(/__PT\.\w+\([^)]*\);\s*|__pt\w*\([^;]*\);\s*/g, '') : out) + '\n')
                if (ours) push('sys', 'The visualizer could not follow part of this program. Run still works as normal.\n')
                return
            }
            publish()
        }
        const feed = (text: string) => {
            if (vizGenRef.current !== gen || ended) return
            lastActivity = Date.now()
            if (stream.feed(text)) { setVizLoading(false); publish() }
            checkAwait(450)
        }

        try {
            const session = await startCompilerSession(runLang.id as ServerLanguage, traced.script, {
                onQueued: (position) => { if (vizGenRef.current === gen) setVizQueuePos(position) },
                onStarted: () => { if (vizGenRef.current === gen) setVizQueuePos(null) },
                onStdout: feed,
                onStderr: (d, source) => { if (source !== 'compiler') feed(d) },
                onCompileError: (output) => finish('Could not visualize: the program does not compile.', output),
                onCompleted: () => finish(),
                onTimeout: ({ message }) => finish(message),
                onStopped: () => finish(),
                onError: ({ message }) => finish(message),
            })
            if (vizGenRef.current !== gen) { session.stop(); session.dispose(); return }
            vizSessionRef.current = session
            // Called by the input box in the visualizer.
            vizInputRef.current = (text: string) => {
                if (ended) return
                lastActivity = Date.now()
                stream.addInput(text)
                session.send(text + '\n')
                // A line can read more than one value (scanf("%d %d")): if the
                // program is still waiting after a moment, ask again.
                checkAwait(1200)
            }
        } catch (e) {
            finish(`Could not visualize: ${startErrorText(e)}`)
        }
    }

    const submitVizInput = (text: string) => {
        setVizInputs((prev) => [...prev, text])
        setVizAwait(false); setVizPrompt('')
        if (vizLang.engine === 'browser') vizHandleRef.current?.provideInput(text)
        else vizInputRef.current?.(text)
    }

    const closeViz = () => {
        vizGenRef.current++
        clearTimeout(vizAwaitTimer.current)
        try { vizHandleRef.current?.stop() } catch { /* noop */ }
        vizHandleRef.current = null
        vizSessionRef.current?.stop()
        vizSessionRef.current?.dispose()
        vizSessionRef.current = null
        setShowViz(false); setVizRunning(false); setVizAwait(false); setVizLoading(false); setVizQueuePos(null)
    }
    useEffect(() => () => {
        try { vizHandleRef.current?.stop() } catch { /* noop */ }
        vizSessionRef.current?.stop()
        vizSessionRef.current?.dispose()
        clearTimeout(vizAwaitTimer.current)
    }, [])

    // Ctrl/⌘ + Enter runs from anywhere on the page.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !showViz) { e.preventDefault(); if (!running) void run() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const statusLabel = status === 'queued' && queuePos ? `Queued… #${queuePos}` : STATUS_UI[status].label

    return (
        <div className="flex h-screen flex-col bg-[#f6f7f9] text-slate-800">
            {/* ── Top bar ── */}
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FDF0E9] text-[#EE6A22]"><Zap size={17} /></span>
                    <div>
                        <h1 className="text-[15px] font-semibold leading-tight">Live Interactive Compiler</h1>
                        <p className="text-[11px] text-slate-500">Programs that ask for input wait for you; type into the terminal while they run.</p>
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                        aria-label="Language"
                        value={langId}
                        disabled={running}
                        onChange={(e) => { saveEditor(); setLangId(e.target.value as Lang['id']) }}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium focus:border-[#F0A574] focus:outline-none focus:ring-4 focus:ring-[#EE6A22]/15 disabled:opacity-60"
                    >
                        {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <button type="button" onClick={() => { editorRef.current?.setValue(lang.starter); setCodeByLang((m) => ({ ...m, [lang.id]: lang.starter })) }} disabled={running} title="Reset to the sample program"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        <RotateCcw size={14} /> Reset
                    </button>
                    <button type="button" onClick={() => void visualize()} disabled={running || vizRunning}
                        title="Step through the program line by line and watch the variables change"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-[13px] font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
                        {vizRunning ? <Loader2 size={14} className="animate-spin" /> : <Footprints size={14} />} Visualize
                    </button>
                    {running ? (
                        <button type="button" onClick={stop} disabled={status === 'stopping'}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-70">
                            <CircleStop size={15} /> Stop
                        </button>
                    ) : (
                        <button type="button" onClick={() => void run()} title="Run (Ctrl + Enter)"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#F07A35] to-[#EE6A22] px-5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(238,106,34,0.35)] hover:from-[#EE6A22] hover:to-[#D65A16]">
                            <Play size={15} fill="currentColor" /> Run
                        </button>
                    )}
                </div>
            </header>

            {/* ── Editor | Terminal ── */}
            <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-[12px] text-slate-500">
                        <span className="font-semibold text-slate-700">{lang.label}</span>
                        <span>Ctrl + Enter to run</span>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Editor
                            height="100%"
                            language={lang.monaco}
                            value={code}
                            onChange={(v) => setCodeByLang((m) => ({ ...m, [lang.id]: v ?? '' }))}
                            onMount={(editor) => { editorRef.current = editor }}
                            options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, padding: { top: 10 } }}
                        />
                    </div>
                </section>

                <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f1419] shadow-sm">
                    <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[12px]">
                        <SquareTerminal size={14} className="text-slate-400" />
                        <span className="font-semibold text-slate-200">Terminal</span>
                        <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_UI[status].cls}`}>
                            {running && status !== 'running' && <Loader2 size={11} className="animate-spin" />}
                            {statusLabel}
                        </span>
                        <button type="button" onClick={() => setLines([])} title="Clear terminal"
                            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-white/10 hover:text-slate-200">
                            <Eraser size={13} /> Clear
                        </button>
                    </div>
                    <div ref={termRef} onMouseUp={focusTerminal}
                        className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[13px] leading-relaxed ${status === 'running' ? 'cursor-text' : ''}`}>
                        {lines.length === 0 && <span className="text-slate-500">Press Run to start. Output appears here, and when the program asks for input, just type here in the terminal and press Enter.</span>}
                        {lines.map((l, i) => (
                            <span key={i} className={l.kind === 'in' ? 'text-[#F0A574]' : l.kind === 'sys' ? 'text-slate-500' : l.kind === 'err' ? 'text-red-400' : 'text-slate-100'}>{l.text}</span>
                        ))}
                        {status === 'running' && (
                            <span className="text-[#F0A574]">
                                {input.slice(0, caret)}
                                <span className={termFocused ? 'term-cursor' : 'outline outline-1 -outline-offset-1 outline-slate-500'}>{input[caret] ?? ' '}</span>
                                {input.slice(caret + 1)}
                            </span>
                        )}
                        {/* Takes the keystrokes; the text is drawn above. */}
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => { setInput(e.target.value); syncCaret(e.target) }}
                            onSelect={(e) => syncCaret(e.currentTarget)}
                            onKeyDown={onTermKeyDown}
                            onFocus={() => setTermFocused(true)}
                            onBlur={() => setTermFocused(false)}
                            disabled={status !== 'running'}
                            aria-label="Program input"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            className="pointer-events-none inline-block h-0 w-0 border-0 p-0 opacity-0"
                        />
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 font-mono text-[11px] text-slate-500">
                        <span>{status === 'running' ? (termFocused ? 'Type your input and press Enter' : 'Click the terminal to type') : status === 'queued' ? 'Waiting for a free worker…' : 'Input opens while the program runs'}</span>
                        <span className="hidden sm:inline">Enter send · ↑↓ history · Ctrl+C stop · Ctrl+L clear</span>
                    </div>
                    <style>{'@keyframes term-blink{0%,49%{background:#e2e8f0;color:#0f1419}50%,100%{background:transparent;color:inherit}}.term-cursor{animation:term-blink 1.06s step-end infinite}'}</style>
                </section>
            </main>

            <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-500">
                <span>Java, C, C++ and C# run on the LMS compiler service. Python runs in your browser.</span>
            </footer>

            {/* Step-through visualizer (same as the course code editor) */}
            {showViz && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) closeViz() }}
                    className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[3px]"
                >
                    <div className="flex h-[min(860px,94vh)] w-[min(1280px,97vw)] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
                        {vizLoading && vizSteps.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3">
                                <Loader2 className="h-7 w-7 animate-spin text-indigo-700" />
                                <div className="text-sm text-gray-600">
                                    {vizLang.engine === 'browser'
                                        ? 'Starting Python… (the first run downloads Pyodide)'
                                        : vizQueuePos
                                            ? `All ${vizLang.label} workers are busy: you are #${vizQueuePos} in the queue…`
                                            : `Compiling and starting your ${vizLang.label} program…`}
                                </div>
                                <button type="button" onClick={closeViz} className="text-xs text-gray-400 underline hover:text-gray-600">Cancel</button>
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
                                onClose={closeViz}
                                title={`${vizLang.label} Execution Visualizer`}
                                languageLabel={vizLang.engine === 'browser' ? 'Python 3.11' : vizLang.label}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
