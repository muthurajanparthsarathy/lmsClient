// Per-question aggregation across an entire class, computed from the
// `/getAll/courses-data/{courseId}` payload the detail page already fetches
// for the marks side-channel.
//
// The persisted answer schema stores `isCorrect` on each question submission
// but does NOT retain which MCQ option the student selected — so a per-option
// histogram cannot be truthfully reconstructed. What we CAN surface is the
// class-wide correct / incorrect / skipped tally plus average response time,
// which matches the "Statistics" panel in the Screen 4 spec. Options are still
// listed on the card with the correct one highlighted so a reader can see the
// question at a glance.

import { findExerciseInCourseData, getQuestionMaxScore } from "./computeStudentMarks";

type Loose = Record<string, any>;

const idOf = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.$oid === "string") return v.$oid;
    if (v._id != null) return idOf(v._id);
    try {
      const s = v.toString();
      if (s && s !== "[object Object]") return s;
    } catch { /* ignore */ }
  }
  return String(v);
};

const plainText = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(v)) return v.map(plainText).filter(Boolean).join(" ").trim();
  if (typeof v === "object") return plainText(v.value ?? v.text ?? v.title ?? "");
  return String(v);
};

// Same idea as `computeStudentMarks.getAnswersForExercise` but streamlined for
// the aggregate walk: for each participant, return every answer document that
// belongs to this exercise.
const answersForParticipant = (
  participant: Loose,
  courseId: string,
  exerciseId: string,
): Loose[] => {
  const user = participant?.user;
  if (!user) return [];
  const course = (user.courses || []).find(
    (c: Loose) => c?.courseId?.toString?.() === courseId?.toString?.(),
  );
  if (!course?.answers) return [];
  const collect = (catObj: Loose | undefined): Loose[] => {
    if (!catObj || typeof catObj !== "object") return [];
    const out: Loose[] = [];
    for (const bucket of Object.values(catObj)) {
      if (Array.isArray(bucket)) out.push(...bucket);
    }
    return out;
  };
  const all = [...collect(course.answers.We_Do), ...collect(course.answers.You_Do)];
  const exIdStr = String(exerciseId);
  return all.filter((ans) => {
    const aid = idOf(ans?.exerciseId);
    if (!aid) return false;
    return aid === exIdStr || aid.includes(exIdStr);
  });
};

// Per-question aggregation result. `options` is present only for MCQ / choice
// questions; `null` marks a free-form question.
export interface AggregatedOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface AggregatedQuestion {
  id: string;
  index: number;
  questionNo: string;
  title: string;
  type: string;
  maxScore: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  reviewCount: number;
  accuracy: number | null;
  avgResponseSeconds: number | null;
  options: AggregatedOption[] | null;
  /** Learners who earned the full max mark on this question. For MCQ this
   *  equals `correctCount`; for programming this is the "all test cases
   *  passed / full grader override" bucket. Null when the question has no
   *  marks configured (max === 0). */
  fullMarksCount: number;
  /** Learners who earned some marks but less than max (partial credit).
   *  Always 0 for MCQ (auto-graded is all-or-nothing); the field exists so
   *  the coding card can show a Partial bucket without a shape switch. */
  partialCount: number;
  /** Learners who answered but earned zero marks. */
  zeroCount: number;
  /** Mean of earned marks across every scored submission on this question,
   *  0–maxScore. Null when nothing has been scored yet. */
  avgScore: number | null;
}

export interface AggregatedExercise {
  assessmentName: string;
  totalQuestions: number;
  enrolledCount: number;
  attemptedCount: number;
  questions: AggregatedQuestion[];
}

const roleValueOf = (u: Loose): string => {
  const r = u?.role || {};
  return String(r.roleValue || r.renameRole || "").toLowerCase();
};

/** Compute per-question aggregates for one exercise. Returns null when the
 *  course payload can't be walked (still loading or missing exercise). */
