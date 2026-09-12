import { http } from '@/lib/http'
import {
    BRAND_ACCENT, BRAND_ADDRESS, BRAND_CONTACT, BRAND_HAIRLINE, BRAND_INK,
    BRAND_MARK_PNG, BRAND_MUTED, BRAND_NAME,
} from './brand'

/* Report page design — a canvas of positioned elements, one set per setting.

   Positions are a PERCENTAGE of the page, not millimetres or pixels: switching
   A4 → Letter or landscape → portrait then keeps a layout intact instead of
   throwing everything off the sheet, and the editor's canvas can be any size on
   screen with no scale factor to keep in step. */

export type Align = 'left' | 'center' | 'right'
export type PaperSize = 'a4' | 'letter' | 'legal'
export type Orientation = 'portrait' | 'landscape'
export type ElementKind = 'text' | 'logo' | 'line' | 'table' | 'watermark' | 'signature' | 'pageNumber'

export type ReportElement = {
    /** Stable across reorders — the editor selects by it. */
    id: string
    kind: ElementKind
    /** Percent of the page; x/y are the top-left corner. */
    x: number
    y: number
    w: number
    h: number
    text: string
    /** Points, as a PDF measures type. The canvas scales it to the sheet. */
    fontSize: number
    bold: boolean
    italic: boolean
    align: Align
    color: string
    opacity: number
    rotation: number
    /** Data URL for `logo`, so a design is self-contained. */
    dataUrl: string
    everyPage: boolean
}

export type ReportFormat = {
    name: string
    /** The fallback, used by every client no other setting names. */
    isDefault: boolean
    /** Clients this setting applies to. Empty when it is the default. */
    clients: string[]
    page: {
        size: PaperSize
        orientation: Orientation
        /** Millimetres, the unit a printer dialog uses. */
        marginTop: number
        marginRight: number
        marginBottom: number
        marginLeft: number
    }
    elements: ReportElement[]
}

export type ReportSettings = {
    institution?: string
    formats: ReportFormat[]
    updatedBy?: string
    updatedAt?: string
}

/** Paper dimensions in millimetres, portrait. The canvas uses the ratio. */
export const PAPER_MM: Record<PaperSize, { width: number; height: number; label: string }> = {
    a4: { width: 210, height: 297, label: 'A4' },
    letter: { width: 216, height: 279, label: 'Letter' },
    legal: { width: 216, height: 356, label: 'Legal' },
}

const base = (id: string, kind: ElementKind): ReportElement => ({
    id, kind,
    x: 8, y: 40, w: 30, h: 8,
    text: '', fontSize: 12, bold: false, italic: false,
    align: 'left', color: '#101828', opacity: 1, rotation: 0,
    dataUrl: '', everyPage: false,
})

/** A new element of each kind, sized and placed so it lands somewhere sensible
 *  rather than on top of whatever is already there. */
export const newElement = (kind: ElementKind, id: string): ReportElement => {
    const element = base(id, kind)
    if (kind === 'text') return { ...element, text: 'Text', w: 34, h: 6 }
    if (kind === 'logo') return { ...element, x: 6, y: 4, w: 14, h: 9 }
    // A hairline by default — thickness is its height, so the resize grip
    // doubles as a stroke-weight control.
    if (kind === 'line') return { ...element, x: 6, y: 50, w: 88, h: 0.4, color: '#d0d5dd' }
    if (kind === 'table') return { ...element, x: 6, y: 22, w: 88, h: 62 }
    if (kind === 'watermark') return {
        ...element, text: 'CONFIDENTIAL', x: 20, y: 42, w: 60, h: 14,
        fontSize: 44, bold: true, align: 'center', opacity: 0.08, rotation: -28,
    }
    if (kind === 'signature') return { ...element, text: 'Authorised signatory', x: 70, y: 82, w: 24, h: 7, fontSize: 9, align: 'center' }
    if (kind === 'pageNumber') return { ...element, x: 74, y: 92, w: 20, h: 4, fontSize: 9, align: 'right', color: '#667085', everyPage: true }
    return element
}

