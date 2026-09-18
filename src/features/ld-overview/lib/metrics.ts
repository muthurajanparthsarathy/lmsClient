/**
 * L&D Overview — derivation layer.
 *
 * One pure function over the raw payloads, so every number on screen is
 * traceable and no component does arithmetic. Rules already defined elsewhere
 * in the platform are REUSED rather than restated:
 *
 *   at risk        started but under 50% overall   (L&D dashboard rule)
 *   completed      80% or more overall             (staffStudentAnalytics)
 *   stage %        completed/total across a stage  (`stageDone`, shared)
 *   score          the server's marks-weighted `percentage`
 *
 * New rules introduced here are named constants at the top of their section
 * with the reasoning beside them. Percentages are `null`, never 0, when the
 * underlying content does not exist — "no assessments configured" and "every
 * assessment failed" must never render the same.
 */

import { mondayKey, stageDone, weekLabel } from "@/features/ld-dashboard/lib/metrics";
import { tallyPractice, type PracticeTally } from "./practice";
import { bandOf, courseStatus, industryReadiness, READINESS_BANDS, READINESS_WEIGHTS } from "./readiness";
import type {
  CourseHealthRow,
  DistributionSlice,
  JourneyGap,
  JourneyStage,
  OverviewFilter,
  OverviewModel,
  PriorityAction,
  Tone,
  TrendPoint,
} from "../types";

/* ── new rules, named ─────────────────────────────────────────────────────── */

/** Days without activity before a learner is chased. Matches the L&D
 *  dashboard's "inactive 7+ days" alert. */
const INACTIVE_DAYS = 7;
/** Points below a learner's own course average that count as behind schedule.
 *  Relative, not absolute: a cohort that is uniformly early in a course is not
 *  "behind", but a learner trailing their peers by this much is. */
const BEHIND_COURSE_GAP = 15;
/** You Do performance under this needs teaching intervention — the platform's
 *  at-risk line applied to independent execution. */
const LOW_YOUDO = 50;
/** Drop between two consecutive stages that counts a learner as struggling at
 *  that transition. */
const STAGE_DROP = 15;
/** Stage colouring — 80/60 mirrors the `Strong` / `On Track` course bands. */
const stageTone = (v: number | null): Tone =>
  v === null ? "neutral" : v >= 80 ? "success" : v >= 60 ? "warning" : "danger";

const DAY = 86_400_000;

/* ── small helpers ────────────────────────────────────────────────────────── */

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const mean = (vals: number[]): number | null =>
  vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
/** Safe percentage. `null` when there is no denominator — never NaN, never 0. */
const ratio = (a: number, b: number): number | null =>
  b > 0 ? Math.round((a / b) * 100) : null;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

const roleName = (role: any): string => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return (role.renameRole || role.originalRole || role.roleValue || role.name || "").toString();
};

/* ── payload normalisers ──────────────────────────────────────────────────── */

export interface OverviewCourse {
  id: string;
  name: string;
  client: string;
  students: number;
  avg: number;
}

export interface OverviewStudent {
  id: string;
  name: string;
  courseId: string;
  overall: number;
  iDo: number | null;
  weDo: number | null;
  youDo: number | null;
  practice: PracticeTally;
  /** Total attempts / possible attempts as the server counted them — the
   *  denominator behind Course Progress. */
  attempts: number;
  possible: number;
  readiness: number | null;
  last: number | null;
}

export interface AnalyticsShape {
  courses: OverviewCourse[];
  students: OverviewStudent[];
}

/** Payload → flat rows. Deliberately does NOT resolve client names: this runs
 *  memoised on the raw payload, and the course→client map arrives from a
 *  separate request. `deriveOverview` resolves them, where the map is a
 *  dependency. */
