import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getToken } from "@/lib/session";
import { fetchUsers, fetchUsersPage, type UsersPageParams } from "@/apiServices/userService";
import { fetchRoles } from "@/apiServices/rolesApi";
import type { Role, User } from "@/app/lms/pages/usermanagement/components/types";

// ─────────────────────────────────────────────────────────────────────────────
// User-management queries — ONE cache entry per resource.
//
// Before this module the users list lived under a 10-element query key that
// included every filter and the debounced search term, so each keystroke
// minted a new cache entry and re-ran the fetch; underneath it, userService
// kept its own 15-minute module cache plus a 2-minute setInterval poller that
// survived navigation forever. Both layers are gone: React Query is the only
// cache, filters are applied in useMemo over this one entry, and the poller
// is replaced by refetchInterval — same 2-minute freshness, but only while a
// consumer is actually mounted.
//
// NOTE for the persister: the "users" root is in NON_PERSISTED_KEYS
// (PII + multi-MB) — see queryPersister.ts before renaming keys.
// ─────────────────────────────────────────────────────────────────────────────

const TWO_MIN = 2 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

/** Server row → the page's User shape (moved verbatim from the old queryFn).
 *  Exported so the CSV export path maps its slim rows the same way. */
export const transformUser = (user: any): User => ({
  id: user._id || user.id,
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  gender: user.gender,
  email: user.email,
  phone: user.phone || "",
  role: user.role?.renameRole || (typeof user.role === "string" ? user.role : "Unknown Role"),
  roleId: user.role?._id || user.role,
  status: user.status || "active",
  lastLogin: user.lastLogin || "",
  degree: user.degree || "",
  department: user.department || "",
  semester: user.semester || "",
  section: user.section || "",
  year: user.year || "",
  batch: user.batch || "",
  phase: user.phase || "",
  serviceModel: user.serviceModel || "",
  studentType: user.studentType || "",
  clientId: user.clientId || "",
  clientName: user.clientName || "",
});

/**
 * The WHOLE roster in one entry.
 *
 * Still the right read for the consumers that genuinely need every user in
 * memory at once (EnrollmentTab's picker, the Profile stats, the bulk
 * permission picker). It is NOT the right read for the admin table — see
 * useUsersPageQuery below — and callers that only need it behind a modal
 * should pass `enabled` so the page doesn't pay for it on load.
 */
export const useUsersListQuery = (
  institutionId: string | null,
  basedOn: string | null,
  enabled = true
) =>
  useQuery<User[]>({
    queryKey: queryKeys.users.list(institutionId),
    queryFn: async () => {
      const token = getToken();
      // The token can vanish mid-session (logout in another tab) between
      // interval ticks. Throw — returning [] would cache an empty roster as
      // a SUCCESS and silently swap the table to "No users yet"; throwing
      // keeps the last good data on screen instead.
      if (!token || !institutionId) {
        throw new Error("Session ended — users list unavailable");
      }
      const result = await fetchUsers(institutionId, token, basedOn || "");
      // Newest first so recently added users land on page 1. Prefer createdAt;
      // fall back to the Mongo _id (which encodes creation time).
      const rawUsers = [...(result.users || [])].sort((a: any, b: any) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return String(b._id || "").localeCompare(String(a._id || ""));
      });
      return rawUsers.map(transformUser);
    },
    enabled:
      enabled && typeof window !== "undefined" && !!institutionId && !!getToken(),
    staleTime: TWO_MIN,
    // The roster changes from outside the page (auto-enrolment, other admins).
    // This replaces the old service-level 2-minute background poller with the
    // same cadence, scoped to while the page is actually open.
    refetchInterval: TWO_MIN,
    gcTime: TEN_MIN,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Paginated directory — the shape the admin table uses.
//
// useUsersListQuery above still exists for the consumers that genuinely need
// the whole roster in memory (EnrollmentTab's picker, the Profile stats). The
// table itself must not: at 100,000 users the full read is a ~300 MB response
// and 100,000 rows of React state. This hook asks the server for one page and
// lets it do the filtering, the sorting and the counting.
// ─────────────────────────────────────────────────────────────────────────────

export type UsersPageResult = {
  users: User[];
  total: number;
  totalPages: number;
  /** Batch dropdown options — every batch in the institution, which is what
   *  the page showed when it held the whole roster. */
  batches: string[];
};

export const useUsersPageQuery = (
  institutionId: string | null,
  params: Omit<UsersPageParams, "page" | "limit"> & { page: number; limit: number },
) =>
  useQuery<UsersPageResult>({
    queryKey: queryKeys.users.page(institutionId, params as Record<string, unknown>),
    queryFn: async () => {
      const token = getToken();
      // Same reasoning as the full-list read: throwing keeps the last good
      // page on screen instead of caching an empty directory as a success.
      if (!token || !institutionId) {
        throw new Error("Session ended — users list unavailable");
      }
      const data = await fetchUsersPage(institutionId, token, params);
      return {
        users: (data.Users || []).map(transformUser),
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        batches: data.facets?.batches ?? [],
      };
    },
    enabled: typeof window !== "undefined" && !!institutionId && !!getToken(),
    // Hold the previous page's rows while the next one loads, so paging and
    // typing in the search box don't blank the table between responses.
    placeholderData: keepPreviousData,
    staleTime: TWO_MIN,
    // Unchanged cadence from the full-list read — the roster moves from
    // outside the page — but now it refreshes ONE page, not the directory.
    // React Query only polls the mounted key, so this is a single small
    // request every two minutes regardless of how many pages were visited.
    refetchInterval: TWO_MIN,
    gcTime: TEN_MIN,
  });

export const useRolesQuery = (institutionId: string | null) =>
  useQuery<Role[]>({
    queryKey: queryKeys.roles.list(institutionId),
    queryFn: async () => {
      const token = getToken();
      if (!token) return [];
      const result = await fetchRoles(token);
      return (result.roles || []) as Role[];
    },
    // institutionId is only a cache-identity input (the server scopes by
    // token), but it arrives one commit after mount from a localStorage
    // effect — without this gate the hook fires a wasted fetch under the
    // {institutionId: null} key on every boot and orphans that entry.
    enabled: typeof window !== "undefined" && !!getToken() && !!institutionId,
    // Roles change rarely; mutations in rolesApi callers should invalidate
    // queryKeys.roles.all.
    staleTime: TEN_MIN,
  });
