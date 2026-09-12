"use client";
import { getToken } from "@/lib/session";

// ════════════════════════════════════════════════════════════════════════════
// You-Do · Assessment instruction page
// ----------------------------------------------------------------------------
// Opened in a NEW TAB when a student clicks "Start" on a You-Do assessment.
// A full pre-assessment briefing — hero, summary metrics, dynamic instructions,
// marks & evaluation, assessment details, and a sticky "Ready to begin" panel
// whose acknowledgement gates the Start button.
//
// EVERY value comes from the exercise the trainer configured in the You-Do
// create-assessment flow; the readers below mirror the ones the assessment list
// (assessments.tsx) and the test pages already use, so numbers agree everywhere.
// Nothing here starts a timer — Start hands off to the existing test route.
//
// State is sourced from localStorage (payload written by the list) + a fresh
// fetch by exerciseId, so a reload never loses it.
// ════════════════════════════════════════════════════════════════════════════

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  normalizeSecurityConfig,
  type AssessmentSecurityConfig,
} from "@/app/lms/pages/courses/coursesdetailedview/components/YouDo/useAssessmentSecurity";
import {
  Home, ChevronRight, ArrowLeft, CalendarDays, Clock, ClipboardList, Award,
  RotateCcw, Trophy, Code2, Gauge, ListChecks, SlidersHorizontal, Play,
  AlertTriangle, CheckCircle2, Layers, Loader2, AlertCircle, Camera, Maximize,
  MonitorPlay, Copy, Lock, ArrowLeftRight, ShieldCheck, User,
} from "lucide-react";
import { API_ORIGIN } from '@/lib/apiBase'

const FONT = "'Poppins','Poppins','Segoe UI','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif";
const API_BASE = `${API_ORIGIN}`;

// ── Design tokens ───────────────────────────────────────────────────────────
const C = {
  page: "#f7f8fc",
  card: "#ffffff",
  border: "#e5e7ee",
  text: "#101426",
  sub: "#74798c",
  muted: "#9296a8",
  orange: "#f4510b",
  orangeHover: "#d94708",
  orangeSoft: "#fff7f0",
  orangeBorder: "#ffd1ae",
  disabled: "#e6e7ee",
} as const;

const CARD: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

type Level = "easy" | "medium" | "hard";
const LEVELS: Level[] = ["easy", "medium", "hard"];
const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const LEVEL_DOT: Record<Level, string> = { easy: "#fdba74", medium: "#f97316", hard: "#c2410c" };

