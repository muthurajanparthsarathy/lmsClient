"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Send, Info, Loader2 } from "lucide-react";

const MAX = 500;

interface Props {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => Promise<{ ok: boolean; error?: string; recipients?: number }>;
}

export default function BroadcastMessageModal({ open, onClose, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
      setSending(false);
      requestAnimationFrame(() => { setShow(true); taRef.current?.focus(); });
    } else {
      setShow(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  if (!open) return null;

  const trimmed = text.trim();
  const handleSend = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const res = await onSend(trimmed);
    if (res.ok) {
      onClose();
    } else {
      setSending(false);
      setError(res.error || "Failed to send message. Please try again.");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[1100] flex items-center justify-center p-4 transition-opacity duration-150 ${show ? "opacity-100" : "opacity-0"}`}
      style={{ background: "rgba(15,23,42,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 transition-all duration-150 ${show ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-2 opacity-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Send Message to All Students</h2>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2.5 rounded-lg bg-indigo-50 border border-indigo-100 px-3.5 py-3">
            <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-relaxed text-indigo-700">
              This message will be sent to all students who are currently in live session.
            </p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Message</label>
            <textarea
              ref={taRef}
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here…"
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
            <div className="flex items-center justify-between mt-1">
              {error ? <span className="text-[12px] text-red-500">{error}</span> : <span />}
              <span className="text-[11px] text-gray-400">{text.length}/{MAX}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => !sending && onClose()}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!trimmed || sending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to All
          </button>
        </div>
      </div>
    </div>
  );
}
