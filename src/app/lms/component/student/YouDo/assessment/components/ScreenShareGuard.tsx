"use client";

import React from "react";
import { Monitor, AlertTriangle, ShieldAlert } from "lucide-react";
import { useLiveScreenShare } from "./useLiveScreenShare";

// ─── ScreenShareGuard ───────────────────────────────────────────────────────
// Drop-in companion for the test players. Starts live screen sharing while the
// test is active, shows the student a warning + "Re-share" prompt if sharing
// stops (#3), and surfaces proctor warnings. One JSX line per player keeps the
// integration tiny and identical everywhere.

interface ScreenShareGuardProps {
  assessmentId?: string;
  /** Share only while the test is running (e.g. securityAgreed && !embedded). */
  active: boolean;
  courseId?: string;
  /** True when proctoring recording is on (reuse its stream, avoid 2nd prompt). */
  waitForSharedStream?: boolean;
}

export default function ScreenShareGuard({
  assessmentId,
  active,
  courseId,
  waitForSharedStream,
}: ScreenShareGuardProps) {
  const { isSharing, needsReshare, lastWarning, clearWarning, restart } = useLiveScreenShare({
    assessmentId,
    active,
    courseId,
    waitForSharedStream,
  });

  if (!active) return null;

  return (
    <>
      {/* Subtle "live" indicator while everything is fine */}
      {isSharing && !needsReshare && (
        <div
          style={{
            position: "fixed", bottom: 12, left: 12, zIndex: 99990,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(17,24,39,0.78)", color: "#fff",
            padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
            fontFamily: "'Poppins',sans-serif", pointerEvents: "none",
          }}
        >
          <Monitor size={13} />
          <span>Screen shared with proctor</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
        </div>
      )}

      {/* Proctor warning banner */}
      {lastWarning && !needsReshare && (
        <div
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 99998, maxWidth: 460, display: "flex", alignItems: "center", gap: 10,
            background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
            padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)", fontFamily: "'Poppins',sans-serif",
          }}
        >
          <ShieldAlert size={16} style={{ color: "#d97706", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{lastWarning}</span>
          <button
            onClick={clearWarning}
            style={{ border: "none", background: "transparent", color: "#92400e", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Blocking re-share prompt — sharing stopped mid-test */}
      {needsReshare && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", width: "100%", maxWidth: 440, padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} style={{ color: "#dc2626" }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>Screen Sharing Required</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>This violation has been recorded and the proctor notified.</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.55, marginBottom: 18 }}>
              You must share your <strong>entire screen</strong> for the duration of this test.
              Sharing has stopped — click below and choose <strong>“Entire Screen”</strong> to continue.
            </p>
            <button
              onClick={restart}
              style={{ width: "100%", padding: "11px 16px", borderRadius: 9, border: "none", background: "#f97316", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
            >
              <Monitor size={16} /> Re-share my screen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
