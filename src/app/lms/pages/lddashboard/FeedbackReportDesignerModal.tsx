"use client";

/**
 * Feedback Report Designer — Canva-style overlay for #fb-summary, matched to
 * PerformanceReportDesignerModal in shape (drawer left · live preview right ·
 * top-right Excel / PDF download menu).
 *
 * Multi-form aggregation: pool every response from every selected form and
 * derive one set of pooled charts (parameter bars, rating distribution pie,
 * trainer averages). The parent page already builds the per-form summary
 * rows; the modal takes those rows plus the raw feedback docs and does the
 * pooled math against the raw docs.
 *
 * The per-form export modal (FeedbackReportExportModal on the coursestructure
 * side) stays intact — it's still what the Open button on each row invokes.
 * This designer is the CROSS-form dynamic tool that #fb-summary lacked.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    FeedbackCategoryCharts,
    shortLabelsFor,
    type CategoryGroup,
    type QuestionBar,
} from "@/features/feedback/components/FeedbackCategoryCharts";
import {
    BarChart3,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    MessageSquare,
    PieChart as PieIcon,
    Search,
    Settings2,
    SlidersHorizontal,
    Star,
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

// ─── Public props ────────────────────────────────────────────────────────
// The parent (FeedbackReport in lddashboard/page.tsx) already builds one row
// per feedback form scoped to the current client/course, so we take those
// rows verbatim + the raw feedback docs (needed for response pooling).
export type FbFormRow = {
    id: string;
    title: string;
    courseId: string;
    course: string;
    client: string;
    batch: string;
    trainer: string;
    trainerId: string;
    responses: number;
    denom: number | null;
    rate: number | null;
    avg: number | null;
    window: string;
    startT: number;
    active: boolean;
    raw: any;
};

type Props = {
    open: boolean;
    onClose: () => void;
    forms: FbFormRow[];
    scopeLabel: string;
    /** Fired when the head clicks Open on a form row inside the preview
     *  table — parent uses this to launch its existing per-form export modal. */
    onOpenForm: (raw: any) => void;
};

// ─── Constants shared with the L&D report designer aesthetic ────────────
const RATING_BANDS = [
    { key: "excellent", label: "Excellent (≥ 4)", from: 4, to: 5.01, color: "#10b981" },
    { key: "good", label: "Good (3 – 4)", from: 3, to: 4, color: "#3b82f6" },
    { key: "average", label: "Average (2 – 3)", from: 2, to: 3, color: "#f59e0b" },
    { key: "poor", label: "Poor (< 2)", from: 0.01, to: 2, color: "#ef4444" },
    { key: "unrated", label: "No rating", from: 0, to: 0.01, color: "#98A2B3" },
] as const;
type BandKey = typeof RATING_BANDS[number]["key"];
const bandOf = (avg: number | null): BandKey => {
    if (avg == null || !Number.isFinite(avg) || avg <= 0) return "unrated";
    if (avg >= 4) return "excellent";
    if (avg >= 3) return "good";
    if (avg >= 2) return "average";
    return "poor";
};
const bandLabel = (k: BandKey) => RATING_BANDS.find((b) => b.key === k)?.label || "—";
const bandColor = (k: BandKey) => RATING_BANDS.find((b) => b.key === k)?.color || "#94A3B8";

// Category palette (mirrors PARAM_COLORS in the per-form report so the two
// surfaces stay visually consistent).
const PARAM_COLORS = [
    "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899",
    "#8b5cf6", "#14b8a6", "#f43f5e", "#22c55e", "#eab308",
];

// Distribution palette (green → red across ratingScale).
const DIST_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#fb923c", "#ef4444"];

type ViewKey =
    | "stats"
    | "distPie"
    | "paramBars"
    | "trainerBars"
    | "formsTable"
    | "responses"
    | "comments";
const VIEWS: { key: ViewKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "stats", label: "Summary stats", icon: SlidersHorizontal },
    { key: "distPie", label: "Rating distribution", icon: PieIcon },
    { key: "paramBars", label: "Parameter averages", icon: BarChart3 },
    { key: "trainerBars", label: "Trainer averages", icon: BarChart3 },
    { key: "formsTable", label: "Forms table", icon: TableIcon },
    { key: "responses", label: "Response detail", icon: TableIcon },
    { key: "comments", label: "Comments & suggestions", icon: MessageSquare },
];
const DEFAULT_VIEWS: ViewKey[] = ["stats", "distPie", "paramBars", "trainerBars", "formsTable"];

type FormsColKey =
    | "course"
    | "client"
    | "batch"
    | "trainer"
    | "responses"
    | "rate"
    | "avg"
    | "band"
    | "window"
    | "status";
const FORMS_COLS: { key: FormsColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "course", label: "Course", hint: "Course the form belongs to" },
    { key: "client", label: "Client", hint: "Institution" },
    { key: "batch", label: "Batch", hint: "Batch label" },
    { key: "trainer", label: "Trainer", hint: "Trainer / instructor" },
    { key: "responses", label: "Responses", hint: "Answered / Enrolled", r: true },
    { key: "rate", label: "Rate", hint: "Response rate %", r: true },
    { key: "avg", label: "Avg rating", hint: "Overall rating on 5-scale", r: true },
    { key: "band", label: "Band", hint: "Grade band on the average" },
    { key: "window", label: "Window", hint: "Active window (start → end)" },
    { key: "status", label: "Status", hint: "Open / Closed" },
];
const DEFAULT_FORMS_COLS: FormsColKey[] = ["course", "trainer", "responses", "rate", "avg", "band", "status"];

type RespColKey =
    | "form"
    | "course"
    | "trainer"
    | "batch"
    | "student"
    | "email"
    | "submittedAt"
    | "overall"
    | "band"
    | "reason";
