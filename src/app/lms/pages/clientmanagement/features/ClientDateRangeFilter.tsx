"use client"

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** A span of whole YEARS — `from` and `to` are 'YYYY', either side optional.
 *
 *  Years rather than calendar dates: nobody filters a client list by the day a
 *  record was created, and a full date picker asked for two facts (month, day)
 *  that were then almost always set to the start and end of a year anyway. */
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

export default function ClientDateRangeFilter({ value, onChange, earliestCreatedAt }: {
    value: ClientDateRange
    onChange: (range: ClientDateRange) => void
    /** The oldest client on file, so the list offers no year that cannot match. */
    earliestCreatedAt?: string
}) {
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(value)
    const years = yearsBack(earliestCreatedAt)
    const invalid = Boolean(draft.from && draft.to && draft.from > draft.to)
    const active = Boolean(value.from || value.to)
    const caption = value.from && value.to
        ? (value.from === value.to ? value.from : `${value.from} – ${value.to}`)
        : value.from ? `From ${value.from}`
        : value.to ? `Until ${value.to}`
        : 'Created year'

    const select = (key: 'from' | 'to') => (
        <label className="min-w-0 text-xs text-subtle">
            {key === 'from' ? 'From' : 'To'}
            <select
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                className="mt-1.5 h-9 w-full min-w-0 rounded-control border border-hairline-strong bg-surface px-2 text-xs text-body focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
                <option value="">Any year</option>
                {years.map((year) => (
                    // The other end of the span disables the years that would
                    // invert it, so the error message below is only a backstop.
                    <option
                        key={year}
                        value={year}
                        disabled={key === 'from' ? Boolean(draft.to && year > draft.to) : Boolean(draft.from && year < draft.from)}
                    >
                        {year}
                    </option>
                ))}
            </select>
        </label>
    )

    return (
        <Popover.Root open={open} onOpenChange={(next) => { if (next) setDraft(value); setOpen(next) }}>
            <Popover.Trigger asChild>
                <button type="button" aria-label={`Created year range: ${caption}`} title={caption} className={`group inline-flex h-8 min-w-0 items-center gap-2 rounded-control border px-2.5 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${active ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'}`}>
                    <CalendarDays className="size-3.5 shrink-0 text-subtle" /><span className="min-w-0 flex-1 truncate text-left font-medium">{caption}</span><ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform group-data-[state=open]:rotate-180" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-popover w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-hairline bg-surface p-4 text-body shadow-lg outline-none">
                    <form onSubmit={(event) => { event.preventDefault(); if (!invalid) { onChange(draft); setOpen(false) } }}>
                        <h2 className="mb-3 text-sm font-semibold text-heading">Created year</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {select('from')}
                            {select('to')}
                        </div>
                        {invalid
                            ? <p role="alert" className="mt-2 text-xs text-red-600">The end year must be the same as or after the start year.</p>
                            : <p className="mt-2 text-xs text-subtle">Both years are included. Leave either on “Any year” for no limit.</p>}
                        <div className="mt-4 flex items-center justify-between">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange({ from: '', to: '' }); setOpen(false) }}>Clear years</Button>
                            <Button type="submit" size="sm" disabled={invalid}>Apply</Button>
                        </div>
                    </form>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
