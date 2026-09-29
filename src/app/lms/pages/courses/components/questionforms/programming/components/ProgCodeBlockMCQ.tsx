// MCQ-flavoured code block (used inside title editor).
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ProgContentBlock } from '../types';
import { PROG_CODE_THEMES_MCQ } from './codeThemes';
import { highlightAutoP } from './ProgCodeBlock';

export const ProgCodeBlockMCQ: React.FC<{
  block: ProgContentBlock & { type: 'code' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const [editing, setEditing] = React.useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const savedWidth = (block as any).width;
  const savedHeight = (block as any).height;
  const [liveWidth, setLiveWidth] = React.useState<number | undefined>(savedWidth);
  const [liveHeight, setLiveHeight] = React.useState<number | undefined>(savedHeight);
  const bg = block.bgColor || '#f5f5f5';
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bg);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';

  return (
    <div
      className="relative my-2 group/code"
      style={{
        borderRadius: 8,
        border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
        background: bg,
        overflow: 'visible',
        display: 'inline-block',
        width: liveWidth ? `${liveWidth}px` : 'fit-content',
        minWidth: 200,
        maxWidth: 'none',
        position: 'relative',
      }}
    >
      {/* Remove button */}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: 'absolute', top: 7, right: 10, zIndex: 10,
            background: isDark ? '#ffffff' : '#eb0303',
            border: `1px solid ${isDark ? '#444' : '#d0d0d0'}`,
            borderRadius: 6, padding: '3px 6px', fontSize: 10,
            color: isDark ? '#000000' : '#ffffff',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            opacity: 0, transition: 'opacity 0.15s',
          }}
          className="group-hover/code:!opacity-100"
        >
          <X size={10} />
        </button>
      )}

      {/* Code area */}
      {editing && !disabled ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <textarea
            ref={textareaRef}
            value={block.value}
            onChange={e => onUpdate({ value: e.target.value } as any)}
            onMouseMove={() => {
              if (textareaRef.current) {
                setLiveWidth(textareaRef.current.offsetWidth);
                setLiveHeight(textareaRef.current.offsetHeight);
              }
            }}
            onBlur={() => {
              if (textareaRef.current) {
                const w = textareaRef.current.offsetWidth;
                const h = textareaRef.current.offsetHeight;
                setLiveWidth(w); setLiveHeight(h);
                onUpdate({ width: w, height: h } as any);
              }
              setEditing(false);
            }}
            placeholder="// Write your code here…"
            spellCheck={false}
            autoFocus
            style={{
              display: 'block',
              width: liveWidth ? `${liveWidth}px` : '400px',
              height: liveHeight ? `${liveHeight}px` : '120px',
              minWidth: 200, background: 'transparent', border: 'none',
              outline: 'none', padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              color: textColor, resize: 'both', overflow: 'auto',
              boxSizing: 'border-box', whiteSpace: 'pre', minHeight: 42,
            }}
          />
          <div style={{
            position: 'absolute', bottom: 4, right: 4, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'var(--lms-orange)', opacity: 0.85, zIndex: 10,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 5L5 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 9H5V5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      ) : (
        <pre
          onClick={() => { if (!disabled) setEditing(true); }}
          style={{
            margin: 0, padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            color: textColor, whiteSpace: 'pre', cursor: disabled ? 'default' : 'text',
            display: 'block',
            width: savedWidth ? `${savedWidth}px` : '100%',
            height: savedHeight ? `${savedHeight}px` : undefined,
            minWidth: 200, background: 'transparent', overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightAutoP(block.value || '', bg) }}
        />
      )}

      {/* Bottom toolbar */}
      {!disabled && (
        <div
          className="group-hover/code:!opacity-100"
          style={{
            opacity: 0, transition: 'opacity 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            borderTop: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
          }}
        >
          {PROG_CODE_THEMES_MCQ.map(theme => (
            <button
              key={theme.label}
              type="button"
              title={theme.label}
              onClick={() => onUpdate({ bgColor: theme.bg } as any)}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: theme.bg,
                border: bg === theme.bg ? '2px solid var(--lms-orange)' : `2px solid ${isDark ? '#555' : '#d0d0d0'}`,
                cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ))}
          <div style={{ width: 1, height: 12, background: isDark ? '#444' : '#e0e0e0', margin: '0 2px' }} />
          <input
            type="text"
            value={block.language || ''}
            onChange={e => onUpdate({ language: e.target.value } as any)}
            style={{
              fontSize: 10, fontFamily: 'monospace',
              color: isDark ? '#888' : '#999',
              background: 'transparent', border: 'none', outline: 'none', width: 70,
            }}
          />
        </div>
      )}
    </div>
  );
};


