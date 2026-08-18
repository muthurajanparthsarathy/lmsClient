"use client";

/**
 * L&D Head console — self-contained area inside the dedicated LDLayout shell.
 * View switching is hash-driven (mirrors the approved wireframe). Views wire to
 * real endpoints where the platform already exposes the data:
 *   Dashboard / Student Performance → /analytics/staff/analytics/students
 *   Course Insight / Trainers / Rules → /courses-structure/getAll
 *   Approval Queue → /approvals/pending      Schedule → /program-calendar/getAll
 *   Attendance → /attendance/overview        Profile → local session
 * Feedback and Reports are structured views; their cross-course rollups need
 * dedicated manager endpoints and are labelled as such.
 */

import { useEffect, useMemo, useState, type ReactNode, type ComponentType } from "react";
import {
  Target, Users, CheckCircle2, AlertTriangle, Building2, BookOpen,
  Activity, GraduationCap, ArrowUpRight, FileText, Eye, EyeOff,
  ChevronRight, ClipboardList, CalendarCheck, Star, Clock, UserCheck,
  Search, Bell, Settings, SlidersHorizontal,
} from "lucide-react";
import LDLayout, { LDView, CourseOpt } from "../../component/ldshell/LDLayout";
import ApprovalHierarchyModal from "../../component/ApprovalHierarchyModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";
const getToken = () =>
  typeof window === "undefined"
    ? ""
    : localStorage.getItem("smartcliff_token") || localStorage.getItem("token") || "";
const authGet = async (path: string) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};
const n = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : 0);
const pct = (v: number) => `${Math.round(v)}%`;
const roleName = (role: any): string => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return (role.renameRole || role.originalRole || role.roleValue || role.name || "").toString();
};

const VIEWS: LDView[] = [
  "dashboard", "appr-queue", "appr-rules", "courses", "content", "schedule",
  "trainers", "attendance", "perf-progress", "perf-results",
  "fb-summary", "reports", "profile",
];
function useHashView(): LDView {
  const [v, setV] = useState<LDView>("dashboard");
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || "").replace("#", "") as LDView;
      setV(VIEWS.includes(h) ? h : "dashboard");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return v;
}

/* generic states */
const Loading = () => <div className="ldc-empty">Loading…</div>;
const ErrBox = ({ m }: { m: string }) => <div className="ldc-empty ldc-err">{m}</div>;
const Head = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) => (
  <div className={sub ? "ldc-head" : "ldc-head nosub"}>{eyebrow ? <div className="ldc-eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
);
const Note = ({ children }: { children: ReactNode }) => <p className="ldc-note">{children}</p>;

/* small hook to load an endpoint */
function useData<T>(path: string, map: (j: any) => T) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: T | null }>({
    loading: true, error: "", data: null,
  });
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const j = await authGet(path);
        if (on) setState({ loading: false, error: "", data: map(j) });
      } catch (e) {
        if (on) setState({ loading: false, error: e instanceof Error ? e.message : "Could not load", data: null });
      }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return state;
}

/* useData variant that waits until its path is known (null = don't fetch yet) */
function useDataOpt<T>(path: string | null, map: (j: any) => T) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: T | null }>({
    loading: !!path, error: "", data: null,
  });
  useEffect(() => {
    if (!path) { setState({ loading: false, error: "", data: null }); return; }
    let on = true;
    setState({ loading: true, error: "", data: null });
    (async () => {
      try {
        const j = await authGet(path);
        if (on) setState({ loading: false, error: "", data: map(j) });
      } catch (e) {
        if (on) setState({ loading: false, error: e instanceof Error ? e.message : "Could not load", data: null });
      }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return state;
}

/* ───────── Dashboard ───────── */
const stageVal = (p: any, k: string): number => {
  const v = p?.[k];
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const a = Object.values(v).filter((x) => typeof x === "number") as number[];
    return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  }
  return 0;
};

// Per-stage completion %, consistent with `overall` (attempts/exercises done).
// A stage is an object of sub-types, e.g. I_Do: { Video: {completed,total,...} }.
// Returns completed/total across sub-types, or null when the stage has NO
// content (total 0) — null means "not applicable", never counted as 0%.
const stageDone = (p: any, k: string): number | null => {
  const v = p?.[k];
  if (!v || typeof v !== "object") return null;
  let comp = 0, tot = 0;
  Object.values(v).forEach((sub: any) => {
    if (sub && typeof sub === "object" && ("total" in sub)) {
      comp += Number(sub.completed) || 0;
      tot += Number(sub.total) || 0;
    }
  });
  return tot > 0 ? Math.round((comp / tot) * 100) : null;
};

// Score metric (distinct from completion): the per-category `percentage` on
// We_Do/You_Do is score-weighted server-side (marks earned vs marks possible),
// so its mean is an honest "average score". I_Do is excluded — its percentage
// mirrors MCQ-doc completion, not marks.
const scoreOf = (p: any): number | null => {
  const vals: number[] = [];
  ["We_Do", "You_Do"].forEach((k) => {
    const v = p?.[k];
    if (!v || typeof v !== "object") return;
    Object.values(v).forEach((sub: any) => {
      if (sub && typeof sub === "object" && Number(sub.total) > 0 && typeof sub.percentage === "number") vals.push(Number(sub.percentage) || 0);
    });
  });
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
};

// ISO-week bucketing for the focus-course attendance chart.
const mondayKey = (d: Date): string => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};
const wkLabel = (k: string): string => {
  const d = new Date(`${k}T00:00:00Z`);
  return isNaN(d.getTime()) ? k : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

type DashFilter = { client: string; course: string; courseIds: Set<string> | null; clientOf: (id: string) => string | undefined; onReset: () => void };

const STAGE_META = [
  { key: "iDo", label: "I Do", tag: "concept MCQs" },
  { key: "weDo", label: "We Do", tag: "guided practice" },
  { key: "youDo", label: "You Do", tag: "independent exercises" },
] as const;
const band = (v: number): [string, string] => (v >= 85 ? ["good", "On track"] : v < 50 ? ["bad", "Needs attention"] : ["warn", "In progress"]);

/* ── shared presentational atoms (student-dashboard style, ember palette) ── */
type Ico = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
const TINT: Record<string, string> = { ember: "#E2670F", good: "#0E9F6E", bad: "#B42318", violet: "#7C5CFC", blue: "#2E90C4", amber: "#C77700" };

function IconChip({ icon: Icon, tint }: { icon: Ico; tint: string }) {
  const c = TINT[tint] || TINT.ember;
  return <span className="ldc-ichip" style={{ background: `${c}17`, color: c }}><Icon size={17} strokeWidth={2.1} /></span>;
}

// Mini distribution bars (a shape, not a time-trend — honest with our data).
function Spark({ data, tint }: { data: number[]; tint: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const c = TINT[tint] || TINT.ember;
  return (
    <span className="ldc-spark">
      {data.slice(0, 16).map((v, i) => <i key={i} style={{ height: `${Math.max(10, (v / max) * 100)}%`, background: c, opacity: 0.35 + 0.65 * (v / max) }} />)}
    </span>
  );
}

function StatTile({ tint, icon, label, value, sub, spark, bar, delta }: {
  tint: string; icon: Ico; label: string; value: ReactNode; sub: string; spark?: number[]; bar?: number; delta?: string;
}) {
  return (
    <div className="ldc-stat">
      <div className="ldc-stat-top">
        <IconChip icon={icon} tint={tint} />
        {spark && spark.length ? <Spark data={spark} tint={tint} /> : delta ? <span className="ldc-delta"><ArrowUpRight size={12} strokeWidth={2.5} />{delta}</span> : null}
      </div>
      <div className="ldc-stat-v">{value}</div>
      <div className="ldc-stat-k">{label}</div>
      {typeof bar === "number" ? <span className="ldc-statbar"><i style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: TINT[tint] }} /></span> : null}
      <div className="ldc-stat-s">{sub}</div>
    </div>
  );
}

function Ring({ pct: p }: { pct: number }) {
  const size = 150, sw = 13, r = (size - sw) / 2, C = 2 * Math.PI * r;
  const off = C - (Math.min(100, Math.max(0, p)) / 100) * C;
  return (
    <svg width={size} height={size} className="ldc-ring" viewBox={`0 0 ${size} ${size}`}>
      <defs><linearGradient id="ldcring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0872E" /><stop offset="100%" stopColor="#B94E08" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb,var(--muted) 15%,transparent)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ldcring)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function ProgBar({ label, tag, v }: { label: string; tag: string; v: number | null }) {
  const na = v === null;
  return (
    <div className="ldc-pb">
      <div className="ldc-pb-h"><span className="ldc-pb-l"><b>{label}</b><small>{tag}</small></span><span className="ldc-pb-v">{na ? <em className="ldc-na">N/A</em> : pct(v)}</span></div>
      <span className="ldc-pb-tk"><i className={na ? "" : band(v)[0]} style={{ width: `${na ? 0 : Math.max(2, Math.min(100, v))}%` }} /></span>
    </div>
  );
}

// Segmented donut (completed / in progress / not started) with center caption.
function Donut({ segs, center, sub, size = 128, sw = 15 }: { segs: { v: number; c: string }[]; center: string; sub: string; size?: number; sw?: number }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  const r = (size - sw) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ldc-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb,var(--muted) 15%,transparent)" strokeWidth={sw} />
      {total > 0 ? segs.map((s, i) => {
        const frac = s.v / total;
        const el = frac > 0 ? (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={sw}
            strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null;
        acc += frac;
        return el;
      }) : null}
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="ldc-donut-n">{center}</text>
      <text x="50%" y="61%" textAnchor="middle" dominantBaseline="central" className="ldc-donut-l">{sub}</text>
    </svg>
  );
}

