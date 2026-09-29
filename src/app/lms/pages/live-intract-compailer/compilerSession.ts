// Browser side of the self-hosted live compiler (Java, C, C++, C#).
//
// Talks to the LMS server's compiler gateway over the app's shared Socket.IO
// connection (apiServices/socketClient), which already carries the login
// token. One run = one session:
//
//   compiler:start {language, source} ──ack──▶ { ok, sessionId }
//   ◀── compiler:queued / :started / :status / :stdout / :stderr
//   ◀── compiler:compile_error | :completed | :timeout | :stopped | :error   (end)
//   compiler:input {sessionId, data}  ──▶ the program's stdin, while it runs
//   compiler:stop  {sessionId}        ──▶ stop now
//
// The program runs on a warm worker for as long as it needs; output arrives
// as it is printed, so prompts show up before the program waits for input.

import type { Socket } from 'socket.io-client'
import { getSocket } from '@/apiServices/socketClient'

export type ServerLanguage = 'java' | 'c' | 'cpp' | 'csharp'

export type CompilerHandlers = {
    onConnecting?: () => void
    onQueued?: (position: number, waiting: number) => void
    onStarted?: (workerId: string) => void
    onStatus?: (phase: 'compiling' | 'running') => void
    onStdout?: (data: string) => void
    onStderr?: (data: string, source?: 'compiler') => void
    onCompileError?: (output: string) => void
    onCompleted?: (result: { exitCode: number | null; signal: string | null; durationMs: number }) => void
    onTimeout?: (result: { kind: 'execution' | 'idle' | 'session'; message: string }) => void
    onStopped?: () => void
    onError?: (result: { code: string; message: string }) => void
}

export type CompilerSession = {
    sessionId: string
    send: (data: string) => void
    stop: () => void
    dispose: () => void
}

export class CompilerStartError extends Error {
    constructor(public code: string, message: string) {
        super(message)
    }
}

const EVENTS = [
    'compiler:queued', 'compiler:started', 'compiler:status', 'compiler:stdout', 'compiler:stderr',
    'compiler:compile_error', 'compiler:completed', 'compiler:timeout', 'compiler:stopped', 'compiler:error',
] as const
const TERMINAL = new Set<string>(['compiler:compile_error', 'compiler:completed', 'compiler:timeout', 'compiler:stopped', 'compiler:error'])

type Payload = Record<string, unknown> & { sessionId?: string }

function currentToken(): string {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('smartcliff_token') || localStorage.getItem('token') || ''
}

async function connected(socket: Socket): Promise<void> {
    // The shared socket was created with whatever token existed at the time;
    // if the user has signed in since, reconnect with the current one.
    const token = currentToken()
    const auth = (socket.auth || {}) as { token?: string }
    if (token && auth.token !== token) {
        socket.auth = { token }
        if (socket.connected) socket.disconnect()
    }
    if (socket.connected) return
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new CompilerStartError('UNAVAILABLE', 'Could not reach the server. Check your connection and try again.')) }, 10000)
        const ok = () => { cleanup(); resolve() }
        const cleanup = () => { clearTimeout(timer); socket.off('connect', ok) }
        socket.on('connect', ok)
        if (!socket.active || !socket.connected) socket.connect()
    })
}

export async function startCompilerSession(language: ServerLanguage, source: string, h: CompilerHandlers): Promise<CompilerSession> {
    const socket = getSocket()
    h.onConnecting?.()
    await connected(socket)

    let sessionId: string | null = null
    let finished = false
    const early: [string, Payload][] = [] // events that beat the ack

    const route = (event: string, p: Payload) => {
        if (finished) return
        switch (event) {
            case 'compiler:queued': h.onQueued?.(Number(p.position) || 1, Number(p.waiting) || 1); break
            case 'compiler:started': h.onStarted?.(String(p.workerId || '')); break
            case 'compiler:status': h.onStatus?.(p.phase as 'compiling' | 'running'); break
            case 'compiler:stdout': h.onStdout?.(String(p.data ?? '')); break
            case 'compiler:stderr': h.onStderr?.(String(p.data ?? ''), p.source === 'compiler' ? 'compiler' : undefined); break
            case 'compiler:compile_error': h.onCompileError?.(String(p.output ?? '')); break
            case 'compiler:completed': h.onCompleted?.({ exitCode: (p.exitCode as number | null) ?? null, signal: (p.signal as string | null) ?? null, durationMs: Number(p.durationMs) || 0 }); break
            case 'compiler:timeout': h.onTimeout?.({ kind: p.kind as 'execution' | 'idle' | 'session', message: String(p.message || 'Time limit reached.') }); break
            case 'compiler:stopped': h.onStopped?.(); break
            case 'compiler:error': h.onError?.({ code: String(p.code || 'ERROR'), message: String(p.message || 'Something went wrong.') }); break
        }
        if (TERMINAL.has(event)) { finished = true; dispose() }
    }

    const listeners = EVENTS.map((event) => {
        const fn = (p: Payload) => {
            if (!p || typeof p !== 'object') return
            if (!sessionId) { early.push([event, p]); return }
            if (p.sessionId === sessionId) route(event, p)
        }
        socket.on(event, fn)
        return [event, fn] as const
    })
    const onDisconnect = () => {
        if (finished) return
        finished = true
        dispose()
        h.onError?.({ code: 'DISCONNECTED', message: 'The connection to the server was lost, so the program was stopped.' })
    }
    socket.on('disconnect', onDisconnect)

    function dispose() {
        for (const [event, fn] of listeners) socket.off(event, fn)
        socket.off('disconnect', onDisconnect)
    }

    let ack: { ok: boolean; sessionId?: string; code?: string; error?: string }
    try {
        ack = await socket.timeout(15000).emitWithAck('compiler:start', { language, source })
    } catch {
        dispose()
        throw new CompilerStartError('UNAVAILABLE', 'The compiler did not respond. Please try again.')
    }
    if (!ack || !ack.ok || !ack.sessionId) {
        dispose()
        throw new CompilerStartError(ack?.code || 'ERROR', ack?.error || 'Could not start the program.')
    }
    sessionId = ack.sessionId
    for (const [event, p] of early.splice(0)) if (p.sessionId === sessionId) route(event, p)

    const id = sessionId
    return {
        sessionId: id,
        send: (data) => { if (!finished) socket.emit('compiler:input', { sessionId: id, data }) },
        stop: () => { if (!finished) socket.emit('compiler:stop', { sessionId: id }) },
        dispose: () => { finished = true; dispose() },
    }
}
