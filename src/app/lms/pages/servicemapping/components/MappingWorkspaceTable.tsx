"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreVertical,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClientAvatar, modelTone, hierarchySummary, fmtDate, type MappingRowVM } from "./workspaceShared";

// The Service Mapping listing table — purpose-built so a row click opens the
// detail panel, the status pill stays a live toggle, and the header sticks while
// the body fills the viewport. Owns no data: sorting, selection, status toggle
// and row actions all arrive as props.

type SortDir = "asc" | "desc";

interface MappingWorkspaceTableProps {
  rows: MappingRowVM[];
  isLoading: boolean;
  skeletonRows: number;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  selectedId: string | null;
  onSelect: (vm: MappingRowVM) => void;
  onToggleStatus: (vm: MappingRowVM) => void;
  togglingId: string | null;
  onEdit: (vm: MappingRowVM) => void;
  onMapService: (vm: MappingRowVM) => void;
  onDelete: (vm: MappingRowVM) => void;
  onDeleteSeveral: (vm: MappingRowVM) => void;
  onViewClient: (vm: MappingRowVM) => void;
  // Per-action permission flags — gate the kebab entries (and the kebab itself
  // when nothing would show). Default true keeps the component usable when
  // consumers haven't wired permissions yet.
  canView?: boolean;
  canEdit?: boolean;
  canMap?: boolean;
  canDelete?: boolean;
  startIndex: number;
  emptyState: React.ReactNode;
  // Legacy cap. Ignored when fillHeight is true.
  maxBodyHeight: string;
  // When true, the scroll region grows to fill its parent's remaining
  // height (flex-1 min-h-0) instead of capping at maxBodyHeight. Requires
  // every ancestor up to a definite-height container to be
  // `flex flex-col min-h-0`.
  fillHeight?: boolean;
}

const HEAD_CELL =
  "h-11 px-3 text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";

function SortButton({ label, columnKey, active, dir, onSort }: { label: string; columnKey: string; active: boolean; dir: SortDir; onSort: (k: string) => void }) {
  return (
    <button type="button" onClick={() => onSort(columnKey)} className="inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-heading transition-colors duration-150">
      {label}
      {active ? (dir === "asc" ? <ChevronUp size={13} className="text-brand" /> : <ChevronDown size={13} className="text-brand" />) : <ChevronsUpDown size={13} className="text-line-muted" />}
    </button>
  );
}

function StatusToggle({ vm, busy, onToggle }: { vm: MappingRowVM; busy: boolean; onToggle: () => void }) {
  const active = vm.status === "active";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={busy}
      title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
      className={`inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-chip text-2xs font-medium border transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25 ${
        active ? "bg-success-50 text-success-700 border-success-500/20 hover:border-success-500/40" : "bg-ink-100 text-ink-500 border-ink-200 hover:border-ink-300"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success-500" : "bg-ink-400"} ${busy ? "animate-pulse" : ""}`} />
      {active ? "Active" : "Inactive"}
    </button>
  );
}

