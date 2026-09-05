/**
 * Industry Readiness — the one composite this dashboard introduces.
 *
 * ─── Status ────────────────────────────────────────────────────────────────
 * The platform does NOT ship an Industry Readiness score. Nothing in the
 * models, the analytics roll-up or the existing reports computes one, so there
 * was no existing rule to reuse. What follows is a PROPOSED formula, kept in
 * this file alone so a product decision to reweight it is a one-line change
 * and never a hunt through components.
 *
 * ─── Proposed formula — PERFORMANCE-DRIVEN ─────────────────────────────────
 * Three stage-performance contributors, each already a real measured score
 * out of 100:
 *
 *   I Do Performance    Concept Understanding      score on I Do checks
 *   We Do Performance   Guided Practice            marks on assignments
 *   You Do Performance  Independent Performance    marks on assessments
 *
 *   readiness = Σ (weight × contributor) / Σ (weight of contributors present)
 *
 * The reason this replaced the earlier "progress + practice + assessment +
 * independent" mix: readiness must answer "can learners perform?", not "how
 * much did they complete?" — those are already the Overview's Course Progress
 * and Practice Completion cards. So readiness now uses only PERFORMANCE
 * measures. If a contributor doesn't exist (I Do has no score-based content,
 * a course has no assessments configured), it is DROPPED rather than counted
 * as zero, and the remaining weights are renormalised. A course with no
 * measured performance at all returns null, which every caller renders as an
 * em dash instead of 0.
 *
 * The weights lean heavily on You Do (55%) because independent execution is
 * the strongest signal of employability — SmartCliff's actual question. We Do
 * (30%) confirms the learner can apply the concept with support; I Do (15%)
 * confirms understanding.
 */

export const READINESS_WEIGHTS = {
  iDo: 15,
  weDo: 30,
  youDo: 55,
} as const;

export interface ReadinessInput {
  /** I Do performance — score on concept checks. Usually null: the platform's
   *  I Do progress is completion-based, not score-based. */
  iDo: number | null;
  /** We Do performance — marks on guided practice (assignments etc.). */
  weDo: number | null;
  /** You Do performance — marks on independent execution (assessments etc.). */
  youDo: number | null;
}

/** Weighted mean of whichever contributors exist. `null` when none do. */
export function industryReadiness(input: ReadinessInput): number | null {
  let sum = 0;
  let weight = 0;
  (Object.keys(READINESS_WEIGHTS) as (keyof ReadinessInput)[]).forEach((k) => {
    const v = input[k];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const w = READINESS_WEIGHTS[k];
    sum += Math.max(0, Math.min(100, v)) * w;
    weight += w;
  });
  return weight > 0 ? Math.round(sum / weight) : null;
}

/* ── Learner bands ─────────────────────────────────────────────────────────
   Where each learner sits on the same readiness scale. The cut points line up
   with thresholds the console already uses elsewhere: 50 is the platform's
   at-risk line (`overall > 0 && overall < 50` on the L&D dashboard) and 80 is
   what `staffStudentAnalytics` treats as a completed learner. */

export type ReadinessBandKey = "ready" | "track" | "support" | "risk";

export interface ReadinessBand {
  key: ReadinessBandKey;
  label: string;
  /** Inclusive lower bound on the readiness score. */
  min: number;
  hint: string;
}

export const READINESS_BANDS: ReadinessBand[] = [
  { key: "ready", label: "Industry Ready", min: 80, hint: "Performing independently at target" },
  { key: "track", label: "On Track", min: 50, hint: "Progressing, no intervention needed" },
  { key: "support", label: "Needs Support", min: 35, hint: "Falling behind on practice or marks" },
  { key: "risk", label: "At Risk", min: 0, hint: "Below the platform's at-risk line" },
];

export function bandOf(score: number | null): ReadinessBandKey | null {
  if (score === null) return null;
  return (READINESS_BANDS.find((b) => score >= b.min) ?? READINESS_BANDS[READINESS_BANDS.length - 1]).key;
}

/** Course health label — the same scale, phrased for a course row. */
export type CourseStatus = "Strong" | "On Track" | "Attention" | "At Risk";

export function courseStatus(score: number | null): CourseStatus | null {
  if (score === null) return null;
  if (score >= 80) return "Strong";
  if (score >= 60) return "On Track";
  if (score >= 45) return "Attention";
  return "At Risk";
}
