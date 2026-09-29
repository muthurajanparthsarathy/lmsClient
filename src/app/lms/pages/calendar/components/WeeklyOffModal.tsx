"use client"

import { useState, useEffect, useMemo } from 'react'
import { CalendarRange, Check, Trash2, Info } from 'lucide-react'
import ModalShell from './ModalShell'
import {
    FieldLabel, NameErrorRow, TypeChipGrid, DurationSegmented,
    INPUT_CLS, INPUT_INVALID_CLS, BTN_PRIMARY, BTN_SECONDARY,
} from './HolidayFormFields'
import { Holiday, HolidayDuration, HolidayType, DAY_ABBR, isoDate } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Off — "every Saturday is a holiday" in one action instead of 52 clicks.
//
// The modal only COMPUTES dates; the page's existing upsert/delete paths do the
// writing, so a weekly off is stored as ordinary per-date holidays. That keeps
// every other surface (grid, agenda, student calendar, reports) working with no
// notion of a "recurring rule" — and any single Saturday can still be edited or
// deleted on its own afterwards.
//
// Scoped to ONE year, the year the workspace currently has loaded. The page
// only holds that window of holidays, and the "skip dates that already have a
// holiday" check below is only trustworthy for dates inside it — the server
// merges by date, so marking outside the window could silently overwrite a
// festival that happens to fall on a Saturday.
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'mark' | 'remove'
// Which occurrences of the weekday inside each month. "2nd & 4th Saturday" is
// the common pattern for Indian institutes, so it gets a first-class option.
type WeekPattern = 'all' | '2-4' | '1-3'

const PATTERNS: { v: WeekPattern; l: string }[] = [
    { v: 'all', l: 'Every week' },
    { v: '2-4', l: '2nd & 4th' },
    { v: '1-3', l: '1st & 3rd' },
]

const DEFAULT_NAME = 'Weekly Off'
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Remove is destructive, so its confirm button reads red rather than brand.
const BTN_DANGER =
    'flex items-center gap-1.5 h-9 px-4 rounded-control bg-danger-700 text-white text-xs ' +
    'font-semibold shadow-xs hover:bg-danger-600 disabled:opacity-50 disabled:hover:bg-danger-700 ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/30'

// 1-based occurrence of this weekday within its month (1st Saturday, 2nd …).
const nthInMonth = (d: Date) => Math.ceil(d.getDate() / 7)

function matchingDates(from: string, to: string, weekdays: number[], pattern: WeekPattern): string[] {
    if (!from || !to || from > to || !weekdays.length) return []
    const out: string[] = []
    const cur = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    while (cur <= end) {
        if (weekdays.includes(cur.getDay())) {
            const n = nthInMonth(cur)
            if (pattern === 'all' || (pattern === '2-4' && (n === 2 || n === 4)) || (pattern === '1-3' && (n === 1 || n === 3))) {
                out.push(isoDate(cur))
            }
        }
        cur.setDate(cur.getDate() + 1)
    }
    return out
}

type Props = {
    open: boolean
    year: number
    holidays: Holiday[]
    onClose: () => void
    onMark: (dates: string[], data: { name: string; type: HolidayType; duration: HolidayDuration; note: string }) => void
    onRemove: (dates: string[]) => void
}

