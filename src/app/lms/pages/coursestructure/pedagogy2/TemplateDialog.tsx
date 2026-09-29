"use client"

// More ▸ Template: ask for the course's shape, e.g. "5 modules, each with 3
// topics of 2 sub topics", then draw it as an empty grid (see
// pedagogyTemplate.ts). Only the levels the course's hierarchy has are asked
// for, and counts can be the same for every module or set per module.

import React, { useEffect, useMemo, useState } from "react"
import { LayoutGrid, X } from "lucide-react"
import type { PedagogyTemplate, TemplateLevel, TemplateModule } from "./pedagogyTemplate"

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? Math.floor(n) : lo))

function CountInput({ value, onChange, max = 50, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
    return (
        <input
            type="number"
            min={0}
            max={max}
            aria-label={label}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value), 0, max))}
            className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 text-center text-xs font-semibold text-gray-800 focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
        />
    )
}

export default function TemplateDialog({
    open,
    onClose,
    levels,
    initial,
    existingModules,
    onApply,
}: {
    open: boolean
    onClose: () => void
    levels: TemplateLevel[]
    initial: PedagogyTemplate | null
    /** Real modules already on the course. Template module i pairs with the i-th. */
    existingModules: number
    onApply: (template: PedagogyTemplate) => void
}) {
    const hasSM = levels.includes("submodule")
    const hasT = levels.includes("topic")
    const hasST = levels.includes("subtopic")
    const blank: TemplateModule = { subModules: hasSM ? 2 : 0, topics: hasT ? 3 : 0, subTopics: hasST ? 2 : 0 }

    const [count, setCount] = useState(5)
    const [sameForAll, setSameForAll] = useState(true)
    const [shared, setShared] = useState<TemplateModule>(blank)
    const [perModule, setPerModule] = useState<TemplateModule[]>([])

    // Re-seed from the saved template every time the dialog opens.
    useEffect(() => {
        if (!open) return
        const mods = initial?.modules ?? []
        setCount(mods.length || Math.max(existingModules, 5))
        const uniform = mods.length > 0 && mods.every(m => JSON.stringify(m) === JSON.stringify(mods[0]))
        setSameForAll(!mods.length || uniform)
        setShared(mods[0] ?? blank)
        setPerModule(mods)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const modules: TemplateModule[] = useMemo(
        () => Array.from({ length: count }, (_, i) => (sameForAll ? shared : perModule[i] ?? shared)),
        [count, sameForAll, shared, perModule],
    )
    const totals = useMemo(() => {
        let sm = 0, t = 0, st = 0
        for (const m of modules) {
            const parents = hasSM ? Math.max(1, m.subModules) : 1
            sm += hasSM ? m.subModules : 0
            t += hasT ? parents * m.topics : 0
            st += hasST ? parents * Math.max(1, hasT ? m.topics : 1) * m.subTopics : 0
        }
        return { sm, t, st }
    }, [modules, hasSM, hasT, hasST])

    if (!open) return null

    const setModuleField = (i: number, key: keyof TemplateModule, n: number) =>
        setPerModule(prev => {
            const next = Array.from({ length: count }, (_, k) => prev[k] ?? shared)
            next[i] = { ...next[i], [key]: n }
            return next
        })

    const fields: { key: keyof TemplateModule; label: string; show: boolean }[] = [
        { key: "subModules", label: "Sub modules", show: hasSM },
        { key: "topics", label: hasSM ? "Topics / sub module" : "Topics", show: hasT },
        { key: "subTopics", label: "Sub topics / topic", show: hasST },
    ]

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pedagogy-template-title"
                className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-[#FFF3EA] to-white px-4 py-3">
                    <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFE4D0] text-[#F97316]"><LayoutGrid className="h-4 w-4" /></span>
                        <div>
                            <h2 id="pedagogy-template-title" className="text-sm font-semibold text-[#9A3F0A]">Structure template</h2>
                            <p className="text-[11px] text-gray-500">Draw a blank grid, then fill each cell with its Add button.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-gray-800">Number of modules</label>
                        <CountInput label="Number of modules" value={count} max={50} onChange={(n) => setCount(Math.max(1, n))} />
                    </div>

                    {(hasSM || hasT || hasST) && (
                        <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs font-medium">
                            {([[true, "Same for every module"], [false, "Set per module"]] as const).map(([v, l]) => (
                                <button
                                    key={l}
                                    type="button"
                                    onClick={() => { setSameForAll(v); if (!v) setPerModule(Array.from({ length: count }, (_, k) => perModule[k] ?? shared)) }}
                                    className={`flex-1 py-1.5 transition-colors ${sameForAll === v ? "bg-[#FFE4D0] text-[#9A3F0A]" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    )}

                    {sameForAll ? (
                        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                            {fields.filter(f => f.show).map(f => (
                                <div key={f.key} className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-gray-700">{f.label}</span>
                                    <CountInput label={f.label} value={shared[f.key]} onChange={(n) => setShared(s => ({ ...s, [f.key]: n }))} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                            <table className="w-full text-xs">
                                <thead className="bg-[#FFE4D0] text-[#9A3F0A]">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left font-semibold">Module</th>
                                        {fields.filter(f => f.show).map(f => <th key={f.key} className="px-2 py-1.5 text-center font-semibold">{f.label}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {modules.map((m, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="px-2 py-1 font-medium text-gray-700">
                                                Module {i + 1}
                                                {i < existingModules && <span className="ml-1 text-[10px] text-gray-400">(existing)</span>}
                                            </td>
                                            {fields.filter(f => f.show).map(f => (
                                                <td key={f.key} className="px-2 py-1 text-center">
                                                    <CountInput label={`Module ${i + 1} ${f.label}`} value={m[f.key]} onChange={(n) => setModuleField(i, f.key, n)} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="rounded-lg border border-[#FFD9BC] bg-[#FFF8F2] px-3 py-2 text-[11px] leading-relaxed text-[#9A3F0A]">
                        Grid: <b>{count}</b> module{count === 1 ? "" : "s"}
                        {hasSM && <> · <b>{totals.sm}</b> sub modules</>}
                        {hasT && <> · <b>{totals.t}</b> topics</>}
                        {hasST && <> · <b>{totals.st}</b> sub topics</>}.
                        {" "}Existing items stay as they are and fill the first slots; nothing is saved until you add each one.
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <button type="button" onClick={onClose} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100">Cancel</button>
                    <button
                        type="button"
                        onClick={() => onApply({ modules })}
                        className="h-8 rounded-md bg-gradient-to-r from-[#FB8C3C] to-[#F0701F] px-4 text-xs font-semibold text-white shadow-sm hover:from-[#F0701F] hover:to-[#C2540F]"
                    >
                        Create grid
                    </button>
                </div>
            </div>
        </div>
    )
}
