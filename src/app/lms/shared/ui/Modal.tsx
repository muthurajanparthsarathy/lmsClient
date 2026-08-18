"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
  xl: "max-w-[960px]",
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
}: ModalProps) {
  const reduceMotion = useReducedMotion();

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
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-modal flex max-h-[85vh] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl focus:outline-none",
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
                  <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                    <div className="min-w-0">
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
                        <button
                          type="button"
                          aria-label="Close"
                          className="-mr-1 -mt-0.5 shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-ink-50 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
                        >
                          <X className="size-4.5" />
                        </button>
                      </Dialog.Close>
                    ) : null}
                  </div>
                ) : (
                  <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                )}
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer ? (
                  <div className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-surface px-5 py-4">
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
