"use client"

/* One rendered page of the final report, as it will appear on paper.
 *
 * The whole point of this component is fidelity: what the reader sees here
 * MUST be what the printer prints and what the PDF encodes. So the layout
 * uses the same millimetre grid as `printDesignedReport` — percent element
 * positions on a sheet of `wMm × hMm`, rows of `REPORT_ROW_MM` height, an
 * explicit table box for the data — and CSS `transform: scale()` shrinks
 * the whole thing to fit the container without changing any positions.
 * Nothing here is a re-interpretation of the design.
 *
 * A read-only surface: no drag handles, no selection borders, no property
 * panel. The reader is looking at the output, not editing it. */

import { PAPER_MM, type ReportElement, type ReportFormat } from '../../reportsettings/api/reportSettingsService'
import {
    fillTokens, REPORT_ROW_MM, reportColumnRole, reportColumnWidths,
    type ReportLine, type ReportMeta,
} from '../designedExport'

/** How wide a millimetre reads on-screen at CSS 96 DPI. Used to compute the
 *  scale factor between the natural mm sheet and the display container. */
const MM_TO_PX = 3.7795275591

type Props = {
    format: ReportFormat
    /** The lines to lay out on THIS page — a slice of the pagination. */
    lines: ReportLine[]
    /** The table's headers (repeated on every page, matching print output). */
    headers: string[]
    /** 1-based page number for {pageNumber} and everyPage gating. */
    pageNo: number
    /** Total pages, so the pageNumber element can say "Page N of M". */
    totalPages: number
    /** Table box, in mm, on the sheet. Comes from `paginateReport`. */
    box: { top: number; left: number; width: number; height: number }
    /** The table's own layout box in mm — width/height swapped when the
     *  table is turned. Also from `paginateReport`. */
    layout?: { width: number; height: number }
    /** Turn the TABLE (and only the table) 90° inside its box. The
     *  letterhead, rules, watermark and footer stay upright. */
    tableRotated?: boolean
    /** How many BLANK ruled rows to draw after the data rows so the
     *  table's grid reaches the box's bottom edge on pages where the
     *  paginator did not pack row-for-row. Comes from
     *  `paginated.fillers[currentPage - 1]`; defaults to 0 so older
     *  callers that don't paginate still work. */
    fillerCount?: number
    /** Token substitutions — title, scope, generated, org, address, contact. */
    meta: ReportMeta
    /** Container width in CSS pixels. The sheet is scaled to fit. */
    width: number
    /** Extra classes on the outer frame (e.g. shadow variations). */
    className?: string
    /** When set, each rendered chrome element becomes clickable — clicking
     *  it calls `onSelectElement(id)`. The `selectedElementId` element gets
     *  a brand ring so the reader can see which one is currently the target
     *  of the sidebar's property editor. Omit these props to keep the
     *  preview read-only. */
    selectedElementId?: string | null
    onSelectElement?: (id: string | null) => void
}

/** Font size for the watermark element — clamped so a very long org name
 *  still fits its box. Kept in step with the same formula the PDF and print
 *  paths use in designedExport.ts. */
const WATERMARK_EM = 0.78

function watermarkFontSize(element: ReportElement, text: string, boxWidthPt: number) {
    if (!text) return element.fontSize
    const needed = text.length * WATERMARK_EM * element.fontSize
    const room = boxWidthPt * 0.96
    if (needed <= room) return element.fontSize
    return Math.max(8, room / (text.length * WATERMARK_EM))
}

