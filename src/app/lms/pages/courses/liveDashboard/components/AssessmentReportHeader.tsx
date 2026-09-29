"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  PlayCircle,
  Clock3,
  CircleCheck,
  CalendarDays,
  Info,
  X,
} from "lucide-react";

import {
  formatDateTime,
  type AssessmentChip,
  type AssessmentDetails,
} from "../utils/assessmentHeader";

// Re-export so existing importers (SessionDetail) don't need to change their
// import path. The interface itself now lives with the deriver.
export type { AssessmentDetails };

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
  counts: LearnerCounts;
  imageUrl?: string;
  /** Optional — when passed the info icon appears to the right of the
   *  title and opens a two-column details popover. */
  details?: AssessmentDetails;
}

interface MetricBlockProps {
  value: number;
  label: string;
  icon: React.ReactNode;
}

function MetricBlock({ value, label, icon }: MetricBlockProps) {
  return (
    <div className="flex min-w-[100px] items-center gap-2 px-3 first:pl-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-none tabular-nums text-slate-950">
          {value}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-slate-600">
          {label}
        </div>
      </div>
    </div>
  );
}

const PANEL_WIDTH = 680;   // requested "620–720px" range midpoint
const PANEL_MAX_HEIGHT = 560;   // requested "520–600px" ceiling
const PANEL_GAP = 10;      // gap between the (i) icon and the panel

// ─── Popover internals ──────────────────────────────────────────────────────

interface Row { label: string; value: React.ReactNode; }
interface Section { title: string; rows: Row[]; }