export function parseOverviewAnalytics(j: any): AnalyticsShape {
  const d = j?.data ?? j ?? {};
  const raw: any[] = Array.isArray(d.courses) ? d.courses : [];
  const courses: OverviewCourse[] = [];
  const students: OverviewStudent[] = [];

  raw.forEach((c) => {
    const co = c.course ?? {};
    const s = c.stats ?? {};
    const id = String(co._id || c._id || "");
    courses.push({
      id,
      name: co.courseName || c.courseName || "Untitled",
      client: co.clientName || "Unassigned",
      students: num(s.totalStudents ?? co.totalStudents),
      avg: num(s.averageProgress),
    });

    (Array.isArray(c.students) ? c.students : []).forEach((stu: any) => {
      const p = stu.progress ?? {};
      const st = stu.student ?? {};
      const practice = tallyPractice(p);
      const overall = num(p.overall);
      const last = stu.lastActivity ? Date.parse(stu.lastActivity) || null : null;
      students.push({
        id: String(st._id || st.email || `${id}-${students.length}`),
        name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
        courseId: id,
        overall,
        iDo: stageDone(p, "I_Do"),
        weDo: stageDone(p, "We_Do"),
        youDo: stageDone(p, "You_Do"),
        practice,
        attempts: num(p.metadata?.totalAttempts),
        possible: num(p.metadata?.totalPossibleAttempts),
        readiness: industryReadiness({
          // I Do is completion-tracked in the platform, not score-tracked, so
          // the per-learner readiness leans on We Do / You Do performance.
          iDo: null,
          weDo: practice.weDoScore,
          youDo: practice.independentScore,
        }),
        last,
      });
    });
  });

  return { courses, students };
}

/** One course's row out of `/analytics/staff/analytics/ld-signals`. */
export interface SignalWeek {
  w: string;
  act: number;
  ex: number;
  skillSum: number;
  skillN: number;
  youSum: number;
  youN: number;
}
export interface SignalCourse {
  courseId: string;
  learners: number;
  attempts: number;
  attemptedQuestions: number;
  solvedQuestions: number;
  firstTrySolved: number;
  strugglingLearners: number;
  repeatFailLearners: number;
  weeks: SignalWeek[];
}

export function parseSignals(j: any): SignalCourse[] {
  const rows = j?.data?.courses;
  return Array.isArray(rows) ? (rows as SignalCourse[]) : [];
}

/* ── the model ────────────────────────────────────────────────────────────── */

export interface DeriveInput {
  filter: OverviewFilter;
  analytics: AnalyticsShape;
  signals: SignalCourse[] | null;
  roster: any[];
  attendanceToday: any[];
}

