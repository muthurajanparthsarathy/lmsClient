"use client";

// The one toolbar above the directory: search (with its scope picker) on the
// left · Filter · Export · Bulk Actions grouped right · divider · Add User.
// Mirrors Client Management so the two admin lists read the same.

import { motion } from "framer-motion";
import {
  Plus, Filter, KeyRound, FileSpreadsheet, Download, Search, X,
  ChevronDown, Upload, UserCog, Layers,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SEARCH_FIELD_OPTIONS, type SearchField } from "./userManagement.constants";

export interface UserToolbarProps {
  searchTerm: string;
  onSearchTerm: (v: string) => void;
  searchField: SearchField;
  onSearchField: (v: SearchField) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onExportAll: () => void;
  canAddUser: boolean;
  canBulkUpload: boolean;
  canBulkPermission: boolean;
  onAddUser: () => void;
  onBulkUpload: () => void;
  onBulkEdit: () => void;
  onBulkPermission: () => void;
}

export function UserToolbar({
  searchTerm, onSearchTerm,
  searchField, onSearchField,
  showFilters, onToggleFilters, activeFilterCount,
  onExportAll,
  canAddUser, canBulkUpload, canBulkPermission,
  onAddUser, onBulkUpload, onBulkEdit, onBulkPermission,
}: UserToolbarProps) {
  // The picked scope drives both the trigger label and the input's placeholder,
  // so the box always says which column it is about to search.
  const activeSearchField =
    SEARCH_FIELD_OPTIONS.find((o) => o.value === searchField) ?? SEARCH_FIELD_OPTIONS[0];

  return (
    <div className="no-print mt-3 flex items-center gap-2 flex-wrap min-w-0">
      {/* Compact search + the scope picker on its right edge. The two share
          one bordered shell so they read as a single control: the term on
          the left, the column it applies to on the right. */}
      <div className="relative flex-1 min-w-[260px] max-w-md flex items-stretch h-8 rounded-control border border-hairline-strong bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-colors duration-150">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
            placeholder={activeSearchField.placeholder}
            className="w-full h-full pl-8 pr-7 bg-transparent rounded-l-control text-[13px] text-body placeholder:text-faint focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchTerm("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Search in: ${activeSearchField.label}`}
              className={`inline-flex items-center gap-1 h-full pl-2 pr-2 border-l border-hairline-strong rounded-r-control text-xs font-medium whitespace-nowrap transition-colors duration-150 ${searchField === "all" ? "text-subtle hover:bg-row-hover hover:text-heading" : "bg-brand-wash text-brand-strong"}`}
            >
              {activeSearchField.label}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-44">
            <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-wider text-subtle">
              Search in
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={searchField}
              onValueChange={(v) => onSearchField(v as SearchField)}
            >
              {SEARCH_FIELD_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value} className="cursor-pointer">
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Secondary-action cluster (Filter · Export · More) pushed right */}
      <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border text-xs font-medium transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? "border-brand text-brand-strong bg-brand-wash" : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Export — standalone dropdown like Client Management */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Export list"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-40">
            <DropdownMenuItem onClick={onExportAll} className="cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-success-700" /> Export all (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk Actions — one dropdown gathering every bulk operation
            (Upload / Edit / Permission). Replaces the earlier standalone
            Bulk Upload button + the "More actions" kebab that hid Bulk
            Permission (spec Sections 1, 16). Only rendered when at least
            one of the three items is permitted to the caller. */}
        {(canBulkUpload || canAddUser || canBulkPermission) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Bulk actions"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk Actions</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                Bulk operations
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canBulkUpload && (
                <DropdownMenuItem onClick={onBulkUpload} className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Bulk Upload</div>
                    <div className="text-2xs text-subtle">Upload a spreadsheet, preview and add new users.</div>
                  </div>
                </DropdownMenuItem>
              )}
              {canAddUser && (
                <DropdownMenuItem onClick={onBulkEdit} className="cursor-pointer">
                  <UserCog className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Reassign Client / Service</div>
                    <div className="text-2xs text-subtle">Move many users to a different client or service.</div>
                  </div>
                </DropdownMenuItem>
              )}
              {canBulkPermission && (
                <DropdownMenuItem onClick={onBulkPermission} className="cursor-pointer">
                  <KeyRound className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Bulk Permission</div>
                    <div className="text-2xs text-subtle">Copy permissions to many users at once.</div>
                  </div>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Primary action — Add User only. Every bulk path now lives inside
          the Bulk Actions dropdown above. */}
      {canAddUser && (
        <>
          <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />
          <motion.button
            type="button"
            onClick={onAddUser}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
            aria-label="Add user"
          >
            <Plus size={14} strokeWidth={2.4} />
            <span className="text-xs font-semibold hidden sm:inline">Add User</span>
          </motion.button>
        </>
      )}
    </div>
  );
}
