// ─────────────────────────────────────────────────────────────────────────────
// React Query cache persistence — survives hard reloads.
//
// Without persistence, every `Ctrl+R` (or close-and-reopen-tab) starts from
// an empty in-memory cache, so every endpoint re-fetches over the network.
// With persistence the QueryClient writes its cache to `localStorage` on
// every change and reads it back on app boot — repeat reloads paint from
// cache instantly while a background revalidation keeps things fresh.
//
// We use the SYNCHRONOUS `createSyncStoragePersister` because:
//   • `localStorage` is sync, simpler, no race conditions on boot.
//   • Our cache footprint is small now that the heavy endpoints are split
//     (`/light` + per-node `/node-pedagogy`) — well within the 5 MB LS quota
//     even for big courses.
//   • The async (IndexedDB) variant is overkill for what we cache here.
//
// Three safety knobs are set:
//   1. `key` is namespaced so multiple Next.js apps on the same origin can't
//      collide.
//   2. `BUSTER` is bumped when the cache shape changes (e.g. when we add or
//      remove a query factory) so stale serialized state is discarded.
//   3. `maxAge` caps how long we'll trust a persisted entry. After this,
//      it's discarded and re-fetched — protects against hours-old data
//      lingering after a long absence.
//
// We also restrict WHICH queries get persisted (`dehydrateOptions.shouldDehydrateQuery`)
// to avoid bloating LS:
//   • The "heavy" `["course", id]` payload (used by reviewSubmission + live
//     dashboard marks) can be multi-MB — explicitly NOT persisted.
//   • The "light" `["course-light", id]` and per-node `["course-node-pedagogy",
//     type, id]` payloads ARE persisted — these are the ones the Resources
//     page reads on first paint, so caching them is exactly what fixes the
//     hard-reload latency.
//   • `["youDoExercises", …]` payload is small and worth persisting.
//   • Everything else (notifications, current user, etc.) persists by
//     default — they're tiny and benefit from instant boot too.
// ─────────────────────────────────────────────────────────────────────────────

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query } from "@tanstack/react-query";

/** Bump this string whenever query shapes / factories change in a way that
 *  would break a persisted cache from the previous version. The persister
 *  will discard any cache whose buster doesn't match. */
// v9: "grades" added to NON_PERSISTED_KEYS. That filter only decides what is
// WRITTEN from now on — every browser still holds a persisted blob containing
// the old grades entries, including the string-concatenated overallScore the
// server used to emit ("555005550" where the sum is 30). Bumping the buster is
// what actually discards it.
// v10: "courses" added to NON_PERSISTED_KEYS. ["courses","detail",id] is the
// SAME multi-MB /getAll/courses-data payload the legacy "course" root was
// excluded for — and it is viewer/batch-scoped and carries the populated
// roster (student names + emails). Persisted under a courseId-only key it
// outlived logins for 24h, so a student rehydrated another viewer's (or a
// pre-upload) copy and saw an empty resource list. The buster bump discards
// every browser's already-persisted copy; the key gained a viewerId segment
// in the same change.
export const QUERY_CACHE_BUSTER = "2026-09-01-v10";

/** Max age for a persisted entry. After this we re-fetch on next read.
 *  24h is a sane middle ground — long enough to make repeat-reloads feel
 *  instant for a full work day, short enough that yesterday's data doesn't
 *  silently hang around for a week. */
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** localStorage key under which the cache is serialized. Namespaced so the
 *  cache from one Next.js app (e.g. a future second deploy on the same
 *  origin during a migration) can't poison this one. */
export const QUERY_CACHE_LS_KEY = "smartcliff:rq-cache:v1";

/** Set of query-key root names we explicitly DON'T want to persist. These
 *  are large enough that persisting them would risk blowing the ~5 MB
 *  localStorage quota for one origin and would also be slow to (de)serialize
 *  on app boot. */
