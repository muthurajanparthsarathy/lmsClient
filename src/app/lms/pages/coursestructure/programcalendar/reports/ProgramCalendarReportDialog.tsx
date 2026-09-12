"use client"

import { useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getReportCellStyle, REPORT_GRID } from './calendarReportStyles'
import type { CalendarReportTable, ReportCell, ReportTableRow } from './calendarReportTable'
import {
    buildCalendarReport,
    DETAIL_OPTIONS,
    exportCalendarReport,
    HIERARCHY_OPTIONS,
    VIEW_OPTIONS,
    type CalendarDetailKey,
    type CalendarHierarchy,
    type CalendarReportSource,
    type CalendarReportView,
} from './programCalendarReport'

const checkboxItem = [
    'cursor-pointer py-2 text-xs data-[state=checked]:bg-brand-wash data-[state=checked]:text-brand-strong',
    '[&>span:first-child]:size-4 [&>span:first-child]:rounded-[4px] [&>span:first-child]:border [&>span:first-child]:border-hairline-strong [&>span:first-child]:bg-surface',
    '[&[data-state=checked]>span:first-child]:border-brand-700 [&[data-state=checked]>span:first-child]:bg-brand-700 [&[data-state=checked]>span:first-child]:text-white [&_svg]:size-3',
].join(' ')

function ReportMultiSelect<T extends string>({ label, options, value, onChange, emptyLabel, disabled }: {
    label: string
    options: readonly { value: T; label: string }[]
    value: readonly T[]
    onChange: (value: T[]) => void
    emptyLabel: string
    disabled: boolean
}) {
    const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label)
    const caption = selectedLabels.length > 1 ? `${selectedLabels.length} selected` : selectedLabels[0] || emptyLabel
    const labelId = useId()
    return <div className="min-w-0">
        <p id={labelId} className="mb-1 text-xs font-medium text-subtle">{label}</p>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" disabled={disabled} aria-labelledby={`${labelId} ${labelId}-selection`} title={selectedLabels.join(', ') || emptyLabel} className="inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-2.5 text-left text-xs text-body outline-none transition-colors hover:border-line-hover focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50">
                    <span id={`${labelId}-selection`} className="min-w-0 truncate">{caption}</span><ChevronDown className="size-3.5 shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl">
                <DropdownMenuLabel className="text-xs">{label} · select any</DropdownMenuLabel>
                {options.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={value.includes(option.value)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange(options.filter((item) => item.value === option.value ? checked : value.includes(item.value)).map((item) => item.value))} className={checkboxItem}>{option.label}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
}

function reportRowCount(table: CalendarReportTable) {
    return table.rows.filter((row) => row.kind !== 'total').length
}

function ReportTable({ table, caption }: { table: CalendarReportTable; caption: string }) {
    const totalWidth = table.columnWidths.reduce((sum, width) => sum + width, 0) || 1
    const renderCell = (cell: ReportCell, rowKind?: ReportTableRow['kind'], header = false) => {
        const style = getReportCellStyle(cell, rowKind)
        const Cell = header ? 'th' : 'td'
        return <Cell key={cell.column} scope={header ? (cell.colSpan && cell.colSpan > 1 ? 'colgroup' : 'col') : undefined} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={`whitespace-pre-line break-words px-2 align-middle sm:px-2.5 ${header && cell.secondary ? 'py-1.5 text-[11px]' : 'py-2'}`} style={{ backgroundColor: style.background, color: style.color, fontWeight: style.bold ? 600 : 400, textAlign: style.align, border: `${style.borderWidth}px solid ${style.borderColor}` }}>{cell.value}</Cell>
    }

    return <div role="region" aria-label={`${caption} table`} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand/20" style={{ borderColor: REPORT_GRID }}>
        <table className="w-full border-collapse text-xs leading-[1.55] tabular-nums" style={{ minWidth: Math.max(480, totalWidth * 7), tableLayout: 'fixed' }}>
            <caption className="sr-only">{caption}</caption>
            <colgroup>{table.columnWidths.map((width, index) => <col key={index} style={{ width: `${width / totalWidth * 100}%` }} />)}</colgroup>
            <thead>{table.headers.map((row, index) => <tr key={index}>{row.map((cell) => renderCell(cell, undefined, true))}</tr>)}</thead>
            <tbody>{table.rows.length ? table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.cells.map((cell) => renderCell(cell, row.kind))}</tr>) : <tr><td colSpan={Math.max(1, table.columnCount)} className="px-4 py-10 text-center text-slate-600" style={{ border: `1px solid ${REPORT_GRID}` }}>No scheduled sessions are available for this view.</td></tr>}</tbody>
        </table>
    </div>
}

