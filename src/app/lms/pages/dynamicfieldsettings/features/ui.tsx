"use client"

// Page-local presentational kit for the Dynamic Field Settings console.
// Pure chrome — no data logic lives here. Every tab composes the same
// card shell, header, count pill, pager and destructive-confirm dialog
// so the five surfaces read as one product.

import React from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Trash2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/app/lms/shared/ui'

/* ── Card shell ──────────────────────────────────────────────────────────── */

export function TabCard({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={`bg-surface border border-hairline rounded-xl shadow-xs overflow-hidden flex flex-col ${className}`}>
            {children}
        </div>
    )
}

export function TabCardHeader({
    icon: Icon,
    title,
    subtitle,
    actions,
}: {
    icon: LucideIcon
    title: string
    subtitle?: string
    actions?: React.ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-tile bg-brand-wash">
                    <Icon className="h-4.5 w-4.5 text-brand-strong" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-md font-semibold text-heading truncate">{title}</h3>
                    {subtitle ? <p className="text-xs text-subtle truncate">{subtitle}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex items-center gap-2 flex-shrink-0">{actions}</div> : null}
        </div>
    )
}

/* ── Small chrome ────────────────────────────────────────────────────────── */

export function CountPill({ value, label }: { value: number; label: string }) {
    return (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink-100 px-3 text-xs font-medium text-ink-700">
            <span className="font-semibold tabular-nums text-heading">{value}</span>
            {label}
        </span>
    )
}

const PAGER_BTN =
    'flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong bg-surface text-subtle ' +
    'transition-colors duration-150 hover:border-line-hover hover:text-heading ' +
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline-strong'

export function MiniPager({
    page,
    totalPages,
    onPrev,
    onNext,
    prevDisabled,
    nextDisabled,
}: {
    page: number
    totalPages: number
    onPrev: () => void
    onNext: () => void
    prevDisabled?: boolean
    nextDisabled?: boolean
}) {
    return (
        <div className="flex items-center gap-2">
            <button type="button" onClick={onPrev} disabled={prevDisabled} aria-label="Previous page" className={PAGER_BTN}>
                <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-subtle tabular-nums whitespace-nowrap">
                Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Next page" className={PAGER_BTN}>
                <ChevronRight size={15} />
            </button>
        </div>
    )
}

/* ── Table primitives (hand-rolled tables share the DataTable anatomy) ───── */

export const TH_CLASS =
    'h-11 bg-canvas border-b border-hairline px-4 text-left align-middle text-2xs font-semibold uppercase tracking-wider text-subtle'

export const TD_CLASS = 'h-12 px-4 align-middle text-sm text-body'

export function RowIconButton({
    label,
    danger,
    disabled,
    onClick,
    children,
}: {
    label: string
    danger?: boolean
    disabled?: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-chip transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-40 ${
                danger
                    ? 'text-subtle hover:bg-danger-50 hover:text-danger-700'
                    : 'text-subtle hover:bg-ink-100 hover:text-heading'
            }`}
        >
            {children}
        </button>
    )
}

/* ── Destructive confirm dialog ──────────────────────────────────────────── */

export function ConfirmDeleteModal({
    open,
    onClose,
    onConfirm,
    title,
    entityName,
    message,
    isPending,
    confirmLabel = 'Delete',
}: {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    entityName?: string
    message?: string
    isPending: boolean
    confirmLabel?: string
}) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            size="sm"
            hideClose
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                {confirmLabel}
                            </>
                        )}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col items-center px-1 py-2 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-tile bg-danger-50">
                    <AlertTriangle className="h-5 w-5 text-danger-700" />
                </div>
                <h3 className="text-md font-semibold text-heading">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-subtle">
                    {message ?? (
                        <>
                            Are you sure you want to delete{' '}
                            {entityName ? <span className="font-medium text-heading">{entityName}</span> : 'this item'}?
                        </>
                    )}
                </p>
                <p className="mt-1 text-xs font-medium text-danger-700">This action cannot be undone.</p>
            </div>
        </Modal>
    )
}
