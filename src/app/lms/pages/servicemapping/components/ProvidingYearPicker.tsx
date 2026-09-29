"use client"

/* Providing Year picker — one filter trigger, mode toggle INSIDE the popover.
 *
 * Every report page's Providing Year filter has two shapes: pick a set of
 * discrete years (List) or pick a from–to span (Range). Older callers wired
 * two components side by side and flipped between them with an outer Switch,
 * which visibly crowded the label row when the filter grid was tight.
 *
 * This picker keeps the outer row uniform (one trigger button, same height
 * and border as its neighbours) and moves the Range / List switch to a
 * segmented control at the top of the popover. Range shows the from / to
 * Select pair; List shows a scrollable year-checkbox list. Switching modes
 * CLEARS the other mode's state so a report never carries a stale year from
 * a mode the reader already left — that clearing is the caller's job (via
 * `onPeriodChange`) since only the caller knows the shape of its draft.
 *
 * Shared between the Business Reports and the Courses Report tabs.
 */

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type YearPickerPeriod = 'range' | 'years'

export type ProvidingYearPickerProps = {
    period: YearPickerPeriod
    years: string[]
    from: string
    to: string
    availableYears: string[]
    onPeriodChange: (next: YearPickerPeriod) => void
    onYearsChange: (next: string[]) => void
    onRangeChange: (from: string, to: string) => void
    /** Message shown in the popover when there are no years to pick from
     *  in the currently narrowed scope (e.g. after another filter drops
     *  every option). Defaults to a generic "No years available". */
    emptyLabel?: string
}

export default function ProvidingYearPicker(props: ProvidingYearPickerProps) {
    const { period, years, from, to, availableYears, onPeriodChange, onYearsChange, onRangeChange, emptyLabel } = props
    const [open, setOpen] = useState(false)

    const isSpan = Boolean(from || to) && from !== to
    const rangeCaption = from || to
        ? (isSpan ? `${from || 'Any'} – ${to || 'Any'}` : from || to)
        : 'Select year range'
    const listCaption = availableYears.length && years.length === availableYears.length
        ? 'All Years'
        : years.length === 0
            ? 'Select years'
            : years.length <= 3
                ? years.join(', ')
                : `${years.length} of ${availableYears.length} selected`
    const caption = period === 'range' ? rangeCaption : listCaption
    const active = period === 'range'
        ? Boolean(from || to)
        : years.length > 0 && years.length < availableYears.length

    const pickRange = (key: 'from' | 'to') => (choice: string) => {
        const value = choice === 'any' ? '' : choice
        const next = key === 'from' ? { from: value, to } : { from, to: value }
        if (next.from && next.to && next.from > next.to) return
        onRangeChange(next.from, next.to)
    }

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label="Providing year"
                    title={caption}
                    className={`inline-flex h-8 w-full min-w-0 items-center gap-2 rounded-control border px-2.5 text-xs text-body outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${active
                        ? 'border-brand-500/30 bg-brand-wash'
                        : 'border-hairline-strong bg-surface'}`}
                >
                    <CalendarDays className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{caption}</span>
                    <ChevronDown className="size-3.5 shrink-0" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    /* The year Selects portal their listbox to <body>, so opening one
                       moves focus outside this popover and Radix would dismiss it —
                       taking the picker away mid-choice. Only focus-driven dismissal
                       is refused; a real click outside still closes it. */
                    onFocusOutside={(event) => event.preventDefault()}
                    className="pointer-events-auto z-popover w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-hairline bg-surface p-3 shadow-lg"
                >
                    <div role="tablist" aria-label="Year selection mode" className="inline-flex items-center rounded-md border border-hairline bg-white overflow-hidden">
                        {([
                            { key: 'range' as const, label: 'Range' },
                            { key: 'years' as const, label: 'List' },
                        ]).map((mode) => {
                            const isActive = period === mode.key
                            return (
                                <button
                                    key={mode.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => onPeriodChange(mode.key)}
                                    className={`px-3 py-1 text-[11px] font-medium transition-colors ${isActive
                                        ? 'bg-brand-wash text-brand-strong'
                                        : 'text-subtle hover:text-heading'}`}
                                >
                                    {mode.label}
                                </button>
                            )
                        })}
                    </div>

                    {period === 'range' ? (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {(['from', 'to'] as const).map((key) => (
                                <div key={key}>
                                    <p className="mb-1.5 text-xs capitalize text-subtle">{key}</p>
                                    <Select
                                        value={(key === 'from' ? from : to) || 'any'}
                                        disabled={!availableYears.length}
                                        onValueChange={pickRange(key)}
                                    >
                                        <SelectTrigger aria-label={`${key === 'from' ? 'From' : 'To'} year`} className="w-full h-8">
                                            <SelectValue placeholder="Any year" />
                                        </SelectTrigger>
                                        <SelectContent className="pointer-events-auto z-popover max-h-60 min-w-[var(--radix-select-trigger-width)] p-1">
                                            <SelectItem value="any">Any year</SelectItem>
                                            {availableYears.map((year) => (
                                                <SelectItem
                                                    key={year}
                                                    value={year}
                                                    disabled={Boolean(key === 'from' ? to && year > to : from && year < from)}
                                                >
                                                    {year}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-3">
                            {!availableYears.length ? (
                                <p className="px-2 py-3 text-center text-xs text-subtle">{emptyLabel || 'No years available'}</p>
                            ) : (
                                <>
                                    <label className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-body hover:bg-canvas/60">
                                        <Checkbox
                                            checked={years.length === availableYears.length ? true : years.length ? 'indeterminate' : false}
                                            onCheckedChange={(checked) => onYearsChange(checked ? [...availableYears] : [])}
                                            className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white data-[state=indeterminate]:border-brand-700 data-[state=indeterminate]:bg-brand-700 data-[state=indeterminate]:text-white"
                                        />
                                        Select all years
                                    </label>
                                    <div className="mt-1 max-h-56 overflow-y-auto">
                                        {availableYears.map((year) => {
                                            const on = years.includes(year)
                                            return (
                                                <label key={year} className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs text-body hover:bg-canvas/60">
                                                    <Checkbox
                                                        checked={on}
                                                        onCheckedChange={(checked) => onYearsChange(checked
                                                            ? [...years, year].sort()
                                                            : years.filter((existing) => existing !== year))}
                                                        className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white"
                                                    />
                                                    {year}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="mt-2 flex justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={period === 'range' ? !(from || to) : years.length === 0}
                            onClick={() => {
                                if (period === 'range') onRangeChange('', '')
                                else onYearsChange([])
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
