import type { ReportClientBlock, ReportTable } from '@/app/lms/pages/servicemapping/components/serviceReport'
import { PAPER_MM, type ReportElement, type ReportFormat } from '@/app/lms/pages/reportsettings/api/reportSettingsService'

/** One cell in a spanned data row. `text` prints; `rowSpan` merges the cell
 *  downward across N rows. `null` in a row's cell array means "this position
 *  is already covered by a rowspan from a previous row on this page — do
 *  not render an element here". */
export type SpanCell = { text: string; rowSpan: number }

/** One rendered line inside the table box.
 *  - `band` is a legacy full-width section heading (used when a table has
 *    `sections` but no `groups`; kept so anything that was rendering the
 *    section-based layout keeps working during the transition).
 *  - `cells` is a data row of one cell per column, with rowspan info per
 *    cell. `null` cells are skipped by the renderer. */
export type ReportLine = { band?: string; cells?: (SpanCell | null)[] }

/** Paginated shape shared between the on-screen preview and the print/PDF
 *  paths — same box, same rows-per-page, same page count, so what the
 *  reader sees in the preview is what the file actually contains. */
export type PaginatedReport = {
    pages: ReportLine[][]
    /** Table box in millimetres, on the physical sheet. */
    box: { top: number; left: number; width: number; height: number }
    /** The table's OWN layout box in millimetres — the space the grid is
     *  laid out in before any rotation is applied. Equal to `box` when the
     *  table is upright; width and height are swapped when it is turned,
     *  because a rotated grid flows along the box's short edge. Renderers
     *  size the table to this, then rotate it into `box`. */
    layout: { width: number; height: number }
    /** Whether the table (and only the table) is turned 90° in its box. */
    tableRotated: boolean
    /** Sheet size (accounting for orientation). */
    wMm: number
    hMm: number
    rowsPerPage: number
    totalPages: number
    /** How many BLANK ruled rows each page should draw after its real
     *  data rows so the table's grid continues to the box's edge even
     *  when the paginator did not pack the box row-for-row. The reader
     *  designs a table box of a given height; if their content only
     *  fills part of it, an all-white strip inside the design's own
     *  border reads as a rendering bug. Filling that strip with empty
     *  rows of the same 5.2 mm min-height makes the box read as
     *  "ruled paper with unused rows at the bottom" — the same
     *  behaviour every renderer honours off this array so the canvas,
     *  the preview and the printed sheet all end at the same line. */
    fillers: number[]
}

/** Height of one row in millimetres — used to lay out the table on both the
 *  preview and the print sheet. Kept as a shared constant so a change in
 *  one place cannot silently make the two disagree. */
export const REPORT_ROW_MM = 5.2

/** Extra millimetres each wrapped line beyond the first adds to a row.
 *  8.5pt with line-height 1.2 comes out just over 3.5 mm per line on both
 *  the browser preview and the print sheet. Used by the wrap-aware
 *  paginator below so a page's rows-per-page count matches what actually
 *  fits after long cells break across lines. */
const REPORT_WRAP_LINE_MM = 3.5

/** Approximate millimetres per character at 8.5 pt Arial — the type the
 *  table renders in. Empirical fit against a browser measurement; sits a
 *  hair on the conservative side so a slightly under-wide column errs on
 *  "wraps" instead of "packs another row that will spill". */
const REPORT_CHAR_MM = 1.55

/** Guess how many millimetres tall a single data row will actually be
 *  once its cells wrap to fit their column widths. Reads the widest cell
 *  across the row: the row grows to the tallest cell, so that is the one
 *  that decides the row's height. */
function estimateRowMm(cellTexts: string[], widthsPct: number[], tableWidthMm: number): number {
    let maxLines = 1
    for (let i = 0; i < cellTexts.length; i++) {
        const width = widthsPct[i]
        if (!width) continue
        // 2 mm of padding gutter and the border stroke, subtracted from
        // the column's own width. `Math.max` guards a very narrow column
        // against a divide-by-zero if the reader designed it that way.
        const colWidthMm = Math.max(1, (width / 100) * tableWidthMm - 2)
        const charsPerLine = Math.max(1, Math.floor(colWidthMm / REPORT_CHAR_MM))
        const linesNeeded = Math.max(1, Math.ceil((cellTexts[i] || '').length / charsPerLine))
        if (linesNeeded > maxLines) maxLines = linesNeeded
    }
    return REPORT_ROW_MM + (maxLines - 1) * REPORT_WRAP_LINE_MM
}

export type ReportColumnRole =
    | 'sno' | 'client' | 'business' | 'service' | 'year' | 'status'
    | 'clientId' | 'contactNumber' | 'email' | 'address' | 'contactPerson'
    | 'city' | 'state' | 'pincode' | 'generated'
    | 'code' | 'category' | 'course' | 'other'

/** Preferred column widths, in "share" units. The renderer normalises the
 *  chosen columns' shares to 100 so any subset of columns fills the page
 *  without leaving a strip of empty white on the right. Applied via a
 *  `<colgroup>` in HTML (so `table-layout: fixed` lays the columns out
 *  identically in the browser and the print sheet) and via
 *  `columnStyles.cellWidth` in autoTable (so the PDF measures the same
 *  distances). One source, no drift. */
export const REPORT_COLUMN_WIDTHS: Record<ReportColumnRole, number> = {
    sno: 7,
    client: 30,
    business: 22,
    service: 20,
    year: 12,
    // Client-level extras — squeezed to keep the total near 100 with the
    // defaults. The normaliser handles the exact fit at render time.
    clientId: 12,
    contactNumber: 14,
    email: 20,
    address: 22,
    contactPerson: 16,
    city: 13,
    state: 14,
    pincode: 10,
    status: 10,
    generated: 16,
    // Service-level extras
    code: 12,
    category: 14,
    course: 20,
    // Fallback
    other: 12,
}

/** What the column carries — used to line up alignment, wrapping and
 *  width the same way in every renderer. Header-label matching so a
 *  header rename doesn't silently drop the width for that column. */
export function reportColumnRole(header: string, columnIndex: number): ReportColumnRole {
    if (columnIndex === 0) return 'sno'
    const label = (header || '').toLowerCase()
    // Order matters: the more specific labels are tested first so
    // "Client ID" and "Client Status" don't fall into the plain
    // "client" bucket, and "Contact Person" doesn't land in the
    // phone-number bucket.
    if (label.includes('client id')) return 'clientId'
    if (label.includes('contact person')) return 'contactPerson'
    if (label.includes('status')) return 'status'
    if (label.includes('pincode') || label.includes('pin code')) return 'pincode'
    if (label.includes('city')) return 'city'
    if (label.includes('state')) return 'state'
    if (label.includes('address')) return 'address'
    if (label.includes('email')) return 'email'
    if (label.includes('phone') || label.includes('contact')) return 'contactNumber'
    if (label.includes('business')) return 'business'
    if (label.includes('service code') || label === 'code') return 'code'
    if (label.includes('category')) return 'category'
    if (label.includes('course')) return 'course'
    if (label.includes('client')) return 'client'
    if (label.includes('service')) return 'service'
    if (label.includes('year')) return 'year'
    if (label.includes('generated')) return 'generated'
    return 'other'
}

