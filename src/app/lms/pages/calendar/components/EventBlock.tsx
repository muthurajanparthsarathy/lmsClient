'use client'

import { motion } from 'framer-motion'
import { Pencil, Trash2 } from 'lucide-react'
import { Holiday, typeMeta } from './types'

// One premium event block, shared by every view (month cell, week column, day
// panel, agenda row). It renders the holiday's category as a left accent bar +
// soft wash + dot, the name, and a meta line; on hover it reveals inline edit /
// remove actions. Clicking the block opens the detail drawer.
//
// `onMouseDown` stops propagation so a click on the block never starts the
// month grid's cell drag-select underneath it.

const durationLabel = (d: Holiday['duration']) =>
    d === 'first-half' ? 'First half' : d === 'second-half' ? 'Second half' : ''

export default function EventBlock({
    holiday,
    onOpen,
    onEdit,
    onRemove,
    size = 'md',
}: {
    holiday: Holiday
    onOpen?: (h: Holiday) => void
    onEdit?: (date: string) => void
    onRemove?: (id: string) => void
    size?: 'sm' | 'md' | 'lg'
}) {
    const meta = typeMeta(holiday.type)
    const dur = durationLabel(holiday.duration)

    const pad = size === 'sm' ? 'px-1.5 py-1' : size === 'lg' ? 'px-3 py-2.5' : 'px-2.5 py-2'
    const nameCls = size === 'sm' ? 'text-2xs' : size === 'lg' ? 'text-sm' : 'text-xs'
    const showActions = (onEdit || onRemove) && size !== 'sm'

    return (
        <motion.div
            layout
            whileHover={onOpen ? { y: -1 } : undefined}
            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
            role={onOpen ? 'button' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onMouseDown={onOpen ? (e) => e.stopPropagation() : undefined}
            onClick={onOpen ? (e) => { e.stopPropagation(); onOpen(holiday) } : undefined}
            onKeyDown={
                onOpen
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onOpen(holiday)
                          }
                      }
                    : undefined
            }
            className={`group/event relative flex items-center gap-2 rounded-chip border-l-[3px] ${meta.bar} ${meta.cell} ${pad} min-w-0 ${
                onOpen ? 'cursor-pointer' : ''
            } ${size === 'sm' ? '' : 'shadow-xs'}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className={`${nameCls} font-semibold text-heading truncate leading-tight`}>{holiday.name}</p>
                {size !== 'sm' ? (
                    <p className="text-[10px] text-subtle truncate leading-tight mt-0.5">
                        {meta.label}
                        {dur ? ` · ${dur}` : ''}
                        {holiday.note ? ` · ${holiday.note}` : ''}
                    </p>
                ) : (
                    dur && <p className="text-[9px] text-subtle truncate leading-tight">{dur}</p>
                )}
            </div>

            {showActions && (
                <div
                    className="flex items-center gap-0.5 opacity-0 group-hover/event:opacity-100 transition-opacity duration-150 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {onEdit && (
                        <button
                            type="button"
                            aria-label="Edit holiday"
                            title="Edit"
                            onClick={() => onEdit(holiday.date)}
                            className="inline-flex size-6 items-center justify-center rounded-chip text-subtle hover:bg-surface hover:text-heading transition-colors"
                        >
                            <Pencil size={12} />
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            aria-label="Remove holiday"
                            title="Remove"
                            onClick={() => onRemove(holiday.id)}
                            className="inline-flex size-6 items-center justify-center rounded-chip text-subtle hover:bg-danger-50 hover:text-danger-700 transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    )
}
