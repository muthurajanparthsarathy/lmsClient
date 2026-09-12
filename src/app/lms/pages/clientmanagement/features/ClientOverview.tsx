"use client"

import { Building2, GraduationCap, Users } from 'lucide-react'
import ClientCardIllustration from './ClientCardIllustration'

export default function ClientOverview({ counts, isError }: {
    counts?: { total: number; b2b: number; b2i: number }
    isError: boolean
}) {
    const cards = [
        { label: 'Total clients', short: 'Total clients', value: counts?.total, icon: Users, color: 'bg-brand-wash text-brand-strong', art: 'clients', tint: '#fff4e9', ink: 'text-brand-strong' },
        { label: 'B2B clients', short: 'B2B clients', value: counts?.b2b, icon: Building2, color: 'bg-blue-50 text-blue-600', art: 'business', tint: '#edf5ff', ink: 'text-blue-600' },
        { label: 'B2I clients', short: 'B2I clients', value: counts?.b2i, icon: GraduationCap, color: 'bg-violet-50 text-violet-600', art: 'institution', tint: '#f4efff', ink: 'text-violet-600' },
    ] as const

    return (
        <dl aria-label="Client overview" className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            {cards.map(({ label, short, value, icon: Icon, color, art, tint, ink }) => (
                <div key={label} style={{ background: `linear-gradient(110deg, var(--color-surface, #fff) 25%, ${tint} 100%)` }} className="relative isolate flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-hairline px-2.5 py-3 shadow-xs sm:px-4">
                    <div aria-hidden="true" className={`pointer-events-none absolute -right-5 bottom-0 -z-10 h-full w-28 opacity-25 sm:-right-3 sm:w-32 sm:opacity-60 xl:right-0 xl:w-40 xl:opacity-100 ${ink}`}>
                        <ClientCardIllustration kind={art} />
                    </div>
                    <span aria-hidden="true" className={`hidden size-9 shrink-0 items-center justify-center rounded-lg border border-white/70 shadow-xs sm:inline-flex ${color}`}>
                        <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                        <dt className="text-[10px] font-medium leading-4 text-subtle sm:text-xs">{short}</dt>
                        <dd className="mt-0.5 text-xl font-semibold leading-6 tracking-tight text-heading tabular-nums sm:text-2xl sm:leading-7">
                            {value !== undefined ? value.toLocaleString() : isError ? <span aria-label="Count unavailable">—</span> : <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="my-1 block h-5 w-10 animate-pulse rounded bg-ink-100" />}
                        </dd>
                    </div>
                </div>
            ))}
        </dl>
    )
}
