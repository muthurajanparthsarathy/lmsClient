// Inline image block for the Programming description/title editors.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { ProgContentBlock } from '../types';

export const ProgImageBlock: React.FC<{
  block: ProgContentBlock & { type: 'image' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [liveSize, setLiveSize] = useState(block.sizePercent || 60);
  const startX = useRef(0);
  const startSize = useRef(0);
  const side = useRef<'left' | 'right'>('right');

  useEffect(() => { setLiveSize(block.sizePercent || 60); }, [block.sizePercent]);

  const onMouseDown = (e: React.MouseEvent, s: 'left' | 'right') => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX;
    startSize.current = liveSize;
    side.current = s;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right' ? startSize.current + delta : startSize.current - delta
      ));
      setLiveSize(Math.round(newSize));
    };
    const onUp = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right' ? startSize.current + delta : startSize.current - delta
      ));
      const final = Math.round(newSize);
      setLiveSize(final);
      onUpdate({ sizePercent: final } as any);
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify = block.alignment === 'left' ? 'flex-start' : block.alignment === 'right' ? 'flex-end' : 'center';

  // Same diagonal arrow as MCQ
  const DiagArrow = ({ rotate }: { rotate: number }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${rotate}deg)`, display: 'block', pointerEvents: 'none' }}>
      <line x1="1" y1="9" x2="9" y2="1" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" />
      <polyline points="5,1 9,1 9,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,9 1,9 1,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cornerBase: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16, background: 'white',
    border: '1.5px solid var(--lms-orange)', borderRadius: 3, zIndex: 10,
    userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: (hovered || dragging) && !disabled ? 1 : 0,
    transition: 'opacity 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  };

  return (
    <div style={{ display: 'flex', justifyContent: justify, position: 'relative', margin: '4px 0' }}
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ width: `${liveSize}%`, position: 'relative', transition: dragging ? 'none' : 'width 0.1s', minWidth: 60 }}>
        <img src={block.url} alt="" draggable={false}
          style={{ width: '100%', height: 'auto', borderRadius: 8, border: `1.5px solid ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`, display: 'block', userSelect: 'none', pointerEvents: 'none' }} />

        {/* Drag corner handles — exactly like MCQ */}
        {!disabled && <>
          <div style={{ ...cornerBase, top: -7, left: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={0} /></div>
          <div style={{ ...cornerBase, top: -7, right: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, left: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, right: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={0} /></div>
        </>}

        {/* Size badge while dragging */}
        {dragging && (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--lms-font)', pointerEvents: 'none', zIndex: 20 }}>
            {liveSize}%
          </div>
        )}

        {/* Alignment + remove on hover */}
        {!disabled && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, zIndex: 20, opacity: (hovered || dragging) ? 1 : 0, transition: 'opacity 0.15s' }}>
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} type="button" onClick={() => onUpdate({ alignment: a } as any)}
                style={{ width: 22, height: 22, borderRadius: 5, border: '1.5px solid', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lms-font)', background: block.alignment === a ? 'var(--lms-orange)' : 'white', borderColor: block.alignment === a ? 'var(--lms-orange)' : 'var(--lms-border)', color: block.alignment === a ? 'white' : 'var(--lms-text-muted)' }}>
                {a[0].toUpperCase()}
              </button>
            ))}
            <button type="button" onClick={onRemove}
              style={{ width: 22, height: 22, borderRadius: 5, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