// ── generic helpers ─────────────────────────────────────────────────────────
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
function titleCase(s?: string): string {
  return s ? String(s).replace(/^./, (c) => c.toUpperCase()) : "";
}
function formatDateTime(s?: string | null): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}
function formatDueShort(s?: string | null): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    const day = d.toLocaleString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${time}`;
  } catch { return ""; }
}

// ════════════════════════════════════════════════════════════════════════════
// Configuration readers — each maps onto a field the You-Do create flow
// persists (CreateAssessmentModal → buildFullPayload, and the exercise schema's
// questionConfiguration / gradeSettings / securitySettings / evaluationMethod).
// ════════════════════════════════════════════════════════════════════════════

function levelCountsOf(cfg: any): Record<Level, number> | null {
  if (!cfg) return null;
  const t = cfg.questionConfigType;
  const raw =
    t === "levelBased" ? cfg.levelBasedCounts
      : t === "selectionLevel" || t === "selection" ? cfg.selectionLevelCounts
        : null;
  const bucket = raw || cfg.levelBasedCounts || cfg.selectionLevelCounts;
  if (!bucket) return null;
  const counts = { easy: num(bucket.easy), medium: num(bucket.medium), hard: num(bucket.hard) };
  return counts.easy + counts.medium + counts.hard > 0 ? counts : null;
}

/** Marks-per-question for one level, when the trainer set level-specific scoring. */
function levelMarksPerQuestion(cfg: any, level: Level, count: number): number | null {
  const s = cfg?.scoreSettings?.levelScoringConfiguration?.[level] || cfg?.levelScoring?.[level];
  if (!s) return null;
  if (num(s.marksPerQuestion) > 0) return num(s.marksPerQuestion);
  if (num(s.totalMarks) > 0 && count > 0) return Math.round((num(s.totalMarks) / count) * 100) / 100;
  return null;
}
function levelTotalMarks(cfg: any, level: Level, count: number): number | null {
  const s = cfg?.scoreSettings?.levelScoringConfiguration?.[level] || cfg?.levelScoring?.[level];
  if (!s) return null;
  if (s.type === "level_specific" && num(s.marksPerQuestion) > 0) return count * num(s.marksPerQuestion);
  if (num(s.totalMarks) > 0) return num(s.totalMarks);
  if (num(s.marksPerQuestion) > 0) return count * num(s.marksPerQuestion);
  return null;
}

function configQuestionCount(cfg: any): number {
  if (!cfg) return 0;
  const lvl = levelCountsOf(cfg);
  if (cfg.questionConfigType === "general") return num(cfg.generalQuestionCount);
  if (lvl) return lvl.easy + lvl.medium + lvl.hard;
  return num(cfg.generalQuestionCount);
}

function isSectionBased(ex: any): boolean {
  return ex?.exerciseType === "SectionBased" || ex?.isSectionBased === true;
}
function normalizeSectionConfigs(ex: any): any[] {
  const sc = ex?.sectionConfigs;
  if (!sc) return [];
  if (Array.isArray(sc)) return sc;
  if (typeof sc === "object") return Object.entries(sc).map(([key, v]: [string, any]) => ({ ...(v as object), _recordKey: key }));
  return [];
}
function sectionConfiguredCount(cfg: any): number {
  const mcqQ = num(cfg?.mcqConfig?.generalQuestionCount);
  const progQ = configQuestionCount(cfg?.programmingConfig);
  const own = cfg?.questionCount;
  return own != null ? num(own) : mcqQ + progQ;
}

/** A section's marks. MCQ sections often store only the per-question score. */
function computeSectionMarks(s: any): number {
  if (num(s?.totalMarks) > 0) return num(s.totalMarks);
  const slice = num(s?.mcqSectionMarks) + num(s?.programmingSectionMarks);
  if (slice > 0) return slice;
  let m = 0;
  const mc = s?.mcqConfig;
  if (mc) {
    const ss = mc.scoreSettings || {};
    if (ss.scoreType === "questionSpecific" && num(ss.totalMarks) > 0) m += num(ss.totalMarks);
    else m += num(mc.generalQuestionCount) * num(ss.equalDistribution);
  }
  const pc = s?.programmingConfig;
  if (pc) {
    const ss = pc.scoreSettings || {};
    const cnt = num(pc.generalQuestionCount);
    if (num(ss.equalDistribution) > 0) m += cnt * num(ss.equalDistribution);
    else if (num(ss.totalMarks) > 0) m += num(ss.totalMarks);
    else {
      const counts = levelCountsOf(pc);
      if (counts) LEVELS.forEach((l) => { m += levelTotalMarks(pc, l, counts[l]) || 0; });
    }
  }
  return m;
}

interface PartRow { key: string; name: string; type: string; questions: number; marks: number; duration: number }

function getSections(ex: any): PartRow[] {
  const rawToArray = (value: any): any[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return Object.entries(value).map(([key, sec]: [string, any]) => ({ ...(sec as object), _recordKey: key }));
    return [];
  };
  const rawArr = ex?.sectionConfigs ? normalizeSectionConfigs(ex) : rawToArray(ex?.sections);
  const questions: any[] = Array.isArray(ex?.questions) ? ex.questions : [];

  const list = rawArr.map((s: any, i: number): PartRow => {
    const recordKey = s._recordKey as string | undefined;
    const name = s.name || s.sectionName || recordKey || s.id || s.sectionId || `Section ${i + 1}`;
    const id = s.id || s.sectionId || recordKey || name;
    const attached = questions.filter((q: any) => {
      const sid = q?.sectionId != null ? String(q.sectionId) : "";
      return sid && (sid === name || sid === id || sid === recordKey);
    }).length;
    return {
      key: String(recordKey || id || name),
      name: String(name),
      type: s.exerciseType || "",
      questions: sectionConfiguredCount(s) || attached,
      marks: computeSectionMarks(s),
      duration: num(s.totalDuration ?? s.duration),
      ...({ _order: s.order ?? s.sectionNumber ?? i } as object),
    } as PartRow;
  });

  // Marks / duration are sometimes stored on the `sections` array rather than on
  // `sectionConfigs`; merge them in so a trainer-entered total is never lost.
  if (ex?.sectionConfigs) {
    const extra = rawToArray(ex?.sections);
    if (extra.length > 0) {
      const marksByKey = new Map<string, number>();
      const durByKey = new Map<string, number>();
      for (const d of extra) {
        const tm = num(d.totalMarks);
        const du = num(d.totalDuration ?? d.duration);
        [d.name, d.sectionName, d._recordKey, d.id, d.sectionId].filter(Boolean).forEach((k: any) => {
          if (tm > 0) marksByKey.set(String(k), tm);
          if (du > 0) durByKey.set(String(k), du);
        });
      }
      for (const s of list) {
        if (!(s.marks > 0)) s.marks = marksByKey.get(s.name) ?? marksByKey.get(s.key) ?? s.marks;
        if (!(s.duration > 0)) s.duration = durByKey.get(s.name) ?? durByKey.get(s.key) ?? s.duration;
      }
    }
  }
  return list.sort((a: any, b: any) => num(a._order) - num(b._order));
}

function getTotalQuestions(ex: any): number {
  if (!ex) return 0;
  if (isSectionBased(ex)) {
    const configured = getSections(ex).reduce((sum, s) => sum + s.questions, 0);
    if (configured > 0) return configured;
    return Array.isArray(ex.questions) ? ex.questions.length : 0;
  }
  if (Array.isArray(ex.questions) && ex.questions.length > 0) return ex.questions.length;
  const qc = ex.questionConfiguration || {};
  const mcq = num(qc.mcqQuestionConfiguration?.totalMcqQuestions) || num(qc.mcqQuestionConfiguration?.totalQuestions);
  const sum = mcq + configQuestionCount(qc.programmingQuestionConfiguration) + configQuestionCount(qc.othersQuestionConfiguration);
  if (sum > 0) return sum;
  return num(ex.exerciseInformation?.totalQuestions);
}

function bucketMarks(qc: any): number {
  const mcq = qc?.mcqQuestionConfiguration;
  let m = 0;
  if (mcq) m += num(mcq.mcqTotalMarks) || num(mcq.totalMarks) || num(mcq.totalMcqQuestions) * num(mcq.marksPerQuestion);
  for (const key of ["programmingQuestionConfiguration", "othersQuestionConfiguration"]) {
    const cfg = qc?.[key];
    if (!cfg) continue;
    const ss = cfg.scoreSettings || {};
    if (num(ss.totalMarks) > 0) { m += num(ss.totalMarks); continue; }
    const counts = levelCountsOf(cfg);
    if (counts) LEVELS.forEach((l) => { m += levelTotalMarks(cfg, l, counts[l]) || 0; });
    else m += num(cfg.generalQuestionCount) * num(ss.evenMarks);
  }
  return m;
}

function getTotalMarks(ex: any): number | null {
  if (!ex || ex.isGraded === false) return null;
  if (isSectionBased(ex)) {
    const sum = getSections(ex).reduce((s, x) => s + x.marks, 0);
    if (sum > 0) return sum;
  }
  const info = ex.exerciseInformation || {};
  if (num(info.totalMarks) > 0) return num(info.totalMarks);
  const computed = bucketMarks(ex.questionConfiguration);
  if (computed > 0) return computed;
  const legacy = num(info.totalPoints);
  return legacy > 0 ? legacy : null;
}

function getPassMark(ex: any): number | null {
  if (!ex || ex.isGraded === false) return null;
  const g = ex.gradeSettings || {};
  if (g.enablePassMark === false) return null;
  const direct = g.combinedGradeToPass ?? g.mcqGradeToPass ?? g.programmingGradeToPass;
  if (direct != null && direct !== "" && num(direct) > 0) return num(direct);
  const spm = g.sectionPassMarks;
  if (spm && typeof spm === "object") {
    const sum = Object.values(spm).reduce((a: number, v: any) => a + num(v), 0);
    if (sum > 0) return sum;
  }
  const parts = Array.isArray(g.sections) ? g.sections : [];
  const partSum = parts.reduce((a: number, p: any) => a + num(p?.passMark), 0);
  return partSum > 0 ? partSum : null;
}

function getSubmissionAttempts(ex: any): number {
  if (!ex) return 1;
  if (isSectionBased(ex)) {
    const first = normalizeSectionConfigs(ex)[0];
    return num(first?.submissionAttempts) || num(ex.questionConfiguration?.submissionAttempts) || 1;
  }
  const qc = ex.questionConfiguration || {};
  return num(qc.programmingQuestionConfiguration?.submissionAttempts)
    || num(qc.mcqQuestionConfiguration?.submissionAttempts)
    || num(qc.othersQuestionConfiguration?.submissionAttempts)
    || 1;
}

interface LevelRow { level: Level; label: string; questions: number; marksEach: number | null; total: number | null }

/** Difficulty allocation — only for exercises the trainer configured level-based. */
function getLevelRows(ex: any): LevelRow[] {
  const qc = ex?.questionConfiguration || {};
  const acc: Record<Level, { q: number; total: number; each: number | null; hasMarks: boolean }> = {
    easy: { q: 0, total: 0, each: null, hasMarks: false },
    medium: { q: 0, total: 0, each: null, hasMarks: false },
    hard: { q: 0, total: 0, each: null, hasMarks: false },
  };
  let found = false;

  const absorb = (cfg: any) => {
    const counts = levelCountsOf(cfg);
    if (!counts) return;
    found = true;
    LEVELS.forEach((l) => {
      if (counts[l] <= 0) return;
      acc[l].q += counts[l];
      const t = levelTotalMarks(cfg, l, counts[l]);
      if (t != null) { acc[l].total += t; acc[l].hasMarks = true; }
      const each = levelMarksPerQuestion(cfg, l, counts[l]);
      if (each != null && acc[l].each == null) acc[l].each = each;
    });
  };

  absorb(qc.programmingQuestionConfiguration);
  absorb(qc.othersQuestionConfiguration);
  if (isSectionBased(ex)) normalizeSectionConfigs(ex).forEach((s: any) => absorb(s?.programmingConfig));

  const mcq = qc.mcqQuestionConfiguration;
  if (mcq && (mcq.easyCount != null || mcq.mediumCount != null || mcq.hardCount != null)) {
    const legacy: Record<Level, number> = { easy: num(mcq.easyCount), medium: num(mcq.mediumCount), hard: num(mcq.hardCount) };
    if (legacy.easy + legacy.medium + legacy.hard > 0) {
      found = true;
      const per = num(mcq.marksPerQuestion);
      LEVELS.forEach((l) => {
        if (legacy[l] <= 0) return;
        acc[l].q += legacy[l];
        if (per > 0) { acc[l].total += legacy[l] * per; acc[l].each = acc[l].each ?? per; acc[l].hasMarks = true; }
      });
    }
  }

  if (!found) return [];
  return LEVELS.filter((l) => acc[l].q > 0).map((l) => ({
    level: l,
    label: LEVEL_LABEL[l],
    questions: acc[l].q,
    marksEach: acc[l].each,
    total: acc[l].hasMarks ? acc[l].total : null,
  }));
}

/** Part A / Part B structure — section-based parts, or the halves of a Combined test. */
function getParts(ex: any): PartRow[] {
  if (!ex) return [];
  if (isSectionBased(ex)) return getSections(ex).filter((s) => s.questions > 0 || s.marks > 0);
  if (ex.exerciseType !== "Combined") return [];
  const qc = ex.questionConfiguration || {};
  const mcq = qc.mcqQuestionConfiguration;
  const prog = qc.programmingQuestionConfiguration;
  const rows: PartRow[] = [];
  const mcqQ = num(mcq?.totalMcqQuestions) || num(mcq?.totalQuestions);
  if (mcqQ > 0) {
    rows.push({
      key: "mcq", name: "MCQ", type: "MCQ", questions: mcqQ,
      marks: num(mcq?.mcqTotalMarks) || mcqQ * num(mcq?.marksPerQuestion) || num(ex.exerciseInformation?.totalMarksMCQ),
      duration: 0, // Combined runs on one overall timer — never invent per-part durations.
    });
  }
  const progQ = configQuestionCount(prog);
  if (progQ > 0) {
    rows.push({
      key: "programming", name: "Programming", type: "Programming", questions: progQ,
      marks: num(prog?.scoreSettings?.totalMarks) || num(ex.exerciseInformation?.totalMarksProgramming),
      duration: 0,
    });
  }
  return rows.length > 1 ? rows : [];
}

/** Flat per-question marks, when one value genuinely applies to the whole test. */
function getFlatMarksPerQuestion(ex: any): number | null {
  if (!ex || ex.isGraded === false) return null;
  if (isSectionBased(ex) || ex.exerciseType === "Combined") return null;
  if (getLevelRows(ex).length > 0) return null;
  const qc = ex.questionConfiguration || {};
  const perQ =
    num(qc.mcqQuestionConfiguration?.marksPerQuestion) ||
    num(qc.programmingQuestionConfiguration?.scoreSettings?.evenMarks) ||
    num(qc.othersQuestionConfiguration?.scoreSettings?.evenMarks);
  return perQ > 0 ? perQ : null;
}

/**
 * How the trainer chose the questions — the create flow's `questionConfigType`:
 *   general        → one count, marks split equally across every question
 *   levelBased     → a quota per difficulty (Easy / Medium / Hard)
 *   selectionLevel → quotas for only the levels the trainer ticked
 * Returns null for configs that carry no mode (e.g. a plain MCQ exercise).
 */
function getQuestionMode(ex: any): { label: string; note: string } | null {
  const qc = ex?.questionConfiguration || {};
  const cfg =
    qc.programmingQuestionConfiguration
    || qc.othersQuestionConfiguration
    || (isSectionBased(ex)
      ? normalizeSectionConfigs(ex).map((s: any) => s?.programmingConfig).find(Boolean)
      : null);
  const t = cfg?.questionConfigType;
  if (!t) return null;
  if (t === "general") return { label: "General", note: "Every question carries the same marks." };
  if (t === "levelBased") return { label: "Level based", note: "Questions are split across difficulty levels, and harder levels can carry more marks." };
  if (t === "selectionLevel" || t === "selection") {
    return { label: "Selection level", note: "Questions come only from the difficulty levels your trainer selected." };
  }
  return null;
}

/** How submissions are scored, in student language. */
function getEvaluation(ex: any): { label: string; description: string } {
  const method = ex?.evaluationMethod?.method;
  const isMcqOnly = ex?.exerciseType === "MCQ";
  const hidden = !!ex?.questionConfiguration?.programmingQuestionConfiguration?.enableTestCases;

  if (isMcqOnly) {
    return {
      label: "Answer key based",
      description: "Your answers are scored automatically against the correct options as soon as you submit.",
    };
  }
  if (method === "ai") {
    return {
      label: "AI based",
      description: "An AI evaluator reviews your submission and awards marks against the criteria your trainer selected.",
    };
  }
  if (method === "manual") {
    return {
      label: "Trainer based",
      description: "Your trainer reviews each submission manually, so results are published after evaluation rather than immediately.",
    };
  }
  return {
    label: "Test case based",
    description: hidden
      ? "Marks are awarded automatically by running your code against the stored test cases — including hidden ones you cannot see while solving."
      : "Marks are awarded automatically by running your code against the stored test cases.",
  };
}

/** Availability gate — mirrors the list's getExerciseAvailability. */
function computeAvailability(ex: any): { canStart: boolean; message: string; tone: "ok" | "warn" | "blocked" } {
  const now = new Date();
  const ap = ex?.availabilityPeriod || {};
  const start = ap.startDate ? new Date(ap.startDate) : null;
  const end = ap.endDate ? new Date(ap.endDate) : null;
  const grace = ap.gracePeriodAllowed && ap.gracePeriodDate ? new Date(ap.gracePeriodDate) : null;
  const cutoff = ap.cutOffEnabled && ap.cutOffDate ? new Date(ap.cutOffDate) : null;
  if (start && now < start) return { canStart: false, message: `Opens ${formatDateTime(ap.startDate)}`, tone: "blocked" };
  if (grace && end && now > end && now <= grace) return { canStart: true, message: `Grace period until ${formatDateTime(ap.gracePeriodDate)}`, tone: "warn" };
  if (end && now <= end) return { canStart: true, message: "", tone: "ok" };
  if (cutoff && end && now > end && now <= cutoff) return { canStart: true, message: `Late submission until ${formatDateTime(ap.cutOffDate)}`, tone: "warn" };
  if (!start && !end) return { canStart: true, message: "", tone: "ok" };
  return { canStart: false, message: "This assessment has expired", tone: "blocked" };
}

/** Resolve the test route + localStorage key — mirrors [id]/page.tsx's branching. */
function resolveRoute(ex: any): { key: string; path: string } {
  if (ex?.exerciseType === "SectionBased" || ex?.isSectionBased === true) return { key: "currentSectionBasedExercise", path: "sectionbased" };
  if (ex?.exerciseType === "Combined") return { key: "currentCombinedExercise", path: "combined" };
  if (ex?.programmingSettings?.selectedModule === "Frontend") return { key: "currentFrontendExercise", path: "frontend" };
  if (ex?.programmingSettings?.selectedModule === "Database") return { key: "currentSQLExercise", path: "sql" };
  if (ex?.exerciseType === "MCQ") return { key: "currentMCQExercise", path: "mcq" };
  if (ex?.exerciseType === "Other") return { key: "currentOthersExercise", path: "others" };
  return { key: "currentProgrammingExercise", path: "programming" };
}

// ── Dynamic instruction lines ───────────────────────────────────────────────
function buildInstructionList(ex: any, sec: AssessmentSecurityConfig): string[] {
  const out: string[] = [];
  const info = ex?.exerciseInformation || {};
  const qc = ex?.questionConfiguration || {};
  const prog = qc.programmingQuestionConfiguration;
  const duration = num(info.totalDuration);
  const attempts = getSubmissionAttempts(ex);
  const total = getTotalQuestions(ex);
  const type = ex?.exerciseType;
  const isCoding = type === "Programming" || type === "Combined" || isSectionBased(ex);
  const langs: string[] = Array.isArray(info.selectedLanguages) ? info.selectedLanguages.filter(Boolean) : [];
  const noun = isCoding ? "problem" : "question";
  const flow = prog?.questionFlow || qc.othersQuestionConfiguration?.questionFlow;
  const cameraOn = !!(sec.enableFaceVerification || sec.multipleFaceDetection || sec.faceMonitoringDetection);

  out.push(`Read each ${noun} carefully before ${isCoding ? "writing your solution" : "answering"}.`);

  if (total > 0) {
    const lead = langs.length === 1 ? `Use ${langs[0]} in the provided editor and complete` : "Complete";
    const within = duration > 0 ? ` within ${plural(duration, "minute")}` : "";
    out.push(`${lead} all ${plural(total, noun)}${within}.`);
  }

  if (isCoding && prog?.showSampleCases) out.push("Run the sample test cases before submitting your solutions.");
  if (isCoding && prog?.enableTestCases) out.push("Hidden test cases will be used for final evaluation.");
  if (qc.mcqQuestionConfiguration?.shuffleQuestions) out.push("Questions are shown in a random order, so your sequence differs from other students.");

  if (isSectionBased(ex)) out.push("Complete each section in order — a section cannot be revisited once you move forward.");
  else if (flow === "controlled") out.push("Questions must be answered in the given sequence; you cannot return to an earlier question.");
  else out.push(`You may answer the ${noun}s in any order before submitting.`);

  if (sec.requireFullscreen) out.push("The assessment runs in full screen. Exiting full screen is recorded and may end your attempt.");
  if (sec.preventTabSwitch) {
    out.push(num(sec.maxTabSwitches) > 0
      ? `Do not switch tabs or windows — up to ${plural(num(sec.maxTabSwitches), "switch", "switches")} are tolerated before your attempt is submitted automatically.`
      : "Do not switch tabs or windows during the assessment; leaving this tab is recorded.");
  }
  if (sec.preventCopyPaste) out.push("Copying and pasting is disabled — type your answers directly.");
  if (cameraOn) out.push("Keep your camera on and stay in frame; you are monitored throughout the assessment.");
  if (sec.screenRecordingEnabled) out.push("Share your screen when prompted — it is recorded and reviewed with your submission.");
  if (sec.preventRefresh || sec.preventBrowserClose || sec.preventBackNavigation) {
    out.push("Do not refresh or close this tab once you have started; you may lose unsaved answers.");
  }

  out.push(duration > 0
    ? `All answers must be submitted before the timer expires. You have ${plural(attempts, "attempt")}.`
    : `All answers must be submitted before you finish. You have ${plural(attempts, "attempt")}.`);

  out.push("If you experience a device or connectivity issue, contact your trainer before starting.");
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// Presentational pieces
// ════════════════════════════════════════════════════════════════════════════
function IconTile({ children, size = 34 }: { children: React.ReactNode; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: C.orangeSoft, border: `1px solid ${C.orangeBorder}`, color: C.orange,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</span>
  );
}

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section style={{ ...CARD, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <IconTile>{icon}</IconTile>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>{title}</h2>
          {subtitle ? <p style={{ fontSize: 13.5, color: C.sub, margin: "3px 0 0", lineHeight: 1.5 }}>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
      <IconTile size={32}>{icon}</IconTile>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{label}</div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}

function SummaryRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
      <span style={{ color: C.orange, display: "flex", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12,
      padding: "11px 0", borderBottom: `1px solid ${C.border}`, minWidth: 0,
    }}>
      <span style={{ fontSize: 13.5, color: C.sub, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Crumb({ label, last }: { label: string; last?: boolean }) {
  return (
    <span style={{
      fontSize: 12.5, color: last ? C.muted : C.orange, fontWeight: last ? 400 : 500,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220,
    }}>{label}</span>
  );
}

function SecurityLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ color: C.orange, display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: C.sub }}>{text}</span>
    </div>
  );
}

const TH: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em",
  padding: "11px 18px", borderBottom: `1px solid ${C.border}`,
};
const TD: React.CSSProperties = { padding: "13px 18px", borderBottom: `1px solid ${C.border}` };

// ════════════════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════════════════
function InstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseId = searchParams.get("exerciseId") || "";

  const [exercise, setExercise] = useState<any>(null);
  const [context, setContext] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1100px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  // ── Derived, all from the stored configuration ────────────────────────────
  const info = exercise?.exerciseInformation || {};
  const ap = exercise?.availabilityPeriod || {};
  const isGraded = exercise?.isGraded !== false;
  const security = useMemo(() => normalizeSecurityConfig(exercise?.securitySettings || {}), [exercise]);
  const availability = useMemo(() => (exercise ? computeAvailability(exercise) : null), [exercise]);
  const totalQuestions = useMemo(() => getTotalQuestions(exercise), [exercise]);
  const totalMarks = useMemo(() => getTotalMarks(exercise), [exercise]);
  const passMark = useMemo(() => getPassMark(exercise), [exercise]);
  const attempts = useMemo(() => getSubmissionAttempts(exercise), [exercise]);
  const levelRows = useMemo(() => getLevelRows(exercise), [exercise]);
  const partRows = useMemo(() => getParts(exercise), [exercise]);
  const flatPerQuestion = useMemo(() => getFlatMarksPerQuestion(exercise), [exercise]);
  const evaluation = useMemo(() => getEvaluation(exercise), [exercise]);
  const questionMode = useMemo(() => getQuestionMode(exercise), [exercise]);
  const instructionList = useMemo(() => (exercise ? buildInstructionList(exercise, security) : []), [exercise, security]);

  const duration = num(info.totalDuration);
  const languages: string[] = useMemo(
    () => (Array.isArray(info.selectedLanguages) ? info.selectedLanguages.filter(Boolean) : []),
    [info.selectedLanguages],
  );
  const passPercent = passMark != null && totalMarks ? Math.round((passMark / totalMarks) * 100) : null;
  const exerciseType: string = exercise?.exerciseType || info.exerciseType || "";
  const isCoding = exerciseType === "Programming" || exerciseType === "Combined" || isSectionBased(exercise);
  const questionNoun = isCoding ? "problem" : "question";
  const prog = exercise?.questionConfiguration?.programmingQuestionConfiguration;
  const flow = prog?.questionFlow || exercise?.questionConfiguration?.othersQuestionConfiguration?.questionFlow;
  const cameraOn = !!(security.enableFaceVerification || security.multipleFaceDetection || security.faceMonitoringDetection);
  const dueLabel = ap.endDate ? formatDateTime(ap.endDate) : "";
  const trainerInstructions: string = typeof exercise?.instructions === "string" ? exercise.instructions : "";
  const hasTrainerInstructions = trainerInstructions.replace(/<[^>]*>/g, "").trim().length > 0;
  const assignedBy: string = exercise?.createdByEmail || exercise?.createdBy || "";

  // ── Breadcrumb — the real hierarchy this assessment sits in ───────────────
  const crumbs = useMemo(() => {
    const list: string[] = [];
    const hierarchy: string[] = Array.isArray(context?.hierarchy) ? context.hierarchy.filter(Boolean) : [];
    hierarchy.forEach((h) => list.push(String(h)));
    if (context?.nodeName && !list.includes(String(context.nodeName))) list.push(String(context.nodeName));
    if (context?.subcategory) list.push(String(context.subcategory).replace(/_/g, " "));
    if (info.exerciseName) list.push(String(info.exerciseName));
    list.push("Instructions");
    return list;
  }, [context, info.exerciseName]);

  // ── Summary metrics — every entry omitted when not configured ─────────────
  const metrics = useMemo(() => {
    const rows: { key: string; icon: React.ReactNode; label: string; value: string }[] = [];
    rows.push({
      key: "duration", icon: <Clock size={16} />, label: "Duration",
      value: duration > 0 ? `${duration} min` : "No time limit",
    });
    if (totalQuestions > 0) {
      rows.push({
        key: "questions", icon: <ClipboardList size={16} />, label: "Questions",
        value: plural(totalQuestions, questionNoun),
      });
    }
    if (isGraded && totalMarks) rows.push({ key: "marks", icon: <Award size={16} />, label: "Total marks", value: String(totalMarks) });
    rows.push({ key: "attempts", icon: <RotateCcw size={16} />, label: "Attempts", value: String(attempts) });
    if (isGraded && passPercent != null) {
      rows.push({ key: "pass", icon: <Trophy size={16} />, label: "Passing score", value: `${passPercent}%` });
    } else if (isGraded && passMark != null) {
      rows.push({ key: "pass", icon: <Trophy size={16} />, label: "Passing score", value: `${passMark} marks` });
    }
    rows.push({ key: "eval", icon: <Gauge size={16} />, label: "Evaluation", value: evaluation.label });
    if (languages.length > 0) {
      rows.push({
        key: "lang", icon: <Code2 size={16} />, label: languages.length === 1 ? "Language" : "Languages",
        value: languages.join(", "),
      });
    }
    return rows;
  }, [duration, totalQuestions, questionNoun, isGraded, totalMarks, attempts, passPercent, passMark, evaluation.label, languages]);

  // ── Assessment details grid ───────────────────────────────────────────────
  const details = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    const typeLabel = isSectionBased(exercise) ? "Section based" : exerciseType;
    if (typeLabel) rows.push({ label: "Exercise type", value: typeLabel });
    if (info.selectedModule) rows.push({ label: "Module", value: String(info.selectedModule) });
    if (info.exerciseLevel) rows.push({ label: "Difficulty level", value: titleCase(info.exerciseLevel) });
    if (info.testType) rows.push({ label: "Test type", value: `${titleCase(info.testType)} test` });
    rows.push({ label: "Grading", value: isGraded ? "Graded" : "Non-graded" });
    if (languages.length > 0) rows.push({ label: languages.length === 1 ? "Language" : "Languages", value: languages.join(", ") });
    if (totalQuestions > 0) rows.push({ label: "Questions", value: plural(totalQuestions, questionNoun) });
    if (duration > 0) rows.push({ label: "Duration", value: `${duration} min` });
    if (questionMode) rows.push({ label: "Question selection", value: questionMode.label });
    if (!isSectionBased(exercise) && flow) {
      rows.push({ label: "Question flow", value: flow === "controlled" ? "Fixed sequence" : "Answer in any order" });
    }
    if (isCoding && prog?.allowCodeExecution) rows.push({ label: "Run code", value: "Enabled before submitting" });
    if (isCoding && prog?.showSampleCases) rows.push({ label: "Sample test cases", value: "Visible while solving" });
    if (isCoding && prog?.enableTestCases) rows.push({ label: "Hidden test cases", value: "Used for final marks" });
    rows.push({ label: "Attempts allowed", value: String(attempts) });
    rows.push({ label: "Evaluation", value: evaluation.label });
    if (security.requireFullscreen) rows.push({ label: "Full screen", value: "Required" });
    if (security.preventTabSwitch) rows.push({ label: "Tab switching", value: "Not allowed" });
    if (security.preventCopyPaste) rows.push({ label: "Copy / paste", value: "Disabled" });
    if (cameraOn) rows.push({ label: "Camera", value: "Required" });
    if (security.screenRecordingEnabled) rows.push({ label: "Screen recording", value: "Enabled" });
    if (ap.startDate) rows.push({ label: "Opens", value: formatDateTime(ap.startDate) });
    if (ap.endDate) rows.push({ label: "Due", value: formatDateTime(ap.endDate) });
    return rows;
  }, [exercise, exerciseType, info, isGraded, languages, totalQuestions, questionNoun, duration, flow, isCoding, prog, attempts, evaluation.label, security, cameraOn, ap, questionMode]);

  // ── Optional sidebar hints — only genuinely special rules ─────────────────
  const hints = useMemo(() => {
    const list: { key: string; title: string; body: string }[] = [];
    const varying = levelRows.filter((r) => r.marksEach != null);
    if (varying.length > 1 && new Set(varying.map((r) => r.marksEach)).size > 1) {
      list.push({
        key: "levels", title: "Marks vary by difficulty",
        body: `${varying.map((r) => `${r.label} ${r.marksEach}`).join(" · ")} marks per question.`,
      });
    }
    if (partRows.length > 1) {
      list.push({
        key: "parts", title: "Multiple parts",
        body: `${partRows.map((p) => p.name).join(" and ")} are attended in order and scored separately.`,
      });
    }
    return list;
  }, [levelRows, partRows]);

  // ── Start — unchanged flow (attempt routing, fullscreen gesture, payload) ──
  const handleStartTest = useCallback(async () => {
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
    const hierarchy: string[] = Array.isArray(context?.hierarchy) ? context.hierarchy.filter(Boolean) : [];
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
  }, [exercise, starting, context, exerciseId, info.exerciseName, router]);

  // ── load / error ──────────────────────────────────────────────────────────
  if (loading && !exercise) {
    return (
      <div style={{ minHeight: "calc(100dvh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: C.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: C.orange }} />
      </div>
    );
  }
  if (error || !exercise) {
    return (
      <div style={{ minHeight: "calc(100dvh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: C.page }}>
        <div style={{ textAlign: "center", color: C.sub, padding: 24 }}>
          <AlertCircle size={32} style={{ color: C.orange, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{error || "Assessment not found"}</div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>Close this tab and try starting the assessment again.</div>
        </div>
      </div>
    );
  }

  const canStart = acknowledged && !!availability?.canStart && !starting;
  const metaBits = [
    assignedBy ? `Assigned by ${assignedBy}` : "",
    info.exerciseLevel ? titleCase(info.exerciseLevel) : "",
    info.testType ? `${titleCase(info.testType)} test` : "",
  ].filter(Boolean);
  const showMarksCard = isGraded && (levelRows.length > 0 || partRows.length > 1 || flatPerQuestion != null || !!totalMarks);

  return (
    <div style={{ minHeight: "calc(100dvh * var(--ui-scale-inv, 1))", background: C.page, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        body { background: ${C.page}; }
        .ai-html p { margin: 0 0 8px; }
        .ai-html ul, .ai-html ol { margin: 6px 0; padding-left: 20px; }
        .ai-html ul { list-style: disc outside; }
        .ai-html ol { list-style: decimal outside; }
        .ai-html li { margin: 3px 0; display: list-item; }
        .ai-html strong { color: ${C.text}; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: wide ? "24px 34px 40px" : "16px 16px 32px" }}>

        {/* ── Breadcrumb ── */}
        <nav style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          <Home size={13} style={{ color: C.orange, flexShrink: 0 }} />
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c}-${i}`}>
              <ChevronRight size={12} style={{ color: C.muted, flexShrink: 0 }} />
              <Crumb label={c} last={i === crumbs.length - 1} />
            </React.Fragment>
          ))}
        </nav>

        {/* ── Hero / header card ── */}
        <div style={{ ...CARD, padding: wide ? "20px 24px" : 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  if (window.history.length > 1) window.history.back(); else window.close();
                }}
                aria-label="Go back"
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  border: `1px solid ${C.orangeBorder}`, background: C.card, color: C.orange,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: wide ? 26 : 21, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.25 }}>
                    {info.exerciseName || "Assessment"}
                  </h1>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.orange, background: C.orangeSoft,
                    border: `1px solid ${C.orangeBorder}`, borderRadius: 8, padding: "3px 10px",
                  }}>{isGraded ? "Graded" : "Non-graded"}</span>
                </div>
                {metaBits.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                    {metaBits.map((m, i) => (
                      <React.Fragment key={m}>
                        {i === 0
                          ? <User size={13} style={{ color: C.muted }} />
                          : <span style={{ color: C.muted, fontSize: 12 }}>•</span>}
                        <span style={{ fontSize: 13, color: C.sub }}>{m}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {dueLabel ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                background: C.orangeSoft, border: `1px solid ${C.orangeBorder}`, borderRadius: 10, padding: "9px 14px",
              }}>
                <CalendarDays size={15} style={{ color: C.orange }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.orange }}>Due {dueLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Summary metrics ── */}
        <div style={{
          ...CARD, padding: wide ? "18px 24px" : 16, marginBottom: 16,
          display: "grid", gap: wide ? 18 : 14,
          gridTemplateColumns: wide ? `repeat(${Math.min(metrics.length, 7)}, minmax(0,1fr))` : "repeat(2, minmax(0,1fr))",
        }}>
          {metrics.map((m) => <Metric key={m.key} icon={m.icon} label={m.label} value={m.value} />)}
        </div>

        {/* ── Main two-column area ── */}
        <div style={{
          display: "grid", gap: wide ? 18 : 16,
          gridTemplateColumns: wide ? "minmax(0,1fr) 320px" : "minmax(0,1fr)",
          alignItems: "start",
        }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, order: wide ? 0 : 2 }}>

            {/* Instructions for students */}
            <SectionCard
              icon={<ListChecks size={17} />}
              title="Instructions for students"
              subtitle="Read the following instructions carefully before starting the assessment. Follow all guidelines to ensure a smooth and fair evaluation."
            >
              {hasTrainerInstructions && (
                <div
                  className="ai-html"
                  style={{
                    fontSize: 14, color: C.sub, lineHeight: 1.65, marginBottom: 16,
                    paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
                  }}
                  dangerouslySetInnerHTML={{ __html: trainerInstructions }}
                />
              )}
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 13 }}>
                {instructionList.map((line, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      border: `1px solid ${C.orangeBorder}`, background: C.orangeSoft, color: C.orange,
                      fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{line}</span>
                  </li>
                ))}
              </ol>

              {/* Important notice */}
              <div style={{
                marginTop: 20, background: C.orangeSoft, borderRadius: 12,
                borderLeft: `3px solid ${C.orange}`, padding: "14px 16px",
                display: "flex", alignItems: "flex-start", gap: 11,
              }}>
                <AlertTriangle size={16} style={{ color: C.orange, flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.orange, marginBottom: 3 }}>Important</div>
                  <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>
                    {duration > 0
                      ? `All answers must be submitted before the time expires. The timer starts only after you click "Start assessment" and cannot be paused.`
                      : `All answers must be submitted before you finish. Once you click "Start assessment" the attempt cannot be paused.`}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Marks & evaluation */}
            {showMarksCard ? (
              <SectionCard
                icon={<Award size={17} />}
                title="Marks &amp; evaluation"
                subtitle={
                  partRows.length > 1
                    ? "Each part carries its own marks; your total is the sum of all parts."
                    : questionMode?.note
                      ?? (levelRows.length > 0
                        ? "Marks depend on question difficulty — harder questions are worth more."
                        : "How your submission is scored.")
                }
              >
                {/* Level allocation */}
                {levelRows.length > 0 && (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", marginBottom: 10 }}>
                      {questionMode?.label === "Selection level"
                        ? "MARK ALLOCATION BY SELECTED LEVEL"
                        : "MARK ALLOCATION BY DIFFICULTY"}
                    </div>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflowX: "auto", marginBottom: 18 }}>
                      <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#fafbfd" }}>
                            {["LEVEL", "QUESTIONS", "MARKS EACH", "TOTAL"].map((h, i) => (
                              <th key={h} style={{ ...TH, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {levelRows.map((r) => (
                            <tr key={r.level}>
                              <td style={TD}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: LEVEL_DOT[r.level] }} />
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.label}</span>
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: "right", fontSize: 14, color: C.sub }}>{r.questions}</td>
                              <td style={{ ...TD, textAlign: "right", fontSize: 14, color: C.sub }}>{r.marksEach ?? "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontSize: 14, fontWeight: 700, color: C.text }}>{r.total ?? "—"}</td>
                            </tr>
                          ))}
                          <tr style={{ background: C.orangeSoft }}>
                            <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: C.orange }}>Total</td>
                            <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 14, fontWeight: 700, color: C.orange }}>
                              {levelRows.reduce((s, r) => s + r.questions, 0)}
                            </td>
                            <td style={{ padding: "13px 18px" }} />
                            <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 14, fontWeight: 700, color: C.orange }}>
                              {levelRows.some((r) => r.total != null) ? levelRows.reduce((s, r) => s + (r.total || 0), 0) : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Part allocation */}
                {partRows.length > 1 && (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", marginBottom: 10 }}>
                      MARK ALLOCATION BY PART
                    </div>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflowX: "auto", marginBottom: 18 }}>
                      <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#fafbfd" }}>
                            {["PART", "QUESTIONS", "MARKS"].map((h, i) => (
                              <th key={h} style={{ ...TH, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {partRows.map((p) => (
                            <tr key={p.key}>
                              <td style={{ ...TD, fontSize: 14, fontWeight: 600, color: C.text }}>
                                {p.name}
                                {p.type && p.type !== p.name ? <span style={{ color: C.muted, fontWeight: 400 }}> · {p.type}</span> : null}
                              </td>
                              <td style={{ ...TD, textAlign: "right", fontSize: 14, color: C.sub }}>{p.questions || "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontSize: 14, fontWeight: 700, color: C.text }}>{p.marks || "—"}</td>
                            </tr>
                          ))}
                          <tr style={{ background: C.orangeSoft }}>
                            <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: C.orange }}>Total</td>
                            <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 14, fontWeight: 700, color: C.orange }}>{totalQuestions || "—"}</td>
                            <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 14, fontWeight: 700, color: C.orange }}>{totalMarks ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Flat scoring — no level or part split configured */}
                {levelRows.length === 0 && partRows.length <= 1 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                    {[
                      totalQuestions > 0 ? plural(totalQuestions, titleCase(questionNoun)) : "",
                      flatPerQuestion != null ? `${flatPerQuestion} marks each` : "",
                      totalMarks ? `Total ${totalMarks} marks` : "",
                    ].filter(Boolean).map((t) => (
                      <span key={t} style={{
                        fontSize: 13.5, fontWeight: 600, color: C.text, background: "#fafbfd",
                        border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px",
                      }}>{t}</span>
                    ))}
                  </div>
                )}

                {/* Pass criteria — only when the trainer configured one */}
                {passMark != null && (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", marginBottom: 10 }}>
                      PASS CRITERIA
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: C.orange, color: "#fff", borderRadius: 999, padding: "8px 16px",
                        fontSize: 13.5, fontWeight: 600,
                      }}>
                        <Trophy size={14} />
                        Overall ≥ {passMark}{totalMarks ? ` / ${totalMarks}` : ""}{passPercent != null ? ` (${passPercent}%)` : ""}
                      </span>
                    </div>
                  </>
                )}

                {/* How this is evaluated */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                    <Gauge size={15} style={{ color: C.orange }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      How this is evaluated · {evaluation.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{evaluation.description}</div>
                </div>
              </SectionCard>
            ) : !isGraded ? (
              <SectionCard
                icon={<Award size={17} />}
                title="Marks &amp; evaluation"
                subtitle="This assessment is not graded."
              >
                <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>
                  Your work is not scored and there is no pass mark. Use it to practise and check your understanding.
                </div>
              </SectionCard>
            ) : null}

            {/* Assessment details */}
            <SectionCard
              icon={<SlidersHorizontal size={17} />}
              title="Assessment details"
              subtitle="Everything your trainer configured for this assessment."
            >
              <div style={{
                display: "grid", columnGap: 28, rowGap: 0,
                gridTemplateColumns: wide ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
              }}>
                {details.map((d) => <DetailPair key={d.label} label={d.label} value={d.value} />)}
              </div>
            </SectionCard>
          </div>

          {/* RIGHT — Ready to begin */}
          <aside style={{
            display: "flex", flexDirection: "column", gap: 16, minWidth: 0,
            order: wide ? 0 : 1,
            position: wide ? "sticky" : "static", top: 24,
          }}>
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <IconTile><CheckCircle2 size={17} /></IconTile>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>Ready to begin?</h2>
                  <p style={{ fontSize: 13, color: C.sub, margin: "4px 0 0", lineHeight: 1.5 }}>
                    {duration > 0
                      ? "Once you start, the timer will begin and cannot be paused."
                      : "Once you start, the attempt cannot be paused."}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: C.border, margin: "0 0 12px" }} />

              <div>
                <SummaryRow icon={<RotateCcw size={15} />}>
                  <b style={{ color: C.text }}>{attempts}</b> {attempts === 1 ? "attempt" : "attempts"} available
                </SummaryRow>
                {isGraded && totalMarks ? (
                  <SummaryRow icon={<Award size={15} />}>
                    <b style={{ color: C.text }}>{totalMarks}</b> marks in total
                  </SummaryRow>
                ) : null}
                {isGraded && passMark != null ? (
                  <SummaryRow icon={<Trophy size={15} />}>
                    <b style={{ color: C.text }}>{passPercent != null ? `${passPercent}%` : `${passMark} marks`}</b> passing score
                    {passPercent != null ? ` (${passMark} marks)` : ""}
                  </SummaryRow>
                ) : null}
                {duration > 0 ? (
                  <SummaryRow icon={<Clock size={15} />}>
                    <b style={{ color: C.text }}>{duration} min</b> to complete
                  </SummaryRow>
                ) : null}
                {languages.length > 0 ? (
                  <SummaryRow icon={<Code2 size={15} />}>
                    <b style={{ color: C.text }}>{languages.join(", ")}</b> in the editor
                  </SummaryRow>
                ) : null}
                {ap.endDate ? (
                  <SummaryRow icon={<CalendarDays size={15} />}>
                    <span style={{ color: C.orange, fontWeight: 600 }}>Due {formatDueShort(ap.endDate)}</span>
                  </SummaryRow>
                ) : null}
              </div>

              <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

              {/* Acknowledgement */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer", userSelect: "none",
                background: acknowledged ? C.orangeSoft : "#fafbfd",
                border: `1px solid ${acknowledged ? C.orangeBorder : C.border}`,
                borderRadius: 10, padding: "13px 14px", transition: "background 120ms ease, border-color 120ms ease",
              }}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ width: 19, height: 19, accentColor: C.orange, cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                />
                <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.45 }}>
                  I&apos;ve read and understood the instructions.
                </span>
              </label>

              {/* Start */}
              <button
                type="button"
                onClick={handleStartTest}
                disabled={!canStart}
                style={{
                  width: "100%", marginTop: 14, padding: "14px 0", borderRadius: 12, border: "none",
                  fontSize: 15, fontWeight: 600,
                  background: canStart ? C.orange : C.disabled,
                  color: canStart ? "#fff" : C.muted,
                  cursor: canStart ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => { if (canStart) e.currentTarget.style.background = C.orangeHover; }}
                onMouseLeave={(e) => { if (canStart) e.currentTarget.style.background = C.orange; }}
              >
                {starting
                  ? <><Loader2 size={17} className="animate-spin" /> Starting…</>
                  : <><Play size={16} /> Start assessment</>}
              </button>

              {availability?.message ? (
                <div style={{
                  fontSize: 12, textAlign: "center", marginTop: 9, lineHeight: 1.4,
                  color: availability.canStart ? C.sub : C.orange,
                }}>{availability.message}</div>
              ) : null}
            </div>

            {/* Contextual hints — only genuinely special rules */}
            {hints.map((h) => (
              <div key={h.key} style={{ ...CARD, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                  <Layers size={15} style={{ color: C.orange }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{h.title}</span>
                </div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{h.body}</div>
              </div>
            ))}

            {/* Security summary — only what the trainer switched on */}
            {(security.requireFullscreen || security.preventTabSwitch || security.preventCopyPaste
              || cameraOn || security.screenRecordingEnabled || flow === "controlled") && (
              <div style={{ ...CARD, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <ShieldCheck size={15} style={{ color: C.orange }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Monitored assessment</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {security.requireFullscreen && <SecurityLine icon={<Maximize size={13} />} text="Full screen required" />}
                  {security.preventTabSwitch && <SecurityLine icon={<ArrowLeftRight size={13} />} text="Tab switching restricted" />}
                  {security.preventCopyPaste && <SecurityLine icon={<Copy size={13} />} text="Copy and paste disabled" />}
                  {cameraOn && <SecurityLine icon={<Camera size={13} />} text="Camera required" />}
                  {security.screenRecordingEnabled && <SecurityLine icon={<MonitorPlay size={13} />} text="Screen recording enabled" />}
                  {flow === "controlled" && !isSectionBased(exercise) && <SecurityLine icon={<Lock size={13} />} text="No backward navigation" />}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function YouDoInstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "calc(100dvh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, background: C.page }}>
        <Loader2 className="animate-spin" size={28} style={{ color: C.orange }} />
      </div>
    }>
      <InstructionsContent />
    </Suspense>
  );
}