export function reportColumnWidths(headers: string[]): number[] {
    // Sum the preferred shares, then normalise to 100 so whatever subset
    // of columns is on screen still fills the sheet.
    const raw = headers.map((header, index) => REPORT_COLUMN_WIDTHS[reportColumnRole(header, index)] ?? REPORT_COLUMN_WIDTHS.other)
    const total = raw.reduce((sum, w) => sum + w, 0) || 1
    return raw.map((w) => (w / total) * 100)
}

/* Render a report THROUGH a saved design.
 *
 * Report Settings stores a page as positioned elements in percent. This turns
 * that into the two things people actually take away: a PDF and a print
 * preview. Both read the same design, so what the editor showed is what comes
 * out — which is the whole point of having an editor.
 *
 * Percent is converted late, once the real page size is known, so one design
 * prints correctly at A4 or Letter without being re-drawn.
 */

const MM_TO_PT = 2.834645

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Page size in points, honouring orientation. */
function pageSizePt(format: ReportFormat) {
    const paper = PAPER_MM[format.page.size]
    const landscape = format.page.orientation === 'landscape'
    const wMm = landscape ? paper.height : paper.width
    const hMm = landscape ? paper.width : paper.height
    return { width: wMm * MM_TO_PT, height: hMm * MM_TO_PT, wMm, hMm }
}

/** Substitutions a design can reference without knowing the data.
 *
 *  Split in two on purpose. `scope`, `generated` and `title` describe THIS
 *  report; `org`, `address` and `contact` describe WHO IS PRINTING IT and come
 *  from the institution's own record. Keeping the letterhead as tokens rather
 *  than typed-in literals means one saved design prints correctly for any
 *  institution using it, and an address corrected in Institution Management
 *  reaches every report without anyone reopening the canvas. */
export type ReportMeta = {
    scope: string
    generated: string
    title?: string
    org?: string
    address?: string
    contact?: string
    /** What the reader narrowed the report to, in words — e.g.
     *  "Filtered by  ·  Business Model: B2I  ·  Offering Year: 2024–2026".
     *  EMPTY when nothing was narrowed: a report that covers everything
     *  shouldn't carry a line claiming a filter was applied, and the
     *  element printing `{filters}` renders nothing for an empty token,
     *  so the sheet simply closes the gap. */
    filters?: string
}

/** An unresolved token prints as NOTHING, never as a literal "{address}" —
 *  an institution with no address on file should get a letterhead with a blank
 *  line, not one advertising the gap. Exported so the preview renderer can
 *  fill the exact same substitutions the PDF and print paths use. */
export const fillTokens = (value: string, meta: ReportMeta) => (value ?? '')
    .replace(/\{scope\}/gi, meta.scope)
    .replace(/\{generated\}/gi, meta.generated)
    .replace(/\{title\}/gi, meta.title || '')
    .replace(/\{org\}/gi, meta.org || '')
    .replace(/\{address\}/gi, meta.address || '')
    .replace(/\{contact\}/gi, meta.contact || '')
    .replace(/\{filters\}/gi, meta.filters || '')
    .trim()

const fill = fillTokens

/** The shared page-break plan.
 *
 *  Given a design and a table, decide where each row lands on the sheet.
 *  The preview renders exactly this; so does the print sheet builder below.
 *  A change here reaches both, which is the point — a preview that promises
 *  three pages and a printer that spits out four is a bug against the
 *  workflow's central agreement with the reader. */
