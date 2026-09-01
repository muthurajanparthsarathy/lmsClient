// Full-program mode's ad-hoc stdin runner: teacher types stdin, hits Run,
// sees stdout+stderr+exit. Extracted 2026-08-30.
import React, { useState } from 'react';
import {
  X, Play, Loader2, AlertCircle,
} from 'lucide-react';
import { runOnPiston } from '@/lib/pistonClient';
import {
  resolveSupportedLang, classifyRun, runOne,
  buildFullProgramRunSource,
  type RunOutcomeRow,
} from '../utils/pistonHelpers';
import { preStyle, labelStyle } from './RunTestCasesModal';

// ─── CUSTOM INPUT MODAL (Full Program) ───────────────────────────────────
export const CustomInputModal: React.FC<{
  language: string;
  solutionCode: string;
  onClose: () => void;
}> = ({ language, solutionCode, onClose }) => {
  const [stdin, setStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Array<{ kind: 'sys' | 'out' | 'err' | 'in'; text: string }>>([{ kind: 'sys', text: 'Ready. Press Run to execute the Solution against your input.' }]);

  const run = async () => {
    if (!solutionCode.trim()) { setLines([{ kind: 'err', text: 'CompilationError: Solution Code is empty.' }]); return; }
    setRunning(true);
    setLines([{ kind: 'sys', text: '▶ Running program…' }]);
    try {
      const res = await runOne(language, solutionCode, stdin);
      const compileErr = (res.compileError || '').trim();
      const stderr = (res.stderr || '').trim();
      const stdout = ((res.stdout ?? res.output) || '').toString();
      const exit = res.code ?? 0;
      const next: Array<{ kind: 'sys' | 'out' | 'err' | 'in'; text: string }> = [];
      if (compileErr) next.push({ kind: 'err', text: compileErr });
      if (stdout) next.push(...stdout.split('\n').map(l => ({ kind: 'out' as const, text: l })));
      if (stderr) next.push(...stderr.split('\n').map(l => ({ kind: 'err' as const, text: l })));
      if (!compileErr) next.push({ kind: 'sys', text: `✓ Process finished (exit ${exit})` });
      setLines(next);
    } catch (err: any) {
      setLines([{ kind: 'err', text: err?.message || 'Network error' }]);
    } finally { setRunning(false); }
  };

  return (
    <div className="lms-modal-backdrop">
      <div style={{
        background: '#FFFFFF', borderRadius: 14, width: 'min(900px, 96vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>Custom Input — Terminal</div>
          <button className="lms-cancel-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 18px', overflowY: 'auto' }}>
          <div>
            <div style={labelStyle}>stdin</div>
            <textarea
              className="lms-textarea mono"
              style={{ minHeight: 200, marginTop: 4 }}
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder={'Type stdin. Multiline is fine.\ne.g.\n5\n1 8 3 6 2'}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="lms-btn lms-btn-orange" onClick={run} disabled={running}>
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run
              </button>
              <button className="lms-cancel-btn" onClick={() => setLines([])}>Clear</button>
              <button className="lms-btn" style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }} onClick={() => setRunning(false)}>Stop</button>
            </div>
          </div>
          <div>
            <div style={labelStyle}>stdout</div>
            <div style={{
              background: '#0F172A', color: '#E2E8F0', fontFamily: 'ui-monospace,monospace',
              fontSize: 12.5, padding: '10px 14px', borderRadius: 8, minHeight: 200, maxHeight: 320,
              overflowY: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {lines.map((l, i) => (
                <div key={i} style={{
                  color: l.kind === 'err' ? '#FCA5A5'
                    : l.kind === 'in' ? '#FDBA74'
                    : l.kind === 'sys' ? '#94A3B8' : '#E2E8F0',
                }}>{l.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
