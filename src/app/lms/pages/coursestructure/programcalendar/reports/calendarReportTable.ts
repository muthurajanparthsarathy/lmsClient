import type {
    CalendarHierarchy,
    CalendarReportOptions,
    CalendarReportSource,
    CalendarReportView,
    CalendarScheduleRow,
} from './programCalendarReport'

/* The one description of a report table that Excel, PDF, print and the preview
   all render. Each renderer only has to walk cells and ask calendarReportStyles
   how to paint them, so the four outputs cannot drift apart.

   Type-only imports from programCalendarReport keep the dependency one-way at
   runtime: that module imports the builders from here, nothing comes back. */

export type ReportTone =
    'hierarchy' | 'module' | 'subModule' | 'topic' | 'subTopic' |
    'group' | 'iDo' | 'weDo' | 'hours' | 'start' | 'end' |
    'planned' | 'actual' | 'deviation' | 'assessment' | 'total' | 'plain'

export type ReportCell = {
    value: string | number
    /** Zero-based grid column of the cell's TOP-LEFT corner. */
    column: number
    colSpan?: number
    rowSpan?: number
    tone: ReportTone
    header?: boolean
    /** A sub-header under a grouped header — tinted rather than solid. */
    secondary?: boolean
    bold?: boolean
}

export type ReportTableRow = {
    kind: 'data' | 'assessment' | 'total'
    cells: ReportCell[]
}

export type CalendarReportTable = {
    columnCount: number
    /** Excel character widths; the preview turns them into percentages. */
    columnWidths: number[]
    headers: ReportCell[][]
    rows: ReportTableRow[]
}

/* The page's merge geometry, which schedule entries alone cannot reconstruct.
   A pedagogy activity merged across h1..h3 is ONE scheduled item, so the
   schedule has no record that rows 2 and 3 are continuations rather than rows
   with nothing in them. ProgramCalendarContent hands that shape over here. */
export type CalendarStructureActivity = {
    type: 'iDo' | 'weDo' | 'youDo'
    activity: string
    hours: number
    /** Rows this cell covers, counted in structure rows (>= 1). */
    rowSpan: number
    /** True on the rows a merge covers but does not start — emit nothing. */
    continuation: boolean
}

export type CalendarStructureRow = {
    module: string
    subModule: string
    topic: string
    subTopic: string
    activities: CalendarStructureActivity[]
}

export type CalendarReportStructure = { rows: CalendarStructureRow[] }

// ─── Shared schedule arithmetic ──────────────────────────────────────────────
// programCalendarReport imports these rather than keeping its own copies, so
// the hours in the summary always agree with the hours in the table.

export const hoursFromMinutes = (minutes: number) => Math.round(minutes / 60 * 100) / 100

export const segmentMinutes = (row: CalendarScheduleRow) =>
    Number.isFinite(row.startMins) && Number.isFinite(row.endMins) ? Math.max(0, row.endMins - row.startMins) : 0

const isoKey = (date: Date) => Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''

/** ISO to the DD/MM/YYYY the calendar page and every export show. */
export const displayDate = (value?: string) => value ? value.split('-').reverse().join('/') : '—'

const textValue = (value?: string) => {
    const trimmed = value?.trim()
    return trimmed && trimmed !== '-' ? trimmed : '—'
}

export type ScheduleGroup = { item: CalendarScheduleRow; minutes: number; start: string; end: string }

export const scheduleKey = (module: string, subModule: string, topic: string, subTopic: string, type: string, activity: string) =>
    JSON.stringify([module, subModule, topic, subTopic, type, activity])

/** Collapse schedule entries into one group per activity, summing the minutes
 *  actually sat in a session and tracking the first and last day it ran.
 *  assessmentGap rows move the calendar on but teach nothing, so they are left
 *  out of every hours figure. */
export function groupSchedule(rows: CalendarScheduleRow[]): Map<string, ScheduleGroup> {
    const groups = new Map<string, ScheduleGroup>()
    for (const row of rows) {
        if (row.type === 'assessmentGap') continue
        const key = scheduleKey(row.module, row.subModule, row.topic, row.subTopic, row.type, row.activity)
        const date = isoKey(row.date)
        const group = groups.get(key)
        if (!group) groups.set(key, { item: row, minutes: segmentMinutes(row), start: date, end: date })
        else {
            group.minutes += segmentMinutes(row)
            if (date && (!group.start || date < group.start)) group.start = date
            if (date && (!group.end || date > group.end)) group.end = date
        }
    }
    return groups
}

