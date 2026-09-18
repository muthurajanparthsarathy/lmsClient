import { useCallback, useEffect, useRef } from "react";
import { getSocket } from "@/apiServices/socketClient";
import { useAuthStore } from "@/stores/authStore";

// ─── Student → Live Dashboard emitter ───────────────────────────────────────
// Fire-and-forget emissions over the ONE shared socket connection. Handles
// join (mount), reconnect, and beforeunload automatically; exposes helpers the
// exam components call from their existing save/navigate/submit functions.
//
// It also tracks per-question time internally: the question currently in view
// accrues seconds; navigating away banks them, and answering reports the
// cumulative seconds for that question.
export function useExamLiveEmitter(assessmentId?: string, totalQuestions?: number) {
  const user = useAuthStore((s) => s.user);
  const studentId = (user?.id || user?._id || "") as string;
  const joinedRef = useRef(false);

  // Per-question time tracking.
  const startRef = useRef<number>(Date.now());          // when the current question opened
  const currentQRef = useRef<string | null>(null);       // id of the question in view
  const accumRef = useRef<Record<string, number>>({});   // banked seconds per question id

  const secsSinceStart = () => Math.max(0, Math.floor((Date.now() - startRef.current) / 1000));

  // Cumulative seconds for a question (banked + live, if it's the current one).
  const elapsedFor = (qid: string) => {
    const banked = accumRef.current[qid] || 0;
    const liveSecs = currentQRef.current === qid ? secsSinceStart() : 0;
    return banked + liveSecs;
  };

  const emit = useCallback(
    (event: string, payload: Record<string, any> = {}) => {
      if (!assessmentId || !studentId) return;
      try {
        getSocket().emit(event, { assessmentId, studentId, ...payload });
      } catch {
        /* silent — never break the exam on a socket hiccup */
      }
    },
    [assessmentId, studentId]
  );

  // Join on mount; re-announce on reconnect; flag disconnect on unload.
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    const socket = getSocket();

    if (!joinedRef.current) {
      startRef.current = Date.now(); // clock starts when the exam mounts
      emit("student:joined", { timestamp: Date.now(), totalQuestions });
      joinedRef.current = true;
    }

    const onReconnect = () => emit("student:reconnected", { timestamp: Date.now() });
    const onUnload = () => emit("student:disconnected", { timestamp: Date.now() });

    socket.on("reconnect", onReconnect);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      socket.off("reconnect", onReconnect);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [assessmentId, studentId, totalQuestions, emit]);

  return {
    answerSaved: (questionId: string, answer?: any, timeTakenSeconds?: number) => {
      // First interaction: adopt this question as the current one so its time counts.
      if (currentQRef.current === null) currentQRef.current = questionId;
      const secs =
        timeTakenSeconds && timeTakenSeconds > 0 ? timeTakenSeconds : elapsedFor(questionId);
      emit("student:answer_saved", { questionId, answer, timeTakenSeconds: secs });
    },
    questionChanged: (fromQuestionId: string | null, toQuestionId: string | null) => {
      // Bank the time spent on the question we're leaving.
      if (fromQuestionId) {
        accumRef.current[fromQuestionId] = (accumRef.current[fromQuestionId] || 0) + secsSinceStart();
      }
      // Reset the clock for the question we're entering.
      startRef.current = Date.now();
      currentQRef.current = toQuestionId;
      emit("student:question_changed", { fromQuestionId, toQuestionId, timestamp: Date.now() });
    },
    submitted: () => emit("student:submitted", { timestamp: Date.now() }),
  };
}