const RESP_COLS: { key: RespColKey; label: string; hint: string; r?: boolean }[] = [
    { key: "form", label: "Form", hint: "Feedback form title" },
    { key: "course", label: "Course", hint: "Course the response belongs to" },
    { key: "trainer", label: "Trainer", hint: "Trainer the form was for" },
    { key: "batch", label: "Batch", hint: "Batch label" },
    { key: "student", label: "Student", hint: "Student name (or Anonymous)" },
    { key: "email", label: "Email", hint: "Student email (blank when anonymous)" },
    { key: "submittedAt", label: "Submitted", hint: "Timestamp of submission" },
    { key: "overall", label: "Overall", hint: "Overall rating on the form's scale", r: true },
    { key: "band", label: "Band", hint: "Rating band" },
    { key: "reason", label: "Comment", hint: "Overall reason text (if any)" },
];
const DEFAULT_RESP_COLS: RespColKey[] = ["form", "course", "trainer", "student", "submittedAt", "overall", "band"];

// ─── Response pooling ────────────────────────────────────────────────────
// One flat row per (form, response). Each row carries enough context that
// the response table + comments + trainer bars can be built without
// re-walking the raw docs.
type PooledResponse = {
    formId: string;
    form: string;
    course: string;
    courseId: string;
    trainer: string;
    trainerId: string;
    batch: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    isAnonymous: boolean;
    submittedAt: string;
    submittedT: number;
    overallRating: number | null;   // normalised to 0-5 (uses form's own ratingScale)
    overallRaw: number | null;      // raw value on form's own scale
    ratingScale: number;
    band: BandKey;
    reason: string;
    /** Category → average of the rating answers in this response. Used for
     *  parameter roll-ups without re-walking. */
    perCategory: Map<string, { sum: number; count: number }>;
    /** Every text answer (question + text). Fed into the comments panel. */
    texts: { question: string; text: string }[];
};

const stripHtml = (s: string): string => {
    if (!s) return "";
    if (typeof window === "undefined") return s.replace(/<[^>]*>/g, "").trim();
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    return (tmp.textContent || tmp.innerText || "").trim();
};

function poolResponses(forms: FbFormRow[]): PooledResponse[] {
    const out: PooledResponse[] = [];
    for (const f of forms) {
        const raw = f.raw || {};
        const questions: any[] = Array.isArray(raw.questions) ? raw.questions : [];
        const responses: any[] = Array.isArray(raw.studentResponses) ? raw.studentResponses : [];
        const maxes = questions
            .map((q: any) => q.ratingConfig?.maxRating)
            .filter((n: any): n is number => typeof n === "number" && n > 0);
        const ratingScale = maxes.length ? Math.max(...maxes) : 5;
        // Question → category lookup for parameter aggregation.
        const catByQ = new Map<string, string>();
        for (const q of questions) {
            const cat = (q?.category || "").toString().trim() || "Other";
            if (q?.questionText) catByQ.set(q.questionText, cat);
        }

        for (const r of responses) {
            const vals: number[] = [];
            const perCategory = new Map<string, { sum: number; count: number }>();
            const texts: { question: string; text: string }[] = [];

            (r?.answers || []).forEach((a: any) => {
                if (a?.questionType === "rating") {
                    const v = Number(a?.answer);
                    if (Number.isFinite(v) && v > 0) {
                        vals.push(v);
                        const cat = catByQ.get(a?.questionText) || "Other";
                        const prev = perCategory.get(cat) || { sum: 0, count: 0 };
                        prev.sum += v;
                        prev.count += 1;
                        perCategory.set(cat, prev);
                    }
                } else if (a?.questionType === "text") {
                    const t = stripHtml(String(a?.answer || ""));
                    if (t) texts.push({ question: a?.questionText || "—", text: t });
                }
            });
            const overallReason = stripHtml(String(r?.overallReason || ""));
            if (overallReason) texts.push({ question: "Overall reason", text: overallReason });

            const overallRaw = typeof r?.overallRating === "number"
                ? r.overallRating
                : (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);
            const overallRating = overallRaw === null
                ? null
                : (ratingScale !== 5 ? (overallRaw / ratingScale) * 5 : overallRaw);
            const submittedAt = String(r?.submittedAt || "");
            out.push({
                formId: f.id,
                form: f.title,
                course: f.course,
                courseId: f.courseId,
                trainer: f.trainer,
                trainerId: f.trainerId,
                batch: f.batch,
                studentId: String(r?.studentId || ""),
                studentName: r?.isAnonymous ? "Anonymous" : (r?.studentName || "—"),
                studentEmail: r?.isAnonymous ? "" : (r?.studentEmail || ""),
                isAnonymous: !!r?.isAnonymous,
                submittedAt,
                submittedT: submittedAt ? Date.parse(submittedAt) || 0 : 0,
                overallRating: overallRating === null ? null : Math.round(overallRating * 10) / 10,
                overallRaw: overallRaw === null ? null : Math.round(overallRaw * 10) / 10,
                ratingScale,
                band: bandOf(overallRating),
                reason: overallReason,
                perCategory,
                texts,
            });
        }
    }
    return out;
}

