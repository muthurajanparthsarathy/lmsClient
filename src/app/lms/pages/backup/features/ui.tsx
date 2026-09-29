"use client";

// Page-local kit for the Backup console.
//
// The card shell, table cell classes and destructive-confirm dialog are the
// System Settings ones — re-exported from the Dynamic Field Settings kit rather
// than copied, so the two System Settings pages can never drift apart. What
// lives here is only what Backup adds: the scope vocabulary and the two
// formatters (bytes, date-time) the codebase had no home for.

import * as React from "react";
import {
  Building2,
  BookOpen,
  Globe2,
  Layers,
  Users,
  type LucideIcon,
} from "lucide-react";

import { StatusPill, type StatusPillTone } from "@/app/lms/shared/ui";
import { cn } from "@/lib/utils";
import type {
  BackupDestination,
  BackupScope,
  BackupStatus,
} from "@/app/lms/pages/backup/api/backup";

export {
  TabCard,
  TabCardHeader,
  CountPill,
  RowIconButton,
  ConfirmDeleteModal,
  TH_CLASS,
  TD_CLASS,
} from "@/app/lms/pages/dynamicfieldsettings/features/ui";

/* ── Formatters ──────────────────────────────────────────────────────────── */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** 1536 → "1.5 KB". Binary units, because that is what a file size means. */
export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1
  );
  const value = bytes / 1024 ** exponent;
  const decimals = exponent === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${BYTE_UNITS[exponent]}`;
}

/**
 * "09 Sep 2026, 04:15 PM". Hand-rolled like the Audit Logs page — date-fns is
 * installed but no page in this area imports it, and a backup listing is not
 * the place to introduce a second date convention.
 */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCount(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

/* ── Scope vocabulary ────────────────────────────────────────────────────── */

/** Which picker a scope needs, if any. */
export type BackupTargetKind = "client" | "course" | null;

export interface BackupScopeOption {
  value: BackupScope;
  label: string;
  /** Plain-language description of exactly what is captured. */
  description: string;
  /** Terse form for the type dropdown's inline parenthetical. */
  summary: string;
  icon: LucideIcon;
  target: BackupTargetKind;
  /** `users` accepts a client OR nothing ("all users"), so its target is optional. */
  targetRequired: boolean;
  recommended?: boolean;
  tone: StatusPillTone;
}

export const SCOPE_OPTIONS: readonly BackupScopeOption[] = [
  {
    value: "client",
    summary: "Client data and mapping only",
    label: "Client only",
    description: "The client record and its service mappings. No users, no courses.",
    icon: Building2,
    target: "client",
    targetRequired: true,
    tone: "neutral",
  },
  {
    value: "users",
    summary: "User accounts and progress",
    label: "Users only",
    description:
      "Users belonging to one client — or every user in the institution if you pick none.",
    icon: Users,
    target: "client",
    targetRequired: false,
    tone: "neutral",
  },
  {
    value: "course",
    summary: "One course, fully expanded",
    label: "Course only",
    description: "One course and everything inside it, fully expanded.",
    icon: BookOpen,
    target: "course",
    targetRequired: true,
    tone: "info",
  },
  {
    value: "client-full",
    summary: "Client, users and every course",
    label: "Client (entire)",
    description:
      "The client, its service mappings, its users and all of its courses — each course complete.",
    icon: Layers,
    target: "client",
    targetRequired: true,
    recommended: true,
    tone: "brand",
  },
  {
    value: "institution",
    summary: "Everything in the institution",
    label: "Entire institution",
    description:
      "Everything belonging to your institution: all clients, all users, all courses expanded.",
    icon: Globe2,
    target: null,
    targetRequired: false,
    tone: "warn",
  },
] as const;

const SCOPE_BY_VALUE = new Map<BackupScope, BackupScopeOption>(
  SCOPE_OPTIONS.map((option) => [option.value, option])
);

export const scopeOption = (scope: BackupScope): BackupScopeOption | undefined =>
  SCOPE_BY_VALUE.get(scope);

export const scopeLabel = (scope: BackupScope): string =>
  SCOPE_BY_VALUE.get(scope)?.label ?? scope;

export function ScopePill({ scope }: { scope: BackupScope }) {
  const option = SCOPE_BY_VALUE.get(scope);
  return <StatusPill tone={option?.tone ?? "neutral"}>{option?.label ?? scope}</StatusPill>;
}

const STATUS_TONES: Record<BackupStatus, StatusPillTone> = {
  running: "warn",
  completed: "success",
  failed: "danger",
};

const STATUS_LABELS: Record<BackupStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function BackupStatusPill({ status }: { status: BackupStatus }) {
  return (
    <StatusPill tone={STATUS_TONES[status] ?? "neutral"} dot={status === "running"}>
      {STATUS_LABELS[status] ?? status}
    </StatusPill>
  );
}

export const destinationLabel = (destination: BackupDestination): string =>
  destination === "local" ? "Local file" : "Backup database";

/* ── Selectable tile — scope and destination pickers ─────────────────────── */

export interface OptionTileProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  description: string;
  /** Ribbon rendered top-right, e.g. the "Recommended" pill on Client (entire). */
  badge?: React.ReactNode;
  /** Draws the tile with the brand accent even when unselected. */
  emphasised?: boolean;
  className?: string;
}

/**
 * A radio dressed as a card. `role="radio"` on a button rather than a real
 * input because the tile carries an icon, a description and a badge — the
 * FieldKit `RadioItem` is a one-line control and would have to be fought.
 */
export function OptionTile({
  selected,
  onSelect,
  disabled = false,
  icon: Icon,
  label,
  description,
  badge,
  emphasised = false,
  className,
}: OptionTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-tile border p-3.5 text-left transition-colors duration-150 ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        selected
          ? "border-brand-strong bg-brand-wash"
          : emphasised
            ? "border-brand-300 bg-surface hover:border-brand-strong hover:bg-brand-wash/50"
            : "border-hairline-strong bg-surface hover:border-line-hover hover:bg-row-hover",
        disabled && "cursor-not-allowed opacity-50 hover:border-hairline-strong hover:bg-surface",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors",
          selected ? "border-brand-strong" : "border-line-muted"
        )}
      >
        {selected ? <span className="size-2.5 rounded-full bg-brand-strong" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              selected ? "text-brand-strong" : "text-subtle"
            )}
            aria-hidden
          />
          <span className="text-sm font-medium text-heading">{label}</span>
          {badge}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-subtle">
          {description}
        </span>
      </span>
    </button>
  );
}

/* ── Small labelled panel used for preview / restore reports ─────────────── */

export function ReportPanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-tile border border-hairline bg-canvas",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
          {title}
        </p>
        {subtitle ? <div className="text-xs text-subtle">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}
