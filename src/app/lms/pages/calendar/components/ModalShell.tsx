"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// One modal chrome for both holiday modals: backdrop, panel motion, icon
// header, body and footer slots. AddHolidayModal and BulkHolidayModal used to
// restate ~80% of each other's markup — this shell is the single copy.
//
// Deliberately NOT the kit Modal: children are conditionally rendered inside
// AnimatePresence, so the exit animation replays the LAST render's content
// (the kit's forceMount pattern would blank the header the moment `date`
// clears). Overlay click closes; inner clicks stop propagation — identical to
// the behaviour both modals always had.
export default function ModalShell({
    open,
    onClose,
    icon,
    eyebrow,
    title,
    subtitle,
    children,
    footer,
}: {
    open: boolean
    onClose: () => void
    icon: React.ReactNode
    eyebrow: string
    title: React.ReactNode
    subtitle?: React.ReactNode
    children: React.ReactNode
    footer: React.ReactNode
}) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    onClick={onClose}
                    className="fixed inset-0 z-modal bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-md bg-surface rounded-xl border border-hairline shadow-xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-hairline flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <span className="w-9 h-9 rounded-tile bg-brand-wash flex items-center justify-center shrink-0 mt-0.5">
                                    {icon}
                                </span>
                                <div>
                                    <p className="text-2xs font-semibold uppercase tracking-wider text-faint">{eyebrow}</p>
                                    <p className="text-md font-semibold text-heading mt-0.5">{title}</p>
                                    {subtitle}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="w-7 h-7 rounded-chip border border-hairline-strong bg-surface text-subtle flex items-center justify-center hover:border-line-hover hover:text-heading transition-colors duration-150 shrink-0"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {children}

                        {/* Footer */}
                        <div className="flex items-center gap-2 px-5 py-4 border-t border-hairline bg-canvas">
                            {footer}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
