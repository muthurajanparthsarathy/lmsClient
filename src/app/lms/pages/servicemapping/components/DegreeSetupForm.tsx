"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import InfoTooltip from '@/components/ui/reusabletooltip'
import DateTimePicker from '../../../shared/DateTimePicker'
import { AddInline, FieldError, RemovableChip, inputCls } from './shared/primitives'
import { ListSelect } from './shared/ListSelect'
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
    const { open, toggle, setOpen } = useSections<SectionId>(DEFAULT_OPEN)
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
    // Which departments have their section controls showing. A department that
    // ALREADY holds sections starts open — otherwise reopening a saved mapping
    // would hide real data behind an unticked box. Unticking only hides the
    // controls; the sections themselves stay, and the box ticks itself again
    // next time the form is built from them.
    const [deptSectionsOpen, setDeptSectionsOpen] = useState<Record<string, boolean>>({})

    const departments = degree?.departments || []
    const semesterOptions = degree?.semesterOptions || []
    const isDeptSectionsOpen = (dept: string): boolean =>
        deptSectionsOpen[dept] ?? (degree?.sectionsFor(dept) || []).length > 0

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
        // Same inset as the placement and flat forms — px-1 and nothing else.
        // The 70px left margin that used to sit here dated from when step 2 was
        // a label column with no container: it aligned the headers with the flat
        // form's labels. Now every section is an outlined card, and a margin that
        // wide pushed those cards off-centre and squeezed the fields inside them.
        <div ref={rootRef} className="px-1">
            <SectionShell>
                {/* ── Degree ──────────────────────────────────────────────── */}
                {/* "Degree details" over "Programme", not "Degree" over "Degree":
                    a heading and the first field under it saying the same word
                    made the label look like a repeat of the section rather than a
                    question of its own. The section supplies the "degree" half,
                    so the label does not have to. */}
                <Section title="Degree details" required open={open.degree} onToggle={toggle('degree')}>
                    <FieldRow
                        label="Programme"
                        required
                        tooltip="Pick the degree this mapping covers; it brings its own departments, semesters and length"
                    >
                        <div className={CONTROL_WIDTH} data-tour="sm-degree">
                            <ListSelect
                                value={degree?.name || ''}
                                options={degreeOptions.map((d) => ({ value: d, label: d }))}
                                onChange={(next) => { if (next) onChooseDegree(next) }}
                                placeholder="Select a degree…"
                                emptyLabel="No degrees set up yet."
                                ariaLabel="Degree"
                                searchPlaceholder="Search degrees…"
                                className="w-full"
                            />
                            {!degree && !degreesConfigured && (
                                <p className="text-2xs text-faint italic mt-1">
                                    No degrees set up yet — add them in Degree Management.
                                </p>
                            )}
                        </div>
                    </FieldRow>

                    {/* Start year and End year share a row: one is chosen, the
                        other is what that choice works out to, and reading them
                        side by side is how you check the maths landed right.
                        Total semesters follows underneath — also derived, also
                        shown rather than asked. */}
                    <FieldRow
                        label="Start year"
                        required
                        tooltip="The academic year this intake begins; the end year counts forward from the degree length"
                        error={fieldErrors.degreeStartYear}
                        hint={degree && !degree.durationKnown
                            ? 'This degree has no length on file — set it in Degree Management to fill the end year automatically.'
                            : undefined}
                    >
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            {/* A select rather than a typed field: intakes only ever
                                start in a narrow band of years. The band STARTS at
                                the current year — an intake cannot begin in a year
                                that has already gone.

                                A stored year outside the band still has to be shown,
                                or an older mapping would open with a blank field and
                                lose its saved year on the next save. How it is
                                offered depends on which way it falls out: a later
                                year is legal and stays pickable, a past one is
                                displayed but DISABLED, so it reads as "this is what
                                was saved, choose again". */}
                            <div className="w-[190px]" data-tour="sm-startyear">
                                {(() => {
                                    const now = new Date().getFullYear()
                                    const years = Array.from({ length: 6 }, (_, i) => String(now + i))
                                    const stored = degree?.startYear || ''
                                    const storedYear = parseInt(stored, 10)
                                    const isPast = Number.isFinite(storedYear) && storedYear < now
                                    const outsideBand = Boolean(stored) && !years.includes(stored)
                                    const options = [
                                        ...(outsideBand ? [{
                                            value: stored,
                                            label: isPast ? `${stored} — past year, pick again` : stored,
                                            disabled: isPast,
                                        }] : []),
                                        ...years.map((y) => ({ value: y, label: y })),
                                    ]
                                    return (
                                        <ListSelect
                                            value={degree?.startYear || ''}
                                            options={options}
                                            onChange={onSetStartYear}
                                            disabled={!degree}
                                            placeholder={degree ? 'Select year…' : 'Pick a degree first'}
                                            emptyLabel="No years available"
                                            ariaLabel="Start year"
                                            invalid={Boolean(fieldErrors.degreeStartYear)}
                                            className="w-full tabular-nums"
                                        />
                                    )
                                })()}
                            </div>

                            <div className="flex items-center gap-2.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-heading">
                                    End year
                                    <InfoTooltip content="Filled in from the degree's length; type it yourself only when that length is missing" />
                                </span>
                                <div className="w-[140px]">
                                    {degree?.durationKnown ? (
                                        // Derived, so it reads as a CLOSED field — a
                                        // greyed input the shape of every other one,
                                        // rather than the brand-tinted chip it used to
                                        // be. That chip looked like a highlighted
                                        // answer when it is really a value you cannot
                                        // set here.
                                        <Input
                                            value={degree.endYear || '—'}
                                            disabled
                                            readOnly
                                            title="Auto — start year plus the degree's length"
                                            aria-label="End year"
                                            className={`${inputCls} tabular-nums disabled:!bg-surface-sunken disabled:!text-subtle disabled:!opacity-100`}
                                        />
                                    ) : (
                                        // The one case it is a question: a degree with
                                        // no length on file has nothing to derive from,
                                        // and the hint under the row says so.
                                        <Input
                                            value={degree?.endYear || ''}
                                            onChange={(e) => onSetEndYear(e.target.value)}
                                            placeholder="End year"
                                            inputMode="numeric"
                                            disabled={!degree}
                                            aria-label="End year"
                                            className={`${inputCls} bg-surface tabular-nums disabled:bg-surface-sunken`}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </FieldRow>

                    <FieldRow
                        label="Total semesters"
                        tooltip="Every semester this degree has, set in Degree Management; pick the ones in scope below"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-[190px]">
                                <Input
                                    value={semesterOptions.length || '—'}
                                    disabled
                                    readOnly
                                    aria-label="Total semesters"
                                    title="Set in Degree Management"
                                    className={`${inputCls} tabular-nums disabled:!bg-surface-sunken disabled:!text-subtle disabled:!opacity-100`}
                                />
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
                        {/* Wider than the kit's usual control cap: every pick
                            becomes a chip INSIDE this trigger, so the field has to
                            hold several without wrapping into a paragraph. */}
                        <div className="max-w-[560px]" data-tour="sm-departments">
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

                    {/* Sections stay behind an opt-in tick rather than showing an
                        adder per department unconditionally: most mappings have no
                        sections, and four empty adders would be the loudest thing
                        in the step. Blue — it discloses fields, it commits nothing.

                        No FieldRow around it: the label column already carries a
                        "Departments" heading two rows up, and a second "Sections"
                        label beside a checkbox that says "Sections" was the same
                        word twice on one line. */}
                    {departments.length > 0 && (
                        <div className="pt-1" data-tour="sm-sections">
                            <label className="inline-flex w-fit cursor-pointer select-none items-center gap-2 rounded-control px-2 h-8 hover:bg-info-50">
                                <input
                                    type="checkbox"
                                    checked={sectionsOpen}
                                    onChange={(e) => setSectionsOpen(e.target.checked)}
                                    className="w-4 h-4 accent-info-700"
                                />
                                <span className="text-sm font-semibold text-info-700">Sections</span>
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
                                        {/* One row per department the mapping covers,
                                            indented under the tick that revealed them.
                                            A department is a checkbox of its own:
                                            ticking it opens that department's adder and
                                            nothing else, so two departments never share
                                            a row of controls. */}
                                        <div className="mt-1 space-y-1 pl-6">
                                            {departments.map((dept) => {
                                                const sections = degree.sectionsFor(dept) || []
                                                const on = isDeptSectionsOpen(dept)
                                                return (
                                                    <div key={dept}>
                                                        <label className="inline-flex w-fit cursor-pointer select-none items-center gap-2 rounded-control px-2 h-8 hover:bg-row-hover">
                                                            <input
                                                                type="checkbox"
                                                                checked={on}
                                                                onChange={(e) => setDeptSectionsOpen((prev) => ({
                                                                    ...prev,
                                                                    [dept]: e.target.checked,
                                                                }))}
                                                                className="w-4 h-4 accent-info-700"
                                                            />
                                                            {/* No truncation: a department name the user
                                                                cannot read in full is a department they
                                                                cannot tell from its neighbour. */}
                                                            <span className="text-sm font-semibold text-heading">{dept}</span>
                                                        </label>

                                                        {on && (
                                                            // Label, input, Add and the chips already added,
                                                            // all on one line — wrapping onto the next only
                                                            // when the modal is too narrow to hold them.
                                                            <div className="mb-1 ml-6 flex flex-wrap items-center gap-x-3 gap-y-2 pl-2">
                                                                <span className="text-sm font-medium text-heading">Section name</span>
                                                                <div className="w-[300px] max-w-full">
                                                                    <AddInline
                                                                        placeholder="e.g. A, B, C"
                                                                        // PATH_SEP delimits every stored key, so a
                                                                        // name containing it would corrupt the
                                                                        // paths built from this section.
                                                                        onAdd={(v) => {
                                                                            const clean = v.split(PATH_SEP).join(' ').trim()
                                                                            if (clean) onAddSection(dept, clean)
                                                                        }}
                                                                    />
                                                                </div>
                                                                {sections.map((sec) => (
                                                                    <RemovableChip
                                                                        key={sec}
                                                                        label={sec}
                                                                        onRemove={() => onRemoveSection(dept, sec)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
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
