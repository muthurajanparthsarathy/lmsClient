"use client"

import React, { useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FieldError, errorFieldCls, inputCls } from './shared/primitives'
import { CONTROL_WIDTH, FieldRow, Section, SectionShell, useErrorReveal, useSections } from './shared/SectionForm'
import { blankCourse, type CourseApi, type CourseEntry } from './HierarchyBuilder/types'

// Step 2 of the service-mapping wizard for the Placement Training flow, in the
// Moodle settings shape: one collapsible section per question.
//
// The structure it edits is deliberately small. Either the training runs in
// PHASES — and then a phase's name IS the course it delivers, one course per
// phase, which is why there is no separate course-name field on a phase — or it
// does not, and the mapping carries a single named course. Batches hang off
// whichever course exists. There is no third shape, and the retired
// batch-and-phase workbench is not coming back.
//
// This component owns no data. Every value and every mutation arrives from the
// wizard (page.tsx) through props, exactly as HierarchyBuilder does for the
// degree flow. The only local state is which sections are open, which is
// presentation rather than form content.

// Ceilings mirror the wizard's own clamps in applyPhaseCount / setBatchCount, so
// the spinner can never offer a value the store would silently reject.
const MAX_PHASES = 10
const MAX_BATCHES = 20

// "1st batch name", "2nd batch name", … placeholders for the per-batch inputs.
// Moved here with PlacementBatches; page.tsx keeps its own copy for the flat
// flows' validation messages.
const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

// Section ids are derived, not enumerated, because the phase count is data. The
// two fixed ids ('phases', 'course') can never collide with these.
const phaseSectionId = (i: number): string => `phase-${i}`

// Sections default to OPEN: enabling phases should show every phase's fields at
// once so the step reads straight down — Phases → No. of phases → Phase 1 →
// Phase 2 … — rather than hiding the later ones behind a fold. `open[id] ?? true`
// is what carries this to phases added after mount; folding one is still a click
// away. Batch groups are absent here because their fold is data (batchesEnabled),
// not layout state.
const DEFAULT_OPEN: Record<string, boolean> = {
    course: true,
}

export type PlacementFormProps = {
    // The phase names, which double as the phase courses' names. An empty array
    // means phases are off and the mapping delivers one course directly — the
    // length IS the enabled state, so there is no second flag to drift from it.
    phaseNames: string[]
    // Sets how many phases exist. Zero is only ever sent by the checkbox; see the
    // NaN guard on the count input for why the number field must never send it.
    onSetPhaseCount: (count: number) => void
    onSetPhaseName: (index: number, value: string) => void

    // With phases OFF the mapping can still deliver several plain courses (a
    // placement service running java AND python, no phase grouping). This is how
    // many. Courses are managed as a LIST — "+ Add another course" appends, each
    // section's Remove drops that one — not through a count spinner; the count
    // exists so the wizard and this form agree on how many sections render.
    // Ignored while phases are on.
    noPhaseCourseCount: number
    onAddNoPhaseCourse: () => void
    onRemoveNoPhaseCourse: (index: number) => void

    // Courses and their batches, read and written through the wizard's single
    // course store. Placement keys are flat — 'ph' / 'phd<i>' with phases off,
    // 'ph<i>' with them on — and never contain PATH_SEP, which is what keeps them
    // from colliding with the degree flow's paths in the same store.
    courseApi: CourseApi

    // Validation lives in the wizard; this form only displays errors and clears
    // the ones its own fields own.
    fieldErrors: Record<string, string>
    onClearFieldError: (key: string) => void

    // The wizard calls this after a failed Next: expand every section holding an
    // error, then scroll to and focus the first offender.
    revealErrorsRef: React.MutableRefObject<(() => void) | null>
}

// A folded batch group must still say whether it is on: on this form closed and
// off look identical otherwise, and that is a state the user would have to open
// the group to discover.
const batchesSummary = (course: CourseEntry): string => {
    if (!course.batchesEnabled) return 'Off'
    return course.batches.length === 1 ? '1 batch' : `${course.batches.length} batches`
}

