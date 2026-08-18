"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowRight,
  MoreVertical,
  Settings2,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "../../../shared/ui";
import type { ServiceMapping } from "@/apiServices/serviceMappingService";
import {
  ModelBadges,
  STATUS_META,
  formatDate,
  type MappingRowVM,
} from "./mappingPresentation";

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
  onCopyServiceId: (code: string) => void;
  onOpenServiceMapping: () => void;
  emptyState: React.ReactNode;
  maxBodyHeight: string;
}

const HEAD_CELL =
  "h-11 px-3 text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";

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

export function MappingTable({
  rows,
  isLoading,
  skeletonRows,
  sortKey,
  sortDir,
  onSort,
  onOpen,
  onCopyServiceId,
  onOpenServiceMapping,
  emptyState,
  maxBodyHeight,
}: MappingTableProps) {
  const COL_SPAN = 6; // client + model + year + status + updated + actions

  return (
    <div className="overflow-auto min-h-[260px] custom-scrollbar" style={{ maxHeight: maxBodyHeight }}>
      {/* table-fixed, not auto: with auto layout the identity column grows to
          the longest client name's intrinsic width, which can push the table
          wider than the panel and force a horizontal scrollbar even when
          there is room. Fixed layout gives the data columns explicit widths
          and the identity column the remainder. NO min-w floor — a floor
          reintroduces horizontal scroll on scaled/narrow viewports; the
          hidden md/lg/xl columns are what protect small widths instead. */}
      <table className="w-full table-fixed border-collapse">
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} text-left`}>
              <SortButton label="Client & Service" columnKey="client" active={sortKey === "client"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[150px] text-left hidden lg:table-cell`}>Service Model</th>
            <th className={`${HEAD_CELL} w-[80px] text-left hidden xl:table-cell`}>
              <SortButton label="Year" columnKey="year" active={sortKey === "year"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[185px] text-right`}>
              <SortButton label="Status" columnKey="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[110px] text-left hidden xl:table-cell`}>
              <SortButton label="Updated" columnKey="updated" active={sortKey === "updated"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} w-[185px] text-right`}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: Math.max(6, Math.min(skeletonRows, 12)) }).map((_, i) => (
              <tr key={i} className="border-b border-hairline">
                <td className="px-3 h-[68px] align-middle">
                  <div className="flex items-center">
                    <div className="space-y-1.5">
                      <div className="h-3 w-36 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                      <div className="h-2.5 w-24 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                    </div>
                  </div>
                </td>
                <td className="px-3 h-[68px] align-middle hidden lg:table-cell">
                  <div className="h-5 w-24 rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className="px-3 h-[68px] align-middle hidden xl:table-cell">
                  <div className="h-3 w-12 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className="px-3 h-[68px] align-middle">
                  <div className="h-6 w-24 rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className="px-3 h-[68px] align-middle hidden xl:table-cell">
                  <div className="h-3 w-20 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className="px-3 h-[68px] align-middle">
                  <div className="ml-auto h-8 w-32 rounded-control bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                className="group border-b border-hairline last:border-0 transition-colors duration-150 hover:bg-row-hover"
              >
                {/* Client + service identity */}
                <td className="px-3 h-[68px] align-middle">
                  <div className="flex items-center min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-heading truncate leading-tight" title={row.clientName}>
                          {row.clientName}
                        </p>
                        {row.isInactive && (
                          <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-ink-100 text-ink-600 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {row.serviceCode && (
                          <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums tracking-tight flex-shrink-0">
                            {row.serviceCode}
                          </span>
                        )}
                        <span className="text-xs text-subtle truncate" title={row.service}>
                          {row.service || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Service model */}
                <td className="px-3 h-[68px] align-middle hidden lg:table-cell">
                  <ModelBadges models={row.models} />
                </td>

                {/* Year */}
                <td className="px-3 h-[68px] align-middle hidden xl:table-cell">
                  {row.year ? (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-semibold tabular-nums">
                      {row.year}
                    </span>
                  ) : (
                    <span className="text-2xs text-line-muted">—</span>
                  )}
                </td>

                {/* Status — right-aligned per the LMS pattern */}
                <td className="px-3 h-[68px] align-middle text-right">
                  <StatusPill tone={STATUS_META[row.status].tone} dot>
                    {STATUS_META[row.status].label}
                  </StatusPill>
                </td>

                {/* Updated */}
                <td className="px-3 h-[68px] align-middle hidden xl:table-cell">
                  <span className="text-xs text-subtle whitespace-nowrap">{formatDate(row.updatedAt)}</span>
                </td>

                {/* Actions — prominent Manage Course + kebab */}
                <td className="px-3 h-[68px] align-middle">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(row.mapping);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-brand-strong/25 bg-brand-wash text-brand-strong text-xs font-semibold shadow-xs hover:bg-brand-strong hover:text-white hover:border-brand-strong transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 whitespace-nowrap"
                    >
                      <Settings2 size={14} />
                      <span className="hidden sm:inline">Manage</span>
                      <ArrowRight size={14} className="hidden sm:inline" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="More actions"
                          className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} className="w-52">
                        <DropdownMenuItem onClick={() => onOpen(row.mapping)} className="cursor-pointer">
                          <Settings2 className="h-4 w-4" /> Manage course
                        </DropdownMenuItem>
                        {row.serviceCode && (
                          <DropdownMenuItem onClick={() => onCopyServiceId(row.serviceCode)} className="cursor-pointer">
                            <Copy className="h-4 w-4" /> Copy service ID
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={onOpenServiceMapping} className="cursor-pointer">
                          <ExternalLink className="h-4 w-4" /> Open in Service Mapping
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
