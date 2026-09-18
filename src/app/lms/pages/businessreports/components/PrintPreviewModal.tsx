"use client"

/* The print flow.
 *
 * One modal, opened from Print. A tight header sits at the top with two
 * tab-style pills — Customize Fields and Customize Report Settings — right
 * beneath it. A 30 / 70 split fills the rest: a compact form sidebar on the
 * left, a large live preview on the right with a zoom + pager toolbar. A
 * sticky footer on the right holds Close · Download PDF · Print.
 *
 * The working format is a deep clone of the currently-active saved template
 * (or the built-in letterhead when nothing is saved). Edits inside the modal
 * do NOT persist to Report Settings — this is a per-run design, not a
 * global one. Closing the modal discards the clone. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Download, GripVertical, Hash, Image as ImageIcon,
    Loader2, Maximize2, Minus, PenTool, Plus, Printer, Redo2, Stamp, Table as TableIcon, Trash2,
    Type, Undo2, Waves, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { ServiceMapping } from '../../servicemapping/api/serviceMappingService'
import type { ReportClientBlock, ReportTable } from '../../servicemapping/components/serviceReport'
import {
    letterheadElements, newElement, PAPER_MM,
    type Align, type ElementKind, type Orientation, type PaperSize,
    type ReportElement, type ReportFormat,
} from '../../reportsettings/api/reportSettingsService'
import { exportDesignedPdf, paginateReport, printDesignedReport, type ReportMeta } from '../designedExport'
import { PreviewPage } from './PreviewPage'
import ReportCanvas from '../../reportsettings/components/ReportCanvas'

type Snapshot = { draft: unknown; rows: ServiceMapping[]; generated: string } | null

type Props = {
    open: boolean
    onClose: () => void
    snapshot: Snapshot
    blocks: ReportClientBlock[]
    letterhead: { org: string; address: string; contact: string }
    initialFormat: ReportFormat
    meta: ReportMeta
    /** Optional caller-supplied column definitions — used by pages that
     *  print a different domain (e.g. Course Setup ▸ Report) through the
     *  same modal. Absent means use the built-in service-report FIELDS. */
    fields?: FieldRow[]
    /** Optional caller-supplied default-enabled set — same idea as
     *  `fields`. Absent means use the built-in DEFAULT_ENABLED. */
    defaultEnabled?: Set<string>
}

/** Every column-toggle the reader can flip. All fields are unlockable —
 *  the checkbox alone drives visibility, so any of them can be turned
 *  off if the reader doesn't need it. */
export type FieldRow = {
    key: string
    label: string
    /** When true, the checkbox seeds ON — informational only; visibility is
     *  driven by the enabled set alone, so a reader may still turn it off. */
    required?: boolean
    scope: 'client' | 'service'
    column: string
    dataKey: string
}
/* The column set the reader can put on the sheet.
 *
 * Kept in step with what Client Management shows in its own listing —
 * Client ID, Year (the year the client record was created, NOT the
 * service's Offering Year), Client Name, Business Model, Contact Name,
 * Primary Email, Phone Number — plus the three service-level columns a
 * report is actually about. Order here is the order the checklist runs
 * top to bottom in the sidebar, which the sheet then reads left to
 * right. `dataKey` is the property `resolveClient` reads off the block
 * (or `service[key]` for service-scope rows). */
const FIELDS: FieldRow[] = [
    // ── Client scope ─ mirrors the Client Management listing ────────
    { key: 'clientId',      label: 'Client ID',       scope: 'client', column: 'Client ID',      dataKey: 'clientId' },
    { key: 'createdYear',   label: 'Year',            scope: 'client', column: 'Year',           dataKey: 'createdYear' },
    { key: 'clientName',    label: 'Client Name',     scope: 'client', column: 'Client',         dataKey: 'client' },
    { key: 'businessModel', label: 'Business Model',  scope: 'client', column: 'Business Model', dataKey: 'business' },
    { key: 'contactName',   label: 'Contact Name',    scope: 'client', column: 'Contact Name',   dataKey: 'contactPerson' },
    { key: 'primaryEmail',  label: 'Primary Email',   scope: 'client', column: 'Primary Email',  dataKey: 'email' },
    { key: 'phoneNumber',   label: 'Phone Number',    scope: 'client', column: 'Phone Number',   dataKey: 'contactNumber' },

    // ── Service scope ─ the three columns a services report needs ───
    { key: 'serviceModel',  label: 'Service Model',   scope: 'service', column: 'Service Model',  dataKey: 'serviceModel' },
    { key: 'offeringYear',  label: 'Offering Year',   scope: 'service', column: 'Offering Year',  dataKey: 'year' },
    { key: 'serviceCode',   label: 'Service Code',    scope: 'service', column: 'Service Code',   dataKey: 'code' },
]
const DEFAULT_ENABLED = new Set(['clientName', 'businessModel', 'serviceModel', 'offeringYear'])

/** Deep-clone a saved format so per-run edits never leak back to Report Settings. */
function cloneFormat(format: ReportFormat): ReportFormat {
    return {
        ...format,
        page: { ...format.page },
        clients: [...format.clients],
        elements: format.elements.map((element) => ({ ...element })),
    }
}

/** Give a format the "Filtered by …" line if it doesn't already carry one.
 *
 *  The default letterhead has printed `{filters}` since the feature
 *  landed, but templates saved BEFORE that predate the element and would
 *  silently drop the line — leaving a narrowed report with nothing on the
 *  sheet saying what it was narrowed to. Rather than make the reader
 *  re-apply the letterhead, the missing element is added in place, just
 *  above the table where the default puts it. Mutates the passed format,
 *  which is always a fresh clone by the time this runs.
 *
 *  Safe on an unfiltered report: `{filters}` resolves to an empty string
 *  and an element with no text renders nothing at all. */
function ensureFiltersLine(format: ReportFormat) {
    const alreadyHasOne = format.elements.some((element) => /\{filters\}/i.test(element.text || ''))
    if (alreadyHasOne) return
    const tableElement = format.elements.find((element) => element.kind === 'table')
    if (!tableElement) return
    format.elements.push({
        ...newElement('text', 'reportFilters'),
        text: '{filters}',
        x: tableElement.x,
        y: Math.max(0, tableElement.y - 3.4),
        w: tableElement.w,
        h: 3,
        fontSize: 7.5,
        color: '#667085',
    })
}

