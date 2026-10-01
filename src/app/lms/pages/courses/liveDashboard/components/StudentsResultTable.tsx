"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ExternalLink, MoreVertical, ClipboardList, RefreshCw, Video, MessageSquare,
  Zap, CircleCheck,
} from "lucide-react";

import type { StudentProgress } from "../types/liveDashboard.types";
import { getExerciseGradeBands, scaleForPercent, type GradeBand } from "../utils/computeStudentMarks";
import { deriveTestStatus } from "../utils/deriveTestStatus";
// Shared resolver so a bare Supabase filename / backend-relative path /
// absolute URL all render correctly. Also drives the initials fallback.
import { resolveAvatarUrl, initialsOfName } from "@/lib/avatarUrl";

// ── Overview tab — the learner list ─────────────────────────────────────────
//
// Five columns only:
//
//   Student · Test Status · Marks · Percentage · Scale
//
// Row click routes into the trainer's existing per-student grader. The
// per-question matrix, the assessment analytics strip, the printable-report
// modal and the popover have all moved out of this tab — either into the
// Questions tab or into the review page — so the Overview stays focussed on
// "who scored what".

export interface StudentsResultTableProps {
  students: StudentProgress[];
  assessmentId: string;
  assessmentName: string;
  courseData: any | null;
  courseId: string;
  isLoading: boolean;
  /** Primary Action button — navigates straight to the trainer's grading
   *  console for this learner. There is no intermediate list in between. */
  onOpenReview?: (studentId: string) => void;
  /** Kebab entry #1 — always available for a student who has an attempt.
   *  Opens the compact one-learner report overlay; onOpenReview is the
   *  deeper grading console. Kept as separate props so the two can diverge
   *  without a rewiring. */
  onOpenDetailedView?: (studentId: string) => void;
  /** Kebab entry #2 — shown only when the row's Test Status is Completed.
   *  Fires a "please retest" ping the student sees as a notification. The
   *  parent decides whether to POST it or open a confirm sheet first. */
  onRequestRetest?: (studentId: string) => void;
  /** Kebab entry #3 — shown only when the student's attempt has a stored
   *  video recording (`videoRecordingUrl` on StudentProgress). Opens the
   *  proctor's recording viewer for that attempt. */
  onOpenVideo?: (student: StudentProgress) => void;
  /** Kebab entry #4 — opens the parent's MessageStudentModal (SessionDetail
   *  owns the modal + the POST to /api/assessment/messages, which the
   *  student receives as a notification). */
  onSendMessage?: (student: StudentProgress) => void;
  /** Kebab entry #5 — re-score THIS learner's stored code against the
   *  question's current test cases. Only offered when the row's Test Status
   *  is Completed: there is nothing final to re-score until the learner has
   *  submitted. The parent owns the Yes/No confirm and the rerun panel. */
  onRerunStudent?: (student: StudentProgress) => void;
  search?: string;
  statusFilter?: string;
  toolbar?: React.ReactNode;
}


