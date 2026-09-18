// Run all sample test cases through Piston and render pass/fail per case.
// Extracted 2026-08-30.
// Constraint checking added 2026-08-30 — every test case is now validated
// against the question's declared Constraints list (see constraintCheck.ts)
// and any per-input violations are surfaced inline with the run outcome,
// so the teacher catches "test input violates its own constraint" bugs
// before students hit them.
import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Play, Loader2, Check, AlertCircle, AlertTriangle, ChevronRight, ChevronDown,
} from 'lucide-react';
import type { TC, FunctionContract } from '../types';
import { runOnPiston, type RunResult } from '@/lib/pistonClient';
import { tcInputsToPayload, coerceTcInput } from '../utils/execHelpers';
import {
  resolveSupportedLang, classifyRun, runOne, compareFunctionReturn,
  buildFunctionRunSource, buildFullProgramRunSource,
  type RunOutcomeRow,
} from '../utils/pistonHelpers';
import {
  parseConstraintsList, checkConstraintsForInput,
  type ConstraintViolation,
} from '../utils/constraintCheck';

// ─── RUN TEST CASES MODAL ─────────────────────────────────────────────────
export const RunTestCasesModal: React.FC<{
  language: string;
  executionType: 'function' | 'fullProgram';
  functionContract: FunctionContract;
  solutionCode: string;
  testCases: TC[];
  /** Constraints declared on the question, echoed here so each test case's
   *  input can be validated against them before/after the run. Passed as
   *  raw strings; parsing is done inside via useMemo. */
  constraints?: string[];
  onClose: () => void;
}> = ({ language, executionType, functionContract, solutionCode, testCases, constraints, onClose }) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ tc: TC; result: RunOutcomeRow | null; error?: string }>>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const isFn = executionType === 'function';
  const buildSource = isFn ? buildFunctionRunSource : buildFullProgramRunSource;

  // Parse the raw constraints ONCE per modal open. Skipped strings surface
  // in a small "N constraints couldn't be parsed" line so the teacher can
  // fix them; parsing failures never block the run itself.
  const { parsed: parsedConstraints, skipped: skippedConstraints } = useMemo(
    () => parseConstraintsList(constraints || []),
    [constraints],
  );

  // Compute per-test-case violations. For function mode we already have
  // structured `functionInputs`; for full-program mode we have plain stdin
  // which we can't reliably map to named variables, so we skip validation
  // there (the teacher can still see the constraints under section 4).
  const violationsPerTC: ConstraintViolation[][] = useMemo(() => {
    if (!isFn || parsedConstraints.length === 0) {
      return testCases.map(() => []);
    }
    return testCases.map(tc => {
      const paramValues: Record<string, any> = {};
      for (const p of functionContract.params) {
        paramValues[p.name] = coerceTcInput((tc.functionInputs || {})[p.name] || '');
      }
      return checkConstraintsForInput(parsedConstraints, paramValues);
    });
  }, [isFn, parsedConstraints, testCases, functionContract]);
  const totalViolations = violationsPerTC.reduce((s, v) => s + v.length, 0);

  const run = async () => {
    if (!solutionCode.trim()) {
      // Represent as compile error per spec (empty submission).
      setResults(testCases.map(tc => ({ tc, result: { outcome: 'compileErr', actual: '', raw: '', stderr: 'Solution Code is empty.', exit: null, signal: null } as RunOutcomeRow })));
      return;
    }
    setRunning(true);
    setResults([]);
    // Serial to keep within the ~20-parallel Piston budget noted in memory.
    const built = buildSource(language, functionContract, solutionCode);
    if (!built.supported) {
      // Function-mode driver only ships for Python + JavaScript today; others
      // are flagged in the UI so the teacher knows to fall back to Full Program.
      setResults(testCases.map(tc => ({ tc, result: null, error: `Function-mode driver for ${language} is not yet supported. Switch to Full Program mode for this language, or use Python / JavaScript.` })));
      setRunning(false);
      return;
    }
    const collected: Array<{ tc: TC; result: RunOutcomeRow | null; error?: string }> = [];
    for (const tc of testCases) {
      const stdin = isFn
        ? JSON.stringify(tcInputsToPayload(tc, functionContract.params))
        : (tc.input || '');
      const t0 = performance.now();
      try {
        const res = await runOne(language, built.source, stdin);
        const elapsed = res.time != null ? res.time : (performance.now() - t0);
        // For function mode we still need a smarter compare (JSON-aware).
        if (isFn) {
          const classified = classifyRun(res, tc.expectedOutput || '', elapsed);
          if (classified.outcome === 'fail' || classified.outcome === 'pass') {
            const ok = compareFunctionReturn(classified.raw, tc.expectedOutput || '');
            classified.outcome = ok ? 'pass' : 'fail';
            classified.actual = (classified.raw || '').trim();
          }
          collected.push({ tc, result: classified });
        } else {
          collected.push({ tc, result: classifyRun(res, tc.expectedOutput || '', elapsed) });
        }
      } catch (err: any) {
        collected.push({ tc, result: null, error: err?.message || 'Network error' });
      }
      setResults([...collected]);
    }
    setRunning(false);
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const passed = results.filter(r => r.result?.outcome === 'pass').length;
  const failed = results.length - passed;

  return (
    <div className="lms-modal-backdrop">
      <div style={{
        background: '#FFFFFF', borderRadius: 14, width: 'min(960px, 96vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>Run Test Cases — Results</div>
          <button className="lms-cancel-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="lms-badge" style={{ background: '#F1F5F9', color: '#334155', borderColor: '#E2E8F0' }}>Total: {testCases.length}</span>
            <span className="lms-badge lms-badge-green">Passed: {passed}</span>
            <span className="lms-badge" style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}>Failed: {failed}</span>
            {running && <span className="lms-badge" style={{ background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' }}>Running…</span>}
            {isFn && parsedConstraints.length > 0 && totalViolations > 0 && (
              <span className="lms-badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
                <AlertTriangle size={11} style={{ marginRight: 3 }} />
                {totalViolations} constraint violation{totalViolations === 1 ? '' : 's'}
              </span>
            )}
            {isFn && skippedConstraints.length > 0 && (
              <span className="lms-badge" title={`Couldn't parse: ${skippedConstraints.join(' · ')}`}
                style={{ background: '#F1F5F9', color: '#475569', borderColor: '#E2E8F0' }}>
                {skippedConstraints.length} constraint{skippedConstraints.length === 1 ? '' : 's'} not enforced
              </span>
            )}
          </div>
          <div style={{ padding: '8px 12px', background: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: 8, color: '#0E7490', fontSize: 12, marginBottom: 10 }}>
            {isFn
              ? `The hidden driver was invoked with each test case and called ${functionContract.functionName || 'the configured function'}(...).`
              : 'Stored Input was sent to stdin; program stdout was compared to Expected Output.'}
          </div>
          {results.map((row, i) => {
            const r = row.result;
            const outcome = r?.outcome;
            const bar = outcome === 'pass' ? '#16A34A'
              : outcome === 'compileErr' ? '#D97706'
              : outcome === 'runtimeErr' ? '#D97706'
              : outcome === 'timeout' ? '#D97706'
              : outcome === 'fail' ? '#DC2626'
              : '#94A3B8';
            const label = outcome === 'pass' ? 'Passed'
              : outcome === 'fail' ? 'Failed'
              : outcome === 'compileErr' ? 'Compilation Error'
              : outcome === 'runtimeErr' ? 'Runtime Error'
              : outcome === 'timeout' ? 'Timed Out'
              : row.error ? 'Error' : '—';
            const open = expandedIdx === i;
            const rowViolations = violationsPerTC[i] || [];
            return (
              <div key={row.tc.id || i} style={{
                border: '1px solid #E2E8F0', borderLeft: `3px solid ${bar}`,
                borderRadius: 8, marginBottom: 8, overflow: 'hidden',
              }}>
                <div
                  onClick={() => setExpandedIdx(open ? null : i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                >
                  <span className="lms-badge" style={{
                    background: outcome === 'pass' ? '#F0FDF4' : outcome === 'fail' ? '#FEF2F2' : '#FFFBEB',
                    color: bar,
                    borderColor: outcome === 'pass' ? '#BBF7D0' : outcome === 'fail' ? '#FECACA' : '#FDE68A',
                  }}>{label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                    Test Case {i + 1}{row.tc.isSample ? ' · Sample' : ''}{row.tc.isHidden ? ' · Hidden' : ''}
                  </span>
                  {rowViolations.length > 0 && (
                    <span
                      className="lms-badge"
                      title={rowViolations.map(v => v.detail).join(' · ')}
                      style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}
                    >
                      <AlertTriangle size={11} style={{ marginRight: 3 }} />
                      constraint
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {r?.runtimeMs != null && (
                    <span style={{ fontSize: 11, color: '#64748B' }}>runtime {Math.round(r.runtimeMs)}ms{r.exit != null ? ` · exit ${r.exit}` : ''}</span>
                  )}
                </div>
                {open && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E8F0', background: '#FCFCFD' }}>
                    {rowViolations.length > 0 && (
                      <div style={{
                        padding: '8px 10px', marginBottom: 10,
                        background: '#FEF3C7', border: '1px solid #FDE68A',
                        borderRadius: 8, color: '#92400E', fontSize: 12,
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={12} />
                          Constraint violation{rowViolations.length === 1 ? '' : 's'} on this test case
                        </div>
                        <ul style={{ margin: '0 0 0 18px', padding: 0, listStyleType: 'disc' }}>
                          {rowViolations.map((v, vi) => (
                            <li key={vi} style={{ marginTop: 2 }}>
                              {v.detail} <span style={{ color: '#B45309' }}>(rule: <code>{v.constraint}</code>)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Input</div>
                    <pre style={preStyle}>{isFn
                      ? JSON.stringify(tcInputsToPayload(row.tc, functionContract.params), null, 2)
                      : (row.tc.input || '(empty)')}</pre>
                    <div style={{ ...labelStyle, marginTop: 8 }}>Expected</div>
                    <pre style={preStyle}>{row.tc.expectedOutput || '(empty)'}</pre>
                    <div style={{ ...labelStyle, marginTop: 8 }}>Actual</div>
                    <pre style={preStyle}>{r?.actual || r?.raw || (row.error ? row.error : '(empty)')}</pre>
                    {r?.stderr && (
                      <>
                        <div style={{ ...labelStyle, marginTop: 8, color: '#DC2626' }}>Stderr</div>
                        <pre style={{ ...preStyle, background: '#FFF7F7', color: '#B91C1C' }}>{r.stderr}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="lms-cancel-btn" onClick={onClose}>Close</button>
          <button className="lms-btn lms-btn-orange" onClick={() => { setResults([]); run(); }} disabled={running}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run Again
          </button>
        </div>
      </div>
    </div>
  );
};

export const preStyle: React.CSSProperties = {
  margin: '3px 0 0', background: '#F8FAFC', padding: '8px 10px', borderRadius: 6,
  fontFamily: 'ui-monospace,monospace', fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
};
export const labelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 };
