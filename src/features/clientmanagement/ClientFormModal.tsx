"use client"

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, ArrowRight, Building, Check, ChevronDown, Loader2, Pencil, Plus, User, X,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Modal, StatusPill, Field, Input as KitInput, Textarea as KitTextarea, Checkbox } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'
import TipTapEditor from '@/app/lms/component/tiptopEditor'
import type { ContactPerson } from '@/apiServices/clientManagementService'
import { BUSINESS_MODELS, type ContactErrors, type FormData, type FormErrors } from './lib'
import PhoneField from './PhoneField'
import { DiscardChangesDialog } from './ConfirmDialogs'

// ─── Basic information step ───────────────────────────────────────────────────

function BasicInfoSection({
    formData,
    onChange,
    onDescriptionChange,
    errors,
    readOnly,
}: {
    formData: FormData
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onDescriptionChange: (html: string) => void
    errors: FormErrors
    readOnly?: boolean
}) {
    return (
        <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <Field label="Client name" required error={errors.clientCompany}>
                    <KitInput
                        name="clientCompany"
                        value={formData.clientCompany}
                        onChange={onChange}
                        placeholder="e.g. Acme Pvt Ltd"
                        invalid={Boolean(errors.clientCompany)}
                    />
                </Field>
                {/* Status is managed from the list's Activate/Deactivate
                    toggle — not here. New clients start Active. */}
                <Field label="Business model" required error={errors.businessModel}>
                    {/* Modern dropdown replaces the old native <select>
                        (2026-08-30 user request). Trigger looks like a
                        text input; the panel below shows each model as
                        a two-line row (code + description) with a checkmark
                        on the current selection. The click handler
                        synthesises a minimal ChangeEvent so the parent's
                        existing `onChange` handler (which reads
                        e.target.name/value from the old <select>) works
                        unchanged. Uses the project's shared DropdownMenu
                        primitive — no new UI dependency. */}
                    {(() => {
                        const selected = BUSINESS_MODELS.find((m) => m.value === formData.businessModel)
                        const [selCode, selPhrase] = selected ? selected.label.split('—').map((s) => s.trim()) : ['', '']
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        aria-invalid={errors.businessModel ? true : undefined}
                                        aria-haspopup="listbox"
                                        className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15 ${
                                            errors.businessModel
                                                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
                                                : 'border-hairline-strong hover:border-line-hover focus:border-brand focus:ring-brand/15'
                                        }`}
                                    >
                                        {selected ? (
                                            <span className="flex min-w-0 items-baseline gap-2 truncate">
                                                <span className="font-semibold text-heading">{selCode}</span>
                                                <span className="truncate text-xs text-subtle">{selPhrase}</span>
                                            </span>
                                        ) : (
                                            <span className="text-faint">Select a business model…</span>
                                        )}
                                        <ChevronDown size={16} className="shrink-0 text-subtle" aria-hidden />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="bottom"
                                    align="start"
                                    sideOffset={6}
                                    // avoidCollisions must be false or Radix flips the
                                    // panel to whichever edge has more room inside the
                                    // modal — which in the modal's cramped horizontal
                                    // frame usually meant "off to the LEFT of the
                                    // trigger" (2026-08-30 user report). Forcing side
                                    // "bottom" + avoidCollisions:false pins the panel
                                    // to sit directly UNDER the trigger, always.
                                    avoidCollisions={false}
                                    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] p-1"
                                >
                                    {BUSINESS_MODELS.map((m) => {
                                        const isSel = formData.businessModel === m.value
                                        const [code, phrase] = m.label.split('—').map((s) => s.trim())
                                        return (
                                            <DropdownMenuItem
                                                key={m.value}
                                                onClick={() => onChange({
                                                    target: { name: 'businessModel', value: m.value },
                                                } as unknown as React.ChangeEvent<HTMLSelectElement>)}
                                                className={`cursor-pointer gap-2 rounded-[8px] py-2 pl-2.5 pr-2 ${
                                                    isSel ? 'bg-brand-wash text-brand-strong' : ''
                                                }`}
                                            >
                                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                                    <span className={`text-sm font-semibold ${isSel ? 'text-brand-strong' : 'text-heading'}`}>
                                                        {code}
                                                    </span>
                                                    <span className={`text-xs ${isSel ? 'text-brand-strong/80' : 'text-subtle'}`}>
                                                        {phrase || m.label}
                                                    </span>
                                                </span>
                                                {isSel && <Check size={14} className="shrink-0 text-brand-strong" aria-hidden />}
                                            </DropdownMenuItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    })()}
                </Field>
            </div>

            <Field label="Address">
                <KitTextarea
                    name="clientAddress"
                    value={formData.clientAddress}
                    onChange={onChange}
                    placeholder="Street, city, state, ZIP"
                    rows={2}
                    className="min-h-0 resize-none"
                />
            </Field>

            <Field label="Description">
                <TipTapEditor
                    value={formData.description}
                    onChange={onDescriptionChange}
                    placeholder="Short notes about this client…"
                    minHeight="120px"
                    maxHeight="220px"
                    editable={!readOnly}
                    showToolbar={!readOnly}
                />
            </Field>
        </section>
    )
}

// ─── Contacts step ────────────────────────────────────────────────────────────

function StepContacts({
    contacts,
    onContactChange,
    onAdd,
    onRemove,
    onPrimaryChange,
    disabled,
    errors,
}: {
    contacts: ContactPerson[]
    onContactChange: (index: number, field: string, value: string) => void
    onAdd: () => void
    onRemove: (index: number) => void
    onPrimaryChange: (index: number, checked: boolean) => void
    disabled?: boolean
    errors?: ContactErrors[]
}) {
    return (
        <div className="space-y-3">
            {contacts.map((contact, index) => {
                const err = errors?.[index] || {}
                return (
                    <div key={index} className="rounded-tile border border-hairline bg-surface p-4 space-y-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                                    Contact {index + 1}
                                </span>
                                {contact.isPrimary && (
                                    <StatusPill tone="success" dot>
                                        Primary
                                    </StatusPill>
                                )}
                            </div>
                            {contacts.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(index)}
                                    disabled={disabled}
                                    className="w-6 h-6 rounded-chip flex items-center justify-center text-faint hover:text-danger-700 hover:bg-danger-50 transition-colors duration-150"
                                    aria-label="Remove contact"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                            <Field label="Name" required error={err.name}>
                                <KitInput
                                    value={contact.name}
                                    onChange={(e) => onContactChange(index, 'name', e.target.value)}
                                    placeholder="Full name"
                                    invalid={Boolean(err.name)}
                                    disabled={disabled}
                                />
                            </Field>
                            <Field label="Email" required error={err.email}>
                                <KitInput
                                    type="email"
                                    value={contact.email}
                                    onChange={(e) => onContactChange(index, 'email', e.target.value)}
                                    placeholder="email@company.com"
                                    invalid={Boolean(err.email)}
                                    disabled={disabled}
                                />
                            </Field>
                            <Field label="Mobile" required error={err.phoneNumber}>
                                <PhoneField
                                    value={contact.phoneNumber}
                                    onChange={(v) => onContactChange(index, 'phoneNumber', v)}
                                    hasError={Boolean(err.phoneNumber)}
                                    disabled={disabled}
                                />
                            </Field>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer w-fit">
                            <Checkbox
                                checked={contact.isPrimary}
                                onCheckedChange={(v) => onPrimaryChange(index, v === true)}
                                disabled={disabled}
                                aria-label={`Set contact ${index + 1} as primary`}
                            />
                            <span className="text-xs text-subtle">Set as primary contact</span>
                        </label>
                    </div>
                )
            })}

            <button
                type="button"
                onClick={onAdd}
                disabled={disabled}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-tile border border-dashed border-hairline-strong text-sm font-medium text-brand-strong hover:bg-brand-wash hover:border-brand-500/40 transition-colors duration-150 disabled:opacity-50"
            >
                <Plus size={15} />
                Add another contact
            </button>
        </div>
    )
}

// ─── Wizard step rail (slim horizontal) ───────────────────────────────────────

const STEPS = [
    { key: 'details', label: 'Details', icon: Building },
    { key: 'contacts', label: 'Contacts', icon: User },
] as const

function StepperNav({
    stepIndex,
    onStep,
}: {
    stepIndex: number
    onStep: (target: number) => void
}) {
    return (
        <nav aria-label="Form steps" className="flex items-center gap-2 mb-5">
            {STEPS.map((s, i) => {
                const StepIcon = s.icon
                const state = i === stepIndex ? 'active' : i < stepIndex ? 'done' : 'todo'
                return (
                    <React.Fragment key={s.key}>
                        {i > 0 && (
                            <span
                                aria-hidden
                                className={`h-px flex-1 min-w-6 transition-colors duration-150 ${
                                    i <= stepIndex ? 'bg-success-500/50' : 'bg-hairline-strong'
                                }`}
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => onStep(i)}
                            aria-current={state === 'active' ? 'step' : undefined}
                            className={`flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-sm font-medium transition-colors duration-150 ${
                                state === 'active'
                                    ? 'border-brand-500/40 bg-brand-wash text-brand-strong'
                                    : state === 'done'
                                        ? 'border-success-500/25 bg-success-50 text-success-700'
                                        : 'border-hairline bg-surface text-subtle hover:text-heading hover:border-hairline-strong'
                            }`}
                        >
                            <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold ${
                                    state === 'active'
                                        ? 'bg-brand-strong text-white'
                                        : state === 'done'
                                            ? 'bg-success-500 text-white'
                                            : 'bg-ink-100 text-subtle'
                                }`}
                            >
                                {state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}
                            </span>
                            <StepIcon size={14} className="hidden sm:block" />
                            {s.label}
                        </button>
                    </React.Fragment>
                )
            })}
        </nav>
    )
}

