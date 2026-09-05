"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, ArrowRight, Building, Check, ChevronDown, Loader2, Pencil, Plus, Trash2, Upload, User, X,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Modal, StatusPill, Field, Input as KitInput, Textarea as KitTextarea, Checkbox } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'
import TipTapEditor from '@/app/lms/component/tiptopEditor'
import { clientManagementApi, type ContactPerson } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { BUSINESS_MODELS, notify, type ContactErrors, type FormData, type FormErrors } from './lib'
import PhoneField from './PhoneField'
import { DiscardChangesDialog } from './ConfirmDialogs'

// ─── Logo picker ──────────────────────────────────────────────────────────────
// Optional client logo upload used inside the Basic Info step. Uploads
// immediately on file selection (so the parent form never has to shepherd a
// pending File through validation and submit) and reports the resulting
// absolute URL back through onChange. Renders a live preview of the picked
// image; when no logo is set, falls back to a first-letter avatar circle
// derived from the client name so the reader always sees a plausible slot.
// Validation duplicates the server's mime/ext/size checks up-front so the
// user gets an immediate rejection without a round-trip.
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_ACCEPT_MIME = 'image/jpeg,image/jpg,image/png,image/webp'
const LOGO_ACCEPT_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

function LogoPicker({
    value,
    fallbackLetter,
    disabled,
    onChange,
}: {
    value: string
    fallbackLetter: string
    disabled?: boolean
    onChange: (url: string) => void
}) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)
    // Preview is a `blob:` URL while the file is uploading, then swaps to the
    // server URL once the response lands — so the reader sees the picked image
    // instantly rather than a blank circle for the seconds the round-trip
    // takes. Cleaned up when the component unmounts or the preview changes.
    const [localPreview, setLocalPreview] = useState<string | null>(null)
    useEffect(() => () => {
        if (localPreview) URL.revokeObjectURL(localPreview)
    }, [localPreview])
    // If the saved URL fails to load (broken link, server offline, deleted
    // file) fall back to the letter avatar rather than a browser's broken-
    // image glyph. Reset whenever the URL itself changes so a fresh upload
    // isn't tarred by a previous failure.
    const [broken, setBroken] = useState(false)
    useEffect(() => { setBroken(false) }, [value])

    const shownSrc = localPreview || (!broken ? value : '')

    const handleFile = async (file: File) => {
        // Duplicate the server's guard rails in the browser so the user gets
        // instant feedback instead of a rejected request seconds later.
        const ext = (file.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase()
        const mime = file.type.toLowerCase()
        if (!LOGO_ACCEPT_EXTS.includes(ext) || !mime.startsWith('image/')) {
            notify.error('Only JPG, PNG or WebP images are allowed')
            return
        }
        if (file.size > LOGO_MAX_BYTES) {
            notify.error('Logo must be 5 MB or smaller')
            return
        }
        // Show the picked image straight away — no need to wait for the
        // upload. If the upload later fails we swap this back to whatever
        // was on record.
        const preview = URL.createObjectURL(file)
        setLocalPreview(preview)
        setUploading(true)
        try {
            const res = await clientManagementApi.uploadLogo(file)
            const url = res?.data?.url
            if (!url) throw new Error('No URL returned by the server')
            onChange(url)
        } catch (e: any) {
            notify.error(e?.message || 'Failed to upload the logo')
            // Roll the preview back so the reader sees the pre-upload state.
            setLocalPreview(null)
        } finally {
            setUploading(false)
            // Reset the input so re-selecting the same file re-fires change.
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    const handleRemove = () => {
        if (uploading) return
        setLocalPreview(null)
        onChange('')
    }

    return (
        <div className="flex items-center gap-4">
            {/* Preview slot — circular, matches the listing's avatar shape. */}
            <div className="relative size-16 shrink-0 rounded-full border border-hairline bg-brand-wash overflow-hidden flex items-center justify-center">
                {shownSrc ? (
                    <img
                        src={shownSrc}
                        alt=""
                        className="size-full object-cover"
                        onError={() => {
                            setLocalPreview(null)
                            setBroken(true)
                        }}
                    />
                ) : (
                    <span className="text-xl font-semibold text-brand-strong select-none">
                        {fallbackLetter || '?'}
                    </span>
                )}
                {uploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
                        <Loader2 size={16} className="animate-spin text-brand-strong" />
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={LOGO_ACCEPT_MIME}
                        className="hidden"
                        disabled={disabled || uploading}
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void handleFile(f)
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled || uploading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={13} />
                        {value || localPreview ? 'Replace' : 'Upload'}
                    </button>
                    {(value || localPreview) && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={disabled || uploading}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-xs font-medium text-danger-700 hover:bg-danger-50 transition-colors duration-150 disabled:opacity-50"
                        >
                            <Trash2 size={13} /> Remove
                        </button>
                    )}
                </div>
                <p className="text-xs text-subtle leading-snug">
                    Optional · JPG, PNG or WebP · up to 5 MB
                </p>
            </div>
        </div>
    )
}

// ─── Basic information step ───────────────────────────────────────────────────

function BasicInfoSection({
    formData,
    onChange,
    onDescriptionChange,
    onLogoChange,
    errors,
    readOnly,
}: {
    formData: FormData
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onDescriptionChange: (html: string) => void
    onLogoChange: (url: string) => void
    errors: FormErrors
    readOnly?: boolean
}) {
    // First letter of the client name is the letter shown inside the fallback
    // avatar. Trims first so a stray leading space doesn't produce an empty
    // circle when the user has actually typed something.
    const initialLetter = (formData.clientCompany || '').trim().charAt(0).toUpperCase()
    return (
        <section className="space-y-4">
            <Field label="Client logo">
                <LogoPicker
                    value={formData.clientLogo || ''}
                    fallbackLetter={initialLetter}
                    disabled={readOnly}
                    onChange={onLogoChange}
                />
            </Field>

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
    onLogoChange,
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
    onLogoChange: (url: string) => void
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
                                        onLogoChange={onLogoChange}
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