/** Deviations that fall inside a group's window, as one wrapped block of text.
 *  A group whose actual dates moved is widened back to the course start: a
 *  cancellation early in the course is why later content slipped, so it belongs
 *  on those rows too — but only backwards, never onto rows that ran earlier. */
export function deviationsFor(
    source: CalendarReportSource,
    planned: { start: string; end: string } | undefined,
    actual: { start: string; end: string } | undefined,
    courseStart: string,
): string {
    if (!actual) return '—'
    const start = planned?.start || actual.start
    const end = [planned?.end || '', actual.end].sort().at(-1) || ''
    const shifted = Boolean(planned && (planned.start !== actual.start || planned.end !== actual.end))
    const from = shifted ? courseStart || start : start
    if (!from || !end) return '—'
    return [...new Set(source.deviations
        .filter((deviation) => deviation.date >= from && deviation.date <= end && deviation.reason.trim())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((deviation) => `${displayDate(deviation.date)}: ${deviation.reason.trim()}`))].join('\n') || '—'
}

// ─── Column plan ─────────────────────────────────────────────────────────────

const HIERARCHY_FIELD: Record<CalendarHierarchy, 'module' | 'subModule' | 'topic' | 'subTopic'> = {
    Module: 'module', 'Sub Module': 'subModule', Topic: 'topic', 'Sub Topic': 'subTopic',
}
const HIERARCHY_TONE: Record<CalendarHierarchy, ReportTone> = {
    Module: 'module', 'Sub Module': 'subModule', Topic: 'topic', 'Sub Topic': 'subTopic',
}
const HIERARCHY_ORDER: CalendarHierarchy[] = ['Module', 'Sub Module', 'Topic', 'Sub Topic']

// Column widths taken from the client's own course-structure workbook.
const WIDTH = { module: 30, subModule: 28, topic: 42, subTopic: 32, activity: 14, hours: 13, date: 16, deviation: 34 }
const HIERARCHY_WIDTH: Record<CalendarHierarchy, number> = {
    Module: WIDTH.module, 'Sub Module': WIDTH.subModule, Topic: WIDTH.topic, 'Sub Topic': WIDTH.subTopic,
}

type ColumnPlan = {
    hierarchy: CalendarHierarchy[]
    iDo: string[]
    weDo: string[]
    comparison: boolean
    deviations: boolean
    columnCount: number
    widths: number[]
    /** Column of the first I Do activity; We Do follows immediately after. */
    activityStart: number
    hoursColumn: number
    startColumn: number
    endColumn: number
    actualHoursColumn: number
    actualStartColumn: number
    actualEndColumn: number
    deviationColumn: number
    /** Where an assessment banner begins — after Module/Sub Module, matching
     *  the page, so those coloured cells keep running down the left edge. */
    bannerColumn: number
}

function planColumns(
    hierarchy: CalendarHierarchy[],
    iDo: string[],
    weDo: string[],
    comparison: boolean,
    deviations: boolean,
): ColumnPlan {
    const widths = hierarchy.map((level) => HIERARCHY_WIDTH[level])
    const activityStart = widths.length
    if (!comparison) {
        iDo.forEach(() => widths.push(WIDTH.activity))
        weDo.forEach(() => widths.push(WIDTH.activity))
    }
    const hoursColumn = widths.length
    widths.push(WIDTH.hours)
    const startColumn = widths.length
    widths.push(WIDTH.date)
    const endColumn = widths.length
    widths.push(WIDTH.date)
    let actualHoursColumn = -1, actualStartColumn = -1, actualEndColumn = -1
    if (comparison) {
        actualHoursColumn = widths.length; widths.push(WIDTH.hours)
        actualStartColumn = widths.length; widths.push(WIDTH.date)
        actualEndColumn = widths.length; widths.push(WIDTH.date)
    }
    let deviationColumn = -1
    if (deviations) { deviationColumn = widths.length; widths.push(WIDTH.deviation) }
    return {
        hierarchy, iDo: comparison ? [] : iDo, weDo: comparison ? [] : weDo, comparison, deviations,
        columnCount: widths.length, widths, activityStart,
        hoursColumn, startColumn, endColumn, actualHoursColumn, actualStartColumn, actualEndColumn, deviationColumn,
        bannerColumn: hierarchy.filter((level) => level === 'Module' || level === 'Sub Module').length,
    }
}

