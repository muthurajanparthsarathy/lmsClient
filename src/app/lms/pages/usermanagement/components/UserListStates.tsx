"use client";

// The directory's non-row states, kept out of the page so its JSX is layout
// rather than layout-plus-copy: the two empty states, the status cell and the
// bulk-delete confirmation.

import { Plus, Trash2, Users, SearchX, Loader2, X } from "lucide-react";
import { EmptyState, Modal } from "../../../shared/ui";
import { Switch } from "@/components/ui/switch";
import type { User } from "./types";

/**
 * Differentiated empty states: no matches (offer to clear filters) vs a truly
 * empty directory (offer the Add User CTA, when permitted). Telling them apart
 * matters — "no users yet" under an active filter reads as data loss.
 */
export function UsersEmptyState({
  hasActiveFilters,
  canAddUser,
  onClearFilters,
  onAddUser,
}: {
  hasActiveFilters: boolean;
  canAddUser: boolean;
  onClearFilters: () => void;
  onAddUser: () => void;
}) {
  if (hasActiveFilters) {
    return (
      <EmptyState
        icon={SearchX}
        title="No users match your filters"
        message="Try a different search, or clear the filters to see every user."
        secondaryAction={
          <button
            type="button"
            onClick={onClearFilters}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
          >
            Clear filters
          </button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Users}
      title="No users yet"
      message="Users you add will appear here with their role, client and status."
      primaryAction={canAddUser ? (
        <button
          type="button"
          onClick={onAddUser}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
        >
          <Plus size={15} strokeWidth={2.4} /> Add User
        </button>
      ) : undefined}
    />
  );
}

/**
 * Status column, mirroring the Client Management pattern: a real sliding
 * Switch (green when active, gray when inactive) with a compact Active /
 * Inactive text label beside it — a bare knob names nothing to a screen
 * reader, and the pill-plus-switch combo repeated the same signal twice.
 */
export function UserStatusCell({
  user,
  isToggling,
  canToggle,
  onToggle,
}: {
  user: User;
  isToggling: boolean;
  canToggle: boolean;
  onToggle: (userId: string, next: "active" | "inactive") => void;
}) {
  const isActive = user.status === "active";
  return (
    <div className="flex items-center justify-end gap-2">
      {canToggle && (
        <Switch
          checked={isActive}
          disabled={isToggling}
          onCheckedChange={(checked) => onToggle(user.id, checked ? "active" : "inactive")}
          aria-label={isActive ? 'Deactivate user' : 'Activate user'}
          title={isActive ? 'Active — switch off to deactivate' : 'Inactive — switch on to activate'}
          className="scale-90 data-[state=checked]:bg-success-500 data-[state=unchecked]:bg-ink-200"
        />
      )}
      <span className={`text-[11px] font-medium ${isActive ? 'text-success-700' : 'text-subtle'} ${isToggling ? 'animate-pulse' : ''}`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}

export function BulkDeleteModal({
  open,
  count,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      size="sm"
      title={`Delete ${count} user${count > 1 ? 's' : ''}?`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-50 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-control bg-danger-700 text-white text-sm font-semibold shadow-xs hover:bg-danger-700/90 disabled:opacity-60 transition-colors duration-150"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-tile bg-danger-50 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 text-danger-700" />
        </div>
        <p className="text-sm text-subtle pt-0.5">
          This action cannot be undone. The selected user accounts will be permanently removed.
        </p>
      </div>
    </Modal>
  );
}

/** Removable chips for the applied filters. Search has its own input, so it is not chipped. */
export function UserFilterChips({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; onRemove: () => void }[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={chip.onRemove}
            className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
      >
        Clear all
      </button>
    </div>
  );
}
