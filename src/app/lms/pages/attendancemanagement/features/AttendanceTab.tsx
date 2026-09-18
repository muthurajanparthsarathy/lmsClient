"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Management — single-day attendance sheet.
// - Rows: students enrolled in the course with role === 'student'.
// - One date at a time — picked via the ?date= param (layout header owns the
//   date picker); defaults to today.
// - Columns: Present / Absent / Half-day, one checkbox per student per column
//   (mutually exclusive). Each column header carries a labelled "Select all"
//   checkbox that marks the whole class at once.
// - Marks are LOCAL only until the "Save changes" bar below the grid is
//   clicked. On save, every dirty A (absent/leave) and H (half-day) mark must
//   get a reason — collected in one modal listing all of them.
// - Sessions are intentionally OUT of scope for this pass (server model has an
//   optional sessionId slot ready for a follow-up).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from "react";
import {
  FileText,
  FileSpreadsheet,
  Check,
  Clock,
  Layers,
  MoreHorizontal,
  Search,
  X,
  Users,
} from "lucide-react";
import { fmt, fmtWeekday, isWeekend } from "@/app/lms/pages/attendancemanagement/features/attendanceTabShared";
import StyledSelect from "@/app/lms/pages/attendancemanagement/features/AttendanceTabStyledSelect";
import ReasonsModal from "@/app/lms/pages/attendancemanagement/features/AttendanceTabReasonsModal";
import AttendanceTabGrid from "@/app/lms/pages/attendancemanagement/features/AttendanceTabGrid";
import { useAttendanceTab } from "@/app/lms/pages/attendancemanagement/features/useAttendanceTab";
import { createAttendanceTabExports } from "@/app/lms/pages/attendancemanagement/features/attendanceTabExports";

// ── Component ──────────────────────────────────────────────────────────────
interface AttendanceTabProps {
  courseId: string;
  onResetHandled?: () => void;
  resetSignal?: number; // parent bumps this to trigger a reset confirm from outside
}

