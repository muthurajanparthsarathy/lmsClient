"use client"

/* Program Calendar ▸ Reports tab.
 *
 * A trimmed print-oriented view over the same per-row schedule the Program
 * Calendar tab renders (Module / Topic / Total Hours / Start Date / End
 * Date). Sits inside ProgramCalendarContent and takes its rows as a prop
 * so the report cannot drift from what is on the calendar tab — one source
 * of truth for what the sheet will emit.
 *
 * Batches are the one thing the tab reads out of the record: when the
 * course has batches, the reader must pick one before anything renders.
 * With no batches the calendar is shown directly.
 *
 * Printing goes through the shared PrintPreviewModal with a synthetic
 * one-block payload (no client concept here) and an all-service-scope
 * field set, which flips the paginator into per-row S. No. mode.
 *
 * The mode toggle (Planned / Actual / Planned vs Actual) and view toggle
 * (Table / Calendar) are the same segmented controls that appear on the
 * Program Calendar tab. State is OWNED by ProgramCalendarContent so
 * switching tabs preserves the reader's choice; this file only renders
 * the chrome and picks the row source accordingly. */

import { useEffect, useMemo, useState } from 'react'
import { Check, FileSpreadsheet, Loader2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    activeFormat, fetchReportSettings, newFormat,
    type ReportFormat, type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'
import type { ServiceMapping } from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { PrintPreviewModal, type FieldRow } from '@/app/lms/pages/businessreports/components/PrintPreviewModal'
import { GROUP_SPAN_KEY, groupCellSpans } from '@/app/lms/pages/businessreports/groupSpans'
import ProgramCalendarModeViewToggles from './ProgramCalendarModeViewToggles'
import ProgramCalendarTeachingElements from './ProgramCalendarTeachingElements'
import { exportProgramCalendarWorkbook, isoKeyFor, ROW_TYPE_KEY, type CalendarSheet } from './programCalendarExcel'
import type { ReportTable } from '@/app/lms/pages/servicemapping/components/serviceReport'

export type ProgramCalendarReportRow = {
    /** 'topic' is a regular pedagogy row; 'assessment' is a You-Do
     *  banner that appears BETWEEN topic rows (full-width in the main
     *  Program Calendar table). Both share the same shape so the
     *  paginator can render them interleaved under one Module block. */
    type?: 'topic' | 'assessment'
    module: string
    subModule?: string
    topic: string
    subTopic?: string
    /** Per-activity hours — Assessment counts under `youDoHours`. */
    iDoHours?: number
    weDoHours?: number
    youDoHours?: number
    totalHours: number
    startDate: string
    endDate: string
    /** The teaching block this row opens or continues, mirroring the merged
     *  Total Hours / Start / End cells on the Program Calendar tab:
     *  N on a block's first row (N topic rows share its hours + dates),
     *  0 on the block's later rows (their cells merge into the first row's),
     *  undefined on a row that stands alone. */
    scheduleSpan?: number
    /** The Start / End dates as YYYY-MM-DD, so the Excel export can write
     *  real dates (d-mmm-yy) instead of the display text. */
    startISO?: string
    endISO?: string
    /** ISO date strings (YYYY-MM-DD) for every day this row covers on the
     *  actual calendar. Populated only on the Actual stream and consumed
     *  by the Comparison memo to attach deviation reasons per row. */
    _dayISOs?: string[]
}

/** Row shape for the Planned vs Actual comparison view. Every row has a
 *  Planned date pair; when the joined actual is missing (e.g. cancelled
 *  session or actual not yet marked), the actual date cells stay empty
 *  strings so the on-page and printed tables render an em-dash. */
export type ProgramCalendarComparisonRow = {
    type?: 'topic' | 'assessment'
    module: string
    subModule?: string
    topic: string
    subTopic?: string
    totalHours: number
    plannedStart: string
    plannedEnd: string
    actualStart: string
    actualEnd: string
    /** Joined deviation reason(s) for any actual-calendar day this row
     *  covers — one line per matching deviation. Blank when the row has
     *  no deviations on its actual days (or the row is planned-only). */
    deviation?: string
    /** Teaching-block span, taken from the planned row (see ProgramCalendarReportRow). */
    scheduleSpan?: number
    plannedStartISO?: string
    plannedEndISO?: string
    actualStartISO?: string
    actualEndISO?: string
}

type BatchLite = { _id: string; batchName: string }

type Props = {
    courseName: string
    /** The course's client (e.g. "Synergech"). Printed on the sheet, the PDF and the Excel title band. */
    clientName?: string
    courseCode?: string
    batches: BatchLite[]
    /** Rows to print — legacy prop kept for back-compat; mirrors
     *  `calendarRowsPlanned` when the parent passes both. */
    calendarRows: ProgramCalendarReportRow[]

    // ── Mode + view (shared state owned by the parent) ──
    calendarRowsPlanned: ProgramCalendarReportRow[]
    calendarRowsActual: ProgramCalendarReportRow[]
    /** Joined Planned + Actual rows for Comparison mode. Same order/shape
     *  the main Program Calendar tab's comparison table renders. */
    calendarRowsComparison: ProgramCalendarComparisonRow[]
    calendarMode: 'planned' | 'actual' | 'comparison'
    onCalendarModeChange: (m: 'planned' | 'actual' | 'comparison') => void
    scheduleView: 'table' | 'calendar'
    onScheduleViewChange: (v: 'table' | 'calendar') => void
    /** Whether Actual mode has any data (drives disabling Actual/Comparison
     *  buttons when the course hasn't been marked as attended yet). */
    hasActualData: boolean
    /** Batches — for the Actual view's per-batch selector. */
    selectedActualBatch?: string
    onSelectedActualBatchChange?: (id: string) => void

    // ── Teaching Elements (shared state with the Program Calendar tab) ──
    // Ticking / unticking I Do / We Do / You Do on either tab drives the
    // same flags, so a reader can adjust visibility from either surface and
    // both views (plus the printed sheet) update identically.
    hideIDo: boolean
    hideWeDo: boolean
    hideYouDo: boolean
    setHideIDo: (value: boolean) => void
    setHideWeDo: (value: boolean) => void
    setHideYouDo: (value: boolean) => void
}

/* Same columns the Program Calendar tab's own table carries:
 *   Module / Sub Module / Topic / Sub Topic — hierarchy
 *   I Do Hrs / We Do Hrs / You Do Hrs (Assessment) — per-activity
 *   Total Hours / Start Date / End Date — the schedule
 *
 * Module is CLIENT-scope so it rowspans across the topics AND the
 * assessment banner under it, matching how the calendar renders. Every
 * other column is service-scope — one entry per topic / assessment
 * row. When Module is ticked OFF in Customize Fields the paginator
 * flips to per-row S. No. instead. */
const CALENDAR_FIELDS: FieldRow[] = [
    { key: 'module',     label: 'Module',       required: true, scope: 'client',  column: 'Module',       dataKey: 'client' },
    { key: 'subModule',  label: 'Sub Module',                   scope: 'service', column: 'Sub Module',   dataKey: 'subModule' },
    { key: 'topic',      label: 'Topic',        required: true, scope: 'service', column: 'Topic',        dataKey: 'topic' },
    { key: 'subTopic',   label: 'Sub Topic',                    scope: 'service', column: 'Sub Topic',    dataKey: 'subTopic' },
    { key: 'iDoHours',   label: 'I Do Hrs',                     scope: 'service', column: 'I Do Hrs',     dataKey: 'iDoHours' },
    { key: 'weDoHours',  label: 'We Do Hrs',                    scope: 'service', column: 'We Do Hrs',    dataKey: 'weDoHours' },
    { key: 'youDoHours', label: 'You Do Hrs',                   scope: 'service', column: 'You Do Hrs',   dataKey: 'youDoHours' },
    { key: 'totalHours', label: 'Total Hours',                  scope: 'service', column: 'Total Hours',  dataKey: 'totalHours', mergeGroup: true },
    { key: 'startDate',  label: 'Start Date',                   scope: 'service', column: 'Start Date',   dataKey: 'startDate', mergeGroup: true },
    { key: 'endDate',    label: 'End Date',                     scope: 'service', column: 'End Date',     dataKey: 'endDate', mergeGroup: true },
]

/* Default set — the same five columns the previous version enabled by
 * default, matching the on-page review table's own columns. Sub Module,
 * Sub Topic and the three per-activity hour columns are available in
 * CALENDAR_FIELDS but start unticked; the reader ticks them in
 * Customize Fields when they need the extra detail on the printed
 * sheet. Assessment ROWS still flow through by default — they read
 * under the Topic column as "Assessment" with their own Total Hrs and
 * dates — no field toggle needed to see them. */
const CALENDAR_DEFAULT_ENABLED = new Set(['module', 'topic', 'totalHours', 'startDate', 'endDate'])

/* Field set for the Planned vs Actual comparison print. Same client/service
 *  scope split as the planned/actual fields (Module client-scope so it
 *  rowspans across its topics on the printed sheet) but four date columns
 *  instead of two — planned pair on the left, actual pair on the right. */
const COMPARISON_FIELDS: FieldRow[] = [
    { key: 'module',       label: 'Module',        required: true, scope: 'client',  column: 'Module',        dataKey: 'client' },
    { key: 'topic',        label: 'Topic',         required: true, scope: 'service', column: 'Topic',         dataKey: 'topic' },
    { key: 'totalHours',   label: 'Total Hours',                   scope: 'service', column: 'Total Hours',   dataKey: 'totalHours', mergeGroup: true },
    { key: 'plannedStart', label: 'Planned Start',                 scope: 'service', column: 'Planned Start', dataKey: 'plannedStart', mergeGroup: true },
    { key: 'plannedEnd',   label: 'Planned End',                   scope: 'service', column: 'Planned End',   dataKey: 'plannedEnd', mergeGroup: true },
    { key: 'actualStart',  label: 'Actual Start',                  scope: 'service', column: 'Actual Start',  dataKey: 'actualStart', mergeGroup: true },
    { key: 'actualEnd',    label: 'Actual End',                    scope: 'service', column: 'Actual End',    dataKey: 'actualEnd', mergeGroup: true },
    { key: 'deviation',    label: 'Deviation',                     scope: 'service', column: 'Deviation',     dataKey: 'deviation', mergeGroup: true },
]
const COMPARISON_DEFAULT_ENABLED = new Set(['module', 'topic', 'totalHours', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd', 'deviation'])

/* Group a flat list of report rows into "one block per unique consecutive
 * module" — the same shape PrintPreviewModal / on-page review both consume.
 * Extracted so the Planned and Actual streams reuse the identical grouping
 * without duplicating the loop body. */
function buildBlocks(rows: ProgramCalendarReportRow[]) {
    const grouped: { client: string; business: string; services: Array<Record<string, string>> }[] = []
    for (const row of rows) {
        const moduleName = row.module || '—'
        const isAssessment = row.type === 'assessment'
        const service = {
            subModule:  row.subModule || '',
            topic:      isAssessment ? 'Assessment' : (row.topic || ''),
            subTopic:   row.subTopic || '',
            iDoHours:   (row.iDoHours ?? 0) > 0 ? String(row.iDoHours) : '',
            weDoHours:  (row.weDoHours ?? 0) > 0 ? String(row.weDoHours) : '',
            youDoHours: (row.youDoHours ?? 0) > 0 ? String(row.youDoHours) : '',
            totalHours: row.totalHours > 0 ? String(row.totalHours) : '',
            startDate:  row.startDate || '',
            endDate:    row.endDate || '',
            // Only rows inside a teaching block carry the marker; a lone row
            // omits it, which is what tells the paginator not to merge.
            ...(row.scheduleSpan !== undefined ? { [GROUP_SPAN_KEY]: String(row.scheduleSpan) } : {}),
            // Hidden keys the Excel export reads: real dates + the row kind.
            [isoKeyFor('startDate')]: row.startISO || '',
            [isoKeyFor('endDate')]: row.endISO || '',
            [ROW_TYPE_KEY]: row.type || 'topic',
        }
        const last = grouped[grouped.length - 1]
        if (last && last.client === moduleName) {
            last.services.push(service)
        } else {
            grouped.push({ client: moduleName, business: '', services: [service] })
        }
    }
    return grouped
}

/* Grouping variant for Comparison mode — same "one block per consecutive
 * module" shape as buildBlocks, but each service entry carries the four
 * date fields the comparison print emits (plannedStart / plannedEnd /
 * actualStart / actualEnd). Kept as a separate function so the planned
 * and actual builders don't have to know about comparison fields. */
function buildComparisonBlocks(rows: ProgramCalendarComparisonRow[]) {
    const grouped: { client: string; business: string; services: Array<Record<string, string>> }[] = []
    for (const row of rows) {
        const moduleName = row.module || '—'
        const isAssessment = row.type === 'assessment'
        const service = {
            topic:         isAssessment ? 'Assessment' : (row.topic || ''),
            totalHours:    row.totalHours > 0 ? String(row.totalHours) : '',
            plannedStart:  row.plannedStart || '',
            plannedEnd:    row.plannedEnd || '',
            actualStart:   row.actualStart || '',
            actualEnd:     row.actualEnd || '',
            deviation:     row.deviation || '',
            ...(row.scheduleSpan !== undefined ? { [GROUP_SPAN_KEY]: String(row.scheduleSpan) } : {}),
            [isoKeyFor('plannedStart')]: row.plannedStartISO || '',
            [isoKeyFor('plannedEnd')]:   row.plannedEndISO || '',
            [isoKeyFor('actualStart')]:  row.actualStartISO || '',
            [isoKeyFor('actualEnd')]:    row.actualEndISO || '',
            [ROW_TYPE_KEY]: row.type || 'topic',
        }
        const last = grouped[grouped.length - 1]
        if (last && last.client === moduleName) {
            last.services.push(service)
        } else {
            grouped.push({ client: moduleName, business: '', services: [service] })
        }
    }
    return grouped
}

/* On-page colour key — the same tints the Program Calendar tab and the
 * Excel export use, so a reader recognises a column by colour on every
 * surface: light-blue headers, peach Module, amber Total Hours, green
 * Start, violet End, and yellow-with-red Assessment rows (the TA cells on
 * the team's own Program Calendar sheet). Hex rather than tokens because
 * they have to match the workbook's fills exactly. */
const TINT = {
    header:     { background: '#BDDFFF', color: '#0F172A' },
    planned:    { background: '#F8CBAD', color: '#0F172A' },
    actual:     { background: '#00B0F0', color: '#0F172A' },
    devHead:    { background: '#FECACA', color: '#7F1D1D' },
    module:     { background: '#FFEDD5', color: '#1D4ED8' },
    hours:      { background: '#FEF3C7', color: '#B45309' },
    start:      { background: '#ECFDF5', color: '#047857' },
    end:        { background: '#F5F3FF', color: '#5B21B6' },
    assessment: { background: '#FFFF99', color: '#DC2626' },
} as const

const CELL = 'border border-ink-300 px-3 py-2 align-middle'
const HEAD = 'border border-ink-300 px-3 py-2 text-center align-middle text-[11px] font-bold uppercase tracking-wider'
const WRAP = { wordBreak: 'break-word', overflowWrap: 'anywhere' } as const

type Block = ReturnType<typeof buildBlocks>[number]
type ScheduleCol = { key: string; tint?: keyof typeof TINT; bold?: boolean; left?: boolean }

const SINGLE_COLS: ScheduleCol[] = [
    { key: 'totalHours', tint: 'hours', bold: true },
    { key: 'startDate',  tint: 'start' },
    { key: 'endDate',    tint: 'end' },
]
const COMPARISON_COLS: ScheduleCol[] = [
    { key: 'totalHours',   tint: 'hours', bold: true },
    { key: 'plannedStart', tint: 'start' },
    { key: 'plannedEnd',   tint: 'end' },
    { key: 'actualStart',  tint: 'start' },
    { key: 'actualEnd',    tint: 'end' },
    { key: 'deviation',    left: true },
]

/* The report's on-page table, for all three modes. S. No. + Module merge
 * down each module; the schedule columns (hours, dates, deviation) merge
 * down each teaching block through groupCellSpans, the same rule the
 * printed sheet and the Excel file use, so all three agree cell for cell.
 * Comparison adds the Planned / Actual header band from the P Vs A sheet
 * and flags a moved actual date in amber, a missing one in grey. */
function ScheduleTable({ blocks, comparison }: { blocks: Block[]; comparison?: boolean }) {
    const cols = comparison ? COMPARISON_COLS : SINGLE_COLS
    const carry = { opener: null as Record<string, string> | null }
    return (
        <div className="overflow-hidden rounded-xl border border-ink-300 bg-white">
            <div className="max-w-full overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-xs">
                    <colgroup>
                        <col style={{ width: comparison ? '4%' : '6%' }} />
                        <col style={{ width: comparison ? '14%' : '22%' }} />
                        <col style={{ width: comparison ? '20%' : '32%' }} />
                        <col style={{ width: comparison ? '7%' : '10%' }} />
                        {cols.slice(1).map(c => (
                            <col key={c.key} style={{ width: comparison ? (c.key === 'deviation' ? '15%' : '10%') : '15%' }} />
                        ))}
                    </colgroup>
                    <thead>
                        {comparison ? (
                            <>
                                <tr>
                                    <th rowSpan={2} className={HEAD} style={TINT.header}>S. No.</th>
                                    <th rowSpan={2} className={HEAD} style={TINT.header}>Module</th>
                                    <th rowSpan={2} className={HEAD} style={TINT.header}>Topic</th>
                                    <th rowSpan={2} className={HEAD} style={TINT.header}>Total Hours</th>
                                    <th colSpan={2} className={HEAD} style={TINT.planned}>Planned</th>
                                    <th colSpan={2} className={HEAD} style={TINT.actual}>Actuals</th>
                                    <th rowSpan={2} className={HEAD} style={TINT.devHead}>Deviation</th>
                                </tr>
                                <tr>
                                    <th className={HEAD} style={TINT.header}>Start Date</th>
                                    <th className={HEAD} style={TINT.header}>End Date</th>
                                    <th className={HEAD} style={TINT.header}>Start Date</th>
                                    <th className={HEAD} style={TINT.header}>End Date</th>
                                </tr>
                            </>
                        ) : (
                            <tr>
                                <th className={HEAD} style={TINT.header}>S. No.</th>
                                <th className={HEAD} style={TINT.header}>Module</th>
                                <th className={HEAD} style={TINT.header}>Topic</th>
                                <th className={HEAD} style={TINT.header}>Total Hours</th>
                                <th className={HEAD} style={TINT.header}>Start Date</th>
                                <th className={HEAD} style={TINT.header}>End Date</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {blocks.map((block, blockIdx) => {
                            const spans = groupCellSpans(block.services, carry)
                            return block.services.map((svc, topicIdx) => {
                                const isFirst = topicIdx === 0
                                const sched = spans[topicIdx]
                                const src = sched.source
                                const isAssessment = svc[ROW_TYPE_KEY] === 'assessment'
                                // Comparison drift, judged on the block's opener.
                                const hasActual = Boolean(src.actualStart || src.actualEnd)
                                const cancelled = comparison && !hasActual && Boolean(src.plannedStart)
                                const moved = comparison && hasActual && (src.actualStart !== src.plannedStart || src.actualEnd !== src.plannedEnd)
                                return (
                                    <tr key={`${blockIdx}-${topicIdx}`}>
                                        {isFirst && (
                                            <td rowSpan={block.services.length} className={`${CELL} text-center font-bold tabular-nums text-ink-700`}>
                                                {blockIdx + 1}
                                            </td>
                                        )}
                                        {isFirst && (
                                            <td rowSpan={block.services.length} className={`${CELL} font-bold`} style={{ ...TINT.module, ...WRAP }}>
                                                {block.client || '—'}
                                            </td>
                                        )}
                                        <td
                                            className={`${CELL} ${isAssessment ? 'font-bold' : 'text-body'}`}
                                            style={{ ...(isAssessment ? TINT.assessment : {}), ...WRAP }}
                                        >
                                            {svc.topic || '—'}
                                        </td>
                                        {sched.rowSpan > 0 && cols.map(col => {
                                            const value = src[col.key] || ''
                                            const isActualCol = col.key === 'actualStart' || col.key === 'actualEnd'
                                            const tint = isAssessment ? TINT.assessment : col.tint ? TINT[col.tint] : undefined
                                            const drift = isActualCol && !isAssessment
                                                ? cancelled ? { color: '#94A3B8' } : moved ? { background: '#FEF3C7', color: '#B45309' } : {}
                                                : {}
                                            return (
                                                <td
                                                    key={col.key}
                                                    rowSpan={sched.rowSpan}
                                                    className={`${CELL} whitespace-pre-line ${col.left ? 'text-left text-[11px]' : 'text-center'} ${col.bold || isAssessment || (isActualCol && moved) ? 'font-bold' : 'font-medium'} ${col.key === 'totalHours' ? 'tabular-nums' : ''}`}
                                                    style={{ ...tint, ...drift, ...(col.key === 'deviation' && value ? { color: '#B91C1C', background: '#FFF1F2' } : {}), ...WRAP }}
                                                >
                                                    {value || '—'}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default function ProgramCalendarReportTab({
    courseName,
    clientName,
    courseCode,
    batches,
    calendarRows,
    calendarRowsPlanned,
    calendarRowsActual,
    calendarRowsComparison,
    calendarMode,
    onCalendarModeChange,
    scheduleView,
    onScheduleViewChange,
    hasActualData,
    selectedActualBatch,
    onSelectedActualBatchChange,
    hideIDo,
    hideWeDo,
    hideYouDo,
    setHideIDo,
    setHideWeDo,
    setHideYouDo,
}: Props) {
    const [selectedBatchId, setSelectedBatchId] = useState<string>('')
    const [printOpen, setPrintOpen] = useState(false)
    // Excel export asks which calendars to include; each becomes its own sheet.
    const [excelChooser, setExcelChooser] = useState<{ table: ReportTable } | null>(null)
    const [excelModes, setExcelModes] = useState<Set<'planned' | 'actual' | 'comparison'>>(new Set())
    const [excelBusy, setExcelBusy] = useState(false)

    /* ── Letterhead + saved design (same pattern CourseReportPage uses) ──
     *  One fetch per mount, silent fall-back to the built-in layout /
     *  brand wording when neither exists so a missing setting can never
     *  block the report. */
    const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>()
    const [letterhead, setLetterhead] = useState<{ org: string; address: string; contact: string }>(BRAND_FALLBACK)
    useEffect(() => {
        const institutionId = typeof window === 'undefined' ? null : localStorage.getItem('smartcliff_institution')
        if (!institutionId) return
        let cancelled = false
        fetchReportSettings(institutionId)
            .then((settings) => { if (!cancelled) setReportSettings(settings) })
            .catch(() => { /* plain layout */ })
        fetchInstitutionById(institutionId)
            .then((institution) => {
                if (cancelled) return
                setLetterhead({
                    org: institution?.inst_name?.trim() || BRAND_FALLBACK.org,
                    address: institution?.address?.trim() || '',
                    contact: institution?.phone?.trim() || '',
                })
            })
            .catch(() => { /* fallback wording */ })
        return () => { cancelled = true }
    }, [])

    const initialFormat: ReportFormat = useMemo(
        () => activeFormat(reportSettings) ?? newFormat('Report layout', false),
        [reportSettings],
    )

    /* With no batches the calendar shows directly; with batches the reader
     *  must pick one first — the sheet then carries that batch's name.
     *  Nothing renders (or prints) until a selection has been made. */
    const hasBatches = batches.length > 0
    const canRender = !hasBatches || Boolean(selectedBatchId)
    const selectedBatchName = hasBatches
        ? batches.find(b => b._id === selectedBatchId)?.batchName || ''
        : ''

    /* Row source per mode:
     *   planned    → calendarRowsPlanned
     *   actual     → calendarRowsActual
     *   comparison → planned rows drive Print (see printMeta.scope note);
     *                the on-page review renders BOTH tables stacked so
     *                the reader can eyeball drift before deciding.
     *
     * The legacy `calendarRows` prop mirrors calendarRowsPlanned when the
     * parent passes both — kept in the type surface for callers that
     * haven't been updated to the new prop names yet. */
    const rowsForMode = calendarMode === 'actual'
        ? calendarRowsActual
        : calendarRowsPlanned.length ? calendarRowsPlanned : calendarRows
    const plannedBlocks = useMemo(
        () => (canRender ? buildBlocks(calendarRowsPlanned.length ? calendarRowsPlanned : calendarRows) : []),
        [canRender, calendarRowsPlanned, calendarRows],
    )
    const actualBlocks = useMemo(
        () => (canRender ? buildBlocks(calendarRowsActual) : []),
        [canRender, calendarRowsActual],
    )
    const comparisonBlocks = useMemo(
        () => (canRender ? buildComparisonBlocks(calendarRowsComparison) : []),
        [canRender, calendarRowsComparison],
    )
    /* Blocks the Print button feeds to the modal — Planned in Planned mode,
     *  Actual in Actual mode, and the joined comparison blocks (planned +
     *  actual date pairs per row) in Comparison mode so the printed sheet
     *  carries all four date columns under one table. */
    const blocks = calendarMode === 'actual'
        ? actualBlocks
        : calendarMode === 'comparison'
            ? comparisonBlocks
            : plannedBlocks

    const modeLabel = calendarMode === 'actual'
        ? 'Actual'
        : calendarMode === 'comparison'
            ? 'Planned vs Actual'
            : 'Planned'
    const calendarTitle = (label: string) => `${clientName ? `${clientName} - ` : ''}Program Calendar (${label})`
    const fileBaseFor = (label?: string) => `${[clientName, 'Program Calendar', label].filter(Boolean).join(' ')}`
        .replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + `-${new Date().toISOString().slice(0, 10)}`
    const exportFileBase = fileBaseFor(modeLabel)
    const printMeta = useMemo(() => ({
        // Line 1 "Synergech - Program Calendar (Planned)": who and which
        // calendar. Line 2 ".NET Full Stack · All batches": what, for whom.
        // Nothing appears on both lines.
        title: `${clientName ? `${clientName} - ` : ''}Program Calendar (${modeLabel})`,
        scope: [courseName || 'Course', selectedBatchName || (hasBatches ? '' : 'All batches')].filter(Boolean).join(' · '),
        generated: new Date().toLocaleString(),
        filters: '',
        ...letterhead,
    }), [clientName, courseName, selectedBatchName, hasBatches, modeLabel, letterhead])

    /* Modal snapshot expects `rows: ServiceMapping[]`. Nothing in this
     *  report is a service mapping, so an empty list is the honest answer;
     *  the modal reads its rows off `blocks` above, not off `snapshot`. */
    const snapshot = { draft: {}, rows: [] as ServiceMapping[], generated: printMeta.generated }

    /* When the reader flips to Actual/Comparison and the courseHasBatches,
     *  the Reports tab's local batch picker (which controls the print
     *  sheet's title) should follow the shared Actual batch — otherwise
     *  the on-page review reads one batch while the print header names
     *  another. */
    useEffect(() => {
        if (calendarMode === 'planned') return
        if (!hasBatches) return
        if (!selectedActualBatch || selectedActualBatch === 'all') return
        if (selectedActualBatch !== selectedBatchId && batches.some(b => b._id === selectedActualBatch)) {
            setSelectedBatchId(selectedActualBatch)
        }
    }, [calendarMode, hasBatches, selectedActualBatch, selectedBatchId, batches])

    /* Row set the on-page review is looking at right now — drives the
     *  empty-state message and the Print button's disabled state. */
    const hasAnyRowsForMode = calendarMode === 'comparison'
        ? calendarRowsComparison.length > 0
        : rowsForMode.length > 0

    /* Fields the Print modal offers — pruned by the Teaching Elements
     * toggles so unticking I Do hides the I Do Hrs column from the printed
     * sheet (and its Customize Fields list) rather than surfacing zeros.
     * Assessment rows are already filtered upstream via hideYouDo in the
     * report memos, so youDoHours only carries meaningful values when
     * hideYouDo is off. */
    const filteredCalendarFields = useMemo(
        () => CALENDAR_FIELDS.filter(f => {
            if (f.key === 'iDoHours'   && hideIDo)   return false
            if (f.key === 'weDoHours'  && hideWeDo)  return false
            if (f.key === 'youDoHours' && hideYouDo) return false
            return true
        }),
        [hideIDo, hideWeDo, hideYouDo],
    )

    return (
        <div className="space-y-4">
            {/* ── Mode + view toggles (shared state with the Program
                Calendar tab). Rendered above every other control so
                the reader picks WHAT they want to see before they
                pick WHICH batch. */}
            <ProgramCalendarModeViewToggles
                mode={calendarMode}
                onModeChange={onCalendarModeChange}
                hasActualData={hasActualData}
                batches={batches.map(b => ({ value: b._id, label: b.batchName }))}
                batch={selectedActualBatch}
                onBatchChange={onSelectedActualBatchChange}
                showViewToggle={calendarMode === 'planned' && (calendarRowsPlanned.length > 0 || calendarRows.length > 0)}
                view={scheduleView}
                onViewChange={onScheduleViewChange}
            />

            {/* ── Batch picker + Teaching Elements + print action ─────
                A course with batches must pick one first; a batchless
                course goes straight to the calendar + Print. Teaching
                Elements sits alongside so the reader can tick / untick
                I Do / We Do / You Do without leaving the Reports tab. */}
            <div className="flex items-center gap-2 flex-wrap">
                {hasBatches && (
                    <>
                        <label className="text-[12px] font-semibold text-heading">Batch:</label>
                        <select
                            value={selectedBatchId}
                            onChange={e => setSelectedBatchId(e.target.value)}
                            className="h-8 rounded-control border border-hairline-strong bg-white px-2.5 text-[12px] font-medium text-body"
                        >
                            <option value="">Select a batch</option>
                            {batches.map(batch => (
                                <option key={batch._id} value={batch._id}>{batch.batchName}</option>
                            ))}
                        </select>
                    </>
                )}
                {/* Shared Teaching Elements dropdown — same UI as the
                    Program Calendar tab, wired to the same state. */}
                <div className={hasBatches ? '' : 'ml-0'}>
                    <ProgramCalendarTeachingElements
                        hideIDo={hideIDo}
                        hideWeDo={hideWeDo}
                        hideYouDo={hideYouDo}
                        setHideIDo={setHideIDo}
                        setHideWeDo={setHideWeDo}
                        setHideYouDo={setHideYouDo}
                    />
                </div>
                <div className="ml-auto">
                    <Button
                        type="button"
                        size="sm"
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                        disabled={!canRender || blocks.length === 0}
                        onClick={() => setPrintOpen(true)}
                    >
                        <Printer className="size-3.5" />Preview &amp; Print
                    </Button>
                </div>
            </div>

            {/* ── Calendar grid view: the Reports tab is a print-oriented
                surface, and the calendar grid does not paginate cleanly.
                Rather than duplicating that renderer here, we point the
                reader back to the Program Calendar tab and offer a
                one-click switch to Table view for previewing / printing.
                Only shown in Planned mode — the toggle itself is hidden
                for Actual / Comparison already. */}
            {calendarMode === 'planned' && scheduleView === 'calendar' ? (
                <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-6 py-10 text-center space-y-3">
                    <p className="text-sm font-semibold text-ink-700">Calendar grid view is on the Program Calendar tab</p>
                    <p className="text-xs text-ink-400">
                        The Reports tab prints the tabular schedule — switch to Table view to preview and print.
                    </p>
                    <Button type="button" size="sm" className="text-xs" onClick={() => onScheduleViewChange('table')}>
                        Switch to Table view
                    </Button>
                </div>
            ) : !canRender ? (
                <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-ink-700">Pick a batch to view its Program Calendar</p>
                    <p className="text-xs text-ink-400 mt-1">The report needs a batch before it can print.</p>
                </div>
            ) : !hasAnyRowsForMode ? (
                <div className="rounded-xl border border-dashed border-hairline bg-canvas/30 px-6 py-10 text-center">
                    <p className="text-sm text-subtle">
                        {calendarMode === 'planned'
                            ? 'No calendar generated yet — set a start date on the Program Calendar tab first.'
                            : calendarMode === 'actual'
                                ? 'No actual attendance recorded yet — mark attendance from the Program Calendar tab to populate this view.'
                                : 'Comparison needs both a planned and an actual calendar — mark attendance on the Program Calendar tab first.'}
                    </p>
                </div>
            ) : calendarMode === 'comparison' ? (
                /* Comparison: ONE table with grouped Planned + Actual date
                 * columns plus a Deviation column, mirroring the main
                 * Program Calendar tab's comparison view. Deviation text
                 * per row is joined from every actual-calendar day the
                 * row covers whose date matches a recorded deviation. */
                <ScheduleTable blocks={comparisonBlocks} comparison />
            ) : (
                <ScheduleTable blocks={blocks} />
            )}

            {/* Course code hint under the table, matches the breadcrumb. */}
            {courseCode && (
                <p className="text-[11px] text-faint">{clientName && <>Client: <span className="font-semibold text-body">{clientName}</span> · </>}Course: {courseName} <span className="font-mono">({courseCode})</span></p>
            )}

            {excelChooser && (() => {
                const options = ([
                    { mode: 'planned', label: 'Planned', hint: 'The schedule as planned', blocks: plannedBlocks },
                    { mode: 'actual', label: 'Actual', hint: 'What actually ran, after deviations', blocks: actualBlocks },
                    { mode: 'comparison', label: 'Planned vs Actual', hint: 'Both side by side, with deviations', blocks: comparisonBlocks },
                ] as const).map((o) => ({ ...o, available: o.blocks.length > 0 }))
                const chosen = options.filter((o) => o.available && excelModes.has(o.mode))
                const toggle = (mode: 'planned' | 'actual' | 'comparison') => setExcelModes((prev) => {
                    const next = new Set(prev)
                    if (next.has(mode)) next.delete(mode); else next.add(mode)
                    return next
                })
                // The sheet for the calendar on screen reuses the preview's
                // table, so the columns the reader ticked there carry over.
                // The others use that calendar's default columns.
                const tableFor = (mode: 'planned' | 'actual' | 'comparison', modeBlocks: typeof plannedBlocks): ReportTable => {
                    if (mode === calendarMode) return excelChooser.table
                    const fields = mode === 'comparison' ? COMPARISON_FIELDS : filteredCalendarFields
                    const enabled = mode === 'comparison' ? COMPARISON_DEFAULT_ENABLED : CALENDAR_DEFAULT_ENABLED
                    const cols = fields.filter((f) => enabled.has(f.key))
                    return {
                        headers: ['S. No.', ...cols.map((c) => c.column)],
                        rows: [],
                        columns: cols.map((c) => ({ key: c.dataKey, scope: c.scope, ...(c.mergeGroup ? { mergeGroup: true } : {}) })),
                        groups: modeBlocks,
                    }
                }
                const runExport = async () => {
                    if (!chosen.length) return
                    setExcelBusy(true)
                    try {
                        const sheets: CalendarSheet[] = chosen.map((o) => ({
                            name: o.label,
                            table: tableFor(o.mode, o.blocks),
                            meta: { ...printMeta, title: calendarTitle(o.label) },
                        }))
                        await exportProgramCalendarWorkbook(sheets, fileBaseFor(chosen.length === 1 ? chosen[0].label : undefined))
                        setExcelChooser(null)
                    } finally {
                        setExcelBusy(false)
                    }
                }
                return (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/40 p-4" onClick={() => { if (!excelBusy) setExcelChooser(null) }}>
                        <div role="dialog" aria-modal="true" aria-labelledby="excel-chooser-title" className="w-full max-w-md rounded-xl border border-hairline bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700"><FileSpreadsheet size={18} /></span>
                                <div className="min-w-0 flex-1">
                                    <h3 id="excel-chooser-title" className="text-[15px] font-semibold text-heading">Export to Excel</h3>
                                    <p className="text-[12.5px] text-subtle">Pick the calendars to include. Each one becomes its own sheet, so you can switch between them with the tabs at the bottom of Excel.</p>
                                </div>
                                <button type="button" onClick={() => setExcelChooser(null)} disabled={excelBusy} aria-label="Close" className="rounded-md p-1 text-subtle hover:bg-row-hover"><X size={16} /></button>
                            </div>
                            <div className="space-y-2 px-5 py-4">
                                {options.map((o) => {
                                    const on = o.available && excelModes.has(o.mode)
                                    return (
                                        <button key={o.mode} type="button" role="checkbox" aria-checked={on} disabled={!o.available} onClick={() => toggle(o.mode)}
                                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-[#EE6A22] bg-[#FFF8F2]' : 'border-hairline hover:bg-row-hover'}`}>
                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[#EE6A22] bg-[#EE6A22] text-white' : 'border-slate-300 bg-white'}`}>
                                                {on && <Check size={11} strokeWidth={3} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13.5px] font-semibold text-heading">{o.label}{o.mode === calendarMode && <span className="ml-1.5 text-[11px] font-medium text-subtle">(on screen)</span>}</span>
                                                <span className="block text-[12px] text-subtle">{o.available ? o.hint : 'No data yet: mark attendance on the Program Calendar tab first'}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-hairline bg-canvas px-5 py-3">
                                <span className="mr-auto text-[12px] text-subtle">{chosen.length} sheet{chosen.length === 1 ? '' : 's'}</span>
                                <Button type="button" variant="outline" size="sm" onClick={() => setExcelChooser(null)} disabled={excelBusy}>Cancel</Button>
                                <Button type="button" size="sm" onClick={runExport} disabled={!chosen.length || excelBusy} className="bg-success-700 text-white hover:bg-success-700/90">
                                    {excelBusy ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Export
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            <PrintPreviewModal
                open={printOpen}
                onClose={() => setPrintOpen(false)}
                snapshot={snapshot}
                blocks={blocks}
                letterhead={letterhead}
                initialFormat={initialFormat}
                meta={printMeta}
                fields={calendarMode === 'comparison' ? COMPARISON_FIELDS : filteredCalendarFields}
                defaultEnabled={calendarMode === 'comparison' ? COMPARISON_DEFAULT_ENABLED : CALENDAR_DEFAULT_ENABLED}
                // Merged, colour-coded workbook laid out like the team's own
                // Program Calendar / P Vs Actuals sheets, not the flat export.
                // One name for every export: "Synergech-Program-Calendar-Actual-2026-09-25".
                filenameBase={exportFileBase}
                // Excel asks which calendars to include (see the chooser above);
                // the preview's table is kept for the calendar on screen.
                exportExcel={async (table) => {
                    setExcelModes(new Set([calendarMode]))
                    setExcelChooser({ table })
                }}
            />
        </div>
    )
}
