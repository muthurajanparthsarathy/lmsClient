"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X, Check, CircleDot, HelpCircle, XCircle, Minus,
  ChevronDown, Trophy, FileText, Code2, ExternalLink,
} from "lucide-react";

import type { StudentProgress } from "../types/liveDashboard.types";
import type { AssessmentChip } from "../utils/assessmentHeader";
import { formatDateTime } from "../utils/assessmentHeader";
import {
  findExerciseInCourseData,
  getQuestionMaxScore,
} from "../utils/computeStudentMarks";

// ── Programming-assessment learner detail modal ─────────────────────────────
//
// Opens from StudentsResultTable's ⋮ → Detailed View. It is deliberately NOT
// the full IDE-grade review page — this is a QUICK complete report so the
// trainer can eyeball the submission state, per-question marks, and test-case
// aggregates for one learner without leaving the Live Dashboard.
//
// Every number the trainer sees here comes from the same course-data payload
// the review console uses; nothing is fabricated on the client. The
// per-question status logic follows the existing rules used by
// `getStudentQuestionsBreakdown` + `resolveEvaluationMethod`:
//
//   • no submission row for the question   → "Not Submitted"      (grey)
//   • sub.status === "evaluated"           → grader saved a score → colour by mark
//   • else, evaluationMethod === "manual"  → "Needs Review"        (amber)
//   • else, has evaluationBreakdown.testcase / .ai → colour by test-case ratio
//   • else                                  → "Needs Review"        (amber)
//
// The five UI states — Evaluated (Full) / Partial / Needs Review / Failed /
// Not Submitted — match the wording faculty already sees on the metric strip
// and the row status pill.

// ── Loose shapes ────────────────────────────────────────────────────────────
// The course-data payload isn't typed at the source; the review page reads it
// as `any` for the same reason. Keeping to `any` here avoids a large ripple.
type Loose = Record<string, any>;

type CardState = "evaluated_full" | "partial" | "failed" | "needs_review" | "not_submitted";

interface QuestionCard {
  index: number;
  questionId: string;
  title: string;
  totalMark: number;
  scoredMark: number | null;
  scoreLabel: string;
  cardState: CardState;
  statusLabel: string;
  language: string;
  submittedAt: string | null;
  hasTestCases: boolean;
  testCasesPassed: number | null;
  testCasesTotal: number | null;
  testCasesFailed: number | null;
  cases: Array<{ index: number; passed: boolean; input: string; expectedOutput: string; hidden: boolean }>;
  evaluationLabel: string | null;
  code: string | null;
  description: string;
  isSubmitted: boolean;
}

// ── Question-title extractor (matches StudentDetailsPage / review page) ─────
const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ");
  if (typeof v === "object") return asText((v as any).value ?? (v as any).text ?? "");
  return String(v);
};

const idOf = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.$oid === "string") return v.$oid;
    if (v._id != null) return idOf(v._id);
    return v.toString ? v.toString() : String(v);
  }
  return String(v);
};

// Same rank order used in computeStudentMarks so this modal picks the same
// "authoritative" submission row per question when a student has multiple.
const submissionRank = (s: Loose): number =>
  s?.status === "evaluated" ? 4 :
    s?.status === "solved" ? 3 :
      s?.status === "submitted" ? 2 :
        s?.status === "attempted" ? 1 : 0;