export function paginateReport(format: ReportFormat, table: ReportTable): PaginatedReport {
    const paper = PAPER_MM[format.page.size]
    const landscape = format.page.orientation === 'landscape'
    const wMm = landscape ? paper.height : paper.width
    const hMm = landscape ? paper.width : paper.height
    const tableEl = format.elements.find((element) => element.kind === 'table')

    const box = tableEl
        ? {
            top: (tableEl.y / 100) * hMm,
            left: (tableEl.x / 100) * wMm,
            width: (tableEl.w / 100) * wMm,
            height: (tableEl.h / 100) * hMm,
        }
        : {
            top: format.page.marginTop,
            left: format.page.marginLeft,
            width: wMm - format.page.marginLeft - format.page.marginRight,
            height: hMm - format.page.marginTop - format.page.marginBottom,
        }

    /* The table's own layout box. Upright, it matches the box on the
     * sheet. Turned 90°, the grid is laid out in a swapped box and then
     * rotated into place — so its "down the page" axis is the box's
     * WIDTH, which is what rows-per-page has to be measured against. */
    const tableRotated = Boolean(table.tableRotated)
    const layout = tableRotated
        ? { width: box.height, height: box.width }
        : { width: box.width, height: box.height }

    // The header takes one min-height row. What is left is the vertical
    // budget every data row has to share, which the wrap-aware packer
    // below consumes one row at a time. Kept as a millimetre budget
    // rather than a "how many rows" count so a row that grew to two
    // lines counts as two lines' worth, not one — that is what fixes
    // the 17-vs-13 mismatch the reader was seeing between the print
    // sheet and the editor canvas.
    const availableMm = Math.max(REPORT_ROW_MM, layout.height - REPORT_ROW_MM)
    // Column widths in percent, cached once — the wrap estimator runs
    // for every row so a memo saves a couple of Kilobytes of allocation
    // over a long report.
    const widthsPct = reportColumnWidths(table.headers)
    // A last-resort ceiling for the still-widely-used legacy path below,
    // which just counts rows.
    const rowsPerPage = Math.max(1, Math.floor(availableMm / REPORT_ROW_MM))

    /* Grouped layout — Client + Business Model + any enabled client-level
     * extra columns render once per block, spanning the client's services
     * with rowSpan. When a block splits across a page break, ALL rowspan
     * cells are re-emitted on the new page with a fresh rowSpan for that
     * page's slice; without the re-emit the second page would show a bare
     * row with no client identifier at all.
     *
     * The number of rowspan columns depends on `table.clientColumns` (the
     * extras). The number of per-row columns depends on
     * `table.serviceColumns`. Both default to sensible legacy values so
     * callers that predate this generalization still work. */
    /** How many blank ruled rows a page needs after its data rows to
     *  reach the box's bottom edge. `used` is the millimetres already
     *  consumed by data rows (grouped path) or by count × min-height
     *  (legacy path). Rounded UP so the last blank row over-shoots by
     *  a fraction — the wrapper's overflow-hidden clips it, which is
     *  fine, and the grid reaches the box's own border rather than
     *  stopping a hair above it. Never negative: a page that already
     *  spilled just reports 0. */
    const fillerRowsFor = (usedMm: number) =>
        Math.max(0, Math.ceil((availableMm - usedMm) / REPORT_ROW_MM))

    const pages: ReportLine[][] = []
    const fillers: number[] = []
    if (table.groups?.length) {
        /* Columns in the reader's chosen order, each carrying its scope.
         * When `table.columns` is supplied (the new mixed-order path
         * PrintPreviewModal now uses), the paginator honours it exactly
         * — a service-level column that the reader put ABOVE a client
         * one in the sidebar lands to the LEFT of that client column on
         * the sheet. Old callers that only pass clientColumns /
         * serviceColumns still get the classic client-first-then-service
         * layout for back-compat. */
        const columns: { key: string; scope: 'client' | 'service' }[] = table.columns ?? [
            ...(table.clientColumns ?? ['client', 'business']).map((key) => ({ key, scope: 'client' as const })),
            ...(table.serviceColumns ?? ['serviceModel', 'year']).map((key) => ({ key, scope: 'service' as const })),
        ]

        /** Read a client-level cell's value off the block. Client Name and
         *  Business Model live on the block directly; every other key
         *  comes from `clientExtras`. This is why the reorderer can put
         *  Client ID before Client Name — the layout doesn't care which
         *  key sits where. */
        const resolveClient = (block: ReportClientBlock, key: string): string => {
            if (key === 'client') return block.client
            if (key === 'business') return block.business
            return block.clientExtras?.[key] ?? ''
        }

        let current: ReportLine[] = []
        let currentHeightMm = 0
        let serial = 0
        let anchor: ReportLine | null = null

        for (const block of table.groups) {
            // One serial per CLIENT BLOCK, not per service. A client with
            // five services shares one S. No. that rowspans down its five
            // rows — the same way Client Name and Business Model already
            // do. Asking "which client is row 19?" only makes sense if
            // row 19 identifies a client, not one of its services.
            serial += 1
            anchor = null

            for (const service of block.services) {
                /* Estimate how tall this row will actually be after its
                 * cells wrap to fit their columns. The row heights are
                 * summed against `availableMm` — as soon as the next row
                 * would overflow the box, the page breaks and the block's
                 * rowspan restarts (below). This is why 17 rows without
                 * wrapping become e.g. 13 rows with wrapping: the packer
                 * respects the actual visual height of each row rather
                 * than the min-height of 5.2 mm. Same estimator runs for
                 * every renderer that reads `paginated.pages`, so the
                 * count matches on the canvas, in the preview, on the
                 * print sheet and in the PDF. */
                const rowTexts = [
                    String(serial),
                    ...columns.map((col) => col.scope === 'client'
                        ? (resolveClient(block, col.key) || '—')
                        : (String(service[col.key] ?? '') || '—')),
                ]
                const rowHeightMm = estimateRowMm(rowTexts, widthsPct, layout.width)

                if (current.length > 0 && currentHeightMm + rowHeightMm > availableMm) {
                    pages.push(current)
                    // Record the blank rows this page needs to reach the
                    // box's bottom edge — the paginator knew how much of
                    // its budget the data rows spent, so nobody else has
                    // to guess it downstream.
                    fillers.push(fillerRowsFor(currentHeightMm))
                    current = []
                    currentHeightMm = 0
                    // Restart the block's rowspan on the new page: the
                    // paginator re-emits every merged cell (S. No.
                    // included) at the top of the next page so a client
                    // split across the break still shows its identifier
                    // above the continuation rows.
                    anchor = null
                }

                if (!anchor) {
                    // Anchor row for this block. Every client-scope cell
                    // starts life at rowSpan 1 and grows below as more
                    // services join the block; every service-scope cell
                    // sits at rowSpan 1 for its own row only. Cells are
                    // emitted in the reader's chosen column order.
                    const cells: SpanCell[] = columns.map((col) => col.scope === 'client'
                        ? { text: resolveClient(block, col.key) || '—', rowSpan: 1 }
                        : { text: (service[col.key] ?? '') || '—', rowSpan: 1 })
                    const row: ReportLine = {
                        cells: [
                            { text: String(serial), rowSpan: 1 },
                            ...cells,
                        ],
                    }
                    current.push(row)
                    anchor = row
                } else {
                    // Continuation rows carry only the service-scope
                    // cells; each client-scope position (and S. No.)
                    // renders as `null`, which the printer / preview /
                    // mini-table all skip because the anchor's rowspan
                    // already covers that slot.
                    const cells: (SpanCell | null)[] = columns.map((col) => col.scope === 'client'
                        ? null
                        : { text: (service[col.key] ?? '') || '—', rowSpan: 1 })
                    current.push({
                        cells: [
                            null,
                            ...cells,
                        ],
                    })
                    // Grow S. No. and every client-scope cell on the
                    // anchor by one row.
                    const anchorCells = anchor.cells!
                    const snoCell = anchorCells[0] as SpanCell
                    anchorCells[0] = { text: snoCell.text, rowSpan: snoCell.rowSpan + 1 }
                    for (let i = 0; i < columns.length; i++) {
                        if (columns[i].scope !== 'client') continue
                        const cell = anchorCells[1 + i] as SpanCell
                        anchorCells[1 + i] = { text: cell.text, rowSpan: cell.rowSpan + 1 }
                    }
                }
                // Charge the row's estimated height to this page's
                // budget. The next iteration checks the running total
                // against `availableMm` before deciding to keep going
                // or break to a new page.
                currentHeightMm += rowHeightMm
            }
        }
        if (current.length) {
            pages.push(current)
            fillers.push(fillerRowsFor(currentHeightMm))
        }
        if (!pages.length) {
            pages.push([])
            fillers.push(fillerRowsFor(0))
        }
    } else {
        // Legacy path — sections or plain rows, mapped as single-row
        // cells with rowSpan 1 so the renderer only needs one code path.
        const wrap = (cells: string[]): (SpanCell | null)[] => cells.map((text) => ({ text, rowSpan: 1 }))
        const lines: ReportLine[] = table.sections?.length
            ? table.sections.flatMap((section) => [
                ...(section.title ? [{ band: `${section.title}${section.subtitle ? ` — ${section.subtitle}` : ''}` }] : []),
                ...section.rows.map((cells) => ({ cells: wrap(cells) })),
            ])
            : table.rows.map((cells) => ({ cells: wrap(cells) }))

        for (let i = 0; i < lines.length; i += rowsPerPage) {
            const slice = lines.slice(i, i + rowsPerPage)
            pages.push(slice)
            // Every row is treated as one min-height on this path, so
            // the filler count is whatever the rowsPerPage budget did
            // not spend — usually 0 on full pages, positive on the tail.
            fillers.push(fillerRowsFor(slice.length * REPORT_ROW_MM))
        }
        if (!pages.length) {
            pages.push([])
            fillers.push(fillerRowsFor(0))
        }
    }

    return { pages, box, layout, tableRotated, wMm, hMm, rowsPerPage, totalPages: pages.length, fillers }
}

