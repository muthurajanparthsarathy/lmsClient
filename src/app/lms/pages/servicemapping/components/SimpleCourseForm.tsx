"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { FieldError, inputCls, selectCls, errorFieldCls } from './shared/primitives'
import { CONTROL_WIDTH, FieldRow, useErrorReveal } from './shared/SectionForm'
import type { CourseEntry } from './HierarchyBuilder/types'

// "1st batch name", "2nd batch name", … placeholders for the per-batch inputs,
// used only when there is no year to suggest a better name from.
const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

// Ticking Batches starts at TWO. These engagements run parallel groups by
// default, so seeding one would just mean an extra click to add the second. The
// wizard imports this for a fresh mapping's initial state, so the number the
// checkbox writes and the number a new mapping opens with cannot drift apart.
export const DEFAULT_BATCH_COUNT = 2

// Step 2 for the flat flows: one course, then the batches that sit it.
//
// This is what DIV renders with "Degree based structure" OFF, and what the B2B
// family (CSR, COE, HTD, TD) renders always. It is deliberately model-agnostic —
// nothing here asks which service model it is serving, because every one of them
// answers the same two questions. The wizard decides when to mount it.
//
// The rows are FLAT — no accordion. Between them these models ask four
// questions, and folding four rows behind two collapsible headers meant the step
// opened as chrome with the fields hidden inside it. The shape now matches the
// Placement step's no-phases branch exactly (same inset, same label column,
// same Enable-batches checkbox), so the two non-degree flows read as one form.
//
// The order is Course then Batches, and it matters: what is being delivered
// comes before who sits it. The guided tour walks the same order
// (sm-courses → sm-batchcount → sm-batch-names), so reordering the rows would
// silently reorder the walkthrough with them. With batches off the last two
// anchors have no box on screen and WizardTour drops their steps.
//
// This component owns NO DATA — the same rule HierarchyBuilder documents. Every
// value and every mutation arrives through props.
//
// The error keys it reads ('courseCategory-0', 'courseName-0', 'batch-<i>') are
// the ones the wizard's validation writes. They are a shared vocabulary:
// renaming one here without renaming it in validateStep2 leaves a field that can
// fail but never shows why.

// The sentinel the name picker uses for "Others". It is not a course name, so it
// can never collide with a real option.
const CUSTOM_NAME = '__custom'

// There are no collapsible sections left to open, so the reveal has nothing to
// expand — it still scrolls to and focuses the first `data-error-anchor`, which
// is the half of it that matters on a form where every field is always visible.
const NO_SECTIONS: Record<string, string[]> = {}

export type SimpleCourseFormProps = {
    // ── Course ───────────────────────────────────────────────────────────────
    // The single course this mapping delivers — `courses[0]` in the wizard.
    // Optional because the caller indexes into a list; a missing entry renders
    // as empty rather than throwing.
    course: CourseEntry | undefined
    // Master categories from Course Management. Only the two fields read here
    // are required, so the wizard's fuller CourseCategory satisfies this as-is.
    categoryOptions: { _id: string; categoryName: string }[]
    // Course names configured under a category — the name list is filtered by
    // the chosen category, which is why changing the category clears the name.
    courseNamesFor: (category: string) => string[]
    onCourseChange: (patch: Partial<CourseEntry>) => void

    // ── Batches ──────────────────────────────────────────────────────────────
    // ZERO means the Enable-batches checkbox is off. The count IS the enabled
    // state — there is no second flag that could drift out of step with it, and
    // a mapping saved at zero reopens with the checkbox unticked.
    batchCount: number
    // Receives NaN while the number field is mid-retype (an empty input parses
    // to NaN), so the handler must clamp rather than trust the value.
    onBatchCount: (count: number) => void
    batchNames: string[]
    onBatchName: (index: number, value: string) => void
    // Seeds each batch name's placeholder, e.g. "e.g. 2026 Batch 1".
    yearHint: string

    // ── Validation ───────────────────────────────────────────────────────────
    // The wizard's whole message map, not a filtered slice: the failed-save
    // reveal needs to see which keys are active, not just their text.
    fieldErrors: Record<string, string>
    clearFieldError: (key: string) => void
    // Assigned on mount. The wizard calls it after a failed Next to scroll to
    // the first offender.
    revealErrorsRef: React.MutableRefObject<(() => void) | null>
}

