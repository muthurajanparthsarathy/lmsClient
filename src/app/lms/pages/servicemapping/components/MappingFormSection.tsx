"use client"

import React from 'react'
import { ChevronRight } from 'lucide-react'

// One accordion section of the Map Service form, built on the assignment
// editor's global section classes (es-acc-*; styled by
// AssignmentSettings.module.css under the wizard's `reference compact` root):
// orange chevron badge, light title, hairline divider, no boxed card.
// `es-acc-body-content` is also what scopes that stylesheet's 32px input /
// select / listbox-trigger treatment, so every field inside picks it up.
export default function MappingFormSection({ id, title, summary, open, onToggle, children }: {
    id: string
    title: string
    summary?: string
    open: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        <section id={id} className="es-acc-card scroll-mt-4" data-open={open}>
            <h2 style={{ margin: 0 }}>
                <button id={`${id}-heading`} type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle} className="es-acc-head">
                    <span className="es-acc-badge" aria-hidden="true">
                        <ChevronRight size={26} strokeWidth={2} className="es-acc-badge-chev" />
                    </span>
                    <span className="es-acc-title-text">{title}</span>
                    {!open && summary && <span className="ml-auto truncate pl-4 text-[12px] text-[#68727a]">{summary}</span>}
                </button>
            </h2>
            <div id={`${id}-content`} role="region" aria-labelledby={`${id}-heading`} hidden={!open} className="es-acc-body">
                <div className="es-acc-body-content px-3">
                    {children}
                </div>
            </div>
        </section>
    )
}
