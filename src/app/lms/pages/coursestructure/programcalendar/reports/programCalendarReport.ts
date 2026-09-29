import type { Cell, PaperSize, Worksheet } from 'exceljs'
import type { CellDef, RowInput, Styles } from 'jspdf-autotable'
import {
    buildCalendarReportTable,
    buildCalendarSummaryTable,
    hoursFromMinutes,
    segmentMinutes,
    type CalendarReportStructure,
    type CalendarReportTable,
    type ReportCell,
    type ReportTableRow,
} from './calendarReportTable'
import { getReportCellStyle, REPORT_FONT, REPORT_GRID, REPORT_MODULE_FONT } from './calendarReportStyles'

export type CalendarReportView = 'planned' | 'actual' | 'comparison'
export type CalendarHierarchy = 'Module' | 'Sub Module' | 'Topic' | 'Sub Topic'
export type CalendarDetailKey = 'courseName' | 'courseId' | 'clientName' | 'businessModel' | 'serviceModel' | 'providingYear'
export type CalendarScheduleRow = {
    module: string
    subModule: string
    topic: string
    subTopic: string
    activity: string
    type: 'iDo' | 'weDo' | 'youDo' | 'assessmentGap'
    hours: number
    date: Date
    startMins: number
    endMins: number
    slotName: string
}
export type CalendarReportSource = {
    planned: CalendarScheduleRow[]
    actual: CalendarScheduleRow[]
    hierarchy: CalendarHierarchy[]
    details: Record<CalendarDetailKey, string>
    deviations: { date: string; reason: string }[]
    batchName?: string
    structure?: CalendarReportStructure
}
export type CalendarReportOptions = {
    views: CalendarReportView[]
    hierarchy: CalendarHierarchy[]
    details: CalendarDetailKey[]
    includeSummary: boolean
    includeDeviations: boolean
}
/* Every renderer works from `table` (and `summary.table`). There is no second,
   flattened copy of the data any more: one shape is what stops Excel, PDF,
   print and the on-screen preview from disagreeing about what the report says. */
export type CalendarReportSection = {
    view: CalendarReportView
    title: string
    metadata: { label: string; value: string }[]
    table: CalendarReportTable
    summary?: { table: CalendarReportTable }
    note?: string
}

export const VIEW_OPTIONS: { value: CalendarReportView; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'actual', label: 'Actual' },
    { value: 'comparison', label: 'Planned vs Actual' },
]
export const HIERARCHY_OPTIONS: { value: CalendarHierarchy; label: string }[] = [
    { value: 'Module', label: 'Module' },
    { value: 'Sub Module', label: 'Sub Module' },
    { value: 'Topic', label: 'Topic' },
    { value: 'Sub Topic', label: 'Sub Topic' },
]
export const DETAIL_OPTIONS: { value: CalendarDetailKey; label: string }[] = [
    { value: 'courseName', label: 'Course name' },
    { value: 'courseId', label: 'Course ID' },
    { value: 'clientName', label: 'Client name' },
    { value: 'businessModel', label: 'Business model' },
    { value: 'serviceModel', label: 'Service model' },
    { value: 'providingYear', label: 'Providing year' },
]

const textValue = (value?: string) => value?.trim() || '—'
const EMPTY_MESSAGE = 'No schedule entries for this view.'

/** The optional per-module hours block. Sums the schedule rather than the
 *  configured pedagogy hours so it always agrees with the main table's totals;
 *  assessmentGap entries move the calendar on but teach nothing. */
function moduleSummary(rows: CalendarScheduleRow[], comparison: boolean) {
    const modules = new Map<string, number>()
    let totalMinutes = 0
    for (const row of rows) {
        if (row.type === 'assessmentGap') continue
        const moduleName = row.module?.trim() && row.module !== '-' ? row.module.trim() : 'Unspecified module'
        const minutes = segmentMinutes(row)
        modules.set(moduleName, (modules.get(moduleName) || 0) + minutes)
        totalMinutes += minutes
    }
    return {
        headers: ['Module', comparison ? 'Planned Total Hours' : 'Total Hours'],
        rows: [...modules].map(([module, minutes]): (string | number)[] => [module, hoursFromMinutes(minutes)])
            .concat([['Grand total', hoursFromMinutes(totalMinutes)]]),
    }
}

