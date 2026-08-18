import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "@/lib/queryKeys";
import { questionBankService } from "@/apiServices/questionBankService";
import type { Question } from "@/apiServices/type/question";

// ─────────────────────────────────────────────────────────────────────────────
// Question Bank list — `GET /getAll/question-bank`.
//
// The endpoint returns the institution's ENTIRE embedded questions[] array;
// there is no server-side pagination and the four filter params it accepts are
// applied to that same in-memory array server-side. The page therefore fetches
// once and filters/searches/sorts in useMemo — filters must NOT go in the
// query key, or every keystroke would mint a new cache entry and re-download
// the whole bank (the mistake categoryTab.tsx still makes with ['categories',
// page, search, status]).
//
// The Question Bank picker components (QuestionBankSelector and friends, used
// by the pedagogy/exercise authoring forms) deliberately stay on their own
// direct service calls — they are fetch-only by design and belong to a
// different route's scope. They pass filter params, so they would not share
// this cache entry anyway.
//
// NOTE for the persister: the "questionBank" root is in NON_PERSISTED_KEYS —
// see queryPersister.ts before renaming these keys.
// ─────────────────────────────────────────────────────────────────────────────

const TWO_MIN = 2 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export const useQuestionBankQuery = (enabled: boolean = true) =>
  useQuery<Question[]>({
    queryKey: queryKeys.questionBank.list(),
    queryFn: async () => {
      const response = await questionBankService.getAllQuestions();
      return response.questions || [];
    },
    enabled,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

export interface QuestionBankPageParams {
  page: number;
  limit: number;
  questionType?: string;
  category?: string;
  difficulty?: string;
  isActive?: string;
  createdBy?: string;
  marks?: string;
  createdAfter?: number;
  search?: string;
}

export interface QuestionBankFacets {
  categories: string[];
  createdBy: string[];
  stats: { total: number; mcq: number; programming: number; active: number };
}

export interface QuestionBankPage {
  questions: Question[];
  /** Rows matching the current filters, across every page. */
  total: number;
  /** Rows in the whole bank, ignoring the filters. */
  bankTotal: number;
  page: number;
  totalPages: number;
  facets: QuestionBankFacets;
}

const EMPTY_FACETS: QuestionBankFacets = {
  categories: [],
  createdBy: [],
  stats: { total: 0, mcq: 0, programming: 0, active: 0 },
};

/**
 * One page of the institution's authored bank, for the admin Question Bank
 * page — which rendered every row of a response that was 114,576 bytes for 89
 * questions (~1,290 B/row) and grew with the bank.
 *
 * Everything the page used to derive from the full list now travels with the
 * response: the filtered `total`, and `facets` counted over the WHOLE bank so
 * the Category / Created By dropdowns and the four header stat chips keep
 * showing real totals rather than what happens to be on screen.
 *
 * Filters are part of the key, which is correct here (and wrong for the
 * unpaginated `list()` above) precisely because the filtering is server-side.
 * `keepPreviousData` stops the table blanking while the next page loads.
 */
export const useQuestionBankPageQuery = (
  params: QuestionBankPageParams,
  enabled: boolean = true,
) =>
  useQuery<QuestionBankPage>({
    queryKey: queryKeys.questionBank.pagedList(params),
    queryFn: async () => {
      const response: any = await questionBankService.getAllQuestions(params);
      return {
        questions: response.questions || [],
        total: response.total ?? 0,
        bankTotal: response.bankTotal ?? 0,
        page: response.page ?? 1,
        totalPages: response.totalPages ?? 1,
        facets: response.facets ?? EMPTY_FACETS,
      };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

const FIFTEEN_MIN = 15 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

export interface OtherPlatformBankParams {
  page: number;
  limit: number;
  search?: string;
  questionType?: string;
  problemTypes?: string;
  railDifficulty?: string;
  topic?: string;
  tag?: string;
  sort?: string;
}

export interface OtherPlatformBankPage {
  questions: Question[];
  total: number;
  facets: {
    problemTypeCounts: Record<string, number>;
    difficultyCounts: { easy: number; medium: number; hard: number };
    topics: { value: string; label: string }[];
    tags: { value: string; label: string }[];
  };
}

/**
 * The GLOBAL other-platform bank — one document shared by every institution,
 * holding platform-imported questions (Exercism, competitive-programming
 * dumps). 5148 questions / 9.19 MB, of which the picker used to download
 * EVERY row on open — 10.3 MB, 4.7 s — and then render all of them.
 *
 * Now server-paginated: the filters and the sort travel with the request, and
 * the response carries one page plus the filter rail's facets counted over the
 * whole type-scoped set (so the rail still shows real totals, not just what is
 * on this page). Measured: 10,314,588 -> 29,037 bytes for a 25-row page.
 *
 * Every filter is part of the key, which is correct here precisely BECAUSE the
 * filtering is server-side — each distinct filter+page combination really is a
 * different response. `keepPreviousData` stops the grid blanking while the
 * next page loads.
 */
export const useOtherPlatformQuestionBankQuery = (
  params: OtherPlatformBankParams,
  enabled: boolean = true,
) =>
  useQuery<OtherPlatformBankPage>({
    queryKey: [...queryKeys.questionBank.otherPlatform(), params],
    queryFn: async () => {
      const response: any = await questionBankService.getAllOtherPlatformQuestions({
        isActive: true,
        ...params,
      });
      return {
        questions: response.questions || [],
        total: response.total ?? 0,
        facets: response.facets ?? {
          problemTypeCounts: {},
          difficultyCounts: { easy: 0, medium: 0, hard: 0 },
          topics: [],
          tags: [],
        },
      };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: FIFTEEN_MIN,
    gcTime: THIRTY_MIN,
  });

/**
 * Refresh the bank after a write. Exported so the composite flows (the
 * publish-drafts loop, the bulk archive/delete loops, the MCQ save) can fire
 * ONE invalidation after the whole batch instead of one per item — the same
 * shape as useInvalidateMappingCaches in the service-mapping module.
 */
export const useInvalidateQuestionBank = () => {
  const qc = useQueryClient();
  return useCallback(
    () => qc.invalidateQueries({ queryKey: queryKeys.questionBank.all }),
    [qc]
  );
};

export const useDeleteQuestionMutation = () => {
  const invalidate = useInvalidateQuestionBank();
  return useMutation({
    mutationFn: (id: string) => questionBankService.deleteQuestion(id),
    onSuccess: () => invalidate(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// External (Other Platform) bank — admin listing + Create / Edit / Delete.
//
// Shares the "questionBank" root with the picker's own hook so
// useInvalidateQuestionBank refreshes both; distinct factory so the exact
// shapes don't collide (this page's response carries admin-flavor facets —
// stats, categories, createdBy — that the picker never reads).
// ─────────────────────────────────────────────────────────────────────────────

export interface OtherPlatformPageParams {
  page: number;
  limit: number;
  questionType?: string;
  category?: string;
  difficulty?: string;
  isActive?: string;
  createdBy?: string;
  search?: string;
}

export interface OtherPlatformAdminFacets {
  problemTypeCounts: Record<string, number>;
  difficultyCounts: { easy: number; medium: number; hard: number };
  topics: { value: string; label: string }[];
  tags: { value: string; label: string }[];
  stats: { total: number; mcq: number; programming: number; active: number };
  categories: string[];
  createdBy: string[];
}

export interface OtherPlatformAdminPage {
  questions: Question[];
  /** Rows matching the current filters, across every page. */
  total: number;
  /** Rows in the type-scoped set (before rail + search). */
  scopeTotal: number;
  page: number;
  totalPages: number;
  facets: OtherPlatformAdminFacets;
}

const EMPTY_ADMIN_FACETS: OtherPlatformAdminFacets = {
  problemTypeCounts: {},
  difficultyCounts: { easy: 0, medium: 0, hard: 0 },
  topics: [],
  tags: [],
  stats: { total: 0, mcq: 0, programming: 0, active: 0 },
  categories: [],
  createdBy: [],
};

/**
 * One page of the External bank for the admin listing at
 * /lms/pages/questionbanks/external. Uses the same server endpoint as the
 * picker, but reads the additional admin-side facets (stats, categories,
 * createdBy) the endpoint returns alongside its picker-side facets.
 */
export const useOtherPlatformBankPageQuery = (
  params: OtherPlatformPageParams,
  enabled: boolean = true,
) =>
  useQuery<OtherPlatformAdminPage>({
    queryKey: queryKeys.questionBank.otherPlatformPagedList(params),
    queryFn: async () => {
      const response: any = await questionBankService.getAllOtherPlatformQuestions(params);
      const total = response.total ?? 0;
      const limit = response.limit ?? params.limit;
      return {
        questions: response.questions || [],
        total,
        scopeTotal: response.scopeTotal ?? total,
        page: response.page ?? 1,
        totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
        facets: response.facets ?? EMPTY_ADMIN_FACETS,
      };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

/**
 * Refresh every External bank cache entry after a write. Same pattern as
 * useInvalidateQuestionBank: one call refreshes the picker AND the admin
 * listing (both hang off the "questionBank" root).
 */
export const useInvalidateOtherPlatformBank = () => {
  const qc = useQueryClient();
  return useCallback(
    () => qc.invalidateQueries({ queryKey: queryKeys.questionBank.all }),
    [qc],
  );
};

export const useDeleteOtherPlatformQuestionMutation = () => {
  const invalidate = useInvalidateOtherPlatformBank();
  return useMutation({
    mutationFn: (id: string) => questionBankService.deleteOtherPlatformQuestion(id),
    onSuccess: () => invalidate(),
  });
};

export const useToggleOtherPlatformQuestionStatusMutation = () => {
  const invalidate = useInvalidateOtherPlatformBank();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      questionBankService.toggleOtherPlatformQuestionStatus(id, isActive),
    onSuccess: () => invalidate(),
  });
};

export const useToggleQuestionStatusMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      questionBankService.toggleQuestionStatus(id, isActive),
    // Optimistic flip, preserving the page's original behavior: the row
    // switched instantly and only re-read from the server if the call failed.
    // Both cache shapes get the flip — the full list the picker reads, and
    // every paginated entry the admin page holds — so the row switches
    // instantly whichever surface is on screen.
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: queryKeys.questionBank.all });
      const previous = qc.getQueryData<Question[]>(queryKeys.questionBank.list());
      const previousPages = qc.getQueriesData<QuestionBankPage>({
        queryKey: queryKeys.questionBank.paged(),
      });
      qc.setQueryData<Question[]>(queryKeys.questionBank.list(), (old) =>
        (old || []).map((q) => (q._id === id ? { ...q, isActive } : q))
      );
      qc.setQueriesData<QuestionBankPage>(
        { queryKey: queryKeys.questionBank.paged() },
        (old) =>
          old
            ? {
                ...old,
                questions: old.questions.map((q) => (q._id === id ? { ...q, isActive } : q)),
                // The Active chip counts the whole bank, so it moves too.
                facets: {
                  ...old.facets,
                  stats: {
                    ...old.facets.stats,
                    active: old.facets.stats.active + (isActive ? 1 : -1),
                  },
                },
              }
            : old
      );
      return { previous, previousPages };
    },
    onError: (_err, _vars, context) => {
      // Roll the optimistic flip back, then re-sync from the server — the
      // original code called loadQuestions() on failure for the same reason.
      if (context?.previous) {
        qc.setQueryData(queryKeys.questionBank.list(), context.previous);
      }
      for (const [key, data] of context?.previousPages ?? []) {
        qc.setQueryData(key, data);
      }
      qc.invalidateQueries({ queryKey: queryKeys.questionBank.all });
    },
    // Only the paginated entries are re-read. Toggling never refetched the
    // full list before and it is the expensive one, but a status filter is
    // now applied server-side: without this, a row toggled out of an
    // "Active only" view would sit there wearing an Inactive pill instead of
    // dropping out of the list the way it always did.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.questionBank.paged() });
    },
  });
};