// Walk the course structure the same way computeStudentMarks does to find the
// participant's answers list for this exercise. We inline this here (rather
// than importing) so the modal keeps working if the shared helper's shape
// changes — the fields we read are stable.
function getAnswersForParticipant(participant: Loose, courseId: string, exerciseIdKey: string): Loose[] {
  const courses = Array.isArray(participant?.user?.courses) ? participant.user.courses : [];
  const course = courses.find((c: Loose) => idOf(c?.courseId) === idOf(courseId)) || courses[0];
  if (!course?.answers) return [];
  const out: Loose[] = [];
  // `answers` is a Map-like { We_Do: {..}, You_Do: {..} } with per-exercise keys.
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

function participantFor(courseData: Loose | null | undefined, studentId: string): Loose | null {
  if (!courseData) return null;
  const flat: Loose[] = (courseData.batchAndParticipants || []).flatMap((b: Loose) => b?.users || []);
  return flat.find((p: Loose) => idOf(p?.user?._id) === studentId || idOf(p?._id) === studentId) || null;
}

// ── State + label decision ─────────────────────────────────────────────────
function deriveCardState(args: {
  sub: Loose | undefined;
  exercise: Loose;
  question: Loose;
  totalMark: number;
}): { cardState: CardState; statusLabel: string; scoredMark: number | null; scoreLabel: string; evaluationLabel: string | null; hasTestCases: boolean; passed: number | null; total: number | null; failed: number | null } {
  const { sub, exercise, totalMark } = args;
  const evalMethod: string = (exercise?.evaluationMethod?.method || "").toString().toLowerCase();

  // Case D — no submission row at all for this question.
  if (!sub) {
    return {
      cardState: "not_submitted",
      statusLabel: "Not Submitted",
      scoredMark: null,
      scoreLabel: `— / ${totalMark}`,
      evaluationLabel: null,
      hasTestCases: false,
      passed: null,
      total: null,
      failed: null,
    };
  }

  const breakdown: Loose | null = sub.evaluationBreakdown || null;
  const bMethod: string = String(breakdown?.method || "").toLowerCase();

  // Prefer the breakdown's own method (that's what the student's submit
  // actually ran) — otherwise fall back to the exercise-level setting.
  const effectiveMethod: string = bMethod || evalMethod || "";

  const tcPassed = Number(breakdown?.testcase?.passed);
  const tcTotal = Number(breakdown?.testcase?.total);
  const aiPassed = Number(breakdown?.ai?.passedTestCases);
  const aiTotal = Number(breakdown?.ai?.totalTestCases);
  const hasTcBreakdown = effectiveMethod === "testcase" && Number.isFinite(tcTotal) && tcTotal > 0;
  const hasAiBreakdown = effectiveMethod === "ai" && Number.isFinite(aiTotal) && aiTotal > 0;
  const hasTestCases = hasTcBreakdown || hasAiBreakdown;
  const passed = hasTcBreakdown ? tcPassed : hasAiBreakdown ? aiPassed : null;
  const total = hasTcBreakdown ? tcTotal : hasAiBreakdown ? aiTotal : null;
  const failed = total != null && passed != null ? Math.max(0, total - passed) : null;

  const scoredMarkRaw = Math.min(Math.max(Number(sub.score) || 0, 0), totalMark);

  // Case E — grader manually saved an override. This is the authoritative
  // final mark; NEVER overwrite it with the auto-computed number.
  if (sub.status === "evaluated") {
    let state: CardState = "partial";
    if (scoredMarkRaw >= totalMark && totalMark > 0) state = "evaluated_full";
    else if (scoredMarkRaw <= 0) state = "failed";
    return {
      cardState: state,
      statusLabel: state === "evaluated_full" ? "Evaluated" : state === "failed" ? "Failed" : "Partial",
      scoredMark: scoredMarkRaw,
      scoreLabel: `${roundMark(scoredMarkRaw)} / ${totalMark}`,
      evaluationLabel: "Manually Evaluated",
      hasTestCases,
      passed,
      total,
      failed,
    };
  }

  // Case C — Manual-evaluation exercise, no override yet → Needs Review.
  // The student HAS submitted, so the marks number reads "Pending / N".
  if (effectiveMethod === "manual") {
    return {
      cardState: "needs_review",
      statusLabel: "Needs Review",
      scoredMark: null,
      scoreLabel: `Pending / ${totalMark}`,
      evaluationLabel: "Manual Review Required",
      hasTestCases: false,
      passed: null,
      total: null,
      failed: null,
    };
  }

  // Case A / B — auto scored (testcase or AI). Card state follows the pass
  // ratio, not the raw score number, so a 4/10 partial still lights blue.
  if (hasTestCases && total! > 0) {
    let state: CardState = "partial";
    if (passed! >= total!) state = "evaluated_full";
    else if (passed! === 0) state = "failed";
    return {
      cardState: state,
      statusLabel: state === "evaluated_full" ? "Evaluated" : state === "failed" ? "Failed" : "Partial",
      scoredMark: scoredMarkRaw,
      scoreLabel: `${roundMark(scoredMarkRaw)} / ${totalMark}`,
      evaluationLabel: effectiveMethod === "ai" ? "Auto Evaluated (AI)" : "Auto Evaluated",
      hasTestCases: true,
      passed,
      total,
      failed,
    };
  }

  // Submitted but no breakdown yet (queued judge, missing breakdown on legacy
  // submissions, etc.) → still Needs Review so faculty can eyeball it.
  return {
    cardState: "needs_review",
    statusLabel: "Needs Review",
    scoredMark: null,
    scoreLabel: totalMark > 0 ? `Pending / ${totalMark}` : "Pending",
    evaluationLabel: "Needs Review",
    hasTestCases: false,
    passed: null,
    total: null,
    failed: null,
  };
}

function roundMark(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 10) / 10);
}

