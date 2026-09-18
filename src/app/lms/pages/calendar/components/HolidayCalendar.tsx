"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Holiday, getMonthGrid, isoDate } from './types'
import EventBlock from './EventBlock'

type ViewFilter = 'all' | 'holidays' | 'working'

type Props = {
    month: Date
    holidays: Holiday[]
    viewFilter: ViewFilter
    onDateClick: (iso: string) => void
    onBulkSelect: (dates: string[]) => void
    onEventOpen: (h: Holiday) => void
    disabled?: boolean
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function buildRange(a: string, b: string): string[] {
    const [start, end] = [a, b].sort()
    const dates: string[] = []
    const cur = new Date(start + 'T00:00:00')
    const endD = new Date(end + 'T00:00:00')
    while (cur <= endD) {
        dates.push(isoDate(new Date(cur)))
        cur.setDate(cur.getDate() + 1)
    }
    return dates
}

// Hero month grid — fills the entire main workspace edge-to-edge. The month
// label + navigation now live in the command bar and the legend in the rail, so
// this component is purely the grid. Drag-select (click a day to add, drag a
// range to bulk-add) is unchanged from the original.
export default function HolidayCalendar({
    month, holidays, viewFilter, onDateClick, onBulkSelect, onEventOpen, disabled,
}: Props) {
    const holidayMap = new Map(holidays.map(h => [h.date, h] as const))
    const today = new Date()
    const todayIso = isoDate(today)
    const todayDow = today.getDay()
    const isCurrentMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
    const cells = getMonthGrid(month)

    // ── Drag selection (preserved verbatim) ──
    const mouseDown = useRef(false)
    const dragStartRef = useRef<string | null>(null)
    const dragEndRef = useRef<string | null>(null)
    const onDateClickRef = useRef(onDateClick)
    const onBulkSelectRef = useRef(onBulkSelect)
    useEffect(() => { onDateClickRef.current = onDateClick }, [onDateClick])
    useEffect(() => { onBulkSelectRef.current = onBulkSelect }, [onBulkSelect])

    const [dragStart, setDragStart] = useState<string | null>(null)
    const [dragEnd, setDragEnd] = useState<string | null>(null)

    const dragRange = useMemo(() => {
        if (!dragStart) return new Set<string>()
        return new Set(buildRange(dragStart, dragEnd || dragStart))
    }, [dragStart, dragEnd])

    useEffect(() => {
        const handleUp = () => {
            if (!mouseDown.current) return
            mouseDown.current = false
            const start = dragStartRef.current
            const end = dragEndRef.current || start
            if (start && end) {
                const dates = buildRange(start, end)
                if (dates.length === 1) onDateClickRef.current(dates[0])
                else if (dates.length > 1) onBulkSelectRef.current(dates)
            }
            dragStartRef.current = null
            dragEndRef.current = null
            setDragStart(null)
            setDragEnd(null)
        }
        window.addEventListener('mouseup', handleUp)
        return () => window.removeEventListener('mouseup', handleUp)
    }, [])

    return (
        <div className="h-full flex flex-col select-none bg-surface">
            {/* Weekday header row */}
            <div className="grid grid-cols-7 border-b border-hairline shrink-0">
                {WEEK_DAYS.map((d, i) => {
                    const isTodayCol = isCurrentMonth && i === todayDow
                    const isWeekendCol = i === 0 || i === 6
                    return (
                        <div key={d} className="relative px-2 py-2.5 text-center">
                            <span className={`text-2xs font-semibold uppercase tracking-wider ${
                                isTodayCol ? 'text-brand-strong' : isWeekendCol ? 'text-danger-500/70' : 'text-faint'
                            }`}>
                                <span className="hidden sm:inline">{d}</span>
                                <span className="sm:hidden">{d.slice(0, 3)}</span>
                            </span>
                            {isTodayCol && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-500" />}
                        </div>
                    )
                })}
            </div>

            {/* Cells — a 6-row grid that stretches to fill the workspace height */}
            <div className={`grid grid-cols-7 grid-rows-6 flex-1 min-h-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {cells.map((d, i) => {
                    const colStart = i % 7 === 0
                    if (!d) return (
                        <div key={i} className={`border-b border-hairline bg-canvas/60 ${colStart ? '' : 'border-l'}`} />
                    )

                    const iso = isoDate(d)
                    const holiday = holidayMap.get(iso)
                    const isToday = todayIso === iso
                    const isSunday = d.getDay() === 0
                    const isWeekend = isSunday || d.getDay() === 6
                    const inDrag = dragRange.has(iso)

                    const isDimmed =
                        (viewFilter === 'holidays' && !holiday) ||
                        (viewFilter === 'working' && (!!holiday || isSunday))

                    return (
                        <div
                            key={i}
                            onMouseDown={e => {
                                e.preventDefault()
                                mouseDown.current = true
                                dragStartRef.current = iso
                                dragEndRef.current = iso
                                setDragStart(iso)
                                setDragEnd(iso)
                            }}
                            onMouseEnter={() => {
                                if (mouseDown.current) {
                                    dragEndRef.current = iso
                                    setDragEnd(iso)
                                }
                            }}
                            aria-label={iso}
                            className={`group relative border-b border-hairline p-1.5 flex flex-col gap-1 cursor-pointer overflow-hidden transition-colors duration-150 min-h-0
                                ${colStart ? '' : 'border-l'}
                                ${inDrag ? 'bg-brand-wash ring-1 ring-inset ring-brand-300'
                                    : isToday ? 'bg-brand-wash/50'
                                    : isWeekend ? 'bg-canvas/40 hover:bg-row-hover'
                                    : 'hover:bg-row-hover'}
                                ${isDimmed ? 'opacity-25' : ''}`}
                        >
                            {/* Date number + hover Add affordance */}
                            <div className="flex items-center justify-between">
                                <span className={`relative h-6 min-w-[24px] px-1 rounded-full inline-flex items-center justify-center text-xs font-semibold transition-colors duration-150
                                    ${isToday ? 'bg-brand-strong text-white'
                                        : inDrag ? 'text-brand-strong font-bold'
                                        : isWeekend ? 'text-danger-500/90'
                                        : 'text-body'}`}>
                                    {d.getDate()}
                                </span>
                                {!inDrag && !holiday && (
                                    <span className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-chip border border-brand-300 bg-brand-wash text-2xs font-semibold text-brand-strong opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <Plus size={10} strokeWidth={2.6} /> Add
                                    </span>
                                )}
                            </div>

                            {/* The day's holiday (max one per date) */}
                            {holiday && (
                                <div className="min-w-0">
                                    <EventBlock holiday={holiday} size="sm" onOpen={onEventOpen} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
