// Pure helpers that compute a student's earned marks for one assessment by
// walking the same `/getAll/courses-data/{courseId}` payload the reviewSubmission
// page already uses. Logic mirrors reviewSubmission's grading code 1:1 so the
// dashboard's "Scored Marks" column shows the same number the grading panel
// would compute for that student:
//
//   - MCQ + status !== 'evaluated'  → auto-graded: `isCorrect ? maxScore : 0`
//   - Otherwise                      → use the persisted submission.score,
//                                      capped at `maxScore` (covers both
//                                      programming auto-test-case scoring and
//                                      manually-overridden grader scores).
//
// Everything here is intentionally pure: no React, no fetching. The dashboard
// fetches the course payload via React Query (re-using `courseDataApi.getById`)
// and feeds the same `courseData.data` blob in here per student.

// ─── Loose shapes (matching what `/getAll/courses-data` actually returns) ────
//
// We deliberately keep these as `any`-shaped here. The shared `CourseStructureData`
// type in `apiServices/coursesData.ts` doesn't model `batchAndParticipants` or the
// per-question grading fields, and tightening the types here would mean dragging
// in (or duplicating) the reviewSubmission interfaces — a lot of surface area
// for what is fundamentally a "walk a tree, sum numbers" helper.

type Loose = Record<string, any>;

// MongoDB sometimes hands us ObjectId-wrapped values (`{$oid: "..."}`) or
// raw ObjectId instances that don't string-compare against the plain hex
// `_id` strings the exercise tree uses. Normalize everything to a hex
// string before keying into the per-question Map so the lookup can't miss
// because of a wrapper layer.
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

// Rank used to pick the "best" submission row when a student has multiple
// rows for the same question (retests, partial saves, etc.).
//   evaluated  — grader manually saved a score, highest authority
//   solved     — auto-grader passed every test case (code-editor submit)
//   submitted  — student submitted the test (final commit)
//   attempted  — student saved progress mid-flight
//   anything else (pending / unknown) → lowest
const submissionRank = (s: Loose): number =>
  s?.status === "evaluated" ? 4 :
  s?.status === "solved" ? 3 :
  s?.status === "submitted" ? 2 :
  s?.status === "attempted" ? 1 :
  0;

// ─── Exercise discovery ─────────────────────────────────────────────────────
// The same recursive walk reviewSubmission's `collectExercisesWithMetadata` does,
// but short-circuits as soon as we find the exercise we want — we never need
// the full list on the dashboard.
const SUBCAT_KEYS = [
  // We_Do
  //   "assignment"  — SINGULAR, and the one the We Do screen actually writes
  //                   (subcategory comes from the course label "Assignment").
  //                   Without it findExerciseInCourseData never resolves a
  //                   We Do assignment and the report row prints "—".
  "assignments", "assignment", "practical", "project_development", "assessments", "assesments",
  // You_Do — every spelling variant the writers use:
  //   "assessment"   — current default emitted by code-editor / MCQ / SectionBasedTestPage
  //   "Assessment"   — same key with the leading capital preserved
  //   "assesment"    — legacy typo (no `s`) still in older records
  "assessment", "Assessment", "assesment",
] as const;

const matchesExercise = (ex: Loose, exerciseId: string): boolean => {
  if (!ex || !exerciseId) return false;
  const target = idOf(exerciseId);
  if (!target) return false;
  const exId = idOf(ex._id);
  if (exId === target) return true;
  const exInfoId = idOf(ex.exerciseInformation?.exerciseId);
  if (exInfoId === target) return true;
  // Allow inclusive match the same way reviewSubmission does — some callers
  // pass a truncated id.
  if (exId && exId.includes(target)) return true;
  if (exInfoId && exInfoId.includes(target)) return true;
  return false;
};

const scanPedagogy = (pedagogy: Loose | undefined, exerciseId: string): Loose | null => {
  if (!pedagogy) return null;
  for (const tab of ["We_Do", "You_Do"] as const) {
    const tabData = pedagogy[tab];
    if (!tabData) continue;
    for (const sub of SUBCAT_KEYS) {
      const list = tabData[sub];
      if (!Array.isArray(list)) continue;
      for (const ex of list) {
        if (matchesExercise(ex, exerciseId)) return ex;
      }
    }
  }
  return null;
};

