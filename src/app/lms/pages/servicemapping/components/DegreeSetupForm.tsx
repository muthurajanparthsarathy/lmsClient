"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import InfoTooltip from '@/components/ui/reusabletooltip'
import DateTimePicker from '../../../shared/DateTimePicker'
import { AddInline, FieldError, RemovableChip, inputCls, selectCls } from './shared/primitives'
import { CONTROL_WIDTH, FieldRow, Section, SectionShell, useErrorReveal, useSections } from './shared/SectionForm'
import MultiSelectPopover from './HierarchyBuilder/MultiSelectPopover'
import SemesterSelect, { type SemStatus } from './SemesterSelect'
import ConfirmInline from './HierarchyBuilder/ConfirmInline'
import { PATH_SEP, type DegreeView } from './HierarchyBuilder/types'

// The degree flow's setup, in the same Moodle shape as Placement Training: the
// questions as collapsible sections, the workbench underneath.
//
// This replaces SetupPanel's confirm-and-collapse choreography. That panel asked
// its questions one part at a time and made the user press "Save & continue" to
// move on — a save button that saved nothing, on a form whose real save is two
// clicks away in the footer. Every section here is open from the start and stays
// open; collapsing is the user's choice, not a gate.
//
// Owns no data beyond which sections are folded. Every value and every mutation
// arrives from the wizard through props.

// Declaration order IS screen order: degree → department (sections ride along
// inside it) → semester → course & batch allocation. Each answer narrows the
// next, and it is also the order the data is built in — a semester hangs off a
// department or one of its sections, so the department has to be picked first.
type SectionId = 'degree' | 'departments' | 'semesters' | 'courses'

// The lock state of one semester — mirrors the wizard's SemLock (structural, so
// no cross-file type import that would make page.tsx and this component circular).
type SemLock = {
    state: 'available' | 'active' | 'completed' | 'skipped' | 'waiting'
    canEditStart: boolean
    canEditEnd: boolean
    hint?: string
}

// Everything open. The point of replacing the old confirm-and-collapse panel was
// to stop hiding the next question behind the previous one's confirmation.
const DEFAULT_OPEN: Record<SectionId, boolean> = {
    degree: true,
    departments: true,
    semesters: true,
    courses: true,
}

const SECTION_ERROR_KEYS: Record<SectionId, string[]> = {
    degree: ['degreeStartYear'],
    departments: [],
    // Both are filled per render: the semester-date keys depend on which
    // semesters are in scope, and the course keys on what the tree holds, so
    // neither can be enumerated up front.
    semesters: [],
    courses: [],
}

export type DegreeSetupFormProps = {
    degree: DegreeView | null
    degreeOptions: string[]
    degreesConfigured: boolean
    durationYears: number | null
    onChooseDegree: (name: string) => void
    onSetStartYear: (v: string) => void
    onSetEndYear: (v: string) => void
    onToggleDepartment: (department: string) => void
    onAddSection: (department: string, value: string) => void
    onRemoveSection: (department: string, value: string) => void
    // Used to warn before a department that already holds work is removed.
    departmentDataCount: (department: string) => { sections: number; courses: number }

    // ── Semester windows ─────────────────────────────────────────────────────
    semesterDateFor: (semester: string) => { start: string; end: string }
    onSemesterDate: (semester: string, field: 'start' | 'end', iso: string) => void
    semesterDateError: (semester: string, field: 'start' | 'end') => string | undefined
    // The degree's own span, used to clamp the pickers so an out-of-range date
    // cannot be picked in the first place. Null while either year is unknown.
    academicBounds: { min: string; max: string; label: string } | null
    // The sequential-lock state of a semester: which are editable now, which are
    // waiting for an earlier one to end, and whether a start date is frozen
    // because course setup has begun. Derived in the wizard, rendered here.
    semesterLock: (semester: string) => SemLock
    // The semesters the user has chosen so far (in degree order) — only these
    // ask for dates. The dropdown adds to this list one at a time.
    chosenSemesters: string[]
    // How each semester appears in the dropdown that lists them all: already
    // chosen, pickable now, or blocked (a lock icon + hover tooltip reason).
    semesterStatus: (semester: string) => SemStatus
    // The semester shown on the dropdown trigger — the current one being set up.
    activeSemester: string
    onToggleSemester: (semester: string) => void

    fieldErrors: Record<string, string>
    revealErrorsRef: React.MutableRefObject<(() => void) | null>
    // The workbench — courses per semester. Rendered under the setup.
    children: React.ReactNode
}

