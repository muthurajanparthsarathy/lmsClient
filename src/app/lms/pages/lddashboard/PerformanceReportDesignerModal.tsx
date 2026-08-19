"use client";

/**
 * Performance Report Designer — a Canva-style overlay for #rep-performance,
 * modeled on the Attendance Detailed Report modal.
 *
 * Left drawer  = designer surface (scope readout, students, activities,
 *                sub-categories, grade bands, views, columns).
 * Right canvas = live preview that reacts to every drawer edit.
 * Top-right    = download menu (Excel / PDF) that ships whatever the canvas
 *                is currently showing — nothing more, nothing less.
 *
 * Data source is `useStaffAnalytics`'s already-derived per-student payload
 * (the same one PerformanceReport reads on the page). Sub-category buckets
 * are discovered from `progress.I_Do / We_Do / You_Do` object keys, so the
 * picker only offers what the courses in scope actually allocate. Grade
 * bands default to DEFAULT_GRADE_BANDS (Poor / Average / Good / Excellent
 * at 0 / 40 / 60 / 80) on the student's overall percentage — the same
 * bucket the assignment Reports view uses when an exercise has no custom
 * gradeSettings.
 *
 * The existing Generate → Customize modal on PerformanceReport is left
 * intact — this is an additional, more powerful entry point.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    BarChart3,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    PieChart as PieIcon,
    Search,
    Settings2,
    SlidersHorizontal,
    Table as TableIcon,
    X,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend as RLegend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RTooltip,
    XAxis,
    YAxis,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────
// Public props — parent hands us the scope + already-derived analytics
// rows so we don't refetch the 12-second staff analytics call.
// ─────────────────────────────────────────────────────────────────────────
export type PerfStudentRow = {
    pid: string;
    name: string;
    email: string;
    course: string;
    courseId: string;
    client: string;
    overall: number;
    iDo: number | null;
    weDo: number | null;
    youDo: number | null;
    score: number | null;
    last: string;
    lastT: number;
    /** Raw progress object (needed for sub-category slicing). */
    progress: any;
};

export type PerfCourseRow = {
    id: string;
    name: string;
    client: string;
    students: number;
    avg: number;
    done: number;
    prog: number;
    not: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    baseStudents: PerfStudentRow[];
    baseCourseRows: PerfCourseRow[];
    scopeLabel: string;
};

// ─── Grade bands (mirrors DEFAULT_GRADE_BANDS in the assignment Reports flow) ─
const GRADE_BANDS = [
    { key: "excellent", label: "Excellent", from: 80, to: 101, color: "#0E9F6E", tone: "good" },
    { key: "good", label: "Good", from: 60, to: 80, color: "#2E90C4", tone: "brand" },
    { key: "average", label: "Average", from: 40, to: 60, color: "#C77700", tone: "warn" },
    { key: "poor", label: "Poor", from: 1, to: 40, color: "#B42318", tone: "bad" },
    { key: "not", label: "Not started", from: 0, to: 1, color: "#98A2B3", tone: "muted" },
] as const;
type GradeKey = typeof GRADE_BANDS[number]["key"];

const gradeOf = (pctVal: number | null | undefined): GradeKey => {
    const v = typeof pctVal === "number" ? pctVal : 0;
    if (v <= 0) return "not";
    if (v < 40) return "poor";
    if (v < 60) return "average";
    if (v < 80) return "good";
    return "excellent";
};
const gradeLabel = (k: GradeKey) => GRADE_BANDS.find((g) => g.key === k)?.label || "—";
const gradeColor = (k: GradeKey) => GRADE_BANDS.find((g) => g.key === k)?.color || "#94A3B8";

// Which pedagogy grouping the report should target.
const ACTIVITIES: { key: "I_Do" | "We_Do" | "You_Do"; label: string; hint: string }[] = [
    { key: "I_Do", label: "I Do", hint: "Instructor-led — concept videos / MCQs" },
    { key: "We_Do", label: "We Do", hint: "Guided practice — assignments, practical" },
    { key: "You_Do", label: "You Do", hint: "Independent — assessments, projects" },
];

// Pretty labels for the raw sub-category keys the analytics payload uses.
// Anything not on the list falls back to a title-cased version of the key
// so newly added sub-types don't disappear from the picker.
const SUBCAT_LABELS: Record<string, string> = {
    Video: "Video",
    video: "Video",
    Reading: "Reading",
    reading: "Reading",
    Notes: "Notes",
    notes: "Notes",
    MCQ: "MCQ",
    mcq: "MCQ",
    Quiz: "Quiz",
    quiz: "Quiz",
    Assessment: "Assessment",
    assessment: "Assessment",
    assessments: "Assessment",
    assesment: "Assessment",
    Assignment: "Assignment",
    assignment: "Assignment",
    assignments: "Assignment",
    practical: "Practical",
    Practical: "Practical",
    project_development: "Project development",
    projects: "Project",
    project: "Project",
};
const prettySubcat = (raw: string): string => {
    if (SUBCAT_LABELS[raw]) return SUBCAT_LABELS[raw];
    return raw
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Views the canvas can render (multi-select). ─────────────────────────
type ViewKey = "stats" | "gradePie" | "subcatBars" | "courses" | "roster";
const VIEWS: { key: ViewKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "stats", label: "Summary stats", icon: SlidersHorizontal },
    { key: "gradePie", label: "Grade distribution", icon: PieIcon },
    { key: "subcatBars", label: "Sub-category bars", icon: BarChart3 },
    { key: "courses", label: "Courses table", icon: TableIcon },
    { key: "roster", label: "Roster (with grade)", icon: TableIcon },
];

// ─── Roster columns the user can toggle. ─────────────────────────────────
type ColKey =
    | "email"
    | "course"
    | "client"
    | "overall"
    | "iDo"
    | "weDo"
    | "youDo"
    | "subcatPct"
    | "score"
    | "grade"
    | "last";