// ── Palette per card state ─────────────────────────────────────────────────
const STATE_STYLE: Record<CardState, {
  chipBg: string; chipText: string; chipDot: string;
  gridBg: string; gridText: string; iconBg: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  legendLabel: string;
}> = {
  evaluated_full: {
    chipBg: "bg-emerald-50", chipText: "text-emerald-700", chipDot: "bg-emerald-500",
    gridBg: "bg-emerald-500", gridText: "text-white", iconBg: "bg-emerald-600",
    Icon: Check, legendLabel: "Evaluated (Full)",
  },
  partial: {
    chipBg: "bg-sky-50", chipText: "text-sky-700", chipDot: "bg-sky-500",
    gridBg: "bg-sky-500", gridText: "text-white", iconBg: "bg-sky-600",
    Icon: CircleDot, legendLabel: "Partial",
  },
  needs_review: {
    chipBg: "bg-amber-50", chipText: "text-amber-700", chipDot: "bg-amber-500",
    gridBg: "bg-amber-500", gridText: "text-white", iconBg: "bg-amber-600",
    Icon: HelpCircle, legendLabel: "Needs Review",
  },
  failed: {
    chipBg: "bg-rose-50", chipText: "text-rose-700", chipDot: "bg-rose-500",
    gridBg: "bg-rose-500", gridText: "text-white", iconBg: "bg-rose-600",
    Icon: XCircle, legendLabel: "Failed",
  },
  not_submitted: {
    chipBg: "bg-gray-100", chipText: "text-gray-600", chipDot: "bg-gray-400",
    gridBg: "bg-gray-300", gridText: "text-gray-700", iconBg: "bg-gray-400",
    Icon: Minus, legendLabel: "Not Submitted",
  },
};

// ── Props ──────────────────────────────────────────────────────────────────
export interface LearnerDetailModalProps {
  open: boolean;
  student: StudentProgress | null;
  courseData: Loose | null;
  courseId: string;
  exerciseId: string;
  assessmentName: string;
  chips: AssessmentChip[];
  startDate: string | null;
  onClose: () => void;
  /** Same handler the table's Review button uses — opens the trainer's
   *  grading console in a new tab for a specific student. Optionally targets
   *  a specific question if the parent supports it; this modal always passes
   *  the questionId when calling for a per-question Review. */
  onOpenReview?: (studentId: string, questionId?: string) => void;
}

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

