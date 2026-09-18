"use client";

import { CheckCircle2, Repeat, Terminal, TriangleAlert, Lightbulb } from "lucide-react";
import { count } from "@/features/ld-dashboard/lib/format";
import { Card, Empty, IconDot, Skeleton } from "./primitives";
import type { OverviewModel, Tone } from "../types";

/**
 * How practice is actually going, at attempt level — one grouped card, not
 * five more KPI tiles.
 *
 * These five come from `/analytics/staff/analytics/ld-signals`, which walks
 * `questions[].attempts / score / isCorrect`. The main analytics roll-up
 * averages all of that away, so without the signals endpoint the card says so
 * rather than drawing zeroes.
 */
export function PracticeHealthCard({ model }: { model: OverviewModel | null }) {
  if (!model) {
    return (
      <Card title="Practice Health">
        <div className="ldo-health">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="ldo-metric">
              <Skeleton h={32} w={32} r={99} />
              <div style={{ marginTop: 8 }}><Skeleton h={14} /></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const h = model.health;
  if (h.attempts === null) {
    return (
      <Card title="Practice Health">
        <Empty title="Practice signals unavailable" hint="Attempt-level data could not be loaded — the rest of the page is unaffected." />
      </Card>
    );
  }
  if (h.attempts === 0) {
    return (
      <Card title="Practice Health">
        <Empty title="No practice attempts yet" hint="No assignment or assessment questions have been submitted in this scope." />
      </Card>
    );
  }

  const items: { icon: typeof Terminal; tone: Tone; value: string; label: string; title: string }[] = [
    {
      icon: Terminal, tone: "success", value: count(h.attempts), label: "Total Attempts",
      title: "Every submission attempt across assignment and assessment questions",
    },
    {
      icon: CheckCircle2, tone: "info", value: h.completionRate === null ? "—" : `${h.completionRate}%`, label: "Completion Rate",
      title: "Attempted questions that reached a passing score",
    },
    {
      icon: Repeat, tone: "brand", value: h.avgAttempts === null ? "—" : h.avgAttempts.toFixed(1), label: "Avg. Attempts to Solve",
      title: "Attempts spent per question that was solved",
    },
    {
      icon: Lightbulb, tone: "warning", value: h.solvedIndependently === null ? "—" : `${h.solvedIndependently}%`, label: "Solved Independently",
      title: "Questions solved on the first attempt, with no retry",
    },
    {
      icon: TriangleAlert, tone: "danger", value: count(h.struggling), label: "Learners Struggling",
      title: "Learners with a question still unsolved after three or more attempts",
    },
  ];

  return (
    <Card title="Practice Health">
      <div className="ldo-health">
        {items.map((it) => (
          <div key={it.label} className="ldo-metric" title={it.title}>
            <IconDot tone={it.tone}><it.icon size={15} strokeWidth={2} /></IconDot>
            <b>{it.value}</b>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
