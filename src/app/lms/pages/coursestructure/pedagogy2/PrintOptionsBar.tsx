"use client"

// Pedagogy Preview ▸ print / export options as ONE toolbar of dropdowns.
//
// Replaces five stacked cards (Course Hierarchy, Level, Options, Export
// Options, Teaching Elements, Customized Print Summary) that took a third of
// the dialog before the table even started. Every control is the same and
// writes the same `exportSelections` fields with the same rules:
//   · "All" covers the hierarchy levels only while teaching elements are on
//     (Level has its own tick then), and includes Level when they are off,
//     exactly as the two old layouts did
//   · Hours: '' | 'activity' | 'element', with Clear back to ''
//   · teaching elements / print-summary elements: per-activity arrays
// Each trigger shows what it's set to, so the reader can see the whole
// setup without opening anything.

import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Clock, Columns3, FileText, Layers, ListChecks, Printer, Presentation, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

// A small in-place dropdown rather than the Radix DropdownMenu. Radix portals
// its menu to <body>, outside the Preview dialog; the dialog is modal, so it
// blocks pointer events and pulls focus back from anything outside it, and
// the menu closed on the first click inside it. Rendering the panel inside
// the dialog's own tree avoids that. It stays open while you tick, and closes
// on a click outside it or on Esc.
const MenuCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} })

function DropdownMenu({ children }: { children: React.ReactNode; modal?: boolean }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false) } }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey, true)
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true) }
    }, [open])
    return (
        <MenuCtx.Provider value={{ open, setOpen }}>
            <div ref={ref} className="relative">{children}</div>
        </MenuCtx.Provider>
    )
}
function DropdownMenuTrigger({ children }: { children: React.ReactElement<any>; asChild?: boolean }) {
    const { open, setOpen } = useContext(MenuCtx)
    return React.cloneElement(children, {
        "data-state": open ? "open" : "closed",
        "aria-expanded": open,
        "aria-haspopup": "menu",
        onClick: () => setOpen(!open),
    })
}
function DropdownMenuContent({ children, className = "", align = "start" }: { children: React.ReactNode; className?: string; align?: "start" | "end" }) {
    const { open } = useContext(MenuCtx)
    if (!open) return null
    return (
        <div
            role="menu"
            className={`absolute top-full z-[60] mt-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg ${align === "end" ? "right-0" : "left-0"} ${className}`}
        >
            {children}
        </div>
    )
}
const DropdownMenuLabel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
    <div className={`px-2 py-1.5 text-xs font-semibold ${className}`}>{children}</div>
const DropdownMenuSeparator = () => <div className="-mx-1 my-1 h-px bg-slate-100" />

type PType = "iDo" | "weDo" | "youDo"
const PTYPES: { key: PType; label: string; icon: React.ElementType; tone: string; chip: string }[] = [
    { key: "iDo", label: "I Do", icon: Presentation, tone: "text-amber-700", chip: "bg-amber-50 border-amber-200 text-amber-800" },
    { key: "weDo", label: "We Do", icon: Users, tone: "text-rose-700", chip: "bg-rose-50 border-rose-200 text-rose-800" },
    { key: "youDo", label: "You Do", icon: User, tone: "text-emerald-700", chip: "bg-emerald-50 border-emerald-200 text-emerald-800" },
]

/** A tickable row that keeps the menu open (Radix closes on select by default). */
function TickRow({ checked, onToggle, children, muted, indent }: { checked: boolean; onToggle: () => void; children: React.ReactNode; muted?: boolean; indent?: boolean }) {
    return (
        <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={(e) => { e.preventDefault(); onToggle() }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#FFF3EA] focus:bg-[#FFF3EA] focus:outline-none ${indent ? "pl-6" : ""} ${muted ? "text-slate-400" : "text-slate-700"}`}
        >
            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-[#F97316] bg-[#F97316] text-white" : "border-slate-300 bg-white"}`}>
                {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className="flex-1">{children}</span>
        </button>
    )
}

function Trigger({ icon: Icon, label, value, active }: { icon: React.ElementType; label: string; value: string; active?: boolean }) {
    return (
        <DropdownMenuTrigger asChild>
            <button
                type="button"
                className={`group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors data-[state=open]:border-[#F97316] data-[state=open]:bg-[#FFF3EA] ${active ? "border-[#FDBA74] bg-[#FFF8F2]" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
                <Icon className="h-3.5 w-3.5 text-[#F97316]" />
                <span className="font-semibold text-slate-700">{label}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 group-data-[state=open]:bg-white">{value}</span>
                <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
            </button>
        </DropdownMenuTrigger>
    )
}

/** Per-activity ticks for I Do / We Do / You Do, shared by Teaching Elements
 *  and Print Summary (they write different fields). */
function ElementLists({ types, activityTypes, selected, onChange }: {
    types: PType[]
    activityTypes: Record<string, string[]>
    selected: Partial<Record<PType, string[]>>
    onChange: (type: PType, next: string[]) => void
}) {
    return (
        <>
            {PTYPES.filter(p => types.includes(p.key)).map((p, i) => {
                const all = activityTypes[p.key] || []
                const cur = Array.isArray(selected[p.key]) ? selected[p.key]! : []
                const Icon = p.icon
                return (
                    <div key={p.key}>
                        {i > 0 && <DropdownMenuSeparator />}
                        <TickRow checked={all.length > 0 && cur.length === all.length} onToggle={() => onChange(p.key, cur.length === all.length ? [] : [...all])}>
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${p.tone}`}>
                                <Icon className="h-3.5 w-3.5" /> {p.label}
                                <span className={`rounded-full border px-1.5 text-[10px] ${p.chip}`}>{cur.length}/{all.length}</span>
                            </span>
                        </TickRow>
                        {all.map(a => (
                            <TickRow key={a} indent checked={cur.includes(a)} onToggle={() => onChange(p.key, cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a])}>
                                {a}
                            </TickRow>
                        ))}
                    </div>
                )
            })}
        </>
    )
}