/* A watermark is drawn on ONE line, and neither renderer will wrap it: jsPDF is
   handed `maxWidth: undefined` for rotated text because it cannot wrap along an
   angle, and the print sheet clips at the element's box. So a long organisation
   name — "{org}" resolves to whatever is on the institution's record — would
   come out cut mid-word on paper and running off the edge of the PDF.

   Rather than let either happen, the type is stepped DOWN until the line fits.
   Both outputs run the same arithmetic on the same box, so they still agree,
   which is the entire point of designing the page once.

   The estimate: Helvetica (the PDF face) and Arial (the print face) are
   metrically compatible, uppercase averages a shade over 0.6 em a character,
   and the watermark's 0.08 em letter-spacing rides on top — 0.78 em all in.
   Measured against the browser on a 29-character name it lands within 2%.
   It only ever shrinks; a name that already fits keeps the size the designer
   chose on the canvas. */
const WATERMARK_EM = 0.78

const watermarkFontSize = (element: ReportElement, text: string, boxWidthPt: number) => {
    if (!text) return element.fontSize
    const needed = text.length * WATERMARK_EM * element.fontSize
    // 0.96 keeps the last glyph off the box edge, where the rotation puts it
    // closest to the paper's own margin.
    const room = boxWidthPt * 0.96
    if (needed <= room) return element.fontSize
    return Math.max(8, room / (text.length * WATERMARK_EM))
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function exportDesignedPdf(
    format: ReportFormat,
    table: ReportTable,
    meta: ReportMeta,
    filename: string,
) {
    const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
    ])
    const { width, height } = pageSizePt(format)
    const doc = new JsPDF({ orientation: format.page.orientation, unit: 'pt', format: [width, height] })

    const atX = (element: ReportElement) => (element.x / 100) * width
    const atY = (element: ReportElement) => (element.y / 100) * height
    const atW = (element: ReportElement) => (element.w / 100) * width
    const atH = (element: ReportElement) => (element.h / 100) * height

    const tableEl = format.elements.find((element) => element.kind === 'table')
    // Everything that is not the table is chrome. Splitting them here keeps the
    // page painter below from having to special-case the data on every page.
    const chrome = format.elements.filter((element) => element.kind !== 'table')

    /** Paint one element. `firstOnly` chrome is skipped on later pages. */
    const paint = (element: ReportElement, pageNo: number, pageCount: number) => {
        const x = atX(element)
        const y = atY(element)
        const w = atW(element)
        const h = atH(element)

        // jsPDF's alpha is global state, so it has to be set and put back —
        // leaving it at 0.08 after a watermark would fade the whole page.
        const faded = element.opacity < 1
        if (faded) doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: element.opacity }))

        if (element.kind === 'logo' && element.dataUrl) {
            try {
                // Read the format off the data URL rather than assuming PNG:
                // the editor accepts PNG, JPEG and SVG uploads, and jsPDF throws
                // when the declared format and the actual bytes disagree.
                doc.addImage(element.dataUrl, imageFormat(element.dataUrl), x, y, w, h, undefined, 'FAST')
            } catch {
                // A corrupt or unsupported data URL must not take the whole
                // export down — the rest of the page is still worth having.
            }
        } else if (element.kind === 'line') {
            const rgb = hexToRgb(element.color)
            doc.setDrawColor(rgb.r, rgb.g, rgb.b)
            doc.setLineWidth(Math.max(0.4, h))
            doc.line(x, y, x + w, y)
        } else if (element.kind === 'signature') {
            const rgb = hexToRgb('#98a2b3')
            doc.setDrawColor(rgb.r, rgb.g, rgb.b)
            doc.setLineWidth(0.6)
            doc.line(x, y + h - 12, x + w, y + h - 12)
            writeText(doc, element, fill(element.text, meta), x, y + h - 2, w)
        } else if (element.kind === 'pageNumber') {
            writeText(doc, element, `Page ${pageNo} of ${pageCount}`, x, y + element.fontSize, w)
        } else if (element.kind === 'text' || element.kind === 'watermark') {
            const body = fill(element.text, meta)
            if (body) {
                const sized = element.kind === 'watermark'
                    ? { ...element, fontSize: watermarkFontSize(element, body, w) }
                    : element
                writeText(doc, sized, body, x, y + sized.fontSize, w)
            }
        }

        if (faded) doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }))
    }

    // The table decides where the data sits; without one it fills the margins.
    const margin = tableEl
        ? {
            left: atX(tableEl),
            right: Math.max(0, width - atX(tableEl) - atW(tableEl)),
            top: atY(tableEl),
            bottom: Math.max(0, height - atY(tableEl) - atH(tableEl)),
        }
        : {
            left: format.page.marginLeft * MM_TO_PT,
            right: format.page.marginRight * MM_TO_PT,
            top: format.page.marginTop * MM_TO_PT,
            bottom: format.page.marginBottom * MM_TO_PT,
        }

    // Watermarks go down FIRST so the table sits on top of them; everything
    // else goes on after the table so a header cannot be hidden by a long row.
    const behind = chrome.filter((element) => element.kind === 'watermark')
    const front = chrome.filter((element) => element.kind !== 'watermark')

    /* The PDF body.
     *
     * With `groups` present the table becomes the 5-column grouped layout
     * with rowSpan-merged Client and Business Model cells — same shape the
     * preview and the print sheet use. autoTable supports rowSpan via
     * cell-object entries `{ content, rowSpan }`, so a group of N services
     * emits ONE Client cell with rowSpan=N on the first service's row and
     * omits the Client cell entirely on the following services' rows.
     * autoTable handles page-break re-emission if a group happens to split
     * across pages, so the PDF's page count and the preview's stay aligned.
     *
     * Without `groups` (legacy CSV/export paths) it falls back to sections
     * with full-width band headings, exactly as before. */
    type Cell = string | { content: string; rowSpan?: number; styles?: Record<string, unknown> }
    let body: Cell[][]
    if (table.groups?.length) {
        // Row-level styles for the Client / Business Model tone. autoTable
        // takes per-cell `styles` on a rowspanned cell and applies them to
        // every merged row, so the tinted background carries through.
        const CLIENT_STYLE = { fillColor: [250, 251, 252], textColor: [15, 23, 42], fontStyle: 'bold' } as const
        const BUSINESS_STYLE = { fillColor: [254, 247, 240], textColor: [194, 65, 12], fontStyle: 'bold' } as const
        /* Same mixed-order columns list the paginator uses. When
         * `table.columns` is present we honour the reader's exact
         * sidebar order — a service column that got moved above a
         * client column renders in that spot on the PDF too. Legacy
         * callers still get the classic client-first-then-service
         * layout via the fallback. */
        const columns: { key: string; scope: 'client' | 'service' }[] = table.columns ?? [
            ...(table.clientColumns ?? ['client', 'business']).map((key) => ({ key, scope: 'client' as const })),
            ...(table.serviceColumns ?? ['serviceModel', 'year']).map((key) => ({ key, scope: 'service' as const })),
        ]
        const resolveClient = (block: ReportClientBlock, key: string): string => {
            if (key === 'client') return block.client
            if (key === 'business') return block.business
            return block.clientExtras?.[key] ?? ''
        }
        const styleForClientKey = (key: string) => {
            if (key === 'client') return { ...CLIENT_STYLE, valign: 'middle' as const }
            if (key === 'business') return { ...BUSINESS_STYLE, valign: 'middle' as const }
            return { valign: 'middle' as const }
        }
        let serial = 0
        body = []
        for (const block of table.groups) {
            // Same rule the paginator uses: one serial per CLIENT BLOCK.
            serial += 1
            const count = block.services.length
            block.services.forEach((service, index) => {
                if (index === 0) {
                    // Anchor row for the block. Every column is emitted
                    // in the reader's chosen order — client-scope cells
                    // rowSpan by `count`, service-scope cells sit at
                    // rowSpan 1 for this row only. S. No. is rowspanned
                    // alongside the client columns so it merges into
                    // one cell over the block's services.
                    const snoCell: Cell = {
                        content: String(serial),
                        rowSpan: count,
                        styles: { valign: 'middle', halign: 'center' },
                    }
                    const cells: Cell[] = columns.map((col) => col.scope === 'client'
                        ? {
                            content: resolveClient(block, col.key) || '—',
                            rowSpan: count,
                            styles: styleForClientKey(col.key),
                        }
                        : ((service[col.key] ?? '') || '—'))
                    body.push([snoCell, ...cells])
                } else {
                    // Later rows carry only the service-scope cells, in
                    // their column order; autoTable slots them into the
                    // column positions not covered by the rowSpans on
                    // the anchor row.
                    const cells: Cell[] = columns
                        .filter((col) => col.scope === 'service')
                        .map((col) => (service[col.key] ?? '') || '—')
                    body.push(cells)
                }
            })
        }
    } else {
        body = (table.sections?.length
            ? table.sections.flatMap((section) => [
                [{ content: section.title || section.subtitle, colSpan: table.headers.length, styles: { fillColor: [52, 75, 99], textColor: 255, fontStyle: 'bold' } }],
                ...(section.title && section.subtitle
                    ? [[{ content: section.subtitle, colSpan: table.headers.length, styles: { fillColor: [238, 243, 248], textColor: [60, 74, 94], fontSize: 7.5 } }]]
                    : []),
                ...section.rows,
            ])
            : table.rows) as Cell[][]
    }

    /* Column widths for the PDF come from the same table the preview and
     * print sheet use — REPORT_COLUMN_WIDTHS via reportColumnWidths.
     * autoTable's `columnStyles` accepts a cellWidth in points, so the
     * percentages get converted against the printable table width (the
     * page minus its margins). Alignment mirrors the print CSS: S.No and
     * Providing Year centre, Client / Business / Service left. */
    const contentWidth = width - margin.left - margin.right
    const widthsPct = reportColumnWidths(table.headers)
    const columnStyles: Record<number, Record<string, unknown>> = {}
    table.headers.forEach((header, index) => {
        const role = reportColumnRole(header, index)
        const cellWidth = (widthsPct[index] / 100) * contentWidth
        columnStyles[index] = {
            cellWidth,
            halign: role === 'sno' || role === 'year' ? 'center' : 'left',
            // Every column wraps to multiple lines when its text doesn't
            // fit on one — autoTable then grows the row height to fit,
            // and re-paginates rows across pages if needed. The old
            // ellipsize behaviour truncated readable data with "…" which
            // defeats the purpose of the report.
            overflow: 'linebreak',
        }
    })

    if (table.tableRotated) {
        /* Table Orientation is on — draw the grid by hand, turned 90° in
         * its box, page by page. autoTable can only draw on the page's own
         * axes, so it is bypassed entirely here. The chrome (letterhead,
         * rules, watermark, signature, footer) is still painted upright,
         * which is the whole point of the feature: only the data turns. */
        const paginated = paginateReport(format, table)
        const boxPt = tableEl
            ? { top: atY(tableEl), left: atX(tableEl), width: atW(tableEl), height: atH(tableEl) }
            : {
                top: format.page.marginTop * MM_TO_PT,
                left: format.page.marginLeft * MM_TO_PT,
                width: width - (format.page.marginLeft + format.page.marginRight) * MM_TO_PT,
                height: height - (format.page.marginTop + format.page.marginBottom) * MM_TO_PT,
            }
        // The paginator works in millimetres; the PDF works in points.
        const layoutPt = { width: boxPt.height, height: boxPt.width }
        const rowHeightPt = REPORT_ROW_MM * MM_TO_PT
        const pageCount = paginated.totalPages

        paginated.pages.forEach((pageLines, index) => {
            const pageNo = index + 1
            if (index > 0) doc.addPage()
            doc.setPage(pageNo)
            behind.forEach((element) => paint(element, pageNo, pageCount))
            drawRotatedTable(doc as unknown as PdfDoc, {
                headers: table.headers,
                lines: pageLines,
                box: boxPt,
                layout: layoutPt,
                rowHeight: rowHeightPt,
            })
            front
                .filter((element) => element.everyPage || pageNo === 1)
                .forEach((element) => paint(element, pageNo, pageCount))
        })

        doc.save(`${filename}.pdf`)
        return
    }

    autoTable(doc, {
        head: [table.headers],
        body: body as never,
        margin,
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'middle', lineColor: [166, 180, 197], lineWidth: 0.4 },
        headStyles: { fillColor: [90, 118, 144], textColor: 255, fontStyle: 'bold' },
        columnStyles,
        tableWidth: contentWidth,
        // No alternating row fill. A zebra stripe is an opaque rectangle, and
        // the watermark is painted BEFORE the table — striping would have shown
        // it through every other row and hidden it on the rest. The print path
        // has never striped either, so dropping it also makes the PDF and the
        // print preview agree, which is the point of a single design.
        showHead: 'everyPage',
        rowPageBreak: 'auto',
        // Watermarks only; the rest waits until the page count is known.
        willDrawPage: () => { behind.forEach((element) => paint(element, 0, 0)) },
    })

    // The page count is only knowable once the table has been laid out, so the
    // chrome is painted in a second pass over the finished pages.
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page)
        front
            .filter((element) => element.everyPage || page === 1)
            .forEach((element) => paint(element, page, pages))
    }

    doc.save(`${filename}.pdf`)
}

