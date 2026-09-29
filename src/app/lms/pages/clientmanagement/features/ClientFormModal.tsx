"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Check, ChevronDown, ChevronRight, ChevronsUpDown, CloudUpload, Globe, ImageIcon, Info, Loader2,
    Move, Pencil, Search, Trash2, Upload, UserPlus, X,
} from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Modal, StatusPill, Field, Input as KitInput, Checkbox } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'
import TipTapEditor from '@/app/lms/component/tiptopEditor'
import { clientManagementApi } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { BUSINESS_MODELS, notify, type ContactErrors, type FormData, type FormErrors } from './lib'
import type { ContactPerson } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import PhoneField from './PhoneField'
import { DiscardChangesDialog } from './ConfirmDialogs'

// ─── Logo picker ──────────────────────────────────────────────────────────────
// A proper drag-and-drop dropzone with two visual states:
//   1. Empty — dashed rounded box with a cloud-upload glyph, a headline
//      ("Drag & drop your logo here"), a subtle "click to browse" link, and
//      the format/size helper text. Highlights orange on drag-over.
//   2. Filled — compact preview card: image thumbnail on the left, filename
//      / size metadata in the middle, Replace + Remove controls on the right.
// Uploads land immediately on drop / selection so the parent never has to
// shepherd a pending File through submit, and reports the final absolute URL
// back through `onChange`. Mime/size checks duplicate the server's so a
// rejection is instant instead of a round-trip later. Kept private to this
// file — nothing else in the console needs it.
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_ACCEPT_MIME = 'image/jpeg,image/jpg,image/png,image/webp'
const LOGO_ACCEPT_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Fish a filename out of a URL — the server saves logos as
// "<timestamp>_<random>.<ext>" so this reads out the trailing segment
// without carrying the query string.
const filenameFromUrl = (url: string): string => {
    try {
        const path = new URL(url).pathname
        return decodeURIComponent(path.split('/').pop() || 'logo')
    } catch {
        return url.split('/').pop() || 'logo'
    }
}

// Parse a "X% Y%" object-position string into a numeric pair. Bad or empty
// input falls back to center (50/50). Used by the LogoPicker's drag-to-
// reposition logic and by consumers that need the numeric values.
const parsePosition = (raw?: string): { x: number; y: number } => {
    if (!raw) return { x: 50, y: 50 }
    const match = raw.match(/^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/)
    if (!match) return { x: 50, y: 50 }
    const x = Math.max(0, Math.min(100, parseFloat(match[1])))
    const y = Math.max(0, Math.min(100, parseFloat(match[2])))
    return { x, y }
}
const formatPosition = (x: number, y: number) => `${x.toFixed(1)}% ${y.toFixed(1)}%`

