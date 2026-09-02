"use client";
import { getToken } from "@/lib/session";

// ════════════════════════════════════════════════════════════════════════════
// You-Do · Test Instructions / Landing page
// ----------------------------------------------------------------------------
// Opened in a NEW TAB when a student clicks "Start" on a You-Do assessment.
// Shows a full, branded briefing — summary facts, topics covered, scoring,
// timing, instructions, important notes and the active proctoring rules — then
// a "Start Test" button routes (in this same tab) to the real test page.
//
// All state is sourced from localStorage (payload written by the list) + a fresh
// fetch by exerciseId, so a reload never loses it.
// ════════════════════════════════════════════════════════════════════════════

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock, FileText, Award, Target, Layers, ListChecks, BookOpen,
  Shield, Copy, Camera, ScanFace, Monitor, RefreshCw, Maximize,
  Play, ChevronRight, AlertTriangle, CheckCircle2, BarChart3, MinusCircle,
  Hourglass, Upload, PlayCircle, Loader2, AlertCircle, LogOut, UserX, ClipboardList,
} from "lucide-react";

const FONT = "'Poppins','Poppins','Segoe UI','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
const API_BASE = "https://lmsserver-yeve.onrender.com";

// ── helpers ─────────────────────────────────────────────────────────────────
function formatDuration(minutes?: number): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatDateTime(s?: string): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}
function getTotalQuestions(ex: any): number {
  if (Array.isArray(ex?.questions) && ex.questions.length > 0) return ex.questions.length;
  const qc = ex?.questionConfiguration || {};
  const count = (cfg: any): number => {
    if (!cfg) return 0;
    const t = cfg.questionConfigType;
    if (t === "general") return cfg.generalQuestionCount || 0;
    if (t === "levelBased") { const c = cfg.levelBasedCounts || {}; return (c.easy || 0) + (c.medium || 0) + (c.hard || 0); }
    if (t === "selectionLevel" || t === "selection") { const c = cfg.selectionLevelCounts || {}; return (c.easy || 0) + (c.medium || 0) + (c.hard || 0); }
    return cfg.generalQuestionCount || 0;
  };
  const mcq = qc.mcqQuestionConfiguration?.totalMcqQuestions || qc.mcqQuestionConfiguration?.totalQuestions || 0;
  const sum = mcq + count(qc.programmingQuestionConfiguration) + count(qc.othersQuestionConfiguration);
  if (sum > 0) return sum;
  return ex?.exerciseInformation?.totalQuestions || 0;
}
function getTotalMarks(ex: any): number | null {
  if (ex?.isGraded === false) return null;
  const info = ex?.exerciseInformation || {};
  return info.totalMarksProgramming || info.totalMarks || info.totalPoints || ex?.questionConfiguration?.mcqQuestionConfiguration?.totalMarks || null;
}
function getPassMark(ex: any): number | null {
  if (ex?.isGraded === false) return null;
  const g = ex?.gradeSettings || {};
  // combinedGradeToPass is the section-based / combined overall pass mark;
  // mcqGradeToPass is the generic single-type one.
  const direct = g.combinedGradeToPass ?? g.mcqGradeToPass ?? g.programmingGradeToPass ?? null;
  if (direct != null && direct !== "") return Number(direct);
  // Section-based fallback: sum the per-section pass marks if those were set
  // instead of an overall one.
  const spm = g.sectionPassMarks;
  if (spm && typeof spm === "object") {
    const sum = Object.values(spm).reduce((a: number, v: any) => a + (Number(v) || 0), 0);
    if (sum > 0) return sum;
  }
  return null;
}
function getMarksPerQuestion(ex: any): number | null {
  const mpq = ex?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion;
  if (mpq) return mpq;
  const tm = getTotalMarks(ex); const tq = getTotalQuestions(ex);
  if (tm && tq) return Math.round((tm / tq) * 100) / 100;
  return null;
}
function getSubmissionAttempts(ex: any): number {
  const qc = ex?.questionConfiguration || {};
  return qc.programmingQuestionConfiguration?.submissionAttempts
    || qc.mcqQuestionConfiguration?.submissionAttempts
    || qc.othersQuestionConfiguration?.submissionAttempts
    || 1;
}

