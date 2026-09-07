'use client';

/**
 * The right-hand rail on the authoring screen — the You_Do "Exercise Details /
 * Exercise Overview" panel.
 *
 * Everything here is derived from the assessment's configuration and the
 * questions actually written, via `quota.ts`. Nothing is stored: a counter
 * that has to be kept in sync is a counter that eventually disagrees with the
 * list beside it.
 */

import React from 'react';
import { Hash, Award, FileText, BarChart3, ChevronRight } from 'lucide-react';
import { D } from '../wizard/ui';
import type { ExternalAssessment, ExternalQuestion } from '@/apiServices/externalAssessment';
import { questionProgress } from './quota';

/** One label/value line. `tone` colours the value. */
function Row({
  label, value, tone,
}: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px]" style={{ color: D.textMuted }}>{label}</span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: tone || D.textMain }}>
        {value}
      </span>
    </div>
  );
}

/** Thin progress rule under a counter group. */
function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: '#eef0f4' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: pct >= 100 ? D.emerald : D.orange }}
      />
    </div>
  );
}

export default function QuestionOverviewPanel({
  assessment, questions, onOpenDetails,
}: {
  assessment: ExternalAssessment;
  questions: ExternalQuestion[];
  onOpenDetails?: () => void;
}) {
  const p = questionProgress(assessment, questions);
  const isCombined = assessment.exerciseType === 'Combined';

  return (
    <aside
      className="w-72 shrink-0 border-l overflow-y-auto"
      style={{ borderColor: D.border, background: '#fff' }}
    >
      <div className="p-3 space-y-2">
        {/* Two nav cards, matching the You_Do rail's header. Exercise Details
            reopens the wizard; Overview is this panel itself, so it is inert. */}
        <button
          type="button"
          onClick={onOpenDetails}
          disabled={!onOpenDetails}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-60"
          style={{ borderColor: D.border2, background: onOpenDetails ? '#fff' : D.surface }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: D.orangeLight, color: D.orange }}
          >
            <FileText size={15} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-bold" style={{ color: D.textMain }}>
              Assessment Details
            </span>
            <span className="block text-[10.5px] truncate" style={{ color: D.textMuted }}>
              ID, type, config, duration
            </span>
          </span>
          {onOpenDetails && <ChevronRight size={14} style={{ color: D.textHint }} />}
        </button>

        <div
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border"
          style={{ borderColor: D.border2, background: D.surface }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: D.orangeLight, color: D.orange }}
          >
            <BarChart3 size={15} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-bold" style={{ color: D.textMain }}>
              Assessment Overview
            </span>
            <span className="block text-[10.5px] truncate" style={{ color: D.textMuted }}>
              Quota, marks, progress
            </span>
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-5">
        {/* ── Questions ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-1">
            <Hash size={13} style={{ color: D.orange }} />
            <h4 className="text-[12px] font-bold" style={{ color: D.textMain }}>Questions</h4>
          </div>
          <Row label="Total" value={p.total} />
          <Row
            label="Created"
            value={<><span style={{ color: D.orange }}>{p.created}</span><span style={{ color: D.textHint }}>/{p.total}</span></>}
          />
          <Row label="Remaining" value={p.remaining} tone={p.remaining === 0 ? D.emerald : D.textMain} />
          <Bar done={p.created} total={p.total} />

          {/* Combined splits the quota, so show which half still needs work —
              "3 remaining" is ambiguous when two forms feed one counter. */}
          {isCombined && (
            <div className="mt-2.5 space-y-1 pt-2" style={{ borderTop: `1px solid ${D.border}` }}>
              <Row label="MCQ" value={`${p.mcq.created}/${p.mcq.total}`} />
              <Row label="Programming" value={`${p.programming.created}/${p.programming.total}`} />
            </div>
          )}
        </section>

        {/* ── Marks ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-1">
            <Award size={13} style={{ color: D.orange }} />
            <h4 className="text-[12px] font-bold" style={{ color: D.textMain }}>Marks</h4>
          </div>
          {p.marks.perQuestion > 0 && (
            <Row label="Per Question" value={p.marks.perQuestion} tone={D.orange} />
          )}
          <Row label="Total" value={p.marks.total} />
          <Row
            label="Used"
            value={<><span style={{ color: D.orange }}>{p.marks.used}</span><span style={{ color: D.textHint }}>/{p.marks.total}</span></>}
          />
          <Row
            label="Remaining"
            value={p.marks.remaining}
            // Over-allocated is a real state — more marks written than the
            // paper is worth — and it must not read as healthy.
            tone={p.marks.remaining < 0 ? D.red : p.marks.remaining === 0 ? D.emerald : D.textMain}
          />
          <Bar done={p.marks.used} total={p.marks.total} />
          {p.marks.remaining < 0 && (
            <p className="mt-1.5 text-[10.5px] font-medium" style={{ color: D.red }}>
              {Math.abs(p.marks.remaining)} marks over the configured total.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
