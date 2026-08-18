"use client";

// Central permission hook. Reads what login/PermissionModal wrote into
// localStorage under `smartcliff_permissions` and exposes matcher helpers used
// by every action button, menu item, and page-level guard.
//
// Two identifiers exist on every permission:
//   - id           full identifier like "admin-usermanagement" (per role scope)
//   - permissionKey shared route key like "usermanagement" (same across scopes)
// PermissionModal.tsx / BulkPermissionModal.tsx are the source of truth for
// both. The `can(id, fn?)` matcher checks the full id (strict); `canKey(key, fn?)`
// falls back to the shared key for pages that don't need role scoping.

import { useEffect, useState, useMemo, useCallback } from "react";
import { SESSION_KEYS } from "@/lib/session";
import { findPage, storedListMatches } from "@/config/permissions.helpers";

export interface StoredPermission {
  id?: string;
  permissionName?: string;
  permissionKey?: string;
  permissionFunctionality?: string[];
  icon?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
  _id?: string;
}

const PERMISSIONS_KEY = SESSION_KEYS.permissions;

const readPermissions = (): StoredPermission[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PERMISSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredPermission[]) : [];
  } catch {
    return [];
  }
};

const eq = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Resolve a stored permission entry for the given page id.
//
// Matches, in priority order:
//   1. stored.id equals the requested id (or any alias of the tree page)
//   2. stored.permissionKey equals the tree page's key
//   3. stored.permissionKey equals the requested id (some legacy rows carry
//      the id inside permissionKey and leave `id` unset)
//
// Rule (2) is what makes older stored rows work — the DB shape written by
// pre-tree flows carries `permissionKey: "dynamicfieldsettings"` and no `id`
// field, and without a key fallback nothing resolves.
const findById = (list: StoredPermission[], id: string) => {
  const page = findPage(id);
  const idCandidates = new Set(
    [id, page?.id, ...(page?.aliases ?? [])]
      .filter(Boolean)
      .map((s) => (s as string).trim().toLowerCase()),
  );
  const keyCandidates = new Set(
    [page?.key, id]
      .filter(Boolean)
      .map((s) => (s as string).trim().toLowerCase()),
  );
  return list.find((p) => {
    if (p.id && idCandidates.has(p.id.trim().toLowerCase())) return true;
    if (p.permissionKey && keyCandidates.has(p.permissionKey.trim().toLowerCase())) return true;
    return false;
  });
};

const findByKey = (list: StoredPermission[], key: string) =>
  list.find((p) => eq(p.permissionKey, key));

// hasFunctionality checks the stored `permissionFunctionality[]` against the
// requested function id, matching either the exact label or any of the tree
// node's aliases so a stored legacy label still counts.
const hasFunctionality = (
  p: StoredPermission | undefined,
  fn?: string,
  pageId?: string,
) => {
  if (!p || p.isActive === false) return false;
  if (!fn) return true;
  const list = p.permissionFunctionality || [];
  const idForLookup = pageId ?? p.id;
  if (idForLookup && storedListMatches(idForLookup, fn, list)) return true;
  // Fallback for pages that aren't (yet) in the tree — direct label match.
  return list.some((f) => eq(f, fn));
};

export interface UsePermissionsResult {
  permissions: StoredPermission[];
  isReady: boolean;
  can: (permissionId: string, functionality?: string) => boolean;
  canKey: (permissionKey: string, functionality?: string) => boolean;
  canAny: (permissionIds: string[]) => boolean;
  getById: (permissionId: string) => StoredPermission | undefined;
  getByKey: (permissionKey: string) => StoredPermission | undefined;
  refresh: () => void;
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<StoredPermission[]>([]);
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(() => {
    setPermissions(readPermissions());
    setIsReady(true);
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === PERMISSIONS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return useMemo<UsePermissionsResult>(
    () => ({
      permissions,
      isReady,
      can: (id, fn) => hasFunctionality(findById(permissions, id), fn, id),
      canKey: (key, fn) => hasFunctionality(findByKey(permissions, key), fn),
      canAny: (ids) => ids.some((id) => hasFunctionality(findById(permissions, id), undefined, id)),
      getById: (id) => findById(permissions, id),
      getByKey: (key) => findByKey(permissions, key),
      refresh,
    }),
    [permissions, isReady, refresh]
  );
}

// Non-hook helpers for places outside React (route guards, service init, tests).
export const permissionCheck = {
  can(permissionId: string, functionality?: string): boolean {
    return hasFunctionality(
      findById(readPermissions(), permissionId),
      functionality,
      permissionId,
    );
  },
  canKey(permissionKey: string, functionality?: string): boolean {
    return hasFunctionality(findByKey(readPermissions(), permissionKey), functionality);
  },
};