export function MappingWorkspaceTable({
  rows,
  isLoading,
  skeletonRows,
  sortKey,
  sortDir,
  onSort,
  selectedId,
  onSelect,
  onToggleStatus,
  togglingId,
  onEdit,
  onMapService,
  onDelete,
  onDeleteSeveral,
  onViewClient,
  canView = true,
  canEdit = true,
  canMap = true,
  canDelete = true,
  startIndex,
  emptyState,
  maxBodyHeight,
  fillHeight = false,
}: MappingWorkspaceTableProps) {
  const anyKebab = canView || canEdit || canMap || canDelete;
  const COL_SPAN = 8;

  return (
    <div
      className={
        fillHeight
          ? 'flex-1 min-h-[260px] overflow-auto custom-scrollbar'
          : 'overflow-auto min-h-[260px] custom-scrollbar'
      }
      style={fillHeight ? undefined : { maxHeight: maxBodyHeight }}
    >
      <table className="w-full border-collapse min-w-[720px]">
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} w-[52px] pl-5 text-left`}>#</th>
            <th className={`${HEAD_CELL} text-left`}><SortButton label="Client & Service" columnKey="client" active={sortKey === "client"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} text-left hidden lg:table-cell`}>Academic Hierarchy</th>
            <th className={`${HEAD_CELL} text-left hidden xl:table-cell`}><SortButton label="Service Model" columnKey="model" active={sortKey === "model"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} text-left hidden md:table-cell`}><SortButton label="Year" columnKey="year" active={sortKey === "year"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} text-left`}><SortButton label="Status" columnKey="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} text-left hidden xl:table-cell`}>Updated</th>
            <th className={`${HEAD_CELL} w-[60px] pr-5 text-right`}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: Math.max(6, Math.min(skeletonRows, 12)) }).map((_, i) => (
              <tr key={i} className="border-b border-hairline">
                <td className="pl-5 pr-3 h-[64px] align-middle"><div className="h-3 w-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-ink-100 animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 55}ms` }} />
                    <div className="space-y-1.5"><div className="h-3 w-32 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /><div className="h-2.5 w-20 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></div>
                  </div>
                </td>
                <td className="px-3 h-[64px] align-middle hidden lg:table-cell"><div className="h-3 w-40 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle hidden xl:table-cell"><div className="h-5 w-20 rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle hidden md:table-cell"><div className="h-3 w-10 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle"><div className="h-6 w-20 rounded-chip bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle hidden xl:table-cell"><div className="h-3 w-16 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="pr-5 pl-3 h-[64px] align-middle"><div className="ml-auto size-7 rounded-chip bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr><td colSpan={COL_SPAN} className="py-12">{emptyState}</td></tr>
          ) : (
            rows.map((vm, i) => {
              const selected = selectedId === vm.id;
              const summary = hierarchySummary(vm);
              return (
                <motion.tr
                  key={vm.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                  onClick={() => onSelect(vm)}
                  className={`group border-b border-hairline last:border-0 transition-colors duration-150 cursor-pointer ${selected ? "bg-brand-wash/60" : "hover:bg-row-hover"}`}
                >
                  <td className="pl-5 pr-3 h-[64px] align-middle"><span className="text-xs text-faint tabular-nums">{startIndex + i + 1}</span></td>

                  <td className="px-3 h-[64px] align-middle">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClientAvatar name={vm.clientName} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-heading truncate leading-tight" title={vm.clientName}>{vm.clientName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                          {vm.serviceCode && <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums flex-shrink-0">{vm.serviceCode}</span>}
                          <span className="text-xs text-subtle truncate" title={vm.service}>{vm.service || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 h-[64px] align-middle hidden lg:table-cell">
                    {summary ? <span className="text-xs text-body">{summary}</span> : <span className="text-2xs text-line-muted">Flat mapping</span>}
                  </td>

                  <td className="px-3 h-[64px] align-middle hidden xl:table-cell">
                    {vm.models.length === 0 ? <span className="text-2xs text-line-muted">—</span> : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {vm.models.slice(0, 2).map((m) => <span key={m} className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap ${modelTone(m)}`}>{m}</span>)}
                        {vm.models.length > 2 && <span className="inline-flex items-center h-[22px] px-1.5 rounded-chip bg-ink-100 text-ink-600 text-2xs font-semibold">+{vm.models.length - 2}</span>}
                      </div>
                    )}
                  </td>

                  <td className="px-3 h-[64px] align-middle hidden md:table-cell"><span className="text-sm text-body tabular-nums">{vm.year || "—"}</span></td>

                  <td className="px-3 h-[64px] align-middle"><StatusToggle vm={vm} busy={togglingId === vm.id} onToggle={() => onToggleStatus(vm)} /></td>

                  <td className="px-3 h-[64px] align-middle hidden xl:table-cell"><span className="text-xs text-subtle whitespace-nowrap">{fmtDate(vm.updatedAt || vm.createdAt)}</span></td>

                  <td className="pr-5 pl-3 h-[64px] align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    {anyKebab && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label="Row actions" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading">
                            <MoreVertical size={15} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="w-48">
                          {canView && (
                            <DropdownMenuItem onClick={() => onSelect(vm)} className="text-xs cursor-pointer"><Eye className="h-3.5 w-3.5" /> View details</DropdownMenuItem>
                          )}
                          {canView && (
                            <DropdownMenuItem onClick={() => onViewClient(vm)} className="text-xs cursor-pointer"><Eye className="h-3.5 w-3.5" /> View client mappings</DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(vm)} className="text-xs cursor-pointer"><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                          )}
                          {canMap && (
                            <DropdownMenuItem onClick={() => onMapService(vm)} className="text-xs cursor-pointer"><Plus className="h-3.5 w-3.5 text-brand-500" /> Map service</DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onDelete(vm)} variant="destructive" className="text-xs cursor-pointer"><Trash2 className="h-3.5 w-3.5" /> Delete this service</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteSeveral(vm)} variant="destructive" className="text-xs cursor-pointer"><Trash2 className="h-3.5 w-3.5" /> Delete several…</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </motion.tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MappingWorkspaceTable;