const COLUMNS: { key: ColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "email", label: "Email", hint: "Student email address" },
    { key: "course", label: "Course", hint: "Enrolled course name" },
    { key: "client", label: "Client", hint: "Client / institution" },
    { key: "overall", label: "Overall %", hint: "Attempts vs exercises", r: true },
    { key: "iDo", label: "I Do %", hint: "Instructor-led completion", r: true },
    { key: "weDo", label: "We Do %", hint: "Guided practice completion", r: true },
    { key: "youDo", label: "You Do %", hint: "Independent completion", r: true },
    { key: "subcatPct", label: "Selected %", hint: "Avg % across chosen activities + sub-categories", r: true },
    { key: "score", label: "Score %", hint: "Marks earned on We Do / You Do work", r: true },
    { key: "grade", label: "Grade", hint: "Band based on the selected %", r: false },
    { key: "last", label: "Last active", hint: "Most recent activity timestamp" },
];

const DEFAULT_COLS: ColKey[] = ["email", "course", "overall", "subcatPct", "grade", "last"];
const DEFAULT_VIEWS: ViewKey[] = ["stats", "gradePie", "subcatBars", "roster"];

// ─── Helpers ─────────────────────────────────────────────────────────────
// Read progress[stage][subcat] as { completed, total, percentage }. Used
// for both the sub-category catalogue and the per-student calculation.
type PSub = { completed: number; total: number; percentage?: number };
const readSubcat = (progress: any, stage: string, subcat: string): PSub | null => {
    const stg = progress?.[stage];
    if (!stg || typeof stg !== "object") return null;
    const s = stg[subcat];
    if (!s || typeof s !== "object" || !("total" in s)) return null;
    return {
        completed: Number(s.completed) || 0,
        total: Number(s.total) || 0,
        percentage: typeof s.percentage === "number" ? s.percentage : undefined,
    };
};

// Per-student % for one (stage, subcat). Prefers server-side `percentage`
// (score-weighted for We_Do / You_Do), falls back to completed/total.
const subcatPercent = (progress: any, stage: string, subcat: string): number | null => {
    const s = readSubcat(progress, stage, subcat);
    if (!s || s.total <= 0) return null;
    if (typeof s.percentage === "number") return s.percentage;
    return Math.round((s.completed / s.total) * 100);
};

// Per-student % across the picked (stage, subcat) selection. Same
// completion/total math as `stageDone` — sum completed vs sum total across
// the buckets that survive the filter. Returns null when nothing applies.
const pickedPercent = (
    progress: any,
    activities: Set<"I_Do" | "We_Do" | "You_Do">,
    subcats: Set<string>,
): number | null => {
    let comp = 0;
    let tot = 0;
    activities.forEach((stage) => {
        const stg = progress?.[stage];
        if (!stg || typeof stg !== "object") return;
        Object.entries(stg).forEach(([key, sub]: [string, any]) => {
            if (!subcats.has(`${stage}:${key}`)) return;
            if (!sub || typeof sub !== "object" || !("total" in sub)) return;
            comp += Number(sub.completed) || 0;
            tot += Number(sub.total) || 0;
        });
    });
    return tot > 0 ? Math.round((comp / tot) * 100) : null;
};

