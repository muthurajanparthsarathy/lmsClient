// clientManagementService.ts — React Query based service for the standalone
// Client Management module. This is independent of the embedded course-structure
// client (apiServices/dynamicFields/client.ts) and talks to /client-management/*.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ClientType = "college" | "company";

// Business model the client is engaged under — defined on the client itself;
// Service Mapping derives each mapping's service from this. (CSR is NOT a
// business model — it's a service model under B2B.)
export type BusinessModel = "B2B" | "B2I" | "B2C";

export interface ContactPerson {
  name: string;
  email: string;
  phoneNumber: string;
  isPrimary: boolean;
  _id?: string;
}

// A department with its own sections and semester
// (ME → [A, B] · Sem 2 ; CIVIL → [A, B] · Sem 3)
export interface DepartmentSection {
  department: string;
  sections: string[];
  semesters?: string[];
  _id?: string;
}

// One degree block: a single degree + academic year, with multiple departments,
// each carrying its own sections and semester.
export interface DegreeProgramEntry {
  batch?: string;       // combined academic year, e.g. "2026–2029" (for display)
  startYear?: string;   // academic year start, e.g. "2026"
  endYear?: string;     // academic year end, auto-filled from the degree duration
  degree?: string;
  departments?: DepartmentSection[];
  _id?: string;
}

export interface ClientServiceEntry {
  service: string;
  year?: string;
  serviceModals: string[];
  // Batch name for the Degree Program mapping, e.g. "Graduation batch"
  batchName?: string;
  batches?: string[];
  // Degree Program modal: degree blocks (degree + academic year + departments)
  degreePrograms?: DegreeProgramEntry[];
  _id?: string;
}

