"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalBlink } from "./useModalBlink";

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
  xl: "max-w-[960px]",
  // Slightly wider than xl — the two-panel forms (Client Management,
  // Service Mapping) want ~1080px so both sides breathe without hitting
  // the 95vw ceiling on smaller laptops.
  "2xl": "max-w-[1080px]",
  full: "max-w-[95vw]",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideClose?: boolean;
  /** Visual style of the close (X) button in the header corner.
   *  - 'default' (default): transparent icon button, subtle hover.
   *  - 'danger': red circle with a white X, matches the destructive
   *    surfaces used elsewhere in the console. Kept as a variant on the
   *    kit's own button so the position stays exactly in the top-right
   *    header corner regardless of who is calling. */
  closeTone?: "default" | "danger";
  /** Shrink the header and footer padding so the body gets more room.
   *  Useful for tall multi-section modals (Client Management's Add
   *  Client accordion) where the chrome would otherwise push the second
   *  section below the fold. Defaults to false so every existing caller
   *  keeps the roomier padding. */
  compact?: boolean;
  /** Keep the modal at its full max-height regardless of how tall the
   *  content is. Useful for accordion-style modals where collapsing a
   *  section would otherwise shrink the whole modal and shift the
   *  reader's mental anchor. Defaults to false — most modals size to
   *  content. */
  stableHeight?: boolean;
  /** When false, a click on the overlay stops closing the modal and blinks the
   *  dialog instead — for forms where a stray click outside throws away typing.
   *  Escape and the close button are deliberately left working: removing every
   *  dismissal path strands keyboard users. Defaults to true, so callers that
   *  don't opt in keep click-outside-to-close. */
  dismissOnOutsideClick?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  hideClose = false,
  closeTone = "default",
  compact = false,
  stableHeight = false,
  dismissOnOutsideClick = true,
}: ModalProps) {
  const reduceMotion = useReducedMotion();
  const { ref: contentRef, blink } = useModalBlink<HTMLDivElement>();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE_STANDARD }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onPointerDownOutside={(event) => {
                if (dismissOnOutsideClick) return;
                // Radix skips its own dismiss once the event is defaulted, which
                // is what holds the modal open; the blink is what keeps that
                // from reading as a dead click.
                event.preventDefault();
                blink();
              }}
              onInteractOutside={(event) => {
                // Same guard for the focus-outside path, which can dismiss
                // without ever firing a pointer event. No blink here — a focus
                // move the user didn't aim at the overlay shouldn't flash.
                if (!dismissOnOutsideClick) event.preventDefault();
              }}
            >
              <motion.div
                ref={contentRef}
                className={cn(
                  // `max-h-[95vh]` gives tall multi-section modals (Client
                  // Management's Add Client accordion) enough vertical
                  // room that the sticky footer never sits below the fold
                  // on shorter viewports. Kept just under 100vh so browser
                  // chrome (address bar, tab strip) never overlaps the
                  // modal edge on smaller monitors.
                  //
                  // `stableHeight` swaps `max-h` for a FIXED `h` at the
                  // same cap so the modal keeps its full size regardless
                  // of content — collapsing an accordion section can
                  // never shrink the modal and yank the reader's anchor.
                  "fixed left-1/2 top-1/2 z-modal flex w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl focus:outline-none",
                  stableHeight ? "h-[95vh]" : "max-h-[95vh]",
                  sizeClasses[size]
                )}
                initial={{
                  opacity: 0,
                  scale: reduceMotion ? 1 : 0.98,
                  x: "-50%",
                  y: "-50%",
                }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{
                  opacity: 0,
                  scale: reduceMotion ? 1 : 0.98,
                  x: "-50%",
                  y: "-50%",
                }}
                transition={{ duration: 0.18, ease: EASE_STANDARD }}
              >
                {title !== undefined || !hideClose ? (
                  <div className={cn(
                    "flex items-start justify-between gap-4 border-b border-hairline",
                    compact ? "px-4 py-2.5" : "px-5 py-4"
                  )}>
                    {/* `flex-1 min-w-0` lets the title node stretch across
                          the header, so a caller passing a title component
                          with its own flex layout can push adornments
                          (badges, live clocks, extra actions) to the far
                          right just before the close button. Without this
                          the wrapper would take only content width and
                          `ml-auto` inside the title would land next to the
                          text instead of the header edge. */}
                    <div className="min-w-0 flex-1">
                      {title !== undefined ? (
                        <Dialog.Title className="text-lg font-semibold text-heading">
                          {title}
                        </Dialog.Title>
                      ) : (
                        <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                      )}
                      {description ? (
                        <Dialog.Description className="mt-0.5 text-sm text-subtle">
                          {description}
                        </Dialog.Description>
                      ) : null}
                    </div>
                    {!hideClose ? (
                      <Dialog.Close asChild>
                        {closeTone === "danger" ? (
                          <button
                            type="button"
                            aria-label="Close"
                            className="shrink-0 inline-flex size-7 items-center justify-center rounded-full bg-danger-500 text-white shadow-xs transition-colors hover:bg-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40"
                          >
                            <X className="size-3.5" strokeWidth={3} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label="Close"
                            className="-mr-1 -mt-0.5 shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-ink-50 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
                          >
                            <X className="size-4.5" />
                          </button>
                        )}
                      </Dialog.Close>
                    ) : null}
                  </div>
                ) : (
                  <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                )}
                <div className={cn(
                  "flex-1 overflow-y-auto",
                  compact ? "px-4 py-3" : "px-5 py-4"
                )}>{children}</div>
                {footer ? (
                  <div className={cn(
                    "flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-surface",
                    compact ? "px-4 py-2.5" : "px-5 py-4"
                  )}>
                    {footer}
                  </div>
                ) : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
