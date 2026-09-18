import type { ReactNode } from "react";

// Tokenized status chips shared across the grade tables + details drawer.
export function StatusChip({ tone, label, icon }: { tone: "success" | "danger" | "warn" | "info" | "neutral"; label: string; icon?: ReactNode }) {
  const map = {
    success: "bg-success-50 text-success-700 ring-success-500/20",
    danger: "bg-danger-50 text-danger-700 ring-danger-500/20",
    warn: "bg-warn-50 text-warn-700 ring-warn-500/20",
    info: "bg-info-50 text-info-700 ring-info-500/20",
    neutral: "bg-ink-100 text-ink-600 ring-ink-500/15",
  };
  return <span className={`inline-flex items-center gap-1 h-6 rounded-full px-2 text-2xs font-semibold ring-1 ring-inset whitespace-nowrap ${map[tone]}`}>{icon}{label}</span>;
}

export function StudentStatusChip({ status }: { status: string }) {
  // "Evaluated" used to map to `info` (blue). Blue chips on every graded
  // row were the biggest single source of the "light blue theme" the
  // Grades page read as. Evaluated is a *done and reviewed* state, so it
  // shares the green success tone with Completed — the label already tells
  // them apart, so no information is lost by unifying the colour.
  const map: Record<string, { tone: "success" | "warn" | "neutral"; label: string }> = {
    completed: { tone: "success", label: "Completed" },
    in_progress: { tone: "warn", label: "In Progress" },
    evaluated: { tone: "success", label: "Evaluated" },
    not_started: { tone: "neutral", label: "Not Started" },
  };
  const m = map[status] || { tone: "neutral" as const, label: status };
  return <StatusChip tone={m.tone} label={m.label} />;
}

export function QuestionStatusChip({ status }: { status: string }) {
  const map: Record<string, { tone: "success" | "warn" | "danger" | "neutral"; label: string }> = {
    solved: { tone: "success", label: "Solved" },
    partially_solved: { tone: "warn", label: "Partially Solved" },
    failed: { tone: "danger", label: "Failed" },
    not_attempted: { tone: "neutral", label: "Not Attempted" },
  };
  const m = map[status] || { tone: "neutral" as const, label: status };
  return <StatusChip tone={m.tone} label={m.label} />;
}

export function DifficultyChip({ difficulty }: { difficulty: string }) {
  const map: Record<string, "success" | "warn" | "danger"> = { easy: "success", medium: "warn", hard: "danger" };
  return <span className="capitalize"><StatusChip tone={map[difficulty] || "neutral"} label={difficulty} /></span>;
}