export default function AttendanceTab({ courseId }: AttendanceTabProps) {
  const tab = useAttendanceTab(courseId);
  const {
    studentSearch, setStudentSearch, students, statusOf, selectedBatchId, setSelectedBatchId, dayKey,
    attTableWrapRef, attPage, setAttPage, attPageSize, setAttPageSize, fromLdc, selectedDay, future,
    trainingWindow, windowError, windowMissing, beforeStart, afterEnd, fmtWindowDay, visibleBatches, me,
    dirtyCells, setPendingBatchId, pendingBatchId, discardChanges, saving, handleSaveChanges,
    reasonModalItems, setReasonModalItems, persistAll, reportPicker, setReportPicker,
  } = tab;
  const { handlePickFormat } = createAttendanceTabExports(tab);

  // ── Derived view state ──────────────────────────────────────────────────
  // Search is display-only; marking + bulk still act on the full class so
  // "mark all" always means the whole roster, not just what's on screen.
  const searchQ = studentSearch.trim().toLowerCase();
  const visibleStudents = searchQ
    ? students.filter(
        (s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQ) ||
          (s.email || "").toLowerCase().includes(searchQ) ||
          (s.userId || "").toLowerCase().includes(searchQ)
      )
    : students;

  let sumP = 0;
  let sumA = 0;
  let sumH = 0;
  for (const s of students) {
    const st = statusOf(s._id);
    if (st === "P") sumP++;
    else if (st === "A") sumA++;
    else if (st === "H") sumH++;
  }
  const sumNot = students.length - sumP - sumA - sumH;

  // Auto-fit page size — measure the tbody's real budget and slice.
  useEffect(() => { setAttPage(1); }, [studentSearch, selectedBatchId, dayKey, setAttPage]);
  useEffect(() => {
    const el = attTableWrapRef.current;
    if (!el) return;
    const FALLBACK = 56;
    const recompute = () => {
      const thead = el.querySelector<HTMLElement>("thead");
      const firstRow = el.querySelector<HTMLElement>("tbody tr");
      const theadH = thead ? thead.getBoundingClientRect().height : 40;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : FALLBACK;
      // Aggressive rounding: reclaim the last partial-row slot whenever the
      // leftover is >= 30 % of a row. That trailing partial row's own hairline
      // border sits over the tile's border, so the visual clip is negligible.
      // +0.35 bias: reclaim the trailing slot whenever ≥ 15 % of a row's
      // worth of pixels are left after fitting N rows. Aggressive but the
      // tile clips cleanly so a slight overhang is invisible.
      const budget = Math.max(0, el.clientHeight - theadH);
      const rows2 = Math.max(1, Math.min(100, Math.round(budget / Math.max(1, rowH) + 0.35)));
      setAttPageSize((prev) => (prev === rows2 ? prev : rows2));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    const raf = requestAnimationFrame(recompute);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [visibleStudents.length, attTableWrapRef, setAttPageSize]);
  const attTotalPages = Math.max(1, Math.ceil(visibleStudents.length / attPageSize));
  const attCurrent = Math.min(attPage, attTotalPages);
  const attStart = (attCurrent - 1) * attPageSize;
  const attEnd = attStart + attPageSize;
  const pagedStudents = visibleStudents.slice(attStart, attEnd);
  const attRangeFrom = visibleStudents.length === 0 ? 0 : attStart + 1;
  const attRangeTo = Math.min(attEnd, visibleStudents.length);

  // ── Render ─────────────────────────────────────────────────────────────
  // Blocking-state banner text: consolidated from the old row of StatusPills
  // into ONE line so the toolbar row can be the reference's clean
  // Search + Batch. Marking still locks the same way it always did — the
  // message just moved to a single strip.
  const blockingMessage = fromLdc
    ? ""
    : isWeekend(selectedDay)
      ? "Weekend — marking disabled"
      : future
        ? "Future date — marking disabled"
        : trainingWindow === undefined && !windowError
          ? "Checking training window…"
          : windowError
            ? "Couldn't check the training window — reload to retry"
            : windowMissing
              ? "Set the Program Calendar first — attendance needs a training schedule"
              : beforeStart
                ? `Training starts ${fmtWindowDay(trainingWindow?.startDate)} — marking disabled`
                : afterEnd
                  ? `Training ended ${fmtWindowDay(trainingWindow?.endDate)} — marking disabled`
                  : "";

  const summaryCards: {
    key: string;
    label: string;
    value: number;
    iconBg: string;
    iconText: string;
    valueText: string;
    icon: React.ReactNode;
  }[] = [
    { key: "total", label: "Total Students", value: students.length, iconBg: "bg-info-50",    iconText: "text-info-700",    valueText: "text-heading",     icon: <Users className="h-4 w-4" /> },
    { key: "P",     label: "Present",        value: sumP,             iconBg: "bg-success-50", iconText: "text-success-700", valueText: "text-success-700", icon: <Check className="h-4 w-4" strokeWidth={3} /> },
    { key: "A",     label: "Absent",         value: sumA,             iconBg: "bg-danger-50",  iconText: "text-danger-700",  valueText: "text-danger-700",  icon: <X className="h-4 w-4" strokeWidth={3} /> },
    { key: "H",     label: "Half-day",       value: sumH,             iconBg: "bg-warn-50",    iconText: "text-warn-700",    valueText: "text-warn-700",    icon: <Clock className="h-4 w-4" /> },
    { key: "N",     label: "Not marked",     value: sumNot,           iconBg: "bg-ink-100",    iconText: "text-subtle",      valueText: "text-heading",     icon: <MoreHorizontal className="h-4 w-4" /> },
  ];

  return (
    <div className="h-full flex flex-col px-1">
      {/* Summary cards — five compact blocks (Total / Present / Absent /
          Half-day / Not marked). Sits directly under the shell header and
          matches the reference reads. */}
      <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {summaryCards.map((c) => (
          <div key={c.key} className="flex items-center gap-3 rounded-tile border border-hairline bg-surface px-3 py-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${c.iconBg} ${c.iconText} flex-shrink-0`}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-subtle leading-tight">{c.label}</div>
              <div className={`text-lg font-bold tabular-nums leading-tight ${c.valueText}`}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Blocking-state banner — single strip that replaces the old row of
          StatusPills. Only rendered when marking is actually locked. */}
      {blockingMessage && (
        <div className="mt-2.5 rounded-control border border-warn-500/30 bg-warn-50 px-3 py-1.5 text-[11.5px] font-medium text-warn-700">
          {blockingMessage}
        </div>
      )}

      {/* Search + Batch — reference layout: Search flush left, Batch picker
          flush right. Reused StyledSelect for the batch dropdown (keeps the
          dirty-cell guard on batch switch). */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search students…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
          />
          {studentSearch && (
            <button
              type="button"
              onClick={() => setStudentSearch("")}
              aria-label="Clear student search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {visibleBatches.length > 0 && (
            <StyledSelect
              label="Batch"
              ariaLabel="Select batch"
              icon={<Layers size={13} className="text-brand-500" aria-hidden />}
              value={selectedBatchId || ""}
              onChange={(nextId) => {
                if (nextId === selectedBatchId) return;
                if (dirtyCells.length > 0) { setPendingBatchId(nextId); return; }
                setSelectedBatchId(nextId);
              }}
              options={visibleBatches.map((b) => ({
                value: b._id,
                label: `${b.batchName} (${b.students.length})`,
              }))}
            />
          )}
        </div>
      </div>
      {!me.admin && !me.viewer && visibleBatches.length > 0 && (
        <p className="mt-1 text-2xs text-faint">Showing the batches you belong to.</p>
      )}

      {/* Grid — borderless table on the page ground, matching Course Setup.
          No outer card / shadow / rounded box, just a scroll region with
          per-row hairlines. */}
      <AttendanceTabGrid
        {...tab}
        visibleStudents={visibleStudents}
        pagedStudents={pagedStudents}
        attStart={attStart}
        attRangeFrom={attRangeFrom}
        attRangeTo={attRangeTo}
        attTotalPages={attTotalPages}
        attCurrent={attCurrent}
      />

      {/* Save-changes bar — appears once anything is marked but not saved. */}
      {dirtyCells.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50/70 px-3 py-2">
          <span className="text-[12px] font-medium text-brand-800">
            {dirtyCells.length} unsaved change{dirtyCells.length === 1 ? "" : "s"}
            <span className="ml-1.5 font-normal text-brand-500">
              — nothing is saved until you click Save changes.
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="h-8 px-3 rounded-md border border-ink-200 bg-white text-[12px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold disabled:opacity-50"
            >
              {saving && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Reasons modal — every dirty A / H mark needs a reason before save. */}
      {reasonModalItems && (
        <ReasonsModal
          items={reasonModalItems}
          saving={saving}
          onChange={(index, patch) =>
            setReasonModalItems((prev) =>
              prev ? prev.map((it, i) => (i === index ? { ...it, ...patch } : it)) : prev
            )
          }
          onClose={() => setReasonModalItems(null)}
          onSave={() => {
            const byKey = new Map(
              reasonModalItems.map((it) => [
                `${it.studentId}|${it.dateKey}`,
                { reason: it.reason.trim(), halfPeriod: it.halfPeriod },
              ])
            );
            void persistAll(byKey);
          }}
        />
      )}

      {/* Report format picker */}
      {/* Discard-confirm — switching batches with unsaved marks. Same modal
          idiom as the pickers below; outside click and Stay both keep the
          user on the current batch with their marks intact. */}
      {pendingBatchId && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
          onClick={() => setPendingBatchId(null)}
        >
          <div
            className="w-full max-w-sm rounded-tile border border-hairline bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-ink-900">
              Discard unsaved marks?
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              {dirtyCells.length} unsaved change{dirtyCells.length === 1 ? "" : "s"} on{" "}
              <span className="font-semibold text-ink-700">
                {visibleBatches.find((b) => b._id === selectedBatchId)?.batchName || "this batch"}
              </span>{" "}
              will be lost if you switch to{" "}
              <span className="font-semibold text-ink-700">
                {visibleBatches.find((b) => b._id === pendingBatchId)?.batchName || "the other batch"}
              </span>
              . Save changes first to keep them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingBatchId(null)}
                className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchId(pendingBatchId);
                  setPendingBatchId(null);
                }}
                className="h-8 px-3 rounded-md bg-danger-500 hover:bg-danger-700 text-white text-[12px] font-semibold"
              >
                Discard &amp; switch
              </button>
            </div>
          </div>
        </div>
      )}

      {reportPicker && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
          onClick={() => setReportPicker(null)}
        >
          <div
            className="w-full max-w-sm rounded-tile border border-hairline bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-ink-900">
              {reportPicker === "attendance"
                ? "Download Attendance Report"
                : "Download Remarks Report"}
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              Date: {fmt(selectedDay)} ({fmtWeekday(selectedDay)}) · Pick a format.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePickFormat("excel")}
                className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink-200 rounded-md hover:border-success-500/40 hover:bg-success-50/40 transition-colors"
              >
                <FileSpreadsheet className="h-7 w-7 text-success-700" />
                <span className="text-[13px] font-semibold text-ink-900">Excel</span>
                <span className="text-[10px] text-ink-500">.xlsx with filters</span>
              </button>
              <button
                onClick={() => handlePickFormat("pdf")}
                className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink-200 rounded-md hover:border-danger-500/40 hover:bg-danger-50/40 transition-colors"
              >
                <FileText className="h-7 w-7 text-danger-700" />
                <span className="text-[13px] font-semibold text-ink-900">PDF</span>
                <span className="text-[10px] text-ink-500">.pdf landscape</span>
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setReportPicker(null)}
                className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
