"use client"

import { Check, X } from 'lucide-react'
import { toast } from 'react-toastify'
import type { ClientType, ContactPerson } from '@/apiServices/clientManagementService'

// ─── Form types ───────────────────────────────────────────────────────────────

export type FormData = {
    contactPersons: ContactPerson[]
    clientCompany: string
    description: string
    clientAddress: string
    type: ClientType[]
    businessModel: string
    status: 'active' | 'inactive'
}

export type ContactErrors = { name?: string; email?: string; phoneNumber?: string }

export type FormErrors = {
    clientCompany?: string
    businessModel?: string
    contacts?: ContactErrors[]
}

// The listing's sortable columns. Only these three sort: the contact columns
// hold a list per row, so there is no single value to order them by.
export type ClientSortKey = 'company' | 'model' | 'status'

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
export const BUSINESS_MODELS = [
    { value: 'B2B', label: 'B2B — Business to Business' },
    { value: 'B2I', label: 'B2I — Business to Institution' },
    { value: 'B2C', label: 'B2C — Business to Customer' },
] as const

export const businessModelLabel = (value?: string): string =>
    BUSINESS_MODELS.find((m) => m.value === value)?.label || value || '—'

// The descriptive name alone (e.g. "Business to Business"), dropping the "B2B — "
// code prefix — used where the full model name reads clearer than the acronym.
export const businessModelFullName = (value?: string): string => {
    const label = BUSINESS_MODELS.find((m) => m.value === value)?.label
    if (label) return label.split('—')[1]?.trim() || label
    return value || '—'
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

// Format an ISO date string as e.g. "15 Jul 2026, 3:42 PM" (falls back to —)
export function fmtDate(value?: string): string {
    if (!value) return '—'
    const d = new Date(value)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
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
