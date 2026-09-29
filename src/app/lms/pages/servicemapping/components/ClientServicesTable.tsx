"use client"

import React, { useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, ChevronUp, ChevronDown, Loader2, ListTree, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { TABLE_HEAD_CELL, type SortDir } from '../../../shared/listing/DataTable'
import { ClientAvatar } from './workspaceShared'
import { titleCase } from './titleCase'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'

// The Service Mapping listing, grouped: one BLOCK per client, one ROW per
// service inside it. The #, Client ID, Client Name and Business Model cells
// span the client's services (rowSpan), so the client is stated once and its
// services are read down the right-hand columns — which is the shape the
// reader asked for, and the shape the data has.
//
// Why not DataTable: that component draws exactly one <tr> per row and has no
// notion of a spanning cell, and a rowSpan is the whole point here. The header
// typography is still DataTable's (TABLE_HEAD_CELL), so this table and the
// app's other listings stay visually identical.
//
// Every row action belongs to ONE service — Edit / Delete act on that service,
// Add and Manage act on its client — so the ⋮ menu sits on the service row
// rather than on the client. Owns no data: the page hands down the groups and
// the callbacks.

export interface ServiceLine {
    id: string
    /** The service's own name ("Business to Institution"), for the delete label. */
    service: string
    /** Service models: what the reader actually calls the service (TD, HTD,
     *  Skilling, Placement Training), so they lead the Service Name cell. */
    models: string[]
    year: string
    status: 'active' | 'inactive'
}

export interface ClientServiceGroup {
    /** Client _id — what Add / Manage act on. */
    id: string
    /** Human-readable client code ("CLT-000023"), blank for legacy clients. */
    clientCode: string
    clientName: string
    logoUrl?: string
    /** Raw business-model code (B2B / B2I / B2C); displayed in full. */
    businessModel: string
    /** The services shown as rows. Capped by the server — compare with
     *  `totalServices` to know whether more exist. */
    lines: ServiceLine[]
    /** True total across the client, which may exceed `lines.length`. */
    totalServices: number
}

interface ClientServicesTableProps {
    groups: ClientServiceGroup[]
    isLoading: boolean
    sortKey: string | null
    sortDir: SortDir
    onSort: (key: string) => void
    /** Row numbers continue across pages, so pass (page - 1) * limit. */
    startIndex: number
    emptyState: React.ReactNode
    onAddService: (group: ClientServiceGroup) => void
    onManageServices: (group: ClientServiceGroup) => void
    onEditService: (line: ServiceLine, group: ClientServiceGroup) => void
    onDeleteService: (line: ServiceLine, group: ClientServiceGroup) => void
    /** The line whose Edit is still loading its mapping — its ⋮ spins. */
    busyLineId?: string | null
    canView?: boolean
    canEdit?: boolean
    canMap?: boolean
    canDelete?: boolean
    /** Fill the parent's remaining height instead of capping. Needs every
     *  ancestor up to a definite height to be `flex flex-col min-h-0`. */
    fillHeight?: boolean
    maxHeight?: string
}

// Percentages, summing to 100, under table-layout: fixed — so the table can
// never overflow its container horizontally and cells ellipsize instead.
const COLS = [
    { key: 'num', label: '#', width: 'w-[4%]', align: 'text-left' },
    { key: 'clientId', label: 'Client ID', width: 'w-[12%]', align: 'text-left', sortKey: 'clientId' },
    { key: 'client', label: 'Client Name', width: 'w-[25%]', align: 'text-left', sortKey: 'client' },
    { key: 'businessModel', label: 'Business Model', width: 'w-[19%]', align: 'text-left' },
    { key: 'service', label: 'Service Name', width: 'w-[23%]', align: 'text-left' },
    { key: 'year', label: 'Year', width: 'w-[9%]', align: 'text-left', sortKey: 'year' },
    { key: 'actions', label: 'Actions', width: 'w-[8%]', align: 'text-center' },
] as const

// Two weights of horizontal rule, and the difference is the point: a client's
// services are separated from EACH OTHER by the lighter one, and the client's
// block is closed by the heavier, darker one. "Where does this client's data
// end" is then answered at a glance instead of by counting rows.
//
// Both are deliberately darker than the app's `hairline` (#eaecf0): this table
// is a grid of spanned cells, not a plain list of rows, and at hairline weight
// the rules were too faint to read the blocks off. `line-hover` (#cbd1d9) and
// `line-muted` (#b4bbc6) are existing palette steps, so the table is bolder
// without inventing a colour.
// Same rhythm as the Clients table (shared/listing/DataTable): 44px rows,
// 13px regular text, hairline rules. Styling only; the grouping is unchanged.
const CELL = 'px-3 h-11 align-middle text-[13px] text-body'
const ROW_LINE = 'border-b border-hairline'
const GROUP_LINE = 'border-b border-hairline'
// The header's rule matches the group rule, so the first client's block reads
// as bounded top and bottom. `!` because TABLE_HEAD_CELL brings its own
// `border-b border-hairline` and equal-specificity classes would otherwise
// resolve by stylesheet order.
const HEAD_LINE = ''

function SortHead({ label, columnKey, active, dir, onSort }: {
    label: string
    columnKey: string
    active: boolean
    dir: SortDir
    onSort: (key: string) => void
}) {
    return (
        <button
            type="button"
            onClick={() => onSort(columnKey)}
            className="inline-flex items-center gap-1.5 hover:text-heading transition-colors duration-150"
        >
            {label}
            {active
                ? (dir === 'asc' ? <ChevronUp size={13} className="text-brand" /> : <ChevronDown size={13} className="text-brand" />)
                : <ChevronsUpDown size={13} className="text-line-muted" />}
        </button>
    )
}

// The service row's ⋮ menu. Positioned with CSS against its own button rather
// than measured and placed by JS: the app runs under `html { zoom: .95 }`
// (globals.css), and a measured popper lands ~5% short of its trigger. Rows in
// the lower half pass `openUp` so the table's scroll box cannot clip it.
function LineActionsMenu({ label, openUp, busy, items }: {
    label: string
    openUp?: boolean
    busy?: boolean
    items: { key: string; label: string; icon: React.ReactNode; onSelect: () => void; destructive?: boolean }[]
}) {
    const [open, setOpen] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('mousedown', onDown)
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
    }, [open])

    if (!items.length) return <span className="text-xs text-line-muted">—</span>

    return (
        <div ref={boxRef} className="relative inline-flex">
            <button
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={busy}
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex size-7 items-center justify-center rounded-chip text-subtle transition-colors hover:bg-ink-100 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-60 ${open ? 'bg-ink-100 text-heading' : ''}`}
            >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
            </button>
            {open && (
                <div
                    role="menu"
                    className={`absolute right-0 z-dropdown w-44 rounded-tile border border-hairline bg-surface p-1 text-left shadow-lg ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                >
                    {items.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            onClick={() => { setOpen(false); item.onSelect() }}
                            className={`flex w-full items-center gap-2 rounded-chip px-2 py-1.5 text-xs transition-colors focus-visible:outline-none ${
                                item.destructive
                                    ? 'text-danger-700 hover:bg-danger-50 focus-visible:bg-danger-50'
                                    : 'text-body hover:bg-row-hover hover:text-heading focus-visible:bg-row-hover'
                            }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function ClientServicesTable({
    groups,
    isLoading,
    sortKey,
    sortDir,
    onSort,
    startIndex,
    emptyState,
    onAddService,
    onManageServices,
    onEditService,
    onDeleteService,
    busyLineId,
    canView = true,
    canEdit = true,
    canMap = true,
    canDelete = true,
    fillHeight = false,
    maxHeight = 'calc(100vh * var(--ui-scale-inv, 1) - 360px)',
}: ClientServicesTableProps) {
    return (
        <div
            className={
                fillHeight
                    ? 'flex-1 min-h-[220px] overflow-x-hidden overflow-y-auto'
                    : 'min-h-[220px] overflow-x-hidden overflow-y-auto'
            }
            style={fillHeight ? undefined : { maxHeight }}
        >
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-10">
                    <tr>
                        {COLS.map((c) => (
                            <th
                                key={c.key}
                                aria-sort={'sortKey' in c && c.sortKey
                                    ? (sortKey === c.sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none')
                                    : undefined}
                                className={`${c.width} ${c.align} ${c.key === 'num' ? 'pl-5' : 'px-3'} ${TABLE_HEAD_CELL} ${HEAD_LINE}`}
                            >
                                {'sortKey' in c && c.sortKey ? (
                                    <SortHead
                                        label={c.label}
                                        columnKey={c.sortKey}
                                        active={sortKey === c.sortKey}
                                        dir={sortDir}
                                        onSort={onSort}
                                    />
                                ) : c.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {isLoading ? (
                        Array.from({ length: 7 }).map((_, i) => (
                            <tr key={i}>
                                {COLS.map((c) => (
                                    <td key={c.key} className={`${CELL} ${ROW_LINE} ${c.key === 'num' ? 'pl-5' : ''}`}>
                                        <div
                                            className="h-3 rounded bg-ink-100 animate-pulse"
                                            style={{ width: c.key === 'num' ? '20px' : c.key === 'actions' ? '18px' : '70%', animationDelay: `${i * 60}ms` }}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : groups.length === 0 ? (
                        <tr>
                            <td colSpan={COLS.length} className="py-14">{emptyState}</td>
                        </tr>
                    ) : (
                        groups.map((group, gi) => {
                            const hidden = Math.max(0, group.totalServices - group.lines.length)
                            // The "+N more" line is a row of its own, so the
                            // client's cells have to span it too.
                            const span = Math.max(1, group.lines.length) + (hidden > 0 ? 1 : 0)
                            // Menus on the lower half of the page open upward —
                            // the table body is a scroll box and would clip them.
                            const openUp = gi >= 2 && gi >= groups.length - 2
                            // The spanning cells end WITH the block, so they always
                            // carry the heavy line — it is the same rule as the
                            // block's last service row, drawn once.
                            const clientCells = (
                                <>
                                    <td rowSpan={span} className={`${CELL} ${GROUP_LINE} pl-5 !text-faint tabular-nums`}>
                                        {startIndex + gi + 1}
                                    </td>
                                    <td rowSpan={span} className={`${CELL} ${GROUP_LINE}`}>
                                        {group.clientCode
                                            ? <span className="inline-flex max-w-full items-center truncate rounded-chip bg-ink-50 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-heading" title={group.clientCode}>{group.clientCode}</span>
                                            : <span className="text-xs text-line-muted">—</span>}
                                    </td>
                                    <td rowSpan={span} className={`${CELL} ${GROUP_LINE}`}>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ClientAvatar name={group.clientName} size="sm" logoUrl={group.logoUrl} />
                                            <span className="block min-w-0 flex-1 truncate text-heading" title={group.clientName}>
                                                {group.clientName}
                                            </span>
                                        </div>
                                        {/* The count is worth stating even with the
                                            services listed beside it: past the cap
                                            the rows are a sample, not the whole. */}
                                        <span className="mt-0.5 block pl-7 text-2xs text-faint tabular-nums">
                                            {group.totalServices} {group.totalServices === 1 ? 'service' : 'services'}
                                        </span>
                                    </td>
                                    <td rowSpan={span} className={`${CELL} ${GROUP_LINE}`}>
                                        {group.businessModel
                                            ? <span className="block break-words text-body" title={businessModelDisplayName(group.businessModel)}>{businessModelDisplayName(group.businessModel)}</span>
                                            : <span className="text-xs text-line-muted">—</span>}
                                    </td>
                                </>
                            )

                            if (group.lines.length === 0) {
                                // A grouped row always came from at least one
                                // mapping, so this is defensive only — a client
                                // whose services were filtered out server-side.
                                return (
                                    <tr key={group.id} className="group/line">
                                        {clientCells}
                                        <td className={`${CELL} ${GROUP_LINE} text-line-muted group-hover/line:bg-row-hover`}>—</td>
                                        <td className={`${CELL} ${GROUP_LINE} text-line-muted group-hover/line:bg-row-hover`}>—</td>
                                        <td className={`${CELL} ${GROUP_LINE} no-print text-center group-hover/line:bg-row-hover`}>
                                            <div className="flex justify-center">
                                                <LineActionsMenu
                                                    label={`Actions for ${group.clientName}`}
                                                    openUp={openUp}
                                                    items={[
                                                        ...(canMap ? [{ key: 'add', label: 'Add new service', icon: <Plus className="h-3.5 w-3.5 text-subtle" />, onSelect: () => onAddService(group) }] : []),
                                                        ...(canView ? [{ key: 'manage', label: 'Manage services', icon: <ListTree className="h-3.5 w-3.5 text-subtle" />, onSelect: () => onManageServices(group) }] : []),
                                                    ]}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }

                            return (
                                <React.Fragment key={group.id}>
                                    {group.lines.map((line, li) => {
                                        const label = line.models.filter(Boolean)
                                            .map(titleCase)
                                            .join(', ') || titleCase(line.service) || '—'
                                        // Heavy line under the client's LAST
                                        // service (or under the "+N more" row when
                                        // there is one); hairlines in between.
                                        const rule = li === group.lines.length - 1 && hidden === 0
                                            ? GROUP_LINE
                                            : ROW_LINE
                                        return (
                                            // group/line, not a row-level hover:
                                            // the client's cells span the block, so
                                            // tinting the whole <tr> would light up
                                            // the client block from its first
                                            // service only. Hover stays on the
                                            // service's own three cells.
                                            <tr key={line.id} className="group/line">
                                                {li === 0 && clientCells}
                                                <td className={`${CELL} ${rule} group-hover/line:bg-row-hover`}>
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <span
                                                            aria-hidden="true"
                                                            title={line.status === 'active' ? 'Active' : 'Inactive'}
                                                            className={`size-1.5 shrink-0 rounded-full ${line.status === 'active' ? 'bg-success-500' : 'bg-ink-300'}`}
                                                        />
                                                        <span className={`block min-w-0 flex-1 truncate ${line.status === 'active' ? '' : 'text-subtle'}`} title={label}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`${CELL} ${rule} tabular-nums group-hover/line:bg-row-hover`}>
                                                    {line.year || <span className="text-line-muted">—</span>}
                                                </td>
                                                <td className={`${CELL} ${rule} no-print text-center group-hover/line:bg-row-hover`}>
                                                    <div className="flex justify-center">
                                                        <LineActionsMenu
                                                            label={`Actions for ${label} (${group.clientName})`}
                                                            openUp={openUp}
                                                            busy={busyLineId === line.id}
                                                            items={[
                                                                ...(canEdit ? [{ key: 'edit', label: 'Edit service', icon: <Pencil className="h-3.5 w-3.5 text-subtle" />, onSelect: () => onEditService(line, group) }] : []),
                                                                ...(canMap ? [{ key: 'add', label: 'Add new service', icon: <Plus className="h-3.5 w-3.5 text-subtle" />, onSelect: () => onAddService(group) }] : []),
                                                                ...(canView ? [{ key: 'manage', label: 'Manage services', icon: <ListTree className="h-3.5 w-3.5 text-subtle" />, onSelect: () => onManageServices(group) }] : []),
                                                                ...(canDelete ? [{ key: 'delete', label: 'Delete service', icon: <Trash2 className="h-3.5 w-3.5" />, destructive: true, onSelect: () => onDeleteService(line, group) }] : []),
                                                            ]}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {hidden > 0 && (
                                        <tr className="group/line">
                                            <td colSpan={3} className={`${CELL} ${GROUP_LINE} group-hover/line:bg-row-hover`}>
                                                <button
                                                    type="button"
                                                    onClick={() => onManageServices(group)}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 rounded-chip px-0.5"
                                                >
                                                    +{hidden} more {hidden === 1 ? 'service' : 'services'} — manage all
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
    )
}

export default ClientServicesTable
