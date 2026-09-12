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
import ClientManagementWorkspace from '@/features/businessmanagement/ClientManagementWorkspace'
import DataTable, { type Column, type SortDir } from '@/app/lms/shared/listing/DataTable'
import TableFooter from '@/app/lms/shared/listing/TableFooter'
import { ClientAvatar } from '@/app/lms/pages/servicemapping/components/workspaceShared'
import { EmptyState, SkeletonCards, pageEnter } from '@/app/lms/shared/ui'
import { useQueryClient } from '@tanstack/react-query'
import {
    useClientsPage, useClientNames, useCreateClient, useUpdateClient,
    useDeleteClient, useToggleClientStatus,
    clientManagementKeys,
    type Client, type ClientInput,
} from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import {
    businessModelFullName, businessModelLabel,
    fmtCreatedDate, notify, orderedContacts, splitPhone,
    type ClientSortKey, type ContactErrors, type FormData, type FormErrors,
} from './lib'
import ClientFormModal from './ClientFormModal'
import ClientDetailsDrawer from './ClientDetailsDrawer'
import { ClientCreatedSuccessModal, DeleteConfirmModal } from './ConfirmDialogs'
import ClientCards from './ClientCards'
import ClientToolbarFilter from './ClientToolbarFilter'
import ClientDateRangeFilter, { clientDateBounds, type ClientDateRange } from './ClientDateRangeFilter'
import ClientPickerFilter from './ClientPickerFilter'
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