// Status → chip style. "Disconnected" is intentionally absent — the strict
// code-editor exit dialog now converts a genuine close into a Completed
// attempt, so `deriveTestStatus` no longer emits `disconnected`. If a stale
// `active + !isOnline` row still slips through, the pill falls back to
// "Not Started" via the default in `TestStatusPill`.
const COMPLETION_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  submitted: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  started: { label: "Started", bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  "awaiting-approval": { label: "Needs Approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  terminated: { label: "Terminated", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  "not-started": { label: "Not Started", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

function TestStatusPill({ status }: { status: string }) {
  const s = COMPLETION_STYLES[status] || COMPLETION_STYLES["not-started"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      {status === "submitted"
        ? <CircleCheck size={12} strokeWidth={2.4} aria-hidden="true" />
        : <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />}
      {s.label}
    </span>
  );
}

// Colour the scale badge by band position — lowest band → red, top band →
// emerald, mid bands → amber → sky (four-band default). Works for any
// custom band count the exercise's Grade Settings may configure.
function scaleTone(bandIndex: number, bandCount: number): {
  badgeBg: string; badgeText: string; barColor: string; dot: string;
} {
  if (bandCount <= 1) return { badgeBg: "bg-slate-50", badgeText: "text-slate-700", barColor: "bg-slate-400", dot: "bg-slate-400" };
  // Normalise into [0, 1]. 0 = worst, 1 = best.
  const t = bandIndex / (bandCount - 1);
  if (t < 0.25) return { badgeBg: "bg-red-50", badgeText: "text-red-700", barColor: "bg-red-500", dot: "bg-red-500" };
  if (t < 0.6) return { badgeBg: "bg-amber-50", badgeText: "text-amber-800", barColor: "bg-amber-500", dot: "bg-amber-500" };
  if (t < 0.85) return { badgeBg: "bg-sky-50", badgeText: "text-sky-700", barColor: "bg-sky-500", dot: "bg-sky-500" };
  return { badgeBg: "bg-emerald-50", badgeText: "text-emerald-700", barColor: "bg-emerald-500", dot: "bg-emerald-500" };
}

function ScaleBadge({
  label, bandIndex, bandCount,
}: { label: string; bandIndex: number; bandCount: number }) {
  const tone = scaleTone(bandIndex, bandCount);
  // Progress bar removed — the coloured pill + label (Poor / Average / Good
  // / Excellent) already tells the trainer where this learner sits on the
  // band, and the exact percentage lives in its own column just to the left.
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${tone.badgeBg} ${tone.badgeText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 25] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

// Compact vertical sort indicator — a stacked ↑↓ pair, both muted when the
// column isn't the active sort. Ascending lights the top chevron, descending
// lights the bottom one; the muted half stays visible so the affordance
// reads even when the column IS sorted (the user knows they can click again
// to flip / clear the sort).
function SortIndicator({ state }: { state: "none" | "asc" | "desc" }) {
  const upActive = state === "asc";
  const downActive = state === "desc";
  return (
    <span className="inline-flex flex-col leading-none" aria-hidden="true">
      <ChevronUp
        size={10}
        strokeWidth={3}
        className={`-mb-[3px] ${upActive ? "text-indigo-600" : "text-gray-300"}`}
      />
      <ChevronDown
        size={10}
        strokeWidth={3}
        className={downActive ? "text-indigo-600" : "text-gray-300"}
      />
    </span>
  );
}

// Sortable column header — a plain button so the click target covers the
// whole label plus its chevron, and the row's onClick is skipped via
// stopPropagation. The chevron sits on the header's TRAILING edge for
// right-aligned columns and follows the label for left-aligned ones so it
// never crashes into the numeric value one row below.
function SortableHeader<K extends string>({
  label, columnKey, align, active, dir, onToggle,
}: {
  label: string;
  columnKey: K;
  align: "left" | "right";
  active: K | null;
  dir: "asc" | "desc";
  onToggle: (k: K) => void;
}) {
  const isActive = active === columnKey;
  const state: "none" | "asc" | "desc" = isActive ? dir : "none";
  return (
    <button
      type="button"
      onClick={() => onToggle(columnKey)}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
      title={
        isActive
          ? dir === "asc"
            ? `Sorted by ${label}, ascending — click to sort descending`
            : `Sorted by ${label}, descending — click to clear sort`
          : `Sort by ${label}`
      }
      className={`inline-flex w-full cursor-pointer items-center gap-1.5 text-[11px] font-medium transition-colors ${
        align === "right" ? "justify-end" : "justify-start"
      } ${isActive ? "text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
    >
      <span>{label}</span>
      <SortIndicator state={state} />
    </button>
  );
}


function StudentAvatar({
  student,
}: {
  student: StudentProgress;
}) {
  // Route the raw User.profile string through the shared resolver — that is
  // what turns a bare Supabase filename ("abc.png") or backend-relative path
  // ("uploads/2026/a.png") into an addressable URL. Previously this
  // component used `student.profile` verbatim, so anything that wasn't
  // already an absolute https URL rendered as a broken image and fell back
  // to initials — which is exactly the "profile stored but not showing" bug.
  const src = resolveAvatarUrl(student.profile);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={student.studentName || "Student"}
        // Supabase serves these public objects cross-origin; `no-referrer`
        // keeps the request working under the app's COEP header — same
        // treatment the review console's StudentAvatar uses.
        referrerPolicy="no-referrer"
        decoding="async"
        onError={() => setImageFailed(true)}
        className="h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover"
      />
    );
  }

  // Two-letter initials fallback ("Ananya Iyer" → "AI") — matches the review
  // console pattern. Falls back to one letter for single-name accounts and
  // "?" when the record has no name at all.
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10.5px] font-semibold text-indigo-700"
      title={student.studentName}
    >
      {initialsOfName(student.studentName)}
    </div>
  );
}

// Sortable column keys. `action` isn't sortable — a per-row navigate button
// has no natural order.
type SortKey = "student" | "status" | "marks" | "percent" | "scale";
type SortDir = "asc" | "desc";

// Order buckets used for the Test Status sort. Matches the reading order the
// trainer sees in the metric strip (Started → Not Started → Completed) so the
// three views (strip, filter dropdown, sorted table) stay coherent.
const STATUS_ORDER: Record<string, number> = {
  "started": 0,
  "awaiting-approval": 1,
  "terminated": 2,
  "not-started": 3,
  "submitted": 4,
};

export default function StudentsResultTable({
  students,
  assessmentId,
  courseData,
  isLoading,
  onOpenReview,
  onOpenDetailedView,
  onRequestRetest,
  onOpenVideo,
  onSendMessage,
  onRerunStudent,
  search = "",
  statusFilter = "all",
  toolbar,
}: StudentsResultTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  // Which row's kebab menu is currently open. One at a time so background
  // clicks or a fresh kebab open collapse the previous popover.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: MouseEvent) => {
      if (menuRootRef.current && !menuRootRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenuId(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);
  // Three-state sort cycle: none → asc → desc → none. The default (`null`)
  // preserves whatever order the parent handed in (which is already sorted
  // by the roster/attempt fetch), so the initial view isn't re-shuffled the
  // moment the table mounts. Clicking a different column snaps sortKey to
  // it in `asc`; clicking the SAME column walks the cycle.
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const toggleSort = useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev !== k) {
        setSortDir("asc");
        return k;
      }
      // Same column — walk asc → desc → cleared.
      let cleared = false;
      setSortDir((d) => {
        if (d === "asc") return "desc";
        cleared = true;
        return "asc";
      });
      return cleared ? null : prev;
    });
  }, []);

  // Per-exercise grade bands — configured by the trainer under Grade
  // Settings; falls back to the LMS default (Poor / Average / Good /
  // Excellent) when the exercise has none.
  const bands: GradeBand[] = useMemo(
    () => getExerciseGradeBands(courseData, assessmentId),
    [courseData, assessmentId],
  );
  const bandIndexOf = useCallback((label: string): number => {
    for (let i = 0; i < bands.length; i++) if (bands[i].label === label) return i;
    return -1;
  }, [bands]);

  // Filter by search + Test Status — same shape SessionDetail hands in.
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const name = (s.studentName || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const regNo = (s.studentDisplayId || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !regNo.includes(q)) return false;
      }
      if (statusFilter && statusFilter !== "all") {
        if (deriveTestStatus(s) !== statusFilter) return false;
      }
      return true;
    });
  }, [students, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, students.length, pageSize, sortKey, sortDir]);

  // Sort AFTER filter and BEFORE pagination so the currently-visible page
  // always shows the top N of what the trainer asked for, not the first N
  // of the raw list. Null/undefined bubble to the bottom in both directions
  // — a learner with no score sorted "ascending" would otherwise appear
  // above a learner who scored 0/50, which reads wrong.
  //
  // `sortKey === null` is the third-click / initial state: return the parent
  // order untouched so clicking a sorted column a third time visibly resets
  // the table instead of leaving it in the last direction.
  const sortedStudents = useMemo(() => {
    if (sortKey === null) return filteredStudents;
    const arr = filteredStudents.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    const cmpNumWithNulls = (a: number | null | undefined, b: number | null | undefined) => {
      const aNull = a == null;
      const bNull = b == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;   // nulls sink regardless of direction
      if (bNull) return -1;
      return ((a as number) - (b as number)) * dir;
    };
    const percentOf = (s: StudentProgress): number | null => {
      if (s.scoredMarks == null || !s.totalMarks) return null;
      return s.scoredMarks / s.totalMarks;
    };
    arr.sort((a, b) => {
      switch (sortKey) {
        case "student":
          return (a.studentName || "").localeCompare(b.studentName || "") * dir;
        case "status": {
          const aRank = STATUS_ORDER[deriveTestStatus(a)] ?? 99;
          const bRank = STATUS_ORDER[deriveTestStatus(b)] ?? 99;
          return (aRank - bRank) * dir;
        }
        case "marks":
          return cmpNumWithNulls(a.scoredMarks ?? null, b.scoredMarks ?? null);
        case "percent":
          return cmpNumWithNulls(percentOf(a), percentOf(b));
        case "scale": {
          // Scale sorts by band index (Poor = 0, Excellent = last). Falls
          // back to the percent sort for two learners in the same band so
          // the order within a band is still meaningful.
          const pa = percentOf(a);
          const pb = percentOf(b);
          if (pa == null && pb == null) return 0;
          if (pa == null) return 1;
          if (pb == null) return -1;
          const ba = bandIndexOf(scaleForPercent(Math.round(pa * 100), bands));
          const bb = bandIndexOf(scaleForPercent(Math.round(pb * 100), bands));
          if (ba !== bb) return (ba - bb) * dir;
          return (pa - pb) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredStudents, sortKey, sortDir, bands, bandIndexOf]);

  const totalFiltered = sortedStudents.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalFiltered);
  const pagedStudents = sortedStudents.slice(startIdx, endIdx);

  const handleRowClick = useCallback((student: StudentProgress) => {
    if (onOpenReview) onOpenReview(student.id);
  }, [onOpenReview]);

  if (isLoading && students.length === 0) {
    return <div className="p-8 text-center text-[13px] text-gray-400">Loading learners…</div>;
  }

  if (!students.length) {
    return <div className="p-8 text-center text-[13px] text-gray-400">No learners are enrolled in this assessment yet.</div>;
  }

  // Table header top-offset — matches the sticky toolbar height in
  // SessionDetail (h-10 input + py-2 wrapper + 1px bottom border). Keeping
  // this in one place so the two sticky layers stack cleanly.
  const THEAD_TOP = 57;

  return (
    <div className="flex flex-col gap-2">
      {/* No fixed-height wrapper — the row list flows into the LMS <main>
          scroll, and the <thead> below is sticky at THEAD_TOP so it stays
          visible while learners scroll under it. `overflow-visible` is
          explicit so a nested scroll container doesn't hijack sticky.
          `border-separate` + `border-spacing-0` lets us apply rounded corners
          + per-cell borders reliably — the default `border-collapse: collapse`
          drops <tr> backgrounds and border-radii on WebKit, which showed as
          the "white corner behind the gray header" glitch and as rows whose
          first-column bottom border went missing after a hover repaint. */}
      <div className="border border-indigo-100 rounded-lg bg-white overflow-visible">
        {toolbar}
        <table className="min-w-full text-[12.5px] border-separate border-spacing-0">
          <thead>
            <tr
              className="sticky z-20 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
              style={{ top: THEAD_TOP }}
            >
              {/* Header labels use title case (first-letter capital only) —
                  tracking-wider dropped along with `uppercase` so lower-case
                  letters don't sit in a stretched grid. `bg-gray-50` is on
                  every <th> because <tr> backgrounds don't paint under
                  border-collapse rules; first/last <th> pick up the top
                  rounded corners so the gray header meets the outer border
                  cleanly instead of leaving a white notch. Sortable columns
                  wrap their label in a SortableHeader button — a chevron on
                  the right shows the current sort direction, muted for
                  inactive columns so the eye can pick out the active one. */}
              {/* Column budget: # 44 · Reg No 120 · Student flex · Test
                  Status 130 · Marks 108 · Percentage 104 · Scale 128 · Action
                  144 — reg number moved in front of the student cell so the
                  trainer can scan a class roster left-to-right the same way
                  their spreadsheet is ordered. Total fixed budget ~778px;
                  the Student column absorbs the rest of the row's width so
                  the name + email still get all the breathing room they need
                  on a wide viewport. Scale trimmed 170 → 128 and its left
                  padding restored to px-3 — the empty right-side gutter on a
                  short label like "Poor" is gone. */}
              <th className="rounded-tl-lg border-b border-gray-200 px-3 py-2 text-center text-[11px] font-medium text-gray-500 w-11 bg-gray-50">
                #
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-medium text-gray-500 w-[120px] bg-gray-50">
                Reg No
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-medium text-gray-500 min-w-[220px] bg-gray-50">
                <SortableHeader label="Student" columnKey="student" align="left" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-medium text-gray-500 w-[130px] bg-gray-50">
                <SortableHeader label="Test Status" columnKey="status" align="left" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-right text-[11px] font-medium text-gray-500 w-[108px] bg-gray-50">
                <SortableHeader label="Marks" columnKey="marks" align="right" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-right text-[11px] font-medium text-gray-500 w-[104px] bg-gray-50">
                <SortableHeader label="Percentage" columnKey="percent" align="right" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-medium text-gray-500 w-[128px] bg-gray-50">
                <SortableHeader label="Scale" columnKey="scale" align="left" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </th>
              <th className="rounded-tr-lg border-b border-gray-200 px-3 py-2 text-center text-[11px] font-medium text-gray-500 w-[144px] bg-gray-50">
                Action
              </th>
            </tr>
          </thead>
            <tbody>
              {pagedStudents.map((s, i) => {
                // Page-relative ordinal — restarts at 1 on every page so the
                // number the trainer reads matches "row N on this page",
                // which is what they cite when talking through the console.
                const rowNumber = i + 1;
                const status = deriveTestStatus(s);
                const finished = status === "submitted";
                const marksPending = s.scoredMarks == null;
                const scored = s.scoredMarks == null ? null : Math.round((s.scoredMarks) * 10) / 10;
                const outOf = s.totalMarks ?? 0;
                const marksDisplay = scored == null
                  ? "—"
                  : `${scored}${outOf > 0 ? ` / ${outOf}` : ""}`;
                const percent = scored != null && outOf > 0
                  ? Math.round((scored / outOf) * 100)
                  : null;
                const scaleLabel = percent != null ? scaleForPercent(percent, bands) : "";
                const bandIndex = scaleLabel ? bandIndexOf(scaleLabel) : -1;
                return (
                  <tr
                    key={s.id}
                    // Row separator moved from <tr> onto every <td> via the
                    // `[&>td]:border-b` arbitrary variant — under
                    // `border-separate` a <tr> border simply isn't painted,
                    // which is what left every first-column bottom edge
                    // missing after the layout change. Hover tint stays on
                    // the row so all cells wash together on hover.
                    className="group cursor-pointer h-[46px] hover:bg-indigo-50/40 [&>td]:border-b [&>td]:border-gray-100"
                    onClick={() => handleRowClick(s)}
                    title="Open the review submission for this learner in a new tab"
                  >
                    <td className="w-11 px-3 py-1.5 text-center text-[11.5px] font-medium text-gray-500 tabular-nums">
                      {rowNumber}
                    </td>
                    {/* Reg No — pulled out of the student sub-line into its
                        own column so a class roster reads left-to-right in
                        the same order as the trainer's spreadsheet. Falls
                        back to em-dash when the user has no roll number
                        recorded, matching every other "no data" cell here. */}
                    <td className="w-[120px] px-3 py-1.5 text-[12px] font-medium text-gray-700 tabular-nums">
                      {s.studentDisplayId ? (
                        <span className="block max-w-[110px] truncate" title={s.studentDisplayId}>
                          {s.studentDisplayId}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <StudentAvatar student={s} />
                        <div className="min-w-0">
                          <div className="max-w-[220px] truncate text-[12.5px] font-semibold leading-[16px] text-gray-900">
                            {s.studentName}
                          </div>
                          {/* Reg No lives in its own column now, so the
                              secondary line drops to email-only. Kept as an
                              em-dash when the learner also has no email so
                              the row height stays uniform. */}
                          <div className="max-w-[220px] truncate text-[10.5px] leading-[14px] text-gray-500">
                            {s.email || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[130px] px-3 py-1.5">
                      <TestStatusPill status={status} />
                    </td>
                    <td className="w-[108px] px-3 py-1.5 text-right">
                      {marksPending && !finished ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : marksPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                          Pending
                        </span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-gray-800 tabular-nums">
                          {marksDisplay}
                        </span>
                      )}
                    </td>
                    <td className="w-[104px] px-3 py-1.5 text-right">
                      {percent == null ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-gray-800 tabular-nums">{percent}%</span>
                      )}
                    </td>
                    <td className="w-[128px] px-3 py-1.5">
                      {percent == null || !scaleLabel ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : (
                        <ScaleBadge
                          label={scaleLabel}
                          bandIndex={bandIndex}
                          bandCount={bands.length}
                        />
                      )}
                    </td>
                    <td className="w-[144px] px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      {/* Action = Review button (primary, opens in new tab)
                          + kebab menu with per-row shortcuts. A Not Started
                          row has no attempt to open, so we still show an
                          em-dash. Everything else — Started / Completed /
                          Terminated / Needs Approval — gets the pair. */}
                      {status === "not-started" ? (
                        <div className="text-center text-[11.5px] text-gray-400">—</div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {onOpenReview && (
                            <button
                              type="button"
                              onClick={() => onOpenReview(s.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                              title="Open this learner's grading console"
                            >
                              {finished ? "Review" : "View"}
                              <ExternalLink size={11} strokeWidth={2.5} />
                            </button>
                          )}
                          {/* Kebab — Detailed view + conditional Retest /
                              Video / Message. Only mounted when at least one
                              menu entry is available; the button always
                              renders so the row layout stays uniform. */}
                          <div className="relative" ref={openMenuId === s.id ? menuRootRef : null}>
                            <button
                              type="button"
                              aria-label="More actions"
                              aria-haspopup="menu"
                              aria-expanded={openMenuId === s.id}
                              onClick={() => setOpenMenuId((id) => id === s.id ? null : s.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              title="More actions"
                            >
                              <MoreVertical size={13} />
                            </button>
                            {openMenuId === s.id && (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                              >
                                {onOpenDetailedView && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { onOpenDetailedView(s.id); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                                  >
                                    <ClipboardList size={13} className="text-gray-400" />
                                    Detailed View
                                  </button>
                                )}
                                {/* Retest — only for a finished attempt. Live
                                    attempts don't need it; not-started rows
                                    are already gated out above. */}
                                {onRequestRetest && status === "submitted" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { onRequestRetest(s.id); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                                  >
                                    <RefreshCw size={13} className="text-gray-400" />
                                    Request for Retest
                                  </button>
                                )}
                                {/* Rerun — re-score this learner against the
                                    question's CURRENT test cases. Same
                                    Completed-only gate as Retest: a live
                                    attempt's code is still moving, so
                                    re-scoring it would be meaningless. The
                                    parent asks Yes/No before anything runs. */}
                                {onRerunStudent && status === "submitted" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { onRerunStudent(s); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                                  >
                                    <Zap size={13} className="text-gray-400" />
                                    Rerun
                                  </button>
                                )}
                                {/* Video Assessment — only when the recording
                                    actually made it to storage AND the
                                    attempt is finished. A live attempt has
                                    no complete recording yet, and an absent
                                    URL means the pipeline dropped it or
                                    proctoring never captured one. */}
                                {onOpenVideo && status === "submitted" && !!s.videoRecordingUrl && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { onOpenVideo(s); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                                  >
                                    <Video size={13} className="text-gray-400" />
                                    Video Assessment
                                  </button>
                                )}
                                {onSendMessage && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { onSendMessage(s); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                                  >
                                    <MessageSquare size={13} className="text-gray-400" />
                                    Send Message
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pagedStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12.5px] text-gray-400">
                    No learners match this search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      <div className="flex items-center justify-between gap-3 rounded-b-lg border-t border-indigo-100 bg-white px-3 py-2 text-[11px] text-gray-500">
        <div>
          {totalFiltered === 0
            ? "0 learners"
            : `${totalFiltered} ${totalFiltered === 1 ? "learner" : "learners"}`}
        </div>
        {totalFiltered > pageSize && <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - safePage) <= 2 || n === 1 || n === pageCount)
              .reduce((acc: (number | "gap")[], n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("gap");
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) => n === "gap" ? (
                <span key={`g${i}`} className="px-1 text-gray-400">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n as number)}
                  className={`h-7 min-w-[28px] px-1 rounded-md border text-[11.5px] tabular-nums ${
                    n === safePage
                      ? "bg-gray-900 text-white border-gray-900"
                      : "text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight size={12} />
            </button>
          </div>
          <label className="flex items-center gap-1 text-[11px] text-gray-500 ml-1">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
              className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[11.5px] text-gray-700 outline-none focus:border-indigo-400"
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>/ page</span>
          </label>
        </div>}
      </div>
      </div>
    </div>
  );
}
