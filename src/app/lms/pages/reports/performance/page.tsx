"use client";

/**
 * Reports — /lms/pages/reports/performance
 *
 * List-first Learner Progress & Performance Report.
 *
 * ─── Structure ─────────────────────────────────────────────────────────────
 * The dashboard-style report (KPI strip · Learning Journey · Learner Results
 * donut · Activity Performance chart · Filters popover) was retired here in
 * 2026-09-04 in favour of a guided on-page flow:
 *
 *   Section 1 — Select Client and Course
 *   Section 2 — Select Activities   (Learning Stage → Sub-category → Exercises)
 *   Section 3 — Report Results      (grouped-column student table only)
 *
 * The Filters button, filter popover and every chart/KPI card are gone. All
 * selection lives directly on the page.
 *
 * ─── Data reuse ────────────────────────────────────────────────────────────
 * Nothing new was added at the data layer. The page reuses:
 *   • `useStaffAnalytics`               scope-aware student list + progress
 *   • `courseDataApi.getById`           course pedagogy + participant answers
 *     (fetched only when ONE course is selected — the per-question grader
 *     needs it; multi-course selections skip this heavy read)
 *   • `walkCatalogue(courseData)`       flat list of assignments/assessments
 *   • `computeStudentMarks`             per-student per-exercise scoring
 *
 * The three helpers already power the L&D console's Performance Report and
 * its designer modal, so the numbers on this page can never disagree with
 * the ones there.
 *
 * ─── Shell ─────────────────────────────────────────────────────────────────
 * Same session-scoping the previous page had: admin/L&D/POC → `DashboardLayout`,
 * trainer → `StaffLayout`; POC pinned to enrolled courses, trainer to courses
 * where they own a batch or a marked-attendance day.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Book,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    MoreHorizontal,
    Printer,
    Search,
    Users,
} from "lucide-react";
import DashboardLayout from "@/app/lms/component/layout";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";
import LDLayout, { type CourseOpt } from "@/app/lms/component/ldshell/LDLayout";
import { prettySubcat, walkCatalogue, type CatalogueEx, type Stage } from "@/app/lms/pages/lddashboard/performance-designer/model";
import { computeIDoMarks, walkIDoCatalogue, type IDoFile } from "@/app/lms/pages/lddashboard/performance-designer/idoCatalogue";
import { StudentDetailModal, type StudentDetailGroup, type StudentDetailStudent } from "./StudentDetailModal";
import {
    buildPerfBase,
    useStaffAnalytics,
    scopeLabel,
    type ViewFilter,
} from "@/app/lms/pages/lddashboard/page";
import { courseStructuresSummaryQuery, courseStructureApi } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { courseDataApi } from "@/apiServices/coursesData";
import { attendanceApi } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { queryKeys } from "@/lib/queryKeys";
import { isPocSession } from "@/lib/session";
import { Loading } from "@/components/loading-ui/loading";
import { computeStudentMarks } from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";

const readMe = (): any => {
    if (typeof window === "undefined") return null;
    try {
        return JSON.parse(localStorage.getItem("smartcliff_userData") || "null");
    } catch {
        return null;
    }
};

type Mode = { shell: "admin" | "staff" | "ld"; poc: boolean };

/** How many students fit on one page of the results table. Keeps the initial
 *  render cheap on huge cohorts without hiding data — the paginator moves
 *  through every learner in scope. */
const PAGE_SIZE = 10;

/** Semantic colour bands for a % — the same 80 / 60 / 45 the rest of the
 *  Overview grades against, so a "56%" reads the same colour everywhere. */
function scoreTone(pct: number | null): { fill: string; text: string; ring: string } {
    if (pct === null) return { fill: "var(--color-ink-100)", text: "var(--color-subtle)", ring: "var(--color-hairline)" };
    if (pct >= 80) return { fill: "#dcfce7", text: "#15803d", ring: "#22c55e" };
    if (pct >= 60) return { fill: "#fef3c7", text: "#a16207", ring: "#ca8a04" };
    if (pct >= 45) return { fill: "#ffedd5", text: "#c2410c", ring: "#f97316" };
    return { fill: "#fee2e2", text: "#b91c1c", ring: "#ef4444" };
}

