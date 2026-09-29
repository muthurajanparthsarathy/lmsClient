"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'

// Section eyebrow, title and the primary action, shared by every listing page
// so the modules never drift apart. The title block and the button sit on one
// baseline: "what is this page" and "what can I do" in a single sweep.
//
// Backward-compatible: the original section/title/subtitle/actionLabel/onAction
// contract is untouched; `actions` and `statStrip` are additive slots per the
// redesign brief (extra header actions on the right, stat cards underneath).
export default function PageHeader({
    section,
    title,
    subtitle,
    actionLabel,
    onAction,
    showChevron = true,
    actions,
    statStrip,
}: {
    section: string
    title: string
    subtitle: string
    // Optional now: pass undefined for either to hide the primary action
    // button entirely (used by permission-gated callers so the button
    // disappears when the user can't run it).
    actionLabel?: string
    onAction?: () => void
    // The split-button chevron is decoration until a tab has secondary create
    // options, so it's opt-out rather than always drawn.
    showChevron?: boolean
    // Optional extra actions rendered to the left of the primary button.
    actions?: React.ReactNode
    // Optional stat strip rendered below the header row (e.g. <StatCards/>).
    statStrip?: React.ReactNode
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <nav className="flex items-center gap-1.5 text-2xs" aria-label="Breadcrumb">
                        <span className="uppercase tracking-wider text-faint">{section}</span>
                        <ChevronRight size={12} className="text-line-muted" />
                        <span className="uppercase tracking-wider text-subtle font-medium">{title}</span>
                    </nav>
                    <h1 className="mt-1.5 text-2xl font-semibold text-heading tracking-[-0.01em]">
                        {title}
                    </h1>
                    <p className="text-sm text-subtle mt-0.5">{subtitle}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {actions}
                    {actionLabel && onAction && (
                        <motion.button
                            type="button"
                            onClick={onAction}
                            whileTap={{ scale: 0.98 }}
                            className={`flex items-center gap-2 h-9 pl-3.5 ${showChevron ? 'pr-3' : 'pr-3.5'} rounded-control bg-brand-strong text-white shadow-xs hover:bg-brand-800 transition-colors duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2`}
                        >
                            <Plus size={16} strokeWidth={2.4} />
                            <span className="text-sm font-semibold">{actionLabel}</span>
                            {showChevron && (
                                <>
                                    <span className="w-px h-4 bg-white/30 ml-0.5" aria-hidden />
                                    <ChevronDown size={15} strokeWidth={2.4} className="opacity-90" />
                                </>
                            )}
                        </motion.button>
                    )}
                </div>
            </div>

            {statStrip && <div className="mt-4">{statStrip}</div>}
        </motion.div>
    )
}
