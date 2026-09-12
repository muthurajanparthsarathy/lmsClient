"use client"

import { CalendarDays, Check, LayoutList, Layers, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CalendarReportView } from './reports/programCalendarReport'

type Props = {
    startDate: string
    onStartDateChange: (value: string) => void
    editable: boolean
    saving: boolean
    dirty: boolean
    canSave: boolean
    onSave: () => void
    endDate?: string
    workingDays: number
    holidays: number
    onWorkingDays: () => void
    onHolidays: () => void
    restriction?: string
    holidayWarning?: string
    mode: CalendarReportView
    onModeChange: (value: CalendarReportView) => void
    batches: { value: string; label: string }[]
    batch: string
    onBatchChange: (value: string) => void
    showViewToggle: boolean
    view: 'table' | 'calendar'
    onViewChange: (value: 'table' | 'calendar') => void
    // Phases, when this course runs in them. An empty list is the normal case
    // and renders nothing at all — see phaseOptionsFor. Every listed phase is
    // selectable: the course is set up once and runs in all of them.
    phases?: { name: string; courseId: string }[]
    phase?: string
    onPhaseChange?: (name: string) => void
}

export default function ProgramCalendarToolbar(props: Props) {
    const phases = props.phases || []
    return <div className="flex items-center gap-3 overflow-x-auto rounded-xl border border-hairline bg-surface px-3 py-2 text-xs [scrollbar-width:thin]">
        {phases.length > 0 && <div className="flex shrink-0 items-center gap-2 border-r border-hairline pr-3">
            <Layers className="size-4 text-subtle" />
            <label htmlFor="program-calendar-phase" className="whitespace-nowrap font-medium text-heading">Phase</label>
            <Select value={props.phase || undefined} onValueChange={value => props.onPhaseChange?.(value)}>
                <SelectTrigger id="program-calendar-phase" className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Select Phase" />
                </SelectTrigger>
                <SelectContent>
                    {phases.map(entry => <SelectItem key={entry.name} value={entry.name}>{entry.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>}
        <div className="flex shrink-0 items-center gap-2">
            <CalendarDays className="size-4 text-subtle" />
            <label htmlFor="program-calendar-start" className="whitespace-nowrap font-medium text-heading">Program start date</label>
            <input id="program-calendar-start" type="date" value={props.startDate} disabled={!props.editable}
                onChange={event => props.onStartDateChange(event.target.value)} title={!props.editable ? props.restriction : undefined}
                className="h-8 w-36 rounded-control border border-hairline-strong bg-surface px-2 text-xs text-body outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-subtle" />
            {props.editable && (props.dirty || props.saving
                ? <Button size="sm" className="text-xs" disabled={!props.canSave || props.saving} onClick={props.onSave}>{props.saving ? 'Saving…' : 'Save'}</Button>
                : props.startDate && <span className="inline-flex items-center gap-1 text-success-700"><Check className="size-3" />Saved</span>)}
        </div>
        {props.endDate && <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-subtle">
            <span>Ends <span className="font-medium text-heading">{props.endDate}</span></span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={props.onWorkingDays} className="rounded px-0.5 underline-offset-4 hover:text-heading hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20">{props.workingDays} working {props.workingDays === 1 ? 'day' : 'days'}</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={props.onHolidays} className="rounded px-0.5 underline-offset-4 hover:text-heading hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20">{props.holidays} {props.holidays === 1 ? 'holiday' : 'holidays'}</button>
        </div>}
        {props.restriction && <span title={props.restriction} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-canvas px-2 py-1.5 text-[11px] text-subtle"><LockKeyhole className="size-3" />{props.editable ? 'Admin correction only' : 'Start date locked'}</span>}
        {props.holidayWarning && <span className="shrink-0 text-[11px] text-warn-700">{props.holidayWarning}</span>}
        <span aria-hidden="true" className="ml-auto h-5 w-px shrink-0 bg-hairline" />
        <div role="group" aria-label="Calendar view" className="flex shrink-0 items-center gap-0.5 rounded-control bg-canvas p-0.5">
            {([
                ['planned', 'Planned Calendar'], ['actual', 'Actual Calendar'], ['comparison', 'Planned vs Actual'],
            ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={props.mode === value} onClick={() => props.onModeChange(value)}
                className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${props.mode === value ? 'bg-surface text-brand-strong shadow-xs' : 'text-subtle hover:text-heading'}`}>{label}</button>)}
        </div>
        {props.mode !== 'planned' && props.batches.length > 0 && <div role="group" aria-label="Calendar batch" className="flex shrink-0 items-center gap-1 border-l border-hairline pl-3">
            {props.batches.map(batch => <button key={batch.value} type="button" aria-pressed={props.batch === batch.value} onClick={() => props.onBatchChange(batch.value)}
                className={`h-8 whitespace-nowrap rounded-control border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${props.batch === batch.value ? 'border-brand-500/25 bg-brand-wash text-brand-strong' : 'border-transparent text-subtle hover:bg-canvas hover:text-heading'}`}>{batch.label}</button>)}
        </div>}
        {props.showViewToggle && <div role="group" aria-label="Schedule layout" className="flex shrink-0 gap-0.5 rounded-control border border-hairline p-0.5">
            {([{ value: 'table', label: 'Table view', icon: LayoutList }, { value: 'calendar', label: 'Calendar grid', icon: CalendarDays }] as const).map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={props.view === value} onClick={() => props.onViewChange(value)}
                className={`inline-flex size-7 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${props.view === value ? 'bg-canvas text-heading' : 'text-subtle hover:text-heading'}`}><Icon className="size-3.5" /></button>)}
        </div>}
    </div>
}
