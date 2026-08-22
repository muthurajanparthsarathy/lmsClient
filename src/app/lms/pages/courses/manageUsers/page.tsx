"use client";

// Manage Users — proctor view for a single You_Do assessment.
//
// The LOOK is a mirror of User Management (/lms/pages/usermanagement): same
// slim heading, same compact `h-9` search + Filter toolbar, same inline
// expanding filter panel + removable chip strip, same table metrics
// (h-9 header on bg-canvas / h-12 body rows, sticky header, hover fill), same
// StatusPill for status, same `bg-brand-strong text-white` primary button and
// `border-hairline-strong bg-surface` secondary buttons, same shared
// TableFooter for pagination. Nothing about the underlying flow changed —
// this remains the retest / live-controls surface it was: Reports, Message
// All, Live Screens, per-row Check Answer / Send Message / Unlock, and a
// second "Request List" tab for retest requests.
//
// The bespoke look this file used to carry (its own `T` token table with
// indigo `#6366f1` renamed as "blue", per-row hex badges, custom spinner
// rings, per-row custom button pills, no pagination) is gone. Ordinary hover
// buttons no longer carry a colour prop; only genuinely-semantic entries
// (Unlock = destructive-adjacent = danger red) keep one.

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import ReactDOM from "react-dom";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Users, ClipboardList, MoreVertical, Lock, X, AlertTriangle,
  Search, RefreshCw, CheckCircle, Send, MonitorPlay, ClipboardCheck,
  MessageSquare, Filter, Info, Loader2, FileText, RotateCcw, SearchX,
} from "lucide-react";
import { retestApi, type RetestRequestRecord, type EnrolledStudent } from "@/apiServices/retest";
import { exerciseApi } from "@/apiServices/exercise";
import { getSocket } from "@/apiServices/socketClient";
import { EmptyState, StatusPill, pageEnter } from "@/app/lms/shared/ui";
import type { StatusPillTone } from "@/app/lms/shared/ui/StatusPill";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import { UserAvatar } from "@/app/lms/pages/usermanagement/components/UserAvatar";
import { Loading } from "@/components/loading-ui/loading";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// Enrolled-student exerciseProgress.status → StatusPill tone + label. Same
// three-way UX as the Dashboard: Not Submitted / In Progress / Submitted.
// `evaluated` / `completed` / `submitted` all collapse to a single green
// "Submitted" so trainers don't have to distinguish trivially-different
// server states in the table.
const studentStatusPill = (raw?: string | null): { tone: StatusPillTone; label: string } => {
  const s = (raw || "").toLowerCase();
  if (s === "evaluated" || s === "completed" || s === "submitted")
    return { tone: "success", label: "Submitted" };
  if (s === "in_progress")
    return { tone: "brand", label: "In Progress" };
  return { tone: "neutral", label: "Not Submitted" };
};

const requestStatusPill = (raw?: string | null): { tone: StatusPillTone; label: string } => {
  const s = String(raw || "").toLowerCase();
  if (s === "approved") return { tone: "success", label: "Approved" };
  if (s === "rejected") return { tone: "danger", label: "Rejected" };
  return { tone: "warn", label: "Pending" };
};

// ─── Row actions menu ─────────────────────────────────────────────────────────
// Kebab menu opened from a row. Portal so it isn't clipped by the table's
// overflow container. Reads as a plain neutral menu — every item inherits
// text-body / text-heading on hover; only Unlock keeps a red tint because
// it clears the student's saved answers.
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

  const itemCls = "flex items-center gap-2 w-full px-2.5 py-2 text-sm font-medium rounded-chip transition-colors duration-150 text-body hover:bg-row-hover hover:text-heading";
  const dangerCls = "flex items-center gap-2 w-full px-2.5 py-2 text-sm font-medium rounded-chip transition-colors duration-150 text-danger-700 hover:bg-danger-50";

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-label="Row actions"
        className={`inline-flex items-center justify-center size-7 rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors duration-150 ${open ? "bg-row-hover text-heading" : ""}`}
      >
        <MoreVertical size={15} />
      </button>
      {open && pos && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          className="users-row-menu bg-surface border border-hairline-strong rounded-tile shadow-lg p-1.5"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 100000, minWidth: 200 }}
        >
          {canCheck && (
            <button onClick={() => { setOpen(false); onCheckAnswer(); }} className={itemCls}>
              <ClipboardCheck size={14} className="text-subtle" /> Check Answer
            </button>
          )}
          <button onClick={() => { setOpen(false); onSendMessage(); }} className={itemCls}>
            <MessageSquare size={14} className="text-subtle" /> Send Message
          </button>
          {canCheck && <div className="my-1 h-px bg-hairline" />}
          <button onClick={() => { setOpen(false); onUnlock(); }} className={dangerCls}>
            <Lock size={14} /> Unlock Assessment
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

