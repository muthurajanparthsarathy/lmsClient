"use client"

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarDays, Search, X } from 'lucide-react'
import { useClients, type Client, type ContactPerson } from '@/apiServices/clientManagementService'
import { instituteHolidayCalendarApi } from '@/apiServices/instituteHolidayCalendarApi'
import { motion } from 'framer-motion'
import { HeaderStats, type HeaderStatItem } from '@/app/lms/shared/ui/HeaderStats'
import DataTable, { type Column } from '@/app/lms/shared/listing/DataTable'
import TableFooter from '@/app/lms/shared/listing/TableFooter'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// The one place the composite scope key is defined. The server keeps a single
// calendar document per string key, so per-client calendars piggyback on the
// same collection by suffixing the client id — and the plain institution id
// stays the key of the legacy institute-wide record, untouched.
export const scopeIdFor = (instituteId: string, clientId: string | null): string =>
    clientId ? `${instituteId}__client__${clientId}` : instituteId

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

    // ── Compact stat chips (Client Management style): only this institute's
    // scopes count, so another institute's records can't inflate the numbers.
    // Swapped from the four full-width cards to the shared HeaderStats chip
    // strip — same numbers, a fraction of the vertical real estate, so the
    // clients table now fits the viewport without a page-level scrollbar.
    const stats = useMemo<HeaderStatItem[]>(() => {
        const mine = calendarRecords.filter(
            (r) => r.instituteId === instituteId || r.instituteId.startsWith(`${instituteId}__client__`)
        )
        const withHolidays = mine.filter((r) => (r.holidayCount ?? 0) > 0).length
        const totalHolidays = mine.reduce((sum, r) => sum + (r.holidayCount ?? 0), 0)
        const active = clientList.filter((c) => c.status === 'active').length
        return [
            { label: 'Total', value: clientList.length },
            { label: 'Active', value: active },
            { label: 'Calendars', value: withHolidays },
            { label: 'Holidays', value: totalHolidays },
        ]
    }, [clientList, calendarRecords, instituteId])

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
            label: '',
            // Widened from 8% → 20% so the "Manage holidays" button (icon +
            // ~120px label) fits fully in the fixed-layout cell without being
            // clipped on narrow screens. The other columns lost a couple of
            // percentage points to make room.
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
        // Full-height flex column: the header row, filter bar keep their
        // natural height; the table card claims the rest via `flex-1 min-h-0`
        // and its DataTable's `fillHeight` opts in. The parent motion.div in
        // page.tsx is `overflow-hidden` so nothing scrolls at the page level —
        // only the table body does.
        <div className="h-full min-h-0 flex flex-col gap-4 px-6 py-5 md:px-8 md:py-6">
            {/* Two-column header, matching the Client Management pattern:
                title on the left, HeaderStats chips top-right (near the
                notification bell), and the "Institute-wide calendar" button
                stacked underneath them so it doesn't crowd the chip strip.
                PageHeader was replaced because its single-row layout forced
                the button next to the chips. */}
            <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-semibold text-heading tracking-[-0.01em]">
                        Holiday Calendar
                    </h1>
                </div>
                <HeaderStats items={stats} loading={isLoading} skeletonCount={4} />
            </div>

            {/* Inline toolbar (no card wrapper): search + status filter on the
                left, "Institute-wide calendar" button on the right. Matches
                the User Management / Client Management toolbar style — a
                boxed FilterBar around a single-line control set reads as an
                extra rectangle on the page for no real gain. */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search
                        size={15}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
                    />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        placeholder="Search by client, contact name or email…"
                        className="h-10 w-full rounded-control border border-hairline-strong bg-surface pl-3.5 pr-9 text-sm text-body placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => { setSearch(''); setCurrentPage(1) }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                    className={`h-10 rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${statusFilter ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                    style={{ minWidth: 140 }}
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="h-10 rounded-control border border-hairline-strong bg-surface px-3 text-xs font-medium text-subtle hover:text-heading transition-colors duration-150"
                    >
                        Clear
                    </button>
                )}
                {canManageHolidays && (
                    <motion.button
                        type="button"
                        onClick={() => onManage({ clientId: null, clientName: 'Institute-wide' })}
                        whileTap={{ scale: 0.98 }}
                        className="ml-auto flex items-center gap-2 h-10 pl-3.5 pr-3.5 rounded-control bg-brand-strong text-white shadow-xs hover:bg-brand-800 transition-colors duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 flex-shrink-0"
                    >
                        <CalendarDays size={16} strokeWidth={2.2} />
                        <span className="text-sm font-semibold hidden sm:inline">Institute-wide calendar</span>
                    </motion.button>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
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
