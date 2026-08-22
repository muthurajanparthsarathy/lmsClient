"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronDown, Eye, GitBranch, GraduationCap, ListTree, MessageSquare, Pencil, Upload, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

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
  // True only when the course has ≥1 module AND pedagogy hours entered —
  // the Program Calendar plans sessions from those hours.
  hasModuleHours?: boolean
}

/** Which entries this menu offers. Defaults to all eight. */
export type CourseMenuItem = 'view' | 'edit' | 'structure' | 'resources' | 'calendar' | 'enrollment' | 'feedback' | 'grade' | 'approval'

// 'grade' sits directly below 'feedback' so the same course-context grouping
// (per-course actions, not global) reads top-to-bottom.
const ALL_ITEMS: CourseMenuItem[] = ['view', 'edit', 'structure', 'resources', 'calendar', 'enrollment', 'feedback', 'grade', 'approval']

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

export default function CourseActionsMenu({
    status,
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
    label = 'Actions',
}: {
    status: CourseMenuStatus
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
     *  (`/lms/pages/grades/<courseId>`), which skips the client/course picker
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
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const closeTimer = useRef<number | null>(null)
    const hasStructure = status.moduleCount > 0
    // The Program Calendar unlocks ONLY when there is something to plan from:
    // at least one module WITH pedagogy hours. The calendar computes the
    // training end date from those hours (start + hours ⇒ end), so modules
    // without durations — or enrolled users alone — leave it nothing to
    // schedule. Shown disabled (with the hint) until then, never hidden.
    const canPlan = hasStructure && Boolean(status.hasModuleHours)

    const WIDTH = 200
    // h-8 items + container padding/border. The count is known before paint,
    // which is what lets the flip decision below happen without measuring the
    // rendered menu.
    const EST_HEIGHT = allowedItems.length * 32 + 10

    // Measured before paint so the menu never appears at the wrong spot for a
    // frame and then jumps.
    useLayoutEffect(() => {
        if (!open || !btnRef.current) return
        const r = btnRef.current.getBoundingClientRect()
        // Right-aligned to the trigger, but nudged back inside the viewport if
        // the row sits near the edge.
        const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))
        // Flip ABOVE the trigger when the space below can't fit the menu —
        // the last rows of a long hierarchy otherwise open into nothing and
        // force the user to scroll to reach their own menu.
        const below = r.bottom + 6
        const fitsBelow = below + EST_HEIGHT <= window.innerHeight - 8
        const top = fitsBelow ? below : Math.max(8, r.top - 6 - EST_HEIGHT)
        setPos({ top, left })
    }, [open])

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
            setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        // Fixed positioning does not follow the page, so scrolling closes the
        // menu rather than leaving it stranded beside the wrong row.
        const onScroll = () => setOpen(false)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
        }
    }, [open])

    const cancelClose = () => {
        if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null }
    }
    // A grace period on leave, or the menu snaps shut crossing the gap between
    // the trigger and the panel.
    const scheduleClose = () => {
        cancelClose()
        closeTimer.current = window.setTimeout(() => setOpen(false), 180)
    }
    useEffect(() => cancelClose, [])

    const ALL: Record<CourseMenuItem, { label: string; icon: React.ReactNode; onClick: () => void; enabled: boolean; hint: string }> = {
        view: { label: 'View Course Setup', icon: <Eye size={14} />, onClick: onView, enabled: true, hint: '' },
        edit: { label: 'Edit Course Setup', icon: <Pencil size={14} />, onClick: onEdit ?? onView, enabled: true, hint: '' },
        structure: {
            label: hasStructure ? 'Course Structure' : 'Add Course Structure',
            icon: <ListTree size={14} />, onClick: onStructure, enabled: true, hint: '',
        },
        resources: {
            // Uploading needs somewhere to file the material, and that is a
            // module in the structure — so this stays locked until there is one,
            // exactly like the calendar waits on hours.
            label: 'Upload Resources',
            icon: <Upload size={14} />, onClick: onResources ?? onStructure, enabled: hasStructure,
            hint: 'Add at least one module in Course Structure first — resources are uploaded against a module',
        },
        calendar: {
            label: 'Program Calendar',
            icon: <CalendarDays size={14} />, onClick: onCalendar, enabled: canPlan,
            hint: 'Add at least one module with hours in Course Structure first — the calendar plans sessions from those hours',
        },
        enrollment: {
            // Available as soon as the course is set up: enrollment happens per
            // batch, and the enrollment view lists this course's batches as tabs.
            label: 'Enrollment',
            icon: <Users size={14} />, onClick: onEnrollment, enabled: true, hint: '',
        },
        feedback: {
            // Feedback is per-course, so it lives HERE (with course context)
            // rather than as a global sidebar item that would have to ask
            // "which course?" first.
            label: 'Feedback',
            icon: <MessageSquare size={14} />,
            onClick: onFeedback ?? (() => router.push(`/lms/pages/coursestructure/feedback?courseId=${status.id}`)),
            enabled: true, hint: '',
        },
        grade: {
            // Same rationale as Feedback above: Grade is per-course, and the
            // course is already known here — so this deep-links straight to
            // the detail view (`/lms/pages/grades/<courseId>`), skipping the
            // client/course picker at /lms/pages/grades. The detail page
            // reads its id off `window.location.pathname`, so a plain
            // router.push is enough for that part.
            //
            // `returnTo` carries the URL of THIS page (usually the Course
            // Structure listing with `?openMappingId=…`) so the Back arrow
            // on the Grades detail page lands the trainer where they came
            // from instead of on the client picker they never wanted to
            // see. Captured off window.location at click time so any query
            // params (openMappingId, filters, tabs) round-trip cleanly.
            label: 'Grade',
            icon: <GraduationCap size={14} />,
            onClick: onGrade ?? (() => {
                const here = typeof window !== 'undefined'
                    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                    : '';
                const q = here ? `?returnTo=${encodeURIComponent(here)}` : '';
                router.push(`/lms/pages/grades/${status.id}${q}`);
            }),
            enabled: true, hint: '',
        },
        approval: {
            // The former standalone Approvals page is retired; this action
            // opens the same modal (ApprovalHierarchyModal) with this course
            // already pinned, so the manager configures the chain in place.
            label: 'Set Approval',
            icon: <GitBranch size={14} />,
            onClick: onApproval ?? (() => {}),
            enabled: Boolean(onApproval),
            hint: 'Approval configuration is not available in this context',
        },
    }
    const ITEMS = allowedItems.map((key) => ALL[key])

    // Every offered item is denied — hide the trigger rather than render an
    // empty menu. Matches ClientManagementPage's pattern of omitting the
    // action button entirely when the user can do nothing with it.
    if (!allowedItems.length) return null

    const menu = pos ? createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: WIDTH }}
                    className="z-popover rounded-xl border border-hairline bg-surface shadow-xl overflow-hidden py-1"
                >
                    {ITEMS.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            disabled={!item.enabled}
                            title={item.enabled ? undefined : item.hint}
                            onClick={() => { if (item.enabled) { setOpen(false); item.onClick() } }}
                            className={`w-full h-8 px-2.5 flex items-center gap-2 text-xs text-left transition-colors ${
                                item.enabled
                                    ? 'text-body hover:bg-brand-wash hover:text-brand-strong'
                                    : 'text-ink-300 cursor-not-allowed'
                            }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    ) : null

    return (
        <div
            className="relative flex-shrink-0"
            onMouseEnter={() => { cancelClose(); setOpen(true) }}
            onMouseLeave={scheduleClose}
        >
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
                {label}
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {menu}
        </div>
    )
}
