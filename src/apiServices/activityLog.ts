import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

const authHeaders = () => {
  const token = localStorage.getItem('smartcliff_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export interface LoginLogEntry {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  status?: string;
  details: {
    ipAddress?: string;
    location?: string;
    device?: string;
    browser?: string;
    os?: string;
    userAgent?: string;
  };
  sessionDuration?: number; // seconds
  logoutTime?: string;      // ISO – set on logout
  logoutAt?: string;        // ISO – alt field name
  sessionEnd?: string;      // ISO – alt field name
  createdAt: string;
}

export interface StudentActivityLog {
  userId: string;
  userName: string;
  userEmail: string;
  lastActive: string | null;
  nodeVisits: { nodeId: string; nodeName: string; nodeType: string; visitedAt: string }[];
  methodSelections: { action: string; method: string; activity: string | null; nodeName: string | null; selectedAt: string }[];
  resourceOpens: { resourceId: string; resourceName: string; resourceType: string; openedAt: string }[];
  exerciseSubmissions: { exerciseId: string | null; exerciseName: string; method: string; activity: string; status: string; submittedAt: string }[];
}

export interface CourseOption {
  _id: string;
  courseName: string;
  courseCode?: string;
  batchAndParticipants?: {
    _id?: string;
    batchName?: string;
    users?: { user: any; status?: string }[];
  }[];
}

export const fetchLoginLogs = async (): Promise<LoginLogEntry[]> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/logins`, {
    headers: authHeaders(),
    timeout: 10000,
  });
  return res.data.data || [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Paginated login feed.
//
// The call above returns the 500 most recent events and nothing else — with
// 20,797 login records stored that is the last three days, and the rest of the
// audit trail simply could not be reached from the UI. Passing `page` switches
// the SAME endpoint into a mode where the date range and the search run in
// Mongo, one page crosses the wire, and every record is reachable. Callers
// that omit `page` are untouched.
//
// `from`/`to` are epoch milliseconds, resolved to day boundaries HERE in the
// browser, because the page computed them with local-time setHours(). Sending
// absolute instants keeps the selection identical whatever timezone the server
// runs in.
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginLogFilters {
  search?: string;
  from?: number;
  to?: number;
}

export interface LoginLogPage {
  data: LoginLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const loginLogParams = (f: LoginLogFilters, page: number, limit: number, isExport = false) => {
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (f.search?.trim()) params.search = f.search.trim();
  if (typeof f.from === 'number') params.from = String(f.from);
  if (typeof f.to === 'number') params.to = String(f.to);
  if (isExport) params.export = '1';
  return params;
};

export const fetchLoginLogsPage = async (
  filters: LoginLogFilters,
  page: number,
  limit: number,
): Promise<LoginLogPage> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/logins`, {
    headers: authHeaders(),
    params: loginLogParams(filters, page, limit),
    timeout: 15000,
  });
  return {
    data: res.data.data || [],
    total: res.data.total ?? 0,
    page: res.data.page ?? page,
    totalPages: res.data.totalPages ?? 1,
  };
};

/** Every row matching the current filters, for the Excel export — which covers
 *  the whole selection, not just what has been scrolled into view. */
export const fetchLoginLogsForExport = async (filters: LoginLogFilters): Promise<LoginLogEntry[]> => {
  const CHUNK = 5000;
  const rows: LoginLogEntry[] = [];
  let page = 1;
  let total = Infinity;
  // Page ceiling guards against a server build that ignores `page` and keeps
  // returning the same chunk — without it this would never terminate.
  while (rows.length < total && page <= 200) {
    const res = await axios.get(`${API_BASE_URL}/activity-logs/logins`, {
      headers: authHeaders(),
      params: loginLogParams(filters, page, CHUNK, true),
      timeout: 30000,
    });
    const batch: LoginLogEntry[] = res.data.data || [];
    total = typeof res.data.total === 'number' ? res.data.total : batch.length;
    rows.push(...batch);
    if (!batch.length || batch.length < CHUNK) break;
    page += 1;
  }
  return rows;
};

