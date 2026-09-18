import { QueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getCurrentUser } from "@/apiServices/tokenVerify";
import { getToken } from "@/lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// One shared cache entry for the `POST /user/verify-token` payload.
//
// Before this module, four independent code paths hit that endpoint on boot
// (AuthWrapper's permission refresh, AuthWrapper's auth gate, the layout's
// useSyncPermissions, and the account menu's ["currentUser"] query) — five
// POSTs on a cold load, two more on every route change. Routing the non-gate
// consumers through this one query key lets React Query dedupe concurrent
// calls into a single request and serve the rest from cache.
//
// The AuthWrapper's per-navigation auth GATE (authStore.verifyToken) is
// deliberately NOT routed through here — it must stay a fresh check on every
// pathname change, and its semantics are security-relevant.
// ─────────────────────────────────────────────────────────────────────────────

/** Passive observer of the shared current-user entry (account menus etc.). */
export const useCurrentUserQuery = () =>
  useQuery({
    queryKey: queryKeys.auth.currentUser(),
    queryFn: getCurrentUser,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: typeof window !== "undefined" && !!getToken(),
  });

/**
 * Imperative fetch through the shared cache entry, for the effects that need
 * the payload rather than a subscription (permission sync, AuthWrapper's
 * refresh). `maxAgeMs` is how stale a cached result may be and still be
 * reused; 0 forces a network round-trip — but concurrent callers with any
 * maxAge still share the single in-flight request.
 */
export const fetchCurrentUser = (qc: QueryClient, maxAgeMs = 0) =>
  qc.fetchQuery({
    queryKey: queryKeys.auth.currentUser(),
    queryFn: getCurrentUser,
    staleTime: maxAgeMs,
    retry: 1,
  });
