import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { bandOf } from "./gradeHelpers";
import { DifficultyChip, StatusChip } from "./GradeBadges";

// Rich table cells per tab (exercises / students / questions). Each renders the
// <td> set for one row; the parent <tr> owns the key, click + selection.

// Exercise row cells. Five columns, restyled to match Course Setup's
// MappingTable body cells (`h-11 text-[12px] text-body`, no `font-medium`)
// so the two admin lists share one row rhythm:
//   1. `#N`             — right-aligned tabular-nums serial number
//   2. Activity name    — Assignment / Assessment / Exercise per the filter
//   3. Questions count
//   4. Marks (renamed from Total Marks — see header spec)
//   5. Actions          — View Details button (drills into Students; the
//                          whole row is still clickable, but this makes the
//                          affordance discoverable without hovering)
const BODY = "h-11 px-3 align-middle text-[12px] text-body";
export function ExerciseCells({ item, index }: { item: any; index: number }) {
  return (
    <>
      {/* `#` — its own narrow, right-aligned cell so long exercise names in
          the next column can truncate without eating the number. */}
      <td className={`${BODY} text-right tabular-nums text-faint w-10`}>{index + 1}</td>
      <td className={BODY}>
        <span className="truncate block">{item.exerciseName}</span>
      </td>
      {/* Right-aligned to match the "Total Questions" / "Total Marks"
          headers above them — number columns read as one visual block
          against the right edge of the cell. */}
      <td className={`${BODY} text-right tabular-nums`}>{item.totalQuestions || 0}</td>
      <td className={`${BODY} text-right tabular-nums`}>{item.totalPoints || 0}</td>
      <td className={`${BODY} pl-2 pr-4 sm:pr-5 text-right`}>
        {/* View — info-tone pill. "View" is a read-only action, so blue
            (the design system's info palette) reads more appropriately
            than the brand orange, which the app reserves for primary /
            write actions (Save, Publish, Add). Row is still clickable;
            this button forwards the click to the parent <tr>. */}
        <button
          type="button"
          onClick={(e) => e.currentTarget.closest<HTMLElement>('tr')?.click()}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-info-500/25 bg-info-50 text-info-700 text-2xs font-semibold hover:bg-info-50/70 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500/30"
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      </td>
    </>
  );
}

