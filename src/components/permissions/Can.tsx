"use client";

// Declarative permission gate.
//
//   <Can id="admin-usermanagement" fn="Add User">
//     <button>Add User</button>
//   </Can>
//
// - `id` is the full permission id (matches PermissionModal.PERMISSION_DATA[i].id).
// - `fn` optionally scopes to a functionality inside that permission.
// - `anyId` accepts multiple ids; passes if the user has any of them
//   (functionality is ignored on this branch — page-level access only).
// - `fallback` renders when the check fails; omit to render nothing.
//
// The gate reads from `usePermissions()`, which is fed by whatever the login /
// PermissionModal persisted under `smartcliff_permissions`.

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface CanProps {
  id?: string;
  fn?: string;
  anyId?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ id, fn, anyId, fallback = null, children }: CanProps) {
  const { can, canAny, isReady } = usePermissions();
  if (!isReady) return null;
  let allowed = false;
  if (id) allowed = can(id, fn);
  else if (anyId && anyId.length > 0) allowed = canAny(anyId);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export default Can;