export default function DegreeSetupForm({
    degree,
    degreeOptions,
    degreesConfigured,
    durationYears,
    onChooseDegree,
    onSetStartYear,
    onSetEndYear,
    onToggleDepartment,
    onAddSection,
    onRemoveSection,
    departmentDataCount,
    semesterDateFor,
    onSemesterDate,
    semesterDateError,
    academicBounds,
    semesterLock,
    chosenSemesters,
    semesterStatus,
    activeSemester,
    onToggleSemester,
    fieldErrors,
    revealErrorsRef,
    children,
}: DegreeSetupFormProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    const { open, toggle, allOpen, toggleAll, setOpen } = useSections<SectionId>(DEFAULT_OPEN)
    const [pendingRemoveDept, setPendingRemoveDept] = useState<string | null>(null)
    // Open by DEFAULT. It used to start closed unless the mapping already had
    // sections, which quietly made sections a feature you had to know about:
    // the adder sat behind an unticked box, so most mappings never got one, and
    // Course & batch allocation then showed a bare department with no section
    // rows under it — looking like sections were missing rather than un-entered.
    // Showing the inputs is what makes them get filled in.
    //
    // The toggle stays, because collapsing four departments' worth of inputs is
    // still worth having; it just no longer decides whether the feature is
    // discoverable.
    const [sectionsOpen, setSectionsOpen] = useState(true)

    const departments = degree?.departments || []
    const semesterOptions = degree?.semesterOptions || []
    const sectionedCount = departments.filter((d) => (degree?.sectionsFor(d) || []).length).length

    // Semesters can only be scheduled from today onward — past dates are disabled in
    // the picker. The floor is the later of today and the degree's own start bound
    // (ISO strings in the same UTC format sort chronologically).
    const now = new Date()
    const todayFloorIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const minStartIso = academicBounds?.min && academicBounds.min > todayFloorIso
        ? academicBounds.min
        : todayFloorIso

    const sectionErrorKeys: Record<SectionId, string[]> = {
        ...SECTION_ERROR_KEYS,
        semesters: Object.keys(fieldErrors).filter((k) => k.startsWith('semdate:')),
        // Course and batch failures live on `sem:<path>:…` keys. Listing them
        // here is what lets a failed save open the workbench — folded, it
        // unmounts, and the reveal would have nothing to scroll to.
        courses: Object.keys(fieldErrors).filter((k) => k.startsWith('sem:')),
    }

    const { reveal } = useErrorReveal<SectionId>({
        sectionErrorKeys,
        activeErrorKeys: () => Object.keys(fieldErrors).filter((k) => fieldErrors[k]),
        setOpen,
        rootRef,
    })

    useEffect(() => {
        revealErrorsRef.current = reveal
        return () => { revealErrorsRef.current = null }
    }, [revealErrorsRef, reveal])

    // Removing a department that already holds sections or courses takes them
    // with it, so that case asks first. An empty one just goes.
    const removeDepartment = (dept: string) => {
        const { sections, courses } = departmentDataCount(dept)
        if (sections || courses) { setPendingRemoveDept(dept); return }
        onToggleDepartment(dept)
    }
    const pendingCounts = pendingRemoveDept ? departmentDataCount(pendingRemoveDept) : null

    return (
        // Grows with its content rather than filling a fixed pane: with every
        // section open the setup is routinely taller than the modal, and the
        // step's own overflow-y-auto is what scrolls it. A fixed height here
        // would leave the workbench below squeezed to nothing and unreachable.
        //
        // Same inset as PlacementForm and SimpleCourseForm, so every step-2 form
        // starts on one column: the section headers here line up with the DIV
        // "Degree structure" toggle above them and with the flat form's labels.
        // Field rows inside a section still take Section's own pl-6 — that indent
        // is the nesting, and it is meant to read one level in from the headers.
        <div ref={rootRef} className="px-1 md:ml-[70px]">
            <SectionShell allOpen={allOpen} onToggleAll={toggleAll}>
                {/* ── Degree ──────────────────────────────────────────────── */}
                <Section title="Degree" required open={open.degree} onToggle={toggle('degree')}>
                    <FieldRow
                        label="Degree"
                        required
                        tooltip="Pick the degree this mapping covers; it brings its own departments, semesters and length"
                    >
                        <div className={CONTROL_WIDTH} data-tour="sm-degree">
                            <select
                                value={degree?.name || ''}
                                onChange={(e) => { if (e.target.value) onChooseDegree(e.target.value) }}
                                className={selectCls}
                            >
                                <option value="" disabled>Select a degree…</option>
                                {degreeOptions.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            {!degree && !degreesConfigured && (
                                <p className="text-2xs text-faint italic mt-1">
                                    No degrees set up yet — add them in Degree Management.
                                </p>
                            )}
                        </div>
                    </FieldRow>

                    <FieldRow
                        label="Start year"
                        required
                        tooltip="The academic year this intake begins; the end year counts forward from the degree length"
                        error={fieldErrors.degreeStartYear}
                    >
                        {/* A select rather than a typed field: intakes only ever
                            start in a narrow band of years. The band now STARTS at
                            the current year — an intake cannot begin in a year that
                            has already gone, and the list used to open on last year.

                            A stored year outside the band still has to be shown, or
                            an older mapping would open with a blank field and lose
                            its saved year on the next save. How it is offered depends
                            on which way it falls out: a later year is legal and stays
                            pickable, a past one is displayed but DISABLED, so it
                            reads as "this is what was saved, choose again". */}
                        <div className={CONTROL_WIDTH} data-tour="sm-startyear">
                            <select
                                value={degree?.startYear || ''}
                                onChange={(e) => onSetStartYear(e.target.value)}
                                disabled={!degree}
                                className={`${selectCls} disabled:bg-surface-sunken`}
                            >
                                <option value="" disabled>Select year…</option>
                                {(() => {
                                    const now = new Date().getFullYear()
                                    const years = Array.from({ length: 6 }, (_, i) => String(now + i))
                                    const stored = degree?.startYear || ''
                                    const storedYear = parseInt(stored, 10)
                                    const isPast = Number.isFinite(storedYear) && storedYear < now
                                    const outsideBand = Boolean(stored) && !years.includes(stored)
                                    return (
                                        <>
                                            {outsideBand && (
                                                <option value={stored} disabled={isPast}>
                                                    {isPast ? `${stored} — past year, pick again` : stored}
                                                </option>
                                            )}
                                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                        </>
                                    )
                                })()}
                            </select>
                        </div>
                    </FieldRow>

                    {/* End year and semester count are consequences of the degree's
                        length, not questions — shown read-only so the user can see
                        the maths landed the way they expect. A degree with no
                        length on file still has to be told. */}
                    <FieldRow
                        label="End year"
                        tooltip="Filled in from the degree's length; type it yourself only when that length is missing"
                        hint={degree && !degree.durationKnown
                            ? 'This degree has no length on file — set it in Degree Management to fill this automatically.'
                            : undefined}
                    >
                        <div className={CONTROL_WIDTH}>
                            {degree?.durationKnown ? (
                                <div
                                    className="h-9 px-3 rounded-control bg-brand-50 text-brand-700 text-sm font-semibold flex items-center tabular-nums"
                                    title="Auto — start year plus the degree's length"
                                >
                                    {degree.endYear || '—'}
                                </div>
                            ) : (
                                <Input
                                    value={degree?.endYear || ''}
                                    onChange={(e) => onSetEndYear(e.target.value)}
                                    placeholder="End year"
                                    inputMode="numeric"
                                    disabled={!degree}
                                    className={`${inputCls} bg-surface disabled:bg-surface-sunken`}
                                />
                            )}
                        </div>
                    </FieldRow>

                    <FieldRow
                        label="Total semesters"
                        tooltip="Every semester this degree has, set in Degree Management; pick the ones in scope below"
                    >
                        <div className={`${CONTROL_WIDTH} flex items-center gap-3`}>
                            <div className="h-9 px-3 rounded-control bg-brand-50 text-brand-700 text-sm font-semibold flex items-center min-w-[64px] tabular-nums">
                                {semesterOptions.length || '—'}
                            </div>
                            {durationYears ? (
                                <span className="text-xs text-subtle">{durationYears} year programme</span>
                            ) : null}
                        </div>
                    </FieldRow>
                </Section>

                {/* ── Departments & sections ──────────────────────────────── */}
                {/* Before Semesters, because that is the order the data is built
                    in: a semester hangs off a department (or off one of its
                    sections), and choosing a department is what seeds them. */}
                <Section
                    title="Departments"
                    required
                    open={open.departments}
                    onToggle={toggle('departments')}
                >
                    <FieldRow
                        label="Departments"
                        required
                        tooltip="Choose the departments this mapping covers; each one gets its own course editors per semester"
                    >
                        <div className="max-w-[420px]" data-tour="sm-departments">
                            <MultiSelectPopover
                                label="Select departments…"
                                options={degree?.departmentOptions || []}
                                value={departments}
                                onToggle={(d) => (departments.includes(d) ? removeDepartment(d) : onToggleDepartment(d))}
                                onSelectAll={() => (degree?.departmentOptions || [])
                                    .filter((d) => !departments.includes(d))
                                    .forEach(onToggleDepartment)}
                                emptyLabel={`No departments set up for ${degree?.name || 'this degree'}.`}
                                disabled={!degree}
                            />
                        </div>
                    </FieldRow>

                    {pendingRemoveDept && pendingCounts && (
                        <div className="pl-1 pb-2">
                            <ConfirmInline
                                message={`Remove ${pendingRemoveDept}? Its ${pendingCounts.sections} section${pendingCounts.sections !== 1 ? 's' : ''} and ${pendingCounts.courses} course${pendingCounts.courses !== 1 ? 's' : ''} go with it.`}
                                confirmLabel="Remove"
                                onConfirm={() => { onToggleDepartment(pendingRemoveDept); setPendingRemoveDept(null) }}
                                onCancel={() => setPendingRemoveDept(null)}
                            />
                        </div>
                    )}

                    {/* Sections share this step with the departments they belong
                        to. They stay behind an opt-in tick rather than showing an
                        adder per department unconditionally: most mappings have no
                        sections, and four empty adders would be the loudest thing
                        in the step. Blue — it discloses fields, it commits nothing. */}
                    {departments.length > 0 && (
                        <FieldRow label="Sections">
                            <div data-tour="sm-sections">
                                <label className="inline-flex items-center gap-2 text-sm font-semibold text-info-700 rounded-control px-2 h-8 cursor-pointer select-none hover:bg-info-50 w-fit">
                                    <input
                                        type="checkbox"
                                        checked={sectionsOpen}
                                        onChange={(e) => setSectionsOpen(e.target.checked)}
                                        className="w-4 h-4 accent-info-700"
                                    />
                                    {sectionedCount
                                        ? `Sections (${sectionedCount} department${sectionedCount !== 1 ? 's' : ''})`
                                        : 'Sections (optional)'}
                                    <InfoTooltip content="Optional — add sections like A or B and that department's semesters hang off each section instead" />
                                </label>

                                <AnimatePresence initial={false}>
                                    {sectionsOpen && degree && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.16 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-2 space-y-2">
                                                <p className="text-2xs text-faint">
                                                    Leave a department empty to keep its semesters directly under it.
                                                </p>
                                                {departments.map((dept) => (
                                                    <div key={dept} className="flex items-start gap-2 flex-wrap">
                                                        <span className="text-xs font-semibold text-heading w-24 pt-2 flex-shrink-0 truncate">
                                                            {dept}
                                                        </span>
                                                        {/* Fixed compact width: a section name is two or
                                                            three characters, and a full-width input read
                                                            as a paragraph field. */}
                                                        <div className="w-[220px] flex-shrink-0">
                                                            <AddInline
                                                                compact
                                                                placeholder="Section name (A, B…)"
                                                                // PATH_SEP delimits every stored key, so a
                                                                // name containing it would corrupt the
                                                                // paths built from this section.
                                                                onAdd={(v) => {
                                                                    const clean = v.split(PATH_SEP).join(' ').trim()
                                                                    if (clean) onAddSection(dept, clean)
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 pt-1 min-w-0">
                                                            {(degree.sectionsFor(dept) || []).map((s) => (
                                                                <RemovableChip key={s} label={s} onRemove={() => onRemoveSection(dept, s)} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </FieldRow>
                    )}
                </Section>

                {/* ── Semesters & their dates ─────────────────────────────── */}
                {/* Semesters are set up ONE AT A TIME. The multi-select is gone:
                    every semester the degree has is listed, but only the current
                    one is editable — earlier ones are locked (already run), and the
                    next opens only once the current one's end date has passed. Its
                    start date also freezes once course setup adds a module. */}
                <Section title="Semesters" required open={open.semesters} onToggle={toggle('semesters')}>
                    <p className="text-xs text-subtle pb-1 pl-1">
                        Pick a semester to set its start and end dates. You can change the
                        current pick from the list — until course setup adds a module,
                        which locks it. A 🔒 semester is locked; hover it to see why.
                    </p>
                    {semesterOptions.length === 0 ? (
                        <p className="text-xs text-faint italic pl-1">
                            This degree has no semesters — set its length in Degree Management.
                        </p>
                    ) : (
                        <div data-tour="sm-semesters">
                            {/* ONE dropdown listing every semester. The trigger shows the
                                current one; locked options carry a 🔒 with a hover tooltip
                                explaining why; chosen ones are ticked. Picking an available
                                one reveals its date fields below. */}
                            <FieldRow label="Select semester" required={chosenSemesters.length === 0}>
                                <div className={CONTROL_WIDTH}>
                                    <SemesterSelect
                                        options={semesterOptions}
                                        statusFor={semesterStatus}
                                        value={activeSemester}
                                        onPick={onToggleSemester}
                                        placeholder="Choose a semester…"
                                    />
                                </div>
                            </FieldRow>

                            {/* Date windows for the chosen semesters — the current one is
                                editable (its start date frozen once course setup adds a
                                module); earlier chosen ones are done and read-only. */}
                            {chosenSemesters.map((sem) => {
                                const lock = semesterLock(sem)
                                const dates = semesterDateFor(sem)
                                const startError = semesterDateError(sem, 'start')
                                const endError = semesterDateError(sem, 'end')
                                return (
                                    <FieldRow key={sem} label={`Semester ${sem}`} error={startError || endError}>
                                        <div className="flex flex-wrap items-start gap-2">
                                            <div className="w-[210px]">
                                                <DateTimePicker
                                                    value={dates.start}
                                                    onChange={(iso) => onSemesterDate(sem, 'start', iso)}
                                                    minIso={minStartIso}
                                                    maxIso={dates.end || academicBounds?.max}
                                                    error={Boolean(startError)}
                                                    disabled={!lock.canEditStart}
                                                    ariaLabel={`Semester ${sem} start date`}
                                                />
                                            </div>
                                            <span className="text-xs text-faint pt-2.5">to</span>
                                            <div className="w-[210px]">
                                                <DateTimePicker
                                                    value={dates.end}
                                                    onChange={(iso) => onSemesterDate(sem, 'end', iso)}
                                                    minIso={dates.start || minStartIso}
                                                    maxIso={academicBounds?.max}
                                                    error={Boolean(endError)}
                                                    disabled={!lock.canEditEnd}
                                                    ariaLabel={`Semester ${sem} end date`}
                                                />
                                            </div>
                                            {lock.hint && (
                                                <span className="inline-flex items-center gap-1 h-[22px] px-2 mt-1.5 rounded-chip bg-warn-50 border border-warn-500/20 text-2xs font-medium text-warn-700">
                                                    <Lock size={11} className="flex-shrink-0" />
                                                    {lock.hint}
                                                </span>
                                            )}
                                        </div>
                                    </FieldRow>
                                )
                            })}

                            {academicBounds && chosenSemesters.length > 0 && (
                                <p className="text-2xs text-faint pl-1 pt-1">
                                    Dates must fall within {academicBounds.label}.
                                </p>
                            )}
                        </div>
                    )}
                </Section>

                {/* ── Course & batch allocation ───────────────────────────── */}
                {/* The last step, and a fold like every other one — it is the
                    tallest thing on the page, so being able to shut it while
                    revisiting the setup above is worth more here than anywhere.
                    Open by default: it is where the actual work happens, and the
                    walkthrough anchors inside it (a folded section unmounts its
                    content, which would strand those beats). */}
                {/* Rendered ALWAYS, degree or not. It used to disappear entirely
                    until a degree was chosen, which left the step ending at
                    Semesters and gave no sign that course allocation was even part
                    of it — the section then appeared from nowhere. Showing it from
                    the start makes the four questions a fixed, countable list. */}
                <Section
                    title="Course & batch allocation"
                    required
                    open={open.courses}
                    onToggle={toggle('courses')}
                >
                    {/* A floor, not a fixed height: the workbench no longer
                        competes with the setup for one pane, but it still needs
                        enough room that the department list and semester tabs
                        are usable rather than collapsing to a couple of rows.
                        The floor is dropped with no degree, so an empty section
                        is one line of guidance rather than a 420px void. */}
                    <div className={degree ? 'min-h-[420px]' : ''}>
                        {degree ? children : (
                            <p className="text-xs text-faint italic pl-1">
                                Pick a degree above to start allocating courses and batches.
                            </p>
                        )}
                    </div>
                </Section>
            </SectionShell>

            <FieldError message={fieldErrors.hierarchy} />
        </div>
    )
}