/**
 * Locate the exercise object inside a `/getAll/courses-data` payload. The
 * pedagogy can hang off module / submodule / topic / subtopic — we walk all
 * four levels and return the first hit.
 */
export const findExerciseInCourseData = (
  courseData: Loose | null | undefined,
  exerciseId: string,
): Loose | null => {
  if (!courseData?.modules || !Array.isArray(courseData.modules)) return null;

  for (const mod of courseData.modules) {
    const hit = scanPedagogy(mod?.pedagogy, exerciseId);
    if (hit) return hit;

    // module → topics → subTopics
    for (const topic of mod?.topics || []) {
      const tHit = scanPedagogy(topic?.pedagogy, exerciseId);
      if (tHit) return tHit;
      for (const st of topic?.subTopics || []) {
        const sHit = scanPedagogy(st?.pedagogy, exerciseId);
        if (sHit) return sHit;
      }
    }

    // module → subModules → topics → subTopics
    for (const sub of mod?.subModules || []) {
      const sHit = scanPedagogy(sub?.pedagogy, exerciseId);
      if (sHit) return sHit;
      for (const topic of sub?.topics || []) {
        const tHit = scanPedagogy(topic?.pedagogy, exerciseId);
        if (tHit) return tHit;
        for (const st of topic?.subTopics || []) {
          const stHit = scanPedagogy(st?.pedagogy, exerciseId);
          if (stHit) return stHit;
        }
      }
    }
  }

  return null;
};

// ─── Section discovery (for section-based assessments) ──────────────────────
// Section-based exercises (Part A / Part B …) keep their section definitions in
// `exercise.sectionConfigs` (Record<key, section> or array) and/or
// `exercise.sections`. Each question carries `q.sectionId` that matches a
// section's record-key / name / id. This mirrors SectionBasedTestPage's
// `rawToArray` + `normaliseSections` so the report groups questions exactly the
// way the student attended them.
export interface ExerciseSection {
  /** Canonical lookup key — equals the record-key when sectionConfigs is a map
   *  (which is what questions store in `q.sectionId`). */
  key: string;
  name: string;
  id: string;
  order: number;
}

const sectionRawToArray = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    return Object.entries(value).map(([key, sec]: [string, any]) => ({ ...(sec as object), _recordKey: key }));
  }
  return [];
};

export const getExerciseSections = (exercise: Loose | null | undefined): ExerciseSection[] => {
  if (!exercise) return [];
  const rawArr = exercise.sectionConfigs
    ? sectionRawToArray(exercise.sectionConfigs)
    : sectionRawToArray(exercise.sections);
  return rawArr
    .map((s: any): ExerciseSection => {
      const recordKey = s._recordKey as string | undefined;
      const name = s.name || s.sectionName || recordKey || s.id || s.sectionId || "";
      const id = s.id || s.sectionId || recordKey || name;
      return { key: recordKey || name || id, name, id, order: s.order ?? s.sectionNumber ?? 0 };
    })
    .sort((a, b) => a.order - b.order);
};

export const isExerciseSectionBased = (exercise: Loose | null | undefined): boolean => {
  if (!exercise) return false;
  if (exercise.exerciseType === "SectionBased" || exercise.isSectionBased === true) return true;
  return getExerciseSections(exercise).length > 0;
};

/** Convenience for the report modal: locate the exercise and return whether it
 *  is section-based plus its ordered section list. */
export const getExerciseSectionInfo = (
  courseData: Loose | null | undefined,
  exerciseId: string,
): { isSectionBased: boolean; sections: ExerciseSection[] } => {
  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise) return { isSectionBased: false, sections: [] };
  return { isSectionBased: isExerciseSectionBased(exercise), sections: getExerciseSections(exercise) };
};

// Match a question to its owning section. `q.sectionId` may equal the section's
// name, id, OR record-key (same triple-match SectionBasedTestPage uses).
const resolveQuestionSection = (q: Loose, sections: ExerciseSection[]): { id: string; name: string } => {
  const sid = q?.sectionId != null ? String(q.sectionId) : "";
  if (!sid) return { id: "", name: "" };
  const sec = sections.find(s => sid === s.name || sid === s.id || sid === s.key);
  return sec ? { id: sec.id, name: sec.name } : { id: sid, name: sid };
};

// ─── Per-question max score ─────────────────────────────────────────────────
// Direct port of reviewSubmission's `getQuestionMaxScore` (page.tsx ~line 474).
// Keep these two in lockstep — drift will make the dashboard total disagree
// with what the grader sees.
export const getQuestionMaxScore = (exercise: Loose, question: Loose): number => {
  if (question?.mcqQuestionScore && question.mcqQuestionScore > 0) return question.mcqQuestionScore;
  if (question?.score && question.score > 0) return question.score;
  if (question?.points && question.points > 0) return question.points;

  const ss = exercise?.scoreSettings;
  if (ss) {
    const { scoreType, levelBasedMarks, evenMarks, totalMarks, separateMarks, levelScoringConfiguration } = ss;

    if (scoreType === "separateMarks" && separateMarks) {
      const idx = (exercise.questions || []).findIndex((q: Loose) => q._id === question._id);
      if (idx !== -1) {
        if (separateMarks.general && separateMarks.general[idx] !== undefined) return separateMarks.general[idx];
        const diff = (question.difficulty || question.mcqQuestionDifficulty || "easy").toLowerCase();
        if (diff.includes("easy") && separateMarks.levelBased?.easy?.[idx] !== undefined) return separateMarks.levelBased.easy[idx];
        if (diff.includes("medium") && separateMarks.levelBased?.medium?.[idx] !== undefined) return separateMarks.levelBased.medium[idx];
        if (diff.includes("hard") && separateMarks.levelBased?.hard?.[idx] !== undefined) return separateMarks.levelBased.hard[idx];
      }
    }

    if (scoreType === "levelBasedMarks" && levelBasedMarks) {
      const diff = (question.difficulty || question.mcqQuestionDifficulty || "easy").toLowerCase();
      if (diff.includes("easy")) return levelBasedMarks.easy || 10;
      if (diff.includes("medium")) return levelBasedMarks.medium || 15;
      if (diff.includes("hard")) return levelBasedMarks.hard || 20;
    }

    if (scoreType === "levelBasedMarks" && levelScoringConfiguration) {
      const diff = (question.difficulty || question.mcqQuestionDifficulty || "easy").toLowerCase();
      if (diff.includes("easy") && levelScoringConfiguration.easy) return levelScoringConfiguration.easy.marksPerQuestion || 10;
      if (diff.includes("medium") && levelScoringConfiguration.medium) return levelScoringConfiguration.medium.marksPerQuestion || 15;
      if (diff.includes("hard") && levelScoringConfiguration.hard) return levelScoringConfiguration.hard.marksPerQuestion || 20;
    }

    if (scoreType === "evenMarks") {
      if (evenMarks !== undefined && evenMarks > 0) return evenMarks;
      if (totalMarks && (exercise.questions || []).length > 0) {
        return parseFloat((totalMarks / exercise.questions.length).toFixed(2));
      }
    }
  }

  const mcqConfig = exercise?.questionConfiguration?.mcqQuestionConfiguration;
  if (mcqConfig) {
    if (mcqConfig.scoringType === "equalDistribution" && mcqConfig.marksPerQuestion) return mcqConfig.marksPerQuestion;
    if (mcqConfig.scoringType === "questionSpecific" && question.mcqQuestionScore) return question.mcqQuestionScore;
  }

  const progConfig = exercise?.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
  if (progConfig) {
    if (progConfig.scoreType === "evenMarks" && progConfig.evenMarks) return progConfig.evenMarks;
    if (progConfig.scoreType === "levelBasedMarks" && progConfig.levelBasedMarks) {
      const diff = (question.difficulty || "easy").toLowerCase();
      if (diff.includes("easy")) return progConfig.levelBasedMarks.easy || 10;
      if (diff.includes("medium")) return progConfig.levelBasedMarks.medium || 15;
      if (diff.includes("hard")) return progConfig.levelBasedMarks.hard || 20;
    }
  }

  return 10; // Matches reviewSubmission's fallback so totals agree.
};

// ─── Exercise max total ─────────────────────────────────────────────────────
export const getDynamicExerciseTotal = (exercise: Loose | null | undefined): number => {
  if (!exercise || !Array.isArray(exercise.questions) || exercise.questions.length === 0) return 0;

  // Prefer the stored totalMarks from exerciseInformation (covers Combined/Section-based)
  if (exercise.exerciseInformation?.totalMarks && exercise.exerciseInformation.totalMarks > 0) {
    return exercise.exerciseInformation.totalMarks;
  }

  const ss = exercise.scoreSettings;
  if (ss) {
    const { scoreType, totalMarks, evenMarks, levelBasedMarks, levelScoringConfiguration } = ss;
    if (totalMarks && totalMarks > 0) return totalMarks;
    if (scoreType === "evenMarks" && evenMarks) return evenMarks * exercise.questions.length;
    if (scoreType === "levelBasedMarks") {
      let total = 0;
      for (const q of exercise.questions) {
        const diff = (q.difficulty || q.mcqQuestionDifficulty || "easy").toLowerCase();
        if (levelScoringConfiguration) {
          if (diff.includes("easy") && levelScoringConfiguration.easy) total += levelScoringConfiguration.easy.marksPerQuestion || 10;
          else if (diff.includes("medium") && levelScoringConfiguration.medium) total += levelScoringConfiguration.medium.marksPerQuestion || 15;
          else if (diff.includes("hard") && levelScoringConfiguration.hard) total += levelScoringConfiguration.hard.marksPerQuestion || 20;
          else total += 10;
        } else if (levelBasedMarks) {
          if (diff.includes("easy")) total += levelBasedMarks.easy || 10;
          else if (diff.includes("medium")) total += levelBasedMarks.medium || 15;
          else if (diff.includes("hard")) total += levelBasedMarks.hard || 20;
          else total += 10;
        } else {
          total += 10;
        }
      }
      return total;
    }
  }

  const mcqConfig = exercise.questionConfiguration?.mcqQuestionConfiguration;
  if (mcqConfig) {
    if (mcqConfig.mcqTotalMarks && mcqConfig.mcqTotalMarks > 0) return mcqConfig.mcqTotalMarks;
    if (mcqConfig.scoringType === "equalDistribution" && mcqConfig.marksPerQuestion) {
      return mcqConfig.marksPerQuestion * exercise.questions.length;
    }
  }

  return exercise.questions.reduce((acc: number, q: Loose) => acc + getQuestionMaxScore(exercise, q), 0);
};

const isQuestionMCQ = (q: Loose | null | undefined): boolean => {
  if (!q) return false;
  return (q.questionType?.toLowerCase() === "mcq") || (!q.title && !!q.mcqQuestionTitle);
};

// ─── Performance scale (grade bands) ────────────────────────────────────────
// Teachers configure a percentage-banded scale in Grade Settings (e.g.
// 0–40 "Poor", 40–60 "Average", 60–80 "Good", 80–100 "Excellent"). It's
// persisted on the exercise as `gradeSettings.gradeBands`. The report maps each
// student's percentage onto its band so the "Scale" column reads "Average" etc.
export interface GradeBand {
  label: string;
  fromPercent: number;
  toPercent: number;
}

// Mirrors GradeSettingsStep's DEFAULT_GRADE_BANDS so exercises saved before the
// scale was editable still show a sensible band instead of a dash.
const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { label: "Poor", fromPercent: 0, toPercent: 40 },
  { label: "Average", fromPercent: 40, toPercent: 60 },
  { label: "Good", fromPercent: 60, toPercent: 80 },
  { label: "Excellent", fromPercent: 80, toPercent: 100 },
];

/** Pull the performance-scale bands stored on the exercise's grade settings,
 *  normalized + sorted ascending. Falls back to the recommended default scale
 *  when the exercise has none configured. */
export const getExerciseGradeBands = (
  courseData: Loose | null | undefined,
  exerciseId: string,
): GradeBand[] => {
  const exercise = findExerciseInCourseData(courseData, exerciseId);
  const raw = exercise?.gradeSettings?.gradeBands;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_GRADE_BANDS;
  const bands = raw
    .map((b: Loose): GradeBand => ({
      label: typeof b?.label === "string" ? b.label : String(b?.label ?? ""),
      fromPercent: Number(b?.fromPercent) || 0,
      toPercent: Number(b?.toPercent) || 0,
    }))
    .filter((b) => b.label.trim() !== "")
    .sort((a, b) => a.fromPercent - b.fromPercent);
  return bands.length > 0 ? bands : DEFAULT_GRADE_BANDS;
};

/** Map a percentage (0–100) onto its scale label. Each band covers
 *  `[fromPercent, toPercent)`; the band that reaches 100 is inclusive so a
 *  perfect score still lands. Returns "" when pct is null or no band matches. */
export const scaleForPercent = (
  pct: number | null | undefined,
  bands: GradeBand[],
): string => {
  if (pct == null || !Number.isFinite(pct) || bands.length === 0) return "";
  for (const b of bands) {
    const inclusiveTop = b.toPercent >= 100;
    if (pct >= b.fromPercent && (inclusiveTop ? pct <= b.toPercent : pct < b.toPercent)) {
      return b.label;
    }
  }
  // Defensive: above every band → top label; below every band → bottom label.
  const last = bands[bands.length - 1];
  if (pct >= last.toPercent) return last.label;
  return bands[0].label;
};

// ─── Pull a single participant's answers for one exercise ───────────────────
const getAnswersForExercise = (
  participant: Loose,
  courseId: string,
  exercise: Loose,
): Loose[] => {
  const courses = participant?.user?.courses;
  if (!Array.isArray(courses)) return [];
  const course = courses.find((c: Loose) => c.courseId === courseId);
  if (!course?.answers) return [];

  const collect = (catObj: Loose | undefined): Loose[] => {
    if (!catObj) return [];
    const out: Loose[] = [];
    // Mirror reviewSubmission: scan every plausible subcategory bucket so we
    // don't miss assignments / practical / assessments / the `assesment` typo etc.
    for (const key of ["assignments", "assignment", "practical", "project_development", "assessment", "Assessment", "assessments", "assesments", "assesment"]) {
      if (Array.isArray(catObj[key])) out.push(...catObj[key]);
    }
    return out;
  };

  const all = [...collect(course.answers.We_Do), ...collect(course.answers.You_Do)];

  const exId = idOf(exercise._id);
  const exInfoId = idOf(exercise.exerciseInformation?.exerciseId);
  return all.filter((ans) => {
    const aid = idOf(ans?.exerciseId);
    if (!aid) return false;
    if (exId && aid === exId) return true;
    if (exInfoId && aid === exInfoId) return true;
    if (exId && aid.includes(exId)) return true;
    return false;
  });
};

// ─── The actual sum ─────────────────────────────────────────────────────────
export interface StudentMarks {
  /** Sum of every question's max — same for every student in the exercise. */
  totalMarks: number;
  /** Sum of the student's earned marks (MCQ auto + grader overrides). */
  scoredMarks: number;
  /** True if the student has at least one persisted answer for this exercise.
   *  Lets the UI render "—" for not-yet-attempted students instead of "0". */
  hasSubmitted: boolean;
  /** True if any matched answer document has a final-state parent status
   *  (`status: "completed" | "submitted" | "solved"`). Used by the live
   *  dashboard to promote the Test Status badge to "Submitted" even when
   *  the live-session `submitted` flag never flipped because the student
   *  walked away from the room without pressing the final Submit button. */
  parentSubmitted: boolean;
  /** Total number of questions in the exercise (MCQ + Programming + Others).
   *  Computed from the exercise definition, not the backend's live-dashboard
   *  response — which may under-count for Combined/Section-based exercises. */
  totalQuestions: number;
  /** Number of questions the student has actually answered (has a submission
   *  with content). */
  completedQuestions: number;
}

const EMPTY: StudentMarks = { totalMarks: 0, scoredMarks: 0, hasSubmitted: false, parentSubmitted: false, totalQuestions: 0, completedQuestions: 0 };

// Final-state parent statuses written either by the backend on full Submit
// or by the per-question auto-grader on a passing solved test. Any of these
// counts as "the student has finished this assessment".
const SUBMITTED_PARENT_STATUSES = new Set(["completed", "submitted", "solved"]);

const isParentDocSubmitted = (ans: Loose): boolean => {
  const s = String(ans?.status || "").toLowerCase();
  if (SUBMITTED_PARENT_STATUSES.has(s)) return true;
  // Fallback: any individual question marked as a terminal state.
  if (Array.isArray(ans?.questions)) {
    return ans.questions.some((q: Loose) => {
      const qs = String(q?.status || "").toLowerCase();
      return qs === "solved" || qs === "submitted" || qs === "evaluated" || qs === "completed";
    });
  }
  return false;
};

/**
 * Compute one student's marks for one exercise. Returns zeros + hasSubmitted=false
 * if the exercise can't be found in `courseData` or the student has no answers.
 */
export const computeStudentMarks = (args: {
  courseData: Loose | null | undefined;
  courseId: string;
  exerciseId: string;
  participant: Loose;
}): StudentMarks => {
  const { courseData, courseId, exerciseId, participant } = args;
  if (!courseData || !exerciseId || !participant) return EMPTY;

  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise) return EMPTY;

  const totalMarks = getDynamicExerciseTotal(exercise);
  const allQuestions = exercise.questions || [];
  const totalQuestions = allQuestions.length;
  const answers = getAnswersForExercise(participant, courseId, exercise);
  if (answers.length === 0) {
    return { totalMarks, scoredMarks: 0, hasSubmitted: false, parentSubmitted: false, totalQuestions, completedQuestions: 0 };
  }

  // Any matched answer doc with a terminal parent status counts as "the
  // student has submitted this assessment". Drives the live-dashboard
  // Test Status badge ("Submitted" vs "Not Started").
  const parentSubmitted = answers.some(isParentDocSubmitted);

  // Build a map of questionId → best submission across all answer groups.
  // Keys are normalized via `idOf` so a raw ObjectId / `{$oid:...}` wrapper
  // and a plain hex string both land in the same bucket. We rank "evaluated"
  // (grader saved) over "solved" (auto-grader passed) over "submitted" over
  // "attempted", with newest-submittedAt as the tie-breaker.
  const subByQ = new Map<string, Loose>();
  for (const ans of answers) {
    for (const sub of ans?.questions || []) {
      const qid = idOf(sub?.questionId);
      if (!qid) continue;
      const existing = subByQ.get(qid);
      if (!existing) {
        subByQ.set(qid, sub);
        continue;
      }
      if (submissionRank(sub) > submissionRank(existing)) subByQ.set(qid, sub);
      else if (submissionRank(sub) === submissionRank(existing) &&
               (sub?.submittedAt || "") > (existing?.submittedAt || "")) {
        subByQ.set(qid, sub);
      }
    }
  }

  // Both the total here and the per-question breakdown share `scoreOneQuestion`
  // — that's the contract that prevents drift (which previously caused the
  // total to show 10 while the per-question table summed to 0).
  // `studentSubmitted` doesn't affect the totalled score (an unanswered
  // question contributes 0 either way), so we pass `false` here.
  let scoredMarks = 0;
  let completedQuestions = 0;
  for (const question of allQuestions) {
    const sub = subByQ.get(idOf(question._id));
    if (!sub) continue; // no answer → 0 contribution
    const hasAnswer = !!(
      sub.codeAnswer ||
      (Array.isArray(sub.files) && sub.files.length > 0) ||
      (Array.isArray(sub.othersFiles) && sub.othersFiles.length > 0) ||
      (sub.isCorrect !== undefined && sub.isCorrect !== null)
    );
    if (hasAnswer) completedQuestions++;
    const { scoredMark } = scoreOneQuestion(exercise, question, sub, false);
    scoredMarks += scoredMark;
  }

  return { totalMarks, scoredMarks, hasSubmitted: true, parentSubmitted, totalQuestions, completedQuestions };
};

// ─── Per-question breakdown for the Report view's "Detailed Report" toggle ──
//
// Returns one row per question on the exercise (whether the student answered
// it or not). Each row carries everything the inline expand panel needs to
// render the per-question table the user asked for:
//   Question No, Title, Type, Status, Total Mark, Scored Mark, Submitted At, Time Taken
//
// Status values mirror the existing `StudentQuestion.status` enum the
// StudentDetailsPage overlay uses, with one addition (`evaluated`) so the
// panel can distinguish auto-graded MCQ from grader-saved manual scores.

// Per-question status. Note: "in_progress" intentionally does NOT exist here
// — that's a TEST-level concept (the student is currently attending the
// test). Once they submit, every individual question is either:
//   - "evaluated"   — grader saved a manual override score
//   - "submitted"   — student answered it (auto-graded for MCQ)
//   - "not_answered" — student submitted the test but skipped this question
// For a still-live test that the student has NOT yet submitted, a skipped
// question is "pending" (they may still come back to it).
export type BreakdownStatus = "evaluated" | "submitted" | "not_answered" | "pending";

export interface QuestionBreakdownRow {
  /** Stable per-question id — used as React key. */
  questionId: string;
  /** Human display number (1-based). */
  questionNo: number;
  /** Plain-text title. We collapse rich-text/object titles down to a string
   *  with the same `asText` rules StudentDetailsPage uses. */
  title: string;
  /** "MCQ" / "Programming" / etc. Falls back to "—" when the exercise doesn't
   *  declare a per-question type. */
  type: string;
  status: BreakdownStatus;
  /** Per-question max — same value `getQuestionMaxScore` returns. */
  totalMark: number;
  /** Earned for this question. 0 for un-attempted; auto-graded for MCQ;
   *  persisted score otherwise. Capped at `totalMark` defensively. */
  scoredMark: number;
  /** ISO timestamp the student last submitted this question. `null` if
   *  they haven't touched it. */
  submittedAt: string | null;
  /** Seconds. 0 if unattempted. */
  timeTakenSeconds: number;
  /** Owning section's id for section-based assessments (Part A / Part B …).
   *  Empty string for non-section exercises. */
  sectionId: string;
  /** Owning section's display name (e.g. "Part A"). Empty for non-section. */
  sectionName: string;
}

// Match the title-normalization used by StudentDetailsPage — titles in the
// payload can occasionally arrive as content-block arrays/objects.
const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ");
  if (typeof v === "object") return asText((v as any).value ?? (v as any).text ?? "");
  return String(v);
};

const inferQuestionType = (q: Loose): string => {
  if (q?.questionType) return String(q.questionType).toUpperCase();
  if (isQuestionMCQ(q)) return "MCQ";
  if (q?.programmingLanguage || q?.codeStub) return "Programming";
  return "—";
};

/**
 * Decide a single question's scored mark + status. Used by BOTH the per-
 * question breakdown and the assessment-total computation so the two
 * numbers can never disagree (the earlier bug: the total used MCQ
 * isCorrect for "pending" status while the breakdown silently dropped
 * those to 0, leading to a non-zero total with all-zero rows).
 *
 * Rules (matching reviewSubmission's grading code at ~line 2020):
 *   - If grader manually saved an override → "evaluated", use the saved score.
 *   - Else if any submission exists at all  → "submitted",
 *       MCQ: `isCorrect ? max : 0` (auto-grader is instant)
 *       Other: persisted submission.score (auto-test-case or in-flight)
 *   - Else (no submission row at all):
 *       Test already submitted → "not_answered" (student skipped it)
 *       Test still live        → "pending"     (they may return)
 *
 * Pure: no React, no IO.
 */
const scoreOneQuestion = (
  exercise: Loose,
  question: Loose,
  sub: Loose | undefined,
  studentSubmitted: boolean,
): { status: BreakdownStatus; scoredMark: number; submittedAt: string | null; timeTakenSeconds: number } => {
  const max = getQuestionMaxScore(exercise, question);

  if (!sub) {
    return {
      status: studentSubmitted ? "not_answered" : "pending",
      scoredMark: 0,
      submittedAt: null,
      timeTakenSeconds: 0,
    };
  }

  const submittedAt = sub.submittedAt || null;
  const timeTakenSeconds = Math.max(0, Number(sub.timeTaken) || 0);

  if (sub.status === "evaluated") {
    return {
      status: "evaluated",
      scoredMark: Math.min(Math.max(Number(sub.score) || 0, 0), max),
      submittedAt,
      timeTakenSeconds,
    };
  }

  // ANY other submission status (including "pending", "attempted", or a
  // missing/unexpected value) means the student answered the question.
  // For MCQ → instant auto-grade via `isCorrect`. For programming/etc →
  // use the persisted score (auto-test-case score or in-flight value).
  if (isQuestionMCQ(question)) {
    return {
      status: "submitted",
      scoredMark: sub.isCorrect ? max : 0,
      submittedAt,
      timeTakenSeconds,
    };
  }
  return {
    status: "submitted",
    scoredMark: Math.min(Math.max(Number(sub.score) || 0, 0), max),
    submittedAt,
    timeTakenSeconds,
  };
};

/**
 * Build the per-question breakdown for one student in one exercise. Returns
 * an empty array if the exercise can't be found in `courseData` or if the
 * participant is missing — the caller renders a "—" / "no submissions" state.
 *
 * `studentSubmitted` controls how empty rows are labelled (see `scoreOneQuestion`).
 */
export const getStudentQuestionsBreakdown = (args: {
  courseData: Loose | null | undefined;
  courseId: string;
  exerciseId: string;
  participant: Loose | null | undefined;
  /** Test-level submission state (StudentProgress.submitted). When true,
   *  missing-answer questions are labelled "not_answered" instead of "pending".
   *  Defaults to false for backwards compatibility. */
  studentSubmitted?: boolean;
  /** Optional map of questionId → seconds, sourced from the
   *  `/api/assessment/student-details` endpoint (the same one the existing
   *  StudentDetailsPage overlay uses). The courses-data payload that powers
   *  marks doesn't reliably carry `timeTaken` per submission, so this
   *  override is the canonical source for the "Time Taken" column. When
   *  absent we fall back to `sub.timeTaken` (which may be 0 / missing → "—"). */
  timeTakenByQuestionId?: Map<string, number> | null;
}): QuestionBreakdownRow[] => {
  const { courseData, courseId, exerciseId, participant, studentSubmitted = false, timeTakenByQuestionId } = args;
  if (!courseData || !exerciseId || !participant) return [];

  const exercise = findExerciseInCourseData(courseData, exerciseId);
  if (!exercise || !Array.isArray(exercise.questions)) return [];

  // Resolve sections once so each row can carry its section (used by the
  // report's "Section Based" grouping).
  const sections = getExerciseSections(exercise);

  const answers = getAnswersForExercise(participant, courseId, exercise);

  // De-dupe with the same idOf + submissionRank rules `computeStudentMarks`
  // uses, so the per-question detail panel can never disagree with the
  // assessment total.
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

  return exercise.questions.map((q: Loose, idx: number) => {
    const sub = subByQ.get(idOf(q._id));
    const totalMark = getQuestionMaxScore(exercise, q);
    const { status, scoredMark, submittedAt, timeTakenSeconds: derivedTimeTaken } =
      scoreOneQuestion(exercise, q, sub, studentSubmitted);

    // Prefer the value from `/api/assessment/student-details` when provided —
    // that endpoint computes timing the same way the working "View Detailed
    // Report" overlay does. Fall back to whatever the courses-data submission
    // carries (often 0 / missing, which is why this override exists).
    const overrideSeconds = timeTakenByQuestionId?.get(String(q._id));
    const timeTakenSeconds = typeof overrideSeconds === "number" && overrideSeconds >= 0
      ? overrideSeconds
      : derivedTimeTaken;

    // Title fallback chain — MCQ rows often carry the question under
    // `mcqQuestionTitle`, programming under `title`.
    const rawTitle = q.title ?? q.mcqQuestionTitle ?? q.questionTitle ?? "";
    const title = asText(rawTitle) || `Question ${idx + 1}`;

    const section = resolveQuestionSection(q, sections);

    return {
      questionId: String(q._id),
      questionNo: idx + 1,
      title,
      type: inferQuestionType(q),
      status,
      totalMark,
      scoredMark,
      submittedAt,
      timeTakenSeconds,
      sectionId: section.id,
      sectionName: section.name,
    };
  });
};
