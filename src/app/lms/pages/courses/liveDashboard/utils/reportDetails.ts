// Per-student question detail rows for the Report modal.
//
// Reuses the same courses-data walk / submission-rank rules the existing
// dashboard trusts (`computeStudentMarks`, `LearnerDetailModal`), so the
// Report preview and every export line up with what the trainer sees on the
// row and on the Detailed View overlay. Nothing here fabricates a value —
// missing fields surface as `null` and the UI decides how to render them.

import {
  findExerciseInCourseData,
  getQuestionMaxScore,
} from "./computeStudentMarks";

type Loose = Record<string, any>;

const idOf = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.$oid === "string") return v.$oid;
    if (v._id != null) return idOf(v._id);
    if (typeof v.toString === "function") {
      const s = v.toString();
      if (s && s !== "[object Object]") return s;
    }
  }
  return String(v);
};

const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ");
  if (typeof v === "object") return asText((v as any).value ?? (v as any).text ?? "");
  return String(v);
};

const submissionRank = (s: Loose): number =>
  s?.status === "evaluated" ? 4 :
  s?.status === "solved" ? 3 :
  s?.status === "submitted" ? 2 :
  s?.status === "attempted" ? 1 :
  0;

// Same MCQ detection `computeStudentMarks` uses. A question with only
// `mcqQuestionTitle` and no `title` is MCQ.
const isMCQQuestion = (q: Loose): boolean => {
  const t = String(q?.questionType || "").toLowerCase();
  if (t === "mcq") return true;
  return !q?.title && !!q?.mcqQuestionTitle;
};

