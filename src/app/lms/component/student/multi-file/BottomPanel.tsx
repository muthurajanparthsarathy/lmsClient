"use client"

// Two-tab bottom panel for the multi-file code editor: Terminal + Test Result.
//
// - Terminal hosts the interactive RunTerminal exactly as before; state
//   (termLines/stdin/awaitingInput) is owned by the parent and passed through
//   so switching tabs is pure UI — no output is dropped.
// - Test Result renders the last Submit answer response: a summary chip
//   (Accepted / Wrong answer / Partial / Compilation error / Runtime error /
//   Time limit / Submission failed / Evaluating), then a row of Case
//   selectors, then Input / Expected / Your output for the selected case.
//   Hidden cases never reveal the trainer's input/expected; the student's
//   own output is safe to show (helps debug format mismatches).

import React from "react"
import {
  Terminal as TerminalIcon,
  ClipboardCheck, Copy, CheckCircle2, XCircle, AlertTriangle,
  Loader2, RefreshCw,
} from "lucide-react"
import RunTerminal, { type TermLine } from "./RunTerminal"

export type SubmitStatus =
  | 'evaluating'
  | 'accepted'
  | 'wrong-answer'
  | 'partial'
  | 'compilation-error'
  | 'runtime-error'
  | 'time-limit'
  | 'submission-failed'

export interface TestResultCase {
  index: number
  hidden: boolean
  passed: boolean
  // `unlocked` — for hidden cases only. Server sets true once every visible
  // case has passed AND every prior hidden case has passed too (progressive
  // reveal). Non-hidden cases are always effectively unlocked; the client
  // treats missing flag as `true` for visible cases.
  unlocked?: boolean
  input: string
  expectedOutput: string
  actualOutput: string
  errorMessage?: string
}

export interface TestResultState {
  status: SubmitStatus
  message?: string
  cases: TestResultCase[]
  passedCount?: number
  totalCount?: number
  runtimeMs?: number | null
  memoryKb?: number | null
  score?: number | null
  maxMarks?: number | null
  errorDetail?: string
}

interface BottomPanelProps {
  activeTab: 'terminal' | 'test-result'
  onTabChange: (t: 'terminal' | 'test-result') => void
  testResult: TestResultState | null
  // Terminal
  termLines: TermLine[]
  running: boolean
  stdin: string
  lastRuntime: number | null
  setStdin: (v: string) => void
  onClearTerm: () => void
  interactive: boolean
  awaitingInput: boolean
  inputPrompt: string
  onSubmitInput: (text: string) => void
  // Test Result
  selectedCaseIndex: number
  onSelectCase: (i: number) => void
  onRetrySubmit?: () => void
  isSubmitting?: boolean
}

const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif"

// Status → { label, tone, Icon }. Tones map to green / amber / red / slate so
// we never rely on color alone — the icon + label carry the meaning.
const STATUS_META: Record<SubmitStatus, { label: string; tone: 'ok' | 'bad' | 'warn' | 'info'; Icon: any }> = {
  evaluating:          { label: 'Evaluating your answer…', tone: 'info', Icon: Loader2 },
  accepted:            { label: 'Accepted',                tone: 'ok',   Icon: CheckCircle2 },
  'wrong-answer':      { label: 'Wrong answer',            tone: 'bad',  Icon: XCircle },
  partial:             { label: 'Partially accepted',      tone: 'warn', Icon: AlertTriangle },
  'compilation-error': { label: 'Compilation error',       tone: 'bad',  Icon: XCircle },
  'runtime-error':     { label: 'Runtime error',           tone: 'bad',  Icon: XCircle },
  'time-limit':        { label: 'Time limit exceeded',     tone: 'warn', Icon: AlertTriangle },
  'submission-failed': { label: 'Submission failed',       tone: 'bad',  Icon: XCircle },
}

const TONE: Record<'ok' | 'bad' | 'warn' | 'info', { fg: string; bg: string; border: string }> = {
  ok:   { fg: '#046C4E', bg: '#ECFDF3', border: '#BBF7D0' },
  bad:  { fg: '#B42318', bg: '#FEF3F2', border: '#FBD3CE' },
  warn: { fg: '#B54708', bg: '#FFFAEB', border: '#F5DFA8' },
  info: { fg: '#175CD3', bg: '#EFF6FF', border: '#BFDBFE' },
}