// Student row cells. Recomposed to nine columns the trainer actually needs
// (per feedback on the Students tab):
//   1. `#`               — serial
//   2. Student Name       — plain text, no avatar (icon removed)
//   3. Email              — own column, truncated with a hover tooltip
//   4. Total Questions    — the exercise's question count
//   5. Attended           — how many the student has actually attempted
//   6. Mark Scored        — X/Y
//   7. Grade              — Poor / Average / Good / Excellent (from bandOf)
//   8. Status             — Completed / In Progress / Not Started, DERIVED
//                            from attempted vs total so a stuck server
//                            status ("in_progress" after the student is done)
//                            flips to Completed
//   9. Actions            — View Details
export function StudentCells({ item, index, selectedExercise, onDetails }: { item: any; index: number; selectedExercise: any; onDetails: () => void }) {
  const p = item.exerciseProgress || {};

  // Marks = the exercise TOTAL, summed from the per-question attempts the
  // payload already carries. Deliberately NOT read straight off
  // `overallScore`: per-question scores are stored as STRINGS, so the
  // server-side reduce that builds `overallScore` used to concatenate them
  // ("00555005550" where the sum is 30). That is fixed server-side, but
  // summing here means the column is correct even against an older server or
  // a response cached before the fix — and `Number()` on an already-glued
  // string cannot recover it, so a cast alone would not be enough.
  const attempts: any[] = Array.isArray(p.questionAttempts) ? p.questionAttempts : [];
  const total = attempts.length
    ? attempts.reduce((sum, q) => sum + (Number(q?.score) || 0), 0)
    : Number(p.overallScore) || 0;
  // Denominator comes from `totalMaxScore`, which the server computes from the
  // exercise definition. NOT summed from the attempts: their `totalScore` is
  // null on stored records, so a sum would be 0 — and worse, a partially
  // populated set would produce a truthy but wrong max.
  const max = Number(p.totalMaxScore) || Number(selectedExercise?.totalPoints) || 0;
  const scorePct = max > 0 ? (total / max) * 100 : 0;
  const band = bandOf(scorePct);
  const noAttempt = max === 0 || total === 0;

  // Total / attended question counts. `questionsTotal` / `questionsAttempted`
  // are what this endpoint actually returns — the older probe list here
  // (attemptedQuestions / attendedQuestions / completedCount / …) matched
  // none of them, so Attended rendered 0 for every student even when all ten
  // questions had been answered. The legacy names are kept as fallbacks for
  // any other caller still shaped that way, and the per-question array is the
  // last resort since it is present whenever progress is included.
  const totalQuestions =
    Number(
      p.questionsTotal
      ?? p.totalQuestions
      ?? selectedExercise?.totalQuestions
      ?? selectedExercise?.questions?.length
      ?? attempts.length
      ?? 0,
    ) || 0;
  const attendedQuestions =
    Number(
      p.questionsAttempted
      ?? p.attemptedQuestions
      ?? p.attendedQuestions
      ?? p.completedCount
      ?? p.completedQuestions
      ?? p.answeredQuestions
      ?? (attempts.length ? attempts.filter(q => q?.status || q?.submittedAt || Number(q?.attempts) > 0).length : undefined)
      ?? (Number(p.completionPercentage) > 0 && totalQuestions > 0
            ? Math.round((Number(p.completionPercentage) / 100) * totalQuestions)
            : 0),
    ) || 0;

  // Grade — map bandOf's four labels to the shorter set the trainer asked
  // for (Excellent / Good / Average / Poor), and paint via the band's own
  // chip tokens so the visual meaning stays consistent with the score bar.
  const gradeLabel: "Excellent" | "Good" | "Average" | "Poor" =
    band.label === "Needs work" ? "Poor"
      : band.label === "Excellent" ? "Excellent"
        : band.label === "Good" ? "Good"
          : "Average";

  // Status — two states only. "In Progress" is gone: the trainer's view
  // never needs to distinguish "currently taking the test" from "already
  // submitted", and rows showing "In Progress" after the student had
  // clearly finished (marks + grade visible) read as broken. Now: any
  // sign of an attempt → Completed. No sign → Not Started.
  //   • Completed   — server flagged the attempt as
  //                   completed/evaluated/submitted, OR the student
  //                   scored any marks, OR they attempted any question.
  //   • Not Started — no server flag, no marks, no attempt on record.
  const submittedByServer = (() => {
    const s = String(p.status || "").toLowerCase();
    return s === "completed" || s === "evaluated" || s === "submitted"
      || s === "in_progress" /* server-side "in progress" still counts as done for the trainer's read */;
  })();
  const derivedStatus: "completed" | "not_started" =
    submittedByServer
      || total > 0
      || attendedQuestions > 0
      ? "completed"
      : "not_started";

  return (
    <>
      <td className={`${BODY} text-right tabular-nums text-faint w-10`}>{index + 1}</td>
      {/* Student Name — plain text (avatar removed per the design ask), one
          line, truncated with the full name in the tooltip. */}
      <td className={BODY}>
        <span className="truncate block text-heading" title={item.name || undefined}>{item.name || "—"}</span>
      </td>
      {/* Email — own column, truncated with the full address in the
          tooltip so the trainer can hover to read a long one. */}
      <td className={BODY}>
        <span className="truncate block text-subtle" title={item.email || undefined}>{item.email || "—"}</span>
      </td>
      {/* Attended — attempted/total in one cell (0/10, 5/10, 10/10), matching
          the scored/max shape of Marks beside it. */}
      <td className={`${BODY} text-right tabular-nums`}>
        {attendedQuestions}<span className="text-faint">/{totalQuestions}</span>
      </td>
      <td className={`${BODY} text-right tabular-nums`}>
        {noAttempt
          ? "—"
          : <>{total}<span className="text-faint">/{max}</span></>}
      </td>
      <td className={BODY}>
        {noAttempt
          ? <span className="text-faint">—</span>
          : <span className={`inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold ring-1 ring-inset ${band.chip}`}>{gradeLabel}</span>}
      </td>
      <td className={BODY}>
        {derivedStatus === "completed"
          ? <StatusChip tone="success" icon={<CheckCircle2 className="h-3 w-3" />} label="Completed" />
          : <StatusChip tone="neutral" icon={<XCircle className="h-3 w-3" />} label="Not Started" />}
      </td>
      <td className={`${BODY} pl-2 pr-4 sm:pr-5 text-right`}>
        {/* View — drills DIRECTLY into that student's Questions tab. Was
            wired to `onDetails` (the right-side StudentDetailsDrawer),
            but the trainer wants the full question view, not the
            drawer. Forwards the click to the parent <tr>, which the
            page's onClick handler catches and calls
            handleSelectStudent(item) → activeTab = "questions". Same
            pattern the exercises action uses. */}
        <button
          type="button"
          onClick={(e) => e.currentTarget.closest<HTMLElement>('tr')?.click()}
          title="View questions"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-info-500/25 bg-info-50 text-info-700 text-2xs font-semibold hover:bg-info-50/70 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500/30"
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      </td>
    </>
  );
}

// Question row cells. Six columns, styled with the same BODY constant as
// exercise/student rows so the whole drill reads as one table:
//   1. `#`             — right-aligned tabular-nums serial number
//   2. Question title  — plain text; no icon tile (removed for consistency
//                        with the other tabs)
//   3. Difficulty      — DifficultyChip (easy/medium/hard)
//   4. Mark Scored     — X/Y right-aligned (renamed from "Score")
//   5. Attempts        — right-aligned count
//   6. Status          — Submitted (attempted) / Not attempted. Replaces the
//                        earlier duplicate pair "Answer" + "Status" that
//                        conveyed the same signal twice.
export function QuestionCells({ item, index }: { item: any; index: number }) {
  const attempted = !!item.studentAttempt;
  return (
    <>
      <td className={`${BODY} text-right tabular-nums text-faint w-10`}>{index + 1}</td>
      <td className={BODY}>
        <span className="truncate block text-heading" title={item.title || undefined}>{item.title}</span>
      </td>
      <td className={BODY}><DifficultyChip difficulty={item.difficulty || "medium"} /></td>
      <td className={`${BODY} text-right tabular-nums`}>
        <span className="font-semibold text-heading">{item.studentAttempt?.score || 0}</span>
        <span className="text-faint">/{item.score || 0}</span>
      </td>
      <td className={`${BODY} text-right tabular-nums`}>{item.studentAttempt?.attempts || 0}</td>
      <td className={BODY}>
        {attempted
          ? <span className="inline-flex items-center gap-1 h-6 rounded-full px-2 text-2xs font-semibold ring-1 ring-inset bg-success-50 text-success-700 ring-success-500/20"><CheckCircle2 className="h-3 w-3" /> Submitted</span>
          : <span className="inline-flex items-center gap-1 h-6 rounded-full px-2 text-2xs font-semibold ring-1 ring-inset bg-ink-100 text-ink-600 ring-ink-500/15"><XCircle className="h-3 w-3" /> Not attempted</span>}
      </td>
    </>
  );
}
