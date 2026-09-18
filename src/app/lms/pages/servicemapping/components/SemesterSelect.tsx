"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Lock, Check } from 'lucide-react'
import { selectCls } from './shared/primitives'

// A single-select dropdown for the degree flow's semesters. Unlike a native
// <select> it can show a lock icon on blocked options and a hover tooltip
// explaining why each is locked — which is exactly what the sequential setup
// needs. The panel is portalled to the body so the accordion's overflow-hidden
// fold cannot clip it (same fix as MultiSelectPopover).

export type SemStatus = { status: 'chosen' | 'available' | 'blocked'; reason?: string; removable?: boolean }

export default function SemesterSelect({
    options,
    statusFor,
    value,
    onPick,
    placeholder,
}: {
    // Every semester the degree has, in order ("1".."N").
    options: string[]
    statusFor: (semester: string) => SemStatus
    // The semester shown on the trigger (the current one being set up), or ''.
    value: string
    // Called when a pickable row is clicked: an available one to add it, or the
    // changeable current one to unpick it.
    onPick: (semester: string) => void
    placeholder: string
}) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

    useLayoutEffect(() => {
        if (!open || !wrapRef.current) return
        const r = wrapRef.current.getBoundingClientRect()
        const width = Math.max(r.width, 220)
        const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
        const below = r.bottom + 4
        const height = panelRef.current?.getBoundingClientRect().height || 300
        const top = below + height > window.innerHeight && r.top - height - 4 > 0 ? r.top - height - 4 : below
        setPos({ top, left, width })
    }, [open])

    useEffect(() => {
        if (!open) return
        const dismiss = () => setOpen(false)
        const onMouseDown = (e: MouseEvent) => {
            const t = e.target as Node
            if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
            dismiss()
        }
        // Capture + consume Escape so it closes this popover without also closing
        // the wizard modal underneath.
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); dismiss() } }
        const onScroll = () => dismiss()
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown, true)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
        }
    }, [open])

    const isClickable = (s: SemStatus) => s.status === 'available' || (s.status === 'chosen' && Boolean(s.removable))
    const pick = (sem: string, s: SemStatus) => {
        if (!isClickable(s)) return // blocked, module-locked, or committed rows do nothing
        onPick(sem)
        setOpen(false)
    }

    return (
        <div ref={wrapRef} className="relative block">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`${selectCls} text-left flex items-center justify-between gap-2`}
            >
                <span className={value ? 'text-heading' : 'text-faint'}>
                    {value ? `Semester ${value}` : placeholder}
                </span>
                <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && pos && createPortal(
                <div
                    ref={panelRef}
                    role="listbox"
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
                    className="z-dropdown rounded-xl border border-hairline bg-surface shadow-lg overflow-hidden"
                >
                    <div className="max-h-64 overflow-y-auto py-1">
                        {options.map((sem) => {
                            const s = statusFor(sem)
                            const clickable = isClickable(s)
                            // A lock shows on anything that can't be picked: a blocked
                            // one, or a chosen one that course setup has locked. A tick
                            // shows on the current changeable one (click it to change).
                            const locked = !clickable
                            const changeable = s.status === 'chosen' && Boolean(s.removable)
                            return (
                                <div
                                    key={sem}
                                    role="option"
                                    aria-selected={sem === value}
                                    aria-disabled={locked}
                                    // Native hover tooltip: the lock reason, or a prompt
                                    // that the current one can be changed.
                                    title={locked ? s.reason : changeable ? 'Click to change this semester' : undefined}
                                    onClick={() => pick(sem, s)}
                                    className={`h-9 px-3 flex items-center justify-between gap-2 text-sm select-none ${
                                        locked
                                            ? 'text-faint cursor-not-allowed'
                                            : changeable
                                                ? 'text-heading bg-brand-wash hover:bg-brand-wash-hover cursor-pointer'
                                                : 'text-body hover:bg-brand-50 cursor-pointer'
                                    }`}
                                >
                                    <span>Semester {sem}</span>
                                    {locked ? (
                                        <Lock size={13} className="flex-shrink-0" />
                                    ) : changeable ? (
                                        <Check size={14} className="text-brand-500 flex-shrink-0" />
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
