"use client"

import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, ChevronRight, GraduationCap, CircleCheck, Settings2, Network, Table2, Layers, BookOpen,
    CalendarDays, UploadCloud, UsersRound, Check, Building2, Code2, CircleAlert,
} from 'lucide-react'
import type { ServiceMapping } from '@/apiServices/serviceMappingService'
import { DataTable, type Column } from '../../../shared/listing/DataTable'
import { EmptyState } from '../../../shared/ui'
import CourseActionsMenu from './CourseActionsMenu'
import ApprovalHierarchyModal from '../../../component/ApprovalHierarchyModal'
import {
    buildBatchTree, buildPhaseTree, buildTree, groupCourses, looseCourses,
    placementLabel, runsInLabel, unplacedCourses, PATH_SEP,
    type BatchNode, type CourseGroup, type DegreeNode, type PhaseFirstNode,
} from './mappingTree'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

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

type CourseStatus = { id: string; moduleCount: number; participantCount: number; exerciseCount?: number; courseCode: string; hasModuleHours?: boolean; hasProgramCalendar?: boolean } | null
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
        return (
            <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-chip bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-500/20 text-2xs font-medium whitespace-nowrap">
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
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-chip bg-brand-strong text-white text-2xs font-semibold hover:bg-brand-800 transition-colors flex-shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
            <Settings2 size={12} /> Setup Course
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

const actionBreadcrumbsFor = (course: CourseGroup) => {
    const parts = course.path.split(PATH_SEP).map((p) => p.trim()).filter(Boolean)
    const labels = parts.length === 4
        ? ['Degree', 'Department', 'Section', 'Semester']
        : parts.length === 3
            ? ['Degree', 'Department', 'Semester']
            : parts.length === 2
                ? ['Batch', 'Phase']
                : parts.length === 1
                    ? ['Batch']
                    : []
    return [
        ...parts.map((part, index) => `${labels[index] || 'Level'}: ${part}`),
        `Course: ${course.courseName}`,
    ]
}

function Collapsible({
    header,
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
                className="flex items-center gap-2 h-9 text-left min-w-0 w-full rounded-chip px-1 -mx-1 hover:bg-row-hover transition-colors"
                aria-expanded={open}
            >
                <ChevronRight
                    size={17}
                    strokeWidth={3}
                    className={`text-brand-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
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
                        // Clipping is required for the height animation. It used
                        // to cut off the actions menu; that menu now portals to
                        // the body, so nothing inside needs to escape this box.
                        className="overflow-hidden"
                    >
                        {/* The connector rail: children hang off a hairline dropped
                            from the chevron, so depth reads at a glance. */}
                        <div className="ml-2 border-l border-hairline pl-4">{children}</div>
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
    const [open, setOpen] = useState(true)
    return (
        <div>
            <div className="flex items-center gap-2 py-2 rounded-chip hover:bg-row-hover transition-colors">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-label={open ? 'Hide batches' : 'Show batches'}
                    className="flex-shrink-0 p-0.5 rounded-chip hover:bg-row-hover transition-colors"
                >
                    <ChevronRight
                        size={17}
                        strokeWidth={3}
                        className={`text-brand-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                </button>
                <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                    <BookOpen size={15} className="text-brand-strong" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${SIZE.course} font-semibold text-heading truncate`}>
                            {course.courseName}
                            {status?.courseCode && (
                                <span className="text-faint font-normal"> ({status.courseCode})</span>
                            )}
                        </span>
                        {course.category && (
                            <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-500 text-2xs font-medium">
                                {course.category}
                            </span>
                        )}
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
                        <div className="ml-4 border-l border-hairline pl-4">
                            {batchLabels.map((b) => (
                                <div key={b} className="flex items-center gap-2 py-1.5">
                                    <span className="h-6 w-6 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                        <Layers size={13} className="text-brand-strong" />
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

export default function HierarchyPicker({
    mapping,
    statusFor,
    onBack,
    onSetup,
    onView,
    onProgramCalendar,
    onCourseStructure,
    onCourseResources,
    onCourseEnrollment,
}: {
    mapping: ServiceMapping
    statusFor: (courseName: string, coursePath: string) => CourseStatus
    onBack: () => void
    onSetup: (course: CourseGroup) => void
    onView: (course: CourseGroup) => void
    onProgramCalendar: (courseId: string) => void
    onCourseStructure: (courseId: string) => void
    onCourseResources: (courseId: string) => void
    onCourseEnrollment: (courseId: string) => void
}) {
    const [view, setView] = useState<ViewMode>('tree')
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

    const clientName = typeof mapping.client === 'string' ? '' : mapping.client?.clientCompany || 'Client'
    const configured = groups.filter((g) => statusFor(g.courseName, g.path)).length
    const structured = groups.filter((g) => (statusFor(g.courseName, g.path)?.moduleCount || 0) > 0).length

    const actionsFor = (course: CourseGroup) => {
        const status = statusFor(course.courseName, course.path)
        if (status) {
            // CourseActionsMenu filters its own items and returns null when
            // the user is granted none of them — no wrapper check needed here.
            return (
            <CourseActionsMenu
                status={status}
                breadcrumbs={actionBreadcrumbsFor(course)}
                onView={() => onView(withBatches(course))}
                    onEdit={() => onSetup(withBatches(course))}
                    onStructure={() => onCourseStructure(status.id)}
                    onResources={() => onCourseResources(status.id)}
                    onCalendar={() => onProgramCalendar(status.id)}
                    onEnrollment={() => onCourseEnrollment(status.id)}
                    onApproval={() => setApprovalFor({ id: status.id, name: course.courseName })}
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
    const CourseRow = ({ course, alsoIn, batches }: {
        course: CourseGroup
        alsoIn?: string[]
        // The batches this course runs for, shown inline as chips right after the
        // course name so it's obvious at a glance. Used by the degree tree (each
        // course's own MappedCourse.batches) and by phase-first rows (the batches
        // that course's phase runs for). Chips rather than tree levels: neither
        // shape nests anything under a batch.
        batches?: string[]
    }) => {
        const others = alsoIn ?? course.placements.slice(1).map(placementLabel)
        const status = statusFor(course.courseName, course.path)
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent py-2 pl-1 pr-2 transition-colors hover:border-hairline hover:bg-row-hover sm:flex-nowrap">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand-strong">
                    <Code2 size={16} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${SIZE.course} font-semibold text-heading truncate`}>
                            {course.courseName}
                            {/* The generated code only exists once a setup record
                                does, so its presence doubles as a quiet "which
                                record" cue. It lives inside the truncating span so
                                a long name clips it instead of widening the row. */}
                            {status?.courseCode && (
                                <span className="text-faint font-normal"> ({status.courseCode})</span>
                            )}
                        </span>
                        {/* Batches sit right next to the name — the reader asked to
                            see which batches a course runs for without leaving the
                            hierarchy. Each name is its own chip so "b1, b2" stays
                            legible even when the row wraps. */}
                        {batches && batches.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <span className="text-2xs text-faint font-medium">Batches:</span>
                                {batches.map((b) => (
                                    <span
                                        key={b}
                                        className="inline-flex items-center h-[20px] px-2 rounded-chip bg-brand-50 border border-brand-200 text-brand-700 text-2xs font-medium"
                                    >
                                        {b}
                                    </span>
                                ))}
                            </span>
                        )}
                        {course.category && (
                            <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-500 text-2xs font-medium">
                                {course.category}
                            </span>
                        )}
                        <StatusPill status={status} />
                    </div>
                    {/* One setup covers every placement, so the others are named
                        here rather than becoming separate rows to configure. */}
                    {others.length > 0 && (
                        <p className="text-xs text-faint mt-0.5 truncate">
                            Also in {others.join(', ')}
                        </p>
                    )}
                </div>
                {actionsFor(course)}
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
                    {/* Client Management heading size — text-base sm:text-lg
                        font-semibold, so the two pages share one baseline. */}
                    <h1 className="mt-1 text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                        {clientName}
                    </h1>
                    <p className="text-xs text-subtle mt-0.5">
                        {[mapping.service, (mapping.serviceModels || []).join(' · '), mapping.year]
                            .filter(Boolean).join(' · ')}
                    </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs text-subtle">
                        <CircleCheck size={12} className="text-success-500" />
                        {configured} of {groups.length} configured
                    </span>

                    {/* Compact segmented toggle — Client Management chip
                        density (h-8, text-xs), flat surface + brand-orange
                        active pill instead of the loud gradient. */}
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
            </div>

            <CourseFlowStepper structured={structured} total={groups.length} />

            {groups.length === 0 ? (
                <div className="bg-surface rounded-xl border border-hairline shadow-xs">
                    <EmptyState
                        icon={BookOpen}
                        title="No courses in this mapping"
                        message="Courses are chosen in Map Service, inside each semester. Edit this mapping there and add them — they will appear here to set up."
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
            ) : view === 'table' ? (
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
                <div className="bg-surface rounded-xl border border-hairline shadow-xs px-4 sm:px-5 py-4 space-y-0.5">
                    {tree.map((deg) => (
                        <Collapsible
                            key={deg.degree}
                            header={
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                        <GraduationCap size={16} className="text-brand-strong" />
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
                                            <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                                <Building2 size={15} className="text-brand-strong" />
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
                                                        <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                                            <CalendarDays size={15} className="text-brand-strong" />
                                                        </span>
                                                        <LevelLabel label="Semester" value={sem.semester} className={SIZE.semester} />
                                                        <CourseCount n={sem.courses.length} />
                                                    </span>
                                                }
                                            >
                                                {sem.courses.map((c) => <CourseRow key={c.key} course={c} batches={c.batches} />)}
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
                                                        <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                                            <UsersRound size={15} className="text-brand-strong" />
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

                    {/* New-shape Placement Training: Phase → its one course, with
                        the course's own batches as chips on the row. Each phase
                        holds exactly one course by construction, so no course
                        count is shown — it would always read "1 course". The
                        zero-phase mapping has no phase level at all, so its
                        course renders directly. Same one-setup-per-course rule:
                        the same course under two phases opens the SAME setup. */}
                    {phaseTree.map((node, i) => {
                        const alsoIn = phaseTree
                            .filter((n) => n !== node && n.course.key === node.course.key && n.phase)
                            .map((n) => n.phase as string)
                        const row = (
                            <CourseRow course={node.course} alsoIn={alsoIn} batches={node.batches} />
                        )
                        return node.phase ? (
                            <Collapsible
                                key={`${node.phase}-${i}`}
                                header={
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="h-7 w-7 rounded-chip bg-brand-wash flex items-center justify-center flex-shrink-0">
                                            <Layers size={15} className="text-brand-strong" />
                                        </span>
                                        <LevelLabel label="Phase" value={node.phase} className={SIZE.degree} />
                                    </span>
                                }
                            >
                                {row}
                            </Collapsible>
                        ) : (
                            <React.Fragment key={`no-phase-${i}`}>{row}</React.Fragment>
                        )
                    })}

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
                                {loose.map((c) => <CourseRow key={c.key} course={c} batches={c.batches} />)}
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
                    onClose={() => setApprovalFor(null)}
                    courseId={approvalFor.id}
                    courseName={approvalFor.name}
                    clientName={clientName}
                />
            )}
        </div>
    )
}
