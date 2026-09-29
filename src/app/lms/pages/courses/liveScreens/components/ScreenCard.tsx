"use client";

import React, { useEffect, useRef } from "react";
import { Monitor, AlertTriangle, WifiOff, Maximize2 } from "lucide-react";
import type { ScreenStudent } from "../types/liveScreens.types";

interface ScreenCardProps {
  index: number;
  student: ScreenStudent;
  stream?: MediaStream;
  onOpen: (studentId: string) => void;
}

const STATUS_META = {
  sharing: { label: "Live", color: "#16a34a", dot: "#22c55e" },
  online:  { label: "Online", color: "#f59e0b", dot: "#f59e0b" },
  offline: { label: "Offline", color: "#9ca3af", dot: "#9ca3af" },
} as const;

function ScreenCardBase({ index, student, stream, onOpen }: ScreenCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach/detach the live MediaStream to the <video> element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && v.srcObject !== stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    } else if (!stream && v.srcObject) {
      v.srcObject = null;
    }
  }, [stream]);

  const meta = STATUS_META[student.status] ?? STATUS_META.offline;
  const hasVideo = student.isSharingScreen && !!stream;

  return (
    <button
      type="button"
      onClick={() => onOpen(student.id)}
      className="group text-left bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:border-indigo-300"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gray-100 text-[11px] font-bold text-gray-500 flex-shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{student.studentName}</div>
            <div className="text-[11px] text-gray-400 truncate">{student.registerNumber || student.email}</div>
          </div>
        </div>
        <span className="flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold" style={{ color: meta.color }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: meta.dot, boxShadow: student.status === "sharing" ? `0 0 0 0 ${meta.dot}` : "none", animation: student.status === "sharing" ? "lsPulse 1.4s ease-in-out infinite" : "none" }}
          />
          {meta.label}
        </span>
      </div>

      {/* Preview */}
      <div className="relative bg-gray-900" style={{ aspectRatio: "16 / 10" }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-1.5">
            {student.status === "offline" ? <WifiOff size={22} /> : <Monitor size={22} />}
            <span className="text-[11px]">
              {student.status === "offline" ? "Not connected" : "Waiting for screen…"}
            </span>
          </div>
        )}

        {/* Hover zoom hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="flex items-center gap-1 text-white text-[12px] font-semibold bg-black/50 px-2.5 py-1 rounded-lg">
            <Maximize2 size={13} /> Open
          </span>
        </div>

        {/* Warning badge */}
        {student.warningCount > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
            <AlertTriangle size={10} /> {student.warningCount}
          </span>
        )}
      </div>

      <style>{`@keyframes lsPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6)}70%{box-shadow:0 0 0 5px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
    </button>
  );
}

function areEqual(prev: ScreenCardProps, next: ScreenCardProps) {
  return (
    prev.index === next.index &&
    prev.stream === next.stream &&
    prev.onOpen === next.onOpen &&
    prev.student.id === next.student.id &&
    prev.student.studentName === next.student.studentName &&
    prev.student.registerNumber === next.student.registerNumber &&
    prev.student.status === next.student.status &&
    prev.student.isSharingScreen === next.student.isSharingScreen &&
    prev.student.warningCount === next.student.warningCount
  );
}

export default React.memo(ScreenCardBase, areEqual);