export interface Client {
  _id: string;
  clientCompany: string;
  description?: string;
  clientAddress?: string;
  clientLogo?: string;
  status: "active" | "inactive";
  type: ClientType[];
  // Empty string on legacy clients created before the field existed
  businessModel?: BusinessModel | "";
  services: ClientServiceEntry[];
  contactPersons: ContactPerson[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Payload for create / update (no server-managed fields).
export interface ClientInput {
  clientCompany: string;
  description?: string;
  clientAddress?: string;
  clientLogo?: string;
  status?: "active" | "inactive";
  type: ClientType[];
  businessModel: BusinessModel;
  // Managed separately via the per-client "Add service" panel
  services?: ClientServiceEntry[];
  contactPersons: ContactPerson[];
}

interface ListResponse {
  success: boolean;
  count: number;
  data: Client[];
}

interface ItemResponse {
  success: boolean;
  message?: string;
  data: Client;
}

interface MessageResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const clientManagementKeys = {
  all: ["client-management"] as const,
  lists: () => [...clientManagementKeys.all, "list"] as const,
  // ONE page of the list, server-filtered and server-sorted. Filters and sort
  // are part of the identity because the SERVER decides which rows come back.
  // Same "client-management" root as lists(), so every existing mutation
  // invalidation still reaches it.
  page: (params: Record<string, unknown>) =>
    [...clientManagementKeys.all, "list", "page", params] as const,
  detail: (id: string) => [...clientManagementKeys.all, "detail", id] as const,
};

// Client mutations must also refresh the mappings list — mapping rows display
// populated client fields (clientCompany, businessModel), so a rename or
// business-model change leaves those rows stale until a mapping mutation
// fires (potentially forever). Keeps the "always fresh across tabs" contract
// mappings hold in the other direction (see useInvalidateMappingCaches in
// serviceMappingService.ts).
const SERVICE_MAPPING_ROOT = ["service-mapping"] as const;

// ─── Raw API functions ──────────────────────────────────────────────────────

export const clientManagementApi = {
  getAll: () => api.get<ListResponse>("/client-management/getAll"),
  getPage: (params: Record<string, string>, signal?: AbortSignal) =>
    api.get<ClientPageResponse>(
      `/client-management/getAll?${new URLSearchParams(params).toString()}`,
      { signal }
    ),
  getById: (id: string) =>
    api.get<ItemResponse>(`/client-management/getById/${id}`),
  create: (payload: ClientInput) =>
    api.post<ItemResponse>("/client-management/create", payload),
  update: (id: string, payload: Partial<ClientInput>) =>
    api.put<ItemResponse>(`/client-management/update/${id}`, payload),
  remove: (id: string) =>
    api.del<MessageResponse>(`/client-management/delete/${id}`),
  toggleStatus: (id: string) =>
    api.put<MessageResponse>(`/client-management/toggle-status/${id}`, {}),
  // Upload a client logo. Returns the absolute URL the server saved the
  // file under; the caller stores it on `clientLogo` in the create/update
  // payload. Called separately from the record write so the ADD form —
  // which doesn't have a client id yet — can still upload.
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    return api.postForm<{ success: boolean; message?: string; data: { url: string } }>(
      "/client-management/upload-logo",
      fd
    );
  },
};

// ─── Paginated list ──────────────────────────────────────────────────────────
// The page used to download every client and slice the array in the browser.
// Passing `page` moves the search, the four filters and the sort into Mongo,
// so one page crosses the wire. Callers that omit `page` are untouched.

export interface ClientPageFilters {
  search?: string;
  status?: string;
  businessModel?: string;
  /** An explicit pick from the toolbar's client filter. Absent or empty means
   *  every client — the same thing the multi-select means by an empty box. */
  clients?: string[];
  type?: string;
  /** Date-range cutoff as epoch ms — computed in the browser, because the page
   *  derived it from local time ("this year" is a local-calendar boundary). */
  since?: number;
  /** Exclusive upper date boundary, in epoch milliseconds. */
  until?: number;
  createdRanges?: { since: number; until: number }[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
}

export interface ClientPageResponse {
  success: boolean;
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: {
    businessModels: string[];
    /** [id, name] pairs, sorted by name, over every client the reader may see —
     *  NOT narrowed by the current filters, or picking one client would empty
     *  the dropdown that lets you pick another. */
    clients?: [string, string][];
    earliestCreatedAt?: string;
    counts?: { total: number; b2b: number; b2i: number; active: number; inactive: number; models: number };
  };
}

/** Only send what is set — an empty value means "no filter", and omitting it
 *  keeps the query string, and so the cache key, stable. */
export const buildClientPageParams = (
  f: ClientPageFilters,
  page: number,
  limit: number,
  isExport = false
) => {
  const q: Record<string, string> = { page: String(page), limit: String(limit) };
  if (f.search?.trim()) q.search = f.search.trim();
  if (f.status) q.status = f.status;
  if (f.businessModel) q.businessModel = f.businessModel;
  if (f.clients?.length) q.clients = JSON.stringify(f.clients);
  if (f.type) q.type = f.type;
  if (f.since) q.since = String(f.since);
  if (f.until) q.until = String(f.until);
  if (f.createdRanges?.length) q.createdRanges = JSON.stringify(f.createdRanges);
  if (f.sortKey) {
    q.sortKey = f.sortKey;
    q.sortDir = f.sortDir || "asc";
  }
  if (isExport) q.export = "1";
  return q;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useClients(
  options?: Omit<
    UseQueryOptions<Client[], Error, Client[]>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: clientManagementKeys.lists(),
    queryFn: async () => {
      const res = await clientManagementApi.getAll();
      return res.data;
    },
    ...options,
  });
}

/** One page of clients. `keepPreviousData` holds the current rows while the
 *  next page loads, so the table never blanks between requests. */
export function useClientsPage(filters: ClientPageFilters, page: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: clientManagementKeys.page({ ...filters, page, limit }),
    queryFn: ({ signal }) => clientManagementApi.getPage(
      { ...buildClientPageParams(filters, page, limit), facets: "models" }, signal
    ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}

/** Every row matching the current filters, for the CSV export — which covers
 *  the whole selection, not just the visible page. Not a cached query: it
 *  answers a click, and caching a full dump would undo the pagination. */
export async function fetchClientsForExport(filters: ClientPageFilters, signal?: AbortSignal): Promise<Client[]> {
  const CHUNK = 5000;
  const rows: Client[] = [];
  let page = 1;
  let total = Infinity;
  while (rows.length < total && page <= 200) {
    const res = (await clientManagementApi.getPage(
      buildClientPageParams(filters, page, CHUNK, true), signal
    )) as unknown as ClientPageResponse;
    const batch = res.data || [];
    total = typeof res.total === "number" ? res.total : batch.length;
    rows.push(...batch);
    if (!batch.length || batch.length < CHUNK) break;
    page += 1;
  }
  if (rows.length < total) throw new Error("Could not load all matching clients. Please narrow your filters and retry.");
  return rows;
}

/** Just `{_id, clientCompany}` for every client — the Add/Edit form's inline
 *  duplicate-name check, which cannot be answered from a single page. Loaded
 *  only while that form is open, so the list page never pays for it. */
export function useClientNames(enabled: boolean) {
  return useQuery({
    queryKey: [...clientManagementKeys.all, "names"] as const,
    queryFn: async () => {
      const res = await api.get<ListResponse>("/client-management/getAll?names=1");
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: id ? clientManagementKeys.detail(id) : clientManagementKeys.all,
    queryFn: async () => {
      const res = await clientManagementApi.getById(id as string);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClientInput) => clientManagementApi.create(payload),
    retry: false,
    onSuccess: (response) => {
      queryClient.setQueryData(clientManagementKeys.detail(response.data._id), response.data);
      queryClient.invalidateQueries({ queryKey: clientManagementKeys.all });
      queryClient.invalidateQueries({ queryKey: SERVICE_MAPPING_ROOT });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ClientInput> }) =>
      clientManagementApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientManagementKeys.all });
      queryClient.invalidateQueries({ queryKey: SERVICE_MAPPING_ROOT });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientManagementApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientManagementKeys.all });
      queryClient.invalidateQueries({ queryKey: SERVICE_MAPPING_ROOT });
    },
  });
}

export function useToggleClientStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientManagementApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientManagementKeys.all });
      queryClient.invalidateQueries({ queryKey: SERVICE_MAPPING_ROOT });
    },
  });
}
