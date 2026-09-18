"use client";

import { count } from "@/features/ld-dashboard/lib/format";
import { Card, Empty, Skeleton } from "./primitives";
import type { DistributionSlice, OverviewModel } from "../types";

/**
 * Where the filtered learner population sits on the readiness scale.
 *
 * Bands and their cut points live in `lib/readiness.ts`. Each legend row is a
 * link into the learner-level report, so a segment is a way INTO the detail
 * rather than a picture of it.
 */
export function LearnerDistributionCard({ model }: { model: OverviewModel | null }) {
  if (!model) {
    return (
      <Card title="Learner Distribution">
        <div className="ldo-dist">
          <Skeleton h={132} w={132} r={99} />
          <div style={{ display: "grid", gap: 6 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={26} />)}
          </div>
        </div>
      </Card>
    );
  }

  if (model.distributionTotal === 0) {
    return (
      <Card title="Learner Distribution">
        <Empty title="No learners in this scope" hint="Adjust the client or course filter to see the distribution." />
      </Card>
    );
  }

  return (
    <Card title="Learner Distribution">
      <div className="ldo-dist">
        <Donut slices={model.distribution} total={model.distributionTotal} />
        <div className="ldo-legend">
          {model.distribution.map((s) => (
            <a key={s.key} className="ldo-leg" href={s.href} title={s.hint}>
              <i style={{ background: s.color }} aria-hidden />
              <span>{s.label}</span>
              <b>{count(s.count)}</b>
              <em>({s.pct}%)</em>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** SVG donut. Segments are drawn as stroked arcs on one circle so there are no
 *  seams between them and no path maths per slice. */
function Donut({ slices, total }: { slices: DistributionSlice[]; total: number }) {
  const R = 52;
  const W = 20;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="ldo-donut">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Learner distribution by readiness band">
        <circle cx="66" cy="66" r={R} fill="none" stroke="var(--grid)" strokeWidth={W} />
        {slices.map((s) => {
          if (!s.count) return null;
          const len = (s.count / total) * C;
          const el = (
            <circle
              key={s.key}
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={W}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 66 66)"
            >
              <title>{`${s.label}: ${s.count.toLocaleString()} (${s.pct}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="ldo-donut-c">
        <b>{count(total)}</b>
        <span>Total Learners</span>
      </div>
    </div>
  );
}
