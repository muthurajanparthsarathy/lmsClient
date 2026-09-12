"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { PAPER_MM, type ReportElement, type ReportFormat } from '../api/reportSettingsService'

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
 *  on the canvas is how a typo gets noticed before it prints as nothing. */
const preview = (text: string) =>
    text.replace(/\{(\w+)\}/g, (whole, key: string) => SAMPLE[key.toLowerCase()] ?? whole)

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

export default function ReportCanvas({
    format, selectedId, onSelect, onChange,
}: {
    format: ReportFormat
    selectedId: string | null
    onSelect: (id: string | null) => void
    onChange: (id: string, patch: Partial<ReportElement>) => void
}) {
    const sheetRef = useRef<HTMLDivElement>(null)
    // The gesture in flight. Held in a ref, not state: it changes on every
    // pointermove and re-rendering the whole canvas per frame would crawl.
    const drag = useRef<null | {
        id: string
        mode: 'move' | 'resize'
        startX: number
        startY: number
        origin: { x: number; y: number; w: number; h: number }
        rect: DOMRect
    }>(null)
    const [dragging, setDragging] = useState<string | null>(null)

    // The table is what splits the page into header / body / footer.
    const table = format.elements.find((element) => element.kind === 'table')

    const paper = PAPER_MM[format.page.size]
    const landscape = format.page.orientation === 'landscape'
    const sheetW = landscape ? paper.height : paper.width
    const sheetH = landscape ? paper.width : paper.height

    /* Fit the sheet to the pane, in pixels.
     *
     * `aspect-ratio` alone cannot do this: with a width it overflows tall panes
     * vertically, and with a height it overflows wide ones horizontally — there
     * is no CSS pair that means "as large as fits, both ways, keeping the
     * ratio". So the pane is measured and the smaller of the two scale factors
     * wins, which is the same arithmetic a print preview does. */
    const paneRef = useRef<HTMLDivElement>(null)
    const [fit, setFit] = useState<{ width: number; height: number } | null>(null)

    useLayoutEffect(() => {
        const pane = paneRef.current
        if (!pane) return
        const measure = () => {
            // The padding is the breathing room around the page; the sheet gets
            // what is left.
            const available = { w: pane.clientWidth - 32, h: pane.clientHeight - 44 }
            if (available.w <= 0 || available.h <= 0) return
            const scale = Math.min(available.w / sheetW, available.h / sheetH)
            setFit({ width: Math.floor(sheetW * scale), height: Math.floor(sheetH * scale) })
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(pane)
        return () => observer.disconnect()
    }, [sheetW, sheetH])

    const begin = useCallback((event: React.PointerEvent, element: ReportElement, mode: 'move' | 'resize') => {
        const sheet = sheetRef.current
        if (!sheet) return
        event.preventDefault()
        event.stopPropagation()
        // Capture on the sheet, not the handle: the pointer routinely leaves a
        // small element mid-drag, and without capture the gesture would end the
        // moment it did.
        sheet.setPointerCapture(event.pointerId)
        drag.current = {
            id: element.id,
            mode,
            startX: event.clientX,
            startY: event.clientY,
            origin: { x: element.x, y: element.y, w: element.w, h: element.h },
            rect: sheet.getBoundingClientRect(),
        }
        setDragging(element.id)
        onSelect(element.id)
    }, [onSelect])

    const move = useCallback((event: React.PointerEvent) => {
        const state = drag.current
        if (!state) return
        const dx = ((event.clientX - state.startX) / state.rect.width) * 100
        const dy = ((event.clientY - state.startY) / state.rect.height) * 100

        if (state.mode === 'move') {
            onChange(state.id, {
                // Allowed a little past the edge: a bleed logo is a real design,
                // and the clamp still stops an element vanishing entirely.
                x: snap(clamp(state.origin.x + dx, -5, 100 - 3)),
                y: snap(clamp(state.origin.y + dy, -5, 100 - 2)),
            })
        } else {
            onChange(state.id, {
                w: snap(clamp(state.origin.w + dx, 3, 100)),
                h: snap(clamp(state.origin.h + dy, 2, 100)),
            })
        }
    }, [onChange])

    const end = useCallback((event: React.PointerEvent) => {
        if (!drag.current) return
        sheetRef.current?.releasePointerCapture(event.pointerId)
        drag.current = null
        setDragging(null)
    }, [])

    return (
        <div ref={paneRef} className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-ink-100/60 p-4">
            <div
                ref={sheetRef}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onPointerDown={() => onSelect(null)}
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
                }}
            >
                {/* Margin guides — dashed, non-interactive, so the safe area is
                    visible while dragging without being something to grab. */}
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

                {/* Header / body / footer, derived from where the table sits.
                    The zones are not a constraint — anything can go anywhere —
                    but "put the signatures in the footer" needs the footer to
                    be somewhere you can see. */}
                {table && (
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
                    const selected = element.id === selectedId
                    const isDragging = element.id === dragging
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
                                // The data, drawn as a shape rather than real rows:
                                // the design is about where the table sits and how
                                // big it is, not what is in it.
                                <div className="flex h-full w-full flex-col gap-[2px] overflow-hidden rounded-[2px] border border-dashed border-ink-300 bg-white/60 p-[3px]">
                                    <div className="h-[9%] min-h-[4px] w-full rounded-[1px] bg-[#344b63]" />
                                    {Array.from({ length: 8 }, (_, i) => (
                                        <div key={i} className="h-[9%] min-h-[3px] w-full rounded-[1px] bg-ink-100" />
                                    ))}
                                    <span className="mt-auto text-center text-[8px] font-semibold uppercase tracking-wide text-ink-400">
                                        Report table
                                    </span>
                                </div>
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
                                <div className="flex h-full w-full flex-col justify-end">
                                    <div className="w-full border-t border-ink-400" />
                                    <span className="mt-[2px] w-full truncate text-[8px] text-ink-500"
                                        style={{ textAlign: element.align }}>
                                        {preview(element.text) || PLACEHOLDER.signature}
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
                                            // Font size is in points against the
                                            // sheet's height, so type scales with
                                            // the canvas exactly as it will on paper.
                                            fontSize: `${(element.fontSize / (sheetH * 2.83)) * 100}cqh`,
                                            fontWeight: element.bold ? 800 : 400,
                                            fontStyle: element.italic ? 'italic' : undefined,
                                            color: element.color,
                                            textAlign: element.align,
                                            textTransform: element.kind === 'watermark' ? 'uppercase' : undefined,
                                            letterSpacing: element.kind === 'watermark' ? '0.08em' : undefined,
                                        }}
                                    >
                                        {preview(element.text) || PLACEHOLDER[element.kind] || ''}
                                    </span>
                                </div>
                            )}

                            {/* Resize grip, only on the selected element so the
                                page is not covered in handles. */}
                            {selected && (
                                <span
                                    onPointerDown={(event) => begin(event, element, 'resize')}
                                    role="button"
                                    tabIndex={-1}
                                    aria-label="Resize"
                                    className="absolute -bottom-1 -right-1 size-3 cursor-nwse-resize rounded-sm border border-white bg-brand shadow"
                                />
                            )}
                        </div>
                    )
                })}
            </div>

            <p className="mt-2 shrink-0 whitespace-nowrap text-[11px] text-subtle">
                {paper.label} · {format.page.orientation} · drag to move, corner to resize
            </p>
        </div>
    )
}
