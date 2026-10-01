"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Loader2, LockKeyhole, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'
import { useSectionHref } from '@/lib/sectionRoute'

// The four things you can do with a configured course, behind one trigger.
//
// The menu renders through a PORTAL onto document.body rather than beside the
// trigger. Every collapsible level in the tree animates its height and therefore
// carries `overflow: hidden`, which clipped the menu to the row it belonged to —
// an absolutely positioned child cannot escape a clipping ancestor no matter how
// high its z-index. A portal leaves that subtree entirely.
export type CourseMenuStatus = {
  id: string
  moduleCount: number
  participantCount?: number
  exerciseCount?: number
  // True only when the course has ≥1 module AND pedagogy hours entered —
  // the Program Calendar plans sessions from those hours.
  hasModuleHours?: boolean
  hasProgramCalendar?: boolean
  // True once any enrolled learner has submitted an assignment or assessment —
  // the Report has nothing to show before that.
  hasSubmissions?: boolean
}

/** Which entries this menu offers. Defaults to all of them. */
export type CourseMenuItem = 'view' | 'edit' | 'structure' | 'resources' | 'calendar' | 'enrollment' | 'feedback' | 'grade' | 'report' | 'approval'

// 'grade' sits directly below 'feedback' so the same course-context grouping
// (per-course actions, not global) reads top-to-bottom.
// 'report' sits beside 'grade': both read what students have scored.
const ALL_ITEMS: CourseMenuItem[] = ['view', 'edit', 'structure', 'calendar', 'resources', 'enrollment', 'grade', 'report', 'feedback', 'approval']

// Which functionality (as spelled in PermissionModal) each menu item requires.
// The parent's `items` prop still decides the SET; this only decides which of
// those the current user is granted to see, so the trigger goes away entirely
// when nothing remains and the user is never shown an action they can't take.
const ITEM_PERMISSION: Record<CourseMenuItem, string> = {
    view: 'View Full Details',
    edit: 'Edit Course',
    structure: 'Add Course Structure',
    resources: 'Upload Resourses', // typo intentional — matches PermissionModal
    calendar: 'Program Calendar',
    enrollment: 'Add Participants',
    feedback: 'Add Feedback',
    // Grade opens the course's Grades detail view directly (no client/course
    // picker step, because the course is already in hand). Reads from the
    // course-management permission the rest of this menu uses; "View Full
    // Details" is the closest fit — Grade is a course-scoped read of what
    // students have scored. Deliberately NOT gated on the admin-grades
    // sidebar permission: the trainer removed that from the sidebar but
    // still wants Grade reachable per-course from here.
    grade: 'View Full Details',
    // Report is the same kind of course-scoped read as Grade — every
    // student's results by exercise and by student — so it rides on the
    // same permission rather than needing a new slot.
    report: 'View Full Details',
    // Setting an approval chain is a course-configuration task, so it rides
    // on Edit Course rather than needing a new permission slot.
    approval: 'Edit Course',
}

const ACTION_IMAGES: Record<CourseMenuItem, string> = {
    edit: '/assets/course-actions/edit-course-setup.png',
    structure: '/assets/course-actions/course-structure.png',
    calendar: '/assets/course-actions/program-calendar.png',
    resources: '/assets/course-actions/upload-resources.png',
    enrollment: '/assets/course-actions/enrollment.png',
    view: '/assets/course-actions/view-course-setup.png',
    feedback: '/assets/course-actions/feedback.png',
    grade: '/assets/course-actions/grade.png',
    report: '/assets/course-actions/grade.png',
    approval: '/assets/course-actions/approval.png',
}

// Short display names used by the primary button ("Open <name>") and,
// where the tile label differs from the destination name, by the tile
// itself. Keeps the button copy predictable regardless of the tile's
// own status-dependent label.
const SHORT_NAME: Record<CourseMenuItem, string> = {
    view: 'Course Details',
    edit: 'Course Details',
    structure: 'Course Structure',
    calendar: 'Calendar',
    resources: 'Resources',
    enrollment: 'Enrollment',
    grade: 'Grades',
    report: 'Reports',
    feedback: 'Feedback',
    approval: 'Approvals',
}

