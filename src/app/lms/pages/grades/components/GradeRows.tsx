import { AlertCircle, CheckCircle2, ChevronRight, Dumbbell, Eye, HelpCircle, XCircle } from "lucide-react";
import { avatarTone, bandOf, initials, sectionLabel } from "./gradeHelpers";
import { DifficultyChip, QuestionStatusChip, StatusChip, StudentStatusChip } from "./GradeBadges";

// Rich table cells per tab (exercises / students / questions). Each renders the
// <td> set for one row; the parent <tr> owns the key, click + selection.

export function ExerciseCells({ item, index }: { item: any; index: number }) {
  return (
    <>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xs tabular-nums text-faint w-5 text-right shrink-0">{index + 1}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-tile bg-brand-wash text-brand-strong shrink-0"><Dumbbell className="h-4 w-4" /></span>
          <span className="font-medium text-heading truncate">{item.exerciseName}</span>
        </div>
      </td>
      <td className="px-3 py-3"><span className="inline-flex items-center rounded-chip bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-700 capitalize">{sectionLabel(item.section)}</span></td>
      <td className="px-3 py-3 font-medium text-body tabular-nums">{item.totalQuestions || 0}</td>
      <td className="px-3 py-3 font-medium text-body tabular-nums">{item.totalPoints || 0}</td>
      <td className="px-3 py-3"><StatusChip tone={(item.status || "active") === "active" ? "success" : "neutral"} label={(item.status || "active") === "active" ? "Active" : "Inactive"} /></td>
      <td className="px-3 py-3 text-right"><ChevronRight className="inline h-4 w-4 text-faint group-hover:text-brand-strong group-hover:translate-x-0.5 transition-all" /></td>
    </>
  );
}

export function StudentCells({ item, index, selectedExercise, onDetails }: { item: any; index: number; selectedExercise: any; onDetails: () => void }) {
  const p = item.exerciseProgress || {};
  const total = p.overallScore || 0;
  const max = p.totalMaxScore || selectedExercise?.totalPoints || 0;
  const pct = p.completionPercentage || 0;
  const scorePct = max > 0 ? (total / max) * 100 : 0;
  const band = bandOf(scorePct);
  const isPassing = p.isPassing || false;
  const passMark = p.passingMarksRequired || selectedExercise?.passingMarksRequired || (max ? Math.ceil(max * 0.5) : 0);
  const noAttempt = max === 0 || total === 0;
  return (
    <>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xs tabular-nums text-faint w-5 text-right shrink-0">{index + 1}</span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-2xs font-bold shrink-0 ${avatarTone(item.name || "")}`}>{initials(item.name || "")}</span>
          <div className="min-w-0">
            <p className="font-medium text-heading truncate">{item.name || "—"}</p>
            <p className="text-2xs text-subtle truncate">{item.email || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className={`h-full rounded-full ${band.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          <span className="text-2xs font-semibold text-body tabular-nums w-9 text-right">{pct}%</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-heading tabular-nums">{total}<span className="text-faint font-normal">/{max}</span></span>
          {!noAttempt && <span className={`inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold ring-1 ring-inset ${band.chip}`}>{band.label}</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        {noAttempt
          ? <StatusChip tone="neutral" icon={<AlertCircle className="h-3 w-3" />} label="No attempt" />
          : isPassing
            ? <StatusChip tone="success" icon={<CheckCircle2 className="h-3 w-3" />} label={`Pass (${total}/${passMark})`} />
            : <StatusChip tone="danger" icon={<XCircle className="h-3 w-3" />} label={`Fail (${total}/${passMark})`} />}
      </td>
      <td className="px-3 py-3 text-2xs text-subtle whitespace-nowrap">{p.lastActivity ? new Date(p.lastActivity).toLocaleDateString() : "Never"}</td>
      <td className="px-3 py-3"><StudentStatusChip status={p.status || "not_started"} /></td>
      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onDetails} title="View details" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors"><Eye className="h-4 w-4" /></button>
      </td>
    </>
  );
}

export function QuestionCells({ item, index }: { item: any; index: number }) {
  const attempted = !!item.studentAttempt;
  return (
    <>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xs tabular-nums text-faint w-5 text-right shrink-0">{index + 1}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-tile bg-info-50 text-info-700 shrink-0"><HelpCircle className="h-4 w-4" /></span>
          <span className="font-medium text-heading truncate">{item.title}</span>
        </div>
      </td>
      <td className="px-3 py-3"><DifficultyChip difficulty={item.difficulty || "medium"} /></td>
      <td className="px-3 py-3">
        {attempted
          ? <span className="inline-flex items-center gap-1 text-2xs font-medium text-success-700"><CheckCircle2 className="h-3.5 w-3.5" /> Submitted</span>
          : <span className="inline-flex items-center gap-1 text-2xs font-medium text-faint"><XCircle className="h-3.5 w-3.5" /> Not attempted</span>}
      </td>
      <td className="px-3 py-3 font-semibold text-heading tabular-nums">{item.studentAttempt?.score || 0}<span className="text-faint font-normal">/{item.score || 0}</span></td>
      <td className="px-3 py-3 text-body tabular-nums">{item.studentAttempt?.attempts || 0}</td>
      <td className="px-3 py-3"><QuestionStatusChip status={item.studentAttempt?.status || "not_attempted"} /></td>
    </>
  );
}
