// Program Calendar ▸ Excel export.
//
// The shared designed export writes one flat, unmerged row per record: right
// for Business Reports (filter/sort friendly), wrong for a program calendar,
// which people read and send as a laid-out sheet. This builds the workbook
// the team already hand-makes (see the Synergech "Program Calender" and
// "P Vs Actuals" sheets it was modelled on):
//   · a pink title band across every column
//   · light-blue bold column headers; in Planned vs Actual, a group row
//     above them (Planned / Actuals) exactly like the P Vs A sheet
//   · S. No. + Module merged down each module, Total Hours / dates merged
//     down each teaching block (same spans as the on-page table and print)
//   · Assessment rows in yellow with red bold text, like the TA cells
//   · real Excel dates formatted d-mmm-yy, thin borders on every cell
//
// It takes the SAME ReportTable the print preview built, so the columns the
// reader ticked, and their order, are the columns that land in the file.

import { saveAs } from 'file-saver'
import type { ReportColumn, ReportTable } from '@/app/lms/pages/servicemapping/components/serviceReport'
import type { ReportMeta } from '@/app/lms/pages/businessreports/designedExport'
import { groupCellSpans } from '@/app/lms/pages/businessreports/groupSpans'

// Hidden per-row keys the report tab writes next to the display text.
export const ROW_TYPE_KEY = '__rowType'
export const isoKeyFor = (dataKey: string) => `__${dataKey}ISO`

// ── Palette (ARGB). Title / header / Planned / Actuals / assessment colours
//    are lifted from the reference sheets; the column tints match the
//    Program Calendar tab so screen and file read the same. ──
const C = {
    title: 'FFF5B8D0',
    header: 'FFBDDFFF',
    planned: 'FFF8CBAD',
    actual: 'FF00B0F0',
    deviationHead: 'FFFECACA',
    module: 'FFFFEDD5',
    hours: 'FFFEF3C7',
    start: 'FFECFDF5',
    end: 'FFF5F3FF',
    assessment: 'FFFFFF99',
    red: 'FFFF0000',
    ink: 'FF1F2937',
    moduleText: 'FF1D4ED8',
    hoursText: 'FFB45309',
    border: 'FF000000',
    deviationText: 'FFB91C1C',
}

