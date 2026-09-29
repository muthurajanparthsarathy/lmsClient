// Pure derivations behind the Assessment Report header (see
// `components/AssessmentReportHeader.tsx`). Everything here reads data the
// dashboard ALREADY fetches:
//
//   - the `/api/assessment/live-dashboard` response (student rows +
//     assessmentName + availability window), via `hooks/useLiveDashboard`
//   - the `/getAll/courses-data/{courseId}` payload the marks pipeline uses,
//     via `courseDataApi.getById` — which carries the full exercise document
//     (`exerciseInformation`, `isGraded`, `availabilityPeriod`, `createdBy`,
//     `questions[]`) plus `courseImage` and the enrolled participants.
//
// No React, no fetching, no new endpoints — same stance as
// `computeStudentMarks.ts`, which this file sits next to.

import type { StudentProgress } from "../types/liveDashboard.types";
import { findExerciseInCourseData, getDynamicExerciseTotal } from "./computeStudentMarks";

type Loose = Record<string, any>;

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Placeholder rendered wherever the backend has nothing for us. */
export const EMPTY_VALUE = "—";

/** "Coding_Test" / "section-based" → "Coding Test" / "Section Based". */
export const humanizeToken = (raw: unknown): string => {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s
    // camelCase / PascalCase boundaries → spaces ("SectionBased" → "Section Based")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
};

