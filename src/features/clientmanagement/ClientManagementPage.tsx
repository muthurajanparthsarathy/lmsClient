"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Building2, ChevronDown, Eye, EyeOff, LayoutGrid,
    MoreVertical, Pencil, Plus, Printer, Rows3, SearchX, Trash2, X,
    Search, SlidersHorizontal, Download, FileSpreadsheet, FileText,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/app/lms/component/layout'
import DataTable, { type Column, type SortDir } from '@/app/lms/shared/listing/DataTable'
import TableFooter from '@/app/lms/shared/listing/TableFooter'
import { EmptyState, SkeletonCards, pageEnter } from '@/app/lms/shared/ui'
import { HeaderStats } from '@/app/lms/shared/ui/HeaderStats'
import ClientFilterPanel from './ClientFilterPanel'
import {
    useClientsPage, useClientNames, fetchClientsForExport, useCreateClient, useUpdateClient,
    useDeleteClient, useToggleClientStatus,
    type Client, type ClientInput,
} from '@/apiServices/clientManagementService'
import {
    MODEL_TONES, avatarTone, businessModelFullName, businessModelLabel,
    fmtDate, notify, orderedContacts, splitPhone,
    type ClientSortKey, type ContactErrors, type FormData, type FormErrors,
} from './lib'
import ClientFormModal from './ClientFormModal'
import ClientDetailsDrawer from './ClientDetailsDrawer'
import { DeleteConfirmModal } from './ConfirmDialogs'
import ClientCards from './ClientCards'
import { Can } from '@/components/permissions/Can'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// The row's icon buttons. Kept as a constant so the kebab trigger matches the
// eye and pencil exactly — a Radix trigger can't inherit a sibling's styling.
const ICON_BUTTON_CLASS =
    'w-7 h-7 rounded-chip border border-hairline-strong bg-surface text-subtle flex items-center ' +
    'justify-center hover:text-heading hover:border-line-hover hover:bg-row-hover ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'

