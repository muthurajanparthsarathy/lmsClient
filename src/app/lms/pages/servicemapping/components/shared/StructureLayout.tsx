'use client'

// The Structure & course presentation, in one place.
// ─────────────────────────────────────────────────────────────────────────────
// Step 2 asks the same two questions in every service — what is delivered, and
// to which batches — but each flow had grown its own answer to how that should
// LOOK: the placement step in outlined cards, the flat models in a label-column
// form, the degree workbench in dense inline rows. Same wizard, three layouts.
//
// These are the shared pieces, so the arrangement is a property of the step
// rather than of whichever component happens to render it:
//
//   structureCardCls   the thin outlined container a course block sits in
//   StructureSplit     course on the left, batches on the right, batch names
//                      under the batches column
//   StructureField     label on the left, its control directly to the right
//
// They are LAYOUT ONLY. Every field, option, handler, validation key and display
// condition stays with the flow that owns it — these components take children
// and place them.

import React from 'react'
import { ChevronRight } from 'lucide-react'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { cn } from '@/lib/utils'
import { FieldError } from './primitives'

/**
 * The expand/collapse control on every folding heading in the wizard — Degree,
 * Department, Phase 1, and the rest.
 *
 * One chevron that TURNS rather than two glyphs that swap: the rotation is the
 * open/close gesture itself. The ring around it is what makes a 14px arrow read
 * as a control rather than as punctuation before the title, and it is blue
 * because it belongs to the fold, not to the brand's primary actions — an orange
 * arrow beside every heading competed with the step's real orange, the buttons
 * that commit.
 *
 * `group-hover` here needs a `group` on the button that owns the heading; every
 * call site has one.
 */
export function FoldChevron({
    open,
    size = 'md',
}: {
    open: boolean
    /** `sm` for a fold nested inside another fold. */
    size?: 'sm' | 'md'
}) {
    return (
        <span
            className={cn(
                'flex flex-shrink-0 items-center justify-center rounded-full border border-info-500/40',
                'text-info-700 transition-colors group-hover:border-info-500',
                size === 'sm' ? 'size-5' : 'size-6'
            )}
        >
            <ChevronRight
                size={size === 'sm' ? 12 : 14}
                strokeWidth={3}
                className={cn('transition-transform duration-200', open && 'rotate-90')}
            />
        </span>
    )
}

/** The outlined container one course (and its batches) lives in. */
export const structureCardCls = 'rounded-tile border border-info-500/40 bg-surface'

/** Field labels across the step. */
export const structureLabelCls = 'text-sm font-medium text-heading'

/** The control column beside a label. ONE width for every field on the step, so
 *  a dropdown and a text box in the same card end on the same right edge. Wide
 *  enough for a course name, narrow enough that two of them still share a row. */
export const structureControlWidth = 'w-[240px]'

/** The label column. Fixed, so stacked fields — or fields that WRAP to stack on
 *  a narrow card — start their controls at the same x however long the words
 *  are: "Course category" is wider than "Course name", and ragged control edges
 *  are the first thing you see in a column of them.
 *
 *  Sized for the longest label on the step PLUS its asterisk and info icon, all
 *  of which share this box: at 132 "Course category" had nowhere to put the icon
 *  and broke across two lines. */
export const structureLabelWidth = 'w-[152px]'

/**
 * The batch-name fields: as many ~160px columns as the space beside the course
 * block allows, so they stay readable whether the modal is wide or the grid is
 * nested in the right-hand column.
 */
export const batchNameGridCls = 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-3'

/**
 * Three stacked rows: the course fields side by side, then the batches opt-in
 * and its count, then the batch names.
 *
 * This replaced a two-column split (course left, batches right). The split kept
 * running out of room — a label, a picker, a checkbox, a count label and a count
 * box on ONE line only fit at the widest modal size, and below that the checkbox
 * dropped to a line of its own anyway, which is the ragged version of the same
 * layout. Stacking says it on purpose, and gives every row the full card width:
 * the course fields sit together because they answer one question, and the batch
 * names land directly under the checkbox that governs them because both start at
 * the same edge.
 */
export function StructureRows({
    course,
    batches,
    batchNames,
    className,
}: {
    /** The flow's own course fields — one row, side by side. */
    course: React.ReactNode
    /** The batches opt-in and, once on, its count. */
    batches: React.ReactNode
    batchNames?: React.ReactNode
    className?: string
}) {
    // Uneven spacing on purpose. The gap above Batches is the wider one: it
    // separates two different questions — what is delivered, and who takes it —
    // and at an even rhythm the three rows read as one undifferentiated list.
    // The batch names stay tight under the checkbox that governs them.
    return (
        <div className={className}>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2.5">{course}</div>
            <div className="mt-5 flex flex-wrap items-center gap-3">{batches}</div>
            {batchNames && <div className="mt-3">{batchNames}</div>}
        </div>
    )
}

/**
 * One labelled control: label left, control directly to its right.
 *
 * The control sits in a FIXED-width box and the error wraps inside it. On an
 * auto-sized column a long message ("This course is already used by another
 * phase") would widen the column and drag whatever sits beside it sideways.
 */
export function StructureField({
    label,
    id,
    required,
    error,
    tooltip,
    controlClass,
    children,
}: {
    label: string
    /** Points the label at the control, where the control can carry an id. */
    id?: string
    required?: boolean
    error?: string
    tooltip?: string
    /** Overrides the control column width for a field that needs more room. */
    controlClass?: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label htmlFor={id} className={cn(structureLabelCls, 'flex shrink-0 items-center gap-1.5', structureLabelWidth)}>
                {/* nowrap as well as a width: the column is sized for today's
                    longest label, and a longer one added later should push its
                    icon along rather than silently break in half. */}
                <span className="whitespace-nowrap">
                    {label}
                    {required && <span className="ml-0.5 text-brand-700" title="Required">*</span>}
                </span>
                {tooltip && <InfoTooltip content={tooltip} />}
            </label>
            <div
                className={cn('shrink-0', controlClass || structureControlWidth)}
                data-error-anchor={error ? 'true' : undefined}
            >
                {children}
                {error && <div className="mt-1"><FieldError message={error} /></div>}
            </div>
        </div>
    )
}

/**
 * A batch-name field: its label above the input, as the reference layout has
 * them. The anchor is per field, so a failed save scrolls to the batch that is
 * actually wrong rather than to the top of the list.
 */
export function BatchNameField({
    label,
    id,
    error,
    children,
}: {
    label: string
    id?: string
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="min-w-0" data-error-anchor={error ? 'true' : undefined}>
            <label htmlFor={id} className={structureLabelCls}>
                {label}
                <span className="ml-0.5 text-brand-700" title="Required">*</span>
            </label>
            <div className="mt-1.5">{children}</div>
            {error && <div className="mt-1"><FieldError message={error} /></div>}
        </div>
    )
}
