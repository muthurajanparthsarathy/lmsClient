import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getToken } from "@/lib/session";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// How many users the institution has, and how they split by role.
//
// Feeds the count button on the User Management page and the breakdown modal
// behind it. Counted in Mongo (getUserAccessRoleCounts in
// server/controllers/userAuth.js) rather than by pulling the roster and
// grouping it here — the page shows numbers, so only numbers are fetched, and
// the response stays the same size at 179 users as at 100,000.
//
// Institution-wide on purpose: it is a directory summary, not a readout of the
// table's current filters, so the figure does not move while the operator
// types in the search box.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";
const TWO_MIN = 2 * 60 * 1000;

export interface UserRoleCount {
  /** Empty for users carrying no role at all. */
  roleId: string;
  name: string;
  count: number;
}

export interface UserRoleCounts {
  total: number;
  /** Biggest bucket first, as the server sorts it. */
  roles: UserRoleCount[];
}

export const useUserRoleCountsQuery = (institutionId: string | null) =>
  useQuery<UserRoleCounts>({
    queryKey: queryKeys.users.roleCounts(institutionId),
    queryFn: async () => {
      const token = getToken();
      if (!token || !institutionId) {
        throw new Error("Session ended — user counts unavailable");
      }
      const res = await axios.get(
        `${API_BASE_URL}/getAll/userAccess/${institutionId}`,
        { headers: { Authorization: `Bearer ${token}` }, params: { roleCounts: "1" } }
      );
      return {
        total: res.data?.total ?? 0,
        roles: (res.data?.roles ?? []) as UserRoleCount[],
      };
    },
    enabled: typeof window !== "undefined" && !!institutionId && !!getToken(),
    staleTime: TWO_MIN,
  });
