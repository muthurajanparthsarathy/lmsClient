"use client"

// The Level picker — MULTI-select. A level cell can hold any combination of
// Basic / Easy / Medium / Hard, emitted as a single combined string:
// picking Basic + Easy gives "Basic & Easy", Easy + Medium gives
// "Easy & Medium". The value stays a plain string so the level API and the
// row matcher keep working without transformation — formatLevels always emits
// LEVEL_OPTIONS order, so the same pair picked in either click order produces
// one identical string (level rows are matched by string equality).

import React, { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { LEVEL_OPTIONS, parseLevels, formatLevels } from "./constants"

export default function LevelMultiSelect({
    value,
    onChange,
    placeholder = "Select level",
    className = "",
    disabled = false,
}: {
    /** Combined level string — "Easy", "Easy & Medium", or empty. */
    value?: string | null
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    // Current picks, parsed back out of the combined string.
    const selected = parseLevels(value)
    // Re-format for display so a legacy value saved in another order ("Medium &
    // Easy") still shows the canonical "Easy & Medium".
    const display = formatLevels(selected)

    useEffect(() => {
        if (!open) return
        const onPointerDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onPointerDown)
        document.addEventListener("keydown", onKeyDown, true)
        return () => {
            document.removeEventListener("mousedown", onPointerDown)
            document.removeEventListener("keydown", onKeyDown, true)
        }
    }, [open])

    // Multi-select: clicking a level toggles it and leaves the menu open, so a
    // pair can be picked in two clicks. Unticking the last one clears the cell.
    const toggle = (level: string) => {
        const next = selected.includes(level)
            ? selected.filter((l) => l !== level)
            : [...selected, level]
        onChange(formatLevels(next))
    }

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors
                    ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-[#FDBA74]"}
                    ${open ? "border-[#F97316] ring-1 ring-[#FDBA74]" : ""}`}
            >
                <span className={display ? "text-slate-800" : "text-slate-400"}>
                    {display || placeholder}
                </span>
                <span className="flex items-center gap-1">
                    {display && !disabled && (
                        <span
                            role="button"
                            tabIndex={-1}
                            title="Clear"
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange("")
                            }}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                    {LEVEL_OPTIONS.map((level) => {
                        const isSelected = selected.includes(level)
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => toggle(level)}
                                className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs transition-colors
                                    ${isSelected ? "bg-[#FFF3EA] text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                            >
                                <span className="flex items-center gap-2">
                                    {/* Checkbox-style indicator — several levels can be on at once. */}
                                    <span
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors
                                            ${isSelected ? "border-[#F97316] bg-[#F97316] text-white" : "border-slate-300 bg-white"}`}
                                    >
                                        {isSelected && <Check className="h-2.5 w-2.5" />}
                                    </span>
                                    {level}
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
