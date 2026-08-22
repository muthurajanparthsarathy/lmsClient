"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Holiday Calendar — two stages:
//   1. Clients  — every client (plus the pinned institute-wide scope) with a
//                 Manage holidays action
//   2. Calendar — a full calendar WORKSPACE (app-shell: command bar · left rail ·
//                 hero grid · slide-over drawers), scoped to whichever row opened
//
// Scoping rides the existing per-institute API unchanged: a per-client calendar
// is saved under the composite key `<institutionId>__client__<clientId>`, while
// the institute-wide calendar keeps the bare institution id.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Check, ChevronLeft, ChevronRight, CircleAlert, Plus, Search, X,
    SlidersHorizontal, LayoutGrid, Columns3, Square, List, Menu, ArrowLeft, CalendarDays,
} from 'lucide-react'
import DashboardLayout from '@/app/lms/component/layout'
import { institutionApi } from '@/apiServices/institutionService'
import { instituteHolidayCalendarApi, type HolidayPayload } from '@/apiServices/instituteHolidayCalendarApi'
import { userPermission } from '@/apiServices/tokenVerify'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'
import { EmptyState } from '@/app/lms/shared/ui'
import ClientList, { scopeIdFor, type ManageTarget } from './components/ClientList'
import HolidayCalendar from './components/HolidayCalendar'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import CalendarRail from './components/CalendarRail'
import FilterDrawer from './components/FilterDrawer'
import AddHolidayModal from './components/AddHolidayModal'
import BulkHolidayModal from './components/BulkHolidayModal'
import AgendaView from './components/AgendaView'
import HolidayDetailsDrawer from './components/HolidayDetailsDrawer'
import { BTN_PRIMARY } from './components/HolidayFormFields'
import { Holiday, HolidayType, HolidayDuration, MONTHS, uid, isoDate } from './components/types'

type ViewFilter = 'all' | 'holidays' | 'working'
type CalView = 'month' | 'week' | 'day' | 'agenda'
type ToastTone = 'success' | 'error'

type Stage =
    | { name: 'clients' }
    | { name: 'calendar'; clientId: string | null; clientName: string }

const VIEW_OPTIONS: { v: CalView; label: string; icon: React.ReactNode }[] = [
    { v: 'month', label: 'Month', icon: <LayoutGrid size={14} strokeWidth={2.2} /> },
    { v: 'week', label: 'Week', icon: <Columns3 size={14} strokeWidth={2.2} /> },
    { v: 'day', label: 'Day', icon: <Square size={14} strokeWidth={2.2} /> },
    { v: 'agenda', label: 'Agenda', icon: <List size={14} strokeWidth={2.2} /> },
]

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

