'use client'

// The wizard's dropdown.
// ─────────────────────────────────────────────────────────────────────────────
// A native <select> renders the OS menu — a grey system list that ignores the
// console's type, radii and colours, and looks nothing like the client picker in
// Step 1. This is the same shape as that picker (ClientCombobox in page.tsx): a
// button trigger, an animated panel, a search box once the list is long enough
// to need one, and a tick on the current choice.
//
// Replacing a native control means re-earning what it gave away for free, so the
// keyboard still works: ↓ opens, ↑/↓ move (skipping disabled rows), Enter picks,
// Escape closes, and the list is a real listbox to assistive tech.
//
// It started life as the Step 2 course picker and was generalised the moment a
// second field wanted the same thing. Hence `options` carrying a label and a
// disabled flag rather than plain strings: the year field shows a stored PAST
// year as a visible-but-unpickable row, which a string list cannot express.
//
// The panel is PORTALLED to the body and positioned fixed, for the same reason
// MultiSelectPopover and SemesterSelect are. Step 2 is a stack of accordion
// cards, and Section's fold container is `overflow-hidden` — that clipping is
// what makes the height animation read as a fold — so an absolutely positioned
// panel, which is what this used to be, got sliced off at the card's edge and
// the options looked like they were opening INSIDE the card. The modal shell
// clips as well, and each step animates on a transform, which would re-anchor a
// plain `fixed` panel to the step rather than the viewport. Portalling escapes
// all three at once.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// Local copy of the wizard's own walk (page.tsx) rather than an import: this
// component sits UNDER page.tsx in the tree, and reaching back up for a helper
// would tie a leaf to the screen that renders it.
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement || null
    while (node) {
        const oy = getComputedStyle(node).overflowY
        if (oy === 'auto' || oy === 'scroll') return node
        node = node.parentElement
    }
    return null
}

export type ListSelectOption = {
    value: string
    label: string
    /** Rendered, but not pickable — a row the user must SEE and cannot choose. */
    disabled?: boolean
}

// Where the portalled panel sits, in viewport coordinates. A downward menu is
// pinned by its top edge and an upward one by its bottom, so the flip does not
// depend on knowing the panel's height before it has been rendered.
type PanelPos = { left: number; width: number; top?: number; bottom?: number }

// Trigger-to-panel gap — the mt-1.5/mb-1.5 this carried back when the panel was
// a sibling of the trigger rather than a portal.
const GAP = 6

