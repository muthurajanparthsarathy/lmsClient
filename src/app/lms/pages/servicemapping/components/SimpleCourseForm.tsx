"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { inputCls, errorFieldCls } from './shared/primitives'
import { ListSelect } from './shared/ListSelect'
import { useErrorReveal } from './shared/SectionForm'
import {
    BatchNameField,
    StructureField,
    StructureRows,
    batchNameGridCls,
    structureCardCls,
    structureLabelCls,
} from './shared/StructureLayout'
import { StructureCheckbox, StructureCountInput } from './structure/StructureControls'
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
        // The step's shared presentation: one outlined container holding the
        // course on the left and its batches on the right, identical to the
        // placement flow's phase card and the degree flow's course row. The
        // fields, their order and their conditions are exactly as before — only
        // where they sit has changed.
        <div ref={rootRef} className="px-1">
            <div className={cn(structureCardCls, 'p-4')} data-tour="sm-courses">
                <StructureRows
                    course={
                        <>
                <StructureField
                    label="Course category"
                    required
                    tooltip="Choose the category first; it filters which course names the next field offers"
                    error={categoryError}
                >
                    <ListSelect
                        value={category}
                        options={categoryOptions.map((opt) => ({
                            value: opt.categoryName,
                            label: opt.categoryName,
                        }))}
                        onChange={(next) => {
                            // The name list is filtered by category, so a category
                            // change resets the name and clears BOTH messages —
                            // leaving the name error up would point at a field
                            // that just emptied.
                            clearFieldError('courseCategory-0')
                            clearFieldError('courseName-0')
                            onCourseChange({ category: next, courseName: '', custom: false })
                        }}
                        placeholder="Select a category…"
                        emptyLabel="No course categories configured."
                        ariaLabel="Course category"
                        searchPlaceholder="Search categories…"
                        invalid={Boolean(categoryError)}
                        className="w-full"
                    />
                </StructureField>

                            <StructureField
                                label="Course name"
                                required
                                tooltip="Pick the course being delivered, or choose Others to type a name outside the list"
                                error={nameError}
                                                            >
                                {!course?.custom ? (
                                    <ListSelect
                                        // Guarded against a stale name: a value that
                                        // matches no option would render blank, and a
                                        // custom name left over from "Others" must not
                                        // select a phantom option.
                                        value={names.includes(courseName) ? courseName : ''}
                                        options={[
                                            ...names.map((n) => ({ value: n, label: n })),
                                            { value: CUSTOM_NAME, label: 'Others (custom name)' },
                                        ]}
                                        onChange={(next) => {
                                            clearFieldError('courseName-0')
                                            if (next === CUSTOM_NAME) {
                                                onCourseChange({ custom: true, courseName: '' })
                                            } else {
                                                onCourseChange({ courseName: next })
                                            }
                                        }}
                                        disabled={!category}
                                        placeholder={category ? 'Select a course…' : 'Pick a category first'}
                                        emptyLabel="No courses under this category."
                                        ariaLabel="Course name"
                                        searchPlaceholder="Search courses…"
                                        invalid={Boolean(nameError)}
                                        className="w-full"
                                    />
                                ) : (
                                    // Clearing the box is the way back to the picker,
                                    // in place of the "Back to list" link that used to
                                    // sit beside it. Leaving on an empty field means
                                    // the user typed nothing, and an empty free-text
                                    // course is not an answer worth keeping — so the
                                    // field returns to offering the list rather than
                                    // stranding them in a mode with no way out.
                                    <Input
                                        value={courseName}
                                        onChange={(e) => { clearFieldError('courseName-0'); onCourseChange({ courseName: e.target.value }) }}
                                        onBlur={() => { if (!courseName.trim()) onCourseChange({ custom: false, courseName: '' }) }}
                                        placeholder="Enter course name"
                                        className={`${inputCls} bg-white ${nameError ? errorFieldCls : ''}`}
                                        aria-label="Course name"
                                    />
                                )}
                            </StructureField>
                        </>
                    }
                    batches={
                        <>
                            {/* Batches are opt-in. Unticking does NOT clear the names
                                the user already typed — they stay in the wizard's
                                state and come back on reticking; only the saved
                                payload drops them. */}
                            <StructureCheckbox
                                checked={batchesOn}
                                onCheckedChange={(next) => onBatchCount(next ? DEFAULT_BATCH_COUNT : 0)}
                                label="Batches"
                                labelClass="text-sm font-semibold text-heading"
                            />
                            {batchesOn && (
                                // The anchor wraps the whole group so the walkthrough
                                // frames the label and its control together.
                                <div data-tour="sm-batchcount" className="flex flex-wrap items-center gap-3">
                                    <span aria-hidden className="hidden h-5 w-px bg-hairline-strong sm:block" />
                                    <span className={structureLabelCls}>Number of batches</span>
                                    <StructureCountInput
                                        label="Number of batches"
                                        value={batchCount}
                                        onChange={onBatchCount}
                                        max={20}
                                    />
                                </div>
                            )}
                        </>
                    }
                    batchNames={batchesOn && (
                        // Plain labelled inputs, not BatchCard. A batch in these
                        // models is nothing but a name — the card wrapped that one
                        // field in a header, an expand toggle and a phases block
                        // that is never shown here, so it was chrome around an
                        // input. Legacy phase data still round-trips: it lives in
                        // the wizard's state and is written from there at save
                        // time, not from anything rendered in this list.
                        <div className={batchNameGridCls} data-tour="sm-batch-names">
                            {indices.map((i) => {
                                const error = fieldErrors[`batch-${i}`]
                                const aria = batchCount === 1 ? 'Batch name' : `${ordinal(i + 1)} batch name`
                                return (
                                    <BatchNameField
                                        key={i}
                                        label={batchCount === 1 ? 'Batch name' : `Batch ${i + 1} name`}
                                        error={error}
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
                                            aria-label={aria}
                                        />
                                    </BatchNameField>
                                )
                            })}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}
