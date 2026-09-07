"use client";

/**
 * Hero KPI tile.
 *
 * HONESTY NOTE — deliberately no "↑20% from last month" badge.
 * The analytics endpoints backing this console return a *current snapshot*
 * only; there is no historical series to diff against. A month-over-month
 * delta would therefore have to be invented, and an invented number on an
 * executive dashboard is worse than no number.
 *
 * What IS real is the spread of the metric across the courses in scope, so the
 * sparkline plots that distribution (sorted low→high) and is labelled as such.
 * It answers a question the reference design could not: "is this average hiding
 * a few very weak courses?"
 */

import { motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { Icon, Tone } from "../types";
import { toneBg, toneHex, toneText } from "../lib/format";
import { Meter } from "./ui-kit";

export interface KpiCardProps {
  label: string;
  value: string;
  caption: string;
  icon: Icon;
  tone?: Tone;
  /** 0–100 fill for the meter. Omit to hide it. */
  meter?: number | null;
  /** Real per-course values. Rendered as a distribution, not a trend. */
  spread?: number[];
  spreadLabel?: string;
  href?: string;
  index?: number;
}

export function KpiCard({
  label,
  value,
  caption,
  icon: Ico,
  tone = "brand",
  meter,
  spread,
  spreadLabel,
  href,
  index = 0,
}: KpiCardProps) {
  const reduce = useReducedMotion();
  const series = (spread ?? []).filter((v) => Number.isFinite(v));
  const showSpark = series.length >= 3;
  const data = showSpark ? [...series].sort((a, b) => a - b).map((v, i) => ({ i, v })) : [];
  const gradientId = `kpi-grad-${label.replace(/\W+/g, "-").toLowerCase()}`;

  const Wrapper = href ? motion.a : motion.div;

  return (
    <Wrapper
      {...(href ? { href } : {})}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : index * 0.04 }}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-tile border border-hairline bg-surface p-4 shadow-sm sm:p-5",
        "transition-shadow duration-base ease-standard hover:shadow-md",
        href &&
          "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1",
      )}
    >
      {/* No tone rail: the tone already colours the icon chip and the
          sparkline/meter, and clean card edges are what keeps the grid calm. */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-2xs font-semibold tracking-wide text-subtle uppercase">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-chip",
            toneBg[tone],
            toneText[tone],
          )}
        >
          <Ico size={15} strokeWidth={2.2} aria-hidden />
        </span>
      </div>

      {/* text-4xl is 30px — the top of the ramp, and within a few percent of the
          spec's ~32px. Adding a 32px step would put one number in the product
          on a size nothing else can reach. */}
      <p className="mt-2.5 text-3xl leading-none font-semibold tracking-[-0.02em] tabular-nums text-heading sm:text-4xl">
        {value}
      </p>

      {showSpark && (
        <div className="mt-2.5 -mx-1 h-8" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={toneHex[tone]} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={toneHex[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Domain is padded past 0–100 so a course sitting at exactly 0%
                  still draws a visible line instead of being clipped flush
                  against the bottom edge — which reads as "chart broken"
                  rather than "these courses have not started". */}
              <YAxis hide domain={[-6, 106]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={toneHex[tone]}
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                isAnimationActive={!reduce}
                animationDuration={420}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!showSpark && meter !== undefined && meter !== null && (
        <Meter value={meter} tone={tone} className="mt-3" label={`${label}: ${value}`} />
      )}

      <p className="mt-2 text-2xs leading-relaxed text-subtle">
        {showSpark && spreadLabel ? spreadLabel : caption}
      </p>
    </Wrapper>
  );
}
