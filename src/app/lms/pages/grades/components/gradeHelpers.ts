// Shared pure helpers for the grades drill-down workspace (no JSX).

export const sectionLabel = (s?: string) => (s ? s.replace(/_/g, " ") : "N/A");

// Score % → qualitative performance band (grade visualization).
export type Band = { label: string; chip: string; bar: string };
export const bandOf = (pct: number): Band => {
  if (pct >= 85) return { label: "Excellent", chip: "bg-success-50 text-success-700 ring-success-500/20", bar: "bg-success-500" };
  if (pct >= 60) return { label: "Good", chip: "bg-info-50 text-info-700 ring-info-500/20", bar: "bg-info-500" };
  if (pct >= 40) return { label: "Average", chip: "bg-warn-50 text-warn-700 ring-warn-500/20", bar: "bg-warn-500" };
  return { label: "Needs work", chip: "bg-danger-50 text-danger-700 ring-danger-500/20", bar: "bg-danger-500" };
};

// Stable avatar tint + initials from a name.
const AVATARS = ["bg-info-50 text-info-700", "bg-brand-wash text-brand-strong", "bg-success-50 text-success-700", "bg-warn-50 text-warn-700", "bg-danger-50 text-danger-700"];
const nameHash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const avatarTone = (name: string) => AVATARS[nameHash(name || "?") % AVATARS.length];
export const initials = (name: string) => (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";

// Table header definitions per tab.
export function headersFor(tab: string): { label: string; align?: "right" }[] {
  switch (tab) {
    case "exercises": return [{ label: "Exercise" }, { label: "Section" }, { label: "Questions" }, { label: "Points" }, { label: "Status" }, { label: "" }];
    case "students": return [{ label: "Student" }, { label: "Progress" }, { label: "Score" }, { label: "Result" }, { label: "Last activity" }, { label: "Status" }, { label: "" }];
    case "questions": return [{ label: "Question" }, { label: "Difficulty" }, { label: "Answer" }, { label: "Score" }, { label: "Attempts" }, { label: "Status" }];
    default: return [];
  }
}