// ── Section-based helpers (Part A / Part B …) ──
// Mirror SectionBasedTestPage's rawToArray + normaliseSections so the briefing
// lists sections exactly as the student will attend them.
interface InstrSection { key: string; name: string; id: string; order: number; exerciseType: string; totalMarks: number; totalDuration: number; }

// A section's marks aren't always on `section.totalMarks` — MCQ sections often
// only store the per-question score (equalDistribution), so the total must be
// derived as questionCount × marksPerQuestion. This mirrors SectionConfiguration's
// own marks math so the briefing matches what the teacher configured.
function computeSectionMarks(s: any): number {
  if (s?.totalMarks && s.totalMarks > 0) return s.totalMarks;
  const slice = (s?.mcqSectionMarks || 0) + (s?.programmingSectionMarks || 0);
  if (slice > 0) return slice;
  let m = 0;
  const mc = s?.mcqConfig;
  if (mc) {
    const ss = mc.scoreSettings || {};
    if (ss.scoreType === "questionSpecific" && ss.totalMarks) m += ss.totalMarks;
    else m += (mc.generalQuestionCount || 0) * (ss.equalDistribution || 0);
  }
  const pc = s?.programmingConfig;
  if (pc) {
    const ss = pc.scoreSettings || {};
    const cnt = pc.generalQuestionCount || 0;
    if (ss.equalDistribution) m += cnt * ss.equalDistribution;
    else if (ss.totalMarks) m += ss.totalMarks;
    else {
      // level-based fallback (easy/medium/hard).
      const ls = pc.levelScoring || ss.levelScoringConfiguration;
      const counts = pc.levelBasedCounts || pc.selectionLevelCounts;
      if (ls && counts) {
        (["easy", "medium", "hard"] as const).forEach(l => {
          const c = counts[l] || 0;
          const sc = ls[l];
          if (!c || !sc) return;
          if (sc.type === "level_specific" && sc.marksPerQuestion) m += c * sc.marksPerQuestion;
          else if (sc.totalMarks) m += sc.totalMarks;
          else if (sc.marksPerQuestion) m += c * sc.marksPerQuestion;
        });
      }
    }
  }
  return m;
}
function getInstrSections(ex: any): InstrSection[] {
  const rawToArray = (value: any): any[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return Object.entries(value).map(([key, sec]: [string, any]) => ({ ...(sec as object), _recordKey: key }));
    return [];
  };
  const rawArr = ex?.sectionConfigs ? rawToArray(ex.sectionConfigs) : rawToArray(ex?.sections);
  const list = rawArr.map((s: any): InstrSection => {
    const recordKey = s._recordKey as string | undefined;
    const name = s.name || s.sectionName || recordKey || s.id || s.sectionId || "";
    const id = s.id || s.sectionId || recordKey || name;
    return {
      key: recordKey || name || id, name, id,
      order: s.order ?? s.sectionNumber ?? 0,
      exerciseType: s.exerciseType || "",
      totalMarks: computeSectionMarks(s),
      totalDuration: s.totalDuration ?? s.duration ?? 0,
    };
  });

  // Section marks/duration are sometimes stored on the `sections` array
  // (SectionItem[]) rather than on `sectionConfigs`. Merge those in by matching
  // name / id / record-key so an explicit teacher-entered total is never lost
  // (mirrors how SectionBasedTestPage merges per-section durations).
  if (ex?.sectionConfigs) {
    const extra = rawToArray(ex?.sections);
    if (extra.length > 0) {
      const marksByKey = new Map<string, number>();
      const durByKey = new Map<string, number>();
      for (const d of extra) {
        const tm = Number(d.totalMarks) || 0;
        const du = Number(d.totalDuration ?? d.duration) || 0;
        [d.name, d.sectionName, d._recordKey, d.id, d.sectionId].filter(Boolean).forEach((k: any) => {
          if (tm > 0) marksByKey.set(String(k), tm);
          if (du > 0) durByKey.set(String(k), du);
        });
      }
      for (const s of list) {
        if (!(s.totalMarks > 0)) s.totalMarks = marksByKey.get(s.name) ?? marksByKey.get(s.id) ?? marksByKey.get(s.key) ?? s.totalMarks;
        if (!(s.totalDuration > 0)) s.totalDuration = durByKey.get(s.name) ?? durByKey.get(s.id) ?? durByKey.get(s.key) ?? s.totalDuration;
      }
    }
  }

  return list.sort((a, b) => a.order - b.order);
}
function isInstrSectionBased(ex: any): boolean {
  if (!ex) return false;
  if (ex.exerciseType === "SectionBased" || ex.isSectionBased === true) return true;
  return getInstrSections(ex).length > 0;
}
function sectionQuestionCount(ex: any, sec: InstrSection): number {
  const qs = Array.isArray(ex?.questions) ? ex.questions : [];
  return qs.filter((q: any) => {
    const sid = q?.sectionId != null ? String(q.sectionId) : "";
    return sid && (sid === sec.name || sid === sec.id || sid === sec.key);
  }).length;
}

