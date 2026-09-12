"use client";
import { getToken } from "@/lib/session";
 
// ════════════════════════════════════════════════════════════════════════════
// We-Do · Assignment pre-start page
// ----------------------------------------------------------------------------
// Replaces the old StartExercisePopup modal for We_Do assignments. The student
// clicking Start on a We_Do row lands here first, sees a breadcrumb trail, a
// summary strip, the author's Instructions (or an auto-generated checklist when
// nothing was authored), the FULL mark-allocation + pass criteria, the rest of
// the assignment's configuration, consents, and then clicks Start Assignment →
// routes to the actual workspace.
//
// State sources (mirror the You_Do instructions page):
//   • localStorage("wedo_test_intro_" + exerciseId)   — fast hydrate
//   • GET /exercise/:id                                — reload-safe fetch
//
// Marks maths lives in @/lib/exerciseMarks so this page only renders — the
// teacher can score by even marks, per-level marks, per-question marks or by
// section, and the resolver flattens all of those into one table.
// ════════════════════════════════════════════════════════════════════════════
 
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, ArrowLeft, Play, User, Home, ChevronRight, CalendarDays, Clock,
  FileText, RotateCcw, Trophy, ClipboardCheck, Code2, Award,
  AlertTriangle, ListChecks, Layers, Target, CheckCircle2, Gauge,
  SlidersHorizontal,
} from "lucide-react";
import { resolveExerciseInstructions } from "@/lib/exerciseInstructions";
import { resolveMarkPlan } from "@/lib/exerciseMarks";
import { API_ORIGIN } from '@/lib/apiBase'
 
const FONT = "'Poppins','Poppins','Segoe UI','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
const API_BASE = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) {
    return `${API_ORIGIN}`;
  }
  return "https://lms-server-3-wedg.onrender.com";
})();
 
// Design tokens — one orange ramp plus neutrals, so the whole page reads as a
// single-hue system. Accent variety comes from tint steps, never a second hue.
const T = {
  o50: "#FFF8F1", o100: "#FFEEE0", o200: "#FED7AA", o300: "#FDBA74",
  o400: "#FB923C", o500: "#F97316", o600: "#EA580C", o700: "#C2410C",
  page: "#F7F7FB", card: "#FFFFFF", panel: "#FBFBFD",
  text: "#1A1A2E", sub: "#6B6B7E", muted: "#8B8B9E", hint: "#BCBCCC",
  border: "#E9E9F1", borderSoft: "#F2F2F7",
};
const CARD: React.CSSProperties = {
  background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
  boxShadow: "0 1px 2px rgba(26,26,46,0.04)",
};
 
