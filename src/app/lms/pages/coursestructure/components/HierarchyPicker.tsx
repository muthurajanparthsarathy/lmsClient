"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Building2, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Code2, GraduationCap, Layers, Network, Plus, Settings2, Table2, UploadCloud, UsersRound } from 'lucide-react'
import type { ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { DataTable, type Column } from '../../../shared/listing/DataTable'
import { EmptyState } from '../../../shared/ui'
import CourseActionsMenu from './CourseActionsMenu'
import ApprovalHierarchyModal from '../../approvals/components/ApprovalHierarchyModal'
import {
    buildBatchTree, buildPhaseTree, buildTree, groupCourses, looseCourses,
    placementLabel, runsInLabel, unplacedCourses, PATH_SEP,
    type BatchNode, type CourseGroup, type DegreeNode, type PhaseFirstNode,
} from './mappingTree'
import { usePermissions } from '@/hooks/usePermissions'
import { sectionLabel } from '@/app/lms/shared/courseGroups'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

// Stage 2: the hierarchy the Map Service wizard built, with the courses already
// chosen inside each semester. Nothing is picked here — the category and course
// name are given; this screen only decides which one you are working on.
//
// Two ways to read the same data: the tree, which shows WHERE each course sits,
// and a flat table, which is faster to scan when you only care about status.
// Depth in the tree is carried by indentation, hairline connector rails and
// type size together.
// Sizes are per DEPTH — trimmed one step across the board to match the
// compact Client Management typography (base/lg heading, sm body).
const SIZE = {
    degree: 'text-sm',       // depth 1
    department: 'text-sm',   // depth 2
    semester: 'text-sm',     // depth 3
    course: 'text-sm',
}

type CourseStatus = { id: string; moduleCount: number; participantCount: number; exerciseCount?: number; courseCode: string; hasModuleHours?: boolean; hasProgramCalendar?: boolean; hasSubmissions?: boolean } | null
type ViewMode = 'tree' | 'table'

// "Degree : B.E" — naming the level means the tree reads without the reader
// having to infer depth from indentation alone.
function LevelLabel({ label, value, className }: { label: string; value: string; className: string }) {
    return (
        <span className={`${className} font-semibold text-heading truncate`}>
            <span className="text-faint font-medium">{label} : </span>
            {value}
        </span>
    )
}

function CourseCount({ n }: { n: number }) {
    return (
        <span className="text-xs text-faint flex-shrink-0">
            {n} course{n !== 1 ? 's' : ''}
        </span>
    )
}

function StatusPill({ status }: { status: CourseStatus }) {
    if (!status) {
        // Warn tone rather than brand-orange: the primary "Set up course"
        // button sits in the same row and is already orange, so the pill
        // signals attention with an amber wash to keep the row visually
        // legible instead of showing two competing orange elements.
        return (
            <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-chip bg-warn-50 text-warn-700 ring-1 ring-inset ring-warn-500/20 text-2xs font-medium whitespace-nowrap">
                <CircleAlert size={12} />
                Not set up
            </span>
        )
    }
    // "Set up" and "structured" are different milestones, and which one a course
    // has reached decides what it can do next.
    return status.moduleCount > 0 ? (
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-chip bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20 text-2xs font-medium whitespace-nowrap">
            <CircleCheck size={12} /> Ready
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-chip bg-info-50 text-info-700 ring-1 ring-inset ring-info-500/20 text-2xs font-medium whitespace-nowrap">
            <CircleCheck size={12} /> Setup done
        </span>
    )
}

function SetupButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip bg-brand-strong text-white text-2xs font-semibold hover:bg-brand-800 transition-colors flex-shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
            <Settings2 size={12} /> Set up course
        </button>
    )
}

