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
    courseId: string
): Promise<ProgramCalendarRecord | null> => {
    const res = await apiClient.get(`/program-calendar/getByCourse/${courseId}`);
    return res.data.data; // null when none saved yet
};

export const fetchAllProgramCalendars = async (): Promise<ProgramCalendarRecord[]> => {
    const res = await apiClient.get('/program-calendar/getAll');
    return res.data.data;
};

export const deleteProgramCalendar = async (courseId: string): Promise<any> => {
    const res = await apiClient.delete(`/program-calendar/delete/${courseId}`);
    return res.data;
};

// ── React Query config (same shape as courseStructureApi) ────────────────────────
export const programCalendarApi = {
    getByCourse: (courseId: string) => ({
        queryKey: ['programCalendar', courseId],
        queryFn: () => fetchProgramCalendarByCourse(courseId),
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
        mutationFn: (courseId: string) => deleteProgramCalendar(courseId),
    }),
};