/** Container-driven fit: the sheet grows to the container's WIDTH and is
 *  allowed to overflow vertically — the outer pane scrolls when the sheet
 *  is taller than the visible viewport. The old algorithm clamped to the
 *  smaller of width or height, which shrank an A4 sheet to a tiny square
 *  in short panes (the toolbar and footer eat 100 px between them) and
 *  made the report unreadable. Reading the report matters more than
 *  seeing every page at once, so scroll wins.
 *
 *  A callback-ref rather than a ref object so the ResizeObserver follows
 *  the actual DOM node — when the tab switches settings → fields the
 *  preview div is a fresh element, and a plain `useRef` bound in a
 *  once-only effect would still be watching the previous (now detached)
 *  node. That was the reason the page appeared blank on some tab
 *  switches: the observer never woke up on the new node. */
function useFitWidth() {
    const [element, setElement] = useState<HTMLDivElement | null>(null)
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
    useLayoutEffect(() => {
        if (!element) return
        const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight })
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [element])
    // Full container width with a hair of gutter so the sheet's shadow
    // doesn't bleed into the pane's own border.
    const PADDING = 8
    const fitWidth = Math.max(0, size.w - PADDING)
    return { ref: setElement, fitWidth, containerWidth: size.w, containerHeight: size.h }
}

