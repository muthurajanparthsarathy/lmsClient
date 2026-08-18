"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import ReactDOM from "react-dom";
import { toast } from "react-hot-toast";
import {
  ArrowLeft, Users, ClipboardList, MoreVertical, Lock, X, AlertTriangle,
  Search, RefreshCw, CheckCircle,
  Send, MonitorPlay, ClipboardCheck, MessageSquare, Filter,
  Info, Loader2, FileText,
} from "lucide-react";
import { retestApi, type RetestRequestRecord, type EnrolledStudent } from "@/apiServices/retest";
import { exerciseApi } from "@/apiServices/exercise";
import { getSocket } from "@/apiServices/socketClient";

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: "#F97316",
  cyan: "#0891b2",
  textMain: "#1a1a2e",
  textSub: "#475569",
  textMuted: "#64748b",
  textHint: "#94a3b8",
  border: "#e9eaf0",
  bg: "#ffffff",
  pageBg: "#f7f8fb",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#16a34a",
};

const AVATAR_COLORS = [
  { bg: "#fee2e2", fg: "#dc2626" },
  { bg: "#dbeafe", fg: "#2563eb" },
  { bg: "#dcfce7", fg: "#16a34a" },
  { bg: "#fef3c7", fg: "#d97706" },
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#cffafe", fg: "#0891b2" },
  { bg: "#fce7f3", fg: "#db2777" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const colorForName = (name: string) => {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const formatDateTime = (d?: string | null): string => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
};

const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Map enrolled-student exerciseProgress.status → a friendly submission badge
const STUDENT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Submitted", color: "#64748b", bg: "rgba(100,116,139,0.10)" },
  in_progress: { label: "In Progress", color: "#F97316", bg: "rgba(249,115,22,0.10)" },
  evaluated: { label: "Submitted", color: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  completed: { label: "Submitted", color: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  submitted: { label: "Submitted", color: "#16a34a", bg: "rgba(22,163,74,0.10)" },
};

const REQUEST_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  Pending: { label: "Pending", color: "#b45309", bg: "rgba(245,158,11,0.12)" },
  Approved: { label: "Approved", color: "#15803d", bg: "rgba(22,163,74,0.12)" },
  Rejected: { label: "Rejected", color: "#b91c1c", bg: "rgba(239,68,68,0.12)" },
};

// ─── Avatar ─────────────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const c = colorForName(name);
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: 34, height: 34, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 700 }}
    >
      {getInitials(name)}
    </div>
  );
};

// ─── Status badge ───────────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-full"
    style={{ fontSize: 11, fontWeight: 600, color, background: bg }}
  >
    {label}
  </span>
);

// ─── Users List row 3-dot menu — all per-student actions live here now.
// The three items are, in order:
//   1. Check Answer   — only when the student has any DB answer (gated by `canCheck`)
//   2. Send Message   — always available
//   3. Unlock Assessment — always available
// Items 1 & 2 replaced the inline pills that briefly lived in the row itself.
interface UsersRowMenuProps {
  canCheck: boolean;
  onCheckAnswer: () => void;
  onSendMessage: () => void;
  onUnlock: () => void;
}
const UsersRowMenu: React.FC<UsersRowMenuProps> = ({ canCheck, onCheckAnswer, onSendMessage, onUnlock }) => {
  const [open, setOpen] = useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    update();
    const close = (e: MouseEvent) => {
      const t = e.target as Element;
      if (btnRef.current && !btnRef.current.contains(t) && !t.closest?.(".users-row-menu")) setOpen(false);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  // Shared style for a menu row so we don't repeat 5 lines of inline style
  // three times. `color` picks the icon+text tint; hover just tints the row bg.
  const itemStyle = (color: string): React.CSSProperties => ({
    fontSize: 12.5, fontWeight: 600, color,
    background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
  });
  const hoverBg = (color: string) => `${color}14`; // ~8% opacity

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="Actions"
        className="p-1.5 rounded-lg"
        style={{ color: T.textHint, background: open ? "#f1f5f9" : "transparent", border: "none", cursor: "pointer", lineHeight: 0 }}
      >
        <MoreVertical size={16} />
      </button>
      {open && pos && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          className="users-row-menu"
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 100000,
            background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)", padding: 4, minWidth: 200,
          }}
        >
          {canCheck && (
            <button
              onClick={() => { setOpen(false); onCheckAnswer(); }}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg"
              style={itemStyle(T.green)}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg(T.green))}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <ClipboardCheck size={13} /> Check Answer
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onSendMessage(); }}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg"
            style={itemStyle("#4f46e5")}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg("#4f46e5"))}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <MessageSquare size={13} /> Send Message
          </button>
          <button
            onClick={() => { setOpen(false); onUnlock(); }}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg"
            style={itemStyle(T.cyan)}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg(T.cyan))}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Lock size={13} /> Unlock Assessment
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

