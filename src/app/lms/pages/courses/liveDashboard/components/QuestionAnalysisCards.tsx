"use client";

import React, { useMemo, useState } from "react";
import { Clock, CheckCircle2 } from "lucide-react";

import type { AggregatedQuestion, AggregatedExercise } from "../utils/questionAggregate";

// ── Questions tab — per-question class analysis ─────────────────────────────
//
// One card per question with:
//   • MCQ         — a compact list of options; the correct one filled green
//                   with the class-wide correct-response bar and count. The
//                   persisted answer schema does not retain which option each
//                   student picked (only `isCorrect`), so incorrect-option
//                   rows are shown neutral without an invented per-option
//                   distribution. The class-wide split lives in the right-
//                   side Statistics panel — Correct / Incorrect / Accuracy.
//   • Programming — no options list; a Marks-band strip (Full / Partial /
//                   Zero / Not Attempted / Needs Review) sourced from the
//                   aggregate's per-question mark buckets. Right-side stats
//                   panel shows the same buckets in numbers plus an
//                   Avg. Marks line and a Needs Review count.
//
// Filter + Sort strip on top (matches Image 5 / 6 header).

const TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple Choice",
  "multi-select": "Multiple Select",
  fillblank: "Fill in the Blank",
  programming: "Programming",
  others: "Open Response",
};

const humanType = (t: string) => TYPE_LABEL[t?.toLowerCase()] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Question");

const isProgramming = (t: string): boolean => t?.toLowerCase() === "programming";

const formatSeconds = (s: number | null) => {
  if (s == null || !Number.isFinite(s)) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
};

// One row in the Statistics panel.
function StatRow({
  label, value, valueClass,
}: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11.5px] text-gray-500">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${valueClass || "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