type HierarchyChoice = CalendarHierarchy | 'summary'

export default function ProgramCalendarReportDialog({ source, initialView, onClose, batches = [], selectedBatch, onBatchChange, loading = false, metadataError, onRetryMetadata }: {
    source: CalendarReportSource
    initialView: CalendarReportView
    onClose: () => void
    batches?: { value: string; label: string }[]
    selectedBatch?: string
    onBatchChange?: (value: string) => void
    loading?: boolean
    metadataError?: string
    onRetryMetadata?: () => void
}) {
    const [views, setViews] = useState<CalendarReportView[]>([initialView])
    const [hierarchy, setHierarchy] = useState<CalendarHierarchy[]>(source.hierarchy)
    const [details, setDetails] = useState<CalendarDetailKey[]>(['courseName', 'courseId', 'clientName'])
    const [includeSummary, setIncludeSummary] = useState(false)
    const [includeDeviations, setIncludeDeviations] = useState(false)
    const [previewView, setPreviewView] = useState<CalendarReportView>(initialView)
    const [exporting, setExporting] = useState<'excel' | 'pdf' | 'print' | null>(null)
    const [error, setError] = useState('')
    const exportLock = useRef(false)
    const deviationRadioName = useId()
    const hasActual = views.includes('actual') || views.includes('comparison')
    const availableHierarchy = HIERARCHY_OPTIONS.filter((option) => source.hierarchy.includes(option.value))
    const hierarchyOptions: { value: HierarchyChoice; label: string }[] = [...availableHierarchy, { value: 'summary', label: 'Summary' }]
    const selectedHierarchy: HierarchyChoice[] = [...hierarchy.filter((value) => source.hierarchy.includes(value)), ...(includeSummary ? ['summary' as const] : [])]
    const sections = useMemo(() => buildCalendarReport(source, {
        views,
        hierarchy: hierarchy.filter((value) => source.hierarchy.includes(value)),
        details,
        includeSummary,
        includeDeviations: hasActual && includeDeviations,
    }), [source, views, hierarchy, details, includeSummary, includeDeviations, hasActual])
    const activePreview = views.includes(previewView) ? previewView : views[0]
    const canExport = !exporting && !loading && sections.some((section) => reportRowCount(section.table) > 0)

    const output = async (format: 'excel' | 'pdf' | 'print') => {
        if (exportLock.current || !canExport) return
        exportLock.current = true
        setExporting(format)
        setError('')
        const course = source.details.courseId || source.details.courseName || 'report'
        const filename = `program-calendar-${course.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}-${new Date().toISOString().slice(0, 10)}`
        try {
            await exportCalendarReport(format, sections, filename)
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Could not export the calendar report. Please try again.')
        } finally {
            exportLock.current = false
            setExporting(null)
        }
    }

    return <Dialog open onOpenChange={(open) => { if (!open && !exportLock.current) onClose() }}>
        <DialogContent showCloseButton={!exporting} onEscapeKeyDown={(event) => { if (exportLock.current) event.preventDefault() }} onInteractOutside={(event) => { if (exportLock.current) event.preventDefault() }} className="flex h-[92dvh] max-h-[94dvh] w-[98vw] max-w-[1600px] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 gap-3 border-b border-hairline py-3 pl-4 pr-12 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 shrink-0 text-brand-strong" />Program calendar report</DialogTitle>
                    <DialogDescription className="mt-1 text-xs">Choose your calendar views and the details to include.</DialogDescription>
                </div>
                <div role="group" aria-label="Export selected calendar reports" className="flex shrink-0 items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('pdf')}>{exporting === 'pdf' ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}PDF</Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('excel')}>{exporting === 'excel' ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}Excel</Button>
                    <Button type="button" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('print')}>{exporting === 'print' ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}Print</Button>
                </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <fieldset disabled={Boolean(exporting)} className="min-w-0 border-b border-hairline bg-canvas/40 px-4 py-3">
                    <legend className="sr-only">Report options</legend>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        <ReportMultiSelect label="Calendar views" options={VIEW_OPTIONS} value={views} onChange={setViews} emptyLabel="Select calendar views" disabled={Boolean(exporting)} />
                        <ReportMultiSelect label="Hierarchy" options={hierarchyOptions} value={selectedHierarchy} onChange={(values) => { setHierarchy(values.filter((value): value is CalendarHierarchy => value !== 'summary')); setIncludeSummary(values.includes('summary')) }} emptyLabel="Dates & hours only" disabled={Boolean(exporting)} />
                        <ReportMultiSelect label="Course & client details" options={DETAIL_OPTIONS} value={details} onChange={setDetails} emptyLabel="No additional details" disabled={Boolean(exporting)} />
                    </div>
                    {hasActual && <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-2.5">
                        <fieldset className="flex flex-wrap items-center gap-3">
                            <legend className="sr-only">Include deviation details?</legend>
                            <span aria-hidden="true" className="text-xs font-medium text-body">Include deviation details?</span>
                            {([false, true] as const).map((value) => <label key={String(value)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-body"><input type="radio" name={deviationRadioName} value={String(value)} checked={includeDeviations === value} onChange={() => setIncludeDeviations(value)} className="size-3.5 accent-brand-700" />{value ? 'Yes' : 'No'}</label>)}
                        </fieldset>
                        {batches.length > 0 && <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-xs text-subtle">Batch</span>
                            <Select value={selectedBatch} onValueChange={onBatchChange} disabled={Boolean(exporting) || !onBatchChange}>
                                <SelectTrigger aria-label="Batch for actual and comparison reports" className="w-48 max-w-full"><SelectValue placeholder="Select batch" /></SelectTrigger>
                                <SelectContent>{batches.map((batch) => <SelectItem key={batch.value} value={batch.value}>{batch.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="text-xs text-subtle">Actual and comparison use this batch.</span>
                        </div>}
                    </div>}
                </fieldset>

                <div className="p-4">
                    {loading && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-subtle"><Loader2 className="size-3.5 animate-spin" />Loading course and client details…</p>}
                    {metadataError && !loading && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn-500/30 bg-warn-50 px-3 py-2 text-xs text-warn-700"><span>{metadataError}</span>{onRetryMetadata && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={Boolean(exporting)} onClick={onRetryMetadata}>Retry</Button>}</div>}
                    {error && <div role="alert" className="mb-3 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>}
                    {exporting && <p role="status" className="mb-3 text-xs text-subtle">Preparing {exporting === 'excel' ? 'Excel' : exporting === 'pdf' ? 'PDF' : 'print preview'} for all selected calendar views…</p>}
                    {!views.length ? <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-hairline p-5 text-center">
                        <CalendarDays className="mb-2 size-7 text-brand-strong" />
                        <h2 className="text-sm font-semibold text-heading">Choose a calendar view</h2>
                        <p className="mt-1.5 max-w-md text-xs leading-5 text-subtle">Select Planned, Actual or Planned vs Actual to preview and export a report. You can include more than one view.</p>
                    </div> : <Tabs value={activePreview} onValueChange={(value) => setPreviewView(value as CalendarReportView)} className="min-w-0 gap-3">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden"><TabsList aria-label="Selected report previews" className="h-8">{sections.map((section) => <TabsTrigger key={section.view} value={section.view} className="text-xs">{VIEW_OPTIONS.find((option) => option.value === section.view)?.label || section.title}</TabsTrigger>)}</TabsList></div>
                            <p className="text-xs text-subtle">Exports include all {sections.length} selected {sections.length === 1 ? 'view' : 'views'}.</p>
                        </div>
                        {sections.map((section) => <TabsContent key={section.view} value={section.view} className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold text-heading">{section.title}</h2>
                                <span className="text-xs tabular-nums text-subtle">{reportRowCount(section.table).toLocaleString()} {reportRowCount(section.table) === 1 ? 'row' : 'rows'}</span>
                            </div>
                            {section.note && <p className="text-xs leading-5 text-subtle">{section.note}</p>}
                            {section.metadata.length > 0 && <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-hairline bg-canvas/30 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-3">{section.metadata.map((item) => <div key={item.label} className="min-w-0"><dt className="text-[11px] text-subtle">{item.label}</dt><dd className="mt-0.5 break-words text-xs font-medium text-heading">{item.value || 'Not specified'}</dd></div>)}</dl>}
                            <ReportTable table={section.table} caption={section.title} />
                            {section.summary && <section className="max-w-xl space-y-2 pt-1">
                                <h3 className="text-xs font-semibold text-heading">Hours summary</h3>
                                <ReportTable table={section.summary.table} caption={`${section.title} hours summary`} />
                            </section>}
                        </TabsContent>)}
                    </Tabs>}
                </div>
            </div>
        </DialogContent>
    </Dialog>
}