export default function SimpleCourseForm({
    course,
    categoryOptions,
    courseNamesFor,
    onCourseChange,
    batchCount,
    onBatchCount,
    batchNames,
    onBatchName,
    yearHint,
    fieldErrors,
    clearFieldError,
    revealErrorsRef,
}: SimpleCourseFormProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    // Kept only to satisfy useErrorReveal's contract; with no sections to fold
    // this state is never read, and the setter it hands over is a no-op against
    // the empty map above.
    const [, setOpen] = useState<Record<string, boolean>>({})

    const category = course?.category || ''
    const courseName = course?.courseName || ''
    const names = courseNamesFor(category)
    const categoryError = fieldErrors['courseCategory-0']
    const nameError = fieldErrors['courseName-0']

    const batchesOn = batchCount > 0

    const { reveal } = useErrorReveal<string>({
        sectionErrorKeys: NO_SECTIONS,
        // A getter, not a precomputed array: the reveal runs one render after the
        // wizard sets the errors, and must read them as they are at that moment.
        activeErrorKeys: () => Object.keys(fieldErrors).filter((k) => fieldErrors[k]),
        setOpen,
        rootRef,
    })

    useEffect(() => {
        revealErrorsRef.current = reveal
        return () => { revealErrorsRef.current = null }
    }, [revealErrorsRef, reveal])

    const indices = Array.from({ length: batchCount }, (_, i) => i)

    return (
        // Same inset and horizontal padding as PlacementForm's root, so every
        // label in both non-degree steps starts on the same x.
        <div ref={rootRef} className="space-y-1 px-1 md:ml-[70px]">
            <div data-tour="sm-courses">
                <FieldRow
                    label="Course category"
                    required
                    tooltip="Choose the category first; it filters which course names the next field offers"
                    error={categoryError}
                >
                    {/* aria-label on every control: FieldRow's label is a
                        plain span, not a <label for>, so the accessible name
                        has to come from the control itself. */}
                    <div className={CONTROL_WIDTH}>
                        <select
                            value={category}
                            onChange={(e) => {
                                // The name list is filtered by category, so a
                                // category change resets the name and clears
                                // BOTH messages — leaving the name error up
                                // would point at a field that just emptied.
                                clearFieldError('courseCategory-0')
                                clearFieldError('courseName-0')
                                onCourseChange({ category: e.target.value, courseName: '', custom: false })
                            }}
                            className={`${selectCls} bg-white ${categoryError ? errorFieldCls : ''}`}
                            aria-label="Course category"
                        >
                            <option value="">Select a category…</option>
                            {categoryOptions.map((opt) => (
                                <option key={opt._id} value={opt.categoryName}>{opt.categoryName}</option>
                            ))}
                        </select>
                    </div>
                </FieldRow>

                <FieldRow
                    label="Course name"
                    required
                    tooltip="Pick the course being delivered, or choose Others to type a name outside the list"
                    error={nameError}
                >
                    <div className={CONTROL_WIDTH}>
                        {!course?.custom ? (
                            <select
                                // Guarded against a stale name: a <select>
                                // whose value matches no option renders blank
                                // anyway, and a custom name left over from
                                // "Others" must not select a phantom option.
                                value={names.includes(courseName) ? courseName : ''}
                                onChange={(e) => {
                                    clearFieldError('courseName-0')
                                    if (e.target.value === CUSTOM_NAME) {
                                        onCourseChange({ custom: true, courseName: '' })
                                    } else {
                                        onCourseChange({ courseName: e.target.value })
                                    }
                                }}
                                disabled={!category}
                                className={`${selectCls} bg-white disabled:bg-surface-sunken disabled:text-faint ${nameError ? errorFieldCls : ''}`}
                                aria-label="Course name"
                            >
                                <option value="">
                                    {category ? 'Select a course…' : 'Pick a category first'}
                                </option>
                                {names.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                                <option value={CUSTOM_NAME}>Others (custom name)</option>
                            </select>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={courseName}
                                    onChange={(e) => { clearFieldError('courseName-0'); onCourseChange({ courseName: e.target.value }) }}
                                    placeholder="Enter course name"
                                    className={`${inputCls} bg-white flex-1 ${nameError ? errorFieldCls : ''}`}
                                    aria-label="Course name"
                                />
                                {/* Blue, not orange: this switches the field
                                    back to the picker, it does not commit
                                    anything. */}
                                <button
                                    type="button"
                                    onClick={() => onCourseChange({ custom: false, courseName: '' })}
                                    className="text-2xs font-medium text-info-700 hover:text-info-500 whitespace-nowrap transition-colors"
                                >
                                    Back to list
                                </button>
                            </div>
                        )}
                    </div>
                </FieldRow>
            </div>

            {/* Batches are opt-in. Unticking does NOT clear the names the user
                already typed — they stay in the wizard's state and come back on
                reticking; only the saved payload drops them. */}
            <FieldRow
                label="Batches"
                tooltip="Turn on if this service runs as parallel student groups; off, it is delivered once"
            >
                {/* h-9 matches an input's height so the checkbox lines up with
                    the label column, which is offset for h-9 controls. */}
                <label className="inline-flex items-center gap-2 h-9 cursor-pointer select-none group/batch">
                    <input
                        type="checkbox"
                        checked={batchesOn}
                        onChange={(e) => onBatchCount(e.target.checked ? DEFAULT_BATCH_COUNT : 0)}
                        className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-sm font-medium text-heading group-hover/batch:text-brand-700 transition-colors">
                        Enable
                    </span>
                    {batchesOn && (
                        <span className="text-xs font-medium text-faint tabular-nums">
                            {batchCount === 1 ? '1 batch' : `${batchCount} batches`}
                        </span>
                    )}
                </label>
            </FieldRow>

            {batchesOn && (
                <>
                    {/* The anchor wraps the whole row so the walkthrough frames
                        the label and its control together. */}
                    <div data-tour="sm-batchcount">
                        <FieldRow
                            label="No. of batches"
                            required
                            tooltip="How many student groups run this service; each one gets its own name below"
                        >
                            {/* Two digits at most — this one control is capped
                                tighter than CONTROL_WIDTH, which is sized for
                                text and selects. */}
                            <div className="max-w-[200px]">
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={batchCount}
                                    onChange={(e) => onBatchCount(parseInt(e.target.value, 10))}
                                    className={`${inputCls} bg-white`}
                                    aria-label="Number of batches"
                                />
                            </div>
                        </FieldRow>
                    </div>

                    {/* Plain labelled inputs, not BatchCard. A batch in these
                        models is nothing but a name — the card wrapped that one
                        field in a header, an expand toggle and a phases block
                        that is never shown here, so it was chrome around an
                        input. Legacy phase data still round-trips: it lives in
                        the wizard's state and is written from there at save
                        time, not from anything rendered in this list. */}
                    <FieldRow label="Batch name" required>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[520px]" data-tour="sm-batch-names">
                            {indices.map((i) => {
                                const error = fieldErrors[`batch-${i}`]
                                return (
                                    // The anchor is per input, so a failed save
                                    // scrolls to the batch that is actually wrong
                                    // rather than to the top of the list.
                                    <div
                                        key={i}
                                        data-error-anchor={error ? 'true' : undefined}
                                        className="space-y-1"
                                    >
                                        <Input
                                            value={batchNames[i] || ''}
                                            onChange={(e) => { clearFieldError(`batch-${i}`); onBatchName(i, e.target.value) }}
                                            // The engagement year is offered as a
                                            // naming hint — "2026 Batch 1" is what
                                            // a college recognises on a report,
                                            // and the walkthrough promises it.
                                            placeholder={yearHint
                                                ? `${yearHint} Batch ${i + 1}`
                                                : (batchCount === 1 ? 'Batch name' : `${ordinal(i + 1)} batch name`)}
                                            className={`${inputCls} bg-white ${error ? errorFieldCls : ''}`}
                                            aria-label={batchCount === 1 ? 'Batch name' : `${ordinal(i + 1)} batch name`}
                                        />
                                        <FieldError message={error} />
                                    </div>
                                )
                            })}
                        </div>
                    </FieldRow>
                </>
            )}
        </div>
    )
}
