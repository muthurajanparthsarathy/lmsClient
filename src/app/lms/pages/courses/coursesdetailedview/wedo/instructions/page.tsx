"use client";
import { getToken } from "@/lib/session";

// ════════════════════════════════════════════════════════════════════════════
// We-Do · Assignment pre-start page
// ----------------------------------------------------------------------------
// Replaces the old StartExercisePopup modal for We_Do assignments. The student
// clicking Start on a We_Do row lands here first, sees a summary + the
// author's Instructions (or an auto-generated paragraph when nothing was
// authored), consents, and then clicks Start Assignment → routes to the
// actual workspace.
//
// State sources (mirror the You_Do instructions page):
//   • localStorage("wedo_test_intro_" + exerciseId)   — fast hydrate
//   • GET /exercise/:id                                — reload-safe fetch
// ════════════════════════════════════════════════════════════════════════════

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, Play, User } from "lucide-react";
import { resolveExerciseInstructions } from "@/lib/exerciseInstructions";

const FONT = "'Poppins','Poppins','Segoe UI','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
const API_BASE = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) {
    return "http://localhost:5533";
  }
  return "https://lms-server-3-wedg.onrender.com";
})();

// Design tokens from the mockup — kept in one place so the whole page reads
// as one system.
const T = {
  orange: "#F97316", deepOrange: "#EA580C",
  paleOrangeBg: "rgba(249,115,22,0.08)",
  page: "#FFFFFF", panel: "#F8F9FC",
  text: "#1A1A2E", sub: "#6B6B7E", muted: "#8B8B9E", hint: "#BCBCCC",
  border: "#E4E4ED",
};

