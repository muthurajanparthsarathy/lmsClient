"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { PAPER_MM, type ReportElement, type ReportFormat } from '../api/reportSettingsService'
import {
    fillTokens, REPORT_ROW_MM, reportColumnRole, reportColumnWidths,
    type ReportLine, type ReportMeta,
} from '../../businessreports/designedExport'

/** CSS px per mm at 96 DPI. The canvas draws the sheet at its natural
 *  size in pixels and lets a CSS transform scale it to fit the pane, so
 *  every dimension inside (fonts in pt, table row heights in mm) reads
 *  the same fraction of the sheet the printed page does. */
const MM_TO_PX = 3.7795275591

/* The page, and the elements on it, dragged into place.
 *
 * Everything is positioned in PERCENT of the sheet, so the canvas can be any
 * size on screen and the saved design means the same thing at A4 or Letter.
 * The only pixel maths here converts a pointer delta into a percentage, which
 * is why the sheet's own bounding box is measured on every drag start rather
 * than cached — the pane is resizable.
 */

/* Tokens are substituted at EXPORT time — {org}, {address} and {contact} from
   the institution's record, {title}, {scope} and {generated} from the report
   being run. The canvas has neither to hand, so it shows representative values
   instead: arranging a masthead around the literal word "{org}" would size the
   box for eight characters and then print thirty.

   Fixed strings, not live ones — `new Date()` here would differ between the
   server's first render and the browser's, which React reports as a hydration
   mismatch. */
const SAMPLE: Record<string, string> = {
    org: 'SmartCliff',
    address: '123 Example Road, Example City 000000',
    contact: '+00 00000 00000  ·  support@smartcliff.com',
    title: 'Services report',
    scope: '6 clients  ·  48 rows',
    generated: '01/01/2026, 10:30:00 am',
}

/** An unknown token is left visible rather than blanked — seeing "{clientz}"
 *  on the canvas is how a typo gets noticed before it prints as nothing.
 *  Nullable input: older saves can arrive without `text` on kinds that don't
 *  use it (line, logo, pageNumber). Coerced to '' so the `|| PLACEHOLDER[...]`
 *  fallback at the call site still runs instead of the canvas throwing. */
const preview = (text: string | undefined | null) =>
    (text ?? '').replace(/\{(\w+)\}/g, (whole, key: string) => SAMPLE[key.toLowerCase()] ?? whole)

const GRID = 0.5   // percent — enough to stop jitter, fine enough to feel free

const snap = (value: number) => Math.round(value / GRID) * GRID
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** What a kind looks like on the canvas when it has no text of its own. */
const PLACEHOLDER: Record<string, string> = {
    text: 'Text',
    logo: 'Logo',
    line: '',
    table: 'Report table',
    watermark: 'Watermark',
    signature: 'Signature',
    pageNumber: 'Page 1 of 3',
}

/** Which corner a resize gesture grabbed. Each pulls a different pair of
 *  edges, so the delta maps onto x/y/w/h differently — see `move`. */
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