const NON_PERSISTED_KEYS = new Set<string>([
  // The heavy `/getAll/courses-data/:courseId` payload. Multi-MB. Only
  // consumed by reviewSubmission + live dashboard marks — both of which
  // benefit less from a stale cache than from fresh data anyway.
  "course",
  // The SAME payload under the query-factory root: ["courses","detail",id]
  // (student course detailed view) plus the per-user course list. Three
  // reasons, each sufficient:
  //   • size — identical multi-MB body to "course" above;
  //   • PII — the populated batchAndParticipants roster (names, emails);
  //   • viewer scoping — the server resolves the caller's batch and gates by
  //     role, so a persisted copy served across logins painted another
  //     viewer's (or a pre-upload) resource list — the "teacher added
  //     resources, student sees No resources yet" bug.
  // Still cached in memory for the hook's gcTime — it just doesn't outlive
  // the tab.
  "courses",
  // Dashboard analytics (`/student-Dashboard/courses-data/analytics`).
  // Against an up-to-date server the admin dashboard requests the ?light=1
  // projection (small), but an older server ignores the param and returns
  // the full multi-MB pedagogy payload — persisting that can blow the LS
  // quota for the WHOLE cache blob. The data is also institution-scoped,
  // so it shouldn't outlive the session in shared-browser setups.
  "analytics",
  // The institution user directory (`/getAll/userAccess/:id`). Megabytes for
  // a real institution, and it's PII (names, emails, phones, per-user
  // permission trees) — never write it to localStorage. Covers the
  // usermanagement page's ["users", ...] keys.
  "users",
  // EnrollmentTab's separate cache of the SAME payload.
  "allUsersForCourse",
  // The course-structure list (`/courses-structure/getAll`) deep-populates
  // every enrolled user of every batch — multi-MB per institution — and the
  // per-course detail can carry full rosters too. "course-structures" covers
  // stale entries persisted under the retired private key.
  "courseStructures",
  "courseStructure",
  "course-structures",
  // Per-user approval queue — must never leak across accounts on a shared
  // browser, and it goes stale the moment anyone acts on a workflow.
  "approvals",
  // Login logs + per-course activity reports — names, emails, IPs, resolved
  // locations, device/browser strings. Never write PII like this to
  // localStorage.
  "activityLogs",
  // The institution's question bank. One embedded `questions[]` array that
  // grows without bound — the sibling other-platform bank is already
  // 5148 questions / 9.2 MB, and an authored bank scales the same way, so
  // this must never compete for the ~5 MB localStorage budget.
  // ONE narrow exception is re-admitted below — see `isReadmittedEntry`.
  "questionBank",
  // Attendance records are per-course/per-range slices that go stale as soon
  // as anyone marks a day.
  "attendance",
  // The shared course roster — student names, emails and enrollment ids.
  "courseRoster",
  // Every feedback form with its embedded studentResponses[] — student names
  // and free-text comments. Same rule as the roster: never localStorage.
  "feedback",
  // The Grades drill (exercises → students → questions). Two reasons, either
  // one sufficient:
  //   • PII — the students payload is names, emails and per-student scores,
  //     the same shape as courseRoster and feedback above.
  //   • Freshness — marks change the moment anyone grades or a student
  //     submits, and the global query defaults are staleTime 5 min with
  //     `refetchOnMount: false`, so a PERSISTED entry can keep painting the
  //     old marks for the persister's full 24 h maxAge. A grading screen is
  //     the last place that should show yesterday's numbers.
  // Still cached in memory for the hook's gcTime — it just doesn't outlive
  // the tab.
  "grades",
]);

/** Hard ceiling on a single re-admitted entry (see `isReadmittedEntry`). A
 *  root lands in NON_PERSISTED_KEYS because SOMETHING under it is huge, so an
 *  entry allowed back in has to prove it is small before it is written. 512 KB
 *  is ~10 % of the 5 MB localStorage budget for the origin — generous for a
 *  10-row page, tight enough that an unexpectedly fat payload is dropped
 *  instead of evicting the rest of the cache. */
const READMITTED_MAX_BYTES = 512 * 1024;

/** The two server-paginated question-bank listings, by their queryKey's second
 *  element: the institution's own bank (/lms/pages/questionbanks) and the
 *  global external bank (/lms/pages/questionbanks/external). */
