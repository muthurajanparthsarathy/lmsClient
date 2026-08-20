"use client";
import React from "react";
import type { ServiceMapping } from "@/apiServices/serviceMappingService";
import type { StatusPillTone } from "../../../shared/ui";

// Presentation-only helpers shared by the Course Setup list's table and card
// views. No data or business logic lives here — MappingList builds the view
// models from the mappings + the hub's progress lookup and hands them down.

export type MappingStatus = "configured" | "in-progress" | "not-started" | "no-courses";

export interface MappingRowVM {
  mapping: ServiceMapping;
  id: string;
  clientName: string;
  // Short business-model code (B2B / B2I / B2C). The full "Business to Business"
  // wording sits in the tooltip; the cell shows just the acronym.
  businessModel: string;
  serviceCode: string;
  service: string;
  models: string[];
  year: string;
  status: MappingStatus;
  configured: number;
  total: number;
  updatedAt?: string;
  isInactive: boolean;
  /**
   * The course names mapped under this row, so the list can be searched and
   * filtered by course. A mapping is found by what it TEACHES at least as often
   * as by its client or service code, and neither of those tells you whether the
   * course you are looking for is in there.
   */
  courses: string[];
}

export const STATUS_META: Record<MappingStatus, { label: string; tone: StatusPillTone }> = {
  // The table has no Progress column — the status label alone must say how
  // far along a mapping is, hence "Fully/Partially" rather than bare states.
  configured: { label: "Fully configured", tone: "success" },
  "in-progress": { label: "Partially configured", tone: "warn" },
  "not-started": { label: "Not started", tone: "neutral" },
  "no-courses": { label: "No courses", tone: "neutral" },
};

export function statusOf(configured: number, total: number): MappingStatus {
  if (total === 0) return "no-courses";
  if (configured >= total) return "configured";
  if (configured === 0) return "not-started";
  return "in-progress";
}

// Deterministic avatar tint from the client name (stable across renders).
const AVATARS = [
  "bg-info-50 text-info-700",
  "bg-brand-wash text-brand-strong",
  "bg-success-50 text-success-700",
  "bg-warn-50 text-warn-700",
  "bg-danger-50 text-danger-700",
];
const tintHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
export const avatarClass = (name: string) => AVATARS[tintHash(name) % AVATARS.length];

const MODEL_TONES: Record<string, string> = {
  "placement training": "bg-brand-wash text-brand-strong",
  "degree program": "bg-brand-wash text-brand-strong",
  skilling: "bg-info-50 text-info-700",
  td: "bg-success-50 text-success-700",
  htd: "bg-warn-50 text-warn-700",
};
const MODEL_FALLBACK = [
  "bg-brand-wash text-brand-strong",
  "bg-info-50 text-info-700",
  "bg-success-50 text-success-700",
  "bg-warn-50 text-warn-700",
];
export const modelTone = (m: string) =>
  MODEL_TONES[m.trim().toLowerCase()] || MODEL_FALLBACK[tintHash(m) % MODEL_FALLBACK.length];

export const clientNameOf = (m: ServiceMapping): string =>
  typeof m.client === "string" ? "" : m.client?.clientCompany || "N/A";
export const clientIdOf = (m: ServiceMapping): string =>
  typeof m.client === "string" ? m.client : m.client?._id || "";

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Small presentational pieces ──────────────────────────────────────────────

export function ClientAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-6 h-6 text-2xs" : "w-9 h-9 text-xs";
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${avatarClass(name)}`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase() || "C"}
    </span>
  );
}

export function ModelBadges({ models, max = 2 }: { models: string[]; max?: number }) {
  const shown = models.slice(0, max);
  const extra = models.length - shown.length;
  if (!models.length) return <span className="text-2xs text-line-muted">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap ${modelTone(s)}`}
        >
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center h-[22px] px-1.5 rounded-chip bg-ink-100 text-ink-600 text-2xs font-semibold">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function MappingProgress({
  configured,
  total,
  className = "",
}: {
  configured: number;
  total: number;
  className?: string;
}) {
  if (total === 0) {
    return <span className={`text-2xs text-line-muted ${className}`}>No courses</span>;
  }
  const pct = Math.round((configured / total) * 100);
  const done = configured >= total;
  return (
    <div className={`min-w-[92px] ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-semibold text-body tabular-nums">
          {configured}/{total}
        </span>
        <span className="text-2xs text-subtle tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? "bg-success-500" : "bg-brand-500"}`}
          style={{ width: `${Math.max(pct, total > 0 && configured > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  );
}