export default function ReportsPage() {
    const [mode, setMode] = useState<Mode | null>(null);
    const [client, setClient] = useState("all");
    const [course, setCourse] = useState("all");

    // ── Shell + scoping ────────────────────────────────────────────────────
    // L&D roles (Head / Subhead) get the LDLayout console so the Reports item
    // in their sidebar keeps its context — before this split they fell into
    // the admin DashboardLayout on click and the whole sidebar changed under
    // them. POC and true admin still get the admin shell; trainers get Staff.
    useEffect(() => {
        const poc = isPocSession();
        const u = readMe();
        const role = u?.role;
        const roleStr = String(
            (typeof role === "object" ? role?.roleValue || role?.originalRole || role?.renameRole : role) ||
                localStorage.getItem("smartcliff_originalRole") ||
                "",
        )
            .toLowerCase()
            .replace(/[^a-z]/g, "");
        const isLd = ["ldhead", "subhead"].some((r) => roleStr.includes(r));
        const adminish = ["admin", "programcoordinator"].some((r) => roleStr.includes(r));
        const shell: Mode["shell"] = poc
            ? "admin"
            : isLd
                ? "ld"
                : adminish
                    ? "admin"
                    : "staff";
        setMode({ shell, poc });
    }, []);

    // Course catalogue for the scope pickers.
    const summaryQ = useQuery(courseStructuresSummaryQuery());
    const allCourses = useMemo<CourseOpt[]>(
        () =>
            (Array.isArray(summaryQ.data) ? summaryQ.data : []).map((c: any) => ({
                id: String(c._id),
                name: c.courseName || "Untitled",
                client: c.clientName || "Unassigned",
            })),
        [summaryQ.data],
    );

    // Trainer/POC scoping (unchanged from the previous shell).
    const isStaff = mode?.shell === "staff";
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const rosterQ = useQuery({ ...(courseStructureApi.getAll() as any), enabled: isStaff });
    const attnQ = useQuery({
        queryKey: queryKeys.attendance.overview(today),
        queryFn: () => attendanceApi.overview(today),
        staleTime: 30_000,
        enabled: isStaff,
    });
    const trainerIds = useMemo<Set<string> | null>(() => {
        if (!isStaff) return null;
        const me = readMe();
        const myId = me?._id ? String(me._id) : "";
        const myEmail = String(me?.email || "").toLowerCase();
        const ids = new Set<string>();
        const roster: any[] = Array.isArray(rosterQ.data) ? (rosterQ.data as any[]) : [];
        roster.forEach((c: any) => {
            (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
                (Array.isArray(b.users) ? b.users : []).forEach((u: any) => {
                    const uu = u?.user;
                    if (!uu) return;
                    const matches =
                        (myId && String(uu._id) === myId) ||
                        (myEmail && String(uu.email || "").toLowerCase() === myEmail);
                    if (matches) ids.add(String(c._id));
                });
            });
        });
        ((attnQ.data as any)?.data ?? []).forEach((c: any) => {
            if ((Array.isArray(c.batches) ? c.batches : []).some((b: any) => b.mine)) {
                ids.add(String(c._id));
            }
        });
        return ids;
    }, [isStaff, rosterQ.data, attnQ.data]);

    const baseIds = useMemo<Set<string> | null>(() => {
        if (isStaff) return trainerIds;
        if (mode?.poc) return new Set(allCourses.map((c) => c.id));
        return null;
    }, [isStaff, trainerIds, mode?.poc, allCourses]);

    const scopedCourses = useMemo(
        () => (baseIds === null ? allCourses : allCourses.filter((c) => baseIds.has(c.id))),
        [allCourses, baseIds],
    );
    const clients = useMemo(
        () => Array.from(new Set(scopedCourses.map((c) => c.client).filter(Boolean))).sort(),
        [scopedCourses],
    );
    const courseOpts = useMemo(
        () => (client === "all" ? scopedCourses : scopedCourses.filter((c) => c.client === client)),
        [scopedCourses, client],
    );
    const clientById = useMemo(() => new Map(scopedCourses.map((c) => [c.id, c.client])), [scopedCourses]);
    const clientOf = useMemo(() => (id: string) => clientById.get(id), [clientById]);
    const courseIds = useMemo<Set<string> | null>(() => {
        const clientIds = client === "all" ? null : new Set(courseOpts.map((c) => c.id));
        if (baseIds === null) return clientIds;
        if (clientIds === null) return baseIds;
        return new Set([...baseIds].filter((id) => clientIds.has(id)));
    }, [baseIds, client, courseOpts]);

    // Course change → discard any exercise / stage picks: exercise ids belong
    // to the previous course and would silently score everyone as null.
    useEffect(() => {
        setActiveStage("We_Do");
        setActiveSubcat({ I_Do: "", We_Do: "", You_Do: "" });
        setPickedExercises(new Set());
        setPickedIDoFiles(new Set());
        setPickedStudents(null);
        setStudentQuery("");
        setPage(1);
    }, [course]);
    // Client change: reset course too (already handled by onClient).

    const f = useMemo<ViewFilter>(
        () => ({
            client,
            course,
            clients,
            courseOpts,
            courseIds,
            clientOf,
            onClient: (v: string) => {
                setClient(v);
                setCourse("all");
            },
            onCourse: (v: string) => setCourse(v),
        }),
        [client, course, clients, courseOpts, courseIds, clientOf],
    );

    // ── Data ───────────────────────────────────────────────────────────────
    // Institution roll-up (12s call, shared cache entry). Powers the student
    // list. Filtered down to the current course/client scope by buildPerfBase.
    const { loading, error, data } = useStaffAnalytics((j) => j?.data ?? null);
    const base = useMemo(() => buildPerfBase(data, f), [data, f]);

    // Course pedagogy + participant answers — only when ONE course is picked.
    // Without a specific course we have no exercise list to score against.
    const courseDataQuery = useQuery({
        ...(course !== "all" ? courseDataApi.getById(course) : { queryKey: ["course-detail-skip"], queryFn: async () => null as any }),
        enabled: course !== "all" && !!course,
    });
    const courseData = (courseDataQuery.data as any)?.data ?? null;
    const catalogue = useMemo(() => walkCatalogue(courseData), [courseData]);
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

    const activeCourseName = courseOpts.find((c) => c.id === course)?.name;
    const scopeLine = scopeLabel(f, activeCourseName) || "All clients · all courses";

    // ── Selection state ────────────────────────────────────────────────────
    // Which stages the head has enabled. I Do is included alongside We Do
    // and You Do because I Do MCQ-bearing documents are score-tracked too;
    // see `walkIDoCatalogue` for the discovery rule.
    // All three stages (I Do / We Do / You Do) are always in play — the user
    // asked us to drop the enable/disable toggles. A stage simply omits its
    // panel when the course has no content for it (see the panel row).
    const [activeStage, setActiveStage] = useState<Extract<Stage, "I_Do" | "We_Do" | "You_Do">>("We_Do");
    // Per-stage active sub-category tab. "" = default to first available.
    const [activeSubcat, setActiveSubcat] = useState<Record<"I_Do" | "We_Do" | "You_Do", string>>({ I_Do: "", We_Do: "", You_Do: "" });
    const [pickedExercises, setPickedExercises] = useState<Set<string>>(new Set());
    /** Picked I Do MCQ file ids — a separate set because I Do items are files
     *  (with MCQs inside), not exercise objects. `walkIDoCatalogue` produces
     *  them; `computeIDoMarks` scores them. */
    const [pickedIDoFiles, setPickedIDoFiles] = useState<Set<string>>(new Set());
    // `null` means "all students in scope" — same convention as the exercise
    // set. When the user first picks one, the set is seeded from what's
    // visible so the toggle-off flow is intuitive.
    const [pickedStudents, setPickedStudents] = useState<Set<string> | null>(null);
    const [studentQuery, setStudentQuery] = useState("");
    /** Collapsed vs expanded Report Setup. Collapsing does NOT clear picks. */
    const [setupCollapsed, setSetupCollapsed] = useState(false);
    /** Student Detail modal open target — one row's data or null. */
    const [detailFor, setDetailFor] = useState<string | null>(null);

    // I Do catalogue — files with active MCQs on this course, in syllabus order.
    const idoCatalogue = useMemo<IDoFile[]>(() => walkIDoCatalogue(courseData), [courseData]);

    // Group I Do files by sub-category so the panel below can render tabs.
    const idoGrouped = useMemo(() => {
        const out: Record<string, IDoFile[]> = {};
        for (const f of idoCatalogue) {
            if (!out[f.subCategory]) out[f.subCategory] = [];
            out[f.subCategory].push(f);
        }
        return out;
    }, [idoCatalogue]);

    // Group We_Do / You_Do catalogue by stage → subcategory → [exercises].
    const grouped = useMemo(() => {
        const out: Record<"We_Do" | "You_Do", Record<string, CatalogueEx[]>> = { We_Do: {}, You_Do: {} };
        for (const ex of catalogue) {
            const stage = ex.stage;
            const sub = ex.subCategory; // Already pretty-labelled by walkCatalogue.
            if (!out[stage][sub]) out[stage][sub] = [];
            out[stage][sub].push(ex);
        }
        return out;
    }, [catalogue]);

    // Sub-category tabs per stage — sorted so tab order is stable.
    const subcatsOf = (stage: "I_Do" | "We_Do" | "You_Do") => {
        if (stage === "I_Do") return Object.keys(idoGrouped).sort((a, b) => a.localeCompare(b));
        return Object.keys(grouped[stage]).sort((a, b) => a.localeCompare(b));
    };

    // Default the active sub-category tab to the first available on the
    // current stage the first time the catalogue lands.
    useEffect(() => {
        (["I_Do", "We_Do", "You_Do"] as const).forEach((stage) => {
            const subs = subcatsOf(stage);
            if (subs.length === 0) return;
            if (activeSubcat[stage] && subs.includes(activeSubcat[stage])) return;
            setActiveSubcat((prev) => ({ ...prev, [stage]: subs[0] }));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogue, idoCatalogue]);

    // Selected We_Do / You_Do exercises: the picked ids intersected with
    // what the catalogue still contains (guards against stale picks after a
    // course swap).
    const activeExercises = useMemo(
        () => catalogue.filter((e) => pickedExercises.has(e.id)),
        [catalogue, pickedExercises],
    );
    /** Selected I Do MCQ files. */
    const activeIDoFiles = useMemo(
        () => idoCatalogue.filter((f) => pickedIDoFiles.has(f.id)),
        [idoCatalogue, pickedIDoFiles],
    );
    const activeItemsCount = activeExercises.length + activeIDoFiles.length;

    // Distinct learner roster for the Students column — the L&D scope list
    // (base.students) collapsed by pid so a learner enrolled twice on the
    // same course still appears once. Ordered by name so the checklist
    // scrolls predictably.
    const studentOpts = useMemo(() => {
        const seen = new Map<string, { pid: string; name: string; email: string }>();
        for (const s of base.students) {
            if (!seen.has(s.pid)) seen.set(s.pid, { pid: s.pid, name: s.name, email: s.email });
        }
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [base.students]);

    // ── Results ────────────────────────────────────────────────────────────
    // Grouped columns — one per (stage, sub-category) with at least one
    // selected item. A group can carry either We_Do / You_Do exercises OR
    // I_Do MCQ files; downstream code branches on `stage`.
    type ColGroup = {
        stage: "I_Do" | "We_Do" | "You_Do";
        subcat: string;
        exercises: CatalogueEx[];
        idoFiles: IDoFile[];
    };
    /** Every item that produces a column, in the order the table renders them.
     *  Used by row scoring so the loops don't have to branch on stage. */
    type ItemPointer = { id: string; kind: "ex"; ex: CatalogueEx } | { id: string; kind: "ido"; file: IDoFile };
    const colGroups = useMemo<ColGroup[]>(() => {
        const map = new Map<string, ColGroup>();
        for (const ex of activeExercises) {
            const key = `${ex.stage}:${ex.subCategory}`;
            let g = map.get(key);
            if (!g) {
                g = { stage: ex.stage as "We_Do" | "You_Do", subcat: ex.subCategory, exercises: [], idoFiles: [] };
                map.set(key, g);
            }
            g.exercises.push(ex);
        }
        for (const f of activeIDoFiles) {
            const key = `I_Do:${f.subCategory}`;
            let g = map.get(key);
            if (!g) {
                g = { stage: "I_Do", subcat: f.subCategory, exercises: [], idoFiles: [] };
                map.set(key, g);
            }
            g.idoFiles.push(f);
        }
        // I Do first, We Do second, You Do third, sub-cats alphabetical within.
        const stageOrder: Record<ColGroup["stage"], number> = { I_Do: 0, We_Do: 1, You_Do: 2 };
        return [...map.values()].sort((a, b) => {
            if (a.stage !== b.stage) return stageOrder[a.stage] - stageOrder[b.stage];
            return a.subcat.localeCompare(b.subcat);
        });
    }, [activeExercises, activeIDoFiles]);
    /** Flat item pointers, in canvas order. Row loops walk this instead of
     *  branching on stage per column. */
    const itemPointers = useMemo<ItemPointer[]>(() => {
        const out: ItemPointer[] = [];
        for (const g of colGroups) {
            if (g.stage === "I_Do") {
                for (const f of g.idoFiles) out.push({ id: f.id, kind: "ido", file: f });
            } else {
                for (const ex of g.exercises) out.push({ id: ex.id, kind: "ex", ex });
            }
        }
        return out;
    }, [colGroups]);

    // Per-row per-column data. `null` scoredMarks means "not attempted".
    interface RowScore { pct: number | null; scored: number; total: number; }
    interface StudentRow {
        pid: string;
        name: string;
        email: string;
        cells: Map<string, RowScore>; // key = exerciseId
        groupAvg: Map<string, number | null>; // key = "stage:subcat"
        overallPct: number | null;
        overallScored: number;
        overallTotal: number;
        /** Progress = share of selected exercises this learner attempted. A
         *  separate signal from Score: someone can have 100% score on the
         *  one exercise they tried and still be 25% progress against a
         *  four-exercise selection. */
        progressPct: number;
        attemptedCount: number;
    }
    const rows = useMemo<StudentRow[]>(() => {
        // Distinct students in scope — someone enrolled twice on the same
        // course should still be one row.
        const seen = new Map<string, { pid: string; name: string; email: string }>();
        for (const s of base.students) {
            if (!seen.has(s.pid)) seen.set(s.pid, { pid: s.pid, name: s.name, email: s.email });
        }
        const out: StudentRow[] = [];
        for (const s of seen.values()) {
            // Filter by the Students column's selection. `null` = all.
            if (pickedStudents !== null && !pickedStudents.has(s.pid)) continue;
            const cells = new Map<string, RowScore>();
            const groupAvg = new Map<string, number | null>();
            let overallScored = 0;
            let overallTotal = 0;

            const participant = participants.get(s.pid);
            // Score every selected item — We Do / You Do via computeStudentMarks,
            // I Do via computeIDoMarks — into the same cells map so downstream
            // rendering treats them uniformly.
            for (const p of itemPointers) {
                if (p.kind === "ex") {
                    const { ex } = p;
                    if (!courseData || !participant) {
                        cells.set(ex.id, { pct: null, scored: 0, total: ex.totalMarks });
                        continue;
                    }
                    const m = computeStudentMarks({ courseData, courseId: course, exerciseId: ex.id, participant });
                    const total = m.totalMarks || ex.totalMarks || 0;
                    const scored = m.hasSubmitted ? m.scoredMarks : 0;
                    const pct = m.hasSubmitted && total > 0 ? Math.round((scored / total) * 100) : null;
                    cells.set(ex.id, { pct, scored, total });
                    overallScored += scored;
                    overallTotal += total;
                } else {
                    const { file } = p;
                    if (!courseData || !participant) {
                        cells.set(file.id, { pct: null, scored: 0, total: file.totalMcq });
                        continue;
                    }
                    const m = computeIDoMarks({ participant, courseId: course, file });
                    // I Do cells display COMPLETION, not correctness — the
                    // resource is what the learner completes. `scored/total`
                    // in the bubble means "MCQs attempted / total" so the
                    // "N / M" secondary reads as completion progress.
                    cells.set(file.id, {
                        pct: m.pct,
                        scored: m.attemptedMcq,
                        total: m.totalMcq,
                    });
                    // I Do is intentionally EXCLUDED from the Overall Score
                    // roll-up. Score is a marks concept — I Do is a
                    // completion concept — mixing them would misrepresent
                    // both. I Do still contributes to Progress via
                    // `attemptedCount` below (a completed I Do resource
                    // does count as attended for progress).
                }
            }

            // Group averages: mean of the per-item % (only counting cells that
            // were actually attempted, so an un-started item doesn't drag the
            // average to 0).
            for (const g of colGroups) {
                const vals: number[] = [];
                const items = g.stage === "I_Do" ? g.idoFiles.map((f) => f.id) : g.exercises.map((e) => e.id);
                for (const id of items) {
                    const c = cells.get(id);
                    if (c && c.pct !== null) vals.push(c.pct);
                }
                groupAvg.set(
                    `${g.stage}:${g.subcat}`,
                    vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
                );
            }

            const overallPct = overallTotal > 0 ? Math.round((overallScored / overallTotal) * 100) : null;
            let attemptedCount = 0;
            cells.forEach((c) => { if (c.pct !== null) attemptedCount += 1; });
            const progressPct = itemPointers.length > 0
                ? Math.round((attemptedCount / itemPointers.length) * 100)
                : 0;
            out.push({ pid: s.pid, name: s.name, email: s.email, cells, groupAvg, overallPct, overallScored, overallTotal, progressPct, attemptedCount });
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }, [base.students, itemPointers, colGroups, courseData, participants, course, pickedStudents]);

    // Aggregate metrics for the Report Summary header — computed once over
    // the full row set (NOT the paginated slice) so what the head sees stays
    // consistent across pages.
    const summaryMetrics = useMemo(() => {
        const scores = rows.map((r) => r.overallPct).filter((v): v is number => v !== null);
        const progresses = rows.map((r) => r.progressPct);
        const mean = (vals: number[]) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
        return {
            averageScore: mean(scores),
            highestScore: scores.length ? Math.max(...scores) : null,
            lowestScore: scores.length ? Math.min(...scores) : null,
            averageProgress: mean(progresses),
        };
    }, [rows]);

    // Pagination
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    useEffect(() => {
        // Clamp page after selection changes reduce the row count.
        if (page > pageCount) setPage(1);
    }, [pageCount, page]);
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── Downloads ──────────────────────────────────────────────────────────
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
    const downloadRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!downloadOpen) return;
        const onDown = (e: MouseEvent) => {
            if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false);
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [downloadOpen]);

    const canDownload = rows.length > 0 && colGroups.length > 0;
    const today10 = () => new Date().toISOString().slice(0, 10);

    const downloadExcel = async () => {
        if (busy || !canDownload) return;
        setBusy("xlsx");
        try {
            const [xl, fsv] = await Promise.all([import("exceljs"), import("file-saver")]);
            const ExcelJS: any = (xl as any).default ?? xl;
            const saveAs: (b: Blob, name: string) => void = (fsv as any).saveAs ?? (fsv as any).default;
            const wb = new ExcelJS.Workbook();
            wb.creator = "SmartCliff";
            wb.created = new Date();
            const ws = wb.addWorksheet("Report");

            // Header row 1: group titles (merged across each group's cells).
            // Header row 2: per-exercise columns + "Average" per group + "Overall".
            const groupCols: number[] = []; // count of columns per group (exercises + 1 avg)
            colGroups.forEach((g) => groupCols.push((g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length) + 1));
            const totalGroupCols = groupCols.reduce((a, b) => a + b, 0);

            const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB6834" } } as any;
            const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 } as any;
            const border = {
                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            } as any;

            // Row 1
            const r1 = ws.addRow([
                "Student",
                "Email",
                ...colGroups.flatMap((g) => {
                    const stageLabel = g.stage === "I_Do" ? "I Do" : g.stage === "We_Do" ? "We Do" : "You Do";
                    const label = `${stageLabel} > ${g.subcat}`;
                    const itemCount = g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length;
                    return [label, ...Array(itemCount).fill("")];
                }),
                "Overall",
                "",
            ]);
            r1.eachCell((c: any) => { c.style = { font: headerFont, fill: headerFill, alignment: { vertical: "middle", horizontal: "center" }, border }; });
            // Merge group titles + Overall header pair
            let col = 3;
            colGroups.forEach((g) => {
                const count = g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length;
                ws.mergeCells(r1.number, col, r1.number, col + count);
                col += count + 1;
            });
            ws.mergeCells(r1.number, col, r1.number, col + 1);

            // Row 2 — per-column labels
            const subHead = ["", "" ];
            colGroups.forEach((g) => {
                const items = g.stage === "I_Do" ? g.idoFiles : g.exercises;
                items.forEach((it) => subHead.push(it.name));
                subHead.push("Average");
            });
            subHead.push("Score (Total)");
            subHead.push("Progress");
            const r2 = ws.addRow(subHead);
            r2.eachCell((c: any) => { c.style = { font: { bold: true, size: 10 }, alignment: { horizontal: "center" }, border, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } } }; });

            ws.getColumn(1).width = 26;
            ws.getColumn(2).width = 30;
            let colIdx = 3;
            colGroups.forEach((g) => {
                const count = g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length;
                for (let i = 0; i < count; i++) { ws.getColumn(colIdx).width = 12; colIdx += 1; }
                ws.getColumn(colIdx).width = 12; colIdx += 1; // Average
            });
            ws.getColumn(colIdx).width = 14; // Score (Total)
            ws.getColumn(colIdx + 1).width = 12; // Progress

            for (const r of rows) {
                const cells: any[] = [r.name, r.email];
                for (const g of colGroups) {
                    const items = g.stage === "I_Do"
                        ? g.idoFiles.map((f) => f.id)
                        : g.exercises.map((e) => e.id);
                    for (const id of items) {
                        const c = r.cells.get(id);
                        cells.push(c && c.pct !== null ? `${c.pct}%` : "—");
                    }
                    const avg = r.groupAvg.get(`${g.stage}:${g.subcat}`);
                    cells.push(avg === null || avg === undefined ? "—" : `${avg}%`);
                }
                cells.push(r.overallTotal > 0 ? `${r.overallScored} / ${r.overallTotal}` : "—");
                cells.push(`${r.progressPct}%`);
                const row = ws.addRow(cells);
                row.eachCell((c: any) => { c.style = { font: { size: 10 }, alignment: { horizontal: "center", vertical: "middle" }, border }; });
                row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
                row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
            }
            ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }];

            const buf = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `performance-report_${today10()}.xlsx`);
            setDownloadOpen(false);
            // The `totalGroupCols` above is used only by ExcelJS's merge maths;
            // silence the unused-var lint by touching it here.
            void totalGroupCols;
        } catch (e) {
            console.error("Excel export failed", e);
        } finally {
            setBusy("");
        }
    };

    const downloadPdf = async () => {
        if (busy || !canDownload) return;
        setBusy("pdf");
        try {
            const [{ default: jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
            const autoTable: any = (autoTableMod as any).default ?? autoTableMod;
            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            const pageW = doc.internal.pageSize.getWidth();
            const M = 32;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(17, 24, 39);
            doc.text("Learner Progress & Performance Report", M, 44);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text(`${scopeLine} · ${rows.length} student${rows.length === 1 ? "" : "s"}`, M, 60);
            doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, M, 72);

            // Two-row header: group titles (merged with colSpan), then per-cell labels.
            const groupHead = [
                { content: "Student", rowSpan: 2, styles: { halign: "left" as const, valign: "middle" as const } },
                ...colGroups.map((g) => {
                    const stageLabel = g.stage === "I_Do" ? "I Do" : g.stage === "We_Do" ? "We Do" : "You Do";
                    const count = g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length;
                    return {
                        content: `${stageLabel} > ${g.subcat}`,
                        colSpan: count + 1,
                        styles: { halign: "center" as const },
                    };
                }),
                { content: "Overall", colSpan: 2, styles: { halign: "center" as const } },
            ];
            const cellHead: any[] = [];
            colGroups.forEach((g) => {
                const items = g.stage === "I_Do" ? g.idoFiles : g.exercises;
                items.forEach((it) => cellHead.push({ content: it.name }));
                cellHead.push({ content: "Avg" });
            });
            cellHead.push({ content: "Score" });
            cellHead.push({ content: "Progress" });

            const body = rows.map((r) => {
                const line: any[] = [{ content: r.name, styles: { halign: "left" as const } }];
                for (const g of colGroups) {
                    const ids = g.stage === "I_Do" ? g.idoFiles.map((f) => f.id) : g.exercises.map((e) => e.id);
                    for (const id of ids) {
                        const c = r.cells.get(id);
                        line.push({ content: c && c.pct !== null ? `${c.pct}%` : "—" });
                    }
                    const avg = r.groupAvg.get(`${g.stage}:${g.subcat}`);
                    line.push({ content: avg === null || avg === undefined ? "—" : `${avg}%` });
                }
                line.push({ content: r.overallTotal > 0 ? `${r.overallScored}/${r.overallTotal}` : "—" });
                line.push({ content: `${r.progressPct}%` });
                return line;
            });

            autoTable(doc, {
                startY: 90,
                head: [groupHead, cellHead],
                body,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle" },
                headStyles: { fillColor: [235, 104, 52], textColor: 255, fontStyle: "bold" },
                columnStyles: { 0: { halign: "left", cellWidth: 130 } },
                margin: { left: M, right: M },
                didDrawPage: () => {
                    const p = (doc as any).internal.getCurrentPageInfo().pageNumber;
                    doc.setFontSize(8);
                    doc.setTextColor(156, 163, 175);
                    doc.text(`Page ${p}`, pageW - M, doc.internal.pageSize.getHeight() - 14, { align: "right" });
                },
            });

            doc.save(`performance-report_${today10()}.pdf`);
            setDownloadOpen(false);
        } catch (e) {
            console.error("PDF export failed", e);
        } finally {
            setBusy("");
        }
    };

    const toggleExercise = (id: string) => {
        setPickedExercises((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };
    const toggleIDoFile = (id: string) => {
        setPickedIDoFiles((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };
    /** Whichever sub-category is currently visible for `activeStage`.
     *  Falls back to the first available so Select all / Clear still work
     *  before the user has clicked any tab. */
    const effectiveActiveSub = (): string => {
        const explicit = activeSubcat[activeStage];
        if (explicit) return explicit;
        return subcatsOf(activeStage)[0] ?? "";
    };
    const selectAllForActiveSubcat = () => {
        const sub = effectiveActiveSub();
        if (!sub) return;
        if (activeStage === "I_Do") {
            const files = idoGrouped[sub] ?? [];
            setPickedIDoFiles((prev) => {
                const n = new Set(prev);
                files.forEach((f) => n.add(f.id));
                return n;
            });
            return;
        }
        const exs = grouped[activeStage][sub] ?? [];
        setPickedExercises((prev) => {
            const n = new Set(prev);
            exs.forEach((e) => n.add(e.id));
            return n;
        });
    };
    const clearAllForActiveSubcat = () => {
        const sub = effectiveActiveSub();
        if (!sub) return;
        if (activeStage === "I_Do") {
            const files = idoGrouped[sub] ?? [];
            setPickedIDoFiles((prev) => {
                const n = new Set(prev);
                files.forEach((f) => n.delete(f.id));
                return n;
            });
            return;
        }
        const exs = grouped[activeStage][sub] ?? [];
        setPickedExercises((prev) => {
            const n = new Set(prev);
            exs.forEach((e) => n.delete(e.id));
            return n;
        });
    };
    // ── Student picker helpers (third column) ──────────────────────────
    const toggleStudent = (pid: string) => {
        setPickedStudents((prev) => {
            const next = new Set(prev === null ? studentOpts.map((s) => s.pid) : prev);
            if (next.has(pid)) next.delete(pid);
            else next.add(pid);
            // Collapse "everyone ticked" back to null so the "All students"
            // switch stays in sync without a separate flag.
            return next.size === studentOpts.length ? null : next;
        });
    };
    const toggleAllStudents = () => setPickedStudents((prev) => (prev === null ? new Set() : null));

    const scopeSettling = isStaff && (rosterQ.isLoading || attnQ.isLoading);
    const isLoading = loading || scopeSettling;

    // ── Render ─────────────────────────────────────────────────────────────
    if (!mode) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface">
                <Loading size="size-8" />
            </div>
        );
    }

    const content = (
        <div className="flex h-full min-h-0 flex-1 flex-col bg-surface">
            {/* Header — title only. The Export / Print pair now lives on the
                Report Summary row below, next to the numbers a reader would
                actually want to save or print. */}
            <header className="flex-shrink-0 bg-surface px-5 pb-2 pt-4 sm:px-7 sm:pb-3 sm:pt-5">
                <h1 className="text-[20px] font-bold tracking-[-0.015em] text-heading">
                    Learner Progress &amp; Performance Report
                </h1>
            </header>

            {isLoading ? (
                <div className="flex min-h-[60vh] items-center justify-center bg-surface">
                    <Loading size="size-8" />
                </div>
            ) : error ? (
                <div className="flex min-h-[60vh] items-center justify-center bg-surface px-4">
                    <p className="text-[13px] text-danger-700">{error}</p>
                </div>
            ) : (
                // Flat body — no card-in-card wrappers, no numbered section
                // titles, no step indicator. The layout carries the flow
                // (Client → Course → Stage → Sub-category → Exercises) via
                // grouping and spacing, not headings.
                <div className="flex-1 overflow-y-auto px-5 pb-8 sm:px-7">
                    {/* ── Report Setup — one collapsible section holding every
                          selection control (Client / Course / stages / sub-cats /
                          exercises / students). Collapsing preserves state. */}
                    <ReportSetupSection
                        collapsed={setupCollapsed}
                        onToggle={() => setSetupCollapsed((v) => !v)}
                    >
                        {/* Row 1 — Client + Course, side-by-side. */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FloatingSelect
                                label="Client"
                                icon={<Users size={14} />}
                                value={client}
                                onChange={(v) => { setClient(v); setCourse("all"); }}
                                /* "All clients" was the first option and — being the
                                   default — was doing no work for the reader; a
                                   report page starts by narrowing to one client, so
                                   the first row now literally says "Select client".
                                   Same story on the course row below. */
                                options={[{ value: "all", label: "Select client" }, ...clients.map((c) => ({ value: c, label: c }))]}
                            />
                            <FloatingSelect
                                label="Course"
                                icon={<Book size={14} />}
                                value={course}
                                onChange={setCourse}
                                options={[{ value: "all", label: "Select Course" }, ...courseOpts.map((c) => ({ value: c.id, label: c.name }))]}
                            />
                        </div>

                        {course === "all" ? (
                            <p className="mt-5 text-[11.5px] text-subtle">
                                Pick a single course above to see its I Do, We Do and You Do content.
                            </p>
                        ) : courseDataQuery.isLoading ? (
                            <p className="mt-5 inline-flex items-center gap-2 text-[11.5px] text-subtle">
                                <Loader2 size={14} className="animate-spin" /> Loading course pedagogy…
                            </p>
                        ) : (catalogue.length === 0 && idoCatalogue.length === 0) ? (
                            <p className="mt-5 text-[11.5px] text-subtle">This course has no I Do MCQs, assignments, or assessments configured.</p>
                        ) : (
                            (() => {
                                // Effective active sub-category, computed at render
                                // time so the FIRST tab is always highlighted the
                                // moment a course loads.
                                const iSubs = subcatsOf("I_Do");
                                const weSubs = subcatsOf("We_Do");
                                const youSubs = subcatsOf("You_Do");
                                const iActive = (activeSubcat.I_Do && iSubs.includes(activeSubcat.I_Do)) ? activeSubcat.I_Do : (iSubs[0] || "");
                                const weActive = (activeSubcat.We_Do && weSubs.includes(activeSubcat.We_Do)) ? activeSubcat.We_Do : (weSubs[0] || "");
                                const youActive = (activeSubcat.You_Do && youSubs.includes(activeSubcat.You_Do)) ? activeSubcat.You_Do : (youSubs[0] || "");
                                return (
                                    <>
                                        {/* All three stage panels render by default. No
                                            separate enable / disable step: a stage
                                            simply omits its panel when the course has
                                            no content for it, so the user never sees
                                            an empty widget. Stage count sits inside
                                            each panel's own header, not as a separate
                                            toggle row. */}
                                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                            {iSubs.length > 0 ? (
                                                <SelectionPanel
                                                    stage="I_Do"
                                                    stageLabel="I Do Selection"
                                                    stageCountHint={`${idoCatalogue.length} resource${idoCatalogue.length === 1 ? "" : "s"}`}
                                                    subcats={iSubs}
                                                    activeSub={iActive}
                                                    onActiveSub={(s) => { setActiveStage("I_Do"); setActiveSubcat((p) => ({ ...p, I_Do: s })); }}
                                                    exercises={(idoGrouped[iActive] || []).map((f) => ({ id: f.id, name: f.name, sub: `${f.totalMcq} MCQ${f.totalMcq === 1 ? "" : "s"} · ${f.path}` }))}
                                                    picked={pickedIDoFiles}
                                                    onToggle={toggleIDoFile}
                                                    onSelectAll={() => { setActiveStage("I_Do"); selectAllForActiveSubcat(); }}
                                                    onClear={() => { setActiveStage("I_Do"); clearAllForActiveSubcat(); }}
                                                    onFocus={() => setActiveStage("I_Do")}
                                                />
                                            ) : null}
                                            {weSubs.length > 0 ? (
                                                <SelectionPanel
                                                    stage="We_Do"
                                                    stageLabel="We Do Selection"
                                                    stageCountHint={`${(grouped.We_Do && Object.values(grouped.We_Do).reduce((n, a) => n + a.length, 0)) || 0} exercises`}
                                                    subcats={weSubs}
                                                    activeSub={weActive}
                                                    onActiveSub={(s) => { setActiveStage("We_Do"); setActiveSubcat((p) => ({ ...p, We_Do: s })); }}
                                                    exercises={(grouped.We_Do[weActive] || []).map((e) => ({ id: e.id, name: e.name, sub: `${e.totalMarks} marks · ${e.totalQuestions} Q` }))}
                                                    picked={pickedExercises}
                                                    onToggle={toggleExercise}
                                                    onSelectAll={() => { setActiveStage("We_Do"); selectAllForActiveSubcat(); }}
                                                    onClear={() => { setActiveStage("We_Do"); clearAllForActiveSubcat(); }}
                                                    onFocus={() => setActiveStage("We_Do")}
                                                />
                                            ) : null}
                                            {youSubs.length > 0 ? (
                                                <SelectionPanel
                                                    stage="You_Do"
                                                    stageLabel="You Do Selection"
                                                    stageCountHint={`${(grouped.You_Do && Object.values(grouped.You_Do).reduce((n, a) => n + a.length, 0)) || 0} exercises`}
                                                    subcats={youSubs}
                                                    activeSub={youActive}
                                                    onActiveSub={(s) => { setActiveStage("You_Do"); setActiveSubcat((p) => ({ ...p, You_Do: s })); }}
                                                    exercises={(grouped.You_Do[youActive] || []).map((e) => ({ id: e.id, name: e.name, sub: `${e.totalMarks} marks · ${e.totalQuestions} Q` }))}
                                                    picked={pickedExercises}
                                                    onToggle={toggleExercise}
                                                    onSelectAll={() => { setActiveStage("You_Do"); selectAllForActiveSubcat(); }}
                                                    onClear={() => { setActiveStage("You_Do"); clearAllForActiveSubcat(); }}
                                                    onFocus={() => setActiveStage("You_Do")}
                                                />
                                            ) : null}
                                        </div>

                                        {/* Row 4 — Students panel, always visible so
                                            the head can narrow the roster while
                                            picking exercises. */}
                                        <div className="mt-4">
                                            <StudentsPanel
                                                students={studentOpts}
                                                picked={pickedStudents}
                                                onToggle={toggleStudent}
                                                onToggleAll={toggleAllStudents}
                                                query={studentQuery}
                                                onQuery={setStudentQuery}
                                            />
                                        </div>
                                    </>
                                );
                            })()
                        )}
                    </ReportSetupSection>

                    {/* Results — subtle divider then the summary heading and
                        the table. No outer card wrapper. */}
                    <div className="mt-6 border-t border-hairline pt-5">
                        {/* The heading row now carries three things: the "Report
                            Summary" title on the left, the metric row in the
                            middle, and the Export / Print pair on the right.
                            justify-between splits into two flex children with
                            the metrics + actions grouped so the buttons stay
                            hard-pinned to the row's right corner. no-print keeps
                            the buttons out of paper — they mean nothing there. */}
                        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <h3 className="text-[13.5px] font-semibold text-heading">Report Summary</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                {rows.length > 0 && activeExercises.length > 0 ? (
                                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                                        <SummaryStat label="Average Score" value={summaryMetrics.averageScore} tone="ink" />
                                        <SummaryStat label="Highest Score" value={summaryMetrics.highestScore} tone="good" />
                                        <SummaryStat label="Lowest Score" value={summaryMetrics.lowestScore} tone="bad" />
                                        <SummaryStat label="Avg. Progress" value={summaryMetrics.averageProgress} tone="brand" />
                                    </div>
                                ) : null}
                                {/* Export (was "Download" in the page header) — same
                                    dropdown, same PDF/Excel handlers; only its home
                                    and label moved. Print sits beside it and fires
                                    the browser's own print dialog on the page. */}
                                <div className="no-print flex items-center gap-1.5" ref={downloadRef}>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            disabled={!canDownload || !!busy}
                                            onClick={() => setDownloadOpen((v) => !v)}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-control bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                            Export
                                            <ChevronDown size={11} className={`transition-transform ${downloadOpen ? "rotate-180" : ""}`} />
                                        </button>
                                        {downloadOpen ? (
                                            <div className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-tile border border-hairline bg-surface shadow-lg">
                                                <button
                                                    type="button"
                                                    onClick={downloadPdf}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-body hover:bg-row-hover"
                                                >
                                                    <FileText size={14} className="text-danger-500" /> Export as PDF
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={downloadExcel}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-body hover:bg-row-hover"
                                                >
                                                    <FileSpreadsheet size={14} className="text-success-700" /> Export as Excel
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        title="Print this report"
                                        aria-label="Print report"
                                        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline-strong bg-surface px-3 text-[12px] font-semibold text-body transition-colors hover:bg-row-hover hover:text-heading"
                                    >
                                        <Printer size={12} />
                                        Print
                                    </button>
                                </div>
                            </div>
                        </div>

                        {course === "all" || (catalogue.length === 0 && idoCatalogue.length === 0) ? (
                            <EmptyPanel>Pick a course and select exercises above to build the report.</EmptyPanel>
                        ) : activeItemsCount === 0 ? (
                            <EmptyPanel>Tick at least one I Do MCQ, We Do exercise, or You Do assessment above to score the learners.</EmptyPanel>
                        ) : rows.length === 0 ? (
                            <EmptyPanel>No learners are enrolled in this course.</EmptyPanel>
                        ) : (
                            <ReportTable
                                colGroups={colGroups}
                                rows={pageRows}
                                page={page}
                                pageCount={pageCount}
                                onPage={setPage}
                                pageFrom={(page - 1) * PAGE_SIZE + 1}
                                pageTo={Math.min(page * PAGE_SIZE, rows.length)}
                                totalRows={rows.length}
                                onViewDetails={(pid) => setDetailFor(pid)}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Student Detail modal — mounted at the top level so it overlays
                the whole shell. `detailFor` is the pid of the selected row. */}
            {(() => {
                if (!detailFor) return null;
                const row = rows.find((r) => r.pid === detailFor);
                if (!row) return null;
                const student: StudentDetailStudent = {
                    pid: row.pid,
                    name: row.name,
                    email: row.email,
                    overallPct: row.overallPct,
                    overallScored: row.overallScored,
                    overallTotal: row.overallTotal,
                    progressPct: row.progressPct,
                    attemptedCount: row.attemptedCount,
                };
                const groups: StudentDetailGroup[] = colGroups.map((g) => ({
                    stage: g.stage,
                    subcat: g.subcat,
                    exercises: g.stage === "I_Do" ? undefined : g.exercises,
                    idoFiles: g.stage === "I_Do" ? g.idoFiles : undefined,
                }));
                return (
                    <StudentDetailModal
                        open
                        student={student}
                        groups={groups}
                        courseId={course}
                        courseName={activeCourseName}
                        courseData={courseData}
                        participant={participants.get(row.pid) ?? null}
                        onClose={() => setDetailFor(null)}
                    />
                );
            })()}
        </div>
    );

    // L&D Head / Subhead: keep the L&D console shell with `Reports` active so
    // the sidebar doesn't flip to a different menu on click. Admin/POC use the
    // admin shell, trainers use the staff shell.
    if (mode.shell === "ld") {
        return <LDLayout active="rep-performance">{content}</LDLayout>;
    }
    return mode.shell === "admin" ? (
        <DashboardLayout>{content}</DashboardLayout>
    ) : (
        <StaffLayout>{content}</StaffLayout>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Presentational helpers
 * The whole page is one file on purpose — the sub-components are only useful
 * here and inline definitions keep the reader on one screen.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * FloatingSelect — the material/shadcn-style select the redesign wants.
 *
 * The label sits ON the top border of the control (`-top-2` + a small strip
 * of `bg-surface` behind it) so it reads as the field's title without a
 * separate row above the control. Since a `<select>` always has a value, the
 * label stays floated at all times — there is no "empty state" to interpolate.
 *
 * The `focused` state paints the border and label in the brand orange, so the
 * user sees which of the two selects they are editing without another chip
 * or hint line. `native` under the hood keeps keyboard + mobile behaviour
 * that a custom Combobox would trade away for very little gain.
 */
/**
 * FloatingSelect — modern searchable combobox with a floating label.
 *
 * The native `<select>` this replaced worked but rendered whatever chrome the
 * OS shipped with — a long courses list scrolled miserably, and there was no
 * way to search. This custom picker keeps the same visual shell (rounded
 * border, brand-orange focus ring, floating label on the top border) but
 * opens a bordered popover with:
 *
 *   • an inline search box at the top (auto-focused on open) that filters
 *     the list by option label — case-insensitive substring match;
 *   • a scrollable list of results, keyboard-navigable with Arrow ↑/↓ /
 *     Home / End / Enter / Escape;
 *   • a check mark on the currently-selected row so the user can see where
 *     they are after scrolling.
 *
 * `value` is the option id (matches the previous `<select>` contract), so
 * every call site keeps working without a shape change.
 */
function FloatingSelect({
    label,
    icon,
    value,
    onChange,
    options,
}: {
    label: string;
    icon?: React.ReactNode;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    const current = options.find((o) => o.value === value);
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // On open, clear the query, point the active row at the current value,
    // and focus the search box so the user can type immediately.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        const idx = options.findIndex((o) => o.value === value);
        setActive(idx < 0 ? 0 : idx);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep the active row scrolled into view as the user arrows through.
    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    const commit = (v: string) => { onChange(v); setOpen(false); setQuery(""); };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Home") { e.preventDefault(); setActive(0); }
        else if (e.key === "End") { e.preventDefault(); setActive(filtered.length - 1); }
        else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[active]) commit(filtered[active].value);
        }
    };

    return (
        <div
            ref={rootRef}
            className={`relative rounded-control border bg-surface transition-colors ${
                open
                    ? "border-brand-500 ring-2 ring-brand-500/15"
                    : "border-hairline-strong hover:border-brand-300"
            }`}
        >
            <span
                className={`pointer-events-none absolute -top-[7px] left-3 bg-surface px-1.5 text-[11px] font-medium tracking-tight transition-colors ${
                    open ? "text-brand-strong" : "text-subtle"
                }`}
            >
                {label}
            </span>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`flex h-10 w-full items-center bg-transparent text-left outline-none ${icon ? "pl-3" : "pl-3"} pr-9`}
            >
                {icon ? <span className="mr-2 text-subtle">{icon}</span> : null}
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-body">
                    {current?.label ?? "Select…"}
                </span>
                <ChevronDown
                    size={14}
                    className={`pointer-events-none absolute right-3 text-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open ? (
                <div
                    role="listbox"
                    aria-label={label}
                    className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-control border border-hairline bg-surface shadow-lg"
                >
                    <div className="border-b border-hairline p-1.5">
                        <div className="relative">
                            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                                onKeyDown={onKeyDown}
                                placeholder={`Search ${label.toLowerCase()}…`}
                                className="h-8 w-full rounded-chip border border-hairline-strong bg-surface pl-7 pr-2 text-[11.5px] text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                            />
                        </div>
                    </div>
                    <ul ref={listRef} className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-[11px] text-subtle">No matches.</li>
                        ) : (
                            filtered.map((o, i) => {
                                const isActive = i === active;
                                const isSelected = o.value === value;
                                return (
                                    <li
                                        key={o.value}
                                        data-idx={i}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => commit(o.value)}
                                        className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[12px] transition-colors ${
                                            isActive ? "bg-brand-50" : ""
                                        } ${isSelected ? "font-semibold text-heading" : "font-medium text-body"}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                        {isSelected ? <Check size={13} className="shrink-0 text-brand-strong" /> : null}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 rounded-control border border-dashed border-hairline bg-surface-sunken/40 px-4 py-6 text-center text-[12px] text-subtle">
            {children}
        </div>
    );
}

/**
 * Third column of the selection row — Students.
 *
 * Same visual weight and interior chrome as the We Do / You Do panels so the
 * three read as one selection system rather than "two selectors plus a
 * widget". Header carries the title + hint + selected count, a compact
 * "All students" switch and a search field replace the sub-category tabs,
 * and the scrollable checkbox list below reuses the same row style.
 *
 * `picked === null` is "all"; toggling one student explicitly narrows the set,
 * flipping "All students" flips between null and an empty set.
 */
function StudentsPanel({
    students,
    picked,
    onToggle,
    onToggleAll,
    query,
    onQuery,
}: {
    students: { pid: string; name: string; email: string }[];
    picked: Set<string> | null;
    onToggle: (pid: string) => void;
    onToggleAll: () => void;
    query: string;
    onQuery: (q: string) => void;
}) {
    const total = students.length;
    const selectedCount = picked === null ? total : picked.size;
    const q = query.trim().toLowerCase();
    const shown = q
        ? students.filter((s) => s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q))
        : students;
    const allOn = picked === null;
    return (
        <div className="flex flex-col overflow-hidden rounded-control border border-hairline bg-surface">
            <header className="flex items-center justify-between border-b border-hairline px-3 py-2">
                <span className="text-[13px] font-semibold text-heading">Students</span>
                <span className="text-[10.5px] tabular-nums text-subtle">
                    {selectedCount} / {total} selected
                </span>
            </header>
            {total === 0 ? (
                <div className="px-3 py-6 text-center text-[11.5px] text-subtle">
                    No learners enrolled in this course.
                </div>
            ) : (
                <>
                    <div className="border-b border-hairline px-3 py-2">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={allOn}
                                onChange={onToggleAll}
                                className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                            />
                            <span className="flex-1 text-[12px] font-medium text-body">All students</span>
                            <span className="text-[10px] tabular-nums text-faint">{total.toLocaleString()}</span>
                        </label>
                        <div className="relative mt-2">
                            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => onQuery(e.target.value)}
                                placeholder="Search students…"
                                className="h-8 w-full rounded-chip border border-hairline-strong bg-surface pl-7 pr-2 text-[11.5px] text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto px-3 py-2">
                        {shown.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-subtle">No matches.</p>
                        ) : (
                            <ul className="flex flex-col gap-0.5">
                                {shown.map((s) => {
                                    const on = picked === null || picked.has(s.pid);
                                    return (
                                        <li key={s.pid}>
                                            <label className="flex cursor-pointer items-center gap-2 rounded-chip px-2 py-1.5 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => onToggle(s.pid)}
                                                    className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[12px] font-medium text-body">{s.name}</p>
                                                    {s.email ? (
                                                        <p className="truncate text-[10px] text-subtle">{s.email}</p>
                                                    ) : null}
                                                </div>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function SelectionPanel({
    stage,
    stageLabel,
    stageCountHint,
    subcats,
    activeSub,
    onActiveSub,
    exercises,
    picked,
    onToggle,
    onSelectAll,
    onClear,
    onFocus,
}: {
    stage: "I_Do" | "We_Do" | "You_Do";
    stageLabel: string;
    /** Muted hint next to the stage label — e.g. "29 exercises" or
     *  "1 resource". Replaces the outboard stage-toggle badge; kept
     *  subtle so it doesn't compete with the panel title. */
    stageCountHint?: string;
    subcats: string[];
    activeSub: string;
    onActiveSub: (s: string) => void;
    /** Generic item shape so the same panel renders exercise objects (We Do /
     *  You Do) and I Do MCQ files. Only `id` + `name` are load-bearing;
     *  `sub` is the tiny grey line under the name. */
    exercises: { id: string; name: string; sub?: string }[];
    picked: Set<string>;
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onClear: () => void;
    onFocus: () => void;
}) {
    return (
        <div
            className="flex flex-col overflow-hidden rounded-control border border-hairline bg-surface"
            onClick={onFocus}
        >
            <header className="flex items-center justify-between border-b border-hairline px-3 py-2">
                <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[13px] font-semibold text-heading">{stageLabel}</span>
                    {stageCountHint ? (
                        <span className="truncate text-[10.5px] tabular-nums text-faint">{stageCountHint}</span>
                    ) : null}
                </span>
                <span className="text-[10.5px] tabular-nums text-subtle">
                    {exercises.filter((e) => picked.has(e.id)).length} / {exercises.length} selected
                </span>
            </header>
            {subcats.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11.5px] text-subtle">
                    No {stage === "I_Do" ? "I Do" : stage === "We_Do" ? "We Do" : "You Do"} sub-categories in this course.
                </div>
            ) : (
                <>
                    {/* Sub-category tabs — underline-style, single-select.
                        Active tab's 2 px orange border sits on top of the row's
                        1 px hairline (`-mb-px`) so the two read as one line
                        broken only where the tab is. `role="tab"` announces
                        the single-select semantics to screen readers. */}
                    <div className="flex flex-wrap items-end gap-4 border-b border-hairline px-3" role="tablist">
                        {subcats.map((s) => {
                            const on = s === activeSub;
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => onActiveSub(s)}
                                    className={`-mb-px inline-flex items-center border-b-2 px-1 py-2 text-[12px] font-semibold transition-colors ${
                                        on
                                            ? "border-brand-500 text-heading"
                                            : "border-transparent text-subtle hover:text-body"
                                    }`}
                                >
                                    {prettySubcat(s)}
                                </button>
                            );
                        })}
                    </div>
                    {/* Exercise list actions live on their OWN row so it is
                        obvious they act on the exercises below, not on the
                        sub-categories above. */}
                    <div className="flex items-center justify-between px-3 pt-2">
                        <span className="text-[10.5px] tabular-nums text-subtle">
                            {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-2 text-[10.5px]">
                            <button
                                type="button"
                                onClick={onSelectAll}
                                className="font-semibold text-brand-strong hover:text-brand-800"
                            >
                                Select all
                            </button>
                            <span className="text-hairline-strong">|</span>
                            <button
                                type="button"
                                onClick={onClear}
                                className="font-semibold text-subtle hover:text-heading"
                            >
                                Clear
                            </button>
                        </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto px-3 pb-2 pt-1">
                        {exercises.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-subtle">
                                No exercises under {prettySubcat(activeSub || "this sub-category")}.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-0.5">
                                {exercises.map((ex) => {
                                    const on = picked.has(ex.id);
                                    return (
                                        <li key={ex.id}>
                                            <label className="flex cursor-pointer items-start gap-2 rounded-chip px-2 py-1.5 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => onToggle(ex.id)}
                                                    className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[12px] font-medium text-body">{ex.name}</p>
                                                    {ex.sub ? (
                                                        <p className="truncate text-[10px] text-faint">{ex.sub}</p>
                                                    ) : null}
                                                </div>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

type ColGroupExt = { stage: "I_Do" | "We_Do" | "You_Do"; subcat: string; exercises: CatalogueEx[]; idoFiles: IDoFile[] };

function ReportTable({
    colGroups,
    rows,
    page,
    pageCount,
    onPage,
    pageFrom,
    pageTo,
    totalRows,
    onViewDetails,
}: {
    colGroups: ColGroupExt[];
    rows: {
        pid: string;
        name: string;
        email: string;
        cells: Map<string, { pct: number | null; scored: number; total: number }>;
        groupAvg: Map<string, number | null>;
        overallPct: number | null;
        overallScored: number;
        overallTotal: number;
        progressPct: number;
        attemptedCount: number;
    }[];
    page: number;
    pageCount: number;
    onPage: (p: number) => void;
    pageFrom: number;
    pageTo: number;
    totalRows: number;
    onViewDetails: (pid: string) => void;
}) {
    return (
        <div className="overflow-hidden rounded-control border border-hairline bg-surface">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11.5px]">
                    <thead>
                        {/* Group-title row: student cell rowspans, each group spans (exercises + 1 avg), overall spans 2. */}
                        <tr className="bg-surface-sunken/60">
                            <th rowSpan={2} className="sticky left-0 z-10 min-w-[240px] border-b border-r border-hairline bg-surface-sunken/60 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                Student
                            </th>
                            {colGroups.map((g) => {
                                const itemCount = g.stage === "I_Do" ? g.idoFiles.length : g.exercises.length;
                                const stageLabel = g.stage === "I_Do" ? "I Do" : g.stage === "We_Do" ? "We Do" : "You Do";
                                return (
                                    <th
                                        key={`${g.stage}:${g.subcat}`}
                                        colSpan={itemCount + 1}
                                        className="border-b border-r border-hairline px-3 py-2 text-center text-[10.5px] font-semibold text-heading"
                                    >
                                        <span className="mr-1 text-faint">{stageLabel} &gt;</span>
                                        {prettySubcat(g.subcat)}
                                    </th>
                                );
                            })}
                            <th colSpan={3} className="border-b border-hairline px-3 py-2 text-center text-[10.5px] font-semibold text-heading">
                                Overall
                            </th>
                        </tr>
                        <tr className="bg-surface-sunken/40">
                            {colGroups.map((g) => {
                                const items = g.stage === "I_Do"
                                    ? g.idoFiles.map((f) => ({ id: f.id, name: f.name }))
                                    : g.exercises.map((ex) => ({ id: ex.id, name: ex.name }));
                                return (
                                    <React.Fragment key={`h-${g.stage}:${g.subcat}`}>
                                        {items.map((it) => (
                                            <th
                                                key={it.id}
                                                // min-width keeps a long name from squeezing to two
                                                // stacked characters and forces the container to
                                                // scroll horizontally instead.
                                                className="border-b border-hairline px-3 py-2 text-center text-[11px] font-semibold text-heading"
                                                style={{ minWidth: 128 }}
                                                title={it.name}
                                            >
                                                {it.name}
                                            </th>
                                        ))}
                                        <th
                                            className="border-b border-r border-hairline px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-strong"
                                            style={{ minWidth: 108 }}
                                        >
                                            {/* I Do is completion-tracked, not marks-tracked
                                                — the group column label follows suit. */}
                                            {g.stage === "I_Do" ? "Completion" : "Average"}
                                        </th>
                                    </React.Fragment>
                                );
                            })}
                            {/* Overall — three independent columns. Each carries an
                                explicit min-width so `overflow-x-auto` on the wrapper
                                gives them enough room instead of squeezing the group
                                header into an overlap. Details is no longer sticky
                                (it overlaid Progress on scroll); horizontal scroll
                                reaches it naturally. */}
                            <th className="border-b border-hairline px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle" style={{ minWidth: 130 }}>
                                Score (Total)
                            </th>
                            <th className="border-b border-hairline px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle" style={{ minWidth: 150 }}>
                                Progress
                            </th>
                            <th className="border-b border-l border-hairline px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle whitespace-nowrap">
                                Details
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.pid} className="group border-b border-hairline last:border-b-0 hover:bg-row-hover">
                                <td className="sticky left-0 z-10 min-w-[240px] border-r border-hairline bg-surface px-3 py-2 group-hover:bg-row-hover">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar name={r.name} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[12px] font-semibold text-heading">{r.name}</p>
                                            <p className="truncate text-[10.5px] text-subtle">{r.email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Row actions"
                                            className="invisible flex size-6 items-center justify-center rounded-chip text-subtle transition-colors hover:bg-ink-100 hover:text-heading group-hover:visible"
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>
                                    </div>
                                </td>
                                {colGroups.map((g) => {
                                    const ids = g.stage === "I_Do" ? g.idoFiles.map((f) => f.id) : g.exercises.map((e) => e.id);
                                    return (
                                        <React.Fragment key={`c-${r.pid}-${g.stage}:${g.subcat}`}>
                                            {ids.map((id) => {
                                                const c = r.cells.get(id);
                                                return (
                                                    <td
                                                        key={id}
                                                        className="border-b border-hairline px-3 py-2 align-middle"
                                                        style={{ minWidth: 128 }}
                                                    >
                                                        <div className="flex items-center justify-center">
                                                            <ScoreBubble
                                                                pct={c?.pct ?? null}
                                                                secondary={c && c.total > 0 ? `${c.scored}/${c.total}` : undefined}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b border-r border-hairline px-2 py-2 text-center align-middle">
                                                <AvgBadge pct={r.groupAvg.get(`${g.stage}:${g.subcat}`) ?? null} />
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                <td className="border-b border-hairline px-3 py-2 text-center align-middle">
                                    <div className="tabular-nums">
                                        <p className="text-[13px] font-semibold text-heading">
                                            {r.overallPct === null ? "—" : `${r.overallPct}%`}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-subtle">
                                            {r.overallTotal > 0 ? `${r.overallScored} / ${r.overallTotal}` : ""}
                                        </p>
                                    </div>
                                </td>
                                <td className="border-b border-hairline px-3 py-2 align-middle" style={{ minWidth: 140 }}>
                                    {/* Completion, not score — different signal. */}
                                    <ProgressBar pct={r.progressPct} secondary={`${r.attemptedCount} / ${r.cells.size}`} />
                                </td>
                                <td className="border-b border-l border-hairline px-2 py-2 text-center align-middle">
                                    <button
                                        type="button"
                                        onClick={() => onViewDetails(r.pid)}
                                        aria-label={`View details for ${r.name}`}
                                        className="inline-flex items-center rounded-chip px-2 py-1 text-[11px] font-semibold text-brand-strong transition-colors hover:bg-brand-50"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-sunken/40 px-4 py-2.5">
                <p className="text-[11px] text-subtle">
                    Showing {pageFrom} to {pageTo} of {totalRows} students
                </p>
                <Paginator page={page} pageCount={pageCount} onPage={onPage} />
            </div>
        </div>
    );
}

function Avatar({ name }: { name: string }) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "?";
    return (
        <span
            className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #fb923c, #ea580c)" }}
            aria-hidden
        >
            {initials}
        </span>
    );
}

function ScoreBubble({ pct, secondary }: { pct: number | null; secondary?: string }) {
    if (pct === null) {
        return <span className="text-[11px] font-medium text-faint">—</span>;
    }
    const tone = scoreTone(pct);
    // Circular indicator: outer ring uses conic-gradient to show the fill,
    // inner disc carries the label. No SVG — one div, cheap to render across
    // hundreds of cells.
    return (
        <div className="flex flex-col items-center">
            <div
                className="relative flex size-8 items-center justify-center rounded-full"
                style={{
                    background: `conic-gradient(${tone.ring} ${pct}%, var(--color-hairline) ${pct}% 100%)`,
                }}
            >
                <div
                    className="flex size-6 items-center justify-center rounded-full text-[9.5px] font-bold tabular-nums"
                    style={{ background: tone.fill, color: tone.text }}
                >
                    {pct}%
                </div>
            </div>
            {secondary ? <span className="mt-0.5 text-[9.5px] tabular-nums text-faint">{secondary}</span> : null}
        </div>
    );
}

function AvgBadge({ pct }: { pct: number | null }) {
    if (pct === null) return <span className="text-[11px] font-medium text-faint">—</span>;
    const tone = scoreTone(pct);
    return (
        <span
            className="inline-flex min-w-[42px] items-center justify-center rounded-chip px-2 py-0.5 text-[12px] font-bold tabular-nums"
            style={{ background: tone.fill, color: tone.text }}
        >
            {pct}%
        </span>
    );
}

function ProgressBar({ pct, secondary }: { pct: number | null; secondary?: string }) {
    const shown = pct === null ? 0 : Math.max(0, Math.min(100, pct));
    const tone = scoreTone(pct);
    return (
        <div>
            <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${shown}%`, background: pct === null ? "var(--color-hairline)" : tone.ring }}
                    />
                </div>
                <span className="min-w-[34px] text-right text-[11px] font-semibold tabular-nums" style={{ color: pct === null ? "var(--color-faint)" : tone.text }}>
                    {pct === null ? "—" : `${pct}%`}
                </span>
            </div>
            {secondary ? (
                <p className="mt-0.5 text-right text-[10px] tabular-nums text-faint">{secondary}</p>
            ) : null}
        </div>
    );
}

/** Compact "Label · 74%" pair for the Report Summary header. Tone drives
 *  only the value colour so the labels stay uniformly muted. */
function SummaryStat({
    label,
    value,
    tone,
}: {
    label: string;
    value: number | null;
    tone: "ink" | "good" | "bad" | "brand";
}) {
    const color =
        tone === "good"
            ? "var(--color-success-700)"
            : tone === "bad"
                ? "var(--color-danger-700)"
                : tone === "brand"
                    ? "var(--color-brand-strong)"
                    : "var(--color-heading)";
    return (
        <div className="flex flex-col leading-tight">
            <span className="text-[10.5px] font-medium tracking-tight text-subtle">{label}</span>
            <span className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color }}>
                {value === null ? "—" : `${value}%`}
            </span>
        </div>
    );
}

function Paginator({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
    // Ellipsis-aware page list. Always show first + last, and the neighbours
    // of the current page. Keeps the control narrow even for 50+ pages.
    const items: (number | "…")[] = [];
    const push = (n: number | "…") => { if (items[items.length - 1] !== n) items.push(n); };
    push(1);
    for (let i = page - 1; i <= page + 1; i++) {
        if (i > 1 && i < pageCount) push(i);
    }
    if (pageCount > 1) push(pageCount);
    // Insert ellipses where gaps appear.
    const withGaps: (number | "…")[] = [];
    for (let i = 0; i < items.length; i++) {
        const cur = items[i];
        const prev = items[i - 1];
        if (typeof cur === "number" && typeof prev === "number" && cur - prev > 1) withGaps.push("…");
        withGaps.push(cur);
    }

    return (
        <nav className="flex items-center gap-1" aria-label="Pagination">
            <PagerBtn disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous">
                <ChevronLeft size={13} />
            </PagerBtn>
            {withGaps.map((it, i) =>
                it === "…" ? (
                    <span key={`e-${i}`} className="px-1.5 text-[11px] text-faint">…</span>
                ) : (
                    <button
                        key={it}
                        type="button"
                        onClick={() => onPage(it)}
                        className={`inline-flex size-7 items-center justify-center rounded-chip text-[11.5px] font-semibold transition-colors ${
                            it === page
                                ? "bg-brand-500 text-white"
                                : "text-body hover:bg-row-hover"
                        }`}
                    >
                        {it}
                    </button>
                ),
            )}
            <PagerBtn disabled={page >= pageCount} onClick={() => onPage(page + 1)} label="Next">
                <ChevronRight size={13} />
            </PagerBtn>
        </nav>
    );
}

function PagerBtn({ disabled, onClick, children, label }: { disabled: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="inline-flex size-7 items-center justify-center rounded-chip text-subtle transition-colors hover:bg-row-hover hover:text-heading disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}

/**
 * One collapsible section wrapping the whole selection area (Client / Course /
 * stages / sub-categories / exercises / students).
 *
 * When collapsed the header carries a very compact scope summary line so the
 * head can see what the current report is scoped to without expanding. Collapse
 * / expand only affects presentation — the container preserves every pick.
 */
/**
 * Report Setup — a header row + expanded content + one divider. NO outer
 * card, NO border, NO shadow, NO `overflow: hidden`. The old card wrapper
 * clipped every dropdown its children opened; dropping it lets the header
 * sit directly on the page's own white background.
 *
 * Vertical padding is minimal by design — the button sits flush with the
 * page header above (no empty row between them).
 */
function ReportSetupSection({
    collapsed,
    onToggle,
    children,
}: {
    collapsed: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-4">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                className="group flex w-full items-center gap-2 pb-2 pt-0 text-left"
            >
                <span className="text-[13.5px] font-semibold text-heading">Report Setup</span>
                <span
                    className="text-subtle transition-transform group-hover:text-heading"
                    style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
                    aria-hidden
                >
                    <ChevronDown size={14} />
                </span>
            </button>
            <div className="border-b border-hairline" aria-hidden />
            {collapsed ? null : (
                <div className="pt-4">
                    {children}
                </div>
            )}
        </section>
    );
}

