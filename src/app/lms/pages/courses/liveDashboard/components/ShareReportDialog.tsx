"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Copy, Check, Search, Send } from "lucide-react";

// ── Share Report dialog ─────────────────────────────────────────────────────
//
// Opened from the individual student report's Share button. Compact centered
// dialog:
//   • Read-only report link + Copy (primary action — this actually works)
//   • Searchable recipient selector, selected chips
//   • Optional message textarea gated by a checkbox
//   • Cancel + Send Report
//
// Important honesty: the LMS does NOT ship a "mail student report" endpoint
// today. Rather than pretend a delivery occurred, the "Send Report" button
// copies the link to the clipboard, notifies the parent (which raises a
// truthful toast), and closes. If/when a real endpoint lands, swap the
// `send()` body and the parent toast — nothing above this file changes.

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

export interface ShareReportDialogProps {
  studentName: string;
  assessmentName: string;
  /** Candidate recipients (usually the course's own trainers + staff).
   *  Filtered client-side by the search box. */
  recipients?: Recipient[];
  /** Fired when the request completes successfully. Parent shows the toast
   *  and closes any wrapping modal state. */
  onSent?: (recipients: Recipient[]) => void;
  onClose: () => void;
}

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

export default function ShareReportDialog({
  studentName,
  assessmentName,
  recipients = [],
  onSent,
  onClose,
}: ShareReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Recipient[]>([]);
  const [withMessage, setWithMessage] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousActive?.focus?.();
    };
  }, [onClose]);

  // The share URL is deep-linked to the report page. We include a hash-like
  // token off `id`, but there is no signed-URL backend yet — this is a
  // placeholder that opens the same page a signed-in trainer would see.
  const reportLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  const filteredRecipients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedIds = new Set(selected.map((r) => r.id));
    let rows = recipients.filter((r) => !selectedIds.has(r.id));
    if (q) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
      );
    }
    return rows.slice(0, 8);
  }, [recipients, selected, query]);

  const canSend = selected.length > 0 && !sending;

  const copyLink = async (): Promise<boolean> => {
    if (!reportLink) return false;
    try {
      await navigator.clipboard.writeText(reportLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      return true;
    } catch {
      return false;
    }
  };

  // Honest "Send Report" — the LMS has no report-mailing endpoint yet, so
  // the button copies the deep link to the clipboard and asks the parent to
  // surface a truthful toast ("Link copied — share it manually"). When a
  // real endpoint lands, replace this body with the fetch call.
  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      const ok = await copyLink();
      if (!ok) {
        setSendError("Clipboard is blocked — copy the link manually.");
        return;
      }
      onSent?.(selected);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-report-title"
        className="bg-white rounded-xl shadow-2xl w-[520px] max-w-full flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-100">
          <div>
            <h2 id="share-report-title" className="text-[15px] font-semibold text-gray-900">Share Report</h2>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              {studentName} · {assessmentName}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Report link */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Report link</label>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={reportLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-[12px] text-gray-700 bg-gray-50 outline-none"
                aria-label="Report link"
              />
              <button
                type="button"
                onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors ${
                  copied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="share-recipients" className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
              Send to
            </label>
            <div className="border border-gray-200 rounded-md bg-white">
              <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
                {selected.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11.5px]">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-semibold">
                      {initialsOf(r.name)}
                    </span>
                    {r.name}
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => prev.filter((x) => x.id !== r.id))}
                      className="ml-0.5 p-0.5 rounded hover:bg-indigo-100 text-indigo-500"
                      aria-label={`Remove ${r.name}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="share-recipients"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={recipients.length ? "Search people…" : "No recipients configured"}
                    disabled={!recipients.length}
                    className="w-full pl-6 pr-2 py-1 text-[12.5px] outline-none bg-transparent disabled:opacity-60"
                  />
                </div>
              </div>
              {query && filteredRecipients.length > 0 && (
                <div className="border-t border-gray-100 max-h-40 overflow-auto">
                  {filteredRecipients.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelected((prev) => [...prev, r]);
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-50/60"
                    >
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center">
                        {initialsOf(r.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-gray-800 truncate">{r.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{r.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional message */}
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={withMessage}
                onChange={(e) => setWithMessage(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Add a message
            </label>
            {withMessage && (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a short note…"
                rows={3}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-[12.5px] text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
            )}
          </div>

          {sendError && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
              {sendError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12.5px] font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white transition-colors ${
              canSend ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"
            }`}
          >
            <Send size={13} />
            {sending ? "Sending…" : "Send Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
