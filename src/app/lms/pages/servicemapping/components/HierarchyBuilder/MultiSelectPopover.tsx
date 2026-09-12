"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { selectCls } from '../shared/primitives'

// A trigger + checkbox panel for picking many values at once. A plain multi-select
// is unusable here — the lists (departments, sections) are long and the user needs
// to see the chips they already picked while picking more. Ticks commit through
// `onToggle` immediately rather than on an Apply button, so the chips behind the
// panel stay in sync with what's checked.
export default function MultiSelectPopover({
    label,
    options,
    value,
    onToggle,
    onSelectAll,
    onClearAll,
    emptyLabel,
    filterThreshold = 8,
    labelFor,
    quickActions,
    disabled,
}: {
    label: string
    options: string[]
    value: string[]
    onToggle: (option: string) => void
    onSelectAll?: () => void
    onClearAll?: () => void
    emptyLabel: string
    filterThreshold?: number
    // Semesters store as "1" but read as "Semester 1"; the stored value and the
    // label the user sees are not always the same string.
    labelFor?: (option: string) => string
    // Shortcuts above the list (All / Odd / Even for semesters).
    quickActions?: React.ReactNode
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const wrapRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    // Where the portalled panel sits, in viewport coordinates. Null until it has
    // been measured, which is also what keeps it from painting at 0,0 for a frame.
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

    // The panel is portalled to the body, so it is NOT clipped by the accordion's
    // overflow-hidden fold container — an absolutely positioned panel inside one
    // gets cut off at the section's edge, which is exactly what this fixes.
    // Position is measured from the trigger before paint.
    useLayoutEffect(() => {
        if (!open || !wrapRef.current) return
        const r = wrapRef.current.getBoundingClientRect()
        const width = Math.max(r.width, 240)
        const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
        const below = r.bottom + 4
        // Real height once mounted; the panel is capped around this, so the
        // estimate only ever covers the very first frame.
        const height = panelRef.current?.getBoundingClientRect().height || 320
        // Flip above the trigger when the panel would run off the bottom edge.
        const top = below + height > window.innerHeight && r.top - height - 4 > 0
            ? r.top - height - 4
            : below
        setPos({ top, left, width })
    }, [open, value.length, query])

    // Only listen while the panel is open — a permanent document listener on
    // every popover in the tree would fire for every click on the page.
    useEffect(() => {
        if (!open) return
        const dismiss = () => { setOpen(false); setQuery('') }
        const onMouseDown = (e: MouseEvent) => {
            const t = e.target as Node
            // The panel lives outside wrapRef now that it is portalled, so it has
            // to be tested separately — checking the wrapper alone would treat
            // every click INSIDE the panel as a click outside and close it.
            if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
            dismiss()
        }
        // Capture phase, and the event is consumed: Escape must close this
        // popover WITHOUT also reaching the wizard modal, which closes on Escape.
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            dismiss()
        }
        // Fixed positioning does not follow the page, so scrolling closes the
        // panel rather than leaving it stranded away from its trigger.
        const onScroll = () => dismiss()
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown, true)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
        }
    }, [open])

    // The filter is per-opening, not persisted — reopening with a stale query
    // would hide options the user expects to see.
    const close = () => { setOpen(false); setQuery('') }

    const showFilter = options.length > filterThreshold
    const visible = showFilter && query.trim()
        ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
        : options

    // Nothing to choose from yet (no departments defined upstream). The trigger
    // stays visible but inert so the row keeps its shape.
    if (options.length === 0 || disabled) {
        return (
            <div className="relative block">
                <button
                    type="button"
                    disabled
                    className={`${selectCls} text-left flex items-center justify-between gap-2 opacity-60 cursor-not-allowed`}
                >
                    {label}
                    <ChevronDown size={14} />
                </button>
                {options.length === 0 && (
                    <p className="text-2xs text-faint italic mt-1">{emptyLabel}</p>
                )}
            </div>
        )
    }

    return (
        <div ref={wrapRef} className="relative block">
            <button
                type="button"
                onClick={() => (open ? close() : setOpen(true))}
                aria-expanded={open}
                className={`${selectCls} !h-auto min-h-9 py-1 text-left flex items-center justify-between gap-2`}
            >
                {/* The picks render as chips INSIDE the trigger, each with its
                    own remove — the control reads as "these are chosen" at a
                    glance instead of an opaque "3 selected". The remove is a
                    span acting as a button because a real <button> cannot nest
                    inside the trigger button. */}
                {value.length ? (
                    <span className="flex flex-wrap gap-1 min-w-0 py-0.5">
                        {value.map((v) => (
                            <span
                                key={v}
                                className="inline-flex items-center gap-0.5 h-6 pl-2 pr-1 rounded-chip border border-brand-200 bg-brand-50 text-brand-700 text-2xs font-medium"
                            >
                                {labelFor ? labelFor(v) : v}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Remove ${labelFor ? labelFor(v) : v}`}
                                    onClick={(e) => { e.stopPropagation(); onToggle(v) }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault(); e.stopPropagation(); onToggle(v)
                                        }
                                    }}
                                    className="w-4 h-4 rounded flex items-center justify-center text-brand-500 hover:text-danger-500 hover:bg-surface"
                                >
                                    <X size={11} />
                                </span>
                            </span>
                        ))}
                    </span>
                ) : (
                    <span className="text-faint">{label}</span>
                )}
                <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && pos && createPortal(
                <div
                    ref={panelRef}
                    // z-dropdown: the wizard modal sits high, and a panel that opens
                    // behind the sheet it belongs to reads as not opening at all.
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
                    className="z-dropdown rounded-xl border border-hairline bg-surface shadow-lg overflow-hidden"
                >
                    {showFilter && (
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter…"
                            className="h-9 px-3 border-b border-hairline w-full text-sm outline-none"
                        />
                    )}

                    {quickActions && (
                        <div className="px-2 py-1.5 border-b border-hairline">{quickActions}</div>
                    )}

                    <div className="max-h-64 overflow-y-auto py-1">
                        {visible.length === 0 ? (
                            <p className="px-3 py-2 text-2xs text-faint italic">No matches</p>
                        ) : (
                            visible.map((o) => (
                                <label
                                    key={o}
                                    className="h-8 px-3 flex items-center gap-2.5 text-sm hover:bg-row-hover cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 accent-brand-500"
                                        checked={value.includes(o)}
                                        onChange={() => onToggle(o)}
                                    />
                                    {labelFor ? labelFor(o) : o}
                                </label>
                            ))
                        )}
                    </div>

                    <div className="h-9 px-3 border-t border-hairline flex items-center justify-between text-2xs">
                        <span className="text-subtle tabular-nums">{value.length} selected</span>
                        <div className="flex items-center gap-3">
                            {onSelectAll && (
                                <button type="button" onClick={onSelectAll} className="text-subtle hover:text-heading transition-colors">
                                    Select all
                                </button>
                            )}
                            {onClearAll && (
                                <button type="button" onClick={onClearAll} className="text-subtle hover:text-heading transition-colors">
                                    Clear all
                                </button>
                            )}
                            <button type="button" onClick={close} className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
