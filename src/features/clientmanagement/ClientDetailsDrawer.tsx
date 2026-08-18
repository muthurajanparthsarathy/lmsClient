"use client"

import React from 'react'
import { Box, Building, Mail, Pencil, Phone, Power, Trash2, User } from 'lucide-react'
import { Drawer, StatusPill } from '@/app/lms/shared/ui'
import { Button } from '@/components/ui/button'
import type { Client } from '@/apiServices/clientManagementService'
import { TYPE_LABEL, avatarTone, businessModelLabel, fmtDate, orderedContacts } from './lib'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

// Read-only full view of a client, as a right-side sheet on the kit Drawer —
// organization info, enabled modules, usage, contacts and quick actions, so the
// admin never leaves the page to inspect or act on an organization.

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5 border-b border-hairline last:border-0">
            <span className="text-xs text-subtle pt-px">{label}</span>
            <span className="text-sm text-body min-w-0 break-words">{value}</span>
        </div>
    )
}

function UsageTile({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-tile border border-hairline bg-surface px-3 py-2.5 shadow-xs">
            <p className="text-lg font-semibold text-heading tabular-nums leading-none">{value}</p>
            <p className="text-2xs text-subtle mt-1">{label}</p>
        </div>
    )
}

export default function ClientDetailsDrawer({
    open,
    client,
    onClose,
    onEdit,
    onToggleStatus,
    onDelete,
}: {
    open: boolean
    client: Client | null
    onClose: () => void
    onEdit?: (id: string) => void
    onToggleStatus?: (client: Client) => void
    onDelete?: (id: string) => void
}) {
    // Drop optional callbacks the signed-in user isn't allowed to trigger, so
    // the quick-actions row hides the buttons even when the parent passed
    // handlers. Parent + gate must both grant an action for it to appear.
    const { can } = usePermissions()
    const gatedEdit = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Edit') ? onEdit : undefined
    const gatedToggle = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Toggle Client Status') ? onToggleStatus : undefined
    const gatedDelete = can(PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT, 'Delete') ? onDelete : undefined

    // Presentation only: hold on to the last shown client so the drawer's exit
    // animation doesn't flash empty when the parent nulls `client` on close.
    const lastClient = React.useRef<Client | null>(null)
    if (client) lastClient.current = client
    const shown = client ?? lastClient.current

    const name = shown?.clientCompany || 'N/A'
    const isActive = shown?.status === 'active'
    const modules = (shown?.services || []).map((s) => s.service).filter(Boolean)
    const namedContacts = shown?.contactPersons?.filter((p) => p.name?.trim()).length || 0

    return (
        <Drawer
            open={open && Boolean(client)}
            onClose={onClose}
            width="lg"
            title={
                <span className="flex items-center gap-3 min-w-0">
                    {shown?.clientLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shown.clientLogo} alt="" className="w-10 h-10 rounded-tile object-cover flex-shrink-0 border border-hairline" />
                    ) : (
                        <span className={`w-10 h-10 rounded-tile flex items-center justify-center text-md font-semibold flex-shrink-0 ${avatarTone(name)}`}>
                            {name.charAt(0).toUpperCase() || 'C'}
                        </span>
                    )}
                    <span className="min-w-0">
                        <span className="block text-lg font-semibold text-heading truncate">{name}</span>
                        <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <StatusPill tone={isActive ? 'success' : 'neutral'} dot className="capitalize">{shown?.status}</StatusPill>
                            {shown?.type?.map((t) => <StatusPill key={t} tone="brand">{TYPE_LABEL[t]}</StatusPill>)}
                        </span>
                    </span>
                </span>
            }
            footer={
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
            }
        >
            {shown && (
                <div className="space-y-5">
                    {/* Quick actions */}
                    {(gatedEdit || gatedToggle || gatedDelete) && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {gatedEdit && (
                                <button type="button" onClick={() => gatedEdit(shown._id)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150">
                                    <Pencil size={14} /> Edit
                                </button>
                            )}
                            {gatedToggle && (
                                <button type="button" onClick={() => gatedToggle(shown)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150">
                                    <Power size={14} className={isActive ? undefined : 'text-success-700'} /> {isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            )}
                            {gatedDelete && (
                                <button type="button" onClick={() => gatedDelete(shown._id)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-danger-700 hover:bg-danger-50 hover:border-danger-500/30 transition-colors duration-150">
                                    <Trash2 size={14} /> Delete
                                </button>
                            )}
                        </div>
                    )}

                    {/* Usage summary */}
                    <section>
                        <div className="grid grid-cols-3 gap-3">
                            <UsageTile label="Contacts" value={namedContacts} />
                            <UsageTile label="Modules" value={modules.length} />
                            <UsageTile label="Type" value={shown.type?.length ? shown.type.map((t) => TYPE_LABEL[t]).join(', ') : '—'} />
                        </div>
                    </section>

                    {/* Base details */}
                    <section>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2 flex items-center gap-1.5"><Building size={12} /> Organization</p>
                        <div className="rounded-tile border border-hairline bg-surface overflow-hidden shadow-xs">
                            <DetailRow label="Client name" value={shown.clientCompany || '—'} />
                            <DetailRow label="Business model" value={businessModelLabel(shown.businessModel)} />
                            <DetailRow label="Status" value={isActive ? 'Active' : 'Inactive'} />
                            <DetailRow label="Address" value={shown.clientAddress || '—'} />
                            <DetailRow label="Created by" value={shown.createdBy || '—'} />
                            <DetailRow label="Created on" value={fmtDate(shown.createdAt)} />
                            <DetailRow label="Last updated" value={fmtDate(shown.updatedAt)} />
                            <div className="px-4 py-2.5">
                                <span className="text-xs text-subtle block mb-1.5">Description</span>
                                {shown.description && shown.description.replace(/<[^>]*>/g, '').trim() ? (
                                    <div
                                        className="prose prose-sm max-w-none text-sm text-body leading-relaxed [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                        dangerouslySetInnerHTML={{ __html: shown.description }}
                                    />
                                ) : (
                                    <span className="text-sm text-body">—</span>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Enabled modules / services */}
                    <section>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2 flex items-center gap-1.5"><Box size={12} /> Enabled modules ({modules.length})</p>
                        {modules.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                {(shown.services || []).map((s, i) => (
                                    <span key={`${s.service}-${i}`} className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-chip bg-info-50 text-info-700 text-2xs font-medium">
                                        {s.service}{s.year ? <span className="text-info-700/70 tabular-nums">· {s.year}</span> : null}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-subtle">No modules mapped yet — configure them in Service Mapping.</p>
                        )}
                    </section>

                    {/* Contacts */}
                    <section>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-2 flex items-center gap-1.5"><User size={12} /> Contacts ({shown.contactPersons?.length || 0})</p>
                        <div className="space-y-2">
                            {shown.contactPersons?.length ? (
                                orderedContacts(shown.contactPersons).map((c, i) => (
                                    <div key={i} className="rounded-tile border border-hairline bg-surface px-4 py-3 shadow-xs flex items-start gap-3">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 ${avatarTone(c.name || 'N/A')}`}>
                                            {(c.name || 'N').charAt(0).toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-heading truncate">{c.name || '—'}</span>
                                                {c.isPrimary && <StatusPill tone="success" dot>Primary</StatusPill>}
                                            </div>
                                            <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-subtle">
                                                <span className="inline-flex items-center gap-1.5 min-w-0"><Mail size={12} className="text-faint flex-shrink-0" /><span className="truncate">{c.email || '—'}</span></span>
                                                <span className="inline-flex items-center gap-1.5"><Phone size={12} className="text-faint flex-shrink-0" />{c.phoneNumber || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-subtle px-1">No contacts.</div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </Drawer>
    )
}
