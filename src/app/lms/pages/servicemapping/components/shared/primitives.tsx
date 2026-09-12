"use client"

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import InfoTooltip from '@/components/ui/reusabletooltip'
import { AlertCircle, Plus, X } from 'lucide-react'
import { ListSelect } from './ListSelect'

// Shared style tokens for every field in the wizard — authored against the
// console's semantic tokens so the whole overlay family agrees on one look.
export const inputCls = "h-9 text-sm rounded-control border-hairline-strong px-3 hover:border-line-hover focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors"
// pr-4 rather than a symmetric px-2.5: a native <select> draws its chevron
// against the padding edge, so at 10px the arrow sat on the control's rounded
// corner and read as falling out of the box. Spelled as pl/pr rather than px
// plus an override, because most call sites concatenate this string raw instead
// of merging it, and then the winner would come down to stylesheet order.
export const selectCls = "w-full h-9 text-sm text-body border border-hairline-strong rounded-control pl-2.5 pr-4 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none bg-surface hover:border-line-hover transition-colors"

// Appended to a field's own classes when it fails validation, so the control
// itself reads as wrong — the message alone is easy to miss in a long form.
export const errorFieldCls = "!border-danger-500 focus:!border-danger-500 focus:!ring-danger-500/15"

// `hint` renders the shared ⓘ tooltip beside the label. Threading it through the
// primitive rather than at each call site is what lets every field in the wizard
// carry guidance without 40 near-identical tooltip wrappers.
//
// The label text and its required asterisk are wrapped together so the parent
// Label's flex gap separates the text from the ⓘ icon only — without the wrapper
// the gap also pushed the asterisk away from the word it belongs to.
export function FieldLabel({
    children,
    required,
    hint,
}: {
    children: React.ReactNode
    required?: boolean
    hint?: string
}) {
    // Sentence case, not caps. CLIENT / BUSINESS MODEL / SERVICE PROVIDING YEAR
    // shouted every field name at the user and took a beat longer to read than
    // the words themselves — and the same modal's Step 2 labels were already
    // sentence case, so the wizard disagreed with itself. `tracking-wide` goes
    // with it: that letterspacing was only there to make capitals legible.
    // Size and colour now match Step 2 as well, so one label style runs through
    // the whole wizard.
    return (
        <Label className="gap-1.5 text-sm font-medium text-heading">
            <span>
                {children}
                {required && <span className="text-brand-700 ml-0.5">*</span>}
            </span>
            {hint && <InfoTooltip content={hint} />}
        </Label>
    )
}

// The inline validation message shown under a field. Renders nothing when there
// is no error, so call sites can drop it in unconditionally.
export function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return (
        <p role="alert" className="flex items-center gap-1 text-2xs font-medium text-danger-700">
            <AlertCircle size={11} className="flex-shrink-0" />
            {message}
        </p>
    )
}

// Full-width "type a name → Add" row. Clears itself after adding; Enter also adds.
// `middle` renders between the input and the Add button (e.g. small quick-add chips).
// `compact` shrinks the row for nested contexts (inside degree/department cards).
export function AddInline({
    placeholder,
    onAdd,
    middle,
    compact,
}: {
    placeholder: string
    onAdd: (value: string) => void
    middle?: React.ReactNode
    compact?: boolean
}) {
    const [val, setVal] = useState('')
    const submit = () => { const v = val.trim(); if (!v) return; onAdd(v); setVal('') }
    return (
        <div className="flex items-center gap-2 w-full">
            <Input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder={placeholder}
                className={`${compact ? 'h-8 text-xs px-2.5 rounded-control border-hairline-strong hover:border-line-hover focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors' : inputCls} flex-1 bg-surface`}
            />
            {middle}
            <button
                type="button"
                onClick={submit}
                className={`${compact ? 'h-8 px-3' : 'h-9 px-4'} rounded-control bg-brand-700 text-white text-xs font-semibold hover:bg-brand-800 active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-colors`}
            >
                <Plus size={compact ? 12 : 13} /> Add
            </button>
        </div>
    )
}

// A "pick from a list → Add" row. The list comes from master data (degrees /
// departments defined in Degree Management), so values can't be free-typed — the
// user selects one and it's added immediately. Resets to the placeholder after
// each pick. When there's nothing left to add, shows `emptyLabel` instead.
// `compact` shrinks it for nested contexts (inside degree cards).
export function SelectAdd({
    placeholder,
    options,
    onAdd,
    compact,
    emptyLabel,
}: {
    placeholder: string
    options: string[]
    onAdd: (value: string) => void
    compact?: boolean
    emptyLabel: string
}) {
    if (options.length === 0) {
        return <p className="text-2xs text-faint italic">{emptyLabel}</p>
    }
    // Value stays EMPTY on purpose: this picker is an action, not a field. It
    // never holds a selection — choosing an option adds it and the control goes
    // back to offering the placeholder.
    return (
        <ListSelect
            value=""
            options={options.map((o) => ({ value: o, label: o }))}
            onChange={(next) => { if (next) onAdd(next) }}
            placeholder={placeholder}
            emptyLabel={emptyLabel}
            ariaLabel={placeholder}
            className={compact ? 'w-full [&>button]:h-8 [&>button]:text-xs' : 'w-full'}
        />
    )
}

// A value chip with an inline remove (×)
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-chip border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium">
            {label}
            <button
                type="button"
                onClick={onRemove}
                className="w-5 h-5 rounded flex items-center justify-center text-brand-500 hover:text-danger-500 hover:bg-surface transition-colors"
                aria-label={`Remove ${label}`}
            >
                <X size={12} />
            </button>
        </span>
    )
}