// ─── Accordion step card ─────────────────────────────────────────────────
// A minimal white card with a thin blue border. Header carries a circled
// chevron on the LEFT — pointing DOWN when open, RIGHT when closed — and
// a single title line ("Step 1 — Client Information"). No filled colour,
// no step-number badge; the whole surface stays white apart from the
// border and the chevron's blue tint.
//
// Collapsed height reads as a compact ~60-64px row; expanded, the body
// sits directly below the header on the same white surface. Everything on
// the header is one button so keyboard users can activate with Enter/Space.
function StepCard({
    title,
    open,
    onToggle,
    children,
}: {
    title: string
    open: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        // No border, no rounded corners, no background chrome. Section
        // reads as plain white on the modal's own surface — separated
        // from its sibling only by the button row acting as a title.
        <section>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-1 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500/25 rounded-md"
            >
                {/* Circular chevron on the LEFT.
                      - Open  → ChevronDown (points down)
                      - Closed→ ChevronRight (points right)
                    Swap by icon, not rotation — a rotated ChevronDown
                    tilts to the LEFT in most CSS engines, which reads as
                    "the section is on the left", not "collapsed". */}
                <span
                    aria-hidden
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-info-500/60 bg-surface text-info-700 transition-colors"
                >
                    {open
                        ? <ChevronDown size={15} strokeWidth={2.4} />
                        : <ChevronRight size={15} strokeWidth={2.4} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-heading">
                    {title}
                </span>
            </button>
            {open && (
                // Nudged a touch further right than the header's chevron
                // + gap origin (44px) — a 12px cushion (pl-14 = 56px)
                // gives Business Model's "B" a hint of indent under the
                // Step 1 "S", so the body reads as clearly nested inside
                // the step, not flush with its label.
                <div className="pl-14 pr-1 pb-4 pt-0">
                    {children}
                </div>
            )}
        </section>
    )
}

// ─── Compact year picker ────────────────────────────────────────────────
// Dropdown of the past 20 years (newest first) — used for "Created Year"
// in Step 1. Emits a synthetic ChangeEvent so the parent's `onInputChange`
// contract stays identical to a plain input's.
function YearSelect({
    value,
    invalid,
    onChange,
}: {
    value: string
    invalid?: boolean
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
    const years = useMemo(() => {
        const now = new Date().getFullYear()
        return Array.from({ length: 20 }, (_, i) => String(now - i))
    }, [])
    const display = value || 'Select year…'
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-invalid={invalid ? true : undefined}
                    aria-haspopup="listbox"
                    className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15 ${
                        invalid
                            ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
                            : 'border-field hover:border-field-hover focus:border-brand focus:ring-brand/15'
                    }`}
                >
                    <span className={value ? 'text-heading tabular-nums font-medium' : 'text-faint'}>
                        {display}
                    </span>
                    <ChevronDown size={15} className="shrink-0 text-subtle" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={6}
                avoidCollisions={false}
                className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto p-1"
            >
                {years.map((y) => {
                    const isSel = value === y
                    return (
                        <DropdownMenuItem
                            key={y}
                            onClick={() => onChange({
                                target: { name: 'createdYear', value: y },
                            } as unknown as React.ChangeEvent<HTMLSelectElement>)}
                            className={`cursor-pointer rounded-[8px] px-2.5 py-1.5 text-sm tabular-nums ${
                                isSel ? 'bg-brand-wash text-brand-strong font-semibold' : 'text-body'
                            }`}
                        >
                            <span className="flex-1">{y}</span>
                            {isSel && <Check size={13} className="text-brand-strong" aria-hidden />}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ─── Profile-style circular crop preview ────────────────────────────────
// Renders the uploaded logo inside a fixed-size circle with a subtle
// rule-of-thirds grid overlay, and lets the user drag the image around to
// reposition it inside the frame. The crop itself isn't destructive — the
// original image is kept as-is on the server; we only record the CSS
// `object-position` offset so every downstream renderer (avatar, drawer,
// details page) can show the logo the same way. Kept private to this
// file — only the LogoPicker needs it.
function ProfileCropCircle({
    src,
    position,
    uploading,
    disabled,
    onPositionChange,
    onBroken,
}: {
    src: string
    position?: string
    uploading?: boolean
    disabled?: boolean
    onPositionChange?: (position: string) => void
    onBroken?: () => void
}) {
    const { x, y } = useMemo(() => parsePosition(position), [position])
    const [dragging, setDragging] = useState(false)
    const frameRef = useRef<HTMLDivElement | null>(null)
    // Pointer-drag baseline: where the pointer was when the drag began and
    // what the position was at that moment. Every pointermove computes the
    // delta from these anchors, so the image tracks the cursor 1:1 no matter
    // how big the crop frame is.
    const startRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

    const canDrag = Boolean(onPositionChange) && !disabled && !uploading

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canDrag || !frameRef.current) return
        e.preventDefault()
        // Grab pointer capture so releasing outside the circle still fires
        // the pointerup — otherwise a fast drag lets the pointer escape and
        // leaves the image in a mid-drag state.
        try { frameRef.current.setPointerCapture(e.pointerId) } catch { /* Safari <13 */ }
        startRef.current = { px: e.clientX, py: e.clientY, x, y }
        setDragging(true)
    }
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !startRef.current || !frameRef.current) return
        const rect = frameRef.current.getBoundingClientRect()
        // Convert pixel delta into a percentage of the frame, then INVERT
        // the sign: dragging the cursor RIGHT should reveal the image's
        // left side, which is object-position moving toward 0%.
        const dxPct = ((e.clientX - startRef.current.px) / rect.width) * 100
        const dyPct = ((e.clientY - startRef.current.py) / rect.height) * 100
        const nextX = Math.max(0, Math.min(100, startRef.current.x - dxPct))
        const nextY = Math.max(0, Math.min(100, startRef.current.y - dyPct))
        onPositionChange?.(formatPosition(nextX, nextY))
    }
    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragging) return
        setDragging(false)
        startRef.current = null
        try { frameRef.current?.releasePointerCapture(e.pointerId) } catch { /* ok */ }
    }

    return (
        <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative size-24 shrink-0 rounded-full overflow-hidden border border-hairline bg-surface select-none ${
                canDrag ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
            aria-label={canDrag ? 'Drag to reposition the logo inside the circle' : 'Client logo'}
        >
            <img
                src={src}
                alt=""
                draggable={false}
                onError={onBroken}
                className="pointer-events-none size-full object-cover"
                style={{ objectPosition: `${x}% ${y}%` }}
            />
            {/* Rule-of-thirds overlay — two vertical + two horizontal
                  hairlines dividing the circle into 3×3. Only shown while
                  the user is actively dragging so the frame stays clean
                  otherwise. `mix-blend-difference` keeps the lines readable
                  over dark AND light imagery. */}
            {canDrag && dragging && (
                <svg
                    aria-hidden
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 size-full mix-blend-difference"
                >
                    <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.6">
                        <line x1="33.333" y1="0" x2="33.333" y2="100" />
                        <line x1="66.666" y1="0" x2="66.666" y2="100" />
                        <line x1="0" y1="33.333" x2="100" y2="33.333" />
                        <line x1="0" y1="66.666" x2="100" y2="66.666" />
                    </g>
                </svg>
            )}
            {/* Move glyph shown when the user is NOT dragging, as a hint
                  that the frame is interactive. Fades out during the drag
                  so it doesn't compete with the grid. */}
            {canDrag && !uploading && !dragging && (
                <span className="pointer-events-none absolute bottom-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/55 text-white shadow-xs backdrop-blur-[2px]">
                    <Move size={12} strokeWidth={2.5} />
                </span>
            )}
            {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
                    <Loader2 size={18} className="animate-spin text-brand-strong" />
                </span>
            )}
        </div>
    )
}

function LogoPicker({
    value,
    position,
    fallbackLetter: _fallbackLetter,
    disabled,
    onChange,
    onPositionChange,
}: {
    value: string
    /** CSS object-position string ("50% 50%"). Empty / missing = centered. */
    position?: string
    // Kept in the props signature so callers already passing a fallback
    // letter don't error — the flat drop-zone design doesn't render the
    // first-letter circle, but callers shouldn't need to change.
    fallbackLetter: string
    disabled?: boolean
    onChange: (url: string) => void
    /** Called when the user drags the image inside the circular frame to
     *  reposition it. Receives the new object-position string; the caller
     *  stores it on the client record. Optional — if unset, the reposition
     *  tool becomes read-only. */
    onPositionChange?: (position: string) => void
}) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)
    // Preview is a blob: URL while the file is uploading, then swaps to the
    // server URL once the response lands. Cleaned up when the component
    // unmounts or the preview changes.
    const [localPreview, setLocalPreview] = useState<string | null>(null)
    // Track the picked file's name + size to render in the filled state —
    // the server URL doesn't carry the original filename.
    const [pickedMeta, setPickedMeta] = useState<{ name: string; size: number } | null>(null)
    useEffect(() => () => {
        if (localPreview) URL.revokeObjectURL(localPreview)
    }, [localPreview])
    // Fall back to the letter avatar when the stored URL fails to load, rather
    // than showing the browser's broken-image glyph. Reset whenever the URL
    // itself changes so a fresh upload isn't tarred by a previous failure.
    const [broken, setBroken] = useState(false)
    useEffect(() => { setBroken(false) }, [value])

    // Drag counter — `dragleave` fires when the cursor enters a CHILD element
    // even though the drag is still over the zone. Counting enters/leaves is
    // the standard fix, so the zone only stops looking "active" once the
    // cursor actually leaves it.
    const [dragDepth, setDragDepth] = useState(0)
    const isDragActive = dragDepth > 0

    const shownSrc = localPreview || (!broken ? value : '')
    const hasImage = Boolean(shownSrc)

    const validateAndUpload = async (file: File) => {
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
        const preview = URL.createObjectURL(file)
        setLocalPreview(preview)
        setPickedMeta({ name: file.name, size: file.size })
        setUploading(true)
        try {
            const res = await clientManagementApi.uploadLogo(file)
            const url = res?.data?.url
            if (!url) throw new Error('No URL returned by the server')
            onChange(url)
        } catch (e: any) {
            notify.error(e?.message || 'Failed to upload the logo')
            setLocalPreview(null)
            setPickedMeta(null)
        } finally {
            setUploading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    const openPicker = () => {
        if (disabled || uploading) return
        inputRef.current?.click()
    }

    const handleRemove = () => {
        if (uploading) return
        setLocalPreview(null)
        setPickedMeta(null)
        onChange('')
    }

    // Drag handlers. `preventDefault` on dragover is required or the browser
    // treats the drop as a navigation to the file, which unloads the page.
    const stopAll = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const onDragEnter = (e: React.DragEvent) => {
        if (disabled || uploading) return
        stopAll(e)
        setDragDepth((d) => d + 1)
    }
    const onDragOver = (e: React.DragEvent) => {
        if (disabled || uploading) return
        stopAll(e)
    }
    const onDragLeave = (e: React.DragEvent) => {
        if (disabled || uploading) return
        stopAll(e)
        setDragDepth((d) => Math.max(0, d - 1))
    }
    const onDrop = (e: React.DragEvent) => {
        if (disabled || uploading) return
        stopAll(e)
        setDragDepth(0)
        const file = e.dataTransfer.files?.[0]
        if (file) void validateAndUpload(file)
    }

    // Hidden native input — reused by both the empty-state click handler
    // and the Replace button in the filled state.
    const hiddenInput = (
        <input
            ref={inputRef}
            type="file"
            accept={LOGO_ACCEPT_MIME}
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void validateAndUpload(f)
            }}
        />
    )

    // ── Filled state — profile-style circle + drag to reposition ────
    if (hasImage) {
        const name = pickedMeta?.name || filenameFromUrl(value)
        const size = pickedMeta ? formatBytes(pickedMeta.size) : null
        return (
            <div className="flex items-center gap-4 rounded-tile border border-hairline bg-canvas p-3">
                {hiddenInput}
                <ProfileCropCircle
                    src={shownSrc}
                    position={position}
                    uploading={uploading}
                    disabled={disabled}
                    onPositionChange={onPositionChange}
                    onBroken={() => {
                        setLocalPreview(null)
                        setBroken(true)
                    }}
                />
                <div className="flex flex-col min-w-0 flex-1 gap-1">
                    <span className="text-xs font-medium text-heading truncate" title={name}>
                        {name}
                    </span>
                    <span className="text-2xs text-subtle">
                        {size ? `${size} · ` : ''}Drag the image to reposition
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={openPicker}
                            disabled={disabled || uploading}
                            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload size={11} /> Replace
                        </button>
                        {onPositionChange && (
                            <button
                                type="button"
                                onClick={() => onPositionChange('50% 50%')}
                                disabled={disabled || uploading}
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-control text-xs font-medium text-subtle hover:text-heading hover:bg-row-hover transition-colors disabled:opacity-50"
                                title="Center the image inside the circle"
                            >
                                Reset
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={disabled || uploading}
                            aria-label="Remove logo"
                            className="inline-flex items-center justify-center h-7 size-7 rounded-control text-subtle hover:text-danger-700 hover:bg-danger-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Empty state — dashed drop zone ───────────────────────────────
    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={openPicker}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault()
                    openPicker()
                }
            }}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            aria-label="Upload a client logo"
            aria-disabled={disabled || uploading}
            // `border-2` is doing real work here, not decoration: at 1px the
            // browser's dash pattern is so fine it reads as a solid hairline,
            // which made this look like just another bordered box sitting
            // among the inputs. Two pixels is where the dashes actually
            // become dashes. The tinted wash separates it from the white
            // fields around it for the same reason, and the taller box gives
            // the pointer somewhere to aim.
            className={`flex flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                disabled
                    ? 'border-hairline-strong bg-ink-50 cursor-not-allowed opacity-60'
                    : isDragActive
                        ? 'border-brand-strong bg-brand-wash ring-4 ring-brand/15 cursor-copy'
                        : 'border-brand-500/40 bg-brand-wash/25 hover:border-brand-500/70 hover:bg-brand-wash/50 cursor-pointer'
            }`}
        >
            {hiddenInput}
            <span className={`inline-flex size-11 items-center justify-center rounded-full transition-colors ${
                isDragActive ? 'bg-brand-strong text-white' : 'bg-brand-wash text-brand-strong'
            }`}>
                {uploading ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : isDragActive ? (
                    <CloudUpload size={20} />
                ) : (
                    <ImageIcon size={20} />
                )}
            </span>
            <p className="text-sm font-semibold text-heading">
                {uploading
                    ? 'Uploading…'
                    : isDragActive
                        ? 'Drop to upload'
                        : 'Drag & drop your logo here'}
            </p>
            {!isDragActive && !uploading && (
                <>
                    <p className="text-2xs text-subtle">or</p>
                    {/* A span dressed as a button, NOT a real <button>: the
                        whole zone is already role="button", and nesting a
                        second control inside it would hand screen readers
                        two overlapping targets for one action. It only has
                        to LOOK clickable — the click lands on the parent
                        either way. */}
                    <span
                        aria-hidden="true"
                        className="inline-flex h-7 items-center gap-1.5 rounded-control border border-hairline-strong bg-surface px-2.5 text-2xs font-semibold text-body shadow-xs"
                    >
                        <Upload size={11} /> Browse files
                    </span>
                </>
            )}
            <p className="mt-0.5 text-2xs text-faint">JPG / PNG / WebP · up to 5 MB</p>
        </div>
    )
}

// ─── Business model dropdown (unchanged control, extracted so the form body
//     stays readable). Emits a synthetic ChangeEvent to keep the parent's
//     onInputChange contract identical to the input's. ───────────────────────
function BusinessModelSelect({
    value,
    invalid,
    onChange,
}: {
    value: string
    invalid?: boolean
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
    const selected = BUSINESS_MODELS.find((m) => m.value === value)
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-invalid={invalid ? true : undefined}
                    aria-haspopup="listbox"
                    className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15 ${
                        invalid
                            ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
                            : 'border-field hover:border-field-hover focus:border-brand focus:ring-brand/15'
                    }`}
                >
                    {selected ? (
                        // Full "Business to Business (B2B)" text — both list
                        // and selected value render the same string.
                        <span className="truncate font-medium text-heading">{selected.label}</span>
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
                avoidCollisions={false}
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] p-1"
            >
                {BUSINESS_MODELS.map((m) => {
                    const isSel = value === m.value
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
                            <span className={`min-w-0 flex-1 truncate text-sm ${isSel ? 'font-semibold text-brand-strong' : 'font-medium text-heading'}`}>
                                {m.label}
                            </span>
                            {isSel && <Check size={14} className="shrink-0 text-brand-strong" aria-hidden />}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ─── Structured address fields ──────────────────────────────────────────────
//
// The address used to be a TipTap rich-text editor storing HTML — which meant
// styled bullet points and colours could sneak in, and there was no clean way
// to know which line was the city or the pincode. The fields below split it
// into the four parts every address has (line, city, state, pincode) and
// combine them into a single newline-separated plain string
//
//   {addressLine}
//   {city}, {state} - {pincode}
//
// The combined string is what gets stored on `clientAddress`, so the report
// letterhead's `{address}` token keeps rendering as before and the details
// page's plain-text display doesn't need a second migration. On load the
// same shape is parsed back so an existing client edits with the parts split
// out; if the stored string doesn't match (a legacy HTML value from the old
// editor, say), the whole thing lands in the Address Line field where the
// reader can restructure it.

type AddressParts = { line: string; city: string; state: string; pincode: string }

const EMPTY_ADDRESS: AddressParts = { line: '', city: '', state: '', pincode: '' }

const stripHtml = (raw: string): string =>
    (raw || '')
        .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')

const parseAddress = (raw: string): AddressParts => {
    const plain = stripHtml(raw).replace(/\r/g, '').trim()
    if (!plain) return EMPTY_ADDRESS
    const lines = plain.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (lines.length >= 2) {
        const csp = lines[1].match(/^(.+?),\s*(.+?)\s*[-–]\s*(\d[\d\s]*)$/)
        if (csp) {
            const [, city, state, pincode] = csp
            return {
                line: lines[0],
                city: city.trim(),
                state: state.trim(),
                pincode: pincode.replace(/\s+/g, ''),
            }
        }
    }
    return { ...EMPTY_ADDRESS, line: plain }
}

const joinAddress = (parts: AddressParts): string => {
    const lines: string[] = []
    if (parts.line.trim()) lines.push(parts.line.trim())
    const csp = [parts.city, parts.state].map((s) => s.trim()).filter(Boolean).join(', ')
    if (csp || parts.pincode.trim()) {
        lines.push([csp, parts.pincode.trim()].filter(Boolean).join(csp && parts.pincode ? ' - ' : ''))
    }
    return lines.join('\n')
}

// Indian states + union territories. Presented in alphabetical order so
// the modern search list feels predictable. Free text is still allowed —
// the reader can type a state that isn't listed and it will be accepted
// as-is on blur.
const INDIAN_STATES: readonly string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

// Cities grouped by state. Picked from India's biggest population
// centres per state — enough for the common case to be a click, with
// free text still honoured for anything that isn't listed. When a
// State is chosen, the City combobox filters down to that state's
// cities; when no state is picked, every city is offered. */
const CITIES_BY_STATE: Record<string, readonly string[]> = {
    'Andhra Pradesh': ['Guntur', 'Kurnool', 'Nellore', 'Rajahmundry', 'Tirupati', 'Vijayawada', 'Visakhapatnam'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun'],
    'Assam': ['Dibrugarh', 'Guwahati', 'Jorhat', 'Silchar', 'Tezpur'],
    'Bihar': ['Bhagalpur', 'Darbhanga', 'Gaya', 'Muzaffarpur', 'Patna'],
    'Chhattisgarh': ['Bhilai', 'Bilaspur', 'Durg', 'Korba', 'Raipur'],
    'Goa': ['Margao', 'Panaji', 'Vasco da Gama'],
    'Gujarat': ['Ahmedabad', 'Bhavnagar', 'Gandhinagar', 'Jamnagar', 'Rajkot', 'Surat', 'Vadodara'],
    'Haryana': ['Ambala', 'Faridabad', 'Gurgaon', 'Hisar', 'Karnal', 'Panipat', 'Rohtak'],
    'Himachal Pradesh': ['Dharamshala', 'Kullu', 'Mandi', 'Shimla', 'Solan'],
    'Jharkhand': ['Bokaro', 'Dhanbad', 'Jamshedpur', 'Ranchi'],
    'Karnataka': ['Bangalore', 'Belgaum', 'Hubli-Dharwad', 'Mangalore', 'Mysore', 'Shimoga', 'Tumkur'],
    'Kerala': ['Kochi', 'Kollam', 'Kozhikode', 'Palakkad', 'Thiruvananthapuram', 'Thrissur'],
    'Madhya Pradesh': ['Bhopal', 'Gwalior', 'Indore', 'Jabalpur', 'Sagar', 'Ujjain'],
    'Maharashtra': ['Aurangabad', 'Kolhapur', 'Mumbai', 'Nagpur', 'Nashik', 'Navi Mumbai', 'Pune', 'Solapur', 'Thane', 'Vasai-Virar'],
    'Manipur': ['Imphal', 'Thoubal'],
    'Meghalaya': ['Shillong', 'Tura'],
    'Mizoram': ['Aizawl', 'Lunglei'],
    'Nagaland': ['Dimapur', 'Kohima'],
    'Odisha': ['Berhampur', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'],
    'Punjab': ['Amritsar', 'Bathinda', 'Jalandhar', 'Ludhiana', 'Mohali', 'Patiala'],
    'Rajasthan': ['Ajmer', 'Bikaner', 'Jaipur', 'Jodhpur', 'Kota', 'Udaipur'],
    'Sikkim': ['Gangtok', 'Namchi'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Erode', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Vellore'],
    'Telangana': ['Hyderabad', 'Karimnagar', 'Nizamabad', 'Warangal'],
    'Tripura': ['Agartala', 'Udaipur'],
    'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Bareilly', 'Ghaziabad', 'Gorakhpur', 'Kanpur', 'Lucknow', 'Meerut', 'Moradabad', 'Noida', 'Varanasi'],
    'Uttarakhand': ['Dehradun', 'Haldwani', 'Haridwar', 'Roorkee', 'Rudrapur'],
    'West Bengal': ['Asansol', 'Durgapur', 'Howrah', 'Kolkata', 'Siliguri'],
    'Andaman and Nicobar Islands': ['Port Blair'],
    'Chandigarh': ['Chandigarh'],
    'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
    'Delhi': ['Delhi', 'New Delhi'],
    'Jammu and Kashmir': ['Anantnag', 'Baramulla', 'Jammu', 'Srinagar'],
    'Ladakh': ['Kargil', 'Leh'],
    'Lakshadweep': ['Kavaratti'],
    'Puducherry': ['Karaikal', 'Mahé', 'Pondicherry', 'Yanam'],
}

/** Full alphabetized list — the fallback when no state has been picked
 *  yet, so the City combobox still offers real suggestions from the
 *  moment it is opened. Built once at module load so the render path
 *  doesn't have to flatten and sort on every keystroke. */
const INDIAN_CITIES: readonly string[] = Array.from(
    new Set(Object.values(CITIES_BY_STATE).flat()),
).sort()

/** A modern searchable combobox — Radix Popover + cmdk. The `options`
 *  list is a suggestion set; the reader can also type a value that isn't
 *  on the list and press Enter (or blur) to accept it as free text. Kept
 *  local to this file since only the address fields use it, and the
 *  wider UI kit already has the primitives to build one on demand. */
function SearchableCombobox({
    value, onChange, options, placeholder, disabled, invalid,
}: {
    value: string
    onChange: (next: string) => void
    options: readonly string[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    useEffect(() => { if (!open) setQuery('') }, [open])

    // Filter locally rather than letting cmdk apply its built-in
    // matcher — cmdk's fuzzy scoring occasionally scored every option
    // below its visibility threshold and left the list looking empty on
    // open, which is exactly the bug this component was reported for. A
    // plain case-insensitive substring is what the reader expects for
    // a short, curated list anyway.
    const normalisedQuery = query.trim().toLowerCase()
    const filtered = useMemo(() => {
        if (!normalisedQuery) return options.slice()
        return options.filter((option) => option.toLowerCase().includes(normalisedQuery))
    }, [normalisedQuery, options])
    const canAcceptTyped = normalisedQuery.length > 0 && !options.some((option) => option.toLowerCase() === normalisedQuery)

    const commit = (next: string) => {
        onChange(next.trim())
        setOpen(false)
    }

    return (
        <Popover.Root open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    className={`flex h-9 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60 ${
                        invalid
                            ? 'border-danger-500/60 text-body'
                            : 'border-field text-body hover:border-brand-500/40'
                    }`}
                >
                    <span className={`min-w-0 truncate ${value ? '' : 'text-faint'}`}>
                        {value || placeholder || 'Select…'}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" aria-hidden />
                </button>
            </Popover.Trigger>
            {/* No Popover.Portal — the address fields sit inside a Radix
                Dialog (the Client form modal). A portalled Popover renders
                outside the dialog's DOM tree, and every click on the list
                fires the dialog's onInteractOutside handler, which closes
                the popover before an option can be picked. Keeping the
                popover in-place keeps its clicks inside the dialog's
                interaction boundary. */}
            <Popover.Content
                align="start"
                sideOffset={4}
                className="z-[200] w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg"
            >
                <Command loop shouldFilter={false}>
                        <div className="flex items-center gap-1.5 border-b border-hairline px-2.5 py-1.5">
                            <Search className="size-3.5 shrink-0 text-faint" />
                            <Command.Input
                                autoFocus
                                value={query}
                                onValueChange={setQuery}
                                placeholder={placeholder || 'Search…'}
                                className="h-8 flex-1 bg-transparent text-[13px] text-body placeholder:text-faint focus:outline-none"
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && canAcceptTyped) {
                                        event.preventDefault()
                                        commit(query)
                                    }
                                }}
                            />
                        </div>
                        <Command.List className="max-h-56 overflow-y-auto p-1">
                            {filtered.length === 0 ? (
                                <div className="px-3 py-2 text-[12px] text-subtle">
                                    {canAcceptTyped
                                        ? <>No matches. Press <span className="font-semibold text-heading">Enter</span> to use &ldquo;{query.trim()}&rdquo;.</>
                                        : 'No options.'}
                                </div>
                            ) : (
                                filtered.map((option) => (
                                    <Command.Item
                                        key={option}
                                        value={option}
                                        onSelect={() => commit(option)}
                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-body aria-selected:bg-brand-wash aria-selected:text-brand-strong data-[selected=true]:bg-brand-wash data-[selected=true]:text-brand-strong"
                                    >
                                        <Check className={`size-3.5 shrink-0 ${value === option ? 'opacity-100 text-brand-strong' : 'opacity-0'}`} />
                                        <span className="min-w-0 truncate">{option}</span>
                                    </Command.Item>
                                ))
                            )}
                        </Command.List>
                    </Command>
                </Popover.Content>
        </Popover.Root>
    )
}

function AddressFields({
    value, error, readOnly, onChange,
}: {
    value: string
    error?: string
    readOnly?: boolean
    onChange: (combined: string) => void
}) {
    const lastEmittedRef = useRef<string>('')
    const [parts, setParts] = useState<AddressParts>(() => parseAddress(value))
    useEffect(() => {
        if (value !== lastEmittedRef.current) setParts(parseAddress(value))
    }, [value])

    const update = (patch: Partial<AddressParts>) => {
        const next = { ...parts, ...patch }
        setParts(next)
        const combined = joinAddress(next)
        lastEmittedRef.current = combined
        onChange(combined)
    }

    /* Cities offered in the combobox depend on which state is selected.
     * With a state chosen, only its cities show — so picking Tamil Nadu
     * narrows the list to Chennai, Coimbatore, Madurai, etc. Without a
     * state, the full alphabetised list is offered so the field is
     * still useful on its own. A city already typed is left alone even
     * if it isn't on the state's shortlist — free text is honoured for
     * small-town offices the curated lists can't cover. */
    const cityOptions = useMemo<readonly string[]>(() => {
        if (parts.state && CITIES_BY_STATE[parts.state]) return CITIES_BY_STATE[parts.state]
        return INDIAN_CITIES
    }, [parts.state])

    /** Changing the state to one whose city list doesn't include the
     *  currently-typed city clears the city — otherwise the reader
     *  could pick "Tamil Nadu" but leave "Mumbai" behind and the joined
     *  address would print an impossible combination. Free-text cities
     *  (not on any state's list) are cleared too since we can't verify
     *  they belong to the new state. */
    const updateState = (nextState: string) => {
        const nextCities = nextState && CITIES_BY_STATE[nextState] ? CITIES_BY_STATE[nextState] : null
        const cityStillValid = !nextCities || nextCities.some((c) => c.toLowerCase() === parts.city.toLowerCase())
        update({ state: nextState, city: cityStillValid ? parts.city : '' })
    }

    return (
        <div className="space-y-4">
            <Field label="Address Line" required error={error}>
                <KitInput
                    value={parts.line}
                    onChange={(e) => update({ line: e.target.value })}
                    placeholder="Building, Street, Area"
                    invalid={Boolean(error)}
                    disabled={readOnly}
                />
            </Field>
            {/* State first (the broader region), then City, then Pincode
                — mirrors the way most Indian address forms flow top to
                bottom and how a caller would read it out. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="State">
                    <SearchableCombobox
                        value={parts.state}
                        onChange={updateState}
                        options={INDIAN_STATES}
                        placeholder="Search state"
                        disabled={readOnly}
                    />
                </Field>
                <Field label="City">
                    <SearchableCombobox
                        value={parts.city}
                        onChange={(next) => update({ city: next })}
                        options={cityOptions}
                        placeholder={parts.state ? `Search ${parts.state} cities` : 'Search city'}
                        disabled={readOnly}
                    />
                </Field>
                <Field label="Pincode">
                    <KitInput
                        value={parts.pincode}
                        onChange={(e) => update({ pincode: e.target.value.replace(/[^\d\s-]/g, '') })}
                        placeholder="e.g. 641004"
                        inputMode="numeric"
                        maxLength={10}
                        disabled={readOnly}
                    />
                </Field>
            </div>
        </div>
    )
}

// ─── One contact person ─────────────────────────────────────────────────
//
// Every person in Step 2 is authored through this SAME block: contact
// person name, Email + phone, the two optional secondary reach-me
// fields, and that person's OWN postal address (Address Line / State /
// City / Pincode).
// "Add Another Contact Person" appends another identical block, so contact 2
// is filled in exactly the way contact 1 was — the whole point of the step.
//
// Contact 1 is the client's primary and carries no Remove control (a client
// must always have one contact); every later block can be removed.
function ContactBlock({
    index,
    contact,
    err,
    readOnly,
    onContactChange,
    onRemove,
}: {
    index: number
    contact: ContactPerson
    err: ContactErrors
    readOnly?: boolean
    onContactChange: (index: number, field: string, value: string | boolean) => void
    onRemove: (index: number) => void
}) {
    const isFirst = index === 0
    const emailRef = useRef<HTMLInputElement>(null)
    const phoneRef = useRef<HTMLInputElement>(null)

    // Which source fields were still blank when "Same as primary" was last
    // ticked. Held separately from `err` — which arrives from the parent's
    // submit-time validation — so it can appear on a click and clear itself
    // the moment the field is filled, without the parent having to run a
    // whole validation pass for one checkbox.
    //
    // Deliberately flags, not messages. A message rendered under the field
    // through <Field error> adds a line of height, which shoves the "Same
    // as primary" row and everything below it down the instant you click —
    // the control moves out from under your own cursor. The flags only
    // redden the borders (no height change) and the one explanation is
    // rendered beside the checkbox instead, on a row that is already tall
    // enough to hold it.
    const [copyNag, setCopyNag] = useState<{ email: boolean; phone: boolean } | null>(null)

    // Clear each flag as soon as the field it points at has something in it.
    // Deriving this from the value (rather than clearing inside the inputs'
    // own onChange) keeps the two typing paths — the field itself and the
    // "Same as primary" copy — from having to know about each other.
    useEffect(() => {
        setCopyNag((prev) => {
            if (!prev) return prev
            const next = {
                email: prev.email && !contact.email.trim(),
                phone: prev.phone && !contact.phoneNumber.trim(),
            }
            if (!next.email && !next.phone) return null
            // Returning `prev` unchanged matters: a fresh object every run
            // would re-render on every keystroke for no reason.
            return next.email === prev.email && next.phone === prev.phone ? prev : next
        })
    }, [contact.email, contact.phoneNumber])

    const copyNagMessage = !copyNag
        ? null
        : copyNag.email && copyNag.phone
            ? 'Fill in the Email and phone number first'
            : copyNag.email
                ? 'Fill in the Email first'
                : 'Fill in the Phone Number first'

    // "Same as primary" copies this person's Email + phone down into
    // their secondary fields. With either one still blank there is nothing
    // to copy, and the old handler just no-opped — the box refused to tick
    // and nothing said why. Now the empty source fields go red and the
    // first of them takes focus, so the click explains itself.
    const handleSameAsPrimary = (next: boolean) => {
        if (!next) {
            setCopyNag(null)
            onContactChange(index, 'secondaryEmail', '')
            onContactChange(index, 'secondaryPhoneNumber', '')
            return
        }
        const missingEmail = !contact.email.trim()
        const missingPhone = !contact.phoneNumber.trim()
        if (missingEmail || missingPhone) {
            setCopyNag({ email: missingEmail, phone: missingPhone })
            // Land on the earlier of the two that is missing, so the reader
            // is already in the field they have to fill.
            const target = missingEmail ? emailRef : phoneRef
            target.current?.focus()
            target.current?.scrollIntoView({ block: 'nearest' })
            return
        }
        setCopyNag(null)
        onContactChange(index, 'secondaryEmail', contact.email)
        onContactChange(index, 'secondaryPhoneNumber', contact.phoneNumber)
    }

    // The nag only reddens; the message under the field stays whatever
    // submit-time validation had to say, so nothing shifts on a click.
    const emailInvalid = Boolean(err.email) || Boolean(copyNag?.email)
    const phoneInvalid = Boolean(err.phoneNumber) || Boolean(copyNag?.phone)
    return (
        // Blocks after the first are fenced off by a top hairline so the
        // reader sees where one person ends and the next begins. Plain
        // white surface throughout — no tinted card — so contact 2 reads
        // as an equal of contact 1, not a lesser appendix.
        <div className={isFirst ? 'space-y-4' : 'mt-6 border-t border-hairline pt-5 space-y-4'}>
            <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-heading">
                    Contact {index + 1}
                    {isFirst && <StatusPill tone="info">Primary Contact</StatusPill>}
                </span>
                {!isFirst && (
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        disabled={readOnly}
                        // Red at rest, not only under the cursor — the
                        // action destroys a filled-in contact, and a
                        // destructive control that looks neutral until you
                        // are already on it warns nobody. Hover just adds
                        // the wash behind it.
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-control text-xs font-medium text-danger-700 hover:bg-danger-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={12} /> Remove
                    </button>
                )}
            </div>

            {/* Row 1 · Contact Person Name | Email | Primary Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Contact Person Name" required error={err.name}>
                    <KitInput
                        value={contact.name}
                        onChange={(e) => onContactChange(index, 'name', e.target.value)}
                        placeholder="Enter contact person name"
                        invalid={Boolean(err.name)}
                        disabled={readOnly}
                    />
                </Field>
                <Field label="Email" required error={err.email}>
                    <KitInput
                        ref={emailRef}
                        type="email"
                        value={contact.email}
                        onChange={(e) => onContactChange(index, 'email', e.target.value)}
                        placeholder="name@company.com"
                        invalid={emailInvalid}
                        disabled={readOnly}
                    />
                </Field>
                <Field label="Phone Number" required error={err.phoneNumber}>
                    <PhoneField
                        inputRef={phoneRef}
                        value={contact.phoneNumber}
                        onChange={(v) => onContactChange(index, 'phoneNumber', v)}
                        hasError={phoneInvalid}
                    />
                </Field>
            </div>

            {/* Shortcut sitting ABOVE the secondary fields so the reader
                  sees it before typing anything. Ticking copies THIS
                  person's own Email + phone down into their
                  secondary fields; un-ticking clears them again. */}
            {/* The nag rides on this row rather than under the two fields
                  above it. At `text-xs` inside an `items-center` row whose
                  label is already `text-sm`, it adds no height — so the
                  checkbox stays exactly where the cursor just clicked. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-body">
                    <Checkbox
                        checked={Boolean(contact.email && contact.phoneNumber
                            && contact.secondaryEmail === contact.email
                            && contact.secondaryPhoneNumber === contact.phoneNumber)}
                        onCheckedChange={handleSameAsPrimary}
                        disabled={readOnly}
                        aria-label="Same as primary — copy this contact's email and phone to their secondary fields"
                    />
                    <span>Same as primary</span>
                </label>
                {copyNagMessage && (
                    <span role="alert" className="text-xs font-medium text-danger-700">
                        {copyNagMessage}
                    </span>
                )}
            </div>

            {/* Row 2 · Secondary Email | Secondary Phone Number.
                  Same 3-column grid as row 1 so Secondary Email lands
                  directly under Email and Secondary Phone under
                  Primary Phone; column 3 stays empty. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Secondary Email" error={err.secondaryEmail}>
                    <KitInput
                        type="email"
                        value={contact.secondaryEmail || ''}
                        onChange={(e) => onContactChange(index, 'secondaryEmail', e.target.value)}
                        placeholder="secondary@company.com"
                        invalid={Boolean(err.secondaryEmail)}
                        disabled={readOnly}
                    />
                </Field>
                <Field label="Secondary Phone Number" error={err.secondaryPhoneNumber}>
                    <PhoneField
                        value={contact.secondaryPhoneNumber || ''}
                        onChange={(v) => onContactChange(index, 'secondaryPhoneNumber', v)}
                        hasError={Boolean(err.secondaryPhoneNumber)}
                    />
                </Field>
            </div>

            {/* Row 3 · this person's own address — Address Line, then
                  State / City / Pincode. Separated by a little more
                  breathing room than the rows above so "how to reach
                  them" and "where they are" read as two groups. */}
            <div className="pt-1">
                <AddressFields
                    value={contact.address || ''}
                    error={err.address}
                    readOnly={readOnly}
                    onChange={(combined) => onContactChange(index, 'address', combined)}
                />
            </div>
        </div>
    )
}

// ─── Client form modal (single form, no wizard) ─────────────────────────────

export default function ClientFormModal({
    open,
    onClose,
    isEditing,
    viewMode,
    isLoading,
    formData,
    errors,
    // The pre-existing wizard exposed a `onValidateStep` callback. The single
    // form has nothing to advance, so the prop is ignored here — kept in the
    // signature so the caller doesn't have to change its own prop list.
    onValidateStep: _onValidateStep,
    onInputChange,
    onDescriptionChange,
    onLogoChange,
    onContactChange,
    onAddContact,
    onRemoveContact,
    // Contact 1 is always the primary now — every block is identical and
    // the "Set as primary" toggle is gone — so the callback is accepted
    // and ignored rather than removed from the caller's prop list.
    onPrimaryChange: _onPrimaryChange,
    onSubmit,
    // Server-allocated Client ID for edit mode. Absent (or "") in add mode,
    // where a placeholder + helper text explain that the id is generated.
    clientCode,
    clientCount,
}: {
    open: boolean
    onClose: () => void
    isEditing: boolean
    viewMode: boolean
    isLoading: boolean
    formData: FormData
    errors: FormErrors
    onValidateStep?: (step: number) => boolean
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onDescriptionChange: (html: string) => void
    onLogoChange: (url: string) => void
    onContactChange: (index: number, field: string, value: string | boolean) => void
    onAddContact: () => void
    onRemoveContact: (index: number) => void
    onPrimaryChange?: (index: number, checked: boolean) => void
    onSubmit: (e: React.FormEvent) => void
    clientCode?: string
    /** Total existing clients — used to render a subtle "Client #N" badge
     *  in the header. In Add mode the badge previews the number the new
     *  record is likely to take (count + 1); in Edit mode it shows the
     *  client's own number, parsed out of its Client ID when present.
     *  The count is a hint, not a promise — the real Client ID is minted
     *  by the server on save (see server/utils/clientCode.js), and if the
     *  count is stale by one the preview will read "#9" for what becomes
     *  CLT-000010. The badge is a scale cue, not a stable identifier. */
    clientCount?: number
}) {
    const [readOnly, setReadOnly] = useState(false)
    const [showDiscard, setShowDiscard] = useState(false)
    // Accordion state — only one step is open at a time, and Step 1
    // opens by default so a new client starts on the client-info fields.
    // Clicking a closed step opens it (and closes the other one);
    // clicking the currently open step closes it. Failed submits below
    // still expand whichever step carries an error so validation is
    // never hidden. `null` means both collapsed.
    const [openStep, setOpenStep] = useState<1 | 2 | null>(1)
    const toggleStep = (which: 1 | 2) => setOpenStep((prev) => (prev === which ? null : which))

    // Snapshot of the form when the modal opens, to detect unsaved changes so
    // Cancel / Escape can ask before throwing typing away.
    const initialSnapshot = React.useRef<string>('')

    useEffect(() => {
        if (open) {
            setReadOnly(viewMode)
            setShowDiscard(false)
            // Reset accordion every time the modal opens — Step 1 open,
            // Step 2 closed — so returning to Add flow doesn't inherit
            // the previous session's disclosure state.
            setOpenStep(1)
            initialSnapshot.current = JSON.stringify(formData)
        }
        // Intentionally snapshot only on open (not on every keystroke)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, viewMode])

    // After a failed submit, scroll the first invalid field into view. The
    // form has one column of sections stacked top-to-bottom, so the client
    // name is the earliest anchor — the DOM order of the queries below is
    // the order the reader sees them in.
    //
    // Auto-expand the step that carries a failing field. Only one step is
    // open at a time, so Step 2's errors win over Step 1's — the reader
    // still lands on a highlighted invalid field, and the missing Step 1
    // errors surface again once they open it back.
    // Errors in step 1 (Basic Details): clientCompany / businessModel /
    // createdYear / website. Errors in step 2 (Contact Details) all live
    // under contacts[*] now — each person's address is theirs, so the old
    // client-level `clientAddress` slot is checked only for the legacy
    // case where the server rejects the mirrored value.
    const bodyRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        if (!open) return
        const step2HasError = Boolean(errors.clientAddress || errors.contacts?.some((c) => c && Object.keys(c).length))
        const step1HasError = Boolean(errors.clientCompany || errors.businessModel || errors.createdYear || errors.website)
        if (step2HasError) setOpenStep(2)
        else if (step1HasError) setOpenStep(1)
        // Focus the first field marked invalid — happens on the next frame
        // so the accordion has time to expand and mount the input.
        const raf = requestAnimationFrame(() => {
            const el = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
            if (el) {
                el.focus({ preventScroll: true })
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        })
        return () => cancelAnimationFrame(raf)
    }, [errors, open])

    const guardedClose = React.useCallback(() => {
        if (isLoading) return
        const dirty = !readOnly && JSON.stringify(formData) !== initialSnapshot.current
        if (dirty) { setShowDiscard(true); return }
        onClose()
    }, [isLoading, readOnly, formData, onClose])

    // Every contact renders through the same ContactBlock now — index 0 is
    // simply the one badged "Primary" and the one that can't be removed.
    // A parent whose state has drifted to an empty array still gets one
    // blank block to edit, so the reader never sees a contact-less form.
    const contacts = formData.contactPersons.length
        ? formData.contactPersons
        : [{ name: '', email: '', phoneNumber: '', isPrimary: true } as ContactPerson]

    const title = readOnly ? 'View client' : isEditing ? 'Edit client' : 'Add client'

    // Ordinal number this record represents. In Edit mode it's parsed
    // from the record's own Client ID; in Add mode it's `clientCount + 1`,
    // the number the server will most likely mint next. Feeds the in-form
    // Client ID chip only — the header badge that used to show it was
    // removed as redundant.
    const clientNumber = useMemo<number | null>(() => {
        if (isEditing) {
            const match = /(\d+)$/.exec(String(clientCode || ''))
            if (match) return parseInt(match[1], 10)
            return null
        }
        return typeof clientCount === 'number' ? clientCount + 1 : null
    }, [isEditing, clientCode, clientCount])

    // The Client ID chip inside Step 1. In Edit mode we show the record's
    // saved id verbatim; in Add mode we render the PREDICTED id ("CLT-
    // 000024") derived from `clientNumber`. The value is a hint — the
    // real id is minted atomically on save (see server/utils/clientCode)
    // and may differ if a parallel add is running, but the reader gets an
    // actual sequence number to look at instead of an "XXXXXX" placeholder.
    const idDisplay = useMemo(() => {
        if (isEditing) return clientCode || '—'
        if (clientNumber != null) return `CLT-${String(clientNumber).padStart(6, '0')}`
        return 'CLT-000001'
    }, [isEditing, clientCode, clientNumber])

    const primaryLetter = (formData.clientCompany || '').trim().charAt(0).toUpperCase()

    return (
        <>
            <Modal
                open={open}
                onClose={guardedClose}
                // ~1080px — wide enough for a comfortable 2-column grid
                // inside each accordion card, and paired with the modal's
                // `max-h-[85vh]` gives the body plenty of vertical room so
                // Step 1 doesn't feel cramped when expanded.
                // 1080px (`2xl`) — the roomier frame the accordion is
                // designed around, so each step card has enough width for
                // a 2-column grid and its label/hint columns to breathe.
                size="2xl"
                // Lock the modal at its full 95vh so collapsing / expanding
                // step cards never shrinks the outer frame. Without this
                // the modal resizes on every accordion toggle and the
                // reader's mental anchor jumps.
                stableHeight
                // A stray click on the overlay must not throw away typing.
                // Escape and Cancel still route through guardedClose, which
                // is where the discard-changes confirmation lives.
                dismissOnOutsideClick={false}
                // Red circle + white X — sits in the shared header's own
                // close slot (top-right corner), styled via the Modal
                // kit's `danger` tone variant.
                closeTone="danger"
                // Single-line title, `text-xl font-bold` overriding the
                // kit's default `text-lg`. Subtitle intentionally omitted —
                // the modal's own name is enough context, and a second line
                // read as redundant framing.
                //
                // No "Client No: N" chip here — the ordinal was a hint, not
                // a stable identifier, and it competed with the real Client
                // ID the reader can see inside step 1. `clientNumber` still
                // feeds that field's predicted id.
                title={
                    <span className="flex items-center gap-2.5 flex-wrap text-lg font-bold text-heading tracking-tight">
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
                footer={
                    <div className="flex flex-1 items-center justify-end gap-2">
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
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setReadOnly(false)}
                            >
                                <Pencil className="size-3.5" /> Edit
                            </Button>
                        ) : (
                            // Green rather than the default brand fill: this
                            // is the commit, and it now reads "Save" in both
                            // modes so the button names the ACTION while the
                            // modal's own title says whether that action
                            // creates or edits.
                            <Button
                                type="submit"
                                form="client-form"
                                variant="success"
                                size="sm"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <Check className="size-3.5" />
                                        {isEditing ? 'Save changes' : 'Save'}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                }
            >
                <div ref={bodyRef}>
                    <form id="client-form" onSubmit={onSubmit}>
                        {/* Outer padding around the two step cards so they
                              don't sit flush against the modal body edge —
                              gives the accordion breathing room top, bottom
                              and on both sides regardless of the modal's
                              own padding. */}
                        <fieldset disabled={readOnly} className="border-0 m-0 min-w-0 space-y-4 px-2 py-2 sm:px-4 sm:py-3">
                            {/* ── Step 1 — Client Information ─────────────
                                  Business Model + Created Year on row 1,
                                  Client ID (readonly chip) + Client Name on
                                  row 2, Description (TipTap) spans the row,
                                  Logo picker at the bottom. */}
                            <StepCard
                                title="1. Basic Details"
                                open={openStep === 1}
                                onToggle={() => toggleStep(1)}
                            >
                                {/* Compact overrides — every input, phone
                                      select and dropdown trigger inside
                                      this step renders at h-9 with 13-px
                                      text, so the form reads minimal and
                                      dense while the 32-px column gap
                                      keeps Business Model / Created Year
                                      cleanly separated. */}
                                <div className="space-y-5 [&_input[type=text],&_input[type=email],&_input[type=tel],&_input[type=number]]:h-9 [&_input[type=text],&_input[type=email],&_input[type=tel],&_input[type=number]]:text-[13px] [&_button[aria-haspopup=listbox]]:h-9 [&_button[aria-haspopup=listbox]]:text-[13px] [&_button[aria-haspopup=menu]]:h-9 [&_button[aria-haspopup=menu]]:text-[13px]">
                                    {/* Row 1 · Business Model | Created Year | Client ID */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-6">
                                        <Field label="Business Model" required error={errors.businessModel}>
                                            <BusinessModelSelect
                                                value={formData.businessModel}
                                                invalid={Boolean(errors.businessModel)}
                                                onChange={onInputChange}
                                            />
                                        </Field>
                                        {/* The helper line under both of these
                                              fields is gone — each one is a
                                              greyed, unclickable chip with an
                                              Info affordance already, so a
                                              standing "Auto-generated" /
                                              "Uses the current calendar year"
                                              caption only repeated what the
                                              control was showing. The detail
                                              still lives on the Info tooltip. */}
                                        <Field label="Created Year" required>
                                            <div className="flex h-9 items-center gap-2 rounded-control border border-hairline-strong bg-ink-50 px-3 cursor-default">
                                                <span className="font-mono text-sm tracking-tight text-heading tabular-nums">
                                                    {formData.createdYear || new Date().getFullYear()}
                                                </span>
                                                <span
                                                    className="ml-auto text-faint"
                                                    title="Created Year is set to the current calendar year and can't be changed here."
                                                >
                                                    <Info size={12} aria-hidden />
                                                </span>
                                            </div>
                                        </Field>
                                        <Field
                                            label="Client ID"
                                            required
                                        >
                                            <div className="flex h-9 items-center gap-2 rounded-control border border-hairline-strong bg-ink-50 px-3 cursor-default">
                                                <span className={`font-mono text-sm tracking-tight ${clientCode || isEditing ? 'text-heading' : 'text-subtle'}`}>
                                                    {idDisplay}
                                                </span>
                                                <span
                                                    className="ml-auto text-faint"
                                                    title={isEditing ? 'This identifier is fixed for the life of the client.' : 'A unique Client ID will be assigned on save.'}
                                                >
                                                    <Info size={12} aria-hidden />
                                                </span>
                                            </div>
                                        </Field>
                                    </div>

                                    {/* Row 2 · Client Name, full width now
                                          that Website has moved down below
                                          the logo. */}
                                    <Field label="Client Name" required error={errors.clientCompany}>
                                        <KitInput
                                            name="clientCompany"
                                            value={formData.clientCompany}
                                            onChange={onInputChange}
                                            placeholder="Enter client / organization name"
                                            invalid={Boolean(errors.clientCompany)}
                                            autoFocus={!isEditing}
                                        />
                                    </Field>

                                    <Field label="About Client">
                                        {/* Long-form notes on the client.
                                              Stored as HTML on `description`;
                                              details views render as HTML,
                                              plain-text sites strip tags. */}
                                        <TipTapEditor
                                            value={formData.description}
                                            onChange={onDescriptionChange}
                                            placeholder="Write a short note about the client…"
                                            minHeight="110px"
                                            maxHeight="180px"
                                            editable={!readOnly}
                                            showToolbar={!readOnly}
                                        />
                                    </Field>

                                    <Field label="Client Logo">
                                        <LogoPicker
                                            value={formData.clientLogo || ''}
                                            position={formData.clientLogoPosition || ''}
                                            fallbackLetter={primaryLetter}
                                            disabled={readOnly}
                                            onChange={onLogoChange}
                                            onPositionChange={(next) => onInputChange({
                                                target: { name: 'clientLogoPosition', value: next },
                                            } as unknown as React.ChangeEvent<HTMLInputElement>)}
                                        />
                                    </Field>

                                    {/* Website, directly after the logo — the
                                          two things that say where to FIND the
                                          client, read after who they are.
                                          `type="text"` (not "url") on purpose:
                                          the step's compact overrides key off
                                          the text / email / tel / number
                                          selectors, so a url-typed input would
                                          render a head taller than every field
                                          beside it. `inputMode` still gives
                                          mobile keyboards the "/" and ".com"
                                          keys. */}
                                    <Field label="Website Link" error={errors.website}>
                                        <KitInput
                                            name="website"
                                            type="text"
                                            inputMode="url"
                                            leading={Globe}
                                            value={formData.website || ''}
                                            onChange={onInputChange}
                                            placeholder="https://www.acme.com"
                                            invalid={Boolean(errors.website)}
                                            disabled={readOnly}
                                        />
                                    </Field>
                                </div>
                            </StepCard>

                            {/* ── 2. Contact Details ─────────────────────
                                  One block per person, each carrying the
                                  identical field set: Contact Person
                                  Email, Primary Phone, the two
                                  secondary reach-me fields, and that
                                  person's own address (Address Line /
                                  State / City / Pincode).
                                  "Add Another Contact Person" sits at the
                                  very bottom — below the last person's
                                  Pincode — and appends a complete block, so
                                  contact 2 is filled in exactly the way
                                  contact 1 was. */}
                            <StepCard
                                title="2. Contact Details"
                                open={openStep === 2}
                                onToggle={() => toggleStep(2)}
                            >
                                {/* Same compact overrides as Step 1 so both
                                      accordions render at the same minimal
                                      input density. */}
                                <div className="[&_input[type=text],&_input[type=email],&_input[type=tel],&_input[type=number]]:h-9 [&_input[type=text],&_input[type=email],&_input[type=tel],&_input[type=number]]:text-[13px] [&_button[aria-haspopup=listbox]]:h-9 [&_button[aria-haspopup=listbox]]:text-[13px] [&_button[aria-haspopup=menu]]:h-9 [&_button[aria-haspopup=menu]]:text-[13px]">
                                    {contacts.map((contact, index) => (
                                        <ContactBlock
                                            key={index}
                                            index={index}
                                            contact={contact}
                                            err={errors.contacts?.[index] || {}}
                                            readOnly={readOnly}
                                            onContactChange={onContactChange}
                                            onRemove={onRemoveContact}
                                        />
                                    ))}

                                    {/* Full-width dashed button anchored BELOW
                                          the last person's address block, so
                                          the CTA always sits exactly where the
                                          next contact will land. One wording
                                          at every count — the label used to
                                          switch between "Add contact" and
                                          "Add another contact" on the second
                                          click, which moved the button's text
                                          out from under the reader's cursor
                                          for no gain. */}
                                    <button
                                        type="button"
                                        onClick={onAddContact}
                                        disabled={readOnly}
                                        className="mt-6 w-full inline-flex items-center justify-center gap-2 h-11 rounded-tile border border-dashed border-brand-500/40 bg-surface text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-wash hover:border-brand-500/60 disabled:opacity-50"
                                    >
                                        <UserPlus size={15} />
                                        Add Another Contact Person
                                    </button>
                                </div>
                            </StepCard>
                        </fieldset>
                    </form>
                </div>
            </Modal>

            <DiscardChangesDialog
                open={showDiscard}
                dismissOnOutsideClick={false}
                onConfirm={() => { setShowDiscard(false); onClose() }}
                onCancel={() => setShowDiscard(false)}
            />
        </>
    )
}
