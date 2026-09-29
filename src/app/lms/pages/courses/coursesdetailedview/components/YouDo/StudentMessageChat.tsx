"use client";
import { getToken } from "@/lib/session";

// ─── Student-side proctor message chat ──────────────────────────────────────
// Floating bottom-right widget mounted on the assessment page. It is CLOSED on
// load (only an unread badge shows for any pre-existing messages) and opens
// AUTOMATICALLY when the proctor sends a new message — over the shared socket,
// no refresh. Manual click opens the panel with the full history. Display-only
// (messaging scope is proctor → student).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Megaphone } from "lucide-react";
import { getSocket } from "@/apiServices/socketClient";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";

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

export default function StudentMessageChat({ assessmentId }: { assessmentId?: string }) {
  const user = useAuthStore((s) => s.user);
  const studentId = (user?.id || user?._id || "") as string;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { openRef.current = open; }, [open]);

  const token = () =>
    typeof window !== "undefined"
      ? getToken() || localStorage.getItem("token") || ""
      : "";

  const markRead = useCallback(() => {
    if (!assessmentId) return;
    fetch(`${API_URL}/api/assessment/messages/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    }).catch(() => {});
  }, [assessmentId]);

  // ── Initial history → badge only. Do NOT open on load. ──────────────────────
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/assessment/messages?assessmentId=${assessmentId}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.success) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setUnread(data.unread || 0);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [assessmentId, studentId]);

  // ── Socket: join broadcast room + receive messages in real time. ────────────
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    const socket = getSocket();
    const join = () => socket.emit("student:join_messages", { assessmentId });
    join();
    socket.on("connect", join);

    const onMsg = (m: Msg) => {
      if (!m || !m.message) return;
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
      if (openRef.current) {
        markRead();
      } else {
        setUnread((u) => u + 1);
        setOpen(true); // auto-open ONLY for newly received messages
      }
    };
    socket.on("student:message", onMsg);

    return () => {
      socket.off("connect", join);
      socket.off("student:message", onMsg);
    };
  }, [assessmentId, studentId, markRead]);

  // ── When open: clear unread, mark read, stick to the latest message. ────────
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    markRead();
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }, [open, markRead, messages.length]);

  if (!assessmentId || !studentId) return null;

  return (
    <>
      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-40 right-5 z-[2147483000] w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: 380, maxHeight: "calc(100vh - 11rem)", animation: "smc-pop 0.16s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={17} />
              <span className="text-base font-semibold">Messages</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Close messages"
            >
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
                <MessageCircle size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No messages yet. Messages from your proctor will appear here.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m._id} className="flex flex-col items-start">
                  <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white border border-gray-200 shadow-sm px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {m.scope === "broadcast" && <Megaphone size={12} className="text-indigo-500" />}
                      <span className="text-2xs font-semibold text-indigo-600">
                        {m.senderName || "Proctor"}
                      </span>
                      {m.scope === "broadcast" && (
                        <span className="text-2xs font-semibold uppercase tracking-wide text-indigo-400 bg-indigo-50 rounded px-1 py-0.5">
                          All
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                  <span className="text-2xs text-gray-400 mt-0.5 ml-1">{fmtTime(m.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Floating launcher ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Messages"
        className="fixed bottom-20 right-5 z-[2147483000] w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-2xs font-bold flex items-center justify-center border-2 border-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <style>{`
        @keyframes smc-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
