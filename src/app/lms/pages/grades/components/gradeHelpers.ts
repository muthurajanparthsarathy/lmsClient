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
//
// Exercises: the leading column heading is contextual — the trainer picks an
// Activity (We Do → Assignment, You Do → Assessment) from the toolbar select,
// and the column header rewrites to match. When Activity = All the header
// falls back to "Exercise" (both kinds of activity are in the list, so the
// generic term is the honest label).
//
// Everything else on the exercises row is unchanged: Questions count · Total
// Marks (renamed from Points) · trailing chevron. The Section and Status
// columns are gone (moved to the toolbar / dropped as noise).
export function headersFor(
  tab: string,
  opts: { activityLabel?: string } = {},
): { label: string; align?: "right" }[] {
  const activity = opts.activityLabel || "Exercise";
  switch (tab) {
    // `#` is a serial number column — separate from the Activity name so
    // long titles never squeeze the index out of the row. Kept narrow via
    // an align class the page reads back off the header spec (right-aligned
    // text-faint style in the body cell).
    // "Total Questions" / "Total Marks" — the exercises tab lists whole
    // exercises, so both counts belong to the exercise as a whole; the
    // "Total" prefix reads more accurately than the bare noun did.
    // Actions column added last so the trainer can View a row without
    // having to click the whole row.
    case "exercises": return [{ label: "#", align: "right" }, { label: activity }, { label: "Total Questions", align: "right" }, { label: "Total Marks", align: "right" }, { label: "Actions", align: "right" }];
    // Students: `#` serial · Student Name (no avatar, plain text) · Email
    // (its own column, truncated with hover tooltip) · Total Questions ·
    // Attended · Mark Scored · Grade (Poor/Average/Good/Excellent) ·
    // Status (Completed/In Progress/Not Started, computed client-side from
    // attempted vs total so a "still In Progress" row that has actually
    // finished flips to Completed) · Actions (View Details icon).
    case "students": return [
      { label: "#", align: "right" },
      { label: "Student Name" },
      { label: "Email" },
      // Questions and Attended were two numeric columns whose only useful
      // reading was the pair ("how many of how many"), so they are one
      // "Attended" column showing `attempted/total` — 0/10, 5/10, 10/10.
      // Same shape as Marks beside it, which reads scored/max.
      { label: "Attended", align: "right" },
      { label: "Marks", align: "right" },
      { label: "Grade" },
      { label: "Status" },
      { label: "Actions", align: "right" },
    ];
    // Questions: `#` serial · Question title · Difficulty · Mark Scored
    // (X/Y, renamed from "Score") · Attempts · Status. The "Answer"
    // column that used to show Submitted / Not attempted was dropped
    // because the row already conveyed the same signal twice — Status
    // now takes over as the single "did they attempt / how did it go"
    // column (Submitted / Not attempted), matching the student rows'
    // Completed / Not Started semantics.
    case "questions": return [
      { label: "#", align: "right" },
      { label: "Question" },
      { label: "Difficulty" },
      { label: "Mark Scored", align: "right" },
      { label: "Attempts", align: "right" },
      { label: "Status" },
    ];
    default: return [];
  }
}
