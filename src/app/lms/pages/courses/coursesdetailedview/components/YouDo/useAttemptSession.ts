"use client";

// ─── Assessment attempt session (Recovery & Resume) ───────────────────────
// The single hook every You-Do attempt page should mount to get the recovery
// contract for free. Responsibilities:
//
//   • Idempotent /attempt/start on mount — returns the SAME attempt on
//     refresh / reopen (never a duplicate).
//   • Reads /attempt/state so `savedAnswers` and `currentQuestionId` are
//     available on first render — the page can hydrate its buffers instead
//     of restarting from question 1.
//   • Owns a server-authoritative countdown. `timeLeft` is derived from
//     `serverExpiresAt - now`, corrected once for clock skew on load. The
//     student cannot extend the timer by refreshing.
//   • Wraps `saveAnswer(questionId, payload)` — enqueues the write to
//     IndexedDB, tries the network. Offline? The queue keeps it and
//     flushes on the next `online` event (or every 15 s).
//   • Wraps `setCurrentQuestion(qId)` — emits the socket event and (debounced)
//     PATCHes /attempt/current-question so the resume state is accurate.
//   • Wraps `submit()` — flushes queue, then POSTs /attempt/submit. Terminal.
//   • Tracks `netStatus` + `queueCount` so `ConnectionStatusBanner` can
//     render without extra listeners.
//
// The hook DOES NOT touch grading, scoring, or per-answer evaluation. Every
// answer write ultimately lands on the existing /courses/answers/submit
// endpoint via the queue — the grader is untouched.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/http";
import { getToken } from "@/lib/session";
import { enqueue, count as queueCount, flush as queueFlush, dropAll, newClientEventId, type PendingAnswer } from "./attemptStorage";

// ── Types ─────────────────────────────────────────────────────────────────
export type AttemptStatus = "active" | "submitted" | "terminated";
export type TerminationReason = "submit" | "timer" | "security" | null;
export type ResumeState = "active" | "awaiting_approval" | "approved_for_resume" | "rejected";

export interface AttemptShape {
  id: string;
  exerciseId: string;
  studentId: string;
  startedAt: string;              // ISO
  serverExpiresAt: string | null; // ISO or null (untimed) — legacy wall-clock
  totalDurationSeconds: number | null;
  remainingSeconds: number | null; // elapsed-time model (frozen at lastSubmittedAt)
  lastSubmittedAt: string | null;
  status: AttemptStatus;
  terminationReason: TerminationReason;
  currentQuestionId: string | null;
  submittedAt: string | null;
  resumeState: ResumeState;
  resumeRequestedAt: string | null;
  resumeApprovedAt: string | null;
}

export interface SavedAnswer {
  questionId: string;
  code?: string;
  language?: string;
  status?: string;
  score?: number;
  attempts?: number;
  submittedAt?: string | null;
  othersFiles?: any[];
  notionPages?: any[];
  selectedProgrammingLanguage?: string;
}

export interface QuestionStatus {
  questionId: string;
  status: string;
  lastActivityAt: string | null;
}

export type NetStatus = "online" | "offline" | "syncing";

export interface QuestionStatusRich extends QuestionStatus {
  submittedAt?: string | null;
  timeTakenSeconds?: number;
}

export interface UseAttemptSessionResult {
  loading: boolean;
  error: string | null;
  attempt: AttemptShape | null;
  canResume: boolean;              // true if the returned attempt already had prior activity
  /** Permission-gate: true when the server says the student needs trainer
   *  approval before re-entering. Set by /start when the attempt exists but
   *  resumeState is not 'active' / 'approved_for_resume'. */
  requiresApproval: boolean;
  savedAnswers: SavedAnswer[];
  questionStatuses: QuestionStatusRich[];
  timeLeftSeconds: number | null;  // null when the exercise has no timer
  hasTimer: boolean;
  netStatus: NetStatus;
  queueCount: number;              // for the banner
  saveAnswer: (params: SaveAnswerParams) => Promise<void>;
  setCurrentQuestion: (questionId: string) => void;
  submit: (opts?: { autoSubmitReason?: string; submitType?: "USER" | "AUTO" }) => Promise<{ ok: boolean; alreadyFinal?: boolean }>;
  refresh: () => Promise<void>;
  /** Student action: send /attempt/request-resume. Idempotent. After success,
   *  attempt.resumeState becomes 'awaiting_approval'. */
  requestResume: () => Promise<{ ok: boolean }>;
}

export interface SaveAnswerParams {
  questionId: string;
  body: Record<string, any>;    // full body the /submit endpoint expects
  endpoint?: string;            // defaults to /courses/answers/submit
}

