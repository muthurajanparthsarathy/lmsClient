"use client";

import { Check, Loader2 } from "lucide-react";

interface GradingActionsProps {
  moveToNext: boolean;
  onMoveToNextChange: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

export default function GradingActions({
  moveToNext,
  onMoveToNextChange,
  onCancel,
  onSave,
  saving,
  saved,
}: GradingActionsProps) {
  // Two-row layout — the "Move to next question after save" checkbox has its
  // own row on top; Cancel + Save Mark & Feedback sit on a second row below.
  // This keeps the primary action button at full column width so the label
  // never truncates on narrow grading rails, and the checkbox no longer has
  // to fight the button pair for horizontal space.
  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-w-0 cursor-pointer items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={moveToNext}
          onChange={(e) => onMoveToNextChange(e.target.checked)}
          className="h-[15px] w-[15px] shrink-0 cursor-pointer rounded-[4px] border border-[#C6D2E4] accent-[#0667F9]"
        />
        <span className="text-[11px] font-medium leading-[1.3] text-[#53658C]">
          Move to next question after save
        </span>
      </label>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-[42px] flex-none rounded-[9px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#39496B] transition-colors hover:border-[#B9CDEA] hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#0667F9] text-[13px] font-semibold text-white transition-colors hover:bg-[#0559DC] disabled:cursor-not-allowed disabled:bg-[#A9C8F7]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Mark & Feedback"
          )}
        </button>
      </div>
    </div>
  );
}
