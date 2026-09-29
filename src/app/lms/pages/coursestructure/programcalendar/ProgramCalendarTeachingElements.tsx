"use client"

/* Teaching Elements checkbox dropdown — shared between the Program Calendar
 * tab (rendered inside ProgramCalendarBatchRow) and the Reports tab (rendered
 * above the review table). Wired to the SAME hideIDo / hideWeDo / hideYouDo
 * state owned by ProgramCalendarContent so ticking I Do / We Do / You Do on
 * either surface affects both — one source of truth. Extracted so both tabs
 * present identical chrome without duplicating the checkbox markup.
 */

import { useState } from 'react'
import { Check, ChevronDownIcon, Sliders } from 'lucide-react'

type Props = {
    // hideIDo / hideWeDo hide the two teaching columns; hideYouDo hides the
    // Assessment rows (banner in the main tab, "Assessment" report rows in
    // the Reports tab).
    hideIDo: boolean
    hideWeDo: boolean
    hideYouDo: boolean
    setHideIDo: (value: boolean) => void
    setHideWeDo: (value: boolean) => void
    setHideYouDo: (value: boolean) => void
    /** Optional caption rendered to the LEFT of the dropdown trigger.
     *  Defaults to "Teaching Elements:" — override with an empty string when
     *  the caller already carries a label. */
    label?: string
}

/* Element metadata — kept in a small array so the checkbox rows loop over
 * one definition instead of repeating three near-identical blocks. Colour
 * dots match the pedagogy palette (indigo for I Do, violet for We Do,
 * emerald for You Do). */
const ELEMENTS = [
    { key: 'iDo',   label: 'I Do Activities',   dot: 'bg-indigo-500' },
    { key: 'weDo',  label: 'We Do Activities',  dot: 'bg-violet-500' },
    { key: 'youDo', label: 'You Do Activities', dot: 'bg-emerald-500' },
] as const
type ElementKey = typeof ELEMENTS[number]['key']

export default function ProgramCalendarTeachingElements({
    hideIDo, hideWeDo, hideYouDo,
    setHideIDo, setHideWeDo, setHideYouDo,
    label = 'Teaching Elements:',
}: Props) {
    const [open, setOpen] = useState(false)

    // Read the three hide flags into a "visible?" tuple keyed by element.
    // The dropdown talks in "shown", not "hidden", to match how a reader
    // thinks about ticking / unticking a Teaching Element.
    const visible: Record<ElementKey, boolean> = {
        iDo:   !hideIDo,
        weDo:  !hideWeDo,
        youDo: !hideYouDo,
    }
    const setVisible = (key: ElementKey, on: boolean) => {
        if (key === 'iDo')   setHideIDo(!on)
        if (key === 'weDo')  setHideWeDo(!on)
        if (key === 'youDo') setHideYouDo(!on)
    }
    // Trigger label — brief summary of what is currently shown. Empty set
    // reads as a prompt to pick something, not as an error.
    const selected = ELEMENTS.filter(e => visible[e.key])
    const triggerLabel = selected.length === 0
        ? 'Select elements'
        : selected.map(e => e.label.replace(' Activities', '')).join(' · ')

    return (
        <div className="flex items-center gap-2">
            {label && (
                <label className="text-[12px] font-semibold text-heading">{label}</label>
            )}

            <div className="relative inline-block text-left">
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-xl transition-all duration-200 ease-out cursor-pointer border
${open
                            ? 'border-[#F0701F] bg-[#FFF3EA] text-[#9A3F0A] shadow-[0_0_6px_rgba(240,112,31,0.2)]'
                            : 'border-[#FB8C3C]/60 bg-white text-[#9A3F0A] hover:border-[#F0701F] hover:shadow-[0_0_6px_rgba(240,112,31,0.15)]'
                        }`}
                >
                    <div className="relative flex items-center gap-1.5 z-10">
                        <span className="tracking-tight font-medium truncate max-w-[220px]">{triggerLabel}</span>
                        <div className={`transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDownIcon size={12} className="sm:size-3.5" />
                        </div>
                    </div>
                </button>

                {open && (
                    <div className="absolute right-0 mt-2 w-56 sm:w-60 bg-white rounded-lg shadow-xl border border-gray-200 z-30 overflow-hidden text-sm">
                        <div className="bg-gradient-to-r from-[#FFF3EA] to-white px-3 py-2 border-b border-gray-200">
                            <div className="flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-[#F97316]" />
                                <h3 className="text-xs font-semibold text-[#9A3F0A]">Teaching Elements</h3>
                            </div>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                            {ELEMENTS.map(el => {
                                const id = `pc-te-${el.key}`
                                const on = visible[el.key]
                                return (
                                    <label
                                        key={el.key}
                                        htmlFor={id}
                                        className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                    >
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border transition-colors ${on ? 'bg-[#F97316] border-[#F97316] text-white' : 'bg-white border-gray-300 text-transparent'}`}>
                                            <Check className="w-3 h-3" />
                                        </span>
                                        <input
                                            id={id}
                                            type="checkbox"
                                            checked={on}
                                            onChange={e => setVisible(el.key, e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`w-2.5 h-2.5 rounded-full ${el.dot}`} aria-hidden />
                                        <span className="text-xs font-medium text-gray-800">{el.label}</span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                )}

                {open && (
                    <div
                        className="fixed inset-0 z-20"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                )}
            </div>
        </div>
    )
}
