import type { ReportCell, ReportTableRow, ReportTone } from './calendarReportTable'

/* Matches the client's own course-structure workbook (KIOT DIV / ISSD Track):
   a white sheet with thin black gridlines, and colour used only to mark the
   teaching-element bands — yellow over the whole group, then amber I Do,
   blue We Do, green You Do. Every renderer reads this one palette, so the
   preview, Excel, PDF and print all come out looking like that workbook. */
export const REPORT_GRID = '#000000'
export const REPORT_GRID_STRONG = '#000000'

/** The reference workbook's body font, and the heavier face it uses for the
 *  module column that runs down the left edge. */
export const REPORT_FONT = { name: 'Calibri', size: 11 }
export const REPORT_MODULE_FONT = { name: 'Segoe UI', size: 12 }

const WHITE = '#FFFFFF'
const INK = '#000000'

const PALETTE: Record<ReportTone, { header: string; fill: string; text: string; secondary?: string }> = {
    hierarchy: { header: WHITE, fill: WHITE, text: INK },
    module: { header: WHITE, fill: WHITE, text: '#0D0D0D' },
    subModule: { header: WHITE, fill: WHITE, text: '#0D0D0D' },
    topic: { header: WHITE, fill: WHITE, text: INK },
    subTopic: { header: WHITE, fill: WHITE, text: INK },
    // The yellow band that spans every teaching element, exactly as the
    // reference sheet titles D2:G2.
    group: { header: '#FFFF00', fill: '#FFFF00', text: INK },
    iDo: { header: '#FFC000', fill: WHITE, text: INK, secondary: WHITE },
    weDo: { header: '#00B0F0', fill: WHITE, text: INK, secondary: WHITE },
    hours: { header: WHITE, fill: WHITE, text: INK },
    start: { header: WHITE, fill: WHITE, text: INK },
    end: { header: WHITE, fill: WHITE, text: INK },
    planned: { header: '#00B0F0', fill: WHITE, text: INK, secondary: WHITE },
    actual: { header: '#00B050', fill: WHITE, text: INK, secondary: WHITE },
    deviation: { header: '#FF33CC', fill: WHITE, text: INK },
    assessment: { header: '#00B050', fill: '#E2EFDA', text: INK },
    total: { header: WHITE, fill: WHITE, text: INK },
    plain: { header: WHITE, fill: WHITE, text: INK },
}

// Topic-style columns read as a list and are left-aligned in the reference;
// everything else — identifiers, hours, dates — sits centred.
const LEFT_ALIGNED: ReportTone[] = ['topic', 'subTopic', 'deviation']

export function getReportCellStyle(cell: ReportCell, rowKind?: ReportTableRow['kind']): {
    background: string; color: string; bold: boolean; align: 'left' | 'center' | 'right'; borderColor: string; borderWidth: number
} {
    const palette = PALETTE[cell.tone]
    const total = rowKind === 'total'
    const assessment = rowKind === 'assessment' && cell.tone === 'assessment'
    return {
        background: cell.header
            ? cell.secondary ? palette.secondary || WHITE : palette.header
            : assessment ? palette.fill : total ? WHITE : palette.fill,
        color: palette.text,
        bold: Boolean(cell.header || cell.bold || total || assessment),
        align: LEFT_ALIGNED.includes(cell.tone) && !cell.header ? 'left' : 'center',
        borderColor: REPORT_GRID,
        // One thin rule everywhere, like the reference sheet.
        borderWidth: 1,
    }
}