// ─── Unlock confirmation modal ────────────────────────────────────────────────
// The retune here is minimal — same layout, same wording, same behaviour;
// tokens swapped to the shared palette (bg-surface / text-heading / border-
// hairline / danger-700) so the modal reads like the app's other confirm
// dialogs instead of a bespoke amber card. The per-student retest window
// controls stay identical.
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
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden bg-surface shadow-xl border border-hairline"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-heading transition-colors duration-150"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center px-7 pt-7 pb-3">
          <div className="flex items-center justify-center rounded-full mb-3 bg-warn-50 text-warn-700" style={{ width: 56, height: 56 }}>
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-md font-bold text-heading">Unlock Assessment?</h3>
          <p className="text-sm text-subtle mt-1.5">
            Are you sure you want to unlock the assessment for{" "}
            <span className="font-semibold text-heading">{name}</span>?
          </p>
        </div>

        {requireSchedule ? (
          <div className="px-7 pb-2">
            <div className="rounded-tile p-3.5 bg-canvas border border-hairline">
              <p className="text-xs font-semibold mb-2.5 text-subtle">
                The assessment window has ended — set a retest window for this student only
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider mb-1 text-subtle">Start</label>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    className="w-full h-9 rounded-control border border-hairline-strong bg-surface text-sm text-body px-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider mb-1 text-subtle">End</label>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={e => setEnd(e.target.value)}
                    className={`w-full h-9 rounded-control border bg-surface text-sm text-body px-2.5 outline-none transition-colors duration-150 ${touched && invalid ? "border-danger-700/60 focus:border-danger-700 focus:ring-2 focus:ring-danger-700/15" : "border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand/15"}`}
                  />
                </div>
              </div>
              {touched && invalid && (
                <p className="text-xs mt-2 flex items-center gap-1 text-danger-700">
                  <AlertTriangle size={11} /> End time must be after the start time.
                </p>
              )}
              <p className="text-2xs mt-2.5 leading-relaxed text-faint">
                The student's previous answers are cleared and the Start button reappears for them only during this window.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-7 pb-2">
            <div className="rounded-tile p-3.5 bg-canvas border border-hairline">
              <p className="text-sm leading-relaxed text-subtle">
                This assessment is still open, so no schedule is needed. Unlocking clears{" "}
                <span className="font-semibold text-heading">{name}</span>'s previous answers so they can retake it within the assessment's current window.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-7 py-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 rounded-control text-sm font-semibold border border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading disabled:opacity-50 transition-colors duration-150"
          >
            No, Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || invalid}
            className="flex-1 h-10 rounded-control text-sm font-semibold text-white bg-danger-700 hover:bg-danger-700/90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Unlocking…</>
            ) : (
              <><Lock size={14} /> Yes, Unlock</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Socket helper — mirrors liveDashboard's emitWithAck exactly ──────────────
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

// ─── Status filter options ────────────────────────────────────────────────────
// Same three-way UX as the Dashboard, keyed to the retest API's raw
// `exerciseProgress.status` vocabulary via `bucketStatus`.
type StatusFilterValue = "all" | "not_started" | "in_progress" | "submitted";
const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all",          label: "All statuses" },
  { value: "not_started",  label: "Not Submitted" },
  { value: "in_progress",  label: "In Progress"   },
  { value: "submitted",    label: "Submitted"     },
];

