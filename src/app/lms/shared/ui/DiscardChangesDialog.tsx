"use client"

import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'

// The "you typed something, then hit X" confirmation. Lives in the shared kit
// because more than one surface needs it — the client console form modal and
// the I_Do / We_Do exercise wizard both close the same way, and a second
// hand-rolled copy would drift in wording and button order.
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