// ─── Unlock confirmation modal (warning + per-student window) ─────────────────
interface UnlockModalProps {
  name: string;
  requireSchedule: boolean;
  onClose: () => void;
  onConfirm: (startISO?: string, endISO?: string) => void;
  loading?: boolean;
}
const UnlockModal: React.FC<UnlockModalProps> = ({ name, requireSchedule, onClose, onConfirm, loading }) => {
  const now = new Date();
  const [start, setStart] = useState(toLocalInput(now));
  const [end, setEnd] = useState(toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
  const [touched, setTouched] = useState(false);

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const invalid = requireSchedule && (!startDate || !endDate || endDate <= startDate);

  const handleConfirm = () => {
    setTouched(true);
    if (invalid || loading) return;
    if (requireSchedule) onConfirm(new Date(start).toISOString(), new Date(end).toISOString());
    else onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(15,15,30,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ maxWidth: 440, background: "#fffdf7", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full"
          style={{ color: T.textMuted, background: "transparent", border: "none", cursor: "pointer" }}
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center px-7 pt-7 pb-3">
          <div
            className="flex items-center justify-center rounded-full mb-3"
            style={{ width: 56, height: 56, background: "rgba(245,158,11,0.15)", color: T.amber }}
          >
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-[18px] font-bold" style={{ color: T.textMain }}>Unlock Assessment?</h3>
          <p className="text-[13px] mt-1.5" style={{ color: T.textSub }}>
            Are you sure you want to unlock the assessment for{" "}
            <span className="font-semibold" style={{ color: T.textMain }}>{name}</span>?
          </p>
        </div>

        {requireSchedule ? (
        /* Assessment window has ended — give this student their own retest window */
        <div className="px-7 pb-2">
          <div
            className="rounded-xl p-3.5"
            style={{ background: "#fff", border: `1px solid ${T.border}` }}
          >
            <p className="text-[11px] font-semibold mb-2.5" style={{ color: T.textMuted }}>
              The assessment window has ended — set a retest window for this student only
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textSub }}>Start</label>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="w-full text-[12px] rounded-lg px-2.5 py-2 outline-none"
                  style={{ border: `1.5px solid ${T.border}`, color: T.textMain }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textSub }}>End</label>
                <input
                  type="datetime-local"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="w-full text-[12px] rounded-lg px-2.5 py-2 outline-none"
                  style={{ border: `1.5px solid ${touched && invalid ? "#fca5a5" : T.border}`, color: T.textMain }}
                />
              </div>
            </div>
            {touched && invalid && (
              <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: T.red }}>
                <AlertTriangle size={11} /> End time must be after the start time.
              </p>
            )}
            <p className="text-[10.5px] mt-2.5 leading-relaxed" style={{ color: T.textHint }}>
              The student's previous answers are cleared and the Start button reappears for them only during this window.
            </p>
          </div>
        </div>
        ) : (
        /* Assessment still open — a plain reset is enough, no schedule needed */
        <div className="px-7 pb-2">
          <div className="rounded-xl p-3.5" style={{ background: "#fff", border: `1px solid ${T.border}` }}>
            <p className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>
              This assessment is still open, so no schedule is needed. Unlocking clears{" "}
              <span className="font-semibold" style={{ color: T.textMain }}>{name}</span>'s previous answers so they can retake it within the assessment's current window.
            </p>
          </div>
        </div>
        )}

        <div className="flex items-center gap-3 px-7 py-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
            style={{ background: "#fff", color: T.textSub, border: `1.5px solid ${T.border}`, cursor: loading ? "not-allowed" : "pointer" }}
          >
            No, Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || invalid}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2"
            style={{ background: loading || invalid ? "#fca5a5" : T.red, border: "none", cursor: loading || invalid ? "not-allowed" : "pointer" }}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Unlocking…</>
            ) : (
              <><Lock size={14} /> Yes, Unlock</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Socket helper — mirrors liveDashboard's emitWithAck exactly, so the
//    proctor's message/broadcast handlers behave identically here. ────────────
function emitWithAck(event: string, payload: Record<string, any>) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    let settled = false;
    const done = (r: { ok: boolean; error?: string }) => {
      if (!settled) { settled = true; resolve(r); }
    };
    try {
      getSocket().emit(event, payload, (resp: any) =>
        done(resp?.ok ? { ok: true } : { ok: false, error: resp?.error || "Failed to send" }),
      );
    } catch {
      done({ ok: false, error: "Connection error" });
    }
    setTimeout(() => done({ ok: false, error: "Timed out — check your connection." }), 10000);
  });
}

