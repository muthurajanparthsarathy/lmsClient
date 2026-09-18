"use client";

import React, { useState } from "react";

import {
  formatDateTime,
  type AssessmentChip,
} from "../utils/assessmentHeader";

// ── Assessment report header ─────────────────────────────────────────────────
//
// Compact identity band — no outer bordered card. Left column carries the
// title, metadata chips, and the four learner-status counters. Right rail
// is the Started label + a small assessment thumbnail; nothing wraps or
// truncates.
//
//   Technical Assessment 03 — …                              STARTED
//   [Intermediate] [Assessment] [5 Q] [50 M] [60 min]        08 Sept, 07:20 AM
//   12 Total Students · 11 Not Started · 1 In Progress · 0 Completed   [thumb]
//
// Everything sits on a single subtle bottom hairline so the page reads as
// one flow, not a stack of boxed sections.

const FALLBACK_ARTWORK = "/assets/assessment-illustration.svg";

export interface LearnerCounts {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export interface AssessmentReportHeaderProps {
  title: string;
  chips: AssessmentChip[];
  startDate: string | null;
  imageUrl?: string;
  counts: LearnerCounts;
}

function CountItem({
  value, label, tone,
}: { value: number; label: string; tone: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`text-[18px] font-semibold leading-none tabular-nums ${tone}`}>{value}</span>
      <span className="text-[12.5px] text-gray-600">{label}</span>
    </span>
  );
}

export default function AssessmentReportHeader({
  title, chips, startDate, imageUrl, counts,
}: AssessmentReportHeaderProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const artwork = imageUrl && !imgFailed ? imageUrl : FALLBACK_ARTWORK;

  return (
    <header className="flex-shrink-0 pb-3 border-b border-gray-100">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-6">
        <div className="min-w-0">
          {/* Row 1 — assessment title */}
          <h1
            className="truncate text-[20px] font-semibold leading-tight text-gray-900 xl:text-[22px]"
            title={title}
          >
            {title}
          </h1>

          {/* Row 3 — compact metadata chips */}
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {/* Row 4 — inline learner-status counters. Text-based, no circle
              rings. Vertical pipe dividers with generous spacing on either
              side so each count reads as its own unit. */}
          <div className="mt-3 flex flex-wrap items-center gap-y-1.5">
            <CountItem value={counts.total} label="Total Students" tone="text-indigo-700" />
            <span className="mx-4 h-4 w-px bg-gray-300" aria-hidden="true" />
            <CountItem value={counts.notStarted} label="Not Started" tone="text-slate-700" />
            <span className="mx-4 h-4 w-px bg-gray-300" aria-hidden="true" />
            <CountItem value={counts.inProgress} label="In Progress" tone="text-sky-700" />
            <span className="mx-4 h-4 w-px bg-gray-300" aria-hidden="true" />
            <CountItem value={counts.completed} label="Completed" tone="text-emerald-700" />
          </div>
        </div>

        {/* Right rail — Started label + small thumbnail. Rail width chosen so
            the full date + AM/PM never wraps or truncates. */}
        <aside className="flex flex-shrink-0 items-start gap-3">
          <div className="flex flex-1 flex-col gap-0.5 min-w-[140px]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Started
            </div>
            <div className="text-[12.5px] font-medium text-gray-800 whitespace-nowrap">
              {formatDateTime(startDate)}
            </div>
          </div>

          <div className="hidden h-[86px] w-[140px] flex-shrink-0 overflow-hidden rounded-lg bg-violet-50 sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork}
              alt=""
              aria-hidden="true"
              onError={() => setImgFailed(true)}
              className={`h-full w-full ${imageUrl && !imgFailed ? "object-cover" : "object-contain"}`}
            />
          </div>
        </aside>
      </div>
    </header>
  );
}
