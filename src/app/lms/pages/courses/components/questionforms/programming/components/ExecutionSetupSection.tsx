// The Function / Full Program toggle + function-contract editor + starter-
// experience picker. The heart of the Programming form's execution-setup
// vertical (functionContract, executionType, startingExperience).
// Extracted 2026-08-30.
import React from 'react';
import { Plus, Trash2, ChevronDown, Info, Code } from 'lucide-react';
import type { FunctionContract, FunctionParam } from '../types';
import {
  EXEC_DATA_TYPES, execDataTypesFor, mkFunctionParam, normalizeExecLang,
  execSignatureFor, execGeneratedStarter, execDriverPreview,
} from '../utils/execHelpers';

const EXEC_CARD_STYLE: React.CSSProperties = {
  background: 'var(--lms-bg-white, #FFFFFF)',
  border: '1px solid var(--lms-border, #E2E8F0)',
  borderRadius: 12,
  padding: '14px 16px',
};
const EXEC_OPT_CARD_ON: React.CSSProperties = {
  border: '1.5px solid #E76F51',
  background: '#FFF5F1',
  boxShadow: '0 0 0 3px rgba(231,111,81,0.10)',
};
const EXEC_OPT_CARD_OFF: React.CSSProperties = {
  border: '1.5px solid var(--lms-border, #E2E8F0)',
  background: 'var(--lms-bg-white, #FFFFFF)',
};

