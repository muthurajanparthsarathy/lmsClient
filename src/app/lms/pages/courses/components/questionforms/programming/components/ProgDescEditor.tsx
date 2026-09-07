// Rich block editor for the Problem Description (text + image + code blocks).
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Image, Code } from 'lucide-react';
import type { ProgContentBlock } from '../types';
import { mkProgTextBlock, mkProgCodeBlock } from '../utils/blocksHelpers';
import { ProgImageBlock } from './ProgImageBlock';
import { ProgCodeBlock } from './ProgCodeBlock';
import { ProgCodeBlockMCQ } from './ProgCodeBlockMCQ';
import { ProgImageUploadModal } from '../modals/ProgImageUploadModal';

export const ProgDescEditor: React.FC<{
  blocks: ProgContentBlock[];
  onChange: (blocks: ProgContentBlock[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  resetKey?: number;
}> = ({ blocks, onChange, disabled, hasError, resetKey }) => {
  const mkId = () => `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [showImgModal, setShowImgModal] = React.useState(false);
  const [fmtState, setFmtState] = React.useState({ bold: false, italic: false, underline: false });
  const editRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const lastSetValues = React.useRef<Map<string, string>>(new Map());

  // Clear lastSetValues cache when question changes so stale IDs don't skip DOM updates
  React.useEffect(() => {
    lastSetValues.current.clear();
  }, [resetKey]);

  const updateBlock = (id: string, patch: Partial<ProgContentBlock>) => {
    onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as ProgContentBlock) : b));
  };
  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: mkId(), type: 'text', value: '' }]);
  };

  // Sync HTML value to contentEditable without resetting cursor
  React.useEffect(() => {
    blocks.forEach(b => {
      if (b.type !== 'text') return;
      const el = editRefs.current.get(b.id);
      if (!el) return;
      const html = (b as any).value || '';
      if (lastSetValues.current.get(b.id) === html) return;
      el.innerHTML = html;
      lastSetValues.current.set(b.id, html);
    });
  });

  const trackFmt = () => {
    setFmtState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  const applyFmt = (cmd: string) => {
    document.execCommand(cmd);
    trackFmt();
    const focused = document.activeElement as HTMLDivElement;
    if (focused) {
      const entry = [...editRefs.current.entries()].find(([, el]) => el === focused);
      if (entry) {
        const [id] = entry;
        const html = focused.innerHTML;
        lastSetValues.current.set(id, html);
        updateBlock(id, { value: html } as any);
      }
    }
  };

  const hasImage = blocks.some(b => b.type === 'image');

  return (
    <div>
      {/* Toolbar — above text area */}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 0 6px' }}>
          <button type="button" className="lms-fmt-btn" title="Bold"
            onMouseDown={e => { e.preventDefault(); applyFmt('bold'); }}
            style={{ fontWeight: 700, color: fmtState.bold ? 'var(--lms-orange)' : undefined, background: fmtState.bold ? 'rgba(255,107,53,0.08)' : undefined }}>
            B
          </button>
          <button type="button" className="lms-fmt-btn" title="Italic"
            onMouseDown={e => { e.preventDefault(); applyFmt('italic'); }}
            style={{ fontStyle: 'italic', color: fmtState.italic ? 'var(--lms-orange)' : undefined, background: fmtState.italic ? 'rgba(255,107,53,0.08)' : undefined }}>
            I
          </button>
          <button type="button" className="lms-fmt-btn" title="Underline"
            onMouseDown={e => { e.preventDefault(); applyFmt('underline'); }}
            style={{ textDecoration: 'underline', color: fmtState.underline ? 'var(--lms-orange)' : undefined, background: fmtState.underline ? 'rgba(255,107,53,0.08)' : undefined }}>
            U
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--lms-border)', margin: '0 2px' }} />
          <button type="button" className="lms-fmt-btn" title="Insert code block"
            onClick={() => onChange([...blocks, { id: mkId(), type: 'code', value: '', language: 'python', bgColor: '#f5f5f5' }])}>
            <Code size={13} />
          </button>
          <button type="button" className="lms-fmt-btn"
            title={hasImage ? 'Remove existing image first' : 'Insert image'}
            disabled={hasImage}
            style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}
            onClick={() => { if (!hasImage) setShowImgModal(true); }}>
            <Image size={13} />
          </button>
        </div>
      )}
      {/* Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {blocks.map((b) => {
          if (b.type === 'text') return (
            <div
              key={b.id}
              ref={el => { if (el) editRefs.current.set(b.id, el); else editRefs.current.delete(b.id); }}
              contentEditable={!disabled}
              suppressContentEditableWarning
              data-placeholder="Describe the problem clearly. Include input/output format and examples."
              onInput={e => {
                const html = (e.currentTarget as HTMLDivElement).innerHTML;
                lastSetValues.current.set(b.id, html);
                updateBlock(b.id, { value: html } as any);
              }}
              onKeyUp={trackFmt}
              onMouseUp={trackFmt}
              style={{
                fontFamily: 'var(--lms-font)',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.65,
                color: 'var(--lms-text-main)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${disabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
                borderRadius: 0,
                outline: 'none',
                width: '100%',
                padding: '4px 0 6px',
                minHeight: 80,
                cursor: disabled ? 'not-allowed' : 'text',
                boxSizing: 'border-box',
                wordBreak: 'break-word',
              }}
            />
          );
          if (b.type === 'image') return (
            <ProgImageBlock key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          if (b.type === 'code') return (
            <ProgCodeBlockMCQ key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          return null;
        })}
      </div>
      {showImgModal && (
        <ProgImageUploadModal
          onUpload={url => {
            onChange([...blocks, { id: mkId(), type: 'image', url, alignment: 'center', sizePercent: 70 }]);
            setShowImgModal(false);
          }}
          onClose={() => setShowImgModal(false)}
        />
      )}
    </div>
  );
};
