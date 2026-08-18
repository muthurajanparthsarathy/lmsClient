import { getToken } from "@/lib/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/apiServices/socketClient";
import type {
  LiveDashboardResponse,
  StudentProgress,
  DashboardStudentUpdate,
  DashboardStudentJoined,
} from "../types/liveDashboard.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

interface UseLiveDashboardArgs {
  assessmentId: string;
  courseId?: string;
  nodeId?: string;
  nodeType?: string;
}

interface UseLiveDashboardResult {
  students: StudentProgress[];
  totalStudents: number;
  assessmentName: string;
  courseName: string;
  isLoading: boolean;
  error: string | null;
}

export function useLiveDashboard({
  assessmentId,
  courseId,
  nodeId,
  nodeType,
}: UseLiveDashboardArgs): UseLiveDashboardResult {
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [assessmentName, setAssessmentName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Refs hold the latest handlers so the (once-registered) socket
  //    listeners never read stale closures. ──────────────────────────────────
  const onUpdateRef = useRef<(p: DashboardStudentUpdate) => void>(() => {});
  const onJoinedRef = useRef<(p: DashboardStudentJoined) => void>(() => {});

  // Update ONLY the matching row (functional update keeps other rows' refs).
  const handleStudentUpdate = useCallback((p: DashboardStudentUpdate) => {
    setStudents(prev => {
      const idx = prev.findIndex(s => s.id === p.studentId);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], ...stripStudentId(p) };
      return next;
    });
  }, []);

  const handleStudentJoined = useCallback((p: DashboardStudentJoined) => {
    setStudents(prev => {
      if (prev.some(s => s.id === p.id)) {
        // already present → merge instead of duplicating
        return prev.map(s => (s.id === p.id ? { ...s, ...p } : s));
      }
      setTotalStudents(t => t + 1);
      return [...prev, p];
    });
  }, []);

  useEffect(() => { onUpdateRef.current = handleStudentUpdate; }, [handleStudentUpdate]);
  useEffect(() => { onJoinedRef.current = handleStudentJoined; }, [handleStudentJoined]);

  // ── Initial fetch (seeded from persisted answers on the server) ───────────
  useEffect(() => {
    if (!assessmentId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token =
          (typeof window !== "undefined" &&
            (getToken() || localStorage.getItem("token"))) || "";
        const qs = new URLSearchParams({ assessmentId });
        if (courseId) qs.set("courseId", courseId);
        if (nodeId) qs.set("nodeId", nodeId);
        if (nodeType) qs.set("nodeType", nodeType);

        const res = await fetch(`${API_URL}/api/assessment/live-dashboard?${qs.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
        const data: LiveDashboardResponse = await res.json();
        if (cancelled) return;
        setStudents(data.students || []);
        setTotalStudents(data.totalStudents ?? (data.students?.length || 0));
        setAssessmentName(data.assessmentName || "");
        setCourseName(data.courseName || "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load dashboard");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assessmentId, courseId, nodeId, nodeType]);

  // ── Socket: join room, register listeners once, leave + cleanup on unmount ─
  useEffect(() => {
    if (!assessmentId) return;
    const socket = getSocket();

    const updateListener = (p: DashboardStudentUpdate) => onUpdateRef.current(p);
    const joinedListener = (p: DashboardStudentJoined) => onJoinedRef.current(p);

    const join = () => socket.emit("teacher:join_dashboard", { assessmentId });

    // join now (and again after any reconnect)
    join();
    socket.on("connect", join);
    socket.on("dashboard:student_update", updateListener);
    socket.on("dashboard:student_joined", joinedListener);

    return () => {
      socket.emit("teacher:leave_dashboard", { assessmentId });
      socket.off("connect", join);
      socket.off("dashboard:student_update", updateListener);
      socket.off("dashboard:student_joined", joinedListener);
    };
  }, [assessmentId]);

  return { students, totalStudents, assessmentName, courseName, isLoading, error };
}

function stripStudentId(p: DashboardStudentUpdate): Partial<StudentProgress> {
  const { studentId, ...rest } = p;
  return rest;
}
