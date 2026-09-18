"use client"

import { Plus } from 'lucide-react'
import { Holiday, isoDate } from './types'
import EventBlock from './EventBlock'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Week view — the seven days of the week containing `focusedDate`, each a tall
// column. All-day holidays render as a full event block; empty days offer an
// add affordance on hover. Same click/add + event/open model as the month grid.
export default function WeekView({
    focusedDate,
    holidays,
    onDateClick,
    onEventOpen,
}: {
    focusedDate: Date
    holidays: Holiday[]
    onDateClick: (iso: string) => void
    onEventOpen: (h: Holiday) => void
}) {
    const holidayMap = new Map(holidays.map(h => [h.date, h] as const))
    const todayIso = isoDate(new Date())

    const start = new Date(focusedDate)
    start.setDate(focusedDate.getDate() - focusedDate.getDay()) // back to Sunday
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return d
    })

    return (
        <div className="h-full flex flex-col bg-surface">
            <div className="grid grid-cols-7 flex-1 min-h-0">
                {days.map((d, i) => {
                    const iso = isoDate(d)
                    const holiday = holidayMap.get(iso)
                    const isToday = iso === todayIso
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                        <div
                            key={iso}
                            onClick={() => { if (!holiday) onDateClick(iso) }}
                            className={`group flex flex-col min-h-0 cursor-pointer transition-colors duration-150 ${i > 0 ? 'border-l border-hairline' : ''} ${
                                isToday ? 'bg-brand-wash/40' : isWeekend ? 'bg-canvas/40 hover:bg-row-hover' : 'hover:bg-row-hover'
                            }`}
                        >
                            {/* Column header */}
                            <div className={`shrink-0 flex flex-col items-center gap-1 px-2 py-3 border-b border-hairline ${isToday ? 'bg-brand-wash/60' : ''}`}>
                                <span className={`text-2xs font-semibold uppercase tracking-wider ${isToday ? 'text-brand-strong' : isWeekend ? 'text-danger-500/70' : 'text-faint'}`}>{WD[i]}</span>
                                <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-bold transition-colors
                                    ${isToday ? 'bg-brand-strong text-white' : isWeekend ? 'text-danger-500' : 'text-heading'}`}>
                                    {d.getDate()}
                                </span>
                            </div>

                            {/* Column body */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-2 custom-scrollbar">
                                {holiday ? (
                                    <EventBlock holiday={holiday} size="md" onOpen={onEventOpen} />
                                ) : (
                                    <div className="h-full min-h-[100px] rounded-tile border border-dashed border-hairline flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-strong">
                                            <Plus size={12} strokeWidth={2.6} /> Add
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
