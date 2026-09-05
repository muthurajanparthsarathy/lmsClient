// serviceMappingService.ts — React Query based service for the standalone
// Service Mapping module (client ↔ service configuration). Mirrors
// clientManagementService.ts and talks to /service-mapping/*.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";
import { clientManagementKeys } from "@/app/lms/pages/clientmanagement/api/clientManagementService";

// ─── Types ──────────────────────────────────────────────────────────────────

// One hierarchy level of a mapping. Levels are data-driven — new levels can be
// added to the catalog without any type/schema change.
export interface HierarchyLevelConfig {
  level: string;
  enabled: boolean;
  mandatory: boolean;
}

// Master-data values configured for one enabled hierarchy level.
// `group` scopes the values to a parent-level value — e.g.
// { level: "Department", group: "BE", values: ["CSE", "ECE"] } means those
// departments belong to the BE degree specifically.
export interface MasterDataEntry {
  level: string;
  group?: string;
  values: string[];
}

// Client ref as populated by the server list endpoints. `businessModel` is
// populated so the mapping listing can render the B2B / B2I pill without a
// second fetch — matching the Client Management column.
export interface MappedClientRef {
  _id: string;
  clientCompany: string;
  status: "active" | "inactive";
  type?: string[];
  businessModel?: string;
}

// One batch of the mapping's course. PRT department mode ties each batch to a
// degree + departments (Batch 1 → B.E → [CSE]); other flows carry only names.
export interface BatchConfig {
  name: string;
  degree?: string;
  departments?: string[];
  // Stages a batch runs through — "Phase 1", "Phase 2", … Numbered in sequence,
  // so the position is the name.
  phases?: string[];
}

// One course covered by a mapping. Under Degree Program courses are entered per
// semester inside the hierarchy, so `path` records where: the semester's full
// path, e.g. "B.E ▸ CSE ▸ A ▸ 3". Flows that attach courses to the mapping as a
// whole leave it unset.
export interface MappedCourse {
  category: string;
  courseName: string;
  path?: string;
  // Batches are opt-in per course: `batchesEnabled` is the switch, `batches` the
  // names once it's on. Other flows keep their batches on the mapping
  // (batchConfigs) instead.
  batchesEnabled?: boolean;
  batches?: string[];
}

// Step 3 (Resources) of the Map Service wizard — the resource configuration a
// course created under this mapping starts from. Deliberately the same shape as
// a course's own `resourcesType` (Addcoursestructure/types.ts PedagogyResources)
// so applying it is a straight copy, not a translation that could drift.
export interface ResourceDefaultsFileResource {
  enabled?: boolean;
  maxSize?: number;
  aiChat?: boolean;
  aiSummary?: boolean;
  notes?: boolean;
  allowedFormats?: string[];
}

export interface ResourceDefaultsConfig {
  video?: ResourceDefaultsFileResource;
  ppt?: ResourceDefaultsFileResource;
  pdf?: ResourceDefaultsFileResource;
  image?: ResourceDefaultsFileResource;
  zip?: ResourceDefaultsFileResource;
  url?: { enabled?: boolean };
  aiChat?: { enabled?: boolean };
  aiSummary?: { enabled?: boolean };
  notes?: { enabled?: boolean };
  ai?: { enabled?: boolean };
  autoQuestionGenerate?: { enabled?: boolean };
}

export interface ResourceDefaults {
  iDo?: ResourceDefaultsConfig;
  weDo?: ResourceDefaultsConfig;
  youDo?: ResourceDefaultsConfig;
}