/* Three stacked header rows, the shape the client's own course-structure
   workbook uses:

     row 0   Module │ Topic │ … │      Teaching Learning Elements      │ …
     row 1                        │  I Do  │  We Do  │
     row 2                        │ Concept │ … │ Practice │ … │

   The identity and date columns span all three so they read as one tall cell,
   which is how that workbook merges A2:A4. */
function buildHeaders(plan: ColumnPlan): ReportCell[][] {
    const activityCount = plan.iDo.length + plan.weDo.length
    const rowCount = activityCount ? 3 : plan.comparison ? 2 : 1
    const tall = (cell: ReportCell): ReportCell => rowCount > 1 ? { ...cell, rowSpan: rowCount } : cell

    const group: ReportCell[] = []
    const bands: ReportCell[] = []
    const leaves: ReportCell[] = []

    plan.hierarchy.forEach((level, index) => {
        group.push(tall({ value: level, column: index, tone: HIERARCHY_TONE[level], header: true }))
    })

    if (activityCount) {
        group.push({ value: 'Teaching Learning Elements', column: plan.activityStart, colSpan: activityCount, tone: 'group', header: true })
        if (plan.iDo.length) {
            bands.push({ value: 'I Do', column: plan.activityStart, colSpan: plan.iDo.length, tone: 'iDo', header: true })
            plan.iDo.forEach((activity, index) => leaves.push({ value: activity, column: plan.activityStart + index, tone: 'iDo', header: true, secondary: true }))
        }
        if (plan.weDo.length) {
            const start = plan.activityStart + plan.iDo.length
            bands.push({ value: 'We Do', column: start, colSpan: plan.weDo.length, tone: 'weDo', header: true })
            plan.weDo.forEach((activity, index) => leaves.push({ value: activity, column: start + index, tone: 'weDo', header: true, secondary: true }))
        }
    }

    if (plan.comparison) {
        // Planned and Actual are their own bands, so they sit on the group row
        // and their Total Hours / Start / End fall underneath.
        const span = activityCount ? 2 : 1
        group.push({ value: 'Planned', column: plan.hoursColumn, colSpan: 3, tone: 'planned', header: true })
        group.push({ value: 'Actual', column: plan.actualHoursColumn, colSpan: 3, tone: 'actual', header: true })
        const under = (value: string, column: number, tone: 'planned' | 'actual') =>
            ({ value, column, tone, header: true, secondary: true, ...(span > 1 ? { rowSpan: span } : {}) })
        bands.push(under('Total Hours', plan.hoursColumn, 'planned'))
        bands.push(under('Start Date', plan.startColumn, 'planned'))
        bands.push(under('End Date', plan.endColumn, 'planned'))
        bands.push(under('Total Hours', plan.actualHoursColumn, 'actual'))
        bands.push(under('Start Date', plan.actualStartColumn, 'actual'))
        bands.push(under('End Date', plan.actualEndColumn, 'actual'))
    } else {
        group.push(tall({ value: 'Total Hours', column: plan.hoursColumn, tone: 'hours', header: true }))
        group.push(tall({ value: 'Start Date', column: plan.startColumn, tone: 'start', header: true }))
        group.push(tall({ value: 'End Date', column: plan.endColumn, tone: 'end', header: true }))
    }
    if (plan.deviations) group.push(tall({ value: 'Deviations', column: plan.deviationColumn, tone: 'deviation', header: true }))

    if (rowCount === 1) return [group]
    if (rowCount === 2) return [group, bands]
    return [group, bands, leaves]
}

// ─── Row plan ────────────────────────────────────────────────────────────────

type PlanRow =
    | { kind: 'data'; row: CalendarStructureRow; index: number }
    | { kind: 'assessment'; hours: number; start: string; end: string; module: string; subModule: string }

/** Vertical merge runs for one hierarchy level over the FINAL row list.
 *  `valueOf` returns null for a row the level does not appear on, which both
 *  suppresses its cell and breaks the run — that is how Topic and Sub Topic
 *  stop short of an assessment banner while Module and Sub Module carry on
 *  down beside it. */