// Initials avatar, deterministic tint per name.
const AV_TINTS = ["ember", "good", "violet", "blue", "amber", "bad"];
function Av({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return <span className="ldm-av" style={{ background: TINT[AV_TINTS[Math.abs(h) % AV_TINTS.length]] }}>{init}</span>;
}

function DashboardView({ filter }: { filter: DashFilter }) {
  const { client, course, courseIds, clientOf, onReset } = filter;
  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  const todayKey = new Date().toISOString().slice(0, 10);

  // Primary payload — KPIs, progress, at-risk, client rollups.
  const main = useData(`/analytics/staff/analytics/students`, (j) => {
    const d = j?.data ?? j ?? {};
    const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    const rows: any[] = []; const students: any[] = [];
    courses.forEach((c) => {
      const co = c.course ?? {}; const s = c.stats ?? {};
      const cid = String(co._id || c._id || "");
      rows.push({ id: cid, name: co.courseName || c.courseName || "Untitled", code: co.courseCode || "—",
        client: co.clientName || "Unassigned", students: n(s.totalStudents ?? co.totalStudents), avg: n(s.averageProgress),
        done: n(s.completedStudents), prog: n(s.inProgressStudents), not: n(s.notStartedStudents) });
      (Array.isArray(c.students) ? c.students : []).forEach((stu: any) => {
        const p = stu.progress ?? stu; const st = stu.student ?? stu;
        students.push({
          name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
          course: co.courseName || c.courseName || "Course",
          courseId: cid,
          overall: n(p.overall ?? stu.overall),
          iDo: stageDone(p, "I_Do"), weDo: stageDone(p, "We_Do"), youDo: stageDone(p, "You_Do"),
          score: scoreOf(p), last: stu.lastActivity || null,
        });
      });
    });
    return { rows, students };
  });
  // Secondary sources — each panel degrades on its own if one fails.
  const roster = useData(`/courses-structure/getAll`, (j) => (Array.isArray(j?.data) ? j.data : []));
  const attnDay = useData(`/attendance/overview?date=${todayKey}`, (j) => (Array.isArray(j?.data) ? j.data : []));
  const appr = useData(`/approvals/pending`, (j) => (Array.isArray(j?.data) ? j.data : []));
  const fbk = useData(`/getAll/feedback`, (j) => {
    const docs = Array.isArray(j?.getAllFeedback) ? j.getAllFeedback : [];
    const out: any[] = [];
    docs.forEach((f: any) => (Array.isArray(f.studentResponses) ? f.studentResponses : []).forEach((r: any) => out.push({
      t: r.submittedAt || "", name: r.studentName || "Student",
      rating: typeof r.overallRating === "number" ? r.overallRating : null,
      title: f.feedbackTitle || "Feedback", courseId: String(f.courseId || ""),
    })));
    return out;
  });
  // Course Analytics focus: the filtered course, else the weakest active one —
  // the course the L&D Head should look at first.
  const focusId = useMemo(() => {
    if (!main.data) return null;
    const rs = (main.data.rows as any[]).filter((r) => inClient(r.id) && (course === "all" || r.id === course));
    if (course !== "all") return rs.find((r) => r.id === course)?.id ?? null;
    const active = rs.filter((r) => r.students > 0);
    return active.length ? [...active].sort((a, b) => a.avg - b.avg)[0].id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main.data, course, courseIds]);
  const attFocus = useDataOpt(focusId ? `/attendance/get/${focusId}` : null, (j) => (Array.isArray(j?.data) ? j.data : []));

  if (main.loading) return <><DashHead scope="All courses overview" sub="Loading your courses…" filtered={false} onReset={onReset} /><DashSkeleton /></>;
  if (main.error || !main.data) return <><DashHead scope="All courses overview" sub="" filtered={false} onReset={onReset} /><ErrBox m={main.error || "No data"} /></>;

  // Filter (client-side). Bridge the client filter through course IDs — the
  // analytics rows don't reliably carry clientName, so we match on ID.
  const filtered = client !== "all" || course !== "all";
  const rows = (main.data.rows as any[]).filter((r) => inClient(r.id) && (course === "all" || r.id === course));
  const studs = (main.data.students as any[]).filter((s) => inClient(s.courseId) && (course === "all" || s.courseId === course));

  // ── portfolio aggregates ────────────────────────────────────────────────
  const totalCourses = rows.length;
  const students = rows.reduce((s, r) => s + r.students, 0);
  const activeRows = rows.filter((r) => r.students > 0);
  const avg = activeRows.length ? Math.round(activeRows.reduce((s, r) => s + r.avg, 0) / activeRows.length) : 0;
  const st = rows.reduce((a, r) => ({ done: a.done + r.done, prog: a.prog + r.prog, not: a.not + r.not }), { done: 0, prog: 0, not: 0 });
  const donePct = students ? Math.round((st.done / students) * 100) : 0;
  const clientsInScope = new Set(rows.map((r) => clientOf(r.id) || r.client)).size;

  // marks-weighted score (We Do / You Do `percentage`), portfolio + per course
  const scored = studs.map((x) => x.score).filter((v): v is number => v !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, v) => s + v, 0) / scored.length) : null;
  const scoreAgg = new Map<string, { s: number; n: number }>();
  studs.forEach((x) => { if (x.score !== null) { const e = scoreAgg.get(x.courseId) || { s: 0, n: 0 }; e.s += x.score; e.n++; scoreAgg.set(x.courseId, e); } });
  const courseScore = (id: string): number | null => { const e = scoreAgg.get(id); return e && e.n ? Math.round(e.s / e.n) : null; };

  // at-risk (started but below 50%), worst first — Critical rows sort to the top
  const atRisk = studs.filter((x) => x.overall > 0 && x.overall < 50).sort((a, b) => a.overall - b.overall);
  const atRiskPct = students ? Math.round((atRisk.length / students) * 100) : 0;
  const riskOf = (o: number): [string, string] => (o < 35 ? ["bad", "Critical"] : o < 45 ? ["bad", "High"] : ["warn", "Medium"]);

  // activity recency (lastAccessed — stamped on answer/progress writes)
  const now = Date.now();
  const DAY = 86400000;
  const active7 = studs.filter((x) => x.last && now - +new Date(x.last) <= 7 * DAY).length;
  const inactive7 = studs.filter((x) => x.overall > 0 && x.overall < 80 && x.last && now - +new Date(x.last) > 7 * DAY).length;

  // stage funnel (null = stage has no content → N/A)
  const mean = (k: "iDo" | "weDo" | "youDo") => {
    const vs = studs.map((x) => x[k]).filter((v): v is number => v !== null);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const funnel = STAGE_META.map((m) => ({ ...m, v: mean(m.key as "iDo" | "weDo" | "youDo") }));

  // ── attendance today (overview), scoped ─────────────────────────────────
  const ovRows = (attnDay.data || []).filter((c: any) => inClient(String(c._id)) && (course === "all" || String(c._id) === course));
  let batchT = 0, batchM = 0;
  const attByClient = new Map<string, { m: number; t: number }>();
  ovRows.forEach((c: any) => {
    if (!c.hasSchedule) return;
    const cn = clientOf(String(c._id)) || c.clientName || "Unassigned";
    const e = attByClient.get(cn) || { m: 0, t: 0 };
    (Array.isArray(c.batches) ? c.batches : []).forEach((b: any) => { batchT++; e.t++; if (b.markedToday) { batchM++; e.m++; } });
    attByClient.set(cn, e);
  });
  const pendingBatches = batchT - batchM;

  // ── client performance rollup ───────────────────────────────────────────
  const cMap = new Map<string, { students: number; avgs: number[]; scores: number[]; risk: number }>();
  rows.forEach((r) => {
    const cn = clientOf(r.id) || r.client || "Unassigned";
    const e = cMap.get(cn) || { students: 0, avgs: [], scores: [], risk: 0 };
    e.students += r.students;
    if (r.students > 0) e.avgs.push(r.avg);
    const sc = courseScore(r.id); if (sc !== null) e.scores.push(sc);
    cMap.set(cn, e);
  });
  atRisk.forEach((x) => { const cn = clientOf(x.courseId) || "Unassigned"; const e = cMap.get(cn); if (e) e.risk++; });
  const clientsPerf = [...cMap.entries()].map(([name, e]) => ({
    name, students: e.students,
    avg: e.avgs.length ? Math.round(e.avgs.reduce((s, v) => s + v, 0) / e.avgs.length) : null,
    score: e.scores.length ? Math.round(e.scores.reduce((s, v) => s + v, 0) / e.scores.length) : null,
    risk: e.risk, att: attByClient.get(name) || null,
    sparks: rows.filter((r) => (clientOf(r.id) || r.client || "Unassigned") === name && r.students > 0).map((r) => r.avg),
  })).sort((a, b) => b.students - a.students);

  // ── trainer performance (roster join → analytics rows by course _id) ────
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const tMap = new Map<string, { label: string; courses: Set<string>; students: Set<string> }>();
  (roster.data || []).filter((c: any) => inClient(String(c._id)) && (course === "all" || String(c._id) === course)).forEach((c: any) => {
    (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
      const us = Array.isArray(b.users) ? b.users : [];
      const batchStudents = us.filter((u: any) => { const rn = roleName(u.user?.role).toLowerCase(); return rn.includes("student") || rn === ""; });
      us.forEach((u: any) => {
        const rn = roleName(u.user?.role).toLowerCase();
        if (!rn.includes("trainer") && !rn.includes("faculty")) return;
        const email = u.user?.email || "";
        const key = String(u.user?._id || email || "trainer");
        const label = `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.trim() || (email ? email.split("@")[0] : "Trainer");
        const e = tMap.get(key) || { label, courses: new Set<string>(), students: new Set<string>() };
        e.courses.add(String(c._id));
        batchStudents.forEach((s2: any) => e.students.add(String(s2.user?._id || s2.user?.email || s2._id)));
        tMap.set(key, e);
      });
    });
  });
  const trainerRows = [...tMap.values()].map((t) => {
    const cs = [...t.courses].map((id) => rowById.get(id)).filter(Boolean) as any[];
    const withStud = cs.filter((c) => c.students > 0);
    const comp = withStud.length ? Math.round(withStud.reduce((s, c) => s + c.avg, 0) / withStud.length) : null;
    const scores = [...t.courses].map((id) => courseScore(id)).filter((v): v is number => v !== null);
    const score = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
    return { name: t.label, courses: t.courses.size, students: t.students.size, comp, score };
  }).sort((a, b) => b.students - a.students);
  const rated = trainerRows.filter((t) => t.comp !== null);
  const topTrainer = rated.length > 1 ? [...rated].sort((a, b) => (b.comp as number) - (a.comp as number))[0] : null;
  const lowTrainer = rated.length > 1 ? [...rated].sort((a, b) => (a.comp as number) - (b.comp as number))[0] : null;

  // ── approvals + feedback (scoped) → recent activity feed ────────────────
  const apprRows = (appr.data || []).filter((a: any) => inClient(String(a.courseId || "")) && (course === "all" || String(a.courseId) === course));
  const fbRows = (fbk.data || []).filter((f: any) => inClient(f.courseId) && (course === "all" || f.courseId === course));
  const acts: { t: string; tint: string; main: string; sub: string }[] = [];
  apprRows.forEach((a: any) => acts.push({
    t: a.initiatedAt || "", tint: "amber",
    main: `${a.exerciseName || "Exercise"} sent for approval`,
    sub: `${a.tabType === "You_Do" ? "Assessment" : "Assignment"} · step ${n(a.currentStep) || 1} of ${n(a.totalSteps) || 1}`,
  }));
  fbRows.forEach((f: any) => acts.push({
    t: f.t, tint: "violet",
    main: `${f.name} submitted feedback${f.rating !== null ? ` · ${f.rating}/10` : ""}`,
    sub: f.title,
  }));
  [...studs].filter((x) => x.last).sort((a, b) => +new Date(b.last) - +new Date(a.last)).slice(0, 3)
    .forEach((x) => acts.push({ t: x.last, tint: "good", main: `${x.name} active in course`, sub: x.course }));
  const feed = acts.filter((a) => a.t).sort((a, b) => +new Date(b.t) - +new Date(a.t)).slice(0, 7);

  // ── alerts — every row is a real work queue, linked to its view ─────────
  const lowCourses = activeRows.filter((r) => r.avg < 50).length;
  const alerts: { n: number; cls: string; icon: Ico; txt: string; href: string }[] = [
    { n: pendingBatches, cls: "bad", icon: CalendarCheck, txt: "batches attendance pending today", href: "#attendance" },
    { n: atRisk.length, cls: "bad", icon: AlertTriangle, txt: "students at risk (below 50%)", href: "#perf-progress" },
    { n: inactive7, cls: "warn", icon: Clock, txt: "students inactive 7+ days", href: "#perf-progress" },
    { n: apprRows.length, cls: "warn", icon: ClipboardList, txt: "items awaiting your approval", href: "#appr-queue" },
    { n: lowCourses, cls: "bad", icon: BookOpen, txt: "courses below 50% completion", href: "#courses" },
    { n: st.not, cls: "neutral", icon: Users, txt: "students not started", href: "#perf-progress" },
  ].filter((a) => a.n > 0);

  // ── focus course metrics (Course Analytics panel) ───────────────────────
  const focus = focusId ? (rowById.get(focusId) as any) : null;
  const focusStuds = studs.filter((s) => s.courseId === focusId);
  const fMean = (k: "iDo" | "weDo" | "youDo") => {
    const vs = focusStuds.map((x) => x[k]).filter((v): v is number => v !== null);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const attRecs = attFocus.data || [];
  let attPresent = 0;
  attRecs.forEach((r: any) => { if (r.status === "P") attPresent++; else if (r.status === "H") attPresent += 0.5; });
  const attPct = attRecs.length ? Math.round((attPresent / attRecs.length) * 100) : null;
  const wkMap = new Map<string, { p: number; t: number }>();
  attRecs.forEach((r: any) => {
    const d = new Date(r.date); if (isNaN(d.getTime())) return;
    const k = mondayKey(d);
    const e = wkMap.get(k) || { p: 0, t: 0 };
    e.t++; if (r.status === "P") e.p++; else if (r.status === "H") e.p += 0.5;
    wkMap.set(k, e);
  });
  const weeks = [...wkMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6)
    .map(([k, e]) => ({ label: wkLabel(k), v: Math.round((e.p / e.t) * 100) }));

  // ── header scope + sub-line (always denominatored) ───────────────────────
  const courseRow = course !== "all" ? rows.find((r) => r.id === course) : null;
  const clientLabel = client !== "all" ? client : courseRow ? (clientOf(courseRow.id) || "Unassigned") : "All clients";
  const scope = courseRow ? courseRow.name : client !== "all" ? client : "All courses overview";
  const subline = totalCourses === 0
    ? "No courses in this view"
    : courseRow
      ? `${clientLabel} · ${students.toLocaleString()} students enrolled`
      : `${clientLabel} · ${totalCourses} course${totalCourses === 1 ? "" : "s"} · ${students.toLocaleString()} students enrolled`;

  return (
    <>
      <DashHead scope={scope} sub={subline} filtered={filtered} onReset={onReset} alerts={alerts.reduce((s, a) => s + a.n, 0)} />

      {/* ── KPI grid (counts + health) · Quick Actions rail ── */}
      <div className="ldm-top">
        <div className="ldm-kpis">
          <StatTile tint="blue" icon={Building2} label="Clients" value={clientsInScope.toLocaleString()} sub={`${totalCourses} course${totalCourses === 1 ? "" : "s"} in scope`} />
          <StatTile tint="ember" icon={BookOpen} label="Courses" value={totalCourses.toLocaleString()} sub={`${activeRows.length} with enrolled students`} />
          <StatTile tint="violet" icon={GraduationCap} label="Students" value={students.toLocaleString()} sub={`${st.done.toLocaleString()} completed · ${st.not.toLocaleString()} not started`} />
          <StatTile tint="amber" icon={UserCheck} label="Trainers" value={roster.loading ? "…" : trainerRows.length.toLocaleString()} sub="assigned via course batches" />
          <StatTile tint="ember" icon={Target} label="Overall completion" value={students === 0 ? "—" : pct(avg)} bar={students ? avg : 0} sub="share of exercises finished" />
          <StatTile tint="good" icon={Star} label="Average score" value={avgScore === null ? "—" : pct(avgScore)} bar={avgScore ?? 0} sub="marks-weighted · We Do & You Do" />
          <StatTile tint="bad" icon={AlertTriangle} label="At-risk students" value={atRisk.length.toLocaleString()} bar={atRiskPct} sub={`${atRiskPct}% of enrolled · below 50%`} />
          <StatTile tint="good" icon={Activity} label="Active this week" value={active7.toLocaleString()} bar={students ? Math.round((active7 / students) * 100) : 0} sub={`of ${students.toLocaleString()} enrolled · last 7 days`} />
        </div>
        <div className="ldc-panel ldm-qa">
          <div className="ldc-panel-h"><h2>Quick Actions</h2></div>
          <a className="ldm-qa-i" href="#appr-queue"><IconChip icon={ClipboardList} tint="ember" /><span>Approval queue</span>{apprRows.length ? <b className="ldm-qa-b">{apprRows.length}</b> : null}<ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#courses"><IconChip icon={BookOpen} tint="blue" /><span>Course insight</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#trainers"><IconChip icon={Users} tint="violet" /><span>Trainer allocation</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#attendance"><IconChip icon={CalendarCheck} tint="good" /><span>Attendance register</span>{pendingBatches > 0 ? <b className="ldm-qa-b">{pendingBatches}</b> : null}<ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#perf-progress"><IconChip icon={AlertTriangle} tint="bad" /><span>View at-risk students</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#reports"><IconChip icon={FileText} tint="amber" /><span>Generate client report</span><ChevronRight className="chev" size={14} /></a>
        </div>
      </div>

      {/* ── Overall Progress · At Risk Students · Client Performance ── */}
      <div className="ldm-mid ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Overall Progress</h2><span>{course !== "all" ? "this course" : "all courses"}</span></div>
          {studs.length === 0
            ? <div className="ldc-empty">No student progress in this view yet.</div>
            : <>
              <div className="ldc-progbars">{funnel.map((f) => <ProgBar key={f.key} label={f.label} tag={f.tag} v={f.v} />)}</div>
              <div className="ldm-donutrow">
                <Donut center={students ? pct(donePct) : "—"} sub="completed"
                  segs={[{ v: st.done, c: "var(--good)" }, { v: st.prog, c: "var(--accent)" }, { v: st.not, c: "#C9C1B8" }]} />
                <div className="ldc-legend">
                  <span className="lg"><span className="dot" style={{ background: "var(--good)" }} />Completed <b>{donePct}% ({st.done.toLocaleString()})</b></span>
                  <span className="lg"><span className="dot" style={{ background: "var(--accent)" }} />In progress <b>{students ? Math.round((st.prog / students) * 100) : 0}% ({st.prog.toLocaleString()})</b></span>
                  <span className="lg"><span className="dot" style={{ background: "#C9C1B8" }} />Not started <b>{students ? Math.round((st.not / students) * 100) : 0}% ({st.not.toLocaleString()})</b></span>
                </div>
              </div>
            </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>At Risk Students</h2>{atRisk.length ? <span className="ldc-badge2">{atRisk.length}</span> : null}<a className="ldc-link ldm-pa" href="#perf-progress">View all</a></div>
          {atRisk.length === 0 ? (
            <div className="ldc-feed-ok"><span className="ldc-feed-okico"><CheckCircle2 size={18} strokeWidth={2.2} /></span><b>Everyone on track</b><span>No active student is below the 50% line in this view.</span></div>
          ) : (
            <div className="ldm-vh"><table className="ldm-tbl">
              <thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Risk</th></tr></thead>
              <tbody>{atRisk.slice(0, 8).map((x, i) => {
                const [cls, lab] = riskOf(x.overall);
                return (
                  <tr key={i}>
                    <td><span className="ldm-who"><Av name={x.name} /><b>{x.name}</b></span></td>
                    <td><small>{x.course}</small></td>
                    <td><span className="ldc-compbar" style={{ width: 56 }}><i className={cls} style={{ width: `${Math.max(3, x.overall)}%` }} /></span><b className="pctv">{pct(x.overall)}</b></td>
                    <td><span className={`ldc-chip ${cls}`}>{lab}</span></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Client Performance</h2><a className="ldc-link ldm-pa" href="#courses">View all</a></div>
          {clientsPerf.length === 0 ? <div className="ldc-empty">No clients in this view.</div> : (
            <div className="ldm-vh">{clientsPerf.map((c) => (
              <div className="ldm-cl" key={c.name}>
                <div className="ldm-cl-h"><IconChip icon={Building2} tint="blue" /><b>{c.name}</b>{c.sparks.length > 1 ? <Spark data={c.sparks} tint="ember" /> : null}</div>
                <div className="ldm-cl-g">
                  <span className="ldm-ms"><span>Students</span><b>{c.students.toLocaleString()}</b></span>
                  <span className="ldm-ms"><span>Completion</span><b className={c.avg === null ? "" : band(c.avg)[0]}>{c.avg === null ? "—" : pct(c.avg)}</b></span>
                  <span className="ldm-ms"><span>Avg score</span><b>{c.score === null ? "—" : pct(c.score)}</b></span>
                  <span className="ldm-ms" title="in-delivery batches with attendance marked today"><span>Att. today</span><b>{c.att && c.att.t ? `${c.att.m}/${c.att.t}` : "—"}</b></span>
                  <span className="ldm-ms"><span>At risk</span><b className={c.risk ? "bad" : ""}>{c.risk}</b></span>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {/* ── Course Analytics · Trainer Performance · Recent Activity · Alerts ── */}
      <div className="ldm-bot ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Course Analytics</h2><span>{focus ? focus.name : "—"}</span></div>
          {!focus ? <div className="ldc-empty">No active course to analyse yet.</div> : <>
            <div className="ldm-strip5">
              <span className="ldm-ms"><span>Students</span><b>{focus.students}</b></span>
              <span className="ldm-ms"><span>Completion</span><b className={band(focus.avg)[0]}>{pct(focus.avg)}</b></span>
              <span className="ldm-ms"><span>Avg score</span><b>{courseScore(focus.id) === null ? "—" : pct(courseScore(focus.id) as number)}</b></span>
              <span className="ldm-ms"><span>Assignments</span><b>{fMean("weDo") === null ? "—" : pct(fMean("weDo") as number)}</b></span>
              <span className="ldm-ms"><span>Attendance</span><b>{attPct === null ? "—" : pct(attPct)}</b></span>
            </div>
            <div className="ldc-feed-h">Weekly attendance</div>
            {attFocus.loading ? <div className="ldc-empty" style={{ padding: "18px 8px" }}>Loading attendance…</div>
              : weeks.length === 0 ? <div className="ldc-empty" style={{ padding: "18px 8px" }}>No attendance records yet.</div>
                : <div className="ldm-wk">{weeks.map((w) => (
                  <span className="c" key={w.label}><span className="v">{w.v}%</span><span className="t"><span className="f" style={{ height: `${Math.max(4, w.v)}%` }} /></span><span className="l">{w.label}</span></span>
                ))}</div>}
          </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Trainer Performance</h2><a className="ldc-link ldm-pa" href="#trainers">View all</a></div>
          {roster.loading ? <div className="ldc-empty">Loading trainers…</div>
            : trainerRows.length === 0 ? <div className="ldc-empty">No trainers on course rosters in this view.</div>
              : <>
                <div className="ldm-vh"><table className="ldm-tbl">
                  <thead><tr><th>Trainer</th><th className="r">Students</th><th>Avg score</th><th>Completion</th></tr></thead>
                  <tbody>{trainerRows.slice(0, 6).map((t, i) => (
                    <tr key={i}>
                      <td><span className="ldm-who"><Av name={t.name} /><span><b>{t.name}</b><small>{t.courses} course{t.courses === 1 ? "" : "s"}</small></span></span></td>
                      <td className="r">{t.students}</td>
                      <td><b className={`pctv ${t.score === null ? "" : t.score >= 70 ? "good" : t.score >= 50 ? "warn" : "bad"}`}>{t.score === null ? "—" : pct(t.score)}</b></td>
                      <td><span className="ldc-compbar" style={{ width: 64 }}><i className={t.comp === null ? "neutral" : band(t.comp)[0]} style={{ width: `${Math.max(3, t.comp ?? 0)}%` }} /></span><b className="pctv">{t.comp === null ? "—" : pct(t.comp)}</b></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                {topTrainer ? (
                  <div className="ldm-tp-tags">
                    <span className="ldc-chip good">Top performer · {topTrainer.name}</span>
                    {lowTrainer && lowTrainer !== topTrainer ? <span className="ldc-chip warn">Needs attention · {lowTrainer.name}</span> : null}
                  </div>
                ) : null}
              </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Recent Activity</h2></div>
          {feed.length === 0 ? <div className="ldc-empty">Nothing recorded yet — approvals, feedback and student activity land here.</div> : (
            <div className="ldm-act">{feed.map((a, i) => (
              <div className="ldm-act-i" key={i}>
                <span className="dot" style={{ background: TINT[a.tint] }} />
                <div className="ldm-act-b"><small className="tm">{relDate(a.t)}</small><b>{a.main}</b><small>{a.sub}</small></div>
              </div>
            ))}</div>
          )}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Alerts</h2>{alerts.length ? <span className="ldc-badge2">{alerts.length}</span> : null}</div>
          {alerts.length === 0 ? (
            <div className="ldc-feed-ok"><span className="ldc-feed-okico"><CheckCircle2 size={18} strokeWidth={2.2} /></span><b>All clear</b><span>No pending work in this view right now.</span></div>
          ) : alerts.map(({ n: cnt, cls, icon: AIco, txt, href }, i) => (
            <a className={`ldm-alert ${cls}`} href={href} key={i}><AIco size={14} strokeWidth={2.2} /><span>{txt}</span><b>{cnt.toLocaleString()}</b></a>
          ))}
          <p className="ldc-note">Counts respect the Client / Course filter above.</p>
        </div>
      </div>
    </>
  );
}

/* dashboard header: SaaS-style top bar — title + welcome · search · bell · settings · avatar */
function useSessionUser() {
  const [u, setU] = useState<any>(null);
  useEffect(() => { try { setU(JSON.parse(localStorage.getItem("smartcliff_userData") || "null")); } catch { setU(null); } }, []);
  return u;
}
function DashHead({ scope, sub, filtered, onReset, alerts = 0 }: { scope: string; sub: string; filtered: boolean; onReset: () => void; alerts?: number }) {
  const u = useSessionUser();
  const first = u?.firstName || "Admin";
  const name = `${u?.firstName || "L&D"} ${u?.lastName || "Head"}`.trim();
  const init = ((u?.firstName?.[0] || "L") + (u?.lastName?.[0] || "D")).toUpperCase();
  return (
    <div className="ldm-hdr">
      <div className="ldm-hdr-l">
        <h1>{scope}</h1>
        <p className="ldc-scope">Welcome back, {first} · <span className="ldm-scopesub">{sub}</span></p>
      </div>
      <div className="ldm-hdr-r">
        <div className="ldm-search"><Search size={15} strokeWidth={2} /><input type="text" placeholder="Search courses, students, trainers…" aria-label="Search" /></div>
        {filtered ? <button type="button" className="ldc-ghost" onClick={onReset}>Reset filter</button> : null}
        <a className="ldm-ib" href="#perf-progress" title="Alerts" aria-label="Alerts"><Bell size={17} strokeWidth={2} />{alerts > 0 ? <i className="ldm-ib-dot">{alerts > 9 ? "9+" : alerts}</i> : null}</a>
        <a className="ldm-ib" href="#appr-rules" title="Settings" aria-label="Settings"><Settings size={17} strokeWidth={2} /></a>
        <span className="ldm-avatar" title={name}>{init}</span>
      </div>
    </div>
  );
}

/* lightweight skeleton (replaces the bare "Loading…") */
function DashSkeleton() {
  return (
    <>
      <div className="ldc-stats">{[0, 1, 2, 3].map((i) => <div className="ldc-stat" key={i}><span className="ldc-sk ldc-sk-k" /><span className="ldc-sk ldc-sk-v" /><span className="ldc-sk ldc-sk-s" /></div>)}</div>
      <div className="ldc-main2 ldc-sec"><div className="ldc-panel"><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /></div><div className="ldc-panel"><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /></div></div>
    </>
  );
}

/* ───────── Learning Content (I Do · We Do · You Do) ─────────
   The L&D Head can read the full pedagogy their students get — I Do resources,
   We Do assignments and You Do assessments, plus the questions inside each — for
   whichever course/client is chosen in the top filter, regardless of whether an
   approval gate is switched on. Content + per-question approval state come from
   the same nested payload the student/admin dashboards use. */
type CStage = "I Do" | "We Do" | "You Do";
type CItem = {
  key: string; stage: CStage; kindLabel: string; module: string; topic: string;
  name: string; exId: string; level: string; testType: string; graded: boolean;
  marks: number; duration: number; resourceType: string; questions: any[];
  moduleIndex: number; updated: string;
  // resource-only (I Do files)
  fileType?: string; size?: number; url?: string; visible?: boolean; download?: boolean; pages?: number;
};
const fmtSize = (b: number): string => (b >= 1e6 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1e3 ? `${Math.round(b / 1024)} KB` : b ? `${b} B` : "");
const fmtDate = (iso: string): string => { if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const relDate = (iso: string): string => {
  if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); return dd < 30 ? `${dd}d ago` : fmtDate(iso);
};
const fileTypeLabel = (mime: string, fallback: string): string => {
  const t = String(mime || "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("video")) return "Video";
  if (t.includes("image")) return "Image";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "Slides";
  if (t.includes("word") || t.includes("msword") || t.includes("document")) return "Doc";
  if (t.includes("sheet") || t.includes("excel")) return "Sheet";
  if (t.includes("zip") || t.includes("rar")) return "Archive";
  return fallback || "File";
};
const qTitleOf = (q: any): string =>
  q.title || q.mcqQuestionDescription || q.shortAnswer || q.description || q.questionType || "Untitled question";
const qTypeLabel = (t: string): string => {
  const m: Record<string, string> = { programming: "Programming", mcq: "MCQ", multiplechoice: "MCQ", truefalse: "True / False", shortanswer: "Short answer", essay: "Essay", numeric: "Numeric", matching: "Matching", ordering: "Ordering" };
  return m[(t || "").toLowerCase().replace(/[^a-z]/g, "")] || (t ? t[0].toUpperCase() + t.slice(1) : "Question");
};
const apprCls = (s: string): string => (s === "approved" ? "good" : s === "rejected" ? "bad" : s === "pending" ? "warn" : "neutral");
const stageCls = (s: CStage): string => (s === "I Do" ? "ido" : s === "We Do" ? "assign" : "assess");

function collectContent(course: any): CItem[] {
  const out: CItem[] = [];
  (course?.modules || []).forEach((m: any, mi: number) => {
    const module = m.title || m.moduleName || m.name || `Module ${mi + 1}`;
    (m.topics || []).forEach((t: any, ti: number) => {
      const topic = t.title || t.topicName || t.name || `Topic ${ti + 1}`;
      const p = t.pedagogy || {};
      // I Do — resources. Each I_Do type (Video, Document, …) is an object that
      // holds a files[] array (and optionally folders[].files[]); older data may
      // store a plain array instead. Pull every uploaded file out of both shapes.
      const ido = p.I_Do || {};
      Object.keys(ido).forEach((rt) => {
        if (rt === "_id") return;
        const node = ido[rt];
        const files: any[] = [];
        const takeFiles = (n: any) => {
          if (!n) return;
          if (Array.isArray(n)) { n.forEach((x) => { if (x && x.fileName) files.push(x); else takeFiles(x); }); return; }
          if (typeof n === "object") {
            if (Array.isArray(n.files)) n.files.forEach((f: any) => files.push(f));
            if (Array.isArray(n.folders)) n.folders.forEach((fo: any) => takeFiles(fo));
          }
        };
        takeFiles(node);
        files.forEach((f: any, ri: number) => {
          const label = fileTypeLabel(f.fileType, rt);
          out.push({
            key: `${mi}-${ti}-ido-${rt}-${ri}`, stage: "I Do", kindLabel: label, module, topic,
            name: f.fileName || f.title || f.name || rt || "Resource",
            exId: "", level: "", testType: "", graded: false, marks: 0, duration: 0, resourceType: rt, questions: [],
            moduleIndex: mi + 1, updated: f.fileSettings?.lastModified || f.uploadedAt || f.updatedAt || "",
            fileType: label, size: Number(f.size) || 0, url: (f.fileUrl && (f.fileUrl.base || f.fileUrl.url)) || f.fileUrl || f.url || "",
            visible: f.fileSettings?.showToStudents !== false, download: !!f.fileSettings?.allowDownload, pages: Number(f.pages) || 0,
          });
        });
      });
      // We Do (assignments) + You Do (assessments)
      const pushEx = (arr: any[], stage: CStage, kindLabel: string, variant: string) => (arr || []).forEach((e: any, ei: number) => {
        const info = e.exerciseInformation || {};
        out.push({
          key: `${mi}-${ti}-${variant}-${ei}`, stage, kindLabel, module, topic,
          name: info.exerciseName || e.exerciseId || kindLabel,
          exId: info.exerciseId || "", level: info.exerciseLevel || "", testType: info.testType || "",
          graded: !!e.isGraded, marks: Number(info.totalMarks) || 0, duration: Number(info.totalDuration) || 0,
          resourceType: "", questions: Array.isArray(e.questions) ? e.questions : [],
          moduleIndex: mi + 1, updated: e.updatedAt || e.createdAt || "",
        });
      });
      pushEx(p.We_Do?.assignment, "We Do", "Assignment", "wd-assign");
      pushEx(p.We_Do?.practical, "We Do", "Assignment", "wd-prac");
      pushEx(p.You_Do?.assessments, "You Do", "Assessment", "yd-assess");
      pushEx(p.You_Do?.assessment, "You Do", "Assessment", "yd-assess2");
    });
  });
  return out;
}

const apprRollup = (qs: any[]) => {
  const c: Record<string, number> = {};
  qs.forEach((q) => { const s = q?.approval?.status || "none"; c[s] = (c[s] || 0) + 1; });
  return c;
};

function ContentView({ filter }: { filter: { course: string; courseIds: Set<string> | null; clientOf: (id: string) => string | undefined } }) {
  const { loading, error, data } = useData(`/student-Dashboard/courses-data/analytics`, (j) => {
    const d = j?.data ?? j ?? {};
    const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    return courses
      .map((c) => ({
        id: String(c._id || ""), name: c.courseName || "Untitled", client: c.clientName || "Unassigned",
        code: c.courseCode || "", duration: c.courseDuration || "", level: c.courseLevel || "",
        stats: c.stats || {}, modules: Array.isArray(c.modules) ? c.modules : [], items: collectContent(c),
      }))
      .filter((c) => c.items.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const descMap = useData(`/courses-structure/getAll`, (j) => {
    const m = new Map<string, string>();
    (Array.isArray(j?.data) ? j.data : []).forEach((c: any) => m.set(String(c._id), c.courseDescription || ""));
    return m;
  });
  const [stage, setStage] = useState<"all" | CStage>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"newest" | "name" | "size">("newest");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openMods, setOpenMods] = useState<Record<string, boolean>>({});
  const [activeMod, setActiveMod] = useState("");

  const { course, courseIds } = filter;
  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  const scoped = (data || []).filter((c) => inClient(c.id) && (course === "all" || c.id === course));

  const head = <Head eyebrow="Learning Content" title="Learning Content" sub="Every I Do resource, We Do assignment and You Do assessment your students get — for the course selected above." />;
  if (loading) return <>{head}<Loading /></>;
  if (error) return <>{head}<ErrBox m={error} /></>;
  if (scoped.length === 0) return <>{head}<div className="ldc-empty"><b>Nothing to show here</b><span>No course in this view has learning content built yet — try a different Client / Course above.</span></div></>;

  const active = (course !== "all" ? scoped.find((c) => c.id === course) : scoped[0]) || scoped[0];
  const desc = descMap.data?.get(active.id) || "";
  const stats: any = active.stats || {};
  const cohort = n(stats.averageProgress);
  const totalStudents = n(stats.totalStudents);
  const completedS = n(stats.completedStudents);
  const remainingS = Math.max(0, totalStudents - completedS);

  const term = q.trim().toLowerCase();
  const matchItem = (it: CItem) => (stage === "all" || it.stage === stage) && (!term || it.name.toLowerCase().includes(term));
  const sortItems = (arr: CItem[]) => [...arr].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name)
      : sort === "size" ? (b.size || 0) - (a.size || 0)
        : String(b.updated || "").localeCompare(String(a.updated || "")));

  const nAll = active.items.length;
  const nIDo = active.items.filter((i: CItem) => i.stage === "I Do").length;
  const nWe = active.items.filter((i: CItem) => i.stage === "We Do").length;
  const nYou = active.items.filter((i: CItem) => i.stage === "You Do").length;

  const modules = (active.modules || []).map((m: any, mi: number) => {
    const title = m.title || m.moduleName || m.name || `Module ${mi + 1}`;
    return { index: m.index ?? mi + 1, title, duration: m.duration || "", items: sortItems(active.items.filter((i: CItem) => i.module === title && matchItem(i))), total: active.items.filter((i: CItem) => i.module === title).length };
  });
  const recent = [...active.items].filter((i: CItem) => i.updated).sort((a: CItem, b: CItem) => String(b.updated).localeCompare(String(a.updated))).slice(0, 4);
  const STAGES: ("all" | CStage)[] = ["all", "I Do", "We Do", "You Do"];
  const tabCount = (k: "all" | CStage) => (k === "all" ? nAll : k === "I Do" ? nIDo : k === "We Do" ? nWe : nYou);

  return (
    <>
      <div className="lcx-controls">
        <div className="lcx-search">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input placeholder="Search resources…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="lcx-sortlab"><span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "name" | "size")}>
            <option value="newest">Newest</option><option value="name">Name</option><option value="size">Size</option>
          </select>
        </label>
        <div className="lcx-tabs">
          {STAGES.map((k) => <button key={k} type="button" className={stage === k ? "on" : ""} onClick={() => setStage(k)}>{k === "all" ? "All" : k}<b>{tabCount(k)}</b></button>)}
        </div>
        {scoped.length > 1 ? <span className="ldc-chint">Showing 1 of {scoped.length} — pick a <b>Course</b> above.</span> : null}
      </div>

      <div className="lcx-grid">
        <aside className="lcx-left">
          <div className="lcx-thumb"><GraduationCap size={30} strokeWidth={1.6} /></div>
          <div className="lcx-panel">
            <div className="lcx-panel-h">Modules</div>
            <div className="lcx-modnav">
              {modules.map((m: any) => (
                <a key={m.title} href={`#lcxmod-${m.index}`} className={`lcx-modnav-i ${activeMod === m.title ? "on" : ""}`} onClick={() => { setActiveMod(m.title); setOpenMods((o) => ({ ...o, [m.title]: true })); }}>
                  <span className="n">{m.index}</span><span className="t">{m.title}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>

        <main className="lcx-main">
          <div className="lcx-head">
            <div className="lcx-eyebrow">Course</div>
            <h1>{active.name}</h1>
            {desc ? <p className="lcx-desc">{desc}</p> : null}
            <div className="lcx-meta">
              <span className="lcx-mi"><BookOpen size={15} /> <b>{modules.length}</b>&nbsp;Modules</span>
              <span className="lcx-mi"><FileText size={15} /> <b>{nAll}</b>&nbsp;Resources</span>
              <span className="lcx-mi lcx-comp"><b>{pct(cohort)}</b> student completion<span className="lcx-cbar"><i style={{ width: `${Math.max(cohort ? 3 : 0, Math.min(100, cohort))}%` }} /></span></span>
              <a className="lcx-cta" href="#reports">Client report →</a>
            </div>
          </div>

          {modules.length === 0 ? <div className="ldc-empty">No modules in this course.</div> : modules.map((m: any) => {
            const mOpen = openMods[m.title] ?? (m.index === 1);
            const pend = m.items.reduce((s: number, i: CItem) => s + (apprRollup(i.questions).pending || 0), 0);
            return (
              <div className="lcx-mod" id={`lcxmod-${m.index}`} key={m.title}>
                <button type="button" className="lcx-mod-h" onClick={() => setOpenMods((o) => ({ ...o, [m.title]: !mOpen }))}>
                  <span className="lcx-mod-n">{m.index}</span>
                  <span className="lcx-mod-t"><b>{m.title}</b><small>{m.total} resource{m.total === 1 ? "" : "s"}{m.duration ? ` · ${m.duration}` : ""}</small></span>
                  {pend ? <span className="ldc-chip warn">{pend} pending</span> : null}
                  <svg className={`lcx-cv ${mOpen ? "open" : ""}`} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {mOpen ? (
                  m.items.length === 0 ? <div className="lcx-mempty">No {stage === "all" ? "" : stage + " "}content here.</div> : (
                    <div className="lcx-rt">
                      <div className="lcx-rt-head"><span>Resource</span><span>Type</span><span className="ctr">Seen by</span><span className="r">Size</span><span>Updated</span><span>Detail</span><span className="r">Action</span></div>
                      {m.items.map((e: CItem) => {
                        const resource = e.stage === "I Do";
                        const isOpen = !!open[e.key];
                        const roll = apprRollup(e.questions);
                        return (
                          <div className="lcx-rrow" key={e.key}>
                            <div className="lcx-r">
                              <span className={`lcx-ricon ${stageCls(e.stage)}`}><FileText size={15} /></span>
                              <span className="lcx-rname"><b>{e.name}</b><small><span className={`lcx-sb ${stageCls(e.stage)}`}>{e.stage}</span>{resource ? (e.pages ? ` · ${e.pages} pages` : "") : ` · ${e.testType || e.kindLabel}`}</small></span>
                            </div>
                            <div className="lcx-c">{resource ? e.fileType : e.kindLabel}</div>
                            <div className="lcx-c ctr">{resource ? (e.visible ? <span className="lcx-eye on" title="Visible to students"><Eye size={15} /></span> : <span className="lcx-eye off" title="Hidden from students"><EyeOff size={15} /></span>) : <span className="mut">—</span>}</div>
                            <div className="lcx-c r">{resource ? fmtSize(e.size || 0) || "—" : <span className="mut">—</span>}</div>
                            <div className="lcx-c">{fmtDate(e.updated) || <span className="mut">—</span>}</div>
                            <div className="lcx-c">{resource ? (e.download ? "Download on" : "View only") : <span className="lcx-det">{e.questions.length} Q{roll.pending ? <span className="ldc-chip warn">{roll.pending} pending</span> : roll.rejected ? <span className="ldc-chip bad">{roll.rejected} rej</span> : roll.approved ? <span className="ldc-chip good">approved</span> : null}</span>}</div>
                            <div className="lcx-c r">{resource ? (e.url ? <a className="lcx-open" href={e.url} target="_blank" rel="noopener noreferrer">Open</a> : <span className="mut">—</span>) : <button type="button" className={`lcx-open ${isOpen ? "on" : ""}`} onClick={() => setOpen((o) => ({ ...o, [e.key]: !o[e.key] }))}>{isOpen ? "Hide" : "Review"}</button>}</div>
                            {!resource && isOpen ? (
                              <div className="lcx-qbody">
                                {e.questions.length === 0 ? <div className="lcx-mempty">No questions added to this exercise yet.</div> : e.questions.map((qq: any, qi: number) => {
                                  const stq = qq?.approval?.status || "none";
                                  const opts: any[] = Array.isArray(qq.mcqQuestionOptions) ? qq.mcqQuestionOptions : [];
                                  const correct: any[] = Array.isArray(qq.mcqQuestionCorrectAnswers) ? qq.mcqQuestionCorrectAnswers : [];
                                  return (
                                    <div className="ldc-q" key={qi}>
                                      <div className="ldc-q-h"><span className="ldc-q-n">{qi + 1}</span><span className="ldc-q-type">{qTypeLabel(qq.questionType)}</span><span className="ldc-q-title">{qTitleOf(qq)}</span>{stq !== "none" ? <span className={`ldc-chip ${apprCls(stq)}`}>{stq}</span> : null}</div>
                                      {opts.length ? <ul className="ldc-q-opts">{opts.map((o, oi) => { const txt = typeof o === "string" ? o : (o?.text || o?.option || o?.value || JSON.stringify(o)); const ok = correct.includes(oi) || correct.includes(txt) || (typeof o === "object" && (o?.isCorrect || o?.correct)); return <li key={oi} className={ok ? "ok" : ""}>{ok ? "✓ " : ""}{txt}</li>; })}</ul> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
        </main>

        <aside className="lcx-right">
          <div className="lcx-panel">
            <div className="lcx-panel-h">Cohort progress</div>
            <div className="lcx-ring"><Ring pct={cohort} /><div className="lcx-ringcap"><b>{pct(cohort)}</b><span>completed</span></div></div>
            <div className="lcx-rstats">
              <div className="lcx-rstat"><span>Total resources</span><b>{nAll}</b></div>
              <div className="lcx-rstat"><span>Students completed</span><b>{completedS}</b></div>
              <div className="lcx-rstat"><span>Yet to finish</span><b>{remainingS}</b></div>
              {active.duration ? <div className="lcx-rstat"><span>Course length</span><b>{active.duration}</b></div> : null}
            </div>
          </div>
          <div className="lcx-panel">
            <div className="lcx-panel-h">Recently updated</div>
            {recent.length === 0 ? <div className="lcx-mempty">No update dates recorded.</div> : recent.map((r: CItem, i: number) => (
              <div className="lcx-act" key={i}><span className={`lcx-act-ic ${stageCls(r.stage)}`}><FileText size={14} /></span><div className="lcx-act-b"><b>{r.name}</b><small><span className={`lcx-sb ${stageCls(r.stage)}`}>{r.stage}</span> · {relDate(r.updated)}</small></div></div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

/* ───────── Approval Queue ───────── */
function QueueView() {
  const { loading, error, data } = useData(`/approvals/pending`, (j) => (Array.isArray(j?.data) ? j.data : []) as any[]);
  const label = (t?: string) => (t === "You_Do" ? "Assessment" : t === "We_Do" ? "Assignment" : t || "—");
  return (
    <>
      <Head eyebrow="Approvals" title="Approval Queue" sub="Assessments and assignments waiting on you before students can see them." />
      <div className="ldc-list">
        <div className="ldc-list-h"><h2>Waiting on you</h2><span>{data ? data.length : 0} item{data && data.length === 1 ? "" : "s"}</span></div>
        {loading && <Loading />}
        {!loading && error && <ErrBox m={error} />}
        {!loading && !error && data && data.length === 0 && <div className="ldc-empty"><b>Nothing waiting on you</b><span>Items appear when they reach your step in a course’s approval chain.</span></div>}
        {!loading && !error && data && data.length > 0 && (
          <div className="ldc-scroll"><table>
            <thead><tr><th>Item</th><th>Type</th><th>Category</th><th>Step</th></tr></thead>
            <tbody>{data.map((it, i) => (
              <tr key={i}><td><b>{it.exerciseName || "Untitled"}</b></td><td>{label(it.tabType)}</td><td>{it.subcategory || "—"}</td>
                <td>{(it.currentStep || 1)} of {(it.totalSteps || 1)}{it.step?.roleName ? ` · ${it.step.roleName}` : ""}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

/* ───────── Rules & Approvers ───────── */
function RulesView() {
  const { loading, error, data } = useData(`/courses-structure/getAll`, (j) => (Array.isArray(j?.data) ? j.data : []) as any[]);
  const [modalCourse, setModalCourse] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    (data || []).forEach((c) => { const k = c.clientName || "Unassigned client"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);
  return (
    <>
      <Head eyebrow="Approvals" title="Approval Rules" sub="You decide whether each course needs approval and how deep — Admin sets who approves." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && grouped.map(([client, list]) => (
        <div key={client} style={{ marginBottom: 18 }}>
          <div className="ldc-group-h">{client} <span>{list.length} course{list.length === 1 ? "" : "s"}</span></div>
          <div className="ldc-list"><div className="ldc-scroll"><table><tbody>
            {list.map((c) => (
              <tr key={c._id}><td><b>{c.courseName || "Untitled"}</b><small>{c.courseCode || "—"}</small></td>
                <td className="r"><button className="ldc-link" onClick={() => setModalCourse(c._id)}>Set approvers →</button></td></tr>
            ))}
          </tbody></table></div></div>
        </div>
      ))}
      <Note>Admin sets who approves per course. Whether a course needs approval is set on the assessment (coming with assessment setup).</Note>
      <ApprovalHierarchyModal open={!!modalCourse} courseId={modalCourse || ""} onClose={() => setModalCourse(null)} />
    </>
  );
}

/* ───────── Course Insight ───────── */
function CoursesView() {
  const { loading, error, data } = useData(`/courses-structure/getAll`, (j) => (Array.isArray(j?.data) ? j.data : []) as any[]);
  const rows = (data || []).map((c) => {
    const batches = Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : [];
    const students = batches.reduce((s: number, b: any) =>
      s + (Array.isArray(b.users) ? b.users.filter((u: any) => roleName(u.user?.role).toLowerCase().includes("student") || (!roleName(u.user?.role))).length : 0), 0);
    return { name: c.courseName || "Untitled", code: c.courseCode || "—", client: c.clientName || "—",
      batches: batches.length, students: n(c.participantCount) || students, modules: n(c.moduleCount) };
  });
  return (
    <>
      <Head eyebrow="Course Insight" title="Courses" sub="Every course you run, with its client, batches, students and structure." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>All courses</h2><span>{rows.length} course{rows.length === 1 ? "" : "s"}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Course</th><th>Client</th><th className="r">Batches</th><th className="r">Students</th><th className="r">Modules</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (<tr key={i}><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.client}</td>
                <td className="r">{r.batches}</td><td className="r">{r.students}</td><td className="r">{r.modules}</td></tr>))}
              {rows.length === 0 && <tr><td colSpan={5} className="ldc-empty">No courses found.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

/* ───────── Schedule ───────── */
function ScheduleView() {
  const { loading, error, data } = useData(`/program-calendar/getAll`, (j) => {
    const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
    return arr as any[];
  });
  const rows = (data || []).map((c) => ({
    name: c.courseName || c.courseDetails?.courseName || "Untitled", code: c.courseCode || "—",
    start: c.startDate ? new Date(c.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
    end: c.endDate ? new Date(c.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "computed",
    status: c.status || "—",
  }));
  return (
    <>
      <Head eyebrow="Schedule" title="Training Calendar" sub="Published program calendars and their status across your courses." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Program calendars</h2><span>{rows.length}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Course</th><th>Starts</th><th>Ends</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (<tr key={i}><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.start}</td><td>{r.end}</td>
                <td><span className={`ldc-chip ${r.status === "published" ? "good" : "neutral"}`}>{r.status}</span></td></tr>))}
              {rows.length === 0 && <tr><td colSpan={4} className="ldc-empty">No published calendars yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
      <Note>Per-batch week grids and deviations open per course; the end date is computed from pedagogy hours, holidays and deviations.</Note>
    </>
  );
}

/* ───────── Trainers (derived from course rosters) ───────── */
function TrainersView() {
  const { loading, error, data } = useData(`/courses-structure/getAll`, (j) => (Array.isArray(j?.data) ? j.data : []) as any[]);
  const trainers = useMemo(() => {
    const map = new Map<string, { name: string; courses: Set<string>; batches: number }>();
    (data || []).forEach((c: any) => {
      (c.batchAndParticipants || []).forEach((b: any) => {
        (b.users || []).forEach((u: any) => {
          const rn = roleName(u.user?.role).toLowerCase();
          if (rn.includes("trainer") || rn.includes("faculty")) {
            const key = u.user?._id || u.user?.email || `${u.user?.firstName} ${u.user?.lastName}`;
            const label = `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.trim() || u.user?.email || "Trainer";
            if (!map.has(key)) map.set(key, { name: label, courses: new Set(), batches: 0 });
            const t = map.get(key)!; t.courses.add(c.courseName || c.courseCode || "course"); t.batches += 1;
          }
        });
      });
    });
    return Array.from(map.values());
  }, [data]);
  return (
    <>
      <Head eyebrow="Trainers" title="Trainer Allocation" sub="Which trainer is assigned to which courses and batches (from course rosters)." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Trainers</h2><span>{trainers.length}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Trainer</th><th className="r">Courses</th><th className="r">Batches</th><th>Teaches</th></tr></thead>
            <tbody>
              {trainers.map((t, i) => (<tr key={i}><td><b>{t.name}</b></td><td className="r">{t.courses.size}</td><td className="r">{t.batches}</td>
                <td>{Array.from(t.courses).slice(0, 3).join(", ")}{t.courses.size > 3 ? "…" : ""}</td></tr>))}
              {trainers.length === 0 && <tr><td colSpan={4} className="ldc-empty">No trainers found in course rosters.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
      <Note>Ratings and marking compliance per trainer need the trainer rollup endpoint — allocation above is live from batch membership.</Note>
    </>
  );
}

/* ───────── Student Performance ───────── */
function PerformanceView() {
  const { loading, error, data } = useData(`/analytics/staff/analytics/students`, (j) => {
    const d = j?.data ?? j ?? {}; const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    const rows: any[] = [];
    courses.forEach((c) => {
      const cn = c.course?.courseName || c.courseName || "Course";
      (Array.isArray(c.students) ? c.students : []).forEach((s: any) => {
        const st = s.student ?? s;
        rows.push({
          name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
          course: cn, progress: n(s.progress?.overall ?? s.overall ?? s.progress),
        });
      });
    });
    return rows;
  });
  const band = (p: number) => (p >= 85 ? ["good", "Excellent"] : p >= 60 ? ["good", "On track"] : p >= 40 ? ["warn", "Average"] : ["bad", "At risk"]);
  return (
    <>
      <Head eyebrow="Student Performance" title="Students" sub="Progress for every student across your courses." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Students</h2><span>{data.length}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((r, i) => { const [tone, txt] = band(r.progress); return (
                <tr key={i}><td><b>{r.name}</b></td><td>{r.course}</td>
                  <td><span className="ldc-bar"><i style={{ width: `${Math.min(100, r.progress)}%` }} /></span> {pct(r.progress)}</td>
                  <td><span className={`ldc-chip ${tone}`}>{txt}</span></td></tr>); })}
              {data.length === 0 && <tr><td colSpan={4} className="ldc-empty">No student data yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

/* ───────── Attendance ───────── */
/* ───────── Attendance (Overview · Report · Analytics), scoped to top filter ───────── */
const attBand = (p: number): string => (p >= 75 ? "good" : p >= 50 ? "warn" : "bad");

// Roster + raw records for one course → per-student and class attendance stats.
function useCourseAttendance(courseId: string) {
  const [s, setS] = useState<{ loading: boolean; error: string; courseName: string; clientName: string; students: any[]; records: any[] }>(
    { loading: true, error: "", courseName: "", clientName: "", students: [], records: [] }
  );
  useEffect(() => {
    if (!courseId || courseId === "all") { setS({ loading: false, error: "", courseName: "", clientName: "", students: [], records: [] }); return; }
    let on = true; setS((p) => ({ ...p, loading: true, error: "" }));
    (async () => {
      try {
        const [rc, rec] = await Promise.all([authGet(`/getAll/courses-data/${courseId}`), authGet(`/attendance/get/${courseId}`)]);
        const cd = rc?.data ?? rc ?? {};
        const seen = new Set<string>(); const students: any[] = [];
        (cd.batchAndParticipants || []).forEach((b: any) => (b.users || []).forEach((u: any) => {
          const su = u.user || u; const id = String(su._id || u._id || "");
          if (id && !seen.has(id)) { seen.add(id); students.push({ id, name: `${su.firstName || ""} ${su.lastName || ""}`.trim() || su.email || "Student", email: su.email || "", batch: b.batchName || b.name || "" }); }
        }));
        const records = Array.isArray(rec?.data) ? rec.data : Array.isArray(rec) ? rec : [];
        if (on) setS({ loading: false, error: "", courseName: cd.courseName || "", clientName: cd.clientName || "", students, records });
      } catch (e) { if (on) setS({ loading: false, error: e instanceof Error ? e.message : "Could not load attendance", courseName: "", clientName: "", students: [], records: [] }); }
    })();
    return () => { on = false; };
  }, [courseId]);
  return s;
}

function computeAtt(students: any[], records: any[]) {
  const map = new Map<string, Record<string, string>>(); const dates = new Set<string>();
  records.forEach((r) => { const sid = String(r.studentId || ""); const dk = String(r.date || "").slice(0, 10); if (!sid || !dk) return; dates.add(dk); if (!map.has(sid)) map.set(sid, {}); map.get(sid)![dk] = r.status; });
  const sessions = dates.size;
  const per = students.map((s) => {
    const m = map.get(s.id) || {}; let P = 0, A = 0, H = 0;
    Object.values(m).forEach((v) => { if (v === "P") P++; else if (v === "A") A++; else if (v === "H") H++; });
    const eff = P + H * 0.5; const pct = sessions > 0 ? Math.round((eff / sessions) * 100) : 0;
    return { ...s, P, A, H, marked: P + A + H, pct };
  }).sort((a, b) => a.pct - b.pct);
  const sum = (k: "P" | "A" | "H") => per.reduce((s, x) => s + x[k], 0);
  const P = sum("P"), A = sum("A"), H = sum("H");
  const totalCells = students.length * sessions; const N = Math.max(0, totalCells - (P + A + H));
  const avgPct = per.length ? Math.round(per.reduce((s, x) => s + x.pct, 0) / per.length) : 0;
  const atRisk = per.filter((x) => x.pct < 75).length;
  let best: { dk: string; ratio: number } | null = null;
  dates.forEach((dk) => { let pr = 0; per.forEach((s) => { const v = (map.get(s.id) || {})[dk]; if (v === "P") pr++; else if (v === "H") pr += 0.5; }); const ratio = students.length ? (pr / students.length) * 100 : 0; if (!best || ratio > best.ratio) best = { dk, ratio }; });
  return { sessions, per, P, A, H, N, totalCells, avgPct, atRisk, best: best as { dk: string; ratio: number } | null };
}

// Portfolio attendance-health scan — only shown when NO single course is
// selected. Surfaces courses that need attention (in delivery but attendance
// not yet marked today) first, so the L&D Head can spot a gap and drill in.
function AttPortfolio({ filter }: { filter: { courseIds: Set<string> | null; clientOf: (id: string) => string | undefined } }) {
  const today = new Date().toISOString().slice(0, 10);
  const { loading, error, data } = useData(`/attendance/overview?date=${today}`, (j) => {
    const d = j?.data ?? j ?? {}; return (Array.isArray(d.courses) ? d.courses : Array.isArray(d) ? d : Array.isArray(j?.data) ? j.data : []) as any[];
  });
  const { courseIds, clientOf } = filter;
  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  if (loading) return <Loading />;
  if (error) return <ErrBox m={error} />;
  const rows = (data || []).filter((c: any) => inClient(String(c._id))).map((c: any) => {
    const total = Array.isArray(c.batches) ? c.batches.length : 0;
    const marked = Array.isArray(c.batches) ? c.batches.filter((b: any) => b.markedToday).length : 0;
    const inDelivery = !!c.hasSchedule;
    const rank = !inDelivery || total === 0 ? 3 : marked === 0 ? 0 : marked < total ? 1 : 2; // pending-first
    return { ...c, total, marked, inDelivery, rank };
  }).sort((a: any, b: any) => a.rank - b.rank || (n(b.totalStudents) - n(a.totalStudents)));
  const deliv = rows.filter((r: any) => r.inDelivery && r.total > 0);
  const fully = deliv.filter((r: any) => r.marked === r.total).length;
  const pending = deliv.filter((r: any) => r.marked < r.total).length;
  return (
    <>
      <div className="ldc-daysum">
        <span className="ldc-dchip neutral">{deliv.length} in delivery</span>
        <span className="ldc-dchip good">{fully} fully marked today</span>
        <span className="ldc-dchip bad">{pending} pending today</span>
      </div>
      <div className="ldc-list ldc-sec">
        <div className="ldc-list-h"><h2>Attendance status · today</h2><span>{rows.length} course{rows.length === 1 ? "" : "s"}</span></div>
        {rows.length === 0 ? (
          <div className="ldc-empty"><b>No courses in this view</b><span>Nothing for the current Client filter.</span></div>
        ) : (
          <div className="ldc-scroll"><table>
            <thead><tr><th>Course</th><th>Client</th><th className="r">Enrolled</th><th>Training window</th><th>Today</th></tr></thead>
            <tbody>{rows.map((c: any, i: number) => {
              const win = c.inDelivery ? `${c.trainingStart || "—"} → ${c.trainingEnd || "…"}` : "No calendar";
              return (<tr key={i}><td><b>{c.courseName || "Course"}</b><small>{c.courseCode || "—"}</small></td>
                <td>{clientOf(String(c._id)) || c.clientName || "—"}</td>
                <td className="r">{n(c.totalStudents)}</td>
                <td><small className="mut">{win}</small></td>
                <td><span className={`ldc-chip ${!c.inDelivery ? "neutral" : c.total && c.marked === c.total ? "good" : c.marked > 0 ? "warn" : "bad"}`}>{!c.inDelivery ? "not scheduled" : c.total ? (c.marked === c.total ? "marked" : c.marked > 0 ? `${c.marked}/${c.total} marked` : "not marked") : "—"}</span></td></tr>);
            })}</tbody>
          </table></div>
        )}
      </div>
      <p className="ldc-note">Pick a course in the <b>Course</b> filter above to open its daily register, per-student summary and analytics.</p>
    </>
  );
}

// ── date + status helpers ──
const addDayKey = (dk: string, nd: number): string => {
  const [y, m, d] = dk.split("-").map(Number);
  const t = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  t.setUTCDate(t.getUTCDate() + nd);
  return t.toISOString().slice(0, 10);
};
const shortDate = (dk: string): string => {
  const [, m, d] = dk.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m || 1) - 1];
  return `${String(d || 1).padStart(2, "0")} ${mon}`;
};
const ST: Record<string, [string, string]> = { P: ["good", "Present"], A: ["bad", "Absent"], H: ["warn", "Half day"], N: ["neutral", "Not marked"] };

type AttState = {
  mode: "single" | "range"; day: string; from: string; to: string;
  statusF: string; batchF: string; q: string;
  setMode: (v: "single" | "range") => void; setDay: (v: string) => void;
  setFrom: (v: string) => void; setTo: (v: string) => void;
  setStatusF: (v: string) => void; setBatchF: (v: string) => void; setQ: (v: string) => void;
};

function AttFilters({ s, batches, showStatus }: { s: AttState; batches: string[]; showStatus: boolean }) {
  return (
    <div className="ldc-filters">
      {showStatus ? (
        <select className="ldc-mini" value={s.statusF} onChange={(e) => s.setStatusF(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="P">Present</option>
          <option value="A">Absent</option>
          <option value="H">Half day</option>
          <option value="N">Not marked</option>
        </select>
      ) : null}
      {batches.length > 1 ? (
        <select className="ldc-mini" value={s.batchF} onChange={(e) => s.setBatchF(e.target.value)}>
          <option value="all">All batches</option>
          {batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      ) : null}
      <input className="ldc-mini ldc-search" placeholder="Search student…" value={s.q} onChange={(e) => s.setQ(e.target.value)} />
    </div>
  );
}

// Daily register (single day) OR student×date matrix (range).
function AttRegister({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const { students, records } = att;
  const match = (r: any) => (s.batchF === "all" || r.batch === s.batchF) && (!s.q || r.name.toLowerCase().includes(s.q.toLowerCase()));

  if (s.mode === "single") {
    const dmap = new Map<string, any>();
    records.forEach((r) => { if (String(r.date || "").slice(0, 10) === s.day) dmap.set(String(r.studentId), r); });
    const withStatus = students.map((st) => { const r = dmap.get(st.id); return { ...st, status: r?.status || "N", reason: r?.reason || "" }; });
    const counts = { P: 0, A: 0, H: 0, N: 0 } as Record<string, number>;
    withStatus.forEach((r) => { counts[r.status]++; });
    const rows = withStatus.filter((r) => (s.statusF === "all" || r.status === s.statusF) && match(r));
    return (
      <div className="ldc-list ldc-sec ldc-listfill">
        <div className="ldc-list-h">
          <h2>Register · {s.day ? shortDate(s.day) : "—"}</h2>
          <div className="ldc-daysum">
            <span className="ldc-dchip good">{counts.P} present</span>
            <span className="ldc-dchip bad">{counts.A} absent</span>
            <span className="ldc-dchip warn">{counts.H} half-day</span>
            <span className="ldc-dchip neutral">{counts.N} not marked</span>
          </div>
        </div>
        {students.length === 0 ? <div className="ldc-empty">No students on the roster.</div> : (
            <div className="ldc-scroll"><table>
              <thead><tr><th>Student</th><th>Status</th><th>Reason</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i}><td><b>{r.name}</b>{r.batch ? <small>{r.batch}</small> : null}</td>
                  <td><span className={`ldc-chip ${ST[r.status][0]}`}>{ST[r.status][1]}</span></td>
                  <td>{r.reason ? <small className="mut">{r.reason}</small> : <small className="mut">—</small>}</td></tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="ldc-empty">No students match these filters on this day.</td></tr>}
              </tbody>
            </table></div>
          )}
      </div>
    );
  }

  // range matrix
  const cols = Array.from(new Set(records.map((r) => String(r.date || "").slice(0, 10)).filter((dk) => dk && dk >= s.from && dk <= s.to))).sort();
  const map = new Map<string, Record<string, { st: string; reason: string }>>();
  records.forEach((r) => { const dk = String(r.date || "").slice(0, 10); if (!(dk >= s.from && dk <= s.to)) return; const sid = String(r.studentId); if (!map.has(sid)) map.set(sid, {}); map.get(sid)![dk] = { st: r.status, reason: r.reason || "" }; });
  const rows = students.filter(match);
  return (
    <div className="ldc-list ldc-sec ldc-listfill">
      <div className="ldc-list-h"><h2>Register grid · {s.from ? shortDate(s.from) : "—"} → {s.to ? shortDate(s.to) : "—"}</h2><span>{cols.length} day{cols.length === 1 ? "" : "s"} · {rows.length} students</span></div>
      {cols.length === 0 ? <div className="ldc-empty">No sessions in this date range.</div> : (
        <div className="ldc-scroll"><table className="ldc-mx">
          <thead><tr><th className="stick">Student</th>{cols.map((dk) => <th key={dk} className="c">{shortDate(dk)}</th>)}</tr></thead>
          <tbody>{rows.map((st, i) => (
            <tr key={i}><td className="stick"><b>{st.name}</b></td>
              {cols.map((dk) => { const cell = (map.get(st.id) || {})[dk]; const v = cell?.st; const title = v ? `${shortDate(dk)} · ${ST[v][1]}${cell.reason ? ` — ${cell.reason}` : ""}` : `${shortDate(dk)} · Not marked`; return <td key={dk} className="c"><span className={`ldc-mxc ${v ? ST[v][0] : "none"}`} title={title}>{v || "·"}</span></td>; })}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function AttSummary({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const inRange = (r: any) => { const dk = String(r.date || "").slice(0, 10); return dk >= s.from && dk <= s.to; };
  const c = computeAtt(att.students, att.records.filter(inRange));
  const rows = c.per.filter((r) => (s.batchF === "all" || r.batch === s.batchF) && (!s.q || r.name.toLowerCase().includes(s.q.toLowerCase())));
  // No sessions in range → don't render tiles that would read "0% · everyone at risk".
  if (c.sessions === 0) return <div className="ldc-empty"><b>No sessions in this range</b><span>No attendance was marked between the selected dates — widen the range above.</span></div>;
  return (
    <>
      <div className="ldc-strip">
        <div className="ldc-s"><span className="k">Avg attendance</span><b>{c.avgPct}%</b><i>across {att.students.length} student{att.students.length === 1 ? "" : "s"}</i></div>
        <div className="ldc-s"><span className="k">Students</span><b>{att.students.length}</b><i>{c.sessions} session{c.sessions === 1 ? "" : "s"} in range</i></div>
        <div className="ldc-s"><span className="k">Present marks</span><b>{c.P.toLocaleString()}</b><i>+ {c.H} half-day{c.H === 1 ? "" : "s"}</i></div>
        <div className="ldc-s"><span className="k">Below 75%</span><b className={c.atRisk ? "bad" : ""}>{c.atRisk}</b><i>{c.atRisk ? "attendance at risk" : "all above 75%"}</i></div>
      </div>
      <div className="ldc-list ldc-listfill">
        <div className="ldc-list-h"><h2>Attendance by student</h2><span>{rows.length} · lowest first</span></div>
        {c.sessions === 0 ? <div className="ldc-empty">No attendance marked in this date range.</div> : (
          <div className="ldc-scroll"><table>
            <thead><tr><th>Student</th><th className="r">Present</th><th className="r">Absent</th><th className="r">Half</th><th>Attendance</th></tr></thead>
            <tbody>{rows.map((st, i) => (
              <tr key={i}><td><b>{st.name}</b>{st.batch ? <small>{st.batch}</small> : null}</td>
                <td className="r">{st.P}</td><td className="r">{st.A}</td><td className="r">{st.H}</td>
                <td><span className="ldc-compbar"><i className={attBand(st.pct)} style={{ width: `${Math.max(2, Math.min(100, st.pct))}%` }} /></span> <b className="pctv">{st.pct}%</b></td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="ldc-empty">No students match these filters.</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function AttAnalyticsTab({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const inRange = (r: any) => { const dk = String(r.date || "").slice(0, 10); return dk >= s.from && dk <= s.to; };
  const c = computeAtt(att.students, att.records.filter(inRange));
  if (c.sessions === 0) return <div className="ldc-empty"><b>No sessions in range</b><span>No attendance was marked between the selected dates.</span></div>;
  const tot = c.totalCells || 1;
  const seg = [
    { label: "Present", c: "var(--good)", n: c.P }, { label: "Half-day", c: "var(--warn)", n: c.H },
    { label: "Absent", c: "var(--bad)", n: c.A }, { label: "Not marked", c: "#C9C1B8", n: c.N },
  ];
  return (
    <>
      <div className="ldc-strip">
        <div className="ldc-s"><span className="k">Avg attendance</span><b>{c.avgPct}%</b><i>{att.students.length} students · {c.sessions} sessions</i></div>
        <div className="ldc-s"><span className="k">Present rate</span><b>{Math.round(((c.P + c.H * 0.5) / tot) * 100)}%</b><i>{c.P + c.H} of {tot} marks</i></div>
        <div className="ldc-s"><span className="k">Sessions held</span><b>{c.sessions}</b><i>{c.totalCells} attendance cells</i></div>
        <div className="ldc-s"><span className="k">Below 75%</span><b className={c.atRisk ? "bad" : ""}>{c.atRisk}</b><i>of {att.students.length} students</i></div>
      </div>
      <div className="ldc-grid2 ldc-gap16 ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Attendance breakdown</h2><span>{tot} marks</span></div>
          <div className="ldc-stack">{seg.map((b) => b.n > 0 ? <i key={b.label} title={`${b.label} ${b.n}`} style={{ width: `${(b.n / tot) * 100}%`, background: b.c }} /> : null)}</div>
          <div className="ldc-distrows">{seg.map((b) => (
            <div className="ldc-distrow" key={b.label}><span className="dot" style={{ background: b.c }} /><span className="lb">{b.label}</span><span className="ct">{b.n.toLocaleString()}</span><span className="sh">{Math.round((b.n / tot) * 100)}%</span></div>
          ))}</div>
        </div>
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Highlights</h2></div>
          <div className="ldc-distrows">
            <div className="ldc-distrow"><span className="lb">Best-attended day</span><span className="sh" style={{ flexBasis: "auto", color: "var(--ink)", fontWeight: 700 }}>{c.best ? `${shortDate(c.best.dk)} · ${Math.round(c.best.ratio)}%` : "—"}</span></div>
            <div className="ldc-distrow"><span className="lb">Students at risk (&lt;75%)</span><span className="sh" style={{ flexBasis: "auto", color: c.atRisk ? "var(--bad)" : "var(--good-ink)", fontWeight: 700 }}>{c.atRisk}</span></div>
            <div className="ldc-distrow"><span className="lb">Fully present students</span><span className="sh" style={{ flexBasis: "auto", color: "var(--ink)", fontWeight: 700 }}>{c.per.filter((x) => x.pct >= 100).length}</span></div>
          </div>
          <p className="ldc-note">Attendance % = (present + half-day×0.5) ÷ sessions held. “Not marked” = days with no record for that student.</p>
        </div>
      </div>
    </>
  );
}

function AttendanceView({ filter }: { filter: { client: string; course: string; courseIds: Set<string> | null; clientOf: (id: string) => string | undefined } }) {
  const [tab, setTab] = useState<"register" | "summary" | "analytics">("register");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [day, setDay] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [statusF, setStatusF] = useState("all"); const [batchF, setBatchF] = useState("all"); const [q, setQ] = useState("");
  const att = useCourseAttendance(filter.course);

  // distinct session dates from the loaded records
  const dates = useMemo(() => Array.from(new Set((att.records || []).map((r: any) => String(r.date || "").slice(0, 10)).filter(Boolean))).sort(), [att.records]);
  // reset date + filters when the course changes (a new course has different
  // dates and batches), then seed date defaults once dates load
  useEffect(() => { setDay(""); setFrom(""); setTo(""); setStatusF("all"); setBatchF("all"); setQ(""); }, [filter.course]);
  useEffect(() => {
    if (!dates.length) return;
    setDay((d) => d || dates[dates.length - 1]);
    setFrom((f) => f || dates[0]);
    setTo((t) => t || dates[dates.length - 1]);
  }, [dates]);

  const batches = useMemo(() => Array.from(new Set((att.students || []).map((s: any) => s.batch).filter(Boolean))).sort(), [att.students]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const s: AttState = { mode, day, from, to, statusF, batchF, q, setMode, setDay, setFrom, setTo, setStatusF, setBatchF, setQ };

  const noCourse = filter.course === "all";
  const TABS: { k: "register" | "summary" | "analytics"; label: string }[] = [
    { k: "register", label: "Register" }, { k: "summary", label: "Summary" }, { k: "analytics", label: "Analytics" },
  ];
  const ready = !att.loading && !att.error && att.students.length > 0;
  const atToday = !!day && day >= todayKey;

  // No course chosen → portfolio attendance-health scan (not a course picker).
  if (noCourse) {
    return (
      <>
        <Head eyebrow="" title="Attendance" />
        <AttPortfolio filter={filter} />
      </>
    );
  }

  return (
    <div className="ldc-attfill">
      <Head eyebrow="" title="Attendance" />

      <div className="ldc-cbar">
        <div className="ldc-tabs">
          {TABS.map((t) => <button key={t.k} type="button" className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>{t.label}</button>)}
        </div>
      </div>

      {ready ? (
        <div className="ldc-attctl">
          <div className="ldc-seg sm">
            <button type="button" className={mode === "single" ? "on" : ""} onClick={() => setMode("single")}>Single day</button>
            <button type="button" className={mode === "range" ? "on" : ""} onClick={() => setMode("range")}>Date range</button>
          </div>
          {mode === "single" ? (
            <div className="ldc-daynav">
              <button type="button" className="ldc-navbtn" title="Previous day" onClick={() => day && setDay(addDayKey(day, -1))}>‹</button>
              <input type="date" className="ldc-mini" value={day} max={todayKey} onChange={(e) => setDay(e.target.value)} />
              <button type="button" className="ldc-navbtn" title="Next day" disabled={atToday} onClick={() => day && !atToday && setDay(addDayKey(day, 1))}>›</button>
              <button type="button" className="ldc-mini ldc-todaybtn" onClick={() => setDay(todayKey)}>Today</button>
            </div>
          ) : (
            <div className="ldc-daynav">
              <span className="ldc-rlab">From</span><input type="date" className="ldc-mini" value={from} max={to || todayKey} onChange={(e) => setFrom(e.target.value)} />
              <span className="ldc-rlab">To</span><input type="date" className="ldc-mini" value={to} min={from} max={todayKey} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
          {(tab === "register" || tab === "summary") ? <AttFilters s={s} batches={batches} showStatus={tab === "register" && mode === "single"} /> : null}
        </div>
      ) : null}

      {att.loading ? <Loading />
        : att.error ? <ErrBox m={att.error} />
          : att.students.length === 0 ? <div className="ldc-empty"><b>No roster</b><span>No students enrolled in {att.courseName || "this course"} yet.</span></div>
            : tab === "register" ? <AttRegister att={att} s={s} />
              : tab === "summary" ? <AttSummary att={att} s={s} />
                : <AttAnalyticsTab att={att} s={s} />}
    </div>
  );
}

/* ───────── Feedback ───────── */
function FeedbackView() {
  const { loading, error, data } = useData(`/courses-structure/getAll`, (j) => (Array.isArray(j?.data) ? j.data : []) as any[]);
  return (
    <>
      <Head eyebrow="Feedback" title="Feedback" sub="Student feedback by course — ratings, response rates and comments." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Feedback by course</h2><span>{data.length}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Course</th><th>Client</th><th>Feedback</th></tr></thead>
            <tbody>{data.map((c: any, i: number) => (
              <tr key={i}><td><b>{c.courseName || "Untitled"}</b><small>{c.courseCode || "—"}</small></td><td>{c.clientName || "—"}</td>
                <td><a className="ldc-link" href={`/lms/pages/coursestructure/feedback?courseId=${c._id}`}>Open feedback →</a></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      <Note>Per-course feedback (ratings, parameters, comments) opens in the existing feedback screen. A cross-course parameter rollup is the next endpoint.</Note>
    </>
  );
}

/* ───────── Reports ───────── */
function ReportsView() {
  const items = [
    ["Courses delivered", true], ["Schedule & deviations", true], ["Attendance by batch", true],
    ["Results & pass rates", true], ["Student feedback", true], ["Study time", true],
    ["Certificates issued", false], ["Cost per student", false],
  ] as [string, boolean][];
  return (
    <>
      <Head eyebrow="Reporting" title="Client Report" sub="Assemble the review document for your client." />
      <div className="ldc-two">
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>What to include</h2></div>
          <div style={{ padding: "12px 15px", display: "grid", gap: 8 }}>
            {items.map(([label, on], i) => (
              <div key={i} className="ldc-check"><span className={`ldc-box ${on ? "" : "off"}`}>{on ? "✓" : ""}</span>{label}{!on && <small> — not tracked yet</small>}</div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="ldc-btn go">Download PDF</button>
              <button className="ldc-btn">Download Excel</button>
            </div>
          </div>
        </div>
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Evaluation levels</h2></div>
          <div style={{ padding: "12px 15px", display: "grid", gap: 10, fontSize: 12.5 }}>
            <div><b>Reaction</b> — feedback. <span className="ldc-chip good">Strong</span></div>
            <div><b>Learning</b> — scores, pass rates. <span className="ldc-chip good">Strong</span></div>
            <div><b>Behaviour</b> — on-the-job. <span className="ldc-chip neutral">No data</span></div>
            <div><b>Results</b> — ROI, cost. <span className="ldc-chip neutral">No data</span></div>
          </div>
        </div>
      </div>
      <Note>Scheduled/emailed delivery and client branding on the export are the next reporting steps.</Note>
    </>
  );
}

/* ───────── Profile ───────── */
function ProfileView() {
  const [u, setU] = useState<any>(null);
  useEffect(() => {
    try { setU(JSON.parse(localStorage.getItem("smartcliff_userData") || "null")); } catch { setU(null); }
  }, []);
  const perms: any[] = Array.isArray(u?.permissions) ? u.permissions : [];
  return (
    <>
      <Head eyebrow="Account" title="Profile & Access" sub="Your role and the modules this role opens." />
      <div className="ldc-list">
        <div className="ldc-list-h"><h2>Account</h2></div>
        <div style={{ padding: "12px 15px", fontSize: 13 }}>
          <div><b>{`${u?.firstName || "L&D"} ${u?.lastName || "Head"}`}</b></div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{u?.email || "l&d@gmail.com"} · role {roleName(u?.role) || "L&D"}</div>
        </div>
      </div>
      <div className="ldc-list">
        <div className="ldc-list-h"><h2>Module access</h2><span>{perms.length}</span></div>
        <div className="ldc-scroll"><table>
          <thead><tr><th>Module</th><th>Key</th><th>State</th></tr></thead>
          <tbody>{perms.map((p, i) => (
            <tr key={i}><td><b>{p.permissionName}</b></td><td><small>{p.permissionKey}</small></td>
              <td><span className={`ldc-chip ${p.isActive ? "good" : "neutral"}`}>{p.isActive ? "Active" : "Off"}</span></td></tr>
          ))}
          {perms.length === 0 && <tr><td colSpan={3} className="ldc-empty">Sign in as the L&D user to see modules.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

/* ───────── Results & Assessments (Student Performance sub-view) ───────── */
function ResultsView() {
  const { loading, error, data } = useData(`/analytics/staff/analytics/students`, (j) => {
    const d = j?.data ?? j ?? {}; const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    return courses.map((c) => {
      const co = c.course ?? {}; const s = c.stats ?? {};
      const total = n(s.totalStudents ?? co.totalStudents);
      const done = n(s.completedStudents);
      return { name: co.courseName || c.courseName || "Untitled", code: co.courseCode || "—",
        total, done, prog: n(s.inProgressStudents), not: n(s.notStartedStudents),
        rate: total ? Math.round((done / total) * 100) : 0 };
    });
  });
  return (
    <>
      <Head eyebrow="Student Performance" title="Results & Assessments" sub="Completion and pass rates per course, from live progress data." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <div className="ldc-list">
          <div className="ldc-list-h"><h2>Results by course</h2><span>{data.length}</span></div>
          <div className="ldc-scroll"><table>
            <thead><tr><th>Course</th><th className="r">Students</th><th className="r">Completed</th><th className="r">In prog.</th><th className="r">Not started</th><th>Completion</th></tr></thead>
            <tbody>
              {data.map((r, i) => (<tr key={i}><td><b>{r.name}</b><small>{r.code}</small></td>
                <td className="r">{r.total}</td><td className="r">{r.done}</td><td className="r">{r.prog}</td><td className="r">{r.not}</td>
                <td><span className="ldc-bar"><i style={{ width: `${Math.min(100, r.rate)}%` }} /></span> {r.rate}%</td></tr>))}
              {data.length === 0 && <tr><td colSpan={6} className="ldc-empty">No results data yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
      <Note>Per-exercise pass rates against configured pass marks and assessment integrity flags need the results rollup endpoint — completion above is live.</Note>
    </>
  );
}

/* ───────── Ratings Analysis (Feedback sub-view) ───────── */
function RatingsView() {
  return (
    <>
      <Head eyebrow="Feedback" title="Ratings Analysis" sub="Which aspects of delivery are rated weakest, for which trainer, and with how much evidence." />
      <div className="ldc-list"><div className="ldc-empty">
        <b>Needs the feedback rollup endpoint</b>
        <span>Per-course feedback (ratings, parameters) exists today in the feedback screen. The cross-course parameter matrix by trainer is the next endpoint to build — it will render here in this shell.</span>
      </div></div>
    </>
  );
}

/* ───────── Comments & Trends (Feedback sub-view) ───────── */
function CommentsView() {
  return (
    <>
      <Head eyebrow="Feedback" title="Comments & Trends" sub="What students wrote, grouped into themes, and how ratings moved across a course." />
      <div className="ldc-list"><div className="ldc-empty">
        <b>Needs the feedback rollup endpoint</b>
        <span>Verbatim theming and Beginning → Mid → End trend comparison aggregate across forms; that rollup is the next endpoint. Individual form comments are available in the feedback screen today.</span>
      </div></div>
    </>
  );
}

export default function LDConsole() {
  const view = useHashView();
  const [client, setClient] = useState("all");
  const [course, setCourse] = useState("all");
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const j = await authGet(`/courses-structure/getAll`);
        const list: CourseOpt[] = (Array.isArray(j?.data) ? j.data : []).map((c: any) => ({
          id: String(c._id), name: c.courseName || "Untitled", client: c.clientName || "Unassigned",
        }));
        if (on) setCourses(list);
      } catch { /* options stay empty */ }
    })();
    return () => { on = false; };
  }, []);
  const clients = useMemo(() => Array.from(new Set(courses.map((c) => c.client).filter(Boolean))).sort(), [courses]);
  const courseOpts = useMemo(() => (client === "all" ? courses : courses.filter((c) => c.client === client)), [courses, client]);
  // IDs of the selected client's courses (null = all clients). The dashboard
  // matches analytics rows by ID against this set — see DashboardView.
  const clientCourseIds = useMemo(
    () => (client === "all" ? null : new Set(courses.filter((c) => c.client === client).map((c) => c.id))),
    [courses, client]
  );
  // Authoritative course-id → client name (from getAll). The analytics endpoint
  // often returns an empty clientName, so the dashboard labels courses via this.
  const clientById = useMemo(() => new Map(courses.map((c) => [c.id, c.client])), [courses]);
  const clientOf = useMemo(() => (id: string) => clientById.get(id), [clientById]);
  const filter = {
    client, course, clients, courseOpts,
    onClient: (v: string) => { setClient(v); setCourse("all"); },
    onCourse: (v: string) => setCourse(v),
  };

  const body: ReactNode =
    view === "dashboard" ? <DashboardView filter={{ client, course, courseIds: clientCourseIds, clientOf, onReset: () => { setClient("all"); setCourse("all"); } }} /> :
    view === "appr-queue" ? <QueueView /> :
    view === "appr-rules" ? <RulesView /> :
    view === "courses" ? <CoursesView /> :
    view === "content" ? <ContentView filter={{ course, courseIds: clientCourseIds, clientOf }} /> :
    view === "schedule" ? <ScheduleView /> :
    view === "trainers" ? <TrainersView /> :
    view === "attendance" ? <AttendanceView filter={{ client, course, courseIds: clientCourseIds, clientOf }} /> :
    view === "perf-progress" ? <PerformanceView /> :
    view === "perf-results" ? <ResultsView /> :
    view === "fb-summary" ? <FeedbackView /> :
    view === "reports" ? <ReportsView /> :
    <ProfileView />;
  return (
    <LDLayout active={view} filter={filter}>
      <style>{LDC_CSS}</style>
      {body}
    </LDLayout>
  );
}

const LDC_CSS = `
.ldc-head{margin-bottom:16px;}
.ldc-head.nosub{margin-bottom:9px;}
.ldc-eyebrow{font-size:10px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; color:var(--accent-ink);}
.ldc-head h1{margin:4px 0 0; font-size:17px; font-weight:700; letter-spacing:-.02em;}
.ldc-bars{display:grid; gap:1px;}
.ldc-head p{margin:3px 0 0; font-size:13px; color:var(--ink2); max-width:70ch;}
.ldc-strip{display:flex; flex-wrap:wrap; border-bottom:1px solid var(--grid); padding:2px 0 11px; margin-bottom:14px;}
.ldc-s{flex:1 1 130px; padding:2px 16px; border-left:1px solid var(--grid);}
.ldc-s:first-child{border-left:none; padding-left:2px;}
.ldc-s .k{display:block; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
.ldc-s b{display:block; font-size:19px; font-weight:750; letter-spacing:-.02em; margin-top:4px; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-s b.bad{color:var(--bad);}
.ldc-s i{display:block; font-size:10px; color:var(--muted); font-style:normal; margin-top:2px;}
.ldc-list{background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:var(--sh); margin-bottom:14px;}
.ldc-list-h{display:flex; align-items:center; gap:10px; padding:11px 15px; border-bottom:1px solid var(--grid);}
.ldc-list-h h2{margin:0; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.02em; color:var(--ink2);}
.ldc-list-h span{margin-left:auto; font-size:11px; font-weight:600; color:var(--muted);}
.ldc-group-h{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--muted); margin:0 0 8px 2px;}
.ldc-group-h span{font-weight:500; text-transform:none; letter-spacing:0; margin-left:6px;}
.ldc-scroll{overflow-x:auto; max-height:58vh;}
.ldc-list table{width:100%; border-collapse:collapse; font-size:12.5px;}
.ldc-list th{text-align:left; font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); padding:9px 15px; background:color-mix(in srgb,var(--muted) 6%,var(--surface)); border-bottom:1px solid var(--grid); position:sticky; top:0;}
.ldc-list th.r{text-align:right;}
.ldc-list td{padding:11px 15px; border-bottom:1px solid var(--grid); color:var(--ink2); vertical-align:middle;}
.ldc-list tbody tr:last-child td{border-bottom:none;}
.ldc-list tbody tr:hover td{background:color-mix(in srgb,var(--accent) 4%,transparent);}
.ldc-list td b{color:var(--ink); display:block; font-weight:650;}
.ldc-list td small{color:var(--muted); font-size:10.5px;}
.ldc-list td.r{text-align:right; font-variant-numeric:tabular-nums; color:var(--ink);}
.ldc-bar{display:inline-block; vertical-align:middle; width:80px; height:6px; border-radius:99px; background:color-mix(in srgb,var(--accent) 14%,transparent); margin-right:8px; overflow:hidden;}
.ldc-bar i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-link{background:none; border:none; cursor:pointer; font:inherit; font-size:12px; font-weight:650; color:var(--accent-ink); text-decoration:none;}
.ldc-link:hover{text-decoration:underline;}
.ldc-chip{display:inline-flex; align-items:center; font-size:10.5px; font-weight:650; border-radius:7px; padding:2px 9px; border:1px solid transparent;}
.ldc-chip.good{color:var(--good-ink); background:color-mix(in srgb,var(--good) 11%,transparent); border-color:color-mix(in srgb,var(--good) 22%,transparent);}
.ldc-chip.warn{color:color-mix(in srgb,var(--warn) 75%,var(--ink)); background:color-mix(in srgb,var(--warn) 14%,transparent); border-color:color-mix(in srgb,var(--warn) 26%,transparent);}
.ldc-chip.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 11%,transparent); border-color:color-mix(in srgb,var(--bad) 24%,transparent);}
.ldc-chip.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 12%,transparent); border-color:color-mix(in srgb,var(--muted) 22%,transparent);}
.ldc-two{display:grid; grid-template-columns:1fr 1fr; gap:14px;}
@media (max-width:820px){ .ldc-two{grid-template-columns:1fr;} }
.ldc-check{display:flex; align-items:center; gap:10px; font-size:13px;}
.ldc-check small{color:var(--muted);}
.ldc-box{width:18px; height:18px; border-radius:5px; flex:0 0 auto; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:11px; font-weight:800;}
.ldc-box.off{background:none; border:1.5px solid var(--border); color:transparent;}
.ldc-btn{background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:7px 14px; font:inherit; font-size:12px; font-weight:650; color:var(--ink2); cursor:pointer;}
.ldc-btn.go{background:var(--accent); border-color:var(--accent); color:#fff;}
.ldc-empty{padding:36px 16px; text-align:center; color:var(--muted); font-size:13px;}
.ldc-empty b{display:block; color:var(--ink); font-weight:650; font-size:14px; margin-bottom:3px;}
.ldc-empty span{display:block; font-size:12px;}
.ldc-err{color:var(--bad);}
.ldc-note{font-size:11.5px; color:var(--muted); margin-top:4px;}
.ldc-grid2{display:grid; grid-template-columns:1.6fr 1fr; gap:14px;}
@media (max-width:860px){ .ldc-grid2{grid-template-columns:1fr;} }
.ldc-panel{background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:var(--sh); padding:14px 16px; margin-bottom:14px;}
.ldc-panel-h{display:flex; align-items:baseline; gap:10px; margin-bottom:12px;}
.ldc-panel-h h2{margin:0; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.02em; color:var(--ink2);}
.ldc-panel-h span{margin-left:auto; font-size:11px; font-weight:600; color:var(--muted);}
.ldc-barrow{display:flex; align-items:center; gap:12px; padding:4px 0; font-size:12px;}
.ldc-barrow .nm{flex:0 0 40%; max-width:40%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); font-weight:550;}
.ldc-barrow .tk{flex:1; height:9px; border-radius:99px; background:color-mix(in srgb,var(--accent) 12%,transparent); overflow:hidden;}
.ldc-barrow .tk i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-barrow .vl{flex:0 0 auto; font-variant-numeric:tabular-nums; color:var(--ink); font-weight:600; min-width:38px; text-align:right;}
.ldc-donut{display:flex; justify-content:center; padding:6px 0 10px;}
.ldc-donut-n{fill:var(--ink); font-weight:750; font-size:20px; font-family:Poppins,sans-serif;}
.ldc-donut-l{fill:var(--muted); font-size:8.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; font-family:Poppins,sans-serif;}
.ldc-legend{display:flex; gap:14px; flex-wrap:wrap; font-size:11.5px; color:var(--ink2); justify-content:center;}
.ldc-legend .lg{display:inline-flex; align-items:center; gap:6px;}
.ldc-legend .lg b{color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-legend .dot{width:10px; height:10px; border-radius:3px; flex:0 0 auto;}
.ldc-stack{display:flex; height:16px; border-radius:99px; overflow:hidden; gap:2px; margin-bottom:12px; background:color-mix(in srgb,var(--muted) 10%,transparent);}
.ldc-stack i{height:100%;}
.ldc-stack i:first-child{border-radius:99px 0 0 99px;}
.ldc-stack i:last-child{border-radius:0 99px 99px 0;}
.ldc-insights{margin:0; padding:0; list-style:none; display:grid; gap:9px;}
.ldc-insights li{position:relative; padding-left:20px; font-size:13px; color:var(--ink); line-height:1.5;}
.ldc-insights li::before{content:""; position:absolute; left:4px; top:7px; width:7px; height:7px; border-radius:2px; background:var(--accent);}
.ldc-barrow .nm small{color:var(--muted); font-weight:400; font-size:10.5px; margin-left:4px;}
.ldc-cards{display:grid; grid-template-columns:repeat(4,1fr); gap:13px; margin-bottom:14px;}
@media (max-width:900px){ .ldc-cards{grid-template-columns:repeat(2,1fr);} }
.ldc-card{display:flex; align-items:center; gap:13px; padding:15px 16px; border-radius:14px; border:1px solid var(--border); box-shadow:var(--sh);}
.ldc-card .cico{width:44px; height:44px; border-radius:12px; display:grid; place-items:center; flex:0 0 auto;}
.ldc-card .clabel{display:block; font-size:11px; color:var(--ink2); font-weight:500;}
.ldc-card .cval{display:block; font-size:19px; font-weight:700; letter-spacing:-.02em; margin-top:2px; color:var(--ink);}
.ldc-card .csub{display:block; font-size:10px; color:var(--muted); margin-top:2px;}
.ldc-vbars{display:flex; gap:8px; align-items:flex-end; padding:4px 0 2px;}
.ldc-vbar{flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px;}
.ldc-vval{font-size:10px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-vtrack{width:70%; max-width:36px; height:130px; background:color-mix(in srgb,var(--accent) 10%,transparent); border-radius:8px; display:flex; align-items:flex-end; overflow:hidden;}
.ldc-vfill{width:100%; background:linear-gradient(180deg,var(--accent),#B94E08); border-radius:8px 8px 0 0;}
.ldc-vlab{font-size:9px; color:var(--muted); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-pillrow{display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:8px;}
.ldc-pill2{font-size:11px; font-weight:650; border-radius:8px; padding:5px 12px; color:#fff;}

/* ═══ Redesigned dashboard (portfolio-health console) ═══ */
.ldx-content{max-width:1200px;}
.ldc-gap16{gap:16px;}
.ldc-sec{margin-top:20px;}

/* header / context bar */
.ldc-topbar{display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:20px;}
.ldc-topbar-l{min-width:0;}
.ldc-topbar h1{margin:5px 0 0; font-size:21px; font-weight:700; letter-spacing:-.02em; color:var(--ink); line-height:1.15;}
.ldc-scope{margin:5px 0 0; font-size:13px; color:var(--ink2); font-variant-numeric:tabular-nums;}
.ldc-topbar-r{margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; gap:9px; max-width:340px;}
.ldc-method{font-size:11px; color:var(--muted); text-align:right; line-height:1.5;}
.ldc-topbar-actions{display:flex; align-items:center; gap:8px;}
.ldc-ghost{background:none; border:1px solid var(--border); border-radius:9px; padding:7px 13px; font:inherit; font-size:12px; font-weight:600; color:var(--ink2); cursor:pointer;}
.ldc-ghost:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldc-btn{text-decoration:none;}

/* KPI stat cards (icon chip + value + mini viz) */
.ldc-stats{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.ldc-stat{background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:var(--sh); padding:15px 16px 16px; display:flex; flex-direction:column; transition:box-shadow .2s, border-color .2s;}
.ldc-stat:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--border)); box-shadow:0 2px 6px rgba(23,19,15,.05),0 16px 34px -18px rgba(226,103,15,.28);}
.ldc-stat-top{display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:13px;}
.ldc-ichip{width:38px; height:38px; border-radius:11px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto;}
.ldc-spark{display:inline-flex; align-items:flex-end; gap:2px; height:30px; width:88px;}
.ldc-spark i{flex:1; min-height:2px; border-radius:2px 2px 0 0;}
.ldc-delta{display:inline-flex; align-items:center; gap:2px; font-size:11px; font-weight:700; color:var(--good-ink); background:color-mix(in srgb,var(--good) 12%,transparent); border-radius:99px; padding:2px 8px;}
.ldc-stat-v{font-size:23px; font-weight:750; letter-spacing:-.02em; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1;}
.ldc-stat-k{font-size:12px; color:var(--ink2); font-weight:600; margin-top:5px;}
.ldc-statbar{display:block; height:5px; border-radius:99px; background:color-mix(in srgb,var(--muted) 13%,transparent); overflow:hidden; margin-top:11px;}
.ldc-statbar i{display:block; height:100%; border-radius:99px;}
.ldc-stat-s{font-size:10.5px; color:var(--muted); margin-top:8px; font-variant-numeric:tabular-nums;}

/* overview: ring + stage bars + structure | attention feed */
.ldc-main2{display:grid; grid-template-columns:1.55fr 1fr; gap:16px;}
.ldc-prog{display:flex; gap:24px; align-items:center; padding:4px 0 2px;}
.ldc-ringwrap{position:relative; flex:0 0 auto; width:150px; height:150px; display:grid; place-items:center;}
.ldc-ringcap{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;}
.ldc-ringcap b{font-size:26px; font-weight:750; color:var(--accent-ink); letter-spacing:-.02em; font-variant-numeric:tabular-nums; line-height:1;}
.ldc-ringcap span{font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin-top:4px;}
.ldc-progbars{flex:1; min-width:0; display:flex; flex-direction:column; gap:13px;}
.ldc-pb-h{display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:5px;}
.ldc-pb-l b{font-size:12.5px; font-weight:650; color:var(--ink);}
.ldc-pb-l small{font-size:10.5px; color:var(--muted); margin-left:7px;}
.ldc-pb-v{font-size:13px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-pb-tk{display:block; height:9px; border-radius:99px; background:color-mix(in srgb,var(--muted) 12%,transparent); overflow:hidden;}
.ldc-pb-tk i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-pb-tk i.good{background:var(--good);} .ldc-pb-tk i.warn{background:var(--warn);} .ldc-pb-tk i.bad{background:var(--bad);}
.ldc-na{font-style:normal; font-size:13px; font-weight:600; color:var(--muted);}
.ldc-struct{display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid var(--grid);}
.ldc-struct-t{display:flex; flex-direction:column; align-items:flex-start; gap:7px; padding:12px; border-radius:11px; background:color-mix(in srgb,var(--muted) 5%,var(--surface)); border:1px solid var(--grid);}
.ldc-struct-t b{font-size:18px; font-weight:750; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1;}
.ldc-struct-t span{font-size:10.5px; color:var(--muted); font-weight:500;}

/* attention feed */
.ldc-attn{display:flex; flex-direction:column;}
.ldc-badge2{margin-left:auto; font-size:11px; font-weight:700; color:#fff; background:var(--bad); border-radius:99px; padding:1px 9px; line-height:17px;}
.ldc-feed-h{font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin:16px 0 8px;}
.ldc-feed{display:flex; flex-direction:column; gap:6px;}
.ldc-feed-i{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; background:color-mix(in srgb,var(--bad) 5%,var(--surface)); border:1px solid color-mix(in srgb,var(--bad) 13%,transparent);}
.ldc-feed-ic{width:27px; height:27px; border-radius:8px; display:grid; place-items:center; flex:0 0 auto; background:color-mix(in srgb,var(--bad) 13%,transparent); color:var(--bad);}
.ldc-feed-b{flex:1; min-width:0;}
.ldc-feed-b b{display:block; font-size:12.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-feed-b small{display:block; font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-feed-r{display:flex; align-items:center; gap:7px; flex:0 0 auto;}
.ldc-feed-more{display:inline-block; margin-top:8px; font-size:11.5px; font-weight:650; color:var(--accent-ink); text-decoration:none;}
.ldc-feed-more:hover{text-decoration:underline;}
.ldc-feed-ok{text-align:center; padding:22px 10px; display:flex; flex-direction:column; align-items:center; gap:3px;}
.ldc-feed-okico{width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:color-mix(in srgb,var(--good) 12%,transparent); color:var(--good); margin-bottom:6px;}
.ldc-feed-ok b{font-size:13.5px; color:var(--ink);}
.ldc-feed-ok span{font-size:11.5px; color:var(--muted); max-width:34ch;}

/* risk distribution rows */
.ldc-distrows{display:flex; flex-direction:column; margin-top:14px;}
.ldc-distrow{display:flex; align-items:center; gap:10px; padding:7px 0; font-size:12.5px; border-bottom:1px solid var(--grid);}
.ldc-distrow:last-child{border-bottom:none;}
.ldc-distrow .dot{width:10px; height:10px; border-radius:3px; flex:0 0 auto;}
.ldc-distrow .lb{flex:1; color:var(--ink); font-weight:600; display:flex; align-items:baseline; gap:7px; min-width:0;}
.ldc-distrow .lb small{color:var(--muted); font-weight:500; font-size:10.5px;}
.ldc-distrow .ct{font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-distrow .sh{flex:0 0 42px; text-align:right; color:var(--muted); font-variant-numeric:tabular-nums;}

/* pulse strip (vivid summary) */
.ldc-pulse{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.ldc-pulse-t{border-radius:14px; padding:16px 17px; color:#fff; display:flex; flex-direction:column; box-shadow:0 10px 26px -14px rgba(23,19,15,.5);}
.ldc-pulse-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:9px;}
.ldc-pulse-top svg{opacity:.85;}
.ldc-pulse-top b{font-size:22px; font-weight:750; font-variant-numeric:tabular-nums; line-height:1;}
.ldc-pulse-t span{font-size:12px; font-weight:600; opacity:.96;}
.ldc-pulse-t em{font-style:normal; font-size:10.5px; opacity:.82; margin-top:3px;}

/* triage / table helpers */
.ldc-tag{display:inline-block; font-size:10.5px; font-weight:600; color:var(--ink2); background:color-mix(in srgb,var(--muted) 11%,transparent); border-radius:6px; padding:2px 8px; white-space:nowrap;}
.ldc-list td small.mut{color:var(--muted); font-weight:400;}
.pctv{font-size:11.5px; font-weight:650; color:var(--ink); font-variant-numeric:tabular-nums; vertical-align:middle;}
.ldc-compbar{position:relative; display:inline-block; vertical-align:middle; width:96px; height:7px; border-radius:99px; background:color-mix(in srgb,var(--muted) 13%,transparent); margin-right:8px;}
.ldc-compbar i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-compbar i.good{background:var(--good);} .ldc-compbar i.warn{background:var(--warn);} .ldc-compbar i.bad{background:var(--bad);} .ldc-compbar i.neutral{background:#C9C1B8;}
.ldc-compbar .tick{position:absolute; top:-2px; bottom:-2px; width:2px; background:var(--ink); opacity:.5; border-radius:2px;}
.ldc-th{background:none; border:none; padding:0; margin:0; font:inherit; cursor:pointer; color:inherit; font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase;}
.ldc-th:hover{color:var(--accent-ink);}
.ldc-tbl td{vertical-align:middle;}
.ldc-mix{display:inline-flex; vertical-align:middle; width:120px; height:8px; border-radius:99px; overflow:hidden; background:color-mix(in srgb,var(--muted) 12%,transparent); gap:1px;}
.ldc-mix i{height:100%;}
.ldc-microf{display:inline-flex; align-items:flex-end; gap:3px; height:22px; vertical-align:middle;}
.ldc-microf i{width:6px; background:var(--accent); opacity:.8; border-radius:2px 2px 0 0;}

/* skeleton */
.ldc-sk{display:block; border-radius:7px; background:linear-gradient(90deg,color-mix(in srgb,var(--muted) 9%,transparent),color-mix(in srgb,var(--muted) 18%,transparent),color-mix(in srgb,var(--muted) 9%,transparent)); background-size:200% 100%; animation:ldcsk 1.2s ease-in-out infinite;}
@keyframes ldcsk{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.ldc-sk-k{width:55%; height:11px; margin-bottom:12px;}
.ldc-sk-v{width:70%; height:28px; margin-bottom:12px;}
.ldc-sk-s{width:42%; height:10px;}
.ldc-sk-row{width:100%; height:22px; margin:9px 0;}

@media (max-width:960px){ .ldc-stats{grid-template-columns:repeat(2,1fr);} }
@media (max-width:900px){ .ldc-main2{grid-template-columns:1fr;} .ldc-pulse{grid-template-columns:repeat(2,1fr);} }
@media (max-width:640px){ .ldc-struct{grid-template-columns:repeat(2,1fr);} }
@media (max-width:520px){ .ldc-stats,.ldc-pulse{grid-template-columns:1fr;} }

/* ═══ Manager dashboard (mock-parity layout) ═══ */
.ldm-hdr{display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-bottom:20px;}
.ldm-hdr-l{min-width:0;}
.ldm-hdr-l h1{margin:0; font-size:22px; font-weight:750; letter-spacing:-.02em; color:var(--ink); line-height:1.15;}
.ldm-hdr-l .ldc-scope{margin:5px 0 0; font-size:12.5px; color:var(--ink2);}
.ldm-scopesub{color:var(--muted);}
.ldm-hdr-r{margin-left:auto; display:flex; align-items:center; gap:10px;}
.ldm-search{display:flex; align-items:center; gap:8px; background:color-mix(in srgb,var(--muted) 7%,var(--surface)); border:1px solid var(--border); border-radius:10px; padding:0 12px; height:40px; width:248px; max-width:38vw; transition:border-color .15s, box-shadow .15s;}
.ldm-search:focus-within{border-color:var(--accent); box-shadow:0 0 0 3px var(--wash); background:var(--surface);}
.ldm-search svg{stroke:var(--muted); flex:0 0 auto;}
.ldm-search input{flex:1; min-width:0; border:none; outline:none; background:none; font:inherit; font-size:12.5px; color:var(--ink);}
.ldm-search input::placeholder{color:var(--muted);}
.ldm-ib{position:relative; width:40px; height:40px; border-radius:10px; border:1px solid var(--border); background:var(--surface); display:grid; place-items:center; color:var(--ink2); cursor:pointer; text-decoration:none; transition:border-color .15s, color .15s;}
.ldm-ib:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldm-ib-dot{position:absolute; top:-5px; right:-5px; min-width:17px; height:17px; padding:0 4px; border-radius:99px; background:var(--bad); color:#fff; font-size:9.5px; font-weight:700; font-style:normal; display:grid; place-items:center; border:2px solid var(--surface);}
.ldm-avatar{width:40px; height:40px; border-radius:99px; display:grid; place-items:center; font-size:12px; font-weight:700; color:#fff; background:linear-gradient(150deg,var(--accent),#8A3A06); box-shadow:0 4px 12px -4px rgba(226,103,15,.35); flex:0 0 auto; letter-spacing:.02em;}
.ldm-top{display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start;}
.ldm-kpis{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px;}
.ldm-qa{margin-bottom:0; padding-bottom:8px;}
.ldm-qa-i{display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:10px; border:1px solid var(--grid); margin-bottom:7px; text-decoration:none; color:var(--ink); font-size:12.5px; font-weight:600; background:color-mix(in srgb,var(--muted) 4%,var(--surface)); transition:border-color .15s;}
.ldm-qa-i:hover{border-color:var(--accent);}
.ldm-qa-i .ldc-ichip{width:30px; height:30px; border-radius:9px;}
.ldm-qa-i .chev{margin-left:auto; color:var(--muted); flex:0 0 auto;}
.ldm-qa-b{font-size:10.5px; font-weight:700; color:#fff; background:var(--bad); border-radius:99px; padding:1px 8px; margin-left:auto;}
.ldm-qa-b~.chev{margin-left:6px;}
.ldm-mid{display:grid; grid-template-columns:1.02fr 1.25fr 1.08fr; gap:16px; align-items:start;}
.ldm-bot{display:grid; grid-template-columns:1.12fr 1.25fr 1fr 1fr; gap:16px; align-items:start;}
.ldm-mid .ldc-panel,.ldm-bot .ldc-panel{margin-bottom:0;}
.ldm-pa{margin-left:auto; font-size:11px;}
.ldc-panel-h .ldc-badge2+.ldm-pa{margin-left:8px;}
.ldm-vh{max-height:330px; overflow-y:auto;}
.ldm-tbl{width:100%; border-collapse:collapse; font-size:12px;}
.ldm-tbl th{text-align:left; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:5px 8px 7px; border-bottom:1px solid var(--grid); position:sticky; top:0; background:var(--surface);}
.ldm-tbl th.r,.ldm-tbl td.r{text-align:right; font-variant-numeric:tabular-nums;}
.ldm-tbl td{padding:8px; border-bottom:1px solid var(--grid); vertical-align:middle; color:var(--ink2);}
.ldm-tbl tr:last-child td{border-bottom:none;}
.ldm-tbl td small{color:var(--muted); font-size:10.5px;}
.ldm-av{width:28px; height:28px; border-radius:99px; display:inline-grid; place-items:center; font-size:10px; font-weight:700; color:#fff; flex:0 0 auto; letter-spacing:.02em;}
.ldm-who{display:flex; align-items:center; gap:9px; min-width:0;}
.ldm-who b{display:block; font-size:12px; color:var(--ink); font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;}
.ldm-who small{display:block; font-size:10px; color:var(--muted);}
.pctv.good{color:var(--good-ink);} .pctv.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink));} .pctv.bad{color:var(--bad);}
.ldm-cl{border:1px solid var(--grid); border-radius:12px; padding:12px 13px; margin-bottom:10px; background:color-mix(in srgb,var(--accent) 3%,var(--surface));}
.ldm-cl:last-child{margin-bottom:0;}
.ldm-cl-h{display:flex; align-items:center; gap:9px; margin-bottom:10px;}
.ldm-cl-h .ldc-ichip{width:30px; height:30px; border-radius:9px;}
.ldm-cl-h b{font-size:13px; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-cl-h .ldc-spark{margin-left:auto; height:22px; width:64px; flex:0 0 auto;}
.ldm-cl-g{display:grid; grid-template-columns:repeat(5,1fr); gap:6px;}
.ldm-ms{min-width:0;}
.ldm-ms span{display:block; font-size:8.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ldm-ms b{display:block; font-size:14px; font-weight:750; color:var(--ink); margin-top:3px; font-variant-numeric:tabular-nums;}
.ldm-ms b.good{color:var(--good-ink);} .ldm-ms b.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink));} .ldm-ms b.bad{color:var(--bad);}
.ldm-strip5{display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:12px;}
.ldm-strip5 .ldm-ms{border:1px solid var(--grid); border-radius:9px; padding:8px 8px 9px; background:color-mix(in srgb,var(--muted) 4%,var(--surface));}
.ldm-wk{display:flex; gap:8px; align-items:stretch; height:132px; padding-top:4px;}
.ldm-wk .c{flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; min-width:0; justify-content:flex-end;}
.ldm-wk .t{width:68%; max-width:34px; background:color-mix(in srgb,var(--accent) 10%,transparent); border-radius:7px; display:flex; align-items:flex-end; overflow:hidden; flex:1;}
.ldm-wk .f{width:100%; background:linear-gradient(180deg,var(--accent),#B94E08); border-radius:7px 7px 0 0;}
.ldm-wk .v{font-size:9.5px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldm-wk .l{font-size:9px; color:var(--muted); white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;}
.ldm-tp-tags{display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;}
.ldm-act{display:flex; flex-direction:column;}
.ldm-act-i{display:flex; gap:10px; padding:7px 0; border-bottom:1px solid var(--grid);}
.ldm-act-i:last-child{border-bottom:none;}
.ldm-act-i .dot{width:9px; height:9px; border-radius:99px; margin-top:5px; flex:0 0 auto;}
.ldm-act-b{min-width:0; flex:1;}
.ldm-act-b .tm{display:block; font-size:9.5px; color:var(--muted); font-variant-numeric:tabular-nums; margin-bottom:1px;}
.ldm-act-b b{display:block; font-size:12px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-act-b small{display:block; font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-alert{display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px; border:1px solid; margin-bottom:7px; text-decoration:none; font-size:12px; font-weight:600;}
.ldm-alert svg{flex:0 0 auto;}
.ldm-alert span{flex:1; min-width:0;}
.ldm-alert>b{font-size:10.5px; font-weight:700; color:#fff; border-radius:99px; padding:1px 8px;}
.ldm-alert.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 6%,transparent); border-color:color-mix(in srgb,var(--bad) 18%,transparent);} .ldm-alert.bad>b{background:var(--bad);}
.ldm-alert.warn{color:color-mix(in srgb,var(--warn) 80%,var(--ink)); background:color-mix(in srgb,var(--warn) 8%,transparent); border-color:color-mix(in srgb,var(--warn) 24%,transparent);} .ldm-alert.warn>b{background:color-mix(in srgb,var(--warn) 85%,var(--ink));}
.ldm-alert.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 7%,transparent); border-color:var(--grid);} .ldm-alert.neutral>b{background:var(--muted);}
.ldm-donutrow{display:flex; align-items:center; gap:18px; margin-top:14px; padding-top:14px; border-top:1px solid var(--grid);}
.ldm-donutrow .ldc-legend{flex-direction:column; align-items:flex-start; gap:8px; justify-content:flex-start;}
@media (max-width:1150px){ .ldm-mid{grid-template-columns:1fr 1fr;} .ldm-bot{grid-template-columns:1fr 1fr;} }
@media (max-width:980px){ .ldm-top{grid-template-columns:1fr;} .ldm-kpis{grid-template-columns:repeat(2,1fr);} }
@media (max-width:700px){ .ldm-mid,.ldm-bot{grid-template-columns:1fr;} }
@media (max-width:460px){ .ldm-kpis{grid-template-columns:1fr;} .ldm-cl-g,.ldm-strip5{grid-template-columns:repeat(3,1fr); row-gap:10px;} }

/* content review (assignments & assessments) */
.ldc-cbar{display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:14px;}
.ldc-cfield{display:flex; flex-direction:column; gap:5px;}
.ldc-cfield>span{font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
.ldc-cfield select{font:inherit; font-size:12.5px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:8px 11px; min-width:260px; max-width:440px; cursor:pointer;}
.ldc-cfield select:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border));}
.ldc-seg{display:inline-flex; background:color-mix(in srgb,var(--muted) 9%,transparent); border-radius:9px; padding:3px; gap:2px;}
.ldc-seg button{border:none; background:none; font:inherit; font-size:12px; font-weight:600; color:var(--ink2); padding:6px 13px; border-radius:7px; cursor:pointer;}
.ldc-seg button.on{background:var(--surface); color:var(--accent-ink); box-shadow:0 1px 3px rgba(23,19,15,.1);}
/* underline text tabs (leaner than the pill segmented control) */
.ldc-tabs{display:inline-flex; gap:22px; border-bottom:1px solid var(--grid);}
.ldc-tabs button{background:none; border:none; margin:0; padding:0 1px 8px; font:inherit; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; position:relative;}
.ldc-tabs button:hover{color:var(--ink);}
.ldc-tabs button.on{color:var(--accent-ink); font-weight:700;}
.ldc-tabs button.on::after{content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--accent); border-radius:2px 2px 0 0;}
.ldc-chint{font-size:11.5px; color:var(--muted);}
.ldc-chint b{color:var(--ink2); font-weight:650;}
.ldc-csum{display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px;}
.ldc-cchip{font-size:12px; color:var(--ink2); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:7px 12px;}
.ldc-cchip b{color:var(--ink); font-weight:750; font-variant-numeric:tabular-nums;}
.ldc-ccourse{margin-bottom:26px;}
.ldc-ccourse-h{display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:0 0 12px; margin-bottom:14px; border-bottom:2px solid var(--grid);}
.ldc-ccourse-t{display:flex; align-items:baseline; gap:9px; min-width:0;}
.ldc-ccourse-t b{font-size:15px; font-weight:700; color:var(--ink); letter-spacing:-.01em;}
.ldc-ccourse-t small{font-size:11.5px; color:var(--muted);}
.ldc-ccourse-meta{margin-left:auto; font-size:11px; font-weight:600; color:var(--ink2); background:color-mix(in srgb,var(--muted) 8%,transparent); border-radius:8px; padding:5px 11px; font-variant-numeric:tabular-nums;}
.ldc-cmod{margin-bottom:22px;}
.ldc-cmod-h{font-size:13px; font-weight:700; color:var(--ink); letter-spacing:-.01em; padding-bottom:8px; border-bottom:2px solid var(--grid); margin-bottom:12px;}
.ldc-ctopic{margin:0 0 14px;}
.ldc-ctopic-h{font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin:0 0 8px 2px;}
.ldc-ex{background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:var(--sh); margin-bottom:8px; overflow:hidden;}
.ldc-ex.open{border-color:color-mix(in srgb,var(--accent) 35%,var(--border));}
.ldc-ex-h{display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:none; border:none; font:inherit; padding:12px 14px; cursor:pointer;}
.ldc-ex-h:hover{background:color-mix(in srgb,var(--accent) 3%,transparent);}
.ldc-ex-h.static{cursor:default;}
.ldc-ex-h.static:hover{background:none;}
.ldc-ex-kind{flex:0 0 auto; font-size:9.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; border-radius:6px; padding:4px 8px; white-space:nowrap;}
.ldc-ex-kind.ido{color:#22688F; background:color-mix(in srgb,#2E90C4 14%,transparent);}
.ldc-ex-kind.assign{color:var(--accent-ink); background:var(--wash);}
.ldc-ex-kind.assess{color:#5B44C7; background:color-mix(in srgb,#7C5CFC 13%,transparent);}
.ldc-ex-main{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;}
.ldc-ex-main b{font-size:13px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-ex-main small{font-size:10.5px; color:var(--muted);}
.ldc-ex-meta{flex:0 0 auto; display:flex; align-items:center; gap:7px;}
.ldc-ex-qn{font-size:11px; font-weight:700; color:var(--ink2); font-variant-numeric:tabular-nums;}
.ldc-ex-cv{width:15px; height:15px; stroke:var(--muted); transition:transform .16s;}
.ldc-ex.open .ldc-ex-cv{transform:rotate(180deg);}
.ldc-ex-body{padding:2px 14px 10px; border-top:1px solid var(--grid);}
.ldc-q{padding:11px 0; border-bottom:1px solid var(--grid);}
.ldc-q:last-child{border-bottom:none;}
.ldc-q-h{display:flex; align-items:center; gap:9px;}
.ldc-q-n{flex:0 0 auto; width:22px; height:22px; border-radius:6px; background:color-mix(in srgb,var(--muted) 12%,transparent); color:var(--ink2); font-size:11px; font-weight:700; display:grid; place-items:center; font-variant-numeric:tabular-nums;}
.ldc-q-type{flex:0 0 auto; font-size:9.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--accent-ink); background:var(--wash); border-radius:5px; padding:2px 7px;}
.ldc-q-title{flex:1; min-width:0; font-size:12.5px; color:var(--ink); font-weight:500;}
.ldc-q-meta{font-size:10.5px; color:var(--muted); margin:5px 0 0 31px; text-transform:capitalize;}
.ldc-q-opts{list-style:none; margin:7px 0 0 31px; padding:0; display:flex; flex-direction:column; gap:4px;}
.ldc-q-opts li{font-size:12px; color:var(--ink2); padding:4px 10px; border-radius:6px; background:color-mix(in srgb,var(--muted) 6%,transparent);}
.ldc-q-opts li.ok{color:var(--good-ink); background:color-mix(in srgb,var(--good) 10%,transparent); font-weight:600;}

/* attendance: date/range control, filters, register, matrix */
.ldc-seg.sm button{font-size:11px; padding:5px 10px;}
.ldc-attctl{display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:16px; padding:11px 13px; background:color-mix(in srgb,var(--muted) 4%,var(--surface)); border:1px solid var(--grid); border-radius:11px;}
.ldc-daynav{display:inline-flex; align-items:center; gap:6px;}
.ldc-rlab{font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
.ldc-navbtn{width:28px; height:28px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink2); font-size:15px; line-height:1; cursor:pointer; display:grid; place-items:center;}
.ldc-navbtn:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldc-mini{font:inherit; font-size:12px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 9px; cursor:pointer;}
.ldc-mini:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border));}
.ldc-search{cursor:text; min-width:170px; font-weight:500;}
.ldc-todaybtn{font-weight:650; color:var(--ink2);}
.ldc-filters{display:inline-flex; align-items:center; gap:10px; flex-wrap:wrap; margin-left:auto;}
.ldc-daysum{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:2px;}
.ldc-dchip{font-size:11px; font-weight:650; border-radius:7px; padding:3px 9px; border:1px solid transparent; font-variant-numeric:tabular-nums;}
/* day-summary badges tucked into the list header (no separate row) */
.ldc-list-h{flex-wrap:wrap; row-gap:6px;}
.ldc-list-h .ldc-daysum{margin:0 0 0 auto; gap:6px;}
.ldc-list-h .ldc-dchip{font-size:10.5px; font-weight:650; padding:3px 9px; border-radius:7px;}
.ldc-dchip.good{color:var(--good-ink); background:color-mix(in srgb,var(--good) 11%,transparent); border-color:color-mix(in srgb,var(--good) 22%,transparent);}
.ldc-dchip.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 10%,transparent); border-color:color-mix(in srgb,var(--bad) 22%,transparent);}
.ldc-dchip.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink)); background:color-mix(in srgb,var(--warn) 13%,transparent); border-color:color-mix(in srgb,var(--warn) 26%,transparent);}
.ldc-dchip.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 11%,transparent); border-color:var(--grid);}
/* register matrix */
.ldc-mx{border-collapse:separate; border-spacing:0;}
.ldc-mx th.c, .ldc-mx td.c{text-align:center; padding:6px 7px !important; white-space:nowrap;}
.ldc-mx th.stick, .ldc-mx td.stick{position:sticky; left:0; z-index:2; background:var(--surface); box-shadow:1px 0 0 var(--grid);}
.ldc-mx thead th.stick{z-index:3;}
.ldc-mxc{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:6px; font-size:10.5px; font-weight:700; color:var(--ink2); background:color-mix(in srgb,var(--muted) 9%,transparent);}
.ldc-mxc.good{color:#fff; background:var(--good);}
.ldc-mxc.bad{color:#fff; background:var(--bad);}
.ldc-mxc.warn{color:#fff; background:var(--warn);}
.ldc-mxc.none{color:var(--muted); background:color-mix(in srgb,var(--muted) 8%,transparent);}
/* Attendance fills the area below the sticky filter bar; the list flex-grows
   so it reaches the bottom on every tab (matrix, register, summary) with no
   page scroll — regardless of how much sits above it. 104 = filter 54 + content
   pad 16+30 + a small buffer. */
.ldc-attfill{height:calc(100vh - 104px); display:flex; flex-direction:column; min-height:0; overflow:hidden;}
.ldc-listfill{margin-top:2px;}
.ldc-attfill .ldc-listfill{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; margin-bottom:0;}
.ldc-attfill .ldc-listfill .ldc-list-h{flex:0 0 auto;}
.ldc-attfill .ldc-listfill .ldc-scroll{flex:1 1 auto; min-height:0; max-height:none;}
@media (max-width:900px){ .ldc-attfill{height:auto; overflow:visible;} .ldc-attfill .ldc-listfill .ldc-scroll{flex:none;} }

/* ═══ Learning Content — premium course layout (.lcx-*) ═══ */
.lcx-controls{display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:18px;}
.lcx-search{display:inline-flex; align-items:center; gap:8px; flex:1 1 240px; max-width:380px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 12px;}
.lcx-search svg{width:15px; height:15px; stroke:var(--muted); flex:0 0 auto;}
.lcx-search input{flex:1; min-width:0; border:none; outline:none; background:none; font:inherit; font-size:12.5px; color:var(--ink);}
.lcx-search input::placeholder{color:var(--muted);}
.lcx-sortlab{display:inline-flex; align-items:center; gap:7px;}
.lcx-sortlab span{font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted);}
.lcx-sortlab select{font:inherit; font-size:12px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:7px 10px; cursor:pointer;}
.lcx-tabs{display:inline-flex; gap:4px; background:color-mix(in srgb,var(--muted) 8%,transparent); border-radius:10px; padding:4px;}
.lcx-tabs button{display:inline-flex; align-items:center; gap:7px; border:none; background:none; font:inherit; font-size:12.5px; font-weight:600; color:var(--ink2); padding:6px 12px; border-radius:8px; cursor:pointer;}
.lcx-tabs button b{font-size:10.5px; font-weight:700; color:var(--muted); background:color-mix(in srgb,var(--muted) 13%,transparent); border-radius:99px; padding:0 7px; line-height:16px;}
.lcx-tabs button.on{background:var(--surface); color:var(--accent-ink); box-shadow:0 1px 3px rgba(23,19,15,.1);}
.lcx-tabs button.on b{color:var(--accent-ink); background:var(--wash);}

.lcx-grid{display:grid; grid-template-columns:216px minmax(0,1fr) 268px; gap:18px; align-items:start;}
.lcx-panel{background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:var(--sh); padding:14px 15px; margin-bottom:16px;}
.lcx-panel-h{font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:12px;}
.lcx-thumb{height:118px; border-radius:14px; background:linear-gradient(150deg,#211838,#0d1a2b); display:grid; place-items:center; color:#F0872E; margin-bottom:16px; box-shadow:var(--sh);}
.lcx-modnav{display:flex; flex-direction:column; gap:2px;}
.lcx-modnav-i{display:flex; align-items:center; gap:10px; padding:8px 9px; border-radius:8px; text-decoration:none; color:var(--ink2); font-size:12.5px; font-weight:550;}
.lcx-modnav-i:hover{background:color-mix(in srgb,var(--muted) 8%,transparent); color:var(--ink);}
.lcx-modnav-i.on{background:var(--wash); color:var(--accent-ink); font-weight:650;}
.lcx-modnav-i .n{flex:0 0 auto; width:20px; height:20px; border-radius:6px; background:color-mix(in srgb,var(--muted) 12%,transparent); color:var(--ink2); font-size:10.5px; font-weight:700; display:grid; place-items:center;}
.lcx-modnav-i.on .n{background:var(--accent); color:#fff;}
.lcx-modnav-i .t{min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}

.lcx-head{margin-bottom:18px;}
.lcx-head .lcx-eyebrow{font-size:10px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; color:var(--accent-ink);}
.lcx-head h1{margin:5px 0 0; font-size:26px; font-weight:750; letter-spacing:-.02em; color:var(--ink); line-height:1.1;}
.lcx-desc{margin:9px 0 0; font-size:13px; color:var(--ink2); line-height:1.55; max-width:72ch;}
.lcx-meta{display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin-top:15px;}
.lcx-mi{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--ink2);}
.lcx-mi svg{stroke:var(--muted); flex:0 0 auto;}
.lcx-mi b{color:var(--ink); font-weight:700; font-variant-numeric:tabular-nums;}
.lcx-comp{gap:9px;}
.lcx-comp b{color:var(--accent-ink);}
.lcx-cbar{display:inline-block; width:110px; height:6px; border-radius:99px; background:color-mix(in srgb,var(--muted) 13%,transparent); overflow:hidden; vertical-align:middle;}
.lcx-cbar i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.lcx-cta{margin-left:auto; text-decoration:none; font-size:12px; font-weight:650; color:#fff; background:var(--accent); border-radius:9px; padding:8px 14px; white-space:nowrap;}
.lcx-cta:hover{background:var(--accent-ink);}

.lcx-mod{background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:var(--sh); margin-bottom:12px; overflow:hidden; scroll-margin-top:70px;}
.lcx-mod-h{display:flex; align-items:center; gap:13px; width:100%; text-align:left; background:none; border:none; font:inherit; padding:14px 16px; cursor:pointer;}
.lcx-mod-h:hover{background:color-mix(in srgb,var(--accent) 3%,transparent);}
.lcx-mod-n{flex:0 0 auto; width:26px; height:26px; border-radius:8px; background:var(--wash); color:var(--accent-ink); font-size:12px; font-weight:700; display:grid; place-items:center;}
.lcx-mod-t{flex:1; min-width:0; display:flex; flex-direction:column;}
.lcx-mod-t b{font-size:14px; font-weight:650; color:var(--ink);}
.lcx-mod-t small{font-size:11px; color:var(--muted);}
.lcx-cv{width:16px; height:16px; stroke:var(--muted); flex:0 0 auto; transition:transform .16s;}
.lcx-cv.open{transform:rotate(180deg);}
.lcx-mempty{padding:16px; color:var(--muted); font-size:12.5px; border-top:1px solid var(--grid);}

.lcx-rt{border-top:1px solid var(--grid);}
.lcx-rt-head, .lcx-rrow{display:grid; grid-template-columns:minmax(0,2.4fr) 0.8fr 0.7fr 0.7fr 1fr 1.1fr 0.85fr; align-items:center; gap:10px; padding:9px 16px;}
.lcx-rt-head{font-size:9.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--muted); background:color-mix(in srgb,var(--muted) 5%,var(--surface)); border-bottom:1px solid var(--grid);}
.lcx-rt-head .r, .lcx-c.r{justify-self:end; text-align:right;}
.lcx-rt-head .ctr, .lcx-c.ctr{justify-self:center; text-align:center;}
.lcx-rrow{border-bottom:1px solid var(--grid); font-size:12px;}
.lcx-rrow:last-child{border-bottom:none;}
.lcx-rrow:hover{background:color-mix(in srgb,var(--accent) 2.5%,transparent);}
.lcx-r{display:flex; align-items:center; gap:10px; min-width:0;}
.lcx-ricon{width:30px; height:30px; border-radius:8px; display:grid; place-items:center; flex:0 0 auto;}
.lcx-ricon.ido{background:color-mix(in srgb,#2E90C4 13%,transparent); color:#22688F;}
.lcx-ricon.assign{background:var(--wash); color:var(--accent-ink);}
.lcx-ricon.assess{background:color-mix(in srgb,#7C5CFC 13%,transparent); color:#5B44C7;}
.lcx-rname{min-width:0; display:flex; flex-direction:column;}
.lcx-rname b{font-size:12.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.lcx-rname small{font-size:10.5px; color:var(--muted); display:flex; align-items:center; gap:6px;}
.lcx-sb{font-size:8.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; border-radius:5px; padding:1px 5px; white-space:nowrap;}
.lcx-sb.ido{color:#22688F; background:color-mix(in srgb,#2E90C4 14%,transparent);}
.lcx-sb.assign{color:var(--accent-ink); background:var(--wash);}
.lcx-sb.assess{color:#5B44C7; background:color-mix(in srgb,#7C5CFC 13%,transparent);}
.lcx-c{color:var(--ink2); font-variant-numeric:tabular-nums; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.lcx-c .mut{color:var(--muted);}
.lcx-eye.on{color:var(--good);} .lcx-eye.off{color:var(--muted);}
.lcx-det{display:inline-flex; align-items:center; gap:6px;}
.lcx-open{font:inherit; font-size:11.5px; font-weight:650; color:var(--accent-ink); background:var(--wash); border:1px solid color-mix(in srgb,var(--accent) 22%,transparent); border-radius:8px; padding:5px 12px; cursor:pointer; text-decoration:none; display:inline-block;}
.lcx-open:hover{background:color-mix(in srgb,var(--accent) 16%,transparent);}
.lcx-open.on{background:var(--accent); color:#fff; border-color:var(--accent);}
.lcx-qbody{grid-column:1 / -1; padding:2px 16px 12px 58px; background:color-mix(in srgb,var(--muted) 3%,transparent); margin-top:6px;}

.lcx-ring{position:relative; display:grid; place-items:center; margin-bottom:14px;}
.lcx-ringcap{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;}
.lcx-ringcap b{font-size:26px; font-weight:750; color:var(--accent-ink); font-variant-numeric:tabular-nums; line-height:1;}
.lcx-ringcap span{font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-top:3px;}
.lcx-rstats{display:flex; flex-direction:column;}
.lcx-rstat{display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-top:1px solid var(--grid); font-size:12.5px; color:var(--ink2);}
.lcx-rstat b{color:var(--ink); font-weight:700; font-variant-numeric:tabular-nums;}
.lcx-act{display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--grid);}
.lcx-act:first-of-type{border-top:none;}
.lcx-act-ic{width:28px; height:28px; border-radius:8px; display:grid; place-items:center; flex:0 0 auto;}
.lcx-act-ic.ido{background:color-mix(in srgb,#2E90C4 13%,transparent); color:#22688F;}
.lcx-act-ic.assign{background:var(--wash); color:var(--accent-ink);}
.lcx-act-ic.assess{background:color-mix(in srgb,#7C5CFC 13%,transparent); color:#5B44C7;}
.lcx-act-b{min-width:0;}
.lcx-act-b b{display:block; font-size:12px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.lcx-act-b small{display:flex; align-items:center; gap:6px; font-size:10.5px; color:var(--muted);}

@media (max-width:1160px){ .lcx-grid{grid-template-columns:minmax(0,1fr) 260px;} .lcx-left{display:none;} }
@media (max-width:860px){ .lcx-grid{grid-template-columns:1fr;} .lcx-right{display:none;} .lcx-rt-head, .lcx-rrow{grid-template-columns:minmax(0,1fr) auto;} .lcx-rt-head span:nth-child(n+2):nth-child(-n+6), .lcx-c:nth-child(n+2):nth-child(-n+6){display:none;} }
`;
