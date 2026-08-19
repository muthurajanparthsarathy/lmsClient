"use client"

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Count on the left, page size and pager on the right. The window keeps the
// current page centred and always shows first/last with ellipses, so the
// control's width doesn't jump around as you page through.
function pageWindow(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '…', current - 1, current, current + 1, '…', total]
}

const PAGER_BTN =
    'w-8 h-8 rounded-control border border-hairline-strong bg-surface text-subtle flex items-center ' +
    'justify-center hover:border-line-hover hover:text-heading disabled:opacity-40 ' +
    'disabled:hover:border-hairline-strong disabled:cursor-not-allowed transition-colors duration-150'

export default function TableFooter({
    from,
    to,
    total,
    pageSize,
    onPageSize,
    currentPage,
    totalPages,
    onPage,
}: {
    from: number
    to: number
    total: number
    pageSize: number
    onPageSize: (n: number) => void
    currentPage: number
    totalPages: number
    onPage: (p: number) => void
}) {
    const pages = pageWindow(currentPage, totalPages)

    return (
        <div className="flex items-center justify-between gap-4 flex-wrap px-4 sm:px-5 py-3 border-t border-hairline">
            <p className="text-xs text-subtle">
                {total === 0
                    ? 'No entries'
                    : `Showing ${from} to ${to} of ${total} ${total === 1 ? 'entry' : 'entries'}`}
            </p>

            {/* flex-wrap so a full page-number window (up to 7 buttons +
                prev/next + the page-size select, ~460px) reflows onto a
                second line on narrow screens instead of being clipped by
                the footer row's own overflow. */}
            <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                    value={pageSize}
                    onChange={(e) => onPageSize(parseInt(e.target.value, 10))}
                    // The CONTROL recipe minus its h-9/px-3 sizing: the footer
                    // control is deliberately one step smaller than the filter
                    // bar's, so the sizes stay literal and only the colour,
                    // radius and type migrate to tokens.
                    className="h-8 rounded-control border border-hairline-strong bg-surface text-xs text-ink-700 px-2.5 hover:border-line-hover focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none transition-colors duration-150"
                    aria-label="Rows per page"
                >
                    {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>{n} / page</option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => onPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                    className={PAGER_BTN}
                >
                    <ChevronLeft size={15} />
                </button>

                {pages.map((p, i) => (
                    p === '…' ? (
                        <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-faint">…</span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p)}
                            aria-current={p === currentPage ? 'page' : undefined}
                            className={`w-8 h-8 rounded-control text-xs font-semibold tabular-nums flex items-center justify-center transition-colors duration-150 ${
                                p === currentPage
                                    ? 'bg-brand-strong text-white shadow-xs'
                                    : 'border border-hairline-strong bg-surface text-subtle hover:border-line-hover hover:text-heading'
                            }`}
                        >
                            {p}
                        </button>
                    )
                ))}

                <button
                    type="button"
                    onClick={() => onPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                    className={PAGER_BTN}
                >
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    )
}