export interface ServiceMapping {
  _id: string;
  client: MappedClientRef | string;
  // CSR / COE only: the existing clients where the sponsored training runs.
  // Populated by the list/detail endpoints; references to Client Management,
  // never new orgs.
  partnerInstitutions?: (MappedClientRef | string)[];
  service: string;
  year?: string;
  serviceModels: string[];
  hierarchy: HierarchyLevelConfig[];
  masterData: MasterDataEntry[];
  // Course captured by the mapping — the Course Management record is
  // auto-created from these on save.
  courseName?: string;
  category?: string;
  courses?: MappedCourse[];
  // Step 3 of the wizard — see ResourceDefaults.
  resourceDefaults?: ResourceDefaults;
  prtMode?: "" | "general" | "department";
  batchConfigs?: BatchConfig[];
  courseId?: string;
  courseCode?: string;
  // Human-readable service id like "b2i-deg-be-1", generated + owned by the server
  // (never sent on create/update). Absent on legacy mappings created before it.
  serviceCode?: string;
  /**
   * How many of this mapping's courses already have a course-structure setup.
   * Present only on rows from the paginated list asked with `setup: true` —
   * Course Setup derived it in the browser while it held every mapping AND
   * every course-structure record, which is exactly what pagination takes
   * away. Server-side it is the same rule (see getSetupProgress).
   */
  setupProgress?: { configured: number; total: number };
  status: "active" | "inactive";
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Payload for create / update (no server-managed fields)
export interface ServiceMappingInput {
  client: string;
  // CSR / COE only: ids of the existing clients acting as partner institutions.
  partnerInstitutions?: string[];
  service: string;
  year?: string;
  serviceModels: string[];
  hierarchy: HierarchyLevelConfig[];
  masterData: MasterDataEntry[];
  courseName?: string;
  category?: string;
  // Every course the mapping covers. courseName/category above mirror the first
  // entry, so older readers keep working.
  courses?: MappedCourse[];
  // Step 3 of the wizard — see ResourceDefaults.
  resourceDefaults?: ResourceDefaults;
  prtMode?: "" | "general" | "department";
  batchConfigs?: BatchConfig[];
  courseId?: string;
  courseCode?: string;
  status?: "active" | "inactive";
}

interface ListResponse {
  success: boolean;
  count: number;
  data: ServiceMapping[];
}

interface ItemResponse {
  success: boolean;
  message?: string;
  data: ServiceMapping;
}

interface MessageResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const serviceMappingKeys = {
  all: ["service-mapping"] as const,
  lists: () => [...serviceMappingKeys.all, "list"] as const,
  // ONE page of the list, server-filtered and server-sorted. Filters, sort and
  // search scope are part of the identity because the SERVER decides which
  // rows come back. Same "service-mapping" root as lists(), so every existing
  // mutation invalidation still reaches it.
  page: (params: Record<string, unknown>) =>
    [...serviceMappingKeys.all, "list", "page", params] as const,
  detail: (id: string) => [...serviceMappingKeys.all, "detail", id] as const,
  byClient: (clientId: string) => [...serviceMappingKeys.all, "client", clientId] as const,
};

// ─── Paginated list ──────────────────────────────────────────────────────────
// The page used to download every mapping and slice the array in the browser
// (108,133 bytes / 39 rows). Passing `page` moves the search, the nine filters
// and the sort into Mongo — 27,499 bytes for a 10-row page. Callers that omit
// `page` are untouched.
//
// NOTE the page has TWO mapping lists with DIFFERENT search haystacks; pass
// searchScope: 'service' for the one that searches serviceCode. Both are
// matched server-side as a single joined string, so a query straddling two
// fields still works.

export interface MappingPageFilters {
  search?: string;
  /** Which list's haystack to search. 'service' = the workspace's second list
   *  (service + models + year + serviceCode + courseName); 'setup' = Course
   *  Setup's (client + serviceCode + service + year + models + the course names
   *  the mapping teaches). Omit for the workspace table's, which searches the
   *  client and partner names only — it groups by client and shows no service
   *  name, so a service match would surface an unexplainable row. */
  searchScope?: "service" | "setup";
  /** The MAPPING's own state — active / inactive. Not the setup state below. */
  status?: string;
  /** The derived Course Setup state: configured | in-progress | not-started |
   *  no-courses. Needs `setup: true`, since it is computed, not stored. */
  setupStatus?: string;
  year?: string;
  client?: string;
  service?: string;
  serviceModel?: string;
  /** The client's business model — B2B / B2I / B2C. Lives on the client, so
   *  the server matches it after the client join, not in the base match. */
  businessModel?: string;
  /** One course name; matches any mapping that teaches it. */
  course?: string;
  /** Created-at cutoff as epoch ms — mappings created before it are dropped. */
  createdAfter?: number;
  degree?: string;
  department?: string;
  section?: string;
  semester?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  /** Tie-break for descending sorts. 'reverse' matches a list that reverses
   *  its sorted array (equal values flip too); omitted, equal values keep
   *  newest-first in both directions. On a column where most rows tie — Year —
   *  this decides the whole page, not just the order within it. */
  sortTies?: "reverse";
}

export interface MappingFacets {
  years: string[];
  services: string[];
  serviceModels: string[];
  /** The CLIENT-level business models in play (B2B / B2I / B2C). */
  businessModels: string[];
  /** [id, name] pairs, already sorted by name. */
  clients: [string, string][];
  /** Every course name any mapping teaches, deduped case-insensitively.
   *  Present only with `setup: true`. */
  courses?: string[];
  hierarchy: {
    degrees: string[];
    departments: string[];
    sections: string[];
    semesters: string[];
  };
  counts: { total: number; active: number; clients: number; models: number };
  /** Per-year totals, ascending by year. The header sparklines turn these into
   *  CUMULATIVE series — the one thing that used to require the full list. */
  byYear: { year: string; total: number; active: number }[];
}

/** Course Setup's four header tiles. Each counts the WHOLE institution, not
 *  the filtered rows and not the page. Present only with `setup: true`. */
export interface MappingSetupStats {
  mappings: number;
  courses: number;
  configured: number;
  pending: number;
}

export interface MappingPageResponse {
  success: boolean;
  data: ServiceMapping[];
  total: number;
  page: number;
  totalPages: number;
  facets?: MappingFacets;
  stats?: MappingSetupStats;
}

/** `setup` asks the server for the course-setup progress on each row, the
 *  whole-set header stats and the course facet. It costs two extra reads, so
 *  it stays opt-in: only Course Setup shows any of it. */
export interface MappingPageOptions {
  setup?: boolean;
  export?: boolean;
  /** Ask for ONE row per client instead of one per mapping. The workspace's
   *  table view paginates on clients, so it has to be the server's unit of
   *  pagination too — a page of mappings is an unknown number of client rows. */
  groupBy?: "client";
}

/** One client's aggregated row for the workspace table. Deliberately carries
 *  counts rather than the client's mappings: the array is what made the old
 *  full fetch expensive, and only Manage Services needs it (getByClient). */
export interface ClientGroupRow {
  _id: string;
  client: { _id: string; clientCompany?: string; status?: string; type?: string } | null;
  services: number;
  active: number;
  years: (string | number)[];
  minYear?: string | number;
  lastUpdated?: string;
  createdAt?: string;
}

export interface MappingClientPageResponse {
  success: boolean;
  data: ClientGroupRow[];
  total: number;
  page: number;
  totalPages: number;
  facets?: MappingFacets;
}

/** Only send what is set — an empty value means "no filter", and omitting it
 *  keeps the query string, and so the cache key, stable. */
export const buildMappingPageParams = (
  f: MappingPageFilters,
  page: number,
  limit: number,
  opts: MappingPageOptions = {}
) => {
  const q: Record<string, string> = { page: String(page), limit: String(limit) };
  if (f.search?.trim()) q.search = f.search.trim();
  if (f.searchScope) q.searchScope = f.searchScope;
  (["status", "setupStatus", "year", "client", "service", "serviceModel", "course",
    "businessModel", "degree", "department", "section", "semester"] as const).forEach((k) => {
      const v = f[k];
      if (v) q[k] = String(v);
    });
  if (f.createdAfter) q.createdAfter = String(f.createdAfter);
  if (f.sortKey) {
    q.sortKey = f.sortKey;
    q.sortDir = f.sortDir || "asc";
    // Only meaningful with a sort, so it rides along with one — otherwise it
    // would sit in the cache key doing nothing.
    if (f.sortTies) q.sortTies = f.sortTies;
  }
  if (opts.setup) q.setup = "1";
  if (opts.export) q.export = "1";
  if (opts.groupBy) q.groupBy = opts.groupBy;
  return q;
};

// ─── Raw API functions ──────────────────────────────────────────────────────

export const serviceMappingApi = {
  getAll: () => api.get<ListResponse>("/service-mapping/getAll"),
  getPage: (params: Record<string, string>) =>
    api.get<MappingPageResponse>(
      `/service-mapping/getAll?${new URLSearchParams(params).toString()}`
    ),
  getById: (id: string) =>
    api.get<ItemResponse>(`/service-mapping/getById/${id}`),
  getByClient: (clientId: string) =>
    api.get<ListResponse>(`/service-mapping/getByClient/${clientId}`),
  create: (payload: ServiceMappingInput) =>
    api.post<ItemResponse>("/service-mapping/create", payload),
  update: (id: string, payload: Partial<ServiceMappingInput>) =>
    api.put<ItemResponse>(`/service-mapping/update/${id}`, payload),
  remove: (id: string) =>
    api.del<MessageResponse>(`/service-mapping/delete/${id}`),
  toggleStatus: (id: string) =>
    api.put<MessageResponse>(`/service-mapping/toggle-status/${id}`, {}),
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useServiceMappings(
  options?: Omit<
    UseQueryOptions<ServiceMapping[], Error, ServiceMapping[]>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: serviceMappingKeys.lists(),
    queryFn: async () => {
      const res = await serviceMappingApi.getAll();
      return res.data;
    },
    ...options,
  });
}