const DATE_KEYS = new Set(['startDate', 'endDate', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'])
const PLANNED_KEYS = new Set(['plannedStart', 'plannedEnd'])
const ACTUAL_KEYS = new Set(['actualStart', 'actualEnd'])
const NUMBER_KEYS = new Set(['totalHours', 'iDoHours', 'weDoHours', 'youDoHours'])
const LEFT_KEYS = new Set(['client', 'topic', 'subModule', 'subTopic', 'deviation'])

const WIDTHS: Record<string, number> = {
    client: 30, subModule: 24, topic: 56, subTopic: 30,
    iDoHours: 11, weDoHours: 11, youDoHours: 11, totalHours: 12,
    startDate: 16, endDate: 16, plannedStart: 16, plannedEnd: 16, actualStart: 16, actualEnd: 16,
    deviation: 42,
}

const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const thin = { style: 'thin' as const, color: { argb: C.border } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

/** "2026-04-15" → a UTC Date, so Excel shows 15-Apr-26 in every time zone. */
function isoToDate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
}

export type CalendarSheet = { name: string; table: ReportTable; meta: ReportMeta }

/** One file, one sheet per calendar (Planned / Actual / Planned vs Actual),
 *  so the reader switches views with Excel's own sheet tabs. */
export async function exportProgramCalendarWorkbook(sheets: CalendarSheet[], filename: string) {
    if (!sheets.length) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = sheets[0].meta.org || 'EduLMS'
    wb.created = new Date()
    const used = new Set<string>()
    for (const sheet of sheets) {
        // Excel sheet names: at most 31 chars, none of \ / * ? : [ ], unique.
        let name = (sheet.name || 'Program Calendar').replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Sheet'
        for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`
        used.add(name.toLowerCase())
        addCalendarSheet(wb, sheet.table, sheet.meta, name)
    }
    const buffer = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`)
}

export async function exportProgramCalendarExcel(table: ReportTable, meta: ReportMeta, filename: string) {
    await exportProgramCalendarWorkbook([{ name: meta.title || 'Program Calendar', table, meta }], filename)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addCalendarSheet(wb: any, table: ReportTable, meta: ReportMeta, sheetName: string) {
    const ws = wb.addWorksheet(sheetName, {
        views: [{ showGridLines: false }],
    })

    const columns: ReportColumn[] = table.columns ?? []
    const colCount = 1 + columns.length
    // Excel column index (1-based) for columns[i]; S. No. is column 1.
    const xl = (i: number) => i + 2

    const isComparison = columns.some(c => PLANNED_KEYS.has(c.key) || ACTUAL_KEYS.has(c.key))
    const hasClientColumn = columns.some(c => c.scope === 'client')

    const styleCell = (r: number, c: number, opts: {
        bg?: string; color?: string; bold?: boolean; size?: number; h?: 'left' | 'center'; numFmt?: string
    }) => {
        const cell = ws.getCell(r, c)
        cell.border = BORDER
        cell.alignment = { horizontal: opts.h ?? 'center', vertical: 'middle', wrapText: true }
        cell.font = { name: 'Calibri', size: opts.size ?? 11, bold: opts.bold ?? false, color: { argb: opts.color ?? C.ink } }
        if (opts.bg) cell.fill = fill(opts.bg)
        if (opts.numFmt) cell.numFmt = opts.numFmt
        return cell
    }
    // Merge a range after every cell in it is styled, so borders and fills
    // survive on the merged block's edges.
    const merge = (r1: number, c1: number, r2: number, c2: number) => {
        if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2)
    }

    // ── Title band ──
    let row = 1
    for (let c = 1; c <= colCount; c++) styleCell(row, c, { bg: C.title, bold: true, size: 16 })
    ws.getCell(row, 1).value = [meta.org, meta.title, meta.scope].filter(Boolean).join('\n')
    merge(row, 1, row, colCount)
    ws.getRow(row).height = 66
    row++

    // ── Header: a Planned / Actuals group row above the labels in comparison
    //    mode (non-grouped headers merge down through both rows). ──
    const headerTop = row
    const headerRows = isComparison ? 2 : 1
    const labelRow = headerTop + headerRows - 1
    for (let c = 1; c <= colCount; c++) {
        for (let r = headerTop; r <= labelRow; r++) styleCell(r, c, { bg: C.header, bold: true, size: 12 })
    }
    // Under a Planned / Actuals band "Planned Start" reads as just "Start Date".
    table.headers.forEach((label, i) => {
        ws.getCell(labelRow, i + 1).value = isComparison ? label.replace(/^(Planned|Actual) (Start|End)$/, '$2 Date') : label
    })
    if (isComparison) {
        const band = (keys: Set<string>, text: string, bg: string) => {
            const idx = columns.map((c, i) => (keys.has(c.key) ? xl(i) : -1)).filter(i => i > 0)
            if (!idx.length) return
            for (const c of idx) styleCell(headerTop, c, { bg, bold: true, size: 13 })
            ws.getCell(headerTop, idx[0]).value = text
            merge(headerTop, idx[0], headerTop, idx[idx.length - 1])
        }
        band(PLANNED_KEYS, 'Planned', C.planned)
        band(ACTUAL_KEYS, 'Actuals', C.actual)
        // Everything outside the two bands spans both header rows.
        for (let c = 1; c <= colCount; c++) {
            const key = c === 1 ? '' : columns[c - 2].key
            if (PLANNED_KEYS.has(key) || ACTUAL_KEYS.has(key)) continue
            ws.getCell(headerTop, c).value = ws.getCell(labelRow, c).value
            if (key === 'deviation') for (let r = headerTop; r <= labelRow; r++) ws.getCell(r, c).fill = fill(C.deviationHead)
            merge(headerTop, c, labelRow, c)
        }
    }
    for (let r = headerTop; r <= labelRow; r++) ws.getRow(r).height = 24
    row = labelRow + 1

    // ── Body ──
    let serial = 0
    const carry = { opener: null as Record<string, string> | null }
    for (const block of table.groups ?? []) {
        const blockTop = row
        const spans = groupCellSpans(block.services, carry)
        if (hasClientColumn) serial++

        block.services.forEach((service, sIdx) => {
            if (!hasClientColumn) serial++
            const isAssessment = service[ROW_TYPE_KEY] === 'assessment'
            const span = spans[sIdx]

            // S. No.
            styleCell(row, 1, { bold: hasClientColumn })
            if (sIdx === 0 || !hasClientColumn) ws.getCell(row, 1).value = serial

            columns.forEach((col, i) => {
                const c = xl(i)
                const merges = col.scope === 'service' && col.mergeGroup
                const src = merges ? span.source : service
                const assessmentCell = isAssessment && col.scope === 'service'
                const base = {
                    h: LEFT_KEYS.has(col.key) ? 'left' as const : 'center' as const,
                    bg: assessmentCell ? C.assessment
                        : col.scope === 'client' ? C.module
                        : col.key === 'totalHours' ? C.hours
                        : col.key === 'startDate' || col.key === 'plannedStart' || col.key === 'actualStart' ? C.start
                        : col.key === 'endDate' || col.key === 'plannedEnd' || col.key === 'actualEnd' ? C.end
                        : undefined,
                    color: assessmentCell ? C.red
                        : col.scope === 'client' ? C.moduleText
                        : col.key === 'totalHours' ? C.hoursText
                        : col.key === 'deviation' ? C.deviationText
                        : C.ink,
                    bold: assessmentCell || col.scope === 'client' || col.key === 'totalHours',
                }
                const cell = styleCell(row, c, base)

                // Covered cells (below a merged opener) stay empty but styled.
                if (col.scope === 'client' && sIdx > 0) return
                if (merges && span.rowSpan === 0) return

                const raw = col.scope === 'client'
                    ? (col.key === 'client' ? block.client : col.key === 'business' ? block.business : block.clientExtras?.[col.key] ?? '')
                    : (src[col.key] ?? '')
                if (DATE_KEYS.has(col.key)) {
                    const d = isoToDate(src[isoKeyFor(col.key)] ?? '')
                    if (d) { cell.value = d; cell.numFmt = 'd-mmm-yy'; return }
                }
                if (NUMBER_KEYS.has(col.key) && raw !== '' && !Number.isNaN(Number(raw))) {
                    cell.value = Number(raw)
                    return
                }
                cell.value = raw || '—'
            })

            // Merge this teaching block's cells down from its opener.
            if (span.rowSpan > 1) {
                columns.forEach((col, i) => {
                    if (col.scope === 'service' && col.mergeGroup) merge(row, xl(i), row + span.rowSpan - 1, xl(i))
                })
            }
            row++
        })

        // S. No. and client-scope (Module) cells merge down the whole block.
        if (hasClientColumn && row - 1 > blockTop) {
            merge(blockTop, 1, row - 1, 1)
            columns.forEach((col, i) => { if (col.scope === 'client') merge(blockTop, xl(i), row - 1, xl(i)) })
        }
    }

    // ── Column widths + frozen header ──
    ws.getColumn(1).width = 7
    columns.forEach((col, i) => { ws.getColumn(xl(i)).width = WIDTHS[col.key] ?? 16 })
    ws.views = [{ state: 'frozen', ySplit: labelRow, showGridLines: false }]
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
}