/* ── The letterhead ───────────────────────────────────────────────────────────

   A printed report is a document FROM the institution, so it is built like one:
   a masthead, a ruled line, the data, a ruled line, and the sign-off. Laid out
   top to bottom the page reads

        [mark]        ORGANISATION            [mark]
                        address
                       contact
      ───────────────────────────────────────────────  (accent rule)
      ───────────────────────────────────────────────  (hairline)
      Report title                    scope · generated

      ┌─────────────────────────────────────────────┐
      │                                             │
      │                 t h e   t a b l e           │   <- mark, faint, centred
      │                                             │
      └─────────────────────────────────────────────┘

                                      ─────────────
                                     Authorised signatory
      ───────────────────────────────────────────────  (hairline)
      Org · title                             Page 1 of 3

   Every measurement is a PERCENTAGE of the sheet, so the same design prints at
   A4 or Letter, portrait or landscape, without being redrawn. The numbers below
   are chosen against A4 landscape (297 x 210 mm), the default paper:

     - the two marks are 6.5% wide and 9.5% tall, which is 19.3 x 20.0 mm —
       square, so the round mark is not squashed into an oval;
     - they sit at x 4.5 and x 89 so both are inset 4.5% from their edge, and
       the rules, the table and the footer all share that same 4.5 / 95.5 pair.
       A letterhead is read as one column; a stray half-percent shows;
     - the watermark's box is x 8 w 84, so its centre lands exactly at 50%.
       It is deliberately wide because the type inside it is FITTED to the
       box: a long organisation name simply prints smaller, and a wide box
       means it has to shrink less far before it fits.
       Its y of 44.5 is a compromise: the PDF anchors text by its BASELINE and
       the print preview by the TOP of its line box, and 44.5 puts the middle of
       a 54pt line within a millimetre of the page's centre in both.

   Header, rules, watermark, signature and footer are marked `everyPage`, so a
   sheet that gets separated from the others still says where it came from. Only
   the report title and its scope caption are first-page-only — repeating them
   would read as a second report starting.

   The masthead's wording is the BRAND's, fixed — see brand.ts. A report out of
   this LMS carries SmartCliff's letterhead whichever institution's data it
   shows. Only {title}, {scope} and {generated} are substituted, from the report
   being run. ({org}, {address} and {contact} still resolve from the
   institution's record for any design that chooses to use them.) */