/** One page of mappings. `keepPreviousData` holds the current rows while the
 *  next page loads, so the table never blanks between requests. */
export function useServiceMappingsPage(
  filters: MappingPageFilters,
  page: number,
  limit: number,
  opts: MappingPageOptions = {},
  enabled: boolean = true
) {
  // `setup` changes the RESPONSE (progress per row, stats, the course facet),
  // so it is part of the entry's identity — without it in the key, a caller
  // that wants progress could be served a cached page that has none.
  return useQuery({
    queryKey: serviceMappingKeys.page({
      ...filters, page, limit,
      setup: Boolean(opts.setup),
      // `groupBy` changes the ROW SHAPE (clients, not mappings), so like
      // `setup` it belongs to the entry's identity. Without it a grouped
      // response and a per-mapping one share a key and whichever landed first
      // is served to both.
      groupBy: opts.groupBy || "",
    }),
    queryFn: async () => {
      const res = await serviceMappingApi.getPage(
        buildMappingPageParams(filters, page, limit, opts)
      );
      return res as unknown as MappingPageResponse;
    },
    enabled,
    placeholderData: keepPreviousData,
    // Revisiting the route within a minute is a cache hit with no
    // background refetch — the coursestructure list otherwise refetched
    // silently on every remount even when data was fresh, so isFetching
    // stayed true long enough to dim the table. 10 min gcTime keeps the
    // cache alive through a brief detour to a sub-page and back.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * One page of CLIENT rows for the workspace table — same filters and the same
 * server, grouped. Split from `useServiceMappingsPage` rather than overloaded
 * on it because the row type genuinely differs, and a caller that got the
 * wrong one would only find out at render.
 */
export function useClientGroupsPage(
  filters: MappingPageFilters,
  page: number,
  limit: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: serviceMappingKeys.page({
      ...filters, page, limit, setup: false, groupBy: "client",
    }),
    queryFn: async () => {
      const res = await serviceMappingApi.getPage(
        buildMappingPageParams(filters, page, limit, { groupBy: "client" })
      );
      return res as unknown as MappingClientPageResponse;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * Every row the current filters select, in one request, for CSV export.
 *
 * Deliberately NOT a hook and NOT cached: the export button is the only caller,
 * it wants the rows once, at click time, and caching a 5,000-row payload behind
 * the list would undo the point of paginating it. The list used to export
 * whatever was already in the browser — which, once the list is a page, would
 * silently export 25 rows and call it the list.
 */
export async function fetchMappingPageExport(
  filters: MappingPageFilters,
  opts: MappingPageOptions = {}
): Promise<MappingPageResponse> {
  const res = await serviceMappingApi.getPage(
    buildMappingPageParams(filters, 1, 5000, { ...opts, export: true })
  );
  return res as unknown as MappingPageResponse;
}

/**
 * One client's mappings, fetched when something actually needs them.
 *
 * The workspace table's rows are aggregates now, so the two places that need
 * the real list — Manage Services and the scoped bulk-delete picker — ask for
 * the one client they are open on instead of being handed a slice of a list the
 * page no longer holds. Bounded by one client's service count, not the
 * institution's.
 */
export function useMappingsByClient(clientId: string | null | undefined) {
  return useQuery({
    queryKey: serviceMappingKeys.byClient(String(clientId || "")),
    queryFn: async () => {
      const res = await serviceMappingApi.getByClient(String(clientId));
      return res.data;
    },
    enabled: Boolean(clientId),
  });
}

export function useServiceMapping(id: string | undefined) {
  return useQuery({
    queryKey: id ? serviceMappingKeys.detail(id) : serviceMappingKeys.all,
    queryFn: async () => {
      const res = await serviceMappingApi.getById(id as string);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

// Mutations also invalidate the client-management cache, because the server
// keeps the legacy embedded client.services array in sync with the mappings.
// Exported so bulk-delete callers can invalidate ONCE after their loop
// instead of paying two full list refetches per deleted mapping.
export function useInvalidateMappingCaches() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: serviceMappingKeys.all });
    queryClient.invalidateQueries({ queryKey: clientManagementKeys.all });
  };
}

export function useCreateServiceMapping() {
  const invalidate = useInvalidateMappingCaches();
  return useMutation({
    mutationFn: (payload: ServiceMappingInput) => serviceMappingApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateServiceMapping() {
  const invalidate = useInvalidateMappingCaches();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ServiceMappingInput> }) =>
      serviceMappingApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteServiceMapping() {
  const invalidate = useInvalidateMappingCaches();
  return useMutation({
    mutationFn: (id: string) => serviceMappingApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useToggleServiceMappingStatus() {
  const invalidate = useInvalidateMappingCaches();
  return useMutation({
    mutationFn: (id: string) => serviceMappingApi.toggleStatus(id),
    onSuccess: invalidate,
  });
}