export function deriveOverview({ filter, analytics, signals, roster, attendanceToday }: DeriveInput): OverviewModel {
  const { course, courseIds, clientOf, period } = filter;
  const inScope = (id: string) =>
    (courseIds === null || courseIds.has(id)) && (course === "all" || id === course);

  // Authoritative course → client mapping arrives with the course list, not
  // with analytics (whose clientName is often empty).
  const rows = analytics.courses
    .filter((r) => inScope(r.id))
    .map((r) => ({ ...r, client: clientOf(r.id) || r.client }));
  const studs = analytics.students.filter((s) => inScope(s.courseId));
  const active = rows.filter((r) => r.students > 0);
  const now = Date.now();
  const windowMs = period.days === null ? null : period.days * DAY;
  const since = windowMs === null ? 0 : now - windowMs;

  /* ── portfolio ────────────────────────────────────────────────────────── */
  const learners = rows.reduce((s, r) => s + r.students, 0);
  const clients = new Set(rows.map((r) => r.client)).size;
  const trainers = countTrainers(roster, inScope);

  /* ── KPI: active learners ─────────────────────────────────────────────── */
  // Same signal the L&D dashboard's "active this week" card uses
  // (`lastActivity` = the student's `lastAccessed` on that course), widened to
  // the selected period. No previous-window comparison: `lastAccessed` keeps
  // only the LATEST timestamp, so "active in the window before this one" is
  // not recoverable from it and would be a fabricated delta.
  const activeCount = studs.filter((s) => s.last !== null && (windowMs === null || s.last >= since)).length;

  /* ── KPI: progress / practice / mastery ───────────────────────────────── */
  const progress = mean(active.map((r) => r.avg));
  const practiceDone = studs.reduce((s, x) => s + x.practice.done, 0);
  const practiceTotal = studs.reduce((s, x) => s + x.practice.total, 0);
  const practicePct = ratio(practiceDone, practiceTotal);
  const mastery = mean(studs.map((x) => x.practice.score).filter((v): v is number => v !== null));

  /* ── time series (real, from submission timestamps) ───────────────────── */
  const sigById = new Map((signals ?? []).map((s) => [String(s.courseId), s]));
  const scopedSignals = rows.map((r) => sigById.get(r.id)).filter(Boolean) as SignalCourse[];
  const youDoTotal = studs.reduce((s, x) => s + x.practice.youDoTotal, 0);
  // Undated I_Do progress — attempts the roll-up counted that carry no
  // submission timestamp. Held flat across the series so the LAST point of the
  // Course Progress line lands on the Course Progress KPI.
  const possible = studs.reduce((s, x) => s + x.possible, 0);
  const undated = Math.max(0, studs.reduce((s, x) => s + x.attempts, 0) - practiceDone);

  const series = buildSeries(scopedSignals, { undated, possible, practiceTotal, youDoTotal });
  // Slice the series to the selected period. Starting ONE week before the
  // window's first week makes the delta measure movement across the window
  // rather than within it. `findIndex` returning -1 means nothing at all
  // happened inside the window — keep only the final point so the chart says
  // "not enough history" and the deltas stay null, instead of silently
  // showing the whole history under a "last 7 days" label.
  const firstIn = windowMs === null ? 0 : series.findIndex((p) => Date.parse(`${p.key}T00:00:00Z`) >= since);
  const windowed =
    firstIn === -1 ? series.slice(-1) : series.slice(firstIn <= 0 ? 0 : firstIn - 1);
  const deltaOf = (pick: (p: (typeof series)[number]) => number | null): number | null => {
    if (windowed.length < 2) return null;
    const a = pick(windowed[0]);
    const b = pick(windowed[windowed.length - 1]);
    return a === null || b === null ? null : Math.round((b - a) * 10) / 10;
  };

  // Sparklines follow the selected period, and drop nulls rather than plotting
  // them as zero — a week with no measurable value is absent, not a crash to 0.
  const sparkOfSeries = (pick: (p: (typeof series)[number]) => number | null) =>
    windowed.map(pick).filter((v): v is number => v !== null);

  const trend: TrendPoint[] = windowed.map((p) => ({
    label: weekLabel(p.key),
    progress: p.progress,
    mastery: p.mastery,
    independent: p.independent,
  }));

  /* ── journey ──────────────────────────────────────────────────────────── */
  const stageMean = (k: "iDo" | "weDo" | "youDo") =>
    mean(studs.map((x) => x[k]).filter((v): v is number => v !== null));
  const journey: JourneyStage[] = (
    [
      { key: "iDo", label: "I Do", tag: "Concept Understanding" },
      { key: "weDo", label: "We Do", tag: "Guided Practice" },
      { key: "youDo", label: "You Do", tag: "Independent Performance" },
    ] as const
  ).map((m) => {
    const value = stageMean(m.key);
    return { key: m.key, label: m.label, tag: m.tag, value, tone: stageTone(value) };
  });

  const gap = biggestGap(journey, studs);

  /* ── industry readiness — performance-driven ─────────────────────────── */
  // I Do is COMPLETION-tracked on the server (file-MCQ completionPercentage),
  // not score-tracked, so we cannot honestly report an I Do PERFORMANCE
  // number and don't. If a future release adds score-based I Do checks this
  // becomes the mean of those.
  const iDoScore: number | null = null;
  const weDoScore = mean(
    studs.map((x) => x.practice.weDoScore).filter((v): v is number => v !== null),
  );
  const youDoScore = mean(
    studs.map((x) => x.practice.independentScore).filter((v): v is number => v !== null),
  );
  const readiness = industryReadiness({ iDo: iDoScore, weDo: weDoScore, youDo: youDoScore });

  // Deltas across the selected window, computed from the weekly submission
  // series. Same slicing as the KPI row above (see `windowed`), so the
  // pathway's trend arrows and the KPI card's trend arrows use the same
  // preceding-point baseline and can never disagree.
  const weDoDelta = deltaOf((p) => p.weDoPerf);
  const youDoDelta = deltaOf((p) => p.independent);
  const readinessDelta = deltaOf((p) => p.readinessPerf);

  const readinessParts: OverviewModel["readinessParts"] = [
    {
      key: "iDo",
      label: "I Do Performance",
      description: "Concept Understanding",
      value: iDoScore,
      delta: null,
      emptyLabel: "No score-based evaluation",
    },
    {
      key: "weDo",
      label: "We Do Performance",
      description: "Guided Practice Performance",
      value: weDoScore,
      delta: weDoDelta,
      emptyLabel: "No We Do performance data",
    },
    {
      key: "youDo",
      label: "You Do Performance",
      description: "Independent Performance",
      value: youDoScore,
      delta: youDoDelta,
      emptyLabel: "No You Do performance data",
    },
    {
      key: "overall",
      label: "Overall Readiness",
      description: "Overall Job-Readiness Indication",
      value: readiness,
      delta: readinessDelta,
      emptyLabel: "Not enough performance data",
    },
  ];

  /* ── learner distribution ─────────────────────────────────────────────── */
  const bandCount = new Map(READINESS_BANDS.map((b) => [b.key, 0]));
  studs.forEach((s) => {
    const k = bandOf(s.readiness);
    if (k) bandCount.set(k, (bandCount.get(k) ?? 0) + 1);
  });
  const banded = studs.filter((s) => s.readiness !== null).length;
  const BAND_COLOR: Record<string, string> = {
    ready: "var(--good)",
    track: "var(--ch2)",
    support: "var(--accent)",
    risk: "var(--bad)",
  };
  const distribution: DistributionSlice[] = READINESS_BANDS.map((b) => ({
    key: b.key,
    label: b.label,
    hint: b.hint,
    count: bandCount.get(b.key) ?? 0,
    pct: ratio(bandCount.get(b.key) ?? 0, banded) ?? 0,
    color: BAND_COLOR[b.key],
    href: "#perf-progress",
  }));

  /* ── work queues ──────────────────────────────────────────────────────── */
  const atRisk = studs.filter((x) => x.overall > 0 && x.overall < 50);
  // Exactly the L&D dashboard's "inactive 7+ days" rule: started, not yet
  // finished, and gone quiet. Learners who never started are a different (and
  // differently actionable) problem, so they are not swept in here.
  const inactive = studs.filter(
    (x) => x.overall > 0 && x.overall < 80 && x.last !== null && now - x.last > INACTIVE_DAYS * DAY,
  );
  const avgByCourse = new Map(rows.map((r) => [r.id, r.avg]));
  const behind = studs.filter((x) => {
    const avg = avgByCourse.get(x.courseId);
    return avg !== undefined && avg - x.overall >= BEHIND_COURSE_GAP;
  });
  const lowYouDo = studs.filter((x) => x.youDo !== null && x.youDo < LOW_YOUDO);
  const atRiskCourses = new Set(atRisk.map((x) => x.courseId)).size;

  // One learner can appear in several queues — Needs Attention counts PEOPLE,
  // so the queues are unioned rather than summed.
  const attentionIds = new Set<string>();
  [atRisk, inactive, lowYouDo].forEach((list) => list.forEach((x) => attentionIds.add(`${x.id}·${x.courseId}`)));
  const attention = { count: attentionIds.size, pct: ratio(attentionIds.size, studs.length) ?? 0 };

  const repeatFail = scopedSignals.reduce((s, c) => s + num(c.repeatFailLearners), 0);
  const pendingBatches = countPendingBatches(attendanceToday, inScope);

  const actions: PriorityAction[] = (
    [
      {
        id: "risk",
        count: atRisk.length,
        label: "Learners at risk",
        detail: atRiskCourses ? `Across ${atRiskCourses} course${atRiskCourses === 1 ? "" : "s"}` : "Below 50% overall",
        href: "#perf-progress",
        tone: "danger",
      },
      {
        id: "fail",
        count: repeatFail,
        label: "Repeatedly failing practice",
        detail: "Immediate attention",
        href: "#rep-performance",
        tone: "danger",
      },
      {
        id: "idle",
        count: inactive.length,
        label: `Inactive for ${INACTIVE_DAYS}+ days`,
        detail: "Reminder recommended",
        href: "#perf-progress",
        tone: "warning",
      },
      {
        id: "behind",
        count: behind.length,
        label: "Behind their course average",
        detail: `${BEHIND_COURSE_GAP}+ points behind peers`,
        href: "#perf-progress",
        tone: "warning",
      },
      {
        id: "youdo",
        count: lowYouDo.length,
        label: "Low You Do performance",
        detail: "Needs intervention",
        href: "#perf-results",
        tone: "danger",
      },
      {
        id: "att",
        count: pendingBatches,
        label: "Batches awaiting attendance",
        detail: "Not marked for today",
        href: "#attendance",
        tone: "warning",
      },
    ] as PriorityAction[]
  ).filter((a) => a.count > 0);

  /* ── course health ────────────────────────────────────────────────────── */
  const byCourse = new Map<string, OverviewStudent[]>();
  studs.forEach((s) => {
    const list = byCourse.get(s.courseId);
    if (list) list.push(s);
    else byCourse.set(s.courseId, [s]);
  });
  const courses: CourseHealthRow[] = rows
    .map((r) => {
      const list = byCourse.get(r.id) ?? [];
      const done = list.reduce((s, x) => s + x.practice.done, 0);
      const total = list.reduce((s, x) => s + x.practice.total, 0);
      const cPractice = ratio(done, total);
      const cMastery = mean(list.map((x) => x.practice.score).filter((v): v is number => v !== null));
      const cWeDo = mean(list.map((x) => x.practice.weDoScore).filter((v): v is number => v !== null));
      const cIndep = mean(list.map((x) => x.practice.independentScore).filter((v): v is number => v !== null));
      const cReady = industryReadiness({ iDo: null, weDo: cWeDo, youDo: cIndep });
      const sig = sigById.get(r.id);
      return {
        id: r.id,
        name: r.name,
        client: r.client,
        learners: r.students,
        progress: r.students ? r.avg : null,
        practice: cPractice,
        mastery: cMastery,
        readiness: cReady,
        status: courseStatus(cReady),
        spark: sparkOf(sig, total),
      };
    })
    .sort((a, b) => (b.learners - a.learners) || (b.readiness ?? 0) - (a.readiness ?? 0));

  /* ── practice health ──────────────────────────────────────────────────── */
  const sum = (k: keyof SignalCourse) => scopedSignals.reduce((s, c) => s + num(c[k] as number), 0);
  const attempts = sum("attempts");
  const solved = sum("solvedQuestions");
  const attempted = sum("attemptedQuestions");
  const firstTry = sum("firstTrySolved");
  const health = signals
    ? {
        attempts,
        completionRate: ratio(solved, attempted),
        avgAttempts: solved > 0 ? Math.round((attempts / solved) * 10) / 10 : null,
        solvedIndependently: ratio(firstTry, solved),
        struggling: sum("strugglingLearners"),
      }
    : { attempts: null, completionRate: null, avgAttempts: null, solvedIndependently: null, struggling: null };

  return {
    portfolio: { clients, courses: rows.length, learners, trainers },
    active: {
      value: activeCount,
      pct: ratio(activeCount, studs.length),
      window: period.days,
      delta: null,
      spark: windowed.map((p) => p.act),
    },
    progress: { value: progress, delta: deltaOf((p) => p.progress), spark: sparkOfSeries((p) => p.progress) },
    practice: {
      value: practicePct,
      done: practiceDone,
      total: practiceTotal,
      delta: deltaOf((p) => p.practice),
      spark: sparkOfSeries((p) => p.practice),
    },
    mastery: { value: mastery, delta: deltaOf((p) => p.mastery), spark: sparkOfSeries((p) => p.mastery) },
    attention,
    journey,
    gap,
    readiness,
    readinessDelta,
    readinessParts,
    distribution,
    distributionTotal: banded,
    health,
    trend,
    actions,
    courses,
    hasData: rows.length > 0,
    signalsMissing: signals === null,
  };
}