export default function ReportCanvas({
    format, selectedIds, onSelect, onChange, tablePreview, viewRotation = 0, tableRotated = false, meta,
}: {
    format: ReportFormat
    /** Every element currently selected. The FIRST entry is the primary
     *  one — the property panel edits that, and resize handles only show
     *  when the selection is exactly one element (resizing several at
     *  once has no single obvious meaning). Ctrl / Cmd-click adds to or
     *  removes from the set; a plain click replaces it. */
    selectedIds: string[]
    onSelect: (ids: string[]) => void
    onChange: (id: string, patch: Partial<ReportElement>) => void
    /** Real headers + one page's worth of ReportLines to draw inside the
     *  `table` element, in place of the dashed-shape placeholder. Supplied
     *  by callers that already have a paginated report (PrintPreviewModal);
     *  the standalone Report Settings page leaves it undefined, which keeps
     *  the neutral shape so a template is edited without pretending to
     *  belong to one particular report. `lines` is the SAME structure
     *  PreviewPage and the print sheet consume — same rowSpan cells, same
     *  page-slice — so the three surfaces render the same table row for
     *  row. `fillerCount` is how many blank ruled rows to draw after the
     *  data rows so the mini-table's grid reaches the design's own box
     *  edge; comes from `paginated.fillers[currentPage - 1]`. */
    tablePreview?: { headers: string[]; lines: ReportLine[]; fillerCount?: number }
    /** VIEW-ONLY rotation of the sheet. 0 keeps the natural orientation
     *  (default; the standalone Report Settings page never sets this).
     *  90 / 180 / 270 rotate the drawn sheet clockwise via CSS; the drag
     *  math below un-rotates pointer deltas so a right-drag on screen
     *  still moves the element to the reader's right regardless of the
     *  angle the sheet is drawn at. */
    viewRotation?: 0 | 90 | 180 | 270
    /** Turn the TABLE element's contents 90° inside its own box, leaving
     *  every other element upright. Mirrors the Table Orientation option
     *  the report's print/PDF paths honour, so the editor shows the same
     *  thing the file will contain. */
    tableRotated?: boolean
    /** The report's own meta — real title, scope, generated stamp and the
     *  filter line. When passed, tokens resolve against these values via
     *  `fillTokens` (the SAME substitution the Fields preview and the
     *  print/PDF paths run), and the editor-only zone bands and margin
     *  guides step aside so the sheet reads exactly like the printed
     *  page. Omit for the standalone template editor: the canvas then
     *  falls back to representative SAMPLE values and shows the guides,
     *  because arranging a masthead around the literal word "{org}"
     *  would size the box for eight characters and then print thirty. */
    meta?: ReportMeta
}) {
    /* Which substitution the canvas runs. With a real `meta` we defer to
     * the shared `fillTokens` — the exact function the print sheet, the
     * PDF and the Fields-tab preview call — so every path resolves the
     * same tokens to the same strings. Without one, we fall back to the
     * fixed SAMPLE dictionary so a template editor still shows something
     * meaningful. */
    const resolve = meta
        ? (text: string | undefined | null) => fillTokens(text ?? '', meta)
        : preview
    const sheetRef = useRef<HTMLDivElement>(null)
    // The gesture in flight. Held in a ref, not state: it changes on every
    // pointermove and re-rendering the whole canvas per frame would crawl.
    // A move carries EVERY selected element's starting box so the whole
    // selection travels together; a resize only ever touches one.
    const drag = useRef<null | {
        ids: string[]
        mode: 'move' | 'resize'
        corner?: ResizeCorner
        startX: number
        startY: number
        origins: Record<string, { x: number; y: number; w: number; h: number }>
        rect: DOMRect
    }>(null)
    const [dragging, setDragging] = useState<string[]>([])

    // The table is what splits the page into header / body / footer.
    const table = format.elements.find((element) => element.kind === 'table')

    const paper = PAPER_MM[format.page.size]
    const landscape = format.page.orientation === 'landscape'
    const sheetW = landscape ? paper.height : paper.width
    const sheetH = landscape ? paper.width : paper.height

    /* Natural pixel size of the sheet at 96 DPI — this is the frame
     * every element is drawn in, before a CSS transform scales the
     * whole thing down to the pane's fit width. Because the transform
     * doesn't affect layout, text at N pt inside this frame is still
     * "true N pt" during layout, and gets shrunk by exactly the same
     * factor as the sheet itself. Same technique the print sheet and
     * the Fields-tab PreviewPage use — so the three surfaces render
     * the same composition down to line breaks and row counts. */
    const naturalW = sheetW * MM_TO_PX
    const naturalH = sheetH * MM_TO_PX

    /* Fit the sheet to the pane, in pixels.
     *
     * `aspect-ratio` alone cannot do this: with a width it overflows tall panes
     * vertically, and with a height it overflows wide ones horizontally — there
     * is no CSS pair that means "as large as fits, both ways, keeping the
     * ratio". So the pane is measured and the smaller of the two scale factors
     * wins, which is the same arithmetic a print preview does. */
    const paneRef = useRef<HTMLDivElement>(null)
    const [fit, setFit] = useState<{ width: number; height: number } | null>(null)

    /* Whether the sheet is drawn at 90° / 270° — swap width and height in
     * the fit calc so the pane sees the ROTATED sheet's bounding box.
     * Without this a portrait sheet in a wide pane would fit its
     * natural (narrow) width and leave a large empty strip either side,
     * even though rotating it 90° would let it fill nearly the whole
     * pane. */
    const rotated90 = viewRotation === 90 || viewRotation === 270
    const visualSheetW = rotated90 ? sheetH : sheetW
    const visualSheetH = rotated90 ? sheetW : sheetH

    useLayoutEffect(() => {
        const pane = paneRef.current
        if (!pane) return
        const measure = () => {
            // 24 px of gutter so the sheet's shadow doesn't touch the
            // pane's border and the reserved vertical scrollbar has a
            // stable slot: measure the interior width and use it end
            // to end.
            const available = { w: pane.clientWidth - 24 }
            if (available.w <= 0) return
            /* Fit to WIDTH only — the sheet is allowed to overflow
             * vertically and the pane scrolls when it does. The old
             * min(widthScale, heightScale) clamp shrank a tall A4
             * sheet down to whatever the toolbar-and-footer chrome
             * left of the pane's height, which read as a tiny square
             * on smaller screens. A big scrolling sheet is easier to
             * read than a small one that fits, and it matches the
             * behaviour of the Fields tab's preview. */
            const scale = available.w / visualSheetW
            setFit({ width: Math.floor(sheetW * scale), height: Math.floor(sheetH * scale) })
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(pane)
        return () => observer.disconnect()
    }, [sheetW, sheetH, visualSheetW, visualSheetH])

    const begin = useCallback((
        event: React.PointerEvent,
        element: ReportElement,
        mode: 'move' | 'resize',
        corner?: ResizeCorner,
    ) => {
        const sheet = sheetRef.current
        if (!sheet) return
        event.preventDefault()
        event.stopPropagation()

        /* Work out what this gesture is acting on.
         *  - Ctrl / Cmd-click toggles the element in the selection and
         *    does NOT start a drag, so a reader can build a selection
         *    without nudging anything.
         *  - Clicking an element that is already selected keeps the whole
         *    selection and drags all of it.
         *  - Clicking an unselected element replaces the selection. */
        const additive = event.ctrlKey || event.metaKey
        if (additive && mode === 'move') {
            onSelect(selectedIds.includes(element.id)
                ? selectedIds.filter((id) => id !== element.id)
                : [...selectedIds, element.id])
            return
        }

        const targets = mode === 'resize'
            ? [element.id]
            : selectedIds.includes(element.id) ? selectedIds : [element.id]
        if (!selectedIds.includes(element.id)) onSelect([element.id])

        const origins: Record<string, { x: number; y: number; w: number; h: number }> = {}
        for (const id of targets) {
            const target = format.elements.find((candidate) => candidate.id === id)
            if (target) origins[id] = { x: target.x, y: target.y, w: target.w, h: target.h }
        }

        // Capture on the sheet, not the handle: the pointer routinely leaves a
        // small element mid-drag, and without capture the gesture would end the
        // moment it did.
        sheet.setPointerCapture(event.pointerId)
        drag.current = {
            ids: targets,
            mode,
            corner,
            startX: event.clientX,
            startY: event.clientY,
            origins,
            rect: sheet.getBoundingClientRect(),
        }
        setDragging(targets)
    }, [onSelect, selectedIds, format.elements])

    const move = useCallback((event: React.PointerEvent) => {
        const state = drag.current
        if (!state) return

        const browserDx = event.clientX - state.startX
        const browserDy = event.clientY - state.startY

        /* Un-rotate the pointer delta so the sheet's own x/y axes always
         * follow the reader's screen. `state.rect` is the ROTATED visual
         * bounding box (getBoundingClientRect accounts for CSS
         * transforms), so `rect.width` is the sheet's natural HEIGHT in
         * pixels when viewRotation is 90 / 270, and its natural WIDTH
         * otherwise. Both facts get folded in below. */
        let sheetDxPx: number
        let sheetDyPx: number
        let sheetWidthPx: number
        let sheetHeightPx: number
        switch (viewRotation) {
            case 90:
                sheetDxPx = browserDy
                sheetDyPx = -browserDx
                sheetWidthPx = state.rect.height
                sheetHeightPx = state.rect.width
                break
            case 180:
                sheetDxPx = -browserDx
                sheetDyPx = -browserDy
                sheetWidthPx = state.rect.width
                sheetHeightPx = state.rect.height
                break
            case 270:
                sheetDxPx = -browserDy
                sheetDyPx = browserDx
                sheetWidthPx = state.rect.height
                sheetHeightPx = state.rect.width
                break
            default:
                sheetDxPx = browserDx
                sheetDyPx = browserDy
                sheetWidthPx = state.rect.width
                sheetHeightPx = state.rect.height
        }
        const dx = (sheetDxPx / sheetWidthPx) * 100
        const dy = (sheetDyPx / sheetHeightPx) * 100

        if (state.mode === 'move') {
            /* Every element in the selection travels by the same delta so
             * their relative arrangement is preserved. Each one is then
             * clamped INSIDE the sheet on its own dimensions — the old
             * clamp let the corner leak 5 % past every edge (a bleed
             * "feature" the printer never asked for), which is why an
             * element could keep going past the page after the sheet
             * ended. Right / bottom edges are pinned at (100 − w) and
             * (100 − h), so the element cannot leave the sheet at all. */
            for (const id of state.ids) {
                const origin = state.origins[id]
                if (!origin) continue
                onChange(id, {
                    x: snap(clamp(origin.x + dx, 0, Math.max(0, 100 - origin.w))),
                    y: snap(clamp(origin.y + dy, 0, Math.max(0, 100 - origin.h))),
                })
            }
            return
        }

        /* Resize. Which edges move depends on the corner that was grabbed:
         * the south / east corners push the far edge out (w / h grow with
         * the delta), while the north / west corners pull the near edge in
         * (x / y follow the pointer and w / h shrink by the same amount,
         * keeping the opposite edge pinned). All four corners are also
         * capped so the resized rect never leaves the sheet — the SE / NE
         * corners can grow only until the right edge reaches 100 %, and
         * the NW / SW corners can pull only until the left edge reaches
         * 0 %. Same clamp on the vertical axis. */
        const id = state.ids[0]
        const origin = state.origins[id]
        if (!origin) return
        const corner: ResizeCorner = state.corner ?? 'se'
        const MIN_W = 3
        const MIN_H = 2
        const patch: Partial<ReportElement> = {}

        if (corner === 'se' || corner === 'ne') {
            // Growing rightwards: cap w so the right edge does not pass 100.
            patch.w = snap(clamp(origin.w + dx, MIN_W, Math.max(MIN_W, 100 - origin.x)))
        } else {
            // Growing leftwards: the right edge stays put, so the width
            // gained is exactly the width the left edge gave up. Cap w so
            // the left edge does not cross 0.
            const right = origin.x + origin.w
            const nextW = clamp(origin.w - dx, MIN_W, right)
            patch.w = snap(nextW)
            patch.x = snap(clamp(right - nextW, 0, 100 - MIN_W))
        }

        if (corner === 'se' || corner === 'sw') {
            patch.h = snap(clamp(origin.h + dy, MIN_H, Math.max(MIN_H, 100 - origin.y)))
        } else {
            const bottom = origin.y + origin.h
            const nextH = clamp(origin.h - dy, MIN_H, bottom)
            patch.h = snap(nextH)
            patch.y = snap(clamp(bottom - nextH, 0, 100 - MIN_H))
        }

        onChange(id, patch)
    }, [onChange, viewRotation])

    const end = useCallback((event: React.PointerEvent) => {
        if (!drag.current) return
        sheetRef.current?.releasePointerCapture(event.pointerId)
        drag.current = null
        setDragging([])
    }, [])

    return (
        /* Scroll pane, matching the Fields-tab preview.
         *
         * `overflow-y-scroll` reserves the scrollbar always so the fit
         * calc above cannot ping-pong when a taller sheet toggles the
         * scrollbar in. `overflow-x-auto` keeps a horizontal scroll
         * available should the editor ever hand this a landscape sheet
         * inside a portrait pane. The inner wrapper is a flex row so a
         * short sheet stays horizontally centred and a tall one scrolls
         * from the top rather than a centred position that hides the
         * header. */
        <div ref={paneRef} className="h-full min-h-0 overflow-y-scroll overflow-x-auto rounded-xl bg-ink-100/60 p-2">
          <div className="flex min-h-full justify-center">
            <div
                ref={sheetRef}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                // Clicking the blank sheet clears the whole selection —
                // unless Ctrl / Cmd is held, which is the reader building
                // a multi-selection and would be annoyed to lose it.
                onPointerDown={(event) => { if (!event.ctrlKey && !event.metaKey) onSelect([]) }}
                className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-lg"
                style={{
                    // Explicit pixels from the fit above. `visibility` rather
                    // than a null render so the pane keeps its size on the
                    // first paint and the observer has something to measure.
                    width: fit ? fit.width : '100%',
                    height: fit ? fit.height : undefined,
                    aspectRatio: fit ? undefined : `${sheetW} / ${sheetH}`,
                    visibility: fit ? 'visible' : 'hidden',
                    touchAction: 'none',
                    // View-only rotation — CSS transform leaves the DOM
                    // layout box alone, so the parent pane still measures
                    // the natural (unrotated) sheet dimensions. The pane's
                    // fit calc uses the ROTATED bounding box (see
                    // visualSheetW / visualSheetH above) to ensure the
                    // whole rotated sheet fits in the pane.
                    transform: viewRotation ? `rotate(${viewRotation}deg)` : undefined,
                    transformOrigin: 'center center',
                }}
            >
              {/* Natural-size inner frame — every element inside draws at
                  the sheet's true mm/pt dimensions, and one CSS transform
                  scales the whole frame down to the pane's fit width.
                  Because the transform doesn't affect layout, percentage-
                  based children still resolve against the natural frame,
                  so the arithmetic is identical to what the print sheet
                  and the Fields-tab preview run. Point-sized fonts and
                  mm-based row heights therefore match print row-for-row. */}
              <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${naturalW}px`,
                    height: `${naturalH}px`,
                    transform: fit ? `scale(${fit.width / naturalW})` : undefined,
                    transformOrigin: 'top left',
                }}
              >
                {/* Margin guides — dashed, non-interactive, so the safe area is
                    visible while dragging without being something to grab.
                    Hidden when a real `meta` is in hand: the canvas is then
                    a fidelity preview, not a template editor, and the reader
                    wants to see what the printer prints — no editor overlays. */}
                {!meta && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute border border-dashed border-brand-500/30"
                        style={{
                            top: `${(format.page.marginTop / sheetH) * 100}%`,
                            bottom: `${(format.page.marginBottom / sheetH) * 100}%`,
                            left: `${(format.page.marginLeft / sheetW) * 100}%`,
                            right: `${(format.page.marginRight / sheetW) * 100}%`,
                        }}
                    />
                )}

                {/* Header / body / footer, derived from where the table sits.
                    The zones are not a constraint — anything can go anywhere —
                    but "put the signatures in the footer" needs the footer to
                    be somewhere you can see. Suppressed alongside the margin
                    guides when a real meta is in hand — same reason. */}
                {!meta && table && (
                    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
                        {([
                            { label: 'Header', top: 0, height: table.y },
                            { label: 'Body', top: table.y, height: table.h },
                            { label: 'Footer', top: table.y + table.h, height: Math.max(0, 100 - table.y - table.h) },
                        ] as const).filter((zone) => zone.height > 4).map((zone) => (
                            <div key={zone.label} className="absolute left-0 right-0 border-t border-dashed border-ink-200/70"
                                style={{ top: `${zone.top}%`, height: `${zone.height}%` }}>
                                <span className="absolute left-1 top-0.5 text-[8px] font-semibold uppercase tracking-wider text-ink-300">
                                    {zone.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {format.elements.map((element) => {
                    const selected = selectedIds.includes(element.id)
                    // Resize handles only make sense on a single target —
                    // dragging a corner with several elements selected has
                    // no one obvious meaning.
                    const isOnlySelection = selected && selectedIds.length === 1
                    const isDragging = dragging.includes(element.id)
                    return (
                        <div
                            key={element.id}
                            onPointerDown={(event) => begin(event, element, 'move')}
                            role="button"
                            tabIndex={0}
                            aria-label={`${element.kind} element`}
                            className={`absolute select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${selected ? 'ring-2 ring-brand ring-offset-1' : 'hover:ring-1 hover:ring-brand/40'}`}
                            style={{
                                left: `${element.x}%`,
                                top: `${element.y}%`,
                                width: `${element.w}%`,
                                height: `${element.h}%`,
                                opacity: element.opacity,
                                transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                                zIndex: element.kind === 'watermark' ? 0 : 1,
                            }}
                        >
                            {element.kind === 'line' ? (
                                // Height IS the stroke weight, so the resize
                                // grip sets thickness as well as length.
                                <div className="h-full w-full" style={{ background: element.color }} />
                            ) : element.kind === 'table' ? (
                                tablePreview && tablePreview.lines.length ? (
                                    /* Draw the mini-table as a REAL <table>,
                                     * using the SAME structure PreviewPage
                                     * and the print sheet consume: same
                                     * colgroup, same 8.5 pt cells, same
                                     * rowSpan handling, same wrap rules,
                                     * fed by the SAME `ReportLine[]` slice
                                     * the paginator emits. That is what
                                     * makes the Settings-tab canvas,
                                     * the Fields-tab preview and the
                                     * printed sheet finally agree on row
                                     * count — three tabs, one renderer.
                                     * A stray extra div here would drift
                                     * the wrap by a hair and re-open the
                                     * 17-vs-13 gap, so nothing wraps the
                                     * <table> that isn't in the print
                                     * sheet's own structure too. */
                                    (() => {
                                        const widths = reportColumnWidths(tablePreview.headers)
                                        const previewHeaders = tablePreview.headers
                                        const previewLines = tablePreview.lines
                                        /* Table Orientation — the grid is laid
                                         * out in a box whose width and height
                                         * are swapped, then turned 90° and slid
                                         * into the element's box. Pixel sizes
                                         * rather than percentages because a
                                         * rotated child can't inherit "the
                                         * parent's height as my width" from
                                         * CSS. Measured in NATURAL pixels (the
                                         * frame the CSS transform above scales
                                         * from), so the rotation math stays
                                         * correct at any fit width. */
                                        const boxW = (element.w / 100) * naturalW
                                        const boxH = (element.h / 100) * naturalH
                                        const rotatedStyle: React.CSSProperties = tableRotated
                                            ? {
                                                width: boxH,
                                                height: boxW,
                                                overflow: 'hidden',
                                                transform: `translateX(${boxW}px) rotate(90deg)`,
                                                transformOrigin: 'top left',
                                            }
                                            : { width: '100%', height: '100%', overflow: 'hidden' }
                                        return (
                                            <div style={rotatedStyle}>
                                                <table
                                                    style={{
                                                        /* A hair under 100 % —
                                                         * the wrapper clips at
                                                         * the box edge and a
                                                         * collapsed table at
                                                         * exactly full width
                                                         * puts its outer right
                                                         * hairline on the clip
                                                         * edge where it rounds
                                                         * away. Same back-off
                                                         * the print sheet uses. */
                                                        width: 'calc(100% - 0.4mm)',
                                                        /* Stretch to fill the wrapper vertically.
                                                         * Combined with the spacer row at the end
                                                         * of tbody, this keeps the outline flush
                                                         * with the element's own box even when
                                                         * the paginator packs fewer rows than the
                                                         * box's height allows. */
                                                        height: '100%',
                                                        borderCollapse: 'collapse',
                                                        tableLayout: 'fixed',
                                                        fontSize: '8.5pt',
                                                        borderRight: '1px solid #a6b4c5',
                                                        borderBottom: '1px solid #a6b4c5',
                                                    }}
                                                >
                                                    {/* Stretch the table to fill the rotated box
                                                        so the reader does not see an empty white
                                                        strip inside the element's outline. The
                                                        paginator packs rows only up to what fits;
                                                        anything the last row leaves is absorbed
                                                        by the spacer row at the bottom of tbody
                                                        below. */}
                                                    <colgroup>
                                                        {widths.map((w, i) => (
                                                            <col key={i} style={{ width: `${w}%` }} />
                                                        ))}
                                                    </colgroup>
                                                    <thead>
                                                        <tr>
                                                            {previewHeaders.map((header, index) => {
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
                                                        {previewLines.map((line, rowIndex) => {
                                                            if (line.band) {
                                                                return (
                                                                    <tr key={rowIndex}>
                                                                        <td
                                                                            colSpan={previewHeaders.length}
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
                                                            return (
                                                                <tr key={rowIndex}>
                                                                    {(line.cells || []).map((cell, cellIndex) => {
                                                                        // A null cell is covered by a
                                                                        // rowSpan from a previous row on
                                                                        // this page — skip it entirely,
                                                                        // exactly like PreviewPage.
                                                                        if (cell === null) return null
                                                                        const role = reportColumnRole(previewHeaders[cellIndex] || '', cellIndex)
                                                                        const isCenter = ['sno', 'year', 'status', 'pincode'].includes(role)
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
                                                                                    // Client, Business, Service and every
                                                                                    // other role read in ink black. Was
                                                                                    // brand orange for Business, but the
                                                                                    // reader wanted the preview to match
                                                                                    // the printed sheet's plain black
                                                                                    // rendering — a coloured column on
                                                                                    // screen only disagrees with paper.
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
                                                        {/* Blank ruled rows — one per unused row
                                                            the paginator left in the box. Every
                                                            column keeps its border and its 5.2 mm
                                                            min-height, so the grid continues past
                                                            the last data row to the design's own
                                                            edge. The count comes from the
                                                            paginator (`paginated.fillers`), so
                                                            the canvas, the Fields-tab preview and
                                                            the printed sheet all end at the same
                                                            line without any renderer guessing. */}
                                                        {Array.from({ length: tablePreview.fillerCount ?? 0 }, (_, i) => (
                                                            <tr key={`blank-${i}`} aria-hidden>
                                                                {previewHeaders.map((_, columnIdx) => {
                                                                    const role = reportColumnRole(previewHeaders[columnIdx] || '', columnIdx)
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
                                        )
                                    })()
                                ) : (
                                    // Standalone template editor: no report is
                                    // in hand, so a shape is drawn instead of
                                    // pretending to know what will be in it.
                                    <div className="flex h-full w-full flex-col gap-[2px] overflow-hidden rounded-[2px] border border-dashed border-ink-300 bg-white/60 p-[3px]">
                                        <div className="h-[9%] min-h-[4px] w-full rounded-[1px] bg-[#344b63]" />
                                        {Array.from({ length: 8 }, (_, i) => (
                                            <div key={i} className="h-[9%] min-h-[3px] w-full rounded-[1px] bg-ink-100" />
                                        ))}
                                        <span className="mt-auto text-center text-[8px] font-semibold uppercase tracking-wide text-ink-400">
                                            Report table
                                        </span>
                                    </div>
                                )
                            ) : element.kind === 'logo' ? (
                                element.dataUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={element.dataUrl} alt="" draggable={false}
                                        className="h-full w-full object-contain" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-[2px] border border-dashed border-ink-300 text-[9px] text-ink-400">
                                        Logo
                                    </div>
                                )
                            ) : element.kind === 'signature' ? (
                                /* Signature text — the natural-size frame
                                 * above lets us set a real pt size and have
                                 * it scale in lockstep with the sheet. Same
                                 * pt values the print sheet and the PDF
                                 * emit, so the sidebar's Font size (pt)
                                 * input finally reads the same on the
                                 * canvas as it does on paper. */
                                <div className="flex h-full w-full flex-col justify-end">
                                    <div className="w-full border-t border-ink-400" />
                                    <span
                                        className="mt-[2px] w-full truncate leading-tight"
                                        style={{
                                            fontSize: `${element.fontSize}pt`,
                                            fontWeight: element.bold ? 800 : 400,
                                            fontStyle: element.italic ? 'italic' : undefined,
                                            color: element.color,
                                            textAlign: element.align,
                                        }}
                                    >
                                        {resolve(element.text) || PLACEHOLDER.signature}
                                    </span>
                                </div>
                            ) : (
                                <div
                                    className="flex h-full w-full items-center overflow-hidden"
                                    style={{ justifyContent: element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start' }}
                                >
                                    <span
                                        className="w-full truncate leading-tight"
                                        style={{
                                            // Real pt against the natural-size
                                            // sheet frame — the CSS transform
                                            // upstairs then scales the whole
                                            // frame (and this type with it),
                                            // so what the canvas shows is
                                            // what the printed sheet renders.
                                            fontSize: `${element.fontSize}pt`,
                                            fontWeight: element.bold ? 800 : 400,
                                            fontStyle: element.italic ? 'italic' : undefined,
                                            color: element.color,
                                            textAlign: element.align,
                                            textTransform: element.kind === 'watermark' ? 'uppercase' : undefined,
                                            letterSpacing: element.kind === 'watermark' ? '0.08em' : undefined,
                                        }}
                                    >
                                        {resolve(element.text) || PLACEHOLDER[element.kind] || ''}
                                    </span>
                                </div>
                            )}

                            {/* Resize grips on all four corners, shown only
                                when this is the sole selected element so the
                                page is not covered in handles. Each corner
                                pulls its own pair of edges — see the resize
                                branch in `move`. */}
                            {isOnlySelection && ([
                                { corner: 'nw' as const, position: '-top-1 -left-1', cursor: 'cursor-nwse-resize' },
                                { corner: 'ne' as const, position: '-top-1 -right-1', cursor: 'cursor-nesw-resize' },
                                { corner: 'sw' as const, position: '-bottom-1 -left-1', cursor: 'cursor-nesw-resize' },
                                { corner: 'se' as const, position: '-bottom-1 -right-1', cursor: 'cursor-nwse-resize' },
                            ]).map(({ corner, position, cursor }) => (
                                <span
                                    key={corner}
                                    onPointerDown={(event) => begin(event, element, 'resize', corner)}
                                    role="button"
                                    tabIndex={-1}
                                    aria-label={`Resize from ${corner}`}
                                    className={`absolute size-3 rounded-sm border border-white bg-brand shadow ${position} ${cursor}`}
                                />
                            ))}
                        </div>
                    )
                })}
              </div>
            </div>
          </div>
        </div>
    )
}