/** "28 Sep 2023, 10:00 AM" — matches the reference header's date line. */
export const formatDateTime = (value: unknown): string => {
  if (!value) return EMPTY_VALUE;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return EMPTY_VALUE;
  try {
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date}, ${time}`;
  } catch {
    return EMPTY_VALUE;
  }
};

/** Seconds → "04:20" (mm:ss) or "1:04:20" (h:mm:ss). Dash when unknown. */
export const formatClock = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return EMPTY_VALUE;
  const secs = Math.round(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** Marks can be fractional (partial test-case credit). Show at most 1 decimal
 *  and never a trailing ".0", so "17" stays "17" and "16.5" stays "16.5". */
export const formatMarks = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return EMPTY_VALUE;
  return String(Math.round(value * 10) / 10);
};

// ─── Assessment metadata (from the exercise document) ───────────────────────

export interface AssessmentChip {
  key: string;
  label: string;
}

export interface AssessmentMeta {
  /** "Assessment" unless the exercise declares a concrete type (MCQ /
   *  Programming / Combined / Section Based). */
  typeLabel: string;
  /** `exercise.isGraded` — null when the exercise couldn't be resolved yet, so
   *  the header renders no Graded/Non-Graded pill rather than guessing. */
  isGraded: boolean | null;
  /** Compact chips under the title. Only entries backed by real data. */
  chips: AssessmentChip[];
  /** Max marks for the whole exercise (0 when unknown). */
  totalMarks: number;
  totalQuestions: number;
  /** The exercise stores its creator as an EMAIL (`createdBy` is set to
   *  `req.user.email` in exerciseAndQuestion.js). There is no persisted
   *  creator name or role on the exercise — see `resolveCreator`. */
  createdByEmail: string;
  /** `availabilityPeriod` window, ISO strings, null when never scheduled. */
  startDate: string | null;
  endDate: string | null;
}

const EMPTY_META: AssessmentMeta = {
  typeLabel: "Assessment",
  isGraded: null,
  chips: [],
  totalMarks: 0,
  totalQuestions: 0,
  createdByEmail: "",
  startDate: null,
  endDate: null,
};

/** Locate this assessment's exercise document inside the courses-data payload. */
export const findExercise = (courseData: Loose | null | undefined, exerciseId: string): Loose | null =>
  courseData && exerciseId ? findExerciseInCourseData(courseData, exerciseId) : null;

export const deriveAssessmentMeta = (
  exercise: Loose | null | undefined,
  /** Pedagogy subcategory from the URL (e.g. "Coding_Test") — the assessment's
   *  category as the trainer filed it. Optional; skipped when absent. */
  subcategory?: string,
): AssessmentMeta => {
  if (!exercise) {
    // Still surface the category chip — it comes from the URL, not the payload,
    // so it is available before courses-data lands.
    const category = humanizeToken(subcategory);
    return { ...EMPTY_META, chips: category ? [{ key: "category", label: category }] : [] };
  }

  const info: Loose = exercise.exerciseInformation || {};
  const questions: Loose[] = Array.isArray(exercise.questions) ? exercise.questions : [];
  const totalQuestions = questions.length || Number(info.totalQuestions) || 0;
  const totalMarks = getDynamicExerciseTotal(exercise);
  const isGraded = typeof exercise.isGraded === "boolean" ? exercise.isGraded : null;

  const rawType = exercise.exerciseType || info.exerciseType || "";
  const typeLabel = humanizeToken(rawType) || "Assessment";

  const chips: AssessmentChip[] = [];
  const push = (key: string, label: string) => {
    if (label) chips.push({ key, label });
  };

  // Difficulty — `exerciseLevel` is a beginner/intermediate/expert enum.
  push("level", humanizeToken(info.exerciseLevel));
  // Category chip (the You_Do subcategory the assessment lives under, e.g.
  // "Assesment") is intentionally omitted from the chip row — the whole
  // Live Dashboard is already scoped to the assessment, so echoing the
  // subcategory name under the title reads as redundant. The breadcrumb bar
  // at the top of SessionDetail still shows it for context.
  if (totalQuestions > 0) {
    push("questions", `${totalQuestions} ${totalQuestions === 1 ? "Question" : "Questions"}`);
  }
  // Marks only mean something on a graded assessment.
  if (isGraded !== false && totalMarks > 0) push("marks", `${formatMarks(totalMarks)} Marks`);
  const duration = Number(info.totalDuration);
  if (Number.isFinite(duration) && duration > 0) push("duration", `${duration} min`);
  const languages: string[] = Array.isArray(info.selectedLanguages)
    ? info.selectedLanguages.filter(Boolean).map(String)
    : [];
  if (languages.length) {
    // Two is enough to characterise the assessment; more would push the chip
    // row past the compact height the header is designed for.
    push("languages", languages.slice(0, 2).map(humanizeToken).join(", "));
  }

  const ap: Loose = exercise.availabilityPeriod || {};
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  return {
    typeLabel,
    isGraded,
    chips,
    totalMarks,
    totalQuestions,
    createdByEmail: String(exercise.createdByEmail || exercise.createdBy || "").trim(),
    startDate: toIso(ap.startDate),
    endDate: toIso(ap.endDate),
  };
};

// ─── Rich assessment details (behind the title's (i) icon) ─────────────────
//
// A superset of `AssessmentMeta` scoped specifically to the info popover.
// Every field is optional — the popover only prints rows/sections whose data
// actually exists on the exercise document, so a bare-bones exercise still
// gets a compact panel instead of "— — — — —".
//
// The values come from three places on the exercise doc, all of which are
// already fetched by the courses-data endpoint the dashboard uses:
//   • `exerciseInformation`         (name, type, level, duration, languages)
//   • `questionConfiguration`       (general vs level-based, attempts, flow)
//   • `evaluationMethod` / `gradeSettings` / `securitySettings`
//   • the `questions[]` array itself (used to tally marks by difficulty when
//     the configured `levelBasedMarks` are absent, so the E/M/H rows reflect
//     the questions the students will actually see).

export interface DifficultyBucket {
  /** How many questions of this difficulty this exercise carries. */
  count: number;
  /** Sum of `score` (Programming) or `mcqQuestionScore` (MCQ). 0 when the
   *  questions carry no per-item mark, so the popover shows just the count. */
  marks: number;
}

export interface SectionSummary {
  name: string;
  type?: string;
  questions?: number;
  marks?: number;
}

export interface AssessmentSecurity {
  requireFullscreen?: boolean;
  preventTabSwitch?: boolean;
  preventCopyPaste?: boolean;
  preventDevTools?: boolean;
  preventRightClick?: boolean;
  preventScreenshot?: boolean;
  screenRecordingEnabled?: boolean;
  faceMonitoring?: boolean;
}

export interface AssessmentDetails {
  // General
  typeLabel?: string;
  subcategoryLabel?: string;
  difficultyLevel?: string;
  testType?: string;
  isGraded?: boolean | null;
  durationMinutes?: number;
  submissionAttempts?: number;
  startDate?: string | null;
  endDate?: string | null;
  cutOffDate?: string | null;

  // Structure
  totalQuestions?: number;
  totalMarks?: number;
  /** "General" | "Level Based" | "Selection Level" | "Section Based". Empty
   *  when the exercise never picked a mode. */
  questionMode?: string;
  isSectionBased?: boolean;
  sections?: SectionSummary[];
  /** Only set when the exercise is level-based AND at least one bucket has
   *  a count > 0, so the popover doesn't render an all-zero table. */
  levelBased?: { easy: DifficultyBucket; medium: DifficultyBucket; hard: DifficultyBucket };
  /** For the General mode, if every question shares a single per-question
   *  mark this is that number; otherwise omitted so we don't print a lie. */
  generalMarksPerQuestion?: number;

  // Grading
  passingMark?: number;
  evaluationMethod?: string;
  aiCriteria?: string[];
  questionFlow?: string;
  gradeBandLabels?: string[];
  negativeMarking?: boolean;

  // Programming
  languages?: string[];
  compilerFileMode?: string;
  allowCodeExecution?: boolean;
  showSampleCases?: boolean;

  // MCQ
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  mcqScoringType?: string;

  // Security
  security?: AssessmentSecurity;
}

/** Deep-read helper that survives missing intermediate keys without a
 *  `?. ?. ?.` chain per field. */
const dig = (obj: Loose | null | undefined, ...path: string[]): unknown => {
  let cur: any = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
};

const cleanNumber = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const cleanBool = (v: unknown): boolean | undefined => {
  return typeof v === "boolean" ? v : undefined;
};

/** Total marks summed across a set of `questions[]` — used to fill the level
 *  buckets when `scoreSettings.levelBasedMarks` isn't configured. */
const sumQuestionMarks = (qs: Loose[]): number => {
  let sum = 0;
  for (const q of qs) {
    const raw = q?.score ?? q?.mcqQuestionScore ?? q?.points;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return sum;
};

const questionDifficulty = (q: Loose): "easy" | "medium" | "hard" | "" => {
  const raw = String(q?.difficulty ?? q?.mcqQuestionDifficulty ?? "")
    .trim()
    .toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "";
};

export const deriveAssessmentDetails = (
  exercise: Loose | null | undefined,
  subcategory?: string,
): AssessmentDetails => {
  if (!exercise) return {};

  const info: Loose = exercise.exerciseInformation || {};
  const questions: Loose[] = Array.isArray(exercise.questions) ? exercise.questions : [];
  const totalQuestions = questions.length || Number(info.totalQuestions) || 0;
  const totalMarks = getDynamicExerciseTotal(exercise);
  const isGraded = typeof exercise.isGraded === "boolean" ? exercise.isGraded : null;

  const rawType = exercise.exerciseType || info.exerciseType || "";
  const typeLabel = humanizeToken(rawType) || "Assessment";
  const subcategoryLabel = humanizeToken(subcategory);
  const difficultyLevel = humanizeToken(info.exerciseLevel);
  const testType = humanizeToken(info.testType);

  const duration = cleanNumber(info.totalDuration);

  // Which config the trainer filled in — Programming Q config beats
  // MCQ/Others when both exist because the type has already been decided.
  const qcfg: Loose =
    dig(exercise, "questionConfiguration", "programmingQuestionConfiguration") as Loose
    || dig(exercise, "questionConfiguration", "mcqQuestionConfiguration") as Loose
    || dig(exercise, "questionConfiguration", "othersQuestionConfiguration") as Loose
    || {};

  const rawMode = String(qcfg.questionConfigType || "").trim();
  let questionMode = "";
  if (rawMode) {
    questionMode = rawMode === "levelBased"
      ? "Level Based"
      : rawMode === "selectionLevel"
      ? "Selection Level"
      : humanizeToken(rawMode);
  }
  const isSectionBased = !!info.isSectionBased;
  if (isSectionBased) questionMode = questionMode || "Section Based";

  // Attempt cap — respected only when the trainer enabled the toggle.
  const submissionAttempts = qcfg.attemptLimitEnabled
    ? cleanNumber(qcfg.submissionAttempts)
    : undefined;

  const questionFlowRaw = String(qcfg.questionFlow || "").trim();
  const questionFlow = questionFlowRaw === "freeFlow"
    ? "Free Flow"
    : questionFlowRaw === "controlled"
    ? "Controlled"
    : "";

  // Level buckets: prefer configured `levelBasedCounts` + `levelBasedMarks`;
  // fall back to counting the questions[] array by `difficulty` so a level-
  // based exercise that stores marks per question still renders correctly.
  let levelBased: AssessmentDetails["levelBased"];
  if (rawMode === "levelBased" || rawMode === "selectionLevel") {
    const counts: Loose = (rawMode === "selectionLevel"
      ? qcfg.selectionLevelCounts
      : qcfg.levelBasedCounts) || {};
    const marksCfg: Loose = dig(qcfg, "scoreSettings", "levelBasedMarks") as Loose || {};

    const buckets: Record<"easy" | "medium" | "hard", DifficultyBucket> = {
      easy: { count: 0, marks: 0 },
      medium: { count: 0, marks: 0 },
      hard: { count: 0, marks: 0 },
    };
    for (const bucket of ["easy", "medium", "hard"] as const) {
      const cCfg = Number(counts[bucket]);
      const mCfg = Number(marksCfg[bucket]);
      const cActual = questions.filter((q) => questionDifficulty(q) === bucket).length;
      buckets[bucket].count = Number.isFinite(cCfg) && cCfg > 0 ? cCfg : cActual;
      buckets[bucket].marks = Number.isFinite(mCfg) && mCfg > 0
        ? mCfg
        : sumQuestionMarks(questions.filter((q) => questionDifficulty(q) === bucket));
    }
    if (buckets.easy.count + buckets.medium.count + buckets.hard.count > 0) {
      levelBased = buckets;
    }
  }

  // General-mode "marks per question" — only show it when every question
  // carries the SAME mark, so we don't invent a per-question value when the
  // trainer really configured 3 + 5 + 2.
  let generalMarksPerQuestion: number | undefined;
  if (rawMode === "general" || (!rawMode && !levelBased && totalQuestions > 0)) {
    const gm = cleanNumber(qcfg.generalMarksPerQuestion);
    if (gm) generalMarksPerQuestion = gm;
    else if (totalMarks > 0 && totalQuestions > 0) {
      const perQ = totalMarks / totalQuestions;
      if (Number.isInteger(perQ)) generalMarksPerQuestion = perQ;
    }
  }

  const sections: SectionSummary[] | undefined = Array.isArray(exercise.sections) && exercise.sections.length
    ? exercise.sections.map((s: Loose) => ({
        name: String(s?.name ?? "").trim() || `Section ${s?.sectionNumber ?? ""}`.trim(),
        type: humanizeToken(s?.exerciseType) || undefined,
        marks: cleanNumber(s?.totalMarks),
        // The section carrier doesn't store its own question count on the
        // schema I read, but Programming/MCQ configs do — use the sum.
        questions:
          cleanNumber(dig(s, "programmingConfig", "generalQuestionCount")) ??
          cleanNumber(dig(s, "mcqConfig", "generalQuestionCount")),
      }))
    : undefined;

  // Grading — passing mark: the schema exposes several ("mcqGradeToPass",
  // "programmingGradeToPass", "combinedGradeToPass", "overallMarkToPass").
  // Prefer the one that matches the exercise type; fall back to any set value.
  const gs: Loose = exercise.gradeSettings || {};
  const passCandidates: number[] = [];
  const pushPass = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) passCandidates.push(n);
  };
  const typeKey = String(rawType).toLowerCase();
  if (typeKey.includes("mcq")) pushPass(gs.mcqGradeToPass);
  else if (typeKey.includes("programming")) pushPass(gs.programmingGradeToPass);
  else if (typeKey.includes("combined") || typeKey.includes("section")) pushPass(gs.combinedGradeToPass);
  if (gs.overallMarkToPassEnabled) pushPass(gs.overallMarkToPass);
  // Last-resort — anything set.
  ["mcqGradeToPass", "programmingGradeToPass", "combinedGradeToPass", "overallMarkToPass"]
    .forEach((k) => pushPass(gs[k]));
  const passingMark = passCandidates.length ? passCandidates[0] : undefined;

  const em: Loose = exercise.evaluationMethod || {};
  const emMethod = String(em.method || "").trim();
  const evaluationMethod = emMethod
    ? emMethod === "testcase"
      ? "Test Cases"
      : emMethod === "manual"
      ? "Manual"
      : emMethod === "ai"
      ? "AI"
      : humanizeToken(emMethod)
    : "";
  const aiCriteria: string[] = Array.isArray(dig(em, "ai", "criteria") as unknown)
    ? ((dig(em, "ai", "criteria") as string[]) || []).map(humanizeToken).filter(Boolean)
    : [];

  const gradeBandLabels: string[] = Array.isArray(gs.gradeBands)
    ? gs.gradeBands.map((b: Loose) => String(b?.label || "").trim()).filter(Boolean)
    : [];

  // Programming / MCQ specifics — reach through the same configuration
  // object we resolved above, which was already scoped to the right subtype.
  const languages: string[] | undefined = Array.isArray(info.selectedLanguages) && info.selectedLanguages.length
    ? info.selectedLanguages.filter(Boolean).map((x: unknown) => humanizeToken(x))
    : undefined;
  const compilerFileMode = (() => {
    const raw = String(qcfg.compilerFileMode || "").trim();
    return raw === "single" ? "Single File" : raw === "multiple" ? "Multiple Files" : "";
  })();
  const allowCodeExecution = cleanBool(qcfg.allowCodeExecution);
  const showSampleCases = cleanBool(qcfg.showSampleCases);

  const shuffleQuestions = cleanBool(qcfg.shuffleQuestions);
  const mcqScoringType = (() => {
    const raw = String(qcfg.scoringType || "").trim();
    if (!raw) return "";
    return raw === "equalDistribution"
      ? "Equal Distribution"
      : raw === "questionSpecific"
      ? "Question Specific"
      : raw === "levelSpecific"
      ? "Level Specific"
      : humanizeToken(raw);
  })();

  // Security — the exerciseSchema uses strict:false, so `securitySettings`
  // lives on the doc alongside `exerciseInformation`. Only pull the flags
  // we actually surface in the popover.
  const sec: Loose = exercise.securitySettings || {};
  const security: AssessmentSecurity = {};
  const pickBool = (k: keyof AssessmentSecurity, val: unknown) => {
    if (typeof val === "boolean") security[k] = val;
  };
  pickBool("requireFullscreen", sec.requireFullscreen);
  pickBool("preventTabSwitch", sec.preventTabSwitch);
  pickBool("preventCopyPaste", sec.preventCopyPaste);
  pickBool("preventDevTools", sec.preventDevTools);
  pickBool("preventRightClick", sec.preventRightClick);
  pickBool("preventScreenshot", sec.preventScreenshot);
  pickBool("screenRecordingEnabled", sec.screenRecordingEnabled);
  const faceOn = !!(sec.enableFaceVerification || sec.multipleFaceDetection || sec.faceMonitoringDetection);
  if (Object.prototype.hasOwnProperty.call(sec, "enableFaceVerification")
    || Object.prototype.hasOwnProperty.call(sec, "multipleFaceDetection")
    || Object.prototype.hasOwnProperty.call(sec, "faceMonitoringDetection")) {
    security.faceMonitoring = faceOn;
  }
  const securityOut = Object.keys(security).length ? security : undefined;

  const ap: Loose = exercise.availabilityPeriod || {};
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  return {
    typeLabel,
    subcategoryLabel: subcategoryLabel || undefined,
    difficultyLevel: difficultyLevel || undefined,
    testType: testType || undefined,
    isGraded,
    durationMinutes: duration,
    submissionAttempts,
    startDate: toIso(ap.startDate),
    endDate: toIso(ap.endDate),
    cutOffDate: ap.cutOffEnabled ? toIso(ap.cutOffDate) : null,

    totalQuestions: totalQuestions || undefined,
    totalMarks: totalMarks || undefined,
    questionMode: questionMode || undefined,
    isSectionBased: isSectionBased || undefined,
    sections,
    levelBased,
    generalMarksPerQuestion,

    passingMark,
    evaluationMethod: evaluationMethod || undefined,
    aiCriteria: aiCriteria.length ? aiCriteria : undefined,
    questionFlow: questionFlow || undefined,
    gradeBandLabels: gradeBandLabels.length ? gradeBandLabels : undefined,

    languages,
    compilerFileMode: compilerFileMode || undefined,
    allowCodeExecution,
    showSampleCases,

    shuffleQuestions,
    mcqScoringType: mcqScoringType || undefined,

    security: securityOut,
  };
};

// ─── Assessment state (Live / Scheduled / Completed) ────────────────────────

export type AssessmentState = "live" | "scheduled" | "completed";

/**
 * Which lifecycle pill sits next to the type label.
 *
 * Live presence wins over the calendar: if someone is attempting the test
 * right now the assessment is Live no matter what the window says (a trainer
 * re-opening an expired test still needs to see "Live"). Otherwise the
 * `availabilityPeriod` window decides, and when no window was configured we
 * fall back to the class's own progress. Returns null when there's nothing
 * truthful to show — the header then renders no pill.
 */
export const deriveAssessmentState = (args: {
  startDate?: string | null;
  endDate?: string | null;
  inProgressCount: number;
  completedCount: number;
  totalLearners: number;
  now?: number;
}): AssessmentState | null => {
  const { startDate, endDate, inProgressCount, completedCount, totalLearners } = args;
  const now = args.now ?? Date.now();
  const start = startDate ? new Date(startDate).getTime() : NaN;
  const end = endDate ? new Date(endDate).getTime() : NaN;

  if (inProgressCount > 0) return "live";
  if (Number.isFinite(start) && now < start) return "scheduled";
  if (Number.isFinite(end) && now > end) return "completed";
  if (Number.isFinite(start) && now >= start) return "live";
  // No usable window — infer from the class.
  if (totalLearners > 0 && completedCount >= totalLearners) return "completed";
  return null;
};

// ─── Header metrics ─────────────────────────────────────────────────────────

export interface HeaderMetrics {
  /** Marks earned ÷ marks available across attempts that carry a score. */
  accuracyPercent: number | null;
  accuracyEarned: number;
  accuracyAvailable: number;
  /** Finalised attempts ÷ assigned learners. */
  completedPercent: number | null;
  completedCount: number;
  totalLearners: number;
  /** Mean earned marks across scored attempts, out of the exercise total. */
  avgScore: number | null;
  avgScoreOutOf: number;
  avgScorePercent: number | null;
  /** Mean recorded attempt duration, seconds. */
  avgTimeSeconds: number | null;
  /** Learners with at least one persisted answer (started OR finished). */
  submissions: number;
}

/** A row that has actually been worked on: a persisted answer, at least one
 *  completed question, or a submission flag. Mirrors StudentRow's
 *  `hasAnswerInDb` gate plus the marks side-channel's "has answers" signal
 *  (`scoredMarks` is only set when `computeStudentMarks` found answers). */
const hasAttempted = (s: StudentProgress): boolean =>
  typeof s.scoredMarks === "number" || (s.completed || 0) > 0 || !!s.submitted;

export const deriveHeaderMetrics = (
  students: StudentProgress[],
  args: {
    /** Count of finalised attempts — the page already tallies this from
     *  `deriveTestStatus`, so we take it rather than re-deriving it here. */
    completedCount: number;
    totalLearners: number;
    /** Exercise max marks, used as the Avg. Score denominator. */
    exerciseTotalMarks: number;
  },
): HeaderMetrics => {
  const { completedCount, totalLearners, exerciseTotalMarks } = args;

  let accuracyEarned = 0;
  let accuracyAvailable = 0;
  let scoredCount = 0;
  let durationSum = 0;
  let durationCount = 0;
  let submissions = 0;

  for (const s of students) {
    if (hasAttempted(s)) submissions++;
    if (typeof s.scoredMarks === "number" && (s.totalMarks || 0) > 0) {
      accuracyEarned += s.scoredMarks;
      accuracyAvailable += s.totalMarks as number;
      scoredCount++;
    }
    if (typeof s.durationSeconds === "number" && s.durationSeconds > 0) {
      durationSum += s.durationSeconds;
      durationCount++;
    }
  }

  const avgScore = scoredCount > 0 ? accuracyEarned / scoredCount : null;
  const avgScoreOutOf = exerciseTotalMarks > 0
    ? exerciseTotalMarks
    // Fall back to the per-student max when the exercise total can't be
    // resolved (courses-data still loading) so the "x / y" stays coherent.
    : (scoredCount > 0 ? accuracyAvailable / scoredCount : 0);

  return {
    accuracyPercent: accuracyAvailable > 0 ? Math.round((accuracyEarned / accuracyAvailable) * 100) : null,
    accuracyEarned,
    accuracyAvailable,
    completedPercent: totalLearners > 0 ? Math.round((completedCount / totalLearners) * 100) : null,
    completedCount,
    totalLearners,
    avgScore,
    avgScoreOutOf,
    avgScorePercent: avgScore != null && avgScoreOutOf > 0 ? Math.round((avgScore / avgScoreOutOf) * 100) : null,
    avgTimeSeconds: durationCount > 0 ? durationSum / durationCount : null,
    submissions,
  };
};

// ─── Creator ────────────────────────────────────────────────────────────────

export interface CreatorInfo {
  /** Display name — a real first/last name when we could match the creator to
   *  an enrolled user, otherwise a name read off the email's local part. */
  name: string;
  /** Role label. Empty when we couldn't match a user document — the exercise
   *  itself stores no role. */
  role: string;
  email: string;
  /** True when name + role came from a real User document rather than the
   *  email string. Lets the UI keep the email visible when it didn't. */
  resolved: boolean;
}

/** "raihan.kabir@x.com" → "Raihan Kabir". Returns "" for single-token local
 *  parts ("jsmith") — inventing "Jsmith" would read as a real name when it
 *  isn't, so those fall back to showing the email itself. */
const nameFromEmail = (email: string): string => {
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._-]+/).filter((p) => p && /[a-z]/i.test(p));
  if (parts.length < 2) return "";
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
};

/**
 * Resolve the exercise's creator for the header's "Created by" block.
 *
 * MISSING BACKEND FIELD: the exercise document persists only `createdBy` (the
 * creator's EMAIL — see `createExercise` in
 * `Server/controllers/courses/moduleStructure/exerciseAndQuestion.js`). There
 * is no `creatorName` / `creatorRole` on the exercise and the live-dashboard
 * endpoint does not return one, so we resolve what we can client-side:
 *
 *   1. Match the email against the course's enrolled users (courses-data
 *      populates each user's `role`) → real name + role.
 *   2. Otherwise (trainers are usually not enrolled in their own course) fall
 *      back to the email, with a display name only when the local part clearly
 *      carries one.
 *
 * Returns null when the exercise carries no creator at all — the header then
 * hides the block rather than showing an invented person.
 */
export const resolveCreator = (
  courseData: Loose | null | undefined,
  email: string,
): CreatorInfo | null => {
  const trimmed = (email || "").trim();
  if (!trimmed) return null;

  const participants: Loose[] = (courseData?.batchAndParticipants || []).flatMap(
    (b: Loose) => b?.users || [],
  );
  const match = participants
    .map((p) => p?.user)
    .find((u: Loose) => u?.email && String(u.email).toLowerCase() === trimmed.toLowerCase());

  if (match) {
    const name = `${match.firstName || ""} ${match.lastName || ""}`.trim();
    const role: Loose = match.role || {};
    const roleLabel = role.renameRole || role.originalRole || role.roleValue || role.name || "";
    if (name) {
      return { name, role: humanizeToken(roleLabel), email: trimmed, resolved: true };
    }
  }

  return { name: nameFromEmail(trimmed) || trimmed, role: "", email: trimmed, resolved: false };
};

/** Initials for the creator avatar — "Raihan Kabir" → "RK". */
export const initialsOf = (name: string): string => {
  const parts = (name || "").trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
