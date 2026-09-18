"use client";

import React from "react";

type ConfirmInlineProps = {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Destructive actions in the builder replace their trigger in place rather than
// opening a dialog, so the row being deleted stays visible and in context while
// the user decides.
function ConfirmInline({ message, confirmLabel, onConfirm, onCancel }: ConfirmInlineProps) {
  return (
    <div className="rounded-tile border border-danger-500/30 bg-danger-50 px-3 py-2 text-2xs text-danger-700 flex items-center gap-2">
      <span className="flex-1 min-w-0">{message}</span>

      {/* type="button" on both: these strips render inside forms, and a submit
          default would fire the surrounding form instead of the handler. */}
      <button
        type="button"
        onClick={onConfirm}
        className="h-6 px-2 rounded-chip bg-danger-700 text-white text-2xs font-semibold flex-shrink-0 hover:bg-danger-700/90 transition-colors"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-2xs text-danger-700/70 hover:text-danger-700 flex-shrink-0 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export default ConfirmInline;
