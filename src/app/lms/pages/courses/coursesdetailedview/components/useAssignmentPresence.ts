import { useEffect } from "react";
import { getSocket } from "@/apiServices/socketClient";
import { useAuthStore } from "@/stores/authStore";

// ─── We Do assignment → Live Dashboard presence ─────────────────────────────
// Tells the trainer's Live Dashboard that this learner has the assignment open
// right now, so their row reads "Started" while they work. A We Do assignment
// has no exam session, and a saved answer is not the same as finishing.
//
// Announces on mount and on every (re)connect, repeats every 25 s so a
// dashboard that opened later still catches up, and signs off on unmount.
// The server also lets the learner go when the socket drops (tab closed,
// network lost) — after a short grace, so a reload doesn't flicker the row.
const HEARTBEAT_MS = 25_000;

interface AssignmentPresenceArgs {
  assessmentId?: string;
  courseId?: string;
  nodeId?: string;
  nodeType?: string;
  enabled?: boolean;
}

export function useAssignmentPresence({
  assessmentId,
  courseId,
  nodeId,
  nodeType,
  enabled = true,
}: AssignmentPresenceArgs) {
  const user = useAuthStore((s) => s.user);
  const studentId = (user?.id || user?._id || "") as string;

  useEffect(() => {
    if (!enabled || !assessmentId || !studentId) return;
    const socket = getSocket();
    const payload = { assessmentId, studentId, courseId, nodeId, nodeType };
    const announce = () => {
      try { socket.emit("student:assignment_open", payload); } catch { /* never break the editor */ }
    };

    announce();
    socket.on("connect", announce);
    const heartbeat = window.setInterval(announce, HEARTBEAT_MS);

    return () => {
      window.clearInterval(heartbeat);
      socket.off("connect", announce);
      try { socket.emit("student:assignment_close", { assessmentId, studentId }); } catch { /* ignore */ }
    };
  }, [enabled, assessmentId, studentId, courseId, nodeId, nodeType]);
}
