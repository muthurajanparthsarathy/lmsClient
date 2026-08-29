"use client";
import React from "react";
import { motion } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Settings2,
} from "lucide-react";
import type { ServiceMapping } from "@/apiServices/serviceMappingService";
import { businessModelFullName } from "@/features/clientmanagement/lib";
import { type MappingRowVM } from "./mappingPresentation";

// The Course Setup list table — purpose-built (not the shared DataTable) so rows
// can be two-line and carry a prominent Manage action, and the header can stick
// while the body fills the viewport. No Progress column — the status pill
// (Fully/Partially configured) carries that information. It owns no data:
// sorting, opening a mapping and the row view-models all arrive as props.

type SortDir = "asc" | "desc";

interface MappingTableProps {
  rows: MappingRowVM[];
  isLoading: boolean;
  skeletonRows: number;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  onOpen: (mapping: ServiceMapping) => void;
  emptyState: React.ReactNode;
}

// Matches the shared DataTable metrics — same header/row heights and text sizes
// as Client Management, so the two lists read as one system.
const HEAD_CELL =
  "h-8 px-3 text-[10px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";
const BODY_CELL = "h-11 px-3 align-middle text-[12px] text-body";

function SortButton({
  label,
  columnKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  columnKey: string;
  active: boolean;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className="inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-heading transition-colors duration-150"
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

// The Available Courses count + its course-list card. CLICK opens it (Radix's
// default toggle); outside-click and Escape close it. No hover behaviour and
// no title tooltips — the card itself is the whole disclosure.
function AvailableCoursesPopover({ courses, year }: { courses: string[]; year: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center h-6 px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-semibold tabular-nums whitespace-nowrap hover:bg-info-50/70 hover:underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-700/30"
        >
          {courses.length} Available Course{courses.length > 1 ? "s" : ""}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-popover w-64 rounded-tile border border-hairline bg-surface shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <p className="px-3 pt-2.5 pb-2 text-2xs font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
            Available Courses ({courses.length})
          </p>
          <ul className="max-h-56 overflow-y-auto py-1.5">
            {courses.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-body"
              >
                <span className="size-1.5 rounded-full bg-info-700 flex-shrink-0" aria-hidden />
                <span className="min-w-0 truncate">
                  {name}
                  <span className="text-subtle"> — {year || "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function MappingTable({
  rows,
  isLoading,
  skeletonRows,
  sortKey,
  sortDir,
  onSort,
  onOpen,
  emptyState,
}: MappingTableProps) {
  // Client + BusinessModel + ServiceModel + ProvidingYear + AvailableCourses + Action
  const COL_SPAN = 6;

  // Pagination page-move animation — the User Management stagger, made
  // visibly kinetic: every row is a motion.tr that fades AND slides up into
  // place (opacity 0→1, y 8→0, 20ms stagger) whenever it mounts. Page moves
  // swap the row keys, so each new page cascades in from the top.

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <table className="w-full table-fixed border-collapse">
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} w-[26%] text-left`}>
              <SortButton label="Client" columnKey="client" active={sortKey === "client"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[12%] text-left`}>Business Model</th>
            <th className={`${HEAD_CELL} w-[18%] text-left`}>Service Model</th>
            <th className={`${HEAD_CELL} w-[12%] text-left`}>
              <SortButton label="Providing Year" columnKey="year" active={sortKey === "year"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[17%] text-left`}>Available Courses</th>
            <th className={`${HEAD_CELL} w-[15%] pl-2 pr-4 sm:pr-5 text-right`}>Action</th>
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: Math.max(6, Math.min(skeletonRows, 12)) }).map((_, i) => (
              <tr key={i} className="border-b border-hairline">
                <td className={BODY_CELL}>
                  <div className="h-3 w-40 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={BODY_CELL}>
                  <div className="h-3 w-10 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={BODY_CELL}>
                  <div className="h-3 w-24 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={BODY_CELL}>
                  <div className="h-3 w-12 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={BODY_CELL}>
                  <div className="h-3 w-28 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${BODY_CELL} pl-2 pr-4 sm:pr-5 text-right`}>
                  <div className="ml-auto h-7 w-24 rounded-control bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
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
            rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut", delay: Math.min(i, 10) * 0.02 }}
                className="group border-b border-hairline last:border-0 transition-colors duration-150 hover:bg-row-hover"
              >
                {/* Client — plain text, no service subline. */}
                <td className={BODY_CELL}>
                  <span className="block truncate" title={row.clientName}>{row.clientName}</span>
                </td>

                {/* Business Model — B2B / B2I / B2C code; full name in tooltip. */}
                <td className={BODY_CELL}>
                  {row.businessModel ? (
                    <span className="block truncate" title={businessModelFullName(row.businessModel)}>{row.businessModel}</span>
                  ) : (
                    <span className="text-line-muted">—</span>
                  )}
                </td>

                {/* Service Model — plain text (no colored chips). */}
                <td className={BODY_CELL}>
                  {row.models.length > 0 ? (
                    <span className="block truncate" title={row.models.join(", ")}>{row.models.join(", ")}</span>
                  ) : (
                    <span className="text-line-muted">—</span>
                  )}
                </td>

                {/* Providing Year — plain text. */}
                <td className={BODY_CELL}>
                  {row.year ? (
                    <span className="tabular-nums">{row.year}</span>
                  ) : (
                    <span className="text-line-muted">—</span>
                  )}
                </td>

                {/* Available Courses — a compact blue count; clicking it
                    opens a small card listing the courses mapped under this
                    row with their providing year. Radix portals the card to
                    the body, so the table's overflow-hidden wrapper never
                    clips it. The info (blue) tokens are deliberate: brand
                    here is orange, and this count is specified as blue. */}
                <td className={BODY_CELL}>
                  {row.courses.length > 0 ? (
                    <AvailableCoursesPopover courses={row.courses} year={row.year} />
                  ) : (
                    <span className="text-line-muted">No courses</span>
                  )}
                </td>

                {/* Action — Manage only. Kebab dropped; Copy ID / Open in
                    Service Mapping still reachable from the toolbar's
                    Service Mapping button + the client-picker export. */}
                <td className={`${BODY_CELL} pl-2 pr-4 sm:pr-5 text-right`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(row.mapping);
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 whitespace-nowrap"
                  >
                    <Settings2 size={12} /> Manage
                  </button>
                </td>
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MappingTable;
