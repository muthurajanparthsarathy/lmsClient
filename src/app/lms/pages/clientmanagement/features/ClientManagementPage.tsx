"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Building2, Eye, Filter, Layers,
    MoreVertical, Pencil, Plus, Power, SearchX, Trash2, Users, X,
    Search,
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
    useDeleteClient, useToggleClientStatus,
    clientManagementKeys,
    type Client, type ClientInput,
} from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import {
    businessModelDisplayName,
    fmtCreatedDate, notify, orderedContacts, splitPhone, stripHtml,
    type ClientSortKey, type ContactErrors, type FormData, type FormErrors,
} from './lib'
import ClientFormModal from './ClientFormModal'
import ClientDetailsDrawer from './ClientDetailsDrawer'
import { ClientCreatedSuccessModal, DeleteConfirmModal } from './ConfirmDialogs'
import ClientCards from './ClientCards'
import { MappingMultiFilter } from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import ClientOverview from './ClientOverview'
import ClientExportDialog from './ClientExportDialog'
import type { ExportFormat } from './clientExport'
import { Can } from '@/app/lms/pages/usermanagement/components/permissions/Can'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

// The row's icon buttons. Kept as a constant so the kebab trigger matches the
// eye and pencil exactly — a Radix trigger can't inherit a sibling's styling.
const ICON_BUTTON_CLASS =
    'w-8 h-8 rounded-lg border border-transparent bg-transparent text-subtle flex items-center ' +
    'justify-center hover:text-heading hover:border-hairline hover:bg-row-hover ' +
    'data-[state=open]:bg-row-hover data-[state=open]:border-hairline data-[state=open]:text-heading ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'

const CLIENT_ACTION_CLASS = 'min-h-9 gap-3 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer [&_svg]:size-4 [&_svg]:stroke-[1.6]'

// ─── Main page component ──────────────────────────────────────────────────────

