"use client"

import React from 'react'
import { AlertTriangle, CheckCircle2, Layers, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'
import { fmtDate } from './lib'

// The two small confirm dialogs, unified on the kit Modal so radius, shadow,
// backdrop and motion match every other overlay in the console.

// ─── Delete confirmation ──────────────────────────────────────────────────────

// What each count in the server's footprint is called on screen, and the order
// they read in — biggest consequences first. Anything the server adds later
// that is not listed here still shows, under a humanised version of its key,
// rather than being silently dropped from a destructive confirmation.
const FOOTPRINT_LABELS: Array<[string, string]> = [
    ['serviceMappings', 'Service mappings'],
    ['courses', 'Courses'],
    ['users', 'Users'],
    ['modules', 'Course modules'],
    ['moduleStructures', 'Module structures'],
    ['subModules', 'Sub-modules'],
    ['topics', 'Topics'],
    ['subTopics', 'Sub-topics'],
    ['programCalendars', 'Program calendars'],
    ['calendarSchedules', 'Calendar schedules'],
    ['attendance', 'Attendance records'],
    ['feedback', 'Feedback records'],
    ['participantGroups', 'Participant groups'],
    ['retestRequests', 'Retest requests'],
    ['glossaries', 'Glossaries'],
    ['questionBanks', 'Question banks'],
    ['questionDrafts', 'Question drafts'],
    ['workspaces', 'Student workspaces'],
    ['examSessions', 'Exam sessions'],
    ['questionActivity', 'Question activity'],
    ['studentResponses', 'Student responses'],
    ['proctorMessages', 'Proctor messages'],
    ['screenViolations', 'Screen violations'],
    ['compilerRuns', 'Compiler runs'],
    ['activityLogs', 'Activity logs'],
    ['notifications', 'Notifications'],
    ['otps', 'OTPs'],
    ['printSettings', 'Print settings'],
]

const humanise = (key: string) =>
    key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

/** The footprint as ordered, non-zero rows. Zero counts are dropped — a list
 *  of twenty "0"s buries the three numbers that matter. */
function footprintRows(counts: Record<string, number> | undefined) {
    if (!counts) return []
    const known = new Set(FOOTPRINT_LABELS.map(([key]) => key))
    const rows = FOOTPRINT_LABELS
        .filter(([key]) => (counts[key] || 0) > 0)
        .map(([key, label]) => ({ key, label, n: counts[key] }))
    const extra = Object.keys(counts)
        .filter((key) => !known.has(key) && (counts[key] || 0) > 0)
        .map((key) => ({ key, label: humanise(key), n: counts[key] }))
    return [...rows, ...extra]
}

export function DeleteConfirmModal({
    open,
    clientName,
    isLoading,
    impact,
    impactLoading,
    impactError,
    sharedUsersKept = 0,
    onConfirm,
    onCancel,
}: {
    open: boolean
    clientName: string
    isLoading: boolean
    /** Counts of everything the cascade will remove, from the server. */
    impact?: Record<string, number>
    impactLoading?: boolean
    impactError?: boolean
    /** Accounts that also belong to another client: kept, not deleted. */
    sharedUsersKept?: number
    onConfirm: () => void
    onCancel: () => void
}) {
    const rows = footprintRows(impact)
    const total = rows.reduce((n, r) => n + r.n, 0)
    // Typing the client's name is the gate. A delete that now takes courses,
    // students and their whole history with it is not something a mis-aimed
    // click on a confirm button should be able to do, and the name is the one
    // thing a user cannot supply by reflex.
    const [typed, setTyped] = React.useState('')
    React.useEffect(() => { if (open) setTyped('') }, [open])
    const nameMatches = typed.trim().toLowerCase() === clientName.trim().toLowerCase()
    const canDelete = nameMatches && !isLoading && !impactLoading

    return (
        <Modal
            open={open}
            // Escape is ignored while the delete is in flight; the overlay click
            // never closes this dialog at all, in flight or not — it blinks.
            onClose={() => { if (!isLoading) onCancel() }}
            size="md"
            hideClose
            dismissOnOutsideClick={false}
            footer={
                <div className="flex flex-1 items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onConfirm} disabled={!canDelete}>
                        {isLoading ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <Trash2 className="size-3.5" />
                                Delete everything
                            </>
                        )}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col px-1 pt-2 pb-1">
                <div className="flex flex-col items-center text-center">
                    <div className="w-11 h-11 rounded-full bg-danger-50 border border-danger-500/15 flex items-center justify-center mb-4">
                        <AlertTriangle size={20} className="text-danger-500" />
                    </div>
                    <h3 className="text-md font-semibold text-heading mb-1">Delete client</h3>
                    <p className="text-sm text-subtle leading-relaxed">
                        <span className="font-medium text-heading">{clientName}</span> and everything
                        that belongs to it will be permanently removed.
                        <br />
                        This action cannot be undone.
                    </p>
                </div>

                {/* The footprint, counted on the server by the same code that
                    does the deleting — so the numbers describe exactly what the
                    button will remove, not an estimate of it. */}
                <div className="mt-4 rounded-lg border border-danger-500/20 bg-danger-50/40">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-danger-500/15">
                        <span className="text-xs font-semibold uppercase tracking-wide text-danger-700">
                            Will be deleted
                        </span>
                        {!impactLoading && !impactError && (
                            <span className="text-xs font-semibold text-danger-700 tabular-nums">
                                {total} record{total === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    {impactLoading ? (
                        <p className="flex items-center gap-2 px-3 py-3 text-sm text-subtle">
                            <Loader2 className="size-3.5 animate-spin" />
                            Checking what this client owns…
                        </p>
                    ) : impactError ? (
                        <p className="px-3 py-3 text-sm text-danger-700">
                            Could not check what this client owns. Deleting now still removes
                            everything — you just will not see the list first.
                        </p>
                    ) : rows.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-subtle">
                            This client has no services, courses or users yet — only the client
                            record itself will be removed.
                        </p>
                    ) : (
                        <ul className="max-h-48 overflow-y-auto px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            {rows.map((r) => (
                                <li key={r.key} className="flex items-baseline justify-between gap-3 py-0.5">
                                    <span className="text-sm text-body truncate">{r.label}</span>
                                    <span className="text-sm font-semibold text-heading tabular-nums">{r.n}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {sharedUsersKept > 0 && (
                    <p className="mt-2 text-xs text-subtle">
                        {sharedUsersKept} user{sharedUsersKept === 1 ? '' : 's'} also
                        belong{sharedUsersKept === 1 ? 's' : ''} to another client and will be
                        kept — they only lose their link to this one.
                    </p>
                )}

                <label className="mt-4 block">
                    <span className="text-xs text-subtle">
                        Type <span className="font-semibold text-heading">{clientName}</span> to confirm
                    </span>
                    <input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        disabled={isLoading}
                        autoComplete="off"
                        placeholder={clientName}
                        className="mt-1 h-9 w-full rounded-lg border border-hairline-strong px-2.5 text-sm text-ink-800 bg-white focus:border-danger-500 focus:ring-2 focus:ring-danger-500/15 focus:outline-none disabled:bg-ink-50"
                    />
                </label>
            </div>
        </Modal>
    )
}

// ─── Client-created success dialog ────────────────────────────────────────────
// Shown right after a successful Add Client. Two-choice: "Create service" hands
// off to the Service Mapping page's New Mapping wizard with this client already
// selected, so the trainer can chain "add client → map a service" without
// going back to the list; "Done" just closes the dialog.
export function ClientCreatedSuccessModal({
    open,
    clientName,
    createdAt,
    onCreateService,
    onClose,
    canCreateService,
}: {
    open: boolean
    clientName: string
    createdAt?: string
    onCreateService: () => void
    onClose: () => void
    /** Hides the primary "Create service" button when the user's permission
     *  set doesn't include Service Mapping — the trainer can still dismiss
     *  the dialog and see the client in the list. */
    canCreateService: boolean
}) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            size="sm"
            hideClose
            dismissOnOutsideClick={false}
            footer={
                <div className="flex flex-1 items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Done
                    </Button>
                    {canCreateService && (
                        <Button variant="default" size="sm" onClick={onCreateService}>
                            <Layers className="size-3.5" />
                            Create service
                        </Button>
                    )}
                </div>
            }
        >
            <div className="flex flex-col items-center text-center px-1 pt-2 pb-1">
                <div className="w-11 h-11 rounded-full bg-success-50 border border-success-500/15 flex items-center justify-center mb-4">
                    <CheckCircle2 size={22} className="text-success-500" />
                </div>
                <h3 className="text-md font-semibold text-heading mb-1">Client added</h3>
                {createdAt && (
                    <p className="mb-2 text-xs text-subtle">Created on <time dateTime={createdAt}>{fmtDate(createdAt)}</time></p>
                )}
                <p className="text-sm text-subtle leading-relaxed">
                    <span className="font-medium text-heading">{clientName || 'The client'}</span>{' '}
                    was added successfully.
                    {canCreateService && (
                        <>
                            <br />
                            Map a service to this client now?
                        </>
                    )}
                </p>
            </div>
        </Modal>
    )
}


// ─── Deactivate confirmation ──────────────────────────────────────────────────
// Shown before an Active client is switched to Inactive. Activation skips this
// dialog entirely — only the direction that takes a client out of circulation
// needs a second look.

// ─── Deactivate confirmation ──────────────────────────────────────────────────
// Shown before an Active client is switched to Inactive. Activation skips this
// dialog entirely — only the direction that takes a client out of circulation
// needs a second look.

export function DeactivateConfirmModal({
    open,
    clientName,
    isLoading,
    onConfirm,
    onCancel,
}: {
    open: boolean
    clientName: string
    isLoading?: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
                <h2 className="text-base font-semibold text-heading">Deactivate client?</h2>
                <p className="mt-2 text-sm text-subtle">
                    <span className="font-medium text-body">{clientName}</span> will be marked
                    inactive. You can reactivate it at any time.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
                        No, keep active
                    </Button>
                    <Button size="sm" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? 'Deactivating…' : 'Yes, deactivate'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
// ─── Discard-changes confirmation ─────────────────────────────────────────────
// Promoted to the shared UI kit — the exercise wizard needs the same dialog, and
// two copies would drift. Re-exported here so this module's surface is unchanged.
export { DiscardChangesDialog } from '@/app/lms/shared/ui/DiscardChangesDialog'
