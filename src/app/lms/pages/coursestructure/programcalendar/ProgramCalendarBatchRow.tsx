"use client"

/* Program Calendar ▸ batch-selector row.
 *
 * Extracted from ProgramCalendarContent so the "Program Calendar for
 * batch: [Batch ▼]" selector can sit alongside a Teaching Elements
 * filter without bloating the main file further:
 *
 *   [Program Calendar for batch: [Batch ▼]]  [Teaching Elements ▼]
 *
 * Teaching Elements is a MULTI-CHECKBOX dropdown — same pattern as
 * pedagogy2/pedagogyMainView (line 692–735). One row per element,
 * plus a leading "All Teaching Elements" checkbox that ticks / unticks
 * every option. Each per-element checkbox is independent, so the reader
 * can show any combination (e.g. I Do + You Do, no We Do). Wired to
 * the same hideIDo / hideWeDo / hideYouDo state the calendar reads.
 *
 * The whole component only makes sense when the course has real batches;
 * ProgramCalendarContent already guards on `realBatches.length > 0`.
 */

import ProgramCalendarTeachingElements from './ProgramCalendarTeachingElements'
import type { CalendarGroupInfo } from './api/programCalendarApi'

type Batch = { _id: string; batchName: string }

type Props = {
    /** Degree Program with a calendar per group: which group is on screen and
     *  what can be picked. null for every other course. */
    calendarGroup?: CalendarGroupInfo | null
    onCalendarGroupChange?: (group: string) => void
    // Existing batch selector props (unchanged behaviour).
    realBatches: Batch[]
    programCalendarViewBatchId: string
    onBatchChange: (value: string) => void
    programCalendarSameForAllBatches: boolean

    // Teaching Elements checkboxes drive calendar column / row visibility.
    // hideIDo / hideWeDo hide the two teaching columns; hideYouDo hides
    // the Assessment rows (state stored here; renderer wiring is a
    // follow-up if the reader needs it).
    hideIDo: boolean
    hideWeDo: boolean
    hideYouDo: boolean
    setHideIDo: (value: boolean) => void
    setHideWeDo: (value: boolean) => void
    setHideYouDo: (value: boolean) => void
}

export default function ProgramCalendarBatchRow(props: Props) {
    const {
        calendarGroup,
        onCalendarGroupChange,
        realBatches,
        programCalendarViewBatchId,
        onBatchChange,
        programCalendarSameForAllBatches,
        hideIDo,
        hideWeDo,
        hideYouDo,
        setHideIDo,
        setHideWeDo,
        setHideYouDo,
    } = props

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {calendarGroup ? (
                // Degree Program: each group here has (or will have) its own
                // calendar. Switching loads that group's — the page remounts.
                <>
                    <label htmlFor="pc-group" className="text-[12px] font-semibold text-heading">Program Calendar for:</label>
                    <select
                        id="pc-group"
                        value={calendarGroup.key}
                        onChange={e => onCalendarGroupChange?.(e.target.value)}
                        className="h-8 rounded-control border border-hairline-strong bg-white px-2.5 text-[12px] font-medium text-body"
                    >
                        {calendarGroup.targets.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {calendarGroup.inherited ? (
                        <span className="inline-flex items-center rounded-chip bg-warn-50 px-2 py-0.5 text-[11px] font-medium text-warn-700">
                            Following {calendarGroup.inheritedFrom === 'Common calendar' ? 'the common calendar' : `${calendarGroup.inheritedFrom}'s calendar`}. Saving here gives {calendarGroup.label} its own.
                        </span>
                    ) : (
                        <span className="text-[11px] text-faint">{calendarGroup.label} has its own calendar.</span>
                    )}
                </>
            ) : (<>
            <label className="text-[12px] font-semibold text-heading">Program Calendar for batch:</label>
            <select
                value={programCalendarViewBatchId}
                onChange={e => onBatchChange(e.target.value)}
                disabled={programCalendarSameForAllBatches}
                title={programCalendarSameForAllBatches ? 'Common program calendar for all batches' : undefined}
                className={`h-8 rounded-control border border-hairline-strong bg-white px-2.5 text-[12px] font-medium text-body ${programCalendarSameForAllBatches ? 'cursor-not-allowed opacity-60' : ''}`}
            >
                <option value="">Select a batch</option>
                {realBatches.map(batch => (
                    <option key={batch._id} value={batch._id}>{batch.batchName}</option>
                ))}
            </select>
            {programCalendarSameForAllBatches && (
                <span className="text-[11px] text-faint">Every batch follows the same schedule.</span>
            )}
            </>)}

            {/* Right-hand controls — Teaching Elements only. The dropdown
                itself is a shared component so the Reports tab renders the
                same UI wired to the same state. */}
            <div className="ml-auto">
                <ProgramCalendarTeachingElements
                    hideIDo={hideIDo}
                    hideWeDo={hideWeDo}
                    hideYouDo={hideYouDo}
                    setHideIDo={setHideIDo}
                    setHideWeDo={setHideWeDo}
                    setHideYouDo={setHideYouDo}
                />
            </div>
        </div>
    )
}