export function PreviewPage({
    format, lines, headers, pageNo, totalPages, box, layout, tableRotated = false,
    fillerCount = 0,
    meta, width, className = '',
    selectedElementId = null, onSelectElement,
}: Props) {
    const editable = Boolean(onSelectElement)
    // The table's layout box — swapped when turned. Falls back to the
    // sheet box so callers that predate the feature keep working.
    const tableLayout = layout ?? { width: box.width, height: box.height }
    const paper = PAPER_MM[format.page.size]
    const landscape = format.page.orientation === 'landscape'
    const wMm = landscape ? paper.height : paper.width
    const hMm = landscape ? paper.width : paper.height

    // The natural size of the sheet at 96 DPI (what mm units render at), and
    // the scale to shrink it into the caller's container. Transform-origin at
    // top-left so the scaled sheet still starts flush with (0,0).
    const naturalWidthPx = wMm * MM_TO_PX
    const naturalHeightPx = hMm * MM_TO_PX
    const scale = width / naturalWidthPx
    const outerHeight = naturalHeightPx * scale

    const paint = (element: ReportElement) => {
        if (element.kind === 'table') return null
        // Same rule the print path enforces: everyPage chrome shows on every
        // page, first-page-only chrome shows on page 1 only. Watermarks are
        // treated as background and appear behind the data on every page.
        if (!element.everyPage && pageNo > 1 && element.kind !== 'watermark') return null

        const isSelected = element.id === selectedElementId

        const style: React.CSSProperties = {
            position: 'absolute',
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.w}%`,
            height: `${element.h}%`,
            opacity: editable ? Math.max(element.opacity, 0.35) : element.opacity,
            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
            overflow: 'hidden',
            boxSizing: 'border-box',
            // In editable mode the elements become click targets; hovering
            // shows a hairline brand outline, and the selected one keeps a
            // filled brand ring so the sidebar's property editor has a
            // visible target on the sheet. Editable elements are also
            // lifted above the table box via z-index so a watermark or a
            // header cell buried under the data grid can still be selected.
            cursor: editable ? 'pointer' : undefined,
            outline: editable
                ? (isSelected ? '2px solid var(--color-brand-strong, #c2410c)' : '1px dashed rgba(226, 97, 63, 0.55)')
                : undefined,
            outlineOffset: editable ? '1px' : undefined,
            zIndex: editable ? (isSelected ? 20 : 10) : undefined,
        }

        const clickProps = editable
            ? {
                onClick: (event: React.MouseEvent) => { event.stopPropagation(); onSelectElement?.(element.id) },
                onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectElement?.(element.id)
                    }
                },
                role: 'button' as const,
                tabIndex: 0,
                'aria-label': `${element.kind} element`,
                'aria-pressed': isSelected,
                title: `Click to edit this ${element.kind}`,
            }
            : {}

        if (element.kind === 'logo') {
            return element.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={element.id} src={element.dataUrl} alt="" draggable={false}
                    {...clickProps}
                    style={{ ...style, objectFit: 'contain' }} />
            ) : editable ? (
                // Empty logo box — invisible on the final sheet but present
                // and clickable in edit mode so it can be selected.
                <div key={element.id} {...clickProps} style={{ ...style, border: '1px dashed rgba(226, 97, 63, 0.4)' }} />
            ) : null
        }
        if (element.kind === 'line') {
            return <div key={element.id} {...clickProps} style={{ ...style, background: element.color, minHeight: 1 }} />
        }

        const body = element.kind === 'pageNumber' ? `Page ${pageNo} of ${totalPages}` : fillTokens(element.text, meta)
        const fontSize = element.kind === 'watermark'
            ? watermarkFontSize(element, body, (element.w / 100) * wMm * 2.834645)
            : element.fontSize

        const textStyle: React.CSSProperties = {
            fontSize: `${fontSize}pt`,
            color: element.color,
            textAlign: element.align,
            lineHeight: 1.15,
            fontWeight: element.bold ? 800 : 400,
            fontStyle: element.italic ? 'italic' : undefined,
            textTransform: element.kind === 'watermark' ? 'uppercase' : undefined,
            letterSpacing: element.kind === 'watermark' ? '0.08em' : undefined,
            whiteSpace: element.kind === 'watermark' ? 'nowrap' : undefined,
        }

        if (element.kind === 'signature') {
            return (
                <div key={element.id} {...clickProps} style={{ ...style, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ borderTop: '1px solid #98a2b3' }} />
                    <div style={{ ...textStyle, paddingTop: 2 }}>{body}</div>
                </div>
            )
        }
        if (body || editable) {
            return <div key={element.id} {...clickProps} style={{ ...style, ...textStyle }}>{body || (editable ? '(empty)' : null)}</div>
        }
        return null
    }

    return (
        <div
            className={`relative shrink-0 bg-white shadow-lg ${className}`}
            style={{ width, height: outerHeight, fontFamily: 'Arial, Helvetica, sans-serif', color: '#172033' }}
            // Clicking on empty white space inside the sheet clears the
            // current selection in edit mode. The individual elements stop
            // propagation on their own clicks, so this only fires for the
            // sheet's background.
            onClick={editable ? () => onSelectElement?.(null) : undefined}
        >
            {/* Inner sheet at natural mm size; the outer container carries the
                scaled dimensions so the reader gets a sensible box in flow
                and the sheet inside just gets multiplied down to fit. */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${naturalWidthPx}px`,
                    height: `${naturalHeightPx}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                {/* Watermarks are drawn FIRST so the table and chrome sit on
                    top of them — the same z-order the print sheet uses. */}
                <div style={{ position: 'absolute', inset: 0 }}>
                    {format.elements.filter((e) => e.kind === 'watermark').map(paint)}
                </div>

                {/* The data grid. Position and size come from `box`, which
                    was computed by paginateReport from the table element's
                    own coordinates — so the printed page and this preview
                    put the table in the exact same spot.

                    When Table Orientation is on, the inner wrapper is sized
                    to the SWAPPED layout box and rotated 90° clockwise about
                    its top-left, then slid right by the box's width so it
                    lands exactly inside the box. CSS applies transforms
                    right-to-left, so `translateX(...) rotate(90deg)` reads
                    as "rotate, then translate" — the order the geometry
                    needs. Only this wrapper moves; every other element on
                    the sheet keeps the page's own orientation. */}
                <div
                    style={{
                        position: 'absolute',
                        top: `${box.top}mm`,
                        left: `${box.left}mm`,
                        width: `${box.width}mm`,
                        height: `${box.height}mm`,
                        overflow: 'hidden',
                    }}
                >
                  <div
                    style={{
                        width: `${tableLayout.width}mm`,
                        height: `${tableLayout.height}mm`,
                        overflow: 'hidden',
                        transform: tableRotated ? `translateX(${box.width}mm) rotate(90deg)` : undefined,
                        transformOrigin: 'top left',
                    }}
                  >
                    <table
                        style={{
                            /* A hair under 100% — the wrapper clips at the
                             * table box, and a collapsed table at exactly
                             * full width puts its outer right hairline on
                             * the clip edge where it rounds away. Matches
                             * the print sheet's own backoff so preview and
                             * paper agree. */
                            width: 'calc(100% - 0.4mm)',
                            /* Stretch to the box's full height — combined
                             * with the spacer row at the end of tbody, the
                             * table fills its outer wrapper even on a page
                             * the paginator did not fill row-for-row.
                             * Without this the last data row's bottom edge
                             * floated above the box, leaving a bare white
                             * strip inside the design's own border. */
                            height: '100%',
                            borderCollapse: 'collapse',
                            /* fixed layout locks the columns to the widths
                             * declared in the colgroup below — this is
                             * exactly what makes the S.No column narrow in
                             * every renderer (preview, print, PDF) instead
                             * of ballooning to a fifth of the sheet. */
                            tableLayout: 'fixed',
                            fontSize: '8.5pt',
                            borderRight: '1px solid #a6b4c5',
                            borderBottom: '1px solid #a6b4c5',
                        }}
                    >
                        <colgroup>
                            {reportColumnWidths(headers).map((w, i) => (
                                <col key={i} style={{ width: `${w}%` }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {headers.map((header, index) => {
                                    const role = reportColumnRole(header, index)
                                    const align: React.CSSProperties['textAlign'] = role === 'sno' || role === 'year' ? 'center' : 'left'
                                    return (
                                        <th
                                            key={`${header}-${index}`}
                                            style={{
                                                border: '1px solid #a6b4c5',
                                                padding: '0 4px',
                                                height: `${REPORT_ROW_MM}mm`,
                                                lineHeight: `${REPORT_ROW_MM}mm`,
                                                background: '#5a7690',
                                                color: '#fff',
                                                textAlign: align,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                verticalAlign: 'middle',
                                            }}
                                        >{header}</th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, rowIndex) => {
                                if (line.band) {
                                    return (
                                        <tr key={rowIndex}>
                                            <td
                                                colSpan={headers.length}
                                                style={{
                                                    border: '1px solid #a6b4c5',
                                                    padding: '0 4px',
                                                    height: `${REPORT_ROW_MM}mm`,
                                                    lineHeight: `${REPORT_ROW_MM}mm`,
                                                    background: '#344b63',
                                                    color: '#fff',
                                                    fontWeight: 700,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    verticalAlign: 'middle',
                                                }}
                                            >{line.band}</td>
                                        </tr>
                                    )
                                }
                                /* Render each non-null cell of the row. A
                                 * null cell is covered by a rowSpan from a
                                 * previous row on this page and must be
                                 * omitted entirely — emitting an empty td
                                 * would push the following data columns
                                 * off by one. */
                                return (
                                    <tr key={rowIndex}>
                                        {(line.cells || []).map((cell, cellIndex) => {
                                            if (cell === null) return null
                                            const role = reportColumnRole(headers[cellIndex] || '', cellIndex)
                                            const isCenter = ['sno', 'year', 'status', 'pincode'].includes(role)
                                            // Every column wraps rather than
                                            // ellipsize — the row height grows
                                            // to fit the wrapped content so
                                            // long values (email, address,
                                            // long service model names) are
                                            // legible in full. Matches the
                                            // print / PDF behaviour so what
                                            // is on screen is what gets sent
                                            // to the printer.
                                            return (
                                                <td
                                                    key={cellIndex}
                                                    rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                                    style={{
                                                        border: '1px solid #a6b4c5',
                                                        padding: '2px 4px',
                                                        minHeight: `${REPORT_ROW_MM}mm`,
                                                        lineHeight: '1.2',
                                                        whiteSpace: 'normal',
                                                        overflow: 'hidden',
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'anywhere',
                                                        verticalAlign: 'middle',
                                                        textAlign: isCenter ? 'center' : 'left',
                                                        fontWeight: role === 'client' || role === 'business' ? 700 : 400,
                                                        // Business Model reads like the Client column next
                                                        // to it: bold, same ink, same faint tint. It used to
                                                        // print brand-orange, which is the one colour on an
                                                        // otherwise black sheet.
                                                        color: role === 'client' || role === 'business' ? '#0f172a' : undefined,
                                                        background: role === 'client' || role === 'business' ? '#fafbfc' : undefined,
                                                        fontVariantNumeric: role === 'sno' || role === 'year' ? 'tabular-nums' : undefined,
                                                    }}
                                                >{cell.text}</td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                            {/* Blank ruled rows — one per unused row slot
                                the paginator did not fill. Each draws a
                                full cell in every column so the grid
                                continues past the last data row to the
                                box's own edge, reading as "ruled paper
                                with empty rows at the bottom" rather
                                than "table stops here and there is
                                blank paper below it". The last one
                                slightly overshoots by design so the
                                grid reaches the border; the outer
                                overflow:hidden clips the overshoot. */}
                            {Array.from({ length: fillerCount }, (_, i) => (
                                <tr key={`blank-${i}`} aria-hidden>
                                    {headers.map((_, columnIdx) => {
                                        const role = reportColumnRole(headers[columnIdx] || '', columnIdx)
                                        const isCenter = ['sno', 'year', 'status', 'pincode'].includes(role)
                                        return (
                                            <td
                                                key={columnIdx}
                                                style={{
                                                    border: '1px solid #a6b4c5',
                                                    padding: '2px 4px',
                                                    minHeight: `${REPORT_ROW_MM}mm`,
                                                    height: `${REPORT_ROW_MM}mm`,
                                                    lineHeight: '1.2',
                                                    verticalAlign: 'middle',
                                                    textAlign: isCenter ? 'center' : 'left',
                                                    background: '#fff',
                                                }}
                                            />
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>

                {/* Chrome — everything on the page that isn't the data grid.
                    Painted last so a title cannot be hidden by a long row. */}
                <div style={{ position: 'absolute', inset: 0 }}>
                    {format.elements.filter((e) => e.kind !== 'watermark' && e.kind !== 'table').map(paint)}
                </div>
            </div>
        </div>
    )
}
