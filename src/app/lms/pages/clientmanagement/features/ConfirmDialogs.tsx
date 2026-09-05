"use client"

import React from 'react'
import { AlertTriangle, CheckCircle2, Layers, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'

// The two small confirm dialogs, unified on the kit Modal so radius, shadow,
// backdrop and motion match every other overlay in the console.

// ─── Delete confirmation ──────────────────────────────────────────────────────

export function DeleteConfirmModal({
    open,
    clientName,
    isLoading,
    onConfirm,
    onCancel,
}: {
    open: boolean
    clientName: string
    isLoading: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <Modal
            open={open}
            // Escape / overlay-click are ignored while the delete is in flight.
            onClose={() => { if (!isLoading) onCancel() }}
            size="sm"
            hideClose
            footer={
                <div className="flex flex-1 items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <Trash2 className="size-3.5" />
                                Delete
                            </>
                        )}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center text-center px-1 pt-2 pb-1">
                <div className="w-11 h-11 rounded-full bg-danger-50 border border-danger-500/15 flex items-center justify-center mb-4">
                    <AlertTriangle size={20} className="text-danger-500" />
                </div>
                <h3 className="text-md font-semibold text-heading mb-1">Delete client</h3>
                <p className="text-sm text-subtle leading-relaxed">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-heading">{clientName}</span>?
                    <br />
                    This action cannot be undone.
                </p>
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
    onCreateService,
    onClose,
    canCreateService,
}: {
    open: boolean
    clientName: string
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

// ─── Discard-changes confirmation ─────────────────────────────────────────────
// Promoted to the shared UI kit — the exercise wizard needs the same dialog, and
// two copies would drift. Re-exported here so this module's surface is unchanged.
export { DiscardChangesDialog } from '@/app/lms/shared/ui/DiscardChangesDialog'
