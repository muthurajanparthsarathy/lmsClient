"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Student Calendar — the learner's READ-ONLY view of the holiday calendars
// that apply to them.
//
// Two scopes feed it, both through the same per-institute API the admin
// Holiday Calendar writes to (`scopeIdFor`, shared from the calendar module's
// types.ts so the read key can never drift from the write key):
//
//   • Institute      — the bare institution id: holidays that apply to
//                      everyone in the institute.
//   • Enrolled client — `<institutionId>__client__<clientId>`, taken from the
//                      `clientId` on the learner's own user document, so this
//                      is the calendar of the client they are enrolled with.
//
// The switch at the top chooses between them: "All" merges both (each entry
// badged with where it came from) and "<Client> only" narrows to the client's
// own calendar. A learner with no client on their account sees the institute
// calendar alone and no switch — there is nothing to switch between.
//
// Nothing here writes. Add/Edit/Delete stay in the admin Holiday Calendar at
// /lms/pages/calendar, which is where the `calendar` permission's Manage
// Holidays grant applies.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
    CalendarDays, ChevronLeft, ChevronRight, Building2, Briefcase, X, CalendarOff,
} from 'lucide-react'
import { StudentLayout } from '@/app/lms/component/student/student-layout'
import { useCurrentUserQuery } from '@/queries/auth'
import { instituteHolidayCalendarApi, type HolidayPayload } from '@/apiServices/instituteHolidayCalendarApi'
import {
    scopeIdFor, getMonthGrid, isoDate, typeMeta, uid, MONTHS, DAY_ABBR,
    HOLIDAY_TYPES, type Holiday, type HolidayType, type HolidayDuration,
} from '@/app/lms/pages/calendar/components/types'

// Where a holiday came from. Carried on every row so the merged "All" view can
// say which calendar an entry is on without a second lookup.
type Source = 'institute' | 'client'
type ScopedHoliday = Holiday & { source: Source }
type ScopeFilter = 'all' | 'client'

const idStr = (v: unknown): string =>
    typeof v === 'string' ? v : (v && typeof v === 'object' && '_id' in (v as any))
        ? String((v as any)._id)
        : v ? String(v) : ''

// The API's stored shape → this page's row shape. Legacy entries carry an
// empty `holidayId`, so a throwaway uid keeps React keys stable for those.
const toHolidays = (rows: HolidayPayload[] | undefined, source: Source): ScopedHoliday[] =>
    (rows ?? []).map(h => ({
        id: h.id || h.holidayId || uid(),
        name: h.name || 'Holiday',
        date: h.date,
        type: (h.type as HolidayType) || 'institute',
        duration: (h.duration as HolidayDuration) || 'full',
        note: h.note || '',
        source,
    }))

const durationLabel = (d: HolidayDuration) =>
    d === 'first-half' ? 'First half' : d === 'second-half' ? 'Second half' : 'Full day'

const fmtLong = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