// Group the flat selectedTopics ([{id,title,level}]) into module → bullets, the
// way the design lays them out. Top-level (minLevel) items become headers; any
// deeper items become the bullets under the preceding header.
function groupTopics(topics: any[]): { title: string | null; items: string[] }[] {
  if (!topics?.length) return [];
  const minLevel = Math.min(...topics.map((t) => t?.level ?? 0));
  const allSame = topics.every((t) => (t?.level ?? 0) === minLevel);
  if (allSame) return [{ title: null, items: topics.map((t) => t.title || t.name || String(t)) }];
  const groups: { title: string | null; items: string[] }[] = [];
  let current: { title: string | null; items: string[] } | null = null;
  topics.forEach((t) => {
    const lvl = t?.level ?? 0;
    const label = t.title || t.name || String(t);
    if (lvl === minLevel || !current) { current = { title: label, items: [] }; groups.push(current); }
    else current.items.push(label);
  });
  return groups;
}

// Resolve which test route + localStorage key an exercise maps to — mirrors the
// branching in [id]/page.tsx · handleExerciseSelect so behaviour stays identical.
function resolveRoute(ex: any): { key: string; path: string } {
  if (ex?.exerciseType === "SectionBased" || ex?.isSectionBased === true) return { key: "currentSectionBasedExercise", path: "sectionbased" };
  if (ex?.exerciseType === "Combined") return { key: "currentCombinedExercise", path: "combined" };
  if (ex?.programmingSettings?.selectedModule === "Frontend") return { key: "currentFrontendExercise", path: "frontend" };
  if (ex?.programmingSettings?.selectedModule === "Database") return { key: "currentSQLExercise", path: "sql" };
  if (ex?.exerciseType === "MCQ") return { key: "currentMCQExercise", path: "mcq" };
  if (ex?.exerciseType === "Other") return { key: "currentOthersExercise", path: "others" };
  return { key: "currentProgrammingExercise", path: "programming" };
}

// Security fields → label + icon for the "Fair Test Environment" tiles.
const SECURITY_TILES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "preventCopyPaste", label: "No Copy / Paste", icon: <Copy size={20} /> },
  { key: "preventScreenshot", label: "No Screenshot", icon: <Camera size={20} /> },
  { key: "preventTabSwitch", label: "No Tab Switch", icon: <UserX size={20} /> },
  { key: "requireFullscreen", label: "Full Screen Mode", icon: <Maximize size={20} /> },
  { key: "enableFaceVerification", label: "Face Verification", icon: <ScanFace size={20} /> },
  { key: "multipleFaceDetection", label: "Face Monitoring", icon: <Monitor size={20} /> },
];