function mergeRuns(rows: PlanRow[], valueOf: (row: PlanRow) => string | null): number[] {
    const spans = new Array<number>(rows.length).fill(0)
    let index = 0
    while (index < rows.length) {
        const value = valueOf(rows[index])
        if (value === null) { index++; continue }
        let end = index + 1
        while (end < rows.length && valueOf(rows[end]) === value) end++
        spans[index] = end - index
        index = end
    }
    return spans
}

type ActivityPlacement = { type: 'iDo' | 'weDo'; activity: string; column: number }

function activityColumns(plan: ColumnPlan): ActivityPlacement[] {
    return [
        ...plan.iDo.map((activity, index) => ({ type: 'iDo' as const, activity, column: plan.activityStart + index })),
        ...plan.weDo.map((activity, index) => ({ type: 'weDo' as const, activity, column: plan.activityStart + plan.iDo.length + index })),
    ]
}

type GroupFacts = { minutes: number; start: string; end: string; planned?: ScheduleGroup; actual?: ScheduleGroup }

/** Hours and the date window for everything a merged block covers. Durations
 *  come from the schedule (endMins - startMins), never from the configured
 *  pedagogy hours, so a cancelled or part-run block reports what actually
 *  happened rather than what was intended. */
function factsFor(
    structure: CalendarStructureRow[],
    startIndex: number,
    span: number,
    groups: Map<string, ScheduleGroup>,
    types: readonly ('iDo' | 'weDo' | 'youDo')[],
): GroupFacts {
    let minutes = 0, start = '', end = ''
    for (let index = startIndex; index < startIndex + span && index < structure.length; index++) {
        const row = structure[index]
        for (const activity of row.activities) {
            if (activity.continuation || !types.includes(activity.type)) continue
            const group = groups.get(scheduleKey(row.module, row.subModule, row.topic, row.subTopic, activity.type, activity.activity))
            if (!group) continue
            minutes += group.minutes
            if (group.start && (!start || group.start < start)) start = group.start
            if (group.end && (!end || group.end > end)) end = group.end
        }
    }
    return { minutes, start, end }
}

