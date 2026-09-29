/**
 * Presentation-only formatting. No business rules live here — anything that
 * decides *what* a number means belongs in `metrics.ts`.
 */

import type { Tone } from "../types";

/** Coerce an unknown API value to a safe number. */
export const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** Percent label. `null` renders as an em dash so "no data" never reads as 0%. */
export const pct = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${Math.round(v)}%`;

/** Thousands-separated count. */
export const count = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toLocaleString();

/** "3 courses" / "1 course" without a stray plural. */
export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Two-letter monogram for avatars. */
export const initials = (name: string): string => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Health band for a completion percentage.
 * The thresholds match the ones the console already used (85 / 50) so the
 * redesign does not silently re-label a course that was previously "on track".
 */
export const band = (v: number | null): { tone: Tone; label: string } => {
  if (v === null) return { tone: "neutral", label: "No data" };
  if (v >= 85) return { tone: "success", label: "On track" };
  if (v < 50) return { tone: "danger", label: "Needs attention" };
  return { tone: "warning", label: "In progress" };
};

/** Score band — scores are judged more leniently than completion. */
export const scoreBand = (v: number | null): Tone => {
  if (v === null) return "neutral";
  if (v >= 70) return "success";
  if (v >= 50) return "warning";
  return "danger";
};

/** Relative timestamp, e.g. "12m ago", "Yesterday", "04 Jun". */
export const relDate = (iso: string): string => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  const diff = Date.now() - t.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return t.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/** Clamp a bar width so a 0.4% value is still visible as a sliver. */
export const barWidth = (v: number | null): string =>
  `${Math.max(3, Math.min(100, v ?? 0))}%`;

/* ── Tone → class maps ─────────────────────────────────────────────────────
   Centralised so a tone means exactly one thing everywhere. Tailwind needs
   whole class names at build time, hence the literal maps rather than
   interpolation. */

export const toneText: Record<Tone, string> = {
  neutral: "text-subtle",
  brand: "text-brand-500 dark:text-brand-400",
  success: "text-success-700 dark:text-success-500",
  warning: "text-warn-700 dark:text-warn-500",
  danger: "text-danger-700 dark:text-danger-500",
  info: "text-info-700 dark:text-info-500",
};

export const toneBg: Record<Tone, string> = {
  neutral: "bg-ink-100 dark:bg-ink-800",
  brand: "bg-brand-100 dark:bg-brand-500/15",
  success: "bg-success-50 dark:bg-success-500/15",
  warning: "bg-warn-50 dark:bg-warn-500/15",
  danger: "bg-danger-50 dark:bg-danger-500/15",
  info: "bg-info-50 dark:bg-info-500/15",
};

export const toneFill: Record<Tone, string> = {
  neutral: "bg-ink-300 dark:bg-ink-600",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warn-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
};

export const toneRing: Record<Tone, string> = {
  neutral: "ring-ink-200 dark:ring-ink-700",
  brand: "ring-brand-200 dark:ring-brand-500/30",
  success: "ring-success-500/20",
  warning: "ring-warn-500/20",
  danger: "ring-danger-500/20",
  info: "ring-info-500/20",
};

/** Raw hex for chart libraries, which cannot read Tailwind classes. */
export const toneHex: Record<Tone, string> = {
  neutral: "#9ca3af",
  brand: "#f97316",
  success: "#22c55e",
  warning: "#ca8a04",
  danger: "#ef4444",
  info: "#3b82f6",
};