// ── Options ───────────────────────────────────────────────────────────────
export interface UseAttemptSessionOptions {
  exerciseId: string;
  courseId: string;
  nodeId: string;
  nodeType: string;
  subcategory: string;
  category?: "You_Do" | "We_Do" | "I_Do";
  totalQuestions?: number;
  /** Optional fallback duration in minutes if the server can't resolve it
   *  from the exercise doc. Not authoritative — the server caps this. */
  durationMinutesHint?: number;
  /** Skip auto-start when the URL is missing required params — the caller
   *  might still be waiting for context. */
  enabled?: boolean;
}

// ── Endpoint helpers ──────────────────────────────────────────────────────
const START = "/courses/attempt/start";
const STATE = "/courses/attempt/state";
const CURRENT = "/courses/attempt/current-question";
const SUBMIT_ATTEMPT = "/courses/attempt/submit";
const SUBMIT_ANSWER = "/courses/answers/submit";
const REQUEST_RESUME = "/courses/attempt/request-resume";

async function jsonFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken() || (typeof window !== "undefined" ? window.localStorage.getItem("token") : "") || "";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as any)?.message || `HTTP ${res.status}`;
    const e: any = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body as T;
}

// ── Main hook ─────────────────────────────────────────────────────────────
export function useAttemptSession(opts: UseAttemptSessionOptions): UseAttemptSessionResult {
  const {
    exerciseId, courseId, nodeId, nodeType, subcategory,
    category = "You_Do", totalQuestions, durationMinutesHint, enabled = true,
  } = opts;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptShape | null>(null);
  const [canResume, setCanResume] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [questionStatuses, setQuestionStatuses] = useState<QuestionStatusRich[]>([]);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0); // serverNow - clientNow
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [netStatus, setNetStatus] = useState<NetStatus>(
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online"
  );
  const [queueSize, setQueueSize] = useState(0);

  // Refs to avoid re-triggering effects on every state churn.
  const attemptRef = useRef<AttemptShape | null>(null);
  attemptRef.current = attempt;

  const hasTimer = attempt?.remainingSeconds != null || !!attempt?.serverExpiresAt;

  // ── /start + /state on mount ────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!enabled) return;
    if (!exerciseId || !courseId) return;
    setLoading(true);
    setError(null);
    try {
      const startBody = {
        exerciseId, courseId, nodeId, nodeType, subcategory, category,
        totalQuestions, durationMinutesHint,
      };
      const startResp = await jsonFetch<{
        attempt: AttemptShape; canResume: boolean; requiresApproval?: boolean; serverNow: string;
      }>(START, { method: "POST", body: JSON.stringify(startBody) });

      setAttempt(startResp.attempt);
      setCanResume(startResp.canResume);
      setRequiresApproval(!!startResp.requiresApproval);
      setServerClockOffsetMs(new Date(startResp.serverNow).getTime() - Date.now());

      // Skip /state when the gate blocks entry — no need to load the answer
      // buffer for a screen the student can't act on yet.
      if (!startResp.requiresApproval) {
        const stateResp = await jsonFetch<{
          attempt: AttemptShape | null;
          savedAnswers: SavedAnswer[];
          questionStatuses: QuestionStatusRich[];
          canResume: boolean;
          requiresApproval?: boolean;
          serverNow: string;
        }>(`${STATE}?exerciseId=${encodeURIComponent(exerciseId)}&courseId=${encodeURIComponent(courseId)}&category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(subcategory)}`);
        if (stateResp.attempt) setAttempt(stateResp.attempt);
        setSavedAnswers(stateResp.savedAnswers || []);
        setQuestionStatuses(stateResp.questionStatuses || []);
        setCanResume(stateResp.canResume);
        setRequiresApproval(!!stateResp.requiresApproval);
      }
    } catch (err: any) {
      console.error("[useAttemptSession] start/state failed:", err);
      setError(err?.message || "Failed to start assessment");
    } finally {
      setLoading(false);
    }
  }, [enabled, exerciseId, courseId, nodeId, nodeType, subcategory, category, totalQuestions, durationMinutesHint]);

  useEffect(() => { void load(); }, [load]);

  // ── Countdown — elapsed-time model with wall-clock fallback ─────────────
  // Preferred: `attempt.remainingSeconds` (server-computed, frozen at
  // lastSubmittedAt). The client counts DOWN from that value locally while
  // the student is answering the current question (post-submit the clock
  // freezes again on the next /state fetch).
  //
  // Legacy fallback: `attempt.serverExpiresAt` for rows created before the
  // elapsed-time model shipped.
  useEffect(() => {
    if (attempt?.remainingSeconds != null) {
      setTimeLeftSeconds(attempt.remainingSeconds);
      // Tick down every second while the student is between submits.
      const id = window.setInterval(() => {
        setTimeLeftSeconds((prev) => (prev == null ? prev : Math.max(0, prev - 1)));
      }, 1000);
      return () => window.clearInterval(id);
    }
    if (!attempt?.serverExpiresAt) { setTimeLeftSeconds(null); return; }
    const expiresMs = new Date(attempt.serverExpiresAt).getTime();
    const compute = () => {
      const nowMs = Date.now() + serverClockOffsetMs;
      const left = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
      setTimeLeftSeconds(left);
      return left;
    };
    if (compute() === 0) return;
    const id = window.setInterval(() => { compute(); }, 1000);
    return () => window.clearInterval(id);
  }, [attempt?.remainingSeconds, attempt?.serverExpiresAt, serverClockOffsetMs]);

  // ── Online/offline listener + queue count polling ───────────────────────
  const refreshQueueCount = useCallback(async () => {
    if (!attemptRef.current) return;
    setQueueSize(await queueCount(attemptRef.current.id));
  }, []);

  useEffect(() => {
    const onOnline = () => { setNetStatus("online"); void tryFlush(); };
    const onOffline = () => setNetStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Poll the queue count every 5 s so the banner ticks down as flushes
    // complete, even when no online/offline event fires.
    const pollId = window.setInterval(refreshQueueCount, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queue flush ─────────────────────────────────────────────────────────
  const sendPending = useCallback(async (row: PendingAnswer): Promise<boolean> => {
    try {
      await jsonFetch(row.endpoint || SUBMIT_ANSWER, {
        method: "POST",
        headers: { "X-Client-Event-Id": row.clientEventId },
        body: JSON.stringify(row.payload),
      });
      return true;
    } catch (err: any) {
      // 4xx → server rejected. Don't retry forever; drop the row so a
      // permanently-bad payload doesn't block the queue. 5xx / network →
      // keep for the next flush.
      if (err && typeof err.status === "number" && err.status >= 400 && err.status < 500) {
        console.warn("[useAttemptSession] dropping pending row on 4xx:", err.status, err.body);
        return true; // treat as "delivered" so the queue advances
      }
      return false;
    }
  }, []);

  const tryFlush = useCallback(async () => {
    const a = attemptRef.current;
    if (!a) return;
    setNetStatus((prev) => (prev === "offline" ? prev : "syncing"));
    const result = await queueFlush(a.id, sendPending);
    await refreshQueueCount();
    setNetStatus(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : (result.failed > 0 ? "offline" : "online")
    );
  }, [sendPending, refreshQueueCount]);

  // Retry pending writes every 15 s while online — catches transient 5xx.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) void tryFlush();
    }, 15000);
    return () => window.clearInterval(id);
  }, [tryFlush]);

  // Flush once after start completes (in case the browser had queued work
  // from a previous session).
  useEffect(() => {
    if (attempt?.id) void tryFlush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id]);

  // ── Public: save one answer ─────────────────────────────────────────────
  const saveAnswer = useCallback(async ({ questionId, body, endpoint = SUBMIT_ANSWER }: SaveAnswerParams) => {
    const a = attemptRef.current;
    if (!a) return;
    const clientEventId = newClientEventId();
    const row: PendingAnswer = {
      clientEventId,
      attemptId: a.id,
      exerciseId: a.exerciseId,
      questionId,
      endpoint,
      payload: body,
      createdAt: Date.now(),
    };
    // Enqueue first — durable. Then try the direct write so the UI feels
    // fast when online. On success, the direct write's rows still count as
    // "sent" via the queue's own flush (idempotent per clientEventId).
    await enqueue(row);
    await refreshQueueCount();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setNetStatus("offline");
      return;
    }
    setNetStatus("syncing");
    try {
      const ok = await sendPending(row);
      if (ok) {
        // Delete just this one row from the queue since it's confirmed sent.
        // A separate flush pass would also delete it, but doing it inline
        // keeps queueCount accurate without waiting for the next poll.
        await queueFlush(a.id, async (r) => r.clientEventId === clientEventId ? true : false);
        await refreshQueueCount();
        setNetStatus("online");
      } else {
        setNetStatus("offline");
      }
    } catch {
      setNetStatus("offline");
    }
  }, [refreshQueueCount, sendPending]);

  // ── Public: track current question (debounced PATCH) ────────────────────
  const currentPatchTimer = useRef<number | null>(null);
  const setCurrentQuestion = useCallback((questionId: string) => {
    const a = attemptRef.current;
    if (!a || !questionId) return;
    // Optimistic local update so a subsequent refresh keeps the position.
    setAttempt((prev) => (prev ? { ...prev, currentQuestionId: questionId } : prev));
    if (currentPatchTimer.current) window.clearTimeout(currentPatchTimer.current);
    currentPatchTimer.current = window.setTimeout(() => {
      void jsonFetch(CURRENT, {
        method: "PATCH",
        body: JSON.stringify({ exerciseId: a.exerciseId, questionId }),
      }).catch((err) => {
        // Non-fatal — the socket's `student:question_changed` (fired by
        // useExamLiveEmitter) already updated ExamSession too.
        console.warn("[useAttemptSession] setCurrentQuestion PATCH failed:", err);
      });
    }, 400);
  }, []);

  // ── Public: submit ──────────────────────────────────────────────────────
  const submit = useCallback(async (submitOpts?: { autoSubmitReason?: string; submitType?: "USER" | "AUTO" }) => {
    const a = attemptRef.current;
    if (!a) return { ok: false };
    // Flush queued answers FIRST so no local edit is dropped on the way out.
    // We tolerate failure — the /attempt/submit call still proceeds so the
    // student isn't left in limbo, but we bubble a warning to the caller.
    await tryFlush();
    try {
      const resp = await jsonFetch<{ attempt: AttemptShape; alreadyFinal?: boolean }>(SUBMIT_ATTEMPT, {
        method: "POST",
        body: JSON.stringify({
          exerciseId: a.exerciseId,
          terminationReason: submitOpts?.submitType === "AUTO" ? "timer" : "submit",
        }),
      });
      setAttempt(resp.attempt);
      if (!resp.alreadyFinal) {
        // Successful terminal submit — drop the offline queue so it doesn't
        // linger in IndexedDB across future attempts on the same device.
        await dropAll(a.id);
        await refreshQueueCount();
      }
      return { ok: true, alreadyFinal: resp.alreadyFinal };
    } catch (err) {
      console.error("[useAttemptSession] submit failed:", err);
      return { ok: false };
    }
  }, [tryFlush, refreshQueueCount]);

  // ── Public: request resume permission (permission-gate flow) ────────────
  const requestResume = useCallback(async (): Promise<{ ok: boolean }> => {
    if (!exerciseId) return { ok: false };
    try {
      const resp = await jsonFetch<{ attempt: AttemptShape; alreadyApproved?: boolean }>(REQUEST_RESUME, {
        method: "POST",
        body: JSON.stringify({ exerciseId }),
      });
      if (resp?.attempt) {
        setAttempt(resp.attempt);
        setRequiresApproval(
          resp.attempt.resumeState !== "active" && resp.attempt.resumeState !== "approved_for_resume"
        );
        // If server tells us it was already approved (rare race), reload
        // state so we hit the exam directly.
        if (resp.alreadyApproved) await load();
      }
      return { ok: true };
    } catch (err) {
      console.error("[useAttemptSession] requestResume failed:", err);
      return { ok: false };
    }
  }, [exerciseId, load]);

  // ── Socket listener — server pushes resume-state changes ────────────────
  // When the trainer approves/rejects, the server broadcasts to the student's
  // private room. The listener updates local state, and on approval the
  // ResumeGate component transitions into "click to enter" mode.
  useEffect(() => {
    if (!enabled || !exerciseId) return;
    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("@/apiServices/socketClient");
        const sock = mod.getSocket();
        if (!sock) return;
        const handler = (payload: { resumeState?: ResumeState; resumeApprovedAt?: string | null }) => {
          if (!payload) return;
          setAttempt((prev) => (prev ? {
            ...prev,
            resumeState: (payload.resumeState || prev.resumeState) as ResumeState,
            resumeApprovedAt: payload.resumeApprovedAt ?? prev.resumeApprovedAt,
          } : prev));
          if (payload.resumeState) {
            const needs = payload.resumeState !== "active" && payload.resumeState !== "approved_for_resume";
            setRequiresApproval(needs);
          }
        };
        sock.emit("student:join_attempt_room", { exerciseId });
        sock.on("attempt:resume_state", handler);
        cleanup = () => { try { sock.off("attempt:resume_state", handler); } catch { /* */ } };
      } catch (e) {
        // Socket unavailable — the /state poll on the ResumeGate is the fallback.
      }
    })();
    return () => { if (cleanup) cleanup(); };
  }, [enabled, exerciseId]);

  const value: UseAttemptSessionResult = useMemo(() => ({
    loading, error, attempt, canResume, requiresApproval, savedAnswers, questionStatuses,
    timeLeftSeconds, hasTimer, netStatus, queueCount: queueSize,
    saveAnswer, setCurrentQuestion, submit, refresh: load, requestResume,
  }), [
    loading, error, attempt, canResume, requiresApproval, savedAnswers, questionStatuses,
    timeLeftSeconds, hasTimer, netStatus, queueSize,
    saveAnswer, setCurrentQuestion, submit, load, requestResume,
  ]);

  return value;
}
