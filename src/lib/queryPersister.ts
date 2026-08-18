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
export const QUERY_CACHE_BUSTER = "2026-08-17-v8";

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
  "questionBank",
  // Attendance records are per-course/per-range slices that go stale as soon
  // as anyone marks a day.
  "attendance",
  // The shared course roster — student names, emails and enrollment ids.
  "courseRoster",
  // Every feedback form with its embedded studentResponses[] — student names
  // and free-text comments. Same rule as the roster: never localStorage.
  "feedback",
]);

/**
 * Filter function passed to the persister's dehydrateOptions. Returns
 * `true` to persist the query, `false` to skip it.
 */
const shouldDehydrateQuery = (query: Query) => {
  // The first element of the queryKey is conventionally the "root" name.
  const root = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined;
  if (typeof root === "string" && NON_PERSISTED_KEYS.has(root)) return false;
  // Only persist successful query data — failed/loading queries would just
  // re-trigger their network call anyway on next mount.
  return query.state.status === "success";
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
