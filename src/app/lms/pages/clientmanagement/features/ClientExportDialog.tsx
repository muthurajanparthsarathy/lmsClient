"use client"

import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fetchClientsForExport, type Client, type ClientPageFilters } from '../api/clientManagementService'
import { EXPORT_FIELDS, exportCell, outputClients, type ExportField, type ExportFormat } from './clientExport'
import { notify } from './lib'
import { useModalBlink } from '@/app/lms/shared/ui/useModalBlink'

const PAGE_SIZE = 10

export default function ClientExportDialog({ filters, initialFormat, onClose }: {
    filters: ClientPageFilters
    initialFormat: ExportFormat
    onClose: () => void
}) {
    // Shares the kit Modal's blink so both overlays on this page refuse an
    // outside click the same way, despite sitting on different dialog bases.
    const { ref: blinkRef, blink } = useModalBlink<HTMLDivElement>()
    const [step, setStep] = useState(1)
    const format = initialFormat
    const [fields, setFields] = useState<ExportField[]>(EXPORT_FIELDS.map((field) => field.key))
    const [rows, setRows] = useState<Client[] | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [page, setPage] = useState(1)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [busy, setBusy] = useState(false)
    const columns = EXPORT_FIELDS.filter((field) => fields.includes(field.key))

    useEffect(() => {
        if (step !== 2 || rows !== null) return
        const controller = new AbortController()
        setError('')
        fetchClientsForExport(filters, controller.signal).then((data) => {
            if (controller.signal.aborted) return
            setRows(data)
            setSelected(new Set(data.map((row) => row._id)))
        }).catch(() => {
            if (!controller.signal.aborted) setError('Could not load clients. Please try again.')
        })
        return () => controller.abort()
    }, [step, rows, filters, attempt])

    const selectedRows = useMemo(() => (rows || []).filter((row) => selected.has(row._id)), [rows, selected])
    const serials = useMemo(() => new Map(selectedRows.map((row, index) => [row._id, index])), [selectedRows])
    const pages = Math.max(1, Math.ceil((rows?.length || 0) / PAGE_SIZE))
    const visibleRows = rows?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || []
    const toggle = (id: string) => setSelected((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const finish = async (target: ExportFormat) => {
        if (busy || !selectedRows.length || !columns.length) return
        setBusy(true)
        try {
            await outputClients(target, selectedRows, fields)
            notify.success(target === 'print' ? 'Print preview opened' : `Exported ${selectedRows.length} clients`)
        } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Export failed. Please try again.')
        } finally { setBusy(false) }
    }

    return (
        <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
            <DialogContent
                ref={blinkRef}
                className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
                showCloseButton={!busy}
                // An overlay click never closes this dialog — a mis-click after
                // picking fields and rows would cost all of that work. It blinks
                // instead; Escape and the X (hidden mid-export) still close it.
                onPointerDownOutside={(event) => { event.preventDefault(); blink() }}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 text-left sm:px-6">
                    <DialogTitle>{format === 'print' ? 'Print clients' : `Export clients as ${format.toUpperCase()}`}</DialogTitle>
                    <DialogDescription>Choose the fields, then select the clients to include.</DialogDescription>
                    <ol aria-label="Export progress" className="!mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                        {['Choose fields', 'Select data'].map((label, index) => (
                            <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`flex items-center gap-2 ${step === index + 1 ? 'font-semibold text-brand-strong' : 'text-subtle'}`}>
                                <span className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] ${step >= index + 1 ? 'bg-brand-wash text-brand-strong' : 'bg-ink-100'}`}>{step > index + 1 ? <Check className="size-3" /> : index + 1}</span>{label}
                            </li>
                        ))}
                    </ol>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
                    {step === 1 && <>
                        <div className="mb-4 flex items-center justify-between gap-3 text-xs"><span className="text-subtle">{fields.length} of {EXPORT_FIELDS.length} fields selected</span><button type="button" className="font-medium text-brand-strong" onClick={() => setFields(fields.length === EXPORT_FIELDS.length ? [] : EXPORT_FIELDS.map((field) => field.key))}>{fields.length === EXPORT_FIELDS.length ? 'Clear all' : 'Select all fields'}</button></div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {EXPORT_FIELDS.map((field) => <label key={field.key} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm ${fields.includes(field.key) ? 'border-brand-500/30 bg-brand-wash text-brand-strong' : 'border-hairline text-body'}`}>
                                <input type="checkbox" checked={fields.includes(field.key)} onChange={() => setFields((current) => current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key])} className="size-4 accent-orange-700" />{field.label}
                            </label>)}
                        </div>
                        <p className="mt-4 text-xs text-subtle">Contact fields use each client’s primary contact. Created Date uses DD/MM/YYYY.</p>
                    </>}
                    {step === 2 && <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-subtle">{selected.size} of {rows?.length ?? '…'} clients selected · {columns.length} fields</span>
                            <div className="flex gap-4"><button type="button" disabled={!rows?.length || busy} onClick={() => setSelected(new Set(rows?.map((row) => row._id)))} className="font-medium text-brand-strong disabled:opacity-40">Select all clients</button><button type="button" disabled={!selected.size || busy} onClick={() => setSelected(new Set())} className="text-subtle disabled:opacity-40">Clear selection</button></div>
                        </div>
                        <p className="mb-3 text-xs text-subtle">Includes all clients matching your search and filters, across every page. Only checked rows will be included.</p>
                        {error ? <div role="alert" className="rounded-lg border border-hairline p-6 text-center text-sm">{error}<Button variant="outline" className="ml-3" onClick={() => setAttempt((value) => value + 1)}>Retry</Button></div>
                            : rows === null ? <div role="status" aria-label="Loading preview" className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded bg-ink-100" />)}</div>
                            : !rows.length ? <p className="py-10 text-center text-sm text-subtle">No clients match these filters. Close this window and adjust your filters.</p>
                            : <>
                                <div className="overflow-x-auto rounded-lg border border-hairline">
                                    <table className="w-full text-left text-xs"><thead className="bg-canvas text-subtle"><tr><th className="p-3"><input type="checkbox" aria-label="Select this preview page" disabled={busy} checked={visibleRows.length > 0 && visibleRows.every((row) => selected.has(row._id))} onChange={(event) => setSelected((current) => { const next = new Set(current); visibleRows.forEach((row) => { if (event.target.checked) next.add(row._id); else next.delete(row._id) }); return next })} className="size-4 accent-orange-700" /></th>{columns.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-3 font-medium">{field.label}</th>)}</tr></thead>
                                        <tbody>{visibleRows.map((row, index) => <tr key={row._id} className={`border-t border-hairline ${selected.has(row._id) ? 'bg-brand-wash/30' : ''}`}><td className="p-3"><input type="checkbox" aria-label={`Include ${row.clientCompany || `client ${(page - 1) * PAGE_SIZE + index + 1}`}`} disabled={busy} checked={selected.has(row._id)} onChange={() => toggle(row._id)} className="size-4 accent-orange-700" /></td>{columns.map((field) => <td key={field.key} className="min-w-24 max-w-64 break-words px-3 py-3 text-body">{field.key === 'serial' && !selected.has(row._id) ? '—' : exportCell(row, field.key, serials.get(row._id) ?? index)}</td>)}</tr>)}</tbody>
                                    </table>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle"><span>Page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1 || busy} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page === pages || busy} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
                            </>}
                    </>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-4 sm:px-6">
                    <Button variant="outline" disabled={busy} onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</Button>
                    {step === 1 ? <Button disabled={!fields.length} onClick={() => setStep(2)}>Next: select data</Button> : <div className="flex flex-wrap gap-2">
                        {format !== 'print' && <Button variant="outline" disabled={busy || !selected.size} onClick={() => finish('print')}><Printer className="size-4" />Print selected</Button>}
                        <Button disabled={busy || !selected.size} onClick={() => finish(format)}>{format === 'print' ? <Printer className="size-4" /> : <Download className="size-4" />}{busy ? 'Preparing…' : format === 'print' ? 'Print selected' : `Export ${format.toUpperCase()}`}</Button>
                    </div>}
                </div>
            </DialogContent>
        </Dialog>
    )
}
