"use client"

// The Level picker — SINGLE-select. A level cell holds exactly one of
// Basic / Easy / Medium / Hard; the older multi-select behavior that emitted
// combined strings like "Easy & Medium" was retired. The value stays a plain
// string (one of LEVEL_OPTIONS or empty) so the level API and row matcher
// keep working without transformation.
//
// The file/component name stays "LevelMultiSelect" so every existing import
// keeps compiling; the behavior is what changed.

import React, { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { LEVEL_OPTIONS } from "./constants"

export default function LevelMultiSelect({
    value,
    onChange,
    placeholder = "Select level",
    className = "",
    disabled = false,
}: {
    /** Exactly one of LEVEL_OPTIONS, or empty string. Legacy combined strings
     *  ("Easy & Medium") are treated as unset — the user must re-pick. */
    value?: string | null
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    // Normalize: only render the current value if it's a known single level.
    const currentSingle = LEVEL_OPTIONS.find((o) => o === (value ?? "")) ?? ""

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

    // Single-select: clicking a level replaces the current value and closes
    // the menu. Clicking the already-selected level clears it.
    const select = (level: string) => {
        onChange(level === currentSingle ? "" : level)
        setOpen(false)
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
                <span className={currentSingle ? "text-slate-800" : "text-slate-400"}>
                    {currentSingle || placeholder}
                </span>
                <span className="flex items-center gap-1">
                    {currentSingle && !disabled && (
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
                        const isSelected = currentSingle === level
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => select(level)}
                                className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs transition-colors
                                    ${isSelected ? "bg-[#FFF3EA] text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                            >
                                <span className="flex items-center gap-2">
                                    {/* Radio-style indicator — single choice, not a checkbox. */}
                                    <span
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors
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
