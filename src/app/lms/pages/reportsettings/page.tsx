"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    ArrowLeft, Check, Copy, FileCog, Image as ImageIcon, Loader2, Pencil, Plus, Save, Stamp, Trash2, Type,
} from 'lucide-react'
import DashboardLayout from '@/app/lms/component/layout'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pageEnter } from '@/app/lms/shared/ui'
import { toast } from 'sonner'
import { useClients } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import ReportCanvas from './components/ReportCanvas'
import {
    fetchReportSettings, letterheadElements, newElement, newFormat, saveReportSettings, PAPER_MM,
    type Align, type ElementKind, type Orientation, type PaperSize,
    type ReportElement, type ReportFormat,
} from './api/reportSettingsService'

/* System Settings ▸ Report Settings.
 *
 * Opens on the LIST — every report setting, and which clients each covers —
 * because most visits are "which design does this client get?" rather than
 * "let me redraw a page". Edit opens the canvas for one setting; Back returns.
 *
 * ONE setting is in use at a time and it applies to every report — a report
 * routinely spans several clients, so a per-client letterhead has no answer for
 * the common case. The others are alternatives kept on the shelf; "Use this"
 * switches which one reports print on.
 *
 * Clients can still be listed against a setting as a note of who it was drawn
 * for; that grouping does not pick the design at export time.
 */

const ALIGNS: Align[] = ['left', 'center', 'right']

const ADDABLE: { kind: ElementKind; label: string }[] = [
    { kind: 'text', label: 'Text' },
    { kind: 'logo', label: 'Logo' },
    { kind: 'line', label: 'Line' },
    { kind: 'watermark', label: 'Watermark' },
    { kind: 'signature', label: 'Signature' },
    { kind: 'pageNumber', label: 'Page number' },
    { kind: 'table', label: 'Table' },
]

const inputClass = 'mt-1 h-8 w-full rounded-control border border-hairline-strong bg-surface px-2 text-xs text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block min-w-0">
            <span className="text-[11px] font-medium text-subtle">{label}</span>
            {children}
            {hint && <span className="mt-0.5 block text-[10px] text-faint">{hint}</span>}
        </label>
    )
}

