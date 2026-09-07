'use client';

/**
 * "Which level?" — the step between picking a source and opening the form.
 *
 * Only shown when Step 2 configured the paper by LEVEL (Level Based /
 * Selection Level for code, or the MCQ level split). A flat `general` config
 * has one undifferentiated pool, so there is nothing to ask.
 *
 * Levels the configuration allots ZERO questions to are shown but disabled,
 * rather than hidden: an author who expected Hard to be available needs to see
 * that it is configured out, not silently miss it. Levels already filled to
 * their quota are disabled the same way, with the count as the explanation.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { D } from '../wizard/ui';

export type Level = 'easy' | 'medium' | 'hard';

export interface LevelSlot {
  level: Level;
  /** How many questions the configuration allots to this level. */
  allowed: number;
  used: number;
}

const META: Record<Level, { label: string; color: string; bg: string }> = {
  easy: { label: 'Easy', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  medium: { label: 'Medium', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  hard: { label: 'Hard', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
};

export default function DifficultyPicker({
  open, assessmentName, slots, onPick, onBack, onClose,
}: {
  open: boolean;
  assessmentName: string;
  slots: LevelSlot[];
  onPick: (level: Level) => void;
  onBack?: () => void;
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
        style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(5px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-md bg-white overflow-hidden"
          style={{ borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.26)' }}
        >
          <header className="px-6 pt-5 pb-4 relative">
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
            <p className="text-[12px]" style={{ color: D.textMuted }}>
              Assessment: <strong style={{ color: D.orange }}>{assessmentName}</strong>
            </p>
            <h3 className="text-[19px] font-extrabold mt-2" style={{ color: D.textMain }}>
              Which difficulty?
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: D.textMuted }}>
              This assessment is configured by level — pick the one this question belongs to.
            </p>
          </header>

          <div className="px-4 pb-4 space-y-2">
            {slots.map((s) => {
              const m = META[s.level];
              const left = Math.max(0, s.allowed - s.used);
              const disabled = s.allowed === 0 || left === 0;
              const reason = s.allowed === 0 ? 'not configured' : 'all added';
              return (
                <button
                  key={s.level}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && onPick(s.level)}
                  title={disabled ? `${m.label}: ${reason}` : undefined}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor: disabled ? D.border : 'transparent',
                    background: disabled ? '#fff' : D.surface,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (disabled) return;
                    e.currentTarget.style.borderColor = m.color;
                    e.currentTarget.style.background = m.bg;
                  }}
                  onMouseLeave={(e) => {
                    if (disabled) return;
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = D.surface;
                  }}
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-lg text-[13px] font-extrabold shrink-0"
                    style={{ background: m.bg, color: m.color }}
                  >
                    {m.label[0]}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold" style={{ color: D.textMain }}>
                      {m.label}
                    </span>
                    <span className="block text-[11.5px] mt-0.5" style={{ color: D.textMuted }}>
                      {s.allowed === 0
                        ? 'Not configured for this assessment'
                        : `${s.used} of ${s.allowed} added · ${left} left`}
                    </span>
                  </span>
                  {!disabled && <ChevronRight size={16} className="shrink-0" style={{ color: D.textHint }} />}
                </button>
              );
            })}
          </div>

          {onBack && (
            <footer className="px-6 pb-5">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors"
                style={{ color: D.textMuted }}
              >
                <ChevronLeft size={14} /> Back to sources
              </button>
            </footer>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
