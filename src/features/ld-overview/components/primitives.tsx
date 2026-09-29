"use client";

/**
 * Shared building blocks for the Overview cards. Everything is plain SVG or a
 * `ldo-` class from `styles.ts` — no new dependency, and no colour that is not
 * a `.ldx` design token.
 */

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Inbox, Minus } from "lucide-react";
import type { Tone } from "../types";

export function Card({
  title,
  sub,
  right,
  className = "",
  children,
}: {
  title?: string;
  sub?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`ldo-card ${className}`.trim()}>
      {title ? (
        <header className="ldo-card-h">
          <h2>{title}</h2>
          {sub ? <span className="sub">{sub}</span> : null}
          {right ? <div className="right">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Round tinted icon holder — the reference's KPI and metric glyph container. */
export function IconDot({ tone = "brand", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ldo-ico t-${tone}`} aria-hidden>{children}</span>;
}

/** Percentage-point change against the preceding window. Renders nothing when
 *  the comparison is not derivable — a fabricated delta is worse than none. */
export function Delta({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return null;
  const dir = value > 0.05 ? "up" : value < -0.05 ? "down" : "flat";
  const Ico = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <>
      <span className={`ldo-delta ${dir}`}>
        <Ico size={12} strokeWidth={2.6} aria-hidden />
        {Math.abs(value).toFixed(1)} pts
      </span>
      <span>{suffix}</span>
    </>
  );
}

/** Tiny trend line. Renders nothing below two real points. */
export function Sparkline({
  points,
  tone = "brand",
  width = 56,
  height = 18,
  label,
}: {
  points: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  /** What the line actually plots — shown on hover, because a sparkline beside
   *  a KPI is easily read as that KPI's own history when it is not. */
  label?: string;
}) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(height - ((p - min) / span) * (height - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      className="ldo-spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label ? <title>{label}</title> : null}
      <path d={d} fill="none" stroke={TONE_VAR[tone]} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tone → the `.ldx` CSS variable holding that colour. Charts and SVG cannot
 *  read a Tailwind class, so they read these instead. */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--muted)",
  brand: "var(--accent)",
  success: "var(--good)",
  warning: "var(--warn)",
  danger: "var(--bad)",
  info: "var(--ch2)",
};

/** Health tone for a 0–100 metric. 80 / 60 are the same cut points the course
 *  status bands use, so a bar and a badge never disagree. */
export const meterTone = (v: number | null): Tone =>
  v === null ? "neutral" : v >= 80 ? "success" : v >= 60 ? "brand" : v >= 45 ? "warning" : "danger";

/** Value + inline progress bar, the Course Health cell shape. */
export function MeterCell({ value }: { value: number | null }) {
  const tone = meterTone(value);
  return (
    <div className="ldo-cell">
      <b>{value === null ? "—" : `${value}%`}</b>
      <span className="ldo-track" role={value === null ? undefined : "progressbar"} aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        {value === null ? null : <i style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: TONE_VAR[tone] }} />}
      </span>
    </div>
  );
}

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`ldo-chip t-${tone}`}>{children}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ldo-empty">
      <Inbox size={18} strokeWidth={1.8} aria-hidden />
      <b>{title}</b>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

export function Skeleton({ h = 14, w = "100%", r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="ldo-sk" style={{ display: "block", height: h, width: w, borderRadius: r }} aria-hidden />;
}
