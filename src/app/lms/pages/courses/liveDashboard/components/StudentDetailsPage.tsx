"use client";

import React from "react";
import { useStudentDetails } from "../hooks/useStudentDetails";
import type { QuestionStatus } from "../types/liveDashboard.types";

interface StudentDetailsPageProps {
  assessmentId: string;
  studentId: string;
  onBack: () => void;
}

const STATUS_META: Record<QuestionStatus, { label: string; cls: string }> = {
  submitted:   { label: "Submitted",   cls: "text-green-600" },
  in_progress: { label: "In Progress", cls: "text-blue-600" },
  pending:     { label: "Pending",     cls: "text-gray-400" },
};

// Defensive: titles can occasionally be content-block arrays/objects, never render those raw.
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ");
  if (typeof v === "object") return asText((v as any).value ?? (v as any).text ?? "");
  return String(v);
}

function fmtTime(secs: number): string {
  if (!secs || secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function StudentDetailsPage({ assessmentId, studentId }: StudentDetailsPageProps) {
  const { studentInfo, questions, isLoading, error } = useStudentDetails(assessmentId, studentId);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-5">
      {/* Header — plain, matching the Live Dashboard page (no wrapping card) */}
      <div className="min-w-0 flex-shrink-0">
        <h1 className="text-[22px] font-bold text-gray-900">Student Details – Completed Questions</h1>
        {studentInfo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500 mt-1">
            <span>Student Name: <strong className="text-gray-700">{studentInfo.studentName}</strong> ({studentInfo.email})</span>
            <span className="text-gray-300">|</span>
            <span>Test Name: <strong className="text-gray-700">{studentInfo.assessmentName}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Total Questions: <strong className="text-gray-700">{studentInfo.totalQuestions}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Completed: <strong className="text-green-600">{studentInfo.completed}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Yet To Complete: <strong className="text-amber-500">{studentInfo.yetToComplete}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Completion: <strong className="text-blue-600">{studentInfo.completionPercent}%</strong></span>
          </div>
        )}
      </div>

      {/* Questions list — fills height & scrolls internally, exactly like the Live Dashboard */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[13px] text-gray-400">Loading student details…</div>
        ) : error ? (
          <div className="p-8 text-center text-[13px] text-red-500">{error}</div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0 lmsd-scroll">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["S. No.", "Question No.", "Question Title", "Question Type", "Marks", "Status", "Submitted At", "Time Taken"].map(h => (
                    <th key={h} className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[12px] font-semibold text-gray-600 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => {
                  const meta = STATUS_META[q.status] ?? STATUS_META.pending;
                  return (
                    <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-[13px] text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-700">{q.questionNo}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{asText(q.questionTitle)}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 uppercase">{asText(q.questionType)}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-700">{q.marks}</td>
                      <td className={`px-4 py-3 text-[13px] font-medium ${meta.cls}`}>{meta.label}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500 whitespace-nowrap">{fmtDate(q.submittedAt)}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-700 font-mono">{fmtTime(q.timeTakenSeconds)}</td>
                    </tr>
                  );
                })}
                {questions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[13px] text-gray-400">
                      No question activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
