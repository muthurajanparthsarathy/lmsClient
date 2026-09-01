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
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClientAvatar, type MappingRowVM } from "./workspaceShared";
import { MODEL_TONES, businessModelFullName } from "@/features/clientmanagement/lib";

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
  // Actions cell is now a single 3-dot kebab (2026-08-30 user request —
  // "action single column, three dots instead of map service text").
  // The old "+ Map service" and "Manage" text-buttons moved INTO the kebab
  // as "Create service" (canMap) and "Edit service" (canEdit) menu items,
  // pinned to the top of the dropdown so the primary actions still land
  // first. anyKebab now includes canMap + canEdit so the kebab renders
  // even when a user only has those two permissions.
  const anyKebab = canView || canEdit || canDelete || canMap;
  // #, Client, Services, Business Model, Service Model, Row actions
  //   (all row actions inside one right-side kebab). Status column was
  // removed 2026-08-30 per user request — active/inactive still managed
  // via the detail panel; onToggleStatus / togglingId props are kept in
  // the API so callers (page.tsx) don't need to change.
  const COL_SPAN = 6;

  return (
    <div
      className={
        fillHeight
          ? 'flex-1 min-h-[260px] overflow-auto custom-scrollbar'
          : 'overflow-auto min-h-[260px] custom-scrollbar'
      }
      style={fillHeight ? undefined : { maxHeight: maxBodyHeight }}
    >
      <table className="w-full border-collapse min-w-[820px]">
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} w-[52px] pl-5 text-left`}>#</th>
            <th className={`${HEAD_CELL} text-left`}><SortButton label="Client" columnKey="client" active={sortKey === "client"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} text-left`}>Service Name</th>
            <th className={`${HEAD_CELL} text-left`}>Business Model</th>
            <th className={`${HEAD_CELL} text-left`}><SortButton label="Service Model" columnKey="model" active={sortKey === "model"} dir={sortDir} onSort={onSort} /></th>
            <th className={`${HEAD_CELL} no-print w-[260px] pr-5 text-right`}>Actions</th>
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
                    <div className="h-3 w-32 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </div>
                </td>
                <td className="px-3 h-[64px] align-middle"><div className="h-3 w-40 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle"><div className="h-5 w-24 rounded-chip bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="px-3 h-[64px] align-middle"><div className="h-3 w-10 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
                <td className="pr-5 pl-3 h-[64px] align-middle"><div className="ml-auto h-7 w-48 rounded-chip bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} /></td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr><td colSpan={COL_SPAN} className="py-12">{emptyState}</td></tr>
          ) : (
            rows.map((vm, i) => {
              const selected = selectedId === vm.id;
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
                      <p className="text-sm font-semibold text-heading truncate leading-tight" title={vm.clientName}>{vm.clientName}</p>
                    </div>
                  </td>

                  <td className="px-3 h-[64px] align-middle">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {vm.serviceCode && <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums flex-shrink-0">{vm.serviceCode}</span>}
                      <span className="text-sm text-body truncate" title={vm.service}>{vm.service || "—"}</span>
                    </div>
                  </td>

                  <td className="px-3 h-[64px] align-middle">
                    {vm.businessModel ? (
                      <span
                        className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap max-w-full ${
                          MODEL_TONES[vm.businessModel] || 'bg-ink-100 text-subtle'
                        }`}
                        title={businessModelFullName(vm.businessModel)}
                      >
                        {businessModelFullName(vm.businessModel)}
                      </span>
                    ) : (
                      <span className="text-2xs text-line-muted">—</span>
                    )}
                  </td>

                  <td className="px-3 h-[64px] align-middle">
                    {vm.models.length === 0 ? (
                      <span className="text-2xs text-line-muted">—</span>
                    ) : (
                      <span
                        className="inline-flex items-center h-[22px] px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-semibold whitespace-nowrap tabular-nums"
                        title={vm.models.join(', ')}
                      >
                        {vm.models.length} {vm.models.length === 1 ? 'model' : 'models'}
                      </span>
                    )}
                  </td>

                  <td className="no-print pr-5 pl-3 h-[64px] align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {/* Single 3-dot kebab — the row's primary actions
                        ("Create service", "Edit service") now live at the
                        top of this menu instead of as separate text-buttons
                        on the row. Keeps the cell narrow and the row hover
                        state clean. */}
                    {anyKebab && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label="Row actions" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading">
                            <MoreVertical size={15} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="w-48">
                          {canMap && (
                            <DropdownMenuItem onClick={() => onMapService(vm)} className="text-xs cursor-pointer"><Plus className="h-3.5 w-3.5" /> Create service</DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(vm)} className="text-xs cursor-pointer"><Settings2 className="h-3.5 w-3.5" /> Edit service</DropdownMenuItem>
                          )}
                          {(canMap || canEdit) && (canView || canDelete) && <DropdownMenuSeparator />}
                          {canView && (
                            <DropdownMenuItem onClick={() => onSelect(vm)} className="text-xs cursor-pointer"><Eye className="h-3.5 w-3.5" /> View details</DropdownMenuItem>
                          )}
                          {canView && (
                            <DropdownMenuItem onClick={() => onViewClient(vm)} className="text-xs cursor-pointer"><Eye className="h-3.5 w-3.5" /> View client mappings</DropdownMenuItem>
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
