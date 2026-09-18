// Rich block editor for the Problem Title (allows text, image, code).
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
import React, { useState, useRef } from 'react';
import { Image, Code } from 'lucide-react';
import type { ProgContentBlock } from '../types';
import { mkProgTextBlock, mkProgCodeBlock } from '../utils/blocksHelpers';
import { ProgImageBlock } from './ProgImageBlock';
import { ProgCodeBlockMCQ } from './ProgCodeBlockMCQ';
import { ProgImageUploadModal } from '../modals/ProgImageUploadModal';

// ─── PROGRAMMING TITLE EDITOR ─────────────────────────────────────────────────

export const ProgTitleEditor: React.FC<{
  blocks: ProgContentBlock[];
  onChange: (blocks: ProgContentBlock[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  titleRef?: React.RefObject<HTMLTextAreaElement | null>;
}> = ({ blocks, onChange, disabled, hasError, titleRef }) => {
  const [showImgModal, setShowImgModal] = useState(false);
  const mkId = () => `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const updateBlock = (id: string, patch: Partial<ProgContentBlock>) =>
    onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as ProgContentBlock) : b));

  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: mkId(), type: 'text', value: '' }]);
  };

  const addCodeBlock = () =>
    onChange([...blocks, { id: mkId(), type: 'code', value: '', language: 'python', bgColor: '#f5f5f5' }]);

  const hasImage = blocks.some(b => b.type === 'image');

  const handleInsertImage = () => {
    if (hasImage) return; // only one image allowed
    setShowImgModal(true);
  };

  const onImageUploaded = (url: string) => {
    onChange([...blocks, { id: mkId(), type: 'image', url, alignment: 'center', sizePercent: 70 }]);
    setShowImgModal(false);
  };

  return (
    <div>
      {/* Toolbar — icons above title (same style as MCQ) */}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0.5, marginBottom: 6 }}>
          {/* Code block */}
          <button type="button" className="lms-fmt-btn" onClick={addCodeBlock} title="Insert code block">
            <Code className="h-3.5 w-3.5" />
          </button>
          {/* Image — only one allowed */}
          <button type="button" className="lms-fmt-btn" onClick={handleInsertImage}
            title={hasImage ? 'Remove existing image first' : 'Insert image'}
            style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}>
            <Image className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image upload modal */}
      {showImgModal && (
        <ProgImageUploadModal
          onUpload={onImageUploaded}
          onClose={() => setShowImgModal(false)}
        />
      )}

      {/* Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: `1.5px solid ${hasError ? 'var(--lms-danger)' : 'transparent'}`, borderRadius: hasError ? 8 : 0 }}>
        {blocks.map((b) => {
          if (b.type === 'text') return (
            <textarea
              key={b.id}
              ref={blocks.indexOf(b) === 0 ? (titleRef as any) : undefined}
              value={(b as any).value}
              onChange={e => updateBlock(b.id, { value: e.target.value } as any)}
              disabled={disabled}
              placeholder="Enter a clear, descriptive question title…"
              rows={1}
              style={{
                fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 500,
                color: 'var(--lms-text-main)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${disabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
                borderRadius: 0, outline: 'none', width: '100%', padding: '4px 0',
                opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'text',
                resize: 'none', overflow: 'hidden', lineHeight: 1.4, boxSizing: 'border-box',
              }}
              onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
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
    </div>
  );
};