export const fetchCourseActivityLogs = async (courseId: string): Promise<StudentActivityLog[]> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}`, {
    headers: authHeaders(),
    timeout: 15000,
  });
  return res.data.data || [];
};

// ── Report sessions (measured time only: viewed resources, submitted assignments/assessments) ──
export interface ReportSession {
  /** Present only on the paginated modes — a stable React key for a row that
   *  no longer carries its index in the full list. */
  _id?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  pedagogy: 'I_Do' | 'We_Do' | 'You_Do';
  type: string;          // 'PDF' | 'Video' | ... | 'Assignment' | 'Assessment'
  title: string;         // resource / assignment / assessment name
  subCategory: string | null;
  nodeName: string | null;
  nodeType: string | null;   // 'module' | 'submodule' | 'topic' | 'subtopic'
  startTime: string;     // ISO
  endTime: string | null; // ISO
  durationSec: number;
}

export const fetchCourseReport = async (courseId: string): Promise<ReportSession[]> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}/report`, {
    headers: authHeaders(),
    timeout: 15000,
  });
  return res.data.data || [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Paginated course report.
//
// The call above returns EVERY measured session for a course — 443 rows and
// 161 KB for the busiest one today — which both logs pages then filtered,
// sorted and sliced ten rows at a time in the browser. Passing `page` moves all
// of that into Mongo and brings back the ten rows actually on screen (~3.6 KB).
// Callers that omit every parameter below are untouched.
//
// The date rule is resolved HERE, in the browser, because both pages computed
// their boundaries with local-time setHours — including the rule that a From
// with no To means that single day. Sending absolute instants keeps the
// selection identical whatever timezone the server runs in.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  student?: string;   // 'all' | studentId
  pedagogy?: string;  // 'all' | 'I_Do' | 'We_Do' | 'You_Do'
  subCat?: string;    // 'all' | sub-category
  from?: string;      // 'YYYY-MM-DD' from the date input
  to?: string;        // 'YYYY-MM-DD'
  search?: string;
}

export interface CourseReportPage {
  data: ReportSession[];
  total: number;
  page: number;
  totalPages: number;
  /** Rows in the whole course, ignoring the filters — tells "no activity at
   *  all" apart from "nothing matched", which a filtered count cannot. */
  unfilteredTotal: number;
}

export interface CourseReportFacets {
  /** `email` backs the report banner, which used to find the address by
   *  scanning the full session list for the student's first row. */
  students: { value: string; label: string; email: string }[];
  subCategories: Record<string, string[]>;
  total: number;
}

export interface CourseReportPerDay {
  key: string;
  total: number;
  count: number;
  byPed: Record<string, number>;
}

export interface CourseReportStats {
  stats: {
    total: number;
    count: number;
    byPed: Record<string, number>;
    cntPed: Record<string, number>;
    activeDays: number;
    students: number;
    firstActivity: string;
    lastActivity: string;
  };
  perDay: CourseReportPerDay[];
}

const reportParams = (f: ReportFilters): Record<string, string> => {
  const p: Record<string, string> = {};
  if (f.student && f.student !== 'all') p.student = f.student;
  if (f.pedagogy && f.pedagogy !== 'all') p.pedagogy = f.pedagogy;
  if (f.subCat && f.subCat !== 'all') p.subCat = f.subCat;
  // Not trimmed — only tested for emptiness — because that is what the pages
  // do: a trailing space is part of the needle they search with.
  if (f.search != null && String(f.search).trim()) p.search = f.search;

  const { from, to } = f;
  if (from && !to) {
    // From with no To → just that one day.
    p.from = String(new Date(from).setHours(0, 0, 0, 0));
    p.to = String(new Date(from).setHours(23, 59, 59, 999));
  } else {
    if (from) p.from = String(new Date(from).setHours(0, 0, 0, 0));
    if (to) p.to = String(new Date(to).setHours(23, 59, 59, 999));
  }
  return p;
};

/** The query-key identity for a filter set — same shape the server receives. */
export const reportFilterKey = (f: ReportFilters) => reportParams(f);

export const fetchCourseReportPage = async (
  courseId: string,
  filters: ReportFilters,
  page: number,
  limit: number,
): Promise<CourseReportPage> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}/report`, {
    headers: authHeaders(),
    params: { ...reportParams(filters), page: String(page), limit: String(limit) },
    timeout: 15000,
  });
  return {
    data: res.data.data || [],
    total: res.data.total ?? 0,
    page: res.data.page ?? page,
    totalPages: res.data.totalPages ?? 1,
    unfilteredTotal: res.data.unfilteredTotal ?? 0,
  };
};

/** Every row matching the filters — for the Excel export and the print view,
 *  which cover the whole selection rather than the page on screen. */
export const fetchCourseReportAll = async (
  courseId: string,
  filters: ReportFilters,
): Promise<ReportSession[]> => {
  const CHUNK = 5000;
  const rows: ReportSession[] = [];
  let page = 1;
  let total = Infinity;
  // Page ceiling guards against a server build that ignores `page` and keeps
  // returning the same chunk — without it this would never terminate.
  while (rows.length < total && page <= 200) {
    const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}/report`, {
      headers: authHeaders(),
      params: { ...reportParams(filters), export: '1', page: String(page), limit: String(CHUNK) },
      timeout: 30000,
    });
    const batch: ReportSession[] = res.data.data || [];
    total = typeof res.data.total === 'number' ? res.data.total : batch.length;
    rows.push(...batch);
    if (!batch.length || batch.length < CHUNK) break;
    page += 1;
  }
  return rows;
};

