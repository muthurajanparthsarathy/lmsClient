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
  // Category — the You_Do subcategory the assessment lives under.
  push("category", humanizeToken(subcategory));
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
