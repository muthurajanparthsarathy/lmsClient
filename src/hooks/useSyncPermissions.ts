"use client";

// Keep the current session's permissions in step with the server.
//
// `smartcliff_permissions` is populated at login and then never refreshed —
// so when another admin (or the account itself, in a different tab) updates
// the user's grants, the running session keeps rendering against the old
// snapshot until logout/login. This hook fixes that: on every LMS shell
// mount it re-reads the current user, writes the fresh permissions to
// localStorage, and nudges `usePermissions` to re-read.
//
// The user payload comes through the shared ["currentUser"] React Query
// entry (see src/queries/auth.ts) instead of a dedicated POST: results
// fresher than SYNC_MAX_AGE_MS are reused, and a concurrent boot-time fetch
// (AuthWrapper's permission refresh) is joined rather than duplicated. The
// shell layouts remount on every route change, so without this reuse window
// each navigation cost one verify-token round trip.
//
// The call is best-effort — failures are swallowed so a transient network
// issue never breaks the page.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser } from "@/queries/auth";
import { getToken, SESSION_KEYS } from "@/lib/session";

/** How stale a cached verify-token result may be and still satisfy a
 *  navigation's permission sync. This window delays BOTH directions —
 *  grants and revocations issued by another admin land within ~15s or on
 *  the next navigation, whichever is later (previously: every navigation
 *  refetched). Kept short because revocation is security-relevant; it still
 *  absorbs the boot burst (three concurrent consumers → one request) and
 *  rapid tab-hopping. */
const SYNC_MAX_AGE_MS = 15 * 1000;

export function useSyncPermissions(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCurrentUser(queryClient, SYNC_MAX_AGE_MS);
        if (cancelled) return;

        // verify-token returns the current user document. Different
        // deployments have shipped this under `user`, `data.user`, or the
        // root object; walk them in that priority order.
        const user = res?.user ?? res?.data?.user ?? res?.data ?? res;
        const perms = user?.permissions;
        if (!Array.isArray(perms)) return;

        const nextSerialized = JSON.stringify(perms);
        const current = window.localStorage.getItem(SESSION_KEYS.permissions);
        if (current === nextSerialized) return;

        window.localStorage.setItem(SESSION_KEYS.permissions, nextSerialized);
        // Also refresh the cached userData snapshot when present, so any
        // reader of that key (sidebar, nav, profile card) sees the change.
        try {
          const userData = window.localStorage.getItem(SESSION_KEYS.userData);
          if (userData) {
            const parsed = JSON.parse(userData);
            parsed.permissions = perms;
            window.localStorage.setItem(
              SESSION_KEYS.userData,
              JSON.stringify(parsed),
            );
          }
        } catch {
          /* userData was malformed — leave it alone */
        }

        // usePermissions listens for `storage` events, which normally only
        // fire on OTHER tabs. Dispatch one manually so this tab's hook
        // notices without waiting for the next mount.
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SESSION_KEYS.permissions,
            newValue: nextSerialized,
          }),
        );
      } catch {
        /* swallow — session may be logging out, or the network is offline */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
