import React from "react";
import {
    BarChart3,
    PieChart as PieIcon,
    Table as TableIcon,
    TrendingUp,
} from "lucide-react";

// ─── Date helpers (mirrors ReportPage; local to modal so no cross-import) ───
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
export const todayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
export const shortDay = (d: Date) => {
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    return `${String(day).padStart(2, "0")} ${mon}`;
};

export type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId: string;
};

export type BatchGroup = {
    id: string;   // batch identity (or "__course__" when the course has no real batches)
    name: string; // display label ("Batch I", …) or "All students" for the synthetic bucket
    students: Student[];
};

export const ALL_BATCHES = "__all__";

// Which columns the canvas table can show. The user picks any subset — the
// download exports exactly those columns.
export type ColKey =
    | "enrollment"
    | "present"
    | "absent"
    | "halfday"
    | "notmarked"
    | "attendance"
    | "performance";

export const COLUMNS: { key: ColKey; label: string; hint: string }[] = [
    { key: "enrollment",  label: "Roll No.", hint: "Student's roll / employee number" },
    { key: "present",     label: "Present",        hint: "Days marked P" },
    { key: "absent",      label: "Absent", hint: "Days marked A" },
    { key: "halfday",     label: "Half-day",       hint: "Days marked H" },
    { key: "notmarked",   label: "Not marked",     hint: "Working days without a mark" },
    { key: "attendance",  label: "Attendance %",   hint: "(P + H×0.5) ÷ working days" },
    { key: "performance", label: "Performance",    hint: "Excellent / Good / Average / Poor" },
];

// Which visual representations to draw on the canvas. Multi-select — pick
// as many as fits the story.
export type ViewKey = "table" | "pie" | "bar" | "line";

export const VIEWS: { key: ViewKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "table", label: "Roster table",   icon: TableIcon },
    { key: "pie",   label: "Status share",   icon: PieIcon },
    { key: "bar",   label: "Per-student %",  icon: BarChart3 },
    { key: "line",  label: "Daily trend",    icon: TrendingUp },
];

// Shared chart palette — reads from Tailwind token colours so both themes work.
export const STATUS_COLOR: Record<"P" | "A" | "H" | "N", string> = {
    P: "#10B981",
    A: "#EF4444",
    H: "#F59E0B",
    N: "#94A3B8",
};
