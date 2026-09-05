'use client';

/**
 * "Add Question" source picker — the modal the You_Do Questions view opens
 * before any authoring form.
 *
 * Each route carries an "N left" badge computed from Step 2's question counts
 * and Step 3's source distribution, and a route with nothing left is disabled
 * rather than hidden — an author needs to see WHY they cannot use it.
 *
 * Routes the assessment did not tick on Step 3 are hidden entirely: offering
 * "Generate with AI" on a Manual-only paper would produce questions the
 * distribution has no room for.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Database, Globe, FlaskConical, FileText, ChevronRight } from 'lucide-react';
import { D } from '../wizard/ui';
import type { ExternalQuestionOrigin } from '@/apiServices/externalAssessment';
import type { SourceQuota } from './quota';

export interface AddQuestionRoute {
  key: ExternalQuestionOrigin;
  title: string;
  description: string;
  icon: React.ElementType;
  tint: string;
  bg: string;
}

const ROUTES: AddQuestionRoute[] = [
  {
    key: 'scratch',
    title: 'Create Question From Scratch',
    description: 'Build from scratch with custom content',
    icon: Plus,
    tint: D.orange,
    bg: 'rgba(232,100,12,0.10)',
  },
  {
    key: 'bank',
    title: 'Create Question From Question Bank',
    description: 'Import from existing question repository',
    icon: Database,
    tint: '#7c3aed',
    bg: 'rgba(124,58,237,0.10)',
  },
  {
    key: 'thirdParty',
    title: 'Import From Other Platform',
    description: 'Pick platform-imported questions — counted against your quota',
    icon: Globe,
    tint: '#0d9488',
    bg: 'rgba(13,148,136,0.10)',
  },
  {
    key: 'ai',
    title: 'Generate with AI',
    description: 'Let AI draft questions from your topic',
    icon: FlaskConical,
    tint: '#4f46e5',
    bg: 'rgba(79,70,229,0.10)',
  },
  {
    key: 'document',
    title: 'Add Questions via Document',
    description: 'Bulk import from JSON · CSV · TXT',
    icon: FileText,
    tint: '#2563eb',
    bg: 'rgba(37,99,235,0.10)',
  },
];

export default function AddQuestionPicker({
  open,
  assessmentName,
  kindLabel,
  quotas,
  availableSources,
  onPick,
  onClose,
}: {
  open: boolean;
  assessmentName: string;
  /** "MCQ" / "Programming" — what the form will author. */
  kindLabel: string;
  quotas: Record<string, SourceQuota>;
  /** Sources ticked on Step 3, expanded to the routes they enable. */
  availableSources: ExternalQuestionOrigin[];
  onPick: (route: ExternalQuestionOrigin) => void;
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;

  const visible = ROUTES.filter((r) => availableSources.includes(r.key));

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(5px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-lg bg-white overflow-hidden flex flex-col"
          style={{ borderRadius: 20, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.26)' }}
        >
          <header className="px-6 pt-5 pb-4 shrink-0 relative">
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
            <p className="text-[12px]" style={{ color: D.textMuted }}>
              Assessment: <strong style={{ color: D.orange }}>{assessmentName}</strong>
            </p>
            <div className="flex items-center gap-2.5 mt-3">
              <span
                className="flex size-7 items-center justify-center rounded-lg shrink-0"
                style={{ background: D.orangeLight, color: D.orange }}
              >
                <Plus size={16} strokeWidth={2.6} />
              </span>
              <h3 className="text-[19px] font-extrabold" style={{ color: D.textMain }}>Add Question</h3>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: D.textMuted }}>
              Add {kindLabel} to this assessment
            </p>
          </header>

          <div className="px-4 pb-5 overflow-y-auto space-y-2">
            {visible.length === 0 ? (
              <p className="text-center text-[12px] py-6" style={{ color: D.textMuted }}>
                No question sources are enabled. Pick at least one on Step&nbsp;3 of the assessment.
              </p>
            ) : (
              visible.map((r) => {
                const q = quotas[r.key];
                const left = q?.left ?? 0;
                // `allowed === 0` means the distribution never gave this route
                // a share — treat it as exhausted rather than unlimited, or an
                // author could quietly overshoot the configured count.
                const exhausted = (q?.allowed ?? 0) === 0 || left <= 0;
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    type="button"
                    disabled={exhausted}
                    onClick={() => !exhausted && onPick(r.key)}
                    title={exhausted ? 'No questions left for this source' : undefined}
                    className="group w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: exhausted ? D.border : 'transparent',
                      background: exhausted ? '#fff' : D.surface,
                      opacity: exhausted ? 0.5 : 1,
                      cursor: exhausted ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (exhausted) return;
                      e.currentTarget.style.borderColor = D.orange;
                      e.currentTarget.style.background = D.orangeLight;
                    }}
                    onMouseLeave={(e) => {
                      if (exhausted) return;
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.background = D.surface;
                    }}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-lg shrink-0"
                      style={{ background: r.bg, color: r.tint }}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-bold" style={{ color: D.textMain }}>{r.title}</span>
                        <span
                          className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-bold shrink-0"
                          style={{
                            background: exhausted ? 'rgba(107,114,128,0.12)' : r.bg,
                            color: exhausted ? '#6b7280' : r.tint,
                          }}
                        >
                          {exhausted ? 'none left' : `${left} left`}
                        </span>
                      </span>
                      <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: D.textMuted }}>
                        {r.description}
                      </span>
                    </span>
                    {!exhausted && (
                      <ChevronRight size={16} className="shrink-0" style={{ color: D.textHint }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Which picker routes a source set enables.
 *
 * Manual (`scratch`) also unlocks the Question Bank and Document routes: both
 * are ways of sourcing a question by hand rather than generating it, and they
 * share Manual's allotment (see `sourceQuotas`).
 */
export function routesForSources(sources: string[] = []): ExternalQuestionOrigin[] {
  const out: ExternalQuestionOrigin[] = [];
  if (sources.includes('scratch')) out.push('scratch', 'bank', 'document');
  if (sources.includes('thirdParty')) out.push('thirdParty');
  if (sources.includes('ai')) out.push('ai');
  return out;
}