// ── helpers ─────────────────────────────────────────────────────────────────
function formatDateTime(s?: string): string {
  if (!s) return "—";
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
function pickTotalQuestions(ex: any): number {
  if (Array.isArray(ex?.questions) && ex.questions.length > 0) return ex.questions.length;
  return ex?.exerciseInformation?.totalQuestions || 0;
}
function pickLanguage(ex: any): string {
  const langs = ex?.programmingSettings?.selectedLanguages || [];
  if (Array.isArray(langs) && langs.length > 0) {
    const lc = String(langs[0]).toLowerCase();
    if (lc === "python") return "Python 3.11";
    return String(langs[0]).replace(/^./, (c: string) => c.toUpperCase());
  }
  return "—";
}
function pickEvaluationLabel(ex: any): string {
  const m = (ex?.evaluationMethod?.method || ex?.evaluationMethod || "").toString().toLowerCase();
  if (m === "ai") return "AI review";
  if (m === "testcase" || m === "test-case") return "Auto tests";
  return "Manual";
}
function pickAttempts(ex: any): { left: number; total: number } {
  const total =
    ex?.programmingSettings?.submissionAttempts ||
    ex?.evaluationSettings?.submissionAttempts ||
    ex?.questionConfiguration?.programmingQuestionConfiguration?.submissionAttempts ||
    1;
  return { left: total, total }; // Actual "left" needs studentAnswers, unavailable on this page — show configured attempts.
}
function pickPassingPercent(ex: any): number | null {
  const g = ex?.gradeSettings || {};
  const totalMarks =
    ex?.exerciseInformation?.totalMarks ||
    ex?.exerciseInformation?.totalMarksProgramming || 0;
  const pass = g.programmingGradeToPass ?? g.combinedGradeToPass ?? g.mcqGradeToPass ?? null;
  if (pass != null && totalMarks > 0) return Math.round((Number(pass) / totalMarks) * 100);
  return null;
}
function pickDifficulty(ex: any): string {
  const d = (ex?.exerciseInformation?.exerciseLevel || "").toString().toLowerCase();
  if (d === "beginner") return "Easy";
  if (d === "expert") return "Hard";
  if (!d) return "";
  return d.charAt(0).toUpperCase() + d.slice(1);
}
function pickAssignedBy(ex: any): string {
  return ex?.createdBy || ex?.assignedBy || ex?.author?.name || "";
}
function pickModuleLine(ex: any, context: any): string {
  const hier = Array.isArray(context?.hierarchy) ? context.hierarchy.filter(Boolean) : [];
  const module = hier[0] || ex?.programmingSettings?.selectedModule || "Course";
  const topic = hier[1] || "";
  return topic ? `${module} · ${topic}` : module;
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

// ── Info strip cell ─────────────────────────────────────────────────────────
function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: T.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}
const InfoDivider = () => (
  <div aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: T.border, margin: "4px 0" }} />
);

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
  const language = useMemo(() => pickLanguage(exercise), [exercise]);
  const evalLabel = useMemo(() => pickEvaluationLabel(exercise), [exercise]);
  const attempts = useMemo(() => pickAttempts(exercise), [exercise]);
  const passing = useMemo(() => pickPassingPercent(exercise), [exercise]);
  const difficulty = useMemo(() => pickDifficulty(exercise), [exercise]);
  const assignedBy = useMemo(() => pickAssignedBy(exercise), [exercise]);
  const moduleLine = useMemo(() => pickModuleLine(exercise, context), [exercise, context]);
  const dueDate = info.availabilityPeriod?.endDate || exercise?.availabilityPeriod?.endDate || "";
  const dueLine = formatDueLine(dueDate);
  const dueRight = dueDate ? `Due ${formatDateTime(dueDate)}` : "";
  const instructions = useMemo(() => resolveExerciseInstructions(exercise || {}), [exercise]);

  const handleBack = () => {
    router.back();
  };

  const handleStart = async () => {
    if (!exercise || starting) return;
    setStarting(true);
    const qs = Array.isArray(exercise.questions) ? exercise.questions : [];
    const courseId = context?.courseId || exercise?.courseId || "";
    const courseName = context?.courseName || exercise?.courseName || "Course";
    const route = resolveWeDoRoute(exercise);
    if (!route) { setStarting(false); return; }

    const stored = {
      ...exercise, questions: qs, courseId, courseName,
      context: {
        courseId,
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
        courseId, courseName,
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
      router.push(`/lms/pages/courses/coursesdetailedview/${courseId}`);
    }
  };

  // ── load / error ─────────────────────────────────────────────────────────
  if (loading && !exercise) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: T.sub }} />
      </div>
    );
  }
  if (error || !exercise) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <div style={{ textAlign: "center", color: T.sub, padding: 24 }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{error || "Assignment not found."}</p>
          <button onClick={handleBack} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.text, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  const canStart = acknowledged && !starting;

  return (
    <div style={{
      height: "100vh", background: T.page, color: T.text, fontFamily: FONT,
      // Whole-page scroll off — internal sections handle overflow so a
      // long instructions paragraph doesn't push the action panel off-screen.
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Assignment header — Back button lives inline beside the title so
          no whole row is wasted on chrome. Orange module-trail eyebrow
          removed per user — it duplicated the info the assignment title
          already conveys. Title trimmed to 22px for a more compact
          reading rhythm. */}
      <section style={{ padding: "20px 32px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              type="button" onClick={handleBack} aria-label="Back"
              title="Back"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                border: `1px solid ${T.border}`, background: "#fff",
                color: T.text, cursor: "pointer",
              }}
            >
              <ArrowLeft size={15} />
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.2, wordBreak: "break-word" }}>
              {info.exerciseName || "Assignment"}
            </h1>
          </div>
          {dueRight && <div style={{ fontSize: 13, color: T.sub, whiteSpace: "nowrap" }}>{dueRight}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, fontSize: 13, color: T.sub, paddingLeft: 48 }}>
          {assignedBy && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <User size={13} /> Assigned by {assignedBy}
            </span>
          )}
          {difficulty && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.orange, display: "inline-block" }} />
              {difficulty}
            </span>
          )}
        </div>
      </section>

      {/* Info strip */}
      <section style={{ padding: "16px 32px 0", flexShrink: 0 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `1fr 1px 1fr 1px 1fr 1px 1fr 1px 1fr 1px 1fr`,
          columnGap: 16, alignItems: "center",
          padding: "16px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
        }}>
          <InfoCell label="Duration" value={info.totalDuration ? `${info.totalDuration} min` : "—"} />
          <InfoDivider />
          <InfoCell label="Questions" value={totalQ ? `${totalQ} problem${totalQ === 1 ? "" : "s"}` : "—"} />
          <InfoDivider />
          <InfoCell label="Attempts" value={`${attempts.total}`} />
          <InfoDivider />
          <InfoCell label="Passing score" value={passing != null ? `${passing}%` : "—"} />
          <InfoDivider />
          <InfoCell label="Evaluation" value={evalLabel} />
          <InfoDivider />
          <InfoCell label="Language" value={language} />
        </div>
      </section>

      {/* Two-column body — takes the remaining viewport height. The left
          column's instructions area scrolls independently when the
          author-written copy is long, keeping the page itself scroll-free
          and the right-side action panel always visible. */}
      <section style={{
        padding: "20px 32px 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
        gap: 32,
        flex: 1, minHeight: 0,
      }}>
        {/* Left — instructions (only the paragraph area scrolls; eyebrow,
            title and timer notice stay pinned). Wrapper takes overflow:
            hidden so the inner flex:1 can shrink and hand the leftover
            room to a real scrollbar rather than pushing the timer line
            off the viewport (which is what was hiding it). */}
        <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.deepOrange, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, flexShrink: 0 }}>
            Before you start
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: "0 0 12px", flexShrink: 0 }}>
            Instructions for students
          </h2>
          <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
            <div aria-hidden="true" style={{ width: 3, background: T.orange, borderRadius: 2, flexShrink: 0 }} />
            <div
              style={{ fontSize: 15, color: T.text, lineHeight: 1.7, overflowY: "auto", paddingRight: 8, flex: 1, minHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: instructions.html }}
            />
          </div>
          <p style={{ fontSize: 13, color: T.sub, marginTop: 12, lineHeight: 1.6, flexShrink: 0 }}>
            The timer starts after you select Start assignment and cannot be paused.
          </p>
        </div>

        {/* Right — action panel */}
        <aside style={{
          background: T.panel, borderRadius: 14, border: `1px solid ${T.border}`,
          padding: "24px 22px", alignSelf: "start",
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>Ready to begin?</h3>
          {dueLine && (
            <div style={{ fontSize: 14, fontWeight: 700, color: T.deepOrange, marginTop: 6 }}>{dueLine}</div>
          )}
          <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: T.text }}>
            <div>
              <span style={{ fontWeight: 700 }}>{attempts.total}</span>
              <span style={{ color: T.sub }}> attempts available</span>
            </div>
            {passing != null && (
              <div>
                <span style={{ fontWeight: 700 }}>{passing}%</span>
                <span style={{ color: T.sub }}> passing score</span>
              </div>
            )}
          </div>
          <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: T.text, cursor: "pointer" }}>
            <input
              type="checkbox" checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ marginTop: 3, accentColor: T.orange, cursor: "pointer" }}
            />
            <span>I&apos;ve read and understood the instructions.</span>
          </label>
          <button
            type="button" onClick={handleStart} disabled={!canStart}
            style={{
              width: "100%", marginTop: 16,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              height: 48, borderRadius: 10, border: "none",
              background: canStart
                ? `linear-gradient(90deg, #FB923C 0%, ${T.orange} 55%, ${T.deepOrange} 100%)`
                : "#E4E4ED",
              color: canStart ? "#fff" : T.hint,
              fontSize: 15, fontWeight: 700, fontFamily: FONT,
              cursor: canStart ? "pointer" : "not-allowed",
            }}
          >
            {starting
              ? <Loader2 size={16} className="animate-spin" />
              : <Play size={16} style={{ fill: canStart ? "#fff" : "transparent" }} />}
            {starting ? "Starting…" : "Start assignment"}
          </button>
        </aside>
      </section>
    </div>
  );
}

export default function WedoInstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: T.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: T.sub }} />
      </div>
    }>
      <WedoInstructionsContent />
    </Suspense>
  );
}
