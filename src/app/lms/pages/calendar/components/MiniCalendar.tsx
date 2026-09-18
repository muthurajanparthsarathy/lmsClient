"use client"

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Holiday, MONTHS, getMonthGrid, isoDate } from './types'

type Props = {
    month: Date
    holidays: Holiday[]
    onPrev: () => void
    onNext: () => void
    onDateClick: (iso: string) => void
    // Optional: highlight the currently focused day (week/day views) so the rail
    // mirrors what the main workspace is showing.
    focusedIso?: string | null
}

const MINI_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Flush (card-less) mini month for the left rail — the rail supplies the frame.
const NAV_BTN =
    'h-6 w-6 flex items-center justify-center rounded-chip text-subtle hover:bg-brand-wash hover:text-brand-strong transition-colors duration-150'

export default function MiniCalendar({ month, holidays, onPrev, onNext, onDateClick, focusedIso }: Props) {
    const holidaySet = new Set(holidays.map(h => h.date))
    const todayIso = isoDate(new Date())
    const cells = getMonthGrid(month)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-heading">
                    {MONTHS[month.getMonth()]} <span className="text-faint font-medium">{month.getFullYear()}</span>
                </p>
                <div className="flex items-center gap-0.5">
                    <button onClick={onPrev} aria-label="Previous month" className={NAV_BTN}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onNext} aria-label="Next month" className={NAV_BTN}>
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Day letters */}
            <div className="grid grid-cols-7 mb-1">
                {MINI_DAYS.map((d, i) => (
                    <div key={i} className={`text-center text-[9px] font-semibold ${
                        i === 0 || i === 6 ? 'text-danger-500/60' : 'text-faint'
                    }`}>{d}</div>
                ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />
                    const iso = isoDate(d)
                    const isHoliday = holidaySet.has(iso)
                    const isToday = todayIso === iso
                    const isFocused = focusedIso === iso
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                        <button
                            key={i}
                            onClick={() => onDateClick(iso)}
                            aria-label={iso}
                            className="relative flex items-center justify-center py-0.5"
                        >
                            <span className={`relative h-6 w-6 rounded-full flex items-center justify-center text-2xs font-semibold transition-colors duration-150
                                ${isFocused ? 'bg-brand-strong text-white'
                                  : isToday ? 'border border-brand-500 text-brand-strong'
                                  : isWeekend ? 'text-danger-500/80 hover:bg-brand-wash'
                                  : 'text-body hover:bg-brand-wash'}`}>
                                {d.getDate()}
                                {isHoliday && !isFocused && (
                                    <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${isToday ? 'bg-brand-500' : 'bg-brand-400'}`} />
                                )}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
