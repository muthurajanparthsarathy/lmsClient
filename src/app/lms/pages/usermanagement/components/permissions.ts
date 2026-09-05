import { ApiPermission } from "./types";
import type { StatusPillTone } from "../../../shared/ui";
import { getFlatPages, storedListMatches } from "@/app/lms/pages/usermanagement/config/permissions.helpers";

// Permission utility functions.
//
// Alias-aware: consults the tree so a stored functionality label like
// "Deactivate User" (new) still resolves a `hasPermission(perms, "usermanagement", "Toggle User Status")`
// (legacy call-site) — the local hasPermission callers were written against the
// pre-tree names, and their storage now contains the tree names after the
// modal rewrite. Delegating to storedListMatches makes both directions match.
export const hasPermission = (
  permissions: ApiPermission[],
  permissionKey: string,
  functionality?: string,
): boolean => {
  const permission = permissions.find((p) => p.permissionKey === permissionKey);
  if (!permission || !permission.isActive) return false;
  if (!functionality) return true;
  // Find every tree page whose key matches (there may be admin- and staff-
  // scoped versions of the same key). Ask each if its functionality-with-
  // aliases resolves the requested label against the storage list.
  const stored = permission.permissionFunctionality || [];
  const pageIds = getFlatPages()
    .filter((p) => p.key === permissionKey)
    .map((p) => p.id);
  if (pageIds.some((id) => storedListMatches(id, functionality, stored))) return true;
  // Fallback for pages not (yet) in the tree — direct label match, matching
  // the pre-tree behavior so nothing regresses.
  return stored.some((f) => f.trim().toLowerCase() === functionality.trim().toLowerCase());
};

export const getPermission = (permissions: ApiPermission[], permissionKey: string): ApiPermission | undefined => {
  return permissions.find(p => p.permissionKey === permissionKey && p.isActive);
};

// One role → StatusPill tone map shared by the table, grid and details modal,
// mirroring the old getRolePillClasses colour intent (Student stays green).
export function roleTone(roleName: string): StatusPillTone {
  const r = roleName.toLowerCase();
  if (r.includes("student")) return "success";
  if (r.includes("lms") || r.includes("admin")) return "brand";
  if (r.includes("manager")) return "info";
  if (r.includes("coordinator")) return "warn";
  if (r.includes("hr")) return "danger";
  return "neutral";
}