export default function BottomPanel(props: BottomPanelProps) {
  const {
    activeTab, onTabChange, testResult,
    termLines, running, stdin, lastRuntime, setStdin, onClearTerm,
    interactive, awaitingInput, inputPrompt, onSubmitInput,
    selectedCaseIndex, onSelectCase, onRetrySubmit, isSubmitting,
  } = props

  const isEval = testResult?.status === 'evaluating'
  const resStatus = testResult?.status
  const resIndicatorColor =
    !testResult ? '#94A3B8' :
    isEval ? '#175CD3' :
    resStatus === 'accepted' ? '#12A765' :
    (resStatus === 'wrong-answer' || resStatus === 'compilation-error' || resStatus === 'runtime-error' || resStatus === 'submission-failed') ? '#B42318' :
    '#B54708'

  const copyResult = async () => {
    if (!testResult) return
    const lines: string[] = []
    const meta = STATUS_META[testResult.status]
    lines.push(`Status: ${meta.label}`)
    if (typeof testResult.passedCount === 'number' && typeof testResult.totalCount === 'number') {
      lines.push(`Cases passed: ${testResult.passedCount} / ${testResult.totalCount}`)
    }
    if (typeof testResult.score === 'number' && typeof testResult.maxMarks === 'number') {
      lines.push(`Score: ${testResult.score} / ${testResult.maxMarks}`)
    }
    if (testResult.runtimeMs != null) lines.push(`Runtime: ${testResult.runtimeMs} ms`)
    try { await navigator.clipboard.writeText(lines.join('\n')) } catch { /* silent */ }
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: FONT }}>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Bottom output panel"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px', borderBottom: '1px solid #D9E1EA', background: '#F7F9FB',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <TabButton
            id="terminal"
            active={activeTab === 'terminal'}
            onClick={() => onTabChange('terminal')}
          >
            <TerminalIcon size={12} style={{ color: activeTab === 'terminal' ? '#0F9D94' : '#667085' }} />
            Terminal
          </TabButton>
          <TabButton
            id="test-result"
            active={activeTab === 'test-result'}
            onClick={() => onTabChange('test-result')}
          >
            <ClipboardCheck size={12} style={{ color: activeTab === 'test-result' ? '#FF641A' : '#667085' }} />
            Test Result
            {/* Inactive-tab indicator: spinner while evaluating, or a dot
                colored by outcome after a submission. */}
            {activeTab !== 'test-result' && testResult && (
              isEval
                ? <Loader2 size={11} className="animate-spin" style={{ color: '#175CD3' }} />
                : <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: resIndicatorColor, display: 'inline-block' }} />
            )}
          </TabButton>
        </div>

        {/* Right-side action — Clear (Terminal tab) or Copy (Test Result tab) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {activeTab === 'terminal' ? (
            <button
              type="button"
              onClick={onClearTerm}
              title="Clear terminal"
              aria-label="Clear terminal output"
              style={smallBtn}
            >
              Clear
            </button>
          ) : (
            <button
              type="button"
              onClick={copyResult}
              disabled={!testResult || isEval}
              title="Copy result"
              aria-label="Copy result summary"
              style={{ ...smallBtn, opacity: (!testResult || isEval) ? 0.5 : 1 }}
            >
              <Copy size={11} /> Copy result
            </button>
          )}
        </div>
      </div>

      {/* Content — one tab visible at a time; the other keeps its state
          because both are mounted (hidden with `display:none` swap). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          role="tabpanel"
          aria-labelledby="terminal"
          hidden={activeTab !== 'terminal'}
          style={{ flex: activeTab === 'terminal' ? 1 : 0, minWidth: 0, display: activeTab === 'terminal' ? 'block' : 'none' }}
        >
          <RunTerminal
            lines={termLines}
            running={running}
            stdin={stdin}
            lastRuntimeMs={lastRuntime}
            onStdinChange={setStdin}
            onClear={onClearTerm}
            interactive={interactive}
            awaitingInput={awaitingInput}
            inputPrompt={inputPrompt}
            onSubmitInput={onSubmitInput}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="test-result"
          hidden={activeTab !== 'test-result'}
          style={{ flex: activeTab === 'test-result' ? 1 : 0, minWidth: 0, display: activeTab === 'test-result' ? 'block' : 'none' }}
        >
          <TestResultView
            state={testResult}
            selectedIndex={selectedCaseIndex}
            onSelect={onSelectCase}
            onRetry={onRetrySubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 26, padding: '0 10px', borderRadius: 6,
  border: '1px solid #D9E1EA', background: '#fff', color: '#344054',
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
}

function TabButton({ active, onClick, id, children }: { active: boolean; onClick: () => void; id: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      id={`bp-tab-${id}`}
      aria-selected={active}
      aria-controls={`bp-panel-${id}`}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 34, padding: '0 12px', border: 'none', background: 'transparent',
        color: active ? '#172033' : '#667085', fontSize: 13, fontWeight: 600,
        borderBottom: active ? '2px solid #0F9D94' : '2px solid transparent',
        cursor: 'pointer', marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

// ─── TestResultView ─────────────────────────────────────────────────────────

function TestResultView({
  state, selectedIndex, onSelect, onRetry, isSubmitting,
}: {
  state: TestResultState | null
  selectedIndex: number
  onSelect: (i: number) => void
  onRetry?: () => void
  isSubmitting?: boolean
}) {
  if (!state) {
    return (
      <div style={{ padding: 20, color: '#667085', fontSize: 13 }} aria-live="polite">
        Click <b style={{ color: '#172033' }}>Submit answer</b> to evaluate this question. Results will appear here.
      </div>
    )
  }

  const isEval = state.status === 'evaluating'
  const meta = STATUS_META[state.status]
  const tone = TONE[meta.tone]
  const Icon = meta.Icon

  // Suppress the metrics line while evaluating — those numbers belong to
  // the PREVIOUS submission and would read as if the new one had already
  // been graded. The status line is enough on its own during eval.
  const summaryBits: string[] = []
  if (!isEval) {
    if (typeof state.passedCount === 'number' && typeof state.totalCount === 'number' && state.totalCount > 0) {
      summaryBits.push(`${state.passedCount} of ${state.totalCount} cases passed`)
    }
    if (state.runtimeMs != null) summaryBits.push(`Runtime ${state.runtimeMs} ms`)
    if (state.memoryKb != null) summaryBits.push(`Memory ${state.memoryKb} KB`)
    if (typeof state.score === 'number' && typeof state.maxMarks === 'number') {
      summaryBits.push(`Score ${state.score} / ${state.maxMarks}`)
    }
  }

  // Hidden cases unlock ONE BY ONE and only once every visible case has
  // passed. The server marks each case with `unlocked` (progressive: reveal
  // the first hidden case; keep revealing subsequent ones only while each
  // one passes; stop AT the first failing hidden case, which IS revealed
  // for debugging). If a later submission has any visible case failing,
  // the server sends every hidden as `unlocked: false` and nothing hidden
  // shows. Passed/total counts in the summary reflect the full case set
  // so the student can see they still have hidden cases pending.
  const visibleCases = state.cases.filter((c) => !c.hidden)
  const isUnlocked = (c: TestResultCase) => !c.hidden || c.unlocked === true
  const shownCases = state.cases.filter(isUnlocked)
  const totalHidden = state.cases.length - visibleCases.length
  const shownHidden = shownCases.length - visibleCases.length
  const hiddenPending = Math.max(0, totalHidden - shownHidden)
  const canPickCase = !isEval && shownCases.length > 0
  const clampedIndex = canPickCase ? Math.min(selectedIndex, shownCases.length - 1) : 0
  const active = canPickCase ? shownCases[clampedIndex] : null
  // Dim the previous submission's chips + detail while a new evaluation is
  // in flight so the student clearly sees the pane is "old, being replaced".
  const staleStyle: React.CSSProperties = isEval ? { opacity: 0.5, pointerEvents: 'none' } : {}

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }} aria-live="polite">
      {/* Summary */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
          }}
        >
          <Icon size={18} className={isEval ? 'animate-spin' : ''} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: tone.fg }}>{meta.label}</div>
          {(state.message || summaryBits.length > 0) && (
            <div style={{ fontSize: 12.5, color: '#667085', marginTop: 3, lineHeight: 1.5 }}>
              {state.message ? state.message : ''}
              {state.message && summaryBits.length > 0 ? ' · ' : ''}
              {summaryBits.join(' · ')}
            </div>
          )}
        </div>
        {state.status === 'submission-failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 12px', borderRadius: 8,
              border: '1px solid #FF641A', background: '#fff', color: '#FF641A',
              fontSize: 12.5, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} /> Try again
          </button>
        )}
      </div>

      {/* Error detail (compilation / runtime / submission-failed) */}
      {state.errorDetail && (
        <div style={{ margin: '0 16px 12px', padding: 12, borderRadius: 8, background: '#FEF3F2', border: '1px solid #FBD3CE' }}>
          <pre style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#912018', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {state.errorDetail}
          </pre>
        </div>
      )}

      {/* Case selectors. `shownCases` filters out hidden ones until every
          visible case passes — the student sees only what they can debug.
          While a new submission is evaluating, the previous chips + detail
          are dimmed via `staleStyle` to signal the pane is being replaced. */}
      {canPickCase && (
        <div
          role="tablist"
          aria-label="Test cases"
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            padding: '0 16px 12px', borderBottom: '1px solid #D9E1EA',
            ...staleStyle,
          }}
        >
          {shownCases.map((c, i) => {
            const selected = i === clampedIndex
            const ok = c.passed
            const label = c.hidden ? `Hidden case ${c.index + 1}` : `Case ${c.index + 1}`
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(i)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 28, padding: '0 10px', borderRadius: 7,
                  border: selected
                    ? `1.5px solid ${ok ? '#12A765' : '#B42318'}`
                    : '1px solid #D9E1EA',
                  background: selected
                    ? (ok ? '#ECFDF3' : '#FEF3F2')
                    : '#fff',
                  color: ok ? '#046C4E' : '#B42318',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {ok
                  ? <CheckCircle2 size={12} style={{ color: '#12A765' }} />
                  : <XCircle size={12} style={{ color: '#B42318' }} />}
                <span style={{ color: '#172033' }}>{label}</span>
              </button>
            )
          })}
          {/* Note pending hidden cases without exposing them. Shown while
              at least one hidden case is still gated — includes both the
              "no visibles passed" state and the "revealed the failing
              hidden case, others still gated" state. */}
          {hiddenPending > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 28, padding: '0 10px', borderRadius: 7,
              border: '1px dashed #D9E1EA', background: '#F7F9FB',
              fontSize: 11.5, fontWeight: 500, color: '#667085',
            }}>
              {hiddenPending} hidden case{hiddenPending === 1 ? '' : 's'} pending — pass the current cases to unlock the next
            </span>
          )}
        </div>
      )}

      {/* Selected case detail. Hidden cases normally keep trainer input +
          expected concealed; the server unlocks them once every visible
          case has passed (an unlocked hidden case arrives with non-empty
          input/expected). Presence of those fields drives the reveal —
          no client-side rule of its own. Dimmed while evaluating so the
          student sees the details as outdated. */}
      {active && (() => {
        const revealHiddenTrainerFields =
          active.hidden && (active.input !== '' || active.expectedOutput !== '')
        const showTrainerFields = !active.hidden || revealHiddenTrainerFields
        return (
          <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, ...staleStyle }}>
            {active.hidden && !showTrainerFields && (
              <div style={{ fontSize: 12.5, color: '#667085', lineHeight: 1.55 }}>
                This is a hidden case. Trainer input and expected output stay concealed until every visible case passes.
              </div>
            )}
            {showTrainerFields && (
              <>
                <Row label="Input" value={active.input} />
                <Row label="Expected output" value={active.expectedOutput} />
              </>
            )}
            <Row label="Your output" value={active.actualOutput} tone={active.passed ? 'ok' : 'bad'} />
            {active.errorMessage && (
              <Row label="Error" value={active.errorMessage} tone="bad" />
            )}
          </div>
        )
      })()}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const border = tone === 'ok' ? '#BBF7D0' : tone === 'bad' ? '#FBD3CE' : '#E4E7EC'
  const bg     = tone === 'ok' ? '#F5FEF9' : tone === 'bad' ? '#FEF6F5' : '#F7F8FA'
  const shown = value == null || value === '' ? '(empty)' : String(value)
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#667085', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <pre
        style={{
          margin: 0, padding: '8px 10px', borderRadius: 7,
          border: `1px solid ${border}`, background: bg,
          fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: '#172033',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflow: 'auto',
        }}
      >
        {shown}
      </pre>
    </div>
  )
}