// ─── MultiPickBox — mirrors the perf designer's version so both feel identical ─
function MultiPickBox({
    label,
    options,
    sel,
    onChange,
    empty,
}: {
    label: string;
    options: { id: string; name: string; sub?: string }[];
    sel: Set<string> | null;
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

const STATUS_OPTS = [
    { id: "open", name: "Open" },
    { id: "closed", name: "Closed" },
];
const RESULT_OPTS = [
    { id: "positive", name: "Positive (≥ 70% of scale)" },
    { id: "negative", name: "Negative (< 70% of scale)" },
];

// ─── Main modal ──────────────────────────────────────────────────────────
export default function FeedbackReportDesignerModal({
    open,
    onClose,
    forms,
    scopeLabel,
    onOpenForm,
}: Props) {
    const [drawerCollapsed, setDrawerCollapsed] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
    const [views, setViews] = useState<Set<ViewKey>>(new Set(DEFAULT_VIEWS));
    const [formsCols, setFormsCols] = useState<Set<FormsColKey>>(new Set(DEFAULT_FORMS_COLS));
    const [respCols, setRespCols] = useState<Set<RespColKey>>(new Set(DEFAULT_RESP_COLS));
    const [formSel, setFormSel] = useState<Set<string> | null>(null);
    const [trainerSel, setTrainerSel] = useState<Set<string> | null>(null);
    const [batchSel, setBatchSel] = useState<Set<string> | null>(null);
    const [statusSel, setStatusSel] = useState<Set<string> | null>(null);
    const [bandSel, setBandSel] = useState<Set<BandKey> | null>(null);
    const [resultSel, setResultSel] = useState<Set<string> | null>(null);
    const [anonSel, setAnonSel] = useState<Set<string> | null>(null);
    const [removed, setRemoved] = useState<Set<ViewKey>>(new Set());
    const downloadRef = useRef<HTMLDivElement>(null);

    // Download menu closes on outside click.
    useEffect(() => {
        if (!downloadOpen) return;
        const h = (e: MouseEvent) => {
            if (!downloadRef.current?.contains(e.target as Node)) setDownloadOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [downloadOpen]);

    // ESC closes the modal.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Re-scope on parent scope changes.
    useEffect(() => {
        setFormSel(null);
        setTrainerSel(null);
        setBatchSel(null);
    }, [forms]);

    // Restore any drawer-re-enabled view that had been removed via ×.
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

    // ── Options ──
    const formOpts = useMemo(
        () => forms.map((f) => ({
            id: f.id,
            name: f.title,
            sub: `${f.course}${f.trainer ? ` · ${f.trainer}` : ""}`,
        })),
        [forms],
    );
    const trainerOpts = useMemo(() => {
        const seen = new Set<string>();
        const out: { id: string; name: string; sub?: string }[] = [];
        for (const f of forms) {
            if (!f.trainer || seen.has(f.trainer)) continue;
            seen.add(f.trainer);
            out.push({ id: f.trainer, name: f.trainer });
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }, [forms]);
    const batchOpts = useMemo(() => {
        const seen = new Set<string>();
        const out: { id: string; name: string; sub?: string }[] = [];
        for (const f of forms) {
            if (!f.batch || f.batch === "—" || seen.has(f.batch)) continue;
            seen.add(f.batch);
            out.push({ id: f.batch, name: f.batch });
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }, [forms]);
    const bandOpts = useMemo(() => RATING_BANDS.map((b) => ({ id: b.key, name: b.label })), []);
    const anonOpts = useMemo(
        () => [
            { id: "identified", name: "Identified" },
            { id: "anonymous", name: "Anonymous" },
        ],
        [],
    );

    // ── Forms after picker filters ──
    const workingForms = useMemo(() => {
        return forms.filter((f) => {
            if (formSel !== null && !formSel.has(f.id)) return false;
            if (trainerSel !== null && !trainerSel.has(f.trainer)) return false;
            if (batchSel !== null && !batchSel.has(f.batch)) return false;
            if (statusSel !== null && !statusSel.has(f.active ? "open" : "closed")) return false;
            if (bandSel !== null && !bandSel.has(bandOf(f.avg))) return false;
            return true;
        });
    }, [forms, formSel, trainerSel, batchSel, statusSel, bandSel]);

    // Pool responses across the surviving forms.
    const pooledAll = useMemo(() => poolResponses(workingForms), [workingForms]);

    // Response-level filters (result: positive / negative on 5-scale;
    // anon: identified / anonymous). Applied AFTER pooling so the summary
    // stats reflect exactly what the response table + comments show.
    const workingResponses = useMemo(() => {
        return pooledAll.filter((r) => {
            if (resultSel !== null) {
                const pos = r.overallRating !== null && r.overallRating >= 3.5;
                const key = pos ? "positive" : "negative";
                if (!resultSel.has(key)) return false;
            }
            if (anonSel !== null) {
                const key = r.isAnonymous ? "anonymous" : "identified";
                if (!anonSel.has(key)) return false;
            }
            return true;
        });
    }, [pooledAll, resultSel, anonSel]);

    // ── Aggregate derivations ──
    const stats = useMemo(() => {
        const totalResponses = workingResponses.length;
        const totalForms = workingForms.length;
        const distinctStudents = new Set(
            workingResponses.filter((r) => !r.isAnonymous && r.studentId).map((r) => r.studentId),
        ).size;
        const rated = workingResponses.filter((r) => r.overallRating !== null).map((r) => r.overallRating!);
        const avgRating = rated.length
            ? Math.round((rated.reduce((s, v) => s + v, 0) / rated.length) * 10) / 10
            : null;
        const positive = rated.filter((v) => v >= 3.5).length;
        const positivePct = rated.length ? Math.round((positive / rated.length) * 100) : 0;
        const suggestions = workingResponses.reduce((n, r) => n + r.texts.length, 0);
        return { totalForms, totalResponses, avgRating, positivePct, distinctStudents, suggestions };
    }, [workingResponses, workingForms]);

    const distribution = useMemo(() => {
        // 1-5 buckets on the normalised 5-scale (nearest integer).
        const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const r of workingResponses) {
            if (r.overallRating === null) continue;
            const b = Math.max(1, Math.min(5, Math.round(r.overallRating)));
            buckets[b] = (buckets[b] || 0) + 1;
        }
        return [5, 4, 3, 2, 1].map((star, i) => ({
            star,
            name: `${star} ★`,
            value: buckets[star] || 0,
            color: DIST_COLORS[i] || "#94A3B8",
        }));
    }, [workingResponses]);

    const parameterAverages = useMemo(() => {
        const acc = new Map<string, { sum: number; count: number }>();
        for (const r of workingResponses) {
            for (const [cat, agg] of r.perCategory) {
                const key = cat || "Other";
                const prev = acc.get(key) || { sum: 0, count: 0 };
                // Each response contributes ITS OWN category average, weighted
                // by the number of rating answers behind that average — that
                // keeps a form with 30 questions in a category from being
                // 30× a form with 1 question.
                const respAvg = agg.count ? agg.sum / agg.count : 0;
                if (respAvg > 0) {
                    prev.sum += respAvg * agg.count;
                    prev.count += agg.count;
                }
                acc.set(key, prev);
            }
        }
        return [...acc.entries()]
            .map(([category, v], i) => ({
                category,
                avg: v.count ? Math.round((v.sum / v.count) * 100) / 100 : 0,
                n: v.count,
                color: PARAM_COLORS[i % PARAM_COLORS.length],
            }))
            .filter((r) => r.avg > 0)
            .sort((a, b) => b.avg - a.avg);
    }, [workingResponses]);

    // Per-category per-question rollup for the new small-multiples chart.
    // Walks raw form payloads (not the pooled per-response perCategory maps,
    // which have already collapsed the questionText dimension) and honours the
    // modal's filters by keeping only responses that survived into
    // workingResponses. Groups are keyed by (category, questionText, scale) so
    // 4-scale and 5-scale questions with identical wording stay separate — the
    // trap the audit flagged.
    const perCategoryQuestions = useMemo<CategoryGroup[]>(() => {
        const keep = new Set<string>();
        for (const r of workingResponses) {
            keep.add(`${r.formId}::${r.studentId}::${r.submittedAt}`);
        }
        const cats = new Map<
            string,
            Map<string, { question: string; sum: number; count: number; scale: number }>
        >();

        for (const f of workingForms) {
            const raw: any = f.raw || {};
            const questions: any[] = Array.isArray(raw.questions) ? raw.questions : [];
            const catByQ = new Map<string, string>();
            const scaleByQ = new Map<string, number>();
            for (const q of questions) {
                if (q?.questionType !== "rating" || !q?.questionText) continue;
                const cat = (q.category || "").toString().trim() || "Other";
                const scale =
                    Number(q?.ratingConfig?.maxRating) > 0
                        ? Number(q.ratingConfig.maxRating)
                        : 5;
                catByQ.set(q.questionText, cat);
                scaleByQ.set(q.questionText, scale);
            }
            for (const r of raw.studentResponses || []) {
                const key = `${f.id}::${r?.studentId || ""}::${r?.submittedAt || ""}`;
                if (!keep.has(key)) continue;
                for (const a of r?.answers || []) {
                    if (a?.questionType !== "rating") continue;
                    const v = Number(a?.answer);
                    if (!Number.isFinite(v) || v <= 0) continue;
                    const cat = catByQ.get(a.questionText);
                    const scale = scaleByQ.get(a.questionText);
                    if (!cat || !scale) continue;
                    const perQ =
                        cats.get(cat) ??
                        new Map<
                            string,
                            { question: string; sum: number; count: number; scale: number }
                        >();
                    // Composite key keeps same-text-different-scale rows apart.
                    const qKey = `${a.questionText}|${scale}`;
                    const cell =
                        perQ.get(qKey) ??
                        { question: a.questionText, sum: 0, count: 0, scale };
                    cell.sum += v;
                    cell.count += 1;
                    perQ.set(qKey, cell);
                    cats.set(cat, perQ);
                }
            }
        }

        const out: CategoryGroup[] = [];
        for (const [category, perQ] of cats) {
            const rows: QuestionBar[] = [];
            for (const { question, sum, count, scale } of perQ.values()) {
                if (count === 0) continue;
                rows.push({
                    question,
                    short: "", // assigned below via shortLabelsFor
                    avg: Math.round((sum / count) * 100) / 100,
                    n: count,
                    scale,
                });
            }
            if (rows.length === 0) continue;
            const shorts = shortLabelsFor(rows.map((r) => r.question));
            rows.forEach((r, i) => (r.short = shorts[i]));
            const scale = Math.max(...rows.map((r) => r.scale));
            const scaleMixed = new Set(rows.map((r) => r.scale)).size > 1;
            const totalN = rows.reduce((s, r) => s + r.n, 0);
            const weightedAvg = totalN
                ? Math.round(
                      (rows.reduce((s, r) => s + r.avg * r.n, 0) / totalN) * 100
                  ) / 100
                : 0;
            out.push({ category, scale, scaleMixed, weightedAvg, totalN, questions: rows });
        }
        // "Other" (catch-all) sorts last so real categories lead the grid.
        return out.sort((a, b) => {
            if (a.category === "Other" && b.category !== "Other") return 1;
            if (b.category === "Other" && a.category !== "Other") return -1;
            return a.category.localeCompare(b.category);
        });
    }, [workingForms, workingResponses]);

    const trainerAverages = useMemo(() => {
        const acc = new Map<string, { sum: number; count: number }>();
        for (const r of workingResponses) {
            if (r.overallRating === null) continue;
            const key = r.trainer || "Course-level";
            const prev = acc.get(key) || { sum: 0, count: 0 };
            prev.sum += r.overallRating;
            prev.count += 1;
            acc.set(key, prev);
        }
        return [...acc.entries()]
            .map(([trainer, v]) => ({
                trainer,
                avg: v.count ? Math.round((v.sum / v.count) * 100) / 100 : 0,
                responses: v.count,
            }))
            .sort((a, b) => b.avg - a.avg);
    }, [workingResponses]);

    const commentRows = useMemo(() => {
        // Flatten every text comment across the surviving responses.
        const out: {
            key: string;
            form: string;
            course: string;
            trainer: string;
            student: string;
            date: string;
            question: string;
            text: string;
        }[] = [];
        workingResponses.forEach((r, i) => {
            r.texts.forEach((t, j) => {
                out.push({
                    key: `${r.formId}:${i}:${j}`,
                    form: r.form,
                    course: r.course,
                    trainer: r.trainer,
                    student: r.isAnonymous ? "Anonymous" : r.studentName,
                    date: r.submittedAt,
                    question: t.question,
                    text: t.text,
                });
            });
        });
        return out
            .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
            .slice(0, 200); // Cap the preview — Excel export still writes everything.
    }, [workingResponses]);

    // ── Section-render controls ──
    const shouldShow = (k: ViewKey) => views.has(k) && !removed.has(k);
    const removeSection = (k: ViewKey) => setRemoved((r) => new Set(r).add(k));
    const restoreSection = (k: ViewKey) =>
        setRemoved((r) => {
            const n = new Set(r);
            n.delete(k);
            return n;
        });
    const toggleSet = <T,>(current: Set<T>, key: T): Set<T> => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    };
    const reset = () => {
        setViews(new Set(DEFAULT_VIEWS));
        setFormsCols(new Set(DEFAULT_FORMS_COLS));
        setRespCols(new Set(DEFAULT_RESP_COLS));
        setFormSel(null);
        setTrainerSel(null);
        setBatchSel(null);
        setStatusSel(null);
        setBandSel(null);
        setResultSel(null);
        setAnonSel(null);
        setRemoved(new Set());
    };

    // ── Cell renderers for the forms + response tables ──
    const activeFormsCols = FORMS_COLS.filter((c) => formsCols.has(c.key));
    const activeRespCols = RESP_COLS.filter((c) => respCols.has(c.key));

    const renderFormCell = (r: FbFormRow, k: FormsColKey): React.ReactNode => {
        switch (k) {
            case "course": return r.course;
            case "client": return r.client;
            case "batch": return r.batch;
            case "trainer": return r.trainer;
            case "responses": return r.denom ? `${r.responses}/${r.denom}` : String(r.responses);
            case "rate": return r.rate === null ? "—" : `${r.rate}%`;
            case "avg":
                if (r.avg === null) return <span className="text-faint">—</span>;
                {
                    const tone = r.avg >= 4 ? "text-success-500" : r.avg < 3 ? "text-danger-500" : "text-warn-500";
                    return <span className={`font-semibold ${tone}`}>{r.avg}/5</span>;
                }
            case "band": {
                const b = bandOf(r.avg);
                return (
                    <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: `${bandColor(b)}17`, color: bandColor(b) }}
                    >
                        {bandLabel(b)}
                    </span>
                );
            }
            case "window": return r.window;
            case "status": return r.active ? (
                <span className="inline-flex items-center rounded-full bg-success-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-success-500">Open</span>
            ) : (
                <span className="inline-flex items-center rounded-full bg-subtle/15 px-2 py-0.5 text-[10.5px] font-semibold text-subtle">Closed</span>
            );
            default: return "";
        }
    };
    const formCellText = (r: FbFormRow, k: FormsColKey): string => {
        switch (k) {
            case "course": return r.course;
            case "client": return r.client;
            case "batch": return r.batch;
            case "trainer": return r.trainer;
            case "responses": return r.denom ? `${r.responses}/${r.denom}` : String(r.responses);
            case "rate": return r.rate === null ? "" : `${r.rate}%`;
            case "avg": return r.avg === null ? "" : `${r.avg}/5`;
            case "band": return bandLabel(bandOf(r.avg));
            case "window": return r.window;
            case "status": return r.active ? "Open" : "Closed";
            default: return "";
        }
    };

    const renderRespCell = (r: PooledResponse, k: RespColKey): React.ReactNode => {
        switch (k) {
            case "form": return r.form;
            case "course": return r.course;
            case "trainer": return r.trainer;
            case "batch": return r.batch;
            case "student": return r.isAnonymous ? (
                <span className="italic text-subtle">Anonymous</span>
            ) : r.studentName;
            case "email": return r.studentEmail || "—";
            case "submittedAt":
                return r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                      })
                    : "—";
            case "overall":
                if (r.overallRating === null) return <span className="text-faint">—</span>;
                return <span className="font-semibold text-heading">{r.overallRating}/5</span>;
            case "band": {
                const b = r.band;
                return (
                    <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: `${bandColor(b)}17`, color: bandColor(b) }}
                    >
                        {bandLabel(b)}
                    </span>
                );
            }
            case "reason":
                return r.reason ? (
                    <span className="truncate text-body" title={r.reason}>{r.reason}</span>
                ) : (
                    <span className="text-faint">—</span>
                );
            default: return "";
        }
    };
    const respCellText = (r: PooledResponse, k: RespColKey): string => {
        switch (k) {
            case "form": return r.form;
            case "course": return r.course;
            case "trainer": return r.trainer;
            case "batch": return r.batch;
            case "student": return r.isAnonymous ? "Anonymous" : r.studentName;
            case "email": return r.studentEmail;
            case "submittedAt":
                return r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                      })
                    : "";
            case "overall": return r.overallRating === null ? "" : `${r.overallRating}/5`;
            case "band": return bandLabel(r.band);
            case "reason": return r.reason || "";
            default: return "";
        }
    };

    // ── Exports ──
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
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } },
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

            // Summary sheet
            const ws = wb.addWorksheet("Summary");
            ws.columns = [{ width: 34 }, { width: 40 }];
            ws.addRow(["Feedback Report"]).getCell(1).style = { font: { bold: true, size: 13 } };
            ws.addRow(["Scope", scopeLabel || "All clients · all courses"]);
            ws.addRow(["Forms", stats.totalForms]);
            ws.addRow(["Total responses", stats.totalResponses]);
            ws.addRow(["Distinct students", stats.distinctStudents]);
            ws.addRow(["Avg rating", stats.avgRating === null ? "—" : `${stats.avgRating}/5`]);
            ws.addRow(["Positive %", `${stats.positivePct}%`]);
            ws.addRow(["Comments / suggestions", stats.suggestions]);
            ws.addRow(["Generated", new Date().toLocaleString("en-GB")]);

            if (shouldShow("distPie") && distribution.some((d) => d.value > 0)) {
                ws.addRow([]);
                const h = ws.addRow(["Rating band", "Responses"]);
                h.eachCell((c: any) => (c.style = header));
                distribution.forEach((d) => {
                    const row = ws.addRow([d.name, d.value]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }
            if (shouldShow("paramBars") && parameterAverages.length > 0) {
                ws.addRow([]);
                const h = ws.addRow(["Parameter", "Avg", "Responses"]);
                h.eachCell((c: any) => (c.style = header));
                parameterAverages.forEach((p) => {
                    const row = ws.addRow([p.category, `${p.avg}/5`, p.n]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }
            if (shouldShow("trainerBars") && trainerAverages.length > 0) {
                ws.addRow([]);
                const h = ws.addRow(["Trainer", "Avg", "Responses"]);
                h.eachCell((c: any) => (c.style = header));
                trainerAverages.forEach((t) => {
                    const row = ws.addRow([t.trainer, `${t.avg}/5`, t.responses]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
            }

            if (shouldShow("formsTable") && workingForms.length > 0) {
                const fs = wb.addWorksheet("Forms");
                const cols = [{ header: "Form", key: "title", width: 30 }, ...activeFormsCols.map((c) => ({ header: c.label, key: c.key, width: 16 }))];
                fs.columns = cols;
                const hr = fs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                workingForms.forEach((r) => {
                    const row = fs.addRow([r.title, ...activeFormsCols.map((c) => formCellText(r, c.key))]);
                    row.eachCell((c: any) => (c.style = bordered));
                });
                fs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
                fs.views = [{ state: "frozen", ySplit: 1 }];
            }

            if (shouldShow("responses") && workingResponses.length > 0) {
                const rs = wb.addWorksheet("Responses");
                const cols = activeRespCols.map((c) => ({ header: c.label, key: c.key, width: 16 }));
                rs.columns = cols;
                const hr = rs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                workingResponses.forEach((r) => {
                    const row = rs.addRow(activeRespCols.map((c) => respCellText(r, c.key)));
                    row.eachCell((c: any) => (c.style = bordered));
                });
                rs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
                rs.views = [{ state: "frozen", ySplit: 1 }];
            }

            if (shouldShow("comments")) {
                const cs = wb.addWorksheet("Comments");
                cs.columns = [
                    { header: "Date", key: "date", width: 18 },
                    { header: "Student", key: "student", width: 22 },
                    { header: "Form", key: "form", width: 28 },
                    { header: "Trainer", key: "trainer", width: 18 },
                    { header: "Question", key: "question", width: 28 },
                    { header: "Comment", key: "text", width: 60 },
                ];
                const hr = cs.getRow(1);
                hr.height = 22;
                hr.eachCell((c: any) => (c.style = header));
                // Write EVERY comment on export, not just the capped preview.
                const all: typeof commentRows = [];
                workingResponses.forEach((r, i) => {
                    r.texts.forEach((t, j) => {
                        all.push({
                            key: `${r.formId}:${i}:${j}`,
                            form: r.form,
                            course: r.course,
                            trainer: r.trainer,
                            student: r.isAnonymous ? "Anonymous" : r.studentName,
                            date: r.submittedAt,
                            question: t.question,
                            text: t.text,
                        });
                    });
                });
                all.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
                all.forEach((c) => {
                    const row = cs.addRow([c.date, c.student, c.form, c.trainer, c.question, c.text]);
                    row.eachCell((cell: any) => (cell.style = bordered));
                });
            }

            const buf = await wb.xlsx.writeBuffer();
            saveAs(
                new Blob([buf], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
                `feedback-report_${localDay()}.xlsx`,
            );
            setDownloadOpen(false);
        } catch (e) {
            console.error("Feedback report Excel export failed", e);
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
                orientation: shouldShow("responses") || shouldShow("formsTable") ? "landscape" : "portrait",
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

            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(17, 24, 39);
            doc.text("Feedback Report", M, y);
            y += 18;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text(`${scopeLabel || "All clients · all courses"} · ${stats.totalForms} form${stats.totalForms === 1 ? "" : "s"} · ${stats.totalResponses} response${stats.totalResponses === 1 ? "" : "s"}`, M, y);
            y += 12;
            doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, M, y);
            y += 12;
            rule();

            if (shouldShow("stats")) {
                h2("Summary");
                autoTable(doc, {
                    startY: y,
                    head: [["Metric", "Value"]],
                    body: [
                        ["Forms", String(stats.totalForms)],
                        ["Total responses", String(stats.totalResponses)],
                        ["Distinct students", String(stats.distinctStudents)],
                        ["Avg rating", stats.avgRating === null ? "—" : `${stats.avgRating}/5`],
                        ["Positive %", `${stats.positivePct}%`],
                        ["Comments / suggestions", String(stats.suggestions)],
                    ],
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [99, 102, 241] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }
            if (shouldShow("distPie") && distribution.some((d) => d.value > 0)) {
                h2("Rating distribution");
                autoTable(doc, {
                    startY: y,
                    head: [["Rating", "Responses"]],
                    body: distribution.map((d) => [d.name, String(d.value)]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [16, 185, 129] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }
            if (shouldShow("paramBars") && parameterAverages.length > 0) {
                h2("Parameter averages");
                autoTable(doc, {
                    startY: y,
                    head: [["Parameter", "Avg", "Answers"]],
                    body: parameterAverages.map((p) => [p.category, `${p.avg}/5`, String(p.n)]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [124, 92, 252] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }
            if (shouldShow("trainerBars") && trainerAverages.length > 0) {
                h2("Trainer averages");
                autoTable(doc, {
                    startY: y,
                    head: [["Trainer", "Avg", "Responses"]],
                    body: trainerAverages.map((t) => [t.trainer, `${t.avg}/5`, String(t.responses)]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [14, 165, 233] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
                rule();
            }
            if (shouldShow("formsTable") && workingForms.length > 0) {
                doc.addPage();
                y = M;
                h2(`Forms (${workingForms.length})`);
                autoTable(doc, {
                    startY: y,
                    head: [["Form", ...activeFormsCols.map((c) => c.label)]],
                    body: workingForms.map((r) => [r.title, ...activeFormsCols.map((c) => formCellText(r, c.key))]),
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [99, 102, 241] },
                    margin: { left: M, right: M },
                });
                y = (doc as any).lastAutoTable?.finalY + 14 || y + 14;
            }
            if (shouldShow("responses") && workingResponses.length > 0) {
                doc.addPage();
                y = M;
                h2(`Responses (${workingResponses.length})`);
                autoTable(doc, {
                    startY: y,
                    head: [activeRespCols.map((c) => c.label)],
                    body: workingResponses.map((r) => activeRespCols.map((c) => respCellText(r, c.key))),
                    styles: { fontSize: 7.5, cellPadding: 2.5 },
                    headStyles: { fillColor: [124, 92, 252] },
                    margin: { left: M, right: M },
                });
            }

            const pages = (doc as any).internal.pages.length - 1;
            const pageH = doc.internal.pageSize.getHeight();
            for (let p = 1; p <= pages; p++) {
                doc.setPage(p);
                doc.setFontSize(8);
                doc.setTextColor(156, 163, 175);
                doc.text(`Page ${p} / ${pages}`, pageW - M, pageH - 16, { align: "right" });
            }
            doc.save(`feedback-report_${localDay()}.pdf`);
            setDownloadOpen(false);
        } catch (e) {
            console.error("Feedback report PDF export failed", e);
        } finally {
            setBusy("");
        }
    };

    if (!open) return null;

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
        shouldShow("distPie") ||
        shouldShow("paramBars") ||
        shouldShow("trainerBars") ||
        shouldShow("formsTable") ||
        shouldShow("responses") ||
        shouldShow("comments");

    return (
        <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 backdrop-blur-[2px] p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Detailed feedback report designer"
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
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Scope</h3>
                                <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] text-body">
                                    {scopeLabel || "All clients · all courses"}
                                </div>
                                <p className="mt-1 text-[10px] text-faint">
                                    Change client / course from the page filters above.
                                </p>
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Forms</h3>
                                <MultiPickBox label="Forms" options={formOpts} sel={formSel} onChange={setFormSel} empty="No forms in scope" />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Trainers</h3>
                                <MultiPickBox label="Trainers" options={trainerOpts} sel={trainerSel} onChange={setTrainerSel} />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Batches</h3>
                                <MultiPickBox label="Batches" options={batchOpts} sel={batchSel} onChange={setBatchSel} />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Status</h3>
                                <MultiPickBox label="Status" options={STATUS_OPTS} sel={statusSel} onChange={setStatusSel} />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Rating band</h3>
                                <MultiPickBox
                                    label="Bands"
                                    options={bandOpts}
                                    sel={bandSel as Set<string> | null}
                                    onChange={(s) => setBandSel(s as Set<BandKey> | null)}
                                />
                                <p className="mt-1 text-[10px] text-faint">Filters forms by their overall avg rating.</p>
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Response result</h3>
                                <MultiPickBox label="Result" options={RESULT_OPTS} sel={resultSel} onChange={setResultSel} />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Identified / anonymous</h3>
                                <MultiPickBox label="Type" options={anonOpts} sel={anonSel} onChange={setAnonSel} />
                            </section>

                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Views</h3>
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

                            <section
                                aria-disabled={!views.has("formsTable")}
                                className={views.has("formsTable") ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Forms columns</h3>
                                <div className="space-y-1">
                                    {FORMS_COLS.map((c) => {
                                        const on = formsCols.has(c.key);
                                        return (
                                            <label
                                                key={c.key}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover"
                                                title={c.hint}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => setFormsCols(toggleSet(formsCols, c.key))}
                                                    className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[11px] font-medium text-body">{c.label}</span>
                                                    <span className="block truncate text-[10px] text-faint">{c.hint}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>

                            <section
                                aria-disabled={!views.has("responses")}
                                className={views.has("responses") ? "" : "opacity-50 pointer-events-none"}
                            >
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Response columns</h3>
                                <div className="space-y-1">
                                    {RESP_COLS.map((c) => {
                                        const on = respCols.has(c.key);
                                        return (
                                            <label
                                                key={c.key}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover"
                                                title={c.hint}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => setRespCols(toggleSet(respCols, c.key))}
                                                    className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[11px] font-medium text-body">{c.label}</span>
                                                    <span className="block truncate text-[10px] text-faint">{c.hint}</span>
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
                            <h2 className="truncate text-sm font-semibold text-heading">Feedback Report</h2>
                            <p className="mt-0.5 truncate text-[10px] text-subtle tabular-nums">
                                {stats.totalForms} form{stats.totalForms === 1 ? "" : "s"} · {stats.totalResponses} response{stats.totalResponses === 1 ? "" : "s"} · Avg {stats.avgRating === null ? "—" : `${stats.avgRating}/5`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div ref={downloadRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDownloadOpen((v) => !v)}
                                    disabled={!!busy || workingForms.length === 0}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-brand-500 bg-brand-500 text-white text-xs font-semibold hover:bg-brand-strong disabled:opacity-50 transition-colors"
                                >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    Download report
                                    <ChevronDown className={`h-3 w-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} />
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
                        {removed.size > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-hairline bg-surface/60 px-3 py-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Removed</span>
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
                        ) : workingForms.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                No forms match this filter — loosen one of the picker sets.
                            </div>
                        ) : (
                            <>
                                {shouldShow("stats") ? (
                                    <Sec id="stats">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Summary</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                pooled across {stats.totalForms} form{stats.totalForms === 1 ? "" : "s"}
                                            </span>
                                        </header>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
                                            <Stat label="Forms" value={stats.totalForms} />
                                            <Stat label="Responses" value={stats.totalResponses} />
                                            <Stat label="Students" value={stats.distinctStudents} hint="distinct, non-anonymous" />
                                            <Stat
                                                label="Avg rating"
                                                value={stats.avgRating === null ? "—" : `${stats.avgRating}/5`}
                                            />
                                            <Stat
                                                label="Positive %"
                                                value={`${stats.positivePct}%`}
                                                tone={stats.positivePct >= 70 ? "good" : stats.positivePct < 40 ? "bad" : undefined}
                                                hint="≥ 3.5/5"
                                            />
                                            <Stat label="Comments" value={stats.suggestions} />
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("distPie") ? (
                                    <Sec id="distPie">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Rating distribution</h3>
                                            <span className="text-[10px] text-subtle">1–5 stars</span>
                                        </header>
                                        <div className="h-64">
                                            {distribution.every((d) => d.value === 0) ? (
                                                <div className="flex h-full items-center justify-center text-xs text-subtle">
                                                    No rated responses in the selection.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            dataKey="value"
                                                            nameKey="name"
                                                            data={distribution.filter((d) => d.value > 0)}
                                                            innerRadius={55}
                                                            outerRadius={90}
                                                            paddingAngle={2}
                                                        >
                                                            {distribution.filter((d) => d.value > 0).map((s, i) => (
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

                                {shouldShow("paramBars") ? (
                                    <Sec id="paramBars">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Parameter averages</h3>
                                            <span className="text-[10px] text-subtle">
                                                one card per parameter · questions on X · avg on Y
                                            </span>
                                        </header>
                                        <div className="p-3">
                                            <FeedbackCategoryCharts groups={perCategoryQuestions} />
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("trainerBars") ? (
                                    <Sec id="trainerBars">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Trainer averages</h3>
                                            <span className="text-[10px] text-subtle">avg / 5 across pooled responses</span>
                                        </header>
                                        <div className="h-72">
                                            {trainerAverages.length === 0 ? (
                                                <div className="flex h-full items-center justify-center text-xs text-subtle">
                                                    No trainer data in the selection.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={trainerAverages.map((t) => ({ name: t.trainer, avg: t.avg }))}
                                                        margin={{ top: 18, right: 16, left: 0, bottom: 60 }}
                                                        barCategoryGap={2}
                                                        barGap={2}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                                        <XAxis
                                                            dataKey="name"
                                                            tick={{ fontSize: 10 }}
                                                            angle={-20}
                                                            textAnchor="end"
                                                            interval={0}
                                                            height={70}
                                                            tickLine={false}
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 10 }}
                                                            domain={[0, 5]}
                                                            tickFormatter={(v) => `${v}`}
                                                            tickLine={false}
                                                            axisLine={false}
                                                        />
                                                        <RTooltip formatter={((v: number) => `${v}/5`) as any} />
                                                        <Bar
                                                            dataKey="avg"
                                                            radius={[3, 3, 0, 0]}
                                                            barSize={16}
                                                            minPointSize={2}
                                                            isAnimationActive={false}
                                                        >
                                                            {trainerAverages.map((t, i) => (
                                                                <Cell
                                                                    key={i}
                                                                    fill={
                                                                        t.avg >= 4
                                                                            ? "#16a34a"
                                                                            : t.avg >= 3
                                                                                ? "#f59e0b"
                                                                                : "#ef4444"
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

                                {shouldShow("formsTable") ? (
                                    <Sec id="formsTable">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Forms</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {workingForms.length} in scope
                                            </span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">#</th>
                                                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">Form</th>
                                                        {activeFormsCols.map((c) => (
                                                            <th
                                                                key={c.key}
                                                                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline ${c.r ? "text-right" : "text-left"}`}
                                                            >
                                                                {c.label}
                                                            </th>
                                                        ))}
                                                        <th className="w-16 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline text-right">Open</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {workingForms.map((r, i) => (
                                                        <tr
                                                            key={r.id}
                                                            className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors"
                                                        >
                                                            <td className="px-3 py-2 text-[10px] tabular-nums text-faint">
                                                                {String(i + 1).padStart(2, "0")}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="truncate text-xs font-semibold text-heading">{r.title}</div>
                                                                {r.window && (
                                                                    <div className="truncate text-[10px] text-subtle">{r.window}</div>
                                                                )}
                                                            </td>
                                                            {activeFormsCols.map((c) => (
                                                                <td
                                                                    key={c.key}
                                                                    className={`px-3 py-2 text-xs text-body ${c.r ? "text-right tabular-nums" : ""}`}
                                                                >
                                                                    {renderFormCell(r, c.key)}
                                                                </td>
                                                            ))}
                                                            <td className="px-3 py-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenForm(r.raw)}
                                                                    className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-[10px] font-semibold text-brand-strong hover:bg-brand-500/20 transition-colors"
                                                                    title="Open the per-form detailed report"
                                                                >
                                                                    Open
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("responses") ? (
                                    <Sec id="responses">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Response detail</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {workingResponses.length} response{workingResponses.length === 1 ? "" : "s"}
                                            </span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">#</th>
                                                        {activeRespCols.map((c) => (
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
                                                    {workingResponses.slice(0, 500).map((r, i) => (
                                                        <tr
                                                            key={`${r.formId}-${r.studentId || i}-${i}`}
                                                            className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors"
                                                        >
                                                            <td className="px-3 py-2 text-[10px] tabular-nums text-faint">
                                                                {String(i + 1).padStart(2, "0")}
                                                            </td>
                                                            {activeRespCols.map((c) => (
                                                                <td
                                                                    key={c.key}
                                                                    className={`px-3 py-2 text-xs text-body ${c.r ? "text-right tabular-nums" : ""}`}
                                                                >
                                                                    {renderRespCell(r, c.key)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                    {workingResponses.length > 500 ? (
                                                        <tr>
                                                            <td
                                                                colSpan={activeRespCols.length + 1}
                                                                className="px-3 py-3 text-center text-[10.5px] text-subtle"
                                                            >
                                                                Showing first 500 of {workingResponses.length}. The Excel export writes every row.
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Sec>
                                ) : null}

                                {shouldShow("comments") ? (
                                    <Sec id="comments">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2 pr-10">
                                            <h3 className="text-xs font-semibold text-heading">Comments &amp; suggestions</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">
                                                {commentRows.length} shown
                                            </span>
                                        </header>
                                        <div className="flex flex-col gap-2 p-4">
                                            {commentRows.length === 0 ? (
                                                <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center text-xs text-subtle">
                                                    No comments in the selection.
                                                </div>
                                            ) : (
                                                commentRows.map((c) => (
                                                    <div
                                                        key={c.key}
                                                        className="rounded-md border border-hairline bg-surface p-3"
                                                    >
                                                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[10px] text-subtle">
                                                            <span className="truncate">
                                                                {c.student} · {c.form}
                                                                {c.trainer && c.trainer !== "Course-level" ? ` · ${c.trainer}` : ""}
                                                            </span>
                                                            <span>
                                                                {c.date
                                                                    ? new Date(c.date).toLocaleString("en-GB", {
                                                                          day: "2-digit",
                                                                          month: "short",
                                                                          year: "numeric",
                                                                      })
                                                                    : "—"}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-faint">{c.question}</div>
                                                        <p className="mt-1 text-xs text-body">{c.text}</p>
                                                    </div>
                                                ))
                                            )}
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

// Small stat tile (mirrors the perf designer's Stat).
function Stat({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: string | number;
    hint?: string;
    tone?: "good" | "bad" | "muted";
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
