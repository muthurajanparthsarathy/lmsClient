"use client"

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarDays, Search, X } from 'lucide-react'
import { useClients, type Client, type ContactPerson } from '@/apiServices/clientManagementService'
import { instituteHolidayCalendarApi } from '@/apiServices/instituteHolidayCalendarApi'
import { motion } from 'framer-motion'
import DataTable, { type Column } from '@/app/lms/shared/listing/DataTable'
import TableFooter from '@/app/lms/shared/listing/TableFooter'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'
import { scopeIdFor } from './types'

// Re-exported from ./types, where the definition now lives so the read-only
// student calendar can share it without importing this table. Existing
// callers (page.tsx) keep importing it from here unchanged.
export { scopeIdFor }

// What "Manage holidays" hands back to the page: `clientId: null` means the
// pinned institute-wide row, whose calendar lives under the bare institute id.
export type ManageTarget = { clientId: string | null; clientName: string }

// One table over two kinds of row: the pinned institute-wide scope and the real
// clients. Modelling the pin as a row (rather than a banner above the table)
// keeps it inside the same columns, so its holiday count and Manage button line
// up with everyone else's.
type Row =
    | { kind: 'institute'; count: number }
    | { kind: 'client'; client: Client; count: number }

// Avatar tints keyed by a stable hash of the name — duplicated from the Client
// Management table on purpose: a client that is blue there must be blue here.
// Same array LENGTH and hash as before, so every client keeps its slot; the
// hues now resolve through the token palette.
const AVATARS = [
    'bg-info-50 text-info-700',
    'bg-ink-100 text-ink-700',
    'bg-brand-wash text-brand-strong',
    'bg-success-50 text-success-700',
    'bg-danger-50 text-danger-700',
]
const hash = (s: string): number => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
}
const avatarTone = (name: string): string => AVATARS[hash(name) % AVATARS.length]

// Primary contact first — the Email and Contact person columns must show the
// same person, so both read from this one helper.
const primaryContact = (c: Client): ContactPerson | null =>
    c.contactPersons?.find((p) => p.isPrimary) ?? c.contactPersons?.[0] ?? null

function ManageButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-chip border border-brand-300 bg-brand-wash text-brand-strong text-xs font-semibold hover:bg-brand-wash-hover active:scale-[0.98] transition-all duration-150"
        >
            <CalendarDays size={13} strokeWidth={2.2} />
            Manage holidays
        </button>
    )
}