/* ── Rotated table renderer (PDF) ────────────────────────────────────────
 *
 * autoTable draws on the page's own axes and has no notion of a rotated
 * table, so when Table Orientation is on the grid is drawn by hand with
 * jsPDF primitives instead. The geometry:
 *
 *   The table is laid out NORMALLY in a "layout box" whose width is the
 *   sheet box's HEIGHT and whose height is the sheet box's WIDTH. That
 *   layout is then turned 90° clockwise and slid into the sheet box.
 *
 *   A layout point (lx, ly) lands on the page at
 *       page_x = box.left + box.width - ly
 *       page_y = box.top  + lx
 *   so a layout rect (lx, ly, cw, ch) becomes a page rect
 *       (box.left + box.width - ly - ch,  box.top + lx,  ch,  cw)
 *   — width and height swap, as they must.
 *
 * Text is drawn with `angle: -90` so it reads down the page, which is the
 * direction the layout's +x axis points to after the turn. Ascenders then
 * point right, which is why a line's baseline offset is SUBTRACTED from
 * page_x rather than added to page_y.
 */
type PdfDoc = {
    setFillColor: (r: number, g: number, b: number) => void
    setDrawColor: (r: number, g: number, b: number) => void
    setLineWidth: (w: number) => void
    setTextColor: (r: number, g: number, b: number) => void
    setFont: (family: string, style: string) => void
    setFontSize: (size: number) => void
    rect: (x: number, y: number, w: number, h: number, style?: string) => void
    text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void
    splitTextToSize: (text: string, width: number) => string[]
}