export default function PrintOptionsBar({
    exportSelections, setExportSelections, activityTypes, selectedPedagogyTypes, selectedCourse, handlePrint, exportToExcel,
}: {
    exportSelections: any
    setExportSelections: (fn: (prev: any) => any) => void
    activityTypes: Record<string, string[]>
    selectedPedagogyTypes: string[]
    selectedCourse: any
    handlePrint: () => void
    exportToExcel: () => void
}) {
    const hierarchy: string[] = selectedCourse?.courseHierarchy || []
    const teachingTypes = PTYPES.map(p => p.key).filter(k => selectedPedagogyTypes.includes(k))
    const hasTeaching = teachingTypes.length > 0

    // ── Columns (hierarchy + level) ──
    const LEVELS: { name: string; key: "module" | "subModule" | "topic" | "subTopic" }[] = [
        { name: "Module", key: "module" }, { name: "Sub Module", key: "subModule" },
        { name: "Topic", key: "topic" }, { name: "Sub Topic", key: "subTopic" },
    ]
    const present = LEVELS.filter(l => hierarchy.includes(l.name))
    const h = exportSelections.hierarchy || {}
    const allHierarchy = present.every(l => h[l.key]) && (hasTeaching || h.level)
    const toggleAll = () => {
        const on = !allHierarchy
        setExportSelections((prev: any) => ({
            ...prev,
            hierarchy: {
                module: hierarchy.includes("Module") ? on : prev.hierarchy.module,
                subModule: hierarchy.includes("Sub Module") ? on : prev.hierarchy.subModule,
                topic: hierarchy.includes("Topic") ? on : prev.hierarchy.topic,
                subTopic: hierarchy.includes("Sub Topic") ? on : prev.hierarchy.subTopic,
                level: hasTeaching ? prev.hierarchy.level : on,
            },
        }))
    }
    const setLevel = (key: string, on: boolean) =>
        setExportSelections((prev: any) => ({ ...prev, hierarchy: { ...prev.hierarchy, [key]: on } }))
    const columnsOn = present.filter(l => h[l.key]).length + (h.level ? 1 : 0)

    // ── Teaching elements ──
    const ped = exportSelections.pedagogy || {}
    const allElements = teachingTypes.every(t => Array.isArray(ped[t]) && ped[t].length === (activityTypes[t] || []).length)
    const elementsOn = teachingTypes.reduce((n, t) => n + (Array.isArray(ped[t]) ? ped[t].length : 0), 0)
    const elementsAll = teachingTypes.reduce((n, t) => n + (activityTypes[t] || []).length, 0)
    const setAllElements = (field: "pedagogy" | "printPedagogy", on: boolean) =>
        setExportSelections((prev: any) => ({
            ...prev,
            [field]: {
                ...prev[field],
                ...Object.fromEntries(PTYPES.map(p => [p.key, selectedPedagogyTypes.includes(p.key)
                    ? (on ? [...(activityTypes[p.key] || [])] : [])
                    : (prev[field]?.[p.key] || [])])),
            },
        }))

    // ── Print summary ──
    const pp = exportSelections.printPedagogy || {}
    const allPrint = teachingTypes.every(t => Array.isArray(pp[t]) && pp[t].length === (activityTypes[t] || []).length)

    const hoursLabel = exportSelections.hoursOption === "activity" ? "Activity" : exportSelections.hoursOption === "element" ? "Element" : "None"

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Columns */}
            <DropdownMenu modal={false}>
                <Trigger icon={Columns3} label="Columns" value={`${columnsOn}/${present.length + 1}`} active={columnsOn > 0} />
                <DropdownMenuContent align="start" className="w-60">
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Course hierarchy</DropdownMenuLabel>
                    <TickRow checked={allHierarchy} onToggle={toggleAll}><span className="font-semibold">All</span></TickRow>
                    {present.map(l => (
                        <TickRow key={l.key} indent checked={!!h[l.key]} onToggle={() => setLevel(l.key, !h[l.key])}>{l.name}</TickRow>
                    ))}
                    <DropdownMenuSeparator />
                    <TickRow checked={!!h.level} onToggle={() => setLevel("level", !h.level)}>
                        <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-green-600" /> Level</span>
                    </TickRow>
                    {hasTeaching && (
                        <>
                            <DropdownMenuSeparator />
                            <TickRow
                                checked={!!exportSelections.includeTotalHours}
                                muted={!allElements}
                                onToggle={() => setExportSelections((prev: any) => ({ ...prev, includeTotalHours: !prev.includeTotalHours }))}
                            >
                                Include Total Hours
                                {!allElements && <span className="block text-[10px] text-slate-400">Needs every teaching element ticked</span>}
                            </TickRow>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {hasTeaching && (
                <>
                    {/* Hours display */}
                    <DropdownMenu modal={false}>
                        <Trigger icon={Clock} label="Hours" value={hoursLabel} active={!!exportSelections.hoursOption} />
                        <DropdownMenuContent align="start" className="w-64">
                            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Show hours as</DropdownMenuLabel>
                            {([
                                ["", "None", "No hours columns"],
                                ["activity", "Activity Hours", "Show category totals"],
                                ["element", "Element Hours", "Show individual activities"],
                            ] as const).map(([v, l, hint]) => (
                                <button
                                    key={v || "none"}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={(exportSelections.hoursOption || "") === v}
                                    onClick={(e) => { e.preventDefault(); setExportSelections((prev: any) => ({ ...prev, hoursOption: v })) }}
                                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#FFF3EA] focus:bg-[#FFF3EA] focus:outline-none"
                                >
                                    <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${(exportSelections.hoursOption || "") === v ? "border-[#F97316]" : "border-slate-300"}`}>
                                        {(exportSelections.hoursOption || "") === v && <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />}
                                    </span>
                                    <span>
                                        <span className="block font-medium text-slate-700">{l}</span>
                                        <span className="block text-[10px] text-slate-400">{hint}</span>
                                    </span>
                                </button>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Teaching elements */}
                    <DropdownMenu modal={false}>
                        <Trigger icon={ListChecks} label="Teaching Elements" value={`${elementsOn}/${elementsAll}`} active={elementsOn > 0} />
                        <DropdownMenuContent align="start" className="max-h-[60vh] w-64">
                            <TickRow checked={allElements} onToggle={() => setAllElements("pedagogy", !allElements)}><span className="font-semibold">Select All</span></TickRow>
                            <DropdownMenuSeparator />
                            <ElementLists
                                types={teachingTypes}
                                activityTypes={activityTypes}
                                selected={ped}
                                onChange={(type, next) => setExportSelections((prev: any) => ({ ...prev, pedagogy: { ...prev.pedagogy, [type]: next } }))}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Customized print summary */}
                    <DropdownMenu modal={false}>
                        <Trigger icon={FileText} label="Print Summary" value={exportSelections.showSummary ? "On" : "Off"} active={!!exportSelections.showSummary} />
                        <DropdownMenuContent align="start" className="max-h-[60vh] w-64">
                            <TickRow
                                checked={!!exportSelections.showSummary}
                                onToggle={() => setExportSelections((prev: any) => ({ ...prev, showSummary: !prev.showSummary }))}
                            >
                                <span className="font-semibold">Include customized summary in print</span>
                            </TickRow>
                            <div className={exportSelections.showSummary ? "" : "pointer-events-none opacity-50"}>
                                <TickRow
                                    checked={!!exportSelections.summaryIncludeTotalHours}
                                    onToggle={() => setExportSelections((prev: any) => ({ ...prev, summaryIncludeTotalHours: !prev.summaryIncludeTotalHours }))}
                                >
                                    Include Total Hours
                                </TickRow>
                                <DropdownMenuSeparator />
                                <TickRow checked={allPrint} onToggle={() => setAllElements("printPedagogy", !allPrint)}><span className="font-semibold">Select All</span></TickRow>
                                <ElementLists
                                    types={teachingTypes}
                                    activityTypes={activityTypes}
                                    selected={pp}
                                    onChange={(type, next) => setExportSelections((prev: any) => ({ ...prev, printPedagogy: { ...prev.printPedagogy, [type]: next } }))}
                                />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            {/* Export */}
            <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-100">
                    <Printer className="mr-1 h-3.5 w-3.5" /> Print
                </Button>
                <Button size="sm" onClick={() => exportToExcel()} className="h-8 px-3 text-xs bg-[#F97316] text-white hover:bg-[#C2540F]">
                    <FileText className="mr-1 h-3.5 w-3.5" /> Excel
                </Button>
            </div>
        </div>
    )
}