/* ── series construction ──────────────────────────────────────────────────── */

interface SeriesPoint {
  key: string;
  act: number;
  progress: number | null;
  practice: number | null;
  mastery: number | null;
  independent: number | null;
  /** We Do performance to date. Derived from mastery − You Do share of the
   *  cumulative score, so it never disagrees with those two lines. */
  weDoPerf: number | null;
  /** Overall Industry Readiness to date, using the same performance formula
   *  the KPI cards use. Held null until at least one performance line has any
   *  value, so an empty scope never draws a "0% readiness" trend. */
  readinessPerf: number | null;
}

/**
 * Weekly, cumulative-to-date curves built from submission timestamps.
 *
 * Each line uses the SAME construction as the KPI it belongs to, so the last
 * point of a line and its card agree:
 *   Course Progress      (undated I Do attempts + exercises attempted to date) / total possible
 *   Practice Completion  exercises attempted to date / assignments + assessments assigned
 *   Skill Mastery        Σ per-exercise score% to date / assignments + assessments assigned
 *   Independent (You Do) Σ You Do score% to date / You Do items assigned
 *
 * The last three mirror the server's own `scorePercentageSum / denominator`,
 * which is what makes the endpoint line up with the card rather than drifting
 * a few points above it.
 */
/** Inline copy of `industryReadiness`'s math for the weekly series — keeps the
 *  hot loop free of any object allocation. Weights live in `lib/readiness.ts`;
 *  change them there and this stays honest because it reads them at call time. */
