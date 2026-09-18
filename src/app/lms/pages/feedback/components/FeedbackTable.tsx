"use client";
import React from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown, Star } from "lucide-react";
import { StatusPill } from "../../../shared/ui";
import type { FeedbackRow, SortDir, SortKey } from "./types";

// The student Feedback data grid — a sibling of User Management's UsersTable,
// deliberately built to the SAME metrics so the two lists read as one table on
// two routes: 36px header row (h-9), 48px body row (h-12), fixed layout with
// percentage columns, sticky header, one line per row.
//
// It owns NO data or business logic: rows, sorting and the row action all
// arrive as props from page.tsx, exactly as UsersTable takes them from the
// User Management page.

interface FeedbackTableProps {
  rows: FeedbackRow[];
  isLoading: boolean;
  skeletonRows: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  renderActions: (row: FeedbackRow) => React.ReactNode;
  emptyState: React.ReactNode;
}

// Per-column widths. `table-layout: fixed`, so these widths ARE the layout:
// cells clip and ellipsize instead of stretching, which keeps every row exactly
// one line tall and the table inside its container with no horizontal
// scrollbar — the User Management / Client Management arrangement.
//
// The percentages sum to exactly 100. Batch drops out below `lg` (it is the
// least load-bearing column and is "—" on most rows), the same way User
// Management sheds its Phone column.
const COL = {
  form: "w-[22%] pl-4 sm:pl-5 pr-3 text-left",
  course: "w-[16%] px-3 text-left",
  trainer: "w-[12%] px-3 text-left",
  batch: "w-[9%] px-3 text-left hidden lg:table-cell",
  start: "w-[8%] px-3 text-left whitespace-nowrap",
  end: "w-[8%] px-3 text-left whitespace-nowrap",
  status: "w-[8%] px-3 text-right whitespace-nowrap",
  // Wide enough for the "Give feedback" button at its longest — under ~15%
  // the button wraps and the row loses its 48px.
  action: "w-[17%] pl-2 pr-4 sm:pr-5 text-right",
};

const HEAD_CELL =
  "h-9 text-xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";
const BODY_CELL = "h-12 align-middle";
const BAR = "h-3 rounded bg-ink-100 animate-pulse";

const fmtDate = (iso: string | undefined | null): string => {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return String(iso);
  return new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function SortButton({
  label,
  columnKey,
  active,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  columnKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-heading transition-colors duration-150 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp size={13} className="text-brand" />
        ) : (
          <ChevronDown size={13} className="text-brand" />
        )
      ) : (
        <ChevronsUpDown size={13} className="text-line-muted" />
      )}
    </button>
  );
}

export function FeedbackTable({
  rows,
  isLoading,
  skeletonRows,
  sortKey,
  sortDir,
  onSort,
  renderActions,
  emptyState,
}: FeedbackTableProps) {
  // form + course + trainer + batch + start + end + status + action
  const COL_SPAN = 8;

  return (
    <div
      // flex-1 min-h-0 absorbs the vertical space between the toolbar and the
      // pagination footer. overflow-y-auto (not hidden) because the page size
      // is a fixed 10: on a short viewport the last rows would otherwise be
      // dropped with no scrollbar and no other clue. The sticky header stays
      // pinned inside the scroll container; overflow-x stays clipped because
      // table-layout is fixed at 100% width.
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
    >
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} ${COL.form}`}>
              <SortButton label="Feedback form" columnKey="title" active={sortKey === "title"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.course}`}>
              <SortButton label="Course" columnKey="course" active={sortKey === "course"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.trainer}`}>
              <SortButton label="Trainer" columnKey="trainer" active={sortKey === "trainer"} dir={sortDir} onSort={onSort} />
            </th>
            {/* Not sortable — batch is a label the server does not order on,
                the same way User Management's Email column is read-only. */}
            <th className={`${HEAD_CELL} ${COL.batch}`}>Batch</th>
            <th className={`${HEAD_CELL} ${COL.start}`}>
              <SortButton label="Start" columnKey="start" active={sortKey === "start"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.end}`}>
              <SortButton label="End" columnKey="end" active={sortKey === "end"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.status}`}>
              <SortButton label="Status" columnKey="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} align="right" />
            </th>
            <th className={`${HEAD_CELL} ${COL.action}`}>Action</th>
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: Math.max(6, Math.min(skeletonRows, 14)) }).map((_, i) => (
              <tr key={i} className="border-b border-hairline">
                <td className={`${COL.form} ${BODY_CELL}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="size-4 rounded bg-ink-100 animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 55}ms` }} />
                    <div className={`${BAR} w-[75%]`} style={{ animationDelay: `${i * 55}ms` }} />
                  </div>
                </td>
                <td className={`${COL.course} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[80%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.trainer} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[75%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.batch} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[70%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.start} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[85%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.end} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[85%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.status} ${BODY_CELL}`}>
                  <div className="ml-auto h-6 w-[80%] rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.action} ${BODY_CELL}`}>
                  <div className="ml-auto h-7 w-[85%] rounded-control bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={COL_SPAN} className="py-12">
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                className="group border-b border-hairline last:border-0 transition-colors duration-150 hover:bg-row-hover"
              >
                <td className={`${COL.form} ${BODY_CELL} text-base font-medium text-heading`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Star size={14} className="text-brand flex-shrink-0" strokeWidth={2.2} />
                    {/* Long values ellipsize with the full value in the
                        tooltip, rather than stretching the row. */}
                    <span className="truncate" title={r.title}>{r.title}</span>
                  </div>
                </td>
                <td className={`${COL.course} ${BODY_CELL}`}>
                  <span className="text-base text-body truncate block" title={r.course}>{r.course}</span>
                </td>
                <td className={`${COL.trainer} ${BODY_CELL}`}>
                  <span className="text-base text-subtle truncate block" title={r.trainer}>{r.trainer}</span>
                </td>
                <td className={`${COL.batch} ${BODY_CELL}`}>
                  <span className="text-base text-subtle truncate block" title={r.batch}>{r.batch}</span>
                </td>
                <td className={`${COL.start} ${BODY_CELL}`}>
                  <span className="text-base text-body tabular-nums truncate block">{fmtDate(r.startISO)}</span>
                </td>
                <td className={`${COL.end} ${BODY_CELL}`}>
                  <span className="text-base text-body tabular-nums truncate block">
                    {r.endISO ? fmtDate(r.endISO) : "Open-ended"}
                  </span>
                </td>
                <td className={`${COL.status} ${BODY_CELL}`}>
                  <StatusPill tone={r.active ? "success" : "neutral"} dot className="max-w-full">
                    <span className="truncate">{r.active ? "Open" : "Closed"}</span>
                  </StatusPill>
                </td>
                <td className={`${COL.action} ${BODY_CELL}`}>
                  <div className="flex justify-end">{renderActions(r)}</div>
                </td>
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FeedbackTable;