export default function ClientList({
    instituteId,
    onManage,
}: {
    instituteId: string
    onManage: (target: ManageTarget) => void
}) {
    // Both the top "Institute-wide calendar" button and every row's "Manage
    // holidays" button open the same holiday manager — so both gate on the
    // "Manage Holidays" grant. The tree also lists "My Calendar", which
    // covers viewing/editing the user's personal calendar view (rendered
    // by the sibling stage in page.tsx), so either grant enables holiday
    // management here.
    const { can } = usePermissions()
    const canManageHolidays = can(PERMISSION_IDS.ADMIN_CALENDAR, 'Manage Holidays')

    const { data: clientList = [], isLoading: isLoadingClients } = useClients()
    // One request instead of a fetch per row — and ?counts=1, so each record
    // carries a `holidayCount` instead of its whole holidays[] array. This
    // column renders a number; shipping every scope's every holiday to draw it
    // was the entire payload for none of the value, and those arrays grow every
    // academic year. The count is the server's, so it stays correct even though
    // the calendar page itself only loads one year's window.
    const { data: calendarRecords = [], isLoading: isLoadingCounts } = useQuery(instituteHolidayCalendarApi.getAllCounts())

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const isLoading = isLoadingClients || isLoadingCounts

    // Holiday count per scope key. Records from other institutes simply never
    // match a key this page asks for, so no filtering is needed here.
    const countByScope = useMemo(() => {
        const m = new Map<string, number>()
        calendarRecords.forEach((r) => m.set(r.instituteId, r.holidayCount ?? 0))
        return m
    }, [calendarRecords])

    const filteredClients = useMemo(() => {
        const q = search.trim().toLowerCase()
        return clientList.filter((c) => {
            if (statusFilter && c.status !== statusFilter) return false
            if (q) {
                const haystack = [
                    c.clientCompany,
                    ...(c.contactPersons || []).flatMap((p) => [p.name, p.email]),
                ].filter(Boolean).join(' ').toLowerCase()
                if (!haystack.includes(q)) return false
            }
            return true
        })
    }, [clientList, search, statusFilter])

    const instituteCount = countByScope.get(instituteId) ?? 0

    // The institute-wide row is pinned first because it is where every holiday
    // entered before per-client calendars existed lives — hiding it would make
    // real data look lost. It only leaves the list when a search doesn't match
    // it; the status filter is about clients, which it is not.
    const instituteMatchesSearch = useMemo(() => {
        const q = search.trim().toLowerCase()
        return !q || 'institute-wide applies to all clients'.includes(q)
    }, [search])

    const rows = useMemo<Row[]>(() => {
        const clientRows: Row[] = filteredClients.map((client) => ({
            kind: 'client',
            client,
            count: countByScope.get(scopeIdFor(instituteId, client._id)) ?? 0,
        }))
        return instituteMatchesSearch
            ? [{ kind: 'institute', count: instituteCount }, ...clientRows]
            : clientRows
    }, [filteredClients, countByScope, instituteId, instituteCount, instituteMatchesSearch])

    const totalRows = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    // Keep the current page valid as filters / page size change.
    useEffect(() => {
        setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(totalRows / pageSize))))
    }, [totalRows, pageSize])

    const hasActiveFilters = Boolean(search.trim() || statusFilter)
    const clearFilters = () => {
        setSearch('')
        setStatusFilter('')
        setCurrentPage(1)
    }

    // Percentage column widths sum to 100% so `fixedLayout` (below) can decide
    // the layout on its own — no horizontal scrollbar, cells clip long values
    // via `truncate` + `title` tooltips instead. Same pattern as the User
    // Management table.
    const columns: Column<Row>[] = [
        {
            key: 'idx',
            label: '#',
            className: 'w-[4%] pl-4 pr-2 text-left',
            skeletonWidth: '18px',
            render: (_row, i) => (
                <span className="text-xs text-faint tabular-nums">
                    {(currentPage - 1) * pageSize + i + 1}
                </span>
            ),
        },
        {
            key: 'client',
            label: 'Client',
            className: 'w-[28%] px-3 text-left',
            skeletonWidth: '65%',
            render: (row) =>
                row.kind === 'institute' ? (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-control bg-brand-wash text-brand-strong flex items-center justify-center shrink-0">
                            <Building2 size={15} strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-heading truncate" title="Institute-wide">Institute-wide</p>
                            <p className="text-2xs text-faint truncate">Applies to all clients</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-8 h-8 rounded-control text-2xs font-bold flex items-center justify-center shrink-0 ${avatarTone(row.client.clientCompany || '')}`}>
                            {(row.client.clientCompany || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-heading truncate" title={row.client.clientCompany || undefined}>
                                {row.client.clientCompany || '—'}
                            </p>
                            <p className="text-2xs text-faint truncate">
                                {row.client.businessModel || (row.client.status === 'active' ? 'Active' : 'Inactive')}
                            </p>
                        </div>
                    </div>
                ),
        },
        {
            key: 'email',
            label: 'Email',
            className: 'w-[22%] px-3 text-left',
            skeletonWidth: '70%',
            render: (row) => {
                const email = row.kind === 'client' ? primaryContact(row.client)?.email || '—' : '—'
                return (
                    <span className="block truncate text-xs text-subtle" title={email !== '—' ? email : undefined}>
                        {email}
                    </span>
                )
            },
        },
        {
            key: 'contact',
            label: 'Contact person',
            className: 'w-[18%] px-3 text-left',
            skeletonWidth: '55%',
            render: (row) => {
                const name = row.kind === 'client' ? primaryContact(row.client)?.name || '—' : '—'
                return (
                    <span className="block truncate text-xs text-body" title={name !== '—' ? name : undefined}>
                        {name}
                    </span>
                )
            },
        },
        {
            key: 'holidays',
            label: 'Holidays',
            className: 'w-[8%] px-3 text-left',
            skeletonWidth: '36px',
            render: (row) => (
                <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-semibold tabular-nums ${
                        row.count > 0
                            ? 'bg-brand-wash text-brand-strong border-brand-300'
                            : 'bg-canvas text-faint border-hairline'
                    }`}
                >
                    {row.count}
                </span>
            ),
        },
        {
            key: 'action',
            label: 'Actions',
            // Widened from 8% → 20% so the "Manage holidays" button (icon +
            // ~120px label) fits fully in the fixed-layout cell without being
            // clipped on narrow screens. Column header now reads "Actions" —
            // the blank header made the button feel disconnected from the
            // row above and away from the pattern the other admin lists use.
            className: 'w-[20%] px-3 pr-4 text-right',
            skeletonWidth: '140px',
            render: (row) =>
                canManageHolidays ? (
                    <ManageButton
                        onClick={() =>
                            row.kind === 'institute'
                                ? onManage({ clientId: null, clientName: 'Institute-wide' })
                                : onManage({ clientId: row.client._id, clientName: row.client.clientCompany || 'Client' })
                        }
                    />
                ) : null,
        },
    ]

    return (
        // Repainted onto the Client Management / Course Structure layout:
        // slim title row (no HeaderStats chip strip), h-8 toolbar rhythm,
        // and a flat list panel — no rounded-xl border card around the
        // table. Padding matches CM (`px-4 sm:px-6 md:px-8 pt-3 pb-3`).
        // The parent motion.div in page.tsx is `overflow-hidden` so
        // nothing scrolls at the page level — only the table body does.
        <div className="h-full min-h-0 flex flex-col px-4 sm:px-6 md:px-8 pt-3 pb-3">
            {/* Slim heading — the Total / Active / Calendars / Holidays
                HeaderStats strip was removed at the user's request; those
                numbers duplicate what the table + pagination footer already
                show, and the extra chip row crowded the workspace. */}
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">Holiday Calendar</h1>
            </div>

            {/* Toolbar — h-8 pills, same rhythm as Client Management.
                Search + status filter on the left, Institute-wide calendar
                as the primary right-aligned action. */}
            <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
                    />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        placeholder="Search by client, contact name or email…"
                        className="h-8 w-full rounded-control border border-hairline-strong bg-surface pl-8 pr-8 text-xs text-body placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => { setSearch(''); setCurrentPage(1) }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                    className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${statusFilter ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                    style={{ minWidth: 130 }}
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-subtle hover:bg-row-hover hover:text-heading transition-colors duration-150"
                    >
                        Clear
                    </button>
                )}
                {canManageHolidays && (
                    <>
                        <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5 ml-auto" aria-hidden />
                        <motion.button
                            type="button"
                            onClick={() => onManage({ clientId: null, clientName: 'Institute-wide' })}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                        >
                            <CalendarDays size={14} strokeWidth={2.4} />
                            <span className="text-xs font-semibold hidden sm:inline">Institute-wide calendar</span>
                        </motion.button>
                    </>
                )}
            </div>

            {/* Flat list panel — no rounded-xl card chrome, matching CM
                / User Management. The DataTable's own hairline rows carry
                the visual separation. */}
            <div className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden">
                <DataTable<Row>
                    rows={pageRows}
                    columns={columns}
                    rowKey={(row) => (row.kind === 'institute' ? '__institute-wide__' : row.client._id)}
                    sortKey={null}
                    sortDir="asc"
                    onSort={() => {}}
                    isLoading={isLoading}
                    isFiltered={hasActiveFilters}
                    emptyTitle={hasActiveFilters ? 'No clients match' : 'No clients yet'}
                    emptyHint={hasActiveFilters
                        ? 'Try different search terms or clear the filters.'
                        : 'Clients created in Client Management appear here.'}
                    emptyAction="Clear filters"
                    onEmptyAction={clearFilters}
                    fixedLayout
                    fillHeight
                />
                <TableFooter
                    from={totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                    to={Math.min(currentPage * pageSize, totalRows)}
                    total={totalRows}
                    pageSize={pageSize}
                    onPageSize={(n) => { setPageSize(n); setCurrentPage(1) }}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPage={(p) => setCurrentPage(Math.min(Math.max(1, p), totalPages))}
                />
            </div>
        </div>
    )
}