function industryReadinessInline(iDo: number | null, weDo: number | null, youDo: number | null): number | null {
  const W = READINESS_WEIGHTS;
  let sum = 0, weight = 0;
  if (iDo !== null && Number.isFinite(iDo)) { sum += Math.max(0, Math.min(100, iDo)) * W.iDo; weight += W.iDo; }
  if (weDo !== null && Number.isFinite(weDo)) { sum += Math.max(0, Math.min(100, weDo)) * W.weDo; weight += W.weDo; }
  if (youDo !== null && Number.isFinite(youDo)) { sum += Math.max(0, Math.min(100, youDo)) * W.youDo; weight += W.youDo; }
  return weight > 0 ? Math.round(sum / weight) : null;
}

function buildSeries(
  courses: SignalCourse[],
  denom: { undated: number; possible: number; practiceTotal: number; youDoTotal: number },
): SeriesPoint[] {
  // We Do denominator is the practice pool minus the You Do slice. Never
  // negative in real data, but clamp defensively.
  const weDoTotal = Math.max(0, denom.practiceTotal - denom.youDoTotal);
  const weeks = new Map<string, { act: number; ex: number; skill: number; you: number }>();
  courses.forEach((c) =>
    (c.weeks ?? []).forEach((w) => {
      const e = weeks.get(w.w) ?? { act: 0, ex: 0, skill: 0, you: 0 };
      e.act += num(w.act);
      e.ex += num(w.ex);
      e.skill += num(w.skillSum);
      e.you += num(w.youSum);
      weeks.set(w.w, e);
    }),
  );
  if (weeks.size === 0) return [];

  // Fill the gaps: a week with no submissions is a flat week on a cumulative
  // curve, not a missing point, and an axis that skips it lies about pace.
  const keys = [...weeks.keys()].sort();
  const filled: string[] = [];
  const step = 7 * DAY;
  for (let t = Date.parse(`${keys[0]}T00:00:00Z`); t <= Date.parse(`${keys[keys.length - 1]}T00:00:00Z`); t += step) {
    filled.push(mondayKey(new Date(t)));
  }

  let ex = 0;
  let skill = 0;
  let you = 0;
  return filled.map((k) => {
    const e = weeks.get(k);
    ex += e?.ex ?? 0;
    skill += e?.skill ?? 0;
    you += e?.you ?? 0;
    // Derive the two Industry-Readiness performance signals from the same
    // cumulative accumulators the KPI lines use, so any point on the readiness
    // curve and its stage lines is internally consistent.
    const independentTo = denom.youDoTotal > 0 ? clamp(Math.round(you / denom.youDoTotal)) : null;
    const weDoTo = weDoTotal > 0 ? clamp(Math.round((skill - you) / weDoTotal)) : null;
    const readinessTo = industryReadinessInline(null, weDoTo, independentTo);
    return {
      key: k,
      act: e?.act ?? 0,
      progress: denom.possible > 0 ? clamp(Math.round(((denom.undated + ex) / denom.possible) * 100)) : null,
      practice: denom.practiceTotal > 0 ? clamp(Math.round((ex / denom.practiceTotal) * 100)) : null,
      mastery: denom.practiceTotal > 0 ? clamp(Math.round(skill / denom.practiceTotal)) : null,
      independent: independentTo,
      weDoPerf: weDoTo,
      readinessPerf: readinessTo,
    };
  });
}

