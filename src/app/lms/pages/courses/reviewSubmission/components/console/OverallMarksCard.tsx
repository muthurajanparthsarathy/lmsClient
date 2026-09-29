"use client";

import { CARD } from "./tokens";

interface OverallMarksCardProps {
  earned: number;
  total: number;
  /** Nothing submitted anywhere in the assessment — draw an empty ring. */
  attempted: boolean;
}

const SIZE = 112;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function OverallMarksCard({
  earned,
  total,
  attempted,
}: OverallMarksCardProps) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  const dash = attempted ? (Math.min(100, Math.max(0, pct)) / 100) * CIRC : 0;
  const arc =
    pct >= 80 ? "#12A15C" : pct >= 60 ? "#22C55E" : pct > 0 ? "#22C55E" : "#CBD8EA";

  return (
    <section className={`${CARD} px-4 pb-3.5 pt-3.5`}>
      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-[#0B1437]">
        Overall Marks
      </h2>

      <div className="relative mx-auto mt-1.5 flex items-center justify-center">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${earned} of ${total} marks, ${pct} percent`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="#EAF0F9"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={arc}
            strokeWidth={STROKE}
            strokeDasharray={`${dash} ${CIRC}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: "stroke-dasharray 400ms ease" }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[23px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[#0B1437]">
            {earned} / {total}
          </span>
          <span className="mt-1.5 text-[12px] font-semibold tabular-nums text-[#39496B]">
            {pct}%
          </span>
        </div>
      </div>
    </section>
  );
}
