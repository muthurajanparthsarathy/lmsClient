export type CoursesListFilters = {
  searchTerm: string;
  selectedCategory: string;
  selectedLevel: string;
  page: number;
};

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    // ["currentUser"] (not ["auth","currentUser"]) because that literal key
    // predates this factory and is still used inline by the student navbar,
    // uploadcourseresources and Assessment — all consumers must share ONE
    // cache entry for the verify-token payload.
    currentUser: () => ["currentUser"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    // Keyed per user: the payload is institution- and role-scoped on the
    // server, so two accounts on one browser must never share an entry.
    adminDashboard: (userId: string | null) =>
      ["analytics", "admin-dashboard", { userId }] as const,
    // The student dashboard's own scoped view (`?mine=1`) — only the courses
    // the caller is enrolled in, so it must never be shared across accounts.
    studentDashboard: (userId: string | null) =>
      ["analytics", "student-dashboard", { userId }] as const,
    // `GET /analytics/staff/analytics/students` — the staff / L&D roll-up:
    // every course in the institution with its per-student progress rows.
    // Keyed per user like its siblings (the payload is institution- and
    // role-scoped server-side). The L&D console read this from FOUR call
    // sites with no cache at all, and it is the slowest call in the app
    // (~12 s, server-side computation), so sharing one entry matters more
    // here than anywhere else. The 12 s itself is a server problem — this
    // key only stops it being paid four times.
    staffStudents: (userId: string | null) =>
      ["analytics", "staff-students", { userId }] as const,
  },
  // The "users" root is a CONTRACT: PermissionModal and BulkPermissionModal
  // invalidate ['users'] after permission saves — keep the root string if you
  // ever restructure these keys. Root is also excluded from persistence
  // (PII + multi-MB payload) — see queryPersister.ts.
  users: {
    all: ["users"] as const,
    list: (institutionId: string | null) =>
      ["users", "list", { institutionId }] as const,
    // ONE page of the admin directory, server-filtered and server-sorted. The
    // filters and sort are part of the identity because the server, not the
    // page, now decides which rows come back — so each distinct view is its
    // own entry and paging back to a visited page is a cache hit. Same "users"
    // root as list(), so every existing invalidateQueries(queryKeys.users.all)
    // still reaches it.
    page: (institutionId: string | null, params: Record<string, unknown>) =>
      ["users", "page", { institutionId, ...params }] as const,
    // The Profile page's admin stats — six COUNTS, not rows (`?stats=1`).
    // It used to pull the entire roster under a profileStatsRaw key and count
    // it in the browser: 583,744 bytes for 179 users to display six numbers.
    // Mongo counts them now and the response is 153 bytes.
    //
    // `since` parameterises the 30-day "new users" window and so belongs in
    // the identity. Same "users" root as the rest, so permission-save
    // invalidations (PermissionModal/BulkPermissionModal →
    // invalidateQueries(['users'])) still reach this entry by prefix.
    profileStats: (institutionId: string | null, since: number) =>
      ["users", "profileStats", { institutionId, since }] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (institutionId: string | null) =>
      ["roles", "list", { institutionId }] as const,
  },
  // Per-user approval queue (root excluded from persistence — see
  // queryPersister.ts). Approve/reject mutations on the review pages should
  // invalidate the root.
  approvals: {
    all: ["approvals"] as const,
    pending: (userId: string | null) =>
      ["approvals", "pending", { userId }] as const,
  },
  // Reference lists for the user-management modals ride the services' own
  // factories (clientManagementKeys / serviceMappingKeys / plain ['degrees'])
  // so their mutations invalidate one cache entry, not two.
  courses: {
    all: ["courses"] as const,
    lists: () => ["courses", "list"] as const,
    list: (userId: string | null) => ["courses", "list", { userId }] as const,
    details: () => ["courses", "detail"] as const,
    detail: (courseId: string) => ["courses", "detail", courseId] as const,
  },
  pedagogy: {
    all: ["pedagogy"] as const,
    views: () => ["pedagogy", "views"] as const,
    viewById: (id: string) => ["pedagogy", "view", id] as const,
    viewForCourse: (courseId: string) => ["pedagogy", "view-for-course", courseId] as const,
  },
  reviewSubmission: {
    all: ["reviewSubmission"] as const,
    courseData: (courseId: string) =>
      ["reviewSubmission", "courseData", courseId] as const,
  },
  progress: {
    all: ["progress"] as const,
    forUserCourse: (userId: string, courseId: string) =>
      ["progress", userId, courseId] as const,
  },
  // `GET /getAll/courses-data/:courseId?roster=1` — the course document with
  // its enrolled participants populated, minus the module/pedagogy tree.
  // Attendance, the enrollment tab and every feedback screen read this; before
  // unification each fetched the FULL (multi-MB) payload under its own key, or
  // under no cache at all. Root excluded from persistence — it carries student
  // names and emails.
  courseRoster: {
    all: ["courseRoster"] as const,
    detail: (courseId: string) => ["courseRoster", courseId] as const,
  },
  // `GET /courses/:courseId/batches` — the batch list plus the course's
  // hierarchy header (name, code, mappingId, degree, departmentSections).
  // Read by the Course Batches, Course Sections and Course Participants pages,
  // which each used to fetch it independently with no cache at all.
  courseBatches: {
    all: ["courseBatches"] as const,
    detail: (courseId: string) => ["courseBatches", courseId] as const,
  },
  // Attendance management / report / analytics. The roster and the records
  // were each fetched under THREE different keys (report-*, analytics-*,
  // report-modal-*) for byte-identical requests, so moving between the views
  // re-downloaded both. One key each; per-view shapes come from `select`.
  // Root excluded from persistence — the roster is student PII.
  attendance: {
    all: ["attendance"] as const,
    overview: (date: string) => ["attendance", "overview", date] as const,
    // The roster moved to queryKeys.courseRoster — it is not attendance-
    // specific, and keeping a private copy here re-fragmented the very cache
    // entry that unifying it was meant to consolidate.
    records: (courseId: string, from?: string, to?: string) =>
      ["attendance", "records", courseId, from ?? "", to ?? ""] as const,
    // Cells for the page of students on screen. Same "attendance","records"
    // prefix as the whole-range key, so the existing write invalidation still
    // reaches it.
    recordsFor: (courseId: string, from: string, to: string, studentIds: string[]) =>
      ["attendance", "records", courseId, from, to, "for", studentIds] as const,
    // The Report/Analytics aggregates, computed server-side over the whole
    // selection — they are sums over every matching row, so a page of records
    // could never have produced them.
    summary: (courseId: string, from: string, to: string, scope: Record<string, unknown>) =>
      ["attendance", "summary", courseId, from, to, scope] as const,
    // One student's own rows for a course — the student dashboard's scoped
    // read. Separate from records() because the server response differs.
    myRecords: (courseId: string, studentId: string, from?: string, to?: string) =>
      ["attendance", "myRecords", courseId, studentId, from ?? "", to ?? ""] as const,
  },
  // The institution's authored question bank (`GET /getAll/question-bank`).
  // ONE document per institution holding an embedded `questions[]` array, so
  // the list is all-or-nothing — filters/search run in useMemo over this
  // single entry, never in the key. Root excluded from persistence: the
  // sibling other-platform bank shows how large an embedded bank gets
  // (5148 questions / 9.2 MB), and an authored bank grows the same way.
  questionBank: {
    all: ["questionBank"] as const,
    list: () => ["questionBank", "list"] as const,
    // Server-paginated view of that same bank (`?page=`), used by the admin
    // Question Bank page. Filters and page number DO belong in this key —
    // unlike list() above — precisely because the filtering is server-side, so
    // each combination really is a different response.
    //
    // Sibling of list() rather than a child of it: both hang off the
    // "questionBank" root, so useInvalidateQuestionBank still reaches both by
    // prefix, but the optimistic writes that target list() exactly cannot
    // accidentally land on a page object of a different shape.
    paged: () => ["questionBank", "paged"] as const,
    pagedList: (params: unknown) => ["questionBank", "paged", params] as const,
    // The GLOBAL other-platform bank (one shared collection, not
    // institution-scoped): 5148 imported questions. The picker used to re-
    // download it on every open, from ~10 call sites — now server-paginated.
    otherPlatform: () => ["questionBank", "otherPlatform"] as const,
    // Admin-listing paged view of the same bank — Create/Edit/Delete surface
    // at /lms/pages/questionbanks/external. Sibling of `otherPlatform` under
    // the "questionBank" root so both refresh on invalidation, but its own
    // exact factory holds the admin-flavor payload (stats + categories +
    // createdBy in facets) that the picker never reads.
    otherPlatformPaged: () => ["questionBank", "otherPlatformPaged"] as const,
    otherPlatformPagedList: (params: unknown) =>
      ["questionBank", "otherPlatformPaged", params] as const,
  },
  // `GET /getAll/feedback` — every feedback form in the institution with its
  // embedded studentResponses[]. One all-or-nothing document list, so the
  // per-view filtering runs in useMemo over this single entry, never in the
  // key. Root excluded from persistence (see queryPersister.ts): the
  // responses carry student names and free-text comments, and the endpoint
  // is NOT institution-scoped server-side — callers narrow it themselves.
  feedback: {
    all: ["feedback"] as const,
    list: () => ["feedback", "list"] as const,
  },
  // Login logs + per-course activity reports (Logs pages). Root excluded
  // from persistence — see queryPersister.ts (PII: names, emails, IPs).
  activityLogs: {
    all: ["activityLogs"] as const,
    logins: () => ["activityLogs", "logins"] as const,
    // One page of the login feed. The date range and the search are part of
    // the identity because the SERVER, not the page, now decides which rows
    // come back. Same "activityLogs" root as logins(), so any existing
    // invalidateQueries(activityLogs.all) still reaches it.
    loginsPage: (filters: Record<string, unknown>) =>
      ["activityLogs", "logins", "page", filters] as const,
    courseReport: (courseId: string) =>
      ["activityLogs", "courseReport", courseId] as const,
    // The course report's paginated modes. All three nest under the same
    // ["activityLogs","courseReport",courseId] prefix as the full-list key
    // above, so invalidating a course still reaches every one of them.
    courseReportPage: (
      courseId: string,
      filters: Record<string, unknown>,
      page: number,
    ) => ["activityLogs", "courseReport", courseId, "page", filters, page] as const,
    // Facets describe the whole COURSE, so no filters in the identity —
    // narrowing the table must not narrow the dropdowns that undo it.
    courseReportFacets: (courseId: string) =>
      ["activityLogs", "courseReport", courseId, "facets"] as const,
    courseReportStats: (courseId: string, filters: Record<string, unknown>) =>
      ["activityLogs", "courseReport", courseId, "stats", filters] as const,
    // Every row matching a filter set — the print view and the spreadsheet
    // cover the whole selection, not the page on screen.
    courseReportAll: (courseId: string, filters: Record<string, unknown>) =>
      ["activityLogs", "courseReport", courseId, "all", filters] as const,
    // The signed-in user's OWN measured study time (self-scoped server-side).
    myLearningTime: (userId: string | null) =>
      ["activityLogs", "myLearningTime", { userId }] as const,
  },
} as const;
