import type { AttendanceStatus, HalfPeriod } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";

// ── Helpers ────────────────────────────────────────────────────────────────
export const toDayKey = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

export const fmt = (d: Date) => {
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const yr = d.getUTCFullYear();
  return `${String(day).padStart(2, "0")}-${mon}-${yr}`;
};

export const fmtWeekday = (d: Date) =>
  d.toLocaleString("en-GB", { weekday: "long", timeZone: "UTC" });

export const isWeekend = (d: Date) => {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
};

// Midnight UTC of "today" — used to gate marking so admins can't fill in
// attendance for days that haven't happened yet.
export const todayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

export const isFuture = (d: Date) => d.getTime() > todayUtc().getTime();

// ── Types ──────────────────────────────────────────────────────────────────
export type Student = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  enrolmentStatus?: string;
};

// One batch of the course, as attendance sees it: the students to mark, plus
// EVERY member id (staff included) — membership is what entitles a non-admin
// to mark the batch.
export type BatchGroup = {
  _id: string;
  batchName: string;
  students: Student[];
  memberIds: string[];
};

export type CellState = {
  status: AttendanceStatus | "";
  reason?: string;        // populated for A / H marks
  halfPeriod?: HalfPeriod; // populated for H marks
  dirty: boolean;          // has an unsaved change since last fetch
};

export type Grid = Map<string, Map<string, CellState>>; // studentId → (dateKey → state)

// One row in the save-time reasons modal — a dirty A / H mark awaiting reason.
export type ReasonItem = {
  studentId: string;
  dateKey: string;
  name: string;
  status: "A" | "H";
  reason: string;
  halfPeriod: HalfPeriod;
};

// The three markable status columns of the sheet.
export const STATUS_COLUMNS: {
  key: AttendanceStatus;
  label: string;
  accent: string;   // checkbox accent
  headText: string; // header text colour
}[] = [
  { key: "P", label: "Present", accent: "accent-success-700", headText: "text-success-700" },
  { key: "A", label: "Absent", accent: "accent-danger-700", headText: "text-danger-700" },
  { key: "H", label: "Half-day", accent: "accent-warn-500", headText: "text-warn-700" },
];

// Colour ramps for the per-student toggle (filled when marked) and the column
// "mark all" pill (soft-tinted when the whole class already carries it).
export const statusOnClasses: Record<AttendanceStatus, string> = {
  P: "border-success-500 bg-success-500 text-white",
  A: "border-danger-500 bg-danger-500 text-white",
  H: "border-warn-500 bg-warn-500 text-white",
};
export const toneAllActive: Record<AttendanceStatus, string> = {
  P: "border-success-500/40 bg-success-50 text-success-700",
  A: "border-danger-500/40 bg-danger-50 text-danger-700",
  H: "border-warn-500/40 bg-warn-50 text-warn-700",
};
export const statusHeadText: Record<AttendanceStatus, string> = {
  P: "text-success-700",
  A: "text-danger-700",
  H: "text-warn-700",
};