const bucketStatus = (raw?: string | null): Exclude<StatusFilterValue, "all"> => {
  const s = (raw || "").toLowerCase();
  if (s === "evaluated" || s === "completed" || s === "submitted") return "submitted";
  if (s === "in_progress") return "in_progress";
  return "not_started";
};

// Fixed page size — matches User Management + the student Feedback list, so
// every listing surface in the app paginates at the same rhythm.
const PAGE_SIZE = 10;

// ─── Shared column widths (Users List table) ─────────────────────────────────
// `table-layout: fixed`, percentages sum to 100. Same shape as User
// Management's UsersTable: checkbox column dropped (no bulk actions here),
// Actions column matches the same 8% kebab slot.
const USERS_COL = {
  user:    "w-[32%] pl-4 sm:pl-5 pr-3 text-left",
  email:   "w-[36%] px-3 text-left",
  status:  "w-[24%] px-3 text-right whitespace-nowrap",
  actions: "w-[8%]  pl-2 pr-4 sm:pr-5 text-right",
};

// Request List column widths — six columns, wider Message column since it
// carries a free-form reason from the student.
const REQ_COL = {
  user:      "w-[20%] pl-4 sm:pl-5 pr-3 text-left",
  email:     "w-[20%] px-3 text-left",
  status:    "w-[10%] px-3 text-left whitespace-nowrap",
  message:   "w-[26%] px-3 text-left",
  requested: "w-[12%] px-3 text-left whitespace-nowrap",
  action:    "w-[12%] pl-2 pr-4 sm:pr-5 text-right",
};

const HEAD_CELL =
  "h-9 text-xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";
