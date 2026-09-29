"use client";

import React from "react";
import { ChevronDown, Printer } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LAYOUT_LABEL, type PrintLayout } from "./courseReportPrint";
import {
  QUESTION_STATUS_LABEL, round1, STATUS_LABEL,
  type ActivityType, type QuestionRow, type ResultStatus,
} from "./reportData";

// Shared pieces of the Course Report screens. Styling follows the Course
// Setup hierarchy / listing tokens so the report reads as part of the same
// section it is opened from.

export const TH = "px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-subtle whitespace-nowrap";
export const TD = "px-3 py-2.5 text-xs text-body align-middle";
export const TD_NUM = `${TD} text-right tabular-nums`;

const STATUS_TONE: Record<ResultStatus, string> = {
  completed: "bg-success-50 text-success-700 ring-success-500/20",
  "in-progress": "bg-info-50 text-info-700 ring-info-500/20",
  "not-started": "bg-ink-50 text-subtle ring-ink-300/30",
};

export function StatusChip({ status }: { status: ResultStatus }) {
  return (
    <span className={`inline-flex h-[22px] items-center rounded-chip px-2 text-2xs font-medium ring-1 ring-inset whitespace-nowrap ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TypeChip({ type }: { type: ActivityType }) {
  const tone = type === "Assignment"
    ? "bg-info-50 text-info-700 ring-info-500/20"
    : "bg-brand-wash text-brand-strong ring-brand-500/20";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-chip px-2 text-2xs font-semibold ring-1 ring-inset whitespace-nowrap ${tone}`}>
      {type}
    </span>
  );
}

export function Dash() {
  return <span className="text-faint">—</span>;
}

export function Checkbox({
  checked, indeterminate = false, onChange, label, disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => { if (el) el.indeterminate = indeterminate && !checked; }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer rounded border-hairline-strong accent-brand disabled:cursor-not-allowed"
    />
  );
}

export function SelectField({
  label, value, onChange, options, allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-[150px] rounded-control border border-hairline-strong bg-surface px-2.5 text-xs text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** The Preview & Print button. With one layout it opens straight away; with
 *  several it asks which, since that choice decides the columns on the sheet. */
export function PrintMenu({
  layouts, onPick, scopeLabel, disabled,
}: {
  layouts: PrintLayout[];
  onPick: (layout: PrintLayout) => void;
  /** "All 32 students" / "3 selected" — what the printout will cover. */
  scopeLabel: string;
  disabled?: boolean;
}) {
  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={layouts.length === 1 ? () => onPick(layouts[0]) : undefined}
      className="inline-flex h-9 items-center gap-1.5 rounded-control bg-brand-strong px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Printer size={14} /> Preview &amp; Print
      {layouts.length > 1 && <ChevronDown size={13} />}
    </button>
  );
  if (layouts.length === 1) return button;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>{button}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Print {scopeLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {layouts.map((layout) => (
          <DropdownMenuItem key={layout} onClick={() => onPick(layout)} className="cursor-pointer flex-col items-start gap-0.5">
            <span className="text-xs font-semibold text-heading">{LAYOUT_LABEL[layout].label}</span>
            <span className="text-2xs text-subtle">{LAYOUT_LABEL[layout].hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const Q_STATUS_TONE: Record<QuestionRow["status"], string> = {
  evaluated: "text-success-700",
  submitted: "text-info-700",
  not_answered: "text-danger-700",
  pending: "text-subtle",
};

/** One student's questions in one exercise. */
export function QuestionTable({ rows }: { rows: QuestionRow[] }) {
  if (!rows.length) {
    return <p className="px-3 py-4 text-center text-xs text-subtle">This exercise has no questions.</p>;
  }
  const showSection = rows.some((r) => r.section);
  const answered = (r: QuestionRow) => r.status === "evaluated" || r.status === "submitted";
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full border-collapse">
        <thead className="bg-canvas">
          <tr>
            <th className={`${TH} w-12 text-right`}>#</th>
            <th className={TH}>Question</th>
            {showSection && <th className={TH}>Section</th>}
            <th className={TH}>Type</th>
            <th className={TH}>Difficulty</th>
            <th className={`${TH} text-right`}>Max</th>
            <th className={`${TH} text-right`}>Scored</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.questionId} className="border-t border-hairline">
              <td className={`${TD_NUM} text-faint`}>{r.no}</td>
              <td className={`${TD} max-w-[360px]`}><span className="line-clamp-2" title={r.title}>{r.title}</span></td>
              {showSection && <td className={TD}>{r.section || <Dash />}</td>}
              <td className={TD}>{r.type}</td>
              <td className={TD}>{r.difficulty || <Dash />}</td>
              <td className={TD_NUM}>{round1(r.max)}</td>
              <td className={`${TD_NUM} font-semibold text-heading`}>{answered(r) ? round1(r.scored) : <Dash />}</td>
              <td className={`${TD} font-medium ${Q_STATUS_TONE[r.status]}`}>{QUESTION_STATUS_LABEL[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A labelled figure in a header strip. */
export function Stat({ label, value, tone = "text-heading" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-[92px] rounded-lg border border-hairline bg-surface px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className={`mt-0.5 text-base font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