/** The filter dropdowns, built over the WHOLE course. A student with no rows
 *  left after filtering must stay selectable, or the filter that hid them
 *  could never be undone. */
export const fetchCourseReportFacets = async (courseId: string): Promise<CourseReportFacets> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}/report`, {
    headers: authHeaders(),
    params: { facets: '1' },
    timeout: 15000,
  });
  return {
    students: res.data.students || [],
    subCategories: res.data.subCategories || {},
    total: res.data.total ?? 0,
  };
};

/** The report's totals, donut and per-day series — sums over every matching
 *  row, so they cannot be computed from a page. The browser's own timezone
 *  goes with the request because the page buckets days in local time. */
export const fetchCourseReportStats = async (
  courseId: string,
  filters: ReportFilters,
): Promise<CourseReportStats> => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const res = await axios.get(`${API_BASE_URL}/activity-logs/courses/${courseId}/report`, {
    headers: authHeaders(),
    params: { ...reportParams(filters), stats: '1', tz },
    timeout: 20000,
  });
  return {
    stats: res.data.stats || {
      total: 0, count: 0, byPed: {}, cntPed: {}, activeDays: 0, students: 0,
      firstActivity: '', lastActivity: '',
    },
    perDay: res.data.perDay || [],
  };
};

export const fetchAllCourses = async (): Promise<CourseOption[]> => {
  const res = await axios.get(`${API_BASE_URL}/courses-structure/getAll`, {
    headers: authHeaders(),
    timeout: 10000,
  });
  const data = res.data.data || res.data || [];
  return Array.isArray(data) ? data : [];
};

// Called on logout to record the logout time + session duration on the backend.
// Backend should implement POST /activity-logs/logout to stamp logoutTime on the
// user's most recent open login session and compute sessionDuration.
export const postLogout = async (): Promise<void> => {
  try {
    await axios.post(
      `${API_BASE_URL}/activity-logs/logout`,
      { logoutTime: new Date().toISOString() },
      { headers: authHeaders(), timeout: 5000 }
    );
  } catch {
    // Best effort — backend may not have this endpoint yet
  }
};

// Called after login to store browser/device/IP details on the backend.
// Backend should implement POST /activity-logs/login-session to persist these.
export const postLoginDetails = async (details: {
  browser?: string;
  os?: string;
  device?: string;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
}): Promise<void> => {
  try {
    await axios.post(
      `${API_BASE_URL}/activity-logs/login-session`,
      { details },
      { headers: authHeaders(), timeout: 6000 }
    );
  } catch {
    // Best effort — backend may not have this endpoint yet
  }
};

// ── The signed-in user's own measured study time ─────────────────────────────
// Backed by GET /activity-logs/me/learning-time — self-scoped and auth-guarded,
// unlike fetchCourseActivityLogs which returns every user in the course.

export interface LearningTimeBucket {
  seconds: number;
  sessions: number;
}

export interface LearningTimeSummary {
  totalSeconds: number;
  /** Uncapped sum — differs from totalSeconds when long sessions were clamped. */
  rawSeconds: number;
  cappedSessions: number;
  sessionCapSeconds: number;
  weDo: LearningTimeBucket;
  youDo: LearningTimeBucket;
  content: LearningTimeBucket;
  other: LearningTimeBucket;
  byCourse: { courseId: string; courseName: string; seconds: number }[];
  daily: { date: string; seconds: number }[];
}

export const fetchMyLearningTime = async (): Promise<LearningTimeSummary | null> => {
  const res = await axios.get(`${API_BASE_URL}/activity-logs/me/learning-time`, {
    headers: authHeaders(),
    timeout: 15000,
  });
  return res.data?.data || null;
};
