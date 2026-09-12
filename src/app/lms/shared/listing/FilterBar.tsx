"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'

// The filter row as one card rather than a line of loose controls — the card
// is what makes several selects read as a single unit instead of clutter.
//
// Filters are passed in rather than hardcoded, so Clients and Services get the
// same bar with different contents.

export type FilterSelect = {
    key: string
    allLabel: string
    value: string
    onChange: (v: string) => void
    // [value, label] so ids can be stored while names are shown.
    options: [string, string][]
    minWidth?: number
}

// The canonical control recipe, expressed entirely in tokens so the focus ring
// and border can never drift apart across pages again.
export const CONTROL =
    'h-9 rounded-control border border-hairline-strong bg-surface text-xs text-ink-700 ' +
    'px-3 focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none ' +
    'hover:border-line-hover transition-colors duration-150'

// Chip-style select recipe: a filter with a value set lights up in the brand
// wash, so the active state is readable without opening a single menu.
const CHIP_SELECT =
    'h-9 rounded-chip border px-2.5 text-xs font-medium transition-colors duration-150 ' +
    'focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none'

export default function FilterBar({
    search,
    onSearch,
    searchPlaceholder,
    filters,
    hasActiveFilters,
    onClear,
}: {
    search: string
    onSearch: (v: string) => void
    searchPlaceholder: string
    filters: FilterSelect[]
    hasActiveFilters: boolean
    onClear: () => void
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.04, ease: [0.2, 0, 0, 1] }}
            className="bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs"
        >
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <input
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className={`${CONTROL} w-full pr-16 placeholder:text-faint`}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => onSearch('')}
                            aria-label="Clear search"
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-faint hover:text-heading transition-colors duration-150"
                        >
                            <X size={14} />
                        </button>
                    )}
                    {/* Trailing, not leading: these placeholders are long and a
                        leading icon pushes them into truncation. */}
                    <Search
                        size={15}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
                    />
                </div>

                {filters.map((f) => (
                    <select
                        key={f.key}
                        value={f.value}
                        onChange={(e) => f.onChange(e.target.value)}
                        className={`${CHIP_SELECT} ${
                            f.value
                                ? 'border-brand-500/40 bg-brand-wash text-brand-strong hover:bg-brand-wash-hover'
                                : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'
                        }`}
                        style={{ minWidth: f.minWidth || 120 }}
                        aria-label={f.allLabel}
                    >
                        <option value="">{f.allLabel}</option>
                        {f.options.map(([v, label]) => (
                            <option key={v} value={v}>{label}</option>
                        ))}
                    </select>
                ))}

                {/* Lit only when something is filtering, so the state is visible
                    without reading every select. */}
                <button
                    type="button"
                    onClick={onClear}
                    disabled={!hasActiveFilters}
                    title={hasActiveFilters ? 'Clear all filters' : 'No filters applied'}
                    aria-label="Clear all filters"
                    className={`w-9 h-9 rounded-control border flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                        hasActiveFilters
                            ? 'border-brand text-brand bg-brand-wash hover:bg-brand-wash-hover'
                            : 'border-hairline-strong text-line-muted cursor-not-allowed'
                    }`}
                >
                    <SlidersHorizontal size={16} />
                </button>

                <button
                    type="button"
                    onClick={onClear}
                    disabled={!hasActiveFilters}
                    className={`text-xs font-medium flex-shrink-0 transition-colors duration-150 ${
                        hasActiveFilters ? 'text-subtle hover:text-heading' : 'text-line-muted cursor-not-allowed'
                    }`}
                >
                    Clear
                </button>
            </div>
        </motion.div>
    )
}
