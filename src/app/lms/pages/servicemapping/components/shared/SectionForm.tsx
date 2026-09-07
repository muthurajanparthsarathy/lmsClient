"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { FieldError } from './primitives'

// The Moodle-style settings kit for the service-mapping wizard's step 2:
// collapsible full-width sections, label-left field rows, and the reveal that
// opens and scrolls to the first offender after a failed save.
//
// This is a servicemapping-local sibling of what CourseSetupForm builds inline
// for Course Setup, and it is deliberately a FORK rather than an import: that
// file lives in another feature and carries a read-only mode this wizard has no
// concept of. The visual result must stay identical to it — the user chose this
// look from a screenshot of Course Setup — so any spacing or colour change made
// there should be mirrored here on purpose, not inherited by accident.
//
// Nothing here owns data. Open/closed state is the single exception, because it
// is presentation rather than form content; every value, error and mutation
// still arrives through props from page.tsx.

// Controls sit in a capped column rather than stretching to the row's full
// width — a select spanning the whole page reads as a text area.
export const CONTROL_WIDTH = 'max-w-[340px]'

/**
 * One collapsible section. Open state is the caller's (see `useSections`) so a
 * failed save can force sections open without reaching into this component.
 *
 * `tourAnchor` lands on the CONTENT wrapper, not the header: the walkthrough
 * frames the fields being explained, and WizardTour drops any step whose anchor
 * has no visible box — so a collapsed section simply skips its step instead of
 * parking a popover over a zero-size rect.
 */
