"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

type DrawerWidth = "md" | "lg";

const widthClasses: Record<DrawerWidth, string> = {
  md: "max-w-[480px]",
  lg: "max-w-[640px]",
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  width?: DrawerWidth;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  width = "md",
  children,
  footer,
}: DrawerProps) {
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
                transition={{ duration: 0.2, ease: EASE_STANDARD }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed inset-y-0 right-0 z-modal flex h-full w-[calc(100vw-32px)] flex-col border-l border-hairline-strong bg-surface shadow-xl focus:outline-none",
                  widthClasses[width]
                )}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
                transition={{ duration: 0.2, ease: EASE_STANDARD }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                  <div className="min-w-0">
                    {title !== undefined ? (
                      <Dialog.Title className="text-lg font-semibold text-heading">
                        {title}
                      </Dialog.Title>
                    ) : (
                      <Dialog.Title className="sr-only">Drawer</Dialog.Title>
                    )}
                    {description ? (
                      <Dialog.Description className="mt-0.5 text-sm text-subtle">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="-mr-1 -mt-0.5 shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-ink-50 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
                    >
                      <X className="size-4.5" />
                    </button>
                  </Dialog.Close>
                </div>
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
