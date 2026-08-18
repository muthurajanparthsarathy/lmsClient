// Shared between the Feedback Report (report/generate) and Report Analysis
// (report) pages — the Excel-formula workbook computation plus the Master
// Data and Feedback sheet tables, so both pages render identical data.
'use client';
import { useCourseRosterQuery } from '@/queries/courseRoster';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Feedback, FeedbackQuestion } from '../types/feedback';

// Grade colors: 5 → 1 (best → worst).
export const GRADE_COLORS: Record<number, string> = {
  5: '#10b981',
  4: '#3b82f6',
  3: '#f59e0b',
  2: '#fb923c',
  1: '#ef4444',
};

// Distinct hues for per-parameter coloring (chart bars + caption swatches).
export const PARAM_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // purple
];

export const stripHtml = (s: string) => (s ? s.replace(/<[^>]*>/g, '').trim() : '');

// ─────────────────────────────────────────────────────────────────────────────
// Workbook computation — the Excel formulas applied to the feedback document
// ─────────────────────────────────────────────────────────────────────────────
export type MasterRow = {
  id: number;
  submittedAt: string;
  email: string;
  name: string;
  track: string;
  ratings: (number | null)[];
  comments: string;
};

export function buildWorkbook(feedback: Feedback, batchNameByStudent: Map<string, string>) {
  const ratingQuestions = (feedback.questions || [])
    .filter((q) => q.questionType === 'rating')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const maxes = ratingQuestions
    .map((q) => q.ratingConfig?.maxRating)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const scale = maxes.length ? Math.max(...maxes) : 5;
  const grades = Array.from({ length: scale }, (_, i) => scale - i); // [5,4,3,2,1]

  const responses = (feedback.studentResponses || []) as any[];

  const ratingOf = (r: any, q: FeedbackQuestion): number | null => {
    const a = r.answers?.find((x: any) => x.questionText === q.questionText);
    const v = Number(a?.answer);
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  // Sheet 1 — Master Data rows (raw export order = submission order)
  const masterRows: MasterRow[] = responses.map((r, i) => {
    const texts = (r.answers || [])
      .filter((a: any) => a.questionType === 'text')
      .map((a: any) => stripHtml(String(a.answer || '')))
      .filter(Boolean);
    const overall = stripHtml(r.overallReason || '');
    if (overall) texts.push(overall);
    return {
      id: i + 1,
      submittedAt: r.submittedAt || '',
      email: r.isAnonymous ? 'anonymous' : r.studentEmail || '',
      name: r.isAnonymous ? 'Anonymous' : r.studentName || '—',
      track: batchNameByStudent.get(String(r.studentId)) || '—',
      ratings: ratingQuestions.map((q) => ratingOf(r, q)),
      comments: texts.join(' | '),
    };
  });

  // Sheet 2 — grade-count matrix. Excel: =COUNTIF(C3:C26,"5") per question
  // column per grade, and =SUM(C29:C33) for the Total row.
  const gradeCounts = ratingQuestions.map((q) =>
    grades.map((g) => responses.filter((r) => ratingOf(r, q) === g).length)
  );
  const columnTotals = gradeCounts.map((counts) => counts.reduce((s, c) => s + c, 0));

  // Sheet 3 — consolidated percentage. Excel:
  //   =(((C3*$C$2)+(D3*$D$2)+(E3*$E$2)+(F3*$F$2)+(G3*$G$2))/120)*100
  // where 120 = responses × max grade (K11: =24*5). Generalised here.
  const denominator = responses.length * scale;
  const consolidated = ratingQuestions.map((q, qi) => {
    const weighted = gradeCounts[qi].reduce((sum, count, gi) => sum + count * grades[gi], 0);
    return {
      sno: qi + 1,
      parameter: q.questionText,
      counts: gradeCounts[qi],
      percentage: denominator > 0 ? (weighted / denominator) * 100 : 0,
    };
  });

  return { ratingQuestions, scale, grades, responses, masterRows, gradeCounts, columnTotals, consolidated };
}

export type Workbook = ReturnType<typeof buildWorkbook>;

// Batch name per student — powers the "Track / Batch" column. Scoped to the
// feedback's trainer batches when the form targets a trainer.
export function useBatchNameMap(courseId: string, feedback: Feedback | undefined) {
  // Derived from the shared roster entry (queries/courseRoster.ts) — this used
  // to be its own raw fetch of the FULL course payload.
  const { data: roster } = useCourseRosterQuery(courseId || '');
  const batchNameByStudent = useMemo(() => {
    const batches: any[] = (roster as any)?.batchAndParticipants || [];
    const trainerId = (feedback as any)?.trainerId ? String((feedback as any).trainerId) : null;
    const relevantBatches = trainerId
      ? batches.filter((b) =>
          (b?.users || []).some((e: any) => String(e?.user?._id || '') === trainerId)
        )
      : batches;
    const scopedBatches = relevantBatches.length > 0 ? relevantBatches : batches;
    const nameMap = new Map<string, string>();
    scopedBatches.forEach((b) => {
      (b?.users || []).forEach((entry: any) => {
        const u = entry?.user;
        if (u?._id) nameMap.set(String(u._id), b.batchName || '—');
      });
    });
    return nameMap;
  }, [roster, feedback]);

  return batchNameByStudent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table styling shared by both pages
// ─────────────────────────────────────────────────────────────────────────────
export const thCls =
  'px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap';
// Question-column header — exact question text, wrapped (no uppercase).
export const qThCls =
  'px-3 py-2 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-300 whitespace-normal leading-[1.35] min-w-[190px] max-w-[230px] align-middle';
export const tdCls = 'px-2.5 py-1.5 text-[11.5px] text-gray-700 dark:text-gray-300 align-top';
export const numCls = `${tdCls} text-center tabular-nums`;

export const gradeCellTone = (v: number | null) => {
  if (v === null) return 'text-gray-300 dark:text-gray-600';
  if (v >= 4) return 'text-emerald-700 dark:text-emerald-400 font-medium';
  if (v === 3) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-red-600 dark:text-red-400 font-semibold';
};

// ─────────────────────────────────────────────────────────────────────────────
// Master Data sheet — raw export table
// ─────────────────────────────────────────────────────────────────────────────
export const MasterDataTable: React.FC<{ wb: Workbook }> = ({ wb }) => {
  const { ratingQuestions, masterRows } = wb;
  return (
    <div className="overflow-auto border border-gray-100 dark:border-gray-800 rounded-md max-h-[440px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 z-10">
          <tr>
            <th className={thCls}>ID</th>
            <th className={thCls}>Completion Time</th>
            <th className={thCls}>Email</th>
            <th className={thCls}>Trainee Name</th>
            <th className={thCls}>Track / Batch</th>
            {ratingQuestions.map((q, i) => (
              <th key={i} className={qThCls}>
                {q.questionText}
              </th>
            ))}
            <th className={thCls}>Feedback / Comments</th>
          </tr>
        </thead>
        <tbody>
          {masterRows.length === 0 ? (
            <tr>
              <td colSpan={6 + ratingQuestions.length} className={`${tdCls} text-center text-gray-400 py-8`}>
                No responses yet
              </td>
            </tr>
          ) : (
            masterRows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                <td className={numCls}>{row.id}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {row.submittedAt ? format(new Date(row.submittedAt), 'dd MMM yyyy, h:mm a') : '—'}
                </td>
                <td className={tdCls}>{row.email}</td>
                <td className={`${tdCls} font-medium text-gray-900 dark:text-white whitespace-nowrap`}>{row.name}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{row.track}</td>
                {row.ratings.map((v, i) => (
                  <td key={i} className={`${numCls} ${gradeCellTone(v)}`}>
                    {v ?? '—'}
                  </td>
                ))}
                <td className={`${tdCls} min-w-[260px] max-w-[420px]`}>{row.comments || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Feedback sheet — response table + grade-count matrix
// ─────────────────────────────────────────────────────────────────────────────
export const FeedbackSheet: React.FC<{ feedback: Feedback; wb: Workbook }> = ({
  feedback,
  wb,
}) => {
  const { ratingQuestions, grades, masterRows, gradeCounts, columnTotals } = wb;
  return (
    <div className="space-y-4">
      {/* Sheet header block (Excel merged title row) */}
      <div className="border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-md p-3 text-center">
        <div className="text-[12px] font-semibold text-gray-900 dark:text-white">
          {feedback.feedbackTitle}
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
          {feedback.trainerName ? <>Trainer : {feedback.trainerName} · </> : null}
          TRAINEES FEEDBACK FORM
        </div>
      </div>

      <div className="overflow-auto border border-gray-100 dark:border-gray-800 rounded-md max-h-[360px]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 z-10">
            <tr>
              <th className={thCls}>ID</th>
              <th className={thCls}>Trainees Name</th>
              {ratingQuestions.map((q, i) => (
                <th key={i} className={qThCls}>
                  {q.questionText}
                </th>
              ))}
              <th className={thCls}>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {masterRows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                <td className={numCls}>{row.id}</td>
                <td className={`${tdCls} font-medium text-gray-900 dark:text-white whitespace-nowrap`}>{row.name}</td>
                {row.ratings.map((v, i) => (
                  <td key={i} className={`${numCls} ${gradeCellTone(v)}`}>
                    {v ?? '—'}
                  </td>
                ))}
                <td className={`${tdCls} min-w-[260px] max-w-[420px]`}>{row.comments || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grade-count matrix — Excel COUNTIF block */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
            Grade → No. of Trainees
          </h4>
          <span className="text-[10px] text-gray-400">
            Excel: <code>=COUNTIF(range,&quot;grade&quot;)</code> per question · Total ={' '}
            <code>=SUM(...)</code>
          </span>
        </div>
        <div className="overflow-auto border border-gray-100 dark:border-gray-800 rounded-md">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className={thCls}>Grade</th>
                {ratingQuestions.map((q, i) => (
                  <th key={i} className={qThCls}>
                    {q.questionText}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((g, gi) => (
                <tr key={g} className="border-t border-gray-100 dark:border-gray-800">
                  <td className={`${tdCls} font-semibold`}>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ background: GRADE_COLORS[g] || '#6366f1' }}
                    />
                    {g}
                  </td>
                  {gradeCounts.map((counts, qi) => (
                    <td key={qi} className={numCls}>
                      {counts[gi]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50">
                <td className={`${tdCls} font-bold text-gray-900 dark:text-white`}>Total</td>
                {columnTotals.map((t, qi) => (
                  <td key={qi} className={`${numCls} font-bold text-gray-900 dark:text-white`}>
                    {t}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
