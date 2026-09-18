"use client"

import { Check } from 'lucide-react'
import { Drawer } from '@/app/lms/shared/ui'
import { HolidayType, HOLIDAY_TYPES } from './types'

type ViewFilter = 'all' | 'holidays' | 'working'

const DAY_OPTIONS: { v: ViewFilter; label: string; hint: string }[] = [
    { v: 'all', label: 'All days', hint: 'Show the whole month' },
    { v: 'holidays', label: 'Holidays only', hint: 'Dim working days' },
    { v: 'working', label: 'Working days', hint: 'Dim holidays & Sundays' },
]

// Slide-over filter panel (replaces the old inline filter row). Filters are
// display-only — they never change what is saved — so closing the drawer keeps
// whatever the user selected applied to the views.
export default function FilterDrawer({
    open,
    onClose,
    typeFilter,
    onToggleType,
    dayFilter,
    onDayFilterChange,
    typeCounts,
    onClearAll,
    isFiltered,
}: {
    open: boolean
    onClose: () => void
    typeFilter: HolidayType[]
    onToggleType: (t: HolidayType) => void
    dayFilter: ViewFilter
    onDayFilterChange: (v: ViewFilter) => void
    typeCounts: Map<HolidayType, number>
    onClearAll: () => void
    isFiltered: boolean
}) {
    return (
        <Drawer
            open={open}
            onClose={onClose}
            width="md"
            title="Filters"
            description="Narrow what's shown — your saved holidays are never changed."
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClearAll}
                        disabled={!isFiltered}
                        className="inline-flex items-center h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors"
                    >
                        Done
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                {/* Event type */}
                <section>
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2.5">Event type</h3>
                    <div className="space-y-1.5">
                        {HOLIDAY_TYPES.map(t => {
                            const on = typeFilter.includes(t.value)
                            const count = typeCounts.get(t.value) ?? 0
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => onToggleType(t.value)}
                                    aria-pressed={on}
                                    className={`w-full flex items-center gap-3 h-11 px-3 rounded-tile border text-left transition-colors duration-150 ${
                                        on ? 'border-brand-300 bg-brand-wash' : 'border-hairline bg-surface hover:bg-row-hover'
                                    }`}
                                >
                                    <span className={`h-3 w-3 rounded-[5px] shrink-0 ${t.dot}`} />
                                    <span className={`flex-1 text-sm font-medium ${on ? 'text-brand-strong' : 'text-body'}`}>{t.label}</span>
                                    <span className="text-2xs font-semibold tabular-nums text-faint">{count}</span>
                                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${on ? 'border-brand-strong bg-brand-strong text-white' : 'border-hairline-strong bg-surface text-transparent'}`}>
                                        <Check size={13} strokeWidth={3} />
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    {typeFilter.length === 0 && (
                        <p className="mt-2 text-2xs text-faint">No types selected — every category is shown.</p>
                    )}
                </section>

                {/* Show days */}
                <section>
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2.5">Show days</h3>
                    <div className="space-y-1.5">
                        {DAY_OPTIONS.map(o => {
                            const on = dayFilter === o.v
                            return (
                                <button
                                    key={o.v}
                                    type="button"
                                    onClick={() => onDayFilterChange(o.v)}
                                    className={`w-full flex items-center gap-3 h-12 px-3 rounded-tile border text-left transition-colors duration-150 ${
                                        on ? 'border-brand-300 bg-brand-wash' : 'border-hairline bg-surface hover:bg-row-hover'
                                    }`}
                                >
                                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0 ${on ? 'border-brand-strong' : 'border-hairline-strong'}`}>
                                        {on && <span className="h-2 w-2 rounded-full bg-brand-strong" />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium ${on ? 'text-brand-strong' : 'text-body'}`}>{o.label}</p>
                                        <p className="text-2xs text-faint">{o.hint}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>
            </div>
        </Drawer>
    )
}