export const letterheadElements = (): ReportElement[] => [
    // ── Masthead ────────────────────────────────────────────────────────────
    { ...newElement('logo', 'markLeft'), x: 4.5, y: 3, w: 6.5, h: 9.5, dataUrl: BRAND_MARK_PNG, everyPage: true },
    { ...newElement('text', 'org'), text: BRAND_NAME, x: 14, y: 3.2, w: 72, h: 7, fontSize: 20, bold: true, align: 'center', color: BRAND_INK, everyPage: true },
    { ...newElement('text', 'address'), text: BRAND_ADDRESS, x: 14, y: 9.4, w: 72, h: 4, fontSize: 9, align: 'center', color: BRAND_MUTED, everyPage: true },
    { ...newElement('text', 'contact'), text: BRAND_CONTACT, x: 14, y: 12.9, w: 72, h: 3.5, fontSize: 8.5, align: 'center', color: BRAND_MUTED, everyPage: true },
    { ...newElement('logo', 'markRight'), x: 89, y: 3, w: 6.5, h: 9.5, dataUrl: BRAND_MARK_PNG, everyPage: true },

    // Two rules, not one: the accent carries the mark's colour down into the
    // page, the hairline under it gives the masthead a base to sit on.
    { ...newElement('line', 'ruleAccent'), x: 4.5, y: 17.2, w: 91, h: 0.3, color: BRAND_ACCENT, everyPage: true },
    { ...newElement('line', 'ruleHair'), x: 4.5, y: 18.3, w: 91, h: 0.1, color: BRAND_HAIRLINE, everyPage: true },

    // ── What this particular report is (first page only) ─────────────────────
    { ...newElement('text', 'reportTitle'), text: '{title}', x: 4.5, y: 20.8, w: 58, h: 5, fontSize: 12.5, bold: true, color: BRAND_INK },
    { ...newElement('text', 'reportMeta'), text: '{scope}  ·  Generated {generated}', x: 57.5, y: 21.3, w: 38, h: 4, fontSize: 8.5, align: 'right', color: BRAND_MUTED },

    // ── The data ─────────────────────────────────────────────────────────────
    { ...newElement('table', 'table'), x: 4.5, y: 26, w: 91, h: 56 },

    // Behind the table, centred on the sheet. 6% is deliberate: enough to read
    // as a watermark on paper, faint enough that an 8pt cell over it is still
    // legible on a grey office printer.
    { ...newElement('watermark', 'watermark'), text: BRAND_NAME, x: 8, y: 44.5, w: 84, h: 14, fontSize: 54, bold: true, align: 'center', color: BRAND_ACCENT, opacity: 0.06, rotation: -24, everyPage: true },

    // ── Sign-off ─────────────────────────────────────────────────────────────
    // Right-aligned with the mark above it, so the page closes on the same
    // vertical the masthead opened on.
    { ...newElement('signature', 'signature'), text: 'Authorised signatory', x: 70.5, y: 83, w: 25, h: 8, fontSize: 9, align: 'center', color: BRAND_INK, everyPage: true },

    { ...newElement('line', 'ruleFoot'), x: 4.5, y: 92, w: 91, h: 0.1, color: BRAND_HAIRLINE, everyPage: true },
    { ...newElement('text', 'footNote'), text: `${BRAND_NAME}  ·  {title}`, x: 4.5, y: 93.2, w: 50, h: 4, fontSize: 8, color: BRAND_MUTED, everyPage: true },
    { ...newElement('pageNumber', 'pageNo'), x: 69.5, y: 93.2, w: 26, h: 4, fontSize: 8, align: 'right', color: BRAND_MUTED, everyPage: true },
]

/** Mirrors the server's own default, so the editor has a real page to arrange
 *  before anything has been saved — and so a brand-new setting starts as a
 *  finished letterhead rather than a blank sheet. Every piece is still free to
 *  be dragged, retyped or deleted; this is only where they start. */
export const newFormat = (name = 'Report setting', isDefault = false): ReportFormat => ({
    name,
    isDefault,
    clients: [],
    page: { size: 'a4', orientation: 'landscape', marginTop: 14, marginRight: 12, marginBottom: 14, marginLeft: 12 },
    elements: letterheadElements(),
})

export const fetchReportSettings = async (institutionId: string): Promise<ReportSettings> => {
    const response = await http.get(`/report-settings/${institutionId}`)
    return response.data?.settings || { formats: [] }
}

export const saveReportSettings = async (
    institutionId: string,
    formats: ReportFormat[],
): Promise<ReportSettings> => {
    const response = await http.put(`/report-settings/${institutionId}`, { formats })
    return response.data?.settings || { formats }
}

/** The design every report prints on.
 *
 *  ONE setting is in use at a time — the one flagged `isDefault` — and it
 *  applies to every report page regardless of which clients the report covers.
 *  Reports routinely span several clients, so choosing a design per client
 *  would leave a multi-client report with no answer; and a report is a document
 *  from the institution, so it carries the institution's letterhead.
 *
 *  The other saved settings are alternatives kept on the shelf: switch which
 *  one is active on the Report Settings page. Undefined when nothing is
 *  configured, which callers read as "the plain built-in layout". */
export const activeFormat = (settings: ReportSettings | undefined): ReportFormat | undefined =>
    settings?.formats?.find((format) => format.isDefault) || settings?.formats?.[0]
