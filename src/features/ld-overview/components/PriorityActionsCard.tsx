"use client";

import { ArrowRight, ChevronRight, CircleCheck } from "lucide-react";
import { Card, Skeleton } from "./primitives";
import type { OverviewModel } from "../types";

/**
 * The work queue. Every row is a real, currently-non-empty queue and links to
 * the existing screen that can act on it — rows with a zero count are dropped
 * in `deriveOverview` rather than rendered as an empty promise.
 *
 * The footer CTA goes to the Approval Queue, which is this console's actual
 * action centre; there is no separate "Action Centre" page to invent one for.
 */
export function PriorityActionsCard({ model }: { model: OverviewModel | null }) {
  if (!model) {
    return (
      <Card title="Priority Actions">
        <div style={{ display: "grid", gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={32} />)}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Priority Actions"
      right={<a className="ldo-link" href="#perf-progress">View all<ChevronRight size={12} strokeWidth={2.4} aria-hidden /></a>}
    >
      {model.actions.length === 0 ? (
        <div className="ldo-empty">
          <CircleCheck size={18} strokeWidth={1.8} aria-hidden style={{ color: "var(--good)" }} />
          <b>Nothing needs attention</b>
          <span>No learners are at risk, inactive or behind in this scope.</span>
        </div>
      ) : (
        <div className="ldo-acts">
          {model.actions.map((a) => (
            <a key={a.id} className="ldo-act" href={a.href} title={`${a.label} — ${a.detail}`}>
              <span className={`ldo-act-n t-${a.tone}`}>{a.count.toLocaleString()}</span>
              <span className="ldo-act-t">
                <b>{a.label}</b>
                <small>{a.detail}</small>
              </span>
              <ChevronRight className="chev" size={14} strokeWidth={2.2} aria-hidden />
            </a>
          ))}
        </div>
      )}
      <a className="ldo-cta" href="#appr-queue">
        Open Approval Queue
        <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
      </a>
    </Card>
  );
}
