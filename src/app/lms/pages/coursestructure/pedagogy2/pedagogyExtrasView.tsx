"use client"

// View pieces for the three additions on the pedagogy builder: move ▲ ▼,
// the structure template's empty grid, and the Excel-style bulk clear.
// Logic lives in usePedagogyManagement (pedagogyExtras); these only draw it.

import React from "react"
import { AlertTriangle, ChevronDown, ChevronUp, LayoutGrid, Loader2, Pencil, Trash2, X } from "lucide-react"
import type { TemplateLevel, TemplateSlotItem } from "./pedagogyTemplate"
import type { MoveLevel } from "./moveHelpers"

/** ▲ ▼ on the cell that Move armed. Drag-and-drop keeps working alongside. */
export function MoveArrows({ level, id, extras }: { level: MoveLevel; id: string; extras: any }) {
    const busy = extras?.movingItemId === id
    const btn = (dir: -1 | 1) => {
        const enabled = !busy && extras?.canMove(level, id, dir)
        return (
            <button
                type="button"
                disabled={!enabled}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); extras?.moveItem(level, id, dir) }}
                title={dir === -1 ? "Move up" : "Move down"}
                aria-label={dir === -1 ? "Move up" : "Move down"}
                className="flex h-5 w-5 items-center justify-center rounded bg-white text-[#F97316] shadow-sm ring-1 ring-[#FDBA74] transition-colors hover:bg-[#FFE4D0] disabled:cursor-not-allowed disabled:opacity-35"
            >
                {dir === -1 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
        )
    }
    return (
        <div className="absolute left-0.5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-0.5" title="Drag to a new place, or step with the arrows">
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" /> : <>{btn(-1)}{btn(1)}</>}
        </div>
    )
}

/** Status strip above the table: template progress + the last move's note. */
export function PedagogyExtrasBanner({ extras }: { extras: any }) {
    if (!extras) return null
    const layout = extras.templateLayout
    return (
        <>
            {extras.template && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#FFD9BC] bg-[#FFF8F2] px-3 py-2 text-[11px] text-[#9A3F0A]">
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-[#F97316]" />
                    {layout && layout.remaining > 0 ? (
                        <span><b>{layout.remaining}</b> empty slot{layout.remaining === 1 ? "" : "s"} from your template. Click <b>+ Add</b> in a slot to fill it. Greyed slots unlock once the item above them exists.</span>
                    ) : (
                        <span>Template complete: every slot has been filled.</span>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                        <button type="button" onClick={() => extras.setTemplateOpen(true)} className="inline-flex h-6 items-center gap-1 rounded-md border border-[#FDBA74] bg-white px-2 font-semibold hover:bg-[#FFE4D0]">
                            <Pencil className="h-3 w-3" /> Edit template
                        </button>
                        <button type="button" onClick={extras.clearTemplate} className="inline-flex h-6 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 font-semibold text-gray-600 hover:bg-gray-100" title="Hide the empty slots. Saved items are not affected.">
                            <X className="h-3 w-3" /> Remove grid
                        </button>
                    </div>
                </div>
            )}
            {extras.moveNotice && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{extras.moveNotice}</span>
                    <button type="button" onClick={extras.dismissMoveNotice} aria-label="Dismiss" className="rounded p-0.5 hover:bg-amber-100"><X className="h-3 w-3" /></button>
                </div>
            )}
        </>
    )
}

/** Confirm for Delete on a range of filled cells. */
export function BulkClearDialog({ extras }: { extras: any }) {
    const keys: string[] | null = extras?.pendingBulkClear
    if (!keys) return null
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={extras.cancelBulkClear}>
            <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 className="h-4 w-4" /></span>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Clear {keys.length} cell{keys.length === 1 ? "" : "s"}?</h3>
                        <p className="mt-1 text-xs text-gray-600">The hours in the selected cells will be deleted. Merged cells in the selection are left alone.</p>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={extras.cancelBulkClear} disabled={extras.isBulkClearing} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={extras.confirmBulkClear} disabled={extras.isBulkClearing} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                        {extras.isBulkClearing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Clear hours
                    </button>
                </div>
            </div>
        </div>
    )
}

const LEVEL_OF: Record<string, TemplateLevel> = { "Module": "module", "Sub Module": "submodule", "Topic": "topic", "Sub Topic": "subtopic" }
const LABEL_OF: Record<TemplateLevel, string> = { module: "Module", submodule: "Sub Module", topic: "Topic", subtopic: "Sub Topic" }

/** One empty row of the template grid. Hierarchy cells start where the slot
 *  starts (rowSpan covers the rows under it); the level, language and hour
 *  cells stay blank until the row's item exists. */
export function renderTemplateSlotRow(item: TemplateSlotItem, ctx: {
    courseHierarchy: string[]
    selectedPedagogyTypes: string[]
    activityTypes: Record<string, string[]>
    AddCellButton: (p: { onClick: () => void; label: string }) => React.ReactElement
    openAdd: (level: TemplateLevel, item: TemplateSlotItem) => boolean
    canAdd: (level: TemplateLevel, item: TemplateSlotItem) => boolean
}) {
    const hourTint: Record<string, string> = { iDo: "bg-yellow-50/60", weDo: "bg-orange-50/60", youDo: "bg-green-50/60" }
    return (
        <tr key={`tpl-${item.key}`} className="h-8">
            {(["Module", "Sub Module", "Topic", "Sub Topic"] as const).filter(l => ctx.courseHierarchy.includes(l)).map(l => {
                const level = LEVEL_OF[l]
                const span = item.starts[level]
                if (!span) return null
                const addable = ctx.canAdd(level, item)
                return (
                    <td key={level} rowSpan={span} className="border-r border-b border-dashed border-gray-400 bg-[#FFFBF7] p-1 align-middle">
                        {addable ? (
                            <ctx.AddCellButton label={LABEL_OF[level]} onClick={() => { ctx.openAdd(level, item) }} />
                        ) : (
                            <div className="text-center text-[11px] text-gray-300" title="Add the item to the left first">
                                —
                            </div>
                        )}
                    </td>
                )
            })}
            <td className="border-r border-b border-dashed border-gray-400 bg-[#FFFBF7]" />
            <td className="border-r border-b border-dashed border-gray-400 bg-white" />
            {ctx.selectedPedagogyTypes.length > 0 && (["iDo", "weDo", "youDo"] as const)
                .filter(t => ctx.selectedPedagogyTypes.includes(t))
                .flatMap(t => (ctx.activityTypes[t] || []).map(a => (
                    <td key={`${t}-${a}`} className={`border-r border-b border-dashed border-gray-300 ${hourTint[t]} min-w-[70px]`} />
                )))}
        </tr>
    )
}
