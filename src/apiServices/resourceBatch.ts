// resourceBatch.ts — the batch the Resources screens are currently working in.
//
// Resources by Batch gives a course three possible shapes (see the server's
// utils/batchResources.js):
//
//   no-batches → resources live on the course; there is nothing to select.
//   shared     → batches exist, but one set serves all of them; still nothing
//                to select — staff upload once.
//   batch-wise → the ticked elements have their own set per batch, so staff
//                need a batch selected before anything they do means anything.
//
// Only the third case has a selection, and the server is the authority on what
// that selection may be: a student's batch always comes from their enrolment,
// never from here.
//
// This module exists so the batch is attached to requests in ONE place instead
// of at the hundred-odd upload / folder / page / MCQ / exercise / question call
// sites spread across the Resources page and its services. A missed call site
// would silently read or write the wrong batch's material — which is exactly
// how We Do and You Do ended up still serving course-level data after I Do was
// already batch-aware. Two mechanisms, both idempotent:
//
//   • explicit helpers (`stampBatch` / `withBatchBody` / `batchParams`) used by
//     coursesData.ts, where the call sites are few and uniform;
//   • an axios request interceptor (bottom of this file) that covers everything
//     else, including call sites written after this feature.
//
// It is deliberately module state rather than React context: the API layer is
// plain functions with no access to the component tree, and the value is
// per-tab UI state, not server state worth caching.

import axios from "axios";

const STORAGE_KEY = "lms_active_resource_batch";

export interface ResourceBatch {
  id: string | null;
  name: string;
}

export interface ResourceBatchContext {
  /** "no-batches" | "shared" | "batch-wise" — what the UI should render. */
  mode: "no-batches" | "shared" | "batch-wise";
  usesBatches: boolean;
  sameForAllBatches: boolean;
  /** Only these elements are per-batch; the rest stay shared. */
  batchwiseElements: Array<"I_Do" | "We_Do" | "You_Do">;
  batches: ResourceBatch[];
  activeBatchId: string;
  activeBatchName: string;
  /** False for students and whenever nothing is batch-wise. */
  canSelectBatch: boolean;
  isStudent: boolean;
  enrolledBatchId: string;
  /** Plain-language explanation, safe to show as-is. */
  message: string;
}

let activeBatchId = "";

/**
 * Remembered per course, so switching courses does not carry a batch across
 * and quietly show the wrong course's selection. Restored from sessionStorage
 * (not localStorage) — a batch selection is a working context for this tab,
 * not a preference worth surviving a browser restart.
 */
export const getActiveBatchId = (): string => activeBatchId;

export const setActiveBatchId = (courseId: string, batchId: string): void => {
  activeBatchId = batchId || "";
  if (typeof window === "undefined") return;
  try {
    if (activeBatchId) sessionStorage.setItem(`${STORAGE_KEY}:${courseId}`, activeBatchId);
    else sessionStorage.removeItem(`${STORAGE_KEY}:${courseId}`);
  } catch {
    // Private-browsing modes can throw on storage writes. The in-memory value
    // is what requests actually use, so losing persistence is harmless.
  }
};

export const restoreActiveBatchId = (courseId: string): string => {
  if (typeof window === "undefined") return "";
  try {
    activeBatchId = sessionStorage.getItem(`${STORAGE_KEY}:${courseId}`) || "";
  } catch {
    activeBatchId = "";
  }
  return activeBatchId;
};

export const clearActiveBatchId = (): void => {
  activeBatchId = "";
};

/**
 * Reconcile a stored selection against what the server says is available.
 *
 * Returns the batch id the UI should actually use. A selection that no longer
 * exists (batch deleted, course flipped back to shared, staff member moved to
 * a course whose batches differ) falls back to the server's own choice rather
 * than sticking on a dead id and showing an empty screen.
 */
export const reconcileBatch = (
  courseId: string,
  ctx: ResourceBatchContext | null | undefined,
): string => {
  if (!ctx || !ctx.canSelectBatch) {
    // Students and shared/no-batch courses never carry a selection — the
    // server decides, and sending a stale one would only be ignored.
    setActiveBatchId(courseId, "");
    return "";
  }

  const stored = activeBatchId || restoreActiveBatchId(courseId);
  const stillValid = ctx.batches.some((b) => b.id && b.id === stored);
  const next = stillValid ? stored : ctx.activeBatchId || "";
  setActiveBatchId(courseId, next);
  return next;
};

