"use client"

// Full-page client details view — the "View details" destination from the
// client-list kebab. Reads the id off the /lms/pages/clientmanagement/[id]
// route, fetches the client + its service mappings, and renders the same
// four cards + tab strip the mockup asked for. Terminology aligns with the
// rest of the app: every "Project" from the reference mockup is spelled
// "Service" here because a Service Mapping is what a client is authored
// against in this codebase.

import React, { useEffect, useMemo, useState } from 'react'
import {
    ArrowRight, Building, Calendar, ChevronRight, FileText,
    Layers, Mail, MapPin, Pencil, Phone, Plus, Loader2,
} from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/app/lms/component/layout'
import { useClient } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import { useMappingsByClient } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'
import { businessModelFullName, notify, orderedContacts } from './lib'

// ─── Small display primitives ────────────────────────────────────────────
// Kept private to this file. Nothing else uses them, and pulling them out
// into a shared kit adds churn for no reader benefit.

const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
    <div className={`rounded-tile border border-hairline bg-surface p-5 shadow-xs ${className}`}>
        {children}
    </div>
)

const CardHeader: React.FC<React.PropsWithChildren<{ title: string; action?: React.ReactNode; icon?: React.ComponentType<{ size?: number; className?: string }> }>> = ({
    title, action, icon: Icon,
}) => (
    <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
            {Icon && (
                <span className="inline-flex size-8 items-center justify-center rounded-md bg-brand-wash text-brand-strong">
                    <Icon size={16} aria-hidden />
                </span>
            )}
            <h2 className="text-sm font-bold text-heading">{title}</h2>
        </div>
        {action}
    </div>
)

// Two-column row inside the summary card. Label on the left, value on the
// right; long values wrap normally.
const SummaryRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="grid grid-cols-[112px_1fr] items-start gap-3 py-1.5">
        <span className="text-xs font-medium text-subtle">{label}</span>
        <span className="text-sm text-heading">{value ?? <span className="text-faint">—</span>}</span>
    </div>
)

// ─── Helpers ─────────────────────────────────────────────────────────────
const initialsOf = (name: string): string => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const fmtSince = (iso?: string): string => {
    if (!iso) return ''
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
        })
    } catch { return '' }
}

// Extract the last non-empty line of an address block for the header's
// "location" line (e.g. "New Delhi, India"). Falls back to the whole
// address if the split doesn't produce anything.
const locationLine = (address?: string): string => {
    if (!address) return ''
    const lines = address.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
    if (lines.length === 0) return ''
    if (lines.length === 1) return lines[0]
    return lines.slice(-2).join(', ')
}

// ─── Tab strip ───────────────────────────────────────────────────────────
type TabKey = 'overview' | 'services' | 'invoices' | 'payments' | 'documents' | 'activity'
const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'services',  label: 'Services'  },
    { key: 'invoices',  label: 'Invoices'  },
    { key: 'payments',  label: 'Payments'  },
    { key: 'documents', label: 'Documents' },
    { key: 'activity',  label: 'Activity'  },
]

// ─── Page ────────────────────────────────────────────────────────────────
export default function ClientDetailsPage() {
    const router = useRouter()
    const params = useParams() as { id?: string | string[] }
    const searchParams = useSearchParams()
    const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id
    const id = typeof rawId === 'string' ? rawId : ''

    const { can } = usePermissions()
    const canEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit Client')
    const canNewMapping = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'New Mapping')

    const { data: client, isLoading, error } = useClient(id || undefined)
    const { data: mappings = [] } = useMappingsByClient(id)

    const [activeTab, setActiveTab] = useState<TabKey>('overview')

    // Show the "Client created successfully" toast only when this page was
    // reached RIGHT after a create — the create flow passes ?created=1 in
    // the URL. Fires once, then strips the param so a refresh doesn't
    // re-fire the toast.
    useEffect(() => {
        if (searchParams.get('created') !== '1') return
        notify.success('Client created successfully')
        const url = new URL(window.location.href)
        url.searchParams.delete('created')
        router.replace(url.pathname + (url.search ? `?${url.searchParams.toString()}` : ''), { scroll: false })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Actions ──
    const handleBackToList = () => router.push('/lms/pages/clientmanagement')
    const handleEdit = () => {
        // The Add/Edit form lives inside the list page; land there with an
        // ?edit=<id> flag so that page opens the form for this client. If
        // the list page doesn't act on the flag yet, the user still lands
        // on a familiar screen (their client is one row away).
        router.push(`/lms/pages/clientmanagement?edit=${encodeURIComponent(id)}`)
    }
    const handleCreateService = () => {
        router.push(`/lms/pages/servicemapping?newMapping=1&clientId=${encodeURIComponent(id)}`)
    }

    // ── Loading + error states ──
    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-full min-h-[50vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-subtle">
                        <Loader2 className="size-8 animate-spin text-brand-strong" />
                        <p className="text-sm">Loading client…</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }
    if (error || !client) {
        return (
            <DashboardLayout>
                <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                    <h1 className="text-xl font-bold text-heading">Client not found</h1>
                    <p className="mt-2 text-sm text-subtle">
                        The client you tried to open no longer exists or you don&apos;t have permission to view it.
                    </p>
                    <button
                        type="button"
                        onClick={handleBackToList}
                        className="mt-6 inline-flex h-9 items-center rounded-chip bg-brand-600 px-4 text-xs font-bold text-white hover:bg-brand-700"
                    >
                        Back to clients
                    </button>
                </div>
            </DashboardLayout>
        )
    }

    // ── Derived display data ──
    const primaryContact = orderedContacts(client.contactPersons)[0]
    const isActive = client.status === 'active'
    const businessLabel = client.businessModel
        ? businessModelFullName(client.businessModel)
        : ''
    // Short ID chip like "CL-<last6>" — friendlier than the raw Mongo id.
    const shortId = `CL-${(client._id || '').slice(-6).toUpperCase()}`

    return (
        <DashboardLayout>
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

                {/* ── Breadcrumb ── */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
                    <button
                        type="button"
                        onClick={handleBackToList}
                        className="text-subtle hover:text-heading transition-colors"
                    >
                        Clients
                    </button>
                    <ChevronRight size={12} className="text-faint" aria-hidden />
                    <span className="font-semibold text-heading truncate max-w-[280px]" title={client.clientCompany}>
                        {client.clientCompany}
                    </span>
                </nav>

                {/* ── Header block ── */}
                <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4 min-w-0">
                        {/* Circular avatar — uses the uploaded client logo
                            when the record has one, and falls back to the
                            initials circle otherwise. Wrapped image gets
                            `object-cover` so a non-square logo crops to the
                            circle instead of distorting. */}
                        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-wash text-2xl font-bold text-brand-strong">
                            {client.clientLogo ? (
                                <img
                                    src={client.clientLogo}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Broken URL → hide the image so the
                                        // sibling initials show through the
                                        // still-styled parent circle.
                                        (e.currentTarget as HTMLImageElement).style.display = 'none'
                                        const next = e.currentTarget.nextElementSibling as HTMLElement | null
                                        if (next) next.style.display = 'flex'
                                    }}
                                />
                            ) : null}
                            <span
                                className="w-full h-full flex items-center justify-center"
                                style={{ display: client.clientLogo ? 'none' : 'flex' }}
                            >
                                {initialsOf(client.clientCompany)}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-heading truncate" title={client.clientCompany}>
                                {client.clientCompany}
                            </h1>
                            <div className="mt-1.5 flex items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-2xs font-bold ${
                                        isActive
                                            ? 'border-success-500/25 bg-success-50 text-success-700'
                                            : 'border-hairline-strong bg-ink-50 text-subtle'
                                    }`}
                                >
                                    <span className={`size-1.5 rounded-full ${isActive ? 'bg-success-500' : 'bg-ink-400'}`} />
                                    {isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                                {locationLine(client.clientAddress) && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin size={12} className="text-faint" aria-hidden />
                                        {locationLine(client.clientAddress)}
                                    </span>
                                )}
                                {client.createdAt && (
                                    <>
                                        <span aria-hidden className="text-faint">•</span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Calendar size={12} className="text-faint" aria-hidden />
                                            Client since {fmtSince(client.createdAt)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={handleEdit}
                                className="inline-flex h-9 items-center gap-1.5 rounded-chip border border-hairline-strong bg-surface px-3 text-xs font-bold text-heading transition-colors hover:bg-ink-50"
                            >
                                <Pencil size={13} /> Edit client
                            </button>
                        )}
                        {canNewMapping && (
                            <button
                                type="button"
                                onClick={handleCreateService}
                                className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-brand-600 px-3.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-700"
                            >
                                <Plus size={13} /> Create service
                            </button>
                        )}
                    </div>
                </header>

                {/* ── Tabs ── */}
                <div className="border-b border-hairline">
                    <nav role="tablist" aria-label="Client sections" className="flex flex-wrap items-center gap-6">
                        {TABS.map((t) => {
                            const active = t.key === activeTab
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveTab(t.key)}
                                    className={`relative pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                                        active ? 'text-brand-strong' : 'text-subtle hover:text-heading'
                                    }`}
                                >
                                    {t.label}
                                    {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                {/* ── Tab content ── */}
                {activeTab === 'overview' && (
                    <OverviewTab
                        client={client}
                        primaryContact={primaryContact}
                        businessLabel={businessLabel}
                        shortId={shortId}
                        mappingsCount={mappings.length}
                        onSeeAllServices={() => setActiveTab('services')}
                        onCreateService={handleCreateService}
                        canNewMapping={canNewMapping}
                    />
                )}
                {activeTab === 'services' && (
                    <ServicesTab
                        clientId={id}
                        mappings={mappings}
                        onCreateService={handleCreateService}
                        canNewMapping={canNewMapping}
                    />
                )}
                {(activeTab === 'invoices' || activeTab === 'payments' || activeTab === 'documents' || activeTab === 'activity') && (
                    <ComingSoonTab tab={activeTab} />
                )}
            </div>
        </DashboardLayout>
    )
}

// ─── Overview tab ────────────────────────────────────────────────────────
function OverviewTab({
    client, primaryContact, businessLabel, shortId, mappingsCount,
    onSeeAllServices, onCreateService, canNewMapping,
}: {
    client: any
    primaryContact?: { name: string; email: string; phoneNumber: string; isPrimary: boolean; _id?: string }
    businessLabel: string
    shortId: string
    mappingsCount: number
    onSeeAllServices: () => void
    onCreateService: () => void
    canNewMapping: boolean
}) {
    // Strip HTML tags from the description — Notes may carry TipTap output
    // (from the Add/Edit form). Displaying raw HTML on a plain-text row
    // would leak formatting; a text-only summary keeps the card clean.
    const plainNotes = useMemo(() => {
        const html = (client.description || '').trim()
        if (!html) return ''
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }, [client.description])

    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Client summary */}
            <Card>
                <CardHeader title="Client summary" icon={Building} />
                <div className="divide-y divide-hairline">
                    <SummaryRow label="Client ID" value={<span className="font-mono text-body">{shortId}</span>} />
                    <SummaryRow label="Company" value={client.clientCompany} />
                    <SummaryRow label="Business model" value={businessLabel || undefined} />
                    <SummaryRow label="Status" value={client.status === 'active' ? 'Active' : 'Inactive'} />
                    <SummaryRow label="Notes" value={plainNotes || undefined} />
                </div>
            </Card>

            {/* Contact details */}
            <Card>
                <CardHeader title="Contact details" icon={Mail} />
                {primaryContact ? (
                    <ul className="flex flex-col gap-3">
                        {primaryContact.email && (
                            <li className="flex items-start gap-3 text-sm">
                                <Mail size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                                <a href={`mailto:${primaryContact.email}`} className="text-heading hover:text-brand-strong hover:underline">
                                    {primaryContact.email}
                                </a>
                            </li>
                        )}
                        {primaryContact.phoneNumber && (
                            <li className="flex items-start gap-3 text-sm">
                                <Phone size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                                <a href={`tel:${primaryContact.phoneNumber}`} className="text-heading hover:text-brand-strong hover:underline">
                                    {primaryContact.phoneNumber}
                                </a>
                            </li>
                        )}
                        {client.clientAddress && (
                            <li className="flex items-start gap-3 text-sm">
                                <MapPin size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                                <span className="whitespace-pre-line text-heading">{client.clientAddress}</span>
                            </li>
                        )}
                    </ul>
                ) : (
                    <p className="text-sm text-subtle">No contact person on file.</p>
                )}
            </Card>

            {/* Services */}
            <Card>
                <CardHeader
                    title="Services"
                    icon={Layers}
                    action={mappingsCount > 0 ? (
                        <button
                            type="button"
                            onClick={onSeeAllServices}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:text-brand-700"
                        >
                            See all <ArrowRight size={12} />
                        </button>
                    ) : undefined}
                />
                {mappingsCount === 0 ? (
                    <EmptyBlock
                        title="No services yet"
                        message="Create your first service to get started."
                        actionLabel={canNewMapping ? 'Create service' : undefined}
                        onAction={canNewMapping ? onCreateService : undefined}
                    />
                ) : (
                    <p className="text-sm text-subtle">
                        {mappingsCount} service{mappingsCount === 1 ? '' : 's'} mapped for this client.
                    </p>
                )}
            </Card>

            {/* Invoices — feature not in this LMS; empty state for parity
                with the SaaS reference. No click handler on the button
                because the feature doesn't exist here; kept for visual
                parity so the two lower cards balance. */}
            <Card>
                <CardHeader title="Invoices" icon={FileText} />
                <EmptyBlock
                    title="No invoices yet"
                    message="Invoices for this client will appear here."
                />
            </Card>
        </div>
    )
}

// ─── Services tab ────────────────────────────────────────────────────────
function ServicesTab({
    mappings, onCreateService, canNewMapping,
}: {
    clientId: string
    mappings: any[]
    onCreateService: () => void
    canNewMapping: boolean
}) {
    if (mappings.length === 0) {
        return (
            <Card>
                <EmptyBlock
                    title="No services yet"
                    message="Create your first service to get started."
                    actionLabel={canNewMapping ? 'Create service' : undefined}
                    onAction={canNewMapping ? onCreateService : undefined}
                />
            </Card>
        )
    }
    return (
        <Card>
            <CardHeader
                title={`Services (${mappings.length})`}
                icon={Layers}
                action={canNewMapping ? (
                    <button
                        type="button"
                        onClick={onCreateService}
                        className="inline-flex h-8 items-center gap-1.5 rounded-chip bg-brand-600 px-3 text-xs font-bold text-white hover:bg-brand-700"
                    >
                        <Plus size={12} /> Create service
                    </button>
                ) : undefined}
            />
            <ul className="divide-y divide-hairline">
                {mappings.map((m: any) => (
                    <li key={m._id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-heading">
                                {m.serviceName || m.service?.serviceName || m.service || 'Service'}
                            </p>
                            <p className="text-xs text-subtle">
                                {m.serviceModels?.length
                                    ? `${m.serviceModels.length} model${m.serviceModels.length === 1 ? '' : 's'}`
                                    : 'No model configured'}
                                {m.year ? ` · ${m.year}` : ''}
                            </p>
                        </div>
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-2xs font-bold ${
                                m.status === 'active'
                                    ? 'border-success-500/25 bg-success-50 text-success-700'
                                    : 'border-hairline-strong bg-ink-50 text-subtle'
                            }`}
                        >
                            <span className={`size-1.5 rounded-full ${m.status === 'active' ? 'bg-success-500' : 'bg-ink-400'}`} />
                            {m.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    )
}

// ─── Coming-soon / placeholder tabs ──────────────────────────────────────
function ComingSoonTab({ tab }: { tab: TabKey }) {
    const label = TABS.find((t) => t.key === tab)?.label || 'This section'
    return (
        <Card>
            <EmptyBlock
                title={`${label} — not available yet`}
                message="This surface isn't wired into the LMS today. Ask if you'd like it added."
            />
        </Card>
    )
}

// ─── Shared empty block ──────────────────────────────────────────────────
function EmptyBlock({
    title, message, actionLabel, onAction, actionMuted,
}: {
    title: string
    message: string
    actionLabel?: string
    onAction?: () => void
    actionMuted?: boolean
}) {
    return (
        <div className="flex flex-col items-start gap-2 py-3">
            <p className="text-sm font-bold text-heading">{title}</p>
            <p className="text-xs text-subtle">{message}</p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className={`mt-1 inline-flex h-8 items-center gap-1.5 rounded-chip border px-3 text-xs font-bold transition-colors ${
                        actionMuted
                            ? 'border-hairline-strong bg-surface text-heading hover:bg-ink-50'
                            : 'border-brand-500/30 bg-brand-wash text-brand-strong hover:bg-brand-100'
                    }`}
                >
                    <Plus size={12} /> {actionLabel}
                </button>
            )}
        </div>
    )
}
