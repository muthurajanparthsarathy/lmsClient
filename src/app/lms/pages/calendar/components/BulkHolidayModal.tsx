"use client"

import { useState, useEffect } from 'react'
import { CalendarDays, Check, CopyPlus } from 'lucide-react'
import ModalShell from './ModalShell'
import {
    FieldLabel, NameErrorRow, TypeChipGrid, DurationSegmented,
    INPUT_CLS, INPUT_INVALID_CLS, BTN_PRIMARY, BTN_SECONDARY,
} from './HolidayFormFields'
import { HolidayDuration, HolidayType, fmtDateLong } from './types'

type Props = {
    dates: string[]
    onClose: () => void
    onSave: (data: { name: string; type: HolidayType; duration: HolidayDuration; note: string }) => void
}

export default function BulkHolidayModal({ dates, onClose, onSave }: Props) {
    const [name, setName] = useState('')
    const [type, setType] = useState<HolidayType>('institute')
    const [duration, setDuration] = useState<HolidayDuration>('full')
    const [nameTouched, setNameTouched] = useState(false)

    useEffect(() => {
        if (dates.length > 0) { setName(''); setType('institute'); setDuration('full'); setNameTouched(false) }
    }, [dates.length])

    const canSave = name.trim().length > 0
    const sorted = [...dates].sort()

    return (
        <ModalShell
            open={dates.length > 1}
            onClose={onClose}
            icon={<CopyPlus size={17} className="text-brand-strong" />}
            eyebrow="Bulk Add"
            title={`${dates.length} Dates Selected`}
            subtitle={<p className="text-xs text-subtle">Same holiday added to all selected dates</p>}
            footer={
                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave({ name: name.trim(), type, duration, note: '' })}
                        disabled={!canSave}
                        className={BTN_PRIMARY}
                    >
                        <Check size={14} /> Add to {dates.length} Dates
                    </button>
                </div>
            }
        >
            {/* Selected dates chips */}
            <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                {sorted.map(d => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-wash text-brand-strong text-2xs font-medium border border-brand-300">
                        <CalendarDays size={10} />
                        {fmtDateLong(new Date(d + 'T00:00:00'))}
                    </span>
                ))}
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
                <div>
                    <FieldLabel required>Holiday Name</FieldLabel>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => setNameTouched(true)}
                        onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave({ name: name.trim(), type, duration, note: '' }) }}
                        placeholder="e.g. State Holiday"
                        className={`${INPUT_CLS} ${nameTouched && !canSave ? INPUT_INVALID_CLS : ''}`}
                    />
                    {nameTouched && !canSave && <NameErrorRow />}
                </div>

                <div>
                    <FieldLabel>Type</FieldLabel>
                    <TypeChipGrid value={type} onChange={setType} />
                </div>

                <div>
                    <FieldLabel>Duration</FieldLabel>
                    <DurationSegmented value={duration} onChange={setDuration} />
                </div>
            </div>
        </ModalShell>
    )
}