export function Section({
    title,
    required,
    open,
    onToggle,
    tourAnchor,
    headerAside,
    children,
}: {
    title: string
    required?: boolean
    open: boolean
    onToggle: () => void
    tourAnchor?: string
    // Rendered beside the title, OUTSIDE the toggle button — a checkbox or any
    // other control nested inside a <button> is invalid HTML and has its click
    // swallowed by the button. Use it for state that must stay readable and
    // changeable while the section is folded.
    headerAside?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <section>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="flex items-center gap-2 py-3.5 text-left group"
                >
                    <ChevronRight
                        size={18}
                        strokeWidth={3}
                        className={`text-brand-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                    <span className="text-lg font-semibold text-heading group-hover:text-brand-700 transition-colors">
                        {title}
                    </span>
                    {required && <span className="text-brand-700 text-lg font-semibold" title="Required">*</span>}
                </button>
                {headerAside}
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        // Clipping is what makes the height animation read as a
                        // fold; nothing inside needs to escape this box.
                        className="overflow-hidden"
                    >
                        {/* Unlike CourseSetupForm there is no <fieldset disabled>
                            wrapper — this wizard has no view mode, and a disabled
                            fieldset would kill the Add/Remove buttons the step
                            depends on. min-w-0 stays: it stops a wide child (a
                            long batch list, a chip row) from forcing the section
                            past its column when this sits in a grid or flex. */}
                        <div data-tour={tourAnchor} className="min-w-0 pl-6 pb-5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}

/**
 * A section nested INSIDE a `Section` — same fold, one level down in the
 * hierarchy and in the type scale, with its content indented so the nesting is
 * visible rather than merely implied.
 *
 * It exists because a phase is not a flat list of fields: it carries a course
 * name AND a batch group, and rendering the batch group as more sibling rows
 * made a phase read as eight unrelated questions. Folding it behind its own
 * arrow means a phase collapses to one line and opens to two ideas.
 *
 * `summary` rides in the header so a FOLDED sub-section still reports its state
 * — without it, "Batches" closed is indistinguishable from "Batches" empty, and
 * on this form closed also means OFF, which the user must never have to guess.
 */
export function SubSection({
    title,
    summary,
    open,
    onToggle,
    checked,
    onCheckedChange,
    children,
}: {
    title: string
    summary?: string
    open: boolean
    onToggle: () => void
    // When both are supplied the header carries a checkbox beside its title, and
    // the sub-section becomes opt-in: the arrow still only folds, the checkbox is
    // what commits. Keeping them separate is deliberate — a fold that writes form
    // data means a user tidying the view silently changes what gets saved.
    checked?: boolean
    onCheckedChange?: (on: boolean) => void
    children: React.ReactNode
}) {
    const optIn = typeof checked === 'boolean' && Boolean(onCheckedChange)
    return (
        <section className="py-1">
            {/* A row rather than one wide button: a checkbox cannot live inside a
                <button> (nested interactive content is invalid and swallows the
                click), so the arrow owns its own button and the checkbox sits
                beside it under its own <label>. */}
            <div className="flex items-center gap-1.5 py-2">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
                    className="flex items-center group flex-shrink-0"
                >
                    <ChevronRight
                        size={15}
                        strokeWidth={3}
                        className={`text-brand-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                </button>
                {optIn ? (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => onCheckedChange?.(e.target.checked)}
                            className="w-4 h-4 accent-brand-500"
                        />
                        <span className="text-base font-semibold text-heading group-hover:text-brand-700 transition-colors">
                            {title}
                        </span>
                    </label>
                ) : (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="text-base font-semibold text-heading hover:text-brand-700 transition-colors text-left"
                    >
                        {title}
                    </button>
                )}
                {summary && (
                    <span className="text-xs font-medium text-faint">{summary}</span>
                )}
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {/* The left rule is what carries the nesting at a glance:
                            indentation alone gets lost once a phase is scrolled
                            and its header is off screen. */}
                        <div className="min-w-0 pl-4 ml-[6px] border-l border-hairline">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}

/**
 * One Moodle row: label in a fixed left column (right-aligned on desktop,
 * stacked above the control on small screens), control on the right.
 *
 * `data-error-anchor` is present only while the row is failing, so the reveal
 * can find the FIRST offender with a single DOM-order query — an always-present
 * attribute would make every query return the top row of the form.
 *
 * Errors render through the wizard's existing `FieldError` rather than a second
 * style local to this kit: step 1 and the batch cards already use it, and two
 * different error treatments in one modal read as a bug.
 */
export function FieldRow({
    label,
    required,
    tooltip,
    error,
    hint,
    children,
}: {
    label: string
    required?: boolean
    tooltip?: string
    error?: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <div
            data-error-anchor={error ? 'true' : undefined}
            className="py-2.5 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-x-6 md:items-start"
        >
            {/* Labels are LEFT-aligned so every first letter lines up in one column
                ("Phases", "No. of phases", "Phase 1" all start at the same x);
                right-aligning them lined up their ends and left the starts ragged. */}
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-0 md:justify-start md:pt-2">
                <span className="text-sm font-medium text-heading md:text-left">{label}</span>
                {required && <span className="text-brand-700 font-semibold" title="Required">*</span>}
                {tooltip && <InfoTooltip content={tooltip} />}
            </div>
            <div className="min-w-0">
                {children}
                {hint && <p className="text-xs text-faint mt-1">{hint}</p>}
                {error && (
                    <div className="mt-1">
                        <FieldError message={error} />
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * The outer wrapper for a set of `Section`s: the expand/collapse-all control and
 * the hairline divider stack.
 *
 * It takes no ref by design. `useErrorReveal` needs a root to query anchors
 * under, and any ancestor will do — so the caller keeps that ref on whatever
 * element it already owns instead of this kit dictating the DOM above it.
 */
export function SectionShell({
    children,
    allOpen,
    onToggleAll,
}: {
    children: React.ReactNode
    allOpen: boolean
    onToggleAll: () => void
}) {
    return (
        <div className="font-sans">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={onToggleAll}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
                >
                    {allOpen ? 'Collapse all' : 'Expand all'}
                </button>
            </div>

            <div className="divide-y divide-hairline">{children}</div>
        </div>
    )
}

/**
 * Open/closed state for a fixed set of section ids.
 *
 * `initial` seeds the state once and is ignored afterwards — it is a starting
 * layout, not a controlled value, so a parent re-render can never slam a section
 * shut while the user is typing in it.
 */
export function useSections<K extends string>(initial: Record<K, boolean>) {
    const [open, setOpen] = useState<Record<K, boolean>>(initial)

    const allOpen = (Object.keys(open) as K[]).every((id) => open[id])

    const toggle = useCallback(
        (id: K) => () =>
            setOpen((prev) => {
                const next = { ...prev }
                next[id] = !prev[id]
                return next
            }),
        []
    )

    const toggleAll = useCallback(() => {
        setOpen((prev) => {
            // The direction is decided from `prev`, not from the rendered
            // `allOpen`: a reveal may have opened sections in the same batch, and
            // reading the stale value would flip the button's meaning.
            const to = !(Object.keys(prev) as K[]).every((id) => prev[id])
            const next = { ...prev }
            for (const id of Object.keys(prev) as K[]) next[id] = to
            return next
        })
    }, [])

    return { open, toggle, allOpen, toggleAll, setOpen }
}

/**
 * The failed-save reveal: open every section holding an error, then scroll to
 * and focus the first failing row.
 *
 * `activeErrorKeys` is a getter rather than a value so the effect can read the
 * errors at the moment it runs — see the deps note below for why that matters.
 *
 * `rootRef` accepts a nullable ref because that is what `useRef<T>(null)` now
 * produces under React 19's types; typing it `RefObject<HTMLElement>` would force
 * every call site to write a cast.
 */
export function useErrorReveal<K extends string>({
    sectionErrorKeys,
    activeErrorKeys,
    setOpen,
    rootRef,
}: {
    sectionErrorKeys: Record<K, string[]>
    activeErrorKeys: () => string[]
    setOpen: React.Dispatch<React.SetStateAction<Record<K, boolean>>>
    rootRef: React.RefObject<HTMLElement | null>
}): { reveal: () => void } {
    // A counter rather than doing the work inside reveal(): the caller invokes it
    // in the same event that SETS the errors, so at that instant this hook has
    // not seen them yet. Bumping state defers the work to the next render, where
    // the new errors and the tick land together in one batch.
    const [tick, setTick] = useState(0)

    // The caller's map and getter are mirrored into a ref so the effect below can
    // read the CURRENT ones without listing them as dependencies. That indirection
    // is the whole trick: it is what lets the deps stay narrow while still seeing
    // fresh errors, so no eslint-disable is needed to express the intent.
    const latest = useRef({ sectionErrorKeys, activeErrorKeys })
    useEffect(() => {
        latest.current = { sectionErrorKeys, activeErrorKeys }
    })

    useEffect(() => {
        if (tick === 0) return
        const { sectionErrorKeys: map, activeErrorKeys: read } = latest.current
        const active = new Set(read())
        if (active.size === 0) return

        setOpen((prev) => {
            const next = { ...prev }
            for (const id of Object.keys(map) as K[]) {
                if (map[id].some((k) => active.has(k))) next[id] = true
            }
            return next
        })

        // The scroll waits out the 0.2s fold: scrolling to a child of a container
        // still animating from height 0 lands on a stale position.
        const timer = setTimeout(() => {
            const anchor = rootRef.current?.querySelector<HTMLElement>('[data-error-anchor]')
            if (!anchor) return
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
            anchor.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus({ preventScroll: true })
        }, 240)
        return () => clearTimeout(timer)
        // The errors are deliberately NOT dependencies — the reveal must fire once
        // per failed save, not again every time the user fixes a field, which
        // would yank the page back to the top offender mid-typing. `setOpen` and
        // `rootRef` are listed only to satisfy exhaustive-deps; both are stable
        // (useState setter, useRef object) so neither can re-trigger this.
    }, [tick, setOpen, rootRef])

    const reveal = useCallback(() => setTick((t) => t + 1), [])

    // Stable identity, so a caller can park this in a dep array or assign it to a
    // ref in an effect without that effect re-running every render.
    return useMemo(() => ({ reveal }), [reveal])
}
