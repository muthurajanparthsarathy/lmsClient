// Inline code block used inside the Programming description editor.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ProgContentBlock } from '../types';
import { PROG_CODE_THEMES } from './codeThemes';

export const ProgCodeBlock: React.FC<{
  block: ProgContentBlock & { type: 'code' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(block.bgColor);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';
  return (
    <div style={{ position: 'relative', borderRadius: 8, border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`, background: block.bgColor, overflow: 'hidden', margin: '4px 0' }}>
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`, flexWrap: 'wrap' }}>
          {PROG_CODE_THEMES.map(t => (
            <button key={t.bg} type="button" onClick={() => onUpdate({ bgColor: t.bg } as any)}
              style={{ padding: '2px 8px', borderRadius: 4, border: `1.5px solid ${block.bgColor === t.bg ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: t.bg, color: ['#1e1e1e', '#282a36', '#272822'].includes(t.bg) ? '#d4d4d4' : '#1a1a2e', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
              {t.label}
            </button>
          ))}
          <select value={block.language} onChange={e => onUpdate({ language: e.target.value } as any)}
            style={{ marginLeft: 'auto', fontFamily: 'ui-monospace,monospace', fontSize: 10, border: `1.5px solid ${isDark ? '#555' : 'var(--lms-border)'}`, borderRadius: 4, padding: '2px 6px', background: isDark ? '#2a2a2a' : 'white', color: isDark ? '#d4d4d4' : '#1a1a2e', cursor: 'pointer' }}>
            {['python', 'javascript', 'java', 'cpp', 'c', 'csharp', 'typescript', 'sql', 'bash', 'other'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button type="button" onClick={onRemove}
            style={{ width: 22, height: 22, borderRadius: 4, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={11} />
          </button>
        </div>
      )}
      <textarea
        value={block.value}
        onChange={e => onUpdate({ value: e.target.value } as any)}
        disabled={disabled}
        placeholder="// Write code here…"
        rows={5}
        style={{ width: '100%', background: 'transparent', border: 'none', color: textColor, fontFamily: 'ui-monospace,monospace', fontSize: 12.5, lineHeight: 1.6, padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
      />
    </div>
  );
};



// FIND and REPLACE entire ProgCodeBlock component with:

export function highlightAutoP(code: string, bgColor: string): string {
  const dark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bgColor);
  const kwC = dark ? '#569cd6' : '#0000ff';
  const strC = dark ? '#ce9178' : '#a31515';
  const cmtC = '#6a9955';
  const numC = dark ? '#b5cea8' : '#098658';
  const kw = [
    '#include', 'float', 'int', 'char', 'double', 'void', 'return',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'function', 'let', 'const', 'var', 'class', 'import', 'export', 'default',
    'new', 'this', 'typeof', 'true', 'false', 'null', 'undefined', 'async', 'await',
    'printf', 'scanf', 'main',
  ];
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, `<span style="color:${cmtC}">$1</span>`)
    .replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color:${cmtC}">$1</span>`)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, `<span style="color:${strC}">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${numC}">$1</span>`)
    .replace(
      new RegExp(`\\b(${kw.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g'),
      `<span style="color:${kwC};font-weight:600">$1</span>`
    );
}