// ─── Status filter options (mirrors the Dashboard's dropdown values, but
//    keyed to the retest API's raw `exerciseProgress.status` vocabulary). ─────
type StatusFilterValue = "all" | "not_started" | "in_progress" | "submitted";
const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all",          label: "All Statuses" },
  { value: "not_started",  label: "Not Submitted" },
  { value: "in_progress",  label: "In Progress"   },
  { value: "submitted",    label: "Submitted"     },
];

// Group the raw status into the three bins the filter uses.
const bucketStatus = (raw?: string | null): Exclude<StatusFilterValue, "all"> => {
  const s = (raw || "").toLowerCase();
  if (s === "evaluated" || s === "completed" || s === "submitted") return "submitted";
  if (s === "in_progress") return "in_progress";
  return "not_started";
};

// ─── Main inner component ─────────────────────────────────────────────────────
function ManageUsersInner() {
  const router = useRouter();
  // Reports / Check Answer stay in whichever section the user came in through
  // (Courses or Course Structure) — both mount this same component.
  const sectionHref = useSectionHref();
  const sp = useSearchParams();
  const courseId = sp.get("courseId") || "";
  const exerciseId = sp.get("exerciseId") || "";
  const assessmentName = sp.get("assessmentName") || "Assessment";
  const subcategory = sp.get("subcategory") || "";
  // Context params — populated by the Assessment card's Manage Users nav so
  // the header buttons (Live Screens) and per-row Check Answer button can
  // deep-link into liveScreens / reviewSubmission with the right breadcrumb
  // trail. Empty strings are safe — the target pages tolerate missing values.
  const nodeId = sp.get("nodeId") || "";
  const nodeType = sp.get("nodeType") || "";
  const moduleName = sp.get("moduleName") || "";
  const submoduleName = sp.get("submoduleName") || "";
  const topicName = sp.get("topicName") || "";
  const subtopicName = sp.get("subtopicName") || "";
  const tabType = sp.get("tabType") || "You_Do";
  // liveDashboard treats `assessmentId` and `exerciseId` as interchangeable;
  // we do the same, preferring an explicit assessmentId when supplied.
  const assessmentId = sp.get("assessmentId") || exerciseId;

  const [tab, setTab] = useState<"users" | "requests">(
    sp.get("tab") === "requests" ? "requests" : "users"
  );
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [requests, setRequests] = useState<RetestRequestRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Status filter (Users List only).
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  // Message-a-student modal target (null = closed). Broadcast modal open flag.
  const [messageStudent, setMessageStudent] = useState<EnrolledStudent | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const [unlockTarget, setUnlockTarget] = useState<{
    studentId: string; name: string; requestId?: string;
    subcategory?: string; exerciseName?: string; exerciseId?: string;
  } | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  // Whether the assessment is still within its own schedule. If it has ended,
  // the coordinator sets a per-student retest window on unlock; if still open,
  // unlocking is a plain reset (the student retakes within the current window).
  const [assessmentActive, setAssessmentActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await exerciseApi.getExerciseById(exerciseId);
        const ex = res?.data?.exercise || res?.exercise || res?.data;
        const end = ex?.availabilityPeriod?.endDate;
        if (!cancelled) setAssessmentActive(end ? new Date() <= new Date(end) : true);
      } catch {
        if (!cancelled) setAssessmentActive(null);
      }
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  const fetchStudents = useCallback(async () => {
    if (!courseId || !exerciseId) return;
    setLoadingStudents(true);
    setError(null);
    try {
      const res = await retestApi.getEnrolledStudents(courseId, exerciseId);
      setStudents(res?.data?.students || res?.students || res?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  }, [courseId, exerciseId]);

  const fetchRequests = useCallback(async () => {
    if (!courseId || !exerciseId) return;
    setLoadingRequests(true);
    try {
      const res = await retestApi.getRequests(courseId, exerciseId);
      setRequests(res?.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to load requests");
    } finally {
      setLoadingRequests(false);
    }
  }, [courseId, exerciseId]);

  useEffect(() => { fetchStudents(); fetchRequests(); }, [fetchStudents, fetchRequests]);

  const handleUnlock = async (startISO?: string, endISO?: string) => {
    if (!unlockTarget) return;
    setUnlocking(true);
    try {
      await retestApi.unlock({
        targetUserId: unlockTarget.studentId,
        courseId,
        exerciseId: unlockTarget.exerciseId || exerciseId,
        subcategory: unlockTarget.subcategory || subcategory,
        category: "You_Do",
        exerciseName: unlockTarget.exerciseName || assessmentName,
        retestStart: startISO || undefined,
        retestEnd: endISO || undefined,
        requestId: unlockTarget.requestId,
      });
      toast.success(`Assessment unlocked for ${unlockTarget.name}`);
      setUnlockTarget(null);
      await Promise.all([fetchStudents(), fetchRequests()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to unlock assessment");
    } finally {
      setUnlocking(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = students;
    if (statusFilter !== "all") {
      rows = rows.filter(s => bucketStatus(s.exerciseProgress?.status) === statusFilter);
    }
    if (q) {
      rows = rows.filter(s =>
        (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [students, search, statusFilter]);

  const pendingCount = useMemo(() => requests.filter(r => r.status === "Pending").length, [requests]);

  // ─── Header actions (Message All / Live Screens) + Check Answer nav ──────
  // Builds the shared context query string used by the outbound links.
  // Reports button was removed — dashboard is no longer part of the flow
  // (all controls now live inside this page), so a Reports button whose
  // sole purpose was to open the dashboard's Reports view has no target.
  const buildDashboardParams = useCallback(() => {
    const q = new URLSearchParams();
    if (assessmentId) { q.set("assessmentId", assessmentId); q.set("exerciseId", assessmentId); }
    if (courseId) q.set("courseId", courseId);
    if (nodeId) q.set("nodeId", nodeId);
    if (nodeType) q.set("nodeType", nodeType);
    if (moduleName) q.set("moduleName", moduleName);
    if (submoduleName) q.set("submoduleName", submoduleName);
    if (topicName) q.set("topicName", topicName);
    if (subtopicName) q.set("subtopicName", subtopicName);
    if (tabType) q.set("tabType", tabType);
    if (subcategory) q.set("subcategory", subcategory);
    return q;
  }, [
    assessmentId, courseId, nodeId, nodeType, moduleName, submoduleName,
    topicName, subtopicName, tabType, subcategory,
  ]);

  const openLiveScreens = useCallback(() => {
    const q = buildDashboardParams();
    router.push(`/lms/pages/courses/liveScreens?${q.toString()}`);
  }, [buildDashboardParams, router]);

  // Reports → navigate to the Reports page that lives INSIDE this folder
  // (`manageUsers/reports`). Its Back button already returns to Manage Users
  // so no `returnTo` sentinel is needed anymore.
  const openReports = useCallback(() => {
    const q = buildDashboardParams();
    router.push(`${sectionHref("manageUsers/reports")}?${q.toString()}`);
  }, [buildDashboardParams, router, sectionHref]);

  // Check Answer → open the reviewSubmission page in single-student mode. This
  // is the exact same navigation the Dashboard's StudentRow makes; keeping the
  // two entry points in sync means both surfaces land on the same grading UI.
  const handleCheckAnswers = useCallback((studentId: string) => {
    if (!assessmentId || !studentId) return;
    const q = buildDashboardParams();
    q.set("studentId", studentId);
    q.set("returnTo", "manageUsers");
    router.push(`${sectionHref("reviewSubmission")}?${q.toString()}`);
  }, [assessmentId, buildDashboardParams, router, sectionHref]);

  const sendIndividual = useCallback(
    (text: string) => emitWithAck("proctor:send_message", {
      assessmentId, studentId: messageStudent?._id, message: text,
    }),
    [assessmentId, messageStudent],
  );
  const sendBroadcast = useCallback(
    (text: string) => emitWithAck("proctor:broadcast_message", { assessmentId, message: text }),
    [assessmentId],
  );

  return (
    <div className="min-h-screen" style={{ background: T.pageBg, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-5">

        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-3"
          style={{ color: T.blue, background: "transparent", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={15} /> Back to Assessments
        </button>

        {/* Title */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: T.textMain }}>Manage Users</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: T.textMuted }}>
              {assessmentName}
            </p>
          </div>
          {/* Header action strip — Reports / Message All / Live Screens.
              Reports navigates to the local `./reports` route (owned by
              this folder, no dependency on liveDashboard). All three are
              Users-List-only. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {tab === "users" && (
              <>
                <button
                  onClick={openReports}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold text-white"
                  style={{ background: "#059669", border: "none", cursor: "pointer" }}
                  title="Open the Reports view"
                >
                  <FileText size={13} /> Reports
                </button>
                <button
                  onClick={() => setBroadcastOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold"
                  style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer" }}
                  title="Send a message to all students in live session"
                >
                  <Send size={13} /> Message All
                </button>
                <button
                  onClick={openLiveScreens}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold text-white"
                  style={{ background: "#4f46e5", border: "none", cursor: "pointer" }}
                  title="View students' live screens"
                >
                  <MonitorPlay size={13} /> Live Screens
                </button>
              </>
            )}
            <button
              onClick={() => { fetchStudents(); fetchRequests(); }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold"
              style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer" }}
            >
              <RefreshCw size={13} className={loadingStudents || loadingRequests ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: T.bg, border: `1px solid ${T.border}` }}>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2" style={{ borderBottom: `1px solid ${T.border}` }}>
            {([
              { key: "users", label: "Users List", icon: <Users size={15} /> },
              { key: "requests", label: "Request List", icon: <ClipboardList size={15} /> },
            ] as const).map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold"
                  style={{
                    color: active ? T.blue : T.textMuted,
                    borderBottom: `2px solid ${active ? T.blue : "transparent"}`,
                    background: "transparent", cursor: "pointer", marginBottom: -1,
                  }}
                >
                  {t.icon}{t.label}
                  {t.key === "requests" && pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center text-[10px] font-bold text-white rounded-full"
                      style={{ minWidth: 18, height: 18, padding: "0 5px", background: T.amber }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Users List ── */}
          {tab === "users" && (
            <div>
              <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-[15px] font-bold" style={{ color: T.textMain }}>Enrolled Students</h2>
                  <p className="text-[11.5px]" style={{ color: T.textMuted }}>
                    View and manage students assigned to this assessment.
                  </p>
                </div>
                {/* Filter row — search + status filter. The status filter uses
                    the raw exerciseProgress.status vocabulary the retest API
                    returns, bucketed into Not Submitted / In Progress /
                    Submitted for the same three-way UX as the Dashboard. */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: T.textHint }} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search students…"
                      className="pl-7 pr-3 h-8 w-56 text-[12px] rounded-lg outline-none"
                      style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textMain }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Filter size={13} style={{ color: T.textHint }} />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as StatusFilterValue)}
                      className="h-8 text-[12px] rounded-lg outline-none px-2"
                      style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textMain }}
                      aria-label="Filter by status"
                    >
                      {STATUS_FILTER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.red }}>{error}</div>
              ) : loadingStudents ? (
                <div className="px-4 py-16 flex flex-col items-center gap-3">
                  <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: T.blue, borderTopColor: "transparent" }} />
                  <p className="text-[12px]" style={{ color: T.textMuted }}>Loading students…</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="px-4 py-16 text-center text-[13px]" style={{ color: T.textMuted }}>No students found.</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: "#fafbfc", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                      {["Student Name", "Email", "Status", "Action"].map((h, i) => (
                        <th key={h} className="text-left px-4 py-2.5"
                          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: T.textMuted, textAlign: i === 3 ? "right" : "left" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => {
                      const rawStatus = s.exerciseProgress?.status || "not_started";
                      const st = STUDENT_STATUS_META[rawStatus] || STUDENT_STATUS_META.not_started;
                      // "Check Answer" visibility gate — the student must have
                      // written at least one answer to the DB. bucketStatus
                      // collapses evaluated/completed/submitted into "submitted"
                      // and any partial progress into "in_progress"; only the
                      // truly-never-started bucket hides the button.
                      const hasAnswerInDb = bucketStatus(rawStatus) !== "not_started";
                      return (
                        <tr key={s._id} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={s.name} />
                              <span className="text-[13px] font-semibold" style={{ color: T.textMain }}>{s.name || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12.5px]" style={{ color: T.textSub }}>{s.email || "—"}</td>
                          <td className="px-4 py-3"><Badge label={st.label} color={st.color} bg={st.bg} /></td>
                          <td className="px-4 py-3 text-right">
                            <UsersRowMenu
                              canCheck={hasAnswerInDb}
                              onCheckAnswer={() => handleCheckAnswers(s._id)}
                              onSendMessage={() => setMessageStudent(s)}
                              onUnlock={() => setUnlockTarget({ studentId: s._id, name: s.name })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Request List ── */}
          {tab === "requests" && (
            <div>
              <div className="px-4 pt-4 pb-3">
                <h2 className="text-[15px] font-bold" style={{ color: T.textMain }}>Requested Retest List</h2>
                <p className="text-[11.5px]" style={{ color: T.textMuted }}>
                  View and manage students who have requested to retake the assessment.
                </p>
              </div>

              {loadingRequests ? (
                <div className="px-4 py-16 flex flex-col items-center gap-3">
                  <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: T.blue, borderTopColor: "transparent" }} />
                  <p className="text-[12px]" style={{ color: T.textMuted }}>Loading requests…</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <ClipboardList size={26} style={{ color: T.textHint }} className="mx-auto mb-2" />
                  <p className="text-[13px] font-semibold" style={{ color: T.textSub }}>No retest requests yet</p>
                  <p className="text-[12px] mt-0.5" style={{ color: T.textMuted }}>Requests from students will appear here.</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: "#fafbfc", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                      {["Student Name", "Email", "Status", "Message (Reason)", "Requested On", "Action"].map((h, i) => (
                        <th key={h} className="text-left px-4 py-2.5"
                          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: T.textMuted, textAlign: i === 5 ? "right" : "left" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => {
                      const st = REQUEST_STATUS_META[r.status] || REQUEST_STATUS_META.Pending;
                      const isPending = r.status === "Pending";
                      return (
                        <tr key={r._id} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.studentName || ""} />
                              <span className="text-[13px] font-semibold" style={{ color: T.textMain }}>{r.studentName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12.5px]" style={{ color: T.textSub }}>{r.studentEmail || "—"}</td>
                          <td className="px-4 py-3"><Badge label={st.label} color={st.color} bg={st.bg} /></td>
                          <td className="px-4 py-3 text-[12px] max-w-[260px]" style={{ color: T.textSub }}>
                            <span className="line-clamp-2">{r.message || "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: T.textMuted }}>
                            {formatDateTime(r.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPending ? (
                              <button
                                onClick={() => setUnlockTarget({ studentId: r.studentId, name: r.studentName || "this student", requestId: r._id, subcategory: r.subcategory, exerciseName: r.exerciseName, exerciseId: r.exerciseId })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                                style={{ color: T.blue, background: "rgba(249,115,22,0.06)", border: `1px solid rgba(249,115,22,0.3)`, cursor: "pointer" }}
                              >
                                <Lock size={12} /> Unlock
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: T.green }}>
                                <CheckCircle size={13} /> Unlocked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {unlockTarget && (
        <UnlockModal
          name={unlockTarget.name}
          requireSchedule={assessmentActive !== true}
          loading={unlocking}
          onClose={() => { if (!unlocking) setUnlockTarget(null); }}
          onConfirm={handleUnlock}
        />
      )}

      {/* Send Message (per student). Kept as a small local component so we
          don't have to shim the EnrolledStudent shape into the Dashboard's
          MessageStudentModal props. */}
      {messageStudent && (
        <SendMessageModal
          name={messageStudent.name}
          email={messageStudent.email}
          onClose={() => setMessageStudent(null)}
          onSend={sendIndividual}
        />
      )}

      {/* Broadcast — sends the same `proctor:broadcast_message` socket event
          the Dashboard used. Kept as a local component so this page has no
          runtime dependency on the (removable) liveDashboard folder. */}
      <BroadcastMessageModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSend={sendBroadcast}
      />
    </div>
  );
}

// ─── Per-student message modal ────────────────────────────────────────────────
// Lightweight local variant of the Dashboard's MessageStudentModal — takes the
// name/email directly instead of the Dashboard-specific StudentProgress shape.
interface SendMessageModalProps {
  name: string;
  email?: string;
  onClose: () => void;
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
}
const MAX_MESSAGE = 500;
const SendMessageModal: React.FC<SendMessageModalProps> = ({ name, email, onClose, onSend }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const trimmed = text.trim();
  const handleSend = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const res = await onSend(trimmed);
    if (res.ok) { toast.success(`Message sent to ${name}`); onClose(); }
    else { setSending(false); setError(res.error || "Failed to send message."); }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold" style={{ color: T.textMain }}>Send Message to Student</h2>
          <button
            onClick={() => !sending && onClose()}
            className="p-1 rounded-lg"
            style={{ color: T.textMuted, background: "transparent", border: "none", cursor: sending ? "not-allowed" : "pointer" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: T.textMuted }}>Student</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[13px]" style={{ color: T.textSub }}>
              <Users size={15} style={{ color: T.textHint }} />
              <span className="truncate">
                {name}{email ? <span style={{ color: T.textHint }}> ({email})</span> : null}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: T.textMuted }}>Message</label>
            <textarea
              value={text}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here…"
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              style={{ color: T.textMain }}
            />
            <div className="flex items-center justify-between mt-1">
              {error ? <span className="text-[12px]" style={{ color: T.red }}>{error}</span> : <span />}
              <span className="text-[11px]" style={{ color: T.textHint }}>{text.length}/{MAX_MESSAGE}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => !sending && onClose()}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold border"
            style={{ color: T.textSub, background: T.bg, borderColor: T.border, cursor: sending ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!trimmed || sending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#4f46e5", border: "none", cursor: !trimmed || sending ? "not-allowed" : "pointer" }}
          >
            {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Broadcast (message all) modal ────────────────────────────────────────────
// Inlined copy of what used to live in liveDashboard/components — kept here so
// this page has zero runtime dependency on the (now-optional) liveDashboard
// folder. Same socket event on send, same UX, same 500-char cap.
interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => Promise<{ ok: boolean; error?: string; recipients?: number }>;
}
const BroadcastMessageModal: React.FC<BroadcastModalProps> = ({ open, onClose, onSend }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(""); setError(null); setSending(false);
      requestAnimationFrame(() => { setShow(true); taRef.current?.focus(); });
    } else {
      setShow(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  if (!open) return null;

  const trimmed = text.trim();
  const handleSend = async () => {
    if (!trimmed || sending) return;
    setSending(true); setError(null);
    const res = await onSend(trimmed);
    if (res.ok) onClose();
    else { setSending(false); setError(res.error || "Failed to send message. Please try again."); }
  };

  return (
    <div
      className={`fixed inset-0 z-[1100] flex items-center justify-center p-4 transition-opacity duration-150 ${show ? "opacity-100" : "opacity-0"}`}
      style={{ background: "rgba(15,23,42,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 transition-all duration-150 ${show ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-2 opacity-0"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Send Message to All Students</h2>
          <button
            onClick={() => !sending && onClose()}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
            style={{ background: "transparent", border: "none", cursor: sending ? "not-allowed" : "pointer" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg bg-indigo-50 border border-indigo-100 px-3.5 py-3">
            <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-relaxed text-indigo-700">
              This message will be sent to all students who are currently in live session.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Message</label>
            <textarea
              ref={taRef}
              value={text}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here…"
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
            <div className="flex items-center justify-between mt-1">
              {error ? <span className="text-[12px] text-red-500">{error}</span> : <span />}
              <span className="text-[11px] text-gray-400">{text.length}/{MAX_MESSAGE}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => !sending && onClose()}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ background: T.bg, cursor: sending ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!trimmed || sending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            style={{ border: "none", cursor: !trimmed || sending ? "not-allowed" : "pointer" }}
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to All
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ManageUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.pageBg }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: T.blue, borderTopColor: "transparent" }} />
      </div>
    }>
      <ManageUsersInner />
    </Suspense>
  );
}