/** Last 8 weeks of one course's cumulative practice completion, for the row
 *  sparkline. Empty when the course has no dated submissions. */
function sparkOf(sig: SignalCourse | undefined, total: number): number[] {
  if (!sig || !sig.weeks?.length || total <= 0) return [];
  let ex = 0;
  const all = sig.weeks.map((w) => {
    ex += num(w.ex);
    return clamp(Math.round((ex / total) * 100));
  });
  return all.slice(-8);
}

/* ── the transition with the biggest drop ─────────────────────────────────── */

function biggestGap(journey: JourneyStage[], studs: OverviewStudent[]): JourneyGap | null {
  const pairs: { label: string; a: JourneyStage; b: JourneyStage; key: [keyof OverviewStudent, keyof OverviewStudent] }[] = [
    { label: "I Do → We Do", a: journey[0], b: journey[1], key: ["iDo", "weDo"] },
    { label: "We Do → You Do", a: journey[1], b: journey[2], key: ["weDo", "youDo"] },
  ];
  let worst: JourneyGap | null = null;
  pairs.forEach((p) => {
    if (p.a.value === null || p.b.value === null) return;
    const delta = p.b.value - p.a.value;
    if (delta >= 0) return;
    if (worst && delta >= worst.delta) return;
    const learners = studs.filter((s) => {
      const a = s[p.key[0]] as number | null;
      const b = s[p.key[1]] as number | null;
      return a !== null && b !== null && a - b >= STAGE_DROP;
    }).length;
    worst = { label: p.label, delta, learners };
  });
  return worst;
}

/* ── roster joins ─────────────────────────────────────────────────────────── */

function countTrainers(roster: any[], inScope: (id: string) => boolean): number {
  const ids = new Set<string>();
  (Array.isArray(roster) ? roster : [])
    .filter((c: any) => inScope(String(c?._id ?? "")))
    .forEach((c: any) => {
      (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
        (Array.isArray(b.users) ? b.users : []).forEach((u: any) => {
          const rn = roleName(u.user?.role).toLowerCase();
          if (!rn.includes("trainer") && !rn.includes("faculty")) return;
          ids.add(String(u.user?._id || u.user?.email || ""));
        });
      });
    });
  ids.delete("");
  return ids.size;
}

function countPendingBatches(overview: any[], inScope: (id: string) => boolean): number {
  let pending = 0;
  (Array.isArray(overview) ? overview : [])
    .filter((c: any) => inScope(String(c?._id ?? "")))
    .forEach((c: any) => {
      if (!c.hasSchedule) return;
      (Array.isArray(c.batches) ? c.batches : []).forEach((b: any) => {
        if (!b.markedToday) pending += 1;
      });
    });
  return pending;
}