export const ExecutionSetupSection: React.FC<{
  executionType: 'function' | 'fullProgram';
  setExecutionType: (v: 'function' | 'fullProgram') => void;
  functionContract: FunctionContract;
  setFunctionContract: (v: FunctionContract) => void;
  startingExperience: 'blank' | 'generated' | 'custom';
  setStartingExperience: (v: 'blank' | 'generated' | 'custom') => void;
  language: string;
  showDriverPreview: boolean;
  setShowDriverPreview: (v: boolean) => void;
  disabled?: boolean;
  functionNameError?: string;
}> = ({
  executionType, setExecutionType,
  functionContract, setFunctionContract,
  startingExperience, setStartingExperience,
  language, showDriverPreview, setShowDriverPreview,
  disabled, functionNameError,
}) => {
  const isFn = executionType === 'function';
  const types = execDataTypesFor(language);

  // Professional segmented control — white active pill on grey track, subtle
  // shadow to lift the active option. No decorative icons or badges; the label
  // does the work. Pattern matches modern segmented controls (Linear / Vercel).
  const segBtn = (key: 'function' | 'fullProgram', label: string) => {
    const on = executionType === key;
    return (
      <button
        type="button"
        onClick={() => { if (!disabled) setExecutionType(key); }}
        disabled={disabled}
        style={{
          padding: '6px 18px', borderRadius: 6, border: 'none',
          background: on ? '#FFFFFF' : 'transparent',
          color: on ? '#0F172A' : '#64748B',
          fontWeight: on ? 600 : 500, fontSize: 13, fontFamily: 'var(--lms-font)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
          opacity: disabled ? 0.6 : 1,
          boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)' : 'none',
          letterSpacing: 0.1,
        }}
      >
        {label}
      </button>
    );
  };

  // Clickable starting-experience tile — radio-style indicator on the left
  // gives an unmistakable "pick one" affordance, hover surface lifts to grey
  // so it reads as a control, not a label.
  const expTile = (
    v: 'blank' | 'generated' | 'custom', label: string, recommended?: boolean,
  ) => {
    const on = startingExperience === v;
    return (
      <button
        type="button"
        onClick={() => { if (!disabled) setStartingExperience(v); }}
        disabled={disabled}
        onMouseEnter={e => { if (!disabled && !on) e.currentTarget.style.background = '#F8FAFC'; }}
        onMouseLeave={e => { if (!disabled && !on) e.currentTarget.style.background = '#FFFFFF'; }}
        style={{
          padding: '10px 12px', borderRadius: 8, textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: on ? '1.5px solid #E76F51' : '1.5px solid #E2E8F0',
          background: on ? '#FFF5F1' : '#FFFFFF',
          boxShadow: on ? '0 0 0 3px rgba(231,111,81,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'var(--lms-font)',
          opacity: disabled ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 600, fontSize: 13, color: on ? '#C55236' : '#0F172A',
          minHeight: 40,
        }}
      >
        {/* Radio-style indicator */}
        <span style={{
          flexShrink: 0,
          width: 16, height: 16, borderRadius: '50%',
          border: on ? '5px solid #E76F51' : '1.5px solid #CBD5E1',
          background: '#FFFFFF',
          transition: 'border 0.15s',
        }} />
        <span style={{ flex: 1 }}>{label}</span>
        {recommended && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', letterSpacing: 0.2,
            flexShrink: 0,
          }}>Recommended</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Internal "Execution Setup *" title + subtitle removed 2026-08-30 —
          the numbered "2. Execution setup" header in the parent form now
          owns the title and subline, so keeping this here rendered the
          same text twice in a row. */}

      {/* Segmented switch — Function / Full Program */}
      <div style={{
        display: 'inline-flex', padding: 3, borderRadius: 8,
        background: '#F1F5F9', alignSelf: 'flex-start', gap: 1,
      }}>
        {segBtn('function', 'Function')}
        {segBtn('fullProgram', 'Full Program')}
      </div>

      {/* Function Contract */}
      {isFn && (
        <div style={EXEC_CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', fontFamily: 'var(--lms-font)' }}>Function Contract</div>
            <span style={{
              fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#64748B',
              padding: '2px 8px', borderRadius: 6, background: '#F1F5F9',
            }}>{normalizeExecLang(language)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)', marginBottom: 4 }}>
                Function Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                className={`lms-input${functionNameError ? ' err' : ''}`}
                value={functionContract.functionName}
                onChange={e => setFunctionContract({ ...functionContract, functionName: e.target.value })}
                placeholder="e.g. findMax"
                disabled={disabled}
              />
              {functionNameError && (
                <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{functionNameError}</div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)', marginBottom: 4 }}>
                Return Type <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className="lms-input"
                value={functionContract.returnType}
                onChange={e => setFunctionContract({ ...functionContract, returnType: e.target.value })}
                disabled={disabled}
              >
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)' }}>Parameters</div>
              <button
                type="button"
                className="lms-btn lms-btn-ghost-orange"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setFunctionContract({
                  ...functionContract,
                  params: [...functionContract.params, mkFunctionParam(functionContract.params.length)],
                })}
                disabled={disabled}
              >
                + Add Parameter
              </button>
            </div>
            {functionContract.params.length === 0 ? (
              <div style={{
                background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '10px 12px',
                fontSize: 12, color: '#475569',
              }}>
                Zero parameters is allowed. The driver will call the function with no arguments.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {functionContract.params.map((p, i) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto auto auto', gap: 6, alignItems: 'center' }}>
                    <input
                      className="lms-input"
                      value={p.name}
                      onChange={e => {
                        const next = [...functionContract.params];
                        next[i] = { ...p, name: e.target.value };
                        setFunctionContract({ ...functionContract, params: next });
                      }}
                      placeholder="name"
                      disabled={disabled}
                    />
                    <select
                      className="lms-input"
                      value={p.type}
                      onChange={e => {
                        const next = [...functionContract.params];
                        next[i] = { ...p, type: e.target.value };
                        setFunctionContract({ ...functionContract, params: next });
                      }}
                      disabled={disabled}
                    >
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      type="button" className="lms-icon-btn"
                      style={{ background: '#F8FAFC' }}
                      title="Move up" disabled={disabled || i === 0}
                      onClick={() => {
                        const next = [...functionContract.params];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setFunctionContract({ ...functionContract, params: next });
                      }}
                    >↑</button>
                    <button
                      type="button" className="lms-icon-btn"
                      style={{ background: '#F8FAFC' }}
                      title="Move down" disabled={disabled || i === functionContract.params.length - 1}
                      onClick={() => {
                        const next = [...functionContract.params];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        setFunctionContract({ ...functionContract, params: next });
                      }}
                    >↓</button>
                    <button
                      type="button" className="lms-icon-btn lms-icon-btn-red"
                      title="Remove parameter" disabled={disabled}
                      onClick={() => setFunctionContract({
                        ...functionContract,
                        params: functionContract.params.filter((_, idx) => idx !== i),
                      })}
                    ><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)', marginBottom: 4 }}>Generated Function Signature</div>
            <pre style={{
              margin: 0, background: '#F1F5F9', padding: '10px 12px', borderRadius: 6,
              fontFamily: 'ui-monospace,monospace', fontSize: 12, overflowX: 'auto',
            }}>{execSignatureFor(language, functionContract)}</pre>
          </div>
        </div>
      )}

      {/* Student Starting Experience — bare tiles, no outer box or header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isFn ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {expTile('blank', 'Blank Editor')}
        {isFn && expTile('generated', 'Generated Starter', true)}
        {expTile('custom', 'Custom Starter')}
      </div>
    </div>
  );
};
