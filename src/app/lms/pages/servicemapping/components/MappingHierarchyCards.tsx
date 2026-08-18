"use client";
import React from "react";
import { motion } from "framer-motion";
import { MoreVertical, Eye, Pencil, Plus, Trash2, Calendar, BookOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClientAvatar, HierarchyChain, modelTone, fmtDate, type MappingRowVM } from "./workspaceShared";

// Hierarchy-first card view: each mapping reads as a relationship
// (Client → Degree → … → Service → Course) rather than a table row.

interface MappingHierarchyCardsProps {
  rows: MappingRowVM[];
  isLoading: boolean;
  skeletonCount: number;
  selectedId: string | null;
  onSelect: (vm: MappingRowVM) => void;
  onToggleStatus: (vm: MappingRowVM) => void;
  togglingId: string | null;
  onEdit: (vm: MappingRowVM) => void;
  onMapService: (vm: MappingRowVM) => void;
  onDelete: (vm: MappingRowVM) => void;
  onViewClient: (vm: MappingRowVM) => void;
  // Per-action permission flags — hide the corresponding menu items (and the
  // whole kebab when nothing remains). Default true keeps callers that haven't
  // wired permissions yet unchanged.
  canView?: boolean;
  canEdit?: boolean;
  canMap?: boolean;
  canDelete?: boolean;
  emptyState: React.ReactNode;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-full bg-ink-100 animate-pulse" />
        <div className="flex-1 space-y-2"><div className="h-3.5 w-40 rounded bg-ink-100 animate-pulse" /><div className="h-2.5 w-24 rounded bg-ink-100 animate-pulse" /></div>
        <div className="h-6 w-16 rounded-chip bg-ink-100 animate-pulse" />
      </div>
      <div className="mt-4 h-12 rounded-tile bg-ink-100/60 animate-pulse" />
      <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between"><div className="h-4 w-24 rounded bg-ink-100 animate-pulse" /><div className="h-4 w-16 rounded bg-ink-100 animate-pulse" /></div>
    </div>
  );
}

export function MappingHierarchyCards({
  rows,
  isLoading,
  skeletonCount,
  selectedId,
  onSelect,
  onToggleStatus,
  togglingId,
  onEdit,
  onMapService,
  onDelete,
  onViewClient,
  canView = true,
  canEdit = true,
  canMap = true,
  canDelete = true,
  emptyState,
}: MappingHierarchyCardsProps) {
  const anyKebab = canView || canEdit || canMap || canDelete;
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 sm:p-5">
        {Array.from({ length: Math.max(4, Math.min(skeletonCount, 10)) }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }
  if (rows.length === 0) return <div className="py-12">{emptyState}</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 sm:p-5">
      {rows.map((vm, i) => {
        const selected = selectedId === vm.id;
        const active = vm.status === "active";
        const busy = togglingId === vm.id;
        return (
          <motion.div
            key={vm.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }}
            onClick={() => onSelect(vm)}
            className={`group flex flex-col rounded-xl border bg-surface p-4 shadow-xs transition-all duration-150 cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${selected ? "border-brand-500/50 ring-1 ring-brand-500/20" : "border-hairline"}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <ClientAvatar name={vm.clientName} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading truncate leading-tight" title={vm.clientName}>{vm.clientName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {vm.serviceCode && <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums">{vm.serviceCode}</span>}
                    <span className="text-xs text-subtle truncate">{vm.service || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onToggleStatus(vm)}
                  disabled={busy}
                  title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
                  className={`inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-chip text-2xs font-medium border transition-colors disabled:opacity-60 ${active ? "bg-success-50 text-success-700 border-success-500/20" : "bg-ink-100 text-ink-500 border-ink-200"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success-500" : "bg-ink-400"} ${busy ? "animate-pulse" : ""}`} />
                  {active ? "Active" : "Inactive"}
                </button>
                {anyKebab && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Card actions" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 data-[state=open]:bg-ink-100">
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
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Hierarchy relationship — the hero of the card */}
            <div className="mt-3 rounded-tile border border-hairline bg-canvas px-3 py-2.5 overflow-x-auto custom-scrollbar">
              <HierarchyChain vm={vm} />
            </div>

            {/* Meta footer */}
            <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {vm.models.slice(0, 2).map((m) => <span key={m} className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap ${modelTone(m)}`}>{m}</span>)}
                {vm.models.length > 2 && <span className="inline-flex items-center h-[22px] px-1.5 rounded-chip bg-ink-100 text-ink-600 text-2xs font-semibold">+{vm.models.length - 2}</span>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-2xs text-subtle">
                {vm.courseCount > 0 && <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {vm.courseCount}</span>}
                {vm.year && <span className="tabular-nums">{vm.year}</span>}
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><Calendar size={12} /> {fmtDate(vm.updatedAt || vm.createdAt)}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default MappingHierarchyCards;