export default function ReportSettingsPage() {
    const [institutionId, setInstitutionId] = useState<string | null>(null)
    const [formats, setFormats] = useState<ReportFormat[]>([])
    /** Which setting the canvas is editing. null = the list. */
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    /** The "add a setting" dialog: a name and the clients it covers. */
    const [draft, setDraft] = useState<null | { name: string; clients: string[] }>(null)
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

    useEffect(() => { setInstitutionId(localStorage.getItem('smartcliff_institution')) }, [])

    const { data: clientsData } = useClients()
    const clients = useMemo(
        () => (clientsData || []).map((client) => ({ id: String(client._id), name: client.clientCompany || 'Unnamed client' })),
        [clientsData],
    )
    const nameOf = useCallback(
        (id: string) => clients.find((client) => client.id === id)?.name || 'Unknown client',
        [clients],
    )

    useEffect(() => {
        if (!institutionId) return
        let cancelled = false
        setLoading(true)
        fetchReportSettings(institutionId)
            .then((settings) => {
                if (cancelled) return
                setFormats(settings.formats?.length ? settings.formats : [newFormat('Default setting', true)])
                setDirty(false)
            })
            .catch(() => { if (!cancelled) toast.error('Could not load report settings') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [institutionId])

    const active = editingIndex === null ? null : formats[editingIndex]
    const selected = active?.elements.find((element) => element.id === selectedId) || null

    const mutate = useCallback((fn: (format: ReportFormat) => ReportFormat) => {
        setFormats((current) => current.map((format, index) => (index === editingIndex ? fn(format) : format)))
        setDirty(true)
    }, [editingIndex])

    /** Patch one element. The canvas calls this on every pointermove, so it
     *  touches only the element that moved and leaves the rest identical. */
    const patchElement = useCallback((id: string, patch: Partial<ReportElement>) => {
        mutate((format) => ({
            ...format,
            elements: format.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
        }))
    }, [mutate])

    /* Put the setting back to the standard letterhead.
     *
     * A new setting is BORN with it, so this is for the ones that predate it or
     * have been rearranged past rescuing. It replaces the elements wholesale
     * rather than merging — a half-applied letterhead, with the old header left
     * behind under the new one, is worse than either. Everything else about the
     * setting (its name, its clients, whether it is in use, the paper) is left
     * alone, and nothing reaches the server until Save. */
    const [confirmLetterhead, setConfirmLetterhead] = useState(false)

    const resetToLetterhead = () => {
        mutate((format) => ({ ...format, elements: letterheadElements() }))
        setSelectedId(null)
        setConfirmLetterhead(false)
        toast.success('Letterhead applied — Save to keep it')
    }

    const addElement = (kind: ElementKind) => {
        if (kind === 'table' && active?.elements.some((element) => element.kind === 'table')) {
            toast.info('The page already has a table — a report has one.')
            return
        }
        const id = `${kind}-${Date.now().toString(36)}`
        mutate((format) => ({ ...format, elements: [...format.elements, newElement(kind, id)] }))
        setSelectedId(id)
    }

    const removeElement = () => {
        if (!selected) return
        if (selected.kind === 'table') { toast.info('The table is the report — it cannot be removed.'); return }
        mutate((format) => ({ ...format, elements: format.elements.filter((element) => element.id !== selected.id) }))
        setSelectedId(null)
    }

    const duplicateElement = () => {
        if (!selected || selected.kind === 'table') return
        const id = `${selected.kind}-${Date.now().toString(36)}`
        mutate((format) => ({
            ...format,
            elements: [...format.elements, { ...selected, id, x: Math.min(95, selected.x + 3), y: Math.min(95, selected.y + 3) }],
        }))
        setSelectedId(id)
    }

    const onLogoPicked = (file: File | undefined) => {
        if (!file || !selected) return
        // ~1 MB. The image rides inside the settings document, whose 16 MB
        // ceiling is shared with every other design.
        if (file.size > 1_000_000) { toast.error('That image is too large — use one under 1 MB'); return }
        const reader = new FileReader()
        reader.onload = () => patchElement(selected.id, { dataUrl: String(reader.result || '') })
        reader.onerror = () => toast.error('Could not read that image')
        reader.readAsDataURL(file)
    }

    /** Create from the dialog. Clients claimed here are taken off whichever
     *  setting had them — one client, one design, or an export would have to
     *  pick between two and nobody could see which won. */
    const createSetting = () => {
        if (!draft) return
        const claimed = new Set(draft.clients)
        const created = { ...newFormat(draft.name.trim() || 'Report setting'), clients: draft.clients }
        setFormats((current) => [
            ...current.map((format) => ({ ...format, clients: format.clients.filter((id) => !claimed.has(id)) })),
            created,
        ])
        setEditingIndex(formats.length)
        setSelectedId(null)
        setDraft(null)
        setDirty(true)
    }

    /** Make one setting the one reports print on. Exactly one is active, so
     *  the others are cleared in the same pass — two actives would resolve by
     *  array order, which nobody can see. */
    const applySetting = (index: number) => {
        setFormats((current) => current.map((format, i) => ({ ...format, isDefault: i === index })))
        setDirty(true)
        toast.success(`“${formats[index]?.name}” now applies to every report`)
    }

    const deleteSetting = (index: number) => {
        if (formats[index]?.isDefault) return
        setFormats((current) => current.filter((_, i) => i !== index))
        setConfirmDelete(null)
        setEditingIndex(null)
        setDirty(true)
    }

    const toggleClient = (clientId: string) => {
        setFormats((current) => current.map((format, index) => {
            if (index === editingIndex) {
                const has = format.clients.includes(clientId)
                return { ...format, clients: has ? format.clients.filter((id) => id !== clientId) : [...format.clients, clientId] }
            }
            return { ...format, clients: format.clients.filter((id) => id !== clientId) }
        }))
        setDirty(true)
    }

    const save = async () => {
        if (!institutionId || saving) return
        setSaving(true)
        try {
            const saved = await saveReportSettings(institutionId, formats)
            setFormats(saved.formats || formats)
            setDirty(false)
            toast.success('Report settings saved')
        } catch (error) {
            const message = (error as { response?: { data?: { message?: { value?: string }[] } } })
                ?.response?.data?.message?.[0]?.value
            toast.error(message || 'Could not save report settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <DashboardLayout>
            <motion.div variants={pageEnter} initial="hidden" animate="visible" className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14 sm:px-6 md:px-8 md:pt-3">

                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            {active && (
                                <Button type="button" variant="outline" size="sm" className="text-xs"
                                    onClick={() => { setEditingIndex(null); setSelectedId(null) }}>
                                    <ArrowLeft className="size-3.5" />Back
                                </Button>
                            )}
                            <div className="min-w-0">
                                <h1 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-heading sm:text-base">
                                    <FileCog className="size-4 shrink-0 text-brand-strong" />
                                    {active ? active.name : 'Report Settings'}
                                </h1>
                                <p className="mt-0.5 truncate text-xs text-subtle">
                                    {active
                                        ? 'Drag the pieces where you want them. This is the page a report prints on.'
                                        : 'The page layout each client’s reports print on.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {dirty && <span className="text-[11px] font-medium text-warn-700">Unsaved changes</span>}
                            {!active && (
                                <Button type="button" variant="outline" size="sm" className="text-xs"
                                    onClick={() => setDraft({ name: '', clients: [] })}>
                                    <Plus className="size-3.5" />Add report setting
                                </Button>
                            )}
                            <Button type="button" size="sm" className="text-xs font-bold" disabled={!dirty || saving} onClick={() => void save()}>
                                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div role="status" aria-label="Loading report settings" className="mt-4 flex-1 animate-pulse rounded-xl bg-ink-100" />

                    ) : !active ? (
                        /* ── The list ─────────────────────────────────────── */
                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                            <div className="max-w-full overflow-x-auto rounded-xl border border-hairline bg-white">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            {['S. No.', 'Report setting', 'In use', 'Drawn for', 'Page', ''].map((header, index) => (
                                                <th key={header || 'actions'}
                                                    className="border-b border-hairline bg-canvas/60 px-3 py-2 text-left font-semibold text-subtle"
                                                    style={index === 0 ? { width: 64 } : index === 5 ? { width: 210 } : undefined}>
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formats.map((format, index) => (
                                            <tr key={`${format.name}-${index}`} className="border-b border-hairline/60 last:border-0 hover:bg-row-hover">
                                                <td className="px-3 py-2.5 align-top tabular-nums text-subtle">{index + 1}</td>
                                                <td className="px-3 py-2.5 align-top font-medium text-heading">{format.name}</td>
                                                <td className="px-3 py-2.5 align-top">
                                                    {format.isDefault ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                                                            <Check className="size-3" />Applied to all reports
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-faint">Not in use</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 align-top">
                                                    {format.clients.length === 0 ? (
                                                        <span className="text-[11px] text-faint">—</span>
                                                    ) : (
                                                        <span className="flex flex-wrap gap-1">
                                                            {format.clients.map((id) => (
                                                                <span key={id} className="inline-flex max-w-[200px] truncate rounded-full border border-hairline bg-canvas/60 px-2 py-0.5 text-[11px] text-body">
                                                                    {nameOf(id)}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 align-top text-subtle">
                                                    {PAPER_MM[format.page.size].label} · {format.page.orientation}
                                                </td>
                                                <td className="px-3 py-2.5 align-top">
                                                    <span className="flex items-center justify-end gap-1.5">
                                                        {!format.isDefault && (
                                                            <Button type="button" variant="outline" size="sm" className="text-[11px]"
                                                                onClick={() => applySetting(index)}>
                                                                <Check className="size-3" />Use this
                                                            </Button>
                                                        )}
                                                        <Button type="button" variant="outline" size="sm" className="text-[11px]"
                                                            onClick={() => { setEditingIndex(index); setSelectedId(null) }}>
                                                            <Pencil className="size-3" />Edit
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm"
                                                            className="text-[11px] text-danger-700 disabled:opacity-40"
                                                            disabled={format.isDefault}
                                                            title={format.isDefault ? 'This is the setting reports print on — switch to another first' : undefined}
                                                            onClick={() => setConfirmDelete(index)}>
                                                            <Trash2 className="size-3" />Delete
                                                        </Button>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-2 text-[11px] text-subtle">
                                Every report prints on the setting marked <span className="font-semibold text-heading">Applied to all reports</span>.
                                The rest are alternatives — press <span className="font-semibold text-heading">Use this</span> to switch.
                            </p>
                        </div>

                    ) : (
                        /* ── The editor ───────────────────────────────────── */
                        <div className="mt-3 grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_268px]">
                            <div className="flex min-h-0 min-w-0 flex-col gap-2">
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-hairline bg-white p-2">
                                    <span className="px-1 text-[11px] font-medium text-subtle">Add</span>
                                    {ADDABLE.map(({ kind, label }) => (
                                        <Button key={kind} type="button" variant="outline" size="sm" className="text-[11px]"
                                            onClick={() => addElement(kind)}>
                                            {kind === 'logo' ? <ImageIcon className="size-3.5" /> : <Type className="size-3.5" />}
                                            {label}
                                        </Button>
                                    ))}
                                    <span className="ml-auto flex items-center gap-1.5">
                                        <Button type="button" variant="outline" size="sm" className="text-[11px]" onClick={() => setConfirmLetterhead(true)}>
                                            <Stamp className="size-3.5" />Letterhead
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="text-[11px]" disabled={!selected || selected.kind === 'table'} onClick={duplicateElement}>
                                            <Copy className="size-3.5" />Duplicate
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="text-[11px] text-danger-700" disabled={!selected || selected.kind === 'table'} onClick={removeElement}>
                                            <Trash2 className="size-3.5" />Delete
                                        </Button>
                                    </span>
                                </div>

                                <div className="min-h-[340px] flex-1">
                                    <ReportCanvas format={active} selectedId={selectedId} onSelect={setSelectedId} onChange={patchElement} />
                                </div>
                            </div>

                            <aside className="min-h-0 space-y-3 overflow-y-auto rounded-xl border border-hairline bg-white p-3">
                                <div>
                                    <Field label="Setting name">
                                        <input value={active.name} className={inputClass}
                                            onChange={(event) => mutate((format) => ({ ...format, name: event.target.value }))} />
                                    </Field>
                                    {active.isDefault ? (
                                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 text-[10.5px] font-semibold text-brand-strong">
                                            <Check className="size-3" />Applied to all reports
                                        </p>
                                    ) : (
                                        <>
                                            <p className="mt-2 text-[11px] font-medium text-subtle">
                                                Drawn for ({active.clients.length} of {clients.length}) — a note, not a rule
                                            </p>
                                            <div className="mt-1.5 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                                                {clients.map((client) => {
                                                    const mine = active.clients.includes(client.id)
                                                    const takenBy = formats.find((format, index) => index !== editingIndex && format.clients.includes(client.id))
                                                    return (
                                                        <button key={client.id} type="button" onClick={() => toggleClient(client.id)}
                                                            title={takenBy ? `On “${takenBy.name}” — selecting moves it here` : undefined}
                                                            className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[10.5px] transition-colors ${mine
                                                                ? 'border-brand-500/40 bg-brand-wash font-semibold text-brand-strong'
                                                                : takenBy
                                                                    ? 'border-hairline bg-canvas/60 text-faint hover:text-body'
                                                                    : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'}`}>
                                                            {client.name}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="border-t border-hairline pt-3">
                                    <h2 className="text-xs font-semibold text-heading">Paper</h2>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <Field label="Size">
                                            <select value={active.page.size} className={inputClass}
                                                onChange={(event) => mutate((format) => ({ ...format, page: { ...format.page, size: event.target.value as PaperSize } }))}>
                                                {(Object.keys(PAPER_MM) as PaperSize[]).map((size) => (
                                                    <option key={size} value={size}>{PAPER_MM[size].label}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Orientation">
                                            <select value={active.page.orientation} className={inputClass}
                                                onChange={(event) => mutate((format) => ({ ...format, page: { ...format.page, orientation: event.target.value as Orientation } }))}>
                                                <option value="landscape">Landscape</option>
                                                <option value="portrait">Portrait</option>
                                            </select>
                                        </Field>
                                    </div>
                                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                                        {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((key) => (
                                            <Field key={key} label={key.replace('margin', '').slice(0, 3)}>
                                                <input type="number" min={0} max={50} value={active.page[key]} className={inputClass}
                                                    onChange={(event) => mutate((format) => ({ ...format, page: { ...format.page, [key]: Number(event.target.value) } }))} />
                                            </Field>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-[10px] text-faint">Margins in mm — the dashed guide.</p>
                                </div>

                                <div className="border-t border-hairline pt-3">
                                    <h2 className="text-xs font-semibold text-heading">
                                        {selected ? `Selected: ${selected.kind}` : 'Nothing selected'}
                                    </h2>
                                    {!selected ? (
                                        <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">
                                            Click a piece on the page to edit it, or add one from the toolbar.
                                        </p>
                                    ) : (
                                        <div className="mt-2 space-y-2.5">
                                            {selected.kind === 'logo' ? (
                                                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-hairline-strong px-2.5 py-1.5 text-[11px] font-medium text-body hover:bg-row-hover">
                                                    <ImageIcon className="size-3.5" />
                                                    {selected.dataUrl ? 'Replace image' : 'Upload image'}
                                                    <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
                                                        onChange={(event) => onLogoPicked(event.target.files?.[0])} />
                                                </label>
                                            ) : selected.kind !== 'table' && selected.kind !== 'line' && (
                                                <Field label="Text">
                                                    <input value={selected.text} className={inputClass}
                                                        onChange={(event) => patchElement(selected.id, { text: event.target.value })} />
                                                </Field>
                                            )}

                                            {selected.kind !== 'table' && selected.kind !== 'logo' && selected.kind !== 'line' && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Field label="Font size" hint="pt">
                                                            <input type="number" min={5} max={96} value={selected.fontSize} className={inputClass}
                                                                onChange={(event) => patchElement(selected.id, { fontSize: Number(event.target.value) })} />
                                                        </Field>
                                                        <Field label="Colour">
                                                            <input type="color" value={selected.color}
                                                                className="mt-1 h-8 w-full cursor-pointer rounded-control border border-hairline-strong bg-surface px-1"
                                                                onChange={(event) => patchElement(selected.id, { color: event.target.value })} />
                                                        </Field>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="inline-flex overflow-hidden rounded-control border border-hairline-strong">
                                                            {ALIGNS.map((align) => (
                                                                <button key={align} type="button" onClick={() => patchElement(selected.id, { align })}
                                                                    className={`px-2 py-1 text-[10.5px] capitalize ${selected.align === align ? 'bg-brand-wash font-semibold text-brand-strong' : 'text-subtle hover:bg-row-hover'}`}>
                                                                    {align}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button type="button" onClick={() => patchElement(selected.id, { bold: !selected.bold })}
                                                            className={`rounded-control border px-2 py-1 text-[11px] font-bold ${selected.bold ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-hairline-strong text-subtle hover:bg-row-hover'}`}>B</button>
                                                        <button type="button" onClick={() => patchElement(selected.id, { italic: !selected.italic })}
                                                            className={`rounded-control border px-2 py-1 text-[11px] italic ${selected.italic ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-hairline-strong text-subtle hover:bg-row-hover'}`}>I</button>
                                                    </div>
                                                </>
                                            )}

                                            {selected.kind === 'line' && (
                                                <Field label="Colour">
                                                    <input type="color" value={selected.color}
                                                        className="mt-1 h-8 w-full cursor-pointer rounded-control border border-hairline-strong bg-surface px-1"
                                                        onChange={(event) => patchElement(selected.id, { color: event.target.value })} />
                                                </Field>
                                            )}

                                            <div className="grid grid-cols-2 gap-2">
                                                <Field label="Opacity" hint={`${Math.round(selected.opacity * 100)}%`}>
                                                    <input type="range" min={2} max={100} value={Math.round(selected.opacity * 100)}
                                                        className="mt-2 w-full accent-[var(--color-brand-strong,#c2410c)]"
                                                        onChange={(event) => patchElement(selected.id, { opacity: Number(event.target.value) / 100 })} />
                                                </Field>
                                                <Field label="Rotation" hint={`${selected.rotation}°`}>
                                                    <input type="range" min={-90} max={90} value={selected.rotation}
                                                        className="mt-2 w-full accent-[var(--color-brand-strong,#c2410c)]"
                                                        onChange={(event) => patchElement(selected.id, { rotation: Number(event.target.value) })} />
                                                </Field>
                                            </div>

                                            <div className="grid grid-cols-4 gap-1.5">
                                                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                                                    <Field key={key} label={key.toUpperCase()}>
                                                        <input type="number" step={0.1} value={Math.round(selected[key] * 10) / 10} className={inputClass}
                                                            onChange={(event) => patchElement(selected.id, { [key]: Number(event.target.value) })} />
                                                    </Field>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-faint">Position and size, as a percentage of the page.</p>

                                            <label className="flex items-center gap-2 text-[11px] text-body">
                                                <Switch checked={selected.everyPage} className="scale-75"
                                                    onCheckedChange={(on) => patchElement(selected.id, { everyPage: on })}
                                                    aria-label="Repeat on every page" />
                                                Repeat on every page
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Add a report setting: name it, say who it is for ─────────── */}
            {draft && (
                <Dialog open onOpenChange={(open) => { if (!open) setDraft(null) }}>
                    <DialogContent className="flex max-h-[86dvh] w-[92vw] max-w-md flex-col gap-0 overflow-hidden p-0">
                        <DialogHeader className="shrink-0 border-b border-hairline px-5 py-3.5 text-left">
                            <DialogTitle className="text-base">New report setting</DialogTitle>
                            <DialogDescription className="mt-1 text-xs">
                                Name it. Listing clients is optional — a note of who it was drawn for; every
                                report prints on whichever setting is in use.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            <Field label="Setting name">
                                <input autoFocus value={draft.name} placeholder="e.g. Government clients" className={inputClass}
                                    onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                            </Field>
                            <div className="mt-3 flex items-baseline justify-between gap-2">
                                <span className="text-[11px] font-medium text-subtle">
                                    Clients ({draft.clients.length} selected)
                                </span>
                                <button type="button" className="text-[11px] font-semibold text-brand-strong hover:underline"
                                    onClick={() => setDraft({ ...draft, clients: draft.clients.length === clients.length ? [] : clients.map((c) => c.id) })}>
                                    {draft.clients.length === clients.length ? 'Clear all' : 'Select all'}
                                </button>
                            </div>
                            <div className="mt-1.5 space-y-1">
                                {clients.map((client) => {
                                    const checked = draft.clients.includes(client.id)
                                    const takenBy = formats.find((format) => format.clients.includes(client.id))
                                    return (
                                        <label key={client.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-2.5 py-1.5 hover:bg-row-hover">
                                            <input type="checkbox" checked={checked}
                                                className="size-4 accent-[var(--color-brand-strong,#c2410c)]"
                                                onChange={(event) => setDraft({
                                                    ...draft,
                                                    clients: event.target.checked
                                                        ? [...draft.clients, client.id]
                                                        : draft.clients.filter((id) => id !== client.id),
                                                })} />
                                            <span className="min-w-0 flex-1 truncate text-xs text-heading">{client.name}</span>
                                            {takenBy && (
                                                <span className="shrink-0 text-[10px] text-faint" title="Selecting moves it to the new setting">
                                                    on {takenBy.name}
                                                </span>
                                            )}
                                        </label>
                                    )
                                })}
                                {clients.length === 0 && <p className="py-4 text-center text-xs text-subtle">No clients yet.</p>}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline px-5 py-3">
                            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setDraft(null)}>Cancel</Button>
                            <Button type="button" size="sm" className="text-xs" onClick={createSetting}>
                                <Plus className="size-3.5" />Create &amp; design
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Letterhead confirmation ─────────────────────────────────── */}
            {confirmLetterhead && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmLetterhead(false) }}>
                    <DialogContent className="w-[92vw] max-w-sm">
                        <DialogHeader className="text-left">
                            <DialogTitle className="text-base">Apply the standard letterhead?</DialogTitle>
                            <DialogDescription className="mt-1 text-xs">
                                Everything currently on the page is replaced by the masthead, rules, table,
                                watermark and sign-off. The setting keeps its name, its clients and its paper,
                                and nothing is saved until you press Save.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setConfirmLetterhead(false)}>Cancel</Button>
                            <Button type="button" size="sm" className="text-xs" onClick={resetToLetterhead}>
                                <Stamp className="size-3.5" />Apply
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Delete confirmation ─────────────────────────────────────── */}
            {confirmDelete !== null && formats[confirmDelete] && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
                    <DialogContent className="w-[92vw] max-w-sm">
                        <DialogHeader className="text-left">
                            <DialogTitle className="text-base">Delete this report setting?</DialogTitle>
                            <DialogDescription className="mt-1 text-xs">
                                “{formats[confirmDelete].name}” will be removed. It is not the setting reports
                                currently print on, so nothing that is exported will change.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                            <Button type="button" size="sm" className="bg-danger-600 text-xs hover:bg-danger-700" onClick={() => deleteSetting(confirmDelete)}>
                                <Trash2 className="size-3.5" />Delete
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    )
}
