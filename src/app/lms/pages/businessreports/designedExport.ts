import type { ReportTable } from '@/app/lms/pages/servicemapping/components/serviceReport'
import { PAPER_MM, type ReportElement, type ReportFormat } from '@/app/lms/pages/reportsettings/api/reportSettingsService'

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
}

/** An unresolved token prints as NOTHING, never as a literal "{address}" —
 *  an institution with no address on file should get a letterhead with a blank
 *  line, not one advertising the gap. */
const fill = (value: string, meta: ReportMeta) => value
    .replace(/\{scope\}/gi, meta.scope)
    .replace(/\{generated\}/gi, meta.generated)
    .replace(/\{title\}/gi, meta.title || '')
    .replace(/\{org\}/gi, meta.org || '')
    .replace(/\{address\}/gi, meta.address || '')
    .replace(/\{contact\}/gi, meta.contact || '')
    .trim()

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

    const body = (table.sections?.length
        ? table.sections.flatMap((section) => [
            [{ content: section.title || section.subtitle, colSpan: table.headers.length, styles: { fillColor: [52, 75, 99], textColor: 255, fontStyle: 'bold' } }],
            ...(section.title && section.subtitle
                ? [[{ content: section.subtitle, colSpan: table.headers.length, styles: { fillColor: [238, 243, 248], textColor: [60, 74, 94], fontSize: 7.5 } }]]
                : []),
            ...section.rows,
        ])
        : table.rows) as unknown[][]

    autoTable(doc, {
        head: [table.headers],
        body: body as never,
        margin,
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'middle', lineColor: [166, 180, 197], lineWidth: 0.4 },
        headStyles: { fillColor: [90, 118, 144], textColor: 255, fontStyle: 'bold' },
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
    const { wMm, hMm } = pageSizePt(format)
    const tableEl = format.elements.find((element) => element.kind === 'table')

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
     */
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

    // Every row is exactly one line tall, so rows-per-page is arithmetic rather
    // than a guess. Cells ellipsis rather than wrap — a wrapping cell would make
    // row heights unpredictable and the page breaks wrong.
    const ROW_MM = 5.2
    const rowsPerPage = Math.max(1, Math.floor((box.height - ROW_MM) / ROW_MM))

    // Flatten sections into rows, keeping the band rows inline so a client's
    // heading travels with its services.
    type Line = { band?: string; cells?: string[] }
    const lines: Line[] = table.sections?.length
        ? table.sections.flatMap((section) => [
            ...(section.title ? [{ band: `${section.title}${section.subtitle ? ` — ${section.subtitle}` : ''}` }] : []),
            ...section.rows.map((cells) => ({ cells })),
        ])
        : table.rows.map((cells) => ({ cells }))

    const pages: Line[][] = []
    for (let i = 0; i < lines.length; i += rowsPerPage) pages.push(lines.slice(i, i + rowsPerPage))
    if (!pages.length) pages.push([])
    const total = pages.length

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

    const head = `<tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`

    const sheets = pages.map((page, index) => {
        const pageNo = index + 1
        const rows = page.map((line) => (line.band
            ? `<tr class="band"><td colspan="${table.headers.length}">${escapeHtml(line.band)}</td></tr>`
            : `<tr>${(line.cells || []).map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`)).join('')
        return `<section class="page">
            <div class="chrome">${format.elements.map((element) => piece(element, pageNo)).join('')}</div>
            <div class="data" style="top:${mm(box.top)};left:${mm(box.left)};width:${mm(box.width)};height:${mm(box.height)}">
                <table><thead>${head}</thead><tbody>${rows}</tbody></table>
            </div>
        </section>`
    }).join('')

    const popup = window.open('', '_blank', 'width=1100,height=800')
    if (!popup) throw new Error('Allow pop-ups to open the print preview.')
    popup.opener = null
    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title || 'Report')}</title>
    <style>
      /* margin:0 — the pages carry their own layout, so a page margin here
         would inset them a second time. */
      @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
      html, body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; color:#172033; }

      .page {
        position: relative;
        width: ${wMm}mm; height: ${hMm}mm;
        overflow: hidden;
        background: #fff;
        break-after: page; page-break-after: always;
      }
      .page:last-child { break-after: auto; page-break-after: auto; }
      .chrome { position:absolute; inset:0; }
      .chrome > * { box-sizing:border-box; overflow:hidden; }
      .data { position:absolute; }

      table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:8.5pt; }
      th, td {
        border:1px solid #a6b4c5; padding:0 4px;
        height:${ROW_MM}mm; line-height:${ROW_MM}mm;
        /* One line per row keeps the page breaks exactly where they were
           calculated; a wrapping cell would push rows off the sheet. */
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      th { background:#5a7690; color:#fff; text-align:left; font-weight:700; }
      tr.band td { background:#344b63; color:#fff; font-weight:700; }

      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      @media screen {
        body { background:#eef0f4; padding:16px 0; }
        .page { margin:0 auto 16px; box-shadow:0 8px 30px rgba(16,24,40,.18); }
        .hint { max-width:${wMm}mm; margin:0 auto 12px; font-size:12px; color:#475467; }
      }
      @media print { .hint { display:none } }
    </style></head><body>
      <p class="hint">${total} page${total === 1 ? '' : 's'} at ${PAPER_MM[format.page.size].label} ${format.page.orientation}.
         In the print dialog set <strong>Margins: None</strong> and turn <strong>Headers and footers</strong> off —
         those add the date and URL you may see around the edges.</p>
      ${sheets}
    </body></html>`)
    popup.document.close()
    popup.addEventListener('afterprint', () => popup.close(), { once: true })
    setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print() } }, 300)
}
