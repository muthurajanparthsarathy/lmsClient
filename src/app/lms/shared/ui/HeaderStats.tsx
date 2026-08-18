"use client"

import React from 'react'

// Shared right-aligned stat-chip strip used by every LMS listing page's
// header (Client Management, Service Mapping, Course Structure, …). Kept
// as one source of truth so the three sections stay pixel-consistent:
// same chip height, same label/value typography, same gap, same clearance
// from the shell's corner-pinned notification bell.
//
// Reference layout (do not drift from Client Management):
//   Section heading                                    CHIP · CHIP · CHIP
//
// Pages compose it inside their existing
//   <div className="flex items-start justify-between gap-4 flex-wrap">
// header row — no wrapper is imposed here so pages keep control of the
// heading side.

export interface HeaderStatItem {
    label: string
    value: React.ReactNode
}

// One pill: uppercase label + tabular-nums value, single line, subtle
// hairline outline. Matches the pattern the design system settled on.
export function HeaderStatChip({ label, value }: HeaderStatItem) {
    return (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-hairline bg-surface">
            <span className="text-2xs font-medium uppercase tracking-wide text-subtle">{label}</span>
            <span className="text-xs font-semibold text-heading tabular-nums">{value}</span>
        </span>
    )
}

// Right-aligned strip of chips. mr-8 clears the shell's corner-pinned
// NotificationBell (layout.tsx) so the last chip never sits under it.
// `loading` renders skeleton pills at the same size so the header height
// doesn't jump when data lands.
export function HeaderStats({
    items,
    loading = false,
    skeletonCount = 4,
    className = '',
}: {
    items: HeaderStatItem[]
    loading?: boolean
    // How many skeleton pills to show while loading. Match the eventual
    // item count so the header doesn't shift when data replaces them.
    skeletonCount?: number
    // Extra classes appended to the container — reserved for rare
    // page-specific tweaks. Do not use to override alignment.
    className?: string
}) {
    // flex-shrink-0 keeps the strip anchored on the right side of the header
    // row: without it, when the heading column's subtitle is long the parent
    // flex-wrap pushes the whole chip strip down onto a new line. Internal
    // flex-wrap still lets individual chips wrap onto a second row on very
    // narrow viewports as a safety fallback.
    return (
        <div className={`flex flex-shrink-0 items-center gap-2 flex-wrap mr-8 justify-end ${className}`}>
            {loading
                ? Array.from({ length: skeletonCount }).map((_, i) => (
                    <span key={i} className="h-7 w-24 rounded-full bg-ink-100 animate-pulse" />
                ))
                : items.map((it) => (
                    <HeaderStatChip key={it.label} label={it.label} value={it.value} />
                ))}
        </div>
    )
}
