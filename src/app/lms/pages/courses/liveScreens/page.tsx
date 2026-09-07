"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid, List, ShieldAlert, MonitorPlay } from "lucide-react";
import { useProctorScreens } from "./hooks/useProctorScreens";
import ScreenCard from "./components/ScreenCard";
import ScreenZoomModal from "./components/ScreenZoomModal";
import type { ScreenStudent } from "./types/liveScreens.types";

const STATUS_ORDER: Record<string, number> = { sharing: 0, online: 1, offline: 2 };

function LiveScreensInner() {
  const router = useRouter();
  const params = useSearchParams();
  const assessmentId = params.get("assessmentId") || params.get("exerciseId") || "";
  const courseId = params.get("courseId") || "";
  const nodeId = params.get("nodeId") || "";
  const nodeType = params.get("nodeType") || "";

  const {
    students, streams, assessmentName, isLoading, error, accessDenied,
    sharingCount, warnStudent, setQuality, sendMessage,
  } = useProctorScreens({ assessmentId, courseId, nodeId, nodeType });

  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sharing students first, then online, then offline; stable by name.
  const ordered = useMemo(() => {
    return [...students].sort((a, b) => {
      const s = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return s !== 0 ? s : a.studentName.localeCompare(b.studentName);
    });
  }, [students]);

  const selected: ScreenStudent | undefined = useMemo(
    () => students.find((s) => s.id === selectedId),
    [students, selectedId],
  );

  // Request high quality for the opened screen; drop back to low on close.
  useEffect(() => {
    if (!selectedId) return;
    setQuality(selectedId, "high");
    return () => setQuality(selectedId, "low");
  }, [selectedId, setQuality]);

  // ── Access denied (non-proctor) ─────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="p-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <ShieldAlert size={32} className="mx-auto text-red-500 mb-3" />
          <h2 className="text-[15px] font-bold text-gray-900">Access Restricted</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Only coordinators and proctors can view student screens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[16px] font-bold text-gray-900">
                <MonitorPlay size={18} className="text-indigo-600" />
                Live Screen Sharing – All Students ({sharingCount})
              </h1>
              {assessmentName && (
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {assessmentName} · {students.length} enrolled · {sharingCount} sharing
                </p>
              )}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"}`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="p-10 text-center text-[13px] text-gray-400">Loading live screens…</div>
        ) : error ? (
          <div className="p-10 text-center text-[13px] text-red-500">{error}</div>
        ) : ordered.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-400">No students enrolled in this assessment.</div>
        ) : (
          <div className="p-4">
            <div
              className={
                view === "grid"
                  ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid gap-3 grid-cols-1"
              }
            >
              {ordered.map((s, i) => (
                <ScreenCard
                  key={s.id}
                  index={i}
                  student={s}
                  stream={streams.get(s.id)}
                  onOpen={setSelectedId}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zoom / fullscreen view */}
      {selected && (
        <ScreenZoomModal
          assessmentId={assessmentId}
          student={selected}
          stream={streams.get(selected.id)}
          onClose={() => setSelectedId(null)}
          onWarn={warnStudent}
          onSendMessage={sendMessage}
        />
      )}
    </div>
  );
}

export default function LiveScreensPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>}>
      <LiveScreensInner />
    </Suspense>
  );
}