// MCQ option row — reference style with response count + inline bar.
function McqOption({
  label, isCorrect, count, total,
}: {
  label: string;
  isCorrect: boolean;
  /** Responses on this option. `null` = unknown (backend doesn't store per-
   *  option counts for incorrect options), rendered as an em-dash. */
  count: number | null;
  total: number;
}) {
  const pct = count != null && total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = isCorrect ? "bg-emerald-500" : "bg-red-400";
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[12.5px] text-gray-800">{label}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full`}
            style={{ width: `${count != null ? pct : 0}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="text-[10.5px] text-gray-500 tabular-nums">
        {count == null ? "— resp." : `${count} resp.`} · {count == null ? "—" : `${pct}%`}
      </div>
    </div>
  );
}

// Mark-band pill for programming questions — shows one bucket (Full / Partial
// / Zero / Not Attempted / Needs Review) with a bar + count.
function MarkBand({
  label, count, total, tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "emerald" | "amber" | "red" | "slate" | "sky";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const bar = tone === "emerald" ? "bg-emerald-500"
    : tone === "amber" ? "bg-amber-500"
    : tone === "red" ? "bg-red-400"
    : tone === "sky" ? "bg-sky-500"
    : "bg-slate-400";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500 tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

function McqCard({ q, position, total }: { q: AggregatedQuestion; position: number; total: number }) {
  // Total answered — used as the denominator on the correct option's bar.
  const answered = q.answeredCount || (q.correctCount + q.incorrectCount);
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px]">
        <div className="p-4 border-b md:border-b-0 md:border-r border-gray-100 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Question {position} of {total}
              </div>
              <div className="text-[14px] font-medium text-gray-900 leading-snug mt-0.5">
                {q.title}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-[11.5px] text-gray-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-50 text-gray-600 font-medium">
                {humanType(q.type)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatSeconds(q.avgResponseSeconds)}
              </span>
              {q.maxScore > 0 && (
                <span className="text-gray-700 font-medium tabular-nums">
                  {q.maxScore} {q.maxScore === 1 ? "Mark" : "Marks"}
                </span>
              )}
            </div>
          </div>

          {q.options && q.options.length > 0 && (
            <div className="mt-3 space-y-3">
              {q.options.map((opt) => (
                <McqOption
                  key={opt.id}
                  label={opt.label}
                  isCorrect={opt.isCorrect}
                  // Only the correct-option count is derivable from `isCorrect`;
                  // incorrect-option distribution isn't persisted.
                  count={opt.isCorrect ? q.correctCount : null}
                  total={answered}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Statistics
          </div>
          <StatRow label="Correct" value={q.correctCount} valueClass="text-emerald-600" />
          <StatRow label="Incorrect" value={q.incorrectCount} valueClass="text-red-600" />
          <StatRow label="Skipped" value={q.skippedCount} valueClass="text-slate-600" />
          {q.reviewCount > 0 && (
            <StatRow label="Needs Review" value={q.reviewCount} valueClass="text-amber-600" />
          )}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <StatRow
              label="Accuracy"
              value={q.accuracy == null ? "—" : `${q.accuracy}%`}
              valueClass={
                q.accuracy == null ? "text-gray-500"
                  : q.accuracy >= 70 ? "text-emerald-600"
                  : q.accuracy >= 40 ? "text-amber-600"
                  : "text-red-600"
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProgrammingCard({ q, position, total, enrolledCount }: {
  q: AggregatedQuestion;
  position: number;
  total: number;
  enrolledCount: number;
}) {
  const attempted = q.answeredCount || (q.correctCount + q.incorrectCount + q.reviewCount);
  const notAttempted = Math.max(0, enrolledCount - attempted);
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px]">
        <div className="p-4 border-b md:border-b-0 md:border-r border-gray-100 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Question {position} of {total}
              </div>
              <div className="text-[14px] font-medium text-gray-900 leading-snug mt-0.5">
                {q.title}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-[11.5px] text-gray-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-50 text-gray-600 font-medium">
                Programming
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatSeconds(q.avgResponseSeconds)}
              </span>
              {q.maxScore > 0 && (
                <span className="text-gray-700 font-medium tabular-nums">
                  {q.maxScore} {q.maxScore === 1 ? "Mark" : "Marks"}
                </span>
              )}
            </div>
          </div>

          {/* Marks distribution — programming submissions land in one of
              these buckets. Percentages are against the enrolled class so
              rows without an attempt aren't hidden. */}
          <div className="mt-3 space-y-3">
            <MarkBand label="Full Marks" count={q.fullMarksCount} total={enrolledCount || attempted} tone="emerald" />
            <MarkBand label="Partial Marks" count={q.partialCount} total={enrolledCount || attempted} tone="amber" />
            <MarkBand label="Zero Marks" count={q.zeroCount} total={enrolledCount || attempted} tone="red" />
            {q.reviewCount > 0 && (
              <MarkBand label="Needs Review" count={q.reviewCount} total={enrolledCount || attempted} tone="sky" />
            )}
            <MarkBand label="Not Attempted" count={notAttempted} total={enrolledCount || attempted} tone="slate" />
          </div>
        </div>

        <aside className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Statistics
          </div>
          <StatRow label="Submitted" value={attempted} />
          <StatRow label="Full Marks" value={q.fullMarksCount} valueClass="text-emerald-600" />
          <StatRow label="Partial" value={q.partialCount} valueClass="text-amber-600" />
          <StatRow label="Zero" value={q.zeroCount} valueClass="text-red-600" />
          {q.reviewCount > 0 && (
            <StatRow label="Needs Review" value={q.reviewCount} valueClass="text-sky-600" />
          )}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <StatRow
              label="Avg. Marks"
              value={q.avgScore == null || q.maxScore <= 0
                ? "—"
                : `${q.avgScore} / ${q.maxScore}`}
              valueClass="text-gray-800"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function QuestionAnalysisCards({
  aggregate,
  isLoading,
}: {
  aggregate: AggregatedExercise | null;
  isLoading: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"index" | "accuracy" | "time">("index");

  const filteredQuestions = useMemo(() => {
    if (!aggregate) return [];
    let list = aggregate.questions.slice();
    if (typeFilter !== "all") {
      list = list.filter((q) => (q.type || "").toLowerCase() === typeFilter);
    }
    if (sortBy === "accuracy") {
      list.sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1));
    } else if (sortBy === "time") {
      list.sort((a, b) => (b.avgResponseSeconds ?? 0) - (a.avgResponseSeconds ?? 0));
    }
    return list;
  }, [aggregate, typeFilter, sortBy]);

  const availableTypes = useMemo(() => {
    if (!aggregate) return [] as string[];
    const set = new Set<string>();
    for (const q of aggregate.questions) if (q.type) set.add(q.type.toLowerCase());
    return Array.from(set);
  }, [aggregate]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[13px] text-gray-400">
        Aggregating responses…
      </div>
    );
  }

  if (!aggregate || aggregate.questions.length === 0) {
    return (
      <div className="p-8 text-center text-[13px] text-gray-400">
        No questions on this assessment yet.
      </div>
    );
  }

  const total = aggregate.questions.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Info + filters strip. Two lines — helper text on the left, filter/
          sort selects on the right — kept intentionally short. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-gray-500 inline-flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-gray-400" />
          This tab shows accumulated data across all learner attempts.
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <label className="text-gray-500">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 bg-white outline-none focus:border-indigo-400"
          >
            <option value="all">All types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{humanType(t)}</option>
            ))}
          </select>
          <label className="text-gray-500 ml-2">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "index" | "accuracy" | "time")}
            className="border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 bg-white outline-none focus:border-indigo-400"
          >
            <option value="index">Order</option>
            <option value="accuracy">Lowest accuracy</option>
            <option value="time">Longest time</option>
          </select>
        </div>
      </div>

      {filteredQuestions.map((q, i) => (
        isProgramming(q.type)
          ? <ProgrammingCard key={q.id} q={q} position={q.index || i + 1} total={total} enrolledCount={aggregate.enrolledCount} />
          : <McqCard key={q.id} q={q} position={q.index || i + 1} total={total} />
      ))}
    </div>
  );
}
