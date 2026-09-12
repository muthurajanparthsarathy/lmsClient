"use client"

import { AlertCircle } from 'lucide-react'
import { HolidayDuration, HolidayType, HOLIDAY_TYPES } from './types'

// The pieces AddHolidayModal and BulkHolidayModal share: label, validation
// row, type chip grid and duration segmented. Form STATE stays in each modal —
// their reset semantics differ on purpose — only the presentation lives here.

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block text-sm font-medium text-body mb-1.5">
            {children}
            {required && <span className="text-brand-strong ml-0.5">*</span>}
        </label>
    )
}

export const INPUT_CLS =
    'h-9 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body ' +
    'placeholder:text-faint hover:border-line-hover focus:border-brand focus:ring-2 ' +
    'focus:ring-brand/15 focus:outline-none transition-colors duration-150'

export const INPUT_INVALID_CLS =
    'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'

export function NameErrorRow() {
    return (
        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-danger-700 mt-1">
            <AlertCircle size={11} className="shrink-0" />
            Holiday name is required.
        </p>
    )
}

export function TypeChipGrid({
    value,
    onChange,
}: {
    value: HolidayType
    onChange: (t: HolidayType) => void
}) {
    return (
        <div className="grid grid-cols-2 gap-1.5">
            {HOLIDAY_TYPES.map(t => (
                <button
                    key={t.value} type="button" onClick={() => onChange(t.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border text-xs font-medium transition-colors duration-150 ${
                        value === t.value
                            ? t.chip + ' ring-2 ring-offset-1 ring-current/25'
                            : 'bg-surface border-hairline-strong text-subtle hover:border-line-hover hover:bg-row-hover'
                    }`}
                >
                    <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                    {t.label}
                </button>
            ))}
        </div>
    )
}

const DURATIONS: { v: HolidayDuration; l: string }[] = [
    { v: 'full', l: 'Full Day' },
    { v: 'first-half', l: 'First Half' },
    { v: 'second-half', l: 'Second Half' },
]

export function DurationSegmented({
    value,
    onChange,
}: {
    value: HolidayDuration
    onChange: (d: HolidayDuration) => void
}) {
    return (
        <div className="flex rounded-control overflow-hidden border border-hairline-strong">
            {DURATIONS.map(d => (
                <button
                    key={d.v} type="button" onClick={() => onChange(d.v)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors duration-150 ${
                        value === d.v
                            ? 'bg-brand-wash text-brand-strong'
                            : 'bg-surface text-subtle hover:bg-row-hover'
                    }`}
                >
                    {d.l}
                </button>
            ))}
        </div>
    )
}

// Footer button recipes shared by both modals (and the page's error card).
export const BTN_SECONDARY =
    'h-9 px-4 rounded-control border border-hairline-strong bg-surface text-xs font-semibold ' +
    'text-body hover:border-line-hover hover:text-heading transition-colors duration-150'

export const BTN_PRIMARY =
    'flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-xs ' +
    'font-semibold shadow-xs hover:bg-brand-800 disabled:opacity-50 disabled:hover:bg-brand-strong ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
