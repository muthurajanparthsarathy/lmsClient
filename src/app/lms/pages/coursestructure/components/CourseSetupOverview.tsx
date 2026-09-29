"use client"

import { Users, BookOpen, CircleCheck, CirclePause } from 'lucide-react'
import ClientCardIllustration from '../../clientmanagement/features/ClientCardIllustration'
import type { MappingSetupStats } from '@/app/lms/pages/servicemapping/api/serviceMappingService'

/* Course Setup's four header tiles — the same card treatment Service Mapping
   uses, counting courses rather than services. Active/inactive comes from the
   mapping each course sits under: a course has no active flag of its own. */
export default function CourseSetupOverview({ stats, isError }: {
    stats?: MappingSetupStats
    isError: boolean
}) {
    const cards = [
        { label: 'Total clients', value: stats?.clients, icon: Users, art: 'clients', color: 'text-brand-strong', tint: '#fff4e9' },
        { label: 'Total courses', value: stats?.courses, icon: BookOpen, art: 'business', color: 'text-blue-600', tint: '#edf5ff' },
        { label: 'Active courses', value: stats?.activeCourses, icon: CircleCheck, art: 'institution', color: 'text-emerald-600', tint: '#ecfdf5' },
        { label: 'Inactive courses', value: stats?.inactiveCourses, icon: CirclePause, art: 'business', color: 'text-slate-500', tint: '#f1f5f9' },
    ] as const

    return <dl aria-label="Course setup overview" className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-3">
        {cards.map(({ label, value, icon: Icon, art, color, tint }) => (
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
                </div>
            </div>
        ))}
    </dl>
}