export default function WeeklyOffModal({ open, year, holidays, onClose, onMark, onRemove }: Props) {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const [mode, setMode] = useState<Mode>('mark')
    const [weekdays, setWeekdays] = useState<number[]>([6])   // Saturday preselected — the usual ask
    const [pattern, setPattern] = useState<WeekPattern>('all')
    const [from, setFrom] = useState(yearStart)
    const [to, setTo] = useState(yearEnd)
    const [name, setName] = useState(DEFAULT_NAME)
    const [type, setType] = useState<HolidayType>('institute')
    const [duration, setDuration] = useState<HolidayDuration>('full')
    const [nameTouched, setNameTouched] = useState(false)

    // Fresh form on every open, and whenever the loaded year changes under it.
    useEffect(() => {
        if (!open) return
        setMode('mark'); setWeekdays([6]); setPattern('all')
        setFrom(yearStart); setTo(yearEnd)
        setName(DEFAULT_NAME); setType('institute'); setDuration('full'); setNameTouched(false)
    }, [open, yearStart, yearEnd])

    const toggleDay = (d: number) =>
        setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())

    const byDate = useMemo(() => {
        const m = new Map<string, Holiday>()
        holidays.forEach(h => m.set(h.date, h))
        return m
    }, [holidays])

    const candidates = useMemo(() => matchingDates(from, to, weekdays, pattern), [from, to, weekdays, pattern])

    // Mark: never overwrite a day that already carries a holiday (a festival on
    // a Saturday must stay a festival). Remove: only clear days whose holiday
    // has this exact name, so removing "Weekly Off" can't take a festival with it.
    const nameKey = name.trim().toLowerCase()
    const { toMark, skipped, toRemove } = useMemo(() => {
        const toMark: string[] = []
        const toRemove: string[] = []
        let skipped = 0
        for (const d of candidates) {
            const existing = byDate.get(d)
            if (!existing) toMark.push(d)
            else {
                skipped++
                if ((existing.name || '').trim().toLowerCase() === nameKey) toRemove.push(d)
            }
        }
        return { toMark, skipped, toRemove }
    }, [candidates, byDate, nameKey])

    const nameOk = nameKey.length > 0
    const rangeOk = Boolean(from && to && from <= to)
    const count = mode === 'mark' ? toMark.length : toRemove.length
    const canSubmit = nameOk && rangeOk && weekdays.length > 0 && count > 0

    const dayWord = weekdays.length === 1 ? `${DAY_FULL[weekdays[0]]}s` : 'days'

    const submit = () => {
        if (!canSubmit) return
        if (mode === 'mark') onMark(toMark, { name: name.trim(), type, duration, note: '' })
        else onRemove(toRemove)
    }

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            icon={<CalendarRange size={17} className="text-brand-strong" />}
            eyebrow={`Weekly Off · ${year}`}
            title="Mark a weekday as holiday"
            subtitle={<p className="text-xs text-subtle">Pick a day once — every matching date in the range is marked</p>}
            footer={
                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className={mode === 'mark' ? BTN_PRIMARY : BTN_DANGER}
                    >
                        {mode === 'mark'
                            ? <><Check size={14} /> Mark {count} {count === 1 ? 'Date' : 'Dates'}</>
                            : <><Trash2 size={14} /> Remove {count} {count === 1 ? 'Date' : 'Dates'}</>}
                    </button>
                </div>
            }
        >
            <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Mark / Remove — Remove is the undo for a weekly off already applied */}
                <div className="flex rounded-control overflow-hidden border border-hairline-strong">
                    {([['mark', 'Mark as holiday'], ['remove', 'Remove weekly off']] as [Mode, string][]).map(([v, l]) => (
                        <button
                            key={v} type="button" onClick={() => setMode(v)}
                            className={`flex-1 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                                mode === v ? 'bg-brand-wash text-brand-strong' : 'bg-surface text-subtle hover:bg-row-hover'
                            }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                <div>
                    <FieldLabel required>Day of the week</FieldLabel>
                    <div className="grid grid-cols-7 gap-1">
                        {DAY_ABBR.map((d, i) => {
                            const on = weekdays.includes(i)
                            return (
                                <button
                                    key={d} type="button" onClick={() => toggleDay(i)} aria-pressed={on}
                                    className={`h-9 rounded-control border text-xs font-semibold transition-colors duration-150 ${
                                        on ? 'bg-brand-strong border-brand-strong text-white' : 'bg-surface border-hairline-strong text-body hover:bg-row-hover'
                                    }`}
                                >
                                    {d}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div>
                    <FieldLabel>Which weeks</FieldLabel>
                    <div className="flex rounded-control overflow-hidden border border-hairline-strong">
                        {PATTERNS.map(p => (
                            <button
                                key={p.v} type="button" onClick={() => setPattern(p.v)}
                                className={`flex-1 py-1.5 text-xs font-medium transition-colors duration-150 ${
                                    pattern === p.v ? 'bg-brand-wash text-brand-strong' : 'bg-surface text-subtle hover:bg-row-hover'
                                }`}
                            >
                                {p.l}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <FieldLabel>From</FieldLabel>
                        <input type="date" value={from} min={yearStart} max={yearEnd} onChange={e => setFrom(e.target.value)} className={`${INPUT_CLS} ${rangeOk ? '' : INPUT_INVALID_CLS}`} />
                    </div>
                    <div>
                        <FieldLabel>To</FieldLabel>
                        <input type="date" value={to} min={yearStart} max={yearEnd} onChange={e => setTo(e.target.value)} className={`${INPUT_CLS} ${rangeOk ? '' : INPUT_INVALID_CLS}`} />
                    </div>
                </div>

                <div>
                    <FieldLabel required>{mode === 'mark' ? 'Holiday name' : 'Remove holidays named'}</FieldLabel>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => setNameTouched(true)}
                        onKeyDown={e => { if (e.key === 'Enter') submit() }}
                        placeholder="e.g. Weekly Off"
                        className={`${INPUT_CLS} ${nameTouched && !nameOk ? INPUT_INVALID_CLS : ''}`}
                    />
                    {nameTouched && !nameOk && <NameErrorRow />}
                </div>

                {mode === 'mark' && (
                    <>
                        <div>
                            <FieldLabel>Type</FieldLabel>
                            <TypeChipGrid value={type} onChange={setType} />
                        </div>
                        <div>
                            <FieldLabel>Duration</FieldLabel>
                            <DurationSegmented value={duration} onChange={setDuration} />
                        </div>
                    </>
                )}

                {/* Live summary — says exactly what the button will do before it does it */}
                <div className="flex items-start gap-2 rounded-control border border-hairline bg-canvas px-3 py-2.5">
                    <Info size={14} className="text-brand-strong shrink-0 mt-0.5" />
                    <p className="text-xs text-body leading-relaxed">
                        {weekdays.length === 0 ? 'Pick at least one day of the week.'
                            : !rangeOk ? 'The From date must be on or before the To date.'
                            : mode === 'mark' ? (
                                <>
                                    <span className="font-semibold tabular-nums">{toMark.length}</span> {dayWord} will be marked as holiday.
                                    {skipped > 0 && <> <span className="font-semibold tabular-nums">{skipped}</span> already {skipped === 1 ? 'has' : 'have'} a holiday and will be left as is.</>}
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold tabular-nums">{toRemove.length}</span> {dayWord} named “{name.trim() || '…'}” will be cleared. Other holidays on these days are not touched.
                                </>
                            )}
                    </p>
                </div>
            </div>
        </ModalShell>
    )
}