// ── Component ──────────────────────────────────────────────────────────────
export default function LearnerDetailModal({
  open, student, courseData, courseId, exerciseId, assessmentName, chips,
  startDate, onClose, onOpenReview,
}: LearnerDetailModalProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Focused-question ring for the click-to-scroll interaction on the grid.
  // focusedId + scrollToQuestion were used by the (now-removed) question-
  // index tile grid; the modal doesn't need the highlight ring anymore.

  useEffect(() => {
    if (!open) return;
    // Reset per-open so a fresh modal doesn't carry the previous learner's
    // expand state.
    setExpandedIds(new Set());
  }, [open, student?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // Lock the page scroll while the overlay is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const cards: QuestionCard[] = useMemo(() => {
    if (!student || !courseData || !exerciseId) return [];
    const exercise = findExerciseInCourseData(courseData as Loose, exerciseId);
    if (!exercise || !Array.isArray(exercise.questions)) return [];

    const participant = participantFor(courseData, student.id);
    if (!participant) {
      // Still render one card per question, all labelled Not Submitted, so the
      // trainer can see the question layout even for learners with no data.
      return exercise.questions.map((q: Loose, i: number) => {
        const totalMark = getQuestionMaxScore(exercise, q);
        const title = asText(q?.title ?? q?.programmingQuestionTitle ?? q?.mcqQuestionTitle) || `Question ${i + 1}`;
        return {
          index: i + 1,
          questionId: idOf(q?._id) || String(i),
          title,
          totalMark,
          scoredMark: null,
          scoreLabel: `— / ${totalMark}`,
          cardState: "not_submitted",
          statusLabel: "Not Submitted",
          language: "",
          submittedAt: null,
          hasTestCases: false,
          testCasesPassed: null,
          testCasesTotal: null,
          testCasesFailed: null,
          cases: [],
          evaluationLabel: null,
          code: null,
          description: asText(q?.description) || "",
          isSubmitted: false,
        };
      });
    }

    const answers = getAnswersForParticipant(participant, courseId, idOf(exerciseId));

    // De-dupe with the same rank rule computeStudentMarks uses.
    const subByQ = new Map<string, Loose>();
    for (const ans of answers) {
      for (const sub of ans?.questions || []) {
        const qid = idOf(sub?.questionId);
        if (!qid) continue;
        const existing = subByQ.get(qid);
        if (!existing) subByQ.set(qid, sub);
        else if (submissionRank(sub) > submissionRank(existing)) subByQ.set(qid, sub);
      }
    }

    return exercise.questions.map((q: Loose, i: number): QuestionCard => {
      const qid = idOf(q?._id) || String(i);
      const sub = subByQ.get(qid);
      const totalMark = getQuestionMaxScore(exercise, q);
      const state = deriveCardState({ sub, exercise, question: q, totalMark });
      const title = asText(q?.title ?? q?.programmingQuestionTitle ?? q?.mcqQuestionTitle) || `Question ${i + 1}`;
      const language = String(sub?.language || q?.programmingLanguage || "").trim();
      const cases: QuestionCard["cases"] = [];
      if (sub?.evaluationBreakdown?.testcase?.cases) {
        for (const c of sub.evaluationBreakdown.testcase.cases) {
          cases.push({
            index: Number(c?.index) || 0,
            passed: !!c?.passed,
            input: typeof c?.input === "string" ? c.input : "",
            expectedOutput: typeof c?.expectedOutput === "string" ? c.expectedOutput : "",
            hidden: !!c?.hidden,
          });
        }
      } else if (sub?.evaluationBreakdown?.ai?.testCases) {
        for (const c of sub.evaluationBreakdown.ai.testCases) {
          cases.push({
            index: Number(c?.index) || 0,
            passed: !!c?.passed,
            input: typeof c?.input === "string" ? c.input : "",
            expectedOutput: typeof c?.expectedOutput === "string" ? c.expectedOutput : "",
            hidden: !!c?.hidden,
          });
        }
      }

      return {
        index: i + 1,
        questionId: qid,
        title,
        totalMark,
        scoredMark: state.scoredMark,
        scoreLabel: state.scoreLabel,
        cardState: state.cardState,
        statusLabel: state.statusLabel,
        language,
        submittedAt: sub?.submittedAt || null,
        hasTestCases: state.hasTestCases,
        testCasesPassed: state.passed,
        testCasesTotal: state.total,
        testCasesFailed: state.failed,
        cases,
        evaluationLabel: state.evaluationLabel,
        code: typeof sub?.codeAnswer === "string" && sub.codeAnswer.trim().length > 0 ? sub.codeAnswer : null,
        description: asText(q?.description) || "",
        isSubmitted: !!sub,
      };
    });
  }, [student, courseData, exerciseId, courseId]);

  // Aggregate metrics — all from real submission data. Test-case aggregate is
  // hidden entirely when no question in the assessment carries test cases.
  const totals = useMemo(() => {
    let submittedCount = 0;
    let evaluatedCount = 0;
    let tcPassed = 0;
    let tcTotal = 0;
    let hasAnyTestCases = false;
    let scoredSum = 0;
    let totalSum = 0;
    const stateCounts: Record<CardState, number> = {
      evaluated_full: 0, partial: 0, needs_review: 0, failed: 0, not_submitted: 0,
    };
    for (const c of cards) {
      stateCounts[c.cardState] += 1;
      totalSum += c.totalMark || 0;
      if (c.isSubmitted) submittedCount += 1;
      if (c.cardState !== "not_submitted" && c.cardState !== "needs_review") evaluatedCount += 1;
      if (c.hasTestCases && c.testCasesTotal != null && c.testCasesPassed != null) {
        tcPassed += c.testCasesPassed;
        tcTotal += c.testCasesTotal;
        hasAnyTestCases = true;
      }
      if (c.scoredMark != null) scoredSum += c.scoredMark;
    }
    return {
      submittedCount, evaluatedCount, tcPassed, tcTotal, hasAnyTestCases,
      scoredSum, totalSum, stateCounts,
    };
  }, [cards]);

  if (!open || !student) return null;

  const toggleExpand = (qid: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${student.studentName} — assessment detail`}
    >
      <div
        className="relative w-full flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        // Widened + taller — trainers wanted more horizontal room for the
        // per-question card metadata row and more vertical room for the
        // stacked cards without paginating. Still capped so it never fills
        // the full viewport (edge padding shows the underlying dashboard,
        // which is what makes the overlay read as an overlay).
        style={{ maxWidth: 1600, maxHeight: "96vh", width: "97vw" }}
      >
        {/* ── Sticky header — compact. Programming / chip pills, the
            overall status badge and the question-index grid have all been
            dropped; the header now reads as identity + assessment title +
            metric strip only. */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[12px] font-semibold"
                aria-hidden="true"
              >
                {initialsOf(student.studentName)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                  {student.studentName || "Learner"}
                </div>
                <div className="text-[11px] text-gray-500 truncate leading-tight">
                  {student.studentDisplayId
                    ? `${student.studentDisplayId}${student.email ? " · " : ""}`
                    : ""}
                  {student.email || (student.studentDisplayId ? "" : "—")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 flex-shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight truncate">
              {assessmentName}
            </h2>
            <div className="text-[10.5px] text-gray-500 whitespace-nowrap">
              {/* Only surface "Completed on" when the student explicitly
                  finished (attemptStatus === "submitted"). Every other
                  state — including in-progress / walked-away — reads as
                  Started on to avoid claiming a completion the code
                  editor's Finish button never triggered. */}
              {student.attemptStatus === "submitted"
                ? `Completed on ${formatDateTime(startDate)}`
                : `Started on ${formatDateTime(startDate)}`}
            </div>
          </div>

          {/* Overall metric strip — Total Marks · Submitted · Test Cases · Evaluated */}
          <div className="mt-2.5 grid gap-3 grid-cols-4">
            <MetricCell
              label="Total Marks"
              value={`${roundMark(totals.scoredSum)} / ${totals.totalSum}`}
              accent="text-amber-600"
              Icon={Trophy}
            />
            <MetricCell
              label="Submitted"
              value={`${totals.submittedCount} / ${cards.length} ${cards.length === 1 ? "Question" : "Questions"}`}
              accent="text-indigo-600"
              Icon={FileText}
            />
            <MetricCell
              label="Test Cases"
              value={totals.hasAnyTestCases ? `${totals.tcPassed} / ${totals.tcTotal}` : "—"}
              accent="text-sky-600"
              Icon={Code2}
            />
            <MetricCell
              label="Evaluated"
              value={`${totals.evaluatedCount} / ${cards.length}`}
              accent="text-emerald-600"
              Icon={Check}
            />
          </div>
        </div>

        {/* ── Scrolling body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Question cards — the numbered-tile grid and the legend counts
              have been removed per trainer feedback; every question card
              already surfaces its own status pill. */}
          <div className="flex flex-col gap-2">
            {cards.map((c) => (
              <QuestionCardRow
                key={c.questionId}
                card={c}
                expanded={expandedIds.has(c.questionId)}
                onToggle={() => toggleExpand(c.questionId)}
                onOpenReview={onOpenReview ? () => onOpenReview(student.id, c.questionId) : undefined}
                studentName={student.studentName}
              />
            ))}
            {cards.length === 0 && (
              <div className="p-8 text-center text-[13px] text-gray-400">
                No questions found for this assessment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function MetricCell({
  label, value, accent, Icon,
}: {
  label: string;
  value: string;
  accent: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-50 ${accent}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="text-[15px] font-bold text-gray-900 tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function QuestionCardRow({
  card, expanded, onToggle, onOpenReview, studentName,
}: {
  card: QuestionCard;
  expanded: boolean;
  onToggle: () => void;
  onOpenReview?: () => void;
  studentName: string;
}) {
  const style = STATE_STYLE[card.cardState];
  return (
    <div
      id={`ldm-q-${card.questionId}`}
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${style.gridBg} ${style.gridText}`}>
          {card.index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-gray-900 truncate">
              {card.title}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chipBg} ${style.chipText}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.chipDot}`} />
              {card.statusLabel}
            </span>
          </div>
        </div>
        <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            Programming
          </span>
          {card.language && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {card.language}
            </span>
          )}
          {/* Evaluation type chip — Auto Evaluated / Manually Evaluated /
              Manual Review Required — moved out of the expanded pane so
              trainers can tell at a glance whether they still need to look
              at this row. */}
          {card.evaluationLabel && (
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${style.chipBg} ${style.chipText}`}>
              {card.evaluationLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-800 tabular-nums">
            <Trophy size={12} className="text-amber-500" />
            {card.scoreLabel} Marks
          </span>
          {card.hasTestCases ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-800 tabular-nums">
              <Code2 size={12} className={style.chipText.replace("text-", "text-")} />
              {card.testCasesPassed} / {card.testCasesTotal} Passed
            </span>
          ) : card.isSubmitted ? (
            <span className="text-[12px] text-gray-400">No test cases</span>
          ) : null}
          {/* Submission time also surfaces on the collapsed row so a trainer
              working a queue of learners can spot late submissions without
              opening each card. Uses the same formatter the expanded pane
              already uses so the string never disagrees between the two. */}
          {card.submittedAt && (
            <span className="text-[11.5px] font-medium text-gray-500 tabular-nums whitespace-nowrap">
              {formatDateTime(card.submittedAt)}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`ml-1 flex-shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
          {card.isSubmitted ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Question Description
                  </div>
                  <div className="mt-1 text-[12.5px] text-gray-700 leading-relaxed line-clamp-4">
                    {card.description || "No description provided for this question."}
                  </div>
                </div>
                <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-gray-500">Submission Status</dt>
                  <dd>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chipBg} ${style.chipText}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.chipDot}`} />
                      {card.statusLabel}
                    </span>
                  </dd>
                  {card.language && (
                    <>
                      <dt className="text-gray-500">Language</dt>
                      <dd className="text-gray-800 font-medium">{card.language}</dd>
                    </>
                  )}
                  {card.submittedAt && (
                    <>
                      <dt className="text-gray-500">Submitted At</dt>
                      <dd className="text-gray-800 font-medium">{formatDateTime(card.submittedAt)}</dd>
                    </>
                  )}
                  {card.evaluationLabel && (
                    <>
                      <dt className="text-gray-500">Evaluation</dt>
                      <dd className="text-gray-800 font-medium">{card.evaluationLabel}</dd>
                    </>
                  )}
                  <dt className="text-gray-500">Marks</dt>
                  <dd className="text-gray-800 font-semibold tabular-nums">{card.scoreLabel}</dd>
                  {card.hasTestCases ? (
                    <>
                      <dt className="text-gray-500">Test Cases</dt>
                      <dd className="text-gray-800 font-semibold tabular-nums">
                        {card.testCasesPassed} / {card.testCasesTotal} Passed
                        {card.testCasesFailed! > 0 ? ` (${card.testCasesFailed} Failed)` : ""}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-gray-500">Test Cases</dt>
                      <dd className="text-gray-500 italic">No test cases configured</dd>
                    </>
                  )}
                </dl>
              </div>

              {card.cases.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Test Case Results ({card.cases.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {card.cases.map((tc, i) => (
                      <TestCasePill key={i} tc={tc} />
                    ))}
                  </div>
                </div>
              )}

              {card.code && (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Submitted Code
                  </div>
                  <pre className="max-h-52 overflow-auto rounded-lg bg-slate-900 p-3 text-[11.5px] leading-relaxed text-slate-100"
                    style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}
                  >
                    <code>{card.code}</code>
                  </pre>
                </div>
              )}

              {onOpenReview && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={onOpenReview}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 transition-colors"
                    title={`Open the full review for ${studentName}`}
                  >
                    Review Submission
                    <ExternalLink size={12} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 text-[12.5px] text-gray-500">
              <Minus size={14} className="text-gray-400" />
              No submission received for this question.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Test-case pill with a hover popover. Shows the case number and pass/fail
// pill at rest; on hover a small card floats above with Input / Expected
// Output / Status. Hidden test cases mask the input/output but still show
// the pass/fail — the case content is intentionally not exposed.
function TestCasePill({ tc }: {
  tc: { index: number; passed: boolean; input: string; expectedOutput: string; hidden: boolean };
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium cursor-help ${tc.passed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
      >
        TC {tc.index + 1}
        {tc.passed ? <Check size={11} /> : <XCircle size={11} />}
      </span>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 bottom-full z-40 mb-1.5 w-[260px] -translate-x-1/2 overflow-hidden rounded-md border border-slate-200 bg-white p-2.5 shadow-lg"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-semibold text-slate-800">Test Case {tc.index + 1}</div>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tc.passed
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
              }`}>
              {tc.passed ? "Passed" : "Failed"}
            </span>
          </div>
          {tc.hidden ? (
            <div className="text-[10.5px] italic text-slate-500">
              Hidden test case — input / expected output masked.
            </div>
          ) : (
            <div className="space-y-1.5">
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">Input</div>
                <pre className="mt-0.5 whitespace-pre-wrap break-words rounded bg-slate-50 px-2 py-1 text-[10.5px] text-slate-800 font-mono max-h-24 overflow-auto">
                  {tc.input || "—"}
                </pre>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">Expected Output</div>
                <pre className="mt-0.5 whitespace-pre-wrap break-words rounded bg-slate-50 px-2 py-1 text-[10.5px] text-slate-800 font-mono max-h-24 overflow-auto">
                  {tc.expectedOutput || "—"}
                </pre>
              </div>
            </div>
          )}
          <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-px h-2 w-2 rotate-45 bg-white border-b border-r border-slate-200" />
        </div>
      )}
    </span>
  );
}
