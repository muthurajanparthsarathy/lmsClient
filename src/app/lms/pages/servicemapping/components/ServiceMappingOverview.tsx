"use client"

import type React from 'react'
import { Building2, Check, GraduationCap, ShoppingBag, Users } from 'lucide-react'
import ClientCardIllustration from '../../clientmanagement/features/ClientCardIllustration'
import { titleCase } from './titleCase'

/** Which tile a click selects: a business model, or '' for "every client"
 *  (the Total tile, which clears the model filter rather than adding one). */
export type OverviewModel = '' | 'B2B' | 'B2I' | 'B2C'

/** One service model under a business model, with how many services carry it
 *  — the `HTD: 2` chips. `count` is optional so a backend that cannot supply
 *  the breakdown still renders the chip as a plain name. */
export interface OverviewServiceModel {
    model: string
    count?: number
}

/** What a business-model tile states: the services mapped under that model and
 *  the per-service-model breakdown. Services only — this page counts services,
 *  and a client count beside every figure was a second number to read past. */
export interface OverviewModelData {
    services?: number
    serviceModels: OverviewServiceModel[]
}

// The four cards over the Service Mapping listing: Total · B2B · B2I · B2C,
// the same set Client Management's overview has.
//
// Compact by LAYOUT, not by shrinking the type: the height comes off the
// padding, the icon and the leading, while the label and the figure keep their
// size and go bold. These sit above a table that wants the vertical space, but
// a card nobody can read from a seat away is no saving.
//
// Every service model under the business model is listed — the chips wrap
// rather than collapsing into a "+N", because the card's job here is to say
// what that model actually covers. A tile filters the listing to its business
// model; a chip filters it to one service model. Both toggle.
//
// Typography is the app's own text scale — muted label, near-black figure —
// rather than a coloured headline number. Colour on this card carries meaning
// (the model's hue in the icon and the illustration, the outline on the live
// tile); using it on the numbers as well made four cards shout at once.
//
// The card is a <div> with an inner button, not a <button>: the chips are
// buttons too, and a button inside a button is invalid HTML.
export default function ServiceMappingOverview({
    totalServices,
    byModel,
    isError,
    activeModel,
    activeServiceModel,
    onSelectModel,
    onSelectServiceModel,
}: {
    /** Services across the whole institution, for the Total tile. */
    totalServices?: number
    byModel?: Partial<Record<'B2B' | 'B2I' | 'B2C', OverviewModelData>>
    isError: boolean
    /** Which tile reads as selected — '' when no business-model filter is
     *  applied (Total), or the single model the list is narrowed to. Left
     *  undefined when two models are picked at once: the cards are a
     *  one-model shortcut, not a mirror of every filter state, so they go
     *  quiet rather than half-claiming a state they can't express. */
    activeModel?: OverviewModel
    /** The single service model the list is narrowed to, if any. */
    activeServiceModel?: string
    onSelectModel?: (model: OverviewModel) => void
    /** Narrow to one service model under a business model. */
    onSelectServiceModel?: (model: Exclude<OverviewModel, ''>, serviceModel: string) => void
}) {
    // One figure per card, and it is always SERVICES — the whole book on the
    // Total tile, that model's share on the other three. The client count that
    // used to sit beside it is gone: this page is a list of services, and the
    // second figure made the reader work out which one the card was about.
    const cards: Array<{
        label: string
        model: OverviewModel
        /** Services — the card's one figure. */
        value?: number
        serviceModels: OverviewServiceModel[]
        icon: typeof Users
        color: string
        art: 'clients' | 'business' | 'institution' | 'consumer'
        tint: string
        ink: string
        /* The breakdown tags, in the card's OWN hue rather than a generic grey
         * pill. They read as part of the card they belong to, and a row of
         * them against the card's wash looks like a legend instead of like
         * five buttons someone left on it. `chipOn` is the live filter's: the
         * hue tinted and its border deepened, NOT painted solid — the tick
         * inside it is what says "this one", the same as on the card. */
        chip: string
        chipOn: string
    }> = [
        { label: 'Total Services', model: '', value: totalServices, serviceModels: [], icon: Users, color: 'bg-brand-wash text-brand-strong', art: 'clients', tint: '#fff4e9', ink: 'text-brand-strong', chip: 'border-brand-200 bg-white/70 text-brand-800 hover:border-brand-300 hover:bg-white', chipOn: 'border-brand-600 bg-brand-100 font-semibold text-brand-800' },
        { label: 'B2B Services', model: 'B2B', value: byModel?.B2B?.services, serviceModels: byModel?.B2B?.serviceModels ?? [], icon: Building2, color: 'bg-blue-50 text-blue-600', art: 'business', tint: '#edf5ff', ink: 'text-blue-600', chip: 'border-blue-200 bg-white/70 text-blue-800 hover:border-blue-300 hover:bg-white', chipOn: 'border-blue-600 bg-blue-100 font-semibold text-blue-800' },
        { label: 'B2I Services', model: 'B2I', value: byModel?.B2I?.services, serviceModels: byModel?.B2I?.serviceModels ?? [], icon: GraduationCap, color: 'bg-violet-50 text-violet-600', art: 'institution', tint: '#f4efff', ink: 'text-violet-600', chip: 'border-violet-200 bg-white/70 text-violet-800 hover:border-violet-300 hover:bg-white', chipOn: 'border-violet-600 bg-violet-100 font-semibold text-violet-800' },
        { label: 'B2C Services', model: 'B2C', value: byModel?.B2C?.services, serviceModels: byModel?.B2C?.serviceModels ?? [], icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600', art: 'consumer', tint: '#e6f7f0', ink: 'text-emerald-600', chip: 'border-emerald-200 bg-white/70 text-emerald-800 hover:border-emerald-300 hover:bg-white', chipOn: 'border-emerald-600 bg-emerald-100 font-semibold text-emerald-800' },
    ]

    const interactive = Boolean(onSelectModel)

    return (
        <div role="group" aria-label="Service mapping overview — filter by business model and service model" className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
            {cards.map(({ label, model, value, serviceModels, icon: Icon, color, art, tint, ink, chip, chipOn }) => {
                const isActive = interactive && activeModel === model
                // A model tile with nothing behind it would filter the list
                // down to nothing, so it isn't offered. Total stays live even at
                // zero — it is the "clear the filter" action.
                const disabled = interactive && model !== '' && value === 0
                const pressable = interactive && !disabled
                // Badge names go through the page's one casing rule: Title Case for
                // words, capitals kept for the acronyms (TD, HTD, CSR, COE).
                // Display only — the filter still sends the stored value.
                const chipLabel = (m: string) => titleCase(m)

                return (
                    <div
                        key={label}
                        style={{
                            // One background, selected or not: white for three
                            // quarters with the card's wash at the right edge.
                            // The selected card used to deepen that wash AND
                            // wear an outline — two loud cues for a state a
                            // tick says quietly (see the label row below).
                            background: `linear-gradient(110deg, var(--color-surface, #fff) 25%, ${tint} 100%)`,
                        } as React.CSSProperties}
                        // Compact: the four of them sit above a table that wants
                        // the vertical space, so the padding, the icon and the
                        // leading are all trimmed a step.
                        className={`group relative isolate flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg border border-hairline px-2.5 py-2 shadow-xs transition-shadow ${
                            pressable ? 'cursor-pointer hover:shadow-sm' : ''
                        } ${disabled ? 'opacity-60' : ''}`}
                    >
                        <div aria-hidden="true" className={`pointer-events-none absolute -right-4 bottom-0 -z-10 h-full w-20 opacity-20 sm:-right-2 sm:w-24 sm:opacity-40 xl:w-28 xl:opacity-60 ${ink}`}>
                            <ClientCardIllustration kind={art} />
                        </div>

                        {/* The figures: icon, then label over count. The
                            breakdown follows BELOW this block rather than
                            inside it, so the badges start at the card's own
                            left edge and get the full width to wrap across —
                            indented under the number, a long model name had
                            barely half the card to sit in.
                            Plain markup: the click target is the overlay at the
                            end of the card, so the WHOLE card is pressable. */}
                        <div className="flex min-w-0 items-center gap-2">
                            <span aria-hidden="true" className={`hidden size-8 shrink-0 items-center justify-center rounded-md border border-white/70 shadow-xs sm:inline-flex ${color}`}>
                                <Icon className="size-4" strokeWidth={2} />
                            </span>
                            <span className="min-w-0">
                                {/* The label, and the TICK — which is the whole
                                    of the selected state now. A card that is
                                    the live filter is marked, not repainted:
                                    the fill and the ring it used to take made
                                    four cards shout at each other over a table
                                    that is the actual subject of the page. */}
                                <span className="flex min-w-0 items-center gap-1">
                                    <span className={`min-w-0 truncate text-xs font-semibold leading-none ${
                                        pressable
                                            ? `group-hover:text-heading group-hover:underline group-hover:decoration-hairline-strong group-hover:underline-offset-2 ${isActive ? 'text-heading' : 'text-subtle'}`
                                            : 'text-subtle'
                                    }`}>
                                        {label}
                                    </span>
                                    {isActive && (
                                        // Tick AND the word: the symbol alone
                                        // is a mark you have to know the
                                        // meaning of, and this row is read at
                                        // a glance from across four near-
                                        // identical cards.
                                        <span className={`inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-[1px] text-[10px] font-medium ${chipOn}`}>
                                            <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
                                            Selected
                                        </span>
                                    )}
                                </span>
                                <span className="mt-1 block text-[19px] font-bold leading-none tracking-tight text-heading tabular-nums">
                                    {value !== undefined
                                        ? value.toLocaleString()
                                        : isError
                                            ? <span aria-label="Count unavailable">—</span>
                                            : <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="inline-block h-4 w-9 animate-pulse rounded bg-ink-100 align-middle" />}
                                </span>
                            </span>
                        </div>

                        {/* The breakdown, on its own row straight after the
                            count and starting at the card's left edge: EVERY
                            service model mapped under this business model, each
                            with how many services carry it — "HTD: 2, TD: 3".
                            Chips wrap onto a second line rather than collapsing
                            into a "+N", because the card's job is to say what
                            the model actually covers. Clicking one shows only
                            that service model; clicking the live one clears
                            it. */}
                        {model !== '' && serviceModels.length > 0 && (
                            // Above the card-wide click overlay (z-[1]), so a
                            // chip keeps its own click instead of being
                            // swallowed by the card's.
                            <div className="relative z-[2] flex flex-wrap items-center gap-1">
                                {serviceModels.map(({ model: serviceModel, count }) => {
                                    const chipActive = activeServiceModel === serviceModel && activeModel === model
                                    const name = chipLabel(serviceModel)
                                    return (
                                        <button
                                            key={serviceModel}
                                            type="button"
                                            onClick={() => onSelectServiceModel?.(
                                                model as Exclude<OverviewModel, ''>,
                                                chipActive ? '' : serviceModel,
                                            )}
                                            aria-pressed={chipActive}
                                            aria-label={count === undefined
                                                ? `${name} services`
                                                : `${name}: ${count} ${count === 1 ? 'service' : 'services'}`}
                                            title={chipActive
                                                ? `Showing only ${name} — click to clear`
                                                : `Show only ${name} services`}
                                            /* A rounded-md TAG, not a pill: a
                                             * squarer corner sits better under
                                             * a figure and stops five of them
                                             * reading as a row of buttons. The
                                             * count is its own segment behind a
                                             * hairline instead of "HTD : 2" —
                                             * name and number stop competing
                                             * for the same line of text.
                                             *
                                             * shrink-0 + whitespace-nowrap is
                                             * the fix for half-read tags: in a
                                             * flex row they compressed to share
                                             * one line, so "Placement Training"
                                             * arrived as "Placement Trainin…".
                                             * Each keeps its own width and the
                                             * row wraps instead; max-w-full
                                             * still stops a pathological name
                                             * from pushing past the card, with
                                             * truncate + title for that case. */
                                            // `tracking-wide` because the names
                                            // are capitals now: set solid at
                                            // 10px, PLACEMENTTRAINING is what
                                            // the eye gets.
                                            className={`inline-flex h-[18px] max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[10px] leading-none tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
                                                chipActive ? chipOn : chip
                                            }`}
                                        >
                                            {/* The chosen badge is marked the
                                                same way the chosen card is — a
                                                tick beside its name — rather
                                                than by being painted solid.
                                                One vocabulary for "this is the
                                                live filter", at both levels. */}
                                            {chipActive && (
                                                <Check className="size-2.5 shrink-0" strokeWidth={3.5} aria-label="Selected" />
                                            )}
                                            <span className="min-w-0 truncate font-medium">{name}</span>
                                            {count !== undefined && (
                                                <>
                                                    <span aria-hidden className="h-2 w-px shrink-0 bg-current opacity-25" />
                                                    <span className="shrink-0 font-semibold tabular-nums">
                                                        {count.toLocaleString()}
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* The click target: a transparent button stretched over
                            the whole card, so ANY part of it filters — the
                            padding, the icon, the figures, the illustration.
                            An overlay rather than wrapping the card in a
                            <button>, because the chips are buttons too and a
                            button inside a button is invalid HTML. It sits
                            above the card (z-[1]) and below the chips (z-[2]),
                            which is what lets a chip keep its own click. */}
                        {pressable && (
                            <button
                                type="button"
                                onClick={() => onSelectModel?.(isActive ? '' : model)}
                                aria-pressed={isActive}
                                aria-label={model
                                    ? (isActive ? `Showing only ${model} services — click to clear` : `Show only ${model} services`)
                                    : 'Show every service'}
                                title={model
                                    ? (isActive ? `Showing only ${model} services — click to clear` : `Show only ${model} services`)
                                    : 'Show every service'}
                                className="absolute inset-0 z-[1] cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
