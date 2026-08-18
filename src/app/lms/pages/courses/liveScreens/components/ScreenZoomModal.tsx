"use client";
import { getToken } from "@/lib/session";

import React, { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, ShieldAlert, Clock, Monitor, WifiOff, ChevronDown, Send, MessageSquare, Loader2 } from "lucide-react";
import type { ScreenStudent, ScreenViolationsResponse, ScreenViolationItem } from "../types/liveScreens.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

interface ScreenZoomModalProps {
  assessmentId: string;
  student: ScreenStudent;
  stream?: MediaStream;
  onClose: () => void;
  onWarn: (studentId: string, message: string) => void;
  onSendMessage: (studentId: string, message: string) => Promise<{ ok: boolean; error?: string }>;
}

const VIOLATION_LABEL: Record<string, string> = {
  share_stopped: "Stopped screen sharing",
  not_full_screen: "Did not share entire screen",
  tab_switch: "Switched tab / window",
  reconnect: "Network reconnect",
  manual_warning: "Proctor warning issued",
  other: "Violation",
};

function readToken(): string {
  if (typeof window === "undefined") return "";
  return getToken() || localStorage.getItem("token") || "";
}

function fmtElapsed(fromIso: string | null): string {
  if (!fromIso) return "—";
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ScreenZoomModal({ assessmentId, student, stream, onClose, onWarn, onSendMessage }: ScreenZoomModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [violations, setViolations] = useState<ScreenViolationItem[]>([]);
  const [info, setInfo] = useState<ScreenViolationsResponse | null>(null);
  const [loadingV, setLoadingV] = useState(true);
  const [, forceTick] = useState(0); // re-render once a second for the live duration

  // Violation history is collapsed by default so the message box has room.
  const [violationsOpen, setViolationsOpen] = useState(false);

  // Per-student message box → delivered to the student's in-assessment chat.
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const handleSend = async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true); setSendErr(null); setSentOk(false);
    const res = await onSendMessage(student.id, text);
    setSending(false);
    if (res.ok) {
      setMsg("");
      setSentOk(true);
      setTimeout(() => setSentOk(false), 2500);
    } else {
      setSendErr(res.error || "Failed to send");
    }
  };

  // Attach the live stream.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && v.srcObject !== stream) { v.srcObject = stream; v.play().catch(() => {}); }
    else if (!stream && v.srcObject) { v.srcObject = null; }
  }, [stream]);

  // Tick the duration clock.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch violation history (and refresh as the warning count changes live).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingV(true);
      try {
        const qs = new URLSearchParams({ assessmentId, studentId: student.id });
        const res = await fetch(`${API_URL}/api/assessment/screen-violations?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${readToken()}`, "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error();
        const data: ScreenViolationsResponse = await res.json();
        if (cancelled) return;
        setInfo(data);
        setViolations(data.violations || []);
      } catch {
        /* keep whatever we have */
      } finally {
        if (!cancelled) setLoadingV(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assessmentId, student.id, student.warningCount]);

  const hasVideo = student.isSharingScreen && !!stream;
  const statusLabel = student.status === "sharing" ? "Sharing" : student.status === "online" ? "Online (not sharing)" : "Offline";
  const statusColor = student.status === "sharing" ? "#16a34a" : student.status === "online" ? "#f59e0b" : "#9ca3af";

  const handleWarn = () => {
    onWarn(student.id, "Please keep your entire screen shared and follow the exam rules.");
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(15,15,30,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full overflow-hidden flex flex-col"
        style={{ maxWidth: 1100, maxHeight: "92vh", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-gray-900 truncate">{student.studentName}</div>
              <div className="text-[12px] text-gray-500 truncate">{student.registerNumber || student.email}</div>
            </div>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold flex-shrink-0" style={{ color: statusColor }}>
              <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
              {statusLabel}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row min-h-0 flex-1 overflow-hidden">
          {/* Large live screen */}
          <div className="relative bg-black flex-1 min-h-[260px] md:min-h-0" style={{ aspectRatio: "16 / 9" }}>
            {hasVideo ? (
              <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                {student.status === "offline" ? <WifiOff size={30} /> : <Monitor size={30} />}
                <span className="text-[13px]">
                  {student.status === "offline" ? "Student not connected" : "Waiting for screen…"}
                </span>
              </div>
            )}
          </div>

          {/* Side panel: details + violation history */}
          <div className="w-full md:w-[320px] flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col min-h-0">
            <div className="px-4 py-3 grid grid-cols-2 gap-2 border-b border-gray-100">
              <Stat label="Test Duration" value={fmtElapsed(student.startedAt)} mono icon={<Clock size={13} />} />
              <Stat label="Warnings" value={String(student.warningCount)} danger={student.warningCount > 0} icon={<AlertTriangle size={13} />} />
              <Stat label="Email" value={info?.email || student.email || "—"} full />
              <Stat label="Submitted" value={student.submitted ? "Yes" : "No"} />
            </div>

            {/* Violation History — collapsible, CLOSED by default */}
            <button
              type="button"
              onClick={() => setViolationsOpen((o) => !o)}
              className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[12px] font-bold text-gray-700">Violation History</span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 min-w-[18px] text-center">{violations.length}</span>
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${violationsOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {violationsOpen && (
              <div className="overflow-y-auto px-4 py-2 border-b border-gray-100" style={{ maxHeight: 200 }}>
                {loadingV ? (
                  <div className="text-[12px] text-gray-400 py-4 text-center">Loading…</div>
                ) : violations.length === 0 ? (
                  <div className="text-[12px] text-gray-400 py-4 text-center">No violations recorded.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {violations.map((v) => (
                      <li key={v.id} className="flex items-start gap-2 text-[12px]">
                        <ShieldAlert size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-700">{VIOLATION_LABEL[v.type] || v.type}</div>
                          {v.detail && <div className="text-gray-400 truncate">{v.detail}</div>}
                          <div className="text-gray-400">{fmtAt(v.at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Send Message — delivered to the student's in-assessment chat icon */}
            <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                <MessageSquare size={12} /> Send Message
              </label>
              <textarea
                value={msg}
                onChange={(e) => { setMsg(e.target.value); setSendErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); } }}
                maxLength={500}
                placeholder="Message this student… (shows in their chat)"
                className="flex-1 min-h-[64px] resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]">
                  {sendErr ? (
                    <span className="text-red-500">{sendErr}</span>
                  ) : sentOk ? (
                    <span className="text-emerald-600 font-medium">Sent ✓</span>
                  ) : (
                    <span className="text-gray-400">{msg.length}/500</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!msg.trim() || sending}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Send
                </button>
              </div>
            </div>

            {/* Send Warning */}
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={handleWarn}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                <ShieldAlert size={15} /> Send Warning
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, mono, danger, full, icon,
}: { label: string; value: string; mono?: boolean; danger?: boolean; full?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {icon}{label}
      </div>
      <div className={`text-[13px] font-semibold truncate ${danger ? "text-red-600" : "text-gray-800"} ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