function drawRotatedTable(doc: PdfDoc, options: {
    headers: string[]
    lines: ReportLine[]
    /** Sheet box in POINTS. */
    box: { top: number; left: number; width: number; height: number }
    /** Table layout box in POINTS (width/height already swapped). */
    layout: { width: number; height: number }
    rowHeight: number
}) {
    const { headers, lines, box, layout, rowHeight } = options
    const FONT_SIZE = 8
    const PAD = 3
    const BORDER = [166, 180, 197] as const
    const HEAD_FILL = [90, 118, 144] as const
    const CLIENT_FILL = [250, 251, 252] as const
    // BUSINESS_FILL used to tint the Business Model cell; the reader now
    // wants a single pale-grey tint for both rowspanned cells so the
    // preview and paper agree, so it is folded into CLIENT_FILL above
    // and this constant is no longer referenced.

    const widthsPct = reportColumnWidths(headers)
    const colWidths = widthsPct.map((pct) => (pct / 100) * layout.width)
    const colOffsets: number[] = []
    colWidths.reduce((acc, w) => { colOffsets.push(acc); return acc + w }, 0)

    /** Draw one cell of the layout, mapped through the rotation. */
    const drawCell = (
        lx: number, ly: number, cw: number, ch: number,
        text: string,
        style: { fill?: readonly [number, number, number]; textColor?: readonly [number, number, number]; bold?: boolean; center?: boolean },
    ) => {
        const px = box.left + box.width - ly - ch
        const py = box.top + lx

        doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
        doc.setLineWidth(0.4)
        if (style.fill) {
            doc.setFillColor(style.fill[0], style.fill[1], style.fill[2])
            doc.rect(px, py, ch, cw, 'FD')
        } else {
            doc.rect(px, py, ch, cw, 'S')
        }

        if (!text) return
        const colour = style.textColor ?? [23, 32, 51]
        doc.setTextColor(colour[0], colour[1], colour[2])
        doc.setFont('helvetica', style.bold ? 'bold' : 'normal')
        doc.setFontSize(FONT_SIZE)

        // Wrap against the flow direction (the cell's layout width), then
        // clip to however many lines fit across the cell's thickness.
        const lineHeight = FONT_SIZE * 1.15
        const maxLines = Math.max(1, Math.floor((ch - PAD) / lineHeight))
        const wrapped = doc.splitTextToSize(text, Math.max(4, cw - PAD * 2)).slice(0, maxLines)

        // Centre the block of lines across the cell's thickness.
        const blockHeight = wrapped.length * lineHeight
        const firstBaseline = (ch - blockHeight) / 2 + FONT_SIZE * 0.82

        wrapped.forEach((lineText: string, i: number) => {
            const baselineOffset = firstBaseline + i * lineHeight
            const anchorX = box.left + box.width - ly - baselineOffset
            const anchorY = style.center ? box.top + lx + cw / 2 : box.top + lx + PAD
            doc.text(lineText, anchorX, anchorY, {
                angle: -90,
                align: style.center ? 'center' : 'left',
            })
        })
    }

    // Header row occupies the first band of the layout; data rows follow.
    headers.forEach((header, columnIndex) => {
        const role = reportColumnRole(header, columnIndex)
        drawCell(
            colOffsets[columnIndex], 0, colWidths[columnIndex], rowHeight,
            header,
            {
                fill: HEAD_FILL,
                textColor: [255, 255, 255],
                bold: true,
                center: role === 'sno' || role === 'year' || role === 'status' || role === 'pincode',
            },
        )
    })

    lines.forEach((line, rowIndex) => {
        const ly = (rowIndex + 1) * rowHeight
        if (line.band) {
            drawCell(0, ly, layout.width, rowHeight, line.band, {
                fill: [52, 75, 99],
                textColor: [255, 255, 255],
                bold: true,
            })
            return
        }
        ;(line.cells || []).forEach((cell, columnIndex) => {
            // A null cell is covered by a rowspan from a row above — the
            // covering cell already painted this area.
            if (cell === null) return
            const role = reportColumnRole(headers[columnIndex] || '', columnIndex)
            drawCell(
                colOffsets[columnIndex], ly, colWidths[columnIndex], rowHeight * cell.rowSpan,
                cell.text,
                {
                    // Same Client tint on the Business cell as the plain
                    // print sheet uses (BUSINESS_FILL is unused now; kept
                    // in the constants block for anyone re-enabling it).
                    // Text stays ink black on every role to match the
                    // print CSS's own no-orange rule.
                    fill: role === 'client' || role === 'business' ? CLIENT_FILL : undefined,
                    textColor: role === 'client' || role === 'business' ? [15, 23, 42] : undefined,
                    bold: role === 'client' || role === 'business',
                    center: role === 'sno' || role === 'year' || role === 'status' || role === 'pincode',
                },
            )
        })
    })
}

/** jsPDF names its formats; a data URL names its MIME type. SVG has no jsPDF
 *  format at all, so it is reported as PNG and left to the try/catch around the
 *  call — a logo that cannot be drawn must not take the export down. */
function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
    const mime = /^data:image\/([a-z+]+)/i.exec(dataUrl)?.[1]?.toLowerCase()
    if (mime === 'jpeg' || mime === 'jpg') return 'JPEG'
    if (mime === 'webp') return 'WEBP'
    return 'PNG'
}

