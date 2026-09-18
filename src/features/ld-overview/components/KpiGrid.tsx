"use client";

import type { ReactNode } from "react";
import { Activity, AlertCircle, BookOpen, ClipboardCheck, Target } from "lucide-react";
import { count, pct } from "@/features/ld-dashboard/lib/format";
import { IconDot, Skeleton, Sparkline } from "./primitives";
import type { OverviewModel, Tone } from "../types";

/**
 * The five headline metrics — one compact row.
 *
 * Executive terminology (renamed 2026-09-04). The two easy-to-mix-up cards
 * moved off analytical jargon onto plain management language, because
 * "Practice" already means We Do inside SmartCliff and "Mastery" reads as a
 * heavier competency framework than what the number actually measures:
 *
 *   Assigned Activities  how much of the assigned work got DONE
 *                        (was "Practice Completion" — same calc, new label
 *                        + numerator/denominator lead)
 *   Average Score        how WELL learners performed on that work
 *                        (was "Skill Mastery" — same marks-weighted calc)
 *
 * The two metrics must not be confused: Assigned Activities answers "did
 * learners complete the work?", Average Score answers "how well did they
 * do?". Both draw from the same assignment + assessment pool.
 *
 * Each card is a link into the detailed report that explains it, so the row is
 * the entry point to the drill-down path rather than a dead end.
 *
 * Layout note: the card is [icon + title] / [value + sparkline] / [caption] /
 * [footer]. The sparkline shares the value's line box rather than sitting in a
 * band of its own, which is what keeps the card near 168px instead of the
 * ~260px it was when the two were stacked.
 */
export function KpiGrid({ model }: { model: OverviewModel | null }) {
  if (!model) {
    return (
      <div className="ldo-kpis">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="ldo-kpi">
            <div className="ldo-kpi-t"><Skeleton h={32} w={32} r={99} /><Skeleton h={12} w={90} /></div>
            <Skeleton h={30} w={76} />
            <div style={{ marginTop: 8 }}><Skeleton h={11} w="72%" /></div>
          </div>
        ))}
      </div>
    );
  }

  const { active, progress, practice, mastery, attention } = model;
  const periodLabel = active.window === null ? "on record" : `in the last ${active.window} days`;

  return (
    <div className="ldo-kpis">
      <Kpi
        icon={<Activity size={17} strokeWidth={2} />}
        tone="success"
        label="Active Learners"
        value={count(active.value)}
        caption={active.pct === null ? "No enrolled learners in scope" : <><b>{active.pct}%</b> active {periodLabel}</>}
        href="#perf-progress"
        title="Learners who last opened a course inside the selected activity period"
        spark={active.spark}
        sparkLabel="Learners submitting work each week"
      />
      <Kpi
        icon={<BookOpen size={17} strokeWidth={2} />}
        tone="info"
        label="Course Progress"
        value={pct(progress.value)}
        caption="Average curriculum completed"
        href="#rep-delivery"
        title="Mean share of assigned course content each learner has completed"
        spark={progress.spark}
        sparkLabel="Course progress, week by week"
      />
      <Kpi
        icon={<ClipboardCheck size={17} strokeWidth={2} />}
        tone="brand"
        label="Assigned Activities"
        // Numerator/denominator IS the headline number here — 74 / 1,435
        // tells an executive far more than "5%" would. The percentage
        // moves into the caption as a supporting rollup.
        value={
          practice.total > 0
            ? `${count(practice.done)} / ${count(practice.total)}`
            : "0 / 0"
        }
        caption={
          practice.total > 0 ? (
            <>
              <b>{pct(practice.value)} completed</b>
              <small>Assignments &amp; assessments</small>
            </>
          ) : (
            "No assignments or assessments assigned"
          )
        }
        href="#rep-performance"
        title="Assignments and assessments completed, out of those assigned"
        spark={practice.spark}
        sparkLabel="Assigned activities completed, week by week"
      />
      <Kpi
        icon={<Target size={17} strokeWidth={2} />}
        tone="brand"
        label="Average Score"
        value={pct(mastery.value)}
        caption="Across assignments & assessments"
        href="#perf-results"
        title="Marks-weighted performance across assignments and assessments — not completion"
        spark={mastery.spark}
        sparkLabel="Average score, week by week"
      />
      <Kpi
        icon={<AlertCircle size={17} strokeWidth={2} />}
        tone="danger"
        label="Needs Attention"
        value={count(attention.count)}
        caption={<><b>{attention.pct}%</b> of learners</>}
        href="#perf-progress"
        title="Learners who are at risk, inactive, or under-performing on You Do — counted once each"
      />
    </div>
  );
}

function Kpi({
  icon, tone, label, value, caption, href, title, spark, sparkLabel,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
  caption: ReactNode;
  href: string;
  title: string;
  spark?: number[];
  sparkLabel?: string;
}) {
  return (
    <a className="ldo-kpi" href={href} title={title}>
      <div className="ldo-kpi-t">
        <IconDot tone={tone}>{icon}</IconDot>
        <h3>{label}</h3>
      </div>
      <div className="ldo-kpi-v">
        <b>{value}</b>
        {spark && spark.length > 1 ? (
          <Sparkline points={spark} tone={tone} label={sparkLabel} width={72} height={28} />
        ) : null}
      </div>
      <p className="ldo-kpi-c">{caption}</p>
    </a>
  );
}
