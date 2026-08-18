import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getToken } from "@/lib/session";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Profile page stats.
//
// This used to fetch the WHOLE user roster — 583,744 bytes for 179 users, and
// roughly 311 MB at 100,000 — so the page could count it in the browser. The
// page renders no rows at all: it shows six numbers. They are now counted in
// Mongo and arrive as a 153-byte response.
//
// The server aggregation (getUserAccessStats in server/controllers/userAuth.js)
// is a port of the page's own derivation, verified against it over live data:
// identical on all six figures.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";
const TWO_MIN = 2 * 60 * 1000;

export interface ProfileUserStats {
  total: number;
  students: number;
  staff: number;
  admin: number;
  newUsers: number;
  activeUsers: number;
}

export const useProfileUserStatsQuery = (institutionId: string | null) => {
  // The "new users" window is 30 days back from now, computed HERE because the
  // page computed it from browser-local time. Sending the absolute instant
  // keeps the count identical whatever timezone the server runs in. Rounded to
  // the hour so the value is stable across renders and does not mint a new
  // cache entry on every tick.
  const since = Math.floor((Date.now() - 30 * 86400000) / 3600000) * 3600000;

  return useQuery<ProfileUserStats>({
    queryKey: queryKeys.users.profileStats(institutionId, since),
    queryFn: async () => {
      const token = getToken();
      if (!token || !institutionId) {
        throw new Error("Session ended — user stats unavailable");
      }
      const res = await axios.get(
        `${API_BASE_URL}/getAll/userAccess/${institutionId}`,
        { headers: { Authorization: `Bearer ${token}` }, params: { stats: "1", since } }
      );
      return res.data.stats as ProfileUserStats;
    },
    enabled: typeof window !== "undefined" && !!institutionId && !!getToken(),
    staleTime: TWO_MIN,
  });
};
