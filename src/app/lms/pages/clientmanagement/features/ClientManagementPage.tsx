"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Building2, Eye, Filter, Layers,
    MoreVertical, Pencil, Plus, Power, SearchX, Trash2, Users, X,
    Search, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { WorkspaceActionSlot } from '@/features/businessmanagement/BusinessWorkspaceChrome'
import DataTable, { type Column, type SortDir } from '@/app/lms/shared/listing/DataTable'
import TableFooter from '@/app/lms/shared/listing/TableFooter'
import { ClientAvatar } from '@/app/lms/pages/servicemapping/components/workspaceShared'
import { EmptyState, SkeletonCards, pageEnter } from '@/app/lms/shared/ui'
import { useQueryClient } from '@tanstack/react-query'
import {
    useClients, useClientsPage, useClientNames, useCreateClient, useUpdateClient,
    useClientDeletionImpact, useDeleteClient, useToggleClientStatus,
    clientManagementKeys,
    type Client, type ClientInput,
} from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import {
    businessModelDisplayName,
    fmtCreatedDate, notify, orderedContacts, splitPhone,
    type ClientSortKey, type ContactErrors, type FormData, type FormErrors,
} from './lib'
import ClientFormModal from './ClientFormModal'
import ClientDetailsDrawer from './ClientDetailsDrawer'
import { ClientCreatedSuccessModal, DeleteConfirmModal, DeactivateConfirmModal } from './ConfirmDialogs'
import ClientCards from './ClientCards'
import { MappingMultiFilter } from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import ClientOverview, { type OverviewModel } from './ClientOverview'
import ClientExportDialog from './ClientExportDialog'
import type { ExportFormat } from './clientExport'
import { Can } from '@/app/lms/pages/usermanagement/components/permissions/Can'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

const ICON_BUTTON_CLASS =
    'w-8 h-8 rounded-lg border border-transparent bg-transparent text-subtle flex items-center ' +
    'justify-center hover:text-heading hover:border-hairline hover:bg-row-hover ' +
    'data-[state=open]:bg-row-hover data-[state=open]:border-hairline data-[state=open]:text-heading ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'

const CLIENT_ACTION_CLASS = 'min-h-9 gap-3 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer [&_svg]:size-4 [&_svg]:stroke-[1.6]'

const DEFAULT_VISIBLE_COLUMNS = [
    'num', 'clientId', 'createdYear', 'clientCompany', 'businessModel',
    'contactName', 'email', 'contactNumber', 'actions',
]

const ALL_COLUMN_KEYS: Array<{ key: string; label: string; alwaysOn?: boolean }> = [
    { key: 'num', label: '#', alwaysOn: true },
    { key: 'actions', label: 'Actions', alwaysOn: true },
    { key: 'clientId', label: 'Client ID' },
    { key: 'createdYear', label: 'Created Year' },
    { key: 'clientCompany', label: 'Client Name', alwaysOn: true },
    { key: 'businessModel', label: 'Business Model' },
    { key: 'website', label: 'Website' },
    { key: 'description', label: 'About Client' },
    { key: 'contactName', label: 'Contact Person Name' },
    { key: 'email', label: 'Email' },
    { key: 'contactNumber', label: 'Phone Number' },
    { key: 'secondaryEmail', label: 'Secondary Email' },
    { key: 'secondaryPhone', label: 'Secondary Phone Number' },
    { key: 'addressLine', label: 'Address Line' },
    { key: 'state', label: 'State' },
    { key: 'city', label: 'City' },
    { key: 'pincode', label: 'Pincode' },
]

const FILTERABLE_COLUMNS: Record<string, string> = {
    website: 'All websites',
    secondaryEmail: 'All secondary emails',
    secondaryPhone: 'All secondary phones',
    addressLine: 'All addresses',
    state: 'All states',
    city: 'All cities',
    pincode: 'All pincodes',
    clientPhone: 'All client phones',
}

function parseAddress(addr?: string) {
    const raw = String(addr || '')
    const [line1 = '', line2 = ''] = raw.split('\n')
    const city = line2.split(',')[0]?.trim() || ''
    const afterComma = line2.split(',')[1] || ''
    const state = afterComma.split('-')[0]?.trim() || ''
    const pincode = line2.split('-')[1]?.trim() || ''
    return { line1: line1.trim(), line2: line2.trim(), city, state, pincode }
}

