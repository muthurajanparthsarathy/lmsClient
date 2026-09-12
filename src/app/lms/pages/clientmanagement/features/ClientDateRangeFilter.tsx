"use client"

import * as Select from '@radix-ui/react-select'
import { CalendarDays, Check, ChevronDown, ChevronUp } from 'lucide-react'

/** A whole calendar YEAR, kept in the range shape callers expect. `from` and
 *  `to` are both 'YYYY' (the same year) when a year is picked, or both '' for
 *  "any year" — the same call sites keep working, and `clientDateBounds` still
 *  produces the year's own start/end without special-casing.
 *
 *  Years rather than calendar dates: nobody filters a client list by the day a
 *  record was created, and the earlier from/to range picker asked two
 *  questions ("start year", "end year") that were almost always answered with
 *  the same year. */
export type ClientDateRange = { from: string; to: string }

const isYear = (value: string) => /^[1-9]\d{3}$/.test(value)

/** Half-open bounds in epoch ms: the whole of `from` through the whole of `to`.
 *  `until` is the first instant of the NEXT year, so the end year is included
 *  without any leap-year or daylight-saving arithmetic. */
export function clientDateBounds(range: ClientDateRange) {
    const start = isYear(range.from) ? new Date(Number(range.from), 0, 1) : null
    const end = isYear(range.to) ? new Date(Number(range.to) + 1, 0, 1) : null
    return { since: start?.getTime(), until: end?.getTime() }
}

/** Newest first — a list is far more often filtered to a recent year than to
 *  the oldest one on file. */
const yearsBack = (earliest?: string) => {
    const now = new Date().getFullYear()
    const first = earliest ? new Date(earliest).getFullYear() : now - 9
    const from = Number.isFinite(first) ? Math.min(first, now) : now - 9
    return Array.from({ length: now - from + 1 }, (_, i) => String(now - i))
}

const ALL = '__all__'

/** A single-year picker rendered as a plain dropdown, matching the other
 *  toolbar filters beside it (Business Model, Client). One year picks the
 *  whole of that calendar year; "All years" clears the filter. */
export default function ClientDateRangeFilter({ value, onChange, earliestCreatedAt, className = '' }: {
    value: ClientDateRange
    onChange: (range: ClientDateRange) => void
    /** The oldest client on file, so the list offers no year that cannot match. */
    earliestCreatedAt?: string
    className?: string
}) {
    const years = yearsBack(earliestCreatedAt)
    // The stored range may still carry a span (from a previous version of this
    // filter); show it as a range in the trigger and treat the single-year
    // dropdown as replacing it on the next pick.
    const selected = value.from && value.from === value.to ? value.from : ''
    const caption = value.from && value.to
        ? (value.from === value.to ? value.from : `${value.from} – ${value.to}`)
        : value.from ? `From ${value.from}`
        : value.to ? `Until ${value.to}`
        : 'All years'
    const active = Boolean(value.from || value.to)

    const handleChange = (next: string) => {
        if (next === ALL) onChange({ from: '', to: '' })
        else onChange({ from: next, to: next })
    }

    return (
        <Select.Root value={selected || ALL} onValueChange={handleChange}>
            <Select.Trigger
                aria-label={`Created year: ${caption}`}
                title={`Created year: ${caption}`}
                className={`group inline-flex h-8 min-w-0 items-center gap-2 rounded-control border px-2.5 text-xs shadow-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand/20 data-[state=open]:border-brand ${active ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:border-line-hover hover:bg-row-hover'} ${className}`}
            >
                <CalendarDays aria-hidden="true" className={`size-3.5 shrink-0 ${active ? 'text-brand-strong' : 'text-subtle'}`} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-left font-medium">
                    <Select.Value>{caption}</Select.Value>
                </span>
                <Select.Icon asChild>
                    <ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform duration-150 group-data-[state=open]:rotate-180" />
                </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
                <Select.Content
                    position="popper"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-popover max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-hairline bg-surface p-1 text-body shadow-lg"
                >
                    <Select.ScrollUpButton className="flex h-6 items-center justify-center text-subtle"><ChevronUp className="size-3.5" /></Select.ScrollUpButton>
                    <Select.Viewport className="max-h-64">
                        <Select.Group>
                            <Select.Label className="px-2.5 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">Created year</Select.Label>
                            {[{ value: ALL, label: 'All years' }, ...years.map((year) => ({ value: year, label: year }))].map((option) => (
                                <Select.Item
                                    key={option.value}
                                    value={option.value}
                                    className="relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-2.5 pr-9 text-xs outline-none transition-colors data-[highlighted]:bg-row-hover data-[highlighted]:text-heading data-[state=checked]:bg-brand-wash data-[state=checked]:font-medium data-[state=checked]:text-brand-strong"
                                >
                                    <Select.ItemText>{option.label}</Select.ItemText>
                                    <Select.ItemIndicator className="absolute right-2.5"><Check className="size-3.5 text-brand-strong" strokeWidth={2} /></Select.ItemIndicator>
                                </Select.Item>
                            ))}
                        </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-6 items-center justify-center text-subtle"><ChevronDown className="size-3.5" /></Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}