function buildStructureRows(
    structure: CalendarStructureRow[],
    plan: ColumnPlan,
    planned: Map<string, ScheduleGroup>,
    actual: Map<string, ScheduleGroup>,
    view: CalendarReportView,
    source: CalendarReportSource,
    courseStart: string,
): ReportTableRow[] {
    const primary = view === 'actual' ? actual : planned
    // Assessment banners hang off the LAST row their You Do block covers, the
    // same anchor the calendar page uses, so a block merged over h1..h3 reports
    // once beneath h3 instead of interrupting at h1.
    const banners = new Map<number, { hours: number; start: string; end: string }>()
    structure.forEach((row, index) => {
        for (const activity of row.activities) {
            if (activity.type !== 'youDo' || activity.continuation) continue
            const endRow = Math.min(structure.length - 1, index + Math.max(1, activity.rowSpan) - 1)
            const group = primary.get(scheduleKey(row.module, row.subModule, row.topic, row.subTopic, 'youDo', activity.activity))
            const current = banners.get(endRow) || { hours: 0, start: '', end: '' }
            const minutes = group?.minutes ?? 0
            current.hours += minutes ? hoursFromMinutes(minutes) : activity.hours
            if (group?.start && (!current.start || group.start < current.start)) current.start = group.start
            if (group?.end && (!current.end || group.end > current.end)) current.end = group.end
            banners.set(endRow, current)
        }
    })

    const planRows: PlanRow[] = []
    structure.forEach((row, index) => {
        planRows.push({ kind: 'data', row, index })
        const banner = banners.get(index)
        if (banner && banner.hours > 0) planRows.push({ kind: 'assessment', ...banner, module: row.module, subModule: row.subModule })
    })

    const spans = new Map<CalendarHierarchy, number[]>()
    for (const level of plan.hierarchy) {
        const field = HIERARCHY_FIELD[level]
        const carries = field === 'module' || field === 'subModule'
        spans.set(level, mergeRuns(planRows, (planRow) => planRow.kind === 'data'
            ? planRow.row[field] || ''
            : carries ? planRow[field] || '' : null))
    }

    const placements = activityColumns(plan)
    const planIndexOfData: number[] = []
    planRows.forEach((planRow, index) => { if (planRow.kind === 'data') planIndexOfData[planRow.index] = index })

    /* A vertical merge must never cross an assessment banner. The banner is a
       full-width band, so a cell spanning through it would OVERLAP it — which
       exceljs rejects outright, turning a cosmetic problem into a failed export.
       The merge is cut into segments around the banner instead: the first
       segment carries the value, the rest share its fill so the block still
       reads as one. Module and Sub Module are exempt because the banner starts
       to their right, which is why they alone run unbroken down the edge. */
    const segmentsFor = (dataIndex: number, structureSpan: number) => {
        const segments: { start: number; length: number }[] = []
        let remaining = structureSpan
        let index = planIndexOfData[dataIndex]
        let start = index, length = 0
        while (index < planRows.length && remaining > 0) {
            if (planRows[index].kind === 'assessment') {
                if (length) { segments.push({ start, length }); length = 0 }
                index++
                start = index
                continue
            }
            remaining--
            length++
            index++
        }
        if (length) segments.push({ start, length })
        return segments
    }

    const emissions = new Map<number, ReportCell[]>()
    const emit = (planIndex: number, cell: ReportCell) => {
        const list = emissions.get(planIndex)
        if (list) list.push(cell)
        else emissions.set(planIndex, [cell])
    }
    const emitAcross = (segments: { start: number; length: number }[], cell: ReportCell) => {
        segments.forEach((segment, order) => emit(segment.start, {
            ...cell,
            value: order === 0 ? cell.value : '',
            bold: order === 0 ? cell.bold : false,
            rowSpan: segment.length > 1 ? segment.length : undefined,
        }))
    }

    structure.forEach((row, dataIndex) => {
        const planIndex = planIndexOfData[dataIndex]
        // Which block this row belongs to, mirroring the page's getRowGroupSpan.
        // Only a CONTINUATION row goes without hours and dates — a row with no
        // merges at all still gets its own, or the grid loses a column and every
        // row below it tears.
        let merged = false, startsBlock = true, blockSpan = 1
        for (const activity of row.activities) {
            if (activity.type === 'youDo') continue
            if (activity.rowSpan > 1 || activity.continuation) {
                merged = true
                blockSpan = Math.max(blockSpan, Math.max(1, activity.rowSpan))
                if (activity.continuation) startsBlock = false
            }
        }

        for (const placement of placements) {
            const activity = row.activities.find((item) => item.type === placement.type && item.activity === placement.activity)
            if (!activity) { emit(planIndex, { value: '—', column: placement.column, tone: placement.type }); continue }
            if (activity.continuation) continue
            const group = primary.get(scheduleKey(row.module, row.subModule, row.topic, row.subTopic, placement.type, placement.activity))
            const hours = group ? hoursFromMinutes(group.minutes) : activity.hours
            emitAcross(segmentsFor(dataIndex, Math.max(1, activity.rowSpan)),
                { value: hours > 0 ? hours : '—', column: placement.column, tone: placement.type, bold: hours > 0 })
        }

        if (merged && !startsBlock) return
        const span = merged ? blockSpan : 1
        const segments = segmentsFor(dataIndex, span)
        const plannedFacts = factsFor(structure, dataIndex, span, planned, ['iDo', 'weDo'])
        const actualFacts = factsFor(structure, dataIndex, span, actual, ['iDo', 'weDo'])
        if (plan.comparison) {
            const plannedHours = hoursFromMinutes(plannedFacts.minutes)
            const actualHours = hoursFromMinutes(actualFacts.minutes)
            emitAcross(segments, { value: plannedHours > 0 ? plannedHours : '—', column: plan.hoursColumn, tone: 'planned', bold: true })
            emitAcross(segments, { value: displayDate(plannedFacts.start), column: plan.startColumn, tone: 'planned' })
            emitAcross(segments, { value: displayDate(plannedFacts.end), column: plan.endColumn, tone: 'planned' })
            emitAcross(segments, { value: actualHours > 0 ? actualHours : '—', column: plan.actualHoursColumn, tone: 'actual', bold: true })
            emitAcross(segments, { value: displayDate(actualFacts.start), column: plan.actualStartColumn, tone: 'actual' })
            emitAcross(segments, { value: displayDate(actualFacts.end), column: plan.actualEndColumn, tone: 'actual' })
        } else {
            const shown = view === 'actual' ? actualFacts : plannedFacts
            const hours = hoursFromMinutes(shown.minutes)
            emitAcross(segments, { value: hours > 0 ? hours : '—', column: plan.hoursColumn, tone: 'hours', bold: true })
            emitAcross(segments, { value: displayDate(shown.start), column: plan.startColumn, tone: 'start' })
            emitAcross(segments, { value: displayDate(shown.end), column: plan.endColumn, tone: 'end' })
        }
        if (plan.deviations) {
            // The window is the block's own, not its first activity's. A block
            // merged over h1..h3 can run for a week; keying the lookup off the
            // first cell would hide every cancellation after day one.
            const window = (facts: GroupFacts) => facts.start ? { start: facts.start, end: facts.end } : undefined
            emitAcross(segments, { value: deviationsFor(source, window(plannedFacts), window(actualFacts), courseStart), column: plan.deviationColumn, tone: 'deviation' })
        }
    })

    const rows: ReportTableRow[] = []
    planRows.forEach((planRow, rowIndex) => {
        const cells: ReportCell[] = []
        plan.hierarchy.forEach((level, column) => {
            const span = spans.get(level)![rowIndex]
            if (span <= 0) return
            const value = planRow.kind === 'data'
                ? textValue(planRow.row[HIERARCHY_FIELD[level]])
                : textValue(planRow[HIERARCHY_FIELD[level] as 'module' | 'subModule'])
            cells.push({ value, column, rowSpan: span > 1 ? span : undefined, tone: HIERARCHY_TONE[level] })
        })
        if (planRow.kind === 'assessment') {
            const window = planRow.start && planRow.end ? ` · ${displayDate(planRow.start)} – ${displayDate(planRow.end)}` : ''
            cells.push({
                value: `Assessment · ${planRow.hours} ${planRow.hours === 1 ? 'hr' : 'hrs'}${window}`,
                column: plan.bannerColumn,
                colSpan: plan.columnCount - plan.bannerColumn,
                tone: 'assessment',
                bold: true,
            })
        } else {
            cells.push(...(emissions.get(rowIndex) || []))
        }
        // An HTML row is read left to right, so cells have to be in column
        // order — segments above can be emitted out of order.
        cells.sort((a, b) => a.column - b.column)
        rows.push({ kind: planRow.kind === 'assessment' ? 'assessment' : 'data', cells })
    })

    return rows
}