const BODY_CELL = "h-12 align-middle";

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
  // trail.
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

  // Toolbar state — mirrors User Management's compact search + Filter toggle
  // + expanding filter panel + chip strip pattern exactly.
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [currentPage, setCurrentPage] = useState(1);

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
  // unlocking is a plain reset (student retakes within the current window).
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

  // ── Pagination (client-side; enrolment lists are small) ──
  const totalFiltered = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, totalFiltered);
  const pageStudents = useMemo(
    () => filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredStudents, safePage],
  );
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, tab]);
  useEffect(() => { setCurrentPage(p => Math.min(p, totalPages)); }, [totalPages]);

  const pendingCount = useMemo(() => requests.filter(r => r.status === "Pending").length, [requests]);

  const activeFilterCount = statusFilter === "all" ? 0 : 1;
  const hasActiveFilters = activeFilterCount > 0 || !!search.trim();
  const clearAllFilters = () => { setStatusFilter("all"); setSearch(""); };
  const statusChipLabel = statusFilter === "not_started" ? "Not Submitted"
    : statusFilter === "in_progress" ? "In Progress"
      : statusFilter === "submitted" ? "Submitted" : "";

  // ─── Header actions (Message All / Live Screens / Reports) + Check Answer ──
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

  const openReports = useCallback(() => {
    const q = buildDashboardParams();
    router.push(`${sectionHref("manageUsers/reports")}?${q.toString()}`);
  }, [buildDashboardParams, router, sectionHref]);

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

  // ── Empty state — same three-way (error / filtered / no data) that User
  //    Management's UsersTable emptyState uses. ────────────────────────────
  const usersEmpty =
    error ? (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load students"
        message={error}
        secondaryAction={
          <button
            type="button"
            onClick={fetchStudents}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
          >
            Try again
          </button>
        }
      />
    ) : hasActiveFilters ? (
      <EmptyState
        icon={SearchX}
        title="No students match your filters"
        message="Try a different search, or clear the filters to see everyone."
        secondaryAction={
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
          >
            Clear filters
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={Users}
        title="No enrolled students yet"
        message="Students enrolled in this course will appear here once they're added."
      />
    );

  return (
    <motion.div
      variants={pageEnter}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-surface-sunken"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 pt-3 pb-6">

        {/* Back link — matches the tone/size of secondary navigation buttons
            used elsewhere; no bespoke coloured link. */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 mb-3"
        >
          <ArrowLeft size={13} /> Back to Assessments
        </button>

        {/* Slim heading — same weight and scale as User Management's H1. */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
              Manage Users
            </h1>
            <p className="mt-0.5 text-xs text-subtle truncate">
              {assessmentName}
            </p>
          </div>
        </div>

        {/* One toolbar — search left, Refresh + Filter + Reports + Message All +
            Live Screens right. Mirrors User Management's toolbar composition,
            including the brand-strong primary button on the right for the
            "start a live operation" action (Live Screens here). */}
        <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "users" ? "Search students…" : "Search requests…"}
              className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => { fetchStudents(); fetchRequests(); }}
              aria-label="Refresh"
              className="inline-flex items-center justify-center h-9 w-9 rounded-control border border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
            >
              <RefreshCw size={14} className={loadingStudents || loadingRequests ? "animate-spin" : ""} />
            </button>

            {tab === "users" && (
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                aria-expanded={showFilters}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-control border text-sm font-medium transition-colors duration-150 relative ${
                  activeFilterCount > 0 || showFilters
                    ? "border-brand text-brand-strong bg-brand-wash"
                    : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {tab === "users" && (
              <>
                <button
                  type="button"
                  onClick={openReports}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">Reports</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">Message All</span>
                </button>
                <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />
                <motion.button
                  type="button"
                  onClick={openLiveScreens}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  <MonitorPlay size={14} />
                  <span className="hidden sm:inline">Live Screens</span>
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Inline filter panel — expands under the toolbar exactly like User
            Management's UserFilterPanel. Only Status matters for this list, so
            the panel is a single dropdown; the shell (rounded-xl border
            hairline shadow-xs card, header row with Reset + close) matches. */}
        <AnimatePresence initial={false}>
          {tab === "users" && showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl border border-hairline bg-surface shadow-xs p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-sm font-semibold text-heading">Filters</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      disabled={activeFilterCount === 0}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-xs font-medium text-subtle hover:text-heading hover:bg-row-hover disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-150"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilters(false)}
                      aria-label="Close filters"
                      className="inline-flex size-8 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-heading transition-colors duration-150"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="max-w-xs">
                  <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
                    Submission
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
                    className="w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                  >
                    {STATUS_FILTER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active-filter chips (visible only when filters are on) */}
        {tab === "users" && activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
              {statusChipLabel}
              <button
                type="button"
                aria-label={`Remove ${statusChipLabel} filter`}
                onClick={() => setStatusFilter("all")}
                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
              >
                <X size={11} />
              </button>
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Tabs — same underline strip as before but retuned to the brand
            palette: idle = text-subtle, active = text-brand-strong with a
            2px brand-strong underline. */}
        <div className="mt-4 flex items-center gap-1 border-b border-hairline">
          {([
            { key: "users",    label: "Users List",   icon: <Users size={14} /> },
            { key: "requests", label: "Request List", icon: <ClipboardList size={14} /> },
          ] as const).map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold transition-colors duration-150 -mb-px border-b-2 ${
                  active
                    ? "text-brand-strong border-brand-strong"
                    : "text-subtle hover:text-heading border-transparent"
                }`}
              >
                {t.icon}{t.label}
                {t.key === "requests" && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-2xs font-semibold bg-warn-50 text-warn-700 ring-1 ring-inset ring-warn-500/20">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Users List body ── */}
        {tab === "users" && (
          <div className="mt-3 flex flex-col rounded-xl border border-hairline bg-surface overflow-hidden">
            <div className="overflow-y-auto overflow-x-hidden">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead className="sticky top-0 z-sticky">
                  <tr>
                    <th className={`${HEAD_CELL} ${USERS_COL.user}`}>Student</th>
                    <th className={`${HEAD_CELL} ${USERS_COL.email}`}>Email</th>
                    <th className={`${HEAD_CELL} ${USERS_COL.status}`}>Status</th>
                    <th className={`${HEAD_CELL} ${USERS_COL.actions}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={4} className="py-16">
                        <Loading label="Loading students…" size="size-10" />
                      </td>
                    </tr>
                  ) : pageStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12">
                        {usersEmpty}
                      </td>
                    </tr>
                  ) : (
                    pageStudents.map(s => {
                      const pill = studentStatusPill(s.exerciseProgress?.status);
                      const hasAnswerInDb = bucketStatus(s.exerciseProgress?.status) !== "not_started";
                      return (
                        <tr
                          key={s._id}
                          className="group border-b border-hairline last:border-0 hover:bg-row-hover transition-colors duration-150"
                        >
                          <td className={`${USERS_COL.user} ${BODY_CELL} text-sm font-medium text-heading`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar name={s.name} size="xs" />
                              <span className="truncate" title={s.name || undefined}>{s.name || "—"}</span>
                            </div>
                          </td>
                          <td className={`${USERS_COL.email} ${BODY_CELL}`}>
                            <span className="text-sm text-subtle truncate block" title={s.email || undefined}>
                              {s.email || "—"}
                            </span>
                          </td>
                          <td className={`${USERS_COL.status} ${BODY_CELL}`}>
                            <StatusPill tone={pill.tone} dot className="max-w-full">
                              <span className="truncate">{pill.label}</span>
                            </StatusPill>
                          </td>
                          <td className={`${USERS_COL.actions} ${BODY_CELL}`}>
                            <div className="flex justify-end">
                              <UsersRowMenu
                                canCheck={hasAnswerInDb}
                                onCheckAnswer={() => handleCheckAnswers(s._id)}
                                onSendMessage={() => setMessageStudent(s)}
                                onUnlock={() => setUnlockTarget({ studentId: s._id, name: s.name })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loadingStudents && totalFiltered > 0 && (
              <TableFooter
                from={rangeStart}
                to={rangeEnd}
                total={totalFiltered}
                pageSize={PAGE_SIZE}
                onPageSize={() => { /* fixed page size, matches User Management */ }}
                currentPage={safePage}
                totalPages={totalPages}
                onPage={setCurrentPage}
              />
            )}
          </div>
        )}

        {/* ── Request List body ── */}
        {tab === "requests" && (
          <div className="mt-3 flex flex-col rounded-xl border border-hairline bg-surface overflow-hidden">
            <div className="overflow-y-auto overflow-x-hidden">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead className="sticky top-0 z-sticky">
                  <tr>
                    <th className={`${HEAD_CELL} ${REQ_COL.user}`}>Student</th>
                    <th className={`${HEAD_CELL} ${REQ_COL.email}`}>Email</th>
                    <th className={`${HEAD_CELL} ${REQ_COL.status}`}>Status</th>
                    <th className={`${HEAD_CELL} ${REQ_COL.message}`}>Message</th>
                    <th className={`${HEAD_CELL} ${REQ_COL.requested}`}>Requested</th>
                    <th className={`${HEAD_CELL} ${REQ_COL.action}`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={6} className="py-16">
                        <Loading label="Loading requests…" size="size-10" />
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12">
                        <EmptyState
                          icon={ClipboardList}
                          title="No retest requests yet"
                          message="Requests from students will appear here once they submit them."
                        />
                      </td>
                    </tr>
                  ) : (
                    requests.map(r => {
                      const pill = requestStatusPill(r.status);
                      const isPending = r.status === "Pending";
                      return (
                        <tr
                          key={r._id}
                          className="group border-b border-hairline last:border-0 hover:bg-row-hover transition-colors duration-150"
                        >
                          <td className={`${REQ_COL.user} ${BODY_CELL} text-sm font-medium text-heading`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar name={r.studentName || ""} size="xs" />
                              <span className="truncate" title={r.studentName || undefined}>{r.studentName || "—"}</span>
                            </div>
                          </td>
                          <td className={`${REQ_COL.email} ${BODY_CELL}`}>
                            <span className="text-sm text-subtle truncate block" title={r.studentEmail || undefined}>
                              {r.studentEmail || "—"}
                            </span>
                          </td>
                          <td className={`${REQ_COL.status} ${BODY_CELL}`}>
                            <StatusPill tone={pill.tone} dot className="max-w-full">
                              <span className="truncate">{pill.label}</span>
                            </StatusPill>
                          </td>
                          <td className={`${REQ_COL.message} ${BODY_CELL}`}>
                            <span className="text-sm text-subtle line-clamp-2" title={r.message || undefined}>
                              {r.message || "—"}
                            </span>
                          </td>
                          <td className={`${REQ_COL.requested} ${BODY_CELL}`}>
                            <span className="text-sm text-subtle tabular-nums truncate block">
                              {formatDateTime(r.createdAt)}
                            </span>
                          </td>
                          <td className={`${REQ_COL.action} ${BODY_CELL}`}>
                            <div className="flex justify-end">
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={() => setUnlockTarget({
                                    studentId: r.studentId,
                                    name: r.studentName || "this student",
                                    requestId: r._id,
                                    subcategory: r.subcategory,
                                    exerciseName: r.exerciseName,
                                    exerciseId: r.exerciseId,
                                  })}
                                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-brand-500/30 bg-brand-wash text-xs font-semibold text-brand-strong hover:bg-brand-wash-hover transition-colors duration-150"
                                >
                                  <Lock size={12} /> Unlock
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-700">
                                  <CheckCircle size={13} /> Unlocked
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

      {messageStudent && (
        <SendMessageModal
          name={messageStudent.name}
          email={messageStudent.email}
          onClose={() => setMessageStudent(null)}
          onSend={sendIndividual}
        />
      )}

      <BroadcastMessageModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSend={sendBroadcast}
      />
    </motion.div>
  );
}

// ─── Per-student message modal ────────────────────────────────────────────────
// Same behaviour as before (proctor:send_message socket, 500-char cap), tokens
// swapped to the shared design system so it reads like the app's other confirm
// dialogs.
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
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-xl border border-hairline overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="text-md font-semibold text-heading">Send Message to Student</h2>
          <button
            onClick={() => !sending && onClose()}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50"
            disabled={sending}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-subtle">Student</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-control border border-hairline bg-canvas text-sm text-body">
              <Users size={14} className="text-faint" />
              <span className="truncate">
                {name}{email ? <span className="text-faint"> ({email})</span> : null}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-subtle">Message</label>
            <textarea
              value={text}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here…"
              rows={4}
              autoFocus
              className="w-full resize-none rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            <div className="flex items-center justify-between mt-1">
              {error ? <span className="text-xs text-danger-700">{error}</span> : <span />}
              <span className="text-2xs text-faint">{text.length}/{MAX_MESSAGE}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-hairline">
          <button
            onClick={() => !sending && onClose()}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-50 transition-colors duration-150"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!trimmed || sending}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Broadcast (message all) modal ────────────────────────────────────────────
// Same 500-char cap + `proctor:broadcast_message` socket event; tokens
// retuned to the shared palette. Kept inlined here so the page has no
// runtime dependency on the (now-optional) liveDashboard folder.
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
      className={`fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 transition-opacity duration-150 ${show ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-surface shadow-xl border border-hairline overflow-hidden transition-all duration-150 ${show ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-2 opacity-0"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="text-md font-semibold text-heading">Send Message to All Students</h2>
          <button
            onClick={() => !sending && onClose()}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50"
            disabled={sending}
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start gap-2.5 rounded-control bg-brand-wash border border-brand-500/30 px-3.5 py-3">
            <Info size={16} className="text-brand-strong flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed text-brand-strong">
              This message will be sent to all students who are currently in live session.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-subtle">Message</label>
            <textarea
              ref={taRef}
              value={text}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here…"
              rows={4}
              className="w-full resize-none rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            <div className="flex items-center justify-between mt-1">
              {error ? <span className="text-xs text-danger-700">{error}</span> : <span />}
              <span className="text-2xs text-faint">{text.length}/{MAX_MESSAGE}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-hairline">
          <button
            onClick={() => !sending && onClose()}
            className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-50 transition-colors duration-150"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!trimmed || sending}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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
      <div className="min-h-screen flex items-center justify-center bg-surface-sunken">
        <Loading label="Loading…" size="size-10" />
      </div>
    }>
      <ManageUsersInner />
    </Suspense>
  );
}