/**
 * The "Batches" opt-in, which rides in the phase's own header beside its title
 * rather than in a row of its own. Whether a phase runs in batches is a fact
 * about the phase, so it belongs on the line that names it — and it stays
 * readable and changeable while the phase is folded.
 *
 * Unticking does NOT clear `batches` — the names stay in the store and come back
 * on reticking. Only the saved payload drops them.
 */
function BatchesToggle({
    path,
    course,
    courseApi,
}: {
    path: string
    course: CourseEntry
    courseApi: CourseApi
}) {
    const on = course.batchesEnabled
    return (
        <label className="inline-flex items-center gap-2 h-9 cursor-pointer select-none group/batch">
            <input
                type="checkbox"
                checked={on}
                onChange={(e) => {
                    const next = e.target.checked
                    courseApi.update(path, 0, { batchesEnabled: next })
                    // Opting in starts at one batch — an empty panel would just
                    // mean a second click to say "at least one".
                    if (next && course.batches.length === 0) courseApi.setBatchCount(path, 0, 1)
                }}
                className="w-4 h-4 accent-brand-500"
            />
            <span className="text-sm font-medium text-heading group-hover/batch:text-brand-700 transition-colors">
                Enable
            </span>
            {on && (
                <span className="text-xs font-medium text-faint tabular-nums">
                    {batchesSummary(course)}
                </span>
            )}
        </label>
    )
}

/**
 * The batch count and names, rendered inside the phase once it has opted in.
 * Bare rows rather than a wrapper, so they share the section's single label
 * column with the course-name row above them.
 */
