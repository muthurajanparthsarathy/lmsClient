"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, MoreVertical, Settings2, Copy, ExternalLink, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "../../../shared/ui";
import type { ServiceMapping } from "@/apiServices/serviceMappingService";
import {
  ClientAvatar,
  ModelBadges,
  MappingProgress,
  STATUS_META,
  formatDate,
  type MappingRowVM,
} from "./mappingPresentation";

// Card view of the Course Setup list — the same data as a table row, laid out
// as a scannable tile. Presentation only.

interface MappingCardGridProps {
  rows: MappingRowVM[];
  isLoading: boolean;
  skeletonCount: number;
  onOpen: (mapping: ServiceMapping) => void;
  onCopyServiceId: (code: string) => void;
  onOpenServiceMapping: () => void;
  emptyState: React.ReactNode;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-ink-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded bg-ink-100 animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-ink-100 animate-pulse" />
        </div>
      </div>
      <div className="mt-4 h-5 w-40 rounded-full bg-ink-100 animate-pulse" />
      <div className="mt-4 h-2 w-full rounded-full bg-ink-100 animate-pulse" />
      <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-ink-100 animate-pulse" />
        <div className="h-8 w-28 rounded-control bg-ink-100 animate-pulse" />
      </div>
    </div>
  );
}

export function MappingCardGrid({
  rows,
  isLoading,
  skeletonCount,
  onOpen,
  onCopyServiceId,
  onOpenServiceMapping,
  emptyState,
}: MappingCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5">
        {Array.from({ length: Math.max(6, Math.min(skeletonCount, 12)) }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="py-12">{emptyState}</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5">
      {rows.map((row, i) => (
        <motion.div
          key={row.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }}
          className="group flex flex-col rounded-xl border border-hairline bg-surface p-4 shadow-xs transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <ClientAvatar name={row.clientName} size="md" />
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
                {row.serviceCode && (
                  <span className="inline-flex items-center h-[18px] px-1.5 mt-0.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums">
                    {row.serviceCode}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 flex-shrink-0 data-[state=open]:bg-ink-100"
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

          {/* Service + meta */}
          <p className="mt-3 text-xs text-subtle truncate" title={row.service}>
            {row.service || "—"}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <ModelBadges models={row.models} max={3} />
            {row.year && (
              <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-semibold tabular-nums">
                {row.year}
              </span>
            )}
          </div>

          {/* Status + progress */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <StatusPill tone={STATUS_META[row.status].tone} dot>
              {STATUS_META[row.status].label}
            </StatusPill>
            <MappingProgress configured={row.configured} total={row.total} className="flex-1 max-w-[140px]" />
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-2xs text-subtle whitespace-nowrap">
              <Calendar size={12} /> {formatDate(row.updatedAt)}
            </span>
            <button
              type="button"
              onClick={() => onOpen(row.mapping)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-brand-strong/25 bg-brand-wash text-brand-strong text-xs font-semibold shadow-xs hover:bg-brand-strong hover:text-white hover:border-brand-strong transition-colors duration-150 whitespace-nowrap"
            >
              <Settings2 size={14} /> Manage Course
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default MappingCardGrid;