// ─── Fallback rows ───────────────────────────────────────────────────────────

/** Used when the page could not hand over its merge geometry. Every schedule
 *  group becomes its own row: no merged activity cells, but the hierarchy,
 *  hours, dates and totals are all still correct. */
function buildScheduleRows(
    plan: ColumnPlan,
    planned: Map<string, ScheduleGroup>,
    actual: Map<string, ScheduleGroup>,
    view: CalendarReportView,
    source: CalendarReportSource,
    courseStart: string,
): ReportTableRow[] {
    const primary = view === 'actual' ? actual : planned
    const keys = plan.comparison ? [...new Set([...planned.keys(), ...actual.keys()])] : [...primary.keys()]
    const entries = keys.map((key) => {
        const group = (plan.comparison ? planned.get(key) || actual.get(key) : primary.get(key))!
        return { key, item: group.item }
    }).filter((entry) => entry.item.type !== 'youDo')

    const structure: CalendarStructureRow[] = entries.map((entry) => ({
        module: entry.item.module, subModule: entry.item.subModule, topic: entry.item.topic, subTopic: entry.item.subTopic,
        activities: [{ type: entry.item.type as 'iDo' | 'weDo', activity: entry.item.activity, hours: 0, rowSpan: 1, continuation: false }],
    }))
    if (!structure.length) return []
    return buildStructureRows(structure, plan, planned, actual, view, source, courseStart)
}

// ─── Totals ──────────────────────────────────────────────────────────────────

