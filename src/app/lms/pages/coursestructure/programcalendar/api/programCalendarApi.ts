// programCalendarApi.ts — React Query service for persisting the Program Calendar
// (start/end date, daily session template, holidays, working days + a course snapshot).
// Modules/topics/subtopics are NOT stored here — they load dynamically elsewhere.
import { http as apiClient } from "@/lib/http";

// ── Types ──────────────────────────────────────────────────────────────────────
export type DaySlotPayload = {
    id?: string;
    slotId?: string;
    kind: 'session' | 'break';
    name: string;
    startTime: string;   // "HH:mm"
    endTime: string;     // "HH:mm"
    trainer?: string;
    sessionType?: string;
};

export type HolidayPayload = {
    id?: string;
    holidayId?: string;
    name: string;
    date: string;        // "YYYY-MM-DD"
    duration?: 'full' | 'first-half' | 'second-half';
};

export type AssessmentDayPayload = {
    id?: string;
    asmtId?: string;
    name: string;
    date: string;        // "YYYY-MM-DD"
    days: number;        // consecutive calendar days blocked
};

// ONLY the calendar's INPUTS travel: the chosen start date, the session
// template, and the deviations that happened. End date, totals, day counts
// and holidays are derived (or owned by the holiday module) and recompute on
// every load — the server stores none of them anymore.
export type ProgramCalendarPayload = {
    courseId: string;
    startDate: string;       // "YYYY-MM-DD"
    sessions: DaySlotPayload[];
    deviations?: { id?: string; date: string; reason: string; appliesTo?: string[] }[];
    status?: 'draft' | 'published';
    /**
     * The phase this calendar is for, by name. A placement course runs its
     * phases on their own schedules, so each keeps its own calendar. Absent or
     * "" for a course with no phases.
     */
    phase?: string;
    /**
     * Only ever set for a course's FIRST phase: "a calendar saved before phases
     * existed is mine". It lets the first save adopt that record instead of
     * stranding it beside a new one — and because only the first phase claims
     * it, every other phase still starts empty.
     */
    adoptLegacy?: boolean;
    /**
     * Degree Program only: the group this calendar is for — a batch id or a
     * section key — when Course Setup gives groups their own calendars. Absent
     * or "" is the course's common calendar (every other service, always).
     */
    groupKey?: string;
};

/** Degree Program: which group's calendar the page is on, from the server. */
export type CalendarGroupInfo = {
    /** True when this course keeps a calendar per group. */
    perGroup: boolean;
    /** The groups to pick from ("Section A", "Section B · Batch 1", …). */
    targets: { id: string; name: string }[];
    /** Where saves go: the group's own calendar key ("" = common). */
    key: string;
    label: string;
    /** The group has no calendar of its own yet and shows the one it follows. */
    inherited: boolean;
    inheritedFrom: string;
};

export type ProgramCalendarView = {
    calendar: ProgramCalendarRecord | null;
    group: CalendarGroupInfo | null;
};

export type ProgramCalendarRecord = ProgramCalendarPayload & {
    _id: string;
    courseName: string;
    courseCode: string;
    courseDetails?: {
        category?: string;
        courseLevel?: string;
        courseDuration?: string;
        serviceType?: string;
        serviceModal?: string;
        clientName?: string;
    };
    createdAt?: string;
    updatedAt?: string;
};

// ── Raw request functions ────────────────────────────────────────────────────────
export const saveProgramCalendar = async (
    payload: ProgramCalendarPayload
): Promise<ProgramCalendarRecord> => {
    const res = await apiClient.post('/program-calendar/save', payload);
    return res.data.data;
};

export const fetchProgramCalendarByCourse = async (
    courseId: string,
    phase = '',
    adoptLegacy = false,
): Promise<ProgramCalendarRecord | null> => {
    const qs = new URLSearchParams()
    if (phase) qs.set('phase', phase)
    if (phase && adoptLegacy) qs.set('adoptLegacy', '1')
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiClient.get(`/program-calendar/getByCourse/${courseId}${suffix}`);
    return res.data.data; // null when none saved yet
};

/**
 * The calendar the Program Calendar page works on, plus — for a Degree Program
 * course with per-group calendars — which group that is and whether it is
 * still following a wider calendar. `group` is the group asked for ("" lets the
 * server open the first one).
 */
export const fetchProgramCalendarView = async (
    courseId: string,
    phase = '',
    adoptLegacy = false,
    group = '',
): Promise<ProgramCalendarView> => {
    const qs = new URLSearchParams()
    if (phase) qs.set('phase', phase)
    if (phase && adoptLegacy) qs.set('adoptLegacy', '1')
    if (group) qs.set('group', group)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiClient.get(`/program-calendar/getByCourse/${courseId}${suffix}`);
    return { calendar: res.data.data ?? null, group: res.data.group ?? null };
};

export const fetchAllProgramCalendars = async (): Promise<ProgramCalendarRecord[]> => {
    const res = await apiClient.get('/program-calendar/getAll');
    return res.data.data;
};

export const deleteProgramCalendar = async (courseId: string, phase = '', group = ''): Promise<any> => {
    // Scoped to the phase: resetting Phase II must not wipe Phase I. And, for a
    // Degree Program group, to that group: it goes back to following its
    // section's (or the common) calendar.
    const qs = new URLSearchParams()
    if (phase) qs.set('phase', phase)
    if (group) qs.set('group', group)
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiClient.delete(`/program-calendar/delete/${courseId}${suffix}`);
    return res.data;
};

// ── React Query config (same shape as courseStructureApi) ────────────────────────
export const programCalendarApi = {
    // The phase is part of the key: switching phase must load THAT phase's
    // calendar, not re-show the one already in cache.
    // The group (Degree Program) is part of the key for the same reason. The
    // key still starts ['programCalendar', courseId, phase], so invalidating
    // that prefix refreshes every group's entry.
    getByCourse: (courseId: string, phase = '', adoptLegacy = false, group = '') => ({
        queryKey: ['programCalendar', courseId, phase, group],
        queryFn: () => fetchProgramCalendarView(courseId, phase, adoptLegacy, group),
        enabled: !!courseId,
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    }),
    getAll: () => ({
        queryKey: ['programCalendars'],
        queryFn: fetchAllProgramCalendars,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: false,
    }),
    save: () => ({
        mutationFn: (payload: ProgramCalendarPayload) => saveProgramCalendar(payload),
    }),
    delete: () => ({
        // Takes the phase too: a reset clears THIS phase's calendar only.
        mutationFn: (vars: string | { courseId: string; phase?: string; group?: string }) =>
            typeof vars === 'string'
                ? deleteProgramCalendar(vars)
                : deleteProgramCalendar(vars.courseId, vars.phase || '', vars.group || ''),
    }),
};
