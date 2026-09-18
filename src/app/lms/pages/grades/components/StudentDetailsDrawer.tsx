import React, { type ReactNode } from "react";
import { AlertCircle, Award, CheckCircle2, Layers, ListChecks, Loader2, XCircle } from "lucide-react";
import { Drawer } from "@/app/lms/shared/ui";
import { avatarTone, bandOf, initials } from "./gradeHelpers";
import { StudentStatusChip } from "./GradeBadges";

// Student details drawer — real assessment fields only (score, progress, pass/fail,
// breakdown, status, last activity). Quick action drills to that student's questions.
export default function StudentDetailsDrawer({ student, selectedExercise, onClose, onViewQuestions }: { student: any; selectedExercise: any; onClose: () => void; onViewQuestions: (s: any) => void }) {
  const last = React.useRef<any>(null);
  if (student) last.current = student;
  const shown = student ?? last.current;
  if (!shown) return <Drawer open={false} onClose={onClose} title="Student"><div /></Drawer>;

  const p = shown.exerciseProgress || {};
  const total = p.overallScore || 0;
  const max = p.totalMaxScore || selectedExercise?.totalPoints || 0;
  const pct = p.completionPercentage || 0;
  const scorePct = max > 0 ? (total / max) * 100 : 0;
  const band = bandOf(scorePct);
  const noAttempt = max === 0 || total === 0;

  return (
    <Drawer
      open={Boolean(student)}
      onClose={onClose}
      width="md"
      title="Student assessment"
      footer={
        <button type="button" onClick={() => onViewQuestions(shown)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors"><ListChecks className="h-4 w-4" /> View questions</button>
      }
    >
      <div className="space-y-5">
        {/* Profile */}
        <div className="flex items-center gap-3">
          <span className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-bold shrink-0 ${avatarTone(shown.name || "")}`}>{initials(shown.name || "")}</span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-heading truncate">{shown.name || "—"}</h3>
            <p className="text-sm text-subtle truncate">{shown.email || "—"}</p>
          </div>
        </div>

        {/* Result banner */}
        <div className="rounded-2xl border border-hairline overflow-hidden shadow-xs">
          <div className={`flex items-center justify-between gap-2 px-4 py-3 ${noAttempt ? "bg-ink-50" : p.isPassing ? "bg-success-50" : "bg-danger-50"}`}>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-heading">
              {noAttempt ? <><AlertCircle className="h-4 w-4 text-ink-500" /> No attempt</> : p.isPassing ? <><CheckCircle2 className="h-4 w-4 text-success-700" /> Passing</> : <><XCircle className="h-4 w-4 text-danger-700" /> Not passing</>}
            </span>
            {!noAttempt && <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset ${band.chip}`}>{band.label}</span>}
          </div>
          <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline bg-surface">
            <div className="px-4 py-3 text-center"><p className="text-2xs uppercase font-medium text-faint">Score</p><p className="text-xl font-bold text-heading tabular-nums">{total}<span className="text-sm text-faint font-normal">/{max}</span></p></div>
            <div className="px-4 py-3 text-center"><p className="text-2xs uppercase font-medium text-faint">Progress</p><p className="text-xl font-bold text-heading tabular-nums">{pct}%</p></div>
          </div>
        </div>

        {/* Marks breakdown */}
        <div>
          <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle mb-2"><Award className="h-3.5 w-3.5" /> Assessment breakdown</p>
          <div className="space-y-2">
            <DetailRow icon={<Layers className="h-4 w-4" />} label="Exercise" value={selectedExercise?.exerciseName || "—"} />
            <DetailRow icon={<ListChecks className="h-4 w-4" />} label="Completion" value={`${pct}%`} />
            <DetailRow icon={<Award className="h-4 w-4" />} label="Score" value={`${total} / ${max}`} />
            <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Passing mark" value={String(p.passingMarksRequired || selectedExercise?.passingMarksRequired || (max ? Math.ceil(max * 0.5) : "—"))} />
            <DetailRow icon={<Loader2 className="h-4 w-4" />} label="Status" value={<StudentStatusChip status={p.status || "not_started"} />} />
            <DetailRow icon={<AlertCircle className="h-4 w-4" />} label="Last activity" value={p.lastActivity ? new Date(p.lastActivity).toLocaleString() : "Never"} />
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-tile border border-hairline bg-canvas px-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-xs text-subtle"><span className="text-faint">{icon}</span>{label}</span>
      <span className="text-sm font-medium text-heading text-right min-w-0 truncate">{value}</span>
    </div>
  );
}
