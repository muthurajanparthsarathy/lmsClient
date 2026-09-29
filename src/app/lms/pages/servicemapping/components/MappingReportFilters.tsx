"use client"

import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, Check, ChevronDown, Layers, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import ProvidingYearPicker from './ProvidingYearPicker'

/* Values arrive from the database exactly as somebody typed them — "business
   to institution", "skilling". Presenting them raw next to a properly cased
   "Degree Program" looks like a bug, so every filter label goes through this.

   Only the FIRST character of each word is touched; the rest is left alone so
   acronyms survive ("B2B" stays "B2B", not "B2b"). The small connecting words
   stay lowercase unless they lead, which is what turns "business to business"
   into "Business to Business" rather than "Business To Business". */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])

export function displayLabel(value: string): string {
    if (!value) return value
    return value.split(/(\s+)/).map((part, index) => {
        if (!part.trim()) return part
        // index counts separators too, so the first WORD is index 0.
        if (index > 0 && MINOR_WORDS.has(part.toLowerCase())) return part.toLowerCase()
        return part.charAt(0).toUpperCase() + part.slice(1)
    }).join('')
}

/* A service whose name IS a business model reads better with its acronym: the
   data holds "business to institution", and the reader knows it as
   "Business to Institution (B2I)". Anything else — "skilling", a course track —
   has no acronym to add, so it just gets the ordinary casing. */
export function serviceLabel(value: string): string {
    if (!value) return value
    const named = businessModelDisplayName(value)
    return named.includes('(') ? named : displayLabel(value)
}

const trigger = 'inline-flex h-8 min-w-0 items-center gap-2 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs text-body outline-none focus-visible:ring-2 focus-visible:ring-brand/20'
// A ticked row keeps plain body text on a plain surface: the box on its left is
// already filled brand, and recolouring the label as well turned a fully-ticked
// list — the normal state of the Reports filters — into a wall of orange.
const checkboxItem = [
    'cursor-pointer py-2 text-xs text-body',
    '[&>span:first-child]:size-4 [&>span:first-child]:rounded-[4px] [&>span:first-child]:border [&>span:first-child]:border-hairline-strong [&>span:first-child]:bg-surface [&>span:first-child]:transition-colors',
    '[&[data-state=checked]>span:first-child]:border-brand-700 [&[data-state=checked]>span:first-child]:bg-brand-700 [&[data-state=checked]>span:first-child]:text-white [&_svg]:size-3',
].join(' ')
// The Select all row. A partial selection gets the same box with a softer fill
// so "some" never reads as the solid "all" — Radix drives it off
// data-state=indeterminate, which it sets for a CheckedState of 'indeterminate'.
const selectAllItem = [
    checkboxItem,
    '[&[data-state=indeterminate]>span:first-child]:border-brand-700 [&[data-state=indeterminate]>span:first-child]:bg-brand-700/40 [&[data-state=indeterminate]>span:first-child]:text-white',
    'mb-1 rounded-none border-b border-hairline',
].join(' ')

/* ─────────────────────────────────────────────────────────────────────────────
   MappingMultiFilter

    `yearFilter` renders the Service-providing-year picker INSIDE the menu,
    under the option list. It is used by the Clients filter.

    The years are derived from the CURRENT selection on every render, via
    `yearsFor(selected)`. The picker can then narrow the visible client rows
    without changing the client's selected values behind the scenes.
   ──────────────────────────────────────────────────────────────────────────── */
