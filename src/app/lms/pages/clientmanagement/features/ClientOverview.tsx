"use client"

import type React from 'react'
import { Building2, GraduationCap, ShoppingBag, Users } from 'lucide-react'
import ClientCardIllustration from './ClientCardIllustration'

/** Which card a click selects: a business model, or '' for "every client"
 *  (the Total tile, which clears the model filter rather than adding one). */
export type OverviewModel = '' | 'B2B' | 'B2I' | 'B2C'

export default function ClientOverview({ counts, isError, activeModel, onSelect }: {
    counts?: { total: number; b2b: number; b2i: number; b2c: number }
    isError: boolean
    /** Which tile reads as selected — '' when no business-model filter is
     *  applied (Total), or the single model the list is narrowed to.
     *  Deliberately NOT defaulted to '': `undefined` means "no tile is
     *  active", which is the honest state when the toolbar's multi-select
     *  holds two models. The cards are a one-model shortcut, not a mirror
     *  of every filter state, so they go quiet rather than half-claiming
     *  one they can't express. */
    activeModel?: OverviewModel
    /** Clicking a tile narrows the list to that business model; clicking the
     *  already-active tile (or Total) clears it again. Omit the callback to
     *  render the tiles as plain, non-interactive figures. */
    onSelect?: (model: OverviewModel) => void
}) {
    // A selected tile is shown by FILLING it with its own hue, not by
    // outlining it — an outline that reads at a glance has to be dark
    // enough to fight the card, and four tiles in a row then look fenced.
    // `tint` is the resting wash (a whisper at the right edge); `tintOn`
    // is the same hue carried across the whole card when the tile is the
    // live filter. Both stay light enough for the text to sit on.
    const cards: Array<{
        label: string
        model: OverviewModel
        value?: number
        icon: typeof Users
        color: string
        art: 'clients' | 'business' | 'institution' | 'consumer'
        tint: string
        tintOn: string
        ink: string
        // The animated outline's colour when this tile is the live filter —
        // its own hue, so the ring belongs to the card it is drawn around.
        ring: string
    }> = [
        { label: 'Total clients', model: '', value: counts?.total, icon: Users, color: 'bg-brand-wash text-brand-strong', art: 'clients', tint: '#fff4e9', tintOn: '#ffe7d2', ink: 'text-brand-strong', ring: '#c2540f' },
        { label: 'B2B clients', model: 'B2B', value: counts?.b2b, icon: Building2, color: 'bg-blue-50 text-blue-600', art: 'business', tint: '#edf5ff', tintOn: '#dbeafe', ink: 'text-blue-600', ring: '#2563eb' },
        { label: 'B2I clients', model: 'B2I', value: counts?.b2i, icon: GraduationCap, color: 'bg-violet-50 text-violet-600', art: 'institution', tint: '#f4efff', tintOn: '#e7ddff', ink: 'text-violet-600', ring: '#7c3aed' },
        { label: 'B2C clients', model: 'B2C', value: counts?.b2c, icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600', art: 'consumer', tint: '#e6f7f0', tintOn: '#d0efe2', ink: 'text-emerald-600', ring: '#059669' },
    ]

    const interactive = Boolean(onSelect)

    return (
        // A plain grid rather than the <dl> this used to be: a <button> is not
        // valid as a child of <dl>, and once every tile is a filter control
        // the group/pressed semantics say more than dt/dd did.
        <div role="group" aria-label="Client overview — filter by business model" className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {cards.map(({ label, model, value, icon: Icon, color, art, tint, tintOn, ink, ring }) => {
                const isActive = activeModel === model
                // A model tile with nothing behind it would filter the list
                // down to zero rows, so it isn't offered. Total stays live
                // even at zero — it is the "clear the filter" action.
                const disabled = interactive && model !== '' && value === 0
                // Border stays the same hairline in both states. The selected
                // tile is told apart by its fill, its inked label, a slightly
                // lifted shadow — and the breathing outline (globals.css,
                // .card-selected-outline), which is what makes "this one is
                // the live filter" carry across four near-identical cards.
                // The outline is painted outside the border box, so it can
                // never move the card's content or fight its shadow.
                const shell = `group relative isolate flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-hairline px-2.5 py-3 text-left transition-[box-shadow,background] sm:px-4 ${
                    isActive ? 'shadow-sm card-selected-outline' : 'shadow-xs'
                } ${
                    interactive && !disabled
                        ? 'cursor-pointer hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25'
                        : ''
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`
                // Resting: white for three quarters, the wash only at the
                // right edge. Selected: the hue starts at the left and
                // deepens across, so the tile reads as switched on from
                // across the room without a single extra line of chrome.
                const background = {
                    background: isActive
                        ? `linear-gradient(110deg, ${tint} 0%, ${tintOn} 100%)`
                        : `linear-gradient(110deg, var(--color-surface, #fff) 25%, ${tint} 100%)`,
                    // Read by the outline keyframe; harmless when not selected.
                    '--card-ring': ring,
                } as React.CSSProperties

                // Black figures, muted label — the same professional treatment
                // Service Mapping's cards use, so the two overviews read as
                // one system. Colour on the card carries meaning instead:
                // the model's hue in the icon and the illustration, and the
                // outline on the live tile. "You can press this" is said by
                // the pointer, the hover shadow and the label's hover
                // underline, not by colouring the numbers.
                const labelClass = interactive
                    ? `${isActive ? 'font-semibold text-heading' : 'font-semibold text-subtle'} ${
                        disabled ? '' : 'group-hover:text-heading group-hover:underline group-hover:decoration-hairline-strong group-hover:underline-offset-2'
                    }`
                    : 'font-semibold text-subtle'
                const valueClass = 'text-heading'

                const body = (
                    <>
                        <div aria-hidden="true" className={`pointer-events-none absolute -right-5 bottom-0 -z-10 h-full w-28 opacity-25 sm:-right-3 sm:w-32 sm:opacity-60 xl:right-0 xl:w-40 xl:opacity-100 ${ink}`}>
                            <ClientCardIllustration kind={art} />
                        </div>
                        <span aria-hidden="true" className={`hidden size-9 shrink-0 items-center justify-center rounded-lg border border-white/70 shadow-xs sm:inline-flex ${color}`}>
                            <Icon className="size-[18px]" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                            {/* UPPERCASE, like Service Mapping's overview: the
                                card's name is a heading for the figure under
                                it, and small caps read as one at a glance
                                without competing with the number. */}
                            <span className={`block truncate text-[11px] uppercase leading-none tracking-wide ${labelClass}`}>{label}</span>
                            <span className={`mt-1.5 block text-xl font-bold leading-none tracking-tight tabular-nums sm:text-[22px] ${valueClass}`}>
                                {value !== undefined ? value.toLocaleString() : isError ? <span aria-label="Count unavailable">—</span> : <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="my-1 block h-5 w-10 animate-pulse rounded bg-ink-100" />}
                            </span>
                        </span>
                    </>
                )

                if (!interactive) {
                    return (
                        <div key={label} style={background} className={shell}>
                            {body}
                        </div>
                    )
                }

                return (
                    <button
                        key={label}
                        type="button"
                        style={background}
                        className={shell}
                        // Re-clicking the live tile drops back to every
                        // client, so the cards toggle instead of trapping
                        // the reader in a filter they have to go find the
                        // toolbar to undo.
                        onClick={() => onSelect?.(isActive ? '' : model)}
                        aria-pressed={isActive}
                        disabled={disabled}
                        title={model
                            ? `Show only ${model} clients`
                            : 'Show every client'}
                    >
                        {body}
                    </button>
                )
            })}
        </div>
    )
}
