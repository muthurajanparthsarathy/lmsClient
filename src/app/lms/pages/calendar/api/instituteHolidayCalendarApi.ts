// instituteHolidayCalendarApi.ts — React Query service for an institute's
// holiday calendar (one calendar per institute, holding all of its holidays).
import { http as apiClient } from "@/lib/http";

// ── Types ──────────────────────────────────────────────────────────────────────
export type HolidayType = 'public' | 'optional' | 'institute' | 'exam' | 'festival' | 'other';
export type HolidayDuration = 'full' | 'first-half' | 'second-half';

export type HolidayPayload = {
    id?: string;
    holidayId?: string;
    name: string;
    date: string;            // "YYYY-MM-DD"
    type?: HolidayType;
    duration?: HolidayDuration;
    note?: string;
};

export type InstituteHolidayCalendarPayload = {
    instituteId: string;
    instituteName?: string;
    instituteCode?: string;
    year?: number;
    holidays: HolidayPayload[];
};

export type InstituteHolidayCalendarRecord = InstituteHolidayCalendarPayload & {
    _id: string;
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    // Present only on a range-scoped fetch: `holidays` then holds just the
    // requested window, while `holidayTotal` counts every date on the calendar.
    rangeScoped?: boolean;
    range?: { from: string | null; to: string | null };
    holidayTotal?: number;
};

// A calendar record with its `holidays[]` replaced by a count (?counts=1).
export type InstituteHolidayCalendarCount = Omit<InstituteHolidayCalendarRecord, 'holidays'> & {
    holidayCount: number;
};

// The window a calendar view is scoped to. Either bound may be left open.
export type HolidayRange = { from?: string; to?: string };

// ── Raw request functions ────────────────────────────────────────────────────────

// LEGACY whole-array write: the server replaces `holidays` with exactly what it
// receives, so this may only ever be called with the COMPLETE list. Use the
// per-holiday functions below instead — they are safe against a partial copy.
export const saveInstituteHolidayCalendar = async (
    payload: InstituteHolidayCalendarPayload
): Promise<InstituteHolidayCalendarRecord> => {
    const res = await apiClient.post('/institute-holiday-calendar/save', payload);
    return res.data.data;
};

export const fetchInstituteHolidayCalendar = async (
    instituteId: string,
    range?: HolidayRange
): Promise<InstituteHolidayCalendarRecord | null> => {
    // No range → no query string → the legacy request, byte for byte.
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    const qs = params.toString();
    const res = await apiClient.get(
        `/institute-holiday-calendar/getByInstitute/${instituteId}${qs ? `?${qs}` : ''}`
    );
    return res.data.data; // null when none saved yet
};

export const fetchAllInstituteHolidayCalendars = async (): Promise<InstituteHolidayCalendarRecord[]> => {
    const res = await apiClient.get('/institute-holiday-calendar/getAll');
    return res.data.data;
};

export const fetchInstituteHolidayCalendarCounts = async (): Promise<InstituteHolidayCalendarCount[]> => {
    const res = await apiClient.get('/institute-holiday-calendar/getAll?counts=1');
    return res.data.data;
};

// ── Per-holiday writes ───────────────────────────────────────────────────────────
// Each of these addresses ONE entry (or one date) server-side. None of them
// sends, or depends on, the rest of the calendar — so a caller holding only
// part of the list can still write safely.

export type AddHolidaysResult = { instituteId: string; holidays: HolidayPayload[]; holidayTotal: number };
export type HolidayWriteResult = { instituteId: string; holidayTotal: number };

export const addInstituteHolidays = async (
    instituteId: string,
    holidays: HolidayPayload[]
): Promise<AddHolidaysResult> => {
    const res = await apiClient.post(`/institute-holiday-calendar/holidays/${instituteId}`, { holidays });
    return res.data.data;
};

export const updateInstituteHoliday = async (
    instituteId: string,
    holidayId: string,
    patch: Partial<HolidayPayload>
): Promise<HolidayWriteResult> => {
    // `date` doubles as the fallback locator for legacy rows stored without an
    // id, so it rides along in the query string as well as the body.
    const qs = patch.date ? `?date=${encodeURIComponent(patch.date)}` : '';
    const res = await apiClient.patch(
        `/institute-holiday-calendar/holidays/${instituteId}/${holidayId}${qs}`,
        patch
    );
    return res.data.data;
};

export const deleteInstituteHoliday = async (
    instituteId: string,
    holidayId: string,
    date?: string
): Promise<HolidayWriteResult> => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiClient.delete(`/institute-holiday-calendar/holidays/${instituteId}/${holidayId}${qs}`);
    return res.data.data;
};

export const deleteInstituteHolidaysByDate = async (
    instituteId: string,
    date: string
): Promise<HolidayWriteResult> => {
    const res = await apiClient.delete(
        `/institute-holiday-calendar/holidays/${instituteId}?date=${encodeURIComponent(date)}`
    );
    return res.data.data;
};

export const deleteInstituteHolidayCalendar = async (instituteId: string): Promise<any> => {
    const res = await apiClient.delete(`/institute-holiday-calendar/delete/${instituteId}`);
    return res.data;
};

// ── React Query config (same shape as programCalendarApi) ─────────────────────────
export const instituteHolidayCalendarApi = {
    // `range` is optional and additive: without it the key, the request and the
    // response are exactly what they were, so existing callers are untouched.
    // With it, the key gains the window so two windows are two cache entries —
    // and both still sit under the ['instituteHolidayCalendar', id] prefix that
    // invalidation targets.
    getByInstitute: (instituteId: string, range?: HolidayRange) => ({
        queryKey: (range?.from || range?.to)
            ? ['instituteHolidayCalendar', instituteId, range?.from ?? null, range?.to ?? null]
            : ['instituteHolidayCalendar', instituteId],
        queryFn: () => fetchInstituteHolidayCalendar(instituteId, range),
        enabled: !!instituteId,
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    }),
    getAll: () => ({
        queryKey: ['instituteHolidayCalendars'],
        queryFn: fetchAllInstituteHolidayCalendars,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: false,
    }),
    // Counts only — same records without the holidays[] arrays. Keyed UNDER the
    // getAll key so one invalidateQueries(['instituteHolidayCalendars']) still
    // refreshes both.
    getAllCounts: () => ({
        queryKey: ['instituteHolidayCalendars', 'counts'],
        queryFn: fetchInstituteHolidayCalendarCounts,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: false,
    }),
    // LEGACY whole-array write — see saveInstituteHolidayCalendar above.
    save: () => ({
        mutationFn: (payload: InstituteHolidayCalendarPayload) => saveInstituteHolidayCalendar(payload),
    }),
    addHolidays: () => ({
        mutationFn: (v: { instituteId: string; holidays: HolidayPayload[] }) =>
            addInstituteHolidays(v.instituteId, v.holidays),
    }),
    updateHoliday: () => ({
        mutationFn: (v: { instituteId: string; holidayId: string; patch: Partial<HolidayPayload> }) =>
            updateInstituteHoliday(v.instituteId, v.holidayId, v.patch),
    }),
    deleteHoliday: () => ({
        mutationFn: (v: { instituteId: string; holidayId: string; date?: string }) =>
            deleteInstituteHoliday(v.instituteId, v.holidayId, v.date),
    }),
    deleteHolidaysByDate: () => ({
        mutationFn: (v: { instituteId: string; date: string }) =>
            deleteInstituteHolidaysByDate(v.instituteId, v.date),
    }),
    delete: () => ({
        mutationFn: (instituteId: string) => deleteInstituteHolidayCalendar(instituteId),
    }),
};