// "12 – 18 Oct 2026", collapsing shared month/year across the week.
function weekRangeLabel(focused: Date): string {
    const start = new Date(focused); start.setDate(focused.getDate() - focused.getDay())
    const end = addDays(start, 6)
    const sameMonth = start.getMonth() === end.getMonth()
    const sameYear = start.getFullYear() === end.getFullYear()
    const mon = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short' })
    if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${mon(start)} ${end.getFullYear()}`
    if (sameYear) return `${start.getDate()} ${mon(start)} – ${end.getDate()} ${mon(end)} ${end.getFullYear()}`
    return `${start.getDate()} ${mon(start)} ${start.getFullYear()} – ${end.getDate()} ${mon(end)} ${end.getFullYear()}`
}

// ── Segmented view switch (compact, brand-lift active) ──
function ViewSwitch({ value, onChange }: { value: CalView; onChange: (v: CalView) => void }) {
    return (
        <div role="group" aria-label="Calendar view" className="flex items-center rounded-control border border-hairline bg-canvas p-0.5">
            {VIEW_OPTIONS.map(o => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onChange(o.v)}
                    aria-pressed={value === o.v}
                    title={o.label}
                    className={`flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-chip text-xs font-semibold transition-colors duration-150 ${
                        value === o.v ? 'bg-surface text-brand-strong shadow-xs' : 'text-subtle hover:text-heading'
                    }`}
                >
                    {o.icon}
                    <span className="hidden md:inline">{o.label}</span>
                </button>
            ))}
        </div>
    )
}

// Skeleton mirroring the app-shell (command bar · rail · grid) so nothing
// reflows when data lands. Loading is always a skeleton, never a spinner.
function CalendarShellSkeleton() {
    return (
        <div className="flex-1 min-h-0 flex">
            <div className="hidden lg:flex w-72 shrink-0 border-r border-hairline bg-surface flex-col p-4 gap-4">
                <div className="h-40 rounded-xl bg-ink-100/70 animate-pulse" />
                <div className="space-y-1.5">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 rounded-chip bg-ink-100/60 animate-pulse" />)}
                </div>
                <div className="h-24 rounded-xl bg-ink-100/50 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col bg-surface">
                <div className="grid grid-cols-7 border-b border-hairline shrink-0">
                    {Array.from({ length: 7 }).map((_, i) => <div key={i} className="px-2 py-3 flex justify-center"><div className="h-2.5 w-8 rounded bg-ink-100 animate-pulse" /></div>)}
                </div>
                <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
                    {Array.from({ length: 42 }).map((_, i) => (
                        <div key={i} className={`border-b border-hairline p-2 ${i % 7 === 0 ? '' : 'border-l'}`}>
                            <div className="h-5 w-5 rounded-full bg-ink-100/70 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — one scope's calendar workspace. All calendar state lives HERE, and
// the page remounts this component when the scope changes, so nothing carries
// over from one client's calendar into another's.
// ─────────────────────────────────────────────────────────────────────────────
function CalendarStage({
    instituteId,
    clientId,
    clientName,
    onBack,
}: {
    instituteId: string
    clientId: string | null
    clientName: string
    onBack: () => void
}) {
    const queryClient = useQueryClient()

    // Calendar CRUD is gated by the single "Manage Holidays" functionality
    // that lives on `admin-calendar` in the permission tree — the old
    // Add / Edit / Delete triad was removed when the tree was consolidated
    // (permissions.tree.ts: `admin-calendar` now carries only "My Calendar"
    // and "Manage Holidays"). Leaving the three separate `can(..., 'Add')`
    // etc. checks in place meant `canAdd`, `canEdit` and `canDelete` all
    // resolved to false, so clicking a calendar cell was silently a no-op
    // (the "Add Holiday" popup stopped opening). One grant now covers the
    // whole write surface — Manage Holidays already implies add/edit/delete.
    const { can } = usePermissions()
    const canManageHolidays = can(PERMISSION_IDS.ADMIN_CALENDAR, 'Manage Holidays')
    const canAdd = canManageHolidays
    const canEdit = canManageHolidays
    const canDelete = canManageHolidays
    const noop = () => {}

    // Every read and write goes through this key, never the bare institute id.
    const scopeId = scopeIdFor(instituteId, clientId)

    // ── Calendar state ──
    const [holidays, setHolidays] = useState<Holiday[]>([])
    const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
    const [focusedDate, setFocusedDate] = useState(() => new Date())
    const [view, setView] = useState<CalView>('month')
    const [modalDate, setModalDate] = useState<string | null>(null)
    const [bulkDates, setBulkDates] = useState<string[]>([])
    const [filter, setFilter] = useState<ViewFilter>('all')
    const [toast, setToast] = useState<{ msg: string; tone: ToastTone } | null>(null)
    // Presentation-only display filters. CRUD/save always use the full `holidays`
    // list; only what is DISPLAYED is narrowed — so filtering can never drop data.
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<HolidayType[]>([])
    const [filterOpen, setFilterOpen] = useState(false)
    const [railOpen, setRailOpen] = useState(false)   // mobile rail overlay
    const [previewHoliday, setPreviewHoliday] = useState<Holiday | null>(null)

    // ── The loaded window ──
    // Holidays are scoped by DATE RANGE, not by page number: the month grid has
    // to render every holiday in the visible weeks, so "page 2 of some sort
    // order" is meaningless here. The window is the focused calendar year padded
    // by a month at each end, which covers the 6-week grid's leading/trailing
    // cells (they spill into the adjacent year) and every week/day view inside
    // the year. Navigating within a year keeps the same key, so it is a cache
    // hit; crossing into another year loads that year's window.
    const windowYear = (view === 'month' ? month : focusedDate).getFullYear()
    const range = useMemo(
        () => ({ from: `${windowYear - 1}-12-01`, to: `${windowYear + 1}-01-31` }),
        [windowYear]
    )

    // ── Data ──
    const { data: selectedInstitute } = useQuery({ ...institutionApi.getById(instituteId), enabled: !!instituteId })
    const { data: savedCalendar, isSuccess, isError, refetch } = useQuery({
        ...instituteHolidayCalendarApi.getByInstitute(scopeId, range),
        // Crossing a year boundary changes the key. Without this the calendar
        // would blank to the skeleton mid-navigation; keeping the previous
        // window on screen makes the year change a refresh, not a reload.
        placeholderData: keepPreviousData,
    })

    // Every holiday on this calendar, including the dates outside the window.
    // Reported by the server so the count can never be inferred from the
    // partial copy this page happens to hold.
    const holidayTotal = savedCalendar?.holidayTotal ?? holidays.length

    // One invalidation for every write. Refetching the window after a mutation
    // makes the server the authority — a local optimistic edit that disagreed
    // with what actually landed is corrected on the next tick rather than
    // lingering until reload.
    const invalidateScope = () => {
        queryClient.invalidateQueries({ queryKey: ['instituteHolidayCalendar', scopeId] })
        queryClient.invalidateQueries({ queryKey: ['instituteHolidayCalendars'] })
    }

    // ── Writes: one holiday at a time ──
    // These replaced a single whole-array save. That save sent `holidays` back
    // in full and the server stored exactly what it received, which made the
    // in-memory list authoritative — so any read that returned less than the
    // whole calendar would have been silently destructive on the next save.
    // Each mutation below addresses one entry (or one date) server-side and
    // leaves everything it did not name untouched, which is what makes the
    // range-scoped read above safe.
    const { mutate: addHolidays, isPending: isAdding } = useMutation({
        ...instituteHolidayCalendarApi.addHolidays(),
        onSuccess: invalidateScope,
    })
    const { mutate: deleteHolidayById, isPending: isDeletingOne } = useMutation({
        ...instituteHolidayCalendarApi.deleteHoliday(),
        onSuccess: invalidateScope,
    })
    const { mutate: deleteHolidaysOnDate, isPending: isDeletingDate } = useMutation({
        ...instituteHolidayCalendarApi.deleteHolidaysByDate(),
        onSuccess: invalidateScope,
    })
    const isSaving = isAdding || isDeletingOne || isDeletingDate

    // Loading until the fetch SUCCEEDS — clearing the skeleton on error would
    // present an editable EMPTY calendar, and an empty grid invites a user to
    // re-enter holidays that are already there.
    const isLoading = !isSuccess && !isError

    // ── Restore the window's holidays whenever it is (re)fetched ──
    useEffect(() => {
        if (!isSuccess) return
        const restored: Holiday[] = (savedCalendar?.holidays ?? []).map((h: HolidayPayload) => ({
            id: h.id || h.holidayId || uid(),
            name: h.name || 'Holiday',
            date: h.date,
            type: (h.type as HolidayType) || 'institute',
            duration: (h.duration as HolidayDuration) || 'full',
            note: h.note || '',
        }))
        setHolidays(restored)
    }, [isSuccess, savedCalendar])

    const showToast = (msg: string, tone: ToastTone = 'success') => {
        setToast({ msg, tone })
        setTimeout(() => setToast(null), 2000)
    }

    // ── Holiday CRUD ──
    // Each of these edits the on-screen list first (the grid must respond to
    // the click immediately) and rolls that edit back if the write fails, so a
    // rejected change can't sit on screen looking saved.

    const upsertHoliday = (dates: string | string[], data: { name: string; type: HolidayType; duration: HolidayDuration; note: string }) => {
        const dateArr = Array.isArray(dates) ? dates : [dates]
        const previous = holidays
        let updated = [...holidays]
        for (const date of dateArr) {
            const exists = updated.some(h => h.date === date)
            if (exists) updated = updated.map(h => h.date === date ? { ...h, ...data } : h)
            else updated = [...updated, { id: uid(), date, ...data }]
        }
        setHolidays(updated)
        setModalDate(null)
        setBulkDates([])

        // Send ONLY the dates that were touched — never the surrounding list.
        // The server merges them by date, so the single-date modal and the bulk
        // modal share one round trip and neither can disturb another date.
        const touched = new Set(dateArr)
        const payload = updated
            .filter(h => touched.has(h.date))
            .map(h => ({ id: h.id, name: h.name, date: h.date, type: h.type, duration: h.duration, note: h.note }))

        addHolidays(
            { instituteId: scopeId, holidays: payload },
            {
                onSuccess: () => showToast('Saved'),
                onError: () => { setHolidays(previous); showToast('Could not save — please try again.', 'error') },
            }
        )
    }

    const removeHoliday = (id: string) => {
        const target = holidays.find(h => h.id === id)
        if (!target) return
        const previous = holidays
        setHolidays(holidays.filter(h => h.id !== id))
        // `date` is the fallback locator: rows saved before ids were persisted
        // carry an empty holidayId, and this page mints a throwaway uid for
        // those on load, so an id-only delete would miss the oldest entries.
        deleteHolidayById(
            { instituteId: scopeId, holidayId: id, date: target.date },
            {
                onSuccess: () => showToast('Deleted'),
                onError: () => { setHolidays(previous); showToast('Could not delete — please try again.', 'error') },
            }
        )
    }

    // The single-date modal's Delete clears the DAY, not one entry, so this is
    // date-scoped rather than a loop of id deletes.
    const removeHolidayByDate = () => {
        if (!modalDate) return
        const date = modalDate
        const previous = holidays
        setHolidays(holidays.filter(h => h.date !== date))
        setModalDate(null)
        deleteHolidaysOnDate(
            { instituteId: scopeId, date },
            {
                onSuccess: () => showToast('Deleted'),
                onError: () => { setHolidays(previous); showToast('Could not delete — please try again.', 'error') },
            }
        )
    }

    const editingHoliday = modalDate ? holidays.find(h => h.date === modalDate) ?? null : null

    // ── Display-only filtered list (name/note search + selected types) ──
    const displayHolidays = useMemo(() => {
        const q = search.trim().toLowerCase()
        return holidays.filter(h => {
            if (typeFilter.length && !typeFilter.includes(h.type)) return false
            if (q && !((h.name || '').toLowerCase().includes(q) || (h.note || '').toLowerCase().includes(q))) return false
            return true
        })
    }, [holidays, search, typeFilter])
    const isDisplayFiltered = Boolean(search.trim() || typeFilter.length)
    const toggleType = (t: HolidayType) =>
        setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
    const clearTypeFilters = () => setTypeFilter([])
    const clearDisplayFilters = () => { setSearch(''); setTypeFilter([]); setFilter('all') }

    const typeCounts = useMemo(() => {
        const m = new Map<HolidayType, number>()
        holidays.forEach(h => m.set(h.type, (m.get(h.type) ?? 0) + 1))
        return m
    }, [holidays])

    // ── Navigation — meaning depends on the active view ──
    // Focusing a date keeps `month` in sync so the rail's mini month follows.
    const focusOn = (d: Date) => { setFocusedDate(d); setMonth(firstOfMonth(d)) }
    const goPrev = () => {
        if (view === 'week') focusOn(addDays(focusedDate, -7))
        else if (view === 'day') focusOn(addDays(focusedDate, -1))
        else setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
    }
    const goNext = () => {
        if (view === 'week') focusOn(addDays(focusedDate, 7))
        else if (view === 'day') focusOn(addDays(focusedDate, 1))
        else setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
    }
    const goToday = () => { const n = new Date(); setMonth(firstOfMonth(n)); setFocusedDate(n) }

    // Clicking a mini-calendar day navigates the workspace to that date.
    const navigateToDate = (iso: string) => focusOn(new Date(iso + 'T00:00:00'))

    // The Create action opens the add modal on the focused day.
    const handleAddHoliday = () => setModalDate(isoDate(focusedDate))
    const openEvent = (h: Holiday) => setPreviewHoliday(h)

    const periodLabel =
        view === 'week' ? weekRangeLabel(focusedDate)
        : view === 'day' ? focusedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        : `${MONTHS[month.getMonth()]} ${month.getFullYear()}`

    const scopeChipName = clientId ? clientName : selectedInstitute?.inst_name
    const focusedIso = view === 'day' ? isoDate(focusedDate) : null

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* ── Command bar ── */}
            <header className="shrink-0 border-b border-hairline bg-surface z-10">
                <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2.5 min-h-[3.5rem]">
                    {/* Left: back + scope */}
                    <button
                        type="button"
                        onClick={() => setRailOpen(true)}
                        aria-label="Open panel"
                        className="lg:hidden h-9 w-9 flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                    >
                        <Menu size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-9 inline-flex items-center gap-1 pl-1.5 pr-2.5 rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                        title="Back to all clients"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-medium hidden sm:inline">All clients</span>
                    </button>
                    {scopeChipName && (
                        <div className="hidden md:flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border border-hairline bg-canvas max-w-[220px]">
                            <span className="h-6 w-6 rounded-full bg-brand-strong text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                {scopeChipName.slice(0, 2).toUpperCase()}
                            </span>
                            <p className="text-xs font-semibold text-body truncate">{scopeChipName}</p>
                        </div>
                    )}

                    <div className="hidden md:block h-6 w-px bg-hairline mx-0.5" />

                    {/* Today + month nav + period label */}
                    <button
                        type="button"
                        onClick={goToday}
                        className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-semibold text-body hover:bg-brand-wash hover:text-brand-strong hover:border-brand-300 transition-colors"
                    >
                        Today
                    </button>
                    <div className="flex items-center">
                        <button type="button" onClick={goPrev} aria-label="Previous" className="h-8 w-8 flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors">
                            <ChevronLeft size={17} />
                        </button>
                        <button type="button" onClick={goNext} aria-label="Next" className="h-8 w-8 flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors">
                            <ChevronRight size={17} />
                        </button>
                    </div>
                    <h1 className="text-base md:text-lg font-semibold text-heading tracking-[-0.01em] whitespace-nowrap px-1">
                        {periodLabel}
                    </h1>

                    {/* What is actually loaded. `holidays` now holds one padded
                        year, not the whole calendar, so the agenda, the search
                        and the type counts all describe THIS window — the count
                        says so outright instead of letting a partial list read
                        as the complete one. */}
                    {holidayTotal > holidays.length && (
                        <span
                            title={`Showing the ${holidays.length} holiday${holidays.length === 1 ? '' : 's'} between ${range.from} and ${range.to}. This calendar has ${holidayTotal} in total — move to another year to load it.`}
                            className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-hairline bg-canvas text-2xs font-semibold text-subtle tabular-nums"
                        >
                            <CalendarDays size={12} className="text-brand-strong" />
                            {holidays.length} of {holidayTotal} · {windowYear}
                        </span>
                    )}

                    {/* Right cluster */}
                    <div className="ml-auto flex items-center gap-2">
                        {isSaving && (
                            <span className="hidden sm:flex items-center gap-1.5 text-2xs font-medium text-brand-strong">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                                Saving…
                            </span>
                        )}
                        <div className="relative hidden sm:block w-40 lg:w-52">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search…"
                                className="h-9 w-full rounded-control border border-hairline-strong bg-surface pl-8 pr-8 text-sm text-body placeholder:text-faint transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                            />
                            {search && (
                                <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors"><X size={13} /></button>
                            )}
                        </div>

                        <ViewSwitch value={view} onChange={setView} />

                        <button
                            type="button"
                            onClick={() => setFilterOpen(true)}
                            className={`relative inline-flex h-9 items-center gap-1.5 rounded-control border px-2.5 md:px-3 text-sm font-medium transition-colors duration-150 ${
                                typeFilter.length > 0 || filter !== 'all' ? 'border-brand bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover'
                            }`}
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            <span className="hidden lg:inline">Filter</span>
                            {typeFilter.length > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold tabular-nums text-white">{typeFilter.length}</span>}
                        </button>

                        {canAdd && (
                            <motion.button
                                type="button"
                                onClick={handleAddHoliday}
                                whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-control bg-brand-strong text-white shadow-xs hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                            >
                                <Plus size={16} strokeWidth={2.6} />
                                <span className="text-sm font-semibold">Create</span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Body ── */}
            {isError ? (
                <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-surface rounded-xl border border-hairline shadow-xs">
                        <EmptyState
                            icon={CircleAlert}
                            title="Couldn't load this calendar"
                            message="The saved holidays could not be fetched, so editing is disabled — saving now could overwrite them."
                            primaryAction={<button type="button" onClick={() => refetch()} className={BTN_PRIMARY}>Retry</button>}
                        />
                    </div>
                </div>
            ) : isLoading ? (
                <CalendarShellSkeleton />
            ) : (
                <div className="flex-1 min-h-0 flex">
                    {/* Left rail (desktop) */}
                    <aside className="hidden lg:flex w-72 shrink-0 border-r border-hairline bg-surface flex-col overflow-y-auto custom-scrollbar">
                        <CalendarRail
                            month={month}
                            holidays={holidays}
                            displayHolidays={displayHolidays}
                            typeFilter={typeFilter}
                            onToggleType={toggleType}
                            onClearTypes={clearTypeFilters}
                            onPrevMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                            onNextMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                            onDateClick={navigateToDate}
                            onEventOpen={openEvent}
                            focusedIso={focusedIso}
                        />
                    </aside>

                    {/* Main workspace */}
                    <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={view}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                                className="h-full min-h-0"
                            >
                                {view === 'month' ? (
                                    <HolidayCalendar
                                        month={month}
                                        holidays={displayHolidays}
                                        viewFilter={filter}
                                        onDateClick={canAdd || canEdit ? setModalDate : noop}
                                        onBulkSelect={canAdd ? setBulkDates : noop}
                                        onEventOpen={openEvent}
                                    />
                                ) : view === 'week' ? (
                                    <WeekView
                                        focusedDate={focusedDate}
                                        holidays={displayHolidays}
                                        onDateClick={canAdd ? setModalDate : noop}
                                        onEventOpen={openEvent}
                                    />
                                ) : view === 'day' ? (
                                    <DayView
                                        focusedDate={focusedDate}
                                        holidays={displayHolidays}
                                        onDateClick={canAdd ? setModalDate : noop}
                                        onEdit={canEdit ? setModalDate : noop}
                                        onRemove={canDelete ? removeHoliday : noop}
                                    />
                                ) : (
                                    <div className="h-full overflow-y-auto px-4 py-4 custom-scrollbar">
                                        <AgendaView
                                            holidays={displayHolidays}
                                            isFiltered={isDisplayFiltered}
                                            onPreview={setPreviewHoliday}
                                            onEdit={canEdit ? setModalDate : noop}
                                            onRemove={canDelete ? removeHoliday : noop}
                                            onAdd={canAdd ? handleAddHoliday : noop}
                                        />
                                        {/* The agenda is the one view that reads as "every holiday",
                                            so it states its own bounds. Shown on every breakpoint —
                                            the command-bar chip above is hidden on small screens. */}
                                        {holidayTotal > holidays.length && (
                                            <p className="mt-4 pt-3 border-t border-hairline text-2xs text-subtle text-center">
                                                Showing <span className="font-semibold tabular-nums text-body">{holidays.length}</span> of{' '}
                                                <span className="font-semibold tabular-nums text-body">{holidayTotal}</span> holidays —
                                                {' '}{range.from} to {range.to}. Move to another year to see the rest.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
            )}

            {/* Mobile rail overlay */}
            <AnimatePresence>
                {railOpen && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[2px] lg:hidden"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setRailOpen(false)}
                        />
                        <motion.aside
                            className="fixed inset-y-0 left-0 z-modal w-72 max-w-[85vw] bg-surface border-r border-hairline-strong shadow-xl overflow-y-auto custom-scrollbar lg:hidden"
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-heading"><CalendarDays size={16} className="text-brand-strong" /> Calendar</span>
                                <button type="button" onClick={() => setRailOpen(false)} aria-label="Close" className="h-8 w-8 flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"><X size={16} /></button>
                            </div>
                            <CalendarRail
                                month={month}
                                holidays={holidays}
                                displayHolidays={displayHolidays}
                                typeFilter={typeFilter}
                                onToggleType={toggleType}
                                onClearTypes={clearTypeFilters}
                                onPrevMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                                onNextMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                onDateClick={(iso) => { navigateToDate(iso); setRailOpen(false) }}
                                onEventOpen={(h) => { openEvent(h); setRailOpen(false) }}
                                focusedIso={focusedIso}
                            />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Filter drawer */}
            <FilterDrawer
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                typeFilter={typeFilter}
                onToggleType={toggleType}
                dayFilter={filter}
                onDayFilterChange={setFilter}
                typeCounts={typeCounts}
                onClearAll={clearDisplayFilters}
                isFiltered={isDisplayFiltered || filter !== 'all'}
            />

            {/* Single date modal — the modal is add-or-edit depending on whether
                the day already has a holiday, so the save gate splits by mode. */}
            <AddHolidayModal
                date={modalDate}
                existing={editingHoliday}
                onClose={() => setModalDate(null)}
                onSave={data => {
                    if (!modalDate) return
                    if (editingHoliday ? !canEdit : !canAdd) return
                    upsertHoliday(modalDate, data)
                }}
                onDelete={canDelete ? removeHolidayByDate : noop}
            />

            {/* Bulk date modal */}
            <BulkHolidayModal
                dates={bulkDates}
                onClose={() => setBulkDates([])}
                onSave={canAdd ? (data => upsertHoliday(bulkDates, data)) : noop}
            />

            {/* Holiday details drawer */}
            <HolidayDetailsDrawer
                holiday={previewHoliday}
                onClose={() => setPreviewHoliday(null)}
                onEdit={canEdit ? ((date) => setModalDate(date)) : noop}
                onRemove={canDelete ? removeHoliday : noop}
            />

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="fixed top-5 right-5 z-toast flex items-center gap-2.5 bg-surface border border-hairline px-4 py-2.5 rounded-xl shadow-lg"
                    >
                        <span className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${toast.tone === 'success' ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                            {toast.tone === 'success' ? <Check size={13} strokeWidth={2.6} /> : <CircleAlert size={13} strokeWidth={2.4} />}
                        </span>
                        <p className="text-sm font-semibold text-heading">{toast.msg}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — the stage machine. Clients first, one scope's calendar second.
// ─────────────────────────────────────────────────────────────────────────────
export default function HolidayCalendarPage() {
    const [instituteId, setInstituteId] = useState('')
    useEffect(() => {
        const { user } = userPermission()
        const id = (user?.institution as string) || ''
        if (id) setInstituteId(id)
    }, [])

    const [stage, setStage] = useState<Stage>({ name: 'clients' })
    const dir = stage.name === 'clients' ? -1 : 1

    // Keyed by scope so a different client's calendar is a DIFFERENT element and
    // React unmounts the old one with all its local state.
    const stageKey = stage.name === 'calendar'
        ? `calendar:${scopeIdFor(instituteId, stage.clientId)}`
        : 'clients'

    const openCalendar = (target: ManageTarget) =>
        setStage({ name: 'calendar', clientId: target.clientId, clientName: target.clientName })

    return (
        <DashboardLayout>
            <div className="h-full">
                {!instituteId ? (
                    <div className="px-6 py-5 md:px-8 md:py-6">
                        <div className="bg-surface rounded-xl border border-dashed border-hairline-strong shadow-xs">
                            <EmptyState
                                icon={Building2}
                                title="No institute linked to your account"
                                message="Contact your administrator to assign you to an institute."
                            />
                        </div>
                    </div>
                ) : (
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                        <motion.div
                            key={stageKey}
                            custom={dir}
                            variants={{
                                enter: (d: number) => ({ opacity: 0, x: d * 16 }),
                                center: { opacity: 1, x: 0 },
                                exit: (d: number) => ({ opacity: 0, x: d * -16 }),
                            }}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                            className="h-full"
                        >
                            {stage.name === 'clients' ? (
                                // overflow-hidden so the page fits the viewport;
                                // ClientList's own layout is flex-col and gives
                                // its table body the remaining height, so only
                                // the table (not the page) scrolls.
                                <div className="h-full overflow-hidden">
                                    <ClientList instituteId={instituteId} onManage={openCalendar} />
                                </div>
                            ) : (
                                <CalendarStage
                                    instituteId={instituteId}
                                    clientId={stage.clientId}
                                    clientName={stage.clientName}
                                    onBack={() => setStage({ name: 'clients' })}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </DashboardLayout>
    )
}