const PAGED_BANK_KEYS = new Set(["paged", "otherPlatformPaged"]);

/** Every axis either bank's listing can narrow on. All must be at their empty
 *  default for an entry to count as "the view the page lands on". `courseId`
 *  and `createdAfter` are absent rather than empty when unset, which `!v`
 *  handles either way. */
const BANK_FILTER_PARAMS = [
  "questionType", "category", "difficulty", "isActive",
  "createdBy", "marks", "search", "createdAfter", "courseId",
] as const;

/**
 * Narrow exceptions to NON_PERSISTED_KEYS: entries under an excluded root that
 * are individually small AND worth having on first paint.
 *
 * Today that means the two Question Bank listings' FIRST page with no filters
 * applied — the view each of those routes lands on every time it mounts. The
 * "questionBank" root is excluded because the UNPAGINATED reads under it are
 * megabytes (the external bank alone is 5148 questions / 9.2 MB, and the
 * institution bank is one embedded array that grows without bound); a
 * server-paginated 10-row page is not, and persisting it is the difference
 * between those pages painting instantly on a hard reload and re-running their
 * request from scratch.
 *
 * Deliberately narrow — page 1, unfiltered only:
 *   • Page state is component state, so a reload always lands back on page 1.
 *     Persisting pages 2..N would buy nothing a reload can use while letting a
 *     long paging session write hundreds of entries into localStorage.
 *   • Filters and the (debounced) search are part of the key, so admitting
 *     them would mint a fresh persisted entry per distinct search term.
 * Pages 2..N and every filtered view still cache normally IN MEMORY for the
 * hook's gcTime — they just don't outlive the tab.
 */
const isReadmittedEntry = (queryKey: readonly unknown[]): boolean => {
  if (queryKey[0] !== "questionBank") return false;
  if (typeof queryKey[1] !== "string" || !PAGED_BANK_KEYS.has(queryKey[1])) return false;
  const params = queryKey[2] as Record<string, unknown> | undefined;
  if (!params || typeof params !== "object") return false;
  if (params.page !== 1) return false;
  return BANK_FILTER_PARAMS.every((k) => !params[k]);
};

/**
 * Filter function passed to the persister's dehydrateOptions. Returns
 * `true` to persist the query, `false` to skip it.
 */
const shouldDehydrateQuery = (query: Query) => {
  // Only persist successful query data — failed/loading queries would just
  // re-trigger their network call anyway on next mount.
  if (query.state.status !== "success") return false;
  // The first element of the queryKey is conventionally the "root" name.
  const root = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined;
  if (typeof root === "string" && NON_PERSISTED_KEYS.has(root)) {
    if (!isReadmittedEntry(query.queryKey)) return false;
    // Cheap here BECAUSE the predicate above matches at most a couple of
    // entries — never run this over the whole cache.
    try {
      return JSON.stringify(query.state.data).length <= READMITTED_MAX_BYTES;
    } catch {
      return false;
    }
  }
  return true;
};

/**
 * Build the persister. Returns `null` on the server (SSR), where
 * `localStorage` doesn't exist. `PersistQueryClientProvider` accepts a
 * `null` persister and falls back to in-memory only — same behavior as
 * before — so no SSR breakage.
 */
export const buildQueryPersister = () => {
  if (typeof window === "undefined") return null;
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_LS_KEY,
    // The persister can throttle writes; default is 1s which is fine for
    // our use case (we don't fire dozens of cache changes per second).
    throttleTime: 1000,
  });
};

/** Persist options to spread into `<PersistQueryClientProvider persistOptions={…}>`. */
export const queryPersistOptions = (persister: ReturnType<typeof buildQueryPersister>) => ({
  persister: persister!, // Caller has already null-checked at the SSR boundary
  buster: QUERY_CACHE_BUSTER,
  maxAge: QUERY_CACHE_MAX_AGE_MS,
  dehydrateOptions: {
    shouldDehydrateQuery,
  },
});

export { shouldDehydrateQuery };
