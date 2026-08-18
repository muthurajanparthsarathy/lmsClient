"use client"

import { motion } from 'framer-motion'
import { CalendarPlus, Clock, FileText, Pencil, Sun, Tag, Trash2 } from 'lucide-react'
import { Holiday, isoDate, typeMeta } from './types'

const durationLabel = (d: Holiday['duration']) =>
    d === 'first-half' ? 'First half' : d === 'second-half' ? 'Second half' : 'Full day'

// Day view — one focused date. Shows that day's holiday as a premium detail
// card, or a clean "working day" state with an add CTA.
export default function DayView({
    focusedDate,
    holidays,
    onDateClick,
    onEdit,
    onRemove,
}: {
    focusedDate: Date
    holidays: Holiday[]
    onDateClick: (iso: string) => void
    onEdit: (date: string) => void
    onRemove: (id: string) => void
}) {
    const iso = isoDate(focusedDate)
    const holiday = holidays.find(h => h.date === iso) ?? null
    const isToday = iso === isoDate(new Date())
    const meta = holiday ? typeMeta(holiday.type) : null
    const weekday = focusedDate.toLocaleDateString('en-IN', { weekday: 'long' })
    const monthYear = focusedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

    return (
        <div className="h-full overflow-y-auto bg-surface custom-scrollbar">
            <div className="max-w-2xl mx-auto px-6 py-8">
                {/* Date header */}
                <div className="flex items-center gap-4 mb-7">
                    <div className={`flex flex-col items-center justify-center h-16 w-16 rounded-tile shrink-0 ${isToday ? 'bg-brand-strong text-white' : 'bg-canvas border border-hairline text-heading'}`}>
                        <span className={`text-2xs font-semibold uppercase ${isToday ? 'text-white/80' : 'text-faint'}`}>{weekday.slice(0, 3)}</span>
                        <span className="text-2xl font-bold leading-none">{focusedDate.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold text-heading tracking-[-0.01em]">{weekday}</h2>
                            {isToday && (
                                <span className="inline-flex h-5 items-center rounded-full bg-brand-wash px-2 text-2xs font-bold uppercase tracking-wide text-brand-strong ring-1 ring-inset ring-brand-300">Today</span>
                            )}
                        </div>
                        <p className="text-sm text-subtle mt-0.5">{monthYear}</p>
                    </div>
                </div>

                {holiday && meta ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="rounded-2xl border border-hairline bg-surface shadow-sm overflow-hidden"
                    >
                        {/* Type band */}
                        <div className={`flex items-center gap-2 px-5 py-3 border-b border-hairline ${meta.cell}`}>
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            <span className={`text-xs font-semibold ${meta.chip.split(' ').find(c => c.startsWith('text-')) || 'text-heading'}`}>{meta.label}</span>
                        </div>

                        <div className="p-5">
                            <h3 className="text-2xl font-semibold text-heading tracking-[-0.01em]">{holiday.name}</h3>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Row icon={<Tag size={14} />} label="Category" value={meta.label} />
                                <Row icon={<Clock size={14} />} label="Duration" value={durationLabel(holiday.duration)} />
                            </div>

                            {holiday.note && (
                                <div className="mt-4">
                                    <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
                                        <FileText size={12} /> Note
                                    </p>
                                    <p className="text-sm text-body leading-relaxed whitespace-pre-wrap rounded-tile bg-canvas border border-hairline px-3.5 py-2.5">{holiday.note}</p>
                                </div>
                            )}

                            <div className="mt-5 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => onEdit(holiday.date)}
                                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors"
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRemove(holiday.id)}
                                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-danger-700 hover:bg-danger-50 hover:border-danger-500/30 transition-colors"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="rounded-2xl border border-dashed border-hairline-strong bg-canvas/50 px-6 py-12 flex flex-col items-center text-center"
                    >
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-700 mb-3">
                            <Sun size={26} strokeWidth={1.8} />
                        </span>
                        <h3 className="text-base font-semibold text-heading">Working day</h3>
                        <p className="mt-1 text-sm text-subtle max-w-xs">No holiday is scheduled for this date. Mark it as a holiday if the institute is closed.</p>
                        <button
                            type="button"
                            onClick={() => onDateClick(iso)}
                            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors"
                        >
                            <CalendarPlus size={15} /> Add holiday
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 rounded-tile border border-hairline bg-canvas px-3.5 py-2.5">
            <span className="text-faint shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
                <p className="text-sm font-medium text-heading truncate">{value}</p>
            </div>
        </div>
    )
}