export function MappingMultiFilter({ label, options, value, onChange, emptyLabel, placeholder, yearFilter, extra }: {
    label: string
    options: { value: string; label: string }[]
    value: string[]
    onChange: (values: string[]) => void
    emptyLabel?: string
    placeholder?: string
    yearFilter?: {
        label: string
        yearsFor: (selected: string[]) => string[]
        matches?: (option: string) => boolean
        period: 'years' | 'range'
        years: string[]
        from: string
        to: string
        onPeriodChange: (period: 'years' | 'range') => void
        onYearsChange: (years: string[]) => void
        onRangeChange: (from: string, to: string) => void
    }
    /** A plain second multi-select in the same menu, above the option list —
     *  the Client filter uses it for the client's CREATED YEAR. Separate from
     *  `yearFilter`, which is the providing-year picker with its own range /
     *  list modes; this one is a list of values and nothing more. The caller
     *  narrows `options` itself, so this stays a picker rather than a second
     *  filtering rule living inside the component. */
    extra?: {
        label: string
        options: (string | number)[]
        value: string[]
        onChange: (values: string[]) => void
        /** The "no filter" row's wording. Defaults to "All". */
        allLabel?: string
    }
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [extraOpen, setExtraOpen] = useState(false)

    /* STAGED, committed by Done.
     *
     * Every answer in this menu — the ticks, the second picker, the year —
     * is held here while it is open and handed to the caller in one go. A
     * filter bar that applies each tick as it lands refetches (or re-derives a
     * report scope) per checkbox, and the reader watches the list churn while
     * they are still choosing. Closing without Done discards, so the menu can
     * be opened, looked at, and dismissed without changing anything.
     *
     * The drafts re-sync from props on every open, which is what makes an
     * outside Reset show up next time. */
    const [draft, setDraft] = useState<string[]>(value)
    const [draftExtra, setDraftExtra] = useState<string[]>(extra?.value ?? [])
    const [draftPeriod, setDraftPeriod] = useState<'years' | 'range'>(yearFilter?.period ?? 'years')
    const [draftYears, setDraftYears] = useState<string[]>(yearFilter?.years ?? [])
    const [draftFrom, setDraftFrom] = useState(yearFilter?.from ?? '')
    const [draftTo, setDraftTo] = useState(yearFilter?.to ?? '')
    useEffect(() => {
        if (!open) return
        setDraft(value)
        setDraftExtra(extra?.value ?? [])
        setDraftPeriod(yearFilter?.period ?? 'years')
        setDraftYears(yearFilter?.years ?? [])
        setDraftFrom(yearFilter?.from ?? '')
        setDraftTo(yearFilter?.to ?? '')
        setSearch('')
        setExtraOpen(false)
        // Keyed on `open` alone: re-reading the applied filter is the point of
        // opening, and adding the values as deps would resync the draft out
        // from under an edit in progress.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const commit = () => {
        onChange(draft)
        extra?.onChange(draftExtra)
        if (yearFilter) {
            // Period first: the caller's handler clears the mode being left,
            // so the values below have to land after it.
            if (draftPeriod !== yearFilter.period) yearFilter.onPeriodChange(draftPeriod)
            if (draftPeriod === 'range') yearFilter.onRangeChange(draftFrom, draftTo)
            else yearFilter.onYearsChange(draftYears)
        }
        setOpen(false)
    }

    // The TRIGGER reports what is APPLIED, never the draft — a caption running
    // ahead of the list would claim a filter that isn't on yet.
    const allPicked = options.length > 0 && value.length >= options.length
    const caption = allPicked ? `All ${label.toLowerCase()}`
        : value.length > 1 ? `${value.length} selected`
        : value.length ? displayLabel(options.find((option) => option.value === value[0])?.label || value[0])
        : (placeholder || `All ${label.toLowerCase()}`)

    // Year options scoped to whatever is ticked IN THE MENU, so the year list
    // follows the choice being made rather than the one already applied.
    const yearOptions = yearFilter ? yearFilter.yearsFor(draft) : []

    const hasYearSelection = Boolean(yearFilter && (
        draftPeriod === 'range' ? draftFrom || draftTo : draftYears.length
    ))

    // Apply both the text search AND the year filter to the visible list.
    // Year filtering works by checking whether the year is offered when
    // scopeByClients is run against just that one client — i.e. does that
    // client have data for the selected year?
    const shown = options.filter((option) => {
        if (!option.label.toLowerCase().includes(search.toLowerCase())) return false
        if (hasYearSelection && yearFilter) {
            if (yearFilter.matches) return yearFilter.matches(option.value)
            const scopeForOption = yearFilter.yearsFor([option.value])
            if (draftPeriod === 'range') {
                if (scopeForOption.some((year) => (!draftFrom || year >= draftFrom) && (!draftTo || year <= draftTo))) return true
            } else if (scopeForOption.some((year) => draftYears.includes(year))) {
                return true
            }
            return false
        }
        return true
    })

    const picked = new Set(draft)
    const shownPicked = shown.filter((option) => picked.has(option.value)).length
    const allShown = shown.length > 0 && shownPicked === shown.length
    const toggleAll = (checked: boolean) => {
        const inView = new Set(shown.map((option) => option.value))
        setDraft((current) => (checked
            ? [...new Set([...current, ...inView])].sort()
            : current.filter((item) => !inView.has(item))))
    }

    const extraOptions = [...new Set((extra?.options ?? []).map((item) => String(item).trim()).filter(Boolean))]
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    // Newest first: a created-year list is read from the most recent back.
    const extraSection = extra ? (
        <div className="mb-1.5 border-b border-hairline px-2 pb-2">
            <p className="mb-1.5 text-xs font-medium text-subtle">{extra.label}</p>
            <button
                type="button"
                onClick={() => setExtraOpen((isOpen) => !isOpen)}
                aria-expanded={extraOpen}
                className={`flex h-8 w-full items-center justify-between rounded-control border px-2.5 text-left text-xs outline-none transition-colors ${
                    draftExtra.length
                        ? 'border-brand-500/30 bg-brand-wash font-medium text-brand-strong'
                        : 'border-hairline-strong bg-surface text-body'
                }`}
            >
                <span className="min-w-0 truncate">
                    {draftExtra.length ? draftExtra.join(', ') : (extra.allLabel || 'All')}
                </span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${extraOpen ? 'rotate-180' : ''}`} />
            </button>
            {extraOpen && (
                <div className="mt-1 rounded-control border border-hairline-strong bg-surface">
                    <div className="max-h-32 overflow-y-auto p-1">
                        <button
                            type="button"
                            onClick={() => setDraftExtra([])}
                            className={`flex min-h-8 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${!draftExtra.length ? 'bg-brand-wash font-medium text-brand-strong' : 'text-body hover:bg-row-hover'}`}
                        >
                            {extra.allLabel || 'All'}
                            {!draftExtra.length && <Check className="size-3.5 text-brand-strong" />}
                        </button>
                        {extraOptions.map((option) => {
                            const on = draftExtra.includes(option)
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setDraftExtra((current) => (on
                                        ? current.filter((item) => item !== option)
                                        : [...current, option]).sort())}
                                    className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-body hover:bg-row-hover"
                                >
                                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-hairline-strong bg-surface'}`}>
                                        {on && <Check className="size-3" />}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{option}</span>
                                </button>
                            )
                        })}
                        {!extraOptions.length && (
                            <p className="px-2 py-2 text-center text-xs text-subtle">Nothing to filter by.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    ) : null

    // Nothing is filtered until Done — so Clear empties the staged answers and
    // Done is what commits, in one update however many boxes were ticked.
    const doneFooter = (
        <div className="mt-1 flex items-center justify-end gap-2 border-t border-hairline px-2 pt-2">
            {(draft.length > 0 || draftExtra.length > 0 || hasYearSelection) && (
                <button
                    type="button"
                    onClick={() => {
                        setDraft([])
                        setDraftExtra([])
                        setDraftYears([])
                        setDraftFrom('')
                        setDraftTo('')
                    }}
                    className="inline-flex h-7 items-center rounded-chip px-2 text-[11px] font-medium text-subtle hover:bg-row-hover hover:text-heading"
                >
                    Clear
                </button>
            )}
            <button
                type="button"
                onClick={commit}
                className="inline-flex h-7 items-center rounded-chip bg-brand-strong px-3 text-[11px] font-semibold text-white shadow-xs hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
                Done
            </button>
        </div>
    )

    return <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger asChild><button type="button" aria-label={`${label}: ${caption}`} title={value.map((id) => displayLabel(options.find((option) => option.value === id)?.label || id)).join(', ') || caption} className={`${trigger} w-full justify-between ${(value.length && !allPicked) || extra?.value.length ? 'border-brand-500/30 bg-brand-wash' : ''}`}><span className="min-w-0 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
            {/* The second picker sits above the list even when the list is
                empty: narrowing by year is exactly what can empty it, and the
                reader has to be able to widen it again. */}
            {options.length === 0 && extraSection}
            {options.length === 0
                ? <>
                    <p className="px-2 py-3 text-center text-xs text-subtle">{emptyLabel || `No ${label.toLowerCase()} available`}</p>
                    {extra && doneFooter}
                </>
                : <>
                    <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} className="mb-1 h-8 w-full rounded-lg border border-hairline px-2 text-xs outline-none focus:border-brand" />
                    {extraSection}
                    {yearFilter && (
                        <div className="mb-1.5 border-b border-hairline px-2 pb-2">
                            <p className="mb-1.5 text-xs font-medium text-subtle">{yearFilter.label}</p>
                            <ProvidingYearPicker
                                period={draftPeriod}
                                years={draftYears}
                                from={draftFrom}
                                to={draftTo}
                                availableYears={yearOptions}
                                emptyLabel="No years for the selected clients"
                                // Staged like everything else in here: switching
                                // mode clears the other mode's staged values,
                                // which is what the caller's own handler does on
                                // commit.
                                onPeriodChange={(next) => {
                                    setDraftPeriod(next)
                                    if (next === 'range') setDraftYears([])
                                    else { setDraftFrom(''); setDraftTo('') }
                                }}
                                onYearsChange={setDraftYears}
                                onRangeChange={(from, to) => { setDraftFrom(from); setDraftTo(to) }}
                            />
                        </div>
                    )}
                    <DropdownMenuCheckboxItem checked={allShown ? true : shownPicked ? 'indeterminate' : false} disabled={!shown.length} onSelect={(event) => event.preventDefault()} onCheckedChange={toggleAll} className={selectAllItem}>
                        <span className="flex-1 truncate">{search ? `Select all ${shown.length} matching` : `Select all ${label.toLowerCase()}`}</span>
                        {shownPicked > 0 && <span className="shrink-0 tabular-nums text-2xs text-subtle">{shownPicked}/{shown.length}</span>}
                    </DropdownMenuCheckboxItem>
                    <div className="max-h-56 overflow-y-auto">
                        {shown.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={picked.has(option.value)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => setDraft((current) => (checked ? [...current, option.value] : current.filter((item) => item !== option.value)).sort())} className={checkboxItem}>{displayLabel(option.label)}</DropdownMenuCheckboxItem>)}
                        {!shown.length && <p className="px-2 py-3 text-center text-xs text-subtle">{hasYearSelection ? 'No options with data for the selected year.' : `No match for "${search}".`}</p>}
                    </div>
                    {doneFooter}
                </>}
        </DropdownMenuContent>
    </DropdownMenu>
}
export function MappingYearRange({ from, to, years, onChange, placeholder, hideRangeToggle = false }: { from: string; to: string; years: string[]; onChange: (from: string, to: string) => void; placeholder?: string; hideRangeToggle?: boolean }) {
    const [open, setOpen] = useState(false)
    // One year is the everyday question, so it is what the picker asks by
    // default; a span is opt-in behind the Range checkbox. A single year still
    // goes out as the inclusive range with both ends equal — the API filters
    // yearFrom ≤ year ≤ yearTo — so nothing downstream had to change. Range
    // mode starts ticked only when the filter genuinely IS a span: two
    // different ends, or one end left open.
    //
    // When the caller already has an outer Range switch of its own (business
    // reports flips MappingYearRange in for MappingMultiFilter based on that
    // switch), the inner Range checkbox is redundant — hideRangeToggle drops
    // it and forces the from/to pair.
    const isSpan = Boolean(from || to) && from !== to
    const [rangeMode, setRangeMode] = useState(hideRangeToggle || isSpan)
    const effectiveRangeMode = hideRangeToggle || rangeMode
    const availableYears = [...new Set(years.map((year) => String(year).trim()).filter((year) => /^[1-9]\d{3}$/.test(year)))].sort()
    // No Apply button — each pick lands as it is made. The two selects read
    // straight from props rather than a local draft, so closing the popover can
    // never strand a half-made choice that was never applied. A pair that would
    // invert the range is refused rather than pushed up: the disabled options
    // below make that mostly unreachable, and this is the backstop.
    const pick = (key: 'from' | 'to') => (choice: string) => {
        const next = { from, to, [key]: choice === 'any' ? '' : choice }
        if (next.from && next.to && next.from > next.to) return
        onChange(next.from, next.to)
    }
    const pickYear = (choice: string) => {
        const year = choice === 'any' ? '' : choice
        onChange(year, year)
    }
    // Unticking Range keeps one end of the span as the single year (its start,
    // or its end when only that was set), so the filter narrows instead of
    // silently clearing.
    const toggleRange = (checked: boolean) => {
        setRangeMode(checked)
        if (!checked && isSpan) pickYear(from || to)
    }
    const caption = !from && !to ? (placeholder || 'All years') : isSpan ? `${from || 'Any'} – ${to || 'Any'}` : from
    return <Popover.Root open={open} onOpenChange={(next) => {
        // With no year filter set, every opening starts on the default
        // single-year question, even if Range was ticked and left unused.
        // Skip that reset when the range toggle is hidden — the picker has
        // only one mode there and must stay in it.
        if (next && !from && !to && !hideRangeToggle) setRangeMode(false)
        setOpen(next)
    }}>
        <Popover.Trigger asChild><button type="button" aria-label="Service providing year" className={`${trigger} ${from || to ? 'border-brand-500/30 bg-brand-wash' : ''}`}><CalendarDays className="size-3.5 shrink-0" /><span className="flex-1 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" /></button></Popover.Trigger>
        <Popover.Portal><Popover.Content align="start" sideOffset={6} collisionPadding={12}
            // The year Selects portal their listbox to the body, so opening one
            // moves focus outside this popover and Radix would dismiss it —
            // taking the picker away mid-choice. Only focus-driven dismissal is
            // refused; a real click outside still closes it.
            onFocusOutside={(event) => event.preventDefault()}
            /* pointer-events-auto is load-bearing. This popover is portalled to
               <body>, and the report Dialog is modal — Radix sets
               pointer-events:none on the body and re-enables it only on the
               dialog itself. The portalled panel inherits that none, so without
               this every click falls straight through to whatever sits behind,
               which Radix then reads as a click OUTSIDE and dismisses on. The
               symptom is a picker you can see but cannot use. The dropdowns on
               this bar do not need it: Radix DropdownMenu is modal by default
               and manages body pointer-events itself, Popover is not. */
            className="pointer-events-auto z-popover w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-hairline bg-surface p-4 shadow-lg">
            <h2 className="text-sm font-semibold text-heading">Service providing years</h2>
            {/* Unticked: one Year select. Ticked: the From / To pair. Same brand
                fill as the checkbox rows on the other filters in this bar.
                Skipped when the caller hides the toggle. */}
            {!hideRangeToggle && (
                <label className="mt-3 flex w-fit cursor-pointer select-none items-center gap-2 text-xs font-medium text-body">
                    <Checkbox checked={rangeMode} disabled={!availableYears.length} onCheckedChange={(checked) => toggleRange(checked === true)} className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white" />
                    Range
                </label>
            )}
            {effectiveRangeMode
                ? <div className="mt-3 grid grid-cols-2 gap-3">{(['from', 'to'] as const).map((key) => <div key={key}>
                    <p className="mb-1.5 text-xs capitalize text-subtle">{key}</p>
                    <Select value={(key === 'from' ? from : to) || 'any'} disabled={!availableYears.length} onValueChange={pick(key)}>
                        <SelectTrigger aria-label={key === 'from' ? 'From service year' : 'To service year'} className="w-full"><SelectValue placeholder="Any year" /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-popover max-h-60 min-w-[var(--radix-select-trigger-width)] p-1">
                            <SelectItem value="any">Any year</SelectItem>
                            {availableYears.map((year) => <SelectItem key={year} value={year} disabled={Boolean(key === 'from' ? to && year > to : from && year < from)}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>)}</div>
                : <div className="mt-3">
                    <p className="mb-1.5 text-xs text-subtle">Year</p>
                    <Select value={from || to || 'any'} disabled={!availableYears.length} onValueChange={pickYear}>
                        <SelectTrigger aria-label="Service year" className="w-full"><SelectValue placeholder="Any year" /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-popover max-h-60 min-w-[var(--radix-select-trigger-width)] p-1">
                            <SelectItem value="any">Any year</SelectItem>
                            {availableYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>}
            <p className="mt-2 text-xs text-subtle">{!availableYears.length ? 'No service years are available.' : effectiveRangeMode ? 'Available service years only. Both selected years are included.' : 'Available service years only. Tick Range to pick a from–to span.'}</p>
            <div className="mt-3 flex justify-end"><Button type="button" variant="ghost" size="sm" disabled={!from && !to} onClick={() => { onChange('', ''); if (!hideRangeToggle) setRangeMode(false); setOpen(false) }}>Clear</Button></div>
        </Popover.Content></Popover.Portal>
    </Popover.Root>
}

/** The listing's year filter, laid out in the filter grid itself rather than
 *  behind a popover — one step, not open-then-choose. One Year select by
 *  default; the Range checkbox beside the label swaps it for a From / To pair.
 *  A single year goes out as the inclusive range with both ends equal, which
 *  the API (yearFrom ≤ year ≤ yearTo) reads as exactly that year. `range` is
 *  held by the caller so its own Clear all can reset it. */
export function MappingYearFilter({ label, from, to, years, range, onRangeChange, onChange }: {
    label: string
    from: string
    to: string
    years: string[]
    range: boolean
    onRangeChange: (range: boolean) => void
    onChange: (from: string, to: string) => void
}) {
    const availableYears = [...new Set(years.map((year) => String(year).trim()).filter((year) => /^[1-9]\d{3}$/.test(year)))].sort()
    const noYears = !availableYears.length
    // Same "has a value" tint as the other filter triggers in this bar.
    const active = 'border-brand-500/30 bg-brand-wash text-brand-strong'
    const content = 'z-popover max-h-60 min-w-[var(--radix-select-trigger-width)] p-1'
    const pickYear = (choice: string) => {
        const year = choice === 'any' ? '' : choice
        onChange(year, year)
    }
    // A pair that would invert the range is refused; the disabled options make
    // that mostly unreachable, and this is the backstop.
    const pickEnd = (key: 'from' | 'to') => (choice: string) => {
        const next = { from, to, [key]: choice === 'any' ? '' : choice }
        if (next.from && next.to && next.from > next.to) return
        onChange(next.from, next.to)
    }
    // Unticking keeps one end of a span as the single year (its start, or its
    // end when only that was set), so the filter narrows instead of clearing.
    const toggleRange = (checked: boolean) => {
        onRangeChange(checked)
        if (!checked && (from || to) && from !== to) pickYear(from || to)
    }
    return <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-subtle">{label}</p>
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-subtle">
                <Checkbox checked={range} disabled={noYears} onCheckedChange={(checked) => toggleRange(checked === true)} className="border-hairline-strong data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=checked]:text-white" />
                Range
            </label>
        </div>
        {range
            ? <div className="grid grid-cols-2 gap-2">{(['from', 'to'] as const).map((key) => {
                const value = key === 'from' ? from : to
                return <Select key={key} value={value || 'any'} disabled={noYears} onValueChange={pickEnd(key)}>
                    <SelectTrigger aria-label={key === 'from' ? 'From service year' : 'To service year'} className={`w-full min-w-0 ${value ? active : ''}`}><SelectValue /></SelectTrigger>
                    <SelectContent className={content}>
                        <SelectItem value="any">{key === 'from' ? 'From any' : 'To any'}</SelectItem>
                        {availableYears.map((year) => <SelectItem key={year} value={year} disabled={Boolean(key === 'from' ? to && year > to : from && year < from)}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
            })}</div>
            : <Select value={from || to || 'any'} disabled={noYears} onValueChange={pickYear}>
                <SelectTrigger aria-label={label} className={`w-full min-w-0 ${from || to ? active : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent className={content}>
                    <SelectItem value="any">All years</SelectItem>
                    {availableYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                </SelectContent>
            </Select>}
    </div>
}

export function MappingModelFilter({ options, value, onChange }: { options: string[]; value: string[]; onChange: (values: string[]) => void }) {
    return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" title={value.join(', ') || 'All service models'} className={`${trigger} max-w-64 ${value.length ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}><Layers className="size-3.5 shrink-0" /><span className="flex-1 truncate">{value.length ? value.join(', ') : 'All service models'}</span><ChevronDown className="size-3.5 shrink-0" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="max-h-72 w-60 overflow-y-auto rounded-xl">
            <DropdownMenuLabel className="text-xs">Service models · select any</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={!value.length} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onChange([])} className={checkboxItem}>All service models</DropdownMenuCheckboxItem>
            {options.map((model) => <DropdownMenuCheckboxItem key={model} checked={value.includes(model)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange((checked ? [...value, model] : value.filter((item) => item !== model)).sort())} className={checkboxItem}>{model}</DropdownMenuCheckboxItem>)}
        </DropdownMenuContent>
    </DropdownMenu>
}

/** Single-choice sibling of MappingMultiFilter, for the filters the API takes
 *  one value for (course, setup status, created-after). Same trigger, same
 *  menu, same empty-state prompt — so a filter bar can mix the two without the
 *  seam showing. Applies on pick: its one caller (Course Setup's Course
 *  filter) picks a single value against data already in hand, so there is
 *  nothing to batch. The listing's own filters are MappingListFilter below,
 *  which is multi-select and commits on Done. */
export function MappingSingleFilter({ label, options, value, onChange, placeholder, anyLabel }: {
    label: string
    options: { value: string; label: string }[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    anyLabel?: string
}) {
    const [search, setSearch] = useState('')
    const chosen = options.find((option) => option.value === value)
    const caption = chosen ? displayLabel(chosen.label) : (placeholder || `All ${label.toLowerCase()}`)
    const shown = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
    return <DropdownMenu onOpenChange={() => setSearch('')}><DropdownMenuTrigger asChild><button type="button" aria-label={`${label}: ${caption}`} title={caption} className={`${trigger} w-full justify-between ${value ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}><span className="min-w-0 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
            <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
            {options.length === 0
                ? <p className="px-2 py-3 text-center text-xs text-subtle">No {label.toLowerCase()} available</p>
                : <>
                    {options.length > 8 && <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} className="mb-1 h-8 w-full rounded-lg border border-hairline px-2 text-xs outline-none focus:border-brand" />}
                    <DropdownMenuCheckboxItem checked={!value} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onChange('')} className={`${checkboxItem} mb-1 rounded-none border-b border-hairline`}>{anyLabel || `All ${label.toLowerCase()}`}</DropdownMenuCheckboxItem>
                    <div className="max-h-56 overflow-y-auto">
                        {shown.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={value === option.value} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange(checked ? option.value : '')} className={checkboxItem}>{displayLabel(option.label)}</DropdownMenuCheckboxItem>)}
                        {!shown.length && <p className="px-2 py-3 text-center text-xs text-subtle">No match for “{search}”.</p>}
                    </div>
                </>}
        </DropdownMenuContent>
    </DropdownMenu>
}

/** The listing's multi-select filter: tick as many as you like, then Done.
 *
 *  Why not MappingMultiFilter, which is also a multi-select: that one applies
 *  every tick straight up to its caller, which is right inside the report
 *  dialogs (they hold a draft of their own and have an Apply button at the
 *  bottom) and wrong on a listing that refetches a page per applied filter.
 *  This one stages the ticks and commits them on Done, so ticking four models
 *  costs one request instead of four. Same trigger and the same checkbox rows,
 *  so the two read as one family.
 *
 *  `extra` is a SECOND multi-select in the same menu, above the main list —
 *  the listing pairs the service-providing year with the service model that
 *  way, because they are asked together and commit together. */
export function MappingListFilter({ label, options, value, onChange, placeholder, emptyLabel, extra, narrow }: {
    label: string
    options: { value: string; label: string }[]
    value: string[]
    onChange: (values: string[]) => void
    placeholder?: string
    emptyLabel?: string
    extra?: {
        label: string
        /** Values on offer, already scoped by whatever else is filtered. */
        options: (string | number)[]
        value: string[]
        onChange: (values: string[]) => void
        /** The "no filter" row's wording. Defaults to "All". */
        allLabel?: string
    }
    /** Narrows the LIST by the year each option was created (the "Created
     *  year" picker on the Service-model filter, merged in from the 22 Sep
     *  work). It never filters the table: it only cuts a long list down
     *  before ticking. An option with no recorded year hides while a year is
     *  picked. */
    narrow?: {
        label: string
        /** option value → the year it was created in. */
        itemYears: Record<string, string>
    }
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [extraOpen, setExtraOpen] = useState(false)
    const [narrowYears, setNarrowYears] = useState<string[]>([])
    // Staged ticks, re-synced from props on every open — so an outside Clear
    // all shows next time, and closing without Done discards.
    const [draft, setDraft] = useState<string[]>(value)
    const [extraDraft, setExtraDraft] = useState<string[]>(extra?.value ?? [])
    const extraApplied = extra?.value
    useEffect(() => {
        if (!open) return
        setDraft(value)
        setExtraDraft(extraApplied ?? [])
        setSearch('')
        setExtraOpen(false)
        setNarrowYears([])
        // Deliberately keyed on `open` alone: re-reading the applied filter is
        // the point of opening, and adding the values as deps would resync the
        // draft out from under an edit in progress.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // The trigger reports what is APPLIED, never the draft — a caption running
    // ahead of the table would claim a filter that isn't on yet.
    const appliedLabel = value.length === 1
        ? displayLabel(options.find((option) => option.value === value[0])?.label || value[0])
        : value.length > 1
            ? `${value.length} selected`
            : (placeholder || `All ${label.toLowerCase()}`)
    const extraCaption = extraApplied?.length
        ? (extraApplied.length === 1 ? String(extraApplied[0]) : `${extraApplied.length} years`)
        : ''
    const caption = extraCaption ? `${appliedLabel} · ${extraCaption}` : appliedLabel
    const anyApplied = value.length > 0 || Boolean(extraApplied?.length)

    const shown = options
        .filter((option) => !narrowYears.length || narrowYears.includes(narrow?.itemYears[option.value] ?? ''))
        .filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
    const narrowOptions = narrow
        ? [...new Set(options.map((option) => narrow.itemYears[option.value]).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
        : []
    const shownPicked = shown.filter((option) => draft.includes(option.value)).length
    const allShown = shown.length > 0 && shownPicked === shown.length
    const toggleAllShown = (checked: boolean) => {
        const inView = new Set(shown.map((option) => option.value))
        setDraft((current) => checked
            ? [...new Set([...current, ...inView])].sort()
            : current.filter((item) => !inView.has(item)))
    }
    const toggleDraft = (optionValue: string, checked: boolean) => {
        setDraft((current) => (checked
            ? [...current, optionValue]
            : current.filter((item) => item !== optionValue)).sort())
    }

    const extraOptions = [...new Set((extra?.options ?? []).map((item) => String(item).trim()).filter(Boolean))].sort()
    const extraSection = extra ? (
        <div className="mb-1.5 border-b border-hairline px-2 pb-2">
            <p className="mb-1.5 text-xs font-medium text-subtle">{extra.label}</p>
            <button
                type="button"
                onClick={() => setExtraOpen((isOpen) => !isOpen)}
                aria-expanded={extraOpen}
                className={`flex h-8 w-full items-center justify-between rounded-control border px-2.5 text-left text-xs outline-none transition-colors ${
                    extraDraft.length
                        ? 'border-brand-500/30 bg-brand-wash font-medium text-brand-strong'
                        : 'border-hairline-strong bg-surface text-body'
                }`}
            >
                <span className="min-w-0 truncate">
                    {extraDraft.length ? extraDraft.join(', ') : (extra.allLabel || 'All')}
                </span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${extraOpen ? 'rotate-180' : ''}`} />
            </button>
            {extraOpen && (
                <div className="mt-1 rounded-control border border-hairline-strong bg-surface">
                    <div className="max-h-32 overflow-y-auto p-1">
                        <button
                            type="button"
                            onClick={() => setExtraDraft([])}
                            className={`flex min-h-8 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${!extraDraft.length ? 'bg-brand-wash font-medium text-brand-strong' : 'text-body hover:bg-row-hover'}`}
                        >
                            {extra.allLabel || 'All'}
                            {!extraDraft.length && <Check className="size-3.5 text-brand-strong" />}
                        </button>
                        {extraOptions.map((option) => {
                            const picked = extraDraft.includes(option)
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setExtraDraft((current) => (picked
                                        ? current.filter((item) => item !== option)
                                        : [...current, option]).sort())}
                                    className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-body hover:bg-row-hover"
                                >
                                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${picked ? 'border-brand-700 bg-brand-700 text-white' : 'border-hairline-strong bg-surface'}`}>
                                        {picked && <Check className="size-3" />}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{option}</span>
                                </button>
                            )
                        })}
                        {!extraOptions.length && (
                            <p className="px-2 py-2 text-center text-xs text-subtle">Nothing to filter by.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    ) : null

    return <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`${label}: ${caption}`} title={caption} className={`${trigger} w-full justify-between ${anyApplied ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}>
                <span className="min-w-0 truncate">{caption}</span>
                <ChevronDown className="size-3.5 shrink-0" />
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
            <DropdownMenuLabel className="text-xs">{label} · select any</DropdownMenuLabel>
            {/* Search first, then the second filter (the year), then the list —
                so the menu reads in the order it is used: find, narrow, tick.
                The search box is always here rather than appearing past some
                option count: a control that comes and goes moves everything
                under it and costs the reader the order they just learnt. */}
            {options.length > 0 && (
                <div className="relative mb-1.5">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                        aria-label={`Search ${label.toLowerCase()}`}
                        placeholder="Search…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="h-8 w-full rounded-lg border border-hairline pl-7 pr-2 text-xs outline-none focus:border-brand"
                    />
                </div>
            )}
            {extraSection}
            {narrow && narrowOptions.length > 0 && (
                <div className="mb-1.5 border-b border-hairline px-2 pb-2">
                    <p className="mb-1.5 text-xs font-medium text-subtle">{narrow.label}</p>
                    <div className="flex flex-wrap gap-1">
                        {narrowOptions.map((year) => {
                            const picked = narrowYears.includes(year)
                            return (
                                <button
                                    key={year}
                                    type="button"
                                    aria-pressed={picked}
                                    onClick={() => setNarrowYears((current) => picked ? current.filter((y) => y !== year) : [...current, year])}
                                    className={`h-6 rounded-full border px-2 text-[11px] font-medium tabular-nums transition-colors ${picked ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'}`}
                                >
                                    {year}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
            {options.length === 0
                ? <p className="px-2 py-3 text-center text-xs text-subtle">{emptyLabel || `No ${label.toLowerCase()} available`}</p>
                : <>
                    <DropdownMenuCheckboxItem
                        checked={allShown ? true : shownPicked ? 'indeterminate' : false}
                        disabled={!shown.length}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={toggleAllShown}
                        className={selectAllItem}
                    >
                        <span className="flex-1 truncate">{search ? `Select all ${shown.length} matching` : `Select all ${label.toLowerCase()}`}</span>
                        {shownPicked > 0 && <span className="shrink-0 tabular-nums text-2xs text-subtle">{shownPicked}/{shown.length}</span>}
                    </DropdownMenuCheckboxItem>
                    <div className="max-h-56 overflow-y-auto">
                        {shown.map((option) => (
                            <DropdownMenuCheckboxItem
                                key={option.value}
                                checked={draft.includes(option.value)}
                                onSelect={(event) => event.preventDefault()}
                                onCheckedChange={(checked) => toggleDraft(option.value, checked === true)}
                                className={checkboxItem}
                            >
                                {displayLabel(option.label)}
                            </DropdownMenuCheckboxItem>
                        ))}
                        {!shown.length && <p className="px-2 py-3 text-center text-xs text-subtle">No match for “{search}”.</p>}
                    </div>
                </>}
            {/* Nothing is filtered until Done — so Clear empties the staged
                ticks, and Done commits both sections in one go. */}
            <div className="mt-1 flex items-center justify-end gap-2 border-t border-hairline px-2 pt-2">
                {(draft.length > 0 || extraDraft.length > 0) && (
                    <button
                        type="button"
                        onClick={() => { setDraft([]); setExtraDraft([]) }}
                        className="inline-flex h-7 items-center rounded-chip px-2 text-[11px] font-medium text-subtle hover:bg-row-hover hover:text-heading"
                    >
                        Clear
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => { onChange(draft); extra?.onChange(extraDraft); setOpen(false) }}
                    className="inline-flex h-7 items-center rounded-chip bg-brand-strong px-3 text-[11px] font-semibold text-white shadow-xs hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                    Done
                </button>
            </div>
        </DropdownMenuContent>
    </DropdownMenu>
}

export function MappingClientYearFilter({
    clients,
    value,
    onChange,
    years,
    pickedYears,
    onYearsChange,
    clientYears,
}: {
    clients: { value: string; label: string }[]
    value: string[]
    onChange: (value: string[]) => void
    /** Created years on offer. */
    years: string[]
    /** Created years ticked; empty means every year. Multi-select, like every
     *  other filter on this bar. */
    pickedYears: string[]
    onYearsChange: (years: string[]) => void
    clientYears?: Record<string, string>
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [yearOpen, setYearOpen] = useState(false)
    // Clients is a multi-select against a paginated, server-filtered list, so
    // ticking five clients used to mean five refetches. The picks are staged
    // here and committed by Done — one refetch per batch — which is the same
    // contract Client Management's filter dropdowns have. They re-sync from
    // props on open, so an outside Clear all shows up next time, and closing
    // without Done discards.
    const [draftClients, setDraftClients] = useState<string[]>(value)
    const [draftYears, setDraftYears] = useState<string[]>(pickedYears)
    useEffect(() => {
        if (!open) return
        setDraftClients(value)
        setDraftYears(pickedYears)
        setSearch('')
        setYearOpen(false)
        // `value`/`pickedYears` are the applied filter; re-reading them on
        // every open is the point, and adding them as deps would resync the
        // draft out from under an edit in progress.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])
    const selectedClients = clients.filter((client) => value.includes(client.value))
    // The list narrows by the STAGED years: the years and the clients are
    // picked in one visit, so the rows follow the picks that are on screen.
    const yearClients = draftYears.length
        ? clients.filter((client) => draftYears.includes(clientYears?.[client.value] || ''))
        : clients
    const shownClients = yearClients.filter((client) => client.label.toLowerCase().includes(search.toLowerCase()))
    // The trigger reports what is APPLIED, never the draft — a caption that
    // ran ahead of the table would claim a filter that isn't on yet.
    const caption = !value.length || value.length >= clients.length
        ? 'All clients'
        : value.length === 1
            ? selectedClients[0]?.label || 'All clients'
            : `${value.length} clients selected`
    const availableYears = [...new Set(years)].sort()
    const applyDraft = () => {
        onYearsChange(draftYears)
        onChange(draftClients)
        setOpen(false)
    }

    return (
        <Popover.Root open={open} onOpenChange={(next) => {
            setOpen(next)
            if (!next) {
                setSearch('')
                setYearOpen(false)
            }
        }}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label={`Client: ${caption}`}
                    title={caption}
                    className={`${trigger} w-full justify-between ${value.length || pickedYears.length ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}
                >
                    <span className="min-w-0 truncate">{caption}</span>
                    <ChevronDown className="size-3.5 shrink-0" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} collisionPadding={12} onFocusOutside={(event) => event.preventDefault()} className="pointer-events-auto z-popover w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-hairline bg-surface p-3 shadow-lg">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                        <input
                            autoFocus
                            aria-label="Search clients"
                            placeholder="Search clients..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="h-9 w-full rounded-control border border-hairline-strong bg-surface pl-8 pr-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                        />
                    </div>
                    <p className="mb-1.5 mt-3 text-xs text-subtle">Created year</p>
                    <button
                        type="button"
                        onClick={() => setYearOpen((isOpen) => !isOpen)}
                        aria-expanded={yearOpen}
                        className={`flex h-9 w-full items-center justify-between rounded-control border px-2.5 text-left text-xs outline-none transition-colors ${draftYears.length ? 'border-brand-500/30 bg-brand-wash font-medium text-brand-strong' : 'border-hairline-strong bg-surface text-body'} `}
                    >
                        <span className="min-w-0 truncate">{draftYears.length ? draftYears.join(', ') : 'All years'}</span>
                        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {yearOpen && <div className="mt-1 rounded-control border border-hairline-strong bg-surface">
                        <div className="max-h-28 overflow-y-auto p-1">
                            <button
                                type="button"
                                onClick={() => setDraftYears([])}
                                className={`flex min-h-8 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${!draftYears.length ? 'bg-brand-wash font-medium text-brand-strong' : 'text-body hover:bg-row-hover'}`}
                            >
                                All years
                                {!draftYears.length && <Check className="size-3.5 text-brand-strong" />}
                            </button>
                            {availableYears.map((option) => {
                                const picked = draftYears.includes(option)
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setDraftYears((current) => (picked
                                            ? current.filter((item) => item !== option)
                                            : [...current, option]).sort())}
                                        className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-body hover:bg-row-hover"
                                    >
                                        <span className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${picked ? 'border-brand-700 bg-brand-700 text-white' : 'border-hairline-strong bg-surface'}`}>
                                            {picked && <Check className="size-3" />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{option}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>}
                    <div className="mt-2 max-h-56 overflow-y-auto border-t border-hairline pt-1">
                        <button type="button" onClick={() => setDraftClients([])} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-body hover:bg-row-hover">
                            <span className="size-2 rounded-full bg-transparent" />
                            <span className="flex-1">All clients</span>
                            {!draftClients.length && <Check className="size-3.5 text-brand-strong" />}
                        </button>
                        {shownClients.map((client) => (
                            <button key={client.value} type="button" onClick={() => setDraftClients((current) => current.includes(client.value) ? current.filter((item) => item !== client.value) : [...current, client.value].sort())} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-body hover:bg-row-hover">
                                <span className={`flex size-4 items-center justify-center rounded-[4px] border ${draftClients.includes(client.value) ? 'border-brand-700 bg-brand-700 text-white' : 'border-hairline-strong bg-surface'}`}>
                                    {draftClients.includes(client.value) && <Check className="size-3" />}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{client.label}</span>
                            </button>
                        ))}
                        {!shownClients.length && <p className="px-2 py-3 text-center text-xs text-subtle">No matching clients.</p>}
                    </div>
                    {/* Nothing is filtered until Done — so Clear empties the
                        staged picks and Done is what commits, in one refetch
                        however many clients were ticked. */}
                    <div className="mt-2 flex items-center justify-end gap-2 border-t border-hairline pt-2">
                        {(draftYears.length > 0 || draftClients.length > 0) && (
                            <button
                                type="button"
                                onClick={() => { setDraftYears([]); setDraftClients([]) }}
                                className="inline-flex h-7 items-center rounded-chip px-2 text-[11px] font-medium text-subtle hover:bg-row-hover hover:text-heading"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={applyDraft}
                            className="inline-flex h-7 items-center rounded-chip bg-brand-strong px-3 text-[11px] font-semibold text-white shadow-xs hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                            Done
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