export function buildCalendarReport(source: CalendarReportSource, options: CalendarReportOptions): CalendarReportSection[] {
    const metadata = DETAIL_OPTIONS.filter(({ value }) => options.details.includes(value))
        .map(({ value, label }) => ({ label, value: textValue(source.details[value]) }))

    return VIEW_OPTIONS.filter(({ value }) => options.views.includes(value)).map(({ value: view, label }) => {
        const summary = options.includeSummary
            ? moduleSummary(view === 'actual' ? source.actual : source.planned, view === 'comparison')
            : undefined
        return {
            view,
            title: label,
            metadata: metadata.map((item) => ({ ...item })),
            table: buildCalendarReportTable(source, options, view),
            ...(summary ? { summary: { table: buildCalendarSummaryTable(summary) } } : {}),
            ...(view !== 'planned' ? { note: `Actual shows the rescheduled calendar${source.batchName ? ` for ${source.batchName}` : ''}.` } : {}),
        }
    })
}

function safeFilename(filename: string) {
    return filename.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '-').replace(/\.(xlsx|pdf)$/i, '').replace(/[. ]+$/g, '').trim().slice(0, 140) || 'program-calendar-report'
}

function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Excel ───────────────────────────────────────────────────────────────────

const INK = 'FF000000'
const MUTED = 'FF657084'
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`
const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }

function styleExcelCell(cell: Cell, reportCell: ReportCell, kind?: ReportTableRow['kind']) {
    const style = getReportCellStyle(reportCell, kind)
    // The module column carries the heavier face the reference sheet uses for
    // the course name running down the left edge; everything else is Calibri 11.
    const face = !reportCell.header && (reportCell.tone === 'module' || reportCell.tone === 'subModule')
        ? REPORT_MODULE_FONT : REPORT_FONT
    cell.font = { name: face.name, size: face.size, color: { argb: argb(style.color) }, bold: style.bold }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(style.background) } }
    cell.alignment = { vertical: 'middle', horizontal: style.align, wrapText: true }
    const border = { style: 'thin' as const, color: { argb: argb(style.borderColor) } }
    cell.border = { top: border, left: border, right: border, bottom: border }
    if (typeof cell.value === 'number') cell.numFmt = '0.##'
}

function addExcelTable(sheet: Worksheet, table: CalendarReportTable) {
    const startRow = sheet.rowCount + 1
    const rows = [
        ...table.headers.map((cells) => ({ cells, kind: undefined })),
        ...table.rows,
    ]
    // Allocate the full grid before merging. This retains every outer border
    // in Excel and keeps PDF/HTML row and column spans identical.
    rows.forEach((row, index) => {
        const excelRow = sheet.getRow(startRow + index)
        excelRow.height = index < table.headers.length ? 28 : 30
        for (let column = 0; column < table.columnCount; column++) {
            const cell = excelRow.getCell(column + 1)
            cell.value = ''
            styleExcelCell(cell, { value: '', column, tone: 'plain' }, row.kind)
        }
    })
    rows.forEach((row, index) => row.cells.forEach((cell) => {
        const rowNumber = startRow + index
        const column = cell.column + 1
        const rowSpan = cell.rowSpan || 1
        const colSpan = cell.colSpan || 1
        if (rowSpan > 1 || colSpan > 1) sheet.mergeCells(rowNumber, column, rowNumber + rowSpan - 1, column + colSpan - 1)
        const target = sheet.getCell(rowNumber, column)
        target.value = cell.value
        styleExcelCell(target, cell, row.kind)
        const width = Array.from({ length: colSpan }, (_, offset) => sheet.getColumn(column + offset).width || 24).reduce((sum, value) => sum + value, 0)
        const lineCount = String(cell.value).split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / Math.max(1, width - 2))), 0)
        const height = Math.min(400, (lineCount * 15 + 12) / rowSpan)
        for (let offset = 0; offset < rowSpan; offset++) {
            const excelRow = sheet.getRow(rowNumber + offset)
            excelRow.height = Math.max(excelRow.height || 30, height)
        }
    }))
    return startRow
}

function addExcelSection(sheet: Worksheet, section: CalendarReportSection) {
    const table = section.table
    sheet.columns = table.columnWidths.map((width) => ({ width }))
    // "<Client> : <Course> Course Structure - <view>", carried across the full
    // width in one merged, bordered, centred cell.
    const detail = (label: string) => {
        const value = section.metadata.find((entry) => entry.label === label)?.value
        return value && value !== '—' ? value : ''
    }
    const heading = [
        [detail('Client name'), detail('Course name')].filter(Boolean).join(' : ') || 'Program calendar',
        'Course Structure -', section.title,
    ].join(' ')
    const title = sheet.addRow([heading])
    sheet.mergeCells(title.number, 1, title.number, table.columnCount)
    title.height = 30
    for (let column = 1; column <= table.columnCount; column++) {
        const cell = title.getCell(column)
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN }
    }
    // Any remaining course/client details sit under the title on one line each,
    // outside the grid so the table below still starts on a clean band.
    for (const entry of section.metadata) {
        if (entry.label === 'Client name' || entry.label === 'Course name') continue
        const row = sheet.addRow([entry.label, entry.value])
        if (table.columnCount > 2) sheet.mergeCells(row.number, 2, row.number, table.columnCount)
        row.height = 20
        row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
        row.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: INK } }
        row.getCell(2).alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
    }
    if (section.note) {
        const note = sheet.addRow([section.note])
        sheet.mergeCells(note.number, 1, note.number, table.columnCount)
        note.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED } }
        note.getCell(1).alignment = { wrapText: true, vertical: 'middle' }
        note.height = 22
    }
    const headerRow = addExcelTable(sheet, table)
    const lastHeaderRow = headerRow + table.headers.length - 1
    sheet.views = [{ state: 'frozen', ySplit: lastHeaderRow, activeCell: `A${lastHeaderRow + 1}`, showGridLines: false }]
    if (!table.rows.length) {
        const empty = sheet.addRow([EMPTY_MESSAGE])
        sheet.mergeCells(empty.number, 1, empty.number, table.columnCount)
    }
    if (section.summary) {
        sheet.addRow([])
        sheet.addRow([])
        const banner = sheet.addRow(['Module Summary'])
        const width = section.summary.table.columnCount
        banner.height = 22
        // Style every cell in the band, then merge. Writing a value into a
        // merged slave cell propagates to the master, so blanking the tail
        // after merging would erase the caption.
        for (let column = 1; column <= width; column++) {
            const cell = banner.getCell(column)
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb('#FF33CC') } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN }
        }
        sheet.mergeCells(banner.number, 1, banner.number, width)
        addExcelTable(sheet, section.summary.table)
    }
    // A3 (8) is a valid Excel paper code that exceljs' PaperSize enum omits, so
    // the wide-table case has to be cast in rather than named.
    sheet.pageSetup = {
        paperSize: (table.columnCount > 12 ? 8 : 9) as PaperSize,
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        printTitlesRow: `${headerRow}:${lastHeaderRow}`,
        printArea: `A1:${sheet.getColumn(table.columnCount).letter}${sheet.rowCount}`,
    }
    sheet.headerFooter.oddFooter = '&LProgram calendar&RPage &P of &N'
}

// ─── Print ───────────────────────────────────────────────────────────────────

function escaped(value: string | number) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** The same grid the preview draws, as standalone HTML. Cells carry their own
 *  colours and borders inline so the stylesheet never has to know the palette,
 *  and print-color-adjust keeps the browser from helpfully dropping every fill
 *  on the way to the printer. */
function printTable(table: CalendarReportTable, summary = false): string {
    const cellHtml = (cell: ReportCell, kind: ReportTableRow['kind'] | undefined, header: boolean) => {
        const style = getReportCellStyle(cell, kind)
        const tag = header ? 'th' : 'td'
        const spans = `${cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''}${cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''}`
        const css = `background:${style.background};color:${style.color};font-weight:${style.bold ? 700 : 400};text-align:${style.align};border:${style.borderWidth}px solid ${style.borderColor}`
        return `<${tag}${spans} style="${css}">${escaped(cell.value)}</${tag}>`
    }
    const units = table.columnWidths.reduce((sum, width) => sum + width, 0) || 1
    const cols = table.columnWidths.map((width) => `<col style="width:${(width / units * 100).toFixed(3)}%">`).join('')
    const head = table.headers.map((row) => `<tr>${row.map((cell) => cellHtml(cell, undefined, true)).join('')}</tr>`).join('')
    const body = table.rows.length
        ? table.rows.map((row) => `<tr>${row.cells.map((cell) => cellHtml(cell, row.kind, false)).join('')}</tr>`).join('')
        : `<tr><td class="empty" colspan="${table.columnCount}">${EMPTY_MESSAGE}</td></tr>`
    return `<table class="${summary ? 'summary' : 'grid'}"><colgroup>${cols}</colgroup><thead>${head}</thead><tbody>${body}</tbody></table>`
}

function printReport(sections: CalendarReportSection[], filename: string) {
    const popup = window.open('', '_blank')
    if (!popup) throw new Error('Allow pop-ups to open the print preview, then try again.')
    popup.opener = null
    const widest = Math.max(...sections.map((section) => section.table.columnCount), 1)
    const body = sections.map((section) => `<section><h1>Program calendar <span>· ${escaped(section.title)}</span></h1>${section.metadata.length ? `<dl>${section.metadata.map(({ label, value }) => `<div><dt>${escaped(label)}</dt><dd>${escaped(value)}</dd></div>`).join('')}</dl>` : ''}${section.note ? `<p class="note">${escaped(section.note)}</p>` : ''}${printTable(section.table)}${section.summary ? `<h2>Hours summary</h2>${printTable(section.summary.table, true)}` : ''}</section>`).join('')
    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaped(filename)}</title><style>
        @page{size:${widest > 12 ? 'A3' : 'A4'} landscape;margin:10mm}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:${widest > 14 ? 8 : widest > 10 ? 9 : 10}px}
        section+section{break-before:page}
        h1{font-size:19px;margin:0 0 10px}h1 span{font-weight:400}
        h2{font-size:12px;margin:16px 0 6px}
        dl{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 10px}dl div{display:flex;gap:6px}
        dt,.note{color:#657084}dd{margin:0;font-weight:600}.note{margin:0 0 10px}
        /* table-layout:fixed plus the colgroup is what stops one long deviation
           note from stretching its column off the edge of the page. */
        table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 10px;font-variant-numeric:tabular-nums}
        /* Repeats the grouped header band at the top of every printed page. */
        thead{display:table-header-group}
        tr{break-inside:avoid}
        th,td{padding:5px 4px;vertical-align:middle;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;line-height:1.4}
        .summary{width:52%;max-width:520px;break-inside:avoid}
        .empty{padding:26px;text-align:center;color:#657084;border:1px solid ${REPORT_GRID}}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
        @media screen{body{padding:22px;max-width:1700px;margin:auto}section+section{margin-top:34px}}
        </style></head><body>${body}</body></html>`)
    popup.document.close()
    popup.addEventListener('afterprint', () => popup.close(), { once: true })
    setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print() } }, 250)
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const rgb = (hex: string): [number, number, number] => {
    const value = hex.replace('#', '')
    const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value.padEnd(6, '0')
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

/** One report cell as an autotable cell. autotable shares the table's "emit
 *  only the starting cell" convention, so spans carry across untouched and the
 *  PDF grid lines up with Excel, print and the preview. */
function pdfCell(cell: ReportCell, kind?: ReportTableRow['kind']): CellDef {
    const style = getReportCellStyle(cell, kind)
    return {
        content: String(cell.value ?? ''),
        ...(cell.colSpan && cell.colSpan > 1 ? { colSpan: cell.colSpan } : {}),
        ...(cell.rowSpan && cell.rowSpan > 1 ? { rowSpan: cell.rowSpan } : {}),
        styles: {
            fillColor: rgb(style.background),
            textColor: rgb(style.color),
            fontStyle: style.bold ? 'bold' : 'normal',
            halign: style.align,
            lineColor: rgb(style.borderColor),
            lineWidth: Math.max(0.3, style.borderWidth * 0.5),
        },
    }
}

function pdfSection(table: CalendarReportTable, usableWidth: number) {
    const units = table.columnWidths.reduce((sum, width) => sum + width, 0) || 1
    const columnStyles: Record<number, Partial<Styles>> = {}
    table.columnWidths.forEach((width, index) => { columnStyles[index] = { cellWidth: usableWidth * width / units } })
    const head: RowInput[] = table.headers.map((row) => row.map((cell) => pdfCell(cell)))
    const body: RowInput[] = table.rows.length
        ? table.rows.map((row) => row.cells.map((cell) => pdfCell(cell, row.kind)))
        : [[{ content: EMPTY_MESSAGE, colSpan: table.columnCount, styles: { halign: 'center', textColor: rgb('#657084'), lineColor: rgb(REPORT_GRID), lineWidth: 0.4 } }]]
    return { head, body, columnStyles }
}

export async function exportCalendarReport(format: 'excel' | 'pdf' | 'print', sections: CalendarReportSection[], filename: string): Promise<void> {
    if (!sections.length) throw new Error('Select at least one report view.')
    const safeName = safeFilename(filename)
    if (format === 'print') {
        printReport(sections, safeName)
        return
    }
    if (format === 'excel') {
        const ExcelJS = (await import('exceljs')).default
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'Program Calendar'
        workbook.created = new Date()
        // One workbook, one worksheet per selected view.
        for (const section of sections) addExcelSection(workbook.addWorksheet(VIEW_OPTIONS.find(({ value }) => value === section.view)!.label), section)
        const buffer = await workbook.xlsx.writeBuffer()
        download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName}.xlsx`)
        return
    }
    const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const widest = Math.max(...sections.map((section) => section.table.columnCount), 1)
    const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: widest > 12 ? 'a3' : 'a4' })
    // Wide grids get thinner margins rather than thinner columns — past about
    // fourteen columns it is the text that runs out of room first.
    const margin = widest > 14 ? 20 : 32
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const usableWidth = pageWidth - margin * 2
    const fontSize = widest > 14 ? 6 : widest > 10 ? 7 : 8

    sections.forEach((section, index) => {
        if (index) doc.addPage()
        let y = margin + 12
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(23, 32, 51)
        doc.text(`Program calendar - ${section.title}`, margin, y)
        y += 20
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(101, 112, 132)
        for (const entry of section.metadata) {
            const lines: string[] = doc.splitTextToSize(`${entry.label}: ${entry.value}`, usableWidth)
            doc.text(lines, margin, y); y += lines.length * 12 + 3
        }
        if (section.note) {
            const lines: string[] = doc.splitTextToSize(section.note, usableWidth)
            doc.text(lines, margin, y); y += lines.length * 12 + 5
        }
        const main = pdfSection(section.table, usableWidth)
        autoTable(doc, {
            startY: y + 5,
            head: main.head,
            body: main.body,
            columnStyles: main.columnStyles,
            tableWidth: usableWidth,
            margin: { top: margin, left: margin, right: margin, bottom: margin + 14 },
            styles: { font: 'helvetica', fontSize, cellPadding: 3.5, overflow: 'linebreak', valign: 'middle', lineColor: rgb(REPORT_GRID), lineWidth: 0.4 },
            // 'auto' rather than 'avoid': a hierarchy cell merged down a whole
            // module can be taller than a page, and refusing to split it would
            // push the block off the end instead of continuing it overleaf.
            rowPageBreak: 'auto',
            showHead: 'everyPage',
        })
        if (section.summary) {
            const endY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y
            let summaryY = endY + 20
            if (summaryY > pageHeight - 120) { doc.addPage(); summaryY = margin + 12 }
            const summaryWidth = Math.min(400, usableWidth / 2)
            const summaryTable = pdfSection(section.summary.table, summaryWidth)
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(23, 32, 51)
            doc.text('Hours summary', margin, summaryY)
            autoTable(doc, {
                startY: summaryY + 6,
                head: summaryTable.head,
                body: summaryTable.body,
                columnStyles: summaryTable.columnStyles,
                tableWidth: summaryWidth,
                margin: { top: margin, left: margin, right: margin, bottom: margin + 14 },
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'middle', lineColor: rgb(REPORT_GRID), lineWidth: 0.4 },
                rowPageBreak: 'auto',
                showHead: 'everyPage',
            })
        }
    })
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(101, 112, 132)
        doc.text('Program calendar', margin, pageHeight - 16)
        doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
    }
    doc.save(`${safeName}.pdf`)
}