function PlacementBatchRows({
    path,
    course,
    courseApi,
}: {
    path: string
    course: CourseEntry
    courseApi: CourseApi
}) {
    if (!course.batchesEnabled) return null

    return (
        <>
            <FieldRow
                label="No. of batches"
                tooltip="How many student groups sit this course; each one gets its own name below"
            >
                <Input
                    type="number"
                    min={1}
                    max={MAX_BATCHES}
                    value={course.batches.length}
                    onChange={(e) => {
                        // Same NaN guard as the phase count: mid-retype the field
                        // is briefly empty, and treating that as 0 would wipe the
                        // names just typed.
                        const n = parseInt(e.target.value, 10)
                        if (!Number.isNaN(n)) courseApi.setBatchCount(path, 0, n)
                    }}
                    className={`${inputCls} !w-24 text-center bg-white`}
                    aria-label="Number of batches"
                />
            </FieldRow>
            <FieldRow label="Batch name" required>
                {/* Each name keeps its own error and its own scroll anchor
                    rather than one anchor for the whole group: with eight
                    batches, landing on the group means hunting for the one
                    that is actually wrong. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[520px]">
                    {course.batches.map((b, bi) => {
                        const error = courseApi.batchErrorAt(path, 0, bi)
                        return (
                            <div key={bi} data-error-anchor={error ? 'true' : undefined} className="space-y-1">
                                <Input
                                    value={b}
                                    onChange={(e) => courseApi.setBatchName(path, 0, bi, e.target.value)}
                                    placeholder={`${ordinal(bi + 1)} batch name`}
                                    className={`${inputCls} bg-white ${error ? errorFieldCls : ''}`}
                                />
                                <FieldError message={error} />
                            </div>
                        )
                    })}
                </div>
            </FieldRow>
        </>
    )
}

// No-phase course store keys — must match noPhaseCourseKey in page.tsx exactly:
// first course stays 'ph' (legacy single-course shape), the rest are 'phd<i>'.
const noPhaseCourseKey = (i: number): string => (i === 0 ? 'ph' : `phd${i}`)

const MAX_NO_PHASE_COURSES = 20

export default function PlacementForm({
    phaseNames,
    onSetPhaseCount,
    onSetPhaseName,
    noPhaseCourseCount,
    onAddNoPhaseCourse,
    onRemoveNoPhaseCourse,
    courseApi,
    fieldErrors,
    onClearFieldError,
    revealErrorsRef,
}: PlacementFormProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    // Only the store, the per-id toggle and the setter are taken from the hook —
    // see `allOpen` below for why the Expand-all control is driven from here.
    const { open, setOpen } = useSections<string>(DEFAULT_OPEN)

    const phasesOn = phaseNames.length > 0

    // A placement key always holds exactly one course; the wizard seeds it in an
    // effect, and blankCourse() only covers the single render between adding a
    // phase and that seed landing.
    const courseAt = (path: string): CourseEntry => courseApi.coursesAt(path)[0] ?? blankCourse()

    // The course sections on screen right now, paired with the store key each one
    // edits. Everything below — Expand all, the error map, the render — walks
    // this one list, so the two shapes can never disagree about what exists.
    const noPhaseCount = Math.max(1, noPhaseCourseCount)
    const courseSections = phasesOn
        ? phaseNames.map((_, i) => ({ id: phaseSectionId(i), path: `ph${i}` }))
        : Array.from({ length: noPhaseCount }, (_, i) => ({ id: `course-${i}`, path: noPhaseCourseKey(i) }))

    // Expand/Collapse all counts only what is actually on screen. `useSections`
    // derives it from the id set it was seeded with, which cannot know how many
    // phases exist right now — so the hook is used purely as the open/closed
    // store and the shell's control is computed against the live list instead.
    const visibleIds = courseSections.map(({ id }) => id)
    // No entry yet means OPEN, so a phase added after mount starts expanded.
    const isOpen = (id: string): boolean => open[id] ?? true
    const allOpen = visibleIds.every(isOpen)
    const toggleAll = () => {
        const to = !allOpen
        setOpen((prev) => {
            const next = { ...prev }
            for (const id of visibleIds) next[id] = to
            return next
        })
    }

    // useSections' own toggle flips `!prev[id]`, which for an untouched phase
    // (no entry = open by default) would set it open AGAIN — so the first click
    // would not fold it. This reads the same `?? true` default the render does.
    const toggleSection = (id: string) => () =>
        setOpen((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))

    // Batch error keys are enumerated from the course's own length, with a floor
    // of one: "Add at least one batch" is reported against batch 0 of a course
    // that opted in without adding any, so that key must be listed even when
    // there are no batch inputs to attach it to.
    const batchErrorKeys = (path: string): string[] =>
        Array.from(
            { length: Math.max(1, courseAt(path).batches.length) },
            (_, bi) => `sem:${path}:0:batch:${bi}`
        )

    // Which error keys live in which section, so a failed save knows exactly
    // which folded sections to open. The 'phases' section holds no field that can
    // fail — the checkbox and the count are always valid by construction — and
    // `hierarchy` is a summary rendered outside every section, so neither forces
    // anything open.
    const sectionErrorKeys: Record<string, string[]> = {}
    courseSections.forEach(({ id, path }, i) => {
        // With phases off each course carries a name of its own, keyed by its own
        // store path (sem:ph:0:… , sem:phd1:0:… , …); a phase's name is validated
        // as the phase instead, under `phase-<i>-0`.
        const nameKey = phasesOn ? `phase-${i}-0` : `sem:${path}:0:courseName`
        // The batch keys ride on the PARENT section. The batch group itself is
        // not listed: its fold is the batchesEnabled flag, and a batch error can
        // only exist on a course that already opted in — so the group is
        // guaranteed open whenever one of these fires.
        sectionErrorKeys[id] = [nameKey, ...batchErrorKeys(path)]
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

    return (
        // Inset from the left so the label column starts further in from the panel
        // edge; md-only so narrow screens keep the full width.
        //
        // The px-1 belongs HERE, not on the course block below. It used to sit on
        // that block alone, which left "Phase configuration" 4px to the left of "Course name"
        // and "Batches" — the only three rows on screen with phases off, so the
        // ragged label column was the first thing the step showed. At the root it
        // covers every top-level row ("Phase configuration", "No. of phases", the "Phase N"
        // headers) so they all start on the same x.
        <div ref={rootRef} className="space-y-1 px-1 md:ml-[70px]">
            {/* The phase question stays OUTSIDE the accordion, in the shape it
                had before this layout: it decides how many sections exist below
                it, so folding it inside one of them would let the user hide the
                control that governs the rest of the form. */}
            <div data-tour="sm-phases">
                {/* Phases is just another field on this form — the same label +
                    checkbox shape as the Batches row inside a course, so the two read
                    as one consistent set of choices rather than a banner and a field. */}
                <FieldRow
                    label="Phase configuration"
                    tooltip="Off, this training is one course delivered to its batches; on, each phase carries its own course"
                >
                    {/* h-9 matches an input's height so the checkbox lines up with
                        the label column, which is offset for h-9 controls. */}
                    <label className="inline-flex items-center gap-2 h-9 cursor-pointer select-none group/phase">
                        <input
                            type="checkbox"
                            checked={phasesOn}
                            // Ticking starts at TWO phases: a training that runs in
                            // phases has at least two by definition, so one would just
                            // mean an extra step to add the second.
                            onChange={(e) => onSetPhaseCount(e.target.checked ? 2 : 0)}
                            className="w-4 h-4 accent-info-700"
                        />
                        <span className="text-sm font-medium text-heading group-hover/phase:text-info-700 transition-colors">
                            Enable
                        </span>
                    </label>
                </FieldRow>
            </div>

            {phasesOn ? (
                // "Phase configuration", "No. of phases" and the "Phase N" headers all sit
                // SAME column — only a phase's own fields indent, under its header
                // (Section's own pl-6). No extra indent here.
                <div>
                <FieldRow
                    label="No. of phases"
                    tooltip="How many phases this placement training runs in; each phase delivers one course to its own batches"
                >
                    <Input
                        type="number"
                        min={1}
                        max={MAX_PHASES}
                        value={phaseNames.length}
                        onChange={(e) => {
                            // Mid-retype the field is briefly empty (NaN).
                            // Treating that as 0 switched phases OFF and
                            // deleted every phase course on a single
                            // Backspace — only the checkbox may mean
                            // "phases off".
                            const n = parseInt(e.target.value, 10)
                            if (!Number.isNaN(n)) onSetPhaseCount(Math.max(1, n))
                        }}
                        className={`${inputCls} !w-24 text-center bg-white`}
                        aria-label="Number of phases"
                    />
                </FieldRow>
                <SectionShell allOpen={allOpen} onToggleAll={toggleAll}>
                    {courseSections.map(({ id, path }, i) => {
                        const course = courseAt(path)
                        // The phase name IS the course name, bound to phaseNames and
                        // validated under the phase's own key.
                        const nameError = fieldErrors[`phase-${i}-0`]
                        return (
                            <Section
                                key={id}
                                // Phases read as a plain ordered story — "Phase 1",
                                // "Phase 2", … The course name is NOT appended: the
                                // ordinal alone is what tells the user where they are.
                                title={`Phase ${i + 1}`}
                                required
                                open={isOpen(id)}
                                onToggle={toggleSection(id)}
                                tourAnchor={i === 0 ? 'sm-prt-courses' : undefined}
                            >
                                {/* Inside a phase: course name, then Enable-batches
                                    below it, then the batches — top-to-bottom. */}
                                <FieldRow
                                    label="Course name"
                                    required
                                    tooltip="The course this phase delivers — one course per phase"
                                    error={nameError}
                                >
                                    <div className={CONTROL_WIDTH}>
                                        <Input
                                            value={phaseNames[i]}
                                            onChange={(e) => {
                                                onClearFieldError(`phase-${i}-0`)
                                                onSetPhaseName(i, e.target.value)
                                            }}
                                            placeholder="e.g. Aptitude, Core Java"
                                            className={`${inputCls} bg-white ${nameError ? errorFieldCls : ''}`}
                                        />
                                    </div>
                                </FieldRow>
                                <FieldRow label="Batches" tooltip="Turn on if this course runs as parallel student batches">
                                    <BatchesToggle path={path} course={course} courseApi={courseApi} />
                                </FieldRow>
                                <PlacementBatchRows path={path} course={course} courseApi={courseApi} />
                            </Section>
                        )
                    })}
                </SectionShell>
                </div>
            ) : (
                // No phases → one or more DIRECT courses, managed as a LIST:
                // "+ Add another course" appends, each section's Remove drops
                // that one. (The old "No. of courses" spinner is gone — the list
                // itself is the count.) Each course renders flat (name → batches).
                // Multiple courses are shown as their own small "Course N"
                // sections so their batch rows stay grouped; a single course
                // drops the header and reads as a plain form.
                <div data-tour="sm-prt-courses">
                    {noPhaseCount === 1 ? (() => {
                        const path = courseSections[0].path
                        const course = courseAt(path)
                        const nameError = courseApi.errorAt(path, 0, 'courseName')
                        return (
                            <div className="mt-1 space-y-1" data-error-anchor={nameError ? 'true' : undefined}>
                                <FieldRow label="Course name" required tooltip="The course this training delivers; its batches are named below" error={nameError}>
                                    <div className={CONTROL_WIDTH}>
                                        <Input
                                            value={course.courseName}
                                            onChange={(e) => { onClearFieldError(`sem:${path}:0:courseName`); courseApi.update(path, 0, { courseName: e.target.value }) }}
                                            placeholder="e.g. Placement Readiness"
                                            className={`${inputCls} bg-white ${nameError ? errorFieldCls : ''}`}
                                        />
                                    </div>
                                </FieldRow>
                                <FieldRow label="Batches" tooltip="Turn on if this course runs as parallel student batches">
                                    <BatchesToggle path={path} course={course} courseApi={courseApi} />
                                </FieldRow>
                                <PlacementBatchRows path={path} course={course} courseApi={courseApi} />
                            </div>
                        )
                    })() : (
                        <SectionShell allOpen={allOpen} onToggleAll={toggleAll}>
                            {courseSections.map(({ id, path }, i) => {
                                const course = courseAt(path)
                                const nameError = courseApi.errorAt(path, 0, 'courseName')
                                return (
                                    <Section
                                        key={id}
                                        title={`Course ${i + 1}`}
                                        required
                                        open={isOpen(id)}
                                        onToggle={toggleSection(id)}
                                        headerAside={
                                            <button
                                                type="button"
                                                onClick={() => onRemoveNoPhaseCourse(i)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-faint hover:text-danger-700 transition-colors"
                                                aria-label={`Remove course ${i + 1}`}
                                                title="Remove this course"
                                            >
                                                <Trash2 size={13} />
                                                Remove
                                            </button>
                                        }
                                    >
                                        <FieldRow label="Course name" required tooltip="The course this training delivers" error={nameError}>
                                            <div className={CONTROL_WIDTH}>
                                                <Input
                                                    value={course.courseName}
                                                    onChange={(e) => { onClearFieldError(`sem:${path}:0:courseName`); courseApi.update(path, 0, { courseName: e.target.value }) }}
                                                    placeholder="e.g. Aptitude, Core Java"
                                                    className={`${inputCls} bg-white ${nameError ? errorFieldCls : ''}`}
                                                />
                                            </div>
                                        </FieldRow>
                                        <FieldRow label="Batches" tooltip="Turn on if this course runs as parallel student batches">
                                            <BatchesToggle path={path} course={course} courseApi={courseApi} />
                                        </FieldRow>
                                        <PlacementBatchRows path={path} course={course} courseApi={courseApi} />
                                    </Section>
                                )
                            })}
                        </SectionShell>
                    )}

                    {/* The list's only growth control. Capped where the old count
                        spinner was, so the store's clamp is never offered a value
                        it would reject. */}
                    {noPhaseCount < MAX_NO_PHASE_COURSES && (
                        <button
                            type="button"
                            onClick={onAddNoPhaseCourse}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                        >
                            <Plus size={13} /> Add another course
                        </button>
                    )}
                </div>
            )}

            {/* The step-level summary, once, outside the accordion: it says "some
                section below is incomplete", so burying it in one of them would
                point at the wrong place. */}
            <div className="pt-3">
                <FieldError message={fieldErrors.hierarchy} />
            </div>
        </div>
    )
}