const formatDateTimeShort = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date}, ${time}`;
  } catch {
    return "";
  }
};

const Chip: React.FC<{ tone?: "indigo" | "amber" | "emerald" | "sky" | "rose" | "slate"; children: React.ReactNode }> = ({ tone = "indigo", children }) => {
  const map: Record<string, string> = {
    indigo:  "bg-indigo-50 text-indigo-700 border-indigo-100",
    amber:   "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky:     "bg-sky-50 text-sky-700 border-sky-100",
    rose:    "bg-rose-50 text-rose-700 border-rose-100",
    slate:   "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

// Build the visible rows/sections from an `AssessmentDetails`. Anything the
// helper couldn't derive is omitted so the popover never prints "— — —".
function buildSections(details: AssessmentDetails): Section[] {
  const sections: Section[] = [];

  // ─ General ────────────────────────────────────────────────────────────────
  const general: Row[] = [];
  if (details.typeLabel) {
    general.push({ label: "Type", value: <Chip tone="indigo">{details.typeLabel}</Chip> });
  }
  if (details.subcategoryLabel) {
    general.push({ label: "Category", value: details.subcategoryLabel });
  }
  if (details.testType) {
    general.push({ label: "Test Type", value: details.testType });
  }
  if (details.difficultyLevel) {
    general.push({ label: "Level", value: details.difficultyLevel });
  }
  if (details.isGraded === true) {
    general.push({ label: "Graded", value: <Chip tone="emerald">Yes</Chip> });
  } else if (details.isGraded === false) {
    general.push({ label: "Graded", value: <Chip tone="slate">No</Chip> });
  }
  if (typeof details.durationMinutes === "number" && details.durationMinutes > 0) {
    general.push({ label: "Duration", value: `${details.durationMinutes} min` });
  }
  if (typeof details.submissionAttempts === "number" && details.submissionAttempts > 0) {
    general.push({ label: "Attempts", value: String(details.submissionAttempts) });
  }
  if (details.startDate) {
    const s = formatDateTimeShort(details.startDate);
    if (s) general.push({ label: "Starts", value: s });
  }
  if (details.endDate) {
    const s = formatDateTimeShort(details.endDate);
    if (s) general.push({ label: "Ends", value: s });
  }
  if (details.cutOffDate) {
    const s = formatDateTimeShort(details.cutOffDate);
    if (s) general.push({ label: "Cut-off", value: s });
  }
  if (general.length) sections.push({ title: "General", rows: general });

  // ─ Assessment Structure ───────────────────────────────────────────────────
  const structure: Row[] = [];
  if (details.questionMode) {
    structure.push({
      label: "Mode",
      value: <Chip tone="sky">{details.questionMode}</Chip>,
    });
  }
  if (typeof details.totalQuestions === "number" && details.totalQuestions > 0) {
    structure.push({ label: "Questions", value: String(details.totalQuestions) });
  }
  if (typeof details.totalMarks === "number" && details.totalMarks > 0) {
    structure.push({ label: "Total Marks", value: String(details.totalMarks) });
  }
  if (typeof details.generalMarksPerQuestion === "number") {
    structure.push({ label: "Marks / Question", value: String(details.generalMarksPerQuestion) });
  }
  if (details.sections && details.sections.length) {
    structure.push({ label: "Sections", value: String(details.sections.length) });
  }
  if (details.questionFlow) {
    structure.push({ label: "Flow", value: details.questionFlow });
  }
  if (structure.length) sections.push({ title: "Assessment Structure", rows: structure });

  // ─ Grading ────────────────────────────────────────────────────────────────
  const grading: Row[] = [];
  if (typeof details.passingMark === "number") {
    grading.push({ label: "Passing Mark", value: String(details.passingMark) });
  }
  if (details.evaluationMethod) {
    grading.push({ label: "Evaluation", value: <Chip tone="indigo">{details.evaluationMethod}</Chip> });
  }
  if (details.aiCriteria && details.aiCriteria.length) {
    grading.push({
      label: "AI Criteria",
      value: (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {details.aiCriteria.map((c) => <Chip key={c} tone="slate">{c}</Chip>)}
        </span>
      ),
    });
  }
  if (details.gradeBandLabels && details.gradeBandLabels.length) {
    grading.push({
      label: "Grade Bands",
      value: (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {details.gradeBandLabels.map((b) => <Chip key={b} tone="emerald">{b}</Chip>)}
        </span>
      ),
    });
  }
  if (typeof details.negativeMarking === "boolean") {
    grading.push({ label: "Negative Marking", value: details.negativeMarking ? "Yes" : "No" });
  }
  if (grading.length) sections.push({ title: "Grading", rows: grading });

  // ─ Programming Settings ──────────────────────────────────────────────────
  const programming: Row[] = [];
  if (details.languages && details.languages.length) {
    programming.push({
      label: "Languages",
      value: (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {details.languages.map((l) => <Chip key={l} tone="sky">{l}</Chip>)}
        </span>
      ),
    });
  }
  if (details.compilerFileMode) {
    programming.push({ label: "Compiler", value: details.compilerFileMode });
  }
  if (typeof details.allowCodeExecution === "boolean") {
    programming.push({ label: "Run Code", value: details.allowCodeExecution ? "Enabled" : "Disabled" });
  }
  if (typeof details.showSampleCases === "boolean") {
    programming.push({ label: "Sample Cases", value: details.showSampleCases ? "Visible" : "Hidden" });
  }
  if (programming.length) sections.push({ title: "Programming", rows: programming });

  // ─ MCQ Settings ──────────────────────────────────────────────────────────
  const mcq: Row[] = [];
  if (details.mcqScoringType) {
    mcq.push({ label: "Scoring", value: details.mcqScoringType });
  }
  if (typeof details.shuffleQuestions === "boolean") {
    mcq.push({ label: "Shuffle Questions", value: details.shuffleQuestions ? "Yes" : "No" });
  }
  if (typeof details.shuffleOptions === "boolean") {
    mcq.push({ label: "Shuffle Options", value: details.shuffleOptions ? "Yes" : "No" });
  }
  if (mcq.length) sections.push({ title: "MCQ", rows: mcq });

  // ─ Security ──────────────────────────────────────────────────────────────
  if (details.security) {
    const s = details.security;
    const secRows: Row[] = [];
    const boolRow = (label: string, v: boolean | undefined, enabledLabel = "Enabled", disabledLabel = "Disabled") => {
      if (typeof v !== "boolean") return;
      secRows.push({
        label,
        value: v
          ? <Chip tone="emerald">{enabledLabel}</Chip>
          : <Chip tone="slate">{disabledLabel}</Chip>,
      });
    };
    boolRow("Fullscreen", s.requireFullscreen, "Required", "Optional");
    boolRow("Tab Switch", s.preventTabSwitch, "Restricted", "Allowed");
    boolRow("Copy / Paste", s.preventCopyPaste, "Disabled", "Allowed");
    boolRow("Dev Tools", s.preventDevTools, "Blocked", "Allowed");
    boolRow("Right Click", s.preventRightClick, "Blocked", "Allowed");
    boolRow("Screenshot", s.preventScreenshot, "Blocked", "Allowed");
    boolRow("Screen Recording", s.screenRecordingEnabled, "On", "Off");
    boolRow("Face Monitoring", s.faceMonitoring, "On", "Off");
    if (secRows.length) sections.push({ title: "Security", rows: secRows });
  }

  return sections;
}

// A compact key/value line inside a section — label on the left, value on the
// right, both wrapping if the content demands it.
const InfoRow: React.FC<{ row: Row }> = ({ row }) => (
  <div className="flex items-start justify-between gap-3 py-[5px] text-[12.5px]">
    <span className="text-slate-500 shrink-0">{row.label}</span>
    <span className="min-w-0 text-right font-medium text-slate-900 break-words">
      {row.value}
    </span>
  </div>
);

// The Difficulty Distribution block — only rendered by DetailsPopover when
// the exercise actually has level-based buckets configured. Uses badges +
// numbers instead of a table so a two-line E / M / H reads at a glance.
const DifficultyBlock: React.FC<{
  levelBased: NonNullable<AssessmentDetails["levelBased"]>;
}> = ({ levelBased }) => {
  const rows = ([
    { tone: "emerald", label: "Easy",   count: levelBased.easy.count,   marks: levelBased.easy.marks },
    { tone: "amber",   label: "Medium", count: levelBased.medium.count, marks: levelBased.medium.marks },
    { tone: "rose",    label: "Hard",   count: levelBased.hard.count,   marks: levelBased.hard.marks },
  ] as const).filter((r) => r.count > 0 || r.marks > 0);
  const totalQ = rows.reduce((n, r) => n + r.count, 0);
  const totalM = rows.reduce((n, r) => n + r.marks, 0);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[12.5px]">
          <span className="inline-flex w-[68px] justify-start">
            <Chip tone={r.tone}>{r.label}</Chip>
          </span>
          <span className="flex-1 text-slate-700 tabular-nums">
            {r.count} {r.count === 1 ? "Question" : "Questions"}
          </span>
          {r.marks > 0 && (
            <span className="text-slate-900 font-semibold tabular-nums">
              {r.marks} Marks
            </span>
          )}
        </div>
      ))}
      {rows.length > 1 && (
        <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11.5px] font-medium text-slate-500">
          <span className="w-[68px]">Total</span>
          <span className="flex-1 tabular-nums">{totalQ} Questions</span>
          {totalM > 0 && <span className="tabular-nums text-slate-700">{totalM} Marks</span>}
        </div>
      )}
    </div>
  );
};

// The Sections block — rendered when the exercise is Section Based and the
// server returned a non-empty `sections[]`. Compact rows with the section
// name and its own Q + M counts.
const SectionsBlock: React.FC<{ sections: NonNullable<AssessmentDetails["sections"]> }> = ({ sections }) => (
  <div className="flex flex-col gap-1.5">
    {sections.map((s, i) => (
      <div key={`${s.name}-${i}`} className="flex items-center gap-2 text-[12.5px]">
        <span className="flex-1 min-w-0 truncate font-medium text-slate-800">{s.name}</span>
        {s.type && <Chip tone="slate">{s.type}</Chip>}
        {typeof s.questions === "number" && s.questions > 0 && (
          <span className="tabular-nums text-slate-600">{s.questions} Q</span>
        )}
        {typeof s.marks === "number" && s.marks > 0 && (
          <span className="tabular-nums text-slate-900 font-semibold">{s.marks} M</span>
        )}
      </div>
    ))}
  </div>
);

// Assessment Details popover — wider two-column layout, scrollable body,
// portaled to <body> so it never sits behind the sticky toolbar / table.
function DetailsPopover({ details }: { details: AssessmentDetails }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);

  const sections = useMemo(() => buildSections(details), [details]);
  const hasLevelBased = !!details.levelBased;
  const hasSections = !!(details.sections && details.sections.length);

  // Split the ordered section list into two visual columns. The left column
  // takes General / Structure / Difficulty; the right column takes Grading /
  // type-specific / Security. Keeps related information together on desktop
  // and lets each column grow independently.
  const leftBlocks: React.ReactNode[] = [];
  const rightBlocks: React.ReactNode[] = [];
  const sectionByTitle: Record<string, Section> = {};
  for (const s of sections) sectionByTitle[s.title] = s;

  const pushSection = (side: React.ReactNode[], title: string, body?: React.ReactNode) => {
    const s = sectionByTitle[title];
    if (!s && !body) return;
    side.push(
      <div key={title} className="flex flex-col">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {title}
        </div>
        {body ?? (
          <div className="divide-y divide-slate-100">
            {s!.rows.map((row) => <InfoRow key={row.label} row={row} />)}
          </div>
        )}
      </div>
    );
  };

  pushSection(leftBlocks, "General");
  pushSection(leftBlocks, "Assessment Structure");
  if (hasLevelBased) {
    pushSection(leftBlocks, "Difficulty Distribution", <DifficultyBlock levelBased={details.levelBased!} />);
  }
  if (hasSections) {
    pushSection(leftBlocks, "Sections", <SectionsBlock sections={details.sections!} />);
  }
  pushSection(rightBlocks, "Grading");
  pushSection(rightBlocks, "Programming");
  pushSection(rightBlocks, "MCQ");
  pushSection(rightBlocks, "Security");

  // Portaled + fixed-position placement. The AssessmentReportHeader is a
  // fixed-height `overflow-hidden` card and the sticky toolbar right beneath
  // it sits at z-30, so an absolute panel would either be clipped or hidden
  // behind that toolbar — both bugs the compact popover had before it moved
  // to a portal. Placement flips above the trigger when the viewport bottom
  // is too close, and clamps horizontally so the panel never overflows.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
      const h = popRef.current?.offsetHeight ?? PANEL_MAX_HEIGHT;
      const below = r.bottom + PANEL_GAP;
      const top = below + h > window.innerHeight - 12 && r.top - PANEL_GAP - h > 12
        ? r.top - PANEL_GAP - h
        : below;
      const left = Math.min(
        Math.max(12, r.left),
        Math.max(12, window.innerWidth - width - 12),
      );
      setPop({ top, left, width });
    };
    update();
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, sections.length, hasLevelBased, hasSections]);

  // No sections resolved → the exercise carries no configuration worth
  // showing. Suppress the icon entirely rather than opening an empty card.
  if (sections.length === 0 && !hasLevelBased && !hasSections) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Assessment details"
        aria-expanded={open}
        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${open
          ? "border-indigo-500 bg-indigo-50 text-indigo-600"
          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
          }`}
      >
        <Info size={11} strokeWidth={2.4} />
      </button>
      {open && pop && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Assessment Details"
          style={{
            position: "fixed",
            top: pop.top,
            left: pop.left,
            width: pop.width,
            maxHeight: PANEL_MAX_HEIGHT,
          }}
          className="z-[9999] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-16px_rgba(15,23,42,0.28)]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold leading-tight text-slate-900">
                Assessment Details
              </div>
              <div className="mt-0.5 text-[11.5px] text-slate-500">
                Configuration and grading information
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close details"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>

          {/* Body — scrolls when the sections overflow. */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
              <div className="flex flex-col gap-5">
                {leftBlocks}
              </div>
              <div className="flex flex-col gap-5">
                {rightBlocks}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function AssessmentReportHeader({
  title,
  chips: _chips,
  startDate,
  counts,
  imageUrl = "/active-images/result.png",
  details,
}: AssessmentReportHeaderProps) {
  return (
    <section
      // Was h-145px — user asked to reduce by ~20% → 116px. Same 4-metric
      // strip fits with tighter gaps between title and metrics.
      className="relative h-[116px] overflow-hidden rounded-xl border border-slate-200/70 bg-white"
    >
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 hidden h-auto max-w-none select-none lg:block"
        style={{ width: "clamp(760px, 52vw, 960px)", transform: "translateY(-54%)" }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white from-[0%] via-white/96 via-[30%] to-transparent to-[58%]" />
      <div className="pointer-events-none absolute left-[34%] top-[-18%] h-[190%] w-[26%] rounded-full bg-white/72 blur-[52px]" />
      <div className="pointer-events-none absolute inset-y-0 left-[42%] w-[16%] bg-gradient-to-r from-white/55 to-transparent blur-xl" />

      {/* Title + metrics stacked tightly (was justify-between which pushed
          the metrics all the way down the 145px block). Gap-2 keeps them
          close together in the shorter 116px shell. */}
      <div className="relative z-10 flex h-full flex-col justify-center gap-2 px-6 py-3 lg:w-[58%]">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            title={title}
            className="max-w-full truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-slate-950 xl:text-[16px]"
          >
            {title}
          </h1>
          {details && <DetailsPopover details={details} />}
        </div>

        <div className="flex max-w-[620px] items-center divide-x divide-slate-300/80">
          <MetricBlock
            value={counts.total}
            label="Total Students"
            icon={<Users size={16} strokeWidth={2} className="text-indigo-600" />}
          />
          <MetricBlock
            value={counts.inProgress}
            label="Started"
            icon={<PlayCircle size={16} strokeWidth={2} className="text-blue-600" />}
          />
          <MetricBlock
            value={counts.notStarted}
            label="Not Started"
            icon={<Clock3 size={16} strokeWidth={2} className="text-slate-500" />}
          />
          <MetricBlock
            value={counts.completed}
            label="Completed"
            icon={<CircleCheck size={16} strokeWidth={2} className="text-emerald-600" />}
          />
        </div>
      </div>

      {startDate && (
        <div className="absolute right-4 top-3 z-20 hidden items-center gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-md lg:flex">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <CalendarDays size={14} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Started
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[10.5px] font-semibold text-slate-900">
              {formatDateTime(startDate)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