// ── Source chip ──────────────────────────────────────────────────────────────
function SourceChip({ source, clientName }: { source: Source; clientName: string }) {
    const isClient = source === 'client'
    return (
        <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-chip border text-2xs font-semibold whitespace-nowrap ${
            isClient
                ? 'bg-brand-wash text-brand-strong border-brand-300'
                : 'bg-info-50 text-info-700 border-info-500/20'
        }`}>
            {isClient ? <Briefcase size={10} strokeWidth={2.4} /> : <Building2 size={10} strokeWidth={2.4} />}
            {isClient ? clientName : 'Institute'}
        </span>
    )
}

// ── Read-only month grid ─────────────────────────────────────────────────────
// A learner's grid, not the editor's: no drag-select, no hover "Add", and a
// cell can show MORE than one entry because the merged view may carry both an
// institute holiday and a client holiday on the same date.
function MonthGrid({
    month, byDate, onOpen, clientName, showSource,
}: {
    month: Date
    byDate: Map<string, ScopedHoliday[]>
    onOpen: (h: ScopedHoliday) => void
    clientName: string
    showSource: boolean
}) {
    const cells = getMonthGrid(month)
    const today = new Date()
    const todayIso = isoDate(today)
    const isCurrentMonth =
        today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()

    return (
        <div className="rounded-[14px] border border-hairline bg-surface overflow-hidden">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-hairline">
                {DAY_ABBR.map((d, i) => {
                    const isTodayCol = isCurrentMonth && i === today.getDay()
                    const isWeekendCol = i === 0 || i === 6
                    return (
                        <div key={d} className="relative px-2 py-2.5 text-center">
                            <span className={`text-2xs font-semibold uppercase tracking-wider ${
                                isTodayCol ? 'text-brand-strong' : isWeekendCol ? 'text-danger-500/70' : 'text-faint'
                            }`}>
                                {d}
                            </span>
                            {isTodayCol && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-500" />}
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-7 auto-rows-[minmax(84px,auto)]">
                {cells.map((d, i) => {
                    const colStart = i % 7 === 0
                    if (!d) return <div key={i} className={`border-b border-hairline bg-canvas/60 ${colStart ? '' : 'border-l'}`} />

                    const iso = isoDate(d)
                    const entries = byDate.get(iso) ?? []
                    const isToday = todayIso === iso
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6

                    return (
                        <div
                            key={i}
                            aria-label={iso}
                            className={`relative border-b border-hairline p-1.5 flex flex-col gap-1 overflow-hidden
                                ${colStart ? '' : 'border-l'}
                                ${isToday ? 'bg-brand-wash/50' : isWeekend ? 'bg-canvas/40' : ''}`}
                        >
                            <span className={`h-6 min-w-[24px] px-1 rounded-full inline-flex items-center justify-center text-xs font-semibold self-start
                                ${isToday ? 'bg-brand-strong text-white'
                                    : isWeekend ? 'text-danger-500/90'
                                    : 'text-body'}`}>
                                {d.getDate()}
                            </span>

                            {entries.map(h => {
                                const meta = typeMeta(h.type)
                                return (
                                    <button
                                        key={`${h.source}:${h.id}`}
                                        type="button"
                                        onClick={() => onOpen(h)}
                                        title={`${h.name} — ${showSource ? (h.source === 'client' ? clientName : 'Institute') : meta.label}`}
                                        className={`w-full text-left border-l-[3px] rounded-chip px-1.5 py-1 min-w-0 transition-opacity hover:opacity-80 ${meta.chip} ${meta.bar}`}
                                    >
                                        <span className="block text-2xs font-semibold truncate">{h.name}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StudentCalendarPage() {
    const { data: me, isLoading: userLoading } = useCurrentUserQuery()
    const user = (me as any)?.user ?? null

    const instituteId = idStr(user?.institution)
    const clientId = idStr(user?.clientId)
    const clientName: string = (user?.clientName as string) || 'My client'
    const hasClient = !!clientId

    const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
    const [scope, setScope] = useState<ScopeFilter>('all')
    const [preview, setPreview] = useState<ScopedHoliday | null>(null)

    // A learner with no client has nothing to narrow to — keep them on the
    // merged view so the switch state can never hide the whole calendar.
    useEffect(() => { if (!hasClient) setScope('all') }, [hasClient])

    // Same windowing rule as the admin calendar: the focused year padded by a
    // month at each end, which covers the 6-week grid's leading/trailing cells.
    // Navigating inside a year is a cache hit; crossing a year loads the next
    // window.
    const windowYear = month.getFullYear()
    const range = useMemo(
        () => ({ from: `${windowYear - 1}-12-01`, to: `${windowYear + 1}-01-31` }),
        [windowYear],
    )

    const instituteScopeId = instituteId
    const clientScopeId = hasClient ? scopeIdFor(instituteId, clientId) : ''

    // The institute calendar is only fetched when it is actually displayed —
    // "<Client> only" is a narrower QUERY, not just a narrower filter.
    const { data: instituteCal, isLoading: instLoading } = useQuery({
        ...instituteHolidayCalendarApi.getByInstitute(instituteScopeId, range),
        enabled: !!instituteScopeId && scope === 'all',
        placeholderData: keepPreviousData,
    })
    const { data: clientCal, isLoading: clientLoading } = useQuery({
        ...instituteHolidayCalendarApi.getByInstitute(clientScopeId, range),
        enabled: !!clientScopeId,
        placeholderData: keepPreviousData,
    })

    const loading = userLoading || (scope === 'all' && !!instituteScopeId && instLoading) || (hasClient && clientLoading)

    const holidays = useMemo<ScopedHoliday[]>(() => {
        const client = toHolidays(clientCal?.holidays, 'client')
        if (scope === 'client') return client
        return [...toHolidays(instituteCal?.holidays, 'institute'), ...client]
    }, [instituteCal, clientCal, scope])

    // Grouped by date so a cell can render both calendars' entries for the same
    // day. Client entries sort after institute ones so the merged order is
    // stable regardless of which request resolved first.
    const byDate = useMemo(() => {
        const m = new Map<string, ScopedHoliday[]>()
        for (const h of holidays) {
            if (!h.date) continue
            const list = m.get(h.date)
            if (list) list.push(h)
            else m.set(h.date, [h])
        }
        for (const list of m.values()) {
            list.sort((a, b) => (a.source === b.source ? 0 : a.source === 'institute' ? -1 : 1))
        }
        return m
    }, [holidays])

    // Next 8 dates from today forward, across the loaded window.
    const upcoming = useMemo(() => {
        const todayIso = isoDate(new Date())
        return [...holidays]
            .filter(h => h.date >= todayIso)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 8)
    }, [holidays])

    const monthCount = useMemo(() => {
        const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
        return holidays.filter(h => h.date?.startsWith(prefix)).length
    }, [holidays, month])

    // Only the types actually present, so the legend describes THIS calendar
    // rather than the full catalog.
    const legendTypes = useMemo(() => {
        const present = new Set(holidays.map(h => h.type))
        return HOLIDAY_TYPES.filter(t => present.has(t.value))
    }, [holidays])

    const goToday = () => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)) }

    if (!userLoading && !instituteId) {
        return (
            <StudentLayout>
                <EmptyCard
                    title="No institute linked to your account"
                    message="Your holiday calendar comes from your institute. Ask your administrator to link your account to one."
                />
            </StudentLayout>
        )
    }

    return (
        <StudentLayout>
            <div className="mx-auto max-w-[1440px] space-y-4">

                {/* ── Header: title · scope switch · month nav ── */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-tile bg-brand-wash text-brand-strong shrink-0">
                            <CalendarDays size={18} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold text-heading leading-tight truncate">Calendar</h1>
                            <p className="text-2xs text-subtle truncate">
                                {scope === 'client'
                                    ? `Holidays on ${clientName}'s calendar`
                                    : hasClient
                                        ? `Institute holidays and ${clientName}'s holidays`
                                        : 'Institute holidays'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Scope switch — only meaningful when the learner is
                            actually enrolled with a client. */}
                        {hasClient && (
                            <div role="group" aria-label="Calendar scope" className="flex items-center rounded-control border border-hairline bg-canvas p-0.5">
                                {([
                                    { v: 'all' as const, label: 'All', icon: <Building2 size={13} strokeWidth={2.2} /> },
                                    { v: 'client' as const, label: `${clientName} only`, icon: <Briefcase size={13} strokeWidth={2.2} /> },
                                ]).map(o => (
                                    <button
                                        key={o.v}
                                        type="button"
                                        onClick={() => setScope(o.v)}
                                        aria-pressed={scope === o.v}
                                        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-chip text-xs font-semibold transition-colors duration-150 max-w-[180px] ${
                                            scope === o.v ? 'bg-surface text-brand-strong shadow-xs' : 'text-subtle hover:text-heading'
                                        }`}
                                    >
                                        {o.icon}
                                        <span className="truncate">{o.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                                aria-label="Previous month"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-control border border-hairline bg-surface text-subtle hover:text-heading hover:bg-row-hover transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="min-w-[140px] text-center text-sm font-semibold text-heading">
                                {MONTHS[month.getMonth()]} {month.getFullYear()}
                            </span>
                            <button
                                type="button"
                                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                aria-label="Next month"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-control border border-hairline bg-surface text-subtle hover:text-heading hover:bg-row-hover transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={goToday}
                                className="h-8 px-3 ml-1 rounded-control border border-hairline bg-surface text-xs font-semibold text-body hover:bg-row-hover transition-colors"
                            >
                                Today
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <CalendarSkeleton />
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                        <div className="xl:col-span-8">
                            <MonthGrid
                                month={month}
                                byDate={byDate}
                                onOpen={setPreview}
                                clientName={clientName}
                                showSource={scope === 'all' && hasClient}
                            />
                            {legendTypes.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {legendTypes.map(t => (
                                        <span key={t.value} className="inline-flex items-center gap-1.5 text-2xs font-medium text-subtle">
                                            <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                                            {t.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="xl:col-span-4 space-y-4">
                            {/* This month at a glance */}
                            <div className="rounded-[14px] border border-hairline bg-surface p-4">
                                <p className="text-2xs font-semibold uppercase tracking-wider text-faint">
                                    {MONTHS[month.getMonth()]} {month.getFullYear()}
                                </p>
                                <p className="mt-1 text-2xl font-bold text-heading leading-none">{monthCount}</p>
                                <p className="mt-1 text-xs text-subtle">
                                    {monthCount === 1 ? 'holiday this month' : 'holidays this month'}
                                </p>
                            </div>

                            {/* Upcoming */}
                            <div className="rounded-[14px] border border-hairline bg-surface overflow-hidden">
                                <div className="px-4 py-3 border-b border-hairline">
                                    <p className="text-sm font-semibold text-heading">Upcoming</p>
                                </div>
                                {upcoming.length === 0 ? (
                                    <div className="px-4 py-8 text-center">
                                        <CalendarOff size={20} className="mx-auto text-faint" strokeWidth={1.8} />
                                        <p className="mt-2 text-xs text-subtle">
                                            {/* Most clients have no calendar of their own yet, so a
                                                learner switching to "<Client> only" would otherwise
                                                see a blank grid and read it as broken. */}
                                            {holidays.length === 0 && scope === 'client'
                                                ? `No holidays on ${clientName}'s calendar yet.`
                                                : 'No holidays coming up.'}
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-hairline">
                                        {upcoming.map(h => {
                                            const meta = typeMeta(h.type)
                                            const d = new Date(h.date + 'T00:00:00')
                                            return (
                                                <li key={`${h.source}:${h.id}:${h.date}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreview(h)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-row-hover transition-colors"
                                                    >
                                                        <span className="flex flex-col items-center justify-center w-9 shrink-0">
                                                            <span className="text-2xs font-semibold uppercase text-faint">
                                                                {MONTHS[d.getMonth()].slice(0, 3)}
                                                            </span>
                                                            <span className="text-sm font-bold text-heading leading-none">{d.getDate()}</span>
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-medium text-heading truncate">{h.name}</span>
                                                            <span className="mt-0.5 flex items-center gap-1.5">
                                                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                                                <span className="text-2xs text-subtle truncate">{meta.label}</span>
                                                            </span>
                                                        </span>
                                                        {scope === 'all' && hasClient && (
                                                            <SourceChip source={h.source} clientName={clientName} />
                                                        )}
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Details — read-only, no edit or remove actions. */}
            {preview && (
                <div
                    className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/40 p-4"
                    onClick={() => setPreview(null)}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={preview.name}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-sm rounded-[16px] border border-hairline bg-surface shadow-xl overflow-hidden"
                    >
                        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-hairline">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-heading truncate">{preview.name}</p>
                                <p className="mt-0.5 text-2xs text-subtle">{fmtLong(preview.date)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                aria-label="Close"
                                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-4 py-3 space-y-2.5">
                            <Row label="Type">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${typeMeta(preview.type).dot}`} />
                                    <span className="text-sm text-body">{typeMeta(preview.type).label}</span>
                                </span>
                            </Row>
                            <Row label="Duration">
                                <span className="text-sm text-body">{durationLabel(preview.duration)}</span>
                            </Row>
                            <Row label="Calendar">
                                <SourceChip source={preview.source} clientName={clientName} />
                            </Row>
                            {preview.note ? (
                                <Row label="Note">
                                    <span className="text-sm text-body">{preview.note}</span>
                                </Row>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </StudentLayout>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <span className="text-2xs font-semibold uppercase tracking-wider text-faint pt-0.5">{label}</span>
            <span className="min-w-0 text-right">{children}</span>
        </div>
    )
}

function EmptyCard({ title, message }: { title: string; message: string }) {
    return (
        <div className="mx-auto max-w-[520px] py-20 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-wash text-brand-strong">
                <CalendarDays size={22} strokeWidth={2.2} />
            </span>
            <h2 className="mt-3 text-base font-semibold text-heading">{title}</h2>
            <p className="mt-1 text-sm text-subtle">{message}</p>
        </div>
    )
}

// Skeleton mirroring the loaded layout so nothing reflows when data lands.
function CalendarSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8 rounded-[14px] border border-hairline bg-surface overflow-hidden">
                <div className="grid grid-cols-7 border-b border-hairline">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="px-2 py-3 flex justify-center">
                            <div className="h-2.5 w-8 rounded bg-ink-100 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[minmax(84px,auto)]">
                    {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className={`border-b border-hairline p-2 ${i % 7 === 0 ? '' : 'border-l'}`}>
                            <div className="h-5 w-5 rounded-full bg-ink-100/70 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="xl:col-span-4 space-y-4">
                <div className="h-24 rounded-[14px] border border-hairline bg-surface animate-pulse" />
                <div className="h-64 rounded-[14px] border border-hairline bg-surface animate-pulse" />
            </div>
        </div>
    )
}