// ─── Client form modal (2-step wizard) ────────────────────────────────────────

export default function ClientFormModal({
    open,
    onClose,
    isEditing,
    viewMode,
    isLoading,
    formData,
    errors,
    onInputChange,
    onDescriptionChange,
    onValidateStep,
    onContactChange,
    onAddContact,
    onRemoveContact,
    onPrimaryChange,
    onSubmit,
}: {
    open: boolean
    onClose: () => void
    isEditing: boolean
    viewMode: boolean
    isLoading: boolean
    formData: FormData
    errors: FormErrors
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onDescriptionChange: (html: string) => void
    onValidateStep: (step: number) => boolean
    onContactChange: (index: number, field: string, value: string) => void
    onAddContact: () => void
    onRemoveContact: (index: number) => void
    onPrimaryChange: (index: number, checked: boolean) => void
    onSubmit: (e: React.FormEvent) => void
}) {
    const [readOnly, setReadOnly] = useState(false)
    const [stepIndex, setStepIndex] = useState(0)
    const [showDiscard, setShowDiscard] = useState(false)
    const isLastStep = stepIndex === STEPS.length - 1

    // Navigate to a step; going forward validates each step in between first
    // (skipped in read-only view). Blocks + toasts on the first invalid step.
    const goToStep = (target: number) => {
        if (!readOnly && target > stepIndex) {
            for (let s = stepIndex; s < target; s++) {
                if (!onValidateStep(s)) return
            }
        }
        setStepIndex(target)
    }

    // Only allow a real submit from the final step. Any stray submit from an
    // earlier step (Enter key, button reconciliation) is treated as "advance".
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLastStep) {
            goToStep(stepIndex + 1)
            return
        }
        onSubmit(e)
    }

    // Snapshot of the form when the modal opens, to detect unsaved changes
    const initialSnapshot = React.useRef<string>('')

    useEffect(() => {
        if (open) {
            setReadOnly(viewMode)
            setStepIndex(0)
            setShowDiscard(false)
            initialSnapshot.current = JSON.stringify(formData)
        }
        // Intentionally snapshot only on open (not on every keystroke)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, viewMode])

    // After a failed submit, jump to the first step that has errors
    useEffect(() => {
        if (errors.clientCompany || errors.businessModel) setStepIndex(0)
        else if (errors.contacts?.some((c) => c && Object.keys(c).length)) setStepIndex(1)
    }, [errors])

    // Close with an unsaved-changes guard (skipped in read-only / while saving).
    // When dirty, open the in-app discard dialog instead of a native confirm().
    // Escape and overlay clicks route here via the kit Modal's Radix dialog;
    // while the discard dialog is open, ITS (topmost) layer takes Escape first,
    // so the discard-closes-before-the-wizard order is preserved.
    const guardedClose = React.useCallback(() => {
        if (isLoading) return
        const dirty = !readOnly && JSON.stringify(formData) !== initialSnapshot.current
        if (dirty) { setShowDiscard(true); return }
        onClose()
    }, [isLoading, readOnly, formData, onClose])

    const title = readOnly ? 'View client' : isEditing ? 'Edit client' : 'Add client'
    const subtitle = `Step ${stepIndex + 1} of ${STEPS.length} · ${STEPS[stepIndex].label}`

    return (
        <>
            <Modal
                open={open}
                onClose={guardedClose}
                size="xl"
                title={
                    <span className="flex items-center gap-2.5 flex-wrap">
                        {title}
                        {readOnly && (
                            <>
                                <StatusPill tone="neutral">Read only</StatusPill>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => setReadOnly(false)}
                                >
                                    <Pencil className="size-3" /> Edit
                                </Button>
                            </>
                        )}
                    </span>
                }
                description={subtitle}
                footer={
                    <div className="flex flex-1 items-center justify-between gap-2">
                        <div>
                            {stepIndex > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStepIndex((s) => s - 1)}
                                >
                                    <ArrowLeft className="size-3.5" /> Back
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={guardedClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            {readOnly ? (
                                isLastStep ? (
                                    <Button
                                        key="action-edit"
                                        type="button"
                                        size="sm"
                                        onClick={() => setReadOnly(false)}
                                    >
                                        <Pencil className="size-3.5" /> Edit
                                    </Button>
                                ) : (
                                    <Button
                                        key="action-next"
                                        type="button"
                                        size="sm"
                                        onClick={() => goToStep(stepIndex + 1)}
                                    >
                                        Next <ArrowRight className="size-3.5" />
                                    </Button>
                                )
                            ) : isLastStep ? (
                                <Button
                                    key="action-submit"
                                    type="submit"
                                    form="client-form"
                                    size="sm"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" /> Saving…
                                        </>
                                    ) : (
                                        <>
                                            <Check className="size-3.5" /> {isEditing ? 'Save changes' : 'Add client'}
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    key="action-continue"
                                    type="button"
                                    size="sm"
                                    onClick={() => goToStep(stepIndex + 1)}
                                >
                                    Continue <ArrowRight className="size-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                <StepperNav stepIndex={stepIndex} onStep={goToStep} />

                <form id="client-form" onSubmit={handleFormSubmit} className="min-h-[360px]">
                    <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={STEPS[stepIndex].key}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12 }}
                                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                            >
                                {stepIndex === 0 ? (
                                    <BasicInfoSection
                                        formData={formData}
                                        onChange={onInputChange}
                                        onDescriptionChange={onDescriptionChange}
                                        errors={errors}
                                        readOnly={readOnly}
                                    />
                                ) : (
                                    <StepContacts
                                        contacts={formData.contactPersons}
                                        onContactChange={onContactChange}
                                        onAdd={onAddContact}
                                        onRemove={onRemoveContact}
                                        onPrimaryChange={onPrimaryChange}
                                        disabled={isLoading}
                                        errors={errors.contacts}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </fieldset>
                </form>
            </Modal>

            <DiscardChangesDialog
                open={showDiscard}
                onConfirm={() => { setShowDiscard(false); onClose() }}
                onCancel={() => setShowDiscard(false)}
            />
        </>
    )
}