const inferQuestionType = (q: Loose): string => {
  if (isMCQQuestion(q)) return "MCQ";
  if (q?.questionType) {
    const t = String(q.questionType);
    if (t.toLowerCase() === "programming") return "Coding";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (q?.programmingLanguage || q?.programmingQuestionTitle || q?.codeStub) return "Coding";
  return "—";
};

function participantForStudent(courseData: Loose | null | undefined, studentId: string): Loose | null {
  if (!courseData) return null;
  const flat: Loose[] = (courseData.batchAndParticipants || []).flatMap((b: Loose) => b?.users || []);
  return flat.find((p: Loose) => idOf(p?.user?._id) === studentId || idOf(p?._id) === studentId) || null;
}

function getAnswersForParticipant(participant: Loose, courseId: string, exerciseIdKey: string): Loose[] {
  const courses = Array.isArray(participant?.user?.courses) ? participant.user.courses : [];
  const course = courses.find((c: Loose) => idOf(c?.courseId) === idOf(courseId)) || courses[0];
  if (!course?.answers) return [];
  const out: Loose[] = [];
  for (const tabKey of Object.keys(course.answers || {})) {
    const tab = course.answers[tabKey];
    if (!tab || typeof tab !== "object") continue;
    for (const arr of Object.values(tab)) {
      if (!Array.isArray(arr)) continue;
      for (const ans of arr) {
        if (idOf(ans?.exerciseId) === exerciseIdKey) out.push(ans);
      }
    }
  }
  return out;
}

export type QuestionSubmissionStatus = "submitted" | "not_submitted" | "pending";

export type QuestionEvaluationStatus =
  | "auto_evaluated"
  | "auto_evaluated_ai"
  | "manually_evaluated"
  | "needs_review"
  | "not_evaluated"; // student never submitted, so nothing to evaluate

/**
 * One question row for one student. Every field is derived from the
 * persisted answer + exercise definition — no fabricated defaults.
 * The renderer decides how to present `null` fields (usually as "—").
 */
export interface StudentQuestionRow {
  questionId: string;
  index: number; // 1-based
  title: string;
  type: string; // "MCQ" / "Coding" / …
  submissionStatus: QuestionSubmissionStatus;
  submissionStatusLabel: string;
  scoredMark: number | null;
  totalMark: number;
  percentage: number | null;
  hasTestCases: boolean;
  testCasesPassed: number | null;
  testCasesTotal: number | null;
  testCasesLabel: string; // "8 / 10 Passed", "All Passed", "No Test Cases", "—"
  evaluationStatus: QuestionEvaluationStatus;
  evaluationLabel: string; // "Auto Evaluated", "Manually Evaluated", "Needs Review", "—"
  language: string | null;
  submittedAt: string | null; // ISO
  timeTakenSeconds: number | null;
}

/**
 * Build the ordered per-question detail rows for one student.
 * Returns `[]` when the exercise or participant cannot be resolved.
 */
export function computeStudentQuestionRows(args: {
  courseData: Loose | null | undefined;
  courseId: string;
  exerciseId: string;
  studentId: string;
}): StudentQuestionRow[] {
  const { courseData, courseId, exerciseId, studentId } = args;
  if (!courseData || !exerciseId || !studentId) return [];

  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise || !Array.isArray(exercise.questions)) return [];

  const participant = participantForStudent(courseData, studentId);
  const answers = participant ? getAnswersForParticipant(participant, courseId, idOf(exerciseId)) : [];

  const subByQ = new Map<string, Loose>();
  for (const ans of answers) {
    for (const sub of ans?.questions || []) {
      const qid = idOf(sub?.questionId);
      if (!qid) continue;
      const existing = subByQ.get(qid);
      if (!existing) subByQ.set(qid, sub);
      else if (submissionRank(sub) > submissionRank(existing)) subByQ.set(qid, sub);
      else if (submissionRank(sub) === submissionRank(existing) &&
               (sub?.submittedAt || "") > (existing?.submittedAt || "")) {
        subByQ.set(qid, sub);
      }
    }
  }

  const exerciseEvalMethod = String(exercise?.evaluationMethod?.method || "").toLowerCase();

  return exercise.questions.map((q: Loose, i: number): StudentQuestionRow => {
    const qid = idOf(q._id) || String(i);
    const sub = subByQ.get(qid);
    const totalMark = getQuestionMaxScore(exercise, q);
    const title = asText(q?.title ?? q?.programmingQuestionTitle ?? q?.mcqQuestionTitle) || `Question ${i + 1}`;
    const type = inferQuestionType(q);
    const isMCQ = isMCQQuestion(q);

    // ── Not submitted ────────────────────────────────────────────────────
    if (!sub) {
      return {
        questionId: qid,
        index: i + 1,
        title,
        type,
        submissionStatus: "not_submitted",
        submissionStatusLabel: "Not Submitted",
        scoredMark: null,
        totalMark,
        percentage: null,
        hasTestCases: false,
        testCasesPassed: null,
        testCasesTotal: null,
        testCasesLabel: "—",
        evaluationStatus: "not_evaluated",
        evaluationLabel: "—",
        language: null,
        submittedAt: null,
        timeTakenSeconds: null,
      };
    }

    // ── Submitted ────────────────────────────────────────────────────────
    const breakdown: Loose | null = sub.evaluationBreakdown || null;
    const bMethod = String(breakdown?.method || "").toLowerCase();
    const effectiveMethod = bMethod || exerciseEvalMethod || "";

    // Test-case aggregate — only meaningful for programming Qs where the
    // grader/AI ran cases. MCQ never has test cases (auto-graded is a
    // single boolean).
    const tcPassed = Number(breakdown?.testcase?.passed);
    const tcTotal = Number(breakdown?.testcase?.total);
    const aiPassed = Number(breakdown?.ai?.passedTestCases);
    const aiTotal = Number(breakdown?.ai?.totalTestCases);
    const hasTcBreakdown = effectiveMethod === "testcase" && Number.isFinite(tcTotal) && tcTotal > 0;
    const hasAiBreakdown = effectiveMethod === "ai" && Number.isFinite(aiTotal) && aiTotal > 0;
    const hasTestCases = hasTcBreakdown || hasAiBreakdown;
    const passed = hasTcBreakdown ? tcPassed : hasAiBreakdown ? aiPassed : null;
    const total = hasTcBreakdown ? tcTotal : hasAiBreakdown ? aiTotal : null;

    let testCasesLabel: string;
    if (isMCQ) testCasesLabel = "—";
    else if (hasTestCases && total != null && passed != null) {
      testCasesLabel = passed >= total ? "All Passed" : `${passed} / ${total} Passed`;
    } else testCasesLabel = "No Test Cases";

    // Marks — MCQ auto-grades to full/zero via isCorrect; others use
    // persisted score (auto-grader OR manual override). Never > max.
    let scoredMark: number;
    if (sub.status === "evaluated") {
      scoredMark = Math.min(Math.max(Number(sub.score) || 0, 0), totalMark);
    } else if (isMCQ) {
      scoredMark = sub.isCorrect ? totalMark : 0;
    } else {
      scoredMark = Math.min(Math.max(Number(sub.score) || 0, 0), totalMark);
    }
    scoredMark = Math.round(scoredMark * 100) / 100;

    // Evaluation status:
    //   - status "evaluated" → grader saved override → Manually Evaluated
    //   - MCQ / testcase / ai breakdown present → Auto Evaluated (AI variant)
    //   - manual method with no override yet → Needs Review
    //   - anything else (queued judge etc.) → Needs Review
    let evaluationStatus: QuestionEvaluationStatus;
    let evaluationLabel: string;
    if (sub.status === "evaluated") {
      evaluationStatus = "manually_evaluated";
      evaluationLabel = "Manually Evaluated";
    } else if (isMCQ) {
      evaluationStatus = "auto_evaluated";
      evaluationLabel = "Auto Evaluated";
    } else if (hasTestCases) {
      evaluationStatus = effectiveMethod === "ai" ? "auto_evaluated_ai" : "auto_evaluated";
      evaluationLabel = effectiveMethod === "ai" ? "Auto Evaluated (AI)" : "Auto Evaluated";
    } else if (effectiveMethod === "manual") {
      evaluationStatus = "needs_review";
      evaluationLabel = "Needs Review";
    } else {
      evaluationStatus = "needs_review";
      evaluationLabel = "Needs Review";
    }

    const percentage = totalMark > 0 ? Math.round((scoredMark / totalMark) * 100) : null;

    // Language / submittedAt / timeTakenSeconds — surface only when real.
    const language = (() => {
      const raw = String(sub?.language || q?.programmingLanguage || "").trim();
      return raw || null;
    })();
    const submittedAt = sub?.submittedAt || null;
    const timeTakenSeconds = (() => {
      const raw = Number(sub?.timeTaken ?? sub?.timeTakenSeconds);
      if (!Number.isFinite(raw) || raw <= 0) return null;
      return Math.round(raw);
    })();

    return {
      questionId: qid,
      index: i + 1,
      title,
      type,
      submissionStatus: "submitted",
      submissionStatusLabel: "Submitted",
      scoredMark,
      totalMark,
      percentage,
      hasTestCases,
      testCasesPassed: passed,
      testCasesTotal: total,
      testCasesLabel,
      evaluationStatus,
      evaluationLabel,
      language,
      submittedAt,
      timeTakenSeconds,
    };
  });
}

/**
 * Ordered question list (title + id + type) for the exercise. Used for the
 * "Questions to Include" picker in the report modal.
 */
export interface ExerciseQuestionMeta {
  id: string;
  index: number; // 1-based
  title: string;
  type: string;
}

export function listExerciseQuestions(
  courseData: Loose | null | undefined,
  exerciseId: string,
): ExerciseQuestionMeta[] {
  if (!courseData || !exerciseId) return [];
  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise || !Array.isArray(exercise.questions)) return [];
  return exercise.questions.map((q: Loose, i: number) => ({
    id: idOf(q._id) || String(i),
    index: i + 1,
    title: asText(q?.title ?? q?.programmingQuestionTitle ?? q?.mcqQuestionTitle) || `Question ${i + 1}`,
    type: inferQuestionType(q),
  }));
}