export function PrintPreviewModal({
    open, onClose, snapshot, blocks, letterhead, initialFormat, meta,
    fields, defaultEnabled,
}: Props) {
    void snapshot
    void letterhead

    // Caller-overridable field set. Memoised so a caller that inlines the
    // array literal in JSX (a fresh reference every render) does not thrash
    // downstream memos keyed off it.
    const effectiveFields = useMemo<FieldRow[]>(() => fields ?? FIELDS, [fields])
    const effectiveDefaultEnabled = useMemo<Set<string>>(
        () => defaultEnabled ?? DEFAULT_ENABLED,
        [defaultEnabled],
    )
    const effectiveDefaultOrder = useMemo(
        () => effectiveFields.map((row) => row.key),
        [effectiveFields],
    )

    // Working clone; re-materialises whenever the modal opens. Orientation
    // is forced to Portrait so the modal always opens the same way and
    // the reader gets a predictable starting point; the sidebar's Page
    // dropdown lets them switch to Landscape whenever they want.
    const [workingFormat, setWorkingFormat] = useState<ReportFormat | null>(null)

    /* Undo / redo. `stack` holds format snapshots, `index` points at the
     * one currently on screen. Every change to `workingFormat` is
     * recorded by the effect below; a change that lands within
     * HISTORY_COALESCE_MS of the previous one REPLACES it instead of
     * appending, which collapses the sixty-odd snapshots a single drag
     * would otherwise produce into one undoable step. */
    const HISTORY_COALESCE_MS = 400
    const HISTORY_LIMIT = 60
    const [history, setHistory] = useState<{ stack: ReportFormat[]; index: number }>({ stack: [], index: -1 })
    const lastPushAtRef = useRef(0)
    // Set just before an undo / redo writes the format, so the recording
    // effect knows to let that write pass without pushing a new entry.
    const skipHistoryRef = useRef(false)

    useEffect(() => {
        if (!open) return
        const seed = cloneFormat(initialFormat)
        seed.page = { ...seed.page, orientation: 'portrait' }
        ensureFiltersLine(seed)
        setWorkingFormat(seed)
        setHistory({ stack: [seed], index: 0 })
        lastPushAtRef.current = 0
        skipHistoryRef.current = true
    }, [open, initialFormat])

    useEffect(() => {
        if (!workingFormat) return
        if (skipHistoryRef.current) { skipHistoryRef.current = false; return }
        const now = Date.now()
        const coalesce = now - lastPushAtRef.current < HISTORY_COALESCE_MS
        lastPushAtRef.current = now
        setHistory((previous) => {
            // Anything the reader had redone but then edited past is
            // dropped — the usual branch-discarding undo behaviour.
            const truncated = previous.stack.slice(0, previous.index + 1)
            const next = coalesce && truncated.length > 1
                ? [...truncated.slice(0, -1), workingFormat]
                : [...truncated, workingFormat]
            const capped = next.slice(-HISTORY_LIMIT)
            return { stack: capped, index: capped.length - 1 }
        })
    }, [workingFormat, open])

    const canUndo = history.index > 0
    const canRedo = history.index >= 0 && history.index < history.stack.length - 1
    const undo = useCallback(() => {
        setHistory((previous) => {
            if (previous.index <= 0) return previous
            skipHistoryRef.current = true
            setWorkingFormat(previous.stack[previous.index - 1])
            return { ...previous, index: previous.index - 1 }
        })
    }, [])
    const redo = useCallback(() => {
        setHistory((previous) => {
            if (previous.index >= previous.stack.length - 1) return previous
            skipHistoryRef.current = true
            setWorkingFormat(previous.stack[previous.index + 1])
            return { ...previous, index: previous.index + 1 }
        })
    }, [])

    /* Ctrl/Cmd+Z undo, Ctrl+Y or Ctrl/Cmd+Shift+Z redo. Held in a ref so
     * the listener can stay subscribed across the many renders a drag
     * produces instead of being torn down and rebuilt each frame. */
    const historyHandlersRef = useRef({ undo, redo })
    historyHandlersRef.current = { undo, redo }
    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return
            // Leave native undo alone while the reader is in a text field.
            const target = event.target as HTMLElement | null
            const tag = target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
            const key = event.key.toLowerCase()
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault()
                historyHandlersRef.current.undo()
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault()
                historyHandlersRef.current.redo()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [open])

    // Which tab is showing. `null` means neither — the modal opens on
    // the plain preview with no sidebar so the reader sees the whole
    // report first, and only reveals the customization rail when they
    // click a tab. Clicking an active tab closes the sidebar again, so
    // the two buttons act like a toggle-switch pair.
    const [tab, setTab] = useState<null | 'fields' | 'settings'>(null)
    useEffect(() => { if (open) setTab(null) }, [open])

    /* In Settings mode the preview becomes the interactive ReportCanvas
     * and the reader can click / drag / resize elements directly. The
     * selection lives here so the canvas and the sidebar's property
     * editor agree on the target. Ctrl / Cmd-click builds a
     * multi-selection for dragging several pieces at once; the property
     * panel always edits the FIRST one. */
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
    const selectedElementId = selectedElementIds[0] ?? null
    const setSelectedElementId = useCallback(
        (id: string | null) => setSelectedElementIds(id ? [id] : []),
        [],
    )
    useEffect(() => { if (open) setSelectedElementIds([]) }, [open])
    useEffect(() => { if (tab !== 'settings') setSelectedElementIds([]) }, [tab])

    // Optional-field toggle set + order — top-to-bottom in the sidebar list
    // is left-to-right on the printed sheet.
    const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set(effectiveDefaultEnabled))
    const [fieldOrder, setFieldOrder] = useState<string[]>(effectiveDefaultOrder)
    useEffect(() => {
        if (!open) return
        setEnabledFields(new Set(effectiveDefaultEnabled))
        setFieldOrder(effectiveDefaultOrder)
    }, [open, effectiveDefaultEnabled, effectiveDefaultOrder])

    /** Move a field one step up or down, freely — a client-scope field
     *  can slide past a service-scope one and vice versa. The paginator
     *  and the PDF path both accept a mixed `columns` array now, so the
     *  sheet honours the exact sidebar order rather than always laying
     *  the client columns before the service ones. */
    const moveField = (key: string, direction: -1 | 1) => {
        setFieldOrder((current) => {
            const from = current.indexOf(key)
            if (from < 0) return current
            const to = from + direction
            if (to < 0 || to >= current.length) return current
            const next = [...current]
            next[from] = current[to]
            next[to] = key
            return next
        })
    }

    /** Drop the row at absolute index `from` into slot `to` (both 0-based,
     *  referring to positions in `fieldOrder`). Used by the drag-and-drop
     *  reorder in FieldsPanel — the row picked up gets removed from its
     *  old slot, then inserted at the new one; a drop onto an item's own
     *  slot is a no-op. Cleaner than repeated single-step moves, and
     *  handles jumps of more than one row correctly on the first render. */
    const reorderField = (from: number, to: number) => {
        setFieldOrder((current) => {
            if (from === to || from < 0 || from >= current.length) return current
            const clampedTo = Math.max(0, Math.min(current.length - 1, to))
            const next = [...current]
            const [moved] = next.splice(from, 1)
            next.splice(clampedTo, 0, moved)
            return next
        })
    }

    /* Table Orientation — turns the DATA GRID 90° inside its box while
     * every other element on the sheet stays upright. Off by default:
     * the report reads normally until the reader has more columns than
     * the page's short edge can carry. */
    const [tableRotated, setTableRotated] = useState(false)
    useEffect(() => { if (open) setTableRotated(false) }, [open])

    // Element-kind visibility. Toggled from the Settings tab.
    const [hiddenKinds, setHiddenKinds] = useState<Set<ElementKind>>(new Set())
    useEffect(() => { if (open) setHiddenKinds(new Set()) }, [open])
    const toggleKind = (kind: ElementKind) => {
        setHiddenKinds((current) => {
            const next = new Set(current)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            return next
        })
    }

    // The design as every render path sees it — hidden kinds stripped.
    const effectiveFormat: ReportFormat | null = useMemo(() => {
        if (!workingFormat) return null
        if (!hiddenKinds.size) return workingFormat
        return {
            ...workingFormat,
            elements: workingFormat.elements.filter((element) => !hiddenKinds.has(element.kind)),
        }
    }, [workingFormat, hiddenKinds])

    // The table for preview / PDF / print — column set + order come from
    // the sidebar's enabled+ordered fields.
    const table: ReportTable | null = useMemo(() => {
        if (!blocks.length) return null
        const rowByKey = new Map(effectiveFields.map((r) => [r.key, r]))
        const enabledInOrder = fieldOrder
            .map((key) => rowByKey.get(key))
            // Nothing is forced on — the reader can turn any column off.
            // An empty selection is a legitimate ask ("just the S. No.,
            // please"), so no `required` fallback here.
            .filter((row): row is FieldRow => Boolean(row && enabledFields.has(row.key)))

        /* Ordered columns for the sheet — headers, `columns` (with scope
         * per entry) and the flat rows all follow the reader's sidebar
         * order exactly. clientColumns/serviceColumns are also emitted
         * so an older caller still gets the classic client-first-then-
         * service layout when it inspects the table directly, but the
         * paginator and PDF path prefer `columns` when it's present. */
        const headers = ['S. No.', ...enabledInOrder.map((r) => r.column)]
        const columns = enabledInOrder.map((r) => ({ key: r.dataKey, scope: r.scope }))
        const clientColumns = enabledInOrder.filter((r) => r.scope === 'client').map((r) => r.dataKey)
        const serviceColumns = enabledInOrder.filter((r) => r.scope === 'service').map((r) => r.dataKey)

        /* Client Name and Business Model live on the block itself because
         * the report tree keys off them; every other client-scope column
         * — Client ID, the client's CREATED Year (distinct from a
         * service's Offering Year), Contact Name, Primary Email, Phone
         * Number — comes off the block's `clientExtras`. Anything the
         * caller didn't populate reads back as an empty string, which
         * the paginator renders as an em-dash. */
        const resolveClient = (block: ReportClientBlock, key: string): string => {
            if (key === 'client') return block.client
            if (key === 'business') return block.business
            return block.clientExtras?.[key] ?? ''
        }

        /* Flat rows for the canvas mini-table.
         *
         * Cells are emitted in the exact `columns` order, so a service
         * column sitting above a client column in the sidebar lands to
         * the LEFT of that client column on the sheet. Serial is one
         * number per CLIENT, so a client with five services shares one
         * S. No. that rowspans its five rows — the mini-table's rowspan
         * detector merges cells whose text matches the row above, so
         * repeating the same serial across the block is all it needs. */
        const flat: string[][] = []
        let serial = 0
        for (const block of blocks) {
            serial += 1
            for (const service of block.services) {
                flat.push([
                    String(serial),
                    ...columns.map((col) => col.scope === 'client'
                        ? resolveClient(block, col.key)
                        : (service[col.key] ?? '')),
                ])
            }
        }
        return { headers, rows: flat, groups: blocks, columns, clientColumns, serviceColumns, tableRotated }
    }, [blocks, enabledFields, fieldOrder, tableRotated, effectiveFields])

    const paginated = useMemo(() => {
        if (!effectiveFormat || !table) return null
        return paginateReport(effectiveFormat, table)
    }, [effectiveFormat, table])

    const [currentPage, setCurrentPage] = useState(1)
    useEffect(() => {
        if (!paginated) return
        setCurrentPage((p) => Math.min(Math.max(1, p), paginated.totalPages))
    }, [paginated])

    /* Lines for the CURRENT page — the exact same ReportLine[] the
     * Fields-tab preview and the printed sheet consume. The Settings tab
     * hands this to ReportCanvas so its mini-table renders through the
     * SAME code path with the SAME rowSpan cells, the SAME wrap-aware
     * pagination and the SAME row count as the printer. Previously the
     * mini-table read `table.rows.slice(...)` which lost the rowspan
     * structure and disagreed with print whenever a row wrapped: this
     * moves it onto the paginator's single source of truth. */
    const currentPageLines = useMemo(() => {
        if (!paginated) return []
        return paginated.pages[currentPage - 1] ?? []
    }, [paginated, currentPage])

    /* How many blank ruled rows to append on this page. The paginator
     * computes it once (per page) so all three renderers agree on
     * where the grid stops; without this the canvas would show a
     * different number of empty rows than the print sheet emits. */
    const currentPageFillers = useMemo(() => {
        if (!paginated) return 0
        return paginated.fillers[currentPage - 1] ?? 0
    }, [paginated, currentPage])

    // Zoom — 'fit' means fill the container, otherwise a numeric percentage
    // multiplier over the fit width. Zoom in / out step by 25%.
    const [zoom, setZoom] = useState<'fit' | number>('fit')
    useEffect(() => { if (open) setZoom('fit') }, [open])

    /* The sheet is always shown in its own orientation — whole-page
     * rotation is gone. Turning the report sideways is now a property of
     * the TABLE (see the Table Orientation checkbox in the settings
     * sidebar), which keeps the letterhead, rules, watermark, signature
     * and footer upright while the data grid takes the sheet's long
     * edge. */
    const { ref: fitRef, fitWidth } = useFitWidth()

    const zoomPct = zoom === 'fit' ? 100 : zoom
    const previewWidth = zoom === 'fit' ? fitWidth : Math.max(120, fitWidth * (zoom / 100))
    const stepZoom = (direction: -1 | 1) => {
        setZoom((current) => {
            const now = current === 'fit' ? 100 : current
            const next = Math.max(50, Math.min(300, now + direction * 25))
            return next
        })
    }

    const [exporting, setExporting] = useState<null | 'pdf' | 'print'>(null)
    const [exportError, setExportError] = useState('')

    const runExport = async (format: 'pdf' | 'print') => {
        if (!effectiveFormat || !table || !table.rows.length || exporting) return
        setExporting(format)
        setExportError('')
        try {
            if (format === 'pdf') {
                await exportDesignedPdf(effectiveFormat, table, meta, `report-${new Date().toISOString().slice(0, 10)}`)
            } else {
                printDesignedReport(effectiveFormat, table, meta)
            }
        } catch (err) {
            setExportError(err instanceof Error && err.message ? err.message : 'Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    if (!open) return null

    return (
        <div
            role="dialog"
            aria-modal
            aria-labelledby="print-preview-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-3"
            onClick={() => { if (!exporting) onClose() }}
        >
            <div
                className="flex h-[94vh] w-[95vw] max-w-[1680px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                {/* ── Header — title, tabs, close ─────────────────────
                    Tabs live at the top of the modal (not inside a
                    sidebar) so both buttons are always visible whether
                    or not the customization rail is open. Clicking one
                    opens the sidebar with that panel; clicking the same
                    button again closes the sidebar back to the plain
                    preview. */}
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-2">
                    <div className="min-w-0">
                        <h2 id="print-preview-title" className="text-sm font-semibold text-heading">Print Preview</h2>
                        <p className="text-[11px] leading-3 text-subtle">Review, customize, download or print.</p>
                    </div>
                    <div role="tablist" aria-label="Customize" className="flex flex-wrap items-center gap-2">
                        <TabButton
                            active={tab === 'fields'}
                            onClick={() => setTab((current) => (current === 'fields' ? null : 'fields'))}
                        >
                            Customize Fields
                        </TabButton>
                        <TabButton
                            active={tab === 'settings'}
                            onClick={() => setTab((current) => (current === 'settings' ? null : 'settings'))}
                        >
                            Customize Report Settings
                        </TabButton>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={Boolean(exporting)}
                        aria-label="Close preview"
                        style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full shadow-xs transition-colors hover:!bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:pointer-events-none disabled:opacity-40"
                    >
                        <X className="size-4" strokeWidth={2.5} />
                    </button>
                </header>

                {/* ── Body: optional sidebar + preview + toolbar ────── */}
                <div className="flex min-h-0 flex-1">

                    {tab && (
                        <aside className="flex w-[30%] min-w-[280px] max-w-[400px] shrink-0 flex-col border-r border-hairline bg-canvas/30">
                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                {tab === 'fields' ? (
                                    <FieldsPanel
                                        fields={effectiveFields}
                                        enabled={enabledFields}
                                        onToggle={(key) => setEnabledFields((current) => {
                                            const next = new Set(current)
                                            if (next.has(key)) next.delete(key)
                                            else next.add(key)
                                            return next
                                        })}
                                        fieldOrder={fieldOrder}
                                        onMove={moveField}
                                        onReorder={reorderField}
                                    />
                                ) : (
                                    <SettingsPanel
                                        format={workingFormat}
                                        onFormatChange={(patch) => setWorkingFormat((current) => (current ? patch(current) : current))}
                                        hiddenKinds={hiddenKinds}
                                        onToggleKind={toggleKind}
                                        selectedElementId={selectedElementId}
                                        onSelectElement={setSelectedElementId}
                                        tableRotated={tableRotated}
                                        onToggleTableRotated={() => setTableRotated((current) => !current)}
                                    />
                                )}
                            </div>
                        </aside>
                    )}

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        {/* Preview toolbar — the SAME pager + Fit + zoom
                            row for both tabs, so switching between
                            Customize Fields and Customize Report Settings
                            never changes what controls are on screen or
                            where they sit. Settings mode adds undo / redo
                            after the shared block since only the editor
                            canvas has history to reach for. */}
                        <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-white px-3 py-1.5">
                            <div role="group" aria-label="Pages" className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={!paginated || currentPage === 1}
                                    aria-label="Previous page"
                                    className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-3.5" />
                                </button>
                                <span className="text-[11px] font-medium tabular-nums text-subtle">
                                    {paginated ? `${currentPage} / ${paginated.totalPages}` : '— / —'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(paginated?.totalPages ?? 1, p + 1))}
                                    disabled={!paginated || currentPage === paginated.totalPages}
                                    aria-label="Next page"
                                    className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <ChevronRight className="size-3.5" />
                                </button>
                            </div>

                            <span aria-hidden className="h-4 w-px bg-hairline" />

                            <button
                                type="button"
                                onClick={() => setZoom('fit')}
                                title="Fit to width"
                                className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-medium transition-colors ${
                                    zoom === 'fit'
                                        ? 'bg-brand-wash text-brand-strong'
                                        : 'text-subtle hover:bg-row-hover hover:text-heading'
                                }`}
                            >
                                <Maximize2 className="size-3" />Fit
                            </button>

                            <div role="group" aria-label="Zoom" className="flex items-center gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => stepZoom(-1)}
                                    aria-label="Zoom out"
                                    className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading"
                                >
                                    <Minus className="size-3.5" />
                                </button>
                                <span className="min-w-[42px] text-center text-[11px] font-medium tabular-nums text-subtle">
                                    {zoomPct}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => stepZoom(1)}
                                    aria-label="Zoom in"
                                    className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading"
                                >
                                    <Plus className="size-3.5" />
                                </button>
                            </div>

                            {tab === 'settings' && (
                                <>
                                    <span aria-hidden className="h-4 w-px bg-hairline" />
                                    <div role="group" aria-label="History" className="flex items-center gap-0.5">
                                        <button
                                            type="button"
                                            onClick={undo}
                                            disabled={!canUndo}
                                            title="Undo (Ctrl+Z)"
                                            aria-label="Undo"
                                            className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading disabled:pointer-events-none disabled:opacity-30"
                                        >
                                            <Undo2 className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={redo}
                                            disabled={!canRedo}
                                            title="Redo (Ctrl+Y)"
                                            aria-label="Redo"
                                            className="inline-flex size-6 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading disabled:pointer-events-none disabled:opacity-30"
                                        >
                                            <Redo2 className="size-3.5" />
                                        </button>
                                    </div>
                                    <span className="ml-1 hidden text-[11px] text-subtle sm:inline">
                                        {selectedElementIds.length > 1
                                            ? `${selectedElementIds.length} selected — drag to move them together`
                                            : 'Ctrl-click to select several · drag a corner to resize'}
                                    </span>
                                </>
                            )}

                            {exportError && (
                                <span className="ml-auto text-[11px] text-danger-700">{exportError}</span>
                            )}
                        </div>

                        {tab === 'settings' ? (
                            // Interactive canvas — same drag / resize / select
                            // surface as System Settings ▸ Report Settings,
                            // with the real generated data drawn inside the
                            // table element. The ReportCanvas paints its own
                            // ink-100 backdrop, so no wrapper padding here.
                            <div className="min-h-0 flex-1">
                                {effectiveFormat && table ? (
                                    // The canvas reads `effectiveFormat` so
                                    // the Show / hide toggles in the sidebar
                                    // remove hidden kinds from the drawn
                                    // sheet immediately. Edits made on the
                                    // canvas (drag / resize / property
                                    // panel) still land on `workingFormat`,
                                    // the full unfiltered store, so
                                    // toggling the switch back on brings
                                    // the element back at its updated
                                    // position.
                                    <ReportCanvas
                                        format={effectiveFormat}
                                        selectedIds={selectedElementIds}
                                        onSelect={setSelectedElementIds}
                                        onChange={(id, patch) => setWorkingFormat((current) => (current ? {
                                            ...current,
                                            elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
                                        } : current))}
                                        tablePreview={{ headers: table.headers, lines: currentPageLines, fillerCount: currentPageFillers }}
                                        tableRotated={tableRotated}
                                        // Feed the same meta the Fields tab and
                                        // the printer use, so tokens ({title},
                                        // {scope}, {generated}, {filters}, …)
                                        // resolve to REAL values on the editor
                                        // canvas — no more "6 clients · 48
                                        // rows" placeholder or literal
                                        // "{filters}" on the sheet.
                                        meta={meta}
                                    />
                                ) : (
                                    <p className="text-xs text-subtle">Preparing editor…</p>
                                )}
                            </div>
                        ) : (
                            /* The scrollable preview pane.
                             *
                             * `overflow-y-scroll` (rather than -auto) reserves the
                             * scrollbar's width even when the sheet fits, so
                             * fitWidth cannot ping-pong when a taller page
                             * appears and the scrollbar shows up mid-render.
                             * `overflow-x-auto` keeps a horizontal scroll
                             * available when the reader has zoomed past the
                             * pane's width. Inside, an `items-start` flex row
                             * puts the sheet at the top so scrolling starts
                             * from the sheet's top edge instead of a centered
                             * position that hides the header.
                             */
                            <div
                                ref={fitRef}
                                className="relative min-h-0 flex-1 overflow-y-scroll overflow-x-auto bg-ink-100/60"
                            >
                                <div className="flex min-h-full justify-center px-2 py-3">
                                    {!effectiveFormat || !table || !paginated ? (
                                        <p className="mt-6 text-xs text-subtle">Preparing preview…</p>
                                    ) : !table.rows.length ? (
                                        <p className="mt-6 text-xs text-subtle">Nothing to preview — the current filters returned no rows.</p>
                                    ) : previewWidth > 0 ? (
                                        <PreviewPage
                                            format={effectiveFormat}
                                            lines={paginated.pages[currentPage - 1] ?? []}
                                            headers={table.headers}
                                            pageNo={currentPage}
                                            totalPages={paginated.totalPages}
                                            box={paginated.box}
                                            layout={paginated.layout}
                                            tableRotated={paginated.tableRotated}
                                            fillerCount={currentPageFillers}
                                            meta={meta}
                                            width={previewWidth}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {/* ── Sticky footer, aligned right ─────────────── */}
                        <footer className="shrink-0 border-t border-hairline bg-white px-4 py-2">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    disabled={Boolean(exporting)}
                                    onClick={onClose}
                                >
                                    Close
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-brand-500/40 text-xs font-bold text-brand-strong hover:bg-brand-wash"
                                    disabled={Boolean(exporting) || !table?.rows.length}
                                    onClick={() => void runExport('pdf')}
                                >
                                    {exporting === 'pdf'
                                        ? <><Loader2 className="size-3.5 animate-spin" />Preparing…</>
                                        : <><Download className="size-4" />Download PDF</>}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="text-xs font-bold"
                                    disabled={Boolean(exporting) || !table?.rows.length}
                                    onClick={() => void runExport('print')}
                                >
                                    {exporting === 'print'
                                        ? <><Loader2 className="size-3.5 animate-spin" />Preparing…</>
                                        : <><Printer className="size-4" />Print</>}
                                </Button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ── Tab button — segmented-control style ─────────────────────────────── */

function TabButton({ active, onClick, children }: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    /* Real button chrome — visible border in both states, filled brand
     * orange when active, soft shadow so the row reads as a segmented
     * control rather than as inline links. */
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-control border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
                active
                    ? 'border-brand-strong bg-brand-strong text-white hover:bg-brand-800'
                    : 'border-hairline-strong bg-white text-body hover:border-brand-500/40 hover:bg-brand-wash hover:text-brand-strong'
            }`}
        >
            {children}
        </button>
    )
}

