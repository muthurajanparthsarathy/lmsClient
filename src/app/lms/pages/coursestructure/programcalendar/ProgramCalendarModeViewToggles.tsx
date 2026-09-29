"use client"

/* Program Calendar ▸ shared mode / view toggle control.
 *
 * Extracted from ProgramCalendarToolbar so the Reports tab can render
 * the same segmented buttons (Planned / Actual / Planned vs Actual)
 * and Table / Calendar view chrome without carrying every unrelated
 * start-date / holiday / phase prop the full toolbar requires.
 *
 * Rendered inside a plain flex row so it can sit above the batch picker
 * on the Reports tab the same way it sits inside the toolbar on the
 * Program Calendar tab. */

import { CalendarDays, LayoutList } from 'lucide-react'

export type CalendarModeValue = 'planned' | 'actual' | 'comparison'
export type ScheduleViewValue = 'table' | 'calendar'

type Props = {
    mode: CalendarModeValue
    onModeChange: (value: CalendarModeValue) => void
    /** Buttons for Actual and Comparison are disabled when the course
     *  has never been marked as attended (no actualGenerated rows). */
    hasActualData?: boolean
    /** Per-batch selector — only shown when mode !== 'planned' AND there
     *  are batches to choose between. */
    batches?: { value: string; label: string }[]
    batch?: string
    onBatchChange?: (value: string) => void
    /** The Table / Calendar-grid pair. In the main tab this is only
     *  visible when the reader is in Planned mode with a generated
     *  calendar; the Reports tab follows the same rule. */
    showViewToggle: boolean
    view: ScheduleViewValue
    onViewChange: (value: ScheduleViewValue) => void
}

export default function ProgramCalendarModeViewToggles(props: Props) {
    const modeOptions: Array<[CalendarModeValue, string]> = [
        ['planned', 'Planned Calendar'],
        ['actual', 'Actual Calendar'],
        ['comparison', 'Planned vs Actual'],
    ]
    const viewOptions = [
        { value: 'table' as const, label: 'Table view', icon: LayoutList },
        { value: 'calendar' as const, label: 'Calendar grid', icon: CalendarDays },
    ]
    return (
        <div className="flex items-center gap-3 flex-wrap">
            <div role="group" aria-label="Calendar view" className="flex shrink-0 items-center gap-0.5 rounded-control bg-canvas p-0.5">
                {modeOptions.map(([value, label]) => {
                    const disabled = (value === 'actual' || value === 'comparison') && !props.hasActualData
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={props.mode === value}
                            disabled={disabled}
                            title={disabled ? 'No actual attendance recorded yet' : undefined}
                            onClick={() => props.onModeChange(value)}
                            className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
                                props.mode === value
                                    ? 'bg-surface text-brand-strong shadow-xs'
                                    : 'text-subtle hover:text-heading'
                            } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-subtle`}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            {props.mode !== 'planned' && (props.batches?.length ?? 0) > 0 && (
                <div role="group" aria-label="Calendar batch" className="flex shrink-0 items-center gap-1 border-l border-hairline pl-3">
                    {props.batches!.map(batch => (
                        <button
                            key={batch.value}
                            type="button"
                            aria-pressed={props.batch === batch.value}
                            onClick={() => props.onBatchChange?.(batch.value)}
                            className={`h-8 whitespace-nowrap rounded-control border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
                                props.batch === batch.value
                                    ? 'border-brand-500/25 bg-brand-wash text-brand-strong'
                                    : 'border-transparent text-subtle hover:bg-canvas hover:text-heading'
                            }`}
                        >
                            {batch.label}
                        </button>
                    ))}
                </div>
            )}
            {props.showViewToggle && (
                <div role="group" aria-label="Schedule layout" className="flex shrink-0 gap-0.5 rounded-control border border-hairline p-0.5">
                    {viewOptions.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            type="button"
                            aria-label={label}
                            title={label}
                            aria-pressed={props.view === value}
                            onClick={() => props.onViewChange(value)}
                            className={`inline-flex size-7 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
                                props.view === value ? 'bg-canvas text-heading' : 'text-subtle hover:text-heading'
                            }`}
                        >
                            <Icon className="size-3.5" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
