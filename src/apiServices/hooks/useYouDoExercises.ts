// React Query hook + query factory for the YouDo exercises endpoint.
//
// Why this exists: previously `Assessment.tsx` owned its own
// `useState/useEffect/fetch` block. That meant:
//   1. No caching — every mount refetched, even when revisiting the same node
//      seconds later.
//   2. The parent page couldn't tell when the list was ready, so the
//      full-page restore overlay had to dismiss before the exercises were
//      loaded, producing the staggered "Loading Course Content" then
//      "Loading assessments..." sequence the user complained about.
//
// With this hook:
//   - Assessment.tsx consumes `useYouDoExercises(...)` and gets cached data
//     instantly on revisit (staleTime = 1 min, gcTime = 10 min). Background
//     revalidation runs without a UI flicker.
//   - The parent page consumes the SAME hook during a restore. The shared
//     React Query cache means the parent and the child observe the same
//     fetch in flight — no duplicate request. The parent can gate its
//     full-page overlay on this hook's `isSuccess`/`isError` so the loader
//     stays up until the assessment rows are actually painted.

import { useQuery } from "@tanstack/react-query";
import { exerciseApi, EntityType } from "@/apiServices/exercise";
// Resources by Batch — the active batch is part of this query's identity when
// the section is batch-wise. See the queryKey below.
import { getActiveBatchId } from "@/apiServices/resourceBatch";

export type YouDoTab = "I_Do" | "We_Do" | "You_Do";

export interface YouDoExercisesArgs {
  /** Which entity model the id refers to. We accept the same `EntityType` the rest of the codebase uses. */
  entityType: EntityType | null | undefined;
  /** Mongo `_id` of the selected node (module / submodule / topic / subtopic). */
  entityId: string | null | undefined;
  /** Which pedagogy tab — defaults to `You_Do` since that's the only tab this endpoint is used for today. */
  tabType?: YouDoTab;
  /** Subcategory key (e.g. `"assesment"`, `"testYourSkills"`, etc.). */
  subcategory: string | null | undefined;
  /**
   * Caller-side gate. When false the query is parked — useful for the parent
   * page which only wants to fetch during a restore-from-localStorage flow,
   * not on every render.
   */
  enabled?: boolean;
  /**
   * The batch this list belongs to.
   *
   * Passed EXPLICITLY by the Resources page rather than read from module state,
   * because module state is read during render while the request goes out
   * later — the two disagreed for one paint after a batch switch, and that
   * paint was cached under the wrong key, which is how batch 1's assessments
   * ended up rendered under batch 2 until something forced a re-render.
   *
   * Omitted by callers outside the batch strip's reach, who fall back to the
   * module value (unchanged behaviour, "" for courses without batches).
   */
  batchId?: string;
}

/**
 * Stable, normalized response shape so callers don't have to handle the three
 * historical response variants (`data.exercises`, plain array, top-level `exercises`).
 */
export interface YouDoExercisesData {
  exercises: any[];
}

/**
 * Query-options factory. Use this in places that want full control over the
 * `useQuery` call (e.g. to pass `select`, attach `placeholderData`, or merge
 * with other options). Exposed alongside the hook so the parent page and the
 * Assessment component can share the same query key — that's what makes the
 * cache do real work across components.
 */
export const youDoExercisesQuery = (args: YouDoExercisesArgs) => {
  const { entityType, entityId, tabType = "You_Do", subcategory, enabled } = args;
  // Resolved ONCE, then used for both the cache key and the request itself, so
  // the two can never disagree.
  const batchId = args.batchId ?? getActiveBatchId();
  // The cache key uniquely identifies a list within a node + tab + sub + BATCH.
  // Two components asking for the same combination share one fetch.
  //
  // The batch has to be in the key. When You_Do is batch-wise, two batches have
  // genuinely different exercise lists at the same node/tab/subcategory — and
  // with a batch-blind key React Query would serve batch 1's cached list after
  // the user switched the strip to batch 2, so the switch would appear to do
  // nothing. `getActiveBatchId()` returns "" for courses without batches and
  // for students, leaving those keys exactly as they were.
  const queryKey = [
    "youDoExercises",
    entityType,
    entityId,
    tabType,
    subcategory,
    batchId,
  ] as const;
  return {
    queryKey,
    queryFn: async (): Promise<YouDoExercisesData> => {
      // Guarded by `enabled` below — these args should be present whenever
      // queryFn actually runs, but narrow anyway to keep TS happy.
      if (!entityType || !entityId || !subcategory) {
        return { exercises: [] };
      }
      const response = await exerciseApi.getYouDoExercises(entityType, entityId, tabType, subcategory, batchId);
      // Normalize the three historical response shapes into one.
      let exercises: any[] = [];
      if (response?.data?.exercises) exercises = response.data.exercises;
      else if (response?.data && Array.isArray(response.data)) exercises = response.data;
      else if (response?.exercises) exercises = response.exercises;
      return { exercises };
    },
    // Only run when we actually have the inputs we need AND the caller didn't
    // explicitly turn us off.
    enabled: !!entityType && !!entityId && !!subcategory && enabled !== false,
    staleTime: 60 * 1000,    // 1 min — back-navigation paints instantly
    gcTime: 10 * 60 * 1000,  // 10 min — survive a brief detour to another page
    // Don't thrash the network when the window regains focus; this list
    // changes via explicit user actions (create / delete), which we handle
    // with `queryClient.invalidateQueries` from the mutation sites.
    refetchOnWindowFocus: false,
  } as const;
};

/**
 * Convenience hook. `Assessment.tsx` and the parent page both call this; the
 * shared query key means they observe one cached fetch.
 */
export const useYouDoExercises = (args: YouDoExercisesArgs) =>
  useQuery(youDoExercisesQuery(args));

/**
 * Stable cache-key helper for mutation sites that need to invalidate this
 * list after a create / delete. Importing the helper keeps the key shape in
 * one place — change it here and every consumer follows.
 */
export const youDoExercisesQueryKey = (args: Omit<YouDoExercisesArgs, "enabled">) =>
  [
    "youDoExercises",
    args.entityType,
    args.entityId,
    args.tabType ?? "You_Do",
    args.subcategory,
    // Must match `youDoExercisesQuery` exactly — a key without the batch
    // matches no cached list, so the invalidation would silently do nothing.
    args.batchId ?? getActiveBatchId(),
  ] as const;
