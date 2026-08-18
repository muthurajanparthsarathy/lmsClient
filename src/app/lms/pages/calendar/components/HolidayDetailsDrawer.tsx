'use client'

import React from 'react'
import { CalendarDays, Clock, FileText, Pencil, Tag, Trash2 } from 'lucide-react'
import { Drawer } from '@/app/lms/shared/ui'
import { Holiday, typeMeta } from './types'

// Right-side details panel for a holiday — inspect and act without leaving the
// calendar. Holidays are all-day records {name, date, type, duration, note}, so
// this shows exactly those fields (the model has no organiser / participants /
// attachments). Quick actions route to the page's existing edit + remove flows.

const durationLabel = (d: Holiday['duration']) =>
    d === 'first-half' ? 'First half' : d === 'second-half' ? 'Second half' : 'Full day'

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 rounded-tile border border-hairline bg-canvas px-3 py-2.5">
            <span className="text-faint shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
                <p className="text-sm font-medium text-heading truncate">{value}</p>
            </div>
        </div>
    )
}

export default function HolidayDetailsDrawer({
    holiday,
    onClose,
    onEdit,
    onRemove,
}: {
    holiday: Holiday | null
    onClose: () => void
    onEdit: (date: string) => void
    onRemove: (id: string) => void
}) {
    // Keep the last holiday so the drawer's exit animation doesn't flash empty.
    const last = React.useRef<Holiday | null>(null)
    if (holiday) last.current = holiday
    const shown = holiday ?? last.current
    const meta = shown ? typeMeta(shown.type) : null
    const d = shown ? new Date(shown.date + 'T00:00:00') : null
    const typeText = meta ? (meta.chip.split(' ').find(c => c.startsWith('text-')) ?? 'text-heading') : 'text-heading'

    return (
        <Drawer
            open={Boolean(holiday)}
            onClose={onClose}
            width="md"
            title="Holiday details"
            footer={
                shown ? (
                    <>
                        <button
                            type="button"
                            onClick={() => { onRemove(shown.id); onClose() }}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-danger-700 hover:bg-danger-50 hover:border-danger-500/30 transition-colors duration-150"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => { onEdit(shown.date); onClose() }}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                        >
                            <Pencil size={14} /> Edit
                        </button>
                    </>
                ) : undefined
            }
        >
            {shown && meta && d && (
                <div className="space-y-5">
                    {/* Hero identity block — type band + name + full date */}
                    <div className="rounded-2xl border border-hairline overflow-hidden shadow-xs">
                        <div className={`flex items-center gap-2 px-4 py-2.5 ${meta.cell}`}>
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            <span className={`text-xs font-semibold ${typeText}`}>{meta.label}</span>
                            {shown.duration !== 'full' && (
                                <span className="ml-auto inline-flex h-5 items-center rounded-full bg-ink-100 px-2 text-2xs font-medium text-ink-600">
                                    {durationLabel(shown.duration)}
                                </span>
                            )}
                        </div>
                        <div className="px-4 py-4 bg-surface">
                            <h3 className="text-xl font-semibold text-heading tracking-[-0.01em]">{shown.name}</h3>
                            <p className="mt-1 text-sm text-subtle">
                                {d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {/* At a glance */}
                    <div className="space-y-2.5">
                        <Row icon={<CalendarDays size={14} />} label="Date" value={d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                        <div className="grid grid-cols-2 gap-2.5">
                            <Row icon={<Tag size={14} />} label="Category" value={meta.label} />
                            <Row icon={<Clock size={14} />} label="Duration" value={durationLabel(shown.duration)} />
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
                            <FileText size={12} /> Note
                        </p>
                        <p className="text-sm text-body leading-relaxed whitespace-pre-wrap rounded-tile bg-canvas border border-hairline px-3.5 py-2.5">
                            {shown.note?.trim() || <span className="text-faint italic">No note added.</span>}
                        </p>
                    </div>
                </div>
            )}
        </Drawer>
    )
}