function plainText(html?: string) {
    return String(html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// ─── FilterDropdown ──────────────────────────────────────────────────────────
// Wrapper around MappingMultiFilter that adds a footer with a "Done" button.
// The dropdown keeps its own draft of the selection; the parent's committed
// value only updates when Done is pressed. This makes the list refresh once
// per selection batch rather than on every checkbox tick.
//
// Implementation note: this wraps MappingMultiFilter's trigger + content via a
// controlled Radix DropdownMenu so we can render a footer inside the same
// popover. If your MappingMultiFilter already accepts a `footer` prop, swap to
// that instead and delete this wrapper — it will be simpler.

function FilterDropdown({
    label,
    options,
    value,
    onChange,
    placeholder,
    selectOptions,
    selectValue,
    onSelectChange,
}: {
    label: string
    options: Array<{ value: string; label: string }>
    value: string[]
    onChange: (values: string[]) => void
    placeholder?: string
    selectOptions?: string[]
    selectValue?: string
    onSelectChange?: (value: string) => void
}) {
    // The draft is what the user sees checked while the menu is open. It
    // syncs from `value` each time the menu opens, so external resets (Clear
    // all) reflect next time.
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState<string[]>(value)
    const [draftSelectValue, setDraftSelectValue] = useState(selectValue || '')
    const [query, setQuery] = useState('')
    useEffect(() => {
        if (open) {
            setDraft(value)
            setDraftSelectValue(selectValue || '')
            setQuery('')
        }
    }, [open, selectValue, value])

    const filteredOptions = query.trim()
        ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
        : options

    const displayText = draft.length === 0
        ? (placeholder || label)
        : draft.length === 1
            ? (options.find((o) => o.value === draft[0])?.label || draft[0])
            : `${draft.length} selected`

    const toggleDraft = (v: string) => {
        setDraft((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-2.5 text-left text-xs font-medium text-body hover:bg-row-hover focus:outline-none focus:ring-2 focus:ring-brand/15"
                    title={label}
                >
                    <span className={`truncate ${draft.length === 0 ? 'text-faint' : 'text-body'}`}>
                        {displayText}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-faint" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={6}
                collisionPadding={8}
                className="w-[260px] rounded-2xl border border-hairline bg-surface p-0 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.06)]"
            >
                <DropdownMenuLabel className="px-3 pb-2 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                    {label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-0 my-0" />
                <div className="relative px-2 pt-2">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        placeholder="Search clients..."
                        className="h-8 w-full rounded-lg border border-hairline-strong bg-surface pl-8 pr-2 text-xs text-body placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                </div>
                {selectOptions && onSelectChange && (
                    <div className="px-2 pt-2">
                        <label className="mb-1 block text-[10px] font-medium text-subtle">Created year</label>
                        <select
                            value={draftSelectValue}
                            onChange={(event) => setDraftSelectValue(event.target.value)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            className="h-8 w-full rounded-lg border border-hairline-strong bg-surface px-2 text-xs font-medium text-body focus:outline-none focus:ring-2 focus:ring-brand/15"
                        >
                            <option value="">All created years</option>
                            {selectOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                )}
                <div className="max-h-64 overflow-y-auto p-1">
                    {filteredOptions.length === 0 ? (
                        <div className="px-3 py-3 text-xs italic text-faint">No options</div>
                    ) : (
                        filteredOptions.map((opt) => {
                            const checked = draft.includes(opt.value)
                            return (
                                <label
                                    key={opt.value}
                                    className="flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-body hover:bg-row-hover"
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleDraft(opt.value)}
                                        className="size-3.5 shrink-0 cursor-pointer rounded border-hairline-strong accent-brand-strong"
                                    />
                                    <span className="truncate">{opt.label}</span>
                                </label>
                            )
                        })
                    )}
                </div>
                <DropdownMenuSeparator className="mx-0 my-0" />
                <div className="flex items-center justify-end gap-2 px-2 py-2">
                    {(draft.length > 0 || draftSelectValue) && (
                        <button
                            type="button"
                            onClick={() => {
                                setDraft([])
                                setDraftSelectValue('')
                            }}
                            className="inline-flex h-7 items-center rounded-chip px-2 text-[11px] font-medium text-subtle hover:bg-row-hover hover:text-heading"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            onChange(draft)
                            onSelectChange?.(draftSelectValue)
                            setOpen(false)
                        }}
                        // Brand tokens, not raw orange: the same Done button now
                        // sits in Service Mapping's filters, and a hardcoded
                        // hue would drift from it (and from dark mode).
                        className="inline-flex h-7 items-center rounded-chip bg-brand-strong px-3 text-[11px] font-semibold text-white shadow-xs hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                        Done
                    </button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ─── Main page component ─────────────────────────────────────────────────────

export function ClientManagementView({ embedded = false }: { embedded?: boolean }) {
    const { can } = usePermissions()
    const canAdd = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Add Client')
    const canView = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'View Full Details')
    const canEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit')
    const canDelete = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Delete')
    const canToggle = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Toggle Client Status')
    const canNewMapping = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'New Mapping')
    const router = useRouter()

    const queryClient = useQueryClient()
    const createClient = useCreateClient()
    const updateClient = useUpdateClient()
    const deleteClientMut = useDeleteClient()
    const toggleStatusMut = useToggleClientStatus()
    const [togglingClientId, setTogglingClientId] = useState<string | null>(null)

    const [currentPage, setCurrentPage] = useState<number>(1)
    const [pageSize, setPageSize] = useState<number>(8)
    const [pageSizeReady, setPageSizeReady] = useState(false)
    const tableCardRef = useRef<HTMLDivElement | null>(null)
    const tableFooterRef = useRef<HTMLDivElement | null>(null)
    const [autoFitPageSize, setAutoFitPageSize] = useState(true)
    const [showForm, setShowForm] = useState<boolean>(false)
    const [createdClient, setCreatedClient] = useState<{ id: string; name: string; createdAt?: string } | null>(null)
    const { data: clientNames = [] } = useClientNames(showForm)
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const [viewMode, setViewMode] = useState<boolean>(false)
    const [currentClientId, setCurrentClientId] = useState<string | null>(null)
    const [formErrors, setFormErrors] = useState<FormErrors>({})
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; clientId: string | null; clientName: string }>({
        open: false,
        clientId: null,
        clientName: '',
    })
    const [deactivateModal, setDeactivateModal] = useState<{ open: boolean; client: Client | null }>({
        open: false,
        client: null,
    })
    // What the delete would take with it. Only fetched while the confirm dialog
    // is up — the counts exist to back that one decision and are worthless
    // outside it, so the listing pays nothing for them.
    const deleteImpactQuery = useClientDeletionImpact(deleteModal.clientId, deleteModal.open)

    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
        return () => clearTimeout(timer)
    }, [search])

    const [businessModelFilter, setBusinessModelFilter] = useState<string[]>([])
    const [yearsFilter, setYearsFilter] = useState<string[]>([])
    const [clientFilter, setClientFilter] = useState<string[]>([])
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
    const setColumnFilter = (key: string, values: string[]) => {
        setColumnFilters((prev) => ({ ...prev, [key]: values }))
    }

    const [sortKey, setSortKey] = useState<ClientSortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS)
    const toggleColumn = (key: string) => {
        const meta = ALL_COLUMN_KEYS.find((c) => c.key === key)
        if (meta?.alwaysOn) return
        setVisibleColumns((prev) => {
            if (prev.includes(key)) {
                setColumnFilters((cf) => {
                    const next = { ...cf }
                    delete next[key]
                    return next
                })
                return prev.filter((k) => k !== key)
            }
            return [...prev, key]
        })
    }
    const columnsDirty = useMemo(
        () =>
            visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length ||
            visibleColumns.some((k) => !DEFAULT_VISIBLE_COLUMNS.includes(k)),
        [visibleColumns]
    )

    const [showFilterOpen, setShowFilterOpen] = useState(true)

    const extraColumns = useMemo(
        () => visibleColumns.filter((k) => !DEFAULT_VISIBLE_COLUMNS.includes(k)),
        [visibleColumns]
    )
    const hasExtraColumns = extraColumns.length > 0
    const extraFilterKeys = useMemo(
        () => extraColumns.filter((k) => FILTERABLE_COLUMNS[k]),
        [extraColumns]
    )
    useEffect(() => {
        if (hasExtraColumns) setShowFilterOpen(true)
    }, [hasExtraColumns, extraColumns.length])

    const createdRanges = useMemo(() => yearsFilter
        .filter((year) => /^[1-9]\d{3}$/.test(year))
        .map((year) => {
            const n = Number(year)
            return { since: new Date(n, 0, 1).getTime(), until: new Date(n + 1, 0, 1).getTime() }
        }), [yearsFilter])

    const clientFilters = useMemo(() => ({
        search: debouncedSearch,
        businessModel: businessModelFilter,
        createdRanges: createdRanges.length ? createdRanges : undefined,
        clients: clientFilter.length ? clientFilter : undefined,
        columnFilters: Object.fromEntries(
            Object.entries(columnFilters).filter(([, v]) => v && v.length > 0)
        ),
        sortKey: sortKey || undefined,
        sortDir,
    }), [debouncedSearch, businessModelFilter, createdRanges, clientFilter, columnFilters, sortKey, sortDir])

    const listSignature = JSON.stringify({ ...clientFilters, pageSize })
    const [lastListSignature, setLastListSignature] = useState(listSignature)
    if (listSignature !== lastListSignature) {
        setLastListSignature(listSignature)
        setCurrentPage(1)
    }

    const {
        data: clientPage, isLoading: isLoadingList, isFetching, isPlaceholderData,
        isError: isListError, refetch: refetchClients,
    } = useClientsPage(clientFilters, currentPage, pageSize, pageSizeReady)

    const currentUsers = clientPage?.data ?? []
    const displayPage = clientPage?.page ?? currentPage
    const displayLimit = clientPage?.limit ?? pageSize
    const isListLoading = !pageSizeReady || isLoadingList || isPlaceholderData
    const isListBusy = isListLoading || isFetching || search.trim() !== debouncedSearch

    const [formData, setFormData] = useState<FormData>({
        contactPersons: [{ name: '', email: '', phoneNumber: '', address: '', isPrimary: true, contactType: 'Primary' }],
        clientCompany: '',
        clientPhone: '',
        createdYear: String(new Date().getFullYear()),
        description: '',
        website: '',
        clientAddress: '',
        clientLogo: '',
        clientLogoPosition: '',
        type: [],
        businessModel: '',
        status: 'active',
    })

    const [detailsClientId, setDetailsClientId] = useState<string | null>(null)
    const [layout, setLayout] = useState<'cards' | 'table'>('table')

    const isSaving = createClient.isPending || updateClient.isPending
    const isDeleting = deleteClientMut.isPending

    const handleSort = (key: string) => {
        const k = key as ClientSortKey
        if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return }
        if (sortDir === 'asc') { setSortDir('desc'); return }
        setSortKey(null)
        setSortDir('asc')
    }

    const hasActiveFilters = Boolean(
        search.trim() ||
        businessModelFilter.length ||
        yearsFilter.length ||
        clientFilter.length ||
        Object.values(columnFilters).some((v) => v && v.length)
    )
    const totalUsers = clientPage?.total ?? 0
    const allClientsCount = clientPage?.facets?.counts?.total ?? totalUsers
    const totalPages = clientPage?.totalPages ?? 1

    const { data: allClientsList = [] } = useClients()
    const yearOf = (c: Client) => (c.createdAt ? String(new Date(c.createdAt).getFullYear()) : '')

    const valueOfColumn = (c: Client, key: string): string => {
        const primary = orderedContacts(c.contactPersons)[0] as any
        switch (key) {
            case 'website': return c.website || ''
            case 'secondaryEmail': return primary?.secondaryEmail || ''
            case 'secondaryPhone': return primary?.secondaryPhoneNumber || ''
            case 'addressLine': return parseAddress(c.clientAddress).line1
            case 'city': return parseAddress(c.clientAddress).city
            case 'state': return parseAddress(c.clientAddress).state
            case 'pincode': return parseAddress(c.clientAddress).pincode
            case 'clientPhone': return c.clientPhone || ''
            default: return ''
        }
    }

    const filterFacets = useMemo(() => {
        const modelSet = new Set<string>()
        const yearSet = new Set<string>()
        const clientList: Array<{ value: string; label: string }> = []
        const modelSelected = new Set(businessModelFilter)
        const yearSelected = new Set(yearsFilter)
        const clientSelected = new Set(clientFilter)
        for (const c of allClientsList) {
            const y = yearOf(c)
            const modelMatch = modelSelected.size === 0 || (c.businessModel && modelSelected.has(c.businessModel))
            const yearMatch = yearSelected.size === 0 || (y && yearSelected.has(y))
            const clientMatch = clientSelected.size === 0 || clientSelected.has(c._id)
            if (yearMatch && clientMatch && c.businessModel) modelSet.add(c.businessModel)
            if (modelMatch && clientMatch && y) yearSet.add(y)
            if (modelMatch && yearMatch) {
                clientList.push({ value: c._id, label: c.clientCompany || 'Unnamed client' })
            }
        }
        return {
            models: [...modelSet].sort(),
            years: [...yearSet].sort((a, b) => b.localeCompare(a)),
            clients: clientList.sort((a, b) => a.label.localeCompare(b.label)),
        }
    }, [allClientsList, businessModelFilter, yearsFilter, clientFilter])

    const columnFilterOptions = useMemo(() => {
        const out: Record<string, Array<{ value: string; label: string }>> = {}
        for (const key of extraFilterKeys) {
            const seen = new Map<string, string>()
            for (const c of allClientsList) {
                const v = valueOfColumn(c, key)
                if (v && !seen.has(v)) seen.set(v, v)
            }
            out[key] = [...seen.entries()]
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label))
        }
        return out
    }, [allClientsList, extraFilterKeys])

    const availableModels = useMemo<[string, string][]>(
        () => filterFacets.models.map((m) => [m, businessModelDisplayName(m)] as [string, string]),
        [filterFacets.models],
    )
    const availableClients = useMemo(() => filterFacets.clients, [filterFacets.clients])
    const availableYears = useMemo(() => {
        const years = new Set(allClientsList.map(yearOf).filter(Boolean))
        return [...years].sort((a, b) => b.localeCompare(a))
    }, [allClientsList])

    useEffect(() => {
        if (clientPage && !isPlaceholderData && !isFetching) {
            setCurrentPage((p) => Math.min(p, totalPages))
        }
    }, [clientPage, isPlaceholderData, isFetching, totalPages])

    useEffect(() => {
        if (!autoFitPageSize) return
        if (layout !== 'table') return
        const cardEl = tableCardRef.current
        if (!cardEl) return
        const HEADER_H = 40
        const ROW_H = 40
        const SAFETY = 4
        const compute = () => {
            if (cardEl.clientHeight <= 0) return
            const footerH = tableFooterRef.current?.clientHeight ?? 44
            const budget = Math.max(0, cardEl.clientHeight - HEADER_H - footerH - SAFETY)
            const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)))
            setPageSize((prev) => (prev === fits ? prev : fits))
            setPageSizeReady(true)
        }
        compute()
        let resizeTimer: ReturnType<typeof setTimeout>
        const ro = new ResizeObserver(() => {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(compute, 100)
        })
        ro.observe(cardEl)
        if (tableFooterRef.current) ro.observe(tableFooterRef.current)
        return () => { ro.disconnect(); clearTimeout(resizeTimer) }
    }, [autoFitPageSize, layout])

    const clearFilters = () => {
        setSearch('')
        setYearsFilter([])
        setClientFilter([])
        setBusinessModelFilter([])
        setColumnFilters({})
        setCurrentPage(1)
    }

    const overviewModel = (businessModelFilter.length === 1
        ? businessModelFilter[0]
        : businessModelFilter.length === 0 ? '' : undefined) as OverviewModel | undefined

    const handleOverviewSelect = (model: OverviewModel) => {
        setBusinessModelFilter(model ? [model] : [])
    }

    const [exportRequest, setExportRequest] = useState<{ filters: typeof clientFilters; initialFormat: ExportFormat } | null>(null)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }
    const handleDescriptionChange = (html: string) => { setFormData((prev) => ({ ...prev, description: html })) }
    const handleContactChange = (index: number, field: string, value: string | boolean) => {
        setFormData((prev) => {
            const updated = [...prev.contactPersons]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, contactPersons: updated }
        })
    }
    const handleAddContact = () => {
        setFormData((prev) => {
            const next = prev.contactPersons.length
            const suggestedRole = next === 1 ? 'Secondary' : ''
            return {
                ...prev,
                contactPersons: [
                    ...prev.contactPersons,
                    { name: '', email: '', phoneNumber: '', address: '', isPrimary: false, contactType: suggestedRole },
                ],
            }
        })
    }
    const handleRemoveContact = (index: number) => {
        if (formData.contactPersons.length <= 1) return
        setFormData((prev) => {
            const removedWasPrimary = Boolean(prev.contactPersons[index]?.isPrimary)
            const next = prev.contactPersons.filter((_, i) => i !== index)
            if (removedWasPrimary && next.length && !next.some((c) => c.isPrimary)) {
                next[0] = { ...next[0], isPrimary: true }
            }
            return { ...prev, contactPersons: next }
        })
    }
    const handlePrimaryChange = (index: number, checked: boolean) => {
        setFormData((prev) => {
            const contacts = prev.contactPersons
            if (!checked || index === 0) return prev
            if (index < 0 || index >= contacts.length) return prev
            const promoted = { ...contacts[index], isPrimary: true }
            const rest = contacts.filter((_, i) => i !== index).map((c) => ({ ...c, isPrimary: false }))
            return { ...prev, contactPersons: [promoted, ...rest] }
        })
    }

    const resetFormData = (): FormData => ({
        contactPersons: [{ name: '', email: '', phoneNumber: '', address: '', isPrimary: true, contactType: 'Primary' }],
        clientCompany: '',
        clientPhone: '',
        createdYear: String(new Date().getFullYear()),
        description: '',
        website: '',
        clientAddress: '',
        clientLogo: '',
        clientLogoPosition: '',
        type: [],
        businessModel: '',
        status: 'active',
    })
    const handleLogoChange = (url: string) => { setFormData((prev) => ({ ...prev, clientLogo: url })) }
    const handleAddNew = () => {
        setFormData(resetFormData())
        setFormErrors({})
        setCurrentClientId(null)
        setIsEditing(false)
        setViewMode(false)
        setShowForm(true)
    }

    const loadClientIntoForm = (id: string, mode: 'edit' | 'view') => {
        const client = currentUsers.find((c) => c._id === id)
        if (!client) return
        setFormData({
            contactPersons: client.contactPersons?.length
                ? orderedContacts(client.contactPersons).map((c, i) => ({
                    ...c,
                    isPrimary: i === 0,
                    address: c.address || (i === 0 ? (client.clientAddress || '') : ''),
                }))
                : [{ name: '', email: '', phoneNumber: '', address: client.clientAddress || '', isPrimary: true, contactType: 'Primary' }],
            clientCompany: client.clientCompany || '',
            clientPhone: client.clientPhone || '',
            createdYear: (() => {
                const iso = client.createdAt
                if (!iso) return String(new Date().getFullYear())
                const y = new Date(iso).getFullYear()
                return Number.isFinite(y) ? String(y) : String(new Date().getFullYear())
            })(),
            description: client.description || '',
            website: client.website || '',
            clientAddress: client.clientAddress || '',
            clientLogo: client.clientLogo || '',
            clientLogoPosition: client.clientLogoPosition || '',
            type: client.type || [],
            businessModel: client.businessModel || '',
            status: client.status || 'active',
        })
        setFormErrors({})
        setCurrentClientId(id)
        setIsEditing(true)
        setViewMode(mode === 'view')
        setShowForm(true)
    }

    const handleEdit = (id: string) => loadClientIntoForm(id, 'edit')

    const handleView = (id: string) => {
        router.push(`/lms/pages/clientmanagement/${encodeURIComponent(id)}`)
    }
    const detailsClient = detailsClientId
        ? currentUsers.find((c) => c._id === detailsClientId) ?? null
        : null

    const handleNewMapping = (id: string) => {
        router.push(`/lms/pages/servicemapping?newMapping=1&clientId=${encodeURIComponent(id)}`)
    }
    const handleDelete = (id: string) => {
        const client = currentUsers.find((c) => c._id === id)
        setDeleteModal({ open: true, clientId: id, clientName: client?.clientCompany || 'this client' })
    }
    const performToggleStatus = (client: Client) => {
        if (togglingClientId) return
        const next = client.status === 'active' ? 'deactivated' : 'activated'
        setTogglingClientId(client._id)
        toggleStatusMut.mutate(client._id, {
            onSuccess: () => notify.success(`Client ${next}`),
            onError: (e: any) => notify.error(e?.message || 'Failed to update status'),
            onSettled: () => setTogglingClientId(null),
        })
    }
    const handleToggleStatus = (client: Client) => {
        if (togglingClientId) return
        if (client.status === 'active') {
            setDeactivateModal({ open: true, client })
            return
        }
        performToggleStatus(client)
    }
    const confirmDeactivate = () => {
        const client = deactivateModal.client
        setDeactivateModal({ open: false, client: null })
        if (client) performToggleStatus(client)
    }
    const confirmDelete = () => {
        if (!deleteModal.clientId) return
        deleteClientMut.mutate(deleteModal.clientId, {
            onSuccess: (res: any) => {
                // The toast says what actually went, not just "deleted" — a
                // cascade this wide should report its own size back.
                const removed: Record<string, number> = res?.data?.removed || {}
                const headline = [
                    removed.serviceMappings ? `${removed.serviceMappings} service${removed.serviceMappings === 1 ? '' : 's'}` : '',
                    removed.courses ? `${removed.courses} course${removed.courses === 1 ? '' : 's'}` : '',
                    removed.users ? `${removed.users} user${removed.users === 1 ? '' : 's'}` : '',
                ].filter(Boolean).join(' · ')
                notify.success(headline ? `Client deleted — ${headline} removed` : 'Client deleted successfully')
                setDeleteModal({ open: false, clientId: null, clientName: '' })
            },
            onError: (e: any) => notify.error(e?.message || 'Failed to delete client'),
        })
    }

    const validate = (): { errors: FormErrors; message: string | null } => {
        const errors: FormErrors = {}
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const name = formData.clientCompany.trim()
        if (!name) {
            errors.clientCompany = 'Client name is required'
        } else {
            const dup = clientNames.some(
                (c) => c._id !== currentClientId && c.clientCompany.trim().toLowerCase() === name.toLowerCase()
            )
            if (dup) errors.clientCompany = 'A client with this name already exists'
        }
        if (!formData.businessModel) errors.businessModel = 'Business model is required'
        const yr = parseInt(String(formData.createdYear || ''), 10)
        const nowYear = new Date().getFullYear()
        if (!Number.isFinite(yr) || yr < 2000 || yr > nowYear) {
            errors.createdYear = 'Select a valid Created Year'
        }
        const site = (formData.website || '').trim()
        if (site) {
            const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(site) ? site : `https://${site}`
            let hostOk = false
            try {
                const url = new URL(candidate)
                hostOk = /^(?!-)[a-z\d-]+(\.[a-z\d-]+)*\.[a-z]{2,}$/i.test(url.hostname)
                    && (url.protocol === 'http:' || url.protocol === 'https:')
            } catch { hostOk = false }
            if (!hostOk) errors.website = 'Enter a valid website URL'
        }
        const contactErrors: ContactErrors[] = formData.contactPersons.map((cp) => {
            const e: ContactErrors = {}
            if (!cp.name.trim()) e.name = 'Required'
            const addressLine = String(cp.address || '').split('\n')[0].trim()
            if (!addressLine) e.address = 'Address line is required'
            if (!cp.email.trim()) e.email = 'Required'
            else if (!emailRegex.test(cp.email.trim())) e.email = 'Invalid email'
            const { code: ccode, local } = splitPhone(cp.phoneNumber)
            if (!cp.phoneNumber.trim()) e.phoneNumber = 'Required'
            else if (ccode === '+91' ? local.length !== 10 : local.length < 6 || local.length > 14) {
                e.phoneNumber = ccode === '+91' ? 'Enter the 10-digit mobile number' : 'Invalid mobile number'
            }
            // A secondary equal to the contact's own Email is allowed — that
            // is exactly what "Same as primary" fills in.
            const sec2 = (cp.secondaryEmail || '').trim()
            if (sec2 && !emailRegex.test(sec2)) e.secondaryEmail = 'Invalid email'
            const secPhone = (cp.secondaryPhoneNumber || '').trim()
            if (secPhone) {
                const { code: sc, local: sl } = splitPhone(secPhone)
                if (sc === '+91' ? sl.length !== 10 : sl.length < 6 || sl.length > 14) {
                    e.secondaryPhoneNumber = sc === '+91' ? 'Enter the 10-digit mobile number' : 'Invalid mobile number'
                }
            }
            return e
        })
        const seen = new Map<string, number>()
        formData.contactPersons.forEach((cp, i) => {
            const key = cp.email.trim().toLowerCase()
            if (!key) return
            if (seen.has(key)) contactErrors[i].email = 'Duplicate email'
            else seen.set(key, i)
        })
        if (contactErrors.some((e) => Object.keys(e).length)) errors.contacts = contactErrors
        const primaryCount = formData.contactPersons.filter((c) => c.isPrimary).length
        let message: string | null = null
        if (errors.clientCompany || errors.businessModel || errors.createdYear || errors.website || errors.clientAddress || errors.contacts) {
            message = 'Please fix the highlighted fields'
        } else if (primaryCount !== 1) {
            message = 'Please mark exactly one contact as primary'
        }
        return { errors, message }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (isSaving) return
        const { errors, message } = validate()
        setFormErrors(errors)
        if (message) { notify.error(message); return }
        const rawSite = (formData.website || '').trim()
        const website = !rawSite || /^[a-z][a-z\d+\-.]*:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`
        const primaryAddress = (formData.contactPersons[0]?.address || '').trim() || formData.clientAddress
        const payload: Omit<ClientInput, 'services'> = {
            clientCompany: formData.clientCompany.trim(),
            clientPhone: (formData.clientPhone || '').trim(),
            createdYear: formData.createdYear,
            description: formData.description,
            website,
            clientAddress: primaryAddress,
            clientLogo: formData.clientLogo ?? '',
            clientLogoPosition: formData.clientLogoPosition ?? '',
            type: formData.type,
            businessModel: formData.businessModel as ClientInput['businessModel'],
            status: formData.status,
            contactPersons: formData.contactPersons,
        }
        if (isEditing && currentClientId) {
            updateClient.mutate(
                { id: currentClientId, payload },
                {
                    onSuccess: () => { notify.success('Client updated successfully'); setShowForm(false) },
                    onError: (er: any) => notify.error(er?.message || 'Failed to update client'),
                }
            )
        } else {
            createClient.mutate(payload, {
                onSuccess: (data: any) => {
                    const doc = data?.data && typeof data.data === 'object' ? data.data : data
                    const newId: string | undefined = doc?._id || doc?.id
                    const newName: string = doc?.clientCompany || payload?.clientCompany || 'The client'
                    setShowForm(false)
                    clearFilters()
                    setSortKey(null)
                    setSortDir('asc')
                    if (newId) {
                        queryClient.setQueryData<Client[] | undefined>(
                            clientManagementKeys.lists(),
                            (prev) => {
                                if (!Array.isArray(prev)) return prev
                                const list = prev
                                if (list.some(c => c._id === newId)) return list
                                return [doc as Client, ...list]
                            },
                        )
                        setCreatedClient({ id: newId, name: newName, createdAt: doc.createdAt })
                    } else {
                        notify.success('Client added successfully')
                    }
                },
                onError: (er: any) => notify.error(er?.message || 'Failed to add client'),
            })
        }
    }

    const primaryOf = (client: Client) => orderedContacts(client.contactPersons)[0]
    const createdYear = (client: Client): string => {
        if (!client.createdAt) return '—'
        const d = new Date(client.createdAt)
        return Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear())
    }
    const columns: Column<Client>[] = [
        {
            key: 'num',
            label: '#',
            sortKey: 'serial',
            className: 'w-[4%] pl-4 sm:pl-5 pr-3 text-left text-xs text-faint tabular-nums align-middle whitespace-nowrap',
            skeletonWidth: '20px',
            render: (_client, i) => sortKey === 'serial' && sortDir === 'desc'
                ? totalUsers - (displayPage - 1) * displayLimit - i
                : (displayPage - 1) * displayLimit + i + 1,
        },
        {
            key: 'clientId',
            label: 'Client ID',
            sortKey: 'clientId',
            className: 'w-[10%] px-3 text-left align-middle whitespace-nowrap',
            skeletonWidth: '70%',
            render: (client) => client.clientId ? (
                <span className="inline-flex items-center rounded-chip bg-ink-50 px-2 py-0.5 font-mono text-[11px] font-medium text-heading tabular-nums" title={client.clientId}>
                    {client.clientId}
                </span>
            ) : (
                <span className="text-faint" title="A Client ID will be assigned automatically">—</span>
            ),
        },
        {
            key: 'createdYear',
            label: 'Created Year',
            sortKey: 'createdAt',
            className: 'w-[10%] px-3 text-left align-middle tabular-nums whitespace-nowrap',
            skeletonWidth: '50%',
            render: (client) => {
                const y = createdYear(client)
                return <span className="text-subtle" title={fmtCreatedDate(client.createdAt)}>{y}</span>
            },
        },
        {
            key: 'clientCompany',
            label: 'Client Name',
            sortKey: 'company',
            className: 'w-[16%] px-3 text-left align-middle',
            skeletonWidth: '80%',
            render: (client) => {
                const name = client.clientCompany || 'N/A'
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <ClientAvatar name={name} size="sm" logoUrl={client.clientLogo || undefined} logoPosition={client.clientLogoPosition || undefined} />
                        <span className="block truncate min-w-0 flex-1" title={name}>{name}</span>
                        {client.status === 'inactive' && <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-slate-600">Inactive</span>}
                    </div>
                )
            },
        },
        {
            key: 'businessModel',
            label: 'Business Model',
            sortKey: 'model',
            className: 'w-[17%] px-3 text-left align-middle',
            render: (client) =>
                client.businessModel ? (
                    <span className="block truncate text-body" title={businessModelDisplayName(client.businessModel)}>
                        {businessModelDisplayName(client.businessModel)}
                    </span>
                ) : (
                    <span className="text-faint italic" title="Edit this client to set its business model">Not set</span>
                ),
        },
        {
            key: 'contactName',
            label: 'Contact Person Name',
            sortKey: 'contactName',
            className: 'w-[14%] px-3 text-left align-middle',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                const total = client.contactPersons?.length ?? 0
                const extra = Math.max(0, total - 1)
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-body truncate min-w-0 flex-1" title={primary.name || 'N/A'}>{primary.name || 'N/A'}</span>
                        {extra > 0 && (
                            <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-brand-wash text-brand-strong text-[10px] font-semibold tabular-nums flex-shrink-0" title={`${extra} more contact${extra === 1 ? '' : 's'}`}>
                                +{extra}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            key: 'email',
            label: 'Email',
            sortKey: 'email',
            className: 'w-[15%] px-3 text-left align-middle',
            skeletonWidth: '85%',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                return <span className="text-subtle truncate block" title={primary.email || 'N/A'}>{primary.email || '—'}</span>
            },
        },
        {
            key: 'contactNumber',
            label: 'Phone Number',
            sortKey: 'contactNumber',
            className: 'w-[13%] px-3 text-left align-middle',
            skeletonWidth: '75%',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                return <span className="text-subtle tabular-nums truncate block" title={primary.phoneNumber || 'N/A'}>{primary.phoneNumber || '—'}</span>
            },
        },
        {
            key: 'secondaryEmail',
            label: 'Secondary Email',
            className: 'w-[15%] px-3 text-left align-middle',
            render: (client) => {
                const primary = primaryOf(client) as any
                const val = primary?.secondaryEmail
                return val ? <span className="text-subtle truncate block" title={val}>{val}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'secondaryPhone',
            label: 'Secondary Phone Number',
            className: 'w-[14%] px-3 text-left align-middle',
            render: (client) => {
                const primary = primaryOf(client) as any
                const val = primary?.secondaryPhoneNumber
                return val ? <span className="text-subtle tabular-nums truncate block" title={val}>{val}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'website',
            label: 'Website Link',
            className: 'w-[14%] px-3 text-left align-middle',
            render: (client) => client.website ? (
                <a href={client.website} target="_blank" rel="noreferrer" className="text-brand-strong underline-offset-2 hover:underline truncate block" title={client.website}>
                    {client.website.replace(/^https?:\/\//, '')}
                </a>
            ) : (
                <span className="text-faint">—</span>
            ),
        },
        {
            key: 'addressLine',
            label: 'Address Line',
            className: 'w-[18%] px-3 text-left align-middle',
            render: (client) => {
                const { line1 } = parseAddress(client.clientAddress)
                return line1 ? <span className="text-subtle truncate block" title={client.clientAddress || ''}>{line1}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'state',
            label: 'State',
            className: 'w-[10%] px-3 text-left align-middle',
            render: (client) => {
                const { state } = parseAddress(client.clientAddress)
                return state ? <span className="text-subtle truncate block" title={state}>{state}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'city',
            label: 'City',
            className: 'w-[12%] px-3 text-left align-middle',
            render: (client) => {
                const { city } = parseAddress(client.clientAddress)
                return city ? <span className="text-subtle truncate block" title={city}>{city}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'pincode',
            label: 'Pincode',
            className: 'w-[9%] px-3 text-left align-middle',
            render: (client) => {
                const { pincode } = parseAddress(client.clientAddress)
                return pincode ? <span className="text-subtle tabular-nums truncate block" title={pincode}>{pincode}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'description',
            label: 'About Client',
            className: 'w-[22%] px-3 text-left align-middle',
            render: (client) => {
                const plain = plainText(client.description)
                return plain ? <span className="text-subtle truncate block" title={plain}>{plain}</span> : <span className="text-faint">—</span>
            },
        },
        {
            key: 'actions',
            label: 'Actions',
            className: 'no-print w-[7%] pl-4 pr-1 text-right whitespace-nowrap align-middle',
            skeletonWidth: '20px',
            render: (client) => {
                const isActive = client.status === 'active'
                const isToggling = togglingClientId === client._id
                const hasSecondary = (client.contactPersons?.length ?? 0) > 1
                return (
                    <div className="flex items-center justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" title="More actions" aria-label={`More actions for ${client.clientCompany}`} className={ICON_BUTTON_CLASS}>
                                    <MoreVertical size={14} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" align="start" sideOffset={-81} alignOffset={40} collisionPadding={8} sticky="always" className="w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.06)]">
                                <DropdownMenuItem onSelect={() => handleView(client._id)} className={CLIENT_ACTION_CLASS}>
                                    <Eye /> View details
                                </DropdownMenuItem>
                                {hasSecondary && (
                                    <DropdownMenuItem onSelect={() => handleView(client._id)} className={CLIENT_ACTION_CLASS}>
                                        <Users /> View all contacts
                                        <span className="ml-auto rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-subtle">{client.contactPersons.length}</span>
                                    </DropdownMenuItem>
                                )}
                                {canEdit && (
                                    <DropdownMenuItem onSelect={() => handleEdit(client._id)} className={CLIENT_ACTION_CLASS}>
                                        <Pencil /> Edit client
                                    </DropdownMenuItem>
                                )}
                                {canNewMapping && (
                                    <DropdownMenuItem onSelect={() => handleNewMapping(client._id)} className={CLIENT_ACTION_CLASS}>
                                        <Layers /> Map new service
                                    </DropdownMenuItem>
                                )}
                                {canToggle && (
                                    <>
                                        <DropdownMenuSeparator className="mx-1 my-1.5" />
                                        <DropdownMenuItem
                                            disabled={isToggling}
                                            onSelect={(event) => { event.preventDefault(); handleToggleStatus(client) }}
                                            className={CLIENT_ACTION_CLASS}
                                        >
                                            <Power />
                                            <span className={`flex items-center gap-2 ${isToggling ? 'animate-pulse' : ''}`}>
                                                <span>{isToggling ? 'Updating…' : isActive ? 'Active' : 'Inactive'}</span>
                                                <span
                                                    role="switch"
                                                    aria-checked={isActive}
                                                    aria-label={isActive ? 'Deactivate client' : 'Activate client'}
                                                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                                                        isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                                    } ${isToggling ? 'opacity-60' : ''}`}
                                                >
                                                    <span
                                                        className={`inline-block size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                                            isActive ? 'translate-x-3.5' : 'translate-x-0.5'
                                                        }`}
                                                    />
                                                </span>
                                            </span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator className="mx-1 my-1.5" />
                                        <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(client._id)} className={CLIENT_ACTION_CLASS}>
                                            <Trash2 /> Delete client
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ]

    const visibleColumnDefs = useMemo(
        () => columns.filter((c) => visibleColumns.includes(c.key)),
        [columns, visibleColumns],
    )
    const tableMinWidth = columnsDirty ? `${visibleColumns.length * 150}px` : undefined

    const addClientButton = canAdd ? (
        <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 shrink-0 whitespace-nowrap"
        >
            <Plus size={15} strokeWidth={2.4} />
            Add Client
        </button>
    ) : null

    const renderColumnFilter = (key: string) => {
        const options = columnFilterOptions[key] || []
        const placeholder = FILTERABLE_COLUMNS[key] || `All ${key}`
        return (
            <div key={key} className="w-full min-w-0 sm:w-[190px]">
                <FilterDropdown
                    label={ALL_COLUMN_KEYS.find((c) => c.key === key)?.label || key}
                    options={options}
                    value={columnFilters[key] || []}
                    onChange={(v) => setColumnFilter(key, v)}
                    placeholder={placeholder}
                />
            </div>
        )
    }

    return (
        <>
            {!embedded && <WorkspaceActionSlot>{addClientButton}</WorkspaceActionSlot>}
            {exportRequest && <ClientExportDialog filters={exportRequest.filters} initialFormat={exportRequest.initialFormat} onClose={() => setExportRequest(null)} />}
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="flex flex-col h-full min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-3 pb-3"
            >
                <ClientOverview
                    counts={clientPage?.facets?.counts}
                    isError={isListError}
                    activeModel={overviewModel}
                    onSelect={handleOverviewSelect}
                />

                {/* ── Toolbar: Search · Show filter · Columns · status ── */}
                <div className="no-print mt-3 flex shrink-0 items-center gap-2 flex-wrap min-w-0">
                    {/* Search */}
                    <div className="relative min-w-0 basis-full sm:basis-[220px] sm:flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search client, contact, email…"
                            className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                        />
                        {search && (
                            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {!hasExtraColumns && (
                        <>
                            <div className="w-full min-w-0 sm:w-[195px]">
                                <FilterDropdown
                                    label="Business models"
                                    options={availableModels.map(([value, label]) => ({ value, label }))}
                                    value={businessModelFilter}
                                    onChange={setBusinessModelFilter}
                                    placeholder="All business models"
                                />
                            </div>
                            <div className="w-full min-w-0 sm:w-[190px]">
                                <FilterDropdown
                                    label="Clients"
                                    options={availableClients}
                                    value={clientFilter}
                                    onChange={setClientFilter}
                                    placeholder="All clients"
                                    selectOptions={availableYears}
                                    selectValue={yearsFilter[0] || ''}
                                    onSelectChange={(year) => setYearsFilter(year ? [year] : [])}
                                />
                            </div>
                        </>
                    )}

                    {/* Show filter */}
                    {hasExtraColumns && (
                        <button
                            type="button"
                            onClick={() => setShowFilterOpen((v) => !v)}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors ${
                                showFilterOpen
                                    ? 'border-brand-500/40 bg-brand-wash text-brand-strong'
                                    : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'
                            }`}
                            aria-expanded={showFilterOpen}
                            title="Show or hide filters"
                        >
                            <Filter className="size-3.5" />
                            Show filter
                            <ChevronDown className={`size-3.5 transition-transform ${showFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}

                    {/* Columns */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body hover:bg-row-hover focus:outline-none focus:ring-2 focus:ring-brand/15"
                                title="Show or hide table columns"
                            >
                                <Layers className="size-3.5" />
                                Columns
                                {columnsDirty && (
                                    <span className="ml-0.5 inline-flex items-center rounded-full bg-brand-strong px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums">
                                        {visibleColumns.length}
                                    </span>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            sideOffset={6}
                            collisionPadding={8}
                            className="w-60 rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.06)]"
                        >
                            <DropdownMenuLabel className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
                                Visible columns
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="mx-1 my-1" />
                            <div className="max-h-80 overflow-y-auto">
                                {ALL_COLUMN_KEYS.map(({ key, label, alwaysOn }) => {
                                    const checked = visibleColumns.includes(key)
                                    return (
                                        <label
                                            key={key}
                                            className={`flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-body hover:bg-row-hover ${alwaysOn ? 'cursor-not-allowed opacity-60' : ''}`}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={alwaysOn}
                                                onChange={() => toggleColumn(key)}
                                                className="size-3.5 shrink-0 cursor-pointer rounded border-hairline-strong accent-brand-strong disabled:cursor-not-allowed"
                                            />
                                            <span className="truncate">{label}</span>
                                        </label>
                                    )
                                })}
                            </div>
                            {columnsDirty && (
                                <>
                                    <DropdownMenuSeparator className="mx-1 my-1" />
                                    <button
                                        type="button"
                                        onClick={() => { setVisibleColumns(DEFAULT_VISIBLE_COLUMNS); setColumnFilters({}) }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-strong hover:bg-brand-wash"
                                    >
                                        Reset to default
                                    </button>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {hasActiveFilters && (
                        <span
                            role="status"
                            title={`${totalUsers} of ${allClientsCount} clients match the current filters`}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-brand-500/30 bg-brand-wash px-2.5 text-xs font-semibold text-brand-strong"
                        >
                            <span className="tabular-nums">{totalUsers.toLocaleString()}</span>
                            <span className="font-medium opacity-80">of {allClientsCount.toLocaleString()}</span>
                        </span>
                    )}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control px-2 text-xs font-medium text-subtle hover:bg-row-hover hover:text-heading"
                        >
                            <X className="size-3.5" />
                            Clear all
                        </button>
                    )}
                </div>

                {/* ── Show filter panel ── */}
                {hasExtraColumns && showFilterOpen && (
                    <div className="no-print mt-2 shrink-0 rounded-control border border-hairline bg-surface px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-full min-w-0 sm:w-[195px]">
                                <FilterDropdown
                                    label="Business models"
                                    options={availableModels.map(([value, label]) => ({ value, label }))}
                                    value={businessModelFilter}
                                    onChange={setBusinessModelFilter}
                                    placeholder="All business models"
                                />
                            </div>

                            <div className="w-full min-w-0 sm:w-[190px]">
                                <FilterDropdown
                                    label="Clients"
                                    options={availableClients}
                                    value={clientFilter}
                                    onChange={setClientFilter}
                                    placeholder="All clients"
                                    selectOptions={availableYears}
                                    selectValue={yearsFilter[0] || ''}
                                    onSelectChange={(year) => setYearsFilter(year ? [year] : [])}
                                />
                            </div>

                            {extraFilterKeys.map((key) => renderColumnFilter(key))}
                        </div>
                    </div>
                )}

                {/* ── Content ── */}
                <div ref={tableCardRef} aria-busy={isListBusy} className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden">
                    {isListError ? (
                        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-sm text-subtle">
                            <p>Couldn’t load clients. Please try again.</p>
                            <Button variant="outline" size="sm" onClick={() => void refetchClients()} disabled={isFetching}>Retry</Button>
                        </div>
                    ) : layout === 'table' ? (
                        <div className="flex-1 min-h-0 overflow-x-auto">
                            <DataTable
                                rows={currentUsers}
                                columns={visibleColumnDefs}
                                rowKey={(client) => client._id}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={handleSort}
                                isLoading={isListLoading}
                                isFiltered={hasActiveFilters}
                                fixedLayout={!columnsDirty}
                                fillHeight
                                emptyTitle={hasActiveFilters ? 'No clients match these filters' : 'No clients yet'}
                                emptyHint={
                                    hasActiveFilters
                                        ? 'Try widening or clearing them to see more.'
                                        : 'Add a client organization to see it listed here.'
                                }
                                emptyAction={hasActiveFilters ? 'Clear filters' : (canAdd ? 'Add Client' : undefined)}
                                onEmptyAction={hasActiveFilters ? clearFilters : (canAdd ? handleAddNew : undefined)}
                                style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-auto bg-canvas p-4">
                            {isListLoading ? (
                                <SkeletonCards count={6} className="lg:grid-cols-2 xl:grid-cols-3" />
                            ) : currentUsers.length === 0 ? (
                                hasActiveFilters ? (
                                    <EmptyState
                                        icon={SearchX}
                                        title="No clients match these filters"
                                        message="Try widening or clearing them to see more."
                                        primaryAction={
                                            <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        icon={Building2}
                                        title="No clients yet"
                                        message="Add a client organization to see it listed here."
                                        primaryAction={canAdd ? (
                                            <Button size="sm" onClick={handleAddNew}><Plus className="size-4" /> Add Client</Button>
                                        ) : undefined}
                                    />
                                )
                            ) : (
                                <ClientCards
                                    clients={currentUsers}
                                    togglingClientId={togglingClientId}
                                    onView={handleView}
                                    onEdit={handleEdit}
                                    onToggleStatus={handleToggleStatus}
                                    onDelete={handleDelete}
                                />
                            )}
                        </div>
                    )}

                    <div ref={tableFooterRef} className="no-print min-h-11">
                        <TableFooter
                            from={currentUsers.length === 0 ? 0 : (displayPage - 1) * displayLimit + 1}
                            to={currentUsers.length === 0 ? 0 : (displayPage - 1) * displayLimit + currentUsers.length}
                            total={totalUsers}
                            pageSize={pageSize}
                            onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1) }}
                            currentPage={displayPage}
                            totalPages={totalPages}
                            onPage={setCurrentPage}
                            isLoading={isListBusy}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Client form modal */}
            <ClientFormModal
                open={showForm}
                onClose={() => setShowForm(false)}
                isEditing={isEditing}
                viewMode={viewMode}
                isLoading={isSaving}
                formData={formData}
                errors={formErrors}
                onInputChange={handleInputChange}
                onDescriptionChange={handleDescriptionChange}
                onLogoChange={handleLogoChange}
                onContactChange={handleContactChange}
                onAddContact={handleAddContact}
                onRemoveContact={handleRemoveContact}
                onPrimaryChange={handlePrimaryChange}
                onSubmit={handleSubmit}
                clientCode={isEditing && currentClientId
                    ? currentUsers.find((c) => c._id === currentClientId)?.clientId
                    : undefined}
                clientCount={allClientsCount}
            />

            <DeleteConfirmModal
                open={deleteModal.open}
                clientName={deleteModal.clientName}
                isLoading={isDeleting}
                impact={deleteImpactQuery.data?.counts}
                impactLoading={deleteImpactQuery.isLoading}
                impactError={deleteImpactQuery.isError}
                sharedUsersKept={deleteImpactQuery.data?.sharedUsersKept}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, clientId: null, clientName: '' })}
            />

            <DeactivateConfirmModal
                open={deactivateModal.open}
                clientName={deactivateModal.client?.clientCompany || 'this client'}
                isLoading={togglingClientId === deactivateModal.client?._id}
                onConfirm={confirmDeactivate}
                onCancel={() => setDeactivateModal({ open: false, client: null })}
            />

            <ClientCreatedSuccessModal
                open={!!createdClient}
                clientName={createdClient?.name || ''}
                createdAt={createdClient?.createdAt}
                canCreateService={canNewMapping}
                onCreateService={() => {
                    if (createdClient) {
                        const id = createdClient.id
                        setCreatedClient(null)
                        handleNewMapping(id)
                    }
                }}
                onClose={() => {
                    if (createdClient) {
                        const id = createdClient.id
                        setCreatedClient(null)
                        router.push(`/lms/pages/clientmanagement/${encodeURIComponent(id)}?created=1`)
                    } else {
                        setCreatedClient(null)
                    }
                }}
            />

            <ClientDetailsDrawer
                open={!!detailsClient}
                client={detailsClient}
                onClose={() => setDetailsClientId(null)}
                onEdit={(id) => { setDetailsClientId(null); handleEdit(id) }}
                onToggleStatus={handleToggleStatus}
                onDelete={(id) => { setDetailsClientId(null); handleDelete(id) }}
            />
        </>
    )
}

export default function ClientManagementPage() {
    return <ClientManagementView />
}