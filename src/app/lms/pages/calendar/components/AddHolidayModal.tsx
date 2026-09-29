"use client"

import { useEffect, useState } from 'react'
import { Trash2, Plus, Check, CalendarDays } from 'lucide-react'
import ModalShell from './ModalShell'
import {
    FieldLabel, NameErrorRow, TypeChipGrid, DurationSegmented,
    INPUT_CLS, INPUT_INVALID_CLS, BTN_PRIMARY, BTN_SECONDARY,
} from './HolidayFormFields'
import { Holiday, HolidayDuration, HolidayType, fmtDateLong } from './types'

type Props = {
    /** ISO date the modal is opened for ("YYYY-MM-DD"), or null when closed. */
    date: string | null
    /** Existing holiday on that date, if any (edit mode). */
    existing: Holiday | null
    onClose: () => void
    onSave: (data: { name: string; type: HolidayType; duration: HolidayDuration; note: string }) => void
    onDelete: () => void
}

export default function AddHolidayModal({ date, existing, onClose, onSave, onDelete }: Props) {
    const [name, setName] = useState('')
    const [type, setType] = useState<HolidayType>('institute')
    const [duration, setDuration] = useState<HolidayDuration>('full')
    const [note, setNote] = useState('')
    const [nameTouched, setNameTouched] = useState(false)

    // Reset the form whenever the target date / existing holiday changes.
    useEffect(() => {
        setName(existing?.name ?? '')
        setType(existing?.type ?? 'institute')
        setDuration(existing?.duration ?? 'full')
        setNote(existing?.note ?? '')
        setNameTouched(false)
    }, [date, existing])

    const canSave = name.trim().length > 0
    const dateObj = date ? new Date(date + 'T00:00:00') : null
    const isSunday = dateObj ? dateObj.getDay() === 0 : false

    return (
        <ModalShell
            open={!!date}
            onClose={onClose}
            icon={<CalendarDays size={17} className="text-brand-strong" />}
            eyebrow={existing ? 'Edit Holiday' : 'Add Holiday'}
            title={dateObj ? fmtDateLong(dateObj) : ''}
            subtitle={
                // Sunday reads in the danger tone — same rule the calendar grids
                // use for off-days.
                <p className={`text-xs ${isSunday ? 'text-danger-700' : 'text-subtle'}`}>
                    {dateObj ? dateObj.toLocaleDateString('en-IN', { weekday: 'long' }) : ''}
                </p>
            }
            footer={
                <>
                    {existing ? (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-control border border-danger-500/25 bg-surface text-xs font-semibold text-danger-700 hover:bg-danger-50 transition-colors duration-150"
                        >
                            <Trash2 size={14} /> Remove
                        </button>
                    ) : <span />}
                    <div className="ml-auto flex items-center gap-2">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onSave({ name: name.trim(), type, duration, note: note.trim() })}
                            disabled={!canSave}
                            className={BTN_PRIMARY}
                        >
                            {existing ? <><Check size={14} /> Save Changes</> : <><Plus size={14} /> Add Holiday</>}
                        </button>
                    </div>
                </>
            }
        >
            {/* Body */}
            <div className="px-5 py-4 space-y-4">
                <div>
                    <FieldLabel required>Holiday Name</FieldLabel>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => setNameTouched(true)}
                        onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave({ name: name.trim(), type, duration, note: note.trim() }) }}
                        placeholder="e.g. Independence Day"
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

                <div>
                    <FieldLabel>Note <span className="text-faint font-normal">(optional)</span></FieldLabel>
                    <input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Any extra detail…"
                        className={INPUT_CLS}
                    />
                </div>
            </div>
        </ModalShell>
    )
}
