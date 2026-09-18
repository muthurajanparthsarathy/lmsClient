/**
 * L&D Dashboard — derivation layer.
 *
 * Every aggregate the dashboard shows is computed here, as one pure function
 * over the raw payloads. The rules are carried over unchanged from the previous
 * console implementation so the redesign cannot silently move a number:
 *
 *   • completion  — mean of per-course `averageProgress` over courses that
 *                   actually have students (empty courses would drag it to 0).
 *   • score       — mean of the server-side `percentage` on We_Do / You_Do
 *                   only. I_Do is excluded because its percentage mirrors
 *                   MCQ-doc completion, not marks.
 *   • at risk     — started but under 50%. Never includes not-started students,
 *                   who are a separate (and differently actionable) problem.
 *   • stage %     — completed/total across a stage's sub-types; `null` when the
 *                   stage has no content, so "N/A" never renders as 0%.
 */

import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Clock,
  Users,
} from "lucide-react";
import type {
  ActivityItem,
  AlertItem,
  ClientPerf,
  CourseRow,
  DashFilter,
  DashboardModel,
  FocusCourse,
  RiskRow,
  StageProgress,
  StudentRow,
  TrainerPerf,
  WeekPoint,
} from "../types";
import { num } from "./format";

export const STAGE_META = [
  { key: "iDo", label: "I Do", tag: "Concept MCQs" },
  { key: "weDo", label: "We Do", tag: "Guided practice" },
  { key: "youDo", label: "You Do", tag: "Independent exercises" },
] as const;

/**
 * Per-stage completion %. A stage is an object of sub-types, e.g.
 * `I_Do: { Video: { completed, total } }`. Returns completed/total across all
 * sub-types, or `null` when the stage has no content at all.
 */
export const stageDone = (p: any, k: string): number | null => {
  const v = p?.[k];
  if (!v || typeof v !== "object") return null;
  let comp = 0;
  let tot = 0;
  Object.values(v).forEach((sub: any) => {
    if (sub && typeof sub === "object" && "total" in sub) {
      comp += Number(sub.completed) || 0;
      tot += Number(sub.total) || 0;
    }
  });
  return tot > 0 ? Math.round((comp / tot) * 100) : null;
};

/** Marks-weighted score across We_Do / You_Do. `null` when nothing is scored. */
export const scoreOf = (p: any): number | null => {
  const vals: number[] = [];
  ["We_Do", "You_Do"].forEach((k) => {
    const v = p?.[k];
    if (!v || typeof v !== "object") return;
    Object.values(v).forEach((sub: any) => {
      if (
        sub &&
        typeof sub === "object" &&
        Number(sub.total) > 0 &&
        typeof sub.percentage === "number"
      ) {
        vals.push(Number(sub.percentage) || 0);
      }
    });
  });
  return vals.length
    ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
    : null;
};

/** ISO-week bucket key (Monday) for the attendance trend. */
export const mondayKey = (d: Date): string => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

