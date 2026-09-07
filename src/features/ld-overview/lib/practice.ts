/**
 * Practice vocabulary — the one place that decides what "Assignment" and
 * "Assessment" mean in this platform.
 *
 * The pedagogy sub-categories are institution-configurable
 * (`pedagogystructuredynamics`), so they are NOT a fixed enum. Live data
 * currently carries:
 *
 *   We_Do  → assignment, assignments, practical, lab, problem solving,
 *            project development, group discussions, discussion
 *   You_Do → assesment, assesments, test_your_skills, projects, exercise,
 *            live coading
 *   I_Do   → lecture, theory, live classes, video …  (concept material)
 *
 * `assesment` / `assesments` are the platform's own long-standing spellings —
 * matching on them is deliberate, not a typo.
 *
 * Rule, in order:
 *   1. The sub-category NAME wins when it names the artefact explicitly.
 *   2. Otherwise the stage decides: We Do is guided practice → Assignment,
 *      You Do is independent execution → Assessment.
 *   3. I Do is concept understanding, never required practice — it is excluded
 *      from Practice Completion and Skill Mastery by design, which is what
 *      keeps "how much work got done" separate from "how much was watched".
 */

/** What a (stage, sub-category) pair counts as. */
export type PracticeKind = "assignment" | "assessment" | "concept";

const ASSIGNMENT_RE = /assign|practical|\blab\b|problem|project|discussion|workshop/i;
const ASSESSMENT_RE = /assess|assesment|exam|quiz|test|evaluat|certif/i;

export function classifyCategory(stage: string, category: string): PracticeKind {
  if (stage === "I_Do") return "concept";
  // Name first — a "Test Your Skills" bucket parked under We Do is still an
  // assessment, and an "Assignment" bucket under You Do is still an assignment.
  if (ASSESSMENT_RE.test(category)) return "assessment";
  if (ASSIGNMENT_RE.test(category)) return "assignment";
  return stage === "You_Do" ? "assessment" : "assignment";
}

/** A learner's roll-up across the categories that count as required practice. */
export interface PracticeTally {
  /** Required assignments + assessments the learner has completed. */
  done: number;
  /** Required assignments + assessments assigned to the learner. */
  total: number;
  /** The You Do slice of the two above — independent execution only. */
  youDoDone: number;
  youDoTotal: number;
  /** Mean performance across those same categories, or null when unscored. */
  score: number | null;
  /** We Do performance only — Guided Practice Performance. */
  weDoScore: number | null;
  /** Assessment-only performance — the Industry Readiness contributor. */
  assessmentScore: number | null;
  /** You Do performance — Independent Performance. */
  independentScore: number | null;
}

const mean = (vals: number[]): number | null =>
  vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;

/**
 * Walk one learner's `progress` object from the staff analytics roll-up.
 *
 * Shape (server: `staffStudentAnalytics`):
 *   progress[stage][category] = { completed, total, percentage, questionProgress }
 *
 * `completed` / `total` are exercise counts → Practice Completion.
 * `percentage` is the server's marks-weighted score → Skill Mastery. Reusing
 * it is deliberate: it is the same number `scoreOf()` on the L&D dashboard
 * already calls "average score", so the two surfaces cannot disagree.
 */
export function tallyPractice(progress: any): PracticeTally {
  let done = 0;
  let total = 0;
  let youDoDone = 0;
  let youDoTotal = 0;
  const scores: number[] = [];
  const weDoOnly: number[] = [];
  const assessment: number[] = [];
  const independent: number[] = [];

  if (progress && typeof progress === "object") {
    ["We_Do", "You_Do"].forEach((stage) => {
      const cats = progress[stage];
      if (!cats || typeof cats !== "object") return;
      Object.entries(cats).forEach(([category, raw]) => {
        const sub = raw as any;
        if (!sub || typeof sub !== "object" || !("total" in sub)) return;
        const kind = classifyCategory(stage, category);
        if (kind === "concept") return;

        const t = Number(sub.total) || 0;
        if (t <= 0) return;
        const c = Number(sub.completed) || 0;
        done += c;
        total += t;
        if (stage === "You_Do") {
          youDoDone += c;
          youDoTotal += t;
        }

        if (typeof sub.percentage === "number") {
          const p = Number(sub.percentage) || 0;
          scores.push(p);
          if (kind === "assessment") assessment.push(p);
          if (stage === "We_Do") weDoOnly.push(p);
          if (stage === "You_Do") independent.push(p);
        }
      });
    });
  }

  return {
    done,
    total,
    youDoDone,
    youDoTotal,
    score: mean(scores),
    weDoScore: mean(weDoOnly),
    assessmentScore: mean(assessment),
    independentScore: mean(independent),
  };
}
