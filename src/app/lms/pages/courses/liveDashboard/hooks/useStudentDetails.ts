import { getToken } from "@/lib/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/apiServices/socketClient";
import type {
  StudentDetailsResponse,
  StudentDetailsInfo,
  StudentQuestion,
  StudentQuestionUpdate,
} from "../types/liveDashboard.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";

interface UseStudentDetailsResult {
  studentInfo: StudentDetailsInfo | null;
  questions: StudentQuestion[];
  isLoading: boolean;
  error: string | null;
}

export function useStudentDetails(
  assessmentId: string,
  studentId: string,
): UseStudentDetailsResult {
  const [studentInfo, setStudentInfo] = useState<StudentDetailsInfo | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref holds the latest handler → listener registered once, never stale.
  const onQuestionUpdateRef = useRef<(p: StudentQuestionUpdate) => void>(() => {});

  const handleQuestionUpdate = useCallback((p: StudentQuestionUpdate) => {
    // Only the currently-viewed student matters.
    if (p.studentId !== studentId) return;
    setQuestions(prev => {
      const idx = prev.findIndex(q => q.id === p.questionId);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = {
        ...next[idx],
        status: p.status,
        submittedAt: p.submittedAt,
        timeTakenSeconds: p.timeTakenSeconds,
      };
      return next;
    });
  }, [studentId]);

  useEffect(() => { onQuestionUpdateRef.current = handleQuestionUpdate; }, [handleQuestionUpdate]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token =
          (typeof window !== "undefined" &&
            (getToken() || localStorage.getItem("token"))) || "";
        const qs = new URLSearchParams({ assessmentId, studentId });
        const res = await fetch(`${API_URL}/api/assessment/student-details?${qs.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load student details (${res.status})`);
        const data: StudentDetailsResponse = await res.json();
        if (cancelled) return;
        const { questions: qs2, ...info } = data;
        setStudentInfo(info);
        setQuestions(qs2 || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load student details");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assessmentId, studentId]);

  // ── Socket: per-question live updates ────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    const socket = getSocket();
    const listener = (p: StudentQuestionUpdate) => onQuestionUpdateRef.current(p);
    socket.on("student:question_update", listener);
    return () => { socket.off("student:question_update", listener); };
  }, [assessmentId, studentId]);

  return { studentInfo, questions, isLoading, error };
}