// Embedded consumers supply their own shell; the route uses the shared tabs.
export function ClientManagementView({ embedded = false }: { embedded?: boolean }) {
    const Shell = embedded ? React.Fragment : ClientManagementWorkspace
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
    const [pageSize, setPageSize] = useState<number>(5)
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
    const [businessModelFilter, setBusinessModelFilter] = useState('')
    const [createdDateRange, setCreatedDateRange] = useState<ClientDateRange>({ from: '', to: '' })
    /* Which client to show, rather than which STATUS to show. The list is
     * already a list of clients, so a picker over it is the filter people
     * actually reach for; status lives on each row's own toggle. Empty is
     * "every client" — the dropdown's own first item says so. */
    const [clientFilter, setClientFilter] = useState('')
    const [sortKey, setSortKey] = useState<ClientSortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    // ── The client list ────────────────────────────────────────────────
    // The page used to download every client and filter, sort and slice the
    // array here. The search, the four filters and the sort now run in Mongo
    // and one page crosses the wire; the predicate below was deleted rather
    // than reimplemented, because the server port (getClientsPaginated) is a
    // field-for-field copy of it, checked against this page's own predicate
    // over live data.
    const clientFilters = useMemo(() => ({
        search: debouncedSearch,
        businessModel: businessModelFilter,
        ...clientDateBounds(createdDateRange),
        // The service takes a list; the toolbar offers one at a time.
        clients: clientFilter ? [clientFilter] : undefined,
        sortKey: sortKey || undefined,
        sortDir,
    }), [debouncedSearch, businessModelFilter, createdDateRange, clientFilter, sortKey, sortDir])

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
        contactPersons: [{ name: '', email: '', phoneNumber: '', isPrimary: true }],
        clientCompany: '',
        description: '',
        clientAddress: '',
        clientLogo: '',
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

    const hasActiveFilters = Boolean(search.trim() || businessModelFilter || createdDateRange.from || createdDateRange.to || clientFilter)
    const totalUsers = clientPage?.total ?? 0
    /* The whole book, which the overview cards also show — `total` above is what
     * the filters left. The pair is the point: "4 of 22" is only meaningful
     * because the 22 did not move when the filter was applied. */
    const allClientsCount = clientPage?.facets?.counts?.total ?? totalUsers
    const totalPages = clientPage?.totalPages ?? 1

    // Business models present in the data rather than the full BUSINESS_MODELS
    // constant: a filter offering a value no client has is a dead end.
    const availableModels = useMemo<[string, string][]>(() => {
        const seen = clientPage?.facets?.businessModels ?? []
        return seen.map((m) => [m, businessModelFullName(m)] as [string, string])
    }, [clientPage])

    /* Every client the reader may see, NOT just the ones the current filters
     * left — a picker narrowed by its own selection is a one-way door. The
     * server sends them as [id, name] pairs, already sorted by name. */
    const availableClients = useMemo(
        () => (clientPage?.facets?.clients ?? []).map(([value, label]) => ({ value, label })),
        [clientPage],
    )

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
    //   - ROW_H = 48 (DataTable's <td> is `h-12`), fixed.
    // A half-row SAFETY buffer sits at the bottom so the last row can never
    // clip against the container edge — otherwise DataTable's own
    // `overflow-y-auto` would surface a scrollbar for that partial pixel.
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
        const ROW_H = 48
        const SAFETY = Math.round(ROW_H / 2)
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
        setCreatedDateRange({ from: '', to: '' })
        setClientFilter('')
        setBusinessModelFilter('')
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

    const handleContactChange = (index: number, field: string, value: string) => {
        const updated = [...formData.contactPersons]
        updated[index] = { ...updated[index], [field]: value }
        setFormData((prev) => ({ ...prev, contactPersons: updated }))
    }

    const handleAddContact = () => {
        setFormData((prev) => ({
            ...prev,
            contactPersons: [...prev.contactPersons, { name: '', email: '', phoneNumber: '', isPrimary: false }],
        }))
    }

    const handleRemoveContact = (index: number) => {
        if (formData.contactPersons.length <= 1) return
        setFormData((prev) => ({
            ...prev,
            contactPersons: prev.contactPersons.filter((_, i) => i !== index),
        }))
    }

    const handlePrimaryChange = (index: number, checked: boolean) => {
        const updated = formData.contactPersons.map((c, i) => ({ ...c, isPrimary: i === index ? checked : false }))
        setFormData((prev) => ({ ...prev, contactPersons: updated }))
    }

    // ── CRUD ──
    const resetFormData = (): FormData => ({
        contactPersons: [{ name: '', email: '', phoneNumber: '', isPrimary: true }],
        clientCompany: '',
        description: '',
        clientAddress: '',
        clientLogo: '',
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
            contactPersons: client.contactPersons?.length
                ? client.contactPersons.map((c) => ({ ...c }))
                : [{ name: '', email: '', phoneNumber: '', isPrimary: true }],
            clientCompany: client.clientCompany || '',
            description: client.description || '',
            clientAddress: client.clientAddress || '',
            clientLogo: client.clientLogo || '',
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

        // Contacts
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
        if (errors.clientCompany || errors.businessModel || errors.contacts) {
            message = 'Please fix the highlighted fields'
        } else if (primaryCount !== 1) {
            message = 'Please mark exactly one contact as primary'
        }
        return { errors, message }
    }

    // Validate a single step before advancing. Sets the step's field errors,
    // toasts the first problem, and returns whether the step is valid.
    const validateStep = (step: number): boolean => {
        if (step === 0) {
            const name = formData.clientCompany.trim()
            let err: string | undefined
            if (!name) {
                err = 'Client name is required'
            } else if (
                clientNames.some(
                    (c) => c._id !== currentClientId && c.clientCompany.trim().toLowerCase() === name.toLowerCase()
                )
            ) {
                err = 'A client with this name already exists'
            }
            const bmErr = formData.businessModel ? undefined : 'Business model is required'
            setFormErrors((prev) => ({ ...prev, clientCompany: err, businessModel: bmErr }))
            if (err) { notify.error(err); return false }
            if (bmErr) { notify.error(bmErr); return false }
            return true
        }
        return true
    }

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
        const payload: Omit<ClientInput, 'services'> = {
            clientCompany: formData.clientCompany.trim(),
            description: formData.description,
            clientAddress: formData.clientAddress,
            clientLogo: formData.clientLogo ?? '',
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
    const columns: Column<Client>[] = [
        {
            // Row number, matching the Service Mapping listing: continuous
            // across pages, so page 2 starts where page 1 left off.
            // 7 data columns + 1 actions column: each 12.5% so the row
            // splits equally and the cells all get the same breathing room.
            key: 'num',
            label: '#',
            sortKey: 'serial',
            className: 'w-[5%] pl-4 sm:pl-5 text-left text-xs text-faint tabular-nums align-middle whitespace-nowrap',
            skeletonWidth: '20px',
            render: (_client, i) => sortKey === 'serial' && sortDir === 'desc'
                ? totalUsers - (displayPage - 1) * displayLimit - i
                : (displayPage - 1) * displayLimit + i + 1,
        },
        {
            key: 'clientCompany',
            label: 'Client Name',
            sortKey: 'company',
            className: 'w-[18%] px-3 text-left align-middle',
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
                        <ClientAvatar name={name} size="sm" logoUrl={client.clientLogo || undefined} />
                        <span className="block truncate" title={name}>
                            {name}
                        </span>
                        {client.status === 'inactive' && <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-slate-600">Inactive</span>}
                    </div>
                )
            },
        },
        {
            key: 'businessModel',
            label: 'Business Model',
            sortKey: 'model',
            className: 'w-[13%] px-3 text-left align-middle',
            render: (client) =>
                client.businessModel ? (
                    <span
                        className="text-body truncate block"
                        title={businessModelLabel(client.businessModel)}
                    >
                        {businessModelFullName(client.businessModel)}
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
            className: 'w-[13%] px-3 text-left align-middle',
            render: (client) => {
                const primary = primaryOf(client)
                if (!primary) return <span className="text-sm text-faint">—</span>
                const total = client.contactPersons?.length ?? 0
                const extra = Math.max(0, total - 1)
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span
                            className="text-body truncate"
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
            label: 'Email',
            sortKey: 'email',
            className: 'w-[17%] px-3 text-left align-middle',
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
            label: 'Contact Number',
            sortKey: 'contactNumber',
            className: 'w-[13%] px-3 text-left align-middle',
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
            key: 'createdAt',
            label: 'Created Date',
            sortKey: 'createdAt',
            className: 'w-[14%] px-3 text-left align-middle',
            render: (client) => <span className="block truncate text-subtle" title={fmtCreatedDate(client.createdAt)}>{fmtCreatedDate(client.createdAt)}</span>,
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
    return (
        <Shell>
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
                    <ClientToolbarFilter
                        label="Business Model"
                        allLabel="All Business Models"
                        value={businessModelFilter}
                        onChange={setBusinessModelFilter}
                        options={availableModels.map(([value, label]) => ({ value, label }))}
                        icon={Building2}
                        className="w-full sm:w-[195px]"
                    />
                    <ClientDateRangeFilter value={createdDateRange} onChange={setCreatedDateRange} earliestCreatedAt={clientPage?.facets?.earliestCreatedAt} />
                    <div className="w-full min-w-0 sm:w-[190px]">
                        <ClientPickerFilter options={availableClients} value={clientFilter} onChange={setClientFilter} />
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

                    {/* Print / Export used to sit here. Reporting is its own
                        task now and lives in the workspace's Reports tab, where
                        a scope is chosen deliberately instead of inheriting
                        whatever filters this list happened to have. The spacer
                        keeps Add Client pinned right. */}
                    <span className="ml-auto" aria-hidden />

                    {canAdd && (
                        <>
                            {/* Vertical divider separates secondary tools
                                from the primary Add action. hidden below sm
                                so on very narrow viewports the primary just
                                wraps to a new line rather than sitting next
                                to a stray divider. */}
                            <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />
                            <button
                                type="button"
                                onClick={handleAddNew}
                                // Filled primary in the app's brand accent —
                                // stands out as the ONE main action on the row.
                                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                            >
                                <Plus size={14} strokeWidth={2.4} />
                                <span className="text-xs font-semibold sr-only sm:not-sr-only">Add Client</span>
                            </button>
                        </>
                    )}
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
                            // fixedLayout: percentage widths sum to 100% so
                            // every column fits inside the container without
                            // a horizontal scrollbar. Cells with `truncate`
                            // shorten with "…" and hover shows the full
                            // value via title tooltip.
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
                onValidateStep={validateStep}
                onContactChange={handleContactChange}
                onAddContact={handleAddContact}
                onRemoveContact={handleRemoveContact}
                onPrimaryChange={handlePrimaryChange}
                onSubmit={handleSubmit}
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
        </Shell>
    )
}

export default function ClientManagementPage() {
    return <ClientManagementView />
}
