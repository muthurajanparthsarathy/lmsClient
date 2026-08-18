"use client"

import React from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
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

// ─── Discard-changes confirmation ─────────────────────────────────────────────

export function DiscardChangesDialog({
    open,
    onConfirm,
    onCancel,
}: {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <Modal
            open={open}
            onClose={onCancel}
            size="sm"
            hideClose
            footer={
                <div className="flex flex-1 items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel}>
                        Keep editing
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onConfirm}>
                        <Trash2 className="size-3.5" />
                        Discard
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center text-center px-1 pt-2 pb-1">
                <div className="w-11 h-11 rounded-full bg-warn-50 border border-warn-500/20 flex items-center justify-center mb-4">
                    <AlertTriangle size={20} className="text-warn-500" />
                </div>
                <h3 className="text-md font-semibold text-heading mb-1">Discard changes?</h3>
                <p className="text-sm text-subtle leading-relaxed">
                    You have unsaved changes. If you leave now, they&apos;ll be lost.
                </p>
            </div>
        </Modal>
    )
}