// ── helpers ─────────────────────────────────────────────────────────────────
function formatDateTime(s?: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-US", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}
function formatDueLine(s?: string): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${sameDay ? "Due today" : `Due ${d.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`} · ${time}`;
  } catch { return ""; }
}
const capitalise = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
function pickTotalQuestions(ex: any): number {
  if (Array.isArray(ex?.questions) && ex.questions.length > 0) return ex.questions.length;
  return ex?.exerciseInformation?.totalQuestions || 0;
}
function pickLanguages(ex: any): string[] {
  const langs = ex?.programmingSettings?.selectedLanguages || ex?.exerciseInformation?.selectedLanguages || [];
  if (!Array.isArray(langs)) return [];
  return langs.filter(Boolean).map((l: string) =>
    String(l).toLowerCase() === "python" ? "Python 3.11" : String(l).replace(/^./, (c: string) => c.toUpperCase()),
  );
}
function pickEvaluationLabel(ex: any): string {
  const m = (ex?.evaluationMethod?.method || ex?.evaluationMethod || "").toString().toLowerCase();
  if (m === "ai") return "AI review";
  if (m === "testcase" || m === "test-case") return "Auto tests";
  return "Manual";
}
function evaluationNote(ex: any): string {
  const m = (ex?.evaluationMethod?.method || ex?.evaluationMethod || "").toString().toLowerCase();
  if (m === "ai") return "An AI reviewer grades each solution against the trainer's criteria, so readable, well-structured code scores best.";
  if (m === "testcase" || m === "test-case") return "Marks are awarded automatically by running your code against the stored test cases — including hidden ones you cannot see while solving.";
  return "Your trainer reviews and grades each submission manually after the deadline.";
}
const AI_CRITERIA_LABEL: Record<string, string> = {
  correctness: "Correctness", codeQuality: "Code quality", efficiency: "Efficiency",
  readability: "Readability", edgeCases: "Edge cases", bestPractices: "Best practices",
};
function pickAttempts(ex: any): { left: number; total: number } {
  const total =
    ex?.programmingSettings?.submissionAttempts ||
    ex?.evaluationSettings?.submissionAttempts ||
    ex?.questionConfiguration?.programmingQuestionConfiguration?.submissionAttempts ||
    ex?.questionConfiguration?.mcqQuestionConfiguration?.submissionAttempts ||
    ex?.questionConfiguration?.othersQuestionConfiguration?.submissionAttempts ||
    1;
  return { left: total, total }; // Actual "left" needs studentAnswers, unavailable on this page — show configured attempts.
}
function pickDifficulty(ex: any): string {
  const d = (ex?.exerciseInformation?.exerciseLevel || "").toString().toLowerCase();
  if (d === "beginner") return "Easy";
  if (d === "expert") return "Hard";
  if (!d) return "";
  return capitalise(d);
}
function pickAssignedBy(ex: any): string {
  return ex?.createdBy || ex?.assignedBy || ex?.author?.name || "";
}
function testTypeLabel(t?: string): string {
  const v = (t || "").toLowerCase();
  if (v === "mock") return "Mock test";
  if (v === "final") return "Final assessment";
  if (v === "practice") return "Practice";
  return "";
}
 
// Route resolution mirrors handleExerciseSelect in coursesdetailedview/[id]/page.tsx
// so navigating from this page matches the existing wedo/programming pattern.
function resolveWeDoRoute(ex: any): { key: string; path: string } | null {
  if (ex?.exerciseType === "Combined") return { key: "currentCombinedExercise", path: "combined" };
  if (ex?.programmingSettings?.selectedModule === "Frontend") return { key: "currentFrontendExercise", path: "frontend" };
  if (ex?.programmingSettings?.selectedModule === "Database") return { key: "currentSQLExercise", path: "sql" };
  if (ex?.exerciseType === "MCQ") return { key: "currentMCQExercise", path: "mcq" };
  if (ex?.exerciseType === "Other") return { key: "currentOthersExercise", path: "others" };
  return { key: "currentProgrammingExercise", path: "programming" };
}
 
// ── small presentational pieces ─────────────────────────────────────────────
function IconTile({ children, size = 34, strong = false }: { children: React.ReactNode; size?: number; strong?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: 9, flexShrink: 0,
      background: strong ? T.o100 : T.o50, color: strong ? T.o700 : T.o600,
      border: `1px solid ${strong ? T.o200 : T.o100}`,
    }}>
      {children}
    </span>
  );
}
 
function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <IconTile>{icon}</IconTile>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13.5, color: T.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      </div>
    </div>
  );
}
 
function CardHead({ icon, title, note }: { icon: React.ReactNode; title: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 16 }}>
      <IconTile strong>{icon}</IconTile>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3 }}>{title}</h2>
        {note && <p style={{ fontSize: 12.5, color: T.sub, margin: "3px 0 0", lineHeight: 1.5 }}>{note}</p>}
      </div>
    </div>
  );
}
 
/** Compact "12 · Marks" tile used across the marks card. */
function StatTile({ label, value, hint, accent = false }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div style={{
      padding: "11px 13px", borderRadius: 10,
      background: accent ? T.o50 : T.panel,
      border: `1px solid ${accent ? T.o200 : T.border}`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: accent ? T.o700 : T.muted, fontWeight: 600, letterSpacing: 0.2, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ? T.o700 : T.text, lineHeight: 1.15 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}
 
function Chip({ children, solid = false }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: solid ? T.o600 : T.o50, color: solid ? "#fff" : T.o700,
      border: `1px solid ${solid ? T.o600 : T.o200}`, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}
 
// ── Main ────────────────────────────────────────────────────────────────────
function WedoInstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseId = searchParams.get("exerciseId") || "";
 
  const [exercise, setExercise] = useState<any>(null);
  const [context, setContext] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
 
  // 1) localStorage hydrate.
  useEffect(() => {
    if (!exerciseId) { setError("No assignment specified."); setLoading(false); return; }
    try {
      const raw = localStorage.getItem("wedo_test_intro_" + exerciseId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.exercise) setExercise(parsed.exercise);
        if (parsed?.context) setContext(parsed.context);
      }
    } catch { /* ignore */ }
  }, [exerciseId]);
 
  // 2) Fetch by id — reload-safe even if localStorage was cleared.
  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = getToken() || (typeof window !== "undefined" ? localStorage.getItem("token") : "") || "";
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
 
  const info = exercise?.exerciseInformation || {};
  const totalQ = useMemo(() => pickTotalQuestions(exercise), [exercise]);
  const languages = useMemo(() => pickLanguages(exercise), [exercise]);
  const evalLabel = useMemo(() => pickEvaluationLabel(exercise), [exercise]);
  const attempts = useMemo(() => pickAttempts(exercise), [exercise]);
  const difficulty = useMemo(() => pickDifficulty(exercise), [exercise]);
  const assignedBy = useMemo(() => pickAssignedBy(exercise), [exercise]);
  const marks = useMemo(() => resolveMarkPlan(exercise || {}), [exercise]);
  const availability = exercise?.availabilityPeriod || info.availabilityPeriod || {};
  const dueDate = info.availabilityPeriod?.endDate || exercise?.availabilityPeriod?.endDate || "";
  const dueLine = formatDueLine(dueDate);
  const dueRight = dueDate ? `Due ${formatDateTime(dueDate)}` : "";
  const instructions = useMemo(() => resolveExerciseInstructions(exercise || {}), [exercise]);
  const passing = marks.passPercent;
 
  // Breadcrumb trail — Home → course → module → sub-module → topic → sub-topic
  // → activity → assignment → Instructions.
  //
  // `context.hierarchy` is the ordered list of node TITLES the course tree
  // walked to reach this exercise, written by handleItemSelect in
  // coursesdetailedview/[id] (it maps the hierarchy ids through findLabel, so
  // the depth varies: a module-level topic yields two crumbs, a sub-topic four).
  // Rendering it verbatim keeps this page's trail identical to the one the
  // student followed. A reload that lost the stash collapses to the shorter
  // course → activity trail rather than showing placeholders.
  const courseId = context?.courseId || exercise?.courseId || "";
  const courseName = context?.courseName || exercise?.courseName || "";
  const activityLabel = capitalise(
    context?.subcategory || (context?.category === "We_Do" ? "Assignments" : context?.category) || "Assignments",
  );
  const trail = useMemo(() => {
    const raw = Array.isArray(context?.hierarchy) ? context.hierarchy : [];
    let nodes = raw
      .map((h: any) => String(h ?? "").trim())
      .filter((h: string) => h && h !== "Unknown");
    if (nodes.length === 0) {
      const node = String(context?.nodeName || context?.nodeTitle || "").trim();
      if (node) nodes = [node];
    }
    // Drop consecutive repeats — a node selected at its own level can appear
    // both in the hierarchy and as nodeName.
    return [courseName, ...nodes, activityLabel]
      .map((s) => String(s || "").trim())
      .filter((s, i, arr) => s && s !== arr[i - 1]);
  }, [context, courseName, activityLabel]);
 
  // Everything not already in the summary strip, rendered as a definition list.
  // Only rows the teacher actually configured are listed.
  const details = useMemo(() => {
    const rows: { label: string; value: React.ReactNode }[] = [];
    const push = (label: string, value: any) => {
      if (value === null || value === undefined || value === "" || value === false) return;
      rows.push({ label, value });
    };
    const progCfg = exercise?.questionConfiguration?.programmingQuestionConfiguration;
    const mcqCfg = exercise?.questionConfiguration?.mcqQuestionConfiguration;
    const flowCfg = progCfg || exercise?.questionConfiguration?.othersQuestionConfiguration;
    const aiCriteria: string[] = exercise?.evaluationMethod?.ai?.criteria || [];
 
    push("Exercise type", exercise?.exerciseType);
    push("Module", exercise?.programmingSettings?.selectedModule || info.selectedModule);
    push("Difficulty level", capitalise(info.exerciseLevel));
    push("Test type", testTypeLabel(info.testType));
    push("Grading", exercise?.isGraded === false ? "Practice — not graded" : "Graded");
    push("Languages", languages.length > 0 ? languages.join(", ") : "");
    push("Question flow", flowCfg?.questionFlow === "controlled" ? "One question at a time" : flowCfg?.questionFlow ? "Answer in any order" : "");
    push("Editor files", progCfg?.compilerFileMode === "multiple" ? "Multiple files" : progCfg?.compilerFileMode === "single" ? "Single file" : "");
    push("Run code", progCfg?.allowCodeExecution === false ? "Disabled" : progCfg ? "Enabled before submitting" : "");
    push("Sample test cases", progCfg?.showSampleCases === false ? "Hidden" : progCfg?.enableTestCases ? "Visible while solving" : "");
    push("Question order", mcqCfg?.shuffleQuestions ? "Shuffled per student" : "");
    push("Attempts allowed", `${attempts.total}`);
    push("Evaluation", evalLabel);
    push("AI review criteria", aiCriteria.map((c) => AI_CRITERIA_LABEL[c] || c).join(", "));
    push("Opens", formatDateTime(availability.startDate));
    push("Due", formatDateTime(availability.endDate || dueDate));
    push("Cut-off", availability.cutOffEnabled ? formatDateTime(availability.cutOffDate) : "");
    push("Grace period",
      availability.gracePeriodEnabled || availability.gracePeriodAllowed
        ? (availability.extendedDays ? `${availability.extendedDays} extra day${availability.extendedDays === 1 ? "" : "s"}` : formatDateTime(availability.gracePeriodDate))
        : "");
    push("Submission", exercise?.additionalOptions?.anonymousSubmissions ? "Anonymous to the grader" : "");
    return rows;
  }, [exercise, info, languages, attempts.total, evalLabel, availability, dueDate]);
 
  const handleBack = () => {
    router.back();
  };
  const goToCourse = () => {
    if (courseId) router.push(`/lms/pages/courses/coursesdetailedview/${courseId}`);
    else router.back();
  };
 
  const handleStart = async () => {
    if (!exercise || starting) return;
    setStarting(true);
    const qs = Array.isArray(exercise.questions) ? exercise.questions : [];
    const cId = context?.courseId || exercise?.courseId || "";
    const cName = context?.courseName || exercise?.courseName || "Course";
    const route = resolveWeDoRoute(exercise);
    if (!route) { setStarting(false); return; }
 
    const stored = {
      ...exercise, questions: qs, courseId: cId, courseName: cName,
      context: {
        courseId: cId,
        nodeId: context?.nodeId,
        nodeTitle: context?.nodeName || context?.nodeTitle,
        method: context?.method || "we-do",
        activity: context?.subcategory,
      },
      storedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(route.key, JSON.stringify(stored)); } catch { /* quota */ }
 
    // Only the multi-file programming path lives under wedo/*. Other types
    // (MCQ / Frontend / SQL / Others / Combined) still use the inline overlay
    // driven by the course detail page — send the student back there with a
    // marker so it can auto-open the overlay next paint.
    const hier = Array.isArray(context?.hierarchy) ? context.hierarchy.filter(Boolean) : [];
    if (route.path === "programming") {
      const params = new URLSearchParams({
        courseId: cId, courseName: cName,
        exerciseId: exercise._id || exerciseId,
        exerciseName: info.exerciseName || "Assignment",
        subcategory: context?.subcategory || "",
        category: context?.category || "We_Do",
        nodeId: context?.nodeId || "",
        nodeName: context?.nodeName || "",
        nodeType: context?.nodeType || "",
        hierarchy: hier.join(","),
      });
      router.push(`/lms/pages/courses/coursesdetailedview/wedo/programming?${params.toString()}`);
    } else {
      // Fallback: land on the course detail page — the launcher there
      // picks up the localStorage stash and opens the type-appropriate overlay.
      router.push(`/lms/pages/courses/coursesdetailedview/${cId}`);
    }
  };
 
  // ── load / error ─────────────────────────────────────────────────────────
  if (loading && !exercise) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: T.o500 }} />
      </div>
    );
  }
  if (error || !exercise) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <div style={{ textAlign: "center", color: T.sub, padding: 24 }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{error || "Assignment not found."}</p>
          <button onClick={handleBack} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.text, cursor: "pointer", fontFamily: FONT }}>Go back</button>
        </div>
      </div>
    );
  }
 
  const canStart = acknowledged && !starting;
  const isGraded = marks.isGraded;
  const levelPass = marks.levelPassMarks;
  const showAllocation = isGraded && (marks.rows.length > 0 || marks.sections.length > 0);
 
  return (
    <div style={{ minHeight: "100vh", background: T.page, color: T.text, fontFamily: FONT }}>
      {/* Full-bleed: the page fills the viewport with a 2% gutter each side
          rather than sitting in a centred column, so nothing is wasted to
          empty margins on a wide screen. */}
      <div style={{ padding: "18px 2% 40px" }}>
 
        {/* ── Breadcrumbs ──────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 12.5, marginBottom: 14 }}>
          <button type="button" onClick={goToCourse} aria-label="Course home"
            style={{ display: "inline-flex", alignItems: "center", border: "none", background: "none", padding: 2, cursor: "pointer", color: T.o600 }}>
            <Home size={14} />
          </button>
          {trail.map((crumb, i) => (
            <React.Fragment key={`${crumb}-${i}`}>
              <ChevronRight size={13} style={{ color: T.hint }} />
              <button type="button" onClick={goToCourse} title={crumb}
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: T.o600, fontWeight: 600, fontSize: 12.5, fontFamily: FONT, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {crumb}
              </button>
            </React.Fragment>
          ))}
          <ChevronRight size={13} style={{ color: T.hint }} />
          <span title={info.exerciseName} style={{ color: T.o600, fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {info.exerciseName || "Assignment"}
          </span>
          <ChevronRight size={13} style={{ color: T.hint }} />
          <span aria-current="page" style={{ color: T.muted, fontWeight: 500 }}>Instructions</span>
        </nav>
 
        {/* ── Header card ──────────────────────────────────────────────── */}
        <section style={{ ...CARD, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
              <button
                type="button" onClick={handleBack} aria-label="Back" title="Back"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0, marginTop: 2,
                  border: `1px solid ${T.o200}`, background: T.o50, color: T.o700, cursor: "pointer",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.25, wordBreak: "break-word" }}>
                    {info.exerciseName || "Assignment"}
                  </h1>
                  <Chip>{isGraded ? "Graded" : "Practice"}</Chip>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, fontSize: 12.5, color: T.sub, flexWrap: "wrap" }}>
                  {assignedBy && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <User size={13} /> Assigned by {assignedBy}
                    </span>
                  )}
                  {difficulty && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.o500, display: "inline-block" }} />
                      {difficulty}
                    </span>
                  )}
                  {testTypeLabel(info.testType) && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ClipboardCheck size={13} /> {testTypeLabel(info.testType)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {dueRight && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0,
                padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                background: T.o50, border: `1px solid ${T.o200}`, color: T.o700, whiteSpace: "nowrap",
              }}>
                <CalendarDays size={14} /> {dueRight}
              </div>
            )}
          </div>
        </section>
 
        {/* ── Summary strip ────────────────────────────────────────────── */}
        <section style={{
          ...CARD, padding: "16px 20px", marginBottom: 16,
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px 20px",
        }}>
          <InfoCell icon={<Clock size={16} />} label="Duration" value={info.totalDuration ? `${info.totalDuration} min` : "—"} />
          <InfoCell icon={<FileText size={16} />} label="Questions" value={totalQ ? `${totalQ} problem${totalQ === 1 ? "" : "s"}` : "—"} />
          <InfoCell icon={<Award size={16} />} label="Total marks" value={isGraded ? (marks.totalMarks ? `${marks.totalMarks}` : "—") : "Practice"} />
          <InfoCell icon={<RotateCcw size={16} />} label="Attempts" value={`${attempts.total}`} />
          <InfoCell icon={<Trophy size={16} />} label="Passing score" value={passing != null ? `${passing}%` : marks.passMark != null ? `${marks.passMark} marks` : "—"} />
          <InfoCell icon={<ClipboardCheck size={16} />} label="Evaluation" value={evalLabel} />
          <InfoCell icon={<Code2 size={16} />} label="Language" value={languages[0] || "—"} />
        </section>
 
        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
 
            {/* Instructions */}
            <section style={{ ...CARD, padding: "20px 22px" }}>
              <CardHead
                icon={<ListChecks size={17} />}
                title="Instructions for students"
                note="Read the following instructions carefully before starting the assignment. Follow all guidelines to ensure a smooth and fair evaluation."
              />
              {instructions.items.length > 0 ? (
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                  {instructions.items.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                      <span aria-hidden="true" style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                        background: T.o50, border: `1px solid ${T.o200}`, color: T.o700,
                        fontSize: 11.5, fontWeight: 700,
                      }}>{i + 1}</span>
                      <span
                        style={{ fontSize: 13.5, color: T.text, lineHeight: 1.65, minWidth: 0 }}
                        dangerouslySetInnerHTML={{ __html: item }}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <div
                  style={{ fontSize: 13.5, color: T.text, lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: instructions.html }}
                />
              )}
 
              {/* Important callout */}
              <div style={{
                display: "flex", gap: 11, marginTop: 18, padding: "13px 15px",
                borderRadius: 10, background: T.o50,
                border: `1px solid ${T.o100}`, borderLeftWidth: 3, borderLeftColor: T.o500,
              }}>
                <AlertTriangle size={16} style={{ color: T.o600, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.o700, marginBottom: 3 }}>Important</div>
                  <p style={{ fontSize: 12.5, color: T.sub, margin: 0, lineHeight: 1.6 }}>
                    All answers must be submitted before the time expires. The timer starts only after you click
                    &ldquo;Start assignment&rdquo; and cannot be paused.
                  </p>
                </div>
              </div>
            </section>
 
            {/* Marks & evaluation */}
            <section style={{ ...CARD, padding: "20px 22px" }}>
              <CardHead
                icon={<Award size={17} />}
                title="Marks &amp; evaluation"
                note={isGraded ? marks.scoreNote : "This assignment is for practice — your work is not scored and does not affect your grade."}
              />
 
              {isGraded && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: showAllocation ? 18 : 0 }}>
                  <StatTile label="TOTAL MARKS" value={marks.totalMarks || "—"} accent hint={marks.totalQuestions ? `across ${marks.totalQuestions} question${marks.totalQuestions === 1 ? "" : "s"}` : undefined} />
                  <StatTile
                    label="MARKS TO PASS"
                    value={marks.passMark != null ? marks.passMark : passing != null ? `${passing}%` : "—"}
                    hint={marks.passMark != null && marks.totalMarks ? `${passing}% of ${marks.totalMarks}` : undefined}
                  />
                  <StatTile
                    label="MARKS PER QUESTION"
                    value={marks.uniformPerQuestion != null ? marks.uniformPerQuestion : "Varies"}
                    hint={marks.uniformPerQuestion != null ? "same for every question" : "see the breakdown below"}
                  />
                  <StatTile
                    label="ALLOCATION"
                    value={marks.allocation === "level" ? "By difficulty" : marks.allocation === "section" ? "By section" : "Whole paper"}
                    hint={marks.scoreLabel}
                  />
                </div>
              )}
 
              {/* Allocation table — level-based, general, or per section */}
              {showAllocation && marks.rows.length > 0 && (
                <div style={{ marginBottom: marks.sections.length > 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                    {marks.allocation === "level" ? "Mark allocation by difficulty" : "Mark allocation"}
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                      background: T.panel, borderBottom: `1px solid ${T.border}`,
                      fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.3, textTransform: "uppercase",
                    }}>
                      <div style={{ padding: "9px 13px" }}>{marks.allocation === "level" ? "Level" : "Group"}</div>
                      <div style={{ padding: "9px 13px", textAlign: "center" }}>Questions</div>
                      <div style={{ padding: "9px 13px", textAlign: "center" }}>Marks each</div>
                      <div style={{ padding: "9px 13px", textAlign: "right" }}>Total</div>
                    </div>
                    {marks.rows.map((r) => (
                      <div key={r.key} style={{
                        display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                        borderBottom: `1px solid ${T.borderSoft}`, fontSize: 13, color: T.text, alignItems: "center",
                      }}>
                        <div style={{ padding: "10px 13px", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                          <span aria-hidden="true" style={{
                            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                            background: r.key === "hard" ? T.o700 : r.key === "medium" ? T.o500 : T.o300,
                          }} />
                          {r.label}
                        </div>
                        <div style={{ padding: "10px 13px", textAlign: "center", color: T.sub }}>{r.count}</div>
                        <div style={{ padding: "10px 13px", textAlign: "center", color: T.sub }}>
                          {r.perQuestion != null
                            ? r.perQuestion
                            : r.perQuestionMarks && r.perQuestionMarks.length > 0 && r.perQuestionMarks.length <= 6
                              ? r.perQuestionMarks.join(" · ")
                              : "Varies"}
                        </div>
                        <div style={{ padding: "10px 13px", textAlign: "right", fontWeight: 700 }}>{r.total || "—"}</div>
                      </div>
                    ))}
                    <div style={{
                      display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                      background: T.o50, fontSize: 13, fontWeight: 800, color: T.o700, alignItems: "center",
                    }}>
                      <div style={{ padding: "11px 13px" }}>Total</div>
                      <div style={{ padding: "11px 13px", textAlign: "center" }}>{marks.totalQuestions || "—"}</div>
                      <div style={{ padding: "11px 13px" }} />
                      <div style={{ padding: "11px 13px", textAlign: "right" }}>{marks.totalMarks || "—"}</div>
                    </div>
                  </div>
                </div>
              )}
 
              {/* Section-based papers (Part A / Part B …) */}
              {showAllocation && marks.sections.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                    Marks by section
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                      background: T.panel, borderBottom: `1px solid ${T.border}`,
                      fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.3, textTransform: "uppercase",
                    }}>
                      <div style={{ padding: "9px 13px" }}>Section</div>
                      <div style={{ padding: "9px 13px", textAlign: "center" }}>Questions</div>
                      <div style={{ padding: "9px 13px", textAlign: "center" }}>Duration</div>
                      <div style={{ padding: "9px 13px", textAlign: "right" }}>Marks</div>
                    </div>
                    {marks.sections.map((s) => (
                      <div key={s.name} style={{
                        display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                        borderBottom: `1px solid ${T.borderSoft}`, fontSize: 13, color: T.text, alignItems: "center",
                      }}>
                        <div style={{ padding: "10px 13px", fontWeight: 600 }}>
                          {s.name}
                          {s.exerciseType && <span style={{ color: T.muted, fontWeight: 500 }}> · {s.exerciseType}</span>}
                        </div>
                        <div style={{ padding: "10px 13px", textAlign: "center", color: T.sub }}>{s.questions || "—"}</div>
                        <div style={{ padding: "10px 13px", textAlign: "center", color: T.sub }}>{s.duration ? `${s.duration} min` : "—"}</div>
                        <div style={{ padding: "10px 13px", textAlign: "right", fontWeight: 700 }}>{s.marks || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
 
              {/* Pass criteria */}
              {isGraded && (marks.passMark != null || levelPass || marks.separatePass) && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                    Pass criteria
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {marks.passMark != null && (
                      <Chip solid>
                        <Target size={12} /> Overall ≥ {marks.passMark}{marks.totalMarks ? ` / ${marks.totalMarks}` : ""}{passing != null ? ` (${passing}%)` : ""}
                      </Chip>
                    )}
                    {levelPass && (["easy", "medium", "hard"] as const).map((l) =>
                      levelPass[l] != null ? <Chip key={l}>{capitalise(l)} ≥ {levelPass[l]}</Chip> : null,
                    )}
                    {marks.separatePass?.mcq != null && <Chip>MCQ ≥ {marks.separatePass.mcq}</Chip>}
                    {marks.separatePass?.programming != null && <Chip>Programming ≥ {marks.separatePass.programming}</Chip>}
                  </div>
                  {levelPass && (
                    <p style={{ fontSize: 12, color: T.sub, margin: "9px 0 0", lineHeight: 1.6 }}>
                      Each difficulty band carries its own pass mark — clearing the overall total alone is not enough.
                    </p>
                  )}
                </div>
              )}
 
              {/* Grade bands */}
              {isGraded && marks.gradeBands.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                    Grade scale
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {marks.gradeBands.map((b, i) => (
                      <span key={`${b.label}-${i}`} style={{
                        display: "inline-flex", alignItems: "baseline", gap: 6,
                        padding: "6px 11px", borderRadius: 8, background: T.panel,
                        border: `1px solid ${T.border}`, fontSize: 12.5,
                      }}>
                        <b style={{ color: T.o700, fontWeight: 800 }}>{b.label || "—"}</b>
                        <span style={{ color: T.sub }}>{b.fromPercent}–{b.toPercent}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
 
              {/* How it's evaluated */}
              <div style={{
                display: "flex", gap: 11, marginTop: 18, padding: "13px 15px",
                borderRadius: 10, background: T.panel, border: `1px solid ${T.border}`,
              }}>
                <Gauge size={16} style={{ color: T.o600, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 3 }}>How this is evaluated · {evalLabel}</div>
                  <p style={{ fontSize: 12.5, color: T.sub, margin: 0, lineHeight: 1.6 }}>{evaluationNote(exercise)}</p>
                </div>
              </div>
            </section>
 
            {/* Assignment details */}
            {details.length > 0 && (
              <section style={{ ...CARD, padding: "20px 22px" }}>
                <CardHead
                  icon={<SlidersHorizontal size={17} />}
                  title="Assignment details"
                  note="Everything your trainer configured for this assignment."
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0 26px" }}>
                  {details.map((d) => (
                    <div key={d.label} style={{
                      display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14,
                      padding: "9px 0", borderBottom: `1px solid ${T.borderSoft}`,
                    }}>
                      <span style={{ fontSize: 12.5, color: T.sub, flexShrink: 0 }}>{d.label}</span>
                      <span style={{ fontSize: 12.5, color: T.text, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
 
          {/* ── Right rail — action panel ─────────────────────────────── */}
          <aside style={{ position: "sticky", top: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...CARD, padding: "20px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 14 }}>
                <IconTile strong size={38}><CheckCircle2 size={18} /></IconTile>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>Ready to begin?</h3>
                  <p style={{ fontSize: 12, color: T.sub, margin: "3px 0 0", lineHeight: 1.5 }}>
                    Once you start, the timer will begin and cannot be paused.
                  </p>
                </div>
              </div>
 
              <div style={{ height: 1, background: T.borderSoft, margin: "0 0 14px" }} />
 
              <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 12.5, color: T.text }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <RotateCcw size={14} style={{ color: T.o600, flexShrink: 0 }} />
                  <span><b>{attempts.total}</b> <span style={{ color: T.sub }}>attempt{attempts.total === 1 ? "" : "s"} available</span></span>
                </div>
                {isGraded && marks.totalMarks > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Award size={14} style={{ color: T.o600, flexShrink: 0 }} />
                    <span><b>{marks.totalMarks}</b> <span style={{ color: T.sub }}>marks in total</span></span>
                  </div>
                )}
                {isGraded && (passing != null || marks.passMark != null) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Trophy size={14} style={{ color: T.o600, flexShrink: 0 }} />
                    <span>
                      <b>{passing != null ? `${passing}%` : marks.passMark}</b>{" "}
                      <span style={{ color: T.sub }}>passing score{marks.passMark != null && passing != null ? ` (${marks.passMark} marks)` : ""}</span>
                    </span>
                  </div>
                )}
                {info.totalDuration ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Clock size={14} style={{ color: T.o600, flexShrink: 0 }} />
                    <span><b>{info.totalDuration} min</b> <span style={{ color: T.sub }}>to complete</span></span>
                  </div>
                ) : null}
                {dueLine && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <CalendarDays size={14} style={{ color: T.o600, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: T.o700 }}>{dueLine}</span>
                  </div>
                )}
              </div>
 
              <div style={{ height: 1, background: T.borderSoft, margin: "14px 0" }} />
 
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: T.text,
                cursor: "pointer", padding: "10px 12px", borderRadius: 9,
                background: acknowledged ? T.o50 : T.panel,
                border: `1px solid ${acknowledged ? T.o200 : T.border}`,
              }}>
                <input
                  type="checkbox" checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ marginTop: 2, accentColor: T.o500, cursor: "pointer" }}
                />
                <span>I&apos;ve read and understood the instructions.</span>
              </label>
 
              <button
                type="button" onClick={handleStart} disabled={!canStart}
                style={{
                  width: "100%", marginTop: 12,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 46, borderRadius: 10, border: "none",
                  background: canStart
                    ? `linear-gradient(90deg, ${T.o400} 0%, ${T.o500} 55%, ${T.o600} 100%)`
                    : "#E9E9F1",
                  color: canStart ? "#fff" : T.hint,
                  fontSize: 14.5, fontWeight: 700, fontFamily: FONT,
                  cursor: canStart ? "pointer" : "not-allowed",
                }}
              >
                {starting
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Play size={16} style={{ fill: canStart ? "#fff" : "transparent" }} />}
                {starting ? "Starting…" : "Start assignment"}
              </button>
            </div>
 
            {marks.allocation === "level" && isGraded && (
              <div style={{ ...CARD, padding: "13px 15px", display: "flex", gap: 10 }}>
                <Layers size={16} style={{ color: T.o600, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Marks vary by difficulty</div>
                  <p style={{ fontSize: 12, color: T.sub, margin: "2px 0 0", lineHeight: 1.5 }}>
                    {marks.rows.map((r) => `${r.label} ${r.perQuestion ?? "—"}`).join(" · ")} marks per question.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
 
export default function WedoInstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: T.o500 }} />
      </div>
    }>
      <WedoInstructionsContent />
    </Suspense>
  );
}
 
 