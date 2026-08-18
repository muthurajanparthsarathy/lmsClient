"use client"

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Box, Calendar, Eye, Mail, MoreVertical, Pencil, Phone, Power, Trash2, Users } from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusPill, listItem, listStagger } from '@/app/lms/shared/ui'
import type { Client } from '@/apiServices/clientManagementService'
import {
    MODEL_TONES, TYPE_LABEL, avatarTone, businessModelFullName, businessModelLabel,
    fmtDate, orderedContacts,
} from './lib'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// The client card grid — the page's primary reading view. Each card is a
// clickable organization tile (opens the details drawer), communicating the
// org's identity, enabled modules, primary contact and health at a glance.

// A short human-facing code from the id, so a card carries an identifier even
// though the model has no dedicated code field.
const clientCode = (id: string) => `#${(id || '').slice(-6).toUpperCase()}`

function ClientLogo({ client, name }: { client: Client; name: string }) {
    if (client.clientLogo) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={client.clientLogo}
                alt=""
                className="w-11 h-11 rounded-tile object-cover flex-shrink-0 border border-hairline bg-surface"
            />
        )
    }
    return (
        <span className={`w-11 h-11 rounded-tile flex items-center justify-center text-md font-semibold flex-shrink-0 ${avatarTone(name)}`} aria-hidden>
            {name.charAt(0).toUpperCase() || 'C'}
        </span>
    )
}

// Row-action kebab for a client card, gated per the signed-in user's
// admin-clientmanagement functionality grants (View Full Details / Edit /
// Toggle Client Status / Delete). Hides items the user can't run and hides
// the whole trigger when nothing is available, so the card never opens an
// empty menu.
function CardKebab({
    client,
    isActive,
    onView,
    onEdit,
    onToggleStatus,
    onDelete,
}: {
    client: Client
    isActive: boolean
    onView: (id: string) => void
    onEdit: (id: string) => void
    onToggleStatus: (client: Client) => void
    onDelete: (id: string) => void
}) {
    const { can } = usePermissions()
    const canView = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'View Full Details')
    const canEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit')
    const canToggle = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Toggle Client Status')
    const canDelete = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Delete')
    if (!(canView || canEdit || canToggle || canDelete)) return null
    return (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" title="More actions" aria-label="More actions" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading">
                        <MoreVertical size={15} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    {canView && <DropdownMenuItem onClick={() => onView(client._id)} className="cursor-pointer"><Eye className="text-brand-strong" /> View details</DropdownMenuItem>}
                    {canEdit && <DropdownMenuItem onClick={() => onEdit(client._id)} className="cursor-pointer"><Pencil /> Edit</DropdownMenuItem>}
                    {canToggle && <DropdownMenuItem onClick={() => onToggleStatus(client)} className="cursor-pointer"><Power className={isActive ? undefined : 'text-success-700'} /> {isActive ? 'Deactivate' : 'Activate'}</DropdownMenuItem>}
                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(client._id)} className="cursor-pointer"><Trash2 /> Delete</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

function ClientCard({
    client,
    isToggling,
    onView,
    onEdit,
    onToggleStatus,
    onDelete,
}: {
    client: Client
    isToggling: boolean
    onView: (id: string) => void
    onEdit: (id: string) => void
    onToggleStatus: (client: Client) => void
    onDelete: (id: string) => void
}) {
    const name = client.clientCompany || 'N/A'
    const contacts = orderedContacts(client.contactPersons)
    const primary = contacts[0]
    const extra = contacts.length - 1
    const isActive = client.status === 'active'
    const namedContacts = client.contactPersons?.filter((p) => p.name?.trim()).length || 0
    const modules = (client.services || []).map((s) => s.service).filter(Boolean)
    const shownModules = modules.slice(0, 3)
    const moreModules = modules.length - shownModules.length

    return (
        <motion.div
            variants={listItem}
            role="button"
            tabIndex={0}
            onClick={() => onView(client._id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onView(client._id)
                }
            }}
            className="group flex flex-col bg-surface rounded-xl border border-hairline shadow-xs p-4 cursor-pointer transition-[box-shadow,transform,border-color] duration-150 ease-standard hover:shadow-md hover:-translate-y-0.5 hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
            {/* Identity row */}
            <div className="flex items-start gap-3">
                <ClientLogo client={client} name={name} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-heading truncate" title={name}>{name}</p>
                        <span className="text-[10px] font-semibold text-faint tabular-nums flex-shrink-0">{clientCode(client._id)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {client.businessModel ? (
                            <span
                                className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium whitespace-nowrap ${MODEL_TONES[client.businessModel] || 'bg-ink-100 text-subtle'}`}
                                title={businessModelLabel(client.businessModel)}
                            >
                                {businessModelFullName(client.businessModel)}
                            </span>
                        ) : (
                            <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium bg-warn-50 text-warn-700 whitespace-nowrap" title="Edit this client to set its business model">
                                Not set
                            </span>
                        )}
                        {client.type?.map((t) => (
                            <span key={t} className="inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium bg-brand-wash text-brand-strong whitespace-nowrap">
                                {TYPE_LABEL[t]}
                            </span>
                        ))}
                        <StatusPill tone={isActive ? 'success' : 'neutral'} dot className={`flex-shrink-0 ${isToggling ? 'animate-pulse' : ''}`}>
                            {isActive ? 'Active' : 'Inactive'}
                        </StatusPill>
                    </div>
                </div>

                <CardKebab
                    client={client}
                    isActive={isActive}
                    onView={onView}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                />
            </div>

            {/* Enabled modules / services */}
            <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-faint mb-1.5"><Box size={11} /> Modules</span>
                {modules.length ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {shownModules.map((m, i) => (
                            <span key={`${m}-${i}`} className="inline-flex items-center h-[22px] px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-medium whitespace-nowrap">{m}</span>
                        ))}
                        {moreModules > 0 && (
                            <span className="inline-flex items-center h-[22px] px-2 rounded-chip bg-ink-100 text-ink-600 text-2xs font-semibold">+{moreModules} More</span>
                        )}
                    </div>
                ) : (
                    <span className="text-2xs text-line-muted">No modules mapped yet</span>
                )}
            </div>

            {/* Primary contact */}
            <div className="mt-3 rounded-tile bg-canvas border border-hairline px-3 py-2.5">
                {primary ? (
                    <>
                        <p className="text-sm text-heading truncate flex items-center gap-1.5">
                            <span className="truncate" title={contacts.map((c) => c.name || 'N/A').join(', ')}>{primary.name || 'N/A'}</span>
                            {extra > 0 && <span className="text-2xs text-faint flex-shrink-0">+{extra}</span>}
                            {primary.isPrimary && <span className="text-2xs text-success-700 font-medium flex-shrink-0">Primary</span>}
                        </p>
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-subtle">
                            <span className="inline-flex items-center gap-1.5 min-w-0"><Mail size={12} className="text-faint flex-shrink-0" /><span className="truncate">{primary.email || '—'}</span></span>
                            <span className="inline-flex items-center gap-1.5"><Phone size={12} className="text-faint flex-shrink-0" />{primary.phoneNumber || '—'}</span>
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-faint">No contacts yet</p>
                )}
            </div>

            {/* Meta footer + Manage */}
            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-2xs text-subtle min-w-0">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><Users size={12} className="text-faint" />{namedContacts}</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><Box size={12} className="text-faint" />{modules.length}</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-faint" title={`Updated ${fmtDate(client.updatedAt)}`}><Calendar size={12} />{fmtDate(client.updatedAt || client.createdAt).split(',')[0]}</span>
                </div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onView(client._id) }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-brand-strong/25 bg-brand-wash text-brand-strong text-xs font-semibold shadow-xs hover:bg-brand-strong hover:text-white hover:border-brand-strong transition-colors duration-150 flex-shrink-0"
                >
                    Manage <ArrowRight size={14} />
                </button>
            </div>
        </motion.div>
    )
}

export default function ClientCards({
    clients,
    togglingClientId,
    onView,
    onEdit,
    onToggleStatus,
    onDelete,
}: {
    clients: Client[]
    togglingClientId: string | null
    onView: (id: string) => void
    onEdit: (id: string) => void
    onToggleStatus: (client: Client) => void
    onDelete: (id: string) => void
}) {
    // Stagger the grid ONCE on first mount; filter/sort/page swaps afterwards
    // render instantly (no re-stagger per the motion rules).
    const [entered, setEntered] = useState(false)
    useEffect(() => { setEntered(true) }, [])

    return (
        <motion.div
            variants={listStagger}
            initial={entered ? false : 'hidden'}
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
            {clients.map((client) => (
                <ClientCard
                    key={client._id}
                    client={client}
                    isToggling={togglingClientId === client._id}
                    onView={onView}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                />
            ))}
        </motion.div>
    )
}
