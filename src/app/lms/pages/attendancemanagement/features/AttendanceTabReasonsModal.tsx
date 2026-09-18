"use client";

import React, { useEffect } from "react";
import { fmt, parseKey, type ReasonItem } from "@/app/lms/pages/attendancemanagement/features/attendanceTabShared";

// ── Reasons modal ───────────────────────────────────────────────────────────
// Opens on "Save changes" when dirty A / H marks exist. Left side: student,
// date and the mark (H additionally picks 1st/2nd half). Right side: reason.
// Save stays disabled until every row has a reason (and half for H).
const ReasonsModal: React.FC<{
  items: ReasonItem[];
  saving: boolean;
  onChange: (
    index: number,
    patch: Partial<Pick<ReasonItem, "reason" | "halfPeriod">>
  ) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ items, saving, onChange, onClose, onSave }) => {
  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isValid = (it: ReasonItem) =>
    !!it.reason.trim() &&
    (it.status !== "H" || it.halfPeriod === "first" || it.halfPeriod === "second");
  const filledCount = items.filter(isValid).length;
  const allValid = filledCount === items.length;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-tile border border-hairline bg-surface p-5 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-semibold text-ink-900">Reasons required</h3>
        <p className="mt-1 text-[12px] text-ink-500">
          Every Absent and Half-day mark needs a reason before the changes
          can be saved.
        </p>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto divide-y divide-ink-100 border border-ink-100 rounded-md">
          {items.map((it, i) => (
            <div key={`${it.studentId}|${it.dateKey}`} className="flex items-start gap-3 p-3">
              {/* Left: who / when / what */}
              <div className="w-52 shrink-0">
                <div className="text-[12.5px] font-medium text-ink-900 truncate">
                  {it.name}
                </div>
                <div className="text-[10.5px] text-ink-500">{fmt(parseKey(it.dateKey))}</div>
                <span
                  className={`mt-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold border ${
                    it.status === "A"
                      ? "bg-danger-50 text-danger-700 border-danger-500/30"
                      : "bg-warn-50 text-warn-700 border-warn-500/30"
                  }`}
                >
                  {it.status === "A" ? "A · Absent" : "H · Half-day"}
                </span>
                {it.status === "H" && (
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(i, { halfPeriod: "first" })}
                      className={`h-6 px-2 rounded border text-[10.5px] font-semibold transition ${
                        it.halfPeriod === "first"
                          ? "bg-warn-50 border-warn-500/40 text-warn-700"
                          : "bg-white border-ink-200 text-ink-600 hover:bg-warn-50"
                      }`}
                    >
                      1st half
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(i, { halfPeriod: "second" })}
                      className={`h-6 px-2 rounded border text-[10.5px] font-semibold transition ${
                        it.halfPeriod === "second"
                          ? "bg-warn-50 border-warn-500/40 text-warn-700"
                          : "bg-white border-ink-200 text-ink-600 hover:bg-warn-50"
                      }`}
                    >
                      2nd half
                    </button>
                  </div>
                )}
              </div>

              {/* Right: the reason */}
              <div className="flex-1 min-w-0">
                <textarea
                  value={it.reason}
                  onChange={(e) => onChange(i, { reason: e.target.value })}
                  rows={2}
                  maxLength={500}
                  placeholder={
                    it.status === "A"
                      ? "e.g. Medical leave, family emergency…"
                      : "e.g. Left early for appointment…"
                  }
                  className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 resize-none ${
                    it.reason.trim() ? "border-ink-200" : "border-danger-500/30"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-500">
            {filledCount} / {items.length} reason{items.length === 1 ? "" : "s"} filled
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!allValid || saving}
              title={allValid ? "Save all changes" : "Fill every reason (and half for H) first"}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReasonsModal;
