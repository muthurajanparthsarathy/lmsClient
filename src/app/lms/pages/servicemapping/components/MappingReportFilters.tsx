"use client"

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, ChevronDown, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'

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

export function MappingMultiFilter({ label, options, value, onChange, emptyLabel, placeholder }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (values: string[]) => void; emptyLabel?: string; placeholder?: string }) {
    const [search, setSearch] = useState('')
    // With nothing picked the trigger shows the caller's prompt when it gives
    // one. The workspace filter bar deliberately does not: an empty filter there
    // really does leave every row on screen, so "All clients" is the truth.
    // Every option ticked means the same thing as none — so say so, rather
    // than making the reader work out that "22 selected" out of 22 is
    // everything. Only the in-between counts get a number.
    const allPicked = options.length > 0 && value.length >= options.length
    const caption = allPicked ? `All ${label.toLowerCase()}`
        : value.length > 1 ? `${value.length} selected`
        : value.length ? displayLabel(options.find((option) => option.value === value[0])?.label || value[0])
        : (placeholder || `All ${label.toLowerCase()}`)
    // Select all acts on what the search is currently showing, not the whole
    // list. With a query typed, a control that also ticked the rows scrolled
    // out of sight would be worse than no control at all.
    const shown = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
    const picked = new Set(value)
    const shownPicked = shown.filter((option) => picked.has(option.value)).length
    const allShown = shown.length > 0 && shownPicked === shown.length
    const toggleAll = (checked: boolean) => {
        const inView = new Set(shown.map((option) => option.value))
        onChange(checked
            ? [...new Set([...value, ...inView])].sort()
            : value.filter((item) => !inView.has(item)))
    }
    return <DropdownMenu onOpenChange={() => setSearch('')}><DropdownMenuTrigger asChild><button type="button" aria-label={`${label}: ${caption}`} title={value.map((id) => displayLabel(options.find((option) => option.value === id)?.label || id)).join(', ') || caption} className={`${trigger} w-full justify-between ${value.length && !allPicked ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}><span className="min-w-0 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
            <DropdownMenuLabel className="text-xs">{label}{value.length ? ` · ${value.length} of ${options.length} selected` : ''}</DropdownMenuLabel>
            {options.length === 0
                ? <p className="px-2 py-3 text-center text-xs text-subtle">{emptyLabel || `No ${label.toLowerCase()} available`}</p>
                : <>
                    <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} className="mb-1 h-8 w-full rounded-lg border border-hairline px-2 text-xs outline-none focus:border-brand" />
                    <DropdownMenuCheckboxItem checked={allShown ? true : shownPicked ? 'indeterminate' : false} disabled={!shown.length} onSelect={(event) => event.preventDefault()} onCheckedChange={toggleAll} className={selectAllItem}>
                        <span className="flex-1 truncate">{search ? `Select all ${shown.length} matching` : `Select all ${label.toLowerCase()}`}</span>
                        {shownPicked > 0 && <span className="shrink-0 tabular-nums text-2xs text-subtle">{shownPicked}/{shown.length}</span>}
                    </DropdownMenuCheckboxItem>
                    <div className="max-h-56 overflow-y-auto">
                        {shown.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={picked.has(option.value)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange((checked ? [...value, option.value] : value.filter((item) => item !== option.value)).sort())} className={checkboxItem}>{displayLabel(option.label)}</DropdownMenuCheckboxItem>)}
                        {!shown.length && <p className="px-2 py-3 text-center text-xs text-subtle">No match for “{search}”.</p>}
                    </div>
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
        <Popover.Trigger asChild><button type="button" aria-label="Service providing year" className={`${trigger} ${from || to ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : ''}`}><CalendarDays className="size-3.5 shrink-0" /><span className="flex-1 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" /></button></Popover.Trigger>
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
 *  seam showing. */
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