export const weekLabel = (k: string): string => {
  const d = new Date(`${k}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? k
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const roleName = (role: any): string => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return (role.renameRole || role.originalRole || role.roleValue || role.name || "").toString();
};

const mean = (vals: number[]): number | null =>
  vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;

/* ── payload normalisers ──────────────────────────────────────────────────── */

export function parseAnalytics(j: any): { rows: CourseRow[]; students: StudentRow[] } {
  const d = j?.data ?? j ?? {};
  const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
  const rows: CourseRow[] = [];
  const students: StudentRow[] = [];

  courses.forEach((c) => {
    const co = c.course ?? {};
    const s = c.stats ?? {};
    const cid = String(co._id || c._id || "");
    rows.push({
      id: cid,
      name: co.courseName || c.courseName || "Untitled",
      code: co.courseCode || "—",
      client: co.clientName || "Unassigned",
      students: num(s.totalStudents ?? co.totalStudents),
      avg: num(s.averageProgress),
      done: num(s.completedStudents),
      prog: num(s.inProgressStudents),
      not: num(s.notStartedStudents),
    });
    (Array.isArray(c.students) ? c.students : []).forEach((stu: any) => {
      const p = stu.progress ?? stu;
      const st = stu.student ?? stu;
      students.push({
        name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
        course: co.courseName || c.courseName || "Course",
        courseId: cid,
        overall: num(p.overall ?? stu.overall),
        iDo: stageDone(p, "I_Do"),
        weDo: stageDone(p, "We_Do"),
        youDo: stageDone(p, "You_Do"),
        score: scoreOf(p),
        last: stu.lastActivity || null,
      });
    });
  });

  return { rows, students };
}

export function parseFeedback(j: any) {
  const docs = Array.isArray(j?.getAllFeedback) ? j.getAllFeedback : [];
  const out: { t: string; name: string; rating: number | null; title: string; courseId: string }[] = [];
  docs.forEach((f: any) =>
    (Array.isArray(f.studentResponses) ? f.studentResponses : []).forEach((r: any) =>
      out.push({
        t: r.submittedAt || "",
        name: r.studentName || "Student",
        rating: typeof r.overallRating === "number" ? r.overallRating : null,
        title: f.feedbackTitle || "Feedback",
        courseId: String(f.courseId || ""),
      }),
    ),
  );
  return out;
}

/* ── the model ────────────────────────────────────────────────────────────── */

export interface DeriveInput {
  filter: DashFilter;
  analytics: { rows: CourseRow[]; students: StudentRow[] };
  roster: any[];
  attendanceToday: any[];
  approvals: any[];
  feedback: ReturnType<typeof parseFeedback>;
  focusAttendance: any[];
  focusId: string | null;
}

export function deriveModel(input: DeriveInput): DashboardModel {
  const { filter, analytics, roster, attendanceToday, approvals, feedback, focusAttendance, focusId } = input;
  const { client, course, courseIds, clientOf } = filter;

  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  const inScope = (id: string) => inClient(id) && (course === "all" || id === course);

  const rows = analytics.rows.filter((r) => inScope(r.id));
  const studs = analytics.students.filter((s) => inScope(s.courseId));
  const filtered = client !== "all" || course !== "all";

  /* portfolio counts */
  const totalCourses = rows.length;
  const students = rows.reduce((s, r) => s + r.students, 0);
  const activeRows = rows.filter((r) => r.students > 0);
  const completion = mean(activeRows.map((r) => r.avg)) ?? 0;
  const st = rows.reduce(
    (a, r) => ({ done: a.done + r.done, prog: a.prog + r.prog, not: a.not + r.not }),
    { done: 0, prog: 0, not: 0 },
  );
  const clientsInScope = new Set(rows.map((r) => clientOf(r.id) || r.client)).size;
  const share = (v: number) => (students ? Math.round((v / students) * 100) : 0);

  /* score */
  const avgScore = mean(studs.map((x) => x.score).filter((v): v is number => v !== null));
  const scoreAgg = new Map<string, { s: number; n: number }>();
  studs.forEach((x) => {
    if (x.score !== null) {
      const e = scoreAgg.get(x.courseId) || { s: 0, n: 0 };
      e.s += x.score;
      e.n += 1;
      scoreAgg.set(x.courseId, e);
    }
  });
  const courseScore = (id: string): number | null => {
    const e = scoreAgg.get(id);
    return e && e.n ? Math.round(e.s / e.n) : null;
  };

  /* at risk — started but under 50%, worst first */
  const atRisk: RiskRow[] = studs
    .filter((x) => x.overall > 0 && x.overall < 50)
    .sort((a, b) => a.overall - b.overall)
    .map((x) => ({
      name: x.name,
      course: x.course,
      overall: x.overall,
      level: x.overall < 35 ? "Critical" : x.overall < 45 ? "High" : "Medium",
      tone: x.overall < 45 ? ("danger" as const) : ("warning" as const),
    }));

  /* recency */
  const now = Date.now();
  const DAY = 86_400_000;
  const active7 = studs.filter((x) => x.last && now - +new Date(x.last) <= 7 * DAY).length;
  const inactive7 = studs.filter(
    (x) => x.overall > 0 && x.overall < 80 && x.last && now - +new Date(x.last) > 7 * DAY,
  ).length;

  /* stage funnel */
  const stageMean = (k: "iDo" | "weDo" | "youDo") =>
    mean(studs.map((x) => x[k]).filter((v): v is number => v !== null));
  const stages: StageProgress[] = STAGE_META.map((m) => ({
    key: m.key,
    label: m.label,
    tag: m.tag,
    value: stageMean(m.key),
  }));

  /* attendance today */
  const ovRows = attendanceToday.filter((c: any) => inScope(String(c._id)));
  let batchT = 0;
  let batchM = 0;
  const attByClient = new Map<string, { marked: number; total: number }>();
  ovRows.forEach((c: any) => {
    if (!c.hasSchedule) return;
    const cn = clientOf(String(c._id)) || c.clientName || "Unassigned";
    const e = attByClient.get(cn) || { marked: 0, total: 0 };
    (Array.isArray(c.batches) ? c.batches : []).forEach((b: any) => {
      batchT += 1;
      e.total += 1;
      if (b.markedToday) {
        batchM += 1;
        e.marked += 1;
      }
    });
    attByClient.set(cn, e);
  });
  const pendingBatches = batchT - batchM;

  /* client rollup */
  const cMap = new Map<string, { students: number; avgs: number[]; scores: number[]; risk: number }>();
  rows.forEach((r) => {
    const cn = clientOf(r.id) || r.client || "Unassigned";
    const e = cMap.get(cn) || { students: 0, avgs: [], scores: [], risk: 0 };
    e.students += r.students;
    if (r.students > 0) e.avgs.push(r.avg);
    const sc = courseScore(r.id);
    if (sc !== null) e.scores.push(sc);
    cMap.set(cn, e);
  });
  studs
    .filter((x) => x.overall > 0 && x.overall < 50)
    .forEach((x) => {
      const cn = clientOf(x.courseId) || "Unassigned";
      const e = cMap.get(cn);
      if (e) e.risk += 1;
    });
  const clientsPerf: ClientPerf[] = [...cMap.entries()]
    .map(([name, e]) => ({
      name,
      students: e.students,
      avg: mean(e.avgs),
      score: mean(e.scores),
      risk: e.risk,
      attendance: attByClient.get(name) || null,
      sparks: rows
        .filter((r) => (clientOf(r.id) || r.client || "Unassigned") === name && r.students > 0)
        .map((r) => r.avg),
    }))
    .sort((a, b) => b.students - a.students);

  /* trainers — roster join onto analytics rows by course id */
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const tMap = new Map<string, { label: string; courses: Set<string>; students: Set<string> }>();
  roster
    .filter((c: any) => inScope(String(c._id)))
    .forEach((c: any) => {
      (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
        const us = Array.isArray(b.users) ? b.users : [];
        const batchStudents = us.filter((u: any) => {
          const rn = roleName(u.user?.role).toLowerCase();
          return rn.includes("student") || rn === "";
        });
        us.forEach((u: any) => {
          const rn = roleName(u.user?.role).toLowerCase();
          if (!rn.includes("trainer") && !rn.includes("faculty")) return;
          const email = u.user?.email || "";
          const key = String(u.user?._id || email || "trainer");
          const label =
            `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.trim() ||
            (email ? email.split("@")[0] : "Trainer");
          const e = tMap.get(key) || { label, courses: new Set<string>(), students: new Set<string>() };
          e.courses.add(String(c._id));
          batchStudents.forEach((s2: any) =>
            e.students.add(String(s2.user?._id || s2.user?.email || s2._id)),
          );
          tMap.set(key, e);
        });
      });
    });
  const trainerRows: TrainerPerf[] = [...tMap.values()]
    .map((t) => {
      const cs = [...t.courses].map((id) => rowById.get(id)).filter(Boolean) as CourseRow[];
      const withStud = cs.filter((c) => c.students > 0);
      return {
        name: t.label,
        courses: t.courses.size,
        students: t.students.size,
        comp: mean(withStud.map((c) => c.avg)),
        score: mean([...t.courses].map((id) => courseScore(id)).filter((v): v is number => v !== null)),
      };
    })
    .sort((a, b) => b.students - a.students);
  const rated = trainerRows.filter((t) => t.comp !== null);
  const topTrainer = rated.length > 1 ? [...rated].sort((a, b) => (b.comp as number) - (a.comp as number))[0] : null;
  const lowTrainer = rated.length > 1 ? [...rated].sort((a, b) => (a.comp as number) - (b.comp as number))[0] : null;

  /* activity feed */
  const apprRows = approvals.filter((a: any) => inScope(String(a.courseId || "")));
  const fbRows = feedback.filter((f) => inScope(f.courseId));
  const acts: ActivityItem[] = [];
  apprRows.forEach((a: any) =>
    acts.push({
      at: a.initiatedAt || "",
      tone: "warning",
      title: `${a.exerciseName || "Exercise"} sent for approval`,
      detail: `${a.tabType === "You_Do" ? "Assessment" : "Assignment"} · step ${num(a.currentStep) || 1} of ${num(a.totalSteps) || 1}`,
    }),
  );
  fbRows.forEach((f) =>
    acts.push({
      at: f.t,
      tone: "info",
      title: `${f.name} submitted feedback${f.rating !== null ? ` · ${f.rating}/10` : ""}`,
      detail: f.title,
    }),
  );
  [...studs]
    .filter((x) => x.last)
    .sort((a, b) => +new Date(b.last as string) - +new Date(a.last as string))
    .slice(0, 3)
    .forEach((x) =>
      acts.push({ at: x.last as string, tone: "success", title: `${x.name} active in course`, detail: x.course }),
    );
  const activity = acts
    .filter((a) => a.at)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 7);

  /* alerts — each row is a real work queue linked to its view */
  const lowCourses = activeRows.filter((r) => r.avg < 50).length;
  const alerts: AlertItem[] = (
    [
      { id: "att", count: pendingBatches, tone: "danger", icon: CalendarCheck, label: "Batches awaiting attendance today", href: "#attendance" },
      { id: "risk", count: atRisk.length, tone: "danger", icon: AlertTriangle, label: "Students at risk (below 50%)", href: "#perf-progress" },
      { id: "idle", count: inactive7, tone: "warning", icon: Clock, label: "Students inactive 7+ days", href: "#perf-progress" },
      { id: "appr", count: apprRows.length, tone: "warning", icon: ClipboardList, label: "Items awaiting your approval", href: "#appr-queue" },
      { id: "low", count: lowCourses, tone: "danger", icon: BookOpen, label: "Courses below 50% completion", href: "#courses" },
      { id: "new", count: st.not, tone: "neutral", icon: Users, label: "Students yet to start", href: "#perf-progress" },
    ] as AlertItem[]
  ).filter((a) => a.count > 0);

  /* focus course */
  let focus: FocusCourse | null = null;
  if (focusId) {
    const row = rowById.get(focusId);
    if (row) {
      const focusStuds = studs.filter((s) => s.courseId === focusId);
      const fMean = (k: "iDo" | "weDo" | "youDo") =>
        mean(focusStuds.map((x) => x[k]).filter((v): v is number => v !== null));

      let present = 0;
      focusAttendance.forEach((r: any) => {
        if (r.status === "P") present += 1;
        else if (r.status === "H") present += 0.5;
      });
      const attPct = focusAttendance.length ? Math.round((present / focusAttendance.length) * 100) : null;

      const wkMap = new Map<string, { p: number; t: number }>();
      focusAttendance.forEach((r: any) => {
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return;
        const k = mondayKey(d);
        const e = wkMap.get(k) || { p: 0, t: 0 };
        e.t += 1;
        if (r.status === "P") e.p += 1;
        else if (r.status === "H") e.p += 0.5;
        wkMap.set(k, e);
      });
      const weeks: WeekPoint[] = [...wkMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-6)
        .map(([k, e]) => ({ label: weekLabel(k), value: Math.round((e.p / e.t) * 100) }));

      focus = {
        id: row.id,
        name: row.name,
        students: row.students,
        completion: row.avg,
        score: courseScore(row.id),
        assignments: fMean("weDo"),
        attendance: attPct,
        weeks,
      };
    }
  }

  /* header scope */
  const courseRow = course !== "all" ? rows.find((r) => r.id === course) : null;
  const clientLabel =
    client !== "all" ? client : courseRow ? clientOf(courseRow.id) || "Unassigned" : "All clients";
  const scope = courseRow ? courseRow.name : client !== "all" ? client : "Portfolio overview";
  const subline =
    totalCourses === 0
      ? "No courses in this view"
      : courseRow
        ? `${clientLabel} · ${students.toLocaleString()} students enrolled`
        : `${clientLabel} · ${totalCourses} course${totalCourses === 1 ? "" : "s"} · ${students.toLocaleString()} students enrolled`;

  return {
    scope,
    subline,
    filtered,
    clients: clientsInScope,
    courses: totalCourses,
    activeCourses: activeRows.length,
    students,
    trainers: trainerRows.length,
    completion,
    avgScore,
    atRiskCount: atRisk.length,
    atRiskPct: share(atRisk.length),
    active7,
    active7Pct: share(active7),
    completed: st.done,
    inProgress: st.prog,
    notStarted: st.not,
    completedPct: share(st.done),
    inProgressPct: share(st.prog),
    notStartedPct: share(st.not),
    inactive7,
    pendingBatches,
    pendingApprovals: apprRows.length,
    lowCourses,
    stages,
    atRisk,
    clientsPerf,
    trainers_: trainerRows,
    topTrainer,
    lowTrainer,
    activity,
    alerts,
    focus,
  };
}

/**
 * Pick the course the L&D Head should look at first: the explicitly filtered
 * one, else the weakest course that actually has students.
 */
export function pickFocusCourse(
  rows: CourseRow[],
  course: string,
  inScope: (id: string) => boolean,
): string | null {
  const rs = rows.filter((r) => inScope(r.id));
  if (course !== "all") return rs.find((r) => r.id === course)?.id ?? null;
  const active = rs.filter((r) => r.students > 0);
  return active.length ? [...active].sort((a, b) => a.avg - b.avg)[0].id : null;
}