function hexToRgb(hex: string) {
    const clean = (hex || '#000').replace('#', '')
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
    return {
        r: parseInt(full.slice(0, 2), 16) || 0,
        g: parseInt(full.slice(2, 4), 16) || 0,
        b: parseInt(full.slice(4, 6), 16) || 0,
    }
}

function writeText(
    doc: { setFont: (f: string, s: string) => void; setFontSize: (n: number) => void; setTextColor: (r: number, g: number, b: number) => void; text: (t: string, x: number, y: number, o?: object) => void },
    element: ReportElement,
    body: string,
    x: number,
    y: number,
    w: number,
) {
    const rgb = hexToRgb(element.color)
    doc.setFont('helvetica', element.bold ? 'bold' : element.italic ? 'italic' : 'normal')
    doc.setFontSize(element.fontSize)
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    // jsPDF anchors centre/right at the given x, so the box's own edge has to
    // be passed rather than its origin.
    const anchorX = element.align === 'center' ? x + w / 2 : element.align === 'right' ? x + w : x
    doc.text(body, anchorX, y, {
        align: element.align,
        angle: element.rotation ? -element.rotation : undefined,
        maxWidth: element.rotation ? undefined : w,
    })
}

// ─── Print ───────────────────────────────────────────────────────────────────

export function printDesignedReport(format: ReportFormat, table: ReportTable, meta: ReportMeta) {
    /* PAGES ARE BUILT BY HAND, not left to @page margins.
     *
     * The previous attempt let the browser paginate and drew the header in a
     * `position: fixed` layer. Fixed elements in paged media anchor to the page
     * AREA, not the sheet, and browsers disagree about whether that includes
     * the margins — which is why the title kept landing inside the table. There
     * is no reliable way to say "this is 6% down the physical sheet" that way.
     *
     * So: every page is an explicit element of exactly the paper's size, with
     * its own chrome layer and its own slice of rows. Percentages then mean the
     * sheet, on every page, in every browser. It also makes the page COUNT
     * known up front, so "Page 2 of 4" can be printed as real text rather than
     * relying on CSS counters that resolve to 0 in page content.
     *
     * The plan comes from `paginateReport` — the same helper the on-screen
     * preview reads, so what the reader saw is what the printer prints. */
    const paginated = paginateReport(format, table)
    const { pages, box, layout, tableRotated, wMm, hMm, totalPages: total } = paginated
    const ROW_MM = REPORT_ROW_MM

    const mm = (n: number) => `${Math.round(n * 100) / 100}mm`

    const piece = (element: ReportElement, pageNo: number) => {
        if (element.kind === 'table') return ''
        // Chrome is drawn on EVERY page: a header, footer or watermark that
        // appeared only once would leave later pages unidentifiable. Elements
        // marked first-page-only are still honoured.
        if (!element.everyPage && pageNo > 1 && element.kind !== 'watermark') return ''

        const geometry = `position:absolute;left:${element.x}%;top:${element.y}%;`
            + `width:${element.w}%;height:${element.h}%;opacity:${element.opacity};`
            + (element.rotation ? `transform:rotate(${element.rotation}deg);` : '')

        if (element.kind === 'logo') {
            return element.dataUrl ? `<img src="${element.dataUrl}" alt="" style="${geometry}object-fit:contain" />` : ''
        }
        if (element.kind === 'line') {
            return `<div style="${geometry}background:${escapeHtml(element.color)}"></div>`
        }

        const body = element.kind === 'pageNumber' ? '' : fill(element.text, meta)
        // Same fit as the PDF, on the same box — the width is a percentage of
        // the sheet, so it is converted to points before being compared.
        const fontSize = element.kind === 'watermark'
            ? watermarkFontSize(element, body, (element.w / 100) * wMm * MM_TO_PT)
            : element.fontSize

        const type = `font-size:${fontSize}pt;color:${escapeHtml(element.color)};`
            + `text-align:${element.align};line-height:1.15;`
            + (element.bold ? 'font-weight:800;' : '')
            + (element.italic ? 'font-style:italic;' : '')
            + (element.kind === 'watermark' ? 'text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;' : '')

        if (element.kind === 'signature') {
            return `<div style="${geometry}display:flex;flex-direction:column;justify-content:flex-end">
                <div style="border-top:1px solid #98a2b3"></div>
                <div style="${type}padding-top:2px">${escapeHtml(fill(element.text, meta))}</div>
            </div>`
        }
        if (element.kind === 'pageNumber') {
            // The count is known because the pages were built here.
            return `<div style="${geometry}${type}">Page ${pageNo} of ${total}</div>`
        }
        return body ? `<div style="${geometry}${type}">${escapeHtml(body)}</div>` : ''
    }

    // Class-per-column so the grouped table can style the Client and Business
    // Model columns distinctly (dark navy / SmartCliff orange, semi-bold) —
    // the on-screen review and the printed sheet then read as one design.
    // Names line up with the CSS classes below AND with reportColumnRole,
    // so the widths applied in the <colgroup> and the styles in the <td>
    // stay in step.
    const columnClass = (column: number, header: string) => `c-${reportColumnRole(header, column)}`
    const widths = reportColumnWidths(table.headers)
    const colgroup = `<colgroup>${widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>`
    const headHtml = `<tr>${table.headers.map((h, i) => `<th class="${columnClass(i, h)}">${escapeHtml(h)}</th>`).join('')}</tr>`

    const sheets = pages.map((page, index) => {
        const pageNo = index + 1
        const rows = page.map((line) => {
            if (line.band) {
                return `<tr class="band"><td colspan="${table.headers.length}">${escapeHtml(line.band)}</td></tr>`
            }
            const cells = (line.cells || []).map((cell, columnIdx) => {
                // A null cell is covered by a rowspan from a previous row on
                // the same page and is deliberately not emitted — the printed
                // table's rowspan takes visual place.
                if (cell === null) return ''
                const rowSpan = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''
                return `<td class="${columnClass(columnIdx, table.headers[columnIdx] || '')}"${rowSpan}>${escapeHtml(cell.text)}</td>`
            }).join('')
            return `<tr>${cells}</tr>`
        }).join('')
        // Blank ruled rows — each one draws every column's border so the
        // grid continues past the last data row to the box's own edge.
        // Uses the same column classes as the data rows so widths, tints
        // (Client / Business) and center alignment match. Marked as a
        // .blank row so the CSS can keep the tint background off if the
        // designer prefers, but keeps the divider hairlines that give
        // the table its "unused rows" feel.
        const emptyRowCount = paginated.fillers[index] ?? 0
        const emptyRow = `<tr class="blank">${table.headers.map((h, i) => `<td class="${columnClass(i, h)}"></td>`).join('')}</tr>`
        const emptyRows = emptyRowCount > 0 ? emptyRow.repeat(emptyRowCount) : ''
        /* The table is laid out at `layout` size and, when turned, rotated
         * 90° clockwise about its top-left corner then slid right by the
         * box's width so it lands exactly inside the box. CSS applies
         * transforms right-to-left, so `translateX(...) rotate(90deg)`
         * means "rotate, then translate" — which is the order the
         * geometry needs. Only this element moves; the chrome layer above
         * keeps the page's own orientation. */
        const tableTransform = tableRotated
            ? `transform:translateX(${mm(box.width)}) rotate(90deg);transform-origin:top left;`
            : ''
        return `<section class="page">
            <div class="chrome">${format.elements.map((element) => piece(element, pageNo)).join('')}</div>
            <div class="data" style="top:${mm(box.top)};left:${mm(box.left)};width:${mm(box.width)};height:${mm(box.height)}">
                <div class="data-inner" style="width:${mm(layout.width)};height:${mm(layout.height)};${tableTransform}">
                    <table>${colgroup}<thead>${headHtml}</thead><tbody>${rows}${emptyRows}</tbody></table>
                </div>
            </div>
        </section>`
    }).join('')

    const popup = window.open('', '_blank', 'width=1100,height=800')
    if (!popup) throw new Error('Allow pop-ups to open the print preview.')
    popup.opener = null
    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title || 'Report')}</title>
    <style>
      /* The sheet carries the whole layout, so it also owns the paper's
         margins. Zeroing them here — on every named page slot Chrome and
         Firefox distinguish — stops the print engine from insetting the
         sheet a second time and shrinking the composition to fit. */
      @page { size: ${wMm}mm ${hMm}mm; margin: 0 !important; }
      @page :first, @page :left, @page :right { margin: 0 !important; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        font-family: Arial, Helvetica, sans-serif;
        color: #172033;
      }

      .page {
        position: relative;
        width: ${wMm}mm; height: ${hMm}mm;
        /* Belt-and-braces against a stylesheet reset the browser might
           merge in — a padding here would offset every percent-positioned
           child by the same amount and drift the composition. */
        margin: 0 !important; padding: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden;
        background: #fff;
        break-after: page; page-break-after: always;
      }
      .page:last-child { break-after: auto; page-break-after: auto; }
      .chrome { position:absolute; inset:0; }
      .chrome > * { box-sizing:border-box; overflow:hidden; }
      .data { position:absolute; overflow:hidden; }
      /* The rotating wrapper. Sized to the table's own layout box, then
         transformed into the data box when Table Orientation is on. */
      .data-inner { overflow:hidden; }

      /* table-layout:fixed is what makes the <colgroup> widths win —
         without it the browser would recompute the columns from content,
         and a long client name in the Client column would blow the S.No.
         column back out to auto width. */
      /* The wrapper clips at the table box so a page's rows can't bleed
         past it — but a collapsed table at exactly 100% puts its OUTER
         right hairline on the clip edge, where print rounding drops it.
         Backing off a hair (about one device pixel at print resolution)
         keeps that border inside the box. The explicit border on the
         table merges with the last column's under border-collapse, so
         nothing is drawn twice. */
      table {
        width:calc(100% - 0.4mm);
        /* Stretch the table to the data box's full height so the last
           filler row (below) absorbs whatever the paginator did not
           hand to a data row. Without this, a page with fewer wrapped
           rows than the box could hold left a white strip inside the
           design's own border. */
        height:100%;
        border-collapse:collapse;
        table-layout:fixed;
        font-size:8.5pt;
        border-right:1px solid #a6b4c5;
        border-bottom:1px solid #a6b4c5;
      }
      /* Blank ruled rows appended after the data rows on pages the
         paginator did not pack tight to the box's edge. Each row draws
         the full grid — same border, same 5.2 mm min-height — so the
         box reads as "ruled paper with empty rows at the bottom"
         instead of "table stops here, then blank paper". The tint on
         c-client / c-business is deliberately kept off so an empty
         column does not carry meaning it does not deserve. */
      tr.blank td { background:#fff !important; color:transparent; }
      th, td {
        border:1px solid #a6b4c5; padding:2px 4px;
        line-height:1.2;
        /* Every column wraps rather than ellipsize — a "…" hides real
           data. The row height grows to fit the wrapped content; the
           paginator picks a conservative rowsPerPage that leaves room
           for occasional multi-line cells. */
        white-space:normal;
        overflow-wrap:anywhere;
        word-break:break-word;
        overflow:hidden;
        vertical-align: middle;
        min-height:${ROW_MM}mm;
      }
      th { background:#5a7690; color:#fff; text-align:left; font-weight:700; }
      tr.band td { background:#344b63; color:#fff; font-weight:700; text-align:left; }

      /* Column-specific styling. Every column can wrap, but the ones
         carrying tabular data (S. No., Year, Status) stay center-aligned
         and monospaced. Client and Business get their tint. */
      th.c-sno, td.c-sno { text-align:center; font-variant-numeric: tabular-nums; }
      td.c-sno { color:#667085; }
      th.c-year, td.c-year { text-align:center; font-variant-numeric: tabular-nums; }
      th.c-status, td.c-status { text-align:center; }
      th.c-client, td.c-client { text-align:left; }
      td.c-client { color:#0f172a; font-weight:700; background:#fafbfc; }
      th.c-business, td.c-business { text-align:left; }
      td.c-business { color:#0f172a; font-weight:700; background:#fafbfc; }
      th.c-service, td.c-service { text-align:left; }

      @media print {
        /* Backgrounds and tints render on paper — without this Chrome
           drops the header fill, the Client / Business row tints and
           the accent rule, so the printed sheet reads paler than the
           on-screen preview. Applied to * so every subtree inherits it. */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        /* zoom:1 stops the browser applying an inherited magnification;
           transform: none clears any parent transform Chrome sometimes
           collapses into the print snapshot. Between them the sheet
           lands at physical mm size regardless of the browser's zoom. */
        html, body { zoom: 1 !important; transform: none !important; overflow: visible !important; }
        .hint { display: none; }
      }
      @media screen {
        body { background:#eef0f4; padding:16px 0; }
        .page { margin:0 auto 16px; box-shadow:0 8px 30px rgba(16,24,40,.18); }
        .hint { max-width:${wMm}mm; margin:0 auto 12px; font-size:12px; color:#475467; }
      }
    </style></head><body>
      <p class="hint">${total} page${total === 1 ? '' : 's'} at ${PAPER_MM[format.page.size].label} ${format.page.orientation}. For a 1:1 match with the preview, set <strong>Margins: None</strong>, turn <strong>Headers and footers</strong> off, and keep <strong>Scale: Default</strong> (or 100%) with paper size <strong>${PAPER_MM[format.page.size].label}</strong>.</p>
      ${sheets}
    </body></html>`)
    popup.document.close()
    popup.addEventListener('afterprint', () => popup.close(), { once: true })
    setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print() } }, 300)
}
