// Shared types, constants and date helpers for the institute Holiday Calendar.
import type { HolidayType, HolidayDuration } from '@/app/lms/pages/calendar/api/instituteHolidayCalendarApi'

export type Holiday = {
    id: string
    name: string
    date: string            // "YYYY-MM-DD"
    type: HolidayType
    duration: HolidayDuration
    note?: string
}

export type { HolidayType, HolidayDuration }

// The one place the composite scope key is defined. The server keeps a single
// calendar document per string key, so per-client calendars piggyback on the
// same collection by suffixing the client id — and the plain institution id
// stays the key of the legacy institute-wide record, untouched.
//
// It lives in this leaf module (not ClientList, which owns the admin table and
// pulls in DataTable + the client service) so the read-only student calendar
// can key its fetches off the SAME function the admin editor writes through.
export const scopeIdFor = (instituteId: string, clientId: string | null): string =>
    clientId ? `${instituteId}__client__${clientId}` : instituteId

// ── Holiday-type display metadata (colour + label) ──
// `cell` is the soft wash a chip/day gets when the date carries that type and
// `bar` is the 3px left accent on event chips, so the grid, legend and chips
// all derive from one token palette. The "institute" type deliberately uses
// the brand tokens rather than a generic hue — it is the house type, so it
// wears the house colour.
export const HOLIDAY_TYPES: { value: HolidayType; label: string; dot: string; chip: string; cell: string; bar: string }[] = [
    { value: 'public',    label: 'Public Holiday',   dot: 'bg-danger-500',  chip: 'bg-danger-50 text-danger-700 border-danger-500/20',    cell: 'bg-danger-50',  bar: 'border-danger-500' },
    { value: 'festival',  label: 'Festival',         dot: 'bg-success-500', chip: 'bg-success-50 text-success-700 border-success-500/20', cell: 'bg-success-50', bar: 'border-success-500' },
    { value: 'optional',  label: 'Optional Holiday', dot: 'bg-warn-500',    chip: 'bg-warn-50 text-warn-700 border-warn-500/20',          cell: 'bg-warn-50',    bar: 'border-warn-500' },
    { value: 'institute', label: 'Institute Holiday',dot: 'bg-brand-500',   chip: 'bg-brand-wash text-brand-strong border-brand-300',     cell: 'bg-brand-wash', bar: 'border-brand-500' },
    { value: 'exam',      label: 'Exam / No Class',  dot: 'bg-info-500',    chip: 'bg-info-50 text-info-700 border-info-500/20',          cell: 'bg-info-50',    bar: 'border-info-500' },
    { value: 'other',     label: 'Other',            dot: 'bg-ink-400',     chip: 'bg-ink-50 text-ink-600 border-ink-200',                cell: 'bg-ink-50',     bar: 'border-ink-400' },
]

export const typeMeta = (t: HolidayType) =>
    HOLIDAY_TYPES.find(h => h.value === t) ?? HOLIDAY_TYPES[3]

export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Date helpers (string-based to avoid timezone drift) ──
export const uid = () => Math.random().toString(36).slice(2, 10)

export const isoDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export const fmtDateLong = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// Build a 6-row month grid (leading/trailing nulls for empty cells).
export const getMonthGrid = (monthStart: Date): (Date | null)[] => {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const firstDay = new Date(year, month, 1).getDay()      // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
}
