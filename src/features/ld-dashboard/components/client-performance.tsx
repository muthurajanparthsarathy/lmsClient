"use client";

/**
 * Client performance rollup.
 *
 * Each client is one block with a completion meter and a four-metric footer.
 * The sparkline (when a client runs more than one course) plots per-course
 * completion, so a client whose headline average looks fine but has one
 * failing course is visible without drilling in.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Building2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { ClientPerf } from "../types";
import { band, count, pct, toneHex } from "../lib/format";
import { EmptyState } from "./states";
import { Meter, MetricPair, ScrollArea, SectionCard } from "./ui-kit";

function ClientBlock({ c, index }: { c: ClientPerf; index: number }) {
  const reduce = useReducedMotion();
  const health = band(c.avg);
  const spark = c.sparks.length > 1 ? [...c.sparks].map((v, i) => ({ i, v })) : null;
  const gid = `cl-${index}`;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : index * 0.04 }}
      className="rounded-control border border-hairline bg-surface-sunken p-3 transition-colors duration-fast hover:border-hairline-strong dark:bg-ink-800/40"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-chip bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-500">
          <Building2 size={13} strokeWidth={2.2} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">{c.name}</p>
        {spark && (
          <span className="h-6 w-14 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={toneHex.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={toneHex.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 100]} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={toneHex.brand}
                  strokeWidth={1.5}
                  fill={`url(#${gid})`}
                  dot={false}
                  isAnimationActive={!reduce}
                />
              </AreaChart>
            </ResponsiveContainer>
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Meter value={c.avg} tone={health.tone} className="flex-1" label={`${c.name} completion`} />
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            c.avg === null ? "text-faint" : "text-heading",
          )}
        >
          {pct(c.avg)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-hairline pt-2.5">
        <MetricPair label="Students" value={count(c.students)} />
        <MetricPair label="Avg score" value={pct(c.score)} />
        <MetricPair
          label="Att. today"
          value={c.attendance && c.attendance.total ? `${c.attendance.marked}/${c.attendance.total}` : "—"}
          title="In-delivery batches with attendance marked today"
        />
        <MetricPair label="At risk" value={count(c.risk)} tone={c.risk ? "danger" : undefined} />
      </dl>
    </motion.li>
  );
}

export function ClientPerformance({
  clients,
  className,
}: {
  clients: ClientPerf[];
  className?: string;
}) {
  return (
    <SectionCard
      title="Client performance"
      action={clients.length ? { label: "View all", href: "#courses" } : undefined}
      className={className}
    >
      {clients.length === 0 ? (
        <EmptyState icon={Building2} title="No clients in this view" hint="Widen the filter above to compare accounts." />
      ) : (
        <ScrollArea>
          <ul className="grid gap-2.5">
            {clients.map((c, i) => (
              <ClientBlock key={c.name} c={c} index={i} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </SectionCard>
  );
}
