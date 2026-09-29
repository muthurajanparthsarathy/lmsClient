"use client"

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronDown, Settings2 } from 'lucide-react'
import { ClientAvatar, type ClientRowVM } from './mappingPresentation'

// The Course Setup list's SEARCH-RESULT state — and only that. While the search
// box holds a term that matches course names, the table is swapped for these
// accordion sections: one per client, auto-expanded, listing just the matching
// courses under the mapping (service · model · year) that teaches them. The
// moment the term stops matching a course (or the box is cleared), MappingList
// falls straight back to the normal table — this component owns no data and no
// query; it is handed the page's row view-models and the term.

export type ClientCourseMatch = {
    clientKey: string
    clientId: string
    clientName: string
    /** Matching course names, already deduped by the server's union. */
    courses: string[]
    courseCount: number
}

// Which clients on the page have a course matching the term, and which courses.
// A row IS a client now, so its `courses` is already the union across that
// client's services — there are no per-mapping sub-sections to build, and no
// mapping in the browser to read them from. What the section lists is exactly
// what the row's Available Courses popover lists, filtered to the term.
export function buildClientCourseMatches(rows: ClientRowVM[], term: string): ClientCourseMatch[] {
    const q = term.trim().toLowerCase()
    if (!q) return []
    const out: ClientCourseMatch[] = []
    rows.forEach((row) => {
        const courses = row.courses.filter((n) => n.toLowerCase().includes(q))
        if (!courses.length) return
        out.push({
            clientKey: row.clientId || row.id,
            clientId: row.clientId,
            clientName: row.clientName,
            courses,
            courseCount: courses.length,
        })
    })
    return out
}

// The matched span of a course name, marked inside the full name so the reader
// can see WHY a row matched. Case-insensitive, and the term is escaped before
// it reaches the RegExp — a search for "C++" is a user typing, not a pattern.
function Highlight({ text, term }: { text: string; term: string }) {
    const q = term.trim()
    if (!q) return <>{text}</>
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'ig'))
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === q.toLowerCase() ? (
                    <mark key={i} className="bg-brand-wash text-brand-strong rounded-[3px] font-semibold">{part}</mark>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                )
            )}
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
    onOpen: (clientId: string) => void
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
                                        <div className="border-t border-hairline px-4 py-3">
                                            {/* One flat list per client. There are no per-service
                                                sub-sections any more: a row is a client, and its
                                                course names arrive already unioned across its
                                                services, so the mapping each course sits under is
                                                not known here. Manage opens the client and shows
                                                every service, which is where that detail lives. */}
                                            <div className="flex items-center justify-end">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); onOpen(g.clientId) }}
                                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 whitespace-nowrap flex-shrink-0"
                                                >
                                                    <Settings2 size={12} /> Manage Courses
                                                </button>
                                            </div>
                                            <ul className="mt-2 space-y-1">
                                                {g.courses.map((name) => (
                                                    <li
                                                        key={name}
                                                        className="flex items-center gap-2.5 rounded-control border border-hairline bg-canvas px-2.5 py-2"
                                                    >
                                                        <BookOpen size={14} className="flex-shrink-0 text-brand" />
                                                        <span className="min-w-0 truncate text-[12px] text-body" title={name}>
                                                            <Highlight text={name} term={term} />
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
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
