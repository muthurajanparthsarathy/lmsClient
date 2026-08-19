"use client"

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

const PAGER_STEP =
    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-hairline-strong bg-surface ' +
    'text-xs font-medium text-subtle hover:border-line-hover hover:text-heading disabled:opacity-40 ' +
    'disabled:hover:border-hairline-strong disabled:cursor-not-allowed transition-colors duration-150'

export default function TableFooter({
    currentPage,
    totalPages,
    onPage,
    // Kept for API compatibility with the many existing callers even though
    // the row-size / count strip is no longer rendered — dropping the props
    // would break every listing page.
    from: _from,
    to: _to,
    total: _total,
    pageSize: _pageSize,
    onPageSize: _onPageSize,
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
        // Just the centred pager row — nothing else. Reference footer has
        // no page-size selector, no "Showing X of Y" strip, no options
        // toggle. flex-wrap so a full page-number window reflows on narrow
        // screens instead of being clipped.
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 sm:px-5 py-1.5">
            <button
                type="button"
                onClick={() => onPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className={PAGER_STEP}
            >
                <ChevronLeft size={13} />
                <span>Previous</span>
            </button>

            {pages.map((p, i) => (
                p === '…' ? (
                    <span key={`gap-${i}`} className="w-6 h-7 flex items-center justify-center text-xs text-faint">…</span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`w-7 h-7 rounded-control text-xs font-semibold tabular-nums flex items-center justify-center transition-colors duration-150 ${
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
                className={PAGER_STEP}
            >
                <span>Next</span>
                <ChevronRight size={13} />
            </button>
        </div>
    )
}
