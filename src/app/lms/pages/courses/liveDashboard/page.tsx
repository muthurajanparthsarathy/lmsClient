"use client";

import React, { Suspense } from "react";

import SessionDetail from "./components/SessionDetail";

// ── Live Dashboard entry point ──────────────────────────────────────────────
//
// The Live Dashboard is only ever reached from an assessment's "Review" action
// (Assessment.tsx, manageUsers.tsx, reviewSubmission) — every one of those
// pushes a URL that already carries `assessmentId`. There is no picker page
// here anymore: the SessionsList branch used to render a course-wide list of
// live sessions when the URL had no assessmentId, but the trainer had already
// picked the assessment upstream by the time they landed on this route.
//
// SessionDetail owns the "no assessmentId in the URL" case (renders a small
// "Missing assessment reference." notice) so a mistyped deep link still fails
// gracefully.
export default function LiveDashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>}>
      <SessionDetail />
    </Suspense>
  );
}
