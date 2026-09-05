/**
 * Performance Report Designer — shared vocabulary.
 *
 * Everything in here was lifted VERBATIM out of PerformanceReportDesignerModal
 * so the presentational components (drawer controls, canvas sections) can read
 * the same constants and helpers the container's derivations use. No rule was
 * changed in the move: grade thresholds, sub-category discovery, catalogue
 * walking and the "selected %" math are byte-for-byte what they were.
 *
 * The only additions are the TYPES of the container's derived rows (so the
 * canvas can be typed without reaching into the component) and
 * `biggestStageGap`, the Learning Pathway insight — a pure comparison of the
 * per-stage averages the summary already computes.
 */

import {
    getDynamicExerciseTotal,
    type GradeBand,
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

export type Stage = "I_Do" | "We_Do" | "You_Do";

// ─── Grade bands (mirrors DEFAULT_GRADE_BANDS in the assignment Reports flow) ─
// These are the PERFORMANCE REPORT's learner bands. They are deliberately not
// the course-readiness bands used by the L&D Overview — a learner's grade and a
// course's readiness answer different questions.
export const GRADE_BANDS = [
    { key: "excellent", label: "Excellent", range: "≥ 80", from: 80, to: 101, color: "#0E9F6E", tone: "good" },
    { key: "good", label: "Good", range: "60 – 79", from: 60, to: 80, color: "#2E90C4", tone: "brand" },
    { key: "average", label: "Average", range: "40 – 59", from: 40, to: 60, color: "#C77700", tone: "warn" },
    { key: "poor", label: "Poor", range: "1 – 39", from: 1, to: 40, color: "#B42318", tone: "bad" },
    { key: "not", label: "Not Started", range: "0", from: 0, to: 1, color: "#98A2B3", tone: "muted" },
] as const;
export type GradeKey = typeof GRADE_BANDS[number]["key"];

export const gradeOf = (pctVal: number | null | undefined): GradeKey => {
    const v = typeof pctVal === "number" ? pctVal : 0;
    if (v <= 0) return "not";
    if (v < 40) return "poor";
    if (v < 60) return "average";
    if (v < 80) return "good";
    return "excellent";
};
export const gradeLabel = (k: GradeKey) => GRADE_BANDS.find((g) => g.key === k)?.label || "—";
export const gradeColor = (k: GradeKey) => GRADE_BANDS.find((g) => g.key === k)?.color || "#94A3B8";

// Which pedagogy grouping the report should target.
export const ACTIVITIES: { key: Stage; label: string; hint: string }[] = [
    { key: "I_Do", label: "I Do", hint: "Instructor-led concepts / MCQs" },
    { key: "We_Do", label: "We Do", hint: "Guided practice / assignments" },
    { key: "You_Do", label: "You Do", hint: "Independent assessments / projects" },
];

/** SmartCliff's pedagogy language — used identically in the drawer, the
 *  canvas and the insight card so the report teaches the method as it goes.
 *
 *  Two descriptor sets so completion and performance sections read distinctly:
 *  STAGE_ROLE_COMPLETION talks about the WORK ("Concept Learning /
 *  Guided Activities / Independent Activities"), STAGE_ROLE_PERFORMANCE
 *  talks about the SCORE on that work. The old STAGE_ROLE alias points at
 *  the completion set so any legacy import keeps compiling. */
export const STAGE_ROLE_COMPLETION: Record<Stage, string> = {
    I_Do: "Concept Learning",
    We_Do: "Guided Activities",
    You_Do: "Independent Activities",
};
export const STAGE_ROLE_PERFORMANCE: Record<Stage, string> = {
    I_Do: "Concept Performance",
    We_Do: "Guided Performance",
    You_Do: "Independent Performance",
};
export const STAGE_ROLE: Record<Stage, string> = STAGE_ROLE_COMPLETION;

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
export const prettySubcat = (raw: string): string => {
    if (SUBCAT_LABELS[raw]) return SUBCAT_LABELS[raw];
    return raw
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Views the canvas can render (multi-select). ─────────────────────────
// Keys are the stable identifiers the export code switches on. Labels and
// canvasTitles reworded 2026-09-04 for L&D-Head clarity: the single
// "Learning Pathway" section split into two paired sections —
//   "activities"            = Learning Journey (completion, %)
//   "activitiesPerformance" = Learning Performance (score-weighted)
// so completion vs performance are never mixed in the reader's head.
export type ViewKey =
    | "stats"
    | "activities"
    | "activitiesPerformance"
    | "gradePie"
    | "subcatBars"
    | "courses"
    | "roster"
    | "exerciseDetail";
export const VIEWS: { key: ViewKey; label: string; canvasTitle: string }[] = [
    { key: "stats", label: "Summary", canvasTitle: "Summary" },
    { key: "activities", label: "Learning Journey", canvasTitle: "Learning Journey" },
    { key: "activitiesPerformance", label: "Learning Performance", canvasTitle: "Learning Performance" },
    { key: "gradePie", label: "Learner Results", canvasTitle: "Learner Results" },
    { key: "subcatBars", label: "Activity Performance", canvasTitle: "Activity Performance" },
    { key: "courses", label: "Course Table", canvasTitle: "Course Table" },
    { key: "roster", label: "Learners", canvasTitle: "Learners" },
    { key: "exerciseDetail", label: "Assignments & Assessments", canvasTitle: "Assignments & Assessments" },
];
/** Canvas render order — the document order of the report. Performance
 *  sits directly after completion so the two paired sections read as one
 *  spread (side-by-side on wide viewports, stacked on narrow). */
export const CANVAS_ORDER: ViewKey[] = [
    "stats",
    "activities",
    "activitiesPerformance",
    "gradePie",
    "subcatBars",
    "courses",
    "roster",
    "exerciseDetail",
];
export const viewMeta = (k: ViewKey) => VIEWS.find((v) => v.key === k)!;

// Fixed identity colors for the three pedagogy stages — used by the stage
// split so I Do / We Do / You Do read the same in preview and PDF.
export const ACTIVITY_SPLIT: { key: "iDo" | "weDo" | "youDo"; stage: Stage; label: string; color: string; hint: string }[] = [
    { key: "iDo", stage: "I_Do", label: "I Do", color: "#2E90C4", hint: "instructor-led" },
    { key: "weDo", stage: "We_Do", label: "We Do", color: "#F97316", hint: "guided practice" },
    { key: "youDo", stage: "You_Do", label: "You Do", color: "#0E9F6E", hint: "independent work" },
];

// ─── Roster columns the user can toggle. ─────────────────────────────────
export type ColKey =
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

export const COLUMNS: { key: ColKey; label: string; hint: string; r?: boolean }[] = [
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

export const DEFAULT_COLS: ColKey[] = ["email", "course", "overall", "subcatPct", "grade", "last"];
// Learning Journey + Learning Performance are both on by default so the
// paired split (completion vs performance) is the first thing an L&D Head
// sees on the report — that separation is the whole point of the redesign.
export const DEFAULT_VIEWS: ViewKey[] = [
    "stats",
    "activities",
    "activitiesPerformance",
    "gradePie",
    "subcatBars",
    "roster",
];

// ─── Per-exercise drilldown (mirrors assignment Dashboard → Reports view) ─
// Summary columns shown on the outer roster row (like SUMMARY_COLUMNS in
// courses/manageUsers/reports/components/ReportExportModal). Student Name +
// Email are always on — the picker toggles the rest.
export type SumColKey =
    | "totalQ"
    | "completed"
    | "nonCompleted"
    | "testStatus"
    | "totalMarks"
    | "scoredMarks"
    | "percentage"
    | "scale";

export const SUM_COLS: { key: SumColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "totalQ", label: "Total Questions", hint: "Questions on the exercise", r: true },
    { key: "completed", label: "Completed", hint: "Answered questions", r: true },
    { key: "nonCompleted", label: "Non Completed", hint: "Skipped / unanswered", r: true },
    { key: "testStatus", label: "Test Status", hint: "Not Started / Started / Submitted" },
    { key: "totalMarks", label: "Total Marks", hint: "Max marks for the exercise", r: true },
    { key: "scoredMarks", label: "Scored Marks", hint: "Marks the student earned", r: true },
    { key: "percentage", label: "Percentage", hint: "scored / total × 100", r: true },
    { key: "scale", label: "Scale", hint: "Grade band (per-exercise gradeSettings, else default)" },
];
export const DEFAULT_SUM_COLS: SumColKey[] = [
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
export type QColKey =
    | "qno"
    | "title"
    | "type"
    | "status"
    | "totalMark"
    | "scoredMark"
    | "submittedAt"
    | "timeTaken";

export const Q_COLS: { key: QColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "qno", label: "Q. No.", hint: "Question number", r: true },
    { key: "title", label: "Title", hint: "Question title" },
    { key: "type", label: "Type", hint: "MCQ / Programming / etc." },
    { key: "status", label: "Status", hint: "Evaluated / Submitted / Not Answered / Pending" },
    { key: "totalMark", label: "Total Mark", hint: "Max mark for this question", r: true },
    { key: "scoredMark", label: "Scored Mark", hint: "Mark this student earned", r: true },
    { key: "submittedAt", label: "Submitted At", hint: "Timestamp of last submission" },
    { key: "timeTaken", label: "Time Taken", hint: "Wall-clock time on this question" },
];
export const DEFAULT_Q_COLS: QColKey[] = [
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
export type CatalogueEx = {
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

export function walkCatalogue(courseData: any): CatalogueEx[] {
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
export const fmtTime = (secs: number | null | undefined): string => {
    if (typeof secs !== "number" || !Number.isFinite(secs) || secs <= 0) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
export const fmtDateT = (iso: string | null): string => {
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

export const Q_STATUS_LABEL: Record<QuestionBreakdownRow["status"], string> = {
    evaluated: "Evaluated",
    submitted: "Submitted",
    not_answered: "Not Answered",
    pending: "Pending",
};
export const Q_STATUS_TONE: Record<QuestionBreakdownRow["status"], string> = {
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
export const subcatPercent = (progress: any, stage: string, subcat: string): number | null => {
    const s = readSubcat(progress, stage, subcat);
    if (!s || s.total <= 0) return null;
    if (typeof s.percentage === "number") return s.percentage;
    return Math.round((s.completed / s.total) * 100);
};

// Per-student SCORE-WEIGHTED % for one stage — used by the Learning
// Performance section. Only counts sub-categories whose server-side
// `percentage` is set (that field is score-weighted for We_Do / You_Do
// and typically absent on I_Do concept content). Returns null when no
// score-based bucket exists for this student in this stage, which the
// Performance card renders as "N/A — No score-based evaluation" rather
// than a misleading 0%.
export const stagePerformancePercent = (progress: any, stage: string): number | null => {
    const stg = progress?.[stage];
    if (!stg || typeof stg !== "object") return null;
    let sum = 0;
    let n = 0;
    for (const [, sub] of Object.entries(stg)) {
        const s = sub as any;
        if (!s || typeof s !== "object") continue;
        if (typeof s.percentage !== "number") continue;
        if ((Number(s.total) || 0) <= 0) continue;
        sum += Number(s.percentage);
        n += 1;
    }
    return n > 0 ? Math.round(sum / n) : null;
};

// Per-student % across the picked (stage, subcat) selection. Same
// completion/total math as `stageDone` — sum completed vs sum total across
// the buckets that survive the filter. Returns null when nothing applies.
export const pickedPercent = (
    progress: any,
    activities: Set<Stage>,
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
export type SubcatOpt = { id: string; stage: Stage; subcat: string; label: string };
export const buildSubcatOptions = (rows: PerfStudentRow[]): SubcatOpt[] => {
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
export const buildActivityOptions = (rows: PerfStudentRow[]): Set<Stage> => {
    const out = new Set<Stage>();
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

// ─── Types of the container's derived data ──────────────────────────────
// These name shapes that already existed as inferred types inside the
// component, so the canvas components can be typed against them.

/** A base row after the student pick + the picked-% / grade derivation. */
export type WorkingRow = PerfStudentRow & {
    selectedPct: number | null;
    gradePct: number;
    grade: GradeKey;
};

export type ActivityStat = (typeof ACTIVITY_SPLIT)[number] & {
    avg: number | null;
    learners: number;
};

/**
 * Per-stage score-weighted performance — parallel to ActivityStat but read
 * from the raw progress[stage][subcat].percentage rather than the
 * completion columns. `avg` is null when the stage has no score-based
 * activity in scope (e.g. an I Do stage of pure concept videos), which
 * the Learning Performance card renders as "N/A — No score-based
 * evaluation".
 */
export type PerformanceStat = (typeof ACTIVITY_SPLIT)[number] & {
    avg: number | null;
    learners: number;
};

export type GradeSlice = { key: GradeKey; name: string; value: number; color: string };
export type SubcatBar = { key: string; label: string; avg: number; learners: number };
export type StatsStrip = {
    total: number;
    avgOverall: number;
    avgSelected: number | null;
    avgScore: number | null;
    atRisk: number;
    notStarted: number;
    excellent: number;
};

export type ExRosterRow = {
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
export type ExRoster = {
    ex: CatalogueEx;
    gradeBands: GradeBand[];
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

// ─── Learning Pathway insight ────────────────────────────────────────────
// The transition losing the most ground between consecutive stages. Pure:
// it compares the per-stage averages the summary already derives, so the
// insight can never disagree with the numbers beside it.
export type StageGap =
    | { kind: "drop"; label: string; delta: number; advice: string }
    | { kind: "steady"; label: string; advice: string }
    | { kind: "insufficient" };

export function biggestStageGap(split: ActivityStat[]): StageGap {
    const by = (k: ActivityStat["key"]) => split.find((s) => s.key === k);
    const pairs: { a?: ActivityStat; b?: ActivityStat; label: string; advice: string }[] = [
        {
            a: by("iDo"), b: by("weDo"), label: "I Do → We Do",
            advice: "Concepts are understood but not yet applied — add guided practice so instruction turns into skill.",
        },
        {
            a: by("weDo"), b: by("youDo"), label: "We Do → You Do",
            advice: "Learners manage with guidance but stall alone — add independent practice and real-world assessments.",
        },
    ];
    let worst: { label: string; delta: number; advice: string } | null = null;
    let measured = 0;
    for (const p of pairs) {
        if (!p.a || !p.b || p.a.avg === null || p.b.avg === null) continue;
        measured += 1;
        const delta = p.b.avg - p.a.avg;
        if (delta < 0 && (worst === null || delta < worst.delta)) worst = { label: p.label, delta, advice: p.advice };
    }
    if (worst) return { kind: "drop", ...worst };
    if (measured > 0) {
        return {
            kind: "steady",
            label: "No drop between stages",
            advice: "No stage loses ground on the one before it — learners are carrying understanding through to independent work.",
        };
    }
    return { kind: "insufficient" };
}

/** Colour a stage by how it is actually performing — the same bands the
 *  report grades learners on, so a 46% You Do reads as "Average" everywhere. */
export const stageColor = (avg: number | null): string =>
    avg === null ? "#98A2B3" : gradeColor(gradeOf(avg));
