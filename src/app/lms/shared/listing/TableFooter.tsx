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
    'inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface ' +
    'text-sm font-medium text-subtle hover:border-line-hover hover:text-heading disabled:opacity-40 ' +
    'disabled:hover:border-hairline-strong disabled:cursor-not-allowed transition-colors duration-150'

export default function TableFooter({
    currentPage,
    totalPages,
    onPage,
    // Kept for API compatibility with the many existing callers even though
    // the row-size / count strip is no longer rendered — dropping the props
    // would break every listing page.
    from,
    to,
    total,
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
    const showCount = total > 0
    const showPager = totalPages > 1

    return (
        // "Showing X–Y of Total" on the left, pager on the right. The
        // pager itself is HIDDEN when there's only one page — showing
        // a disabled Prev/Next pair plus a single non-interactive "1"
        // just added visual noise. The count strip stays so the user
        // still knows how many results are in view.
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-1.5">
            {/* Left: result count. Hidden if the caller doesn't pass a total. */}
            {showCount && (
                <div className="text-xs text-subtle tabular-nums">
                    Showing {from}–{to} of {total}
                </div>
            )}
            {!showCount && <span aria-hidden="true" />}

            {/* Right: pager — only when there's more than one page. */}
            {showPager && (
            <div className="flex flex-wrap items-center gap-2">
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
                    <span key={`gap-${i}`} className="w-6 h-8 flex items-center justify-center text-sm text-faint">…</span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        // Brighter brand orange for the active page — the
                        // shared `brand-strong` token maps to the 700 shade
                        // (brown-orange) which read too muted next to the
                        // rest of the toolbar.
                        className={`w-8 h-8 rounded-control text-sm font-semibold tabular-nums flex items-center justify-center transition-colors duration-150 ${
                            p === currentPage
                                ? 'text-white shadow-xs'
                                : 'border border-hairline-strong bg-surface text-subtle hover:border-line-hover hover:text-heading'
                        }`}
                        style={p === currentPage ? { background: '#F97316' } : undefined}
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
            )}
        </div>
    )
}