export const aggregateExercise = (args: {
  courseData: Loose | null | undefined;
  courseId: string;
  exerciseId: string;
}): AggregatedExercise | null => {
  const { courseData, courseId, exerciseId } = args;
  if (!courseData || !courseId || !exerciseId) return null;

  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise) return null;

  const questions: Loose[] = Array.isArray(exercise.questions) ? exercise.questions : [];
  const assessmentName = exercise?.exerciseInformation?.exerciseName || "Assessment";

  // Same role filter the detail page uses for its own student list —
  // aggregates count students, not staff observers.
  const participants: Loose[] = (courseData.batchAndParticipants || []).flatMap(
    (b: Loose) => b?.users || [],
  );
  const students = participants.filter((p) => {
    const u = p?.user;
    if (!u?._id) return false;
    const rv = roleValueOf(u);
    return !rv || rv === "student";
  });

  const enrolledCount = students.length;

  // Time samples fall back to nothing when the answer document doesn't record
  // per-question time (submissions before that field was added).
  const perQuestionState = new Map<string, {
    correct: number;
    incorrect: number;
    review: number;
    timeSum: number;
    timeSamples: number;
    responders: Set<string>;
    /** Sum of earned marks across every scored submission (auto-grade for
     *  MCQ, persisted `score` for programming/others). Only counted when a
     *  submission has actually been scored. */
    scoreSum: number;
    /** Count of submissions that fed into `scoreSum`. */
    scoredSamples: number;
    /** Learners who reached the question's max mark. */
    fullMarks: number;
    /** Learners with earned marks strictly between 0 and max. */
    partial: number;
    /** Learners who answered but earned zero marks. */
    zero: number;
  }>();
  for (const q of questions) {
    perQuestionState.set(idOf(q._id), {
      correct: 0,
      incorrect: 0,
      review: 0,
      timeSum: 0,
      timeSamples: 0,
      responders: new Set(),
      scoreSum: 0,
      scoredSamples: 0,
      fullMarks: 0,
      partial: 0,
      zero: 0,
    });
  }

  // Same isMCQ heuristic `computeStudentMarks` uses so the auto-grade path
  // matches — a question with only `mcqQuestionTitle` and no `title` is MCQ.
  const isMCQQuestion = (q: Loose): boolean => {
    const t = String(q?.questionType || "").toLowerCase();
    if (t === "mcq") return true;
    return !q?.title && !!q?.mcqQuestionTitle;
  };
  const questionById = new Map<string, Loose>();
  for (const q of questions) questionById.set(idOf(q._id), q);
  // maxScore per question is computed off the exercise's scoring config; cache
  // it once so the per-answer walk is a Map lookup rather than a repeated fn.
  const maxByQid = new Map<string, number>();
  for (const q of questions) maxByQid.set(idOf(q._id), getQuestionMaxScore(exercise, q));

  let attemptedCount = 0;
  for (const p of students) {
    const answers = answersForParticipant(p, courseId, exerciseId);
    if (!answers.length) continue;
    attemptedCount++;
    const uid = String(p?.user?._id || "");
    for (const ans of answers) {
      for (const sub of ans?.questions || []) {
        const qid = idOf(sub?.questionId);
        const state = perQuestionState.get(qid);
        if (!state) continue;
        // Every real submission (including a manual override) has one of
        // these signals. Free-form + unfinished submissions may have neither.
        const graded = sub?.isCorrect === true || sub?.isCorrect === false;
        const needsReview = String(sub?.status || "").toLowerCase() === "attempted"
          && (sub?.isCorrect === undefined || sub?.isCorrect === null);
        if (!graded && !needsReview) continue;
        state.responders.add(uid);
        if (graded) {
          if (sub.isCorrect) state.correct++;
          else state.incorrect++;
        } else {
          state.review++;
        }
        if (typeof sub?.timeTakenSeconds === "number" && sub.timeTakenSeconds > 0) {
          state.timeSum += sub.timeTakenSeconds;
          state.timeSamples++;
        }

        // ── Marks buckets (full / partial / zero) + avg score ──────────────
        // MCQ: `isCorrect` is the truth — auto-grade earns full max OR zero.
        // Programming / manually graded: use persisted `sub.score`, capped
        // by max. Manual override (`status === "evaluated"`) still lands in
        // this branch since it stores the number in `score`.
        const q = questionById.get(qid);
        const max = maxByQid.get(qid) ?? 0;
        if (q && max > 0 && graded) {
          let earned = 0;
          if (isMCQQuestion(q)) {
            earned = sub.isCorrect ? max : 0;
          } else {
            const raw = Number(sub?.score);
            earned = Number.isFinite(raw) && raw > 0 ? Math.min(raw, max) : 0;
          }
          state.scoreSum += earned;
          state.scoredSamples++;
          if (earned >= max) state.fullMarks++;
          else if (earned > 0) state.partial++;
          else state.zero++;
        }
      }
    }
  }

  const out: AggregatedQuestion[] = questions.map((q, i) => {
    const qid = idOf(q._id);
    const state = perQuestionState.get(qid)!;
    const answered = state.correct + state.incorrect + state.review;
    const scored = state.correct + state.incorrect;
    const accuracy = scored ? Math.round((state.correct / scored) * 100) : null;

    const rawOptions: Loose[] = Array.isArray(q.mcqOptions) ? q.mcqOptions : [];
    const options: AggregatedOption[] | null = rawOptions.length
      ? rawOptions.map((opt: Loose, oi: number) => ({
        id: (opt._id || opt.id || `opt-${oi}`).toString(),
        label: plainText(opt.optionText || opt.text || opt.label || `Option ${oi + 1}`),
        isCorrect: !!opt.isCorrect,
      }))
      : null;

    const title =
      plainText(q.mcqQuestionTitle) ||
      plainText(q.title) ||
      plainText(q.programmingQuestionTitle) ||
      `Question ${i + 1}`;
    const type = (q.questionType || (q.mcqQuestionType ? "mcq" : "") || "").toString() || "mcq";

    return {
      id: qid,
      index: i + 1,
      questionNo: `Q${i + 1}`,
      title,
      type,
      maxScore: getQuestionMaxScore(exercise, q),
      answeredCount: answered,
      correctCount: state.correct,
      incorrectCount: state.incorrect,
      skippedCount: Math.max(0, enrolledCount - answered),
      reviewCount: state.review,
      accuracy,
      avgResponseSeconds: state.timeSamples ? Math.round(state.timeSum / state.timeSamples) : null,
      options,
      fullMarksCount: state.fullMarks,
      partialCount: state.partial,
      zeroCount: state.zero,
      avgScore: state.scoredSamples > 0
        ? Math.round((state.scoreSum / state.scoredSamples) * 10) / 10
        : null,
    };
  });

  return {
    assessmentName,
    totalQuestions: questions.length,
    enrolledCount,
    attemptedCount,
    questions: out,
  };
};
