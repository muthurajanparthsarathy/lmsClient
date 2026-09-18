"use client"

import { Users, Building2, CircleCheck, CirclePause, ChevronRight } from 'lucide-react'
import ClientCardIllustration from '../../clientmanagement/features/ClientCardIllustration'

/* The four header tiles, same card treatment as Service Mapping and Course
   Setup so the three admin lists read alike. Counts are institution-wide, not
   the current page or filter. */
export default function UsersOverview({ stats, isError, onViewUsersByRole }: {
    stats?: { users: number; clients: number; active: number; inactive: number }
    isError: boolean
    /** Opens the Users-by-role breakdown. Undefined until the counts have
     *  arrived, so the link never offers a modal with nothing in it. */
    onViewUsersByRole?: () => void
}) {
    const cards = [
        { label: 'Total clients', value: stats?.clients, icon: Building2, art: 'clients', color: 'text-brand-strong', tint: '#fff4e9', action: undefined },
        { label: 'Total users', value: stats?.users, icon: Users, art: 'business', color: 'text-blue-600', tint: '#edf5ff', action: onViewUsersByRole },
        { label: 'Active', value: stats?.active, icon: CircleCheck, art: 'institution', color: 'text-emerald-600', tint: '#ecfdf5', action: undefined },
        { label: 'Inactive', value: stats?.inactive, icon: CirclePause, art: 'business', color: 'text-slate-500', tint: '#f1f5f9', action: undefined },
    ] as const

    return <dl aria-label="User directory overview" className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-3">
        {cards.map(({ label, value, icon: Icon, art, color, tint, action }) => (
            <div
                key={label}
                style={{ background: `linear-gradient(110deg, var(--color-surface, #fff) 25%, ${tint})` }}
                className="relative isolate flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-hairline px-3 py-3 shadow-xs sm:px-4"
            >
                <div aria-hidden="true" className={`pointer-events-none absolute -right-3 bottom-0 -z-10 h-full w-32 opacity-50 ${color}`}>
                    <ClientCardIllustration kind={art} />
                </div>
                <span aria-hidden="true" className={`hidden size-9 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/70 shadow-xs sm:inline-flex ${color}`}>
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-subtle sm:text-xs">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold leading-6 tracking-tight text-heading tabular-nums sm:text-2xl">
                        {value !== undefined
                            ? value.toLocaleString()
                            : isError
                                ? '—'
                                : <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="block h-6 w-10 animate-pulse rounded bg-ink-100" />}
                    </dd>
                    {/* The way into the role breakdown. It lives on the tile it
                        describes rather than as its own button in the header,
                        so the number and the detail behind it stay together. */}
                    {action && (
                        <button
                            type="button"
                            onClick={action}
                            className="-ml-0.5 mt-0.5 inline-flex items-center gap-0.5 rounded px-0.5 text-[11px] font-medium text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                        >
                            View details
                            <ChevronRight className="size-3" />
                        </button>
                    )}
                </div>
            </div>
        ))}
    </dl>
}
