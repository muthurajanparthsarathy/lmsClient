"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    Clock,
} from 'lucide-react'
import {
    addDays,
    addMonths,
    addYears,
    format,
    getDay,
    getDaysInMonth,
    isAfter,
    isBefore,
    isValid,
    parse,
    startOfDay,
    startOfMonth,
} from 'date-fns'

export type DateTimePickerProps = {
    value: string            // ISO 8601 or '' when unset
    onChange: (iso: string) => void
    minIso?: string          // days before this are disabled in the grid
    maxIso?: string          // days after this are disabled
    placeholder?: string     // default 'dd-MMM-yyyy HH:mm:ss'
    error?: boolean          // paints the input border red
    disabled?: boolean
    ariaLabel: string
}

const DISPLAY_FMT = 'dd-MMM-yyyy HH:mm:ss'
const DATE_ONLY_FMT = 'dd-MMM-yyyy'
const POP_WIDTH = 272
// Estimated worst-case popup height (six-row month), used only to decide
// whether to flip above the input near the bottom of the viewport.
const POP_HEIGHT = 360
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i))
const SIXTY = Array.from({ length: 60 }, (_, i) => pad2(i))

// A native <select>'s option list is drawn by the browser at whatever height
// the SCREEN allows — it sprawls far outside the popup and cannot be styled.
// This replaces it with a list that opens UPWARD over the calendar grid, capped
// well inside the popup's own height, so the whole interaction stays within the
// picker.
function TimeSelect({
    value,
    options,
    onChange,
    ariaLabel,
}: {
    value: string
    options: string[]
    onChange: (v: string) => void
    ariaLabel: string
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (rootRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [open])

    // Open ON the current value, the way a native select does. Scrolled by
    // setting scrollTop directly — scrollIntoView would also scroll the page.
    useLayoutEffect(() => {
        if (!open || !listRef.current) return
        const list = listRef.current
        const el = list.querySelector<HTMLElement>('[data-selected="true"]')
        if (el) list.scrollTop = el.offsetTop - (list.clientHeight - el.offsetHeight) / 2
    }, [open])

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="h-8 w-[56px] px-1.5 text-xs text-gray-800 border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:border-[#F97316] focus:ring-2 focus:ring-orange-500/15 focus:outline-none transition-all flex items-center justify-between gap-1"
            >
                {value}
                <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    ref={listRef}
                    role="listbox"
                    aria-label={`${ariaLabel} options`}
                    className="absolute bottom-full mb-1 left-0 w-[56px] max-h-[190px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-10"
                >
                    {options.map((o) => (
                        <button
                            key={o}
                            type="button"
                            role="option"
                            aria-selected={o === value}
                            data-selected={o === value}
                            onClick={() => { onChange(o); setOpen(false) }}
                            className={`w-full px-2 py-1 text-xs text-left ${
                                o === value
                                    ? 'bg-[#FFF3EA] text-[#C2540F] font-semibold'
                                    : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {o}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function DateTimePicker({
    value,
    onChange,
    minIso,
    maxIso,
    placeholder = DISPLAY_FMT,
    error,
    disabled,
    ariaLabel,
}: DateTimePickerProps) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
    // While the user is typing we show their draft verbatim; committing (blur or
    // Enter) either emits a parsed value or discards the draft, so the input can
    // never be left displaying text that disagrees with the controlled value.
    const [draft, setDraft] = useState<string | null>(null)
    const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()))
    const anchorRef = useRef<HTMLDivElement>(null)
    const popRef = useRef<HTMLDivElement>(null)

    const valueDate = useMemo(() => {
        if (!value) return null
        const d = new Date(value)
        return isValid(d) ? d : null
    }, [value])

    // Two granularities on purpose. The DAY bounds drive the grid — a day that
    // merely CONTAINS the min instant must stay clickable. The INSTANT bounds
    // drive what is emitted: the time rides along with every pick, so a value on
    // the boundary day can still overshoot the other picker by hours unless the
    // full timestamp is clamped.
    const minInstant = useMemo(() => {
        if (!minIso) return null
        const d = new Date(minIso)
        return isValid(d) ? d : null
    }, [minIso])
    const maxInstant = useMemo(() => {
        if (!maxIso) return null
        const d = new Date(maxIso)
        return isValid(d) ? d : null
    }, [maxIso])
    const minDay = useMemo(() => (minInstant ? startOfDay(minInstant) : null), [minInstant])
    const maxDay = useMemo(() => (maxInstant ? startOfDay(maxInstant) : null), [maxInstant])

    const dayDisabled = (d: Date) => {
        const day = startOfDay(d)
        if (minDay && isBefore(day, minDay)) return true
        if (maxDay && isAfter(day, maxDay)) return true
        return false
    }

    const displayed = draft ?? (valueDate ? format(valueDate, DISPLAY_FMT) : '')

    const commitDraft = () => {
        if (draft === null) return
        const text = draft.trim()
        setDraft(null)
        if (text === '') { onChange(''); return }
        let parsed = parse(text, DISPLAY_FMT, new Date())
        if (!isValid(parsed)) parsed = parse(text, DATE_ONLY_FMT, new Date())
        // Unparseable text reverts silently: clearing the draft above makes the
        // input fall back to rendering the last valid controlled value.
        if (!isValid(parsed)) return
        onChange(parsed.toISOString())
    }

    // Steppers and time dropdowns need a base date even before any value has
    // been chosen; today-at-midnight matches what picking a day would produce.
    const baseDate = () => valueDate ?? startOfDay(new Date())

    // Clamp the FULL instant, not just the day: the time comes along with every
    // pick, and preserving it across a day clamp still let a value on the
    // boundary day run past the bound by hours (cutoff 30-Nov 23:00 against an
    // end of 30-Nov 10:00). Overshooting now lands exactly ON the bound. Every
    // path that derives a date from the current value applies this — a dropdown
    // starting from an empty value bases itself on TODAY, which can lie outside
    // [min, max] entirely.
    const clampToRange = (d: Date): Date => {
        if (minInstant && d.getTime() < minInstant.getTime()) return new Date(minInstant)
        if (maxInstant && d.getTime() > maxInstant.getTime()) return new Date(maxInstant)
        return d
    }

    const stepDay = (delta: number) => {
        const next = clampToRange(addDays(baseDate(), delta))
        // The grid only reads the value when the popup OPENS, so a step that
        // crosses a month boundary while it is open must walk the view with it —
        // otherwise the calendar keeps showing a month with no selection in it.
        if (open) setViewMonth(startOfMonth(next))
        onChange(next.toISOString())
    }

    const pickDay = (dayNum: number) => {
        const b = baseDate()
        // Clamped like every other path: the grid only blocks whole days, so
        // picking the boundary day with a carried-over time could still land
        // beyond the bound's own time of day.
        const next = clampToRange(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum,
            b.getHours(), b.getMinutes(), b.getSeconds()))
        onChange(next.toISOString())
    }

    const setTimePart = (part: 'h' | 'm' | 's', raw: string) => {
        const n = parseInt(raw, 10)
        const b = baseDate()
        const next = clampToRange(new Date(b.getFullYear(), b.getMonth(), b.getDate(),
            part === 'h' ? n : b.getHours(),
            part === 'm' ? n : b.getMinutes(),
            part === 's' ? n : b.getSeconds()))
        onChange(next.toISOString())
    }

    const openPopup = () => {
        if (disabled) return
        setViewMonth(startOfMonth(valueDate ?? new Date()))
        setOpen(true)
    }

    // Measured before paint so the popup never flashes at a stale position.
    // Re-measured on month navigation: a 5-row month is ~40px shorter than a
    // 6-row one, and a flipped popup anchored by an estimate would hover the
    // wrong distance above the input and jump as the user pages months.
    useLayoutEffect(() => {
        if (!open || !anchorRef.current) return
        const r = anchorRef.current.getBoundingClientRect()
        const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_WIDTH - 8))
        const below = r.bottom + 6
        // The popup is mounted by the time this runs (refs attach before layout
        // effects), so the real height is available; the estimate only covers
        // the first frame if it is not.
        const height = popRef.current?.getBoundingClientRect().height || POP_HEIGHT
        // Flip above the input when the popup would run off the bottom edge.
        const top = below + height > window.innerHeight && r.top - height - 6 > 0
            ? r.top - height - 6
            : below
        setPos({ top, left })
    }, [open, viewMonth])

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node
            if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return
            setOpen(false)
        }
        // Capture phase so Escape is consumed before any ancestor (modal, panel)
        // sees it — closing the picker must never also close its container.
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            setOpen(false)
        }
        // Fixed positioning does not follow the page, so scrolling closes the
        // popup rather than leaving it stranded away from its input.
        const onScroll = () => setOpen(false)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey, true)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
        }
    }, [open])

    // The grid shows leading/trailing blanks, not adjacent-month dates.
    const cells = useMemo(() => {
        const lead = getDay(startOfMonth(viewMonth))
        const dim = getDaysInMonth(viewMonth)
        const out: (number | null)[] = Array.from({ length: lead }, () => null)
        for (let d = 1; d <= dim; d++) out.push(d)
        while (out.length % 7 !== 0) out.push(null)
        return out
    }, [viewMonth])

    const today = startOfDay(new Date())
    const selectedDay = valueDate ? startOfDay(valueDate) : null

    const headBtnCls =
        'h-7 w-7 inline-flex items-center justify-center rounded-lg text-gray-500 ' +
        'hover:bg-[#FFF7F1] hover:text-[#C2540F] transition-colors'

    const popup = open && pos ? createPortal(
        <div
            ref={popRef}
            role="dialog"
            aria-label={`${ariaLabel} calendar`}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_WIDTH }}
            className="z-[100] rounded-xl border border-[#F0EFEE] bg-white shadow-xl p-3"
        >
            <div className="flex items-center gap-0.5 mb-1.5">
                <button type="button" aria-label="Previous year" className={headBtnCls}
                    onClick={() => setViewMonth((m) => addYears(m, -1))}>
                    <ChevronsLeft size={15} />
                </button>
                <button type="button" aria-label="Previous month" className={headBtnCls}
                    onClick={() => setViewMonth((m) => addMonths(m, -1))}>
                    <ChevronLeft size={15} />
                </button>
                <div className="flex-1 text-center text-[13px] font-semibold text-gray-800">
                    {format(viewMonth, 'MMM yyyy')}
                </div>
                <button type="button" aria-label="Next month" className={headBtnCls}
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}>
                    <ChevronRight size={15} />
                </button>
                <button type="button" aria-label="Next year" className={headBtnCls}
                    onClick={() => setViewMonth((m) => addYears(m, 1))}>
                    <ChevronsRight size={15} />
                </button>
            </div>

            <div className="grid grid-cols-7">
                {WEEKDAYS.map((w, i) => (
                    <div key={w}
                        className={`h-7 flex items-center justify-center text-[11px] font-medium ${
                            i === 0 || i === 6 ? 'text-[#DC2626]' : 'text-gray-500'
                        }`}>
                        {w}
                    </div>
                ))}
                {cells.map((dayNum, i) => {
                    if (dayNum === null) return <div key={`c${i}`} className="h-9" />
                    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum)
                    const isWeekend = i % 7 === 0 || i % 7 === 6
                    const isToday = d.getTime() === today.getTime()
                    const isSelected = selectedDay !== null && d.getTime() === selectedDay.getTime()
                    const isDisabled = dayDisabled(d)
                    return (
                        <div key={`c${i}`} className="h-9 flex items-center justify-center">
                            <button
                                type="button"
                                disabled={isDisabled}
                                onClick={() => pickDay(dayNum)}
                                aria-label={format(d, 'dd MMM yyyy')}
                                className={`relative h-8 w-8 rounded-full text-[12.5px] transition-colors ${
                                    isDisabled
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-[#FFF3EA] border border-[#FFD9BC] text-[#C2540F] font-semibold'
                                            : `${isToday ? 'border border-[#F97316] ' : ''}${
                                                isWeekend ? 'text-[#DC2626]' : 'text-gray-700'
                                            } hover:bg-[#FFF7F1]`
                                }`}
                            >
                                {dayNum}
                                {isToday && !isDisabled && (
                                    <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#F97316]" />
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>

            <div className="mt-2 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
                <Clock size={14} className="text-gray-400 flex-shrink-0" />
                <TimeSelect ariaLabel="Hours" options={HOURS}
                    value={pad2(baseDate().getHours())}
                    onChange={(v) => setTimePart('h', v)} />
                <TimeSelect ariaLabel="Minutes" options={SIXTY}
                    value={pad2(baseDate().getMinutes())}
                    onChange={(v) => setTimePart('m', v)} />
                <TimeSelect ariaLabel="Seconds" options={SIXTY}
                    value={pad2(baseDate().getSeconds())}
                    onChange={(v) => setTimePart('s', v)} />
            </div>
        </div>,
        document.body
    ) : null

    return (
        <div
            ref={anchorRef}
            className={`flex items-center h-9 rounded-lg border bg-white transition-all ${
                error
                    ? 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15'
                    : 'border-gray-200 hover:border-gray-300 focus-within:border-[#F97316] focus-within:ring-2 focus-within:ring-orange-500/15'
            } ${disabled ? 'bg-gray-50' : ''}`}
        >
            <input
                type="text"
                aria-label={ariaLabel}
                value={displayed}
                placeholder={placeholder}
                disabled={disabled}
                onFocus={() => setDraft(displayed)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                    // Enter commits the typed text; the picker may sit inside a
                    // form, so it must never trigger a submit.
                    if (e.key === 'Enter') { e.preventDefault(); commitDraft() }
                }}
                className="flex-1 min-w-0 h-full px-3 text-sm text-gray-800 bg-transparent rounded-l-lg outline-none border-none focus:ring-0 disabled:text-gray-400 placeholder:text-gray-400"
            />
            <div className="flex flex-col justify-center flex-shrink-0 pr-0.5">
                <button type="button" aria-label="Next day" disabled={disabled}
                    onClick={() => stepDay(1)}
                    className="h-4 w-5 inline-flex items-center justify-center text-gray-400 hover:text-[#C2540F] disabled:text-gray-300 transition-colors">
                    <ChevronUp size={12} />
                </button>
                <button type="button" aria-label="Previous day" disabled={disabled}
                    onClick={() => stepDay(-1)}
                    className="h-4 w-5 inline-flex items-center justify-center text-gray-400 hover:text-[#C2540F] disabled:text-gray-300 transition-colors">
                    <ChevronDown size={12} />
                </button>
            </div>
            <button
                type="button"
                aria-label={`Open ${ariaLabel} calendar`}
                aria-expanded={open}
                disabled={disabled}
                onClick={() => (open ? setOpen(false) : openPopup())}
                className="h-full px-2.5 inline-flex items-center justify-center rounded-r-lg text-gray-400 hover:text-[#C2540F] hover:bg-[#FFF7F1] disabled:text-gray-300 disabled:hover:bg-transparent transition-colors flex-shrink-0"
            >
                <CalendarIcon size={15} />
            </button>
            {popup}
        </div>
    )
}
