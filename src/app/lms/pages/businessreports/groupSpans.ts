// Row-group merging for service-scope columns.
//
// Client-scope columns already merge once per block. Some reports also need a
// SUB-block merge inside a block: the Program Calendar's Total Hours / Start /
// End cells describe one teaching block that runs across several topic rows,
// and the calendar tab shows them as one tall cell. A report opts in per
// column (`mergeGroup: true` on the field) and marks its rows with
// GROUP_SPAN_KEY:
//   'N' (N ≥ 1): this row opens a group
//   '0':         this row continues the group opened above it
//   absent:      a lone row that never merges
//
// The on-page review table, the paginator and the PDF path all read spans
// through groupCellSpans, so the merge can't come out differently on screen
// and on paper. Reports that never set the marker (Business Reports, Users,
// …) are untouched: every row reads as a lone row.

export const GROUP_SPAN_KEY = '__groupSpan'

export type GroupCellSpan = {
    /** rowSpan for this row's merged cells; 0 means a row above covers them. */
    rowSpan: number
    /** The row whose values the merged cells print (the group's opener). */
    source: Record<string, string>
}

/** Spans for one block's rows. A continuation row whose group was cut off
 *  (by an interleaved lone row such as an Assessment, or by the block
 *  starting mid-group) opens a fresh merged cell carrying the group's
 *  values again, the same way a page break re-emits a client cell. */
export function groupCellSpans(
    services: Record<string, string>[],
    carry?: { opener: Record<string, string> | null },
): GroupCellSpan[] {
    const out: GroupCellSpan[] = []
    let anchor = -1
    let opener: Record<string, string> | null = carry?.opener ?? null
    services.forEach((service, i) => {
        const mark = service[GROUP_SPAN_KEY]
        if (mark === '0' && anchor >= 0) {
            out[anchor].rowSpan += 1
            out.push({ rowSpan: 0, source: out[anchor].source })
            return
        }
        if (mark === undefined) {
            anchor = -1
            out.push({ rowSpan: 1, source: service })
            return
        }
        if (mark !== '0') opener = service
        anchor = i
        out.push({ rowSpan: 1, source: mark === '0' && opener ? opener : service })
    })
    if (carry) carry.opener = opener
    return out
}
