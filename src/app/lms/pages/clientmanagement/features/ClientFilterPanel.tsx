"use client"

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'

// Inline filter panel for Client Management — expands on the SAME screen under
// the toolbar (no drawer). DRAFT model: edits stay local until "Apply Filters"
// commits them to the page's filter state; Reset clears both; Apply collapses.
//
// Only Status + Business Model are exposed here. Client-type and created-date
// were removed from the panel per product feedback (they added noise for a
// question the user rarely asked). Their fields stay on the interface (empty
// strings) so the page's filter payload keeps its stable shape.

export interface ClientFilters {
    status: string
    model: string
    // Kept for payload compatibility with the server filter shape; the panel
    // no longer surfaces controls for these.
    type: string
    date: string
}

export const EMPTY_CLIENT_FILTERS: ClientFilters = { status: '', model: '', type: '', date: '' }

interface Option { value: string; label: string }

interface ClientFilterPanelProps {
    open: boolean
    onClose: () => void
    current: ClientFilters
    modelOptions: Option[]
    onApply: (filters: ClientFilters) => void
    onReset: () => void
}

const SELECT_CLS =
    'w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body ' +
    'focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150'

const STATUS_OPTIONS: Option[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
]

function Field({ label, value, onChange, allLabel, options }: { label: string; value: string; onChange: (v: string) => void; allLabel: string; options: Option[] }) {
    return (
        <div>
            <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLS}>
                <option value="">{allLabel}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}

export default function ClientFilterPanel({ open, onClose, current, modelOptions, onApply, onReset }: ClientFilterPanelProps) {
    const [draft, setDraft] = useState<ClientFilters>(current)

    useEffect(() => {
        if (open) setDraft(current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const set = (key: keyof ClientFilters) => (v: string) => setDraft((d) => ({ ...d, [key]: v }))
    const draftActive = Object.values(draft).some(Boolean)

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden"
                >
                    <div className="mt-3 rounded-xl border border-hairline bg-surface shadow-xs p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-sm font-semibold text-heading">Filters</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setDraft(EMPTY_CLIENT_FILTERS); onReset() }}
                                    disabled={!draftActive}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                                >
                                    <RotateCcw size={13} /> Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onApply(draft); onClose() }}
                                    className="inline-flex items-center h-8 px-3.5 rounded-control bg-brand-strong text-white text-xs font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Business Model" value={draft.model} onChange={set('model')} allLabel="All models" options={modelOptions} />
                            <Field label="Status" value={draft.status} onChange={set('status')} allLabel="Any status" options={STATUS_OPTIONS} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
