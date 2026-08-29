"use client";

// ─── Connection status banner (Recovery & Resume) ─────────────────────────
// Sits at the top of every attempt page. Communicates connection + sync
// state so the student never wonders whether their answers were saved.
//
// States:
//   online + queue empty        → invisible (default; nothing to say).
//   syncing / queue has items   → thin blue strip: "Syncing your last N…".
//   offline                     → persistent orange strip.
//
// Rendered by the attempt page as a sibling of the exam content; positioned
// fixed at top so the exam layout doesn't reshuffle when the banner appears.

import React from "react";
import { CloudOff, Loader2, CheckCircle2 } from "lucide-react";
import type { NetStatus } from "./useAttemptSession";

interface Props {
  netStatus: NetStatus;
  queueCount: number;
}

export default function ConnectionStatusBanner({ netStatus, queueCount }: Props) {
  // Priority: offline first (user needs to know NOW), then syncing (only
  // meaningful when the queue is non-empty), else invisible.
  const isOffline = netStatus === "offline";
  const isSyncing = !isOffline && netStatus === "syncing";
  const hasPending = queueCount > 0;
  const isConfirmingSync = !isOffline && !isSyncing && hasPending;
  const visible = isOffline || isSyncing || isConfirmingSync;
  if (!visible) return null;

  const label = isOffline
    ? "Connection lost — your answers are being saved locally and will sync automatically when you're back online."
    : isSyncing
      ? `Syncing your last ${queueCount} answer${queueCount === 1 ? "" : "s"}…`
      : `${queueCount} answer${queueCount === 1 ? "" : "s"} still pending — retrying shortly.`;

  const palette = isOffline
    ? { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", icon: <CloudOff size={14} /> }
    : isSyncing
      ? { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", icon: <Loader2 size={14} className="animate-spin" /> }
      : { bg: "#dcfce7", border: "#22c55e", text: "#166534", icon: <CheckCircle2 size={14} /> };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: palette.bg,
        borderBottom: `1px solid ${palette.border}`,
        color: palette.text,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {palette.icon}
      <span>{label}</span>
    </div>
  );
}