export function ListSelect({
    id,
    value,
    options,
    onChange,
    placeholder,
    emptyLabel,
    ariaLabel,
    searchPlaceholder = 'Search…',
    searchThreshold = 8,
    listMaxHeight,
    invalid,
    disabled,
    title,
    className,
}: {
    id?: string
    value: string
    options: ListSelectOption[]
    onChange: (next: string) => void
    /** Shown on the trigger while nothing is chosen. */
    placeholder: string
    /** Shown inside the panel when there is nothing to offer at all. */
    emptyLabel: string
    ariaLabel: string
    searchPlaceholder?: string
    /** Below this many options a search box is just another thing to look at. */
    searchThreshold?: number
    /**
     * Caps how tall the option list may grow, in px (default 240). Lower it for
     * a long catalogue that should stay a short scrolling list rather than a
     * panel covering the fields under it — the room available is still the other
     * limit, so this only ever makes the list shorter, never taller.
     */
    listMaxHeight?: number
    invalid?: boolean
    /** Closed: the value shows, the menu never opens. */
    disabled?: boolean
    /** Hover text on the trigger — e.g. why a closed field is closed. */
    title?: string
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    // Which option the keyboard is on. Index into `filtered`, never into
    // `options` — the two differ the moment anything is typed.
    const [active, setActive] = useState(0)
    // Open upward when there is no room below (a field low in a scrolling modal),
    // and size the list to the room the chosen direction leaves.
    const [dropUp, setDropUp] = useState(false)
    const [listMaxH, setListMaxH] = useState(224)
    const [pos, setPos] = useState<PanelPos | null>(null)
    // createPortal needs a document, which the first server render has not got.
    // Gating the portal on this rather than on `open` keeps AnimatePresence
    // mounted across the close, so the panel still animates out.
    const [mounted, setMounted] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setMounted(true) }, [])

    const searchable = options.length > searchThreshold
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
    }, [options, query])

    const selected = options.find((o) => o.value === value)

    // Direction, height and viewport position in one pass, so opening and
    // re-measuring after a scroll can never disagree about where the panel goes.
    const measure = useCallback(() => {
        const el = boxRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        // Measure the ROOM against the scroll container (the modal body), not
        // the viewport — the modal ends well above the window bottom, so the
        // viewport would overstate the room below and let the panel hang out
        // past the sheet it belongs to.
        const scrollParent = getScrollParent(el)
        const bounds = scrollParent
            ? scrollParent.getBoundingClientRect()
            : ({ top: 0, bottom: window.innerHeight } as DOMRect)
        // Scrolled past its own trigger: the panel would be left floating over
        // the header or the footer, pointing at a field that is no longer on
        // screen. Close instead of tracking something the user cannot see.
        if (rect.bottom < bounds.top + 4 || rect.top > bounds.bottom - 4) {
            setOpen(false)
            return
        }
        const spaceBelow = bounds.bottom - rect.bottom
        const spaceAbove = rect.top - bounds.top
        // DOWN is the default, and the bar for overriding it is deliberately
        // low. The old test flipped upward whenever there was less than 260px
        // below — but the list sizes itself to whatever room it gets (down to
        // 120px and scrolling inside that), so 200px below is a perfectly
        // usable menu. All that test achieved was sending fields in the upper
        // half of the modal the wrong way, away from the control the user had
        // just clicked. Now it flips only when the room below genuinely
        // cannot hold the smallest useful list AND above is materially
        // roomier — a field sitting at the very bottom of the pane.
        const MIN_USABLE = 150
        const up = spaceBelow < MIN_USABLE && spaceAbove > spaceBelow + 60
        const room = (up ? spaceAbove : spaceBelow) - (searchable ? 76 : 24)
        setDropUp(up)
        // Two limits: the caller's cap and the room actually available. 120 is a
        // floor under the second one only — a cramped field still gets a usable
        // list and overhangs a little — so a cap BELOW it is still honoured
        // rather than being quietly raised back to 120.
        const cap = listMaxHeight ?? 240
        setListMaxH(Math.max(Math.min(120, cap), Math.min(cap, room)))
        // As wide as the trigger, nudged back on screen when the trigger sits
        // hard against an edge.
        const width = rect.width
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
        setPos(up
            ? { left, width, bottom: window.innerHeight - rect.top + GAP }
            : { left, width, top: rect.bottom + GAP })
    }, [searchable, listMaxHeight])

    const openMenu = () => {
        measure()
        // Land on the current choice so ↑/↓ start from where the user is.
        const at = filtered.findIndex((o) => o.value === value && !o.disabled)
        setActive(at >= 0 ? at : Math.max(0, filtered.findIndex((o) => !o.disabled)))
        setOpen(true)
    }

    const select = (next: string) => {
        onChange(next)
        setOpen(false)
        triggerRef.current?.focus()
    }

    // A fixed panel does not travel with the page, so it is re-pinned to the
    // trigger on every scroll and resize. The sibling popovers CLOSE on scroll
    // instead, which also shuts them when the user scrolls the option list
    // itself — a capture-phase scroll listener fires for inner scrollers too.
    // Following the trigger has neither problem.
    //
    // Plain useEffect, not useLayoutEffect: this only registers listeners. The
    // FIRST position is measured synchronously in openMenu, inside the click
    // handler, so the panel has its coordinates before it ever paints.
    useEffect(() => {
        if (!open) return
        let frame = 0
        const track = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(measure)
        }
        window.addEventListener('scroll', track, true)
        window.addEventListener('resize', track)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('scroll', track, true)
            window.removeEventListener('resize', track)
        }
    }, [open, measure])

    // Close on outside click, exactly as the client picker does. The panel lives
    // OUTSIDE boxRef now that it is portalled, so it has to be tested on its
    // own — checking the wrapper alone would read every click on an option as a
    // click outside and close the menu before the pick landed.
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node
            if (boxRef.current?.contains(t) || panelRef.current?.contains(t)) return
            setOpen(false)
        }
        window.addEventListener('mousedown', onDown)
        return () => window.removeEventListener('mousedown', onDown)
    }, [open])

    // Escape closes the MENU and nothing else. The wizard modal closes on
    // Escape from its own window listener, so an un-stopped key press took the
    // whole form down with the dropdown — capture it first and consume it, the
    // same guard MultiSelectPopover and SemesterSelect already carry.
    useEffect(() => {
        if (!open) return
        const onEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            setOpen(false)
            triggerRef.current?.focus()
        }
        document.addEventListener('keydown', onEscape, true)
        return () => document.removeEventListener('keydown', onEscape, true)
    }, [open])

    useEffect(() => { if (!open) setQuery('') }, [open])
    // A fresh filter invalidates the cursor: index 3 of the old list is not
    // index 3 of the new one.
    useEffect(() => { setActive(0) }, [query])

    // Keep the keyboard cursor in view without scrolling the modal behind it.
    useEffect(() => {
        if (!open) return
        listRef.current
            ?.querySelector<HTMLElement>('[data-active="true"]')
            ?.scrollIntoView({ block: 'nearest' })
    }, [active, open])

    // Arrow keys step over disabled rows rather than landing on one and going
    // quiet — a cursor you cannot act on reads as a broken list.
    const move = (dir: 1 | -1) => setActive((cur) => {
        for (let i = cur + dir; i >= 0 && i < filtered.length; i += dir) {
            if (!filtered[i].disabled) return i
        }
        return cur
    })

    // Escape is taken by the capture listener above, so it never reaches here.
    // Everything else still rides the React tree, which a portal does NOT break:
    // the search box and the option rows are React children of this wrapper
    // however far away the browser puts them, so their keys land in this handler.
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'ArrowDown') { e.preventDefault(); openMenu() }
            return
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
        else if (e.key === 'Enter') {
            e.preventDefault()
            const pick = filtered[active]
            if (pick && !pick.disabled) select(pick.value)
        }
    }

    return (
        <div ref={boxRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                onClick={() => (open ? setOpen(false) : openMenu())}
                disabled={disabled}
                title={title}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                className={cn(
                    'flex h-9 w-full items-center gap-2 rounded-control border bg-surface px-2.5 text-left',
                    'outline-none transition-colors',
                    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-faint',
                    invalid
                        ? 'border-danger-500'
                        : open
                            ? 'border-brand-500 ring-2 ring-brand-500/15'
                            : 'border-hairline-strong hover:border-line-hover disabled:hover:border-hairline-strong'
                )}
            >
                <span className={cn('flex-1 truncate text-sm', selected && !disabled ? 'text-body' : 'text-faint')}>
                    {selected?.label || placeholder}
                </span>
                <ChevronDown
                    size={15}
                    className={cn('flex-shrink-0 text-faint transition-transform', open && 'rotate-180')}
                />
            </button>

            {/* Portalled, so no accordion fold and no modal edge can clip it. */}
            {mounted && createPortal(
                <AnimatePresence>
                    {open && pos && (
                        <motion.div
                            ref={panelRef}
                            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.99 }}
                            transition={{ duration: 0.12 }}
                            // Pinned in viewport coordinates by whichever edge the
                            // flip chose; `width` comes from the trigger, so the
                            // panel still lines up with the control it belongs to.
                            style={{
                                position: 'fixed',
                                left: pos.left,
                                width: pos.width,
                                top: pos.top,
                                bottom: pos.bottom,
                            }}
                            // z-dropdown, not the old z-50: the wizard modal's own
                            // overlay is z-50, and a panel level with the sheet it
                            // belongs to is a coin toss over which one paints first.
                            className="z-dropdown overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg"
                        >
                            {searchable && (
                                <div className="border-b border-hairline p-2">
                                    <div className="relative">
                                        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder={searchPlaceholder}
                                            className="h-9 w-full rounded-control border border-hairline-strong pl-8 pr-2 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    </div>
                                </div>
                            )}
                            <div
                                ref={listRef}
                                role="listbox"
                                aria-label={ariaLabel}
                                className="overflow-y-auto py-1"
                                style={{ maxHeight: listMaxH }}
                            >
                                {filtered.length === 0 ? (
                                    <p className="py-5 text-center text-2xs text-faint">
                                        {options.length === 0 ? emptyLabel : 'Nothing matches that.'}
                                    </p>
                                ) : (
                                    filtered.map((option, i) => {
                                        const isSel = option.value === value
                                        if (option.disabled) {
                                            return (
                                                <div
                                                    key={option.value}
                                                    role="option"
                                                    aria-selected={isSel}
                                                    aria-disabled
                                                    className="flex cursor-not-allowed items-center gap-2 px-3 py-2 text-sm text-faint"
                                                >
                                                    <span className="flex-1 truncate">{option.label}</span>
                                                </div>
                                            )
                                        }
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSel}
                                                data-active={i === active ? 'true' : undefined}
                                                onMouseEnter={() => setActive(i)}
                                                onClick={() => select(option.value)}
                                                className={cn(
                                                    'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                                                    isSel ? 'bg-brand-wash' : i === active ? 'bg-row-hover' : ''
                                                )}
                                            >
                                                <span className={cn(
                                                    'flex-1 truncate text-sm',
                                                    isSel ? 'font-semibold text-brand-700' : 'font-medium text-body'
                                                )}>
                                                    {option.label}
                                                </span>
                                                {isSel && <Check size={13} className="flex-shrink-0 text-brand-700" />}
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
