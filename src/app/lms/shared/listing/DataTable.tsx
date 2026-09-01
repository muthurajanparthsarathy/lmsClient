"use client"

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronsUpDown, ChevronUp, ChevronDown, Inbox, SearchX, MoreVertical, X } from 'lucide-react'
import { Checkbox } from '../ui/FieldKit'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
} from '@/components/ui/dropdown-menu'

// The listing table used by every Business Management tab, so Clients and
// Services stay identical without either page restating the styling.
//
// Two decisions carry it:
//  - The body scrolls and the header sticks. With a hundred rows the column
//    labels are the first thing you lose, and they're what tells you which
//    column you're reading.
//  - Loading is a skeleton, not a spinner. The table's shape is already known,
//    so holding the layout stops the page jumping when the data lands.
//
// The callers own the card shell (rounded-xl border-hairline shadow-xs
// overflow-hidden) — this component is only the scroll region inside it, which
// is why it draws no outer border of its own.

export type Column<T> = {
    key: string
    label: string
    // Present = sortable. The value is what the parent sorts by.
    sortKey?: string
    className?: string
    render: (row: T, index: number) => React.ReactNode
    // Width of the skeleton bar while loading, as a CSS width.
    skeletonWidth?: string
}

export type SortDir = 'asc' | 'desc'