/* ── Fields tab: checkboxes + drag-drop + up/down arrows ─────────────
 *
 * Two ways to reorder a column: drag the row (grip on the left, or the
 * row body itself — the whole row is a native draggable) and drop it
 * anywhere in the list, or click the up / down arrows on the right.
 * Drag is the primary gesture the reader wanted; the arrows stay for
 * keyboard users and one-step nudges.
 *
 * The label text is a `<label htmlFor="…">` bound to the checkbox, so
 * clicking anywhere on the field name toggles the field on / off — no
 * need to hit the tiny checkbox itself. */

function FieldsPanel({ fields, enabled, onToggle, fieldOrder, onMove, onReorder }: {
    fields: FieldRow[]
    enabled: Set<string>
    onToggle: (key: string) => void
    fieldOrder: string[]
    onMove: (key: string, direction: -1 | 1) => void
    onReorder: (from: number, to: number) => void
}) {
    const rowByKey = useMemo(() => new Map(fields.map((r) => [r.key, r])), [fields])
    const orderedRows = fieldOrder
        .map((key) => rowByKey.get(key))
        .filter((row): row is FieldRow => Boolean(row))

    /* Local drag state — the row being dragged, and the slot the pointer
     * is currently over. Kept as keys, not indices, so a re-render mid-
     * drag (say the reader ticks another field's checkbox) can't stale
     * the drop target: the key survives an index shift. */
    const [dragKey, setDragKey] = useState<string | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)

    const clearDrag = () => { setDragKey(null); setDragOverKey(null) }

    const commitDrop = (targetKey: string) => {
        if (!dragKey || dragKey === targetKey) { clearDrag(); return }
        const from = fieldOrder.indexOf(dragKey)
        const to = fieldOrder.indexOf(targetKey)
        if (from < 0 || to < 0) { clearDrag(); return }
        onReorder(from, to)
        clearDrag()
    }

    return (
        <div className="space-y-3">
            <p className="text-[11px] leading-4 text-subtle">
                Drag a row to reorder, or use the arrows — top to bottom here is left to right on the sheet. Click the label to toggle a column.
            </p>
            <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    Client
                </h4>
                <div className="overflow-hidden rounded-lg border border-hairline bg-white">
                    {orderedRows.map((row, positionInList) => {
                        const isOn = enabled.has(row.key)
                        const isFirst = positionInList === 0
                        const isLast = positionInList === orderedRows.length - 1
                        const isDragging = dragKey === row.key
                        const isDropTarget = dragOverKey === row.key && dragKey !== row.key
                        const checkboxId = `field-${row.key}`
                        return (
                            <div
                                key={row.key}
                                draggable
                                onDragStart={(event) => {
                                    setDragKey(row.key)
                                    // The Firefox drag engine ignores a
                                    // drag that starts with no data on the
                                    // DataTransfer, so plant the row key.
                                    event.dataTransfer.effectAllowed = 'move'
                                    event.dataTransfer.setData('text/plain', row.key)
                                }}
                                onDragOver={(event) => {
                                    // preventDefault is what tells the
                                    // browser this element accepts a drop —
                                    // without it, onDrop never fires.
                                    event.preventDefault()
                                    event.dataTransfer.dropEffect = 'move'
                                    if (dragOverKey !== row.key) setDragOverKey(row.key)
                                }}
                                onDrop={(event) => {
                                    event.preventDefault()
                                    commitDrop(row.key)
                                }}
                                onDragEnd={clearDrag}
                                className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors hover:bg-row-hover ${
                                    positionInList === 0 ? '' : 'border-t border-hairline/60'
                                } ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'bg-brand-wash' : ''}`}
                            >
                                {/* Drag handle — the whole row is draggable
                                    anyway, but a grip icon makes the
                                    gesture discoverable and gives the
                                    reader a target that never conflicts
                                    with the label or the arrows. */}
                                <span
                                    aria-hidden
                                    title="Drag to reorder"
                                    className="inline-flex size-4 shrink-0 cursor-grab items-center justify-center text-faint hover:text-brand-strong active:cursor-grabbing"
                                >
                                    <GripVertical className="size-3" />
                                </span>
                                <input
                                    id={checkboxId}
                                    type="checkbox"
                                    checked={isOn}
                                    onChange={() => onToggle(row.key)}
                                    aria-label={row.label}
                                    className="size-3.5 accent-[var(--color-brand-strong,#c2410c)]"
                                />
                                {/* `<label htmlFor>` — clicking the text
                                    toggles the checkbox natively, so the
                                    reader doesn't have to aim for the
                                    tiny box. `cursor-pointer` makes the
                                    affordance obvious. */}
                                <label
                                    htmlFor={checkboxId}
                                    className={`min-w-0 flex-1 cursor-pointer truncate select-none ${isOn ? 'text-heading' : 'text-body'}`}
                                >
                                    {row.label}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onMove(row.key, -1)}
                                    disabled={isFirst}
                                    aria-label={`Move ${row.label} up`}
                                    className="inline-flex size-5 items-center justify-center rounded text-subtle transition-colors hover:bg-brand-wash hover:text-brand-strong disabled:pointer-events-none disabled:opacity-30"
                                >
                                    <ArrowUp className="size-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMove(row.key, 1)}
                                    disabled={isLast}
                                    aria-label={`Move ${row.label} down`}
                                    className="inline-flex size-5 items-center justify-center rounded text-subtle transition-colors hover:bg-brand-wash hover:text-brand-strong disabled:pointer-events-none disabled:opacity-30"
                                >
                                    <ArrowDown className="size-3" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ── Settings tab ────────────────────────────────────────────────────
 *
 *  Layout, top to bottom:
 *    1. Add toolbar    Text / Logo / Line / Watermark / Signature /
 *                      Page number / Table / Letterhead
 *                      + Duplicate / Delete
 *    2. Selected element properties (when something is selected)
 *    3. Simple settings — quick show/hide + logo/watermark/signature
 *       text + page size + orientation + margins.
 *
 *  The Add toolbar and the selected-element panel give the reader the
 *  same expressive power as the standalone Report Settings editor; the
 *  simple settings block is a shortcut for the frequent cases (change
 *  watermark text, hide signature, switch orientation). Both cooperate:
 *  editing the watermark text in the simple block updates the same
 *  element the toolbar can drag/resize on the preview.
 */

const ADDABLE: { kind: ElementKind; label: string; icon: typeof Type }[] = [
    { kind: 'text', label: 'Text', icon: Type },
    { kind: 'logo', label: 'Logo', icon: ImageIcon },
    { kind: 'line', label: 'Line', icon: Minus },
    { kind: 'watermark', label: 'Watermark', icon: Waves },
    { kind: 'signature', label: 'Signature', icon: PenTool },
    { kind: 'pageNumber', label: 'Page #', icon: Hash },
    { kind: 'table', label: 'Table', icon: TableIcon },
]
const ALIGNS: Align[] = ['left', 'center', 'right']

function SettingsPanel({
    format, onFormatChange, hiddenKinds, onToggleKind, selectedElementId, onSelectElement,
    tableRotated, onToggleTableRotated,
}: {
    format: ReportFormat | null
    onFormatChange: (patch: (format: ReportFormat) => ReportFormat) => void
    hiddenKinds: Set<ElementKind>
    onToggleKind: (kind: ElementKind) => void
    selectedElementId: string | null
    onSelectElement: (id: string | null) => void
    tableRotated: boolean
    onToggleTableRotated: () => void
}) {
    if (!format) {
        return <p className="text-[11px] text-subtle">Loading…</p>
    }

    const selected = format.elements.find((element) => element.id === selectedElementId) || null

    const patchElement = (id: string, patch: Partial<ReportElement>) => {
        onFormatChange((current) => ({
            ...current,
            elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
        }))
    }

    /** Add a new element and select it so the property panel opens on it. */
    const addElement = (kind: ElementKind) => {
        if (kind === 'table' && format.elements.some((element) => element.kind === 'table')) {
            toast.info('The page already has a table — a report has one.')
            return
        }
        const id = `${kind}-${Date.now().toString(36)}`
        onFormatChange((current) => ({ ...current, elements: [...current.elements, newElement(kind, id)] }))
        onSelectElement(id)
    }

    const duplicateElement = () => {
        if (!selected || selected.kind === 'table') return
        const id = `${selected.kind}-${Date.now().toString(36)}`
        onFormatChange((current) => ({
            ...current,
            elements: [
                ...current.elements,
                { ...selected, id, x: Math.min(95, selected.x + 3), y: Math.min(95, selected.y + 3) },
            ],
        }))
        onSelectElement(id)
    }

    const removeElement = () => {
        if (!selected) return
        if (selected.kind === 'table') { toast.info('The table is the report — it cannot be removed.'); return }
        onFormatChange((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selected.id) }))
        onSelectElement(null)
    }

    const resetToLetterhead = () => {
        onFormatChange((current) => ({ ...current, elements: letterheadElements() }))
        onSelectElement(null)
        toast.success('Letterhead applied to this print')
    }

    /** Upload replaces the selected logo's image, using the same 1MB cap
     *  as System Settings ▸ Report Settings. Called from the selected-
     *  element panel's Replace-image button. */
    const onLogoPicked = (file: File | undefined, target: ReportElement) => {
        if (!file) return
        if (file.size > 1_000_000) { toast.error('Image too large — use one under 1 MB'); return }
        const reader = new FileReader()
        reader.onload = () => patchElement(target.id, { dataUrl: String(reader.result || '') })
        reader.onerror = () => toast.error('Could not read that image')
        reader.readAsDataURL(file)
    }

    const inputClass = 'h-8 w-full rounded-control border border-hairline-strong bg-white px-2 text-xs text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15'

    return (
        <div className="space-y-3">

            {/* ── Add toolbar ────────────────────────────────────────── */}
            <div className="rounded-lg border border-hairline bg-white p-2">
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Add</h4>
                <div className="flex flex-wrap gap-1">
                    {ADDABLE.map(({ kind, label, icon: Icon }) => (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => addElement(kind)}
                            title={`Add ${label}`}
                            className="inline-flex items-center gap-1 rounded-control border border-hairline-strong bg-white px-1.5 py-1 text-[10.5px] font-medium text-body transition-colors hover:border-brand-500/40 hover:bg-brand-wash hover:text-brand-strong"
                        >
                            <Icon className="size-3" />{label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={resetToLetterhead}
                        title="Reset to the standard letterhead"
                        className="inline-flex items-center gap-1 rounded-control border border-hairline-strong bg-white px-1.5 py-1 text-[10.5px] font-medium text-body transition-colors hover:bg-row-hover"
                    >
                        <Stamp className="size-3" />Letterhead
                    </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                    <button
                        type="button"
                        onClick={duplicateElement}
                        disabled={!selected || selected.kind === 'table'}
                        title="Duplicate selected"
                        className="inline-flex items-center gap-1 rounded-control border border-hairline-strong bg-white px-1.5 py-1 text-[10.5px] font-medium text-body transition-colors hover:bg-row-hover disabled:pointer-events-none disabled:opacity-40"
                    >
                        <Copy className="size-3" />Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={removeElement}
                        disabled={!selected || selected.kind === 'table'}
                        title="Delete selected"
                        className="inline-flex items-center gap-1 rounded-control border border-hairline-strong bg-white px-1.5 py-1 text-[10.5px] font-medium text-danger-700 transition-colors hover:bg-row-hover disabled:pointer-events-none disabled:opacity-40"
                    >
                        <Trash2 className="size-3" />Delete
                    </button>
                </div>
            </div>

            {/* ── Selected element properties ────────────────────────── */}
            {selected && (
                <SettingsSection title={`Selected — ${selected.kind}`}>
                    {selected.kind === 'logo' ? (
                        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-hairline-strong bg-white px-2 py-1.5 text-[11px] font-medium text-body hover:bg-row-hover">
                            <ImageIcon className="size-3.5" />
                            {selected.dataUrl ? 'Replace image' : 'Upload image'}
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml"
                                className="hidden"
                                onChange={(event) => onLogoPicked(event.target.files?.[0], selected)}
                            />
                        </label>
                    ) : selected.kind !== 'table' && selected.kind !== 'line' && (
                        <label className="block">
                            <span className="text-[10px] text-subtle">Text</span>
                            <input
                                value={selected.text}
                                onChange={(event) => patchElement(selected.id, { text: event.target.value })}
                                className={inputClass}
                            />
                        </label>
                    )}
                    {selected.kind !== 'table' && selected.kind !== 'logo' && selected.kind !== 'line' && (
                        <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="text-[10px] text-subtle">Size (pt)</span>
                                    <input
                                        type="number"
                                        min={5}
                                        max={96}
                                        value={selected.fontSize}
                                        className={inputClass}
                                        onChange={(event) => patchElement(selected.id, { fontSize: Number(event.target.value) })}
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] text-subtle">Colour</span>
                                    <input
                                        type="color"
                                        value={selected.color}
                                        className="h-8 w-full cursor-pointer rounded-control border border-hairline-strong bg-white"
                                        onChange={(event) => patchElement(selected.id, { color: event.target.value })}
                                    />
                                </label>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                                <div className="inline-flex overflow-hidden rounded-control border border-hairline-strong">
                                    {ALIGNS.map((align) => (
                                        <button
                                            key={align}
                                            type="button"
                                            onClick={() => patchElement(selected.id, { align })}
                                            className={`px-2 py-1 text-[10px] capitalize ${selected.align === align ? 'bg-brand-wash font-semibold text-brand-strong' : 'text-subtle hover:bg-row-hover'}`}
                                        >
                                            {align}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => patchElement(selected.id, { bold: !selected.bold })}
                                    className={`rounded-control border px-2 py-1 text-[10.5px] font-bold ${selected.bold ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-hairline-strong text-subtle hover:bg-row-hover'}`}
                                >B</button>
                                <button
                                    type="button"
                                    onClick={() => patchElement(selected.id, { italic: !selected.italic })}
                                    className={`rounded-control border px-2 py-1 text-[10.5px] italic ${selected.italic ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-hairline-strong text-subtle hover:bg-row-hover'}`}
                                >I</button>
                            </div>
                        </div>
                    )}
                    {selected.kind === 'line' && (
                        <label className="block">
                            <span className="text-[10px] text-subtle">Colour</span>
                            <input
                                type="color"
                                value={selected.color}
                                className="h-8 w-full cursor-pointer rounded-control border border-hairline-strong bg-white"
                                onChange={(event) => patchElement(selected.id, { color: event.target.value })}
                            />
                        </label>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block text-[10px] text-subtle">
                            Opacity — {Math.round(selected.opacity * 100)}%
                            <input
                                type="range"
                                min={2}
                                max={100}
                                value={Math.round(selected.opacity * 100)}
                                className="mt-1 w-full accent-[var(--color-brand-strong,#c2410c)]"
                                onChange={(event) => patchElement(selected.id, { opacity: Number(event.target.value) / 100 })}
                            />
                        </label>
                        <label className="block text-[10px] text-subtle">
                            Rotation — {selected.rotation}°
                            <input
                                type="range"
                                min={-90}
                                max={90}
                                value={selected.rotation}
                                className="mt-1 w-full accent-[var(--color-brand-strong,#c2410c)]"
                                onChange={(event) => patchElement(selected.id, { rotation: Number(event.target.value) })}
                            />
                        </label>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                        {(['x', 'y', 'w', 'h'] as const).map((key) => (
                            <label key={key} className="block">
                                <span className="text-[10px] uppercase text-subtle">{key}</span>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={Math.round(selected[key] * 10) / 10}
                                    className={inputClass}
                                    onChange={(event) => patchElement(selected.id, { [key]: Number(event.target.value) })}
                                />
                            </label>
                        ))}
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-body">
                        <Switch
                            checked={selected.everyPage}
                            onCheckedChange={(on) => patchElement(selected.id, { everyPage: on })}
                            aria-label="Repeat on every page"
                            className="scale-75"
                        />
                        Repeat on every page
                    </label>
                </SettingsSection>
            )}

            <SettingsSection title="Page">
                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="text-[10px] text-subtle">Size</span>
                        <select
                            value={format.page.size}
                            className={inputClass}
                            onChange={(event) => onFormatChange((current) => ({ ...current, page: { ...current.page, size: event.target.value as PaperSize } }))}
                        >
                            {(Object.keys(PAPER_MM) as PaperSize[]).map((size) => (
                                <option key={size} value={size}>{PAPER_MM[size].label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[10px] text-subtle">Orientation</span>
                        <select
                            value={format.page.orientation}
                            className={inputClass}
                            onChange={(event) => onFormatChange((current) => ({ ...current, page: { ...current.page, orientation: event.target.value as Orientation } }))}
                        >
                            <option value="landscape">Landscape</option>
                            <option value="portrait">Portrait</option>
                        </select>
                    </label>
                </div>

                {/* Table Orientation — turns ONLY the data grid 90° inside
                    its box. The letterhead, rules, watermark, signature and
                    footer all stay in the page's own orientation, so a
                    wide many-column report can use the sheet's long edge
                    without the report itself reading sideways. */}
                <label className="mt-2.5 flex cursor-pointer select-none items-start gap-2 border-t border-hairline pt-2.5">
                    <input
                        type="checkbox"
                        checked={tableRotated}
                        onChange={onToggleTableRotated}
                        className="mt-0.5 size-3.5 accent-[var(--color-brand-strong,#c2410c)]"
                    />
                    <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-heading">Table Orientation</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-subtle">
                            Turn the table sideways to fit more columns. Header, footer and logo stay upright.
                        </span>
                    </span>
                </label>
            </SettingsSection>

            <SettingsSection title="Margins (mm)">
                <div className="grid grid-cols-4 gap-1.5">
                    {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((key) => (
                        <label key={key} className="block">
                            <span className="text-[10px] uppercase text-subtle">{key.replace('margin', '')}</span>
                            <input
                                type="number"
                                min={0}
                                max={50}
                                value={format.page[key]}
                                className={inputClass}
                                onChange={(event) => onFormatChange((current) => ({ ...current, page: { ...current.page, [key]: Number(event.target.value) } }))}
                            />
                        </label>
                    ))}
                </div>
            </SettingsSection>

            {/* ── Batch visibility ──────────────────────────────────────
                Each toggle hides every element of that kind on the sheet
                — a shortcut worth keeping even after the individual Logo /
                Watermark / Signature sections were folded into the
                selected-element panel. Kept at the bottom because it is
                a quick "turn a thing off entirely" tool the reader reaches
                for after they have arranged the page. */}
            <SettingsSection title="Show / hide">
                <ToggleRow label="Logo" checked={!hiddenKinds.has('logo')} onToggle={() => onToggleKind('logo')} />
                <ToggleRow label="Watermark" checked={!hiddenKinds.has('watermark')} onToggle={() => onToggleKind('watermark')} />
                <ToggleRow label="Signature" checked={!hiddenKinds.has('signature')} onToggle={() => onToggleKind('signature')} />
                <ToggleRow label="Rules" checked={!hiddenKinds.has('line')} onToggle={() => onToggleKind('line')} />
                <ToggleRow label="Page numbers" checked={!hiddenKinds.has('pageNumber')} onToggle={() => onToggleKind('pageNumber')} />
            </SettingsSection>
        </div>
    )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-hairline bg-white p-2.5">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{title}</h4>
            {children}
        </div>
    )
}

function ToggleRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
    return (
        <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[11px] text-body">{label}</span>
            <Switch checked={checked} onCheckedChange={onToggle} className="scale-75" aria-label={label} />
        </div>
    )
}
