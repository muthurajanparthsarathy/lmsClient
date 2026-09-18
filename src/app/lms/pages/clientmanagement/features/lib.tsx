"use client"

import { Check, X } from 'lucide-react'
import { toast } from 'react-toastify'
import type { ClientType, ContactPerson } from '@/app/lms/pages/clientmanagement/api/clientManagementService'

// ─── Form types ───────────────────────────────────────────────────────────────

export type FormData = {
    contactPersons: ContactPerson[]
    clientCompany: string
    // Organization / office phone number the form collects. Stored as a
    // single string ("+91 0422 1234567") for round-trip compatibility with
    // the backend's clientPhone column — the split control on the form
    // presents it as code + number and re-joins them for submit.
    clientPhone: string
    // Reference year the client was created. Stored as a 4-digit string
    // ("2026") so the form control emits and parses the same thing. Sent
    // to the backend as `createdYear`, where it's stored on the record
    // for the Created Year column and can also be used to override the
    // auto `createdAt` when the user picks a past year.
    createdYear: string
    description: string
    clientAddress: string
    // Absolute URL returned by the server's /client-management/upload-logo
    // endpoint. Empty string means no logo — the listing then falls back to
    // a first-letter avatar. Optional at the type level too so the field
    // can be omitted from older form state without a TypeScript error.
    clientLogo?: string
    // Where the uploaded logo sits inside its circular frame. Stored as a
    // CSS object-position string (e.g. "50% 50%"). Optional — a missing
    // or empty value means center-center, which is the browser default.
    clientLogoPosition?: string
    type: ClientType[]
    businessModel: string
    status: 'active' | 'inactive'
}

export type ContactErrors = {
    name?: string
    email?: string
    phoneNumber?: string
    // Secondary contact methods on the SAME person — optional, but if
    // filled they still have to be a valid email / phone.
    secondaryEmail?: string
    secondaryPhoneNumber?: string
}

export type FormErrors = {
    clientCompany?: string
    businessModel?: string
    // Organization phone is optional per the brief, so it has no error
    // slot beyond a soft warning surfaced inline; the primary contact's
    // phone lives under `contacts[i].phoneNumber` instead.
    clientPhone?: string
    // Created Year — required; must be a 4-digit year in a sensible range.
    createdYear?: string
    // Address is required. TipTap stores HTML so "empty" means "no
    // visible text after stripping tags" — see the validator in
    // ClientManagementPage.tsx which uses `stripHtml` from this file.
    clientAddress?: string
    contacts?: ContactErrors[]
}

// Contact-type suggestions offered by the form. The list is a UI
// convenience — the backend accepts any free-text string here so a future
// role ("Legal", "Ops") can be added without a schema change. The frontend
// enforces that Primary and Secondary are role labels the user picks, not
// the source-of-truth for isPrimary: only the `Set as primary` toggle
// changes which contact IS primary.
export const CONTACT_TYPES: readonly string[] = [
    'Primary',
    'Secondary',
    'Finance',
    'HR',
    'Technical',
    'Management',
    'Other',
] as const

// The listing's sortable columns. Only these three sort: the contact columns
// hold a list per row, so there is no single value to order them by.
export type ClientSortKey = 'company' | 'clientId' | 'model' | 'status' | 'serial' | 'contactName' | 'email' | 'contactNumber' | 'createdAt'

// ─── Phone ────────────────────────────────────────────────────────────────────

// Country codes offered by the phone field, longest code first so parsing a
// stored value never mistakes +91 for +9. The stored shape stays ONE string
// ("+91 9876543210") — the split control is presentation only, so the server
// and every existing record keep working untouched.
export const COUNTRY_CODES: Array<{ code: string; label: string }> = [
    { code: '+971', label: '🇦🇪 +971' },
    { code: '+966', label: '🇸🇦 +966' },
    { code: '+880', label: '🇧🇩 +880' },
    { code: '+977', label: '🇳🇵 +977' },
    { code: '+94', label: '🇱🇰 +94' },
    { code: '+91', label: '🇮🇳 +91' },
    { code: '+65', label: '🇸🇬 +65' },
    { code: '+61', label: '🇦🇺 +61' },
    { code: '+44', label: '🇬🇧 +44' },
    { code: '+1', label: '🇺🇸 +1' },
]

// "+91 9876543210" -> { code: '+91', local: '9876543210' }. A value without a
// known prefix (legacy free-typed records) keeps its digits under the default
// +91 so nothing is silently thrown away on edit.
export const splitPhone = (value: string): { code: string; local: string } => {
    const v = (value || '').trim()
    const match = COUNTRY_CODES.find((c) => v.startsWith(c.code))
    const rest = match ? v.slice(match.code.length) : v
    return { code: match?.code || '+91', local: rest.replace(/\D/g, '') }
}

// ─── Business models / type labels ───────────────────────────────────────────

export const TYPE_LABEL: Record<ClientType, string> = { college: 'College', company: 'Company' }

// The business models a client can be engaged under. Defined here on the
// client; the Service Mapping wizard derives each mapping's service from it.
// CSR is NOT here — it's a service model under B2B, picked in Service Mapping.
//
// Labels use the "Business to Business (B2B)" format everywhere the user
// reads a business model — dropdown options, selected value, table cell,
// details drawer, exports, Service Mapping filters. `fullName` (just the
// descriptive part) is kept for the odd renderer that wants only the
// prefix, but almost everything now goes through `businessModelDisplayName`.
export const BUSINESS_MODELS = [
    { value: 'B2B', label: 'Business to Business (B2B)' },
    { value: 'B2I', label: 'Business to Institution (B2I)' },
    { value: 'B2C', label: 'Business to Customer (B2C)' },
] as const

