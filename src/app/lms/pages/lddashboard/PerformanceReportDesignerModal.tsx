"use client";

/**
 * Performance Report Designer — the container.
 *
 * ─── What this file OWNS ───────────────────────────────────────────────────
 *   • Selection state (learners, activities, sub-categories, grades, views,
 *     roster columns, hidden sections, exercise picks, detailed toggle,
 *     summary + question columns, expanded rows).
 *   • React Query subscription to `/getAll/courses-data/:id` — only when a
 *     single course is in scope, gated by `enabled: !!courseId && open`.
 *   • Every derivation: workingRows, gradeSlices, subcatBars, stats,
 *     activitySplit, exerciseRosters, breakdowns.
 *   • The Excel and PDF exports, plus the SVG-to-PNG helper the PDF uses.
 *   • The "removed" set for canvas × (kept separate from `views`, so hiding
 *     never unticks the drawer choice).
 *
 * ─── What it RENDERS ──────────────────────────────────────────────────────
 * Only three components: DesignerHeader, DesignerRail + ControlsDrawer, and
 * ReportCanvas. Every card/pill/chart lives in `performance-designer/`; this
 * file's job is orchestration.
 *
 * ─── What it DOES NOT change ──────────────────────────────────────────────
 * Grade thresholds, sub-category discovery, catalogue walking, picked-%
 * math, `computeStudentMarks` calls, cache keys, exported prop shape
 * (`PerfStudentRow`, `PerfCourseRow`), the shared `Props` interface, or any
 * export column semantics. All of that was lifted verbatim to
 * `performance-designer/model.ts` so the presentational layer can read the
 * same constants without duplicating them.
 *
 * Both entry points (Overview and #rep-performance) still import this file;
 * the extraction is component-internal.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { courseDataApi } from "@/apiServices/coursesData";
import {
    computeStudentMarks,
    getExerciseGradeBands,
    getStudentQuestionsBreakdown,
    scaleForPercent,
    type QuestionBreakdownRow,
} from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";
import {
    ACTIVITIES,
    ACTIVITY_SPLIT,
    buildActivityOptions,
    buildSubcatOptions,
    COLUMNS,
    DEFAULT_COLS,
    DEFAULT_Q_COLS,
    DEFAULT_SUM_COLS,
    DEFAULT_VIEWS,
    fmtDateT,
    fmtTime,
    gradeLabel,
    gradeOf,
    GRADE_BANDS,
    pickedPercent,
    prettySubcat,
    Q_COLS,
    Q_STATUS_LABEL,
    STAGE_ROLE,
    stagePerformancePercent,
    subcatPercent,
    SUM_COLS,
    VIEWS,
    walkCatalogue,
    type ActivityStat,
    type PerformanceStat,
    type ColKey,
    type ExRoster,
    type ExRosterRow,
    type GradeKey,
    type GradeSlice,
    type PerfCourseRow,
    type PerfStudentRow,
    type QColKey,
    type Stage,
    type StatsStrip,
    type SubcatBar,
    type SumColKey,
    type ViewKey,
    type WorkingRow,
} from "./performance-designer/model";
import { DesignerHeader } from "./performance-designer/DesignerHeader";
import { DesignerRail } from "./performance-designer/DesignerRail";
import { ControlsDrawer } from "./performance-designer/ControlsDrawer";
import { ReportCanvas } from "./performance-designer/canvas/ReportCanvas";
import { sectionDomId, type DrawerSectionId } from "./performance-designer/controls/sections";

// Re-export the parent-facing types so `page.tsx` and every other importer
// keeps compiling without an import path change.
export type { PerfStudentRow, PerfCourseRow } from "./performance-designer/model";

type Props = {
    open: boolean;
    onClose: () => void;
    baseStudents: PerfStudentRow[];
    baseCourseRows: PerfCourseRow[];
    scopeLabel: string;
    /** Selected client / course names for the drawer readout. */
    clientName?: string;
    courseName?: string;
    /** Set only when the page filter is narrowed to ONE course — enables the
     *  per-assignment / per-question drilldown, which needs the heavy
     *  /getAll/courses-data payload (pedagogy + participant answers). */
    courseId?: string;
    /**
     * Presentation shell:
     *   - "modal"  (default) — old overlay dialog behaviour: fixed inset,
     *                          backdrop, click-outside closes.
     *   - "inline"           — no overlay chrome. The designer renders
     *                          straight into the parent container so a
     *                          full-page host (the new Reports page) can
     *                          embed it without the modal wallpaper. The
     *                          host controls the sidebar rail / drawer
     *                          visibility via `showRail` / `showDrawer`
     *                          below.
     * Same state, same derivations, same exports — only the outer chrome
     * changes. No parallel report logic.
     */
    variant?: "modal" | "inline";
    /** Inline hosts can hide the icon rail (they usually don't have room
     *  for it or drive it their own way). Defaults to true. */
    showRail?: boolean;
    /** Inline hosts can also hide the always-visible drawer and drive
     *  filters through their own popover. Defaults to true. */
    showDrawer?: boolean;
    /** Inline hosts pass a header slot to override the built-in modal
     *  chrome (title + Close). When set, DesignerHeader is skipped.
     *  The helpers object exposes the underlying filter state + setters
     *  so the host can render its own compact Filters popover (or any
     *  other filter UX) driven by the same source of truth the drawer
     *  would use — no parallel state, no re-implementation of filter
     *  logic. */
    renderHeader?: (helpers: {
        canDownload: boolean;
        onExcel: () => void;
        onPdf: () => void;
        busy: "" | "xlsx" | "pdf";
        filters: FilterHelpers;
    }) => React.ReactNode;
};

/** Filter state + setters exposed to inline hosts via renderHeader.
 *  Same identity the drawer's ControlsDrawer receives — the popover
 *  and the drawer stay two views of the exact same state. */
