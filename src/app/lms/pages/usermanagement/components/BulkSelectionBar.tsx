"use client";

// The floating bulk bar — appears only after a selection.
//
// Render it OUTSIDE the animated page wrapper so its `fixed` positioning is
// viewport-relative, never trapped by the entrance transform.
//
// It is DRAGGABLE: parked at the bottom it covers the pagination, so it can be
// pulled aside instead of forcing the selection to be cleared to reach Next.
// The bar is centred by a full-viewport flex box rather than by a transform of
// its own — dragging owns the transform, and the two cannot share it. For the
// same reason the entrance animates opacity and scale but NOT y: a declarative
// `y: 0` would snap the bar home again on every re-render (each selection
// change is one).
//
// The outer box is a motion.div rather than a plain one because it is
// AnimatePresence's direct child — a plain div there would unmount at once and
// the exit would never play.

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { BULK_BAR_BTN, BULK_BAR_BTN_DANGER } from "./userManagement.constants";

export interface BulkSelectionBarProps {
  selectedCount: number;
  bulkBusy: boolean;
  canToggleStatus: boolean;
  canDelete: boolean;
  canBulkPermission: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onPermissions: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkSelectionBar({
  selectedCount, bulkBusy,
  canToggleStatus, canDelete, canBulkPermission,
  onActivate, onDeactivate, onPermissions, onExport, onDelete, onClear,
}: BulkSelectionBarProps) {
  // The viewport-sized box the bar is dragged within, so it can be pushed off
  // the pagination but never off the screen.
  const boundsRef = useRef<HTMLDivElement | null>(null);
  const disabled = !selectedCount || bulkBusy;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          ref={boundsRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="pointer-events-none fixed inset-0 z-dropdown flex items-end justify-center p-6"
        >
          <motion.div
            drag
            dragConstraints={boundsRef}
            dragMomentum={false}
            dragElastic={0.05}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="pointer-events-auto flex cursor-move touch-none select-none items-center gap-3 rounded-full bg-ink-900 py-2 pl-4 pr-2 text-white shadow-xl active:cursor-grabbing"
          >
            <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
              {selectedCount} selected
            </span>
            <span className="h-4 w-px bg-white/20" />
            <span className="flex items-center gap-1.5">
              {canToggleStatus && (
                <>
                  <button type="button" onClick={onActivate} disabled={disabled} className={BULK_BAR_BTN}>
                    Activate
                  </button>
                  <button type="button" onClick={onDeactivate} disabled={disabled} className={BULK_BAR_BTN}>
                    Deactivate
                  </button>
                </>
              )}
              {canBulkPermission && (
                <button type="button" onClick={onPermissions} disabled={disabled} className={BULK_BAR_BTN}>
                  Permissions
                </button>
              )}
              <button type="button" onClick={onExport} disabled={disabled} className={BULK_BAR_BTN}>
                Export
              </button>
              {canDelete && (
                <button type="button" onClick={onDelete} disabled={disabled} className={BULK_BAR_BTN_DANGER}>
                  Delete
                </button>
              )}
              {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/70" />}
            </span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={onClear}
              className="inline-flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X size={14} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