export const businessModelLabel = (value?: string): string =>
    BUSINESS_MODELS.find((m) => m.value === value)?.label || value || '—'

// The descriptive name alone (e.g. "Business to Business"), used where a
// caller wants just the prefix without the parenthesised code.
export const businessModelFullName = (value?: string): string => {
    const label = BUSINESS_MODELS.find((m) => m.value === value)?.label
    if (label) return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label
    return value || '—'
}

// The single source of truth for user-facing rendering — always the
// "Business to Business (B2B)" shape when the value matches a known
// model, or the raw stored value verbatim otherwise. Legacy inputs like
// "B2B — Business to Business" are normalised to the new format.
export const businessModelDisplayName = (value?: string): string => {
    const normalized = value?.trim().toLowerCase()
    if (!normalized) return '—'
    const model = BUSINESS_MODELS.find((item) => {
        const name = businessModelFullName(item.value)
        return [item.value, item.label, name, `${name} (${item.value})`]
            .some((candidate) => candidate.toLowerCase() === normalized)
    })
    return model ? model.label : value?.trim() || '—'
}

// ─── Avatar / chip tones ──────────────────────────────────────────────────────

// Avatar tints keyed by a stable hash of the name, so a client keeps the same
// colour everywhere without anyone maintaining a mapping. This palette and hash
// are duplicated from the Services table on purpose: a client that is teal there
// must be teal here — do NOT retune these values on one page alone.
const AVATARS = [
    'bg-[#E4EDFF] text-[#3B62C4]',
    'bg-[#F1E9FF] text-[#7C4DD1]',
    'bg-[#FFE9DC] text-[#D9722F]',
    'bg-[#DFF4EC] text-[#1F8A6D]',
    'bg-[#FFE6EE] text-[#C64B7B]',
]
const hash = (s: string): number => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
}
export const avatarTone = (name: string): string => AVATARS[hash(name) % AVATARS.length]

// Business-model chips are pinned rather than hashed — there are only three and
// they are the page's main axis, so the colours should mean something. Kept in
// lockstep with the Services table's chips.
export const MODEL_TONES: Record<string, string> = {
    B2B: 'bg-[#E9F1FF] text-[#3B62C4]',
    B2I: 'bg-[#F1E9FF] text-[#7C4DD1]',
    B2C: 'bg-[#E1F5EF] text-[#0F8A72]',
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

// Turn a chunk of TipTap-authored HTML into readable plain text — used
// wherever a client's address (now rich HTML) has to be rendered as a
// single-line label or shipped through a plain-text pipe (CSV, PDF cell,
// window.title). Tag boundaries become line breaks so paragraph splits
// survive the round-trip; runs of whitespace collapse. Entities like
// `&amp;` are decoded via a throwaway element so a stored address that
// contains "&" doesn't print as "&amp;".
//
// Deliberately not DOMPurify: nothing here is placed in the DOM as HTML,
// so there is nothing to sanitize — this is a text extractor. Safe on
// the server too: the `document` guard falls back to a regex-only path
// when it's absent.
export const stripHtml = (value?: string | null): string => {
    if (!value) return ''
    // Replace closing block-level tags with a newline so paragraph and
    // list-item boundaries stay visible in the extracted text, THEN
    // strip every remaining tag. Order matters: strip first and the
    // "<p>Chennai</p><p>India</p>" collapses to "ChennaiIndia".
    const withBreaks = String(value)
        .replace(/<\s*(?:br|\/?p|\/?div|\/?li|\/?tr|\/?h[1-6])\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    let decoded = withBreaks
    if (typeof document !== 'undefined') {
        // Cheap entity decode — a throwaway element interprets the
        // markup and gives us back its `textContent`.
        try {
            const el = document.createElement('textarea')
            el.innerHTML = withBreaks
            decoded = el.value
        } catch {
            decoded = withBreaks
        }
    }
    return decoded.replace(/\r/g, '').replace(/\n{2,}/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean).join('\n').trim()
}

export function fmtCreatedDate(value?: string): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Format an ISO date string as e.g. "15 Jul 2026, 3:42 PM" (falls back to —)
export function fmtDate(value?: string): string {
    if (!value) return '—'
    const d = new Date(value)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    })
}

// All contacts with the primary one(s) first — keeps the Name and Email
// columns in the same vertical order so each row lines up across columns.
export const orderedContacts = (contactPersons: ContactPerson[]): ContactPerson[] => {
    if (!contactPersons?.length) return []
    const primary = contactPersons.filter((p) => p.isPrimary)
    const others = contactPersons.filter((p) => !p.isPrimary)
    return [...primary, ...others]
}

// ─── Toast ────────────────────────────────────────────────────────────────────

// Minimal toast — a clean surface pill with a green tick (success) or red X
// (error). The toastId derives from the message so repeated clicks with the
// same message won't stack — react-toastify ignores a visible duplicate id.
export function showNotify(type: 'success' | 'error', message: string) {
    toast(
        <div className="flex items-center gap-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white ${type === 'success' ? 'bg-success-500' : 'bg-danger-500'}`}>
                {type === 'success' ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
            </span>
            <span className="text-sm font-medium text-heading">{message}</span>
        </div>,
        {
            // Dedupe: repeated clicks with the same message won't stack —
            // react-toastify ignores a toastId that's already visible.
            toastId: `${type}:${message}`,
            icon: false,
            hideProgressBar: true,
            closeButton: false,
            autoClose: 2500,
            className: '!min-h-0 !rounded-xl !shadow-lg !border !border-hairline !bg-surface !px-3 !py-2.5',
        }
    )
}

export const notify = {
    success: (message: string) => showNotify('success', message),
    error: (message: string) => showNotify('error', message),
}