// Compact availability gate (mirrors the list's getExerciseAvailability).
function computeAvailability(ex: any): { canStart: boolean; message: string; tone: "ok" | "warn" | "blocked" } {
  const now = new Date();
  const ap = ex?.availabilityPeriod || {};
  const start = ap.startDate ? new Date(ap.startDate) : null;
  const end = ap.endDate ? new Date(ap.endDate) : null;
  const grace = ap.gracePeriodAllowed && ap.gracePeriodDate ? new Date(ap.gracePeriodDate) : null;
  const cutoff = ap.cutOffEnabled && ap.cutOffDate ? new Date(ap.cutOffDate) : null;
  if (start && now < start) return { canStart: false, message: `Opens ${formatDateTime(ap.startDate)}`, tone: "blocked" };
  if (grace && end && now > end && now <= grace) return { canStart: true, message: `Grace period until ${formatDateTime(ap.gracePeriodDate)}`, tone: "warn" };
  if (end && now <= end) return { canStart: true, message: `Open until ${formatDateTime(ap.endDate)}`, tone: "ok" };
  if (cutoff && end && now > end && now <= cutoff) return { canStart: true, message: `Late submission until ${formatDateTime(ap.cutOffDate)}`, tone: "warn" };
  if (!start && !end) return { canStart: true, message: "Available now", tone: "ok" };
  return { canStart: false, message: "This assessment has expired", tone: "blocked" };
}

// ── reusable bits ─────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" };

function FactCell({ icon, accent, label, value }: { icon: React.ReactNode; accent: string; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: accent + "18", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: "#0f172a", fontWeight: 700, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      </div>
    </div>
  );
}

