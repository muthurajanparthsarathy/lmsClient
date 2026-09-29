// Person Name — React Query based service for the standalone
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

export type BusinessModel = "B2B" | "B2I" | "B2C";

export interface ContactPerson {
  name: string;
  email: string;
  phoneNumber: string;
  secondaryEmail?: string;
  secondaryPhoneNumber?: string;
  address?: string;
  isPrimary: boolean;
  contactType?: string;
  designation?: string;
  _id?: string;
}

export interface DepartmentSection {
  department: string;
  sections: string[];
  semesters?: string[];
  _id?: string;
}

export interface DegreeProgramEntry {
  batch?: string;
  startYear?: string;
  endYear?: string;
  degree?: string;
  departments?: DepartmentSection[];
  _id?: string;
}

export interface ClientServiceEntry {
  service: string;
  year?: string;
  serviceModals: string[];
  batchName?: string;
  batches?: string[];
  degreePrograms?: DegreeProgramEntry[];
  _id?: string;
}

export interface Client {
  _id: string;
  clientId?: string;
  clientCompany: string;
  clientPhone?: string;
  description?: string;
  website?: string;
  clientAddress?: string;
  clientLogo?: string;
  clientLogoPosition?: string;
  status: "active" | "inactive";
  type: ClientType[];
  businessModel?: BusinessModel | "";
  services: ClientServiceEntry[];
  contactPersons: ContactPerson[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClientInput {
  clientCompany: string;
  clientPhone?: string;
  createdYear?: string;
  description?: string;
  website?: string;
  clientAddress?: string;
  clientLogo?: string;
  clientLogoPosition?: string;
  status?: "active" | "inactive";
  type: ClientType[];
  businessModel: BusinessModel;
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
  page: (params: Record<string, unknown>) =>
    [...clientManagementKeys.all, "list", "page", params] as const,
  detail: (id: string) => [...clientManagementKeys.all, "detail", id] as const,
};

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

export interface ClientPageFilters {
  search?: string;
  status?: string;
  businessModel?: string | string[];
  clients?: string[];
  type?: string;
  since?: number;
  until?: number;
  createdRanges?: { since: number; until: number }[];
  /**
   * Extra-column filters from the "Show filter" panel, keyed by column id.
   * Shape: { city: ['Madurai'], state: ['TN'], website: ['acme.com'], … }
   * Empty arrays are dropped before serialisation so a cleared filter reads
   * as "no filter" — the same thing the multi-select means by an empty box.
   */
  columnFilters?: Record<string, string[]>;
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
    clients?: [string, string][];
    earliestCreatedAt?: string;
    counts?: { total: number; b2b: number; b2i: number; b2c: number; active: number; inactive: number; models: number };
  };
}

export const buildClientPageParams = (
  f: ClientPageFilters,
  page: number,
  limit: number,
  isExport = false
) => {
  const q: Record<string, string> = { page: String(page), limit: String(limit) };
  if (f.search?.trim()) q.search = f.search.trim();
  if (f.status) q.status = f.status;
  if (Array.isArray(f.businessModel)) {
    if (f.businessModel.length === 1) q.businessModel = f.businessModel[0];
    else if (f.businessModel.length > 1) q.businessModel = JSON.stringify(f.businessModel);
  } else if (f.businessModel) {
    q.businessModel = f.businessModel;
  }
  if (f.clients?.length) q.clients = JSON.stringify(f.clients);
  if (f.type) q.type = f.type;
  if (f.since) q.since = String(f.since);
  if (f.until) q.until = String(f.until);
  if (f.createdRanges?.length) q.createdRanges = JSON.stringify(f.createdRanges);
  // Column filters — one JSON blob. Only keys with at least one value are
  // kept; a fully empty object is omitted entirely so the query string (and
  // therefore the React Query cache key) stays identical to the unfiltered
  // request when the user has no extra filters on.
  if (f.columnFilters) {
    const clean: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(f.columnFilters)) {
      if (Array.isArray(v) && v.length > 0) clean[k] = v;
    }
    if (Object.keys(clean).length > 0) q.columnFilters = JSON.stringify(clean);
  }
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