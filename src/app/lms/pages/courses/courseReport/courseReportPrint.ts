// Course Report → the shared Print Preview.
//
// Printing goes through Business Reports' PrintPreviewModal, so the course
// report gets the same Customize Fields / Customize Report Settings panels,
// the institution's saved letterhead and the same PDF / Excel / Print output
// as every other report in the LMS. That modal prints a GROUPED table: a
// block's "client"-scope cells are merged down its rows, and each of its
// "service" rows is one line. Each layout below says what a block is, what a
// row is, and which columns the trainer may tick.

import type { FieldRow } from "@/app/lms/pages/businessreports/components/PrintPreviewModal";
import type { ReportClientBlock } from "@/app/lms/pages/servicemapping/components/serviceReport";
import {
  formatMarks, formatPercent, QUESTION_STATUS_LABEL, round1, STATUS_LABEL,
  type QuestionRow, type ReportExercise, type ReportStudent, type StudentResult, type StudentTotals,
} from "./reportData";

export type PrintLayout =
  | "exercise-summary"
  | "exercise-questions"
  | "student-totals"
  | "student-exercises"
  | "student-questions";

export const LAYOUT_LABEL: Record<PrintLayout, { label: string; hint: string }> = {
  "exercise-summary": { label: "Summary", hint: "One row per student" },
  "exercise-questions": { label: "With question details", hint: "Every question for each student" },
  "student-totals": { label: "Totals only", hint: "One row per student, all exercises summed" },
  "student-exercises": { label: "Exercise-wise", hint: "Each student's result in every exercise" },
  "student-questions": { label: "With question details", hint: "Every question of every exercise" },
};

// `client` / `business` are the two block fields the modal reads directly;
// every other block-level column comes off `clientExtras` by its key.
const STUDENT_FIELDS: FieldRow[] = [
  { key: "student", label: "Student Name", required: true, scope: "client", column: "Student", dataKey: "client" },
  { key: "regNo", label: "Register No", scope: "client", column: "Reg No", dataKey: "business" },
  { key: "email", label: "Email", scope: "client", column: "Email", dataKey: "email" },
  { key: "batch", label: "Batch", scope: "client", column: "Batch", dataKey: "batch" },
];

const QUESTION_FIELDS: FieldRow[] = [
  { key: "qNo", label: "Q. No.", scope: "service", column: "Q. No.", dataKey: "qNo" },
  { key: "question", label: "Question", required: true, scope: "service", column: "Question", dataKey: "question" },
  { key: "qType", label: "Question Type", scope: "service", column: "Type", dataKey: "qType" },
  { key: "difficulty", label: "Difficulty", scope: "service", column: "Difficulty", dataKey: "difficulty" },
  { key: "qSection", label: "Section", scope: "service", column: "Section", dataKey: "qSection" },
  { key: "qMax", label: "Max Marks", scope: "service", column: "Max", dataKey: "qMax" },
  { key: "qScored", label: "Marks Scored", scope: "service", column: "Scored", dataKey: "qScored" },
  { key: "qStatus", label: "Question Status", scope: "service", column: "Status", dataKey: "qStatus" },
];

export const LAYOUT_FIELDS: Record<PrintLayout, { fields: FieldRow[]; defaults: Set<string> }> = {
  "exercise-summary": {
    fields: [
      ...STUDENT_FIELDS,
      { key: "status", label: "Test Status", scope: "service", column: "Status", dataKey: "status" },
      { key: "attempted", label: "Attempted", scope: "service", column: "Attempted", dataKey: "attempted" },
      { key: "marks", label: "Marks", scope: "service", column: "Marks", dataKey: "marks" },
      { key: "percent", label: "Percentage", scope: "service", column: "Percentage", dataKey: "percent" },
      { key: "scale", label: "Scale", scope: "service", column: "Scale", dataKey: "scale" },
    ],
    defaults: new Set(["student", "regNo", "status", "marks", "percent", "scale"]),
  },
  "exercise-questions": {
    fields: [
      ...STUDENT_FIELDS,
      { key: "stMarks", label: "Student Marks", scope: "client", column: "Marks", dataKey: "stMarks" },
      { key: "stPercent", label: "Student Percentage", scope: "client", column: "%", dataKey: "stPercent" },
      { key: "stStatus", label: "Test Status", scope: "client", column: "Test Status", dataKey: "stStatus" },
      ...QUESTION_FIELDS,
    ],
    defaults: new Set(["student", "regNo", "stMarks", "qNo", "question", "qMax", "qScored", "qStatus"]),
  },
  "student-totals": {
    fields: [
      ...STUDENT_FIELDS,
      { key: "assignments", label: "Assignments Completed", scope: "service", column: "Assignments", dataKey: "assignments" },
      { key: "assessments", label: "Assessments Completed", scope: "service", column: "Assessments", dataKey: "assessments" },
      { key: "marks", label: "Total Marks", scope: "service", column: "Marks", dataKey: "marks" },
      { key: "percent", label: "Overall Percentage", scope: "service", column: "Overall %", dataKey: "percent" },
      { key: "scale", label: "Scale", scope: "service", column: "Scale", dataKey: "scale" },
    ],
    defaults: new Set(["student", "regNo", "batch", "assignments", "assessments", "marks", "percent", "scale"]),
  },
  "student-exercises": {
    fields: [
      ...STUDENT_FIELDS,
      { key: "overallMarks", label: "Overall Marks", scope: "client", column: "Overall Marks", dataKey: "overallMarks" },
      { key: "overallPercent", label: "Overall Percentage", scope: "client", column: "Overall %", dataKey: "overallPercent" },
      { key: "exercise", label: "Exercise", required: true, scope: "service", column: "Exercise", dataKey: "exercise" },
      { key: "type", label: "Type", scope: "service", column: "Type", dataKey: "type" },
      { key: "subcategory", label: "Subcategory", scope: "service", column: "Subcategory", dataKey: "subcategory" },
      { key: "location", label: "Module › Topic", scope: "service", column: "Module › Topic", dataKey: "location" },
      { key: "status", label: "Status", scope: "service", column: "Status", dataKey: "status" },
      { key: "marks", label: "Marks", scope: "service", column: "Marks", dataKey: "marks" },
      { key: "percent", label: "Percentage", scope: "service", column: "%", dataKey: "percent" },
      { key: "scale", label: "Scale", scope: "service", column: "Scale", dataKey: "scale" },
    ],
    defaults: new Set(["student", "regNo", "overallPercent", "exercise", "type", "status", "marks", "percent"]),
  },
  "student-questions": {
    fields: [
      ...STUDENT_FIELDS,
      // The block is one student IN one exercise, so the exercise columns
      // sit on the block and merge down its questions.
      { key: "exercise", label: "Exercise", required: true, scope: "client", column: "Exercise", dataKey: "exercise" },
      { key: "type", label: "Type", scope: "client", column: "Type", dataKey: "type" },
      { key: "exMarks", label: "Exercise Marks", scope: "client", column: "Marks", dataKey: "exMarks" },
      { key: "exPercent", label: "Exercise Percentage", scope: "client", column: "%", dataKey: "exPercent" },
      ...QUESTION_FIELDS,
    ],
    defaults: new Set(["student", "regNo", "exercise", "exMarks", "qNo", "question", "qMax", "qScored", "qStatus"]),
  },
};

// ─── Blocks ─────────────────────────────────────────────────────────────────

const studentCells = (s: ReportStudent) => ({
  client: s.name,
  business: s.regNo || "—",
  extras: { email: s.email || "—", batch: s.batch || "—" },
});

const answered = (r: StudentResult) => r.status !== "not-started";

const questionService = (q: QuestionRow): Record<string, string> => ({
  qNo: String(q.no),
  question: q.title,
  qType: q.type,
  difficulty: q.difficulty || "—",
  qSection: q.section || "—",
  qMax: String(round1(q.max)),
  qScored: q.status === "pending" || q.status === "not_answered" ? "—" : String(round1(q.scored)),
  qStatus: QUESTION_STATUS_LABEL[q.status],
});

// A block with no rows prints nothing at all, so an exercise without
// questions still gets a line saying so.
const NO_QUESTIONS: Record<string, string> = { qNo: "—", question: "No questions in this exercise" };

export interface PrintSources {
  resultOf: (exerciseId: string, studentId: string) => StudentResult;
  questionsOf: (exercise: ReportExercise, student: ReportStudent) => QuestionRow[];
  totalsOf: (student: ReportStudent) => StudentTotals;
}

/** By Exercise: the chosen students in ONE exercise. */
export function exerciseBlocks(
  layout: "exercise-summary" | "exercise-questions",
  exercise: ReportExercise,
  students: ReportStudent[],
  src: PrintSources,
): ReportClientBlock[] {
  return students.map((s) => {
    const r = src.resultOf(exercise.id, s.id);
    const cells = studentCells(s);
    if (layout === "exercise-summary") {
      return {
        client: cells.client,
        business: cells.business,
        clientExtras: cells.extras,
        services: [{
          status: STATUS_LABEL[r.status],
          attempted: `${r.attempted} / ${r.totalQuestions}`,
          marks: formatMarks(r.scored, r.total, answered(r)),
          percent: formatPercent(r.percent),
          scale: r.scale || "—",
        }],
      };
    }
    const questions = src.questionsOf(exercise, s);
    return {
      client: cells.client,
      business: cells.business,
      clientExtras: {
        ...cells.extras,
        stMarks: formatMarks(r.scored, r.total, answered(r)),
        stPercent: formatPercent(r.percent),
        stStatus: STATUS_LABEL[r.status],
      },
      services: questions.length ? questions.map(questionService) : [NO_QUESTIONS],
    };
  });
}

/** By Student: the chosen students across the filtered exercises. */
export function studentBlocks(
  layout: "student-totals" | "student-exercises" | "student-questions",
  students: ReportStudent[],
  exercises: ReportExercise[],
  src: PrintSources,
): ReportClientBlock[] {
  if (layout === "student-totals") {
    return students.map((s) => {
      const t = src.totalsOf(s);
      const cells = studentCells(s);
      return {
        client: cells.client,
        business: cells.business,
        clientExtras: cells.extras,
        services: [{
          assignments: `${t.assignmentsDone} / ${t.assignmentsTotal}`,
          assessments: `${t.assessmentsDone} / ${t.assessmentsTotal}`,
          marks: `${round1(t.scored)} / ${round1(t.total)}`,
          percent: formatPercent(t.percent),
          scale: t.scale || "—",
        }],
      };
    });
  }

  if (layout === "student-exercises") {
    return students.map((s) => {
      const t = src.totalsOf(s);
      const cells = studentCells(s);
      return {
        client: cells.client,
        business: cells.business,
        clientExtras: {
          ...cells.extras,
          overallMarks: `${round1(t.scored)} / ${round1(t.total)}`,
          overallPercent: formatPercent(t.percent),
        },
        services: exercises.length
          ? exercises.map((ex) => {
            const r = src.resultOf(ex.id, s.id);
            return {
              exercise: ex.name,
              type: ex.type,
              subcategory: ex.subcategory,
              location: ex.location || "—",
              status: STATUS_LABEL[r.status],
              marks: formatMarks(r.scored, r.total, answered(r)),
              percent: formatPercent(r.percent),
              scale: r.scale || "—",
            };
          })
          : [{ exercise: "No exercises match the filters" }],
      };
    });
  }

  // student-questions: one block per student per exercise.
  const blocks: ReportClientBlock[] = [];
  for (const s of students) {
    const cells = studentCells(s);
    for (const ex of exercises) {
      const r = src.resultOf(ex.id, s.id);
      const questions = src.questionsOf(ex, s);
      blocks.push({
        client: cells.client,
        business: cells.business,
        clientExtras: {
          ...cells.extras,
          exercise: ex.name,
          type: ex.type,
          exMarks: formatMarks(r.scored, r.total, answered(r)),
          exPercent: formatPercent(r.percent),
        },
        services: questions.length ? questions.map(questionService) : [NO_QUESTIONS],
      });
    }
  }
  return blocks;
}
