"use client"

import { useMemo } from 'react'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { Holiday, HolidayType, HOLIDAY_TYPES, isoDate, typeMeta } from './types'
import MiniCalendar from './MiniCalendar'
import EventBlock from './EventBlock'

// The persistent left rail: mini month, category quick-filters, today's
// holidays and an upcoming list. Counts come from the FULL holiday list; the
// mini-calendar dots and today/upcoming lists follow the filtered list so the
// rail always agrees with what the main workspace shows.
export default function CalendarRail({
    month,
    holidays,
    displayHolidays,
    typeFilter,
    onToggleType,
    onClearTypes,
    onPrevMonth,
    onNextMonth,
    onDateClick,
    onEventOpen,
    focusedIso,
}: {
    month: Date
    holidays: Holiday[]
    displayHolidays: Holiday[]
    typeFilter: HolidayType[]
    onToggleType: (t: HolidayType) => void
    onClearTypes: () => void
    onPrevMonth: () => void
    onNextMonth: () => void
    onDateClick: (iso: string) => void
    onEventOpen: (h: Holiday) => void
    focusedIso?: string | null
}) {
    const todayIso = isoDate(new Date())

    const typeCounts = useMemo(() => {
        const m = new Map<HolidayType, number>()
        holidays.forEach(h => m.set(h.type, (m.get(h.type) ?? 0) + 1))
        return m
    }, [holidays])

    const todays = useMemo(
        () => displayHolidays.filter(h => h.date === todayIso),
        [displayHolidays, todayIso]
    )
    const upcoming = useMemo(
        () => displayHolidays.filter(h => h.date > todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
        [displayHolidays, todayIso]
    )

    const anyFilter = typeFilter.length > 0

    return (
        <div className="p-4 space-y-5">
            {/* Mini month */}
            <MiniCalendar
                month={month}
                holidays={displayHolidays}
                onPrev={onPrevMonth}
                onNext={onNextMonth}
                onDateClick={onDateClick}
                focusedIso={focusedIso}
            />

            {/* Categories — click to quick-filter the calendar by type */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-faint">Categories</h3>
                    {anyFilter && (
                        <button type="button" onClick={onClearTypes} className="text-2xs font-semibold text-brand-strong hover:underline">
                            Show all
                        </button>
                    )}
                </div>
                <div className="space-y-0.5">
                    {HOLIDAY_TYPES.map(t => {
                        const count = typeCounts.get(t.value) ?? 0
                        const on = typeFilter.includes(t.value)
                        const dimmed = anyFilter && !on
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => onToggleType(t.value)}
                                className={`w-full flex items-center gap-2.5 h-8 px-2 rounded-chip text-left transition-colors duration-150 ${
                                    on ? 'bg-brand-wash' : 'hover:bg-row-hover'
                                } ${dimmed ? 'opacity-45' : ''}`}
                            >
                                <span className={`h-2.5 w-2.5 rounded-[4px] shrink-0 ${t.dot}`} />
                                <span className={`flex-1 min-w-0 truncate text-xs font-medium ${on ? 'text-brand-strong' : 'text-body'}`}>{t.label}</span>
                                <span className="text-2xs font-semibold tabular-nums text-faint">{count}</span>
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Today */}
            {todays.length > 0 && (
                <section>
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-faint mb-2">Today</h3>
                    <div className="space-y-1.5">
                        {todays.map(h => (
                            <EventBlock key={h.id} holiday={h} size="md" onOpen={onEventOpen} />
                        ))}
                    </div>
                </section>
            )}

            {/* Upcoming */}
            <section>
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-faint mb-2">Upcoming</h3>
                {upcoming.length === 0 ? (
                    <div className="flex flex-col items-center text-center rounded-tile border border-dashed border-hairline bg-canvas/50 px-3 py-6">
                        <CalendarClock size={20} className="text-faint mb-1.5" />
                        <p className="text-xs text-subtle">No upcoming holidays</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {upcoming.map(h => {
                            const meta = typeMeta(h.type)
                            const d = new Date(h.date + 'T00:00:00')
                            return (
                                <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => onEventOpen(h)}
                                    className="group w-full flex items-center gap-2.5 rounded-tile px-2 py-1.5 text-left hover:bg-row-hover transition-colors duration-150"
                                >
                                    <div className="flex flex-col items-center justify-center h-9 w-9 rounded-tile bg-canvas border border-hairline shrink-0">
                                        <span className="text-[9px] font-semibold uppercase text-faint leading-none">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                                        <span className="text-sm font-bold text-heading leading-none mt-0.5">{d.getDate()}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-heading truncate">{h.name}</p>
                                        <span className="inline-flex items-center gap-1 text-2xs text-subtle">
                                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                            {meta.label}
                                        </span>
                                    </div>
                                    <ChevronRight size={14} className="text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
