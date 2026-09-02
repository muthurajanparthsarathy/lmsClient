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
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Download,
    FileSpreadsheet,
    FileText,
    Layers,
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
import { useQuery } from "@tanstack/react-query";
import { courseDataApi } from "@/apiServices/coursesData";
import {
    computeStudentMarks,
    findExerciseInCourseData,
    getDynamicExerciseTotal,
    getExerciseGradeBands,
    getStudentQuestionsBreakdown,
    scaleForPercent,
    type QuestionBreakdownRow,
} from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";

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
    /** Selected client / course names for the drawer readout — shown as their
     *  own labeled rows ("Course: X · Client: Y") instead of one vague
     *  "Scope" string. Empty / "all" means no narrowing. */
    clientName?: string;
    courseName?: string;
    /** Set only when the page filter is narrowed to ONE course — enables the
     *  per-assignment / per-question drilldown, which needs the heavy
     *  /getAll/courses-data payload (pedagogy + participant answers). */
    courseId?: string;
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
type ViewKey = "stats" | "activities" | "gradePie" | "subcatBars" | "courses" | "roster" | "exerciseDetail";
const VIEWS: { key: ViewKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "stats", label: "Summary stats", icon: SlidersHorizontal },
    { key: "activities", label: "I Do · We Do · You Do", icon: PieIcon },
    { key: "gradePie", label: "Grade distribution", icon: BarChart3 },
    { key: "subcatBars", label: "Sub-category bars", icon: BarChart3 },
    { key: "courses", label: "Courses table", icon: TableIcon },
    { key: "roster", label: "Roster (with grade)", icon: TableIcon },
    { key: "exerciseDetail", label: "Assignment / Assessment detail", icon: Layers },
];

// Fixed identity colors for the three pedagogy stages — used by the Activities
// pie + bar so I Do / We Do / You Do read the same in preview and PDF.
const ACTIVITY_SPLIT: { key: "iDo" | "weDo" | "youDo"; label: string; color: string; hint: string }[] = [
    { key: "iDo", label: "I Do", color: "#2E90C4", hint: "instructor-led" },
    { key: "weDo", label: "We Do", color: "#F97316", hint: "guided practice" },
    { key: "youDo", label: "You Do", color: "#0E9F6E", hint: "independent work" },
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
const DEFAULT_VIEWS: ViewKey[] = ["stats", "activities", "gradePie", "subcatBars", "roster"];

// ─── Per-exercise drilldown (mirrors assignment Dashboard → Reports view) ─
// Summary columns shown on the outer roster row (like SUMMARY_COLUMNS in
// courses/manageUsers/reports/components/ReportExportModal). Student Name +
// Email are always on — the picker toggles the rest.
type SumColKey =
    | "totalQ"
    | "completed"
    | "nonCompleted"
    | "testStatus"
    | "totalMarks"
    | "scoredMarks"
    | "percentage"
    | "scale";

const SUM_COLS: { key: SumColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "totalQ", label: "Total Questions", hint: "Questions on the exercise", r: true },
    { key: "completed", label: "Completed", hint: "Answered questions", r: true },
    { key: "nonCompleted", label: "Non Completed", hint: "Skipped / unanswered", r: true },
    { key: "testStatus", label: "Test Status", hint: "Not Started / Started / Submitted" },
    { key: "totalMarks", label: "Total Marks", hint: "Max marks for the exercise", r: true },
    { key: "scoredMarks", label: "Scored Marks", hint: "Marks the student earned", r: true },
    { key: "percentage", label: "Percentage", hint: "scored / total × 100", r: true },
    { key: "scale", label: "Scale", hint: "Grade band (per-exercise gradeSettings, else default)" },
];
const DEFAULT_SUM_COLS: SumColKey[] = [
    "totalQ",
    "completed",
    "nonCompleted",
    "testStatus",
    "totalMarks",
    "scoredMarks",
    "percentage",
    "scale",
];

// Per-question detail columns (inner table when a student row is expanded).
// Same catalogue as DETAIL_COLUMNS in ReportExportModal so the two flows
// stay visually consistent.
type QColKey =
    | "qno"
    | "title"
    | "type"
    | "status"
    | "totalMark"
    | "scoredMark"
    | "submittedAt"
    | "timeTaken";

const Q_COLS: { key: QColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "qno", label: "Q. No.", hint: "Question number", r: true },
    { key: "title", label: "Title", hint: "Question title" },
    { key: "type", label: "Type", hint: "MCQ / Programming / etc." },
    { key: "status", label: "Status", hint: "Evaluated / Submitted / Not Answered / Pending" },
    { key: "totalMark", label: "Total Mark", hint: "Max mark for this question", r: true },
    { key: "scoredMark", label: "Scored Mark", hint: "Mark this student earned", r: true },
    { key: "submittedAt", label: "Submitted At", hint: "Timestamp of last submission" },
    { key: "timeTaken", label: "Time Taken", hint: "Wall-clock time on this question" },
];
const DEFAULT_Q_COLS: QColKey[] = [
    "qno",
    "title",
    "type",
    "status",
    "totalMark",
    "scoredMark",
    "submittedAt",
    "timeTaken",
];

// One entry per assignment / assessment discovered in the course pedagogy.
// Path = "Module → (Sub-module → )Topic → (Sub-topic → )Sub-category" so a
// head glancing at the list knows which cell of the syllabus each exercise
// lives under.
type CatalogueEx = {
    id: string;
    name: string;
    path: string;
    stage: "We_Do" | "You_Do";
    subCategory: string;
    exercise: any;
    totalMarks: number;
    totalQuestions: number;
};

const SUBCAT_INCLUDE = new Set([
    // We_Do
    "assignments", "assignment", "practical", "project_development", "assessments", "assesments",
    // You_Do
    "assessment", "Assessment", "assesment",
]);

