"use client";
import { getToken, getUserId, getSessionItem, SESSION_KEYS } from "@/lib/session";
import { useCourseRosterQuery } from "@/queries/courseRoster";
import { useInvalidateAttendance } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import { useQuery } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Management — single-day attendance sheet.
// - Rows: students enrolled in the course with role === 'student'.
// - One date at a time — picked via the ?date= param (layout header owns the
//   date picker); defaults to today.
// - Columns: Present / Absent / Half-day, one checkbox per student per column
//   (mutually exclusive). Each column header carries a labelled "Select all"
//   checkbox that marks the whole class at once.
// - Marks are LOCAL only until the "Save changes" bar below the grid is
//   clicked. On save, every dirty A (absent/leave) and H (half-day) mark must
//   get a reason — collected in one modal listing all of them.
// - Sessions are intentionally OUT of scope for this pass (server model has an
//   optional sessionId slot ready for a follow-up).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileText,
  FileSpreadsheet,
  MessageSquareWarning,
  Check,
  Clock,
  Layers,
  MoreHorizontal,
  Search,
  X,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  attendanceApi,
  type AttendanceStatus,
  type AttendanceRecord,
  type HalfPeriod,
} from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { EmptyState, Skeleton } from "@/app/lms/shared/ui";

/* ── StyledSelect — portalled listbox with the same floating-label chrome as
   the rest of the L&D pickers. Local to this file so AttendanceTab stays a
   single import; API mirrors a bare <select> so existing dirty-cell guards
   and value/onChange plumbing keep working unchanged. */