const hasBatch = (v: unknown): boolean =>
  !!v && typeof v === "object" && "batchId" in (v as Record<string, unknown>);

/**
 * Stamp the active batch onto an outgoing write.
 *
 * Safe to call unconditionally: with no batch selected nothing is appended and
 * the server falls back to the shared, course-level container — exactly the
 * behavior a course without batches (or with shared resources) needs.
 */
export const stampBatch = (formData: FormData): FormData => {
  if (activeBatchId && !formData.has("batchId")) formData.append("batchId", activeBatchId);
  return formData;
};

/** Same, for JSON bodies. */
export const withBatchBody = <T extends object>(body: T): T & { batchId?: string } =>
  activeBatchId && !hasBatch(body) ? { ...body, batchId: activeBatchId } : body;

/** Same, for query strings. */
export const batchParams = (): Record<string, string> =>
  activeBatchId ? { batchId: activeBatchId } : {};

/**
 * Same, for a URL about to be handed to the NATIVE `fetch`.
 *
 * The interceptor at the bottom of this file covers axios and nothing else, so
 * every `fetch()` call is invisible to it. That is not a hypothetical gap: the
 * exercise create/update calls in `ExerciseSettings.tsx` use `fetch`, and with
 * no `batchId` the server falls back to the course's FIRST batch — so an
 * assignment authored with batch 2 selected was filed under batch 1.
 *
 * Idempotent and safe to call unconditionally: with no batch selected the URL
 * is returned untouched and the server uses the shared, course-level container.
 */
export const withBatchUrl = (url: string): string => {
  if (!activeBatchId || /[?&]batchId=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}batchId=${encodeURIComponent(activeBatchId)}`;
};

// ── Global stamping ─────────────────────────────────────────────────────────
//
// The helpers above cover `coursesData.ts`, where the call sites are few and
// uniform. The EXERCISE side — We Do assignments and You Do assessments — is
// spread across `exercise.ts`, `question.ts` and several component-level fetches
// in shapes that vary (FormData, JSON, hand-built query strings). Stamping each
// by hand there means the feature is only as correct as my grep was, and a
// missed call site reads or writes the wrong batch silently.
//
// So the batch is attached by an axios interceptor instead: one rule, applied
// to every request to the pedagogy-bearing endpoints regardless of who wrote
// the call. It is idempotent, so the explicit helpers above and this can
// coexist without sending `batchId` twice (express would turn a duplicate into
// an array and the server's batch lookup would fail to match it).
const BATCH_AWARE_PATHS = [
  "/exercise/",
  "/you-do/",
  "/question-",
  "/mcq/",
  "/uploadResourses/",
  "/pages/",
  "/getAll/courses-data",
  "/file-mcq-",
  "/student-file-progress",
];

const isBatchAware = (url: string): boolean =>
  BATCH_AWARE_PATHS.some((p) => url.includes(p));

let interceptorInstalled = false;

/**
 * Install the interceptor. Idempotent, and called from this module's import
 * side so any page that touches a course API gets it without opting in.
 */
export const installBatchInterceptor = (axiosInstance: any): void => {
  if (interceptorInstalled || !axiosInstance?.interceptors) return;
  interceptorInstalled = true;

  axiosInstance.interceptors.request.use((config: any) => {
    if (!activeBatchId) return config;

    const url = String(config.url || "");
    if (!isBatchAware(url)) return config;

    // Query string — covers GETs and any hand-built `?a=b` URL.
    if (!config.params || !("batchId" in config.params)) {
      // A URL that already spells out batchId (from an explicit helper) wins.
      if (!/[?&]batchId=/.test(url)) {
        config.params = { ...(config.params || {}), batchId: activeBatchId };
      }
    }

    // Body — writes are matched on the server from body first, then query, so
    // stamping both is belt and braces for endpoints that read only one.
    const data = config.data;
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      if (!data.has("batchId")) data.append("batchId", activeBatchId);
    } else if (data && typeof data === "object" && !Array.isArray(data) && !hasBatch(data)) {
      // Leave Blob/ArrayBuffer/URLSearchParams bodies alone — appending to them
      // would corrupt the payload rather than annotate it.
      const isPlain = Object.getPrototypeOf(data) === Object.prototype;
      if (isPlain) config.data = { ...data, batchId: activeBatchId };
    }

    return config;
  });
};

// Install on the shared axios default instance at import time. Every service in
// this app calls the global `axios`, so this reaches all of them — including
// call sites added later that never learn about batches.
installBatchInterceptor(axios);