function ActionIllustration({
    kind,
    disabled,
    loading,
    selected,
}: {
    kind: CourseMenuItem
    disabled?: boolean
    loading?: boolean
    selected?: boolean
}) {
    return (
        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
            disabled ? 'bg-ink-50' : selected ? 'bg-orange-100/70' : 'bg-orange-50/60'
        }`}>
            <img
                src={ACTION_IMAGES[kind]}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`h-9 w-9 object-contain ${disabled ? 'grayscale opacity-45' : ''}`}
            />
            {loading && (
                <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
                    <Loader2 size={16} className="animate-spin text-brand-600" />
                </span>
            )}
        </div>
    )
}

export default function CourseActionsMenu({
    status,
    breadcrumbs,
    onView,
    onEdit,
    onStructure,
    onResources,
    onCalendar,
    onEnrollment,
    onFeedback,
    onGrade,
    onReport,
    onApproval,
    items = ALL_ITEMS,
    label = 'Course Actions',
    autoOpen = false,
    onBeforeNavigate,
}: {
    status: CourseMenuStatus
    breadcrumbs?: string[]
    onView: () => void
    /** Only required when 'edit' is among `items`. */
    onEdit?: () => void
    onStructure: () => void
    /** Only required when 'resources' is among `items`. */
    onResources?: () => void
    onCalendar: () => void
    onEnrollment: () => void
    /** Optional — defaults to navigating to the course's feedback manager. */
    onFeedback?: () => void
    /** Optional — defaults to navigating to the course's Grades detail page
     *  (mounted under both `/lms/pages/coursestructure/grades/<courseId>` and
     *  `/lms/pages/courses/grades/<courseId>`; sectionHref picks the prefix
     *  matching the current section), which skips the client/course picker
     *  because the course is already known from this menu's context. */
    onGrade?: () => void
    /** Optional — defaults to navigating to the course's Report page
     *  (`courseReport`, mounted under both sections like Grades). */
    onReport?: () => void
    /** Only required when 'approval' is among `items`. Opens the parent-owned
     *  ApprovalHierarchyModal so the manager can set the ordered role → person
     *  approvers for this course without leaving Course Management. */
    onApproval?: () => void
    // The L&D console offers oversight, not authoring, so it asks for the four
    // read-and-plan entries and leaves Edit Course Setup to Course Structure.
    items?: CourseMenuItem[]
    label?: string
    /** Fired the instant a card is chosen, before its destination is opened.
     *  The host uses it to remember which modal to put back when the user
     *  returns from that destination. */
    onBeforeNavigate?: () => void
    /** Open the modal the moment this menu mounts. The page sets it on the one
     *  course the user just backed out of, so Back / Close from the setup panel
     *  lands on the Course Actions modal it was opened from instead of on the
     *  bare hierarchy. Read once, as the initial state — closing then works
     *  normally and re-renders never force it back open. */
    autoOpen?: boolean
}) {
    const router = useRouter()
    // Grade links respect the section the menu is opened from — CourseActionsMenu
    // is used from BOTH the coursestructure list and the L&D dashboard, so the
    // hard-coded `/lms/pages/grades/…` would drop L&D users into the Courses
    // shell mid-task. sectionHref resolves to `/lms/pages/coursestructure/grades`
    // when opened inside coursestructure and falls back to `/lms/pages/courses/grades`
    // everywhere else — both routes exist and mount the same detail page.
    const sectionHref = useSectionHref()
    const { can } = usePermissions()
    // Filter the incoming items down to what this user is granted for
    // admin-coursemanagement. If nothing is left, the trigger renders nothing
    // at all — same as ClientManagementPage hiding action icons instead of
    // dimming them.
    const allowedItems = useMemo(
        () => items.filter((key) => can(PERMISSION_IDS.ADMIN_COURSE_MANAGEMENT, ITEM_PERMISSION[key])),
        [items, can]
    )
    const [open, setOpen] = useState(autoOpen)
    // The card the user fired. The modal deliberately stays OPEN behind it:
    // closing first put the bare tree back on screen for however long the next
    // route took to compile, which read as a dead click. The card spins in
    // place instead, and the navigation itself is what unmounts this menu.
    const [pendingKey, setPendingKey] = useState<CourseMenuItem | null>(null)
    // Cards are now a two-step: click to select (highlights the tile),
    // then Proceed to actually fire the action. Avoids accidental navigation
    // and gives the user a moment to change their mind.
    const [selectedKey, setSelectedKey] = useState<CourseMenuItem | null>(null)
    const [mounted, setMounted] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)
    const hasStructure = status.moduleCount > 0
    const moduleLabel = `${status.moduleCount} module${status.moduleCount === 1 ? '' : 's'}`
    const enrolledLabel = `${status.participantCount || 0} user${(status.participantCount || 0) === 1 ? '' : 's'}`
    const exerciseCount = Number(status.exerciseCount) || 0
    const hasSubmissions = Boolean(status.hasSubmissions)
    const hasEnrollment = (status.participantCount || 0) > 0
    const calendarLabel = status.hasProgramCalendar ? 'Created' : 'Not created'
    // The Program Calendar unlocks ONLY when there is something to plan from:
    // at least one module WITH pedagogy hours. The calendar computes the
    // training end date from those hours (start + hours ⇒ end), so modules
    // without durations — or enrolled users alone — leave it nothing to
    // schedule. Shown disabled (with the hint) until then, never hidden.
    const canPlan = hasStructure && Boolean(status.hasModuleHours)

    useEffect(() => setMounted(true), [])

    // autoOpen is seeded into `open` above, but it can also arrive one render
    // LATE — the hierarchy reads its "reopen this" note in an effect — so a
    // flip to true is treated as an instruction to open. It only fires on the
    // transition, so closing the modal afterwards sticks.
    useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])

    useEffect(() => {
        if (!open) return
        setPendingKey(null)
        setSelectedKey(null)
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', onKey)
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
        }
    }, [open])

    // Every card action either routes away or swaps the page's stage, and both
    // unmount this menu — so this timer normally never fires. It is here so a
    // destination that does neither cannot strand the card spinning forever.
    useEffect(() => {
        if (!pendingKey) return
        const timer = setTimeout(() => { setPendingKey(null); setOpen(false) }, 8000)
        return () => clearTimeout(timer)
    }, [pendingKey])

    // Enrollment badge reads "N learners" now (was "N users"): matches the
    // domain vocabulary used elsewhere in the header and in the button copy.
    const enrolledBadge = `${status.participantCount || 0} learner${(status.participantCount || 0) === 1 ? '' : 's'}`

    const ALL: Record<CourseMenuItem, { label: string; description: string; onClick: () => void; enabled: boolean; hint: string; badge?: string; opensInPlace?: boolean }> = {
        view: { label: 'Course Details', description: '', onClick: onView, enabled: true, hint: '' },
        edit: { label: 'Course Details', description: '', onClick: onEdit ?? onView, enabled: true, hint: '' },
        structure: {
            label: 'Course Structure',
            description: '',
            onClick: onStructure, enabled: true, hint: '',
            badge: hasStructure ? moduleLabel : undefined,
        },
        resources: {
            // Uploading needs somewhere to file the material, and that is a
            // module in the structure — so this stays locked until there is one.
            label: 'Resources',
            description: hasStructure ? '' : 'Add a module in Course Structure first — resources are filed against a module.',
            onClick: onResources ?? onStructure, enabled: hasStructure,
            hint: 'Add at least one module in Course Structure first — resources are uploaded against a module',
        },
        calendar: {
            // "(Created)" state moved off the label — the tile is either enabled
            // or disabled, and a status word inside a button reads as clutter.
            label: 'Calendar',
            description: canPlan ? '' : 'Add a module with pedagogy hours in Course Structure — the calendar plans from those hours.',
            onClick: onCalendar, enabled: canPlan,
            hint: 'Add at least one module with hours in Course Structure first — the calendar plans sessions from those hours',
        },
        enrollment: {
            // Available as soon as the course is set up: enrollment happens per
            // batch, and the enrollment view lists this course's batches as tabs.
            label: 'Enrollment',
            description: '',
            onClick: onEnrollment, enabled: true, hint: '', badge: enrolledBadge,
        },
        feedback: {
            // Feedback is per-course, so it lives HERE (with course context)
            // rather than as a global sidebar item that would have to ask
            // "which course?" first.
            label: 'Feedback',
            description: '',
            onClick: onFeedback ?? (() => router.push(`/lms/pages/coursestructure/feedback?courseId=${status.id}`)),
            enabled: true, hint: '',
        },
        grade: {
            // Same rationale as Feedback above: Grade is per-course, and the
            // course is already known here — so this deep-links straight to
            // the detail view for this course, skipping the client/course
            // picker at /lms/pages/grades. The detail component is mounted
            // under BOTH `/lms/pages/coursestructure/grades/[id]` and
            // `/lms/pages/courses/grades/[id]` (thin re-exports of the
            // shared component at `/lms/pages/grades/[id]`), so sectionHref
            // keeps the trainer inside the section the menu was opened from
            // instead of throwing them into the Courses shell. The detail
            // page reads its id off `window.location.pathname` (looking for
            // the `grades` segment), so a plain router.push is enough for
            // that part regardless of prefix.
            //
            // `returnTo` carries the URL of THIS page (usually the Course
            // Structure listing with `?openMappingId=…`) so the Back arrow
            // on the Grades detail page lands the trainer where they came
            // from instead of on the client picker they never wanted to
            // see. Captured off window.location at click time so any query
            // params (openMappingId, filters, tabs) round-trip cleanly.
            label: 'Grades',
            description: exerciseCount > 0 ? '' : 'No exercises to grade yet — create one from Resources first.',
            onClick: onGrade ?? (() => {
                const here = typeof window !== 'undefined'
                    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                    : '';
                const q = here ? `?returnTo=${encodeURIComponent(here)}` : '';
                router.push(`${sectionHref('grades')}/${status.id}${q}`);
            }),
            enabled: exerciseCount > 0,
            hint: 'No exercises to grade yet. Create an exercise from Upload Resources first.',
        },
        report: {
            // Every assignment and assessment in the course, read by exercise
            // or by student, with question-level detail and the shared
            // Preview & Print. `returnTo` works as it does for Grades: Back
            // lands on this page, where the host reopens this modal.
            //
            // Unlocks on the FIRST submission — one learner submitting one
            // assignment or assessment is enough. Exercises alone are not:
            // a report with every row "Not Started" has nothing to say.
            label: 'Reports',
            description: hasSubmissions ? '' : 'Available after the first submission',
            onClick: onReport ?? (() => {
                const here = typeof window !== 'undefined'
                    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                    : '';
                const q = new URLSearchParams({ courseId: status.id })
                if (here) q.set('returnTo', here)
                router.push(`${sectionHref('courseReport')}?${q.toString()}`);
            }),
            enabled: hasSubmissions,
            hint: exerciseCount > 0
                ? 'No learner has submitted an assignment or assessment yet — the report unlocks with the first submission.'
                : 'No assignments or assessments yet. Create one from Upload Resources first.',
        },
        approval: {
            // The former standalone Approvals page is retired; this action
            // opens the same modal (ApprovalHierarchyModal) with this course
            // already pinned, so the manager configures the chain in place.
            //
            // Locked until at least one learner is enrolled: the approval
            // chain routes their submissions, so there is nothing to
            // configure while enrollment is empty.
            label: 'Approvals',
            description: hasEnrollment ? '' : 'Enroll at least one learner — the approval chain routes their submissions.',
            onClick: onApproval ?? (() => {}),
            enabled: Boolean(onApproval) && hasEnrollment,
            hint: !onApproval
                ? 'Approval configuration is not available in this context'
                : 'Enroll at least one learner first — the approval chain routes their submissions.',
            // The only tile that opens a dialog on THIS page instead of
            // navigating: nothing unmounts this menu, so it must not take the
            // spinner (which waits for an unmount that would never come). It
            // steps aside for the approval modal and the host brings it back
            // when that closes.
            opensInPlace: true,
        },
    }
    const ITEMS = allowedItems.map((key) => ({ key, ...ALL[key] }))

    // View and Edit are the same course record read two ways, so they cost one
    // tile between them instead of two. It opens the setup page read-only; the
    // Edit Course button beside that page's Expand all is what turns editing
    // on — the mode is chosen in front of the fields it affects rather than
    // here. A user granted only Edit skips the read-only face entirely and the
    // tile keeps that action's own name.
    const canViewSetup = allowedItems.includes('view')
    const canEditSetup = allowedItems.includes('edit')
    const setupKey: CourseMenuItem = canViewSetup ? 'view' : 'edit'
    const setupCard = canViewSetup || canEditSetup
        ? { ...ALL[setupKey], key: setupKey, label: 'Course Details', description: '' }
        : null

    // Walk the requested order so the merged tile keeps the slot the first of
    // the pair held and the other one simply drops out.
    const GRID_ITEMS: Array<(typeof ITEMS)[number]> = []
    let setupPlaced = false
    for (const item of ITEMS) {
        if (item.key === 'view' || item.key === 'edit') {
            if (setupCard && !setupPlaced) { GRID_ITEMS.push(setupCard); setupPlaced = true }
            continue
        }
        GRID_ITEMS.push(item)
    }


    // Every offered item is denied — hide the trigger rather than render an
    // empty menu. Matches ClientManagementPage's pattern of omitting the
    // action button entirely when the user can do nothing with it.
    if (!allowedItems.length) return null

    const menu = mounted ? createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-popover flex items-center justify-center bg-black/35 px-3 py-3 backdrop-blur-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onMouseDown={() => setOpen(false)}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Course actions"
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.16 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        // Solid warm off-white shell — opaque so the page
                        // behind never bleeds through, but still a shade
                        // warmer than pure white to sit next to the pale
                        // orange selected state without a jump.
                        // Sized to fit the 3×3 grid without hanging empty
                        // space above the footer.
                        className="flex max-h-[min(720px,calc(100vh-24px))] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-hairline bg-[#FFF9F2] shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-4">
                            <div className="min-w-0">
                                {!!breadcrumbs?.length && breadcrumbs.length > 1 && (
                                    <nav className="mb-1 flex max-w-3xl flex-wrap items-center gap-1 text-2xs font-semibold text-subtle" aria-label="Course path">
                                        {breadcrumbs.slice(0, -1).map((crumb, index, arr) => (
                                            <React.Fragment key={`${crumb}-${index}`}>
                                                <span>{crumb}</span>
                                                {index < arr.length - 1 && <ChevronDown size={12} className="-rotate-90 text-faint" />}
                                            </React.Fragment>
                                        ))}
                                    </nav>
                                )}
                                {!!breadcrumbs?.length && (
                                    <h2 className="text-xl font-bold leading-tight text-heading">
                                        {(breadcrumbs[breadcrumbs.length - 1] || '').replace(/^Course:\s*/, '')}
                                    </h2>
                                )}
                                <p className="mt-0.5 text-xs text-subtle">Choose an action, then open it.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 overflow-y-auto px-5 pb-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                            {GRID_ITEMS.map((item) => {
                                const isSelected = selectedKey === item.key
                                const isPending = pendingKey === item.key
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        disabled={!item.enabled || Boolean(pendingKey)}
                                        aria-busy={isPending}
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            if (!item.enabled || pendingKey) return
                                            setSelectedKey(item.key)
                                        }}
                                        // Vertically-centered flex row: icon + text share
                                        // the mid-line, and short-text cards stay balanced
                                        // even when a neighbour wraps to two lines.
                                        className={`group relative flex min-h-[96px] items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 ${
                                            !item.enabled
                                                ? 'cursor-not-allowed border-hairline bg-ink-50/60'
                                                : isSelected
                                                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500/20'
                                                    : 'border-hairline bg-surface hover:border-orange-400/50 hover:bg-orange-50/40'
                                        }`}
                                    >
                                        <ActionIllustration
                                            kind={item.key}
                                            disabled={!item.enabled}
                                            loading={isPending}
                                            selected={isSelected}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className={`block text-sm font-semibold leading-tight ${item.enabled ? 'text-heading' : 'text-ink-600'}`}>
                                                {item.label}
                                            </span>
                                            {item.badge && item.enabled && (
                                                <span className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                                    {item.badge}
                                                </span>
                                            )}
                                            {item.description && (
                                                <span className={`mt-1 block text-[11px] leading-[15px] ${item.enabled ? 'text-subtle' : 'text-ink-500'}`}>
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                        {/* Fixed-width trailing slot so the text column
                                            never shifts between selected/unselected. */}
                                        <span className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center">
                                            {isSelected ? (
                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            ) : !item.enabled ? (
                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-ink-500 shadow-xs">
                                                    <LockKeyhole size={11} />
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-hairline bg-surface px-6 py-3">
                            <button
                                type="button"
                                disabled={!selectedKey || Boolean(pendingKey)}
                                onClick={() => {
                                    if (!selectedKey || pendingKey) return
                                    const item = GRID_ITEMS.find((i) => i.key === selectedKey)
                                    if (!item || !item.enabled) return
                                    if (item.opensInPlace) { setOpen(false); item.onClick(); return }
                                    setPendingKey(item.key)
                                    onBeforeNavigate?.()
                                    item.onClick()
                                }}
                                className={`inline-flex min-w-[200px] items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                                    !selectedKey || pendingKey
                                        ? 'cursor-not-allowed bg-ink-100 text-ink-400'
                                        : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-md'
                                }`}
                            >
                                {selectedKey ? `Open ${SHORT_NAME[selectedKey]}` : 'Open action'}
                                {pendingKey
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <ArrowRight size={16} strokeWidth={2.5} />}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    ) : null

    return (
        <div className="relative flex-shrink-0">
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
                {label}
            </button>
            {menu}
        </div>
    )
}
