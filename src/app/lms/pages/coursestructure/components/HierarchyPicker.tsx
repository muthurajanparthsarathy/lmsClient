"use client"

import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, ChevronRight, GraduationCap, CircleCheck, Settings2, Network, Table2, Layers, BookOpen,
} from 'lucide-react'
import type { ServiceMapping } from '@/apiServices/serviceMappingService'
import { DataTable, type Column } from '../../../shared/listing/DataTable'
import { EmptyState } from '../../../shared/ui'
import CourseActionsMenu from './CourseActionsMenu'
import {
    buildBatchTree, buildPhaseTree, buildTree, groupCourses, looseCourses,
    placementLabel, runsInLabel, unplacedCourses,
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
// Sizes are per DEPTH, not per level name, so the batch hierarchy that Placement
// Training uses steps down at the same rate as the degree one.
const SIZE = {
    degree: 'text-lg',       // depth 1
    department: 'text-md',   // depth 2
    semester: 'text-base',   // depth 3
    course: 'text-base',
}

type CourseStatus = { id: string; moduleCount: number; participantCount: number; courseCode: string; hasModuleHours?: boolean } | null
type ViewMode = 'tree' | 'table'

// "Degree : B.E" — naming the level means the tree reads without the reader
// having to infer depth from indentation alone.
function LevelLabel({ label, value, className }: { label: string; value: string; className: string }) {
    return (
        <span className={`${className} font-bold text-heading truncate`}>
            <span className="text-faint font-semibold">{label} : </span>
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
            <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-500/20 text-2xs font-medium whitespace-nowrap">
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
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control bg-gradient-to-b from-brand-400 to-brand-600 text-white text-sm font-semibold shadow-brand hover:brightness-105 active:scale-[.98] transition-all flex-shrink-0 whitespace-nowrap"
        >
            <Settings2 size={14} /> Setup Course
        </button>
    )
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

    const actionsFor = (course: CourseGroup) => {
        const status = statusFor(course.courseName, course.path)
        if (status) {
            // CourseActionsMenu filters its own items and returns null when
            // the user is granted none of them — no wrapper check needed here.
            return (
                <CourseActionsMenu
                    status={status}
                    onView={() => onView(withBatches(course))}
                    onEdit={() => onSetup(withBatches(course))}
                    onStructure={() => onCourseStructure(status.id)}
                    onResources={() => onCourseResources(status.id)}
                    onCalendar={() => onProgramCalendar(status.id)}
                    onEnrollment={() => onCourseEnrollment(status.id)}
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
            <div className="flex items-center gap-3 py-2 flex-wrap pl-1 rounded-chip hover:bg-row-hover transition-colors">
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

    // Flat view: every course once, with where it runs collapsed into one cell.
    const tableColumns: Column<CourseGroup>[] = [
        {
            key: 'sno',
            label: '#',
            className: 'w-[56px] pl-4 sm:pl-5 pr-2 text-left',
            skeletonWidth: '20px',
            render: (_c, i) => <span className="text-xs text-faint tabular-nums">{i + 1}</span>,
        },
        {
            key: 'course',
            label: 'Course Name',
            className: 'w-[26%] px-3 text-left',
            render: (c) => {
                const code = statusFor(c.courseName, c.path)?.courseCode
                // The tooltip repeats the code because a truncated cell clips the
                // suffix first, and the code is the part worth recovering.
                return (
                    <span
                        className="text-sm font-semibold text-heading truncate block"
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
            className: 'w-[18%] px-3 text-left',
            render: (c) => (
                c.category
                    ? <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-500 text-2xs font-medium">{c.category}</span>
                    : <span className="text-2xs text-ink-300">—</span>
            ),
        },
        {
            key: 'runs',
            label: 'Runs In',
            className: 'w-[28%] px-3 text-left',
            render: (c) => {
                // Describes whichever hierarchy the mapping has — semesters for
                // Degree Program, phases for new-shape Placement Training,
                // batches and phases for the older non-degree shapes.
                const text = runsInLabel(c, batchTree, phaseTree)
                return <span className="text-sm text-ink-600 truncate block" title={text}>{text}</span>
            },
        },
        {
            key: 'status',
            label: 'Status',
            className: 'w-[13%] px-3 text-left',
            render: (c) => <StatusPill status={statusFor(c.courseName, c.path)} />,
        },
        {
            key: 'actions',
            label: 'Actions',
            className: 'w-[150px] pl-3 pr-4 sm:pr-5 text-left',
            skeletonWidth: '110px',
            render: (c) => actionsFor(c),
        },
    ]

    return (
        <div className="px-6 py-5 md:px-8 space-y-4 max-w-[1680px] mx-auto">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-heading transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to clients
                    </button>
                    <h1 className="mt-1.5 text-2xl font-semibold text-heading tracking-[-0.01em]">
                        {clientName}
                    </h1>
                    <p className="text-sm text-subtle mt-0.5">
                        {[mapping.service, (mapping.serviceModels || []).join(' · '), mapping.year]
                            .filter(Boolean).join(' · ')}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-tile bg-surface border border-hairline text-xs text-subtle shadow-xs">
                        <CircleCheck size={13} className="text-success-500" />
                        {configured} of {groups.length} configured
                    </span>

                    {/* Same courses, two readings: the tree answers "where does
                        this run", the table answers "what still needs doing". */}
                    <div className="inline-flex rounded-tile border border-hairline-strong bg-surface overflow-hidden shadow-xs">
                        {([
                            { key: 'tree' as const, label: 'Hierarchy', icon: <Network size={13} /> },
                            { key: 'table' as const, label: 'Table', icon: <Table2 size={13} /> },
                        ]).map((v) => (
                            <button
                                key={v.key}
                                type="button"
                                onClick={() => setView(v.key)}
                                aria-pressed={view === v.key}
                                className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold transition-colors ${
                                    view === v.key
                                        ? 'bg-gradient-to-b from-brand-400 to-brand-600 text-white'
                                        : 'text-subtle hover:bg-row-hover'
                                }`}
                            >
                                {v.icon} {v.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

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
                <div className="bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
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
                        minWidth={860}
                        maxHeight="calc(100vh - 300px)"
                    />
                </div>
            ) : (
                <div className="bg-surface rounded-xl border border-hairline shadow-xs px-4 sm:px-5 py-3 space-y-0.5">
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
                                    header={<LevelLabel label="Department" value={dept.department} className={SIZE.department} />}
                                >
                                    {dept.sections.map((sec) => {
                                        const semesters = sec.semesters.map((sem) => (
                                            <Collapsible
                                                key={sem.semester}
                                                header={
                                                    <span className="flex items-baseline gap-2 min-w-0">
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
                                                header={<LevelLabel label="Section" value={sec.section} className={SIZE.semester} />}
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
        </div>
    )
}