// Created-Date filter presets → the earliest createdAt timestamp that still
// passes. 0 means "no date filter".
const dateCutoff = (d: string): number => {
    const day = 86400000
    if (d === '7') return Date.now() - 7 * day
    if (d === '30') return Date.now() - 30 * day
    if (d === '90') return Date.now() - 90 * day
    if (d === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime()
    return 0
}


// ─── Main page component ──────────────────────────────────────────────────────

// `embedded` — rendered inside another page (Business Management tabs) that
// already provides the DashboardLayout shell, so skip our own. This is a named
// export (not the page default) so Next's PageProps typing stays satisfied.
export function ClientManagementView({ embedded = false }: { embedded?: boolean }) {
    const Shell = embedded ? React.Fragment : DashboardLayout
    // Full-id permission checks — mirrors PermissionModal.PERMISSION_DATA
    // entries for admin-clientmanagement so a button appears only when the
    // signed-in user was actually granted that functionality.
    const { can } = usePermissions()
    const canAdd = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Add Client')
    const canView = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'View Full Details')
    const canEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit')
    const canDelete = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Delete')
    const canToggle = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Toggle Client Status')


    const createClient = useCreateClient()
    const updateClient = useUpdateClient()
    const deleteClientMut = useDeleteClient()
    const toggleStatusMut = useToggleClientStatus()
    // Client currently being toggled from the list (its switch shows a busy state).
    const [togglingClientId, setTogglingClientId] = useState<string | null>(null)

    const [currentPage, setCurrentPage] = useState<number>(1)
    const [pageSize, setPageSize] = useState<number>(10)
    // Auto-fit page size: measure the DataTable card's available height and
    // pick the row count that fills it without triggering internal vertical
    // scroll. Once the user picks a page size manually, autoFit turns off so
    // their choice sticks.
    const tableCardRef = useRef<HTMLDivElement | null>(null)
    const [autoFitPageSize, setAutoFitPageSize] = useState(true)
    const [showForm, setShowForm] = useState<boolean>(false)
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
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
    const [businessModelFilter, setBusinessModelFilter] = useState('')
    // type + date filters were dropped from the surface; retained in the
    // payload with fixed empty values so the server filter shape stays stable.
    const typeFilter = ''
    const dateFilter = ''
    const [showFilters, setShowFilters] = useState(false)
    const [sortKey, setSortKey] = useState<ClientSortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    // Rows currently showing every contact (not just the primary). Toggled by
    // the row-level "View all" action so a reader can spot-check secondary
    // contact details without leaving the list.
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set())
    const toggleRowExpanded = (id: string) => setExpandedRowIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })

    // ── The client list ────────────────────────────────────────────────
    // The page used to download every client and filter, sort and slice the
    // array here. The search, the four filters and the sort now run in Mongo
    // and one page crosses the wire; the predicate below was deleted rather
    // than reimplemented, because the server port (getClientsPaginated) is a
    // field-for-field copy of it, checked against this page's own predicate
    // over live data.
    const clientFilters = useMemo(() => ({
        search,
        status: statusFilter,
        businessModel: businessModelFilter,
        type: typeFilter,
        // Cutoff computed HERE, exactly as the old dateCutoff did — "this
        // year" is a local-calendar boundary — and sent as an absolute
        // instant so the server's timezone cannot shift it.
        since: dateCutoff(dateFilter) || undefined,
        sortKey: sortKey || undefined,
        sortDir,
    }), [search, statusFilter, businessModelFilter, typeFilter, dateFilter, sortKey, sortDir])

    const { data: clientPage, isLoading: isLoadingList } = useClientsPage(
        clientFilters, currentPage, pageSize
    )
    const currentUsers = clientPage?.data ?? []

    const [formData, setFormData] = useState<FormData>({
        contactPersons: [{ name: '', email: '', phoneNumber: '', isPrimary: true }],
        clientCompany: '',
        description: '',
        clientAddress: '',
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

    const hasActiveFilters = Boolean(search.trim() || statusFilter || businessModelFilter)
    // Drawer/panel filters only (search has its own box) — badges the Filter button.
    const activeFilterCount = (statusFilter ? 1 : 0) + (businessModelFilter ? 1 : 0)
    const totalUsers = clientPage?.total ?? 0
    const totalPages = clientPage?.totalPages ?? 1

    // Business models present in the data rather than the full BUSINESS_MODELS
    // constant: a filter offering a value no client has is a dead end.
    const availableModels = useMemo<[string, string][]>(() => {
        const seen = clientPage?.facets?.businessModels ?? []
        return seen.map((m) => [m, businessModelFullName(m)] as [string, string])
    }, [clientPage])

    // ── Summary counts (compact chips in the header) ──
    const counts = useMemo(() => {
        // Over EVERY client in the institution, as before — not the current
        // filter. Counted server-side now (facets) instead of from a list the
        // page no longer holds.
        const f = clientPage?.facets?.counts
        return f ?? { total: 0, active: 0, inactive: 0, models: 0 }
    }, [clientPage])

    // Keep the current page valid as filters / page size change
    useEffect(() => {
        setCurrentPage((p) => Math.min(p, totalPages))
    }, [totalPages, pageSize])

    // Auto-fit page size to the card's available height.
    // Constants below match DataTable row (h-12=48) and header (h-11=44) plus
    // the TableFooter footprint. Recomputes whenever the card resizes or the
    // layout mode toggles. Turns off as soon as the user picks a size manually.
    useEffect(() => {
        if (!autoFitPageSize) return
        if (layout !== 'table') return
        const el = tableCardRef.current
        if (!el) return
        const HEADER_H = 44
        const FOOTER_H = 56
        const ROW_H = 48
        const compute = () => {
            const budget = Math.max(0, el.clientHeight - HEADER_H - FOOTER_H)
            const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)))
            setPageSize((prev) => (prev === fits ? prev : fits))
        }
        compute()
        const ro = new ResizeObserver(compute)
        ro.observe(el)
        return () => ro.disconnect()
    }, [autoFitPageSize, layout])

    const clearFilters = () => {
        setSearch('')
        setStatusFilter('')
        setBusinessModelFilter('')
        setCurrentPage(1)
    }

    // Removable chips for the applied panel filters (search has its own box).
    const filterChips: { key: string; label: string; onRemove: () => void }[] = [
        ...(statusFilter ? [{ key: 'status', label: statusFilter === 'active' ? 'Active' : 'Inactive', onRemove: () => setStatusFilter('') }] : []),
        ...(businessModelFilter ? [{ key: 'model', label: businessModelFullName(businessModelFilter), onRemove: () => setBusinessModelFilter('') }] : []),
    ]

    // Export the filtered set — still EVERY row matching the current filters,
    // not just the visible page, so it asks the server for the whole selection
    // rather than reading what happens to be loaded.
    const [isExporting, setIsExporting] = useState(false)
    // Fetch once and hand the caller a snapshot for either format; toasts on
    // failure so both export paths keep the same error UX.
    const fetchExportRows = async (): Promise<Client[] | null> => {
        if (!totalUsers) { notify.error('Nothing to export'); return null }
        try {
            const rows = await fetchClientsForExport(clientFilters)
            if (!rows.length) { notify.error('Nothing to export'); return null }
            return rows
        } catch {
            notify.error('Export failed')
            return null
        }
    }
    const exportCsv = async () => {
        if (isExporting) return
        setIsExporting(true)
        const rows = await fetchExportRows()
        setIsExporting(false)
        if (!rows) return
        const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
        const header = ['Client', 'Business Model', 'Status', 'Primary Contact', 'Email', 'Phone', 'Created']
        const lines = [
            header.join(','),
            ...rows.map((c) => {
                const primary = orderedContacts(c.contactPersons)[0]
                return [
                    c.clientCompany, businessModelFullName(c.businessModel),
                    c.status,
                    primary?.name || '', primary?.email || '', primary?.phoneNumber || '', fmtDate(c.createdAt),
                ].map(esc).join(',')
            }),
        ]
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        notify.success(`Exported ${rows.length} client${rows.length > 1 ? 's' : ''}`)
    }
    // Same rows as CSV, laid out as a PDF table via jspdf-autotable. The
    // dynamic import keeps ~180KB of PDF machinery out of the initial bundle.
    const exportPdf = async () => {
        if (isExporting) return
        setIsExporting(true)
        const rows = await fetchExportRows()
        if (!rows) { setIsExporting(false); return }
        try {
            const [{ default: JsPDF }, autoTableMod] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ])
            const autoTable = (autoTableMod as any).default ?? autoTableMod
            const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
            doc.setFontSize(14)
            doc.text('Clients', 40, 40)
            doc.setFontSize(9)
            doc.setTextColor(90)
            doc.text(`Generated ${fmtDate(new Date().toISOString())} · ${rows.length} client${rows.length > 1 ? 's' : ''}`, 40, 58)
            autoTable(doc, {
                startY: 76,
                head: [['Client', 'Business Model', 'Status', 'Primary Contact', 'Email', 'Phone', 'Created']],
                body: rows.map((c) => {
                    const primary = orderedContacts(c.contactPersons)[0]
                    return [
                        c.clientCompany || '—',
                        businessModelFullName(c.businessModel),
                        c.status || '—',
                        primary?.name || '—',
                        primary?.email || '—',
                        primary?.phoneNumber || '—',
                        fmtDate(c.createdAt),
                    ]
                }),
                styles: { fontSize: 8, cellPadding: 6, overflow: 'linebreak' },
                headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [247, 249, 252] },
            })
            doc.save(`clients-${new Date().toISOString().slice(0, 10)}.pdf`)
            notify.success(`Exported ${rows.length} client${rows.length > 1 ? 's' : ''} as PDF`)
        } catch {
            notify.error('PDF export failed')
        } finally {
            setIsExporting(false)
        }
    }
    // Browser Print — the app's design tokens print acceptably; the toolbar
    // and modal controls fall out via the standard print-hidden classes.
    const printList = () => {
        if (typeof window !== 'undefined') window.print()
    }

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
        type: [],
        businessModel: '',
        status: 'active',
    })

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

    // The eye icon opens a dedicated read-only details view (not the edit wizard)
    const handleView = (id: string) => {
        setDetailsClientId(id)
    }
    const detailsClient = detailsClientId
        ? currentUsers.find((c) => c._id === detailsClientId) ?? null
        : null

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
        const { errors, message } = validate()
        setFormErrors(errors)
        if (message) {
            notify.error(message)
            return
        }

        // Services are managed in the dedicated Service Mapping module, so the
        // form intentionally does not send `services` (leaving them untouched).
        const payload: Omit<ClientInput, 'services'> = {
            clientCompany: formData.clientCompany.trim(),
            description: formData.description,
            clientAddress: formData.clientAddress,
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
                onSuccess: () => { notify.success('Client added successfully'); setShowForm(false) },
                onError: (er: any) => notify.error(er?.message || 'Failed to add client'),
            })
        }
    }

    // ── Table columns ──
    // DataTable renders in fixedLayout mode, so the percentage widths ARE the
    // layout: they must sum to exactly 100% (4+22+16+18+22+13+5) or
    // table-layout:fixed widens the table past its container. Long values
    // ellipsize with the full value in a title tooltip. When a row is
    // "expanded" (via the row-level "View all" action), the Contact
    // Name/Email/Contact Number cells stack all contacts vertically inside
    // the same row — the header rhythm still holds because every stacked
    // list stays inside its cell.
    const columns: Column<Client>[] = [
        {
            // Row number, matching the Service Mapping listing: continuous
            // across pages, so page 2 starts where page 1 left off.
            key: 'num',
            label: '#',
            className: 'w-[4%] pl-4 sm:pl-5 text-left text-xs text-faint tabular-nums align-top py-3',
            skeletonWidth: '20px',
            render: (_client, i) => (currentPage - 1) * pageSize + i + 1,
        },
        {
            key: 'clientCompany',
            label: 'Client Name',
            sortKey: 'company',
            className: 'w-[22%] px-3 text-left align-top py-3',
            skeletonWidth: '80%',
            render: (client) => {
                const name = client.clientCompany || 'N/A'
                return (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold flex-shrink-0 ${avatarTone(name)}`}>
                            {name.charAt(0).toUpperCase() || 'C'}
                        </span>
                        <span className="truncate" title={name}>
                            {name}
                        </span>
                    </div>
                )
            },
        },
        {
            key: 'businessModel',
            label: 'Business Model',
            sortKey: 'model',
            className: 'w-[16%] px-3 text-left align-top py-3',
            render: (client) =>
                client.businessModel ? (
                    <span
                        className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap max-w-full ${
                            MODEL_TONES[client.businessModel] || 'bg-ink-100 text-subtle'
                        }`}
                        title={businessModelLabel(client.businessModel)}
                    >
                        <span className="truncate">{businessModelFullName(client.businessModel)}</span>
                    </span>
                ) : (
                    <span
                        className="inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium bg-warn-50 text-warn-700 whitespace-nowrap"
                        title="Edit this client to set its business model"
                    >
                        Not set
                    </span>
                ),
        },
        {
            key: 'contactName',
            label: 'Contact Name',
            className: 'w-[18%] px-3 text-left align-top py-3',
            render: (client) => {
                const contacts = orderedContacts(client.contactPersons)
                if (!contacts.length) return <span className="text-sm text-faint">—</span>
                const expanded = expandedRowIds.has(client._id)
                const shown = expanded ? contacts : contacts.slice(0, 1)
                const extra = contacts.length - shown.length
                return (
                    <div className="flex flex-col gap-1 min-w-0">
                        {shown.map((c, i) => (
                            <span
                                key={i}
                                className={`text-sm truncate ${i === 0 ? 'text-body' : 'text-subtle'}`}
                                title={c.name || 'N/A'}
                            >
                                {c.name || 'N/A'}
                                {expanded && i === 0 && contacts.length > 1 ? (
                                    <span className="ml-1.5 text-2xs font-medium text-brand-strong">primary</span>
                                ) : null}
                            </span>
                        ))}
                        {extra > 0 && (
                            <span className="text-2xs text-faint">+{extra}</span>
                        )}
                    </div>
                )
            },
        },
        {
            key: 'email',
            label: 'Email',
            className: 'w-[22%] px-3 text-left align-top py-3',
            skeletonWidth: '85%',
            render: (client) => {
                const contacts = orderedContacts(client.contactPersons)
                if (!contacts.length) return <span className="text-sm text-faint">—</span>
                const expanded = expandedRowIds.has(client._id)
                const shown = expanded ? contacts : contacts.slice(0, 1)
                return (
                    <div className="flex flex-col gap-1 min-w-0">
                        {shown.map((c, i) => (
                            <span
                                key={i}
                                className="text-sm text-subtle truncate block"
                                title={c.email || 'N/A'}
                            >
                                {c.email || '—'}
                            </span>
                        ))}
                    </div>
                )
            },
        },
        {
            key: 'contactNumber',
            label: 'Contact Number',
            className: 'w-[13%] px-3 text-left align-top py-3',
            skeletonWidth: '75%',
            render: (client) => {
                const contacts = orderedContacts(client.contactPersons)
                if (!contacts.length) return <span className="text-sm text-faint">—</span>
                const expanded = expandedRowIds.has(client._id)
                const shown = expanded ? contacts : contacts.slice(0, 1)
                return (
                    <div className="flex flex-col gap-1 min-w-0">
                        {shown.map((c, i) => (
                            <span
                                key={i}
                                className="text-sm text-subtle tabular-nums truncate block"
                                title={c.phoneNumber || 'N/A'}
                            >
                                {c.phoneNumber || '—'}
                            </span>
                        ))}
                    </div>
                )
            },
        },
        {
            key: 'actions',
            label: '',
            // Every row-level action lives in the kebab now, including the
            // status toggle — the column only needs room for a 28-px trigger
            // plus the right gutter.
            className: 'w-[5%] pl-2 pr-4 sm:pr-5 text-right whitespace-nowrap align-top py-3',
            skeletonWidth: '20px',
            render: (client) => {
                const anyKebab = canView || canEdit || canToggle || canDelete
                const isActive = client.status === 'active'
                const isToggling = togglingClientId === client._id
                const expanded = expandedRowIds.has(client._id)
                const hasSecondary = (client.contactPersons?.length ?? 0) > 1
                return (
                    <div className="flex items-center justify-end">
                        {anyKebab && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" title="More actions" aria-label="More actions" className={ICON_BUTTON_CLASS}>
                                        <MoreVertical size={14} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    {/* Secondary-contact reveal — shown ONLY when the row
                                        has more than the primary, otherwise there is
                                        literally nothing "all" to view. */}
                                    {hasSecondary && (
                                        <DropdownMenuItem
                                            onClick={() => toggleRowExpanded(client._id)}
                                            className="cursor-pointer"
                                        >
                                            {expanded ? (
                                                <>
                                                    <EyeOff /> Hide secondary contacts
                                                </>
                                            ) : (
                                                <>
                                                    <Eye className="text-brand-strong" /> View all contacts
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                    )}
                                    {canView && (
                                        <DropdownMenuItem onClick={() => handleView(client._id)} className="cursor-pointer">
                                            <Eye className="text-brand-strong" /> View details
                                        </DropdownMenuItem>
                                    )}
                                    {canEdit && (
                                        <DropdownMenuItem onClick={() => handleEdit(client._id)} className="cursor-pointer">
                                            <Pencil /> Edit
                                        </DropdownMenuItem>
                                    )}
                                    {canToggle && (
                                        <>
                                            <DropdownMenuSeparator />
                                            {/* Status is now controlled by an inline
                                                switch inside the menu item — one place
                                                to see and change state, with a live label
                                                that mirrors the switch. Selecting the
                                                item toggles too, so keyboard users don't
                                                need to hit the switch itself. */}
                                            <DropdownMenuItem
                                                onSelect={(e) => { e.preventDefault(); handleToggleStatus(client) }}
                                                className="cursor-pointer justify-between gap-3"
                                            >
                                                <span className={`text-xs font-medium ${isActive ? 'text-success-700' : 'text-subtle'} ${isToggling ? 'animate-pulse' : ''}`}>
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                <Switch
                                                    checked={isActive}
                                                    disabled={isToggling}
                                                    onCheckedChange={() => handleToggleStatus(client)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={isActive ? 'Deactivate client' : 'Activate client'}
                                                    className="data-[state=checked]:bg-success-500 data-[state=unchecked]:bg-ink-200"
                                                />
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {canDelete && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem variant="destructive" onClick={() => handleDelete(client._id)} className="cursor-pointer">
                                                <Trash2 /> Delete
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
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                // flex-col + h-full + min-h-0 = the chain the parent shell needs
                // so the table card below can `flex-1 min-h-0` and fill the
                // remaining viewport height instead of capping at a hardcoded
                // maxHeight. min-w-0 stops flex children from pushing width
                // beyond the workspace and triggering horizontal overflow.
                className="flex flex-col h-full min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-5 pb-4"
            >
                {/* ── Slim header + compact stat chips ── */}
                {/* flex-nowrap on the wide/desktop rail: the left column
                    shrinks (flex-1 min-w-0) so its subtitle wraps within
                    its own column instead of pushing the right-side chip
                    strip onto a new line. flex-wrap kicks in only on very
                    narrow viewports as a safety fallback. */}
                <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em]">Clients</h1>
                    </div>
                    {/* Right-aligned stat strip — shared primitive so every
                        LMS listing page (Services, Course Setup, …) sits on
                        exactly the same alignment. */}
                    <HeaderStats
                        loading={isLoadingList}
                        items={[
                            { label: 'Clients', value: counts.total },
                            { label: 'Active', value: counts.active },
                            { label: 'Inactive', value: counts.inactive },
                            { label: 'Models', value: counts.models },
                        ]}
                    />
                </div>

                {/* ── One toolbar: search · Filter · view toggle · Export · Print · Add Client ── */}
                {/* Search is bounded (max-w-xs) rather than flex-filling so
                    the trailing action buttons (Export, Print, Add) breathe
                    on the same row. flex-wrap kicks in only on very narrow
                    viewports as a safety fallback. */}
                <div className="mt-4 flex items-center gap-2 flex-wrap min-w-0">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                            placeholder="Search client, contact, email…"
                            className="w-full h-10 pl-10 pr-9 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                        />
                        {search && (
                            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"><X size={14} /></button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border text-sm font-medium shadow-xs transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? 'border-brand text-brand-strong bg-brand-wash' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'}`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Filter</span>
                        {activeFilterCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">{activeFilterCount}</span>}
                    </button>

                    <div className="hidden sm:flex items-center p-0.5 rounded-control border border-hairline-strong bg-surface h-10" role="group" aria-label="Layout">
                        <button type="button" onClick={() => setLayout('cards')} aria-pressed={layout === 'cards'} title="Card view" className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${layout === 'cards' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><LayoutGrid className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setLayout('table')} aria-pressed={layout === 'table'} title="List view" className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${layout === 'table' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><Rows3 className="w-4 h-4" /></button>
                    </div>

                    {/* Export — CSV or PDF via a small dropdown. Both hit the
                        server for the full filtered set (not the visible page)
                        so the download matches what the user is looking at. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Export list"
                                disabled={isExporting || !totalUsers}
                                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body shadow-xs hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                            <DropdownMenuItem onClick={exportCsv} className="cursor-pointer">
                                <FileSpreadsheet className="h-4 w-4 text-success-700" /> CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
                                <FileText className="h-4 w-4 text-danger-500" /> PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                        type="button"
                        onClick={printList}
                        title="Print this page"
                        className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body shadow-xs hover:bg-row-hover hover:text-heading transition-colors duration-150"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Print</span>
                    </button>

                    {canAdd && (
                        <button
                            type="button"
                            onClick={handleAddNew}
                            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-control bg-brand-strong text-white shadow-xs hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                        >
                            <Plus size={16} strokeWidth={2.4} />
                            <span className="text-sm font-semibold hidden sm:inline">Add Client</span>
                        </button>
                    )}
                </div>

                {/* ── Inline filter panel (Business Model + Status only) ── */}
                <ClientFilterPanel
                    open={showFilters}
                    onClose={() => setShowFilters(false)}
                    current={{ status: statusFilter, model: businessModelFilter, type: typeFilter, date: dateFilter }}
                    modelOptions={availableModels.map(([value, label]) => ({ value, label }))}
                    onApply={(f) => {
                        setStatusFilter(f.status as '' | 'active' | 'inactive')
                        setBusinessModelFilter(f.model)
                        setCurrentPage(1)
                    }}
                    onReset={clearFilters}
                />

                {/* ── Active filter chips ── */}
                {filterChips.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {filterChips.map((chip) => (
                            <span key={chip.key} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
                                {chip.label}
                                <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={() => { chip.onRemove(); setCurrentPage(1) }} className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"><X size={11} /></button>
                            </span>
                        ))}
                        <button type="button" onClick={clearFilters} className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5">Clear all</button>
                    </div>
                )}

                {/* ── Content: cards or list (list is the default) ── */}
                {/* flex-1 min-h-0 = fill remaining viewport height. flex-col so
                    the scroll region can flex-1 while the pagination footer
                    keeps its natural height at the bottom. The ref feeds the
                    auto-fit page-size effect above — measuring THIS box tells
                    the effect how many rows fit without vertical scroll. */}
                <div ref={tableCardRef} className="mt-4 flex flex-1 min-h-0 flex-col bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">

                    {layout === 'table' ? (
                        <DataTable
                            rows={currentUsers}
                            columns={columns}
                            rowKey={(client) => client._id}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            isLoading={isLoadingList}
                            isFiltered={hasActiveFilters}
                            // fixedLayout = table-layout:fixed with no minimum
                            // width: the column percentages (summing to 100%)
                            // decide the layout, long values ellipsize, and the
                            // table always fits the card — never a horizontal
                            // scrollbar.
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
                            {isLoadingList ? (
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

                    <TableFooter
                        from={totalUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                        to={Math.min(currentPage * pageSize, totalUsers)}
                        total={totalUsers}
                        pageSize={pageSize}
                        // A manual pick pins the size and stops the auto-fit
                        // observer from overriding on the next resize.
                        onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1) }}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPage={setCurrentPage}
                    />
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
