// One-off function-mode run — teacher types param values in-modal and sees
// the return. Extracted 2026-08-30.
import React, { useState } from 'react';
import {
  X, Play, Loader2, Check, AlertCircle,
} from 'lucide-react';
import type { FunctionContract } from '../types';
import { runOnPiston } from '@/lib/pistonClient';
import { coerceTcInput, execBuildFunctionRunPayload } from '../utils/execHelpers';
import {
  resolveSupportedLang, classifyRun, runOne,
  buildFunctionRunSource,
  type RunOutcomeRow,
} from '../utils/pistonHelpers';

// ─── TRY FUNCTION MODAL ──────────────────────────────────────────────────
export const TryFunctionModal: React.FC<{
  language: string;
  functionContract: FunctionContract;
  solutionCode: string;
  onClose: () => void;
}> = ({ language, functionContract, solutionCode, onClose }) => {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    functionContract.params.forEach(p => { seed[p.name] = ''; });
    return seed;
  });
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ ok: boolean; text: string; stderr?: string } | null>(null);

  const callExpr = `${functionContract.functionName || 'solve'}(${functionContract.params.map(p => JSON.stringify(coerceTcInput(inputs[p.name] || ''))).join(', ')})`;

  const call = async () => {
    if (!solutionCode.trim()) { setOutput({ ok: false, text: 'Solution Code is empty.' }); return; }
    const built = execBuildFunctionRunPayload(language, functionContract, solutionCode);
    if (!built.supported) { setOutput({ ok: false, text: `Function-mode driver for ${language} is not yet supported.` }); return; }
    const payload: Record<string, any> = {};
    functionContract.params.forEach(p => { payload[p.name] = coerceTcInput(inputs[p.name] || ''); });
    setRunning(true);
    try {
      const res = await runOne(language, built.source, JSON.stringify(payload));
      const compileErr = (res.compileError || '').trim();
      const stderr = (res.stderr || '').trim();
      const stdout = ((res.stdout ?? res.output) || '').toString().trim();
      if (compileErr) setOutput({ ok: false, text: compileErr });
      else if (stderr && (res.code ?? 0) !== 0) setOutput({ ok: false, text: stdout || '', stderr });
      else setOutput({ ok: true, text: stdout || '(no output)' });
    } catch (err: any) {
      setOutput({ ok: false, text: err?.message || 'Network error' });
    } finally { setRunning(false); }
  };

  return (
    <div className="lms-modal-backdrop">
      <div style={{
        background: '#FFFFFF', borderRadius: 14, width: 'min(720px, 94vw)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>Try Function</div>
          <button className="lms-cancel-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {functionContract.params.length === 0 && (
              <div style={{ fontSize: 12, color: '#64748B' }}>Function has no parameters — press Call Function to invoke it.</div>
            )}
            {functionContract.params.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{p.name}</div>
                  <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#64748B' }}>{p.type}</div>
                </div>
                <input
                  className="lms-input"
                  value={inputs[p.name] || ''}
                  onChange={e => setInputs({ ...inputs, [p.name]: e.target.value })}
                  placeholder={`value for ${p.name}`}
                  style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#F8FAFC', border: '1px dashed #E2E8F0', borderRadius: 8, fontSize: 12, color: '#475569' }}>
            Call expression: <code style={{ fontFamily: 'ui-monospace,monospace' }}>{callExpr}</code>
          </div>
          <div style={{ marginTop: 10, minHeight: 96, background: '#0F172A', color: '#E2E8F0', fontFamily: 'ui-monospace,monospace', fontSize: 12.5, padding: '10px 14px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
            {output == null && <span style={{ color: '#94A3B8' }}>Enter parameter values and press Call Function.</span>}
            {output && (
              <>
                <div style={{ color: '#93C5FD' }}>{`$ ${callExpr}`}</div>
                <div style={{ color: output.ok ? '#E2E8F0' : '#FCA5A5' }}>{output.ok ? `=> ${output.text}` : output.text}</div>
                {output.stderr && <div style={{ color: '#FCA5A5' }}>{output.stderr}</div>}
              </>
            )}
          </div>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="lms-cancel-btn" onClick={onClose}>Close</button>
          <button className="lms-btn lms-btn-orange" onClick={call} disabled={running}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Call Function
          </button>
        </div>
      </div>
    </div>
  );
};

