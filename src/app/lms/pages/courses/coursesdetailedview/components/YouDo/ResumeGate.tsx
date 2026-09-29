"use client";

// ─── Resume permission gate ───────────────────────────────────────────────
// Mounted by every attempt page IN PLACE of the exam UI whenever
// `attemptSession.requiresApproval` is true. The student cannot enter the
// exam without going through this screen:
//
//   1. `awaiting_approval` (idle)    → "Request Permission" button
//   2. `awaiting_approval` (sent)    → "Waiting for trainer" spinner
//   3. `approved_for_resume`         → "Resume Assessment" button →
//                                      onEnter() → attemptSession.refresh()
//                                      → gate closes, exam mounts
//   4. `rejected`                    → "Request denied" + option to retry
//
// The parent attempt page owns the transition — when `requiresApproval`
// flips to false, this component unmounts and the exam UI mounts.

import React, { useState, useEffect } from "react";
import { CheckCircle2, Clock, Loader2, ShieldQuestion, XCircle } from "lucide-react";
import type { AttemptShape, ResumeState } from "./useAttemptSession";

interface Props {
  attempt: AttemptShape | null;
  assessmentName?: string;
  onRequest: () => Promise<{ ok: boolean }>;
  /** Called when the student clicks Resume after approval — the parent
   *  should refresh the hook so canResume becomes true and the exam mounts. */
  onEnter: () => void | Promise<void>;
  /** Called if the student decides to leave the gate entirely. */
  onExit?: () => void;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  } catch { return ""; }
}

export default function ResumeGate({ attempt, assessmentName, onRequest, onEnter, onExit }: Props) {
  const state: ResumeState = (attempt?.resumeState || "awaiting_approval") as ResumeState;
  const [sending, setSending] = useState(false);
  const [entering, setEntering] = useState(false);
  // Track whether the student has already sent the request in this session so
  // we can show the waiting state even before the server round-trip lands.
  const [locallySent, setLocallySent] = useState(false);

  // If the server-side state already says awaiting_approval / rejected /
  // approved when we mount, no need for the local flag.
  useEffect(() => {
    if (state === "awaiting_approval" || state === "rejected") setLocallySent(true);
  }, [state]);

  const handleRequest = async () => {
    setSending(true);
    try {
      const r = await onRequest();
      if (r?.ok) setLocallySent(true);
    } finally { setSending(false); }
  };

  const handleEnter = async () => {
    setEntering(true);
    try { await onEnter(); }
    finally { setEntering(false); }
  };

  // ── Compute the visible state ──────────────────────────────────────────
  //  awaiting-idle    (server=awaiting AND student hasn't clicked yet)
  //  waiting          (server=awaiting AND we've sent the request)
  //  approved         (server=approved_for_resume)
  //  rejected         (server=rejected)
  const view: "awaiting-idle" | "waiting" | "approved" | "rejected" =
    state === "approved_for_resume" ? "approved" :
    state === "rejected" ? "rejected" :
    locallySent ? "waiting" : "awaiting-idle";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "#f9fafb",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Poppins', -apple-system, sans-serif",
      }}
    >
      <div style={{
        width: "min(520px, 92vw)", padding: "28px 26px",
        background: "#fff", borderRadius: 14,
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.10), 0 4px 12px rgba(15, 23, 42, 0.06)",
        border: "1px solid #e5e7eb",
      }}>
        {/* Icon strip */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: view === "approved" ? "#dcfce7"
                    : view === "rejected" ? "#fee2e2"
                    : view === "waiting" ? "#dbeafe"
                    : "#f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          {view === "approved" && <CheckCircle2 size={28} color="#16a34a" />}
          {view === "rejected" && <XCircle size={28} color="#dc2626" />}
          {view === "waiting" && <Clock size={28} color="#2563eb" />}
          {view === "awaiting-idle" && <ShieldQuestion size={28} color="#475569" />}
        </div>

        <h2 style={{
          margin: 0, textAlign: "center",
          fontSize: 18, fontWeight: 700, color: "#0f172a", lineHeight: 1.3,
        }}>
          {view === "approved" && "Ready to resume"}
          {view === "rejected" && "Resume request denied"}
          {view === "waiting" && "Waiting for trainer's approval"}
          {view === "awaiting-idle" && "Assessment paused"}
        </h2>

        {assessmentName && (
          <p style={{ margin: "6px 0 0", textAlign: "center", fontSize: 13, color: "#64748b" }}>
            {assessmentName}
          </p>
        )}

        {/* Body copy per state */}
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "#f8fafc", borderRadius: 10, border: "1px solid #eef2f7",
          fontSize: 13, color: "#334155", lineHeight: 1.55,
        }}>
          {view === "awaiting-idle" && (
            <>Your attempt is saved. To continue, request permission from your trainer. Your previously submitted answers and remaining time will be restored when approved.</>
          )}
          {view === "waiting" && (
            <>
              Your request was sent{attempt?.resumeRequestedAt ? ` at ${formatWhen(attempt.resumeRequestedAt)}` : ""}. This screen will update automatically the moment your trainer approves.
            </>
          )}
          {view === "approved" && (
            <>
              Your trainer approved this resume{attempt?.resumeApprovedAt ? ` at ${formatWhen(attempt.resumeApprovedAt)}` : ""}. Click Resume to continue from your last submitted question. Your remaining time is preserved.
            </>
          )}
          {view === "rejected" && (
            <>Your trainer denied this resume request. You can request permission again — the trainer will be notified.</>
          )}
        </div>

        {/* Action buttons per state */}
        <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              disabled={sending || entering}
              style={{
                padding: "9px 14px", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "#fff",
                color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Exit
            </button>
          )}
          {view === "awaiting-idle" && (
            <button
              type="button"
              onClick={handleRequest}
              disabled={sending}
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: "1px solid #2563eb", background: "#2563eb",
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              Request Permission to Resume
            </button>
          )}
          {view === "waiting" && (
            <button
              type="button"
              disabled
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: "1px solid #93c5fd", background: "#eff6ff",
                color: "#1d4ed8", fontSize: 13, fontWeight: 600, cursor: "not-allowed",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              <Loader2 size={14} className="animate-spin" />
              Awaiting Approval
            </button>
          )}
          {view === "approved" && (
            <button
              type="button"
              onClick={handleEnter}
              disabled={entering}
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: "1px solid #16a34a", background: "#16a34a",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {entering && <Loader2 size={14} className="animate-spin" />}
              Resume Assessment
            </button>
          )}
          {view === "rejected" && (
            <button
              type="button"
              onClick={handleRequest}
              disabled={sending}
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: "1px solid #2563eb", background: "#2563eb",
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              Request Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
