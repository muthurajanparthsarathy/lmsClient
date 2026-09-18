import type { OverviewCourse } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";

export const todayYmd = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
};

export const fmtDay = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        ...(sameYear ? {} : { year: "2-digit" }),
    });
};

// "BE ▸ Civil ▸ a ▸ 1" → "BE · Civil · Sec a · Sem 1". The last one/two parts
// of a placement path are section and semester; labelling them saves the
// reader from guessing what a bare "a · 1" means.
export const pathLabel = (path: string): string => {
    const parts = path.split("▸").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 4) return `${parts[0]} · ${parts[1]} · Sec ${parts[2]} · Sem ${parts[3]}`;
    if (parts.length === 3) return `${parts[0]} · ${parts[1]} · Sem ${parts[2]}`;
    return parts.join(" · ");
};

export type ScheduleState = "active" | "upcoming" | "ended" | "none";

// The state that decides whether attendance can happen TODAY, keyed on the
// TRAINING window (Program Calendar start → latest batch end) — the same
// window the marking screen locks on and the server enforces. No calendar
// means nothing to attend: its own state, not a fake "active".
export const scheduleStateOf = (c: OverviewCourse, today: string): ScheduleState => {
    if (!c.hasSchedule) return "none";
    if (c.trainingStart && today < c.trainingStart) return "upcoming";
    if (c.trainingEnd && today > c.trainingEnd) return "ended";
    return "active";
};

// The batches that matter for the marking state (header chip, action
// label, sort order) — a lone "Default" batch is
// the fallback container of a batchless course, reported as the course
// itself rather than as a batch named Default.
export const realBatchesOf = (c: OverviewCourse) => {
    if (
        c.batches.length === 1 &&
        (c.batches[0].batchName || "").trim().toLowerCase() === "default"
    )
        return [];
    return c.batches;
};
