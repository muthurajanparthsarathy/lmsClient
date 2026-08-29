"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, GitBranch, LockKeyhole, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'
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
}

/** Which entries this menu offers. Defaults to all eight. */
export type CourseMenuItem = 'view' | 'edit' | 'structure' | 'resources' | 'calendar' | 'enrollment' | 'feedback' | 'grade' | 'approval'

// 'grade' sits directly below 'feedback' so the same course-context grouping
// (per-course actions, not global) reads top-to-bottom.
const ALL_ITEMS: CourseMenuItem[] = ['view', 'edit', 'structure', 'calendar', 'resources', 'enrollment', 'grade', 'feedback', 'approval']

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
    approval: '/assets/course-actions/approval.png',
}

function ActionIllustration({
    kind,
    label,
    disabled,
    active,
}: {
    kind: CourseMenuItem
    label: string
    disabled?: boolean
    active?: boolean
}) {
    return (
        <div className={`relative mx-auto mb-2.5 flex h-24 w-full max-w-[138px] items-center justify-center overflow-hidden rounded-xl ${
            disabled ? 'bg-ink-50' : active ? 'bg-gradient-to-b from-orange-50 to-white' : 'bg-gradient-to-b from-blue-50/80 to-white'
        }`}>
            <img
                src={ACTION_IMAGES[kind]}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`h-[92px] w-[92px] object-contain transition-transform duration-200 group-hover:scale-105 ${
                    disabled ? 'grayscale opacity-45' : ''
                }`}
            />
            {active && (
                <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm" aria-label={`${label} is recommended`}>
                    <ChevronDown size={14} className="-rotate-90" />
                </span>
            )}
            {disabled && (
                <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink-300 shadow-xs">
                    <LockKeyhole size={12} />
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
    onApproval,
    items = ALL_ITEMS,
    label = 'All Actions',
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
    /** Only required when 'approval' is among `items`. Opens the parent-owned
     *  ApprovalHierarchyModal so the manager can set the ordered role → person
     *  approvers for this course without leaving Course Management. */
    onApproval?: () => void
    // The L&D console offers oversight, not authoring, so it asks for the four
    // read-and-plan entries and leaves Edit Course Setup to Course Structure.
    items?: CourseMenuItem[]
    label?: string
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
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)
    const hasStructure = status.moduleCount > 0
    const moduleLabel = `${status.moduleCount} module${status.moduleCount === 1 ? '' : 's'}`
    const enrolledLabel = `${status.participantCount || 0} user${(status.participantCount || 0) === 1 ? '' : 's'}`
    const exerciseCount = Number(status.exerciseCount) || 0
    const calendarLabel = status.hasProgramCalendar ? 'Created' : 'Not created'
    // The Program Calendar unlocks ONLY when there is something to plan from:
    // at least one module WITH pedagogy hours. The calendar computes the
    // training end date from those hours (start + hours ⇒ end), so modules
    // without durations — or enrolled users alone — leave it nothing to
    // schedule. Shown disabled (with the hint) until then, never hidden.
    const canPlan = hasStructure && Boolean(status.hasModuleHours)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', onKey)
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
        }
    }, [open])

    const ALL: Record<CourseMenuItem, { label: string; description: string; onClick: () => void; enabled: boolean; hint: string; badge?: string; recommended?: boolean }> = {
        view: { label: 'View Course Setup', description: 'Review saved course information', onClick: onView, enabled: true, hint: '' },
        edit: { label: 'Edit Course Setup', description: 'Update basic course information', onClick: onEdit ?? onView, enabled: true, hint: '', recommended: !hasStructure },
        structure: {
            label: hasStructure ? `Manage Course Structure (${moduleLabel})` : 'Add Course Structure',
            description: 'Build modules and topics',
            onClick: onStructure, enabled: true, hint: '', badge: hasStructure ? 'Current' : undefined, recommended: hasStructure,
        },
        resources: {
            // Uploading needs somewhere to file the material, and that is a
            // module in the structure — so this stays locked until there is one,
            // exactly like the calendar waits on hours.
            label: 'Upload Resources',
            description: hasStructure ? 'Upload PDFs, PPTs and create exercises' : 'Available after Course Structure',
            onClick: onResources ?? onStructure, enabled: hasStructure,
            hint: 'Add at least one module in Course Structure first — resources are uploaded against a module',
        },
        calendar: {
            label: `Program Calendar (${calendarLabel})`,
            description: canPlan ? 'Plan sessions and important dates' : 'Available after Course Structure',
            onClick: onCalendar, enabled: canPlan,
            hint: 'Add at least one module with hours in Course Structure first — the calendar plans sessions from those hours',
        },
        enrollment: {
            // Available as soon as the course is set up: enrollment happens per
            // batch, and the enrollment view lists this course's batches as tabs.
            label: 'Enrollment',
            description: 'Invite and manage learners',
            onClick: onEnrollment, enabled: true, hint: '', badge: enrolledLabel,
        },
        feedback: {
            // Feedback is per-course, so it lives HERE (with course context)
            // rather than as a global sidebar item that would have to ask
            // "which course?" first.
            label: 'Feedback',
            description: 'Manage course feedback',
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
            description: 'View user grades for exercises',
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
        approval: {
            // The former standalone Approvals page is retired; this action
            // opens the same modal (ApprovalHierarchyModal) with this course
            // already pinned, so the manager configures the chain in place.
            label: 'Set Approval',
            description: 'Configure approval hierarchy',
            onClick: onApproval ?? (() => {}),
            enabled: Boolean(onApproval),
            hint: 'Approval configuration is not available in this context',
        },
    }
    const ITEMS = allowedItems.map((key) => ({ key, ...ALL[key] }))
    const GRID_ITEMS = ITEMS.filter((item) => item.key !== 'approval')
    const recommendedItem = hasStructure
        ? GRID_ITEMS.find((item) => item.key === 'structure')
        : GRID_ITEMS.find((item) => item.key === 'edit')
    const continueItem = recommendedItem ?? GRID_ITEMS.find((item) => item.enabled)

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
                        className="flex h-[min(760px,calc(100vh-24px))] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4 px-6 pb-2.5 pt-4">
                            <div className="min-w-0">
                                {!!breadcrumbs?.length && (
                                    <nav className="mb-2 flex max-w-3xl flex-wrap items-center gap-1 text-2xs font-semibold text-subtle" aria-label="Course path">
                                        {breadcrumbs.map((crumb, index) => (
                                            <React.Fragment key={`${crumb}-${index}`}>
                                                <span className={index === breadcrumbs.length - 1 ? 'text-heading' : ''}>{crumb}</span>
                                                {index < breadcrumbs.length - 1 && <ChevronDown size={12} className="-rotate-90 text-faint" />}
                                            </React.Fragment>
                                        ))}
                                    </nav>
                                )}
                                <h3 className="text-lg font-bold text-heading">Course Actions</h3>
                                <p className="mt-1.5 text-sm font-semibold text-subtle">
                                    Choose the next action for this course
                                </p>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">
                                    From here you can manage course setup, structure, resources and learner operations.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close course actions"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-ink-50 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid flex-1 grid-cols-1 gap-2.5 overflow-y-auto px-6 pb-3 sm:grid-cols-2 lg:grid-cols-4">
                            {GRID_ITEMS.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    disabled={!item.enabled}
                                    title={item.enabled ? undefined : item.hint}
                                    onClick={() => { if (item.enabled) { setOpen(false); item.onClick() } }}
                                    className={`group relative min-h-[178px] rounded-xl border p-3 text-center transition-all ${
                                        item.recommended
                                            ? 'border-brand-500/70 bg-brand-wash shadow-sm ring-1 ring-brand-500/20'
                                            : item.enabled
                                                ? 'border-hairline bg-surface hover:-translate-y-0.5 hover:border-brand-500/35 hover:shadow-md'
                                                : 'cursor-not-allowed border-hairline bg-ink-50/80'
                                    }`}
                                >
                                    <ActionIllustration kind={item.key} label={item.label} disabled={!item.enabled} active={item.recommended} />
                                    <span className={`block text-xs font-bold ${item.enabled ? item.recommended ? 'text-brand-strong' : 'text-heading' : 'text-heading'}`}>
                                        {item.label}
                                    </span>
                                    <span className={`mx-auto mt-1 block max-w-[160px] text-2xs leading-4 ${item.enabled ? 'text-subtle' : 'font-bold text-body'}`}>
                                        {item.enabled ? item.description : item.hint}
                                    </span>
                                    {item.badge && (
                                        <span className="absolute right-3 top-3 rounded-full bg-ink-100 px-2 py-1 text-2xs font-bold text-subtle">
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 border-t border-hairline bg-ink-50/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                            {ITEMS.find((item) => item.key === 'approval') && (
                                <button
                                    type="button"
                                    disabled={!ALL.approval.enabled}
                                    title={ALL.approval.enabled ? undefined : ALL.approval.hint}
                                    onClick={() => { if (ALL.approval.enabled) { setOpen(false); ALL.approval.onClick() } }}
                                    className="inline-flex min-h-[48px] items-center gap-3 rounded-lg border border-brand-500/20 bg-surface px-4 text-left text-heading transition-colors hover:bg-brand-wash disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-wash text-brand-strong">
                                        <GitBranch size={16} />
                                    </span>
                                    <span>
                                        <span className="block text-xs font-bold">Set Approval</span>
                                        <span className="block text-2xs font-medium text-subtle">Configure approval hierarchy</span>
                                    </span>
                                </button>
                            )}
                            <div className="flex items-center justify-end gap-2 sm:ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-hairline bg-surface px-5 text-xs font-bold text-heading transition-colors hover:bg-ink-50"
                                >
                                    Cancel
                                </button>
                                {continueItem && (
                                    <button
                                        type="button"
                                        onClick={() => { setOpen(false); continueItem.onClick() }}
                                        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-700"
                                    >
                                        Continue
                                    </button>
                                )}
                            </div>
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
