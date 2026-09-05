"use client"

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronDown, Settings2 } from 'lucide-react'
import type { ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { ClientAvatar, type MappingRowVM } from './mappingPresentation'
import { groupCourses } from './mappingTree'

// The Course Setup list's SEARCH-RESULT state — and only that. While the search
// box holds a term that matches course names, the table is swapped for these
// accordion sections: one per client, auto-expanded, listing just the matching
// courses under the mapping (service · model · year) that teaches them. The
// moment the term stops matching a course (or the box is cleared), MappingList
// falls straight back to the normal table — this component owns no data and no
// query; it is handed the page's row view-models and the term.

type MatchedCourse = { key: string; name: string; category: string }
type MatchedMapping = { row: MappingRowVM; courses: MatchedCourse[] }
export type ClientCourseMatch = {
    clientKey: string
    clientName: string
    mappings: MatchedMapping[]
    courseCount: number
}

// Which clients on the page have a course matching the term, and which courses.
// Grouped by CLIENT (one section per client even when several of its mappings
// match), with courses deduped by name per mapping — the same one-name-per-
// course rule row.courses uses for the table's search haystack, so a course
// taught at several placements shows once, not once per placement.
export function buildClientCourseMatches(rows: MappingRowVM[], term: string): ClientCourseMatch[] {
    const q = term.trim().toLowerCase()
    if (!q) return []
    const byClient = new Map<string, ClientCourseMatch>()
    rows.forEach((row) => {
        const seen = new Set<string>()
        const courses: MatchedCourse[] = []
        groupCourses(row.mapping).forEach((g) => {
            const nameKey = g.courseName.trim().toLowerCase()
            if (!nameKey.includes(q) || seen.has(nameKey)) return
            seen.add(nameKey)
            courses.push({ key: g.key, name: g.courseName.trim(), category: g.category })
        })
        if (!courses.length) return
        const m = row.mapping
        const clientKey = (typeof m.client === 'string' ? m.client : m.client?._id) || row.clientName
        const entry = byClient.get(clientKey)
            ?? { clientKey, clientName: row.clientName, mappings: [], courseCount: 0 }
        entry.mappings.push({ row, courses })
        entry.courseCount += courses.length
        byClient.set(clientKey, entry)
    })
    return Array.from(byClient.values())
}

// The matched part of the course name, marked in place so the eye lands on why
// this row is here.
function Highlight({ text, term }: { text: string; term: string }) {
    const q = term.trim().toLowerCase()
    const idx = q ? text.toLowerCase().indexOf(q) : -1
    if (idx < 0) return <>{text}</>
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-brand-wash text-brand-strong rounded-[3px] font-semibold">
                {text.slice(idx, idx + q.length)}
            </mark>
            {text.slice(idx + q.length)}
        </>
    )
}

export default function CourseSearchResults({
    groups,
    term,
    onOpen,
}: {
    groups: ClientCourseMatch[]
    term: string
    onOpen: (mapping: ServiceMapping) => void
}) {
    // Sections start OPEN — the whole point of this view is showing the match
    // without another click — so the state tracks what the user collapsed, not
    // what they expanded: a client that newly starts matching as the term is
    // refined arrives expanded for free. A new term resets the collapses.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    useEffect(() => { setCollapsed(new Set()) }, [term])

    const toggle = (key: string) => setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key); else next.add(key)
        return next
    })

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2.5 py-1 pr-1">
                <p className="px-1 text-2xs text-subtle">
                    {groups.length} client{groups.length > 1 ? 's' : ''} with courses matching{' '}
                    <span className="font-semibold text-body">&quot;{term}&quot;</span>
                </p>
                {groups.map((g) => {
                    const open = !collapsed.has(g.clientKey)
                    return (
                        <section
                            key={g.clientKey}
                            className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden"
                        >
                            <button
                                type="button"
                                onClick={() => toggle(g.clientKey)}
                                aria-expanded={open}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-row-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                            >
                                <ChevronDown
                                    size={16}
                                    className={`flex-shrink-0 text-subtle transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                                />
                                <ClientAvatar name={g.clientName} size="sm" />
                                <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-heading" title={g.clientName}>
                                    {g.clientName}
                                </span>
                                <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-brand-wash text-brand-strong text-2xs font-semibold whitespace-nowrap tabular-nums">
                                    {g.courseCount} matching course{g.courseCount > 1 ? 's' : ''}
                                </span>
                            </button>

                            <AnimatePresence initial={false}>
                                {open && (
                                    <motion.div
                                        key="body"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-hairline">
                                            {g.mappings.map(({ row, courses }) => (
                                                <div key={row.id} className="px-4 py-3 border-b border-hairline last:border-0">
                                                    {/* Which mapping these courses sit under, plus the
                                                        SAME Manage drill-in the table row carries — so
                                                        a search result is a working entry point, not
                                                        just a listing. */}
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="min-w-0 truncate text-2xs text-subtle">
                                                            {[row.service, row.models.join(', '), row.year].filter(Boolean).join(' · ') || '—'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); onOpen(row.mapping) }}
                                                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 whitespace-nowrap flex-shrink-0"
                                                        >
                                                            <Settings2 size={12} /> Manage
                                                        </button>
                                                    </div>
                                                    <ul className="mt-2 space-y-1">
                                                        {courses.map((c) => (
                                                            <li
                                                                key={c.key}
                                                                className="flex items-center gap-2.5 rounded-control border border-hairline bg-canvas px-2.5 py-2"
                                                            >
                                                                <BookOpen size={14} className="flex-shrink-0 text-brand" />
                                                                <span className="min-w-0 truncate text-[12px] text-body" title={c.name}>
                                                                    <Highlight text={c.name} term={term} />
                                                                </span>
                                                                {c.category && (
                                                                    <span className="ml-auto inline-flex items-center h-[20px] px-1.5 rounded-chip bg-ink-100 text-ink-600 text-2xs font-medium whitespace-nowrap flex-shrink-0">
                                                                        {c.category}
                                                                    </span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>
                    )
                })}
            </div>
        </div>
    )
}
