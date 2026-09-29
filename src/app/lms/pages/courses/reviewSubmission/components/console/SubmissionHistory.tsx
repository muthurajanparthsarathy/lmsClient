"use client";

import { Eye } from "lucide-react";
import type { SubmissionAttempt } from "./types";

interface SubmissionHistoryProps {
  attempts: SubmissionAttempt[];
  onView: (attempt: SubmissionAttempt) => void;
}

const HEADERS = [
  "Attempt",
  "Submitted On",
  "Status",
  "Test Cases",
  "Mark",
  "Actions",
] as const;

export default function SubmissionHistory({
  attempts,
  onView,
}: SubmissionHistoryProps) {
  return (
    <section className="flex-none overflow-hidden rounded-[10px] border border-[#DEE7F3] bg-white">
      <h2 className="px-5 pb-3 pt-4 text-[16px] font-bold tracking-[-0.01em] text-[#0B1437]">
        Submission History
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-y border-[#E7EEF8] bg-[#F6F9FE]">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-5 py-2.5 text-left text-[12.5px] font-semibold text-[#53658C] first:pl-5 last:pr-5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td
                  colSpan={HEADERS.length}
                  className="px-5 py-6 text-center text-[13px] font-medium text-[#8090AF]"
                >
                  No submission recorded for this question.
                </td>
              </tr>
            ) : (
              attempts.map((a) => (
                <tr
                  key={a.attempt}
                  className="border-b border-[#EDF2F9] last:border-b-0"
                >
                  <td className="px-5 py-3 text-[13px] font-medium tabular-nums text-[#39496B]">
                    {a.attempt}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium text-[#39496B]">
                    {a.submittedOn}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-[6px] bg-[#E8F1FE] px-2.5 py-[3px] text-[12px] font-semibold text-[#0B66F6]">
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium tabular-nums text-[#39496B]">
                    {a.testCasesTotal != null
                      ? `${a.testCasesPassed ?? 0} / ${a.testCasesTotal}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium tabular-nums text-[#39496B]">
                    {a.mark} / {a.maxMark}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onView(a)}
                      title="View submission details"
                      aria-label={`View details of attempt ${a.attempt}`}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-[#DEE7F3] bg-white text-[#53658C] transition-colors hover:border-[#0667F9] hover:text-[#0667F9]"
                    >
                      <Eye className="h-[15px] w-[15px]" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