// Discover every (stage, subcat) pair that at least one student in scope
// has any content for. Keys become the sub-category picker options.
type SubcatOpt = { id: string; stage: "I_Do" | "We_Do" | "You_Do"; subcat: string; label: string };
const buildSubcatOptions = (rows: PerfStudentRow[]): SubcatOpt[] => {
    const seen = new Map<string, SubcatOpt>();
    for (const r of rows) {
        const prog = r.progress || {};
        for (const stage of ACTIVITIES.map((a) => a.key)) {
            const stg = prog[stage];
            if (!stg || typeof stg !== "object") continue;
            for (const [subcat, sub] of Object.entries(stg)) {
                const s = sub as any;
                if (!s || typeof s !== "object" || !("total" in s)) continue;
                if ((Number(s.total) || 0) <= 0) continue;
                const id = `${stage}:${subcat}`;
                if (!seen.has(id)) {
                    seen.set(id, {
                        id,
                        stage: stage as any,
                        subcat,
                        label: `${ACTIVITIES.find((a) => a.key === stage)?.label} · ${prettySubcat(subcat)}`,
                    });
                }
            }
        }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
};

// Discover activities with at least some content across the scope.
const buildActivityOptions = (rows: PerfStudentRow[]): Set<"I_Do" | "We_Do" | "You_Do"> => {
    const out = new Set<"I_Do" | "We_Do" | "You_Do">();
    for (const r of rows) {
        for (const stage of ACTIVITIES.map((a) => a.key)) {
            if (out.has(stage)) continue;
            const stg = r.progress?.[stage];
            if (!stg || typeof stg !== "object") continue;
            const hit = Object.values(stg).some((s: any) => s && typeof s === "object" && (Number(s.total) || 0) > 0);
            if (hit) out.add(stage);
        }
    }
    return out;
};

// ─── Small reusable checkbox multi-select. Owns its open/close state ────
function MultiPickBox({
    label,
    options,
    sel,
    onChange,
    empty,
}: {
    label: string;
    options: { id: string; name: string; sub?: string }[];
    sel: Set<string> | null; // null = "all"
    onChange: (v: Set<string> | null) => void;
    empty?: string;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const boxRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    const t = q.trim().toLowerCase();
    const shown = t
        ? options.filter((o) => o.name.toLowerCase().includes(t) || (o.sub || "").toLowerCase().includes(t))
        : options;
    const toggle = (id: string) => {
        const next = new Set(sel === null ? options.map((o) => o.id) : sel);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange(next.size === options.length ? null : next);
    };
    const count = sel === null ? options.length : sel.size;
    return (
        <div className="relative" ref={boxRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-8 w-full items-center justify-between rounded-md border border-hairline bg-surface px-2.5 text-[11px] font-medium text-heading hover:border-hairline-strong transition-colors"
            >
                <span className="truncate">
                    {label}: {sel === null ? "All" : `${count} of ${options.length}`}
                </span>
                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-hidden rounded-md border border-hairline bg-surface p-1.5 shadow-lg">
                    <div className="relative mb-1.5">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={`Search ${label.toLowerCase()}…`}
                            className="h-7 w-full rounded border border-hairline bg-surface pl-6 pr-2 text-[11px] text-body outline-none focus:border-brand-500"
                        />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                        {shown.length === 0 ? (
                            <div className="px-2 py-2 text-[10px] text-subtle">{empty || "No matches"}</div>
                        ) : (
                            shown.map((o) => (
                                <label
                                    key={o.id}
                                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-row-hover"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sel === null || sel.has(o.id)}
                                        onChange={() => toggle(o.id)}
                                        className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[11px] font-medium text-body">{o.name}</span>
                                        {o.sub ? (
                                            <span className="block truncate text-[10px] text-faint">{o.sub}</span>
                                        ) : null}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="mt-1 flex gap-1.5 border-t border-hairline pt-1.5">
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong hover:bg-brand-wash"
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange(new Set())}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-subtle hover:bg-row-hover"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// ─── Main modal ──────────────────────────────────────────────────────────
export default function PerformanceReportDesignerModal({
    open,
    onClose,
    baseStudents,
    baseCourseRows,
    scopeLabel,
}: Props) {
    // Designer state
    const [drawerCollapsed, setDrawerCollapsed] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
    const [views, setViews] = useState<Set<ViewKey>>(new Set(DEFAULT_VIEWS));
    const [cols, setCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
    const [studentSel, setStudentSel] = useState<Set<string> | null>(null);
    const [activities, setActivities] = useState<Set<"I_Do" | "We_Do" | "You_Do">>(
        () => new Set(["I_Do", "We_Do", "You_Do"]),
    );
    const [subcats, setSubcats] = useState<Set<string> | null>(null); // null = all
    const [grades, setGrades] = useState<Set<GradeKey> | null>(null); // null = all
    // Sections removed on the canvas via ×. Kept independent of the drawer's
    // Views multi-pick so removing a section from the preview doesn't clear
    // the setting a user might want to re-enable via the drawer.
    const [removed, setRemoved] = useState<Set<ViewKey>>(new Set());

    const downloadRef = useRef<HTMLDivElement>(null);

    // Close download menu on outside click.
    useEffect(() => {
        if (!downloadOpen) return;
        const h = (e: MouseEvent) => {
            if (!downloadRef.current?.contains(e.target as Node)) setDownloadOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [downloadOpen]);

    // ESC closes the whole modal.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Re-scope resets: parent hands new baseStudents when the client/course
    // filter changes, so drop the picker sets that no longer apply.
    useEffect(() => {
        setStudentSel(null);
        setSubcats(null);
    }, [baseStudents]);

    // ── Options derived from the current base ──
    const activityHas = useMemo(() => buildActivityOptions(baseStudents), [baseStudents]);
    const subcatOpts = useMemo(() => buildSubcatOptions(baseStudents), [baseStudents]);
    const studentOpts = useMemo(() => {
        // one entry per person even if enrolled in multiple courses
        const seen = new Map<string, { id: string; name: string; sub?: string; n: number }>();
        baseStudents.forEach((s) => {
            const o = seen.get(s.pid);
            if (o) {
                o.n += 1;
                o.sub = `${o.n} courses`;
            } else seen.set(s.pid, { id: s.pid, name: s.name, sub: s.email || s.course, n: 1 });
        });
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [baseStudents]);

    const gradeOpts = useMemo(
        () => GRADE_BANDS.map((g) => ({ id: g.key, name: g.label })),
        [],
    );
    const activityOpts = useMemo(
        () =>
            ACTIVITIES.filter((a) => activityHas.has(a.key)).map((a) => ({
                id: a.key,
                name: a.label,
                sub: a.hint,
            })),
        [activityHas],
    );

    // Sub-cat multipick options are filtered by which activities are on so
    // deselecting "We Do" hides the assignment/practical buckets it owns.
    const filteredSubcatOpts = useMemo(
        () => subcatOpts.filter((o) => activities.has(o.stage)),
        [subcatOpts, activities],
    );

    // ── The rows the report is built from ──
    // 1. Apply the student pick.
    // 2. Compute the per-student "selected %" (activities ∩ subcats).
    // 3. Compute the per-student grade band from that.
    // 4. Apply the grade filter.
    const selectedSubcatSet = useMemo<Set<string>>(() => {
        if (subcats === null) return new Set(filteredSubcatOpts.map((o) => o.id));
        return subcats;
    }, [subcats, filteredSubcatOpts]);

    const workingRows = useMemo(() => {
        const pickSet = studentSel;
        const rows = baseStudents
            .filter((s) => (pickSet === null ? true : pickSet.has(s.pid)))
            .map((s) => {
                const selectedPct = pickedPercent(s.progress, activities, selectedSubcatSet);
                // "Grade %" — the metric we band into Excellent/Good/… — prefers
                // the picked slice when we have one, otherwise falls back to the
                // overall %. That way an unfiltered report still grades every row.
                const gradePct = selectedPct !== null ? selectedPct : s.overall;
                const grade = gradeOf(gradePct);
                return { ...s, selectedPct, gradePct, grade };
            });
        if (grades !== null) return rows.filter((r) => grades.has(r.grade));
        return rows;
    }, [baseStudents, studentSel, activities, selectedSubcatSet, grades]);

    // Course-level rollup restricted to the current row set so the Courses
    // table on the canvas never shows a course with zero surviving students.
    const courseRows = useMemo(() => {
        const keep = new Set(workingRows.map((r) => r.courseId));
        return baseCourseRows.filter((c) => keep.has(c.id));
    }, [baseCourseRows, workingRows]);

    // Grade distribution across the surviving rows.
    const gradeSlices = useMemo(() => {
        const counts: Record<GradeKey, number> = { excellent: 0, good: 0, average: 0, poor: 0, not: 0 };
        for (const r of workingRows) counts[r.grade] += 1;
        return GRADE_BANDS.map((g) => ({
            key: g.key,
            name: g.label,
            value: counts[g.key],
            color: g.color,
        })).filter((s) => s.value > 0);
    }, [workingRows]);

    // Per (activity, sub-category) average across selected rows.
    const subcatBars = useMemo(() => {
        return filteredSubcatOpts
            .filter((o) => selectedSubcatSet.has(o.id))
            .map((o) => {
                const vals: number[] = [];
                for (const r of workingRows) {
                    const p = subcatPercent(r.progress, o.stage, o.subcat);
                    if (p !== null) vals.push(p);
                }
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
                return { key: o.id, label: o.label, avg, learners: vals.length };
            })
            .sort((a, b) => b.avg - a.avg);
    }, [filteredSubcatOpts, selectedSubcatSet, workingRows]);

    // Aggregate stats strip.
    const stats = useMemo(() => {
        const total = workingRows.length;
        const avgOverall = total
            ? Math.round(workingRows.reduce((s, r) => s + r.overall, 0) / total)
            : 0;
        const selVals = workingRows.map((r) => r.selectedPct).filter((v): v is number => v !== null);
        const avgSelected = selVals.length
            ? Math.round(selVals.reduce((a, b) => a + b, 0) / selVals.length)
            : null;
        const scoreVals = workingRows.map((r) => r.score).filter((v): v is number => v !== null);
        const avgScore = scoreVals.length
            ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length)
            : null;
        const atRisk = workingRows.filter((r) => r.gradePct > 0 && r.gradePct < 40).length;
        const notStarted = workingRows.filter((r) => r.gradePct === 0).length;
        const excellent = workingRows.filter((r) => r.gradePct >= 80).length;
        return { total, avgOverall, avgSelected, avgScore, atRisk, notStarted, excellent };
    }, [workingRows]);

    // Whether a view should render on the canvas.
    const shouldShow = (k: ViewKey) => views.has(k) && !removed.has(k);
    const removeSection = (k: ViewKey) => setRemoved((r) => new Set(r).add(k));
    const restoreSection = (k: ViewKey) =>
        setRemoved((r) => {
            const n = new Set(r);
            n.delete(k);
            return n;
        });
    // If the drawer re-enables a section that had been removed, bring it back.
    useEffect(() => {
        // Any removed key that is no longer in views can stay removed harmlessly.
        // Any key that IS in views but was removed → drop from removed so it renders.
        setRemoved((prev) => {
            const next = new Set(prev);
            let changed = false;
            prev.forEach((k) => {
                if (views.has(k)) {
                    next.delete(k);
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [views]);

    // ── Export helpers ────────────────────────────────────────────────────
    const activeCols = COLUMNS.filter((c) => cols.has(c.key));
    const activeSubcatOpts = filteredSubcatOpts.filter((o) => selectedSubcatSet.has(o.id));
    const activeActivityLabels = ACTIVITIES.filter((a) => activities.has(a.key))
        .map((a) => a.label)
        .join(", ");
    const scopeLine = `${scopeLabel || "All clients · all courses"} · ${workingRows.length} student${workingRows.length === 1 ? "" : "s"}`;
    const subcatLine = `Activities: ${activeActivityLabels || "—"} · Sub-cats: ${activeSubcatOpts.length ? activeSubcatOpts.length : "all"} of ${filteredSubcatOpts.length}`;
    const gradeLine = grades === null ? "All grades" : [...grades].map((g) => gradeLabel(g)).join(", ");

    const cellText = (r: (typeof workingRows)[number], c: ColKey): string => {
        switch (c) {
            case "email":
                return r.email || "";
            case "course":
                return r.course || "";
            case "client":
                return r.client || "";
            case "overall":
                return `${r.overall}%`;
            case "iDo":
                return r.iDo === null ? "N/A" : `${r.iDo}%`;
            case "weDo":
                return r.weDo === null ? "N/A" : `${r.weDo}%`;
            case "youDo":
                return r.youDo === null ? "N/A" : `${r.youDo}%`;
            case "subcatPct":
                return r.selectedPct === null ? "N/A" : `${r.selectedPct}%`;
            case "score":
                return r.score === null ? "—" : `${r.score}%`;
            case "grade":
                return gradeLabel(r.grade);
            case "last":
                return r.last || "—";
            default:
                return "";
        }
    };

    const cellNumber = (r: (typeof workingRows)[number], c: ColKey): number | string => {
        switch (c) {
            case "overall":
                return r.overall;
            case "iDo":
                return r.iDo === null ? "N/A" : r.iDo;
            case "weDo":
                return r.weDo === null ? "N/A" : r.weDo;
            case "youDo":
                return r.youDo === null ? "N/A" : r.youDo;
            case "subcatPct":
                return r.selectedPct === null ? "N/A" : r.selectedPct;
            case "score":
                return r.score === null ? "" : r.score;
            default:
                return cellText(r, c);
        }
    };

    const localDay = () => new Date().toISOString().slice(0, 10);

    const downloadExcel = async () => {
        if (busy) return;
        setBusy("xlsx");
        try {
            const [xl, fsv] = await Promise.all([import("exceljs"), import("file-saver")]);
            const ExcelJS: any = (xl as any).default ?? xl;
            const saveAs: (b: Blob, name: string) => void = (fsv as any).saveAs ?? (fsv as any).default;
            const wb = new ExcelJS.Workbook();
            wb.creator = "EduLMS";
            wb.created = new Date();
            const header: any = {
                font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB6834" } },
                alignment: { vertical: "middle", horizontal: "left" },
            };
            const bordered: any = {
                font: { size: 11 },
                border: {
                    top: { style: "thin", color: { argb: "FFF3F4F6" } },
                    bottom: { style: "thin", color: { argb: "FFF3F4F6" } },
                    left: { style: "thin", color: { argb: "FFF3F4F6" } },
                    right: { style: "thin", color: { argb: "FFF3F4F6" } },
                },
            };

            // Summary sheet — always present so the file can never be empty.
            const ws = wb.addWorksheet("Summary");
            ws.columns = [{ width: 34 }, { width: 40 }];
            ws.addRow(["Performance Report"]).getCell(1).style = { font: { bold: true, size: 13 } };
            ws.addRow(["Scope", scopeLabel || "All clients · all courses"]);
            ws.addRow(["Students", stats.total]);
            ws.addRow(["Activities", activeActivityLabels || "—"]);
            ws.addRow(["Sub-categories", subcatLine]);
            ws.addRow(["Grades", gradeLine]);
            ws.addRow(["Generated", new Date().toLocaleString("en-GB")]);
            if (shouldShow("stats")) {
                ws.addRow([]);
                const h = ws.addRow(["Metric", "Value"]);
                h.eachCell((c: any) => (c.style = header));
                const st: [string, string | number][] = [
                    ["Total students", stats.total],
                    ["Avg overall %", `${stats.avgOverall}%`],
                    ["Avg selected %", stats.avgSelected === null ? "—" : `${stats.avgSelected}%`],
                    ["Avg score %", stats.avgScore === null ? "—" : `${stats.avgScore}%`],
                    ["Excellent (≥80%)", stats.excellent],
                    ["At risk (<40%)", stats.atRisk],
                    ["Not started", stats.notStarted],
                ];
                st.forEach((r) => {
                    const row = ws.addRow(r);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }
            if (shouldShow("gradePie")) {
                ws.addRow([]);
                const h = ws.addRow(["Grade", "Students"]);
                h.eachCell((c: any) => (c.style = header));
                gradeSlices.forEach((g) => {
                    const row = ws.addRow([g.name, g.value]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }
            if (shouldShow("subcatBars")) {
                ws.addRow([]);
                const h = ws.addRow(["Activity · sub-category", "Avg %", "Learners with content"]);
                h.eachCell((c: any) => (c.style = header));
                subcatBars.forEach((b) => {
                    const row = ws.addRow([b.label, `${b.avg}%`, b.learners]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }

            if (shouldShow("courses")) {
                const cs = wb.addWorksheet("Courses");
                const cols = [
                    { header: "Course", key: "name", width: 28 },
                    { header: "Client", key: "client", width: 18 },
                    { header: "Students", key: "students", width: 12 },
                    { header: "Avg %", key: "avg", width: 10 },
                    { header: "Completed", key: "done", width: 12 },
                    { header: "In progress", key: "prog", width: 12 },
                    { header: "Not started", key: "not", width: 12 },
                ];
                cs.columns = cols;
                const hr = cs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                courseRows.forEach((c) => {
                    const row = cs.addRow([c.name, c.client, c.students, `${c.avg}%`, c.done, c.prog, c.not]);
                    row.eachCell((cell: any) => (cell.style = bordered));
                });
                cs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
                cs.views = [{ state: "frozen", ySplit: 1 }];
            }

            if (shouldShow("roster")) {
                const rs = wb.addWorksheet("Roster");
                const dcols = [{ header: "Student", key: "name", width: 26 }, ...activeCols.map((c) => ({ header: c.label, key: c.key, width: 16 }))];
                rs.columns = dcols;
                const hr = rs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                workingRows.forEach((r) => {
                    const row = rs.addRow([r.name, ...activeCols.map((c) => cellNumber(r, c.key))]);
                    row.eachCell((cell: any) => (cell.style = bordered));
                });
                rs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: dcols.length } };
                rs.views = [{ state: "frozen", ySplit: 1 }];
            }

            const buf = await wb.xlsx.writeBuffer();
            saveAs(
                new Blob([buf], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
                `performance-report_${localDay()}.xlsx`,
            );
            setDownloadOpen(false);
        } catch (e) {
            console.error("Performance report Excel export failed", e);
        } finally {
            setBusy("");
        }
    };

    const downloadPdf = async () => {
        if (busy) return;
        setBusy("pdf");
        try {
            const [{ default: jsPDF }, autoTableMod] = await Promise.all([
                import("jspdf"),
                import("jspdf-autotable"),
            ]);
            const autoTable: any = (autoTableMod as any).default ?? autoTableMod;

            const doc = new jsPDF({
                orientation: shouldShow("roster") ? "landscape" : "portrait",
                unit: "pt",
                format: "a4",
            });
            const pageW = doc.internal.pageSize.getWidth();
            const M = 36;
            let y = M;

            const rule = () => {
                doc.setDrawColor(229, 231, 235);
                doc.setLineWidth(0.5);
                doc.line(M, y, pageW - M, y);
                y += 12;
            };
            const h2 = (t: string) => {
                if (y > doc.internal.pageSize.getHeight() - 60) {
                    doc.addPage();
                    y = M;
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(17, 24, 39);
                doc.text(t, M, y);
                y += 14;
            };

            // Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(17, 24, 39);
            doc.text("Performance Report", M, y);
            y += 18;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text(scopeLine, M, y);
            y += 12;
            doc.text(subcatLine, M, y);
            y += 12;
            doc.text(`Grades: ${gradeLine}    ·    Generated ${new Date().toLocaleString("en-GB")}`, M, y);
            y += 12;
            rule();

            if (shouldShow("stats")) {
                h2("Summary");
                const rows: [string, string][] = [
                    ["Total students", String(stats.total)],
                    ["Avg overall %", `${stats.avgOverall}%`],
                    ["Avg selected %", stats.avgSelected === null ? "—" : `${stats.avgSelected}%`],
                    ["Avg score %", stats.avgScore === null ? "—" : `${stats.avgScore}%`],
                    ["Excellent (≥80%)", String(stats.excellent)],
                    ["At risk (<40%)", String(stats.atRisk)],
                    ["Not started", String(stats.notStarted)],
                ];
                autoTable(doc, {
                    startY: y,
                    head: [["Metric", "Value"]],
                    body: rows,
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [235, 104, 52] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("gradePie") && gradeSlices.length > 0) {
                h2("Grade distribution");
                autoTable(doc, {
                    startY: y,
                    head: [["Grade", "Students"]],
                    body: gradeSlices.map((g) => [g.name, String(g.value)]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [42, 120, 214] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("subcatBars") && subcatBars.length > 0) {
                h2("Sub-category performance");
                autoTable(doc, {
                    startY: y,
                    head: [["Activity · sub-category", "Avg %", "Learners"]],
                    body: subcatBars.map((b) => [b.label, `${b.avg}%`, String(b.learners)]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [124, 92, 252] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("courses") && courseRows.length > 0) {
                h2(`Courses (${courseRows.length})`);
                autoTable(doc, {
                    startY: y,
                    head: [["Course", "Client", "Students", "Avg %", "Completed", "In progress", "Not started"]],
                    body: courseRows.map((c) => [
                        c.name,
                        c.client,
                        String(c.students),
                        `${c.avg}%`,
                        String(c.done),
                        String(c.prog),
                        String(c.not),
                    ]),
                    styles: { fontSize: 8.5, cellPadding: 4 },
                    headStyles: { fillColor: [14, 159, 110] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("roster") && workingRows.length > 0) {
                h2(`Students (${workingRows.length})`);
                autoTable(doc, {
                    startY: y,
                    head: [["Student", ...activeCols.map((c) => c.label)]],
                    body: workingRows.map((r) => [r.name, ...activeCols.map((c) => cellText(r, c.key))]),
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [235, 104, 52] },
                    margin: { left: M, right: M },
                });
            }

            // Page numbers
            const pages = (doc as any).internal.pages.length - 1;
            const pageH = doc.internal.pageSize.getHeight();
            for (let p = 1; p <= pages; p++) {
                doc.setPage(p);
                doc.setFontSize(8);
                doc.setTextColor(156, 163, 175);
                doc.text(`Page ${p} / ${pages}`, pageW - M, pageH - 16, { align: "right" });
            }

            doc.save(`performance-report_${localDay()}.pdf`);
            setDownloadOpen(false);
        } catch (e) {
            console.error("Performance report PDF export failed", e);
        } finally {
            setBusy("");
        }
    };

    const toggleSet = <T,>(current: Set<T>, key: T): Set<T> => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    };

    // Reset back to defaults.
    const reset = () => {
        setViews(new Set(DEFAULT_VIEWS));
        setCols(new Set(DEFAULT_COLS));
        setActivities(new Set(["I_Do", "We_Do", "You_Do"]));
        setSubcats(null);
        setGrades(null);
        setStudentSel(null);
        setRemoved(new Set());
    };

    if (!open) return null;

    // Small wrapper so preview sections can carry a top-right × like the
    // Attendance Detailed Report modal.
    const Sec: React.FC<{ id: ViewKey; children: React.ReactNode }> = ({ id, children }) => (
        <section className="relative rounded-tile border border-hairline bg-surface">
            <button
                type="button"
                aria-label="Remove from preview"
                title="Remove from preview"
                onClick={() => removeSection(id)}
                className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface text-subtle hover:border-danger-500/40 hover:text-danger-500 transition-colors"
            >
                <X className="h-3 w-3" />
            </button>
            {children}
        </section>
    );

    const anySection =
        shouldShow("stats") ||
        shouldShow("gradePie") ||
        shouldShow("subcatBars") ||
        shouldShow("courses") ||
        shouldShow("roster");

    return (
        <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 backdrop-blur-[2px] p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Detailed performance report designer"
            onClick={onClose}
        >
            <div
                className="relative flex h-[94vh] w-[97vw] max-w-[1440px] overflow-hidden rounded-tile border border-hairline bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── LEFT DRAWER ───────────────────────────────────────── */}
                <aside
                    className={`flex shrink-0 flex-col border-r border-hairline bg-surface-sunken/40 transition-[width] duration-150 ${
                        drawerCollapsed ? "w-[52px]" : "w-[340px]"
                    }`}
                >
                    <header
                        className={`flex flex-shrink-0 items-center gap-2 border-b border-hairline py-3 ${
                            drawerCollapsed ? "justify-center px-2" : "px-4"
                        }`}
                    >
                        {!drawerCollapsed && (
                            <>
                                <Settings2 className="h-4 w-4 text-brand-strong shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-semibold text-heading">Report designer</h2>
                                    <p className="mt-0.5 truncate text-[10px] text-subtle">
                                        Pick what to show — preview updates as you edit.
                                    </p>
                                </div>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setDrawerCollapsed((v) => !v)}
                            aria-label={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            title={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                        >
                            {drawerCollapsed ? (
                                <ChevronsRight className="h-4 w-4" />
                            ) : (
                                <ChevronsLeft className="h-4 w-4" />
                            )}
                        </button>
                    </header>

                    {drawerCollapsed ? (
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 py-3">
                            {VIEWS.map((v) => {
                                const on = views.has(v.key);
                                const Icon = v.icon;
                                return (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => setViews(toggleSet(views, v.key))}
                                        title={v.label}
                                        aria-label={v.label}
                                        aria-pressed={on}
                                        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                                            on
                                                ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                : "border-transparent text-subtle hover:bg-row-hover hover:text-body"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
                            {/* Scope readout */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Scope
                                </h3>
                                <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] text-body">
                                    {scopeLabel || "All clients · all courses"}
                                </div>
                                <p className="mt-1 text-[10px] text-faint">
                                    Change client / course from the page filters above.
                                </p>
                            </section>

                            {/* Students */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Students ({studentSel === null ? studentOpts.length : studentSel.size} of{" "}
                                    {studentOpts.length})
                                </h3>
                                <MultiPickBox
                                    label="Students"
                                    options={studentOpts}
                                    sel={studentSel}
                                    onChange={setStudentSel}
                                    empty="No students in scope"
                                />
                            </section>

                            {/* Activities */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Activities
                                </h3>
                                <div className="space-y-1">
                                    {ACTIVITIES.map((a) => {
                                        const has = activityHas.has(a.key);
                                        const on = activities.has(a.key);
                                        return (
                                            <label
                                                key={a.key}
                                                className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover ${
                                                    has ? "" : "opacity-40 cursor-not-allowed"
                                                }`}
                                                title={has ? a.hint : `${a.label} has no content in this scope`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    disabled={!has}
                                                    onChange={() => setActivities(toggleSet(activities, a.key))}
                                                    className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[11px] font-medium text-body">
                                                        {a.label}
                                                    </span>
                                                    <span className="block truncate text-[10px] text-faint">
                                                        {a.hint}
                                                    </span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Sub-categories */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Sub-categories (
                                    {subcats === null ? filteredSubcatOpts.length : subcats.size} of{" "}
                                    {filteredSubcatOpts.length})
                                </h3>
                                <MultiPickBox
                                    label="Sub-categories"
                                    options={filteredSubcatOpts.map((o) => ({
                                        id: o.id,
                                        name: prettySubcat(o.subcat),
                                        sub: ACTIVITIES.find((a) => a.key === o.stage)?.label,
                                    }))}
                                    sel={subcats}
                                    onChange={setSubcats}
                                    empty="No sub-categories for the picked activities"
                                />
                                <p className="mt-1 text-[10px] text-faint">
                                    Only what your courses have allocated.
                                </p>
                            </section>

                            {/* Grades */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Grade filter
                                </h3>
                                <MultiPickBox
                                    label="Grades"
                                    options={gradeOpts}
                                    sel={grades as Set<string> | null}
                                    onChange={(s) => setGrades(s as Set<GradeKey> | null)}
                                />
                                <p className="mt-1 text-[10px] text-faint">
                                    Bands 0/40/60/80 on the picked % (falls back to overall).
                                </p>
                            </section>

                            {/* Views */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Views
                                </h3>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {VIEWS.map((v) => {
                                        const on = views.has(v.key);
                                        const Icon = v.icon;
                                        return (
                                            <button
                                                key={v.key}
                                                type="button"
                                                onClick={() => setViews(toggleSet(views, v.key))}
                                                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                                    on
                                                        ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                        : "border-hairline bg-surface text-subtle hover:border-hairline-strong hover:text-body"
                                                }`}
                                            >
                                                <Icon className="h-3.5 w-3.5" /> {v.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Roster columns */}
                            <section
                                aria-disabled={!views.has("roster")}
                                className={views.has("roster") ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Roster columns
                                </h3>
                                <div className="space-y-1">
                                    {COLUMNS.map((c) => {
                                        const on = cols.has(c.key);
                                        return (
                                            <label
                                                key={c.key}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover"
                                                title={c.hint}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => setCols(toggleSet(cols, c.key))}
                                                    className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[11px] font-medium text-body">
                                                        {c.label}
                                                    </span>
                                                    <span className="block truncate text-[10px] text-faint">
                                                        {c.hint}
                                                    </span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}

                    {!drawerCollapsed && (
                        <footer className="flex-shrink-0 border-t border-hairline px-4 py-2">
                            <button
                                type="button"
                                onClick={reset}
                                className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[11px] font-medium text-body hover:bg-row-hover transition-colors"
                            >
                                Reset to defaults
                            </button>
                        </footer>
                    )}
                </aside>

                {/* ─── RIGHT CANVAS ──────────────────────────────────────── */}
                <div className="flex flex-1 min-w-0 flex-col">
                    <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-2.5">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-heading">
                                Performance Report
                            </h2>
                            <p className="mt-0.5 truncate text-[10px] text-subtle tabular-nums">
                                {scopeLine} · {gradeLine}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div ref={downloadRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDownloadOpen((v) => !v)}
                                    disabled={!!busy || workingRows.length === 0}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-brand-500 bg-brand-500 text-white text-xs font-semibold hover:bg-brand-strong disabled:opacity-50 transition-colors"
                                >
                                    {busy ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Download className="h-3.5 w-3.5" />
                                    )}
                                    Download report
                                    <ChevronDown
                                        className={`h-3 w-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`}
                                    />
                                </button>
                                {downloadOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg z-10">
                                        <button
                                            type="button"
                                            onClick={downloadExcel}
                                            disabled={!!busy}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors disabled:opacity-50"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-success-500" /> Excel (.xlsx)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadPdf}
                                            disabled={!!busy}
                                            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors disabled:opacity-50"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-danger-500" /> PDF (.pdf)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 overflow-y-auto bg-surface-sunken/20 px-5 py-4 space-y-4">
                        {/* Restore-strip: any sections dropped with × can be brought back here. */}
                        {removed.size > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-hairline bg-surface/60 px-3 py-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Removed
                                </span>
                                {[...removed].map((k) => {
                                    const meta = VIEWS.find((v) => v.key === k);
                                    if (!meta) return null;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => restoreSection(k)}
                                            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-medium text-body hover:border-brand-500 hover:text-brand-strong transition-colors"
                                            title="Restore section"
                                        >
                                            + {meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}

                        {!anySection ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                                <Settings2 className="h-8 w-8 text-faint" />
                                <p className="text-sm font-medium text-body">Nothing on the canvas yet</p>
                                <p className="text-xs text-subtle">Pick at least one view from the left panel.</p>
                            </div>
                        ) : workingRows.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                No students match this filter — loosen a grade / activity choice.
                            </div>
                        ) : (
                            <>
                                {shouldShow("stats") ? (
                                    <Sec id="stats">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Summary</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {stats.total} students in scope
                                            </span>
                                        </header>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
                                            <Stat label="Avg overall" value={`${stats.avgOverall}%`} />
                                            <Stat
                                                label="Avg selected"
                                                value={stats.avgSelected === null ? "—" : `${stats.avgSelected}%`}
                                                hint="across picked activities + sub-cats"
                                            />
                                            <Stat
                                                label="Avg score"
                                                value={stats.avgScore === null ? "—" : `${stats.avgScore}%`}
                                                hint="marks on We/You Do work"
                                            />
                                            <Stat
                                                label="Excellent"
                                                value={stats.excellent}
                                                tone="good"
                                                hint="picked ≥ 80%"
                                            />
                                            <Stat
                                                label="At risk"
                                                value={stats.atRisk}
                                                tone={stats.atRisk > 0 ? "bad" : "good"}
                                                hint="picked < 40%"
                                            />
                                            <Stat label="Not started" value={stats.notStarted} tone="muted" />
                                            <Stat label="Students" value={stats.total} />
                                            <Stat
                                                label="Sub-cats"
                                                value={`${activeSubcatOpts.length}/${filteredSubcatOpts.length}`}
                                                hint="picked / available"
                                            />
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("gradePie") ? (
                                    <Sec id="gradePie">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">
                                                Grade distribution
                                            </h3>
                                            <span className="text-[10px] text-subtle">
                                                bands on the picked %
                                            </span>
                                        </header>
                                        <div className="h-64">
                                            {gradeSlices.length === 0 ? (
                                                <div className="flex h-full items-center justify-center text-xs text-subtle">
                                                    Nothing to grade in the current selection.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            dataKey="value"
                                                            nameKey="name"
                                                            data={gradeSlices}
                                                            innerRadius={55}
                                                            outerRadius={90}
                                                            paddingAngle={2}
                                                        >
                                                            {gradeSlices.map((s, i) => (
                                                                <Cell key={i} fill={s.color} />
                                                            ))}
                                                        </Pie>
                                                        <RTooltip />
                                                        <RLegend
                                                            verticalAlign="bottom"
                                                            height={30}
                                                            iconType="circle"
                                                            wrapperStyle={{ fontSize: 11 }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("subcatBars") ? (
                                    <Sec id="subcatBars">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">
                                                Sub-category performance
                                            </h3>
                                            <span className="text-[10px] text-subtle">
                                                avg % per activity · sub-cat
                                            </span>
                                        </header>
                                        <div className="h-72">
                                            {subcatBars.length === 0 ? (
                                                <div className="flex h-full items-center justify-center text-xs text-subtle">
                                                    No sub-categories in the selection.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={subcatBars.map((b) => ({
                                                            name: b.label,
                                                            avg: b.avg,
                                                        }))}
                                                        margin={{ top: 8, right: 16, left: 0, bottom: 60 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                        <XAxis
                                                            dataKey="name"
                                                            tick={{ fontSize: 10 }}
                                                            angle={-20}
                                                            textAnchor="end"
                                                            interval={0}
                                                            height={70}
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 10 }}
                                                            domain={[0, 100]}
                                                            tickFormatter={(v) => `${v}%`}
                                                        />
                                                        <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                                            {subcatBars.map((b, i) => (
                                                                <Cell
                                                                    key={i}
                                                                    fill={
                                                                        b.avg >= 80
                                                                            ? "#0E9F6E"
                                                                            : b.avg >= 60
                                                                                ? "#2E90C4"
                                                                                : b.avg >= 40
                                                                                    ? "#C77700"
                                                                                    : "#B42318"
                                                                    }
                                                                />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("courses") ? (
                                    <Sec id="courses">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Courses</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {courseRows.length} in scope
                                            </span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        {["Course", "Client", "Students", "Avg %", "Completed", "In progress", "Not started"].map((h, i) => (
                                                            <th
                                                                key={h}
                                                                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline ${i > 1 ? "text-right" : "text-left"}`}
                                                            >
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {courseRows.map((c) => (
                                                        <tr
                                                            key={c.id}
                                                            className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors"
                                                        >
                                                            <td className="px-3 py-2 text-xs font-semibold text-heading">
                                                                {c.name}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-body">
                                                                {c.client}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs tabular-nums text-body">
                                                                {c.students}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs tabular-nums text-body">
                                                                <span
                                                                    className={`font-semibold ${
                                                                        c.avg >= 80
                                                                            ? "text-success-500"
                                                                            : c.avg >= 40
                                                                                ? "text-warn-500"
                                                                                : "text-danger-500"
                                                                    }`}
                                                                >
                                                                    {c.avg}%
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs tabular-nums text-body">
                                                                {c.done}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs tabular-nums text-body">
                                                                {c.prog}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs tabular-nums text-body">
                                                                {c.not}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("roster") ? (
                                    <Sec id="roster">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Roster</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {workingRows.length} students · {activeCols.length + 1} columns
                                            </span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                                                            #
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                                                            Student
                                                        </th>
                                                        {activeCols.map((c) => (
                                                            <th
                                                                key={c.key}
                                                                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline ${c.r ? "text-right" : "text-left"}`}
                                                            >
                                                                {c.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {workingRows.map((r, i) => (
                                                        <tr
                                                            key={`${r.pid}-${r.courseId}`}
                                                            className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors"
                                                        >
                                                            <td className="px-3 py-2 text-[10px] tabular-nums text-faint">
                                                                {String(i + 1).padStart(2, "0")}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="truncate text-xs font-semibold text-heading">
                                                                    {r.name}
                                                                </div>
                                                                {r.email && (
                                                                    <div className="truncate text-[10px] text-subtle">
                                                                        {r.email}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {activeCols.map((c) => (
                                                                <td
                                                                    key={c.key}
                                                                    className={`px-3 py-2 text-xs text-body ${c.r ? "text-right tabular-nums" : ""}`}
                                                                >
                                                                    {c.key === "grade" ? (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                                                                            style={{
                                                                                background: `${gradeColor(r.grade)}17`,
                                                                                color: gradeColor(r.grade),
                                                                            }}
                                                                        >
                                                                            {gradeLabel(r.grade)}
                                                                        </span>
                                                                    ) : (
                                                                        cellText(r, c.key)
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Sec>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Small stat tile used by the summary section.
function Stat({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: string | number;
    hint?: string;
    tone?: "good" | "bad" | "muted" | "brand";
}) {
    const color =
        tone === "good"
            ? "text-success-500"
            : tone === "bad"
                ? "text-danger-500"
                : tone === "muted"
                    ? "text-subtle"
                    : "text-heading";
    return (
        <div className="rounded-md border border-hairline bg-surface px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</div>
            <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
            {hint ? <div className="mt-0.5 text-[10px] text-faint">{hint}</div> : null}
        </div>
    );
}