function SectionHead({ icon, accent, children }: { icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
      <span style={{ color: accent, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a" }}>{children}</span>
    </div>
  );
}

// ── main ────────────────────────────────────────────────────────────────────
function InstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseId = searchParams.get("exerciseId") || "";

  const [exercise, setExercise] = useState<any>(null);
  const [context, setContext] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!exerciseId) { setError("No assessment specified."); setLoading(false); return; }
    try {
      const raw = localStorage.getItem("youdo_test_intro_" + exerciseId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.exercise) setExercise(parsed.exercise);
        if (parsed?.context) setContext(parsed.context);
      }
    } catch { /* ignore */ }
  }, [exerciseId]);

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = getToken() || localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/exercise/${exerciseId}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const full = data?.data?.exercise || data?.data || data?.exercise || data;
          if (!cancelled && full?._id) setExercise((prev: any) => ({ ...(prev || {}), ...full }));
        }
      } catch { /* keep localStorage copy */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  const availability = useMemo(() => (exercise ? computeAvailability(exercise) : null), [exercise]);

  const info = exercise?.exerciseInformation || {};
  const isGraded = exercise?.isGraded !== false;
  const totalMarks = getTotalMarks(exercise);
  const passMark = getPassMark(exercise);
  const totalQ = exercise ? getTotalQuestions(exercise) : 0;
  const perQ = getMarksPerQuestion(exercise);
  const attempts = exercise ? getSubmissionAttempts(exercise) : 1;
  const security = exercise?.securitySettings || {};
  const activeTiles = SECURITY_TILES.filter((t) => !!security[t.key]);
  const selectedTopics: any[] = Array.isArray(exercise?.selectedTopics) ? exercise.selectedTopics : [];
  const topicGroups = useMemo(() => groupTopics(selectedTopics), [selectedTopics]);
  const sections = useMemo(() => getInstrSections(exercise), [exercise]);
  const sectionBased = isInstrSectionBased(exercise);
  const instructionsHtml: string = typeof exercise?.instructions === "string" ? exercise.instructions : "";
  const hasInstructions = !!instructionsHtml && instructionsHtml.replace(/<[^>]*>/g, "").trim().length > 0;
  const hierarchy: string[] = Array.isArray(context?.hierarchy) ? context.hierarchy.filter(Boolean) : [];
  const moduleName = hierarchy[0] || topicGroups[0]?.title || "—";
  // For section-based tests the exercise total is the sum of section marks.
  const sectionsTotalMarks = sections.reduce((sum, s) => sum + (s.totalMarks || 0), 0);
  const effectiveTotalMarks = sectionBased && sectionsTotalMarks > 0 ? sectionsTotalMarks : totalMarks;
  const passPercent = isGraded && passMark != null && effectiveTotalMarks ? Math.round((passMark / effectiveTotalMarks) * 100) : null;

  const handleStartTest = async () => {
    if (!exercise || starting) return;
    setStarting(true);

    // Fullscreen needs a real user gesture — request it inside the click so it
    // survives Next's client-side navigation and the test page stays locked.
    if (exercise?.securitySettings?.requireFullscreen && typeof document !== "undefined") {
      try {
        const el: any = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
      } catch { /* denied / unsupported */ }
    }

    const qs = Array.isArray(exercise.questions) ? exercise.questions : [];
    const courseId = context?.courseId || exercise?.courseId || "";
    const courseName = context?.courseName || exercise?.courseName || "Course";
    const { key, path } = resolveRoute(exercise);

    const stored = {
      ...exercise, questions: qs, courseId, courseName,
      context: { courseId, nodeId: context?.nodeId, nodeTitle: context?.nodeName, method: context?.method, activity: context?.subcategory },
      storedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(key, JSON.stringify(stored)); } catch { /* quota */ }

    const params = new URLSearchParams({
      courseId, courseName,
      exerciseId: exercise._id || exerciseId,
      subcategory: context?.subcategory || "",
      category: context?.category || "You_Do",
      questionCount: String(qs.length),
      exerciseName: info.exerciseName || "Assessment",
      nodeId: context?.nodeId || "", nodeName: context?.nodeName || "", nodeType: context?.nodeType || "",
      hierarchy: hierarchy.join(","),
      securityAck: "1",
    });
    router.push(`/lms/pages/courses/coursesdetailedview/youdo/${path}?${params.toString()}`);
  };

  // ── load / error ──────────────────────────────────────────────────────────
  if (loading && !exercise) {
    return (
      <div style={{ minHeight: "calc(100vh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: "#ffffff" }}>
        <Loader2 className="animate-spin" size={28} style={{ color: "#64748b" }} />
      </div>
    );
  }
  if (error || !exercise) {
    return (
      <div style={{ minHeight: "calc(100vh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: "#ffffff" }}>
        <div style={{ textAlign: "center", color: "#64748b", padding: 24 }}>
          <AlertCircle size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{error || "Assessment not found"}</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Close this tab and try starting the test again.</div>
        </div>
      </div>
    );
  }

  const accentBar = (c: string): React.CSSProperties => ({ borderLeft: `3px solid ${c}`, paddingLeft: 14 });
  const moduleColors = ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];

  return (
    <div style={{ minHeight: "calc(100vh * var(--ui-scale-inv, 1))", background: "#ffffff", fontFamily: FONT, padding: "26px 18px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        /* Dark, visible scrollbar on this route. */
        html, body { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
          background: #475569; border-radius: 8px; border: 2px solid transparent; background-clip: content-box;
        }
        html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover {
          background: #1e293b; background-clip: content-box;
        }
      `}</style>
      <div style={{ maxWidth: 980, margin: "0 auto", ...CARD, padding: "26px 28px 30px", borderRadius: 22, border: "none", boxShadow: "none" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#fff7ed", color: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ClipboardList size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.15 }}>Test Instructions</h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Please read all the instructions carefully before starting the test.</p>
            </div>
          </div>
          <div style={{ width: 110, height: 84, borderRadius: 14, background: "linear-gradient(135deg,#fff7ed,#e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ClipboardList size={34} style={{ color: "#fb923c" }} />
            <Clock size={22} style={{ color: "#6366f1", marginLeft: -8, marginTop: 14 }} />
          </div>
        </div>

        {/* ── Summary fact grid (3×3) ── */}
        <div style={{ ...CARD, marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", rowGap: 2, columnGap: 0, overflow: "hidden" }}>
          <FactCell icon={<FileText size={18} />} accent="#f97316" label="Test Name" value={info.exerciseName || "Assessment"} />
          <FactCell icon={<BookOpen size={18} />} accent="#16a34a" label="Module" value={moduleName} />
          <FactCell icon={<Layers size={18} />} accent="#7c3aed" label="Topics Covered" value={`${selectedTopics.length} Topic${selectedTopics.length === 1 ? "" : "s"}`} />
          <FactCell icon={<ListChecks size={18} />} accent="#d97706" label="Total Questions" value={`${totalQ || "—"} ${totalQ ? "Questions" : ""}`} />
          <FactCell icon={<Award size={18} />} accent="#0d9488" label="Total Marks" value={isGraded ? (effectiveTotalMarks ? `${effectiveTotalMarks} Marks` : "—") : "Practice"} />
          <FactCell icon={<Clock size={18} />} accent="#0891b2" label="Test Duration" value={info.totalDuration ? `${info.totalDuration} Minutes` : "—"} />
          <FactCell icon={<Target size={18} />} accent="#16a34a" label="Passing Score" value={passPercent != null ? `${passPercent}%` : passMark != null ? `${passMark} Marks` : isGraded ? "—" : "Practice"} />
          <FactCell icon={<BarChart3 size={18} />} accent="#dc2626" label="Difficulty Level" value={<span style={{ textTransform: "capitalize" }}>{info.exerciseLevel || "—"}</span>} />
          <FactCell icon={<RefreshCw size={18} />} accent="#4f46e5" label="Attempts Allowed" value={`${attempts} Attempt${attempts === 1 ? "" : "s"}`} />
        </div>

        {/* ── Two columns ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Topics Covered */}
            <div style={{ ...CARD, padding: "18px 20px" }}>
              <SectionHead icon={<BookOpen size={18} />} accent="#f97316">Topics Covered</SectionHead>
              {topicGroups.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No specific topics were attached to this assessment.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {topicGroups.map((g, i) => {
                    const c = moduleColors[i % moduleColors.length];
                    return (
                      <div key={i} style={{ ...accentBar(c), background: c + "0D", borderRadius: "0 10px 10px 0", padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: c, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{g.title || "Selected Topics"}</span>
                        </div>
                        {g.items.length > 0 && (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 30, display: "flex", flexDirection: "column", gap: 4 }}>
                            {g.items.map((it, j) => (
                              <li key={j} style={{ fontSize: 12.5, color: "#475569", listStyleType: "disc" }}>{it}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sections (only for section-based tests — Part A / Part B …) */}
            {sectionBased && sections.length > 0 && (
              <div style={{ ...CARD, padding: "18px 20px" }}>
                <SectionHead icon={<Layers size={18} />} accent="#7c3aed">Sections</SectionHead>
                <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>
                  This is a section-based test. You'll attend each section in order; details below.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.map((s, i) => {
                    const c = moduleColors[i % moduleColors.length];
                    const qCount = sectionQuestionCount(exercise, s);
                    return (
                      <div key={s.key || i} style={{ ...accentBar(c), background: c + "0D", borderRadius: "0 10px 10px 0", padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: c, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{s.name || `Section ${i + 1}`}</span>
                          {s.exerciseType && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c + "1A", color: c, textTransform: "uppercase" }}>{s.exerciseType}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#475569", paddingLeft: 28 }}>
                          {qCount > 0 && <span><b style={{ color: "#0f172a" }}>{qCount}</b> Question{qCount === 1 ? "" : "s"}</span>}
                          {s.totalMarks > 0 && <span><b style={{ color: "#0f172a" }}>{s.totalMarks}</b> Marks</span>}
                          {s.totalDuration > 0 && <span><b style={{ color: "#0f172a" }}>{s.totalDuration}</b> min</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scoring Information */}
            {isGraded && (
              <div style={{ ...CARD, padding: "18px 20px" }}>
                <SectionHead icon={<Award size={18} />} accent="#d97706">Scoring Information</SectionHead>
                {sectionBased && sections.length > 0 ? (
                  // ── Per-section scoring (Part A / Part B …) — marks differ by section ──
                  <div style={{ border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 86px 80px", background: "#f8fafc", fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <div style={{ padding: "10px 14px" }}>Section</div>
                      <div style={{ padding: "10px 6px", textAlign: "center" }}>Questions</div>
                      <div style={{ padding: "10px 12px", textAlign: "center" }}>Marks</div>
                    </div>
                    {sections.map((s, i) => {
                      const qc = sectionQuestionCount(exercise, s);
                      return (
                        <div key={s.key || i} style={{ display: "grid", gridTemplateColumns: "1fr 86px 80px", borderTop: "1px solid #f1f5f9", fontSize: 13 }}>
                          <div style={{ padding: "10px 14px", color: "#334155", fontWeight: 600 }}>
                            {s.name || `Section ${i + 1}`}
                            {s.exerciseType ? <span style={{ color: "#94a3b8", fontWeight: 500 }}> · {s.exerciseType}</span> : null}
                          </div>
                          <div style={{ padding: "10px 6px", textAlign: "center", color: "#475569" }}>{qc || "—"}</div>
                          <div style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#0f172a" }}>{s.totalMarks || "—"}</div>
                        </div>
                      );
                    })}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 86px 80px", borderTop: "1px solid #e2e8f0", background: "#fff7ed", fontSize: 13.5 }}>
                      <div style={{ padding: "11px 14px", color: "#f97316", fontWeight: 700 }}>Total</div>
                      <div style={{ padding: "11px 6px", textAlign: "center", fontWeight: 800, color: "#f97316" }}>{totalQ || "—"}</div>
                      <div style={{ padding: "11px 12px", textAlign: "center", fontWeight: 800, color: "#f97316" }}>{effectiveTotalMarks ?? "—"}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", background: "#f8fafc", fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <div style={{ padding: "10px 14px" }}>Criteria</div>
                      <div style={{ padding: "10px 14px", textAlign: "center" }}>Marks</div>
                    </div>
                    {[
                      { c: "Correct Answer", m: perQ != null ? `+${perQ}` : "+1", color: "#16a34a" },
                      { c: "Incorrect Answer", m: "0", color: "#dc2626" },
                      { c: "Unanswered", m: "0", color: "#64748b" },
                    ].map((r, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px", borderTop: "1px solid #f1f5f9", fontSize: 13 }}>
                        <div style={{ padding: "10px 14px", color: "#334155" }}>{r.c}</div>
                        <div style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: r.color }}>{r.m}</div>
                      </div>
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", borderTop: "1px solid #e2e8f0", background: "#fff7ed", fontSize: 13.5 }}>
                      <div style={{ padding: "11px 14px", color: "#f97316", fontWeight: 700 }}>Total Score</div>
                      <div style={{ padding: "11px 14px", textAlign: "center", fontWeight: 800, color: "#f97316" }}>{effectiveTotalMarks ?? "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Duration & Timing */}
            <div style={{ ...CARD, padding: "18px 20px" }}>
              <SectionHead icon={<Clock size={18} />} accent="#f97316">Test Duration &amp; Timing</SectionHead>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Line icon={<Clock size={15} />}>Total Time: <b style={{ color: "#f97316" }}>{info.totalDuration ? `${info.totalDuration} Minutes` : "—"}</b></Line>
                <Line icon={<PlayCircle size={15} />}>Timer starts immediately after clicking Start Test.</Line>
                <Line icon={<Upload size={15} />}>Auto-submit when time expires.</Line>
                <Line icon={<Hourglass size={15} />}>No extra time will be provided.</Line>
              </div>
            </div>

            {/* Test Instructions */}
            <div style={{ ...CARD, padding: "18px 20px" }}>
              <SectionHead icon={<ListChecks size={18} />} accent="#16a34a">Test Instructions</SectionHead>
              {hasInstructions ? (
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }} dangerouslySetInnerHTML={{ __html: instructionsHtml }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Ensure a stable internet connection.",
                    "Read each question carefully before answering.",
                    "You may navigate between questions.",
                    "Answers are automatically saved.",
                    "Use of external resources is prohibited.",
                    "Do not refresh or close the browser during the test.",
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 13, color: "#475569" }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Important Notes */}
            <div style={{ ...CARD, padding: "18px 20px" }}>
              <SectionHead icon={<AlertTriangle size={18} />} accent="#dc2626">Important Notes</SectionHead>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Once started, the test cannot be paused.",
                  ...(security.preventTabSwitch ? ["Switching tabs may be recorded."] : []),
                  "Any malpractice may result in test termination.",
                  "Results will be available after submission.",
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <AlertTriangle size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: "#475569" }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fair Test Environment */}
            <div style={{ ...CARD, padding: "18px 20px", background: "#fff7ed", borderColor: "#ffedd5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                <Shield size={18} style={{ color: "#f97316" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Ensure a Fair Test Environment</span>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 14px 27px" }}>This test is monitored to ensure fairness and integrity.</p>
              {activeTiles.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {activeTiles.map((t) => (
                    <div key={t.key} style={{ background: "#fff", border: "1px solid #ffedd5", borderRadius: 12, padding: "14px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                      <span style={{ color: "#f97316" }}>{t.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", lineHeight: 1.3 }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "#64748b", marginLeft: 27 }}>No special restrictions are enabled for this assessment.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom summary strip ── */}
        <div style={{ marginTop: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "16px 22px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <Strip icon={<ListChecks size={18} />} label="Questions" value={`${totalQ || "—"}`} />
          <Strip icon={<Clock size={18} />} label="Duration" value={info.totalDuration ? `${info.totalDuration} min` : "—"} />
          <Strip icon={<Target size={18} />} label="Passing Score" value={passPercent != null ? `${passPercent}%` : passMark != null ? `${passMark}` : "—"} />
          <Strip icon={<RefreshCw size={18} />} label="Attempts" value={`1 / ${attempts}`} />
        </div>

        {/* ── Actions ── */}
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {availability && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: availability.tone === "blocked" ? "#b91c1c" : availability.tone === "warn" ? "#c2410c" : "#15803d" }}>
              {availability.message}
            </div>
          )}
          <button
            onClick={handleStartTest}
            disabled={!availability?.canStart || starting}
            style={{
              width: "100%", maxWidth: 520, padding: "15px 0", borderRadius: 12, border: "none",
              fontSize: 16, fontWeight: 700, color: "#fff",
              cursor: availability?.canStart && !starting ? "pointer" : "not-allowed",
              opacity: availability?.canStart && !starting ? 1 : 0.55,
              background: "linear-gradient(135deg,#f97316,#ea580c)", boxShadow: "0 8px 20px rgba(249,115,22,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {starting ? <><Loader2 size={18} className="animate-spin" /> Starting…</> : <><PlayCircle size={20} /> Start Test</>}
          </button>
          {/* <button
            onClick={() => window.close()}
            style={{
              width: "100%", maxWidth: 520, padding: "13px 0", borderRadius: 12, border: "1px solid #e2e8f0",
              fontSize: 14.5, fontWeight: 600, color: "#475569", background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <LogOut size={17} /> Save &amp; Exit
          </button> */}
        </div>
      </div>
    </div>
  );
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "#94a3b8", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "#475569" }}>{children}</span>
    </div>
  );
}

function Strip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ color: "#d97706", flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11.5, color: "#a16207", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#92400e", marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

export default function YouDoInstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "calc(100vh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: "#ffffff" }}>
        <Loader2 className="animate-spin" size={28} style={{ color: "#64748b" }} />
      </div>
    }>
      <InstructionsContent />
    </Suspense>
  );
}
