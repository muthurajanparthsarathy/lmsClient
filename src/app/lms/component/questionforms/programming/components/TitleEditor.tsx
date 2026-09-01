// Simple title input lifted out of ProgrammingQuestionForm so its identity
// stays stable across parent renders (an inline definition would remount on
// every keystroke and lose caret position). Extracted 2026-08-30.
import React, { useState, useRef, useEffect } from 'react';
import type { ProgContentBlock } from '../types';
import { getTitleText, mkProgTextBlock } from '../utils/blocksHelpers';

// ─── Move this OUTSIDE ProgrammingQuestionForm ────────────────────────────────

export const TitleEditor: React.FC<{
  titleBlocks: ProgContentBlock[];
  setTitleBlocks: (blocks: ProgContentBlock[]) => void;
  isDisabled: boolean;
  hasError: boolean;
  setTouched: (fn: (prev: Set<string>) => Set<string>) => void;
  titleRef?: React.RefObject<HTMLTextAreaElement | null>;
}> = ({ titleBlocks, setTitleBlocks, isDisabled, hasError, setTouched }) => {
  const divRef = useRef<HTMLDivElement>(null);
  // Track the "source of truth" text so we can avoid re-setting
  // the DOM while the user is actively typing (which resets cursor).
  const lastSetText = useRef<string>('');

  const textBlock = titleBlocks.find(b => b.type === 'text');
  const currentText = textBlock ? (textBlock as any).value as string : '';

  // Only push value into DOM when it changes from *outside*
  // (e.g. question switch via loadQuestionIntoForm), not while typing.
  useEffect(() => {
    if (!divRef.current) return;
    if (currentText !== lastSetText.current) {
      divRef.current.innerHTML = currentText;
      lastSetText.current = currentText;
    }
  }, [currentText]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerHTML;
    lastSetText.current = newText; // keep ref in sync so effect won't overwrite
    if (textBlock) {
      setTitleBlocks(
        titleBlocks.map(b =>
          b.id === textBlock.id
            ? ({ ...b, value: newText } as ProgContentBlock)
            : b
        )
      );
    } else {
      const newTextBlock = mkProgTextBlock();
      (newTextBlock as any).value = newText;
      setTitleBlocks([newTextBlock, ...titleBlocks]);
    }
    if (newText.trim()) setTouched(p => new Set(p).add('title'));
  };

  return (
    <div
      ref={divRef}
      contentEditable={!isDisabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={() => setTouched(p => new Set(p).add('title'))}
      data-placeholder="Type your question here..."
      style={{
        fontFamily: 'var(--lms-font)',
        fontSize: '15px',
        fontWeight: 500,
        color: 'var(--lms-text-main)',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${isDisabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
        outline: 'none',
        width: '100%',
        padding: '4px 0',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'text',
        lineHeight: 1.65,
        minHeight: '40px',
        // Show placeholder via CSS when empty
        position: 'relative',
      }}
    />
  );
};
// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION SETUP — subsection component (Function vs Full Program, contract,
// starter experience, driver preview). Author-side UI only; the payload it
// mutates is owned by the parent form.
// ═══════════════════════════════════════════════════════════════════════════════
