"use client"

import React, { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { FieldError, errorFieldCls, inputCls } from './shared/primitives'
import { useErrorReveal } from './shared/SectionForm'
import { ListSelect } from './shared/ListSelect'
import {
    BatchNameField,
    FoldChevron,
    StructureField,
    batchNameGridCls,
    structureCardCls,
} from './shared/StructureLayout'
import { StructureCheckbox, StructureCountInput } from './structure/StructureControls'
import {
    MAX_BATCHES,
    MAX_PHASES,
    MIN_BATCHES,
    MIN_PHASES,
    SEMESTER_OPTIONS,
    academicBatchOptions,
    defaultBatchName,
    defaultPhaseBatchName,
    defaultPhaseName,
} from './structure/placementConfig'
import { blankCourse, type CourseApi, type CourseEntry } from './HierarchyBuilder/types'

// Step 2 of the service-mapping wizard for the Placement Training flow.
//
// The mapping delivers ONE course, to one academic batch and one semester. How
// that course is organised is the question underneath:
//
//   phase configuration ON   course → Phase I  → Batch I, Batch II
//                                   → Phase II → Batch I, Batch II
//   phase configuration OFF  course → Batch 1, Batch 2
//
// The course used to be asked per PHASE — a phase's name doubled as the course
// it delivered. It is now asked once, at the top, and a phase carries nothing
// but its own training batches. That is what makes the two "batch" ideas on this
// screen separable: the ACADEMIC batch is an intake year ("2026") belonging to
// the course, while a TRAINING batch ("Batch I") is a group sitting it — and the
// same training batch name may appear under two different phases, because they
// are different batches with different ids.
//
// This component owns no data. Every value and every mutation arrives from the
// wizard (page.tsx) through props; the only local state is which phases are
// unfolded, which is presentation rather than form content.

const phaseSectionId = (i: number): string => `phase-${i}`

// Store keys for the training batches. Must match noPhaseCourseKey / the phase
// keys in page.tsx: the root key carries the batches when phases are off, and
// `ph<i>` carries phase i's.
const ROOT_KEY = 'ph'
const phaseKey = (i: number): string => `ph${i}`

export type PlacementStructureFormProps = {
    // The course names configured under the service model's own category,
    // already resolved by the wizard — this form does no category matching of
    // its own and never creates one.
    courseOptions: string[]
    // Named only so the empty state can say WHICH category is involved.
    courseCategoryName: string
    // False when NO category matched the service model at all — a different
    // problem from a category that matched and holds no courses, and fixed in a
    // different place (the category's NAME in Course Management, not its course
    // list). An empty picker alone cannot tell the two apart.
    courseCategoryFound: boolean
    coursesLoading: boolean

    // ── The configuration's identity ─────────────────────────────────────────
    // One course, one intake year, one semester — asked once, above the
    // structure, because every phase and every batch below belongs to them.
    courseName: string
    onCourseName: (value: string) => void
    academicBatch: string
    onAcademicBatch: (value: string) => void
    semester: string
    onSemester: (value: string) => void

    // The phase names. An empty array means phase configuration is off — the
    // length IS the enabled state, so there is no second flag to drift from it.
    phaseNames: string[]
    onSetPhaseCount: (count: number) => void
    onSetPhaseName: (index: number, value: string) => void

    // Training batches, read and written through the wizard's course store.
    courseApi: CourseApi

    // Validation lives in the wizard; this form only displays errors and clears
    // the ones its own fields own.
    fieldErrors: Record<string, string>
    onClearFieldError: (key: string) => void

    // The wizard calls this after a failed Next: open every phase holding an
    // error, then scroll to and focus the first offender.
    revealErrorsRef: React.MutableRefObject<(() => void) | null>
}

const labelCls = 'text-sm font-medium text-heading'

/**
 * The training batches of one parent — a phase, or the configuration itself.
 *
 * Both carry the same opt-in row: Batches + Number of batches. A phase arrives
 * with it already ticked and two batches, so the common case needs no clicks —
 * but a phase that runs undivided can say so. The checkbox is the only thing
 * that can express "this phase has no batches"; without it the answer would be
 * assumed rather than given.
 */
function BatchRows({
    storeKey,
    course,
    courseApi,
    nameFor,
}: {
    storeKey: string
    course: CourseEntry
    courseApi: CourseApi
    nameFor: (index: number) => string
}) {
    const baseId = useId()
    const on = course.batchesEnabled
    // The TRUE count, so the stepper and the name boxes below it can never
    // disagree. Only the transient zero — the render between ticking the box
    // and the seed landing — is floored, and it is floored to the minimum the
    // seed is about to write anyway. A mapping saved before the minimum existed
    // can still hold one batch: it shows its real 1 with the minus disabled,
    // rather than claiming a second batch that is not in the data.
    const count = course.batches.length || MIN_BATCHES

    const setCount = (next: number) => {
        const n = Math.min(MAX_BATCHES, Math.max(MIN_BATCHES, next))
        courseApi.setBatchCount(storeKey, 0, n)
        // Seed the names the screens show — "Batch I, Batch II" inside a phase,
        // "Batch 1, Batch 2" without one — rather than leaving empty required
        // boxes. Only slots that are actually blank are filled, so a name the
        // user typed is never overwritten.
        for (let i = 0; i < n; i++) {
            if (!(course.batches[i] || '').trim()) courseApi.setBatchName(storeKey, 0, i, nameFor(i))
        }
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <StructureCheckbox
                    checked={course.batchesEnabled}
                    onCheckedChange={(next) => {
                        courseApi.update(storeKey, 0, { batchesEnabled: next })
                        if (next && course.batches.length === 0) setCount(MIN_BATCHES)
                    }}
                    label="Batches"
                    labelClass="text-sm font-semibold text-heading"
                />
                {on && <span aria-hidden className="hidden h-5 w-px bg-hairline-strong sm:block" />}
                {on && (
                    <div className="flex items-center gap-2.5">
                        <span className={labelCls}>Number of batches</span>
                        <StructureCountInput
                            label="Number of batches"
                            value={count}
                            onChange={setCount}
                            min={MIN_BATCHES}
                            max={MAX_BATCHES}
                        />
                        <span className="whitespace-nowrap text-xs text-subtle">
                            Minimum {MIN_BATCHES} batches. Uncheck for no batches.
                        </span>
                    </div>
                )}
            </div>

            {on && (
                <div className={cn(batchNameGridCls, 'mt-3')}>
                    {course.batches.map((b, bi) => {
                        // Each name keeps its own error and its own scroll anchor
                        // rather than one anchor for the whole group: with eight
                        // batches, landing on the group means hunting for the one
                        // that is actually wrong.
                        const error = courseApi.batchErrorAt(storeKey, 0, bi)
                        const fieldId = `${baseId}-batch-${bi}`
                        return (
                            <BatchNameField
                                key={bi}
                                id={fieldId}
                                label={`Batch ${bi + 1} name`}
                                error={error}
                            >
                                <Input
                                    id={fieldId}
                                    value={b}
                                    onChange={(e) => courseApi.setBatchName(storeKey, 0, bi, e.target.value)}
                                    placeholder={nameFor(bi)}
                                    className={cn(inputCls, 'bg-surface', error && errorFieldCls)}
                                />
                            </BatchNameField>
                        )
                    })}
                </div>
            )}
        </>
    )
}

export default function PlacementStructureForm({
    courseOptions,
    courseCategoryName,
    courseCategoryFound,
    coursesLoading,
    courseName,
    onCourseName,
    academicBatch,
    onAcademicBatch,
    semester,
    onSemester,
    phaseNames,
    onSetPhaseCount,
    onSetPhaseName,
    courseApi,
    fieldErrors,
    onClearFieldError,
    revealErrorsRef,
}: PlacementStructureFormProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    // Which phases are unfolded. No entry means "the first one".
    const [open, setOpen] = useState<Record<string, boolean>>({})
    const ids = useId()

    const phasesOn = phaseNames.length > 0

    // A placement key always holds exactly one course entry; the wizard seeds it
    // in an effect, and blankCourse() covers the single render between adding a
    // phase and that seed landing.
    const courseAt = (key: string): CourseEntry => courseApi.coursesAt(key)[0] ?? blankCourse()

    // ── Error reveal ────────────────────────────────────────────────────────
    const batchErrorKeys = (key: string): string[] =>
        Array.from(
            { length: Math.max(1, courseAt(key).batches.length) },
            (_, bi) => `sem:${key}:0:batch:${bi}`
        )

    const sectionErrorKeys: Record<string, string[]> = {}
    phaseNames.forEach((_, i) => {
        sectionErrorKeys[phaseSectionId(i)] = [`phase-${i}-0`, ...batchErrorKeys(phaseKey(i))]
    })

    const { reveal } = useErrorReveal<string>({
        sectionErrorKeys,
        // A getter, never a snapshot: the reveal runs a render AFTER the wizard
        // sets the errors, and has to read them as they are at that moment.
        activeErrorKeys: () => Object.keys(fieldErrors).filter((k) => fieldErrors[k]),
        setOpen,
        rootRef,
    })

    useEffect(() => {
        revealErrorsRef.current = reveal
        return () => { revealErrorsRef.current = null }
    }, [revealErrorsRef, reveal])

    const isOpen = (id: string, index: number): boolean => open[id] ?? index === 0
    const toggleSection = (id: string, index: number) => () =>
        setOpen((prev) => ({ ...prev, [id]: !isOpen(id, index) }))

    const orphanCourse = Boolean(courseName) && !courseOptions.includes(courseName)
    const coursePlaceholder = coursesLoading
        ? 'Loading courses…'
        : !courseCategoryFound
            ? `No course category named “${courseCategoryName}”`
            : courseOptions.length
                ? 'Select a course'
                : `No courses under ${courseCategoryName}`

    const courseError = fieldErrors.configCourseName
    const semesterError = fieldErrors.configSemester

    return (
        <div ref={rootRef} className="px-1">
            {/* ── What is delivered ───────────────────────────────────────────
                One course, one intake, one semester. Asked once and above the
                structure, because every phase and batch below belongs to them. */}
            <div className={cn(structureCardCls, 'p-4')} data-tour="sm-prt-courses">
                {/* A GRID, not a wrapping flex row. Each of these fields is a
                    fixed 152px label plus a fixed 240px control, so as a flex row
                    the three needed 1276px to stay together and simply dropped
                    the third onto its own line one pixel below that. Ticking
                    Phase configuration is enough to cross it: the phases render,
                    the body overflows, a scrollbar appears, and the ~15px it
                    takes sent Academic batch to the next row — the layout moved
                    because of something the user did further down the form.

                    Three explicit columns cannot do that. When a column is
                    tighter than the field's natural width the field stacks its
                    own control under its own label (StructureField wraps), which
                    keeps all three side by side and degrades one field at a time
                    instead of re-flowing the row. items-start so a validation
                    message under one field does not shift the other two. */}
                <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 lg:grid-cols-2 xl:grid-cols-3">
                    <StructureField label="Course name" id={`${ids}-course`} required error={courseError}>
                        <ListSelect
                            id={`${ids}-course`}
                            value={courseName}
                            // A stored name the category no longer offers is still
                            // offered here, so the field shows what it holds
                            // instead of reading blank.
                            options={(orphanCourse ? [courseName, ...courseOptions] : courseOptions)
                                .map((c) => ({ value: c, label: c }))}
                            onChange={(v) => { onClearFieldError('configCourseName'); onCourseName(v) }}
                            placeholder={coursePlaceholder}
                            emptyLabel={courseCategoryFound
                                ? `No courses under ${courseCategoryName}. Add them to that category in Course Management.`
                                : `No course category named “${courseCategoryName}”. Course Management needs a category matching this service model.`}
                            ariaLabel="Course name"
                            searchPlaceholder="Search courses…"
                            invalid={Boolean(courseError)}
                            className="w-full"
                        />
                    </StructureField>

                    {/* The intake YEAR — not a training batch. The two are named
                        alike and mean different things, so they never share a
                        control, an API field or a column. */}
                    <StructureField label="Academic batch" id={`${ids}-academic`} required>
                        <ListSelect
                            id={`${ids}-academic`}
                            value={academicBatch}
                            options={academicBatchOptions(academicBatch).map((y) => ({ value: y, label: y }))}
                            onChange={onAcademicBatch}
                            placeholder="Select a year"
                            emptyLabel="No years available"
                            ariaLabel="Academic batch"
                            className="w-full tabular-nums"
                        />
                    </StructureField>

                    <StructureField label="Semester" id={`${ids}-semester`} required error={semesterError}>
                        <ListSelect
                            id={`${ids}-semester`}
                            value={semester}
                            options={SEMESTER_OPTIONS.map((s) => ({ value: s, label: s }))}
                            onChange={(v) => { onClearFieldError('configSemester'); onSemester(v) }}
                            placeholder="Select a semester"
                            emptyLabel="No semesters available"
                            ariaLabel="Semester"
                            invalid={Boolean(semesterError)}
                            className="w-full"
                        />
                    </StructureField>
                </div>
            </div>

            {/* ── How it is organised ─────────────────────────────────────── */}
            <div data-tour="sm-phases" className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <StructureCheckbox
                        checked={phasesOn}
                        onCheckedChange={(next) => {
                            onSetPhaseCount(next ? MIN_PHASES : 0)
                            // Every phase starts folded on the way in: the user
                            // ticked a box, they did not ask to be shown two
                            // phases' worth of fields at once.
                            if (next) setOpen({ [phaseSectionId(0)]: false })
                        }}
                        label="Phase configuration"
                        labelClass="text-base font-semibold text-heading"
                    />
                    {phasesOn && (
                        <>
                            <span aria-hidden className="hidden h-5 w-px bg-hairline-strong sm:block" />
                            <div className="flex items-center gap-2.5">
                                <span className={labelCls}>Number of phases</span>
                                <StructureCountInput
                                    label="Number of phases"
                                    value={phaseNames.length}
                                    onChange={onSetPhaseCount}
                                    min={MIN_PHASES}
                                    max={MAX_PHASES}
                                />
                                <span className="whitespace-nowrap text-xs text-subtle">
                                    Minimum {MIN_PHASES} phases. Uncheck for no phases.
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {phasesOn ? (
                <div className="space-y-4">
                    {phaseNames.map((phaseName, i) => {
                        const expanded = isOpen(phaseSectionId(i), i)
                        const key = phaseKey(i)
                        const nameError = fieldErrors[`phase-${i}-0`]
                        return (
                            <section key={phaseSectionId(i)} className={structureCardCls}>
                                <h3>
                                    <button
                                        type="button"
                                        onClick={toggleSection(phaseSectionId(i), i)}
                                        aria-expanded={expanded}
                                        className={cn(
                                            'group flex w-full items-center gap-2.5 px-3 py-2.5 text-left outline-none',
                                            'transition-colors hover:bg-info-50 focus-visible:ring-2 focus-visible:ring-info-500/30',
                                            expanded ? 'rounded-t-tile' : 'rounded-tile'
                                        )}
                                    >
                                        <FoldChevron open={expanded} />
                                        <span className="text-lg font-semibold text-heading transition-colors group-hover:text-info-700">
                                            {phaseName || defaultPhaseName(i)}
                                        </span>
                                    </button>
                                </h3>
                                {expanded && (
                                    <div className="px-3 pb-4 pt-1">
                                        {/* A phase is named, and holds batches. It
                                            does NOT carry a course — the course is
                                            the configuration's, chosen once above. */}
                                        <StructureField
                                            label="Phase name"
                                            id={`${ids}-phase-${i}`}
                                            required
                                            error={nameError}
                                        >
                                            <Input
                                                id={`${ids}-phase-${i}`}
                                                value={phaseName}
                                                onChange={(e) => {
                                                    onClearFieldError(`phase-${i}-0`)
                                                    onSetPhaseName(i, e.target.value)
                                                }}
                                                placeholder={defaultPhaseName(i)}
                                                className={cn(inputCls, 'w-full bg-surface', nameError && errorFieldCls)}
                                            />
                                        </StructureField>
                                        <div className="mt-5">
                                            <BatchRows
                                                storeKey={key}
                                                course={courseAt(key)}
                                                courseApi={courseApi}
                                                nameFor={defaultPhaseBatchName}
                                            />
                                        </div>
                                    </div>
                                )}
                            </section>
                        )
                    })}
                </div>
            ) : (
                // No phases — the training batches belong straight to the course's
                // academic batch and semester.
                <div className={cn(structureCardCls, 'p-4')}>
                    <BatchRows
                        storeKey={ROOT_KEY}
                        course={courseAt(ROOT_KEY)}
                        courseApi={courseApi}
                        nameFor={defaultBatchName}
                    />
                </div>
            )}

            {/* The step-level summary, once, outside every phase: it says "some
                phase below is incomplete", so burying it in one of them would
                point at the wrong place. */}
            <div className="pt-3">
                <FieldError message={fieldErrors.hierarchy} />
            </div>
        </div>
    )
}