function walkCatalogue(courseData: any): CatalogueEx[] {
    if (!courseData?.modules || !Array.isArray(courseData.modules)) return [];
    const out: CatalogueEx[] = [];
    const seen = new Set<string>();

    const scan = (pedagogy: any, path: string) => {
        if (!pedagogy) return;
        (["We_Do", "You_Do"] as const).forEach((stage) => {
            const tabData = pedagogy[stage];
            if (!tabData || typeof tabData !== "object") return;
            for (const [rawKey, list] of Object.entries(tabData)) {
                if (!Array.isArray(list)) continue;
                if (!SUBCAT_INCLUDE.has(rawKey)) continue;
                for (const ex of list as any[]) {
                    const id = String(ex?._id || ex?.exerciseInformation?.exerciseId || "");
                    if (!id || seen.has(id)) continue;
                    seen.add(id);
                    const name =
                        ex?.exerciseInformation?.exerciseName ||
                        ex?.title ||
                        ex?.name ||
                        "Untitled exercise";
                    const subCategory = prettySubcat(rawKey);
                    const fullPath = `${path} · ${ACTIVITIES.find((a) => a.key === stage)?.label} · ${subCategory}`;
                    out.push({
                        id,
                        name,
                        path: fullPath,
                        stage,
                        subCategory,
                        exercise: ex,
                        totalMarks: getDynamicExerciseTotal(ex),
                        totalQuestions: Array.isArray(ex?.questions) ? ex.questions.length : 0,
                    });
                }
            }
        });
    };

    for (const mod of courseData.modules) {
        const mPath = mod?.title || "Module";
        scan(mod?.pedagogy, mPath);

        for (const topic of mod?.topics || []) {
            const tPath = `${mPath} → ${topic?.title || "Topic"}`;
            scan(topic?.pedagogy, tPath);
            for (const st of topic?.subTopics || []) {
                scan(st?.pedagogy, `${tPath} → ${st?.title || "Subtopic"}`);
            }
        }

        for (const sub of mod?.subModules || []) {
            const sPath = `${mPath} → ${sub?.title || "Sub-module"}`;
            scan(sub?.pedagogy, sPath);
            for (const topic of sub?.topics || []) {
                const tPath = `${sPath} → ${topic?.title || "Topic"}`;
                scan(topic?.pedagogy, tPath);
                for (const st of topic?.subTopics || []) {
                    scan(st?.pedagogy, `${tPath} → ${st?.title || "Subtopic"}`);
                }
            }
        }
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Time formatter (HH:MM:SS or MM:SS) matching ReportExportModal so the
// detail rows line up with what the assignment Reports flow shows.
const fmtTime = (secs: number | null | undefined): string => {
    if (typeof secs !== "number" || !Number.isFinite(secs) || secs <= 0) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const fmtDateT = (iso: string | null): string => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return iso;
    }
};

const Q_STATUS_LABEL: Record<QuestionBreakdownRow["status"], string> = {
    evaluated: "Evaluated",
    submitted: "Submitted",
    not_answered: "Not Answered",
    pending: "Pending",
};
const Q_STATUS_TONE: Record<QuestionBreakdownRow["status"], string> = {
    evaluated: "bg-success-500/15 text-success-500",
    submitted: "bg-brand-500/15 text-brand-strong",
    not_answered: "bg-danger-500/15 text-danger-500",
    pending: "bg-subtle/15 text-subtle",
};

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
    clientName,
    courseName,
    courseId,
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

    // Per-exercise drilldown state — mirrors assignment Dashboard → Reports.
    const [exSel, setExSel] = useState<Set<string> | null>(new Set()); // picked assignments/assessments (null = all)
    const [sumCols, setSumCols] = useState<Set<SumColKey>>(new Set(DEFAULT_SUM_COLS));
    const [qCols, setQCols] = useState<Set<QColKey>>(new Set(DEFAULT_Q_COLS));
    // Which (exerciseId:studentId) rows are expanded to show per-question detail.
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    // Detailed toggle mirrors the assignment Reports view: when off, the
    // roster rows have no chevron and can't expand (the summary IS the whole
    // row); when on, each row can drill into the per-question inner table.
    const [detailed, setDetailed] = useState(true);

    // Fetch full course data ONLY when a single course is in scope — the
    // pedagogy tree + participant answers are what powers per-question detail.
    // Uses the SAME cache key `["course", id, activeBatchId]` the review /
    // reports pages read, so no duplicate request when they've already loaded it.
    const courseDataQuery = useQuery({
        ...(courseId ? courseDataApi.getById(courseId) : { queryKey: ["course-detail-skip"], queryFn: async () => null as any }),
        enabled: !!courseId && open,
    });
    const courseData = (courseDataQuery.data as any)?.data ?? null;

    // Catalogue of picked-able assignments/assessments (empty when multi-course scope).
    const catalogue = useMemo(() => walkCatalogue(courseData), [courseData]);
    // Participants keyed by student id for O(1) marks lookup per exercise.
    const participants = useMemo(() => {
        if (!courseData) return new Map<string, any>();
        const flat: any[] = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
        const byId = new Map<string, any>();
        for (const p of flat) {
            const id = String(p?.user?._id || p?._id || "");
            if (id) byId.set(id, p);
        }
        return byId;
    }, [courseData]);

    const downloadRef = useRef<HTMLDivElement>(null);
    // Live preview section nodes, keyed by ViewKey. The PDF export rasterises
    // the recharts <svg> found inside chart sections (gradePie, subcatBars) so
    // the downloaded file carries the SAME graphs the canvas shows — the
    // tables alone used to stand in for them. Same pattern as the Attendance
    // Detailed Report modal (AttendanceReportModal.svgToPng).
    const chartRefs = useRef<Record<string, HTMLElement | null>>({});

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
        setExSel(new Set());
        setExpanded(new Set());
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

    // Per-activity (I Do / We Do / You Do) mean completion across the surviving
    // rows — the readable split the flat "Avg overall %" card never gave.
    // null = no student carries that stage (e.g. a course with no I Do work).
    const activitySplit = useMemo(
        () =>
            ACTIVITY_SPLIT.map((a) => {
                const vals = workingRows
                    .map((r) => r[a.key] as number | null)
                    .filter((v): v is number => v !== null);
                return {
                    ...a,
                    avg: vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null,
                    learners: vals.length,
                };
            }),
        [workingRows],
    );
    const activityChartRows = activitySplit.filter((a) => a.avg !== null) as Array<
        (typeof activitySplit)[number] & { avg: number }
    >;

    // ── Per-exercise drilldown data ──────────────────────────────────────
    // Which of the catalogue's exercises are actually selected. `null` = all,
    // empty Set = none (initial state — user hasn't picked yet).
    const activeExercises = useMemo(() => {
        if (!catalogue.length) return [] as CatalogueEx[];
        if (exSel === null) return catalogue;
        return catalogue.filter((e) => exSel.has(e.id));
    }, [catalogue, exSel]);

    // For each selected exercise, compute one summary row per surviving
    // student in scope (workingRows). Heavy: iterates rows × exercises and
    // walks the answer tree for each — but only for what the head picked.
    type ExRosterRow = {
        pid: string;
        name: string;
        email: string;
        totalMarks: number;
        scoredMarks: number | null;
        totalQuestions: number;
        completed: number;
        nonCompleted: number;
        hasSubmitted: boolean;
        parentSubmitted: boolean;
        testStatus: "not-started" | "started" | "submitted";
        percentage: number | null;
        scale: string;
    };
    type ExRoster = {
        ex: CatalogueEx;
        gradeBands: ReturnType<typeof getExerciseGradeBands>;
        rows: ExRosterRow[];
        stats: {
            students: number;
            submitted: number;
            started: number;
            notStarted: number;
            avgPct: number | null;
            passCount: number;
            failCount: number;
        };
    };

    const exerciseRosters = useMemo<ExRoster[]>(() => {
        if (!courseData || activeExercises.length === 0 || workingRows.length === 0) return [];
        const out: ExRoster[] = [];
        for (const ex of activeExercises) {
            const gradeBands = getExerciseGradeBands(courseData, ex.id);
            const rows: ExRosterRow[] = [];
            for (const w of workingRows) {
                const participant = participants.get(w.pid);
                if (!participant) {
                    rows.push({
                        pid: w.pid,
                        name: w.name,
                        email: w.email,
                        totalMarks: ex.totalMarks,
                        scoredMarks: null,
                        totalQuestions: ex.totalQuestions,
                        completed: 0,
                        nonCompleted: ex.totalQuestions,
                        hasSubmitted: false,
                        parentSubmitted: false,
                        testStatus: "not-started",
                        percentage: null,
                        scale: "",
                    });
                    continue;
                }
                const marks = computeStudentMarks({
                    courseData,
                    courseId: courseId || "",
                    exerciseId: ex.id,
                    participant,
                });
                const totalMarks = marks.totalMarks || ex.totalMarks || 0;
                const totalQuestions = marks.totalQuestions || ex.totalQuestions || 0;
                const completed = marks.completedQuestions || 0;
                const nonCompleted = Math.max(0, totalQuestions - completed);
                const hasSubmitted = marks.hasSubmitted;
                const parentSubmitted = marks.parentSubmitted;
                const testStatus: ExRosterRow["testStatus"] = parentSubmitted
                    ? "submitted"
                    : hasSubmitted
                        ? "started"
                        : "not-started";
                const pct =
                    hasSubmitted && totalMarks > 0
                        ? Math.round((marks.scoredMarks / totalMarks) * 1000) / 10
                        : null;
                const scale = pct !== null ? scaleForPercent(pct, gradeBands) : "";
                rows.push({
                    pid: w.pid,
                    name: w.name,
                    email: w.email,
                    totalMarks,
                    scoredMarks: hasSubmitted ? marks.scoredMarks : null,
                    totalQuestions,
                    completed,
                    nonCompleted,
                    hasSubmitted,
                    parentSubmitted,
                    testStatus,
                    percentage: pct,
                    scale,
                });
            }
            // Roll-up stats for the per-exercise header strip.
            let submitted = 0, started = 0, notStarted = 0, pass = 0, fail = 0;
            const pcts: number[] = [];
            const PASS = 50;
            for (const r of rows) {
                if (r.testStatus === "submitted") submitted++;
                else if (r.testStatus === "started") started++;
                else notStarted++;
                if (r.percentage !== null) {
                    pcts.push(r.percentage);
                    if (r.percentage >= PASS) pass++; else fail++;
                }
            }
            const avgPct = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null;
            out.push({
                ex,
                gradeBands,
                rows,
                stats: { students: rows.length, submitted, started, notStarted, avgPct, passCount: pass, failCount: fail },
            });
        }
        return out;
    }, [courseData, activeExercises, workingRows, participants, courseId]);

    // Per-question breakdown for expanded rows only. Recomputed lazily via
    // memo keyed on the expanded set + participants, so re-renders that don't
    // change expansion don't re-walk the answer tree.
    const breakdowns = useMemo(() => {
        const map = new Map<string, QuestionBreakdownRow[]>();
        if (!courseData || expanded.size === 0) return map;
        for (const key of expanded) {
            const [exId, pid] = key.split(":");
            if (!exId || !pid) continue;
            const participant = participants.get(pid);
            if (!participant) { map.set(key, []); continue; }
            const rows = getStudentQuestionsBreakdown({
                courseData,
                courseId: courseId || "",
                exerciseId: exId,
                participant,
                studentSubmitted: true,
            });
            map.set(key, rows);
        }
        return map;
    }, [expanded, courseData, participants, courseId]);

    const toggleExpanded = (exId: string, pid: string) => {
        const key = `${exId}:${pid}`;
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

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
                    // Per-activity averages instead of the blended "Avg overall %".
                    ...activitySplit.map((a): [string, string] => [
                        `${a.label} avg % (${a.hint})`,
                        a.avg === null ? "N/A" : `${a.avg}%`,
                    ]),
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
            if (shouldShow("activities")) {
                ws.addRow([]);
                const h = ws.addRow(["Activity", "Avg %", "Learners"]);
                h.eachCell((c: any) => (c.style = header));
                activitySplit.forEach((a) => {
                    const row = ws.addRow([`${a.label} (${a.hint})`, a.avg === null ? "N/A" : `${a.avg}%`, a.learners]);
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

            // Per-exercise sheets (one per selected assignment / assessment).
            // Sheet name is truncated to Excel's 31-char cap; the header row
            // carries the full exercise + path so nothing gets lost.
            if (shouldShow("exerciseDetail") && exerciseRosters.length > 0) {
                const truncate = (s: string) => s.replace(/[\\\/\?\*\[\]:]/g, "").slice(0, 28);
                const activeSum = SUM_COLS.filter((c) => sumCols.has(c.key));
                const activeQ = Q_COLS.filter((c) => qCols.has(c.key));
                exerciseRosters.forEach((er, idx) => {
                    const sName = truncate(`${idx + 1} ${er.ex.name}`) || `Exercise ${idx + 1}`;
                    const es = wb.addWorksheet(sName);
                    es.addRow([er.ex.name]).getCell(1).style = { font: { bold: true, size: 13 } };
                    es.addRow([er.ex.path]);
                    es.addRow([`Total: ${er.ex.totalMarks} marks · ${er.ex.totalQuestions} questions`]);
                    es.addRow([`Submitted ${er.stats.submitted} · Started ${er.stats.started} · Not started ${er.stats.notStarted} · Avg ${er.stats.avgPct === null ? "—" : er.stats.avgPct + "%"}`]);
                    es.addRow([]);
                    const head = ["#", "Student", "Email", ...activeSum.map((c) => c.label)];
                    const hr = es.addRow(head);
                    hr.eachCell((c: any) => (c.style = header));
                    er.rows.forEach((r, i) => {
                        const row = es.addRow([
                            i + 1,
                            r.name,
                            r.email,
                            ...activeSum.map((c) => {
                                switch (c.key) {
                                    case "totalQ": return r.totalQuestions;
                                    case "completed": return r.completed;
                                    case "nonCompleted": return r.nonCompleted;
                                    case "testStatus":
                                        return r.testStatus === "submitted"
                                            ? "Submitted"
                                            : r.testStatus === "started"
                                                ? "Started"
                                                : "Not Started";
                                    case "totalMarks": return r.totalMarks || "";
                                    case "scoredMarks": return typeof r.scoredMarks === "number" ? r.scoredMarks : "";
                                    case "percentage": return r.percentage === null ? "" : `${r.percentage}%`;
                                    case "scale": return r.scale || "";
                                    default: return "";
                                }
                            }),
                        ]);
                        row.eachCell((c: any) => (c.style = bordered));
                    });
                    es.columns.forEach((c: any) => (c.width = Math.max(12, String(c.header || "").length + 2)));

                    // Detailed mode → append one per-question block per student that has any answers.
                    if (detailed && activeQ.length > 0) {
                        for (const r of er.rows) {
                            const participant = participants.get(r.pid);
                            if (!participant) continue;
                            const bd = getStudentQuestionsBreakdown({
                                courseData,
                                courseId: courseId || "",
                                exerciseId: er.ex.id,
                                participant,
                                studentSubmitted: true,
                            });
                            if (!bd.length) continue;
                            es.addRow([]);
                            const label = es.addRow([`Detail — ${r.name}${r.email ? ` (${r.email})` : ""}`]);
                            label.getCell(1).style = { font: { bold: true } };
                            const qh = es.addRow(activeQ.map((c) => c.label));
                            qh.eachCell((c: any) => (c.style = header));
                            for (const q of bd) {
                                const qrow = es.addRow(
                                    activeQ.map((c) => {
                                        switch (c.key) {
                                            case "qno": return q.questionNo;
                                            case "title": return q.title;
                                            case "type": return q.type;
                                            case "status": return Q_STATUS_LABEL[q.status];
                                            case "totalMark": return q.totalMark;
                                            case "scoredMark":
                                                return q.status === "pending" || q.status === "not_answered"
                                                    ? ""
                                                    : q.scoredMark;
                                            case "submittedAt": return fmtDateT(q.submittedAt);
                                            case "timeTaken": return fmtTime(q.timeTakenSeconds);
                                            default: return "";
                                        }
                                    }),
                                );
                                qrow.eachCell((c: any) => (c.style = bordered));
                            }
                        }
                    }
                });
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

    // Rasterise a rendered chart section into a PNG data URL: serialise the
    // recharts <svg>, load it into an <img>, draw onto a 2× canvas for crisp
    // print. No extra deps (html2canvas isn't installed). Ported verbatim from
    // features/attendancemanagement/AttendanceReportModal.tsx.
    const svgToPng = async (container: HTMLElement | null): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        if (!container) return null;
        // MUST target the recharts surface: the section's × remove button is a
        // lucide icon — also an <svg>, and FIRST in DOM order — so a bare
        // querySelector("svg") captures a giant ✗ instead of the chart.
        const svg = container.querySelector(".recharts-wrapper svg.recharts-surface")
            || container.querySelector(".recharts-wrapper svg");
        if (!svg) return null;
        const box = svg.getBoundingClientRect();
        const clone = svg.cloneNode(true) as SVGSVGElement;
        // Recharts sizes via ResponsiveContainer at runtime, so the cloned
        // SVG needs explicit dimensions or img.decode() falls over.
        clone.setAttribute("width", String(Math.max(1, Math.round(box.width))));
        clone.setAttribute("height", String(Math.max(1, Math.round(box.height))));
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.decoding = "async";
            img.src = url;
            await img.decode();
            const scale = 2;
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(box.width * scale));
            canvas.height = Math.max(1, Math.round(box.height * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) return null;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return { dataUrl: canvas.toDataURL("image/png"), width: box.width, height: box.height };
        } finally {
            URL.revokeObjectURL(url);
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
            // Embed the live chart exactly as the canvas shows it (the data
            // table still follows as the numeric appendix). `legend` re-draws
            // the on-screen legend with jsPDF primitives — recharts renders
            // its legend as an HTML div OUTSIDE the svg, so the capture alone
            // would ship an unlabeled pie.
            const addChartImage = async (key: string, legend?: Array<{ label: string; color: string }>) => {
                const shot = await svgToPng(chartRefs.current[key]);
                if (!shot) return;
                const pageH = doc.internal.pageSize.getHeight();
                const ratio = shot.width / shot.height;
                let w = pageW - M * 2;
                let h = w / ratio;
                if (h > pageH - M * 2) { h = pageH - M * 2; w = h * ratio; }
                if (y + h > pageH - M) { doc.addPage(); y = M; }
                doc.addImage(shot.dataUrl, "PNG", M, y, w, h);
                y += h + 6;
                if (legend && legend.length > 0) {
                    if (y + 14 > pageH - M) { doc.addPage(); y = M; }
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8.5);
                    let x = M;
                    for (const item of legend) {
                        const label = item.label;
                        const itemW = 10 + doc.getTextWidth(label) + 14;
                        if (x + itemW > pageW - M) { x = M; y += 12; }
                        const rgb = hexToRgb(item.color);
                        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                        doc.circle(x + 3, y - 3, 3, "F");
                        doc.setTextColor(55, 65, 81);
                        doc.text(label, x + 10, y);
                        x += itemW;
                    }
                    y += 12;
                }
                y += 4;
            };
            const hexToRgb = (hex: string): [number, number, number] => {
                const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
                if (!m) return [107, 114, 128];
                const n = parseInt(m[1], 16);
                return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
                    // Per-activity averages instead of the old blended
                    // "Avg overall %" — mirrors the canvas tiles.
                    ...activitySplit.map((a): [string, string] => [
                        `${a.label} avg % (${a.hint})`,
                        a.avg === null ? "N/A" : `${a.avg}%`,
                    ]),
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

            if (shouldShow("activities") && activityChartRows.length > 0) {
                h2("Activities — I Do · We Do · You Do");
                await addChartImage("activitiesPie", activityChartRows.map((a) => ({ label: `${a.label} (${a.avg}%)`, color: a.color })));
                await addChartImage("activitiesBar");
                autoTable(doc, {
                    startY: y,
                    head: [["Activity", "Avg %", "Learners"]],
                    body: activitySplit.map((a) => [
                        `${a.label} (${a.hint})`,
                        a.avg === null ? "N/A" : `${a.avg}%`,
                        String(a.learners),
                    ]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [46, 144, 196] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("gradePie") && gradeSlices.length > 0) {
                // Table only — the canvas renders labeled count bars, not a
                // chart, so there is nothing to rasterise here any more.
                h2("Grade distribution");
                autoTable(doc, {
                    startY: y,
                    head: [["Grade", "Students", "% of scope"]],
                    body: gradeSlices.map((g) => [
                        g.name,
                        String(g.value),
                        stats.total ? `${Math.round((g.value / stats.total) * 100)}%` : "0%",
                    ]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [42, 120, 214] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }

            if (shouldShow("subcatBars") && subcatBars.length > 0) {
                h2("Sub-category performance");
                await addChartImage("subcatBars");
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
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
            }

            // Per-exercise detail — one section per selected exercise.
            // Subsequent exercises start on a fresh page (so a head can print
            // + hand out slices); the FIRST exercise reuses whatever room is
            // still free on the current page — otherwise page 1 sits mostly
            // blank whenever the header is the only thing above.
            if (shouldShow("exerciseDetail") && exerciseRosters.length > 0) {
                const activeSum = SUM_COLS.filter((c) => sumCols.has(c.key));
                const activeQ = Q_COLS.filter((c) => qCols.has(c.key));
                const pageH = doc.internal.pageSize.getHeight();
                // Room needed to open an exercise inline: title + stats line
                // + a few table rows. Below this, force a fresh page.
                const MIN_INLINE_ROOM = 160;
                exerciseRosters.forEach((er, exIdx) => {
                    if (exIdx > 0 || pageH - y < MIN_INLINE_ROOM) {
                        doc.addPage();
                        y = M;
                    } else {
                        // Small breather so the exercise heading doesn't butt
                        // up against the section above (rule / previous table).
                        y += 6;
                    }
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(13);
                    doc.setTextColor(17, 24, 39);
                    doc.text(er.ex.name, M, y);
                    y += 16;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(107, 114, 128);
                    doc.text(
                        `${er.ex.totalQuestions} questions · ${er.ex.totalMarks} marks · Submitted ${er.stats.submitted} · Started ${er.stats.started} · Not started ${er.stats.notStarted} · Avg ${er.stats.avgPct === null ? "—" : er.stats.avgPct + "%"}`,
                        M,
                        y,
                    );
                    y += 14;

                    autoTable(doc, {
                        startY: y,
                        head: [["#", "Student", "Email", ...activeSum.map((c) => c.label)]],
                        body: er.rows.map((r, i) => [
                            i + 1,
                            r.name,
                            r.email,
                            ...activeSum.map((c) => {
                                switch (c.key) {
                                    case "totalQ": return String(r.totalQuestions);
                                    case "completed": return String(r.completed);
                                    case "nonCompleted": return String(r.nonCompleted);
                                    case "testStatus":
                                        return r.testStatus === "submitted"
                                            ? "Submitted"
                                            : r.testStatus === "started"
                                                ? "Started"
                                                : "Not Started";
                                    case "totalMarks": return r.totalMarks > 0 ? String(r.totalMarks) : "—";
                                    case "scoredMarks": return typeof r.scoredMarks === "number" ? String(r.scoredMarks) : "—";
                                    case "percentage": return r.percentage === null ? "—" : `${r.percentage}%`;
                                    case "scale": return r.scale || "—";
                                    default: return "";
                                }
                            }),
                        ]),
                        styles: { fontSize: 8, cellPadding: 3 },
                        headStyles: { fillColor: [124, 92, 252] },
                        margin: { left: M, right: M },
                    });
                    y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;

                    if (detailed && activeQ.length > 0) {
                        for (const r of er.rows) {
                            const participant = participants.get(r.pid);
                            if (!participant) continue;
                            const bd = getStudentQuestionsBreakdown({
                                courseData,
                                courseId: courseId || "",
                                exerciseId: er.ex.id,
                                participant,
                                studentSubmitted: true,
                            });
                            if (!bd.length) continue;
                            if (y > doc.internal.pageSize.getHeight() - 100) {
                                doc.addPage();
                                y = M;
                            }
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(10);
                            doc.setTextColor(17, 24, 39);
                            doc.text(
                                `${r.name}${r.email ? ` — ${r.email}` : ""}`,
                                M,
                                y,
                            );
                            y += 12;
                            autoTable(doc, {
                                startY: y,
                                head: [activeQ.map((c) => c.label)],
                                body: bd.map((q) => activeQ.map((c) => {
                                    switch (c.key) {
                                        case "qno": return String(q.questionNo);
                                        case "title": return q.title;
                                        case "type": return q.type;
                                        case "status": return Q_STATUS_LABEL[q.status];
                                        case "totalMark": return String(q.totalMark);
                                        case "scoredMark":
                                            return q.status === "pending" || q.status === "not_answered"
                                                ? "—"
                                                : String(q.scoredMark);
                                        case "submittedAt": return fmtDateT(q.submittedAt);
                                        case "timeTaken": return fmtTime(q.timeTakenSeconds);
                                        default: return "";
                                    }
                                })),
                                styles: { fontSize: 7.5, cellPadding: 2.5 },
                                headStyles: { fillColor: [45, 191, 175] },
                                margin: { left: M, right: M },
                            });
                            y = (doc as any).lastAutoTable?.finalY + 8 || y + 8;
                        }
                    }
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
        setExSel(new Set());
        setSumCols(new Set(DEFAULT_SUM_COLS));
        setQCols(new Set(DEFAULT_Q_COLS));
        setExpanded(new Set());
        setDetailed(true);
    };

    if (!open) return null;

    // Small wrapper so preview sections can carry a top-right × like the
    // Attendance Detailed Report modal.
    const Sec: React.FC<{ id: ViewKey; children: React.ReactNode }> = ({ id, children }) => (
        <section
            className="relative rounded-tile border border-hairline bg-surface"
            ref={(el) => { chartRefs.current[id] = el; }}
        >
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
        shouldShow("roster") ||
        shouldShow("exerciseDetail");

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
                            {/* Course / Client readout — named rows instead of one
                                vague "Scope" string, so what the report covers is
                                obvious at a glance. */}
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Course
                                </h3>
                                <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] font-medium text-body">
                                    {courseName || "All courses"}
                                </div>
                                <h3 className="mt-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Client
                                </h3>
                                <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] text-body">
                                    {clientName && clientName !== "all" ? clientName : "All clients"}
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

                            {/* Assignments / Assessments — per-course drilldown. Only
                                works with a single-course scope; when multiple courses
                                are in scope we tell the head to narrow first (matches
                                assignment Dashboard → Reports, which is also per-course). */}
                            <section
                                aria-disabled={!views.has("exerciseDetail")}
                                className={views.has("exerciseDetail") ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Assignments / Assessments
                                </h3>
                                {!courseId ? (
                                    <p className="rounded-md border border-dashed border-hairline bg-surface px-2.5 py-2 text-[10px] text-subtle">
                                        Narrow the page's Course filter to ONE course to enable per-exercise detail.
                                    </p>
                                ) : courseDataQuery.isLoading ? (
                                    <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[10px] text-subtle">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading exercises…
                                    </div>
                                ) : catalogue.length === 0 ? (
                                    <p className="rounded-md border border-dashed border-hairline bg-surface px-2.5 py-2 text-[10px] text-subtle">
                                        No assignments / assessments on this course.
                                    </p>
                                ) : (
                                    <>
                                        <MultiPickBox
                                            label="Exercises"
                                            options={catalogue.map((e) => ({
                                                id: e.id,
                                                name: e.name,
                                                sub: `${e.subCategory} · ${e.totalQuestions} Q · ${e.totalMarks} m`,
                                            }))}
                                            sel={exSel}
                                            onChange={(s) => setExSel(s)}
                                            empty="No exercises match"
                                        />
                                        <p className="mt-1 text-[10px] text-faint">
                                            Pick one or several — each renders as its own card with a student roster.
                                        </p>
                                        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-row-hover">
                                            <input
                                                type="checkbox"
                                                checked={detailed}
                                                onChange={(e) => setDetailed(e.target.checked)}
                                                className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                            />
                                            <span className="text-[11px] font-medium text-body">
                                                Detailed report (per-question breakdown)
                                            </span>
                                        </label>
                                    </>
                                )}
                            </section>

                            {/* Detail — summary columns (outer roster row) */}
                            <section
                                aria-disabled={!views.has("exerciseDetail") || !courseId}
                                className={views.has("exerciseDetail") && courseId ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Detail: summary columns
                                </h3>
                                <div className="space-y-1">
                                    {SUM_COLS.map((c) => {
                                        const on = sumCols.has(c.key);
                                        return (
                                            <label
                                                key={c.key}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover"
                                                title={c.hint}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => setSumCols(toggleSet(sumCols, c.key))}
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

                            {/* Detail — per-question columns (inner table when expanded) */}
                            <section
                                aria-disabled={!views.has("exerciseDetail") || !courseId || !detailed}
                                className={views.has("exerciseDetail") && courseId && detailed ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                    Detail: per-question columns
                                </h3>
                                <div className="space-y-1">
                                    {Q_COLS.map((c) => {
                                        const on = qCols.has(c.key);
                                        return (
                                            <label
                                                key={c.key}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover"
                                                title={c.hint}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => setQCols(toggleSet(qCols, c.key))}
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
                                            {/* Per-activity averages replace the old flat "Avg overall %"
                                                card — a single blended number nobody could interpret. */}
                                            {activitySplit.map((a) => (
                                                <Stat
                                                    key={a.key}
                                                    label={`${a.label} avg`}
                                                    value={a.avg === null ? "N/A" : `${a.avg}%`}
                                                    hint={`completion — ${a.hint}`}
                                                />
                                            ))}
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
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("activities") ? (
                                    <Sec id="activities">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">
                                                Activities — I Do · We Do · You Do
                                            </h3>
                                            <span className="text-[10px] text-subtle">
                                                avg completion per stage
                                            </span>
                                        </header>
                                        {activityChartRows.length === 0 ? (
                                            <div className="flex h-40 items-center justify-center text-xs text-subtle">
                                                No activity progress in the current selection.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                                                {/* Pie — how the three stages compare to each other. */}
                                                <div
                                                    className="h-60"
                                                    ref={(el) => { chartRefs.current["activitiesPie"] = el; }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                dataKey="avg"
                                                                nameKey="label"
                                                                data={activityChartRows}
                                                                innerRadius={48}
                                                                outerRadius={82}
                                                                paddingAngle={2}
                                                                label={((e: any) => `${e.label}: ${e.avg}%`) as any}
                                                                labelLine={false}
                                                            >
                                                                {activityChartRows.map((a, i) => (
                                                                    <Cell key={i} fill={a.color} />
                                                                ))}
                                                            </Pie>
                                                            <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                            <RLegend
                                                                verticalAlign="bottom"
                                                                height={26}
                                                                iconType="circle"
                                                                wrapperStyle={{ fontSize: 11 }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                {/* Bar — each stage against the 0–100% scale. */}
                                                <div
                                                    className="h-60"
                                                    ref={(el) => { chartRefs.current["activitiesBar"] = el; }}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={activityChartRows.map((a) => ({ name: a.label, avg: a.avg }))}
                                                            margin={{ top: 20, right: 16, left: 0, bottom: 6 }}
                                                            barCategoryGap="28%"
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                            <YAxis
                                                                tick={{ fontSize: 10 }}
                                                                domain={[0, 100]}
                                                                tickFormatter={(v) => `${v}%`}
                                                            />
                                                            <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                                                {activityChartRows.map((a, i) => (
                                                                    <Cell key={i} fill={a.color} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}
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
                                        {/* Plain labeled count bars — the donut this used to be was
                                            redundant next to the Activities pie and harder to read. */}
                                        {gradeSlices.length === 0 ? (
                                            <div className="flex h-40 items-center justify-center text-xs text-subtle">
                                                Nothing to grade in the current selection.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 p-4">
                                                {gradeSlices.map((s) => {
                                                    const pctOfAll = stats.total
                                                        ? Math.round((s.value / stats.total) * 100)
                                                        : 0;
                                                    return (
                                                        <div key={s.key} className="flex items-center gap-3">
                                                            <span className="w-24 flex-shrink-0 text-[11px] font-medium text-body">
                                                                {s.name}
                                                            </span>
                                                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-row-hover">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{ width: `${pctOfAll}%`, background: s.color }}
                                                                />
                                                            </div>
                                                            <span className="w-20 flex-shrink-0 text-right text-[11px] tabular-nums text-subtle">
                                                                <b className="text-body">{s.value}</b> · {pctOfAll}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
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

                                {shouldShow("exerciseDetail") ? (
                                    <Sec id="exerciseDetail">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-semibold text-heading">
                                                    Assignment / Assessment detail
                                                </h3>
                                                <p className="mt-0.5 truncate text-[10px] text-subtle">
                                                    {courseId
                                                        ? exerciseRosters.length === 0
                                                            ? "Pick one or more exercises from the drawer to drill down."
                                                            : `${exerciseRosters.length} exercise${exerciseRosters.length === 1 ? "" : "s"} · ${detailed ? "detailed mode (expandable)" : "summary only"}`
                                                        : "Narrow to a single course to enable drilldown."}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {workingRows.length} students in scope
                                            </span>
                                        </header>
                                        <div className="flex flex-col gap-3 p-4">
                                            {!courseId ? (
                                                <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center text-xs text-subtle">
                                                    Narrow the page's Course filter to ONE course to enable per-assignment drilldown.
                                                </div>
                                            ) : courseDataQuery.isLoading ? (
                                                <div className="flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface p-6 text-xs text-subtle">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading course pedagogy…
                                                </div>
                                            ) : exerciseRosters.length === 0 ? (
                                                <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center text-xs text-subtle">
                                                    {catalogue.length === 0
                                                        ? "This course has no assignments or assessments."
                                                        : "Pick one or more exercises from the drawer to see their detail."}
                                                </div>
                                            ) : (
                                                exerciseRosters.map((er) => {
                                                    const activeSum = SUM_COLS.filter((c) => sumCols.has(c.key));
                                                    const activeQ = Q_COLS.filter((c) => qCols.has(c.key));
                                                    return (
                                                        <div
                                                            key={er.ex.id}
                                                            className="rounded-tile border border-hairline bg-surface"
                                                        >
                                                            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="truncate text-xs font-semibold text-heading">
                                                                        {er.ex.name}
                                                                    </h4>
                                                                    <p className="mt-0.5 truncate text-[10px] text-subtle">
                                                                        {er.ex.path} · {er.ex.totalQuestions} question
                                                                        {er.ex.totalQuestions === 1 ? "" : "s"} · {er.ex.totalMarks} marks
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tabular-nums text-subtle">
                                                                    <span>
                                                                        Submitted:{" "}
                                                                        <b className="text-success-500">
                                                                            {er.stats.submitted}
                                                                        </b>
                                                                    </span>
                                                                    <span>
                                                                        Started:{" "}
                                                                        <b className="text-warn-500">
                                                                            {er.stats.started}
                                                                        </b>
                                                                    </span>
                                                                    <span>
                                                                        Not started:{" "}
                                                                        <b className="text-subtle">
                                                                            {er.stats.notStarted}
                                                                        </b>
                                                                    </span>
                                                                    <span>
                                                                        Avg %:{" "}
                                                                        <b className="text-brand-strong">
                                                                            {er.stats.avgPct === null
                                                                                ? "—"
                                                                                : `${er.stats.avgPct}%`}
                                                                        </b>
                                                                    </span>
                                                                    <span>
                                                                        Pass / Fail:{" "}
                                                                        <b>
                                                                            {er.stats.passCount} / {er.stats.failCount}
                                                                        </b>
                                                                    </span>
                                                                </div>
                                                            </header>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full border-collapse text-xs">
                                                                    <thead className="bg-surface-sunken/50">
                                                                        <tr>
                                                                            {detailed ? (
                                                                                <th className="w-8 px-2 py-2 border-b border-hairline" />
                                                                            ) : null}
                                                                            <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                                                                                #
                                                                            </th>
                                                                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                                                                                Student
                                                                            </th>
                                                                            {activeSum.map((c) => (
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
                                                                        {er.rows.map((r, i) => {
                                                                            const key = `${er.ex.id}:${r.pid}`;
                                                                            const isOpen = expanded.has(key);
                                                                            const rows: React.ReactNode[] = [
                                                                                <tr
                                                                                    key={`${key}-sum`}
                                                                                    className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors"
                                                                                >
                                                                                    {detailed ? (
                                                                                        <td className="w-8 px-2 py-2">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => toggleExpanded(er.ex.id, r.pid)}
                                                                                                aria-label={isOpen ? "Collapse" : "Expand"}
                                                                                                className="flex h-5 w-5 items-center justify-center rounded text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                                                                                            >
                                                                                                {isOpen ? (
                                                                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                                                                ) : (
                                                                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                                                                )}
                                                                                            </button>
                                                                                        </td>
                                                                                    ) : null}
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
                                                                                    {activeSum.map((c) => (
                                                                                        <td
                                                                                            key={c.key}
                                                                                            className={`px-3 py-2 text-xs text-body ${c.r ? "text-right tabular-nums" : ""}`}
                                                                                        >
                                                                                            {renderSumCell(r, c.key)}
                                                                                        </td>
                                                                                    ))}
                                                                                </tr>,
                                                                            ];
                                                                            if (detailed && isOpen) {
                                                                                const bd = breakdowns.get(key) || [];
                                                                                rows.push(
                                                                                    <tr key={`${key}-detail`} className="bg-surface-sunken/30">
                                                                                        <td className="w-8 px-2" />
                                                                                        <td
                                                                                            colSpan={2 + activeSum.length}
                                                                                            className="border-b border-hairline px-4 py-3"
                                                                                        >
                                                                                            {bd.length === 0 ? (
                                                                                                <p className="text-[11px] text-subtle">
                                                                                                    No questions recorded for this student.
                                                                                                </p>
                                                                                            ) : (
                                                                                                <div className="overflow-x-auto rounded border border-hairline">
                                                                                                    <table className="w-full text-[11.5px]">
                                                                                                        <thead className="bg-surface">
                                                                                                            <tr>
                                                                                                                {activeQ.map((qc) => (
                                                                                                                    <th
                                                                                                                        key={qc.key}
                                                                                                                        className={`px-3 py-1.5 text-[10px] font-semibold text-subtle border-b border-hairline ${qc.r ? "text-right" : "text-left"}`}
                                                                                                                    >
                                                                                                                        {qc.label}
                                                                                                                    </th>
                                                                                                                ))}
                                                                                                            </tr>
                                                                                                        </thead>
                                                                                                        <tbody>
                                                                                                            {bd.map((q) => (
                                                                                                                <tr
                                                                                                                    key={q.questionId}
                                                                                                                    className="border-b border-hairline last:border-0"
                                                                                                                >
                                                                                                                    {activeQ.map((qc) => (
                                                                                                                        <td
                                                                                                                            key={qc.key}
                                                                                                                            className={`px-3 py-1.5 text-body ${qc.r ? "text-right tabular-nums" : ""}`}
                                                                                                                        >
                                                                                                                            {renderQCell(q, qc.key)}
                                                                                                                        </td>
                                                                                                                    ))}
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </div>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            }
                                                                            return rows;
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
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

// Per-exercise summary-cell renderer. Types intentionally loose because the
// caller passes rows from the private ExRosterRow type defined inside the
// component.
type SumRowLoose = {
    totalQuestions: number;
    completed: number;
    nonCompleted: number;
    testStatus: "not-started" | "started" | "submitted";
    totalMarks: number;
    scoredMarks: number | null;
    percentage: number | null;
    scale: string;
};
function renderSumCell(r: SumRowLoose, k: SumColKey): React.ReactNode {
    switch (k) {
        case "totalQ":
            return r.totalQuestions;
        case "completed":
            return <span className="font-semibold text-success-500">{r.completed}</span>;
        case "nonCompleted":
            return <span className="font-semibold text-warn-500">{r.nonCompleted}</span>;
        case "testStatus": {
            const meta =
                r.testStatus === "submitted"
                    ? { label: "Submitted", cls: "bg-success-500/15 text-success-500" }
                    : r.testStatus === "started"
                        ? { label: "Started", cls: "bg-warn-500/15 text-warn-500" }
                        : { label: "Not Started", cls: "bg-subtle/15 text-subtle" };
            return (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
                    {meta.label}
                </span>
            );
        }
        case "totalMarks":
            return r.totalMarks > 0 ? r.totalMarks : "—";
        case "scoredMarks":
            return typeof r.scoredMarks === "number" ? (
                <span className="font-semibold text-success-500">{r.scoredMarks}</span>
            ) : (
                <span className="text-faint">—</span>
            );
        case "percentage":
            if (r.percentage === null) return <span className="text-faint">—</span>;
            {
                const pctv = r.percentage;
                const cls =
                    pctv >= 80
                        ? "text-success-500"
                        : pctv >= 50
                            ? "text-warn-500"
                            : "text-danger-500";
                return <span className={`font-semibold ${cls}`}>{pctv}%</span>;
            }
        case "scale":
            return r.scale ? (
                <span className="inline-flex items-center rounded-full bg-brand-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-brand-strong">
                    {r.scale}
                </span>
            ) : (
                <span className="text-faint">—</span>
            );
        default:
            return "";
    }
}

function renderQCell(q: QuestionBreakdownRow, k: QColKey): React.ReactNode {
    switch (k) {
        case "qno":
            return q.questionNo;
        case "title":
            return (
                <span className="text-body" title={q.title}>
                    {q.title || "—"}
                </span>
            );
        case "type":
            return <span className="uppercase tracking-wide text-subtle">{q.type || "—"}</span>;
        case "status":
            return (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${Q_STATUS_TONE[q.status]}`}>
                    {Q_STATUS_LABEL[q.status]}
                </span>
            );
        case "totalMark":
            return q.totalMark;
        case "scoredMark":
            if (q.status === "pending" || q.status === "not_answered") return <span className="text-faint">—</span>;
            {
                const cls =
                    q.scoredMark === q.totalMark
                        ? "text-success-500"
                        : q.scoredMark === 0
                            ? "text-danger-500"
                            : "text-warn-500";
                return <span className={`font-semibold ${cls}`}>{q.scoredMark}</span>;
            }
        case "submittedAt":
            return <span className="whitespace-nowrap">{fmtDateT(q.submittedAt)}</span>;
        case "timeTaken":
            return <span className="whitespace-nowrap">{fmtTime(q.timeTakenSeconds)}</span>;
        default:
            return "";
    }
}
