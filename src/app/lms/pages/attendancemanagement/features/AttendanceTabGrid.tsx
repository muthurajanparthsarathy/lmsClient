"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  MessageSquareWarning,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, Skeleton } from "@/app/lms/shared/ui";
import {
  STATUS_COLUMNS,
  statusHeadText,
  toneAllActive,
  type Student,
} from "@/app/lms/pages/attendancemanagement/features/attendanceTabShared";
import type { useAttendanceTab } from "@/app/lms/pages/attendancemanagement/features/useAttendanceTab";

type AttendanceTabState = ReturnType<typeof useAttendanceTab>;

export default function AttendanceTabGrid({
  loadingStudents,
  loadingAttendance,
  students,
  me,
  noRealBatches,
  visibleBatches,
  visibleStudents,
  attTableWrapRef,
  statusOf,
  locked,
  bulkAll,
  pagedStudents,
  attStart,
  cellOf,
  applyLocal,
  future,
  windowMissing,
  outsideWindow,
  attRangeFrom,
  attRangeTo,
  attTotalPages,
  setAttPage,
  attCurrent,
}: AttendanceTabState & {
  visibleStudents: Student[];
  pagedStudents: Student[];
  attStart: number;
  attRangeFrom: number;
  attRangeTo: number;
  attTotalPages: number;
  attCurrent: number;
}) {
  return (
      <div className="mt-3 flex-1 min-h-0 flex flex-col">
        {loadingStudents || loadingAttendance ? (
          <div className="flex-1 overflow-hidden">
            <div className="flex h-10 items-center gap-4 border-b border-hairline bg-canvas px-4">
              {["w-6", "w-40", "w-24", "w-16", "w-16", "w-16", "w-16"].map((w, i) => (
                <Skeleton key={i} className={`h-2.5 ${w}`} />
              ))}
            </div>
            {[...Array(9)].map((_, i) => (
              <div key={i} className="flex h-14 items-center gap-4 border-b border-hairline px-4">
                <Skeleton className="h-3 w-6" />
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            {!me.admin && !noRealBatches && visibleBatches.length === 0 ? (
              // A non-admin who is in none of this course's batches has no
              // roster to mark — say why instead of "no students".
              <EmptyState
                icon={Layers}
                title="No batch assigned to you"
                message="You can mark attendance only for batches you are enrolled in. Ask an administrator to add you to a batch of this course."
              />
            ) : (
              <EmptyState
                icon={Users}
                title={noRealBatches ? "No students enrolled" : "No students in this batch"}
                message={
                  noRealBatches
                    ? "This course has no enrolled students to mark attendance for yet."
                    : "This batch has no enrolled students yet — enrol students into it from the course's enrollment page."
                }
              />
            )}
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <EmptyState
              icon={Search}
              title="No students match your search"
              message="Try a different name, email, or enrollment number."
            />
          </div>
        ) : (
          <div ref={attTableWrapRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-sticky">
                <tr>
                  <th className="w-12 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">#</th>
                  <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Student</th>
                  <th className="w-32 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Roll No.</th>
                  {STATUS_COLUMNS.map(({ key, label }) => {
                    const allMarked =
                      students.length > 0 &&
                      students.every((s) => statusOf(s._id) === key);
                    return (
                      <th
                        key={key}
                        className="w-32 h-10 px-2 text-center align-middle bg-canvas border-b border-hairline"
                      >
                        <div className="flex flex-col items-center gap-0.5 leading-tight">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider ${statusHeadText[key]}`}>
                            {label}
                          </span>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => bulkAll(allMarked ? "" : key)}
                              title={
                                allMarked
                                  ? `Everyone is ${label} — click to clear all`
                                  : `Mark all students as ${label}`
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-chip border px-1.5 h-4 text-[9px] font-semibold transition-colors",
                                allMarked
                                  ? toneAllActive[key]
                                  : "border-hairline-strong bg-surface text-subtle hover:bg-row-hover"
                              )}
                            >
                              {allMarked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                              {allMarked ? "All" : "All"}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-28 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Remark</th>
                  <th className="w-12 h-10 px-2 align-middle bg-canvas border-b border-hairline" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {pagedStudents.map((s, idx) => {
                  const i = attStart + idx;
                  const cell = cellOf(s._id);
                  const status = cell?.status ?? "";
                  const fullName = `${s.firstName} ${s.lastName}`.trim() || "—";
                  const hasReason = (status === "A" || status === "H") && Boolean(cell?.reason);
                  return (
                    <tr key={s._id} className="group border-b border-hairline last:border-0 hover:bg-row-hover transition-colors duration-150">
                      <td className="h-14 px-3 align-middle text-[11px] tabular-nums text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="h-14 px-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-strong text-white flex items-center justify-center text-[10.5px] font-semibold flex-shrink-0 shadow-sm">
                            {(s.firstName?.[0] || "?").toUpperCase()}
                            {(s.lastName?.[0] || "").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-semibold text-heading truncate leading-tight">
                              {fullName}
                            </div>
                            {s.email && (
                              <div className="text-[10.5px] text-subtle truncate leading-tight">
                                {s.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="h-14 px-3 align-middle text-[11.5px] text-body whitespace-nowrap tabular-nums">
                        {s.userId || "—"}
                      </td>
                      {STATUS_COLUMNS.map(({ key, label }) => {
                        const on = status === key;
                        const tint =
                          key === "P"
                            ? on
                              ? "border-success-500 bg-success-50 text-success-700"
                              : "border-hairline bg-surface text-subtle hover:border-success-500/50 hover:bg-success-50/40"
                            : key === "A"
                              ? on
                                ? "border-danger-500 bg-danger-50 text-danger-700"
                                : "border-hairline bg-surface text-subtle hover:border-danger-500/50 hover:bg-danger-50/40"
                              : on
                                ? "border-warn-500 bg-warn-50 text-warn-700"
                                : "border-hairline bg-surface text-subtle hover:border-warn-500/50 hover:bg-warn-50/40";
                        const radioDot =
                          key === "P"
                            ? on ? "border-success-500 bg-success-500" : "border-hairline-strong bg-surface"
                            : key === "A"
                              ? on ? "border-danger-500 bg-danger-500" : "border-hairline-strong bg-surface"
                              : on ? "border-warn-500 bg-warn-500" : "border-hairline-strong bg-surface";
                        return (
                          <td key={key} className="h-14 px-2 align-middle text-center">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => applyLocal(s._id, on ? "" : key)}
                              title={
                                me.viewer
                                  ? "Read-only view — your role can review attendance but not mark it"
                                  : future
                                    ? "Future date — attendance can't be marked yet"
                                    : windowMissing
                                      ? "Set the Program Calendar first — attendance needs a training schedule"
                                      : outsideWindow
                                        ? "Outside the training window — attendance can't be marked"
                                        : on
                                          ? `Marked ${label} — click to clear`
                                          : `Mark ${label}`
                              }
                              className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                                tint,
                                locked && "opacity-40 cursor-not-allowed",
                                cell?.dirty && on && "ring-2 ring-brand/25 ring-offset-1"
                              )}
                            >
                              <span className={cn("inline-block h-3 w-3 rounded-full border-2 transition-colors", radioDot)} />
                              {label}
                            </button>
                          </td>
                        );
                      })}
                      <td className="h-14 px-3 align-middle text-[11px] text-body">
                        {status === "A" || status === "H" ? (
                          <div className="max-w-[180px]">
                            {status === "H" && cell?.halfPeriod && (
                              <span className="mr-1.5 inline-flex items-center rounded-chip bg-warn-50 border border-warn-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-warn-700">
                                {cell.halfPeriod === "first" ? "1st half" : "2nd half"}
                              </span>
                            )}
                            {cell?.reason ? (
                              <span className="break-words">{cell.reason}</span>
                            ) : (
                              <span className="italic text-faint">Asked on Save</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="h-14 px-2 align-middle text-right">
                        <button
                          type="button"
                          disabled={!(status === "A" || status === "H")}
                          title={
                            hasReason
                              ? cell?.reason
                              : status === "A" || status === "H"
                                ? "Reason will be asked on Save"
                                : "Remarks apply to Absent or Half-day only"
                          }
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-control border transition-colors",
                            hasReason
                              ? "border-warn-500/40 bg-warn-50 text-warn-700 hover:bg-warn-100"
                              : status === "A" || status === "H"
                                ? "border-hairline-strong bg-surface text-subtle hover:bg-row-hover"
                                : "border-hairline bg-surface text-faint cursor-not-allowed opacity-50"
                          )}
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination footer — compact borderless variant, orange active page,
            matches Course Setup's TableFooter language. */}
        {students.length > 0 && visibleStudents.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-2">
            <span className="text-xs tabular-nums text-subtle">
              Showing <b className="font-semibold text-heading">{attRangeFrom}</b>–<b className="font-semibold text-heading">{attRangeTo}</b> of <b className="font-semibold text-heading">{visibleStudents.length}</b> students
            </span>
            {attTotalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAttPage((p) => Math.max(1, p - 1))}
                  disabled={attCurrent <= 1}
                  aria-label="Previous page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: attTotalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAttPage(p)}
                    aria-current={attCurrent === p ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 min-w-[28px] items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors",
                      attCurrent === p
                        ? "bg-brand-wash text-brand-strong border border-brand-500/30"
                        : "text-subtle hover:bg-row-hover hover:text-body border border-transparent"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAttPage((p) => Math.min(attTotalPages, p + 1))}
                  disabled={attCurrent >= attTotalPages}
                  aria-label="Next page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
