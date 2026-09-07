import { getToken } from "@/lib/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/apiServices/socketClient";
import { getIceServers } from "@/lib/webrtc";
import type {
  ScreenStudent,
  LiveScreensResponse,
  ScreenActiveStudents,
  ScreenStudentAvailable,
  ScreenStudentStopped,
  ScreenStudentViolation,
} from "../types/liveScreens.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";

interface UseProctorScreensArgs {
  assessmentId: string;
  courseId?: string;
  nodeId?: string;
  nodeType?: string;
}

interface UseProctorScreensResult {
  students: ScreenStudent[];
  streams: Map<string, MediaStream>;
  assessmentName: string;
  isLoading: boolean;
  error: string | null;
  accessDenied: boolean;
  sharingCount: number;
  warnStudent: (studentId: string, message: string) => void;
  setQuality: (studentId: string, quality: "high" | "low") => void;
  sendMessage: (studentId: string, message: string) => Promise<{ ok: boolean; error?: string }>;
}

function readToken(): string {
  if (typeof window === "undefined") return "";
  return getToken() || localStorage.getItem("token") || "";
}

export function useProctorScreens({
  assessmentId,
  courseId,
  nodeId,
  nodeType,
}: UseProctorScreensArgs): UseProctorScreensResult {
  const [students, setStudents] = useState<ScreenStudent[]>([]);
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());
  const [assessmentName, setAssessmentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // One inbound RTCPeerConnection per student.
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE that arrives before the remote description is set.
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // ── emit helper ─────────────────────────────────────────────────────────────
  const emit = useCallback((event: string, payload: Record<string, any> = {}) => {
    try { getSocket().emit(event, payload); } catch { /* ignore */ }
  }, []);

  const setStudentSharing = useCallback((studentId: string, sharing: boolean, patch: Partial<ScreenStudent> = {}) => {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === studentId);
      if (idx === -1) {
        // Student not in the seed list (e.g. joined late) — add a minimal row.
        if (!sharing) return prev;
        return [
          ...prev,
          {
            id: studentId,
            studentName: patch.studentName || "Student",
            email: patch.email || "",
            registerNumber: patch.registerNumber || patch.email || "",
            isSharingScreen: true,
            warningCount: patch.warningCount ?? 0,
            status: "sharing",
            startedAt: patch.startedAt ?? null,
            lastActivity: patch.lastActivity || "—",
            submitted: false,
          },
        ];
      }
      const next = prev.slice();
      next[idx] = {
        ...next[idx],
        ...patch,
        isSharingScreen: sharing,
        status: sharing ? "sharing" : next[idx].submitted ? "offline" : "online",
      };
      return next;
    });
  }, []);

  const closePeer = useCallback((studentId: string) => {
    const pc = pcsRef.current.get(studentId);
    if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(studentId); }
    pendingIceRef.current.delete(studentId);
    setStreams((prev) => {
      if (!prev.has(studentId)) return prev;
      const next = new Map(prev);
      next.delete(studentId);
      return next;
    });
  }, []);

  // ── answer an incoming offer from a student (we are recv-only viewer) ────────
  const handleOffer = useCallback(
    async (studentId: string, sdp: RTCSessionDescriptionInit) => {
      let pc = pcsRef.current.get(studentId);

      // If the student re-offers (e.g. an ICE restart) and we still hold a
      // healthy peer in a stable signaling state, renegotiate ON IT so the
      // existing stream/connection isn't torn down. Otherwise (re)build fresh.
      const canReuse =
        !!pc &&
        pc.signalingState === "stable" &&
        pc.connectionState !== "failed" &&
        pc.connectionState !== "closed";

      if (!canReuse) {
        if (pc) closePeer(studentId);
        const fresh = new RTCPeerConnection({ iceServers: getIceServers() });
        pcsRef.current.set(studentId, fresh);
        fresh.ontrack = (e) => {
          const stream = e.streams[0];
          if (stream) setStreams((prev) => new Map(prev).set(studentId, stream));
        };
        fresh.onicecandidate = (e) => {
          if (e.candidate) emit("screen:ice", { toUserId: studentId, candidate: e.candidate });
        };
        fresh.onconnectionstatechange = () => {
          if (["failed", "closed"].includes(fresh.connectionState)) closePeer(studentId);
        };
        pc = fresh;
      }

      try {
        await pc!.setRemoteDescription(new RTCSessionDescription(sdp));
        // Flush any ICE that arrived early.
        const pending = pendingIceRef.current.get(studentId) || [];
        for (const c of pending) { try { await pc!.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        pendingIceRef.current.delete(studentId);

        const answer = await pc!.createAnswer();
        await pc!.setLocalDescription(answer);
        emit("screen:answer", { toUserId: studentId, sdp: pc!.localDescription });
      } catch {
        closePeer(studentId);
      }
    },
    [emit, closePeer]
  );

  const handleIce = useCallback(async (studentId: string, candidate: RTCIceCandidateInit) => {
    const pc = pcsRef.current.get(studentId);
    if (pc && pc.remoteDescription) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    } else {
      const list = pendingIceRef.current.get(studentId) || [];
      list.push(candidate);
      pendingIceRef.current.set(studentId, list);
    }
  }, []);

  // ── Latest-ref handlers so the socket effect registers once ──────────────────
  const onOfferRef = useRef(handleOffer);
  const onIceRef = useRef(handleIce);
  const onSharingRef = useRef(setStudentSharing);
  const onCloseRef = useRef(closePeer);
  useEffect(() => { onOfferRef.current = handleOffer; }, [handleOffer]);
  useEffect(() => { onIceRef.current = handleIce; }, [handleIce]);
  useEffect(() => { onSharingRef.current = setStudentSharing; }, [setStudentSharing]);
  useEffect(() => { onCloseRef.current = closePeer; }, [closePeer]);

  // ── Initial REST seed ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ assessmentId });
        if (courseId) qs.set("courseId", courseId);
        if (nodeId) qs.set("nodeId", nodeId);
        if (nodeType) qs.set("nodeType", nodeType);

        const res = await fetch(`${API_URL}/api/assessment/live-screens?${qs.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${readToken()}`, "Content-Type": "application/json" },
        });
        if (res.status === 403) { if (!cancelled) setAccessDenied(true); return; }
        if (!res.ok) throw new Error(`Failed to load live screens (${res.status})`);
        const data: LiveScreensResponse = await res.json();
        if (cancelled) return;
        setStudents(data.students || []);
        setAssessmentName(data.assessmentName || "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load live screens");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assessmentId, courseId, nodeId, nodeType]);

  // ── Socket: join proctor room + WebRTC signaling ────────────────────────────
  useEffect(() => {
    if (!assessmentId) return;
    const socket = getSocket();

    const join = () => socket.emit("proctor:join_screens", { assessmentId });

    const onActive = (p: ScreenActiveStudents) =>
      (p.students || []).forEach((s) =>
        onSharingRef.current(s.studentId, true, {
          studentName: s.studentName, email: s.email,
          startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null,
        })
      );
    const onAvailable = (p: ScreenStudentAvailable) =>
      onSharingRef.current(p.studentId, true, {
        studentName: p.studentName, email: p.email, warningCount: p.warningCount,
        startedAt: p.startedAt ? new Date(p.startedAt).toISOString() : null,
      });
    const onStopped = (p: ScreenStudentStopped) => {
      onCloseRef.current(p.studentId);
      onSharingRef.current(p.studentId, false,
        p.warningCount != null ? { warningCount: p.warningCount } : {});
    };
    const onViolation = (p: ScreenStudentViolation) =>
      setStudents((prev) => prev.map((s) => (s.id === p.studentId ? { ...s, warningCount: p.warningCount } : s)));
    const onOffer = ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) =>
      onOfferRef.current(fromUserId, sdp);
    const onIce = ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) =>
      onIceRef.current(fromUserId, candidate);
    const onDenied = () => setAccessDenied(true);

    join();
    socket.on("connect", join);
    socket.on("screen:active_students", onActive);
    socket.on("screen:student_available", onAvailable);
    socket.on("screen:student_stopped", onStopped);
    socket.on("screen:student_violation", onViolation);
    socket.on("screen:offer", onOffer);
    socket.on("screen:ice", onIce);
    socket.on("screen:access_denied", onDenied);

    return () => {
      socket.emit("proctor:leave_screens", { assessmentId });
      socket.off("connect", join);
      socket.off("screen:active_students", onActive);
      socket.off("screen:student_available", onAvailable);
      socket.off("screen:student_stopped", onStopped);
      socket.off("screen:student_violation", onViolation);
      socket.off("screen:offer", onOffer);
      socket.off("screen:ice", onIce);
      socket.off("screen:access_denied", onDenied);
      pcsRef.current.forEach((pc) => { try { pc.close(); } catch {} });
      pcsRef.current.clear();
      pendingIceRef.current.clear();
    };
  }, [assessmentId]);

  const warnStudent = useCallback((studentId: string, message: string) => {
    emit("proctor:warn", { assessmentId, studentId, message });
  }, [emit, assessmentId]);

  const setQuality = useCallback((studentId: string, quality: "high" | "low") => {
    emit("proctor:set_quality", { studentId, quality });
  }, [emit]);

  // Send a one-to-one message to a student — delivered to their in-assessment
  // chat widget (StudentMessageChat) via the shared `proctor:send_message` event,
  // the SAME path the Live Dashboard "Send Message" uses. Resolves with the ack.
  const sendMessage = useCallback(
    (studentId: string, message: string): Promise<{ ok: boolean; error?: string }> =>
      new Promise((resolve) => {
        const text = (message || "").trim();
        if (!assessmentId || !studentId || !text) {
          resolve({ ok: false, error: "Empty message" });
          return;
        }
        try {
          getSocket().emit(
            "proctor:send_message",
            { assessmentId, studentId, message: text },
            (res: any) => resolve(res?.ok ? { ok: true } : { ok: false, error: res?.error || "Failed to send" })
          );
        } catch {
          resolve({ ok: false, error: "Connection error" });
        }
      }),
    [assessmentId]
  );

  const sharingCount = students.filter((s) => s.isSharingScreen).length;

  return {
    students, streams, assessmentName, isLoading, error, accessDenied,
    sharingCount, warnStudent, setQuality, sendMessage,
  };
}