function StyledSelect({
  label, value, options, onChange, ariaLabel, icon,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPop({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    };
    update();
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active];
      if (opt) { onChange(opt.value); setOpen(false); }
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        className={`relative flex h-9 min-w-[10rem] items-center rounded-md border bg-surface pl-2.5 pr-7 text-left transition-colors hover:border-hairline-strong ${open ? "border-brand-500 ring-2 ring-brand-500/15" : "border-hairline"}`}
      >
        {label && (
          <span className="pointer-events-none absolute -top-1.5 left-2 bg-surface px-1 text-[10px] font-medium leading-none text-subtle">
            {label}
          </span>
        )}
        {icon && <span className="mr-1.5 shrink-0">{icon}</span>}
        <span className="min-w-0 truncate text-xs font-semibold text-heading">{current?.label ?? "Select…"}</span>
        <ChevronDown size={12} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pop && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-label={ariaLabel || label}
          style={{ position: "fixed", top: pop.top, left: pop.left, minWidth: pop.width, pointerEvents: "auto" }}
          className="z-[9999] max-h-64 overflow-y-auto rounded-md border border-hairline bg-surface py-1 shadow-xl ring-1 ring-black/[0.04]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            const isActive = i === active;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                    : isActive
                      ? "bg-row-hover text-heading"
                      : "text-body hover:bg-row-hover"
                }`}
              >
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
const toDayKey = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

const fmt = (d: Date) => {
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const yr = d.getUTCFullYear();
  return `${String(day).padStart(2, "0")}-${mon}-${yr}`;
};

const fmtWeekday = (d: Date) =>
  d.toLocaleString("en-GB", { weekday: "long", timeZone: "UTC" });

const isWeekend = (d: Date) => {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
};

// Midnight UTC of "today" — used to gate marking so admins can't fill in
// attendance for days that haven't happened yet.
const todayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

const isFuture = (d: Date) => d.getTime() > todayUtc().getTime();

// ── Types ──────────────────────────────────────────────────────────────────
type Student = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  enrolmentStatus?: string;
};

// One batch of the course, as attendance sees it: the students to mark, plus
// EVERY member id (staff included) — membership is what entitles a non-admin
// to mark the batch.
type BatchGroup = {
  _id: string;
  batchName: string;
  students: Student[];
  memberIds: string[];
};

type CellState = {
  status: AttendanceStatus | "";
  reason?: string;        // populated for A / H marks
  halfPeriod?: HalfPeriod; // populated for H marks
  dirty: boolean;          // has an unsaved change since last fetch
};

type Grid = Map<string, Map<string, CellState>>; // studentId → (dateKey → state)

// One row in the save-time reasons modal — a dirty A / H mark awaiting reason.
type ReasonItem = {
  studentId: string;
  dateKey: string;
  name: string;
  status: "A" | "H";
  reason: string;
  halfPeriod: HalfPeriod;
};

// The three markable status columns of the sheet.
const STATUS_COLUMNS: {
  key: AttendanceStatus;
  label: string;
  accent: string;   // checkbox accent
  headText: string; // header text colour
}[] = [
  { key: "P", label: "Present", accent: "accent-success-700", headText: "text-success-700" },
  { key: "A", label: "Absent", accent: "accent-danger-700", headText: "text-danger-700" },
  { key: "H", label: "Half-day", accent: "accent-warn-500", headText: "text-warn-700" },
];

// Colour ramps for the per-student toggle (filled when marked) and the column
// "mark all" pill (soft-tinted when the whole class already carries it).
const statusOnClasses: Record<AttendanceStatus, string> = {
  P: "border-success-500 bg-success-500 text-white",
  A: "border-danger-500 bg-danger-500 text-white",
  H: "border-warn-500 bg-warn-500 text-white",
};
const toneAllActive: Record<AttendanceStatus, string> = {
  P: "border-success-500/40 bg-success-50 text-success-700",
  A: "border-danger-500/40 bg-danger-50 text-danger-700",
  H: "border-warn-500/40 bg-warn-50 text-warn-700",
};
const statusHeadText: Record<AttendanceStatus, string> = {
  P: "text-success-700",
  A: "text-danger-700",
  H: "text-warn-700",
};

// ── Component ──────────────────────────────────────────────────────────────
interface AttendanceTabProps {
  courseId: string;
  onResetHandled?: () => void;
  resetSignal?: number; // parent bumps this to trigger a reset confirm from outside
}

export default function AttendanceTab({ courseId }: AttendanceTabProps) {
  // Batch-structured roster. `flatStudents` is the whole course deduped, used
  // only when the course has no real batches; otherwise the selected batch's
  // list is the roster. Both are derived from the shared roster query below.
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  // Auto-fit pagination — measures the painted tbody height and slices the
  // roster so the whole table fits without an inner scrollbar.
  const [attPage, setAttPage] = useState(1);
  const [attPageSize, setAttPageSize] = useState(10);
  const attTableWrapRef = React.useRef<HTMLDivElement | null>(null);
  // A batch pill clicked while unsaved marks exist — held here until the
  // discard-confirm dialog resolves it (null = dialog closed).
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Who is looking: admins mark every batch; institution-wide viewer roles
  // (POC / L&D Head / Sub Head — the same set the server's overview widens
  // for) see every batch but read-only; everyone else only batches they are
  // enrolled in. Read post-mount so SSR/hydration never disagree.
  const [me, setMe] = useState<{ id: string; admin: boolean; viewer: boolean }>({
    id: "",
    admin: false,
    viewer: false,
  });
  useEffect(() => {
    const admin =
      (getSessionItem(SESSION_KEYS.originalRole) || "").trim().toLowerCase() === "admin";
    const roleValue = (getSessionItem(SESSION_KEYS.roleValue) || "").trim().toLowerCase();
    setMe({
      id: getUserId() || "",
      admin,
      viewer: !admin && ["poc", "ldhead", "subhead"].includes(roleValue),
    });
  }, []);

  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  // L&D Head flow (?from=ldc): review-only chrome — the Detailed report modal
  // in the shell header already covers download/remarks, and the date badge
  // is redundant with the header's date input.
  const fromLdc = searchParams.get("from") === "ldc";
  // Density tokens — L&D wants a scan-heavy compact roster, but the trainer /
  // admin marking view is action-heavy (click into circles) and reads better
  // at the original comfortable scale.
  const D = fromLdc
    ? {
        cellPad:     "px-3 py-1.5",
        theadPad:    "px-3 py-1",
        theadText:   "text-[10px]",
        avatarSize:  "w-7 h-7 text-[10px]",
        nameText:    "text-[13px]",
        emailText:   "text-[10px]",
        circleSize:  "h-7 w-7",
        checkIcon:   "h-4 w-4",
        chip:        "h-6 rounded-chip border border-hairline bg-surface px-2 text-[11px]",
        statusCellPad: "px-2 py-1",
      }
    : {
        cellPad:     "px-3 py-2.5",
        theadPad:    "px-3 py-2.5",
        theadText:   "text-2xs",
        avatarSize:  "w-8 h-8 text-xs",
        nameText:    "text-sm",
        emailText:   "text-2xs",
        circleSize:  "h-7 w-7",
        checkIcon:   "h-4 w-4",
        chip:        "h-7 rounded-chip border border-hairline bg-surface px-2.5 text-xs",
        statusCellPad: "px-2 py-2",
      };
  const selectedDay = useMemo(
    () => (dateParam ? parseKey(dateParam) : todayUtc()),
    [dateParam]
  );
  const dayKey = toDayKey(selectedDay);
  const future = isFuture(selectedDay);

  const [grid, setGrid] = useState<Grid>(new Map());
  // Bumped by "Discard" to refetch the day and drop local edits.
  const [refreshKey, setRefreshKey] = useState(0);
  // Which report the format-picker modal is asking about — null means closed.
  const [reportPicker, setReportPicker] = useState<null | "attendance" | "remarks">(null);
  // Layout header has Download / Remarks buttons; they dispatch a CustomEvent
  // that this listener resolves into the local report-picker state, so the
  // exporters (which live down here) stay where their data is without lifting
  // them into the shell.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "attendance" || detail === "remarks") setReportPicker(detail);
    };
    window.addEventListener("attm:openReport", onOpen);
    return () => window.removeEventListener("attm:openReport", onOpen);
  }, []);
  const rev = searchParams.get("rev");

  // ── Enrolled students (role === 'student') ──────────────────────────────
  // Read from the shared roster entry (queries/courseRoster.ts) instead of a
  // private fetch — the same request backs attendance report/analytics, the
  // enrollment tab and every feedback screen. Purely derived, so unlike the
  // day-grid below there is no local edit state to protect.
  const { data: roster, isLoading: loadingStudents } = useCourseRosterQuery(courseId || "");
  const invalidateAttendance = useInvalidateAttendance();

  const { batchGroups, flatStudents } = useMemo(() => {
    // Natural sort by Enrollment No. so APL-2026-001 < 002 < 010 < 100,
    // and rows with no enrollment id sink to the bottom instead of
    // scattering the sort.
    const sortStudents = (list: Student[]) =>
      list.sort((a, b) => {
        const aEmpty = !a.userId;
        const bEmpty = !b.userId;
        if (aEmpty && bEmpty)
          return `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
            undefined,
            { sensitivity: "base" }
          );
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        return a.userId!.localeCompare(b.userId!, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });

    const isStudentUser = (user: any) => {
      const role =
        typeof user?.role === "string"
          ? user.role
          : user?.role?.renameRole || user?.role?.name || "";
      return String(role).toLowerCase() === "student";
    };
    const toStudent = (enrollment: any, user: any): Student => ({
      _id: user._id || user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      userId: user.userId || user.employeeId || "",
      enrolmentStatus: enrollment?.status || "active",
    });

    // Keep the batch structure: each batch carries its own roster, and
    // memberIds (staff included) decide who may mark it.
    const groups: BatchGroup[] = ((roster as any)?.batchAndParticipants || []).map((b: any) => {
      const entries = (b?.users || []).map((e: any) => ({ enrollment: e, user: e?.user || e }));
      return {
        _id: String(b?._id || ""),
        batchName: String(b?.batchName || ""),
        students: sortStudents(
          entries
            .filter(({ user }: any) => isStudentUser(user))
            .map(({ enrollment, user }: any) => toStudent(enrollment, user))
        ),
        memberIds: entries
          .map(({ user }: any) => String(user?._id || user?.id || ""))
          .filter(Boolean),
      };
    });

    // Course-wide list for batchless courses — deduped, a student can sit
    // in two batches but is one row.
    const seen = new Set<string>();
    const flat: Student[] = [];
    groups.forEach((g) =>
      g.students.forEach((s) => {
        if (seen.has(s._id)) return;
        seen.add(s._id);
        flat.push(s);
      })
    );

    return { batchGroups: groups, flatStudents: sortStudents(flat) };
  }, [roster]);

  // ── Batch visibility ────────────────────────────────────────────────────
  // A lone "Default" batch is the fallback container courses without real
  // batches enrol into — no batch UI for it, the course IS the roster. With
  // real batches, admins see all of them and everyone else only the batches
  // they are enrolled in.
  const realBatches = useMemo(() => {
    if (
      batchGroups.length === 1 &&
      (batchGroups[0].batchName || "").trim().toLowerCase() === "default"
    )
      return [];
    return batchGroups;
  }, [batchGroups]);
  const noRealBatches = realBatches.length === 0;
  const visibleBatches = useMemo(
    () =>
      me.admin || me.viewer
        ? realBatches
        : realBatches.filter((b) => b.memberIds.includes(me.id)),
    [realBatches, me]
  );

  // Keep a valid selection: first visible batch, re-picked if the current one
  // disappears (course switch, role resolve).
  useEffect(() => {
    if (noRealBatches) {
      if (selectedBatchId !== null) setSelectedBatchId(null);
      return;
    }
    if (!selectedBatchId || !visibleBatches.some((b) => b._id === selectedBatchId)) {
      setSelectedBatchId(visibleBatches[0]?._id ?? null);
    }
    // selectedBatchId is deliberately read, not depended on — this effect only
    // repairs an invalid selection when the batch list itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBatches, noRealBatches]);

  // The roster being marked: the selected batch's students, or the whole
  // course when there are no real batches. A non-admin in no batch gets an
  // empty roster (and the explanatory empty state below).
  const students = useMemo<Student[]>(() => {
    if (noRealBatches) return flatStudents;
    const g = visibleBatches.find((b) => b._id === selectedBatchId);
    return g ? g.students : [];
  }, [noRealBatches, flatStudents, visibleBatches, selectedBatchId]);

  // ── Training window ─────────────────────────────────────────────────────
  // Attendance records a session that HAPPENED, so marking is bounded by the
  // batch's training window: the Program Calendar's start through its
  // deviation-adjusted end — resolved by the SAME server logic that enforces
  // it on save, so the lock and the law cannot disagree. No calendar means
  // there is no schedule to attend at all. Fresh on every mount: a lock must
  // never trust a cached answer.
  const { data: trainingWindow, isError: windowError } = useQuery({
    queryKey: ['attendance-window', courseId, noRealBatches ? 'course' : selectedBatchId],
    queryFn: () =>
      attendanceApi.window(courseId, noRealBatches ? undefined : selectedBatchId || undefined),
    enabled: !!courseId && (noRealBatches || !!selectedBatchId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // Undecided (still loading) counts as locked — better to unlock a moment
  // late than to accept a mark the save will reject.
  const windowMissing = trainingWindow !== undefined && !trainingWindow.exists;
  const beforeStart = Boolean(
    trainingWindow?.exists && trainingWindow.startDate && dayKey < trainingWindow.startDate
  );
  const afterEnd = Boolean(
    trainingWindow?.exists && trainingWindow.endDate && dayKey > trainingWindow.endDate
  );
  const outsideWindow = trainingWindow === undefined || windowMissing || beforeStart || afterEnd;
  // One switch for every marking control: future days, days outside the
  // training window, and viewer roles (review-only — the save would 403 for
  // them anyway) are equally read-only.
  const locked = future || outsideWindow || me.viewer;
  const fmtWindowDay = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ── Fetch attendance for the selected day ───────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    // With real batches, wait for the selection — fetching unscoped first
    // would flash another batch's marks into the grid.
    if (!noRealBatches && !selectedBatchId) return;
    let cancelled = false;
    setLoadingAttendance(true);

    attendanceApi
      .list(courseId, dayKey, dayKey, noRealBatches ? undefined : selectedBatchId || undefined)
      .then((records: AttendanceRecord[]) => {
        if (cancelled) return;
        const next: Grid = new Map();
        for (const r of records) {
          const dk = toDayKey(new Date(r.date));
          const sid = r.studentId?.toString?.() || (r.studentId as any);
          if (!next.has(sid)) next.set(sid, new Map());
          next.get(sid)!.set(dk, {
            status: r.status,
            reason: r.reason || "",
            halfPeriod: (r.halfPeriod as HalfPeriod) || "",
            dirty: false,
          });
        }
        setGrid(next);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load attendance:", err);
          setGrid(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAttendance(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, dayKey, rev, refreshKey, selectedBatchId, noRealBatches]);

  const cellOf = (studentId: string) => grid.get(studentId)?.get(dayKey);
  const statusOf = (studentId: string) => cellOf(studentId)?.status ?? "";

  // Bulk-mark every student with a status — LOCAL only; the Save-changes bar
  // below the grid persists it.
  const bulkAll = (status: AttendanceStatus | "") => {
    const targets = students.filter((s) => statusOf(s._id) !== status);
    if (targets.length === 0) return;

    setGrid((prev) => {
      const next = new Map(prev);
      for (const s of targets) {
        const row = new Map(next.get(s._id) || new Map());
        row.set(dayKey, { status, reason: "", halfPeriod: "", dirty: true });
        next.set(s._id, row);
      }
      return next;
    });
  };

  // ── Mark one cell locally (nothing saved yet) ───────────────────────────
  const applyLocal = (
    studentId: string,
    status: AttendanceStatus | "",
    reason: string = "",
    halfPeriod: HalfPeriod = ""
  ) => {
    setGrid((prev) => {
      const next = new Map(prev);
      const row = new Map(next.get(studentId) || new Map());
      row.set(dayKey, {
        status,
        reason: status === "A" || status === "H" ? reason : "",
        halfPeriod: status === "H" ? halfPeriod : "",
        dirty: true,
      });
      next.set(studentId, row);
      return next;
    });
  };

  // ── Deferred save — the Save-changes bar persists all dirty cells ───────
  const [reasonModalItems, setReasonModalItems] = useState<ReasonItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  const dirtyCells = useMemo(() => {
    const out: { studentId: string; dateKey: string; state: CellState }[] = [];
    grid.forEach((row, sid) =>
      row.forEach((state, dk) => {
        if (state.dirty) out.push({ studentId: sid, dateKey: dk, state });
      })
    );
    return out;
  }, [grid]);

  const studentNameOf = (sid: string) => {
    const s = students.find((x) => x._id === sid);
    return `${s?.firstName ?? ""} ${s?.lastName ?? ""}`.trim() || "Student";
  };

  // Persist every dirty cell; reasons for A/H come from the reasons modal.
  const persistAll = async (
    reasonByKey: Map<string, { reason: string; halfPeriod: HalfPeriod }>
  ) => {
    if (dirtyCells.length === 0) return;
    const payload = dirtyCells.map((c) => {
      const extra = reasonByKey.get(`${c.studentId}|${c.dateKey}`);
      const needsReason = c.state.status === "A" || c.state.status === "H";
      return {
        studentId: c.studentId,
        date: c.dateKey,
        status: c.state.status,
        reason: needsReason ? extra?.reason ?? c.state.reason ?? "" : "",
        halfPeriod:
          c.state.status === "H" ? extra?.halfPeriod ?? c.state.halfPeriod ?? "" : "" as HalfPeriod,
      };
    });
    setSaving(true);
    try {
      await attendanceApi.bulkSave(
        courseId,
        payload,
        noRealBatches ? undefined : selectedBatchId || undefined
      );
      // Mark everything clean with the reasons that were actually saved.
      setGrid((prev) => {
        const next = new Map(prev);
        for (const p of payload) {
          const row = new Map(next.get(p.studentId) || new Map());
          row.set(p.date, {
            status: p.status,
            reason: p.reason,
            halfPeriod: p.halfPeriod as HalfPeriod,
            dirty: false,
          });
          next.set(p.studentId, row);
        }
        return next;
      });
      setReasonModalItems(null);
      // The grid above is patched in place (it holds unsaved edits, so it must
      // not be blown away), but every OTHER attendance reader — the overview's
      // marked-today flags, and the Report/Analytics date-range slices — was
      // left serving pre-save data until its own staleTime lapsed. Prefix
      // invalidation refreshes them without touching this grid, whose records
      // are fetched outside React Query.
      invalidateAttendance();
      toast.success(
        `Saved ${payload.length} change${payload.length === 1 ? "" : "s"}`
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message?.[0]?.value || "Failed to save attendance"
      );
    } finally {
      setSaving(false);
    }
  };

  // Save-changes click: A/H marks need reasons first — open the modal listing
  // all of them. If there are none, persist straight away.
  const handleSaveChanges = () => {
    const needing = dirtyCells.filter(
      (c) => c.state.status === "A" || c.state.status === "H"
    );
    if (needing.length > 0) {
      setReasonModalItems(
        needing.map((c) => ({
          studentId: c.studentId,
          dateKey: c.dateKey,
          name: studentNameOf(c.studentId),
          status: c.state.status as "A" | "H",
          reason: c.state.reason || "",
          halfPeriod: (c.state.halfPeriod as HalfPeriod) || "",
        }))
      );
    } else {
      void persistAll(new Map());
    }
  };

  const discardChanges = () => setRefreshKey((k) => k + 1);

  // ── Exporters ──────────────────────────────────────────────────────────
  // Both reports scope to the currently selected day — same data the admin
  // sees on screen. Widening to a custom range is a follow-up.

  const dateLabel = dayKey;

  const statusLabel = (s: AttendanceStatus | "") =>
    s === "P" ? "Present" : s === "A" ? "Absent" : s === "H" ? "Half-day" : "Not marked";

  const halfLabel = (h: HalfPeriod) =>
    h === "first" ? "1st half" : h === "second" ? "2nd half" : "";

  // Palette shared by both Excel exports so the file reads as coordinated.
  const XLS_PALETTE = {
    indigoFill: "FF4F46E5",
    indigoSoft: "FFEEF2FF",
    altRow: "FFF9FAFB",
    border: "FFE5E7EB",
    white: "FFFFFFFF",
  };
  const XLS_THIN = {
    top: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    left: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    right: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    bottom: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
  };
  const applyBorder = (c: ExcelJS.Cell) => (c.border = XLS_THIN);
  const applyFill = (c: ExcelJS.Cell, argb: string) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  };

  // ── 1. Download Report — the selected day's attendance sheet ───────────
  const exportAttendanceExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "EduLMS";
    wb.created = new Date();
    const sheet = wb.addWorksheet("Attendance");

    const header = [
      "#",
      "Roll No.",
      "Student Name",
      "Email",
      `Status (${fmt(selectedDay)})`,
      "Half Period",
      "Reason",
    ];
    const widths = [6, 18, 24, 26, 18, 12, 50];
    const hdr = sheet.addRow(header);
    hdr.height = 22;
    header.forEach((_, i) => (sheet.getColumn(i + 1).width = widths[i]));
    hdr.eachCell((cell, n) => {
      if (n > header.length) return;
      cell.font = { bold: true, color: { argb: XLS_PALETTE.white } };
      applyFill(cell, XLS_PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });

    students.forEach((s, i) => {
      const cell = cellOf(s._id);
      const st = cell?.status ?? "";
      const row = sheet.addRow([
        i + 1,
        s.userId || "",
        `${s.firstName} ${s.lastName}`.trim() || "—",
        s.email || "",
        statusLabel(st),
        st === "H" ? halfLabel((cell?.halfPeriod as HalfPeriod) || "") : "",
        st === "A" || st === "H" ? cell?.reason || "" : "",
      ]);
      row.eachCell((c, n) => {
        if (n > header.length) return;
        applyBorder(c);
        if (i % 2 === 1) applyFill(c, XLS_PALETTE.altRow);
      });
    });

    // AutoFilter on the entire header row + freeze it.
    const lastRow = sheet.lastRow?.number ?? 1;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: header.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `attendance_${dateLabel}.xlsx`
    );
  };

  const exportAttendancePdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text(`Attendance — ${fmt(selectedDay)} (${fmtWeekday(selectedDay)})`, margin, margin + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, margin, margin + 20);

    const head = [["#", "Enroll. No.", "Student", "Status", "Half Period", "Reason"]];
    const body = students.map((s, i) => {
      const cell = cellOf(s._id);
      const st = cell?.status ?? "";
      return [
        i + 1,
        s.userId || "",
        `${s.firstName} ${s.lastName}`.trim() || "—",
        statusLabel(st),
        st === "H" ? halfLabel((cell?.halfPeriod as HalfPeriod) || "") : "",
        st === "A" || st === "H" ? cell?.reason || "" : "",
      ];
    });
    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      head,
      body,
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: [229, 231, 235], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 5: { cellWidth: 220 } },
      theme: "grid",
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${p} of ${pages}`,
        pageW - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
    }
    doc.save(`attendance_${dateLabel}.pdf`);
  };

  // ── 2. Remarks Report — only A / H rows with a reason ─────────────────
  // Flatten grid to one entry per student marked A or H on the selected day.
  type RemarkRow = {
    student: Student;
    status: "A" | "H";
    halfPeriod: HalfPeriod;
    reason: string;
  };
  const buildRemarkRows = (): RemarkRow[] => {
    const out: RemarkRow[] = [];
    for (const s of students) {
      const cell = cellOf(s._id);
      const st = cell?.status;
      if (st === "A" || st === "H") {
        out.push({
          student: s,
          status: st,
          halfPeriod: (cell?.halfPeriod as HalfPeriod) || "",
          reason: cell?.reason || "",
        });
      }
    }
    // Sort by student name.
    out.sort((a, b) =>
      `${a.student.firstName} ${a.student.lastName}`.localeCompare(
        `${b.student.firstName} ${b.student.lastName}`
      )
    );
    return out;
  };

  const exportRemarksExcel = async () => {
    const rows = buildRemarkRows();
    const wb = new ExcelJS.Workbook();
    wb.creator = "EduLMS";
    wb.created = new Date();
    const sheet = wb.addWorksheet("Remarks");

    const header = [
      "#",
      "Date",
      "Weekday",
      "Roll No.",
      "Student Name",
      "Email",
      "Attendance",
      "Half Period",
      "Reason",
    ];
    const widths = [5, 14, 10, 18, 24, 26, 12, 12, 60];
    const hdr = sheet.addRow(header);
    hdr.height = 22;
    header.forEach((_, i) => (sheet.getColumn(i + 1).width = widths[i]));
    hdr.eachCell((cell, n) => {
      if (n > header.length) return;
      cell.font = { bold: true, color: { argb: XLS_PALETTE.white } };
      applyFill(cell, XLS_PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });

    if (rows.length === 0) {
      const empty = sheet.addRow(["No remarks for this day"]);
      sheet.mergeCells(empty.number, 1, empty.number, header.length);
      const cell = empty.getCell(1);
      cell.font = { italic: true, color: { argb: "FF6B7280" } };
      applyBorder(cell);
    } else {
      rows.forEach((r, i) => {
        const name = `${r.student.firstName} ${r.student.lastName}`.trim() || "—";
        const row = sheet.addRow([
          i + 1,
          fmt(selectedDay),
          fmtWeekday(selectedDay),
          r.student.userId || "",
          name,
          r.student.email || "",
          r.status === "A" ? "Absent" : "Half-day",
          r.status === "H" ? halfLabel(r.halfPeriod) : "",
          r.reason,
        ]);
        row.eachCell((cell, n) => {
          if (n > header.length) return;
          applyBorder(cell);
          if (i % 2 === 1) applyFill(cell, XLS_PALETTE.altRow);
          cell.alignment = { vertical: "top", wrapText: true };
        });
      });
    }

    // AutoFilter + frozen header for quick filtering by student / date / etc.
    const lastRow = sheet.lastRow?.number ?? 1;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: header.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `remarks_${dateLabel}.xlsx`
    );
  };

  const exportRemarksPdf = () => {
    const rows = buildRemarkRows();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text(`Remarks Report — ${fmt(selectedDay)} (${fmtWeekday(selectedDay)})`, margin, margin + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${rows.length} remark${rows.length !== 1 ? "s" : ""} · Generated ${new Date().toLocaleString(
        "en-GB"
      )}`,
      margin,
      margin + 20
    );

    const head = [
      ["#", "Date", "Day", "Enroll. No.", "Student", "Attendance", "Half Period", "Reason"],
    ];
    const body = rows.map((r, i) => [
      i + 1,
      fmt(selectedDay),
      fmtWeekday(selectedDay),
      r.student.userId || "",
      `${r.student.firstName} ${r.student.lastName}`.trim() || "—",
      r.status === "A" ? "Absent" : "Half-day",
      r.status === "H" ? halfLabel(r.halfPeriod) : "",
      r.reason,
    ]);
    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      head,
      body: body.length ? body : [["", "", "", "", "No remarks for this day", "", "", ""]],
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 7: { cellWidth: 220 } },
      theme: "grid",
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${p} of ${pages}`,
        pageW - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
    }
    doc.save(`remarks_${dateLabel}.pdf`);
  };

  const handlePickFormat = async (fmtSel: "excel" | "pdf") => {
    try {
      if (reportPicker === "attendance") {
        if (fmtSel === "excel") await exportAttendanceExcel();
        else exportAttendancePdf();
      } else if (reportPicker === "remarks") {
        if (fmtSel === "excel") await exportRemarksExcel();
        else exportRemarksPdf();
      }
      setReportPicker(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report");
    }
  };

  // ── Derived view state ──────────────────────────────────────────────────
  // Search is display-only; marking + bulk still act on the full class so
  // "mark all" always means the whole roster, not just what's on screen.
  const searchQ = studentSearch.trim().toLowerCase();
  const visibleStudents = searchQ
    ? students.filter(
        (s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQ) ||
          (s.email || "").toLowerCase().includes(searchQ) ||
          (s.userId || "").toLowerCase().includes(searchQ)
      )
    : students;

  let sumP = 0;
  let sumA = 0;
  let sumH = 0;
  for (const s of students) {
    const st = statusOf(s._id);
    if (st === "P") sumP++;
    else if (st === "A") sumA++;
    else if (st === "H") sumH++;
  }
  const sumNot = students.length - sumP - sumA - sumH;

  // Auto-fit page size — measure the tbody's real budget and slice.
  useEffect(() => { setAttPage(1); }, [studentSearch, selectedBatchId, dayKey]);
  useEffect(() => {
    const el = attTableWrapRef.current;
    if (!el) return;
    const FALLBACK = 56;
    const recompute = () => {
      const thead = el.querySelector<HTMLElement>("thead");
      const firstRow = el.querySelector<HTMLElement>("tbody tr");
      const theadH = thead ? thead.getBoundingClientRect().height : 40;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : FALLBACK;
      // Aggressive rounding: reclaim the last partial-row slot whenever the
      // leftover is >= 30 % of a row. That trailing partial row's own hairline
      // border sits over the tile's border, so the visual clip is negligible.
      // +0.35 bias: reclaim the trailing slot whenever ≥ 15 % of a row's
      // worth of pixels are left after fitting N rows. Aggressive but the
      // tile clips cleanly so a slight overhang is invisible.
      const budget = Math.max(0, el.clientHeight - theadH);
      const rows2 = Math.max(1, Math.min(100, Math.round(budget / Math.max(1, rowH) + 0.35)));
      setAttPageSize((prev) => (prev === rows2 ? prev : rows2));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    const raf = requestAnimationFrame(recompute);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [visibleStudents.length]);
  const attTotalPages = Math.max(1, Math.ceil(visibleStudents.length / attPageSize));
  const attCurrent = Math.min(attPage, attTotalPages);
  const attStart = (attCurrent - 1) * attPageSize;
  const attEnd = attStart + attPageSize;
  const pagedStudents = visibleStudents.slice(attStart, attEnd);
  const attRangeFrom = visibleStudents.length === 0 ? 0 : attStart + 1;
  const attRangeTo = Math.min(attEnd, visibleStudents.length);

  // ── Render ─────────────────────────────────────────────────────────────
  // Blocking-state banner text: consolidated from the old row of StatusPills
  // into ONE line so the toolbar row can be the reference's clean
  // Search + Batch. Marking still locks the same way it always did — the
  // message just moved to a single strip.
  const blockingMessage = fromLdc
    ? ""
    : isWeekend(selectedDay)
      ? "Weekend — marking disabled"
      : future
        ? "Future date — marking disabled"
        : trainingWindow === undefined && !windowError
          ? "Checking training window…"
          : windowError
            ? "Couldn't check the training window — reload to retry"
            : windowMissing
              ? "Set the Program Calendar first — attendance needs a training schedule"
              : beforeStart
                ? `Training starts ${fmtWindowDay(trainingWindow?.startDate)} — marking disabled`
                : afterEnd
                  ? `Training ended ${fmtWindowDay(trainingWindow?.endDate)} — marking disabled`
                  : "";

  const summaryCards: {
    key: string;
    label: string;
    value: number;
    iconBg: string;
    iconText: string;
    valueText: string;
    icon: React.ReactNode;
  }[] = [
    { key: "total", label: "Total Students", value: students.length, iconBg: "bg-info-50",    iconText: "text-info-700",    valueText: "text-heading",     icon: <Users className="h-4 w-4" /> },
    { key: "P",     label: "Present",        value: sumP,             iconBg: "bg-success-50", iconText: "text-success-700", valueText: "text-success-700", icon: <Check className="h-4 w-4" strokeWidth={3} /> },
    { key: "A",     label: "Absent",         value: sumA,             iconBg: "bg-danger-50",  iconText: "text-danger-700",  valueText: "text-danger-700",  icon: <X className="h-4 w-4" strokeWidth={3} /> },
    { key: "H",     label: "Half-day",       value: sumH,             iconBg: "bg-warn-50",    iconText: "text-warn-700",    valueText: "text-warn-700",    icon: <Clock className="h-4 w-4" /> },
    { key: "N",     label: "Not marked",     value: sumNot,           iconBg: "bg-ink-100",    iconText: "text-subtle",      valueText: "text-heading",     icon: <MoreHorizontal className="h-4 w-4" /> },
  ];

  return (
    <div className="h-full flex flex-col px-1">
      {/* Summary cards — five compact blocks (Total / Present / Absent /
          Half-day / Not marked). Sits directly under the shell header and
          matches the reference reads. */}
      <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {summaryCards.map((c) => (
          <div key={c.key} className="flex items-center gap-3 rounded-tile border border-hairline bg-surface px-3 py-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${c.iconBg} ${c.iconText} flex-shrink-0`}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-subtle leading-tight">{c.label}</div>
              <div className={`text-lg font-bold tabular-nums leading-tight ${c.valueText}`}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Blocking-state banner — single strip that replaces the old row of
          StatusPills. Only rendered when marking is actually locked. */}
      {blockingMessage && (
        <div className="mt-2.5 rounded-control border border-warn-500/30 bg-warn-50 px-3 py-1.5 text-[11.5px] font-medium text-warn-700">
          {blockingMessage}
        </div>
      )}

      {/* Search + Batch — reference layout: Search flush left, Batch picker
          flush right. Reused StyledSelect for the batch dropdown (keeps the
          dirty-cell guard on batch switch). */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search students…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
          />
          {studentSearch && (
            <button
              type="button"
              onClick={() => setStudentSearch("")}
              aria-label="Clear student search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {visibleBatches.length > 0 && (
            <StyledSelect
              label="Batch"
              ariaLabel="Select batch"
              icon={<Layers size={13} className="text-brand-500" aria-hidden />}
              value={selectedBatchId || ""}
              onChange={(nextId) => {
                if (nextId === selectedBatchId) return;
                if (dirtyCells.length > 0) { setPendingBatchId(nextId); return; }
                setSelectedBatchId(nextId);
              }}
              options={visibleBatches.map((b) => ({
                value: b._id,
                label: `${b.batchName} (${b.students.length})`,
              }))}
            />
          )}
        </div>
      </div>
      {!me.admin && !me.viewer && visibleBatches.length > 0 && (
        <p className="mt-1 text-2xs text-faint">Showing the batches you belong to.</p>
      )}

      {/* Grid — borderless table on the page ground, matching Course Setup.
          No outer card / shadow / rounded box, just a scroll region with
          per-row hairlines. */}
      <div className="mt-3 flex-1 min-h-0 flex flex-col">
        {loadingStudents || loadingAttendance ? (
          <div className="flex-1 overflow-hidden">
            <div className="flex h-10 items-center gap-4 border-b border-hairline bg-canvas px-4">
              {["w-6", "w-40", "w-24", "w-16", "w-16", "w-16", "w-16"].map((w, i) => (
                <Skeleton key={i} className={`h-2.5 ${w}`} />
              ))}
            </div>
            {[...Array(9)].map((_, i) => (
              <div key={i} className="flex h-14 items-center gap-4 border-b border-hairline px-4">
                <Skeleton className="h-3 w-6" />
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            {!me.admin && !noRealBatches && visibleBatches.length === 0 ? (
              // A non-admin who is in none of this course's batches has no
              // roster to mark — say why instead of "no students".
              <EmptyState
                icon={Layers}
                title="No batch assigned to you"
                message="You can mark attendance only for batches you are enrolled in. Ask an administrator to add you to a batch of this course."
              />
            ) : (
              <EmptyState
                icon={Users}
                title={noRealBatches ? "No students enrolled" : "No students in this batch"}
                message={
                  noRealBatches
                    ? "This course has no enrolled students to mark attendance for yet."
                    : "This batch has no enrolled students yet — enrol students into it from the course's enrollment page."
                }
              />
            )}
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <EmptyState
              icon={Search}
              title="No students match your search"
              message="Try a different name, email, or enrollment number."
            />
          </div>
        ) : (
          <div ref={attTableWrapRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-sticky">
                <tr>
                  <th className="w-12 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">#</th>
                  <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Student</th>
                  <th className="w-32 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Roll No.</th>
                  {STATUS_COLUMNS.map(({ key, label }) => {
                    const allMarked =
                      students.length > 0 &&
                      students.every((s) => statusOf(s._id) === key);
                    return (
                      <th
                        key={key}
                        className="w-32 h-10 px-2 text-center align-middle bg-canvas border-b border-hairline"
                      >
                        <div className="flex flex-col items-center gap-0.5 leading-tight">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider ${statusHeadText[key]}`}>
                            {label}
                          </span>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => bulkAll(allMarked ? "" : key)}
                              title={
                                allMarked
                                  ? `Everyone is ${label} — click to clear all`
                                  : `Mark all students as ${label}`
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-chip border px-1.5 h-4 text-[9px] font-semibold transition-colors",
                                allMarked
                                  ? toneAllActive[key]
                                  : "border-hairline-strong bg-surface text-subtle hover:bg-row-hover"
                              )}
                            >
                              {allMarked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                              {allMarked ? "All" : "All"}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-28 h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Remark</th>
                  <th className="w-12 h-10 px-2 align-middle bg-canvas border-b border-hairline" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {pagedStudents.map((s, idx) => {
                  const i = attStart + idx;
                  const cell = cellOf(s._id);
                  const status = cell?.status ?? "";
                  const fullName = `${s.firstName} ${s.lastName}`.trim() || "—";
                  const hasReason = (status === "A" || status === "H") && Boolean(cell?.reason);
                  return (
                    <tr key={s._id} className="group border-b border-hairline last:border-0 hover:bg-row-hover transition-colors duration-150">
                      <td className="h-14 px-3 align-middle text-[11px] tabular-nums text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="h-14 px-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-strong text-white flex items-center justify-center text-[10.5px] font-semibold flex-shrink-0 shadow-sm">
                            {(s.firstName?.[0] || "?").toUpperCase()}
                            {(s.lastName?.[0] || "").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-semibold text-heading truncate leading-tight">
                              {fullName}
                            </div>
                            {s.email && (
                              <div className="text-[10.5px] text-subtle truncate leading-tight">
                                {s.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="h-14 px-3 align-middle text-[11.5px] text-body whitespace-nowrap tabular-nums">
                        {s.userId || "—"}
                      </td>
                      {STATUS_COLUMNS.map(({ key, label }) => {
                        const on = status === key;
                        const tint =
                          key === "P"
                            ? on
                              ? "border-success-500 bg-success-50 text-success-700"
                              : "border-hairline bg-surface text-subtle hover:border-success-500/50 hover:bg-success-50/40"
                            : key === "A"
                              ? on
                                ? "border-danger-500 bg-danger-50 text-danger-700"
                                : "border-hairline bg-surface text-subtle hover:border-danger-500/50 hover:bg-danger-50/40"
                              : on
                                ? "border-warn-500 bg-warn-50 text-warn-700"
                                : "border-hairline bg-surface text-subtle hover:border-warn-500/50 hover:bg-warn-50/40";
                        const radioDot =
                          key === "P"
                            ? on ? "border-success-500 bg-success-500" : "border-hairline-strong bg-surface"
                            : key === "A"
                              ? on ? "border-danger-500 bg-danger-500" : "border-hairline-strong bg-surface"
                              : on ? "border-warn-500 bg-warn-500" : "border-hairline-strong bg-surface";
                        return (
                          <td key={key} className="h-14 px-2 align-middle text-center">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => applyLocal(s._id, on ? "" : key)}
                              title={
                                me.viewer
                                  ? "Read-only view — your role can review attendance but not mark it"
                                  : future
                                    ? "Future date — attendance can't be marked yet"
                                    : windowMissing
                                      ? "Set the Program Calendar first — attendance needs a training schedule"
                                      : outsideWindow
                                        ? "Outside the training window — attendance can't be marked"
                                        : on
                                          ? `Marked ${label} — click to clear`
                                          : `Mark ${label}`
                              }
                              className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                                tint,
                                locked && "opacity-40 cursor-not-allowed",
                                cell?.dirty && on && "ring-2 ring-brand/25 ring-offset-1"
                              )}
                            >
                              <span className={cn("inline-block h-3 w-3 rounded-full border-2 transition-colors", radioDot)} />
                              {label}
                            </button>
                          </td>
                        );
                      })}
                      <td className="h-14 px-3 align-middle text-[11px] text-body">
                        {status === "A" || status === "H" ? (
                          <div className="max-w-[180px]">
                            {status === "H" && cell?.halfPeriod && (
                              <span className="mr-1.5 inline-flex items-center rounded-chip bg-warn-50 border border-warn-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-warn-700">
                                {cell.halfPeriod === "first" ? "1st half" : "2nd half"}
                              </span>
                            )}
                            {cell?.reason ? (
                              <span className="break-words">{cell.reason}</span>
                            ) : (
                              <span className="italic text-faint">Asked on Save</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="h-14 px-2 align-middle text-right">
                        <button
                          type="button"
                          disabled={!(status === "A" || status === "H")}
                          title={
                            hasReason
                              ? cell?.reason
                              : status === "A" || status === "H"
                                ? "Reason will be asked on Save"
                                : "Remarks apply to Absent or Half-day only"
                          }
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-control border transition-colors",
                            hasReason
                              ? "border-warn-500/40 bg-warn-50 text-warn-700 hover:bg-warn-100"
                              : status === "A" || status === "H"
                                ? "border-hairline-strong bg-surface text-subtle hover:bg-row-hover"
                                : "border-hairline bg-surface text-faint cursor-not-allowed opacity-50"
                          )}
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination footer — compact borderless variant, orange active page,
            matches Course Setup's TableFooter language. */}
        {students.length > 0 && visibleStudents.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-2">
            <span className="text-xs tabular-nums text-subtle">
              Showing <b className="font-semibold text-heading">{attRangeFrom}</b>–<b className="font-semibold text-heading">{attRangeTo}</b> of <b className="font-semibold text-heading">{visibleStudents.length}</b> students
            </span>
            {attTotalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAttPage((p) => Math.max(1, p - 1))}
                  disabled={attCurrent <= 1}
                  aria-label="Previous page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: attTotalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAttPage(p)}
                    aria-current={attCurrent === p ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 min-w-[28px] items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors",
                      attCurrent === p
                        ? "bg-brand-wash text-brand-strong border border-brand-500/30"
                        : "text-subtle hover:bg-row-hover hover:text-body border border-transparent"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAttPage((p) => Math.min(attTotalPages, p + 1))}
                  disabled={attCurrent >= attTotalPages}
                  aria-label="Next page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save-changes bar — appears once anything is marked but not saved. */}
      {dirtyCells.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50/70 px-3 py-2">
          <span className="text-[12px] font-medium text-brand-800">
            {dirtyCells.length} unsaved change{dirtyCells.length === 1 ? "" : "s"}
            <span className="ml-1.5 font-normal text-brand-500">
              — nothing is saved until you click Save changes.
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="h-8 px-3 rounded-md border border-ink-200 bg-white text-[12px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold disabled:opacity-50"
            >
              {saving && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Reasons modal — every dirty A / H mark needs a reason before save. */}
      {reasonModalItems && (
        <ReasonsModal
          items={reasonModalItems}
          saving={saving}
          onChange={(index, patch) =>
            setReasonModalItems((prev) =>
              prev ? prev.map((it, i) => (i === index ? { ...it, ...patch } : it)) : prev
            )
          }
          onClose={() => setReasonModalItems(null)}
          onSave={() => {
            const byKey = new Map(
              reasonModalItems.map((it) => [
                `${it.studentId}|${it.dateKey}`,
                { reason: it.reason.trim(), halfPeriod: it.halfPeriod },
              ])
            );
            void persistAll(byKey);
          }}
        />
      )}

      {/* Report format picker */}
      {/* Discard-confirm — switching batches with unsaved marks. Same modal
          idiom as the pickers below; outside click and Stay both keep the
          user on the current batch with their marks intact. */}
      {pendingBatchId && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
          onClick={() => setPendingBatchId(null)}
        >
          <div
            className="w-full max-w-sm rounded-tile border border-hairline bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-ink-900">
              Discard unsaved marks?
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              {dirtyCells.length} unsaved change{dirtyCells.length === 1 ? "" : "s"} on{" "}
              <span className="font-semibold text-ink-700">
                {visibleBatches.find((b) => b._id === selectedBatchId)?.batchName || "this batch"}
              </span>{" "}
              will be lost if you switch to{" "}
              <span className="font-semibold text-ink-700">
                {visibleBatches.find((b) => b._id === pendingBatchId)?.batchName || "the other batch"}
              </span>
              . Save changes first to keep them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingBatchId(null)}
                className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchId(pendingBatchId);
                  setPendingBatchId(null);
                }}
                className="h-8 px-3 rounded-md bg-danger-500 hover:bg-danger-700 text-white text-[12px] font-semibold"
              >
                Discard &amp; switch
              </button>
            </div>
          </div>
        </div>
      )}

      {reportPicker && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
          onClick={() => setReportPicker(null)}
        >
          <div
            className="w-full max-w-sm rounded-tile border border-hairline bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-ink-900">
              {reportPicker === "attendance"
                ? "Download Attendance Report"
                : "Download Remarks Report"}
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              Date: {fmt(selectedDay)} ({fmtWeekday(selectedDay)}) · Pick a format.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePickFormat("excel")}
                className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink-200 rounded-md hover:border-success-500/40 hover:bg-success-50/40 transition-colors"
              >
                <FileSpreadsheet className="h-7 w-7 text-success-700" />
                <span className="text-[13px] font-semibold text-ink-900">Excel</span>
                <span className="text-[10px] text-ink-500">.xlsx with filters</span>
              </button>
              <button
                onClick={() => handlePickFormat("pdf")}
                className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink-200 rounded-md hover:border-danger-500/40 hover:bg-danger-50/40 transition-colors"
              >
                <FileText className="h-7 w-7 text-danger-700" />
                <span className="text-[13px] font-semibold text-ink-900">PDF</span>
                <span className="text-[10px] text-ink-500">.pdf landscape</span>
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setReportPicker(null)}
                className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reasons modal ───────────────────────────────────────────────────────────
// Opens on "Save changes" when dirty A / H marks exist. Left side: student,
// date and the mark (H additionally picks 1st/2nd half). Right side: reason.
// Save stays disabled until every row has a reason (and half for H).
const ReasonsModal: React.FC<{
  items: ReasonItem[];
  saving: boolean;
  onChange: (
    index: number,
    patch: Partial<Pick<ReasonItem, "reason" | "halfPeriod">>
  ) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ items, saving, onChange, onClose, onSave }) => {
  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isValid = (it: ReasonItem) =>
    !!it.reason.trim() &&
    (it.status !== "H" || it.halfPeriod === "first" || it.halfPeriod === "second");
  const filledCount = items.filter(isValid).length;
  const allValid = filledCount === items.length;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-tile border border-hairline bg-surface p-5 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-semibold text-ink-900">Reasons required</h3>
        <p className="mt-1 text-[12px] text-ink-500">
          Every Absent and Half-day mark needs a reason before the changes
          can be saved.
        </p>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto divide-y divide-ink-100 border border-ink-100 rounded-md">
          {items.map((it, i) => (
            <div key={`${it.studentId}|${it.dateKey}`} className="flex items-start gap-3 p-3">
              {/* Left: who / when / what */}
              <div className="w-52 shrink-0">
                <div className="text-[12.5px] font-medium text-ink-900 truncate">
                  {it.name}
                </div>
                <div className="text-[10.5px] text-ink-500">{fmt(parseKey(it.dateKey))}</div>
                <span
                  className={`mt-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold border ${
                    it.status === "A"
                      ? "bg-danger-50 text-danger-700 border-danger-500/30"
                      : "bg-warn-50 text-warn-700 border-warn-500/30"
                  }`}
                >
                  {it.status === "A" ? "A · Absent" : "H · Half-day"}
                </span>
                {it.status === "H" && (
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(i, { halfPeriod: "first" })}
                      className={`h-6 px-2 rounded border text-[10.5px] font-semibold transition ${
                        it.halfPeriod === "first"
                          ? "bg-warn-50 border-warn-500/40 text-warn-700"
                          : "bg-white border-ink-200 text-ink-600 hover:bg-warn-50"
                      }`}
                    >
                      1st half
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(i, { halfPeriod: "second" })}
                      className={`h-6 px-2 rounded border text-[10.5px] font-semibold transition ${
                        it.halfPeriod === "second"
                          ? "bg-warn-50 border-warn-500/40 text-warn-700"
                          : "bg-white border-ink-200 text-ink-600 hover:bg-warn-50"
                      }`}
                    >
                      2nd half
                    </button>
                  </div>
                )}
              </div>

              {/* Right: the reason */}
              <div className="flex-1 min-w-0">
                <textarea
                  value={it.reason}
                  onChange={(e) => onChange(i, { reason: e.target.value })}
                  rows={2}
                  maxLength={500}
                  placeholder={
                    it.status === "A"
                      ? "e.g. Medical leave, family emergency…"
                      : "e.g. Left early for appointment…"
                  }
                  className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 resize-none ${
                    it.reason.trim() ? "border-ink-200" : "border-danger-500/30"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-500">
            {filledCount} / {items.length} reason{items.length === 1 ? "" : "s"} filled
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!allValid || saving}
              title={allValid ? "Save all changes" : "Fill every reason (and half for H) first"}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