function totalRow(
    plan: ColumnPlan,
    rows: ReportTableRow[],
    planned: Map<string, ScheduleGroup>,
    actual: Map<string, ScheduleGroup>,
    view: CalendarReportView,
): ReportTableRow | null {
    if (!rows.length) return null
    const sum = (groups: Map<string, ScheduleGroup>) =>
        hoursFromMinutes([...groups.values()].reduce((total, group) => total + group.minutes, 0))
    const cells: ReportCell[] = []
    if (plan.hierarchy.length) {
        cells.push({ value: 'Total', column: 0, colSpan: plan.hierarchy.length, tone: 'total', bold: true })
    }
    const perActivity = (type: 'iDo' | 'weDo', activity: string, groups: Map<string, ScheduleGroup>) =>
        hoursFromMinutes([...groups.values()]
            .filter((group) => group.item.type === type && group.item.activity === activity)
            .reduce((total, group) => total + group.minutes, 0))
    for (const placement of activityColumns(plan)) {
        const value = perActivity(placement.type, placement.activity, view === 'actual' ? actual : planned)
        cells.push({ value: value > 0 ? value : '—', column: placement.column, tone: 'total', bold: true })
    }
    if (plan.comparison) {
        cells.push({ value: sum(planned), column: plan.hoursColumn, tone: 'hours', bold: true })
        cells.push({ value: '', column: plan.startColumn, colSpan: 2, tone: 'total' })
        cells.push({ value: sum(actual), column: plan.actualHoursColumn, tone: 'hours', bold: true })
        cells.push({ value: '', column: plan.actualStartColumn, colSpan: 2, tone: 'total' })
    } else {
        cells.push({ value: sum(view === 'actual' ? actual : planned), column: plan.hoursColumn, tone: 'hours', bold: true })
        cells.push({ value: '', column: plan.startColumn, colSpan: 2, tone: 'total' })
    }
    if (plan.deviations) cells.push({ value: '', column: plan.deviationColumn, tone: 'total' })
    return { kind: 'total', cells }
}

// ─── Entry points ────────────────────────────────────────────────────────────

export function buildCalendarReportTable(
    source: CalendarReportSource,
    options: CalendarReportOptions,
    view: CalendarReportView,
): CalendarReportTable {
    const comparison = view === 'comparison'
    const hierarchy = HIERARCHY_ORDER.filter((level) => source.hierarchy.includes(level) && options.hierarchy.includes(level))
    const planned = groupSchedule(source.planned)
    const actual = groupSchedule(source.actual)
    const courseStart = [...planned.values()].map((group) => group.start).filter(Boolean).sort()[0] || ''
    const showDeviations = options.includeDeviations && view !== 'planned'

    const structure = source.structure?.rows ?? []
    // Activity columns follow the order the page shows them in, taken from the
    // structure when it is there and from the schedule when it is not.
    const collect = (type: 'iDo' | 'weDo') => {
        const names: string[] = []
        const add = (name: string) => { if (name && !names.includes(name)) names.push(name) }
        if (structure.length) structure.forEach((row) => row.activities.forEach((activity) => { if (activity.type === type) add(activity.activity) }))
        else for (const group of (view === 'actual' ? actual : planned).values()) if (group.item.type === type) add(group.item.activity)
        return names
    }
    const plan = planColumns(hierarchy, comparison ? [] : collect('iDo'), comparison ? [] : collect('weDo'), comparison, showDeviations)

    const rows = structure.length
        ? buildStructureRows(structure, plan, planned, actual, view, source, courseStart)
        : buildScheduleRows(plan, planned, actual, view, source, courseStart)
    const total = totalRow(plan, rows, planned, actual, view)

    return {
        columnCount: plan.columnCount,
        columnWidths: plan.widths,
        headers: buildHeaders(plan),
        rows: total ? [...rows, total] : rows,
    }
}

/** The optional module-hours block printed under the main table. Two columns,
 *  with the grand total carrying the same highlight the main table's total row
 *  gets so the eye lands in the same place in both. */
export function buildCalendarSummaryTable(summary: { headers: string[]; rows: (string | number)[][] }): CalendarReportTable {
    return {
        columnCount: 2,
        columnWidths: [42, 18],
        headers: [[
            { value: summary.headers[0] ?? 'Module', column: 0, tone: 'module', header: true },
            { value: summary.headers[1] ?? 'Total Hours', column: 1, tone: 'hours', header: true },
        ]],
        rows: summary.rows.map((row, index) => ({
            kind: index === summary.rows.length - 1 ? 'total' : 'data',
            cells: [
                { value: row[0] ?? '', column: 0, tone: index === summary.rows.length - 1 ? 'total' : 'topic' },
                { value: row[1] ?? '', column: 1, tone: 'hours', bold: index === summary.rows.length - 1 },
            ],
        })),
    }
}
