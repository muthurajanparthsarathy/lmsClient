"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { getUserId, getSessionItem, SESSION_KEYS } from "@/lib/session";
import { useCourseRosterQuery } from "@/queries/courseRoster";
import { useInvalidateAttendance } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import {
  attendanceApi,
  type AttendanceStatus,
  type AttendanceRecord,
  type HalfPeriod,
} from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import {
  isFuture,
  parseKey,
  todayUtc,
  toDayKey,
  type BatchGroup,
  type CellState,
  type Grid,
  type ReasonItem,
  type Student,
} from "@/app/lms/pages/attendancemanagement/features/attendanceTabShared";

export function useAttendanceTab(courseId: string) {
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

  return {
    selectedBatchId, setSelectedBatchId, attPage, setAttPage, attPageSize, setAttPageSize, attTableWrapRef,
    pendingBatchId, setPendingBatchId, loadingAttendance, studentSearch, setStudentSearch, me, fromLdc,
    selectedDay, dayKey, future, reportPicker, setReportPicker, loadingStudents, visibleBatches, noRealBatches,
    students, trainingWindow, windowError, windowMissing, beforeStart, afterEnd, outsideWindow, locked,
    fmtWindowDay, cellOf, statusOf, bulkAll, applyLocal, reasonModalItems, setReasonModalItems, saving,
    dirtyCells, persistAll, handleSaveChanges, discardChanges,
  };
}
