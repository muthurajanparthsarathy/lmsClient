"use client";

// ─── Test-only proctor message notification (header bell) ────────────────────
// Replaces the floating chat widget. Designed to sit INSIDE the assessment
// header (inline). Behaviour:
//   • A new proctor message pops a brief popup under the bell (~6s) then
//     collapses behind the bell with an unread badge.
//   • Click the bell to review this session's messages.
//
// EPHEMERAL & SEPARATE: live socket messages only — no history is fetched and
// the server no longer stores these (see messagingSocket.js). This is its own
// test-only notification, independent of the app's global notification system.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, Megaphone } from "lucide-react";
import { getSocket } from "@/apiServices/socketClient";
import { useAuthStore } from "@/stores/authStore";

interface Msg {
  _id: string;
  message: string;
  senderName?: string;
  scope?: "individual" | "broadcast";
  createdAt?: string;
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function TestMessageBell({
  assessmentId,
  className,
}: {
  assessmentId?: string;
  className?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const studentId = (user?.id || user?._id || "") as string;

  const [messages, setMessages] = useState<Msg[]>([]); // in-memory, this session only
  const [open, setOpen] = useState(false); // dropdown open
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<Msg | null>(null); // brief popup under the bell
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Join the assessment's broadcast room + receive messages live. No history
  // fetch — messages exist only for this live session.
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    const socket = getSocket();
    const join = () => socket.emit("student:join_messages", { assessmentId });
    join();
    socket.on("connect", join);

    const onMsg = (m: Msg) => {
      if (!m || !m.message) return;
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
      setUnread((u) => u + 1);
      setToast(m); // pop the brief popup
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    };
    socket.on("student:message", onMsg);

    return () => {
      socket.off("connect", join);
      socket.off("student:message", onMsg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [assessmentId, studentId]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const togglePanel = useCallback(() => {
    setOpen((o) => !o);
    setUnread(0);
    setToast(null);
  }, []);

  if (!assessmentId || !studentId) return null;

  return (
    <div ref={wrapRef} className={`relative ${className || ""}`}>
      {/* Bell button */}
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Proctor messages"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
      >
        <Bell size={18} className={toast ? "animate-bounce" : ""} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Brief popup under the bell on a new message */}
      {toast && !open && (
        <div
          className="absolute right-0 mt-2 w-72 max-w-[80vw] rounded-xl bg-white shadow-2xl border border-gray-200 z-[2147483000] overflow-hidden"
          style={{ animation: "tmb-pop 0.16s ease-out" }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white">
            {toast.scope === "broadcast" ? <Megaphone size={13} /> : <Bell size={13} />}
            <span className="text-[12px] font-semibold flex-1 truncate">{toast.senderName || "Proctor"}</span>
            <button onClick={() => setToast(null)} className="p-0.5 rounded hover:bg-white/15" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Dropdown: this session's messages */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-xl bg-white shadow-2xl border border-gray-200 z-[2147483000] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-600 text-white">
            <span className="text-[13px] font-semibold flex items-center gap-2">
              <Bell size={14} /> Test Notification
            </span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/15" aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-[12.5px] py-6">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m._id} className="rounded-xl bg-white border border-gray-200 shadow-sm px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {m.scope === "broadcast" && <Megaphone size={12} className="text-indigo-500" />}
                    <span className="text-[11px] font-semibold text-indigo-600">{m.senderName || "Proctor"}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{fmtTime(m.createdAt)}</span>
                  </div>
                  <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes tmb-pop{from{opacity:0;transform:translateY(-6px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