export function DataTable<T>({
    rows,
    columns,
    rowKey,
    sortKey,
    sortDir,
    onSort,
    isLoading,
    isFiltered,
    emptyTitle,
    emptyHint,
    emptyAction,
    onEmptyAction,
    minWidth = 720,
    fixedLayout = false,
    maxHeight = 'calc(100vh * var(--ui-scale-inv, 1) - 360px)',
    fillHeight = false,
    loading,
    emptyState,
    selectedKeys,
    onSelectionChange,
    bulkActions,
    rowActions,
    rowClassName,
}: {
    rows: T[]
    columns: Column<T>[]
    rowKey: (row: T) => string
    sortKey: string | null
    sortDir: SortDir
    onSort: (key: string) => void
    isLoading: boolean
    isFiltered: boolean
    emptyTitle: string
    emptyHint: string
    // Both optional: when either is undefined the empty-state CTA hides,
    // letting callers permission-gate the action (e.g. "+ New Mapping").
    emptyAction?: string
    onEmptyAction?: () => void
    minWidth?: number
    // When true the table uses `table-layout: fixed` with NO minimum width:
    // the column classNames' percentage widths (which should sum to 100%)
    // decide the layout, cells clip/ellipsize instead of growing, and the
    // table can never exceed its container — i.e. no horizontal scrollbar.
    // Callers own truncation (`truncate` + title tooltips) on cell content.
    fixedLayout?: boolean
    maxHeight?: string
    // When true, the scroll region grows to fill its parent's remaining
    // height (flex-1 min-h-0) instead of capping at maxHeight. Only works
    // if every ancestor up to a definite-height container is
    // `flex flex-col min-h-0` — otherwise it collapses to min-h-[220px].
    fillHeight?: boolean
    // Additive alias for isLoading, so newer call sites can use the shared
    // { loading, emptyState } convention without touching the old contract.
    loading?: boolean
    // When provided, replaces the built-in empty message wholesale.
    emptyState?: React.ReactNode
    // Selection is opt-in: pass BOTH selectedKeys and onSelectionChange to get
    // the checkbox column. Keys are whatever rowKey() returns.
    selectedKeys?: string[]
    onSelectionChange?: (keys: string[]) => void
    // Rendered inside the floating bulk bar (buttons, menus). The bar itself —
    // count, Clear, slide-up motion — is owned here so every table matches.
    bulkActions?: (selectedKeys: string[]) => React.ReactNode
    // Per-row kebab menu content (DropdownMenuItem elements). The trigger and
    // the trailing column appear only when this is provided.
    rowActions?: (row: T, index: number) => React.ReactNode
    // Per-row className override — lets callers tint a row's background
    // based on its state (e.g. active/inactive, submitted/not-submitted).
    // Whatever this returns is appended to the base row classes so hover
    // and selected states still work; return "" for the default surface.
    rowClassName?: (row: T, index: number) => string
}) {
    const showSkeleton = isLoading || loading
    const selectable = Boolean(selectedKeys && onSelectionChange)
    const selected = selectedKeys ?? []
    const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

    const visibleKeys = rows.map(rowKey)
    const allSelected = rows.length > 0 && visibleKeys.every((k) => selected.includes(k))

    const toggleAll = () => {
        if (!onSelectionChange) return
        onSelectionChange(
            allSelected
                ? selected.filter((k) => !visibleKeys.includes(k))
                : Array.from(new Set([...selected, ...visibleKeys]))
        )
    }

    const toggleRow = (key: string) => {
        if (!onSelectionChange) return
        onSelectionChange(
            selected.includes(key)
                ? selected.filter((k) => k !== key)
                : [...selected, key]
        )
    }

    const headerCellClasses =
        'h-8 align-middle bg-canvas border-b border-hairline'

    return (
        <>
        <div
            // fixedLayout: columns sum to 100%, so the X axis can never
            // overflow and stays clipped. The Y axis SCROLLS rather than
            // clipping — the page size is a plain number, so a page of 10 in a
            // box that fits 9 used to hide the tenth row with no way to reach
            // it. When the rows do fit, no scrollbar appears. The header is
            // sticky, so it survives the scroll either way.
            className={
                fillHeight
                    ? `flex-1 min-h-[220px] ${fixedLayout ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto'}`
                    : `min-h-[220px] ${fixedLayout ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto'}`
            }
            style={fillHeight ? undefined : { maxHeight }}
        >
            <table
                className="w-full border-collapse"
                style={fixedLayout ? { tableLayout: 'fixed', width: '100%' } : { minWidth }}
            >
                <thead className="sticky top-0 z-10">
                    <tr>
                        {selectable && (
                            <th className={`${headerCellClasses} w-11 px-3 text-left`}>
                                <Checkbox
                                    aria-label="Select all rows"
                                    checked={allSelected}
                                    onCheckedChange={toggleAll}
                                    disabled={showSkeleton || rows.length === 0}
                                />
                            </th>
                        )}
                        {columns.map((c) => {
                            const isSorted = c.sortKey && sortKey === c.sortKey
                            return (
                                <th
                                    key={c.key}
                                    // Border on the cell, not the row: a sticky
                                    // <tr>'s own border scrolls away in Chrome
                                    // and leaves the header visually floating.
                                    // `!` on the size / weight / color so column
                                    // classes (which target BODY cells with
                                    // things like `text-[12px] text-body`) can't
                                    // overwrite the header rhythm. Without this
                                    // the You_Do assessment header rendered as
                                    // designed (dark 10 px uppercase) but the
                                    // We_Do assignment header leaked the body
                                    // text-body colour + text-[12px] size.
                                    className={`${c.className || 'px-3 text-left'} h-10 !text-[12px] !font-semibold !text-ink-600 align-middle bg-canvas border-b border-hairline`}
                                >
                                    {c.sortKey ? (
                                        <button
                                            type="button"
                                            onClick={() => onSort(c.sortKey as string)}
                                            className="inline-flex items-center gap-1.5 hover:text-heading transition-colors duration-150"
                                        >
                                            {c.label}
                                            {isSorted
                                                ? (sortDir === 'asc'
                                                    ? <ChevronUp size={13} className="text-brand" />
                                                    : <ChevronDown size={13} className="text-brand" />)
                                                : <ChevronsUpDown size={13} className="text-line-muted" />}
                                        </button>
                                    ) : c.label}
                                </th>
                            )
                        })}
                        {rowActions && (
                            <th
                                className={`${headerCellClasses} w-12 px-3 text-right`}
                                aria-label="Row actions"
                            />
                        )}
                    </tr>
                </thead>

                <tbody>
                    {showSkeleton ? (
                        Array.from({ length: 7 }).map((_, i) => (
                            <tr key={i} className="border-b border-hairline">
                                {selectable && (
                                    <td className="w-11 px-3 h-11 align-middle">
                                        <div
                                            className="size-4.5 rounded-[5px] bg-ink-100 animate-pulse"
                                            style={{ animationDelay: `${i * 60}ms` }}
                                        />
                                    </td>
                                )}
                                {columns.map((c) => (
                                    <td key={c.key} className={`${c.className || 'px-3'} h-11 align-middle`}>
                                        <div
                                            className="h-3 rounded bg-ink-100 animate-pulse"
                                            // Staggered so the row reads as one
                                            // shimmering unit rather than eight
                                            // separate blinking boxes.
                                            style={{ width: c.skeletonWidth || '70%', animationDelay: `${i * 60}ms` }}
                                        />
                                    </td>
                                ))}
                                {rowActions && (
                                    <td className="w-12 px-3 h-11 align-middle">
                                        <div
                                            className="ml-auto size-4.5 rounded bg-ink-100 animate-pulse"
                                            style={{ animationDelay: `${i * 60}ms` }}
                                        />
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : rows.length === 0 ? (
                        <tr>
                            <td colSpan={colCount} className="py-14">
                                {emptyState ?? (
                                    <div className="flex flex-col items-center text-center gap-2.5">
                                        <div className="w-12 h-12 rounded-tile bg-brand-wash flex items-center justify-center">
                                            {isFiltered
                                                ? <SearchX size={21} className="text-brand" />
                                                : <Inbox size={21} className="text-brand" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-heading">{emptyTitle}</p>
                                            <p className="text-xs text-subtle mt-0.5">{emptyHint}</p>
                                        </div>
                                        {emptyAction && onEmptyAction && (
                                        <button
                                            type="button"
                                            onClick={onEmptyAction}
                                            className="h-8 px-3.5 rounded-control bg-brand-strong text-white text-xs font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                                        >
                                            {emptyAction}
                                        </button>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, i) => {
                            const key = rowKey(row)
                            const isSelected = selectable && selected.includes(key)
                            return (
                                <motion.tr
                                    key={key}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    // Only the first handful stagger — past that the
                                    // delay would outlast the user's patience.
                                    transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.022 }}
                                    // Thin hairline between rows so the reader has
                                    // a clear separator without heavy grid lines.
                                    // rowClassName lets the caller tint a row
                                    // by state (active/inactive, submitted, etc.).
                                    className={`border-b border-hairline last:border-0 transition-colors ${isSelected ? 'bg-brand-wash/60 hover:bg-brand-wash' : 'hover:bg-row-hover'} ${rowClassName ? rowClassName(row, i) : ''}`}
                                >
                                    {selectable && (
                                        <td className="w-11 px-3 h-11 align-middle">
                                            <Checkbox
                                                aria-label={`Select row ${i + 1}`}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleRow(key)}
                                            />
                                        </td>
                                    )}
                                    {columns.map((c) => (
                                        // Uniform row cells — no first-column emphasis.
                                        // h-11 (44px) + 12px cell text = the Course
                                        // Setup density the four admin lists (Clients,
                                        // Users, Services, Course Setup) now share.
                                        <td
                                            key={c.key}
                                            className={`${c.className || 'px-3'} h-12 align-middle text-[13px] text-body`}
                                        >
                                            {c.render(row, i)}
                                        </td>
                                    ))}
                                    {rowActions && (
                                        <td className="w-12 px-3 h-11 align-middle text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        aria-label="Row actions"
                                                        className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
                                                    >
                                                        <MoreVertical size={15} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" sideOffset={4}>
                                                    {rowActions(row, i)}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    )}
                                </motion.tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>

        {selectable && (
            <AnimatePresence>
                {selected.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 16, x: '-50%' }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        // Fixed to the viewport: the table body scrolls inside
                        // its own region, so an in-flow bar would drift out of
                        // sight exactly when a long selection needs it most.
                        className="fixed bottom-6 left-1/2 z-dropdown flex items-center gap-3 rounded-full bg-ink-900 py-2 pl-4 pr-2 text-white shadow-xl"
                    >
                        <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
                            {selected.length} selected
                        </span>
                        {bulkActions && (
                            <>
                                <span className="h-4 w-px bg-white/20" />
                                <span className="flex items-center gap-1.5">
                                    {bulkActions(selected)}
                                </span>
                            </>
                        )}
                        <button
                            type="button"
                            aria-label="Clear selection"
                            onClick={() => onSelectionChange?.([])}
                            className="inline-flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        )}
        </>
    )
}

export default DataTable