function CourseFlowStepper({
    structured,
    total,
}: {
    structured: number
    total: number
}) {
    const steps = [
        { n: 1, title: 'Service Mapping', hint: 'Completed', icon: Check, state: 'done' },
        { n: 2, title: 'Course Structure', hint: '', icon: Layers, state: 'current' },
        { n: 3, title: 'Program Calendar', hint: 'Next', icon: CalendarDays, state: 'info' },
        { n: 4, title: 'Upload Resources', hint: 'Next', icon: UploadCloud, state: 'info' },
        { n: 5, title: 'User Enrollment', hint: 'Next', icon: UsersRound, state: 'info' },
    ]

    return (
        <div className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
                {steps.map((step, index) => {
                    const Icon = step.icon
                    const done = step.state === 'done'
                    const current = step.state === 'current'
                    return (
                        <div
                            key={step.title}
                            className={`relative flex min-w-0 items-center gap-2.5 px-3.5 py-3 border-b md:border-r md:last:border-r-0 xl:border-b-0 border-hairline ${
                                current ? 'bg-brand-wash' : done ? 'bg-success-50/60' : 'bg-surface'
                            }`}
                        >
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                done
                                    ? 'border-success-500/30 bg-surface text-success-600'
                                    : current
                                        ? 'border-brand-strong bg-surface text-brand-strong ring-2 ring-brand-500/10'
                                        : 'border-hairline bg-ink-50 text-subtle'
                            }`}>
                                {done ? <Icon size={15} strokeWidth={3} /> : step.n}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-heading">{step.title}</p>
                                {step.hint && (
                                    <p className={`mt-0.5 flex items-center gap-1 truncate text-2xs font-medium ${
                                        done ? 'text-success-600' : current ? 'text-brand-strong' : 'text-subtle'
                                    }`}>
                                        {step.hint}
                                    </p>
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <span className="pointer-events-none absolute -right-1.5 top-1/2 z-[1] hidden h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-hairline bg-inherit xl:block" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// A 1-part path is the one length the part count alone cannot name: it is a
// PHASE in the phase-first placement shape and a BATCH in the batch-first one,
// and both save the bare name. So the shape has to be handed in — `phaseFirst`
// is the phase tree having claimed this mapping, which is the same predicate
// buildPhaseTree applies. It is decided per MAPPING, not per course, so a
// phase-first course whose phase is no longer configured (it renders under
// "Not tied to a phase") is still not relabelled a batch.
//
// The 2-part shape stays ['Batch', 'Phase'] either way: that format is written
// only by the batch-first flow, so its parts really are batch-then-phase even
// in a mapping that has since moved on.
const actionBreadcrumbsFor = (course: CourseGroup, phaseFirst: boolean) => {
    const parts = course.path.split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    const labels = parts.length === 4
        ? ['Degree', 'Department', 'Section', 'Semester']
        : parts.length === 3
            ? ['Degree', 'Department', 'Semester']
            : parts.length === 2
                ? ['Batch', 'Phase']
                : parts.length === 1
                    ? [phaseFirst ? 'Phase' : 'Batch']
                    : []
    return [
        ...parts.map((part, index) => `${labels[index] || 'Level'}: ${part}`),
        `Course: ${course.courseName}`,
    ]
}

function Collapsible({
    header,
    // The tree opens as ONE step: only the outermost level (Degree) starts
    // closed. Everything inside it — Department, Section, Semester and their
    // courses — is expanded, so opening the degree reveals the whole branch.
    // Individual call sites pass `defaultOpen={false}` for the top level.
    defaultOpen = true,
    children,
}: {
    header: React.ReactNode
    defaultOpen?: boolean
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 h-8 text-left min-w-0 w-full rounded-chip px-1 -mx-1 hover:bg-row-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                aria-expanded={open}
            >
                <ChevronRight
                    size={15}
                    strokeWidth={2.5}
                    className={`text-ink-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
                {header}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        {/* ~20px per level: 4px margin + 15px indent under the
                            connector rail keeps the hierarchy compact. */}
                        <div className="ml-1 border-l border-hairline pl-4">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// A course as the top level of the non-degree hierarchy: identity and the one
// Setup Course button on the row itself, with the batches it runs in folded
// underneath. The chevron is its own button rather than wrapping the row,
// because the row already contains a button and nesting them is invalid.
function CourseWithBatches({
    course,
    batchLabels,
    status,
    actions,
}: {
    course: CourseGroup
    batchLabels: string[]
    status: CourseStatus
    actions: React.ReactNode
}) {
    // Open by default — only the Degree level starts closed; everything
    // beneath a course row (its batches, its phases) is expanded on load.
    const [open, setOpen] = useState(true)
    return (
        <div>
            <div className="flex items-center gap-2 py-1.5 rounded-chip hover:bg-row-hover transition-colors">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-label={open ? 'Hide batches' : 'Show batches'}
                    className="flex-shrink-0 p-0.5 rounded-chip hover:bg-row-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                    <ChevronRight
                        size={15}
                        strokeWidth={2.5}
                        className={`text-ink-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                </button>
                <span className="h-6 w-6 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={13} className="text-ink-600" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${SIZE.course} font-semibold text-heading truncate`}>
                            {course.courseName}
                            {status?.courseCode && (
                                <span className="text-faint font-normal"> ({status.courseCode})</span>
                            )}
                        </span>
                        <StatusPill status={status} />
                    </div>
                    <p className="text-xs text-faint mt-0.5 truncate">
                        Runs in {batchLabels.length} batch{batchLabels.length !== 1 ? 'es' : ''}
                        {' · '}one setup covers them all
                    </p>
                </div>

                {actions}
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="ml-1 border-l border-hairline pl-4">
                            {batchLabels.map((b) => (
                                <div key={b} className="flex items-center gap-2 py-1">
                                    <span className="h-5 w-5 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                        <Layers size={11} className="text-ink-600" />
                                    </span>
                                    <span className="text-sm text-heading truncate">
                                        <span className="text-faint font-semibold">Batch : </span>
                                        <span className="font-semibold">{b}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * A row with something nested under it, and a chevron that folds it away.
 *
 * CourseWithBatches already does this for the batch tree; the phase-first
 * shape (Placement Training: one course, its phases, their batches) rendered
 * its phases as a block that was always open, so the same screen had courses
 * that collapsed and courses that did not. This carries just the open/closed
 * state so both shapes behave the same way, with the row free to draw itself.
 *
 * Top-level on purpose: a component declared inside another component's body
 * is a NEW type on every render, and React would throw its state away.
 */
function Expandable({
    // Open by default: only the Degree tier at the top of the tree starts
    // collapsed; the phase list under a Placement Training course opens
    // together with the row.
    defaultOpen = true,
    row,
    children,
}: {
    defaultOpen?: boolean
    /** Draws the header row; gets the current state and the toggle to render
     *  its own chevron wherever it belongs in the row. */
    row: (open: boolean, toggle: () => void) => React.ReactNode
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div>
            {row(open, () => setOpen((o) => !o))}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Where a Course Actions card leaves word that its modal should come back.
//
// Every card navigates to its own route, and those routes go "back" in three
// different ways — router.back() on the Program Calendar, a hardcoded push on
// Feedback and Participants, a plain <Link> on the course structure page. A
// return URL would have to be threaded through all of them. A note in
// sessionStorage costs none of that and is read the same way whichever route
// the user came back by, including the browser's own Back button.
const REOPEN_KEY = 'courseActions.reopenFor'
// Long enough to cover a real detour into one of those pages, short enough
// that a note left behind and forgotten cannot pop a modal out of nowhere.
const REOPEN_TTL_MS = 15 * 60 * 1000

function rememberReopenIntent(courseId: string) {
    try {
        sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ courseId, at: Date.now() }))
    } catch {
        // Private mode / storage disabled: the modal just won't reopen.
    }
}

/** Reads the note and clears it — it is good for exactly one return. */
function consumeReopenIntent(): string | null {
    try {
        const raw = sessionStorage.getItem(REOPEN_KEY)
        if (!raw) return null
        sessionStorage.removeItem(REOPEN_KEY)
        const note = JSON.parse(raw) as { courseId?: string; at?: number }
        if (!note?.courseId || !note.at || Date.now() - note.at > REOPEN_TTL_MS) return null
        return note.courseId
    } catch {
        return null
    }
}

// ONE service mapping's courses. This is the whole screen as it was before the
// list grouped by client — unchanged except that the client-level chrome (Back
// to clients, the client name) moved up to HierarchyPicker, which now renders
// one of these per service the client holds.
//
// `statusFor`, `onSetup` and `onView` still take a course, not a mapping: the
// parent pre-binds this section's mapping before handing them down, so every
// call site inside this body stays exactly as it was.
function MappingSection({
    mapping,
    view,
    statusFor,
    onBack,
    onSetup,
    onView,
    onProgramCalendar,
    onCourseStructure,
    onCourseResources,
    onCourseEnrollment,
    openActionsForCourseId,
}: {
    mapping: ServiceMapping
    /** Owned by the parent: the toggle sits in the section's collapsible
     *  header, which the parent renders. */
    view: ViewMode
    statusFor: (courseName: string, coursePath: string) => CourseStatus
    onBack: () => void
    onSetup: (course: CourseGroup) => void
    onView: (course: CourseGroup) => void
    onProgramCalendar: (courseId: string) => void
    onCourseStructure: (courseId: string) => void
    onCourseResources: (courseId: string) => void
    onCourseEnrollment: (courseId: string) => void
    // The course whose Course Actions modal should be open on arrival — set
    // when the user came back here from that course's setup panel.
    openActionsForCourseId?: string | null
}) {
    // Which course's Course Actions modal should be open right now. Three
    // things write to it, and the menu opens on the flip to its own id: the
    // page's hand-off when the user backs out of the setup panel (seeded
    // below), the sessionStorage note left by a card that navigated away, and
    // the Set Approval tile handing control back after its dialog closes.
    const [autoOpenActionsId, setAutoOpenActionsId] = useState<string | null>(openActionsForCourseId ?? null)
    // The note is consumed in an effect rather than a useState initializer:
    // clearing it is a side effect, and StrictMode runs initializers twice —
    // the second pass would find it already gone.
    const noteReadRef = useRef(false)
    useEffect(() => {
        if (noteReadRef.current) return
        noteReadRef.current = true
        const noted = consumeReopenIntent()
        if (noted) setAutoOpenActionsId((current) => current ?? noted)
    }, [])

    // Local state for the "Set Approval" modal — the ApprovalHierarchyModal
    // is a single mount per hierarchy page. Row actions just set which course
    // it should open with.
    const [approvalFor, setApprovalFor] = useState<{ id: string; name: string } | null>(null)
    // The Setup Course button (first-time setup for a "Not set up" course) is
    // shown when the signed-in admin holds ANY Course Management → Manage
    // functionality — Add Course was removed from the tree, so gating on a
    // single fn would keep this button permanently hidden. Any of View Course
    // Details / Edit Course / Add Course Structure / Upload Resources /
    // Program Calendar / Enrollment / Feedback is enough to enable it.
    const { can } = usePermissions()
    const MANAGE_FUNCTIONS = [
        'View Course Details',
        'Edit Course',
        'Add Course Structure',
        'Upload Resources',
        'Program Calendar',
        'Enrollment',
        'Feedback',
    ]
    const canAddCourse = MANAGE_FUNCTIONS.some((fn) =>
        can(PERMISSION_IDS.ADMIN_COURSE_MANAGEMENT, fn),
    )
    const groups = useMemo(() => groupCourses(mapping), [mapping])
    const tree: DegreeNode[] = useMemo(() => buildTree(groups), [groups])
    const unplaced = useMemo(() => unplacedCourses(groups), [groups])

    // Which hierarchy this mapping actually has. Degree Program puts courses in
    // semesters; every other flow puts them against batches, which may run in
    // phases. Both are rendered the same way — only the level names differ.
    // Mappings older than `batchConfigs` still name their batches in masterData,
    // so that list is handed over as the fallback rather than letting them render
    // as having no structure.
    const masterBatchNames = useMemo(
        () => (mapping.masterData || [])
            .filter((m) => m.level === 'Batch' && !m.group)
            .flatMap((m) => m.values || []),
        [mapping.masterData]
    )
    // The NEW placement shape: Phase → one course → that course's own batches.
    // buildPhaseTree recognises it itself (empty batchConfigs plus Phase master
    // data or per-course batches) and yields nothing for every other shape.
    const phaseTree: PhaseFirstNode[] = useMemo(
        () => buildPhaseTree(mapping, groups),
        [mapping, groups]
    )

    // Placement Training runs ONE course across several phases — it is not a
    // different course each phase. buildPhaseTree answers per phase, which the
    // screen used to render literally: the same course appeared once under each
    // phase, each row carrying its own "Setup Course". That read as two courses
    // to set up when there is only one.
    //
    // So the phases are folded back into the course they belong to. Which phase
    // you work on is chosen inside Course Structure and Program Calendar, where
    // the work is actually per phase — not here, where the question is only
    // whether the course has been set up.
    const phaseCourses = useMemo(() => {
        const byCourse = new Map<string, { name: string; phases: PhaseFirstNode[] }>()
        phaseTree.forEach((node) => {
            if (!node.phase) return
            const key = node.course.courseName.trim().toLowerCase()
            const entry = byCourse.get(key) || { name: node.course.courseName, phases: [] }
            entry.phases.push(node)
            byCourse.set(key, entry)
        })
        return [...byCourse.values()]
    }, [phaseTree])
    // A mapping with phases switched off has no phase level at all; its course
    // still renders directly.
    const unphasedCourses = useMemo(() => phaseTree.filter((n) => !n.phase), [phaseTree])
    // A phase-first mapping still writes batch names into masterData for legacy
    // readers, and those names are exactly what the batch tree's fallback feeds
    // on — so once the phase tree claims the mapping, the batch tree must not
    // also build from the same data.
    const batchTree: BatchNode[] = useMemo(
        () => (unplaced.length && !phaseTree.length
            ? buildBatchTree(mapping.batchConfigs, unplaced, masterBatchNames)
            : []),
        [mapping.batchConfigs, unplaced, masterBatchNames, phaseTree]
    )
    // Courses that belong to no hierarchy at all. Asked of the built trees rather
    // than assumed from their emptiness, because a mapping can now have batches
    // or phases that some of its courses simply do not belong to.
    const loose = useMemo(() => {
        if (phaseTree.length) {
            const shown = new Set(phaseTree.map((n) => n.course.key))
            return unplaced.filter((g) => !shown.has(g.key))
        }
        return looseCourses(unplaced, batchTree)
    }, [unplaced, batchTree, phaseTree])

    // The batch tree keyed by COURSE instead of by batch: one entry per course
    // with every batch (and phase) it runs in. buildBatchTree spreads a pathless
    // course across every configured batch, so this is also the only place that
    // knows the real batch list for such a course.
    const courseFirst = useMemo(() => {
        const byCourse = new Map<string, { course: CourseGroup; batchLabels: string[]; batchNames: string[] }>()
        batchTree.forEach((b) => {
            b.phases.forEach((ph) => {
                ph.courses.forEach((c) => {
                    const entry = byCourse.get(c.key) || { course: c, batchLabels: [], batchNames: [] }
                    const label = ph.phase ? `${b.batch} · ${ph.phase}` : b.batch
                    if (!entry.batchLabels.includes(label)) entry.batchLabels.push(label)
                    if (!entry.batchNames.includes(b.batch)) entry.batchNames.push(b.batch)
                    byCourse.set(c.key, entry)
                })
            })
        })
        return Array.from(byCourse.values())
    }, [batchTree])

    // The batches a course really runs in. A course placed by the batch tree
    // carries none on itself (empty path, no per-course batches), so without
    // this the setup form is handed [] and never offers "Resources by batch".
    const effectiveBatches = useMemo(() => {
        const m = new Map<string, string[]>()
        courseFirst.forEach((n) => m.set(n.course.key, n.batchNames))
        return m
    }, [courseFirst])

    const withBatches = (course: CourseGroup): CourseGroup => {
        if (course.batches.length) return course
        const fromTree = effectiveBatches.get(course.key)
        return fromTree?.length ? { ...course, batches: fromTree } : course
    }

    // Keep the section and batch dimensions in their own columns. Department-
    // level courses inherit both from studentGroups; section-level courses get
    // their section from the mapping path and batches from the course itself.
    const rowSections = (course: CourseGroup): string[] => {
        const sections = course.sectionGroups.length
            ? course.sectionGroups.map((group) => sectionLabel(group.section))
            : course.placements.map((placement) => placement.section)
                .filter((section): section is string => Boolean(section))
                .map(sectionLabel)
        return Array.from(new Set(sections))
    }
    const rowBatches = (course: CourseGroup): string[] => course.sectionGroups.length
        ? Array.from(new Set(course.sectionGroups.flatMap((group) => group.batches).filter(Boolean)))
        : course.batches

    const clientName = typeof mapping.client === 'string' ? '' : mapping.client?.clientCompany || 'Client'
    const configured = groups.filter((g) => statusFor(g.courseName, g.path)).length
    const structured = groups.filter((g) => (statusFor(g.courseName, g.path)?.moduleCount || 0) > 0).length

    // A course can sit under more than one node (the batch tree repeats it,
    // which is what `alsoIn` names), so only the FIRST row that matches is
    // allowed to auto-open — otherwise backing out of that course would stack
    // two identical dialogs. A plain let, not a ref: it must reset on every
    // render pass, and it is only ever read at mount anyway.
    let autoOpenClaimed = false
    const actionsFor = (course: CourseGroup) => {
        const status = statusFor(course.courseName, course.path)
        if (status) {
            const autoOpen = !autoOpenClaimed && Boolean(autoOpenActionsId) && autoOpenActionsId === status.id
            if (autoOpen) autoOpenClaimed = true
            // CourseActionsMenu filters its own items and returns null when
            // the user is granted none of them — no wrapper check needed here.
            return (
            <CourseActionsMenu
                status={status}
                autoOpen={autoOpen}
                onBeforeNavigate={() => rememberReopenIntent(status.id)}
                breadcrumbs={actionBreadcrumbsFor(course, phaseTree.length > 0)}
                onView={() => onView(withBatches(course))}
                    onEdit={() => onSetup(withBatches(course))}
                    onStructure={() => onCourseStructure(status.id)}
                    onResources={() => onCourseResources(status.id)}
                    onCalendar={() => onProgramCalendar(status.id)}
                    onEnrollment={() => onCourseEnrollment(status.id)}
                    // Clearing the signal first matters: the menu opens on the
                    // flip to this id, so without a false in between, setting
                    // the same id a second time would not register and the
                    // modal would stay shut on the second visit.
                    onApproval={() => {
                        setAutoOpenActionsId(null)
                        setApprovalFor({ id: status.id, name: course.courseName })
                    }}
                />
            )
        }
        // "Setup Course" is the first-time save — hidden entirely for users
        // without Add Course.
        return canAddCourse ? <SetupButton onClick={() => onSetup(withBatches(course))} /> : null
    }

    // `alsoIn` names the OTHER nodes this same course appears under. The degree
    // tree can work them out from the course alone, but the batch tree cannot —
    // which of its placements is "this row" depends on the node rendering it — so
    // it passes the list in.
    const CourseRow = ({ course, alsoIn, sections, batches, expandable, open, onToggle }: {
        course: CourseGroup
        alsoIn?: string[]
        sections?: string[]
        batches?: string[]
        /** Set when the row has phases nested under it — draws the chevron that
         *  folds them away. Rows with nothing nested get an invisible spacer of
         *  the same width instead, so every course name in the section still
         *  starts at the same x. */
        expandable?: boolean
        open?: boolean
        onToggle?: () => void
    }) => {
        const others = alsoIn ?? course.placements.slice(1).map(placementLabel)
        const status = statusFor(course.courseName, course.path)
        return (
            // Columnar row aligned to the semester's table header. Fixed column
            // widths on ≥sm keep Course/Section/Batches/Status/Action lined up
            // across every row. On mobile the flex wrap stacks the fields, each
            // with its own inline label so the information stays clear.
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 border-b border-hairline last:border-b-0 py-2 pl-1 pr-2 transition-colors hover:bg-row-hover sm:flex-nowrap sm:items-center">
                {expandable ? (
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={open}
                        aria-label={open ? 'Hide phases' : 'Show phases'}
                        className="-mr-1 flex-shrink-0 p-0.5 rounded-chip hover:bg-row-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                    >
                        <ChevronRight
                            size={15}
                            strokeWidth={2.5}
                            className={`text-ink-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                        />
                    </button>
                ) : (
                    <span className="-mr-1 flex-shrink-0 w-[20px]" aria-hidden />
                )}
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
                    <Code2 size={13} />
                </span>
                {/* Course column — most space; name never truncates against
                    other columns because those have fixed widths on ≥sm. */}
                <div className="min-w-0 flex-1">
                    <span className={`${SIZE.course} font-semibold text-heading block truncate`}>
                        {course.courseName}
                        {status?.courseCode && (
                            <span className="text-faint font-normal"> ({status.courseCode})</span>
                        )}
                    </span>
                    {others.length > 0 && (
                        <p className="text-xs text-faint mt-0.5 truncate">
                            Also in {others.join(', ')}
                        </p>
                    )}
                </div>
                {/* Section column */}
                <div className="flex items-center gap-1 flex-wrap shrink-0 sm:w-[130px]">
                    <span className="sm:hidden text-2xs text-faint font-semibold uppercase mr-0.5">Section:</span>
                    {sections && sections.length > 0 ? sections.map((section) => (
                        <span
                            key={section}
                            className="inline-flex items-center h-[20px] px-2 rounded-chip bg-ink-50 border border-hairline text-ink-700 text-2xs font-medium"
                        >
                            {section}
                        </span>
                    )) : (
                        <span className="text-2xs text-line-muted" aria-label="No section">—</span>
                    )}
                </div>
                {/* Batches column — batch names only, never combined with sections. */}
                <div className="flex items-center gap-1 flex-wrap shrink-0 sm:w-[180px]">
                    <span className="sm:hidden text-2xs text-faint font-semibold uppercase mr-0.5">Batches:</span>
                    {batches && batches.length > 0 ? (
                        batches.map((b) => (
                            <span
                                key={b}
                                className="inline-flex items-center h-[20px] px-2 rounded-chip bg-ink-50 border border-hairline text-ink-700 text-2xs font-medium"
                            >
                                {b}
                            </span>
                        ))
                    ) : (
                        <span className="text-2xs text-line-muted" aria-label="No batches">—</span>
                    )}
                </div>
                {/* Status column */}
                <div className="shrink-0 sm:w-[110px] flex items-center gap-1.5">
                    <span className="sm:hidden text-2xs text-faint font-semibold uppercase">Status:</span>
                    <StatusPill status={status} />
                </div>
                {/* Action column */}
                <div className="shrink-0 sm:w-[130px] flex sm:justify-end items-center gap-1.5">
                    <span className="sm:hidden text-2xs text-faint font-semibold uppercase">Action:</span>
                    {actionsFor(course)}
                </div>
            </div>
        )
    }

    // Flat view — column widths as percentages summing to 100 so `fixedLayout`
    // fills the container with no horizontal scrollbar; long values truncate
    // with the full text in the tooltip.
    const tableColumns: Column<CourseGroup>[] = [
        {
            key: 'sno',
            label: '#',
            className: 'w-[4%] pl-4 sm:pl-5 pr-2 text-left',
            skeletonWidth: '20px',
            render: (_c, i) => <span className="text-xs text-faint tabular-nums">{i + 1}</span>,
        },
        {
            key: 'course',
            label: 'Course Name',
            className: 'w-[30%] px-3 text-left',
            render: (c) => {
                const code = statusFor(c.courseName, c.path)?.courseCode
                return (
                    <span
                        className="text-[12px] font-medium text-heading truncate block"
                        title={code ? `${c.courseName} (${code})` : c.courseName}
                    >
                        {c.courseName}
                        {code && <span className="text-faint font-normal"> ({code})</span>}
                    </span>
                )
            },
        },
        {
            key: 'category',
            label: 'Category',
            className: 'w-[16%] px-3 text-left',
            render: (c) => (
                c.category
                    ? <span className="block truncate text-[12px] text-body" title={c.category}>{c.category}</span>
                    : <span className="text-xs text-line-muted">—</span>
            ),
        },
        {
            key: 'runs',
            label: 'Runs In',
            className: 'w-[26%] px-3 text-left',
            render: (c) => {
                const text = runsInLabel(c, batchTree, phaseTree)
                return <span className="text-[12px] text-body truncate block" title={text}>{text}</span>
            },
        },
        {
            key: 'status',
            label: 'Status',
            className: 'w-[10%] px-3 text-left',
            render: (c) => <StatusPill status={statusFor(c.courseName, c.path)} />,
        },
        {
            key: 'actions',
            label: 'Actions',
            className: 'w-[14%] pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap',
            skeletonWidth: '90px',
            render: (c) => actionsFor(c),
        },
    ]

    return (
        // Tight gutters — the list uses the full workspace width instead of
        // being caged inside a 1680 px max container with wide side margins.
        <div className="space-y-3">

            {/* CourseFlowStepper (Service Mapping → Course Structure →
                Program Calendar → Upload Resources → User Enrollment) was
                removed 2026-08-30 per user request — the 5-step navigation
                bar duplicated context the sidebar already provides. The
                component definition is kept in this file (unused) so we
                can restore it easily if the decision reverses. */}

            {/* A mapping with no courses renders NOTHING. Several mappings can
                share one service header (same service, models and year), so the
                "No courses in this mapping" card used to sit at the top of a
                section that plainly did have courses — the empty one belonged
                to a sibling mapping. The card said the section was empty while
                the courses under it said otherwise. The client-level empty
                state ("No services mapped for this client") still covers the
                case where there is genuinely nothing to show. */}
            {groups.length === 0 ? null : view === 'table' ? (
                // Flat listing — no card border, matching Client Management.
                <div>
                    <DataTable<CourseGroup>
                        rows={groups}
                        columns={tableColumns}
                        rowKey={(c) => c.key}
                        sortKey={null}
                        sortDir="asc"
                        onSort={() => { /* the list is short and already ordered by the hierarchy */ }}
                        isLoading={false}
                        isFiltered={false}
                        emptyTitle="No courses in this mapping"
                        emptyHint="Add them in Map Service first."
                        emptyAction="Back to clients"
                        onEmptyAction={onBack}
                        fixedLayout
                        maxHeight="calc(100vh - 300px)"
                    />
                </div>
            ) : (
                // Still a card — surface, rounded corners, its own soft shadow —
                // but no outline. The rows inside already draw their own border on
                // hover, so the fixed hairline around every mapping stacked a
                // second rectangle inside the section's own border and made a
                // client with several mappings read as a grid of boxes.
                <div className="bg-surface rounded-xl shadow-xs px-3 sm:px-4 py-3 space-y-0">
                    {tree.map((deg) => (
                        <Collapsible
                            key={deg.degree}
                            defaultOpen={false}
                            header={
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-6 w-6 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                        <GraduationCap size={14} className="text-ink-600" />
                                    </span>
                                    <LevelLabel label="Degree" value={deg.degree} className={SIZE.degree} />
                                </span>
                            }
                        >
                            {deg.departments.map((dept) => (
                                <Collapsible
                                    key={dept.department}
                                    header={
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="h-6 w-6 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                                <Building2 size={13} className="text-ink-600" />
                                            </span>
                                            <LevelLabel label="Department" value={dept.department} className={SIZE.department} />
                                        </span>
                                    }
                                >
                                    {dept.sections.map((sec) => {
                                        const semesters = sec.semesters.map((sem) => (
                                            <Collapsible
                                                key={sem.semester}
                                                header={
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        <span className="h-6 w-6 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                                            <CalendarDays size={13} className="text-ink-600" />
                                                        </span>
                                                        <LevelLabel label="Semester" value={sem.semester} className={SIZE.semester} />
                                                        <CourseCount n={sem.courses.length} />
                                                    </span>
                                                }
                                            >
                                                {/* Table header for this semester's course list.
                                                    Widths match CourseRow's column widths exactly so
                                                    Course/Section/Batches/Status/Action stack in the same
                                                    positions as the rows below. Desktop-only — on
                                                    mobile the rows carry inline field labels. */}
                                                <div className="hidden sm:flex items-center gap-x-3 border-b border-hairline px-1 py-1.5 text-2xs font-semibold uppercase tracking-wide text-faint">
                                                    <span className="w-[20px] flex-shrink-0" aria-hidden />
                                                    <span className="w-7 flex-shrink-0" aria-hidden />
                                                    <span className="flex-1 min-w-0">Course</span>
                                                    <span className="w-[130px] flex-shrink-0">Section</span>
                                                    <span className="w-[180px] flex-shrink-0">Batches</span>
                                                    <span className="w-[110px] flex-shrink-0">Status</span>
                                                    <span className="w-[130px] flex-shrink-0 text-right">Action</span>
                                                </div>
                                                {sem.courses.map((c) => <CourseRow key={c.key} course={c} sections={rowSections(c)} batches={rowBatches(c)} />)}
                                            </Collapsible>
                                        ))
                                        // A department without sections shows its
                                        // semesters directly — inventing an empty
                                        // section level would misrepresent the data.
                                        return sec.section ? (
                                            <Collapsible
                                                key={sec.section}
                                                header={
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        <span className="h-6 w-6 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                                            <UsersRound size={13} className="text-ink-600" />
                                                        </span>
                                                        <LevelLabel label="Section" value={sec.section} className={SIZE.semester} />
                                                    </span>
                                                }
                                            >
                                                {semesters}
                                            </Collapsible>
                                        ) : (
                                            <React.Fragment key="no-section">{semesters}</React.Fragment>
                                        )
                                    })}
                                </Collapsible>
                            ))}
                        </Collapsible>
                    ))}

                    {/* Placement Training and the other non-degree flows.
                        COURSE FIRST: one row per course carrying the single
                        Setup Course button, with the batches it runs in nested
                        underneath and collapsible. A course is set up once no
                        matter how many batches it runs in, so showing it once
                        with its batches as children matches how it is actually
                        configured (and how the Table view already reads). */}
                    {courseFirst.map((node) => (
                        <CourseWithBatches
                            key={node.course.key}
                            course={node.course}
                            batchLabels={node.batchLabels}
                            status={statusFor(node.course.courseName, node.course.path)}
                            actions={actionsFor(node.course)}
                        />
                    ))}

                    {/* Placement Training: ONE course row, with the phases it
                        runs in listed beneath it and their batches beside them.
                        One row means one "Setup Course" — setting the course up
                        covers every phase it runs in. */}
                    {phaseCourses.map((entry) => {
                        // Each phase is its own setup record, so the row speaks
                        // for the one that exists; a course not set up anywhere
                        // falls back to the first phase, which is the record the
                        // setup will create.
                        const setUp = entry.phases.find((p) => statusFor(p.course.courseName, p.course.path))
                        const primary = (setUp || entry.phases[0]).course
                        return (
                            // Folds like the batch-tree rows do — the phases used
                            // to be pinned open while every other course on the
                            // screen could be collapsed.
                            <Expandable
                                key={entry.name}
                                row={(open, toggle) => (
                                    <CourseRow
                                        course={primary}
                                        expandable
                                        open={open}
                                        onToggle={toggle}
                                    />
                                )}
                            >
                                <div className="ml-[32px] border-l border-hairline pl-4 pb-1">
                                    {entry.phases.map((p, i) => (
                                        <div key={`${p.phase}-${i}`} className="flex flex-wrap items-center gap-2 py-1">
                                            <span className="h-5 w-5 rounded-chip bg-ink-50 flex items-center justify-center flex-shrink-0">
                                                <Layers size={11} className="text-ink-600" />
                                            </span>
                                            <LevelLabel label="Phase" value={p.phase as string} className={SIZE.degree} />
                                            {p.batches.length > 0 && (
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-2xs text-faint font-medium">Batches:</span>
                                                    {p.batches.map((b) => (
                                                        <span
                                                            key={b}
                                                            className="inline-flex items-center h-[20px] px-2 rounded-chip bg-ink-50 border border-hairline text-ink-700 text-2xs font-medium"
                                                        >
                                                            {b}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Expandable>
                        )
                    })}
                    {unphasedCourses.map((node, i) => (
                        <React.Fragment key={`no-phase-${i}`}>
                            <CourseRow course={node.course} batches={node.batches} />
                        </React.Fragment>
                    ))}

                    {/* In no semester, under no batch, and in no phase — nothing
                        to nest these under, so they stand on their own rather
                        than vanishing. */}
                    {loose.length > 0 && (() => {
                        const nested = tree.length > 0 || batchTree.length > 0 || phaseTree.length > 0
                        return (
                            <div className={nested ? 'pt-3 mt-2 border-t border-hairline' : ''}>
                                {nested && (
                                    <p className="text-2xs font-semibold uppercase tracking-wider text-faint pb-1">
                                        {batchTree.length > 0
                                            ? 'Not tied to a batch'
                                            : phaseTree.length > 0
                                                ? 'Not tied to a phase'
                                                : 'Not tied to a semester'}
                                    </p>
                                )}
                                {loose.map((c) => <CourseRow key={c.key} course={c} sections={rowSections(c)} batches={rowBatches(c)} />)}
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* Approval chain modal — opened from any course's Actions menu.
                Same modal the retired /approvals page mounted; passing the
                course id + name pins it to this course. */}
            {approvalFor && (
                <ApprovalHierarchyModal
                    open
                    // Closing the approval dialog puts the Course Actions
                    // modal back, rather than dropping the user on the tree.
                    onClose={() => {
                        const courseId = approvalFor.id
                        setApprovalFor(null)
                        setAutoOpenActionsId(courseId)
                    }}
                    courseId={approvalFor.id}
                    courseName={approvalFor.name}
                    clientName={clientName}
                />
            )}
        </div>
    )
}

/**
 * A CLIENT's course setup: one collapsible section per service it holds.
 *
 * The list groups by client now, so Manage arrives with a client rather than a
 * mapping and this has to show every service that client runs. The per-service
 * screen is unchanged — it moved wholesale into MappingSection above — and what
 * lives here is only what the client level owns: the Back link, the client
 * name, and the sections.
 *
 * `statusFor` takes a mapping id because a course name is only unique WITHIN a
 * service: the same course under two services is two separate setups, and
 * binding each section to its own id is what keeps them apart.
 */
export default function HierarchyPicker({
    mappings,
    isLoading,
    focusMappingId,
    statusFor,
    onBack,
    onSetup,
    onView,
    onProgramCalendar,
    onCourseStructure,
    onCourseResources,
    onCourseEnrollment,
    openActionsForCourseId,
}: {
    mappings: ServiceMapping[]
    isLoading?: boolean
    /** Expand and scroll to this service — how a ?openMappingId link lands. */
    focusMappingId?: string | null
    statusFor: (mappingId: string, courseName: string, coursePath: string) => CourseStatus
    onBack: () => void
    onSetup: (mapping: ServiceMapping, course: CourseGroup) => void
    onView: (mapping: ServiceMapping, course: CourseGroup) => void
    onProgramCalendar: (courseId: string) => void
    onCourseStructure: (courseId: string) => void
    onCourseResources: (courseId: string) => void
    onCourseEnrollment: (courseId: string) => void
    openActionsForCourseId?: string | null
}) {
    // Every service section starts CLOSED — the client header shows the shared
    // category and total-configured pill up top, so the tree stays quiet until
    // the reader opens the service they care about. State tracks what the user
    // has EXPANDED (inverse of the old collapsed set) so nothing pops open on
    // its own after a refetch.
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    // ONE switch for the screen: it sits in the client header and every section
    // follows it. A per-service toggle meant the same control repeated down the
    // page with nothing to say which one was in charge.
    const [view, setView] = useState<ViewMode>('tree')
    const focusRef = useRef<HTMLDivElement | null>(null)

    // A deep link names one service; bring it into view once it has rendered.
    useEffect(() => {
        if (!focusMappingId || !focusRef.current) return
        focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [focusMappingId, mappings.length])

    const clientName = (() => {
        const m = mappings[0]
        if (!m) return 'Client'
        return typeof m.client === 'string' ? 'Client' : m.client?.clientCompany || 'Client'
    })()

    // When every service under this client shares the same category
    // (e.g. "Business to Institution"), lift it OUT of each service heading
    // and show it once beside the client name — repeating the same phrase in
    // three headers below "KIOT College" was pure noise. When the client's
    // services span more than one category, this stays null and each service
    // heading keeps its own category prefix.
    const sharedCategory = (() => {
        if (!mappings.length) return null
        const values = mappings.map((m) => (m.service || '').trim())
        // Every mapping must NAME a category, and every one must name the
        // same one. A single blank slips the shared line off the client
        // header (nothing to hoist) so each service still prints its own.
        if (values.some((v) => !v)) return null
        return new Set(values).size === 1 ? values[0] : null
    })()

    const toggle = (id: string) => setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })

    // Services that read identically — same service, same models, same year —
    // are ONE section. A client can hold several mappings with that same
    // signature (a second intake, a re-map), and rendering them separately gave
    // two headers with the same words and no way to tell which held what. They
    // are merged here and their courses listed together.
    //
    // The mappings themselves stay separate inside: each carries its own
    // masterData / batchConfigs / hierarchy, and a course's setup identity is
    // keyed by MAPPING id — so they are rendered as one MappingSection each,
    // under one shared header, rather than flattened into a synthetic mapping.
    //
    // The label DROPS the service category (m.service) when it is already
    // shown at client level. When categories are mixed across services, the
    // category stays in each heading so the reader can tell which is which.
    const serviceGroups = (() => {
        const bySignature = new Map<string, { label: string; mappings: ServiceMapping[] }>()
        mappings.forEach((m) => {
            const parts = [
                sharedCategory ? '' : m.service,
                (m.serviceModels || []).join(' · '),
                m.year,
            ].filter(Boolean)
            const label = parts.join(' · ') || 'Service'
            const entry = bySignature.get(label) ?? { label, mappings: [] }
            entry.mappings.push(m)
            bySignature.set(label, entry)
        })
        return Array.from(bySignature.values())
    })()

    // One pair of numbers for the whole client, summed across its services —
    // the pill and the view switch belong to the screen, not to each section,
    // so repeating them per service was just noise.
    let configuredTotal = 0
    let courseTotal = 0
    mappings.forEach((m) => {
        const id = String(m._id)
        const groups = groupCourses(m)
        courseTotal += groups.length
        configuredTotal += groups.filter((g) => statusFor(id, g.courseName, g.path)).length
    })

    return (
        <div className="px-3 sm:px-4 pt-3 pb-3 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-heading transition-colors"
                    >
                        <ArrowLeft size={13} /> Back to clients
                    </button>
                    <h1 className="mt-1 text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                        {clientName}
                    </h1>
                    {!isLoading && mappings.length > 0 && (
                        <p className="text-xs text-subtle mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {sharedCategory && (
                                <>
                                    <span className="font-medium text-body">{sharedCategory}</span>
                                    <span aria-hidden="true" className="text-faint">·</span>
                                </>
                            )}
                            <span>
                                {mappings.length} service{mappings.length === 1 ? '' : 's'}
                            </span>
                        </p>
                    )}
                </div>

                {!isLoading && mappings.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs text-subtle">
                            <CircleCheck size={12} className="text-success-500" />
                            {configuredTotal} of {courseTotal} course{courseTotal === 1 ? '' : 's'} set up
                        </span>
                        <div className="inline-flex rounded-control border border-hairline-strong bg-surface overflow-hidden">
                            {([
                                { key: 'tree' as const, label: 'Hierarchy', icon: <Network size={12} /> },
                                { key: 'table' as const, label: 'Table', icon: <Table2 size={12} /> },
                            ]).map((v) => (
                                <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => setView(v.key)}
                                    aria-pressed={view === v.key}
                                    className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium transition-colors ${
                                        view === v.key
                                            ? 'bg-brand-strong text-white'
                                            : 'text-body hover:bg-row-hover'
                                    }`}
                                >
                                    {v.icon} {v.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className="h-24 rounded-xl border border-hairline bg-surface animate-pulse"
                            style={{ animationDelay: `${i * 80}ms` }}
                        />
                    ))}
                </div>
            ) : mappings.length === 0 ? (
                <div className="bg-surface rounded-xl border border-hairline shadow-xs">
                    <EmptyState
                        icon={BookOpen}
                        title="No services mapped for this client"
                        message="Map a service to this client first — its courses then appear here to set up."
                        secondaryAction={
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-semibold text-body hover:bg-row-hover transition-colors"
                            >
                                <ArrowLeft size={14} /> Back to clients
                            </button>
                        }
                    />
                </div>
            ) : (
                serviceGroups.map((g) => {
                    // The focused mapping decides which SECTION opens, since a
                    // deep link names a mapping and sections are now groups.
                    const focused = Boolean(
                        focusMappingId && g.mappings.some((m) => String(m._id) === focusMappingId)
                    )
                    // Sections start collapsed. `expanded` records what the user
                    // has opened; a deep link to one of the mappings inside
                    // forces this one open the first time it renders.
                    const open = expanded.has(g.label) || focused
                    const courseCount = g.mappings.reduce((n, m) => n + groupCourses(m).length, 0)
                    // Only the mappings that actually carry courses are rendered.
                    // An empty one contributes nothing now that it no longer
                    // draws an empty-state card, and rendering it would leave a
                    // bare bordered strip above the real courses.
                    const shownMappings = g.mappings.filter((m) => groupCourses(m).length > 0)
                    return (
                        <section
                            key={g.label}
                            ref={focused ? focusRef : undefined}
                            className={`rounded-xl border bg-surface shadow-xs overflow-hidden ${
                                focused ? 'border-brand-500/40' : 'border-hairline'
                            }`}
                        >
                            {/* The whole header row toggles the section. The
                                configured pill and the view switch are NOT here
                                — they belong to the client and are rendered once
                                at the top. */}
                            <button
                                type="button"
                                onClick={() => toggle(g.label)}
                                aria-expanded={open}
                                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 text-left hover:bg-row-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
                            >
                                <ChevronDown
                                    size={14}
                                    className={`flex-shrink-0 text-ink-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
                                />
                                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-heading">
                                    {g.label}
                                </span>
                                <span className="flex-shrink-0 text-xs text-faint tabular-nums">
                                    {courseCount} course{courseCount === 1 ? '' : 's'}
                                </span>
                            </button>

                            {open && shownMappings.length > 0 && (
                                <div className="px-3 sm:px-4 pb-3 border-t border-hairline pt-3 space-y-3">
                                    {shownMappings.map((m) => {
                                        const id = String(m._id)
                                        return (
                                            <MappingSection
                                                key={id}
                                                mapping={m}
                                                view={view}
                                                // Pre-bound here — inside the
                                                // section a course is identified
                                                // by name and path alone, exactly
                                                // as before.
                                                statusFor={(courseName, coursePath) => statusFor(id, courseName, coursePath)}
                                                onBack={onBack}
                                                onSetup={(course) => onSetup(m, course)}
                                                onView={(course) => onView(m, course)}
                                                onProgramCalendar={onProgramCalendar}
                                                onCourseStructure={onCourseStructure}
                                                onCourseResources={onCourseResources}
                                                onCourseEnrollment={onCourseEnrollment}
                                                openActionsForCourseId={openActionsForCourseId}
                                            />
                                        )
                                    })}
                                </div>
                            )}
                        </section>
                    )
                })
            )}
        </div>
    )
}
