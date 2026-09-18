'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CalendarX2, Pencil, Trash2 } from 'lucide-react'
import { EmptyState } from '@/app/lms/shared/ui'
import { Holiday, MONTHS, typeMeta } from './types'

// Agenda view of a scope's holidays — grouped by month with sticky headings and
// rich event rows. Display-only: it renders whatever holiday list it is handed
// (already search/type filtered by the page) and routes clicks to the same
// preview / edit / remove callbacks the rest of the page uses.

const ICON_BTN =
    'inline-flex size-7 items-center justify-center rounded-chip border border-hairline-strong bg-surface text-subtle ' +
    'transition-colors duration-150 hover:border-line-hover hover:bg-row-hover hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'

export default function AgendaView({
    holidays,
    isFiltered,
    onPreview,
    onEdit,
    onRemove,
    onAdd,
}: {
    holidays: Holiday[]
    isFiltered: boolean
    onPreview: (h: Holiday) => void
    onEdit: (date: string) => void
    onRemove: (id: string) => void
    onAdd: () => void
}) {
    const groups = useMemo(() => {
        const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
        const map = new Map<string, Holiday[]>()
        sorted.forEach(h => {
            const key = h.date.slice(0, 7) // YYYY-MM
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(h)
        })
        return Array.from(map.entries())
    }, [holidays])

    if (!holidays.length) {
        return (
            <div className="bg-surface rounded-xl border border-hairline shadow-xs">
                <EmptyState
                    icon={CalendarX2}
                    title={isFiltered ? 'No holidays match your filters' : 'No holidays scheduled'}
                    message={isFiltered
                        ? 'Try a different search, or clear the filters to see the full year.'
                        : 'Click a day on the calendar — or use Add holiday — to schedule the first one.'}
                    primaryAction={!isFiltered ? (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                        >
                            Add holiday
                        </button>
                    ) : undefined}
                />
            </div>
        )
    }

    return (
        <div className="bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
            <div className="max-h-[calc(100dvh-16rem)] overflow-auto custom-scrollbar">
                {groups.map(([key, items]) => {
                    const [y, m] = key.split('-')
                    return (
                        <div key={key}>
                            <div className="sticky top-0 z-sticky flex items-center justify-between border-b border-hairline bg-canvas px-4 py-2">
                                <span className="text-xs font-semibold text-heading">{MONTHS[Number(m) - 1]} {y}</span>
                                <span className="text-2xs tabular-nums text-subtle">{items.length} {items.length === 1 ? 'holiday' : 'holidays'}</span>
                            </div>
                            {items.map((h, i) => {
                                const meta = typeMeta(h.type)
                                const d = new Date(h.date + 'T00:00:00')
                                return (
                                    <motion.div
                                        key={h.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.15, delay: Math.min(i, 8) * 0.02 }}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onPreview(h)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(h) } }}
                                        className={`group flex cursor-pointer items-center gap-3 border-b border-l-[3px] border-hairline px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-row-hover ${meta.bar}`}
                                    >
                                        <div className="w-11 shrink-0 text-center">
                                            <div className="text-lg font-semibold leading-none text-heading tabular-nums">{d.getDate()}</div>
                                            <div className="mt-0.5 text-2xs uppercase text-subtle">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-heading">{h.name}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <span className={`inline-flex h-[20px] items-center gap-1 rounded-chip border px-1.5 text-2xs font-semibold ${meta.chip}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                                                </span>
                                                {h.duration !== 'full' && <span className="inline-flex h-[20px] items-center rounded-chip bg-ink-100 px-1.5 text-2xs font-medium text-ink-600">{h.duration === 'first-half' ? 'First half' : 'Second half'}</span>}
                                                {h.note && <span className="max-w-[240px] truncate text-2xs text-subtle">{h.note}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                            <button type="button" onClick={() => onEdit(h.date)} title="Edit" aria-label="Edit holiday" className={ICON_BTN}><Pencil size={14} /></button>
                                            <button type="button" onClick={() => onRemove(h.id)} title="Remove" aria-label="Remove holiday" className={`${ICON_BTN} hover:border-danger-500/30 hover:bg-danger-50 hover:text-danger-700`}><Trash2 size={14} /></button>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