export type FilterHelpers = {
    // Learning Stages
    activityHas: Set<Stage>;
    activities: Set<Stage>;
    onToggleActivity: (s: Stage) => void;

    // Activity Types + Names (derived from filteredSubcatOpts + catalogue)
    activityTypeOpts: string[];               // e.g. ["Assignment","Assessment","Practical"]
    selectedActivityTypes: Set<string>;       // subset of activityTypeOpts currently "on"
    onToggleActivityType: (name: string) => void;
    exercisesByType: Record<string, { id: string; name: string }[]>;
    exSel: Set<string> | null;
    setExSel: (v: Set<string> | null) => void;

    // Grade Bands
    grades: Set<GradeKey> | null;
    onGrades: (v: Set<GradeKey> | null) => void;

    // Include in Report
    views: Set<ViewKey>;
    onToggleView: (k: ViewKey) => void;
    onAllViews: () => void;

    // Roster Columns
    cols: Set<ColKey>;
    onToggleCol: (k: ColKey) => void;

    // Reset everything to defaults
    onReset: () => void;
};

export default function PerformanceReportDesignerModal({
    open,
    onClose,
    baseStudents,
    baseCourseRows,
    scopeLabel,
    clientName,
    courseName,
    courseId,
    variant = "modal",
    showRail = true,
    showDrawer = true,
    renderHeader,
}: Props) {
    // ── Selection state ────────────────────────────────────────────────────
    const [collapsed, setCollapsed] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
    const [views, setViews] = useState<Set<ViewKey>>(new Set(DEFAULT_VIEWS));
    const [cols, setCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
    const [studentSel, setStudentSel] = useState<Set<string> | null>(null);
    const [activities, setActivities] = useState<Set<Stage>>(() => new Set<Stage>(["I_Do", "We_Do", "You_Do"]));
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

    // Which drawer section is currently under the scroll head — the rail lights it.
    const [activeSection, setActiveSection] = useState<DrawerSectionId>("scope");

    // Fetch full course data ONLY when a single course is in scope — the
    // pedagogy tree + participant answers are what powers per-question detail.
    // Uses the SAME cache key `["course", id, activeBatchId]` the review /
    // reports pages read, so no duplicate request when they've already loaded it.
    const courseDataQuery = useQuery({
        ...(courseId
            ? courseDataApi.getById(courseId)
            : { queryKey: ["course-detail-skip"], queryFn: async () => null as any }),
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
    const drawerBodyRef = useRef<HTMLDivElement | null>(null);
    // Live preview section nodes, keyed by ViewKey. The PDF export rasterises
    // the recharts <svg> found inside chart sections (gradePie, subcatBars,
    // activities) so the downloaded file carries the SAME graphs the canvas
    // shows.
    const chartRefs = useRef<Record<string, HTMLElement | null>>({});
    const registerChartRef = (k: ViewKey, el: HTMLElement | null) => {
        chartRefs.current[k] = el;
    };

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

    const workingRows = useMemo<WorkingRow[]>(() => {
        const pickSet = studentSel;
        const rows = baseStudents
            .filter((s) => (pickSet === null ? true : pickSet.has(s.pid)))
            .map((s): WorkingRow => {
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
    const courseRows = useMemo<PerfCourseRow[]>(() => {
        const keep = new Set(workingRows.map((r) => r.courseId));
        return baseCourseRows.filter((c) => keep.has(c.id));
    }, [baseCourseRows, workingRows]);

    // Grade distribution across the surviving rows.
    const gradeSlices = useMemo<GradeSlice[]>(() => {
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
    const subcatBars = useMemo<SubcatBar[]>(() => {
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
    const stats = useMemo<StatsStrip>(() => {
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
    const activitySplit = useMemo<ActivityStat[]>(
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
    const activityChartRows = activitySplit.filter((a) => a.avg !== null) as Array<ActivityStat & { avg: number }>;

    // Per-stage SCORE-WEIGHTED average — the Learning Performance section's
    // data. Parallel to `activitySplit` above, but reads
    // `progress[stage][subcat].percentage` (score-weighted for We_Do /
    // You_Do) instead of the completion columns. Stages without any
    // score-based bucket in scope come through with avg=null — the
    // Performance card renders those as "N/A · No score-based evaluation"
    // instead of a misleading 0%.
    const performanceSplit = useMemo<PerformanceStat[]>(
        () =>
            ACTIVITY_SPLIT.map((a) => {
                const vals: number[] = [];
                for (const r of workingRows) {
                    const v = stagePerformancePercent(r.progress, a.stage);
                    if (v !== null) vals.push(v);
                }
                return {
                    ...a,
                    avg: vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null,
                    learners: vals.length,
                };
            }),
        [workingRows],
    );

    // ── Per-exercise drilldown data ──────────────────────────────────────
    // Which of the catalogue's exercises are actually selected. `null` = all,
    // empty Set = none (initial state — user hasn't picked yet).
    const activeExercises = useMemo(() => {
        if (!catalogue.length) return [] as typeof catalogue;
        if (exSel === null) return catalogue;
        return catalogue.filter((e) => exSel.has(e.id));
    }, [catalogue, exSel]);

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

    // Per-question breakdown for expanded rows only.
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

    // ── Toggle helpers ────────────────────────────────────────────────────
    const toggleSet = <T,>(current: Set<T>, key: T): Set<T> => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    };
    const onToggleView = (k: ViewKey) => setViews((s) => toggleSet(s, k));
    const onAllViews = () => setViews(new Set(VIEWS.map((v) => v.key)));
    const onToggleCol = (k: ColKey) => setCols((s) => toggleSet(s, k));
    const onToggleActivity = (s: Stage) => setActivities((prev) => toggleSet(prev, s));
    const onToggleSum = (k: SumColKey) => setSumCols((s) => toggleSet(s, k));
    const onToggleQ = (k: QColKey) => setQCols((s) => toggleSet(s, k));

    const jumpToSection = (id: DrawerSectionId) => {
        if (collapsed) setCollapsed(false);
        // Wait a frame if we just uncollapsed, then scroll.
        requestAnimationFrame(() => {
            const body = drawerBodyRef.current;
            if (!body) return;
            const node = body.querySelector<HTMLElement>(`#${sectionDomId(id)}`);
            if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        setActiveSection(id);
    };

    // ── Export helpers ────────────────────────────────────────────────────
    const activeCols = COLUMNS.filter((c) => cols.has(c.key));
    const activeSubcatOpts = filteredSubcatOpts.filter((o) => selectedSubcatSet.has(o.id));
    const activeActivityLabels = ACTIVITIES.filter((a) => activities.has(a.key))
        .map((a) => a.label)
        .join(", ");
    const scopeLine = `${scopeLabel || "All clients · all courses"} · ${workingRows.length} student${workingRows.length === 1 ? "" : "s"}`;
    const subcatLine = `Activities: ${activeActivityLabels || "—"} · Sub-cats: ${activeSubcatOpts.length ? activeSubcatOpts.length : "all"} of ${filteredSubcatOpts.length}`;
    const gradeLine = grades === null ? "All grades" : [...grades].map((g) => gradeLabel(g)).join(", ");

    const cellText = (r: WorkingRow, c: ColKey): string => {
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

    const cellNumber = (r: WorkingRow, c: ColKey): number | string => {
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
            ws.addRow(["Learner Progress & Performance Report"]).getCell(1).style = { font: { bold: true, size: 13 } };
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
                    ...activitySplit.map((a): [string, string] => [
                        `${a.label} avg % (${STAGE_ROLE[a.stage]})`,
                        a.avg === null ? "N/A" : `${a.avg}%`,
                    ]),
                    ["Selected % (avg)", stats.avgSelected === null ? "N/A" : `${stats.avgSelected}%`],
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
                ws.addRow(["Learning Journey — Completion"]).getCell(1).style = { font: { bold: true, size: 12 } };
                const h = ws.addRow(["Stage", "Role", "Completion %", "Learners"]);
                h.eachCell((c: any) => (c.style = header));
                activitySplit.forEach((a) => {
                    const row = ws.addRow([a.label, STAGE_ROLE[a.stage], a.avg === null ? "N/A" : `${a.avg}%`, a.learners]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }
            if (shouldShow("activitiesPerformance")) {
                ws.addRow([]);
                ws.addRow(["Learning Performance"]).getCell(1).style = { font: { bold: true, size: 12 } };
                const h = ws.addRow(["Stage", "Descriptor", "Score %", "Learners"]);
                h.eachCell((c: any) => (c.style = header));
                performanceSplit.forEach((a) => {
                    const roleP = a.stage === "I_Do" ? "Concept Performance" : a.stage === "We_Do" ? "Guided Performance" : "Independent Performance";
                    const row = ws.addRow([a.label, roleP, a.avg === null ? "N/A" : `${a.avg}%`, a.learners]);
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
                const csCols = [
                    { header: "Course", key: "name", width: 28 },
                    { header: "Client", key: "client", width: 18 },
                    { header: "Students", key: "students", width: 12 },
                    { header: "Avg %", key: "avg", width: 10 },
                    { header: "Completed", key: "done", width: 12 },
                    { header: "In progress", key: "prog", width: 12 },
                    { header: "Not started", key: "not", width: 12 },
                ];
                cs.columns = csCols;
                const hr = cs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                courseRows.forEach((c) => {
                    const row = cs.addRow([c.name, c.client, c.students, `${c.avg}%`, c.done, c.prog, c.not]);
                    row.eachCell((cell: any) => (cell.style = bordered));
                });
                cs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: csCols.length } };
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

    // Rasterise a rendered chart section into a PNG data URL: serialise an
    // <svg>, load it into an <img>, draw onto a 2× canvas for crisp print.
    // Prefers an off-screen `svg[data-export-chart]` (used by the pathway),
    // then the recharts surface, then the first svg.
    const svgToPng = async (container: HTMLElement | null): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        if (!container) return null;
        const svg =
            container.querySelector("svg[data-export-chart]") ||
            container.querySelector(".recharts-wrapper svg.recharts-surface") ||
            container.querySelector(".recharts-wrapper svg");
        if (!svg) return null;
        const box = svg.getBoundingClientRect();
        const clone = svg.cloneNode(true) as SVGSVGElement;
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

            // ── Orientation: only flip to landscape when the roster is on
            //    AND it carries enough columns to actually need the width.
            //    Anything else — summary-only, charts-only, drill-down —
            //    reads better in portrait. Wide roster picks up landscape
            //    automatically. ────────────────────────────────────────
            const rosterOn = shouldShow("roster") && workingRows.length > 0;
            const wideRoster = rosterOn && activeCols.length > 4;
            const doc = new jsPDF({
                orientation: wideRoster ? "landscape" : "portrait",
                unit: "pt",
                format: "a4",
            });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const M = 42;
            const FOOTER_H = 26; // reserved band at the bottom for the page footer
            let y = M;

            // ── Font scale — professional print sizes per the brief.
            //    Do NOT copy the 8-pt dashboard density into the PDF: the
            //    reader is holding paper (or a full-window PDF viewer),
            //    not squinting at a 300-px web card.
            const F = {
                title: 20,       // Report title
                section: 14,     // Section heading
                metricValue: 16, // Summary metric value
                metricLabel: 9,  // Summary metric label
                body: 10.5,      // Body text
                th: 10,          // Table header
                td: 10,          // Table body
                meta: 9,         // Secondary/meta
                footer: 8.5,     // Page footer
            };

            const guardRoom = (need: number) => {
                if (y + need > pageH - M - FOOTER_H) {
                    doc.addPage();
                    y = M;
                }
            };
            const rule = (gap = 12) => {
                y += 4;
                doc.setDrawColor(229, 231, 235);
                doc.setLineWidth(0.5);
                doc.line(M, y, pageW - M, y);
                y += gap;
            };
            // Section heading — bold title with a short orange underline.
            // Guards against the classic "heading orphan at the bottom":
            // if less than 90 pt remains, the heading moves to the next
            // page rather than starting a new section against the footer.
            const h2 = (t: string, minRoom = 90) => {
                guardRoom(minRoom);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(F.section);
                doc.setTextColor(17, 24, 39);
                doc.text(t, M, y);
                y += 6;
                doc.setDrawColor(249, 115, 22);
                doc.setLineWidth(1.5);
                doc.line(M, y, M + 28, y);
                y += 16;
            };
            const hexToRgb = (hex: string): [number, number, number] => {
                const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
                if (!m) return [107, 114, 128];
                const n = parseInt(m[1], 16);
                return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
            };
            // ── Native chart drawing primitives ───────────────────────
            // Charts are drawn directly with jsPDF's rect/line/text
            // primitives rather than captured from the DOM's off-screen
            // export SVGs. The old capture path was flaky in the field:
            // it depended on the section refs being attached AND on the
            // browser being able to serialise the SVG and decode it as
            // an <img> reliably. When any of those steps failed (React
            // hadn't flushed the ref, the SVG referenced an external
            // font, the image decode raced with PDF generation) the
            // chart silently rendered as an empty rectangle in the PDF,
            // producing the exact "heading + blank block" problem
            // reported. Native drawing is deterministic — same data,
            // same output every time, no DOM dependency.
            //
            // Chart primitives:
            //   drawColumnChart   — clustered vertical columns, 0–100
            //                        Y-axis, dashed grid at 25/50/75/100.
            //                        Used for Learning Journey, Learning
            //                        Performance and Activity Performance.
            //   drawGradeBar      — Learner Results as a compact
            //                        horizontal stacked bar plus legend
            //                        (a pie/donut needs arc segments jsPDF
            //                        does not support natively; the
            //                        stacked bar shows the same
            //                        distribution and prints reliably).
            const ORANGE: [number, number, number] = [249, 115, 22];
            const drawColumnChart = (
                x0: number,
                y0: number,
                w: number,
                h: number,
                rows: Array<{ label: string; avg: number | null }>,
            ) => {
                const padL = 30;
                const padR = 8;
                const padT = 20;
                const padB = 26;
                const plotX = x0 + padL;
                const plotY = y0 + padT;
                const plotW = w - padL - padR;
                const plotH = h - padT - padB;
                // Dashed grid at 25 / 50 / 75 / 100, solid baseline at 0.
                doc.setDrawColor(228, 231, 236);
                doc.setLineWidth(0.5);
                [100, 75, 50, 25].forEach((v) => {
                    const yy = plotY + (plotH * (100 - v)) / 100;
                    doc.setLineDashPattern([2, 3], 0);
                    doc.line(plotX, yy, plotX + plotW, yy);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(152, 162, 179);
                    doc.text(String(v), plotX - 4, yy + 3, { align: "right" });
                });
                doc.setLineDashPattern([], 0);
                doc.setDrawColor(208, 213, 221);
                doc.setLineWidth(0.8);
                doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
                doc.setFontSize(8);
                doc.setTextColor(152, 162, 179);
                doc.text("0", plotX - 4, plotY + plotH + 3, { align: "right" });
                // Columns
                const n = rows.length;
                if (n > 0) {
                    // Column width scales down when the chart has more
                    // categories (Activity Performance can have 4–6+).
                    const bandW = plotW / n;
                    const barW = Math.min(38, Math.max(14, bandW * 0.55));
                    rows.forEach((r, i) => {
                        const cx = plotX + bandW * i + bandW / 2;
                        const na = r.avg === null;
                        const rawH = na ? 0 : (plotH * Math.max(0, Math.min(100, r.avg as number))) / 100;
                        // MIN 6pt so a 1–2% value still renders as a
                        // proper column, not a nothing-sliver. N/A gets
                        // a fixed neutral height to signal "no data".
                        const barH = na ? Math.max(18, plotH * 0.15) : Math.max(6, rawH);
                        const bx = cx - barW / 2;
                        const by = plotY + plotH - barH;
                        if (na) {
                            doc.setFillColor(242, 244, 247);
                            doc.setDrawColor(208, 213, 221);
                            doc.setLineWidth(0.7);
                            doc.setLineDashPattern([2, 2], 0);
                            doc.roundedRect(bx, by, barW, barH, 2, 2, "FD");
                            doc.setLineDashPattern([], 0);
                        } else {
                            doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
                            doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
                            doc.roundedRect(bx, by, barW, barH, 2, 2, "F");
                        }
                        // Value above the bar.
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        if (na) doc.setTextColor(152, 162, 179);
                        else doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
                        doc.text(na ? "N/A" : `${r.avg}%`, cx, by - 4, { align: "center" });
                        // Category label under the axis.
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(17, 24, 39);
                        // Truncate very long activity names so they don't
                        // overrun their column band.
                        const maxChars = Math.max(6, Math.floor(bandW / 4.5));
                        const label = r.label.length > maxChars
                            ? r.label.slice(0, maxChars - 1) + "…"
                            : r.label;
                        doc.text(label, cx, plotY + plotH + 14, { align: "center" });
                    });
                }
                // Card outline so the chart reads as its own block.
                doc.setDrawColor(228, 231, 236);
                doc.setLineWidth(0.5);
                doc.roundedRect(x0, y0, w, h, 4, 4, "S");
            };

            const drawGradeBar = (
                x0: number,
                y0: number,
                w: number,
                h: number,
                slices: Array<{ name: string; value: number; color: string }>,
                total: number,
            ) => {
                // Card outline.
                doc.setDrawColor(228, 231, 236);
                doc.setLineWidth(0.5);
                doc.roundedRect(x0, y0, w, h, 4, 4, "S");
                // Stacked horizontal bar showing the grade distribution.
                // A pie/donut needs arc primitives jsPDF doesn't ship;
                // the stacked bar shows the same proportions and prints
                // reliably at any size.
                const barH = 22;
                const barX = x0 + 14;
                const barY = y0 + 18;
                const barW = w - 28;
                doc.setFillColor(242, 244, 247);
                doc.roundedRect(barX, barY, barW, barH, 3, 3, "F");
                if (total > 0) {
                    let cursor = barX;
                    slices.forEach((s) => {
                        if (s.value <= 0) return;
                        const seg = (s.value / total) * barW;
                        const rgb = hexToRgb(s.color);
                        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                        doc.rect(cursor, barY, seg, barH, "F");
                        cursor += seg;
                    });
                }
                // "N learners" caption above the bar.
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(17, 24, 39);
                doc.text(`${total} learner${total === 1 ? "" : "s"}`, barX, barY - 4);
                // Legend rows under the bar — one line per band with
                // colour swatch, name, count and share.
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                let ly = barY + barH + 14;
                slices.forEach((s) => {
                    if (ly + 12 > y0 + h) return;
                    const rgb = hexToRgb(s.color);
                    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                    doc.circle(barX + 4, ly - 3, 3.2, "F");
                    doc.setTextColor(55, 65, 81);
                    doc.text(s.name, barX + 12, ly);
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                    doc.setTextColor(107, 114, 128);
                    doc.text(`${s.value} · ${pct}%`, x0 + w - 14, ly, { align: "right" });
                    ly += 13;
                });
            };

            // Helper: reserve vertical space before drawing so a chart
            // never crosses a page break. Adds a page if the block
            // wouldn't fit; returns the y at which drawing may start.
            const reserve = (blockH: number): number => {
                if (y + blockH > pageH - M - FOOTER_H) {
                    doc.addPage();
                    y = M;
                }
                return y;
            };

            // ── Report header ────────────────────────────────────────
            // Title (20 pt) followed by explicit labelled meta lines so
            // the reader can see at a glance which course, how many
            // learners, which assignments/assessments and which grade
            // bands the report was generated for. Old export collapsed
            // scope onto one middle-dot-separated line ("GRAD 2026 · 32
            // students · Grade: All grades"), which hid the actual
            // assignment/assessment names the user had picked in the
            // filter drawer.
            doc.setFont("helvetica", "bold");
            doc.setFontSize(F.title);
            doc.setTextColor(17, 24, 39);
            doc.text("Learner Progress & Performance Report", M, y);
            y += F.title + 4;

            // Build labelled meta lines. Group catalogue exercises by
            // sub-category (Assignment, Assessment, Practical, …); for
            // each group, list the actual names when the user has
            // narrowed the picker (exSel !== null), or "All" when they
            // haven't. Groups whose intersection with exSel is empty are
            // skipped so the header stays tight when the user narrowed
            // to only one activity type.
            const courseHeader = (courseName && courseName.trim())
                || (scopeLabel && scopeLabel.trim())
                || "All clients · all courses";
            const bySubcat = new Map<string, string[]>();
            for (const ex of catalogue) {
                const key = ex.subCategory || "Other";
                if (!bySubcat.has(key)) bySubcat.set(key, []);
                if (exSel === null || exSel.has(ex.id)) {
                    bySubcat.get(key)!.push(ex.name);
                }
            }
            const metaLines: Array<{ label: string; value: string }> = [
                { label: "Course name", value: courseHeader },
                { label: "Number of students", value: String(workingRows.length) },
            ];
            for (const [subcat, names] of bySubcat) {
                if (exSel === null) {
                    metaLines.push({ label: `${subcat} name`, value: "All" });
                } else if (names.length > 0) {
                    metaLines.push({ label: `${subcat} name`, value: names.join(", ") });
                }
            }
            metaLines.push({ label: "Grade", value: gradeLine });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(F.body);
            metaLines.forEach(({ label, value }) => {
                // Bold label + normal-weight value, wrapped so long
                // assignment lists don't run off the page.
                doc.setFont("helvetica", "bold");
                doc.setTextColor(55, 65, 81);
                const labelText = `${label}: `;
                const labelW = doc.getTextWidth(labelText);
                doc.text(labelText, M, y);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(80, 90, 106);
                const valueX = M + labelW;
                const valueW = pageW - M - valueX;
                const wrapped = doc.splitTextToSize(value, valueW);
                wrapped.forEach((line: string, i: number) => {
                    doc.text(line, i === 0 ? valueX : M, y);
                    y += F.body + 4;
                });
            });
            doc.setFontSize(F.meta);
            doc.setTextColor(140, 149, 165);
            doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, M, y);
            y += F.meta + 4;
            rule(16);

            // ── Summary — one compact horizontal strip ────────────────
            // Renders the same five metrics the preview shows, drawn as a
            // single bordered row with vertical dividers between each
            // metric cell. Big value up, small uppercase label below.
            // Deliberately NOT a two-column key/value autoTable — that's
            // what the previous export used, and it read as a data dump.
            if (shouldShow("stats")) {
                h2("Summary", 90);
                const avgCompletion = stats.avgSelected ?? stats.avgOverall;
                const metrics: Array<{ label: string; value: string; muted?: boolean; tone?: "danger" }> = [
                    { label: "Learners", value: String(stats.total) },
                    { label: "Average Completion", value: `${avgCompletion}%` },
                    {
                        label: "Average Score",
                        value: stats.avgScore === null ? "N/A" : `${stats.avgScore}%`,
                        muted: stats.avgScore === null,
                    },
                    { label: "At Risk", value: String(stats.atRisk), tone: "danger" },
                    { label: "Not Started", value: String(stats.notStarted), muted: true },
                ];
                const stripH = 62;
                const stripW = pageW - M * 2;
                const cellW = stripW / metrics.length;
                doc.setDrawColor(229, 231, 235);
                doc.setLineWidth(0.5);
                doc.roundedRect(M, y, stripW, stripH, 6, 6, "S");
                metrics.forEach((m, i) => {
                    const cx = M + cellW * i + cellW / 2;
                    if (i > 0) {
                        doc.setDrawColor(229, 231, 235);
                        doc.line(M + cellW * i, y + 10, M + cellW * i, y + stripH - 10);
                    }
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(F.metricLabel);
                    doc.setTextColor(107, 114, 128);
                    doc.text(m.label.toUpperCase(), cx, y + 20, { align: "center" });
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(F.metricValue);
                    if (m.tone === "danger") doc.setTextColor(180, 35, 24);
                    else if (m.muted) doc.setTextColor(152, 162, 179);
                    else doc.setTextColor(17, 24, 39);
                    doc.text(m.value, cx, y + 46, { align: "center" });
                });
                y += stripH + 18;
            }

            // ── Learning Journey + Learning Performance ──────────────
            // Side-by-side when both are on and the page is wide enough
            // (portrait A4 ≈ 515 pt content width; the paired layout wants
            // ≥ 460 pt so each chart clears ~215 pt); stacked otherwise.
            // Charts are treated as indivisible blocks — reserve() moves
            // the whole chart to the next page if it wouldn't fit whole.
            // ── Learning Journey + Learning Performance ──────────────
            // Paired side-by-side on any page that clears ~460 pt of
            // content width; stacked otherwise. Each chart is drawn
            // natively so there's no dependency on the off-screen SVG
            // being captured — same data as the preview, always renders.
            const wantsCompletion = shouldShow("activities") && activityChartRows.length > 0;
            const wantsPerformance = shouldShow("activitiesPerformance") && performanceSplit.some((a) => a.avg !== null);
            const canPairCharts = (pageW - M * 2) >= 460;
            const CHART_H = 200; // fixed height for stage / activity charts
            // Small helper: draw a section heading with the orange rule
            // underline at (x, currentY). Advances y past the heading
            // block so callers can place the chart at the returned y.
            const sectionTitle = (title: string, x: number) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(F.section);
                doc.setTextColor(17, 24, 39);
                doc.text(title, x, y);
                y += 6;
                doc.setDrawColor(249, 115, 22);
                doc.setLineWidth(1.5);
                doc.line(x, y, x + 28, y);
                y += 14;
            };
            if (wantsCompletion && wantsPerformance && canPairCharts) {
                const blockH = 14 /* title */ + 8 + CHART_H;
                reserve(blockH + 12);
                const halfW = (pageW - M * 2 - 16) / 2;
                const leftX = M;
                const rightX = M + halfW + 16;
                // Draw both titles on the same row.
                doc.setFont("helvetica", "bold");
                doc.setFontSize(F.section);
                doc.setTextColor(17, 24, 39);
                doc.text("Learning Journey", leftX, y);
                doc.text("Learning Performance", rightX, y);
                y += 6;
                doc.setDrawColor(249, 115, 22);
                doc.setLineWidth(1.5);
                doc.line(leftX, y, leftX + 28, y);
                doc.line(rightX, y, rightX + 28, y);
                y += 14;
                // Then both charts at the same y, native rendering.
                drawColumnChart(leftX, y, halfW, CHART_H, activitySplit.map((a) => ({ label: a.label, avg: a.avg })));
                drawColumnChart(rightX, y, halfW, CHART_H, performanceSplit.map((a) => ({ label: a.label, avg: a.avg })));
                y += CHART_H + 16;
                rule(12);
            } else {
                if (wantsCompletion) {
                    reserve(14 + 8 + CHART_H + 12);
                    sectionTitle("Learning Journey", M);
                    drawColumnChart(M, y, pageW - M * 2, CHART_H, activitySplit.map((a) => ({ label: a.label, avg: a.avg })));
                    y += CHART_H + 16;
                    rule(12);
                }
                if (wantsPerformance) {
                    reserve(14 + 8 + CHART_H + 12);
                    sectionTitle("Learning Performance", M);
                    drawColumnChart(M, y, pageW - M * 2, CHART_H, performanceSplit.map((a) => ({ label: a.label, avg: a.avg })));
                    y += CHART_H + 16;
                    rule(12);
                }
            }

            // ── Learner Results + Activity Performance ────────────────
            // Learner Results renders as a compact stacked bar plus
            // legend — bounded by a fixed card height so it can never
            // consume the whole page (the previous SVG-donut export
            // would balloon to available width squared). Activity
            // Performance uses the same native column chart primitive.
            const wantsGrade = shouldShow("gradePie") && gradeSlices.length > 0;
            const wantsSubcat = shouldShow("subcatBars") && subcatBars.length > 0;
            const GRADE_H = 180;      // compact card height for the grade bar + legend
            const ACTIVITY_H = 200;   // matches CHART_H
            if (wantsGrade && wantsSubcat && canPairCharts) {
                reserve(14 + 8 + Math.max(GRADE_H, ACTIVITY_H) + 12);
                const halfW = (pageW - M * 2 - 16) / 2;
                const leftX = M;
                const rightX = M + halfW + 16;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(F.section);
                doc.setTextColor(17, 24, 39);
                doc.text("Learner Results", leftX, y);
                doc.text("Activity Performance", rightX, y);
                y += 6;
                doc.setDrawColor(249, 115, 22);
                doc.setLineWidth(1.5);
                doc.line(leftX, y, leftX + 28, y);
                doc.line(rightX, y, rightX + 28, y);
                y += 14;
                drawGradeBar(leftX, y, halfW, GRADE_H, gradeSlices as any, stats.total);
                drawColumnChart(rightX, y, halfW, ACTIVITY_H, subcatBars.map((b) => ({ label: b.label, avg: b.avg })));
                y += Math.max(GRADE_H, ACTIVITY_H) + 16;
                rule(12);
            } else {
                if (wantsGrade) {
                    reserve(14 + 8 + GRADE_H + 12);
                    sectionTitle("Learner Results", M);
                    // When solo, don't stretch the card to full page
                    // width — cap around 380 pt so the reader isn't
                    // staring at a giant thin bar.
                    const soloW = Math.min(pageW - M * 2, 380);
                    drawGradeBar(M, y, soloW, GRADE_H, gradeSlices as any, stats.total);
                    y += GRADE_H + 16;
                    rule(12);
                }
                if (wantsSubcat) {
                    reserve(14 + 8 + ACTIVITY_H + 12);
                    sectionTitle("Activity Performance", M);
                    drawColumnChart(M, y, pageW - M * 2, ACTIVITY_H, subcatBars.map((b) => ({ label: b.label, avg: b.avg })));
                    y += ACTIVITY_H + 16;
                    rule(12);
                }
            }

            // ── Course Table (optional) ──────────────────────────────
            if (shouldShow("courses") && courseRows.length > 0) {
                h2(`Courses (${courseRows.length})`, 120);
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
                    styles: { fontSize: F.td, cellPadding: 5, valign: "middle" },
                    headStyles: { fontSize: F.th, fontStyle: "bold", fillColor: [242, 244, 247], textColor: [55, 65, 81], halign: "left" },
                    alternateRowStyles: { fillColor: [250, 251, 252] },
                    margin: { left: M, right: M, top: M, bottom: M + FOOTER_H },
                    columnStyles: {
                        2: { halign: "right" }, 3: { halign: "right" },
                        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
                    },
                });
                y = (doc as any).lastAutoTable?.finalY + 16 || y + 16;
                rule(16);
            }

            // ── Learners (roster) ────────────────────────────────────
            // Uses EXACTLY the columns the user picked in the drawer's
            // Roster Columns section — nothing added, nothing dropped.
            // Every filtered learner is included; the browser preview may
            // page/scroll, but the export ships the full working set.
            // autoTable repeats the header on every page and never splits
            // a row across pages.
            if (rosterOn) {
                h2(`Learners (${workingRows.length})`, 130);
                autoTable(doc, {
                    startY: y,
                    head: [["#", "Student", ...activeCols.map((c) => c.label)]],
                    body: workingRows.map((r, i) => [
                        i + 1,
                        r.name,
                        ...activeCols.map((c) => cellText(r, c.key)),
                    ]),
                    styles: { fontSize: F.td, cellPadding: 5, valign: "middle", overflow: "linebreak" },
                    headStyles: { fontSize: F.th, fontStyle: "bold", fillColor: [242, 244, 247], textColor: [55, 65, 81], halign: "left" },
                    alternateRowStyles: { fillColor: [250, 251, 252] },
                    margin: { left: M, right: M, top: M, bottom: M + FOOTER_H },
                    // Percentage/numeric roster columns right-align.
                    columnStyles: activeCols.reduce((acc: Record<number, any>, c, idx) => {
                        // Index 0 = "#", 1 = Student; roster cols start at 2.
                        if (c.r) acc[idx + 2] = { halign: "right" };
                        return acc;
                    }, { 0: { halign: "right", cellWidth: 26 } }),
                });
                y = (doc as any).lastAutoTable?.finalY + 16 || y + 16;
            }

            // ── Assignments & Assessments (drill-down) ────────────────
            // Only rendered when the user ticked "Assignments &
            // Assessments" in the drawer AND picked at least one
            // exercise. Each exercise gets its own section header (name +
            // one-line meta) plus a summary autoTable of the selected
            // sumCols. When Detailed Mode is on and question columns are
            // picked, each learner's per-question breakdown is nested
            // underneath. Only the columns the user turned on ship.
            if (shouldShow("exerciseDetail") && exerciseRosters.length > 0) {
                const activeSum = SUM_COLS.filter((c) => sumCols.has(c.key));
                const activeQ = Q_COLS.filter((c) => qCols.has(c.key));
                h2("Assignments & Assessments", 140);
                exerciseRosters.forEach((er, exIdx) => {
                    if (exIdx > 0) guardRoom(180);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(F.body + 1);
                    doc.setTextColor(17, 24, 39);
                    const wrappedName = doc.splitTextToSize(er.ex.name || "Exercise", pageW - M * 2);
                    wrappedName.forEach((line: string) => { doc.text(line, M, y); y += F.body + 4; });
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(F.meta);
                    doc.setTextColor(107, 114, 128);
                    doc.text(
                        `${er.ex.totalQuestions} questions · ${er.ex.totalMarks} marks · Submitted ${er.stats.submitted} · Started ${er.stats.started} · Not started ${er.stats.notStarted} · Avg ${er.stats.avgPct === null ? "—" : er.stats.avgPct + "%"}`,
                        M,
                        y,
                    );
                    y += F.meta + 8;

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
                        styles: { fontSize: F.td, cellPadding: 5, valign: "middle", overflow: "linebreak" },
                        headStyles: { fontSize: F.th, fontStyle: "bold", fillColor: [242, 244, 247], textColor: [55, 65, 81], halign: "left" },
                        alternateRowStyles: { fillColor: [250, 251, 252] },
                        margin: { left: M, right: M, top: M, bottom: M + FOOTER_H },
                        columnStyles: activeSum.reduce((acc: Record<number, any>, c, idx) => {
                            if (c.r) acc[idx + 3] = { halign: "right" };
                            return acc;
                        }, { 0: { halign: "right", cellWidth: 26 } }),
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
                            guardRoom(120);
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(F.body);
                            doc.setTextColor(17, 24, 39);
                            doc.text(
                                `${r.name}${r.email ? ` — ${r.email}` : ""}`,
                                M,
                                y,
                            );
                            y += F.body + 4;
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
                                styles: { fontSize: F.td - 0.5, cellPadding: 4 },
                                headStyles: { fontSize: F.th - 0.5, fontStyle: "bold", fillColor: [242, 244, 247], textColor: [55, 65, 81] },
                                alternateRowStyles: { fillColor: [250, 251, 252] },
                                margin: { left: M, right: M, top: M, bottom: M + FOOTER_H },
                            });
                            y = (doc as any).lastAutoTable?.finalY + 10 || y + 10;
                        }
                    }
                });
            }

            // ── Page footer: SmartCliff · title (left) + Page X of Y
            //    (right) + generated timestamp (center) on every page. Kept
            //    subtle — 8.5 pt, muted gray — so it doesn't eat page room.
            const totalPages = (doc as any).internal.pages.length - 1;
            const generatedAt = new Date().toLocaleString("en-GB");
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setDrawColor(235, 238, 242);
                doc.setLineWidth(0.5);
                doc.line(M, pageH - 22, pageW - M, pageH - 22);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(F.footer);
                doc.setTextColor(140, 149, 165);
                doc.text("SmartCliff · Learner Progress & Performance Report", M, pageH - 10);
                doc.text(generatedAt, pageW / 2, pageH - 10, { align: "center" });
                doc.text(`Page ${p} of ${totalPages}`, pageW - M, pageH - 10, { align: "right" });
            }

            doc.save(`learner-progress-performance-report_${localDay()}.pdf`);
            setDownloadOpen(false);
        } catch (e) {
            console.error("Performance report PDF export failed", e);
        } finally {
            setBusy("");
        }
    };

    // Reset back to defaults.
    const reset = () => {
        setViews(new Set(DEFAULT_VIEWS));
        setCols(new Set(DEFAULT_COLS));
        setActivities(new Set<Stage>(["I_Do", "We_Do", "You_Do"]));
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

    // ── Chrome selection ─────────────────────────────────────────────
    // Inline mode: no fixed overlay, no backdrop, no click-outside close;
    // the designer body renders straight into whatever the host page
    // provides. Modal mode keeps the historical overlay behaviour so
    // existing entry points (Detailed report button in the L&D console)
    // continue to work unchanged.
    const isInline = variant === "inline";
    const OuterWrap: React.FC<{ children: React.ReactNode }> = ({ children }) =>
        isInline ? (
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
            <div
                className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 p-2 backdrop-blur-[2px] sm:p-3"
                role="dialog"
                aria-modal="true"
                aria-label="Performance report designer"
                onClick={onClose}
            >
                <div
                    className="relative flex h-[96vh] w-[97vw] max-w-[1760px] flex-col overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            </div>
        );

    // Header: inline hosts (the new Reports page) pass their own header
    // via renderHeader so the toolbar sits in the page chrome. When
    // absent, DesignerHeader still renders — the modal's title bar and
    // download/close controls.
    // Distinct activity type names discovered in the filtered sub-cat
    // options (e.g. "Assignment", "Assessment", "Practical"). One entry
    // per type — the popover uses this list to render its Activity Types
    // checkbox group instead of the drawer's per-(stage · subcat) chip
    // strip.
    const activityTypeOpts = React.useMemo(() => {
        const seen = new Set<string>();
        for (const o of filteredSubcatOpts) {
            const name = prettySubcat(o.subcat);
            if (name && !seen.has(name)) seen.add(name);
        }
        return Array.from(seen).sort((a, b) => a.localeCompare(b));
    }, [filteredSubcatOpts]);

    // Which activity type NAMES are currently selected. The drawer's
    // subcats state is keyed by (stage:subcat) pairs; a type is "on"
    // when every pair matching it is in the selected set — or, when
    // subcats is null (meaning "all"), all types are "on".
    const selectedActivityTypes = React.useMemo(() => {
        const on = new Set<string>();
        if (subcats === null) {
            activityTypeOpts.forEach((t) => on.add(t));
            return on;
        }
        for (const o of filteredSubcatOpts) {
            if (subcats.has(o.id)) on.add(prettySubcat(o.subcat));
        }
        return on;
    }, [subcats, filteredSubcatOpts, activityTypeOpts]);

    // Toggle every (stage:subcat) pair matching a type name.
    const onToggleActivityType = (name: string) => {
        const matchingIds = filteredSubcatOpts
            .filter((o) => prettySubcat(o.subcat) === name)
            .map((o) => o.id);
        if (matchingIds.length === 0) return;
        // Normalise subcats → concrete Set (was null = "all"). Then flip
        // the type's ids in/out.
        const base = subcats === null
            ? new Set(filteredSubcatOpts.map((o) => o.id))
            : new Set(subcats);
        const anyOn = matchingIds.some((id) => base.has(id));
        if (anyOn) {
            matchingIds.forEach((id) => base.delete(id));
        } else {
            matchingIds.forEach((id) => base.add(id));
        }
        setSubcats(base);
    };

    // Group catalogue exercises by activity type name — the Activity
    // Names selector on the popover pulls its options from this map.
    const exercisesByType = React.useMemo(() => {
        const map: Record<string, { id: string; name: string }[]> = {};
        for (const ex of catalogue) {
            const name = ex.subCategory || "Other";
            if (!map[name]) map[name] = [];
            map[name].push({ id: ex.id, name: ex.name });
        }
        return map;
    }, [catalogue]);

    const filterHelpers: FilterHelpers = {
        activityHas,
        activities,
        onToggleActivity,
        activityTypeOpts,
        selectedActivityTypes,
        onToggleActivityType,
        exercisesByType,
        exSel,
        setExSel,
        grades,
        onGrades: setGrades,
        views,
        onToggleView,
        onAllViews,
        cols,
        onToggleCol,
        onReset: reset,
    };

    const headerNode = renderHeader
        ? renderHeader({
            canDownload: workingRows.length > 0,
            onExcel: downloadExcel,
            onPdf: downloadPdf,
            busy,
            filters: filterHelpers,
        })
        : (
            <DesignerHeader
                busy={busy}
                canDownload={workingRows.length > 0}
                downloadOpen={downloadOpen}
                onToggleDownload={() => setDownloadOpen((v) => !v)}
                downloadRef={downloadRef}
                onExcel={downloadExcel}
                onPdf={downloadPdf}
                onClose={onClose}
            />
        );

    return (
        <OuterWrap>
            {headerNode}

            <div className="flex min-h-0 flex-1">
                {showRail ? (
                    <DesignerRail
                        active={activeSection}
                        collapsed={collapsed}
                        onJump={jumpToSection}
                        onToggleCollapse={() => setCollapsed((v) => !v)}
                    />
                ) : null}
                {showDrawer && !collapsed ? (
                    <ControlsDrawer
                            bodyRef={drawerBodyRef}
                            onActiveChange={setActiveSection}
                            onReset={reset}
                            clientName={clientName}
                            courseName={courseName}
                            studentOpts={studentOpts}
                            studentSel={studentSel}
                            onStudentSel={setStudentSel}
                            activityHas={activityHas}
                            activities={activities}
                            onToggleActivity={onToggleActivity}
                            subcatOpts={filteredSubcatOpts}
                            subcats={subcats}
                            onSubcats={setSubcats}
                            grades={grades}
                            onGrades={setGrades}
                            views={views}
                            onToggleView={onToggleView}
                            onAllViews={onAllViews}
                            cols={cols}
                            onToggleCol={onToggleCol}
                            courseId={courseId}
                            courseLoading={!!courseId && courseDataQuery.isLoading}
                            catalogue={catalogue}
                            exSel={exSel}
                            onExSel={setExSel}
                            detailed={detailed}
                            onDetailed={setDetailed}
                            sumCols={sumCols}
                            onToggleSum={onToggleSum}
                            qCols={qCols}
                            onToggleQ={onToggleQ}
                        />
                    ) : null}

                    <ReportCanvas
                        // When the host provides its own header via
                        // renderHeader, hide the canvas's internal title
                        // block — otherwise "Learner Progress & Performance
                        // Report" prints twice.
                        showTitleBlock={!renderHeader}
                        shouldShow={shouldShow}
                        removed={removed}
                        onRestore={restoreSection}
                        onRemove={removeSection}
                        registerRef={registerChartRef}
                        courseName={courseName}
                        scopeLine={scopeLine}
                        gradeLine={gradeLine}
                        workingRows={workingRows}
                        stats={stats}
                        activitySplit={activitySplit}
                        performanceSplit={performanceSplit}
                        gradeSlices={gradeSlices}
                        subcatBars={subcatBars}
                        courseRows={courseRows}
                        activeCols={activeCols}
                        cellText={cellText}
                        courseId={courseId}
                        courseLoading={!!courseId && courseDataQuery.isLoading}
                        catalogue={catalogue}
                        exerciseRosters={exerciseRosters}
                        sumCols={sumCols}
                        qCols={qCols}
                        detailed={detailed}
                        onDetailed={setDetailed}
                        expanded={expanded}
                        onToggleExpanded={toggleExpanded}
                        breakdowns={breakdowns}
                        onJumpToDrilldown={() => jumpToSection("drilldown")}
                    />
            </div>
        </OuterWrap>
    );
}