// Embedded consumers supply their own shell; the route is wrapped by the shared
// workspace chrome (tab strip) mounted in `app/lms/pages/layout.tsx`.
export function ClientManagementView({ embedded = false }: { embedded?: boolean }) {
    // Full-id permission checks — mirrors PermissionModal.PERMISSION_DATA
    // entries for admin-clientmanagement so a button appears only when the
    // signed-in user was actually granted that functionality.
    const { can } = usePermissions()
    const canAdd = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Add Client')
    const canView = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'View Full Details')
    const canEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit')
    const canDelete = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Delete')
    const canToggle = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Toggle Client Status')
    // Row shortcut into Service Mapping with the New Mapping wizard already
    // open on this client. Its own functionality so it can be granted (or
    // withheld) independently of Add/Edit/Delete.
    const canNewMapping = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'New Mapping')
    const router = useRouter()


    const queryClient = useQueryClient()
    const createClient = useCreateClient()
    const updateClient = useUpdateClient()
    const deleteClientMut = useDeleteClient()
    const toggleStatusMut = useToggleClientStatus()
    // Client currently being toggled from the list (its switch shows a busy state).
    const [togglingClientId, setTogglingClientId] = useState<string | null>(null)

    const [currentPage, setCurrentPage] = useState<number>(1)
    // Measure before the first request, avoiding a second fetch for a new size.
    // Initial page size before the auto-fit measure lands. 8 matches the
    // typical viewport more closely than the old 5, so the first render
    // shows enough rows to make sense of the list even before the
    // ResizeObserver refines it to the real fit.
    const [pageSize, setPageSize] = useState<number>(8)
    const [pageSizeReady, setPageSizeReady] = useState(false)
    // Auto-fit page size: measure the DataTable card's available height and
    // pick the row count that fills it without triggering internal vertical
    // scroll. Once the user picks a page size manually, autoFit turns off so
    // their choice sticks.
    const tableCardRef = useRef<HTMLDivElement | null>(null)
    // Wrapper around TableFooter — measured at runtime so the compute uses
    // the footer's REAL height (which grows when the pager wraps on narrow
    // viewports) instead of a hard-coded constant that would silently push
    // a row off-screen when wrapping happened.
    const tableFooterRef = useRef<HTMLDivElement | null>(null)
    const [autoFitPageSize, setAutoFitPageSize] = useState(true)
    const [showForm, setShowForm] = useState<boolean>(false)
    // "Client added" success dialog. When set, the small success modal
    // renders with a "Create service" button that hands off to the Service
    // Mapping page with this client pre-selected (2026-08-30 flow tweak).
    const [createdClient, setCreatedClient] = useState<{ id: string; name: string; createdAt?: string } | null>(null)
    // Company names only, for the Add/Edit form's inline duplicate check —
    // which cannot be answered from a single page. Loaded only while that form
    // is open, so the listing never pays for it. (The server enforces the same
    // rule on create/update; this keeps the warning appearing on blur.)
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

    // ── Search / filter / sort state ──
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
        return () => clearTimeout(timer)
    }, [search])
    // All three filters are multi-select, matching the Service Mapping list's
    // filter row. Empty array means "no filter" (every option is active); an
    // array with N entries narrows to those N values via an $in match on the
    // server.
    const [businessModelFilter, setBusinessModelFilter] = useState<string[]>([])
    const [yearsFilter, setYearsFilter] = useState<string[]>([])
    /* Which clients to show, rather than which STATUS to show. The list is
     * already a list of clients, so a picker over it is the filter people
     * actually reach for; status lives on each row's own toggle. Empty is
     * "every client" — the dropdown's own first item says so. */
    const [clientFilter, setClientFilter] = useState<string[]>([])
    const [sortKey, setSortKey] = useState<ClientSortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    // ── The client list ────────────────────────────────────────────────
    // The page used to download every client and filter, sort and slice the
    // array here. The search, the four filters and the sort now run in Mongo
    // and one page crosses the wire; the predicate below was deleted rather
    // than reimplemented, because the server port (getClientsPaginated) is a
    // field-for-field copy of it, checked against this page's own predicate
    // over live data.
    // Each picked year becomes an inclusive one-year range; the server ORs
    // them, so ticking 2024 + 2026 selects rows created in either year.
    const createdRanges = useMemo(() => yearsFilter
        .filter((year) => /^[1-9]\d{3}$/.test(year))
        .map((year) => {
            const n = Number(year)
            return { since: new Date(n, 0, 1).getTime(), until: new Date(n + 1, 0, 1).getTime() }
        }), [yearsFilter])
    const clientFilters = useMemo(() => ({
        search: debouncedSearch,
        // Empty array → no filter (server treats it that way, buildClientPageParams omits it).
        businessModel: businessModelFilter,
        createdRanges: createdRanges.length ? createdRanges : undefined,
        clients: clientFilter.length ? clientFilter : undefined,
        sortKey: sortKey || undefined,
        sortDir,
    }), [debouncedSearch, businessModelFilter, createdRanges, clientFilter, sortKey, sortDir])

    // Reset before the query observes new filters, avoiding a request for the old page.
    const listSignature = JSON.stringify({ ...clientFilters, pageSize })
    const [lastListSignature, setLastListSignature] = useState(listSignature)
    if (listSignature !== lastListSignature) {
        setLastListSignature(listSignature)
        setCurrentPage(1)
    }

    const {
        data: clientPage, isLoading: isLoadingList, isFetching, isPlaceholderData,
        isError: isListError, refetch: refetchClients,
    } = useClientsPage(
        clientFilters, currentPage, pageSize, pageSizeReady
    )
    const currentUsers = clientPage?.data ?? []
    const displayPage = clientPage?.page ?? currentPage
    const displayLimit = clientPage?.limit ?? pageSize
    const isListLoading = !pageSizeReady || isLoadingList || isPlaceholderData
    const isListBusy = isListLoading || isFetching || search.trim() !== debouncedSearch

    const [formData, setFormData] = useState<FormData>({
        contactPersons: [{ name: '', email: '', phoneNumber: '', isPrimary: true, contactType: 'Primary' }],
        clientCompany: '',
        clientPhone: '',
        createdYear: String(new Date().getFullYear()),
        description: '',
        clientAddress: '',
        clientLogo: '',
        clientLogoPosition: '',
        type: [],
        businessModel: '',
        status: 'active',
    })

    // Read-only full-details view (opened by the eye icon). The client is
    // resolved from clientList by id at render — snapshotting the whole doc
    // here made the drawer show the pre-toggle status until reopened, because
    // toggle-status's refetch never touched the snapshot.
    const [detailsClientId, setDetailsClientId] = useState<string | null>(null)

    // Presentation-only: table (default, the primary listing) or the card layout.
    const [layout, setLayout] = useState<'cards' | 'table'>('table')

    const isSaving = createClient.isPending || updateClient.isPending
    const isDeleting = deleteClientMut.isPending

    // (The filter and sort that used to live here now run in Mongo — see
    // `clientFilters` above, a port of them field for field. The search in
    // particular matched a single JOINED string across company, address and
    // every contact's name/email/phone, so the server assembles the same
    // haystack rather than matching per field: a query straddling two fields
    // ("<company> <city>") has to keep working.)

    // Clicking the sorted column flips direction; a third click clears it and
    // returns to the server's own order, which is a real state the user wants
    // back and is otherwise unreachable.
    const handleSort = (key: string) => {
        const k = key as ClientSortKey
        if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return }
        if (sortDir === 'asc') { setSortDir('desc'); return }
        setSortKey(null)
        setSortDir('asc')
    }

    const hasActiveFilters = Boolean(search.trim() || businessModelFilter.length || yearsFilter.length || clientFilter.length)
    const totalUsers = clientPage?.total ?? 0
    /* The whole book, which the overview cards also show — `total` above is what
     * the filters left. The pair is the point: "4 of 22" is only meaningful
     * because the 22 did not move when the filter was applied. */
    const allClientsCount = clientPage?.facets?.counts?.total ?? totalUsers
    const totalPages = clientPage?.totalPages ?? 1

    // ── Cross-filtered facet options ──
    // Every dropdown shows the options that OTHER filters' current
    // selections leave available. Picking Business Model = B2B narrows
    // the Year and Client dropdowns to B2B-only years and clients;
    // picking Year = 2026 narrows Business Model and Client to those
    // that appear in 2026; and so on. This uses the full client list
    // (fetched once, cached by React Query) rather than the paginated
    // facet — the paginated facet is over the whole institution and
    // cannot answer "years for B2B clients only".
    const { data: allClientsList = [] } = useClients()
    const yearOf = (c: Client) => (c.createdAt ? String(new Date(c.createdAt).getFullYear()) : '')
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
            // Model options ignore the model filter, respect year+client.
            if (yearMatch && clientMatch && c.businessModel) modelSet.add(c.businessModel)
            // Year options ignore the year filter, respect model+client.
            if (modelMatch && clientMatch && y) yearSet.add(y)
            // Client options ignore the client filter, respect model+year.
            if (modelMatch && yearMatch) {
                clientList.push({ value: c._id, label: c.clientCompany || 'Unnamed client' })
            }
        }
        return {
            models: [...modelSet].sort(),
            // Newest year first, matching what the reader expects to reach for.
            years: [...yearSet].sort((a, b) => b.localeCompare(a)),
            clients: clientList.sort((a, b) => a.label.localeCompare(b.label)),
        }
    }, [allClientsList, businessModelFilter, yearsFilter, clientFilter])

    // The shapes the filter components expect. `availableModels` maps to
    // [value, display] pairs so the toolbar keeps the standardised
    // "Business to Business (B2B)" label.
    const availableModels = useMemo<[string, string][]>(
        () => filterFacets.models.map((m) => [m, businessModelDisplayName(m)] as [string, string]),
        [filterFacets.models],
    )
    const availableClients = useMemo(() => filterFacets.clients, [filterFacets.clients])
    const availableYears = filterFacets.years

    // Keep the current page valid as filters / page size change
    useEffect(() => {
        if (clientPage && !isPlaceholderData && !isFetching) {
            setCurrentPage((p) => Math.min(p, totalPages))
        }
    }, [clientPage, isPlaceholderData, isFetching, totalPages])

    // Auto-fit page size to the card's available height.
    //
    // The compute reads:
    //   - tableCardRef.clientHeight  → the flex-1 area that holds DataTable +
    //     TableFooter, so this already accounts for everything above it (app
    //     shell padding, page heading, toolbar, filter panel when open,
    //     filter-chip row when populated, and the parent's own pt/pb).
    //   - tableFooterRef.clientHeight → the pagination row's REAL height at
    //     the current viewport width. Reading it dynamically (instead of a
    //     hard-coded 44) makes wrapping-safe: on narrow viewports the
    //     buttons wrap onto a second line and the footer grows, and the
    //     compute follows without leaving a row hidden behind it.
    //   - HEADER_H = 40 (DataTable's <th> is `h-10`), fixed.
    //   - ROW_H = 40 (DataTable's <td> is `h-10`), fixed.
    // A quarter-row SAFETY buffer sits at the bottom so the last row can
    // never clip against the container edge — otherwise DataTable's own
    // `overflow-y-auto` would surface a scrollbar for that partial pixel.
    // A quarter (not half) row lets one extra row squeeze in when the
    // container is a hair over a full row's worth of extra space, which
    // is the common case on typical 900-1200px viewports.
    //
    // ResizeObserver watches BOTH refs, so a resize of either surface (page
    // width changes toolbar/footer wrapping; filter panel opens; sidebar
    // collapses; window resizes; data loads and momentarily changes footer
    // content) causes an immediate recompute. Recompute is also idempotent:
    // it only calls setPageSize when the fit value actually changes.
    //
    // Turns off as soon as the user picks a size manually from the footer.
    useEffect(() => {
        if (!autoFitPageSize) return
        if (layout !== 'table') return
        const cardEl = tableCardRef.current
        if (!cardEl) return
        const HEADER_H = 40
        const ROW_H = 40
        // Small fixed buffer instead of a fractional row — enough to
        // guarantee the last row can't clip against the container edge,
        // but small enough that it never costs a whole visible row.
        const SAFETY = 4
        const compute = () => {
            // clientHeight is 0 before the first paint — bail out so the
            // effect doesn't lock pageSize at the clamp floor (3) until the
            // observer fires with a real measurement one frame later.
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
        // Observing the footer separately catches the case where the card's
        // total height stays the same but the footer's height changes (e.g.
        // pager wraps because a new "…" gap or a two-digit page number
        // appears) — the card wouldn't fire a resize on its own then.
        if (tableFooterRef.current) ro.observe(tableFooterRef.current)
        return () => { ro.disconnect(); clearTimeout(resizeTimer) }
    }, [autoFitPageSize, layout])

    const clearFilters = () => {
        setSearch('')
        setYearsFilter([])
        setClientFilter([])
        setBusinessModelFilter([])
        setCurrentPage(1)
    }

    const [exportRequest, setExportRequest] = useState<{ filters: typeof clientFilters; initialFormat: ExportFormat } | null>(null)

    // ── Form handlers ──
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleDescriptionChange = (html: string) => {
        setFormData((prev) => ({ ...prev, description: html }))
    }

    const handleContactChange = (index: number, field: string, value: string | boolean) => {
        // The updater reads `prev.contactPersons` from the functional
        // setState callback rather than the closure's `formData`, so two
        // rapid calls in the same tick (e.g. "Same as primary" copying
        // email AND phone in one click) don't overwrite each other by
        // reading a stale snapshot.
        setFormData((prev) => {
            const updated = [...prev.contactPersons]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, contactPersons: updated }
        })
    }

    const handleAddContact = () => {
        setFormData((prev) => {
            // The new slot's suggested role reflects its position in the
            // list: slot 1 (index 1) is the Secondary contact, slot 3+
            // are Additional. Empty string is a safe default when the
            // template's own suggestion doesn't fit.
            const next = prev.contactPersons.length
            const suggestedRole = next === 1 ? 'Secondary' : ''
            return {
                ...prev,
                contactPersons: [
                    ...prev.contactPersons,
                    { name: '', email: '', phoneNumber: '', isPrimary: false, contactType: suggestedRole },
                ],
            }
        })
    }

    const handleRemoveContact = (index: number) => {
        if (formData.contactPersons.length <= 1) return
        // Primary contact is required, so removing the currently-primary
        // slot must promote another contact rather than leave the client
        // with none. Slot 0 stays primary by convention.
        setFormData((prev) => {
            const removedWasPrimary = Boolean(prev.contactPersons[index]?.isPrimary)
            const next = prev.contactPersons.filter((_, i) => i !== index)
            if (removedWasPrimary && next.length && !next.some((c) => c.isPrimary)) {
                next[0] = { ...next[0], isPrimary: true }
            }
            return { ...prev, contactPersons: next }
        })
    }

    // Promote a contact to Primary. Reorders the array so the newly-primary
    // contact becomes contactPersons[0] — the section split in the form is
    // "index 0 is primary, index 1 is secondary, 2+ are additional", so
    // without the reorder a promoted additional contact would stay under
    // "Additional" while wearing the Primary badge.
    const handlePrimaryChange = (index: number, checked: boolean) => {
        setFormData((prev) => {
            const contacts = prev.contactPersons
            if (!checked || index === 0) {
                // Unticking primary is not offered — a client always has one.
                // Ticking the already-primary slot is a no-op.
                return prev
            }
            if (index < 0 || index >= contacts.length) return prev
            const promoted = { ...contacts[index], isPrimary: true }
            const rest = contacts
                .filter((_, i) => i !== index)
                .map((c) => ({ ...c, isPrimary: false }))
            return { ...prev, contactPersons: [promoted, ...rest] }
        })
    }

    // ── CRUD ──
    const resetFormData = (): FormData => ({
        contactPersons: [{ name: '', email: '', phoneNumber: '', isPrimary: true, contactType: 'Primary' }],
        clientCompany: '',
        clientPhone: '',
        createdYear: String(new Date().getFullYear()),
        description: '',
        clientAddress: '',
        clientLogo: '',
        clientLogoPosition: '',
        type: [],
        businessModel: '',
        status: 'active',
    })

    // Wired straight into the LogoPicker in the form modal. Purely a setter —
    // the picker handles the file upload itself and only reports the final
    // (or cleared) URL up here.
    const handleLogoChange = (url: string) => {
        setFormData((prev) => ({ ...prev, clientLogo: url }))
    }

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
            // orderedContacts guarantees the primary is at index 0 — the form
            // relies on that split (index 0 = Primary, index 1 = Secondary,
            // 2+ = Additional). Legacy records with no explicit primary get
            // the first contact promoted so the form always opens on a
            // valid primary.
            contactPersons: client.contactPersons?.length
                ? orderedContacts(client.contactPersons).map((c, i) => ({ ...c, isPrimary: i === 0 }))
                : [{ name: '', email: '', phoneNumber: '', isPrimary: true, contactType: 'Primary' }],
            clientCompany: client.clientCompany || '',
            clientPhone: client.clientPhone || '',
            // Prefer the record's own year of creation for the picker;
            // fall back to the current year when the record predates the
            // column.
            createdYear: (() => {
                const iso = client.createdAt
                if (!iso) return String(new Date().getFullYear())
                const y = new Date(iso).getFullYear()
                return Number.isFinite(y) ? String(y) : String(new Date().getFullYear())
            })(),
            description: client.description || '',
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

    // "View details" now navigates to the dedicated client-details PAGE
    // (/lms/pages/clientmanagement/<id>) added 2026-08-30 — was previously
    // a right-side drawer opened via setDetailsClientId. The drawer state
    // is kept so any deep code path that toggles it directly still works,
    // but the row kebab and quick-actions link out to the page instead.
    const handleView = (id: string) => {
        router.push(`/lms/pages/clientmanagement/${encodeURIComponent(id)}`)
    }
    const detailsClient = detailsClientId
        ? currentUsers.find((c) => c._id === detailsClientId) ?? null
        : null

    // Hand off to Service Mapping: `newMapping=1` tells that page to open its
    // New Mapping wizard on mount, and `clientId` pre-selects this row's client
    // inside it. The params are stripped there once consumed.
    const handleNewMapping = (id: string) => {
        router.push(`/lms/pages/servicemapping?newMapping=1&clientId=${encodeURIComponent(id)}`)
    }

    const handleDelete = (id: string) => {
        const client = currentUsers.find((c) => c._id === id)
        setDeleteModal({ open: true, clientId: id, clientName: client?.clientCompany || 'this client' })
    }

    const handleToggleStatus = (client: Client) => {
        if (togglingClientId) return
        const next = client.status === 'active' ? 'deactivated' : 'activated'
        setTogglingClientId(client._id)
        toggleStatusMut.mutate(client._id, {
            onSuccess: () => notify.success(`Client ${next}`),
            onError: (e: any) => notify.error(e?.message || 'Failed to update status'),
            onSettled: () => setTogglingClientId(null),
        })
    }

    const confirmDelete = () => {
        if (!deleteModal.clientId) return
        deleteClientMut.mutate(deleteModal.clientId, {
            onSuccess: () => {
                notify.success('Client deleted successfully')
                setDeleteModal({ open: false, clientId: null, clientName: '' })
            },
            onError: (e: any) => notify.error(e?.message || 'Failed to delete client'),
        })
    }

    // Build a field-keyed error map + a top-level summary message.
    // Returns { errors, message } — message is null when the form is valid.
    const validate = (): { errors: FormErrors; message: string | null } => {
        const errors: FormErrors = {}
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

        // Client name — required + unique across other clients
        const name = formData.clientCompany.trim()
        if (!name) {
            errors.clientCompany = 'Client name is required'
        } else {
            const dup = clientNames.some(
                (c) => c._id !== currentClientId && c.clientCompany.trim().toLowerCase() === name.toLowerCase()
            )
            if (dup) errors.clientCompany = 'A client with this name already exists'
        }

        // Business model — required
        if (!formData.businessModel) errors.businessModel = 'Business model is required'

        // Created Year — required, must be a 4-digit year within a
        // sensible range (2000 → current year).
        const yr = parseInt(String(formData.createdYear || ''), 10)
        const nowYear = new Date().getFullYear()
        if (!Number.isFinite(yr) || yr < 2000 || yr > nowYear) {
            errors.createdYear = 'Select a valid year'
        }

        // Address — required. TipTap stores HTML, so we strip tags and
        // trim to see if there is any actual text; a bare "<p></p>" is
        // treated as empty.
        if (!stripHtml(formData.clientAddress).trim()) {
            errors.clientAddress = 'Address is required'
        }

        // Contacts. Each has a required primary email + phone and an
        // optional secondary email + phone on the SAME contact record.
        // "Optional" here means empty is fine; anything present still has
        // to be well-formed.
        const contactErrors: ContactErrors[] = formData.contactPersons.map((cp) => {
            const e: ContactErrors = {}
            if (!cp.name.trim()) e.name = 'Required'
            if (!cp.email.trim()) e.email = 'Required'
            else if (!emailRegex.test(cp.email.trim())) e.email = 'Invalid email'
            // The field stores "+code local" from the split control. India's
            // mobile numbers are exactly 10 digits; other codes get the E.164
            // envelope since their national lengths vary.
            const { code: ccode, local } = splitPhone(cp.phoneNumber)
            if (!cp.phoneNumber.trim()) e.phoneNumber = 'Required'
            else if (ccode === '+91' ? local.length !== 10 : local.length < 6 || local.length > 14) {
                e.phoneNumber = ccode === '+91' ? 'Enter the 10-digit mobile number' : 'Invalid mobile number'
            }
            const sec2 = (cp.secondaryEmail || '').trim()
            if (sec2) {
                if (!emailRegex.test(sec2)) e.secondaryEmail = 'Invalid email'
                else if (sec2.toLowerCase() === (cp.email || '').trim().toLowerCase()) {
                    e.secondaryEmail = 'Must differ from primary email'
                }
            }
            const secPhone = (cp.secondaryPhoneNumber || '').trim()
            if (secPhone) {
                const { code: sc, local: sl } = splitPhone(secPhone)
                if (sc === '+91' ? sl.length !== 10 : sl.length < 6 || sl.length > 14) {
                    e.secondaryPhoneNumber = sc === '+91' ? 'Enter the 10-digit mobile number' : 'Invalid mobile number'
                }
            }
            return e
        })

        // Duplicate email within contacts → flag the later occurrences
        const seen = new Map<string, number>()
        formData.contactPersons.forEach((cp, i) => {
            const key = cp.email.trim().toLowerCase()
            if (!key) return
            if (seen.has(key)) contactErrors[i].email = 'Duplicate email'
            else seen.set(key, i)
        })

        if (contactErrors.some((e) => Object.keys(e).length)) errors.contacts = contactErrors

        // Exactly one primary contact
        const primaryCount = formData.contactPersons.filter((c) => c.isPrimary).length

        let message: string | null = null
        if (errors.clientCompany || errors.businessModel || errors.createdYear || errors.clientAddress || errors.contacts) {
            message = 'Please fix the highlighted fields'
        } else if (primaryCount !== 1) {
            message = 'Please mark exactly one contact as primary'
        }
        return { errors, message }
    }

    // (The wizard's per-step validator used to live here — a step-0 check on
    //  client name + business model. The form is single-page now, so the full
    //  `validate()` runs on submit and there is no interstitial gate to
    //  guard.)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (isSaving) return
        const { errors, message } = validate()
        setFormErrors(errors)
        if (message) {
            notify.error(message)
            return
        }

        // Services are managed in the dedicated Service Mapping module, so the
        // form intentionally does not send `services` (leaving them untouched).
        // clientLogo is always sent (as "" when cleared) so an edit that
        // removes the logo actually clears it on the record — a `?? ''`
        // guard here keeps create working when the picker was never touched.
        // clientId is intentionally omitted: it is server-allocated on create
        // and read-only on update.
        const payload: Omit<ClientInput, 'services'> = {
            clientCompany: formData.clientCompany.trim(),
            clientPhone: (formData.clientPhone || '').trim(),
            // 4-digit year; server may use it to override the auto
            // `createdAt` (Jan 1 of that year) so the "Created Year"
            // column matches the user's pick.
            createdYear: formData.createdYear,
            description: formData.description,
            clientAddress: formData.clientAddress,
            clientLogo: formData.clientLogo ?? '',
            // Empty when the user hasn't dragged the logo — the model
            // defaults to "" and every render site falls back to center.
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
                    // Response is either `{ _id, clientCompany, … }` or wrapped
                    // as `{ data: { _id, … } }` depending on the server envelope.
                    // Strip both shapes and fall back to the form payload's own
                    // name if the response omits it, so the success dialog
                    // ALWAYS has something to display.
                    const doc = data?.data && typeof data.data === 'object' ? data.data : data
                    const newId: string | undefined = doc?._id || doc?.id
                    const newName: string = doc?.clientCompany || payload?.clientCompany || 'The client'
                    setShowForm(false)
                    clearFilters()
                    setSortKey(null)
                    setSortDir('asc')
                    if (newId) {
                        // Seed the shared useClients() cache with the new
                        // client immediately (2026-08-30). Without this
                        // the Service Mapping wizard's client selector
                        // opens with a clientId that isn't in the still-
                        // stale list, so no client label shows until the
                        // invalidation-triggered refetch lands ~200-500ms
                        // later — the user sees "no client selected" for
                        // that window. Prepending here means the wizard's
                        // `clients.find(c => c._id === value)` succeeds on
                        // the very first render.
                        queryClient.setQueryData<Client[] | undefined>(
                            clientManagementKeys.lists(),
                            (prev) => {
                                if (!Array.isArray(prev)) return prev
                                const list = prev
                                if (list.some(c => c._id === newId)) return list
                                return [doc as Client, ...list]
                            },
                        )
                        // Success dialog with "Create service" hand-off.
                        setCreatedClient({ id: newId, name: newName, createdAt: doc.createdAt })
                    } else {
                        // No id came back — fall back to the plain toast so
                        // the user still gets confirmation.
                        notify.success('Client added successfully')
                    }
                },
                onError: (er: any) => notify.error(er?.message || 'Failed to add client'),
            })
        }
    }

    // ── Table columns ──
    // fixedLayout mode: percentage widths add up to 100% and each cell
    // truncates its own text. No horizontal scroll — every column fits the
    // container width; long values ellipsize with the full value in a title
    // tooltip on hover.
    const primaryOf = (client: Client) => orderedContacts(client.contactPersons)[0]
    // Just the year portion of the stored `createdAt` timestamp — the
    // column shows nothing more granular than that, and the year filter
    // above the table matches the same value.
    const createdYear = (client: Client): string => {
        if (!client.createdAt) return '—'
        const d = new Date(client.createdAt)
        return Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear())
    }
    const columns: Column<Client>[] = [
        {
            // Row number, matching the Service Mapping listing: continuous
            // across pages, so page 2 starts where page 1 left off.
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
            // Human-readable Client ID (e.g. "CLT-000023"). Rendered in a
            // monospaced style so digits align across rows — the same
            // treatment invoice numbers and order codes get elsewhere in
            // B2B SaaS. Legacy rows without an id fall back to "—" until
            // the read-side backfill fills them in.
            key: 'clientId',
            label: 'Client ID',
            sortKey: 'clientId',
            className: 'w-[10%] px-3 text-left align-middle whitespace-nowrap',
            skeletonWidth: '70%',
            render: (client) => client.clientId ? (
                <span
                    className="inline-flex items-center rounded-chip bg-ink-50 px-2 py-0.5 font-mono text-[11px] font-medium text-heading tabular-nums"
                    title={client.clientId}
                >
                    {client.clientId}
                </span>
            ) : (
                <span className="text-faint" title="A Client ID will be assigned automatically">—</span>
            ),
        },
        {
            // Just the year portion of `createdAt`. Sorts on the full
            // timestamp so records inside the same year still order by
            // real creation time, but the cell shows only the year to
            // match the year-only filter above the table.
            key: 'createdYear',
            label: 'Year',
            sortKey: 'createdAt',
            className: 'w-[8%] px-3 text-left align-middle tabular-nums whitespace-nowrap',
            skeletonWidth: '50%',
            render: (client) => {
                const y = createdYear(client)
                return (
                    <span className="text-subtle" title={fmtCreatedDate(client.createdAt)}>
                        {y}
                    </span>
                )
            },
        },
        {
            key: 'clientCompany',
            label: 'Client Name',
            sortKey: 'company',
            className: 'w-[16%] px-3 text-left align-middle',
            skeletonWidth: '80%',
            // Small circular avatar in front of the name. Uses the uploaded
            // client logo when the record has one, and falls back to a
            // deterministic first-letter circle (same primitive Service
            // Mapping uses) when the URL is missing or the image fails to
            // load. Keeps the two listings visually aligned.
            render: (client) => {
                const name = client.clientCompany || 'N/A'
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <ClientAvatar
                            name={name}
                            size="sm"
                            logoUrl={client.clientLogo || undefined}
                            logoPosition={client.clientLogoPosition || undefined}
                        />
                        {/* `min-w-0 flex-1` is what makes `truncate`
                              actually clip inside a flex row — without it
                              the span's implicit `min-width: auto` lets
                              the text push the cell wider than the column
                              and the ellipsis never appears. */}
                        <span className="block truncate min-w-0 flex-1" title={name}>
                            {name}
                        </span>
                        {client.status === 'inactive' && <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-slate-600">Inactive</span>}
                    </div>
                )
            },
        },
        {
            // Business model rendered in the standardised
            // "Business to Business (B2B)" format. Cell allows truncation
            // — the full string is available on hover through the same
            // `title=` attribute.
            key: 'businessModel',
            label: 'Business Model',
            sortKey: 'model',
            className: 'w-[17%] px-3 text-left align-middle',
            render: (client) =>
                client.businessModel ? (
                    <span
                        className="block truncate text-body"
                        title={businessModelDisplayName(client.businessModel)}
                    >
                        {businessModelDisplayName(client.businessModel)}
                    </span>
                ) : (
                    <span
                        className="text-faint italic"
                        title="Edit this client to set its business model"
                    >
                        Not set
                    </span>
                ),
        },
        {
            key: 'contactName',
            label: 'Contact Name',
            sortKey: 'contactName',
            className: 'w-[12%] px-3 text-left align-middle',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                const total = client.contactPersons?.length ?? 0
                const extra = Math.max(0, total - 1)
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span
                            className="text-body truncate min-w-0 flex-1"
                            title={primary.name || 'N/A'}
                        >
                            {primary.name || 'N/A'}
                        </span>
                        {extra > 0 && (
                            <span
                                className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-brand-wash text-brand-strong text-[10px] font-semibold tabular-nums flex-shrink-0"
                                title={`${extra} more contact${extra === 1 ? '' : 's'} — open View all contacts to see them`}
                            >
                                +{extra}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            key: 'email',
            // "Primary Email" spells out that the value is the primary
            // contact's PRIMARY email (contacts also carry an optional
            // secondary email now — see ContactPerson.secondaryEmail).
            label: 'Primary Email',
            sortKey: 'email',
            className: 'w-[15%] px-3 text-left align-middle',
            skeletonWidth: '85%',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                return (
                    <span
                        className="text-subtle truncate block"
                        title={primary.email || 'N/A'}
                    >
                        {primary.email || '—'}
                    </span>
                )
            },
        },
        {
            key: 'contactNumber',
            label: 'Phone Number',
            sortKey: 'contactNumber',
            className: 'w-[11%] px-3 text-left align-middle',
            skeletonWidth: '75%',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                return (
                    <span
                        className="text-subtle tabular-nums truncate block"
                        title={primary.phoneNumber || 'N/A'}
                    >
                        {primary.phoneNumber || '—'}
                    </span>
                )
            },
        },
        {
            key: 'actions',
            label: 'Actions',
            // Every row-level action lives in the kebab now, including the
            // status toggle — the column only needs room for a 28-px trigger
            // plus the right gutter. no-print — the kebab is chrome, not data.
            className: 'no-print w-[7%] pl-2 pr-4 sm:pr-5 text-right whitespace-nowrap align-middle',
            skeletonWidth: '20px',
            render: (client) => {
                // Kebab always renders now — "View details" is unconditional so
                // there is always at least one item to show (2026-08-30).
                const anyKebab = true
                const isActive = client.status === 'active'
                const isToggling = togglingClientId === client._id
                // Only surface the "view all contacts" affordance when there
                // actually IS more than the primary — otherwise it points to
                // nothing new for the reader.
                const hasSecondary = (client.contactPersons?.length ?? 0) > 1
                return (
                    <div className="flex items-center justify-end">
                        {anyKebab && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" title="More actions" aria-label={`More actions for ${client.clientCompany}`} className={ICON_BUTTON_CLASS}>
                                        <MoreVertical size={14} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="left" align="start" sideOffset={-43} collisionPadding={8} sticky="always" className="w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.06)]">
                                    <DropdownMenuLabel className="px-3 pb-3 pt-2">
                                        <span className="block truncate text-xs font-semibold text-heading" title={client.clientCompany}>{client.clientCompany}</span>
                                        <span className="mt-1 flex items-center gap-1.5 text-[10px] font-normal text-subtle"><span className={`size-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{isActive ? 'Active client' : 'Inactive client'}</span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="mx-1 my-1" />
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
                                                <span className={isToggling ? 'animate-pulse' : ''}>{isToggling ? 'Updating status...' : isActive ? 'Deactivate client' : 'Activate client'}</span>
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
                        )}
                    </div>
                )
            },
        },
    ]

    // ── Render ──
    // Primary CTA lives at the top-right of the workspace tab strip. The strip
    // is mounted above this route, so the button is portalled up into it via
    // WorkspaceActionSlot below — permission-gated so it only appears when the
    // signed-in user actually holds the Add Client grant.
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

    return (
        <>
            {!embedded && <WorkspaceActionSlot>{addClientButton}</WorkspaceActionSlot>}
            {exportRequest && <ClientExportDialog filters={exportRequest.filters} initialFormat={exportRequest.initialFormat} onClose={() => setExportRequest(null)} />}
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                // flex-col + h-full + min-h-0 = the chain the parent shell needs
                // so the table card below can `flex-1 min-h-0` and fill the
                // remaining viewport height instead of capping at a hardcoded
                // maxHeight. min-w-0 stops flex children from pushing width
                // beyond the workspace and triggering horizontal overflow.
                // Symmetric padding — the notification bell now sits in
                // the panel's very corner (top-1.5 right-1.5 in the shell)
                // so no extra clearance is needed on the right.
                // Mobile hamburger clearance lives on the workspace tab
                // strip above (BusinessWorkspaceChrome), so this content
                // wrapper only needs its own natural top padding.
                className="flex flex-col h-full min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-3 pb-3"
            >
                <ClientOverview counts={clientPage?.facets?.counts} isError={isListError} />

                {/* ── One toolbar: search · Business Model · Created Year · Export · Print · Add Client ── */}
                {/* Wider search (flex-1 up to max-w-lg) so a full company name
                    fits without truncation. Add Client is pushed to the far
                    right corner via ml-auto so it reads as the page's primary
                    call-to-action, separated from the row of secondary
                    actions. flex-wrap kicks in only on very narrow viewports.
                    no-print — toolbar shouldn't reach paper. */}
                <div className="no-print mt-3 flex shrink-0 items-center gap-2 flex-wrap min-w-0">
                    <div className="relative min-w-0 basis-full sm:basis-[180px] sm:flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search client, contact, email…"
                            className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                        />
                        {search && (
                            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"><X size={12} /></button>
                        )}
                    </div>

                    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
                        <div className="w-full min-w-0 sm:w-[195px]">
                            <MappingMultiFilter
                                label="Business models"
                                options={availableModels.map(([value, label]) => ({ value, label }))}
                                value={businessModelFilter}
                                onChange={setBusinessModelFilter}
                                placeholder="All business models"
                            />
                        </div>
                        <div className="w-full min-w-0 sm:w-[140px]">
                            <MappingMultiFilter
                                label="Years"
                                options={availableYears.map((year) => ({ value: year, label: year }))}
                                value={yearsFilter}
                                onChange={setYearsFilter}
                                placeholder="All years"
                            />
                        </div>
                        <div className="w-full min-w-0 sm:w-[190px]">
                            <MappingMultiFilter
                                label="Clients"
                                options={availableClients}
                                value={clientFilter}
                                onChange={setClientFilter}
                                placeholder="All clients"
                            />
                        </div>
                    </div>

                    {/* What the filters left, beside the filters that left it.
                        Deliberately NOT in the overview cards above: those are
                        the standing picture of the whole book of clients, and
                        tiles that moved with every filter would stop being a
                        reference point to compare against. Shown only while a
                        filter is on — unfiltered, "22 of 22" says nothing. */}
                    {hasActiveFilters && (
                        <span
                            role="status"
                            title={`${totalUsers} of ${allClientsCount} clients match the current filters`}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-brand-500/30 bg-brand-wash px-2.5 text-xs font-semibold text-brand-strong"
                        >
                            <Filter className="size-3.5 shrink-0" />
                            <span className="tabular-nums">{totalUsers.toLocaleString()}</span>
                            <span className="font-medium opacity-80">of {allClientsCount.toLocaleString()}</span>
                        </span>
                    )}

                    {hasActiveFilters && <button type="button" onClick={clearFilters} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control px-2 text-xs font-medium text-subtle hover:bg-row-hover hover:text-heading"><X className="size-3.5" />Clear all</button>}

                    {/* Add Client no longer lives in this filter row — it
                        was moved to the tab strip's top-right slot (see
                        WorkspaceActionSlot above). This keeps the filter
                        row purely about narrowing the list. */}
                </div>

                {/* ── Content: cards or list (list is the default) ── */}
                {/* flex-1 min-h-0 = fill remaining viewport height. flex-col so
                    the scroll region can flex-1 while the pagination footer
                    keeps its natural height at the bottom. The ref feeds the
                    auto-fit page-size effect above — measuring THIS box tells
                    the effect how many rows fit without vertical scroll. */}
                {/* No card chrome around the list — the reference reads as a
                    flat list on the panel, not a bordered table card. Rows
                    stay separated by their own hairline. */}
                <div ref={tableCardRef} aria-busy={isListBusy} className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden">

                    {isListError ? (
                        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-sm text-subtle">
                            <p>Couldn’t load clients. Please try again.</p>
                            <Button variant="outline" size="sm" onClick={() => void refetchClients()} disabled={isFetching}>Retry</Button>
                        </div>
                    ) : layout === 'table' ? (
                        <DataTable
                            rows={currentUsers}
                            columns={columns}
                            rowKey={(client) => client._id}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            isLoading={isListLoading}
                            isFiltered={hasActiveFilters}
                            // `fixedLayout` with percentage widths on each
                            // column classname — the table stretches to fill
                            // the container width, columns take their share,
                            // and no horizontal scrollbar appears. Long
                            // values inside Client Name / Contact Name /
                            // Primary Email / Phone Number ellipsize (`…`)
                            // and hover reveals the full string via the
                            // `title=` tooltip on each cell.
                            fixedLayout
                            fillHeight
                            emptyTitle={hasActiveFilters ? 'No clients match these filters' : 'No clients yet'}
                            emptyHint={
                                hasActiveFilters
                                    ? 'Try widening or clearing them to see more.'
                                    : 'Add a client organization to see it listed here.'
                            }
                            // The empty state's button does whichever is useful:
                            // escape the filters, or create the first client
                            // (only when the user is allowed to add clients).
                            emptyAction={hasActiveFilters ? 'Clear filters' : (canAdd ? 'Add Client' : undefined)}
                            onEmptyAction={hasActiveFilters ? clearFilters : (canAdd ? handleAddNew : undefined)}
                        />
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
                                            <Button variant="outline" size="sm" onClick={clearFilters}>
                                                Clear filters
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        icon={Building2}
                                        title="No clients yet"
                                        message="Add a client organization to see it listed here."
                                        primaryAction={canAdd ? (
                                            <Button size="sm" onClick={handleAddNew}>
                                                <Plus className="size-4" /> Add Client
                                            </Button>
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
                        // A manual pick pins the size and stops the auto-fit
                        // observer from overriding on the next resize.
                        onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1) }}
                        currentPage={displayPage}
                        totalPages={totalPages}
                        onPage={setCurrentPage}
                        isLoading={isListBusy}
                    />
                    </div>
                </div>
            </motion.div>

            {/* Client form modal — single form, no wizard. */}
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
                // The server-allocated Client ID for edit mode. In create
                // mode we pass "" and the modal shows the placeholder.
                clientCode={isEditing && currentClientId
                    ? currentUsers.find((c) => c._id === currentClientId)?.clientId
                    : undefined}
                // Full-book count for the header's "Client #N" chip —
                // the reader sees which ordinal position the record is
                // taking. `allClientsCount` is derived from the facets
                // summary above and does not move with the current
                // filters, so the number stays stable while the user is
                // filling in the form.
                clientCount={allClientsCount}
            />

            {/* Delete confirmation modal */}
            <DeleteConfirmModal
                open={deleteModal.open}
                clientName={deleteModal.clientName}
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, clientId: null, clientName: '' })}
            />

            {/* Client-added success dialog.
                  "Done"           → the new full details PAGE (with
                                     ?created=1 so the toast fires there —
                                     matches the mockup where the toast
                                     lives on the details view, not on the
                                     list)
                  "Create service" → Service Mapping page with the new
                                     client already selected in the New
                                     Mapping wizard (unchanged)
                Only shown for CREATE, never for UPDATE. */}
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

            {/* Client details drawer (with quick actions) */}
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
