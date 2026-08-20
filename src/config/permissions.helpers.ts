// Helpers for consuming the permission tree.
//
// The tree is a nested UI shape but storage stays flat: one entry per page
// with the granted leaf-function labels inside `permissionFunctionality[]`.
// These helpers walk the tree to answer the questions the modal, the hook,
// and the sidebar all need — which page a checkbox belongs to, which
// functionalities should be pre-checked when a page is enabled, and whether
// a stored label (possibly a legacy name) matches a tree function.

import { PERMISSION_TREE, PermissionCategory, PermissionNode } from "./permissions.tree";

// ─── Traversal ────────────────────────────────────────────────────────────

export function walkTree(
  visit: (node: PermissionNode, parents: PermissionNode[]) => void,
  nodes: PermissionNode[] = PERMISSION_TREE,
  parents: PermissionNode[] = [],
): void {
  for (const n of nodes) {
    visit(n, parents);
    if (n.children?.length) walkTree(visit, n.children, [...parents, n]);
  }
}

// ─── Category resolution ──────────────────────────────────────────────────

// Each root container carries a category (Admin / Trainer / Student). Nested
// nodes inherit from their nearest ancestor with a `categories` field or —
// by convention — from the root container's id.
const ROOT_CATEGORY: Record<string, PermissionCategory> = {
  admin: "admin",
  trainer: "staff",
  student: "student",
};

export function categoryOf(parents: PermissionNode[]): PermissionCategory | undefined {
  for (let i = parents.length - 1; i >= 0; i--) {
    const c = parents[i].categories?.[0];
    if (c) return c;
    const byId = ROOT_CATEGORY[parents[i].id];
    if (byId) return byId;
  }
  return undefined;
}

// ─── Flat page list ───────────────────────────────────────────────────────

export interface FlatPage {
  id: string;
  key?: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  category?: PermissionCategory;
  aliases: string[];
  /** Leaf function children only — nested containers are skipped. */
  functions: PermissionNode[];
  /** The container ids from the root down, excluding the page itself. */
  breadcrumb: string[];
}

let flatCache: FlatPage[] | null = null;

export function getFlatPages(): FlatPage[] {
  if (flatCache) return flatCache;
  const out: FlatPage[] = [];
  walkTree((node, parents) => {
    if (node.kind !== "page") return;
    const functions = (node.children ?? []).filter((c) => c.kind === "function");
    out.push({
      id: node.id,
      key: node.key,
      name: node.name,
      icon: node.icon,
      color: node.color,
      description: node.description,
      category: categoryOf([...parents, node]),
      aliases: node.aliases ?? [],
      functions,
      breadcrumb: parents.map((p) => p.id),
    });
  });
  flatCache = out;
  return out;
}

export function findPage(pageId: string): FlatPage | undefined {
  return getFlatPages().find(
    (p) => p.id === pageId || p.aliases.includes(pageId),
  );
}

export function findFunction(
  pageId: string,
  fnIdOrLabel: string,
): PermissionNode | undefined {
  const page = findPage(pageId);
  if (!page) return undefined;
  const norm = fnIdOrLabel.trim().toLowerCase();
  return page.functions.find(
    (f) =>
      f.id.trim().toLowerCase() === norm ||
      (f.aliases ?? []).some((a) => a.trim().toLowerCase() === norm),
  );
}

// Given a stored function label (possibly legacy), return the tree function
// node under `pageId` that owns it — or undefined when nothing matches. Used
// by the hook so `can("admin-clientmanagement", "Deactivate")` still resolves
// when the DB row was saved as "Toggle Client Status".
export function resolveStoredFunction(
  pageId: string,
  storedLabel: string,
): PermissionNode | undefined {
  return findFunction(pageId, storedLabel);
}

// True when the stored list contains an entry matching `fnIdOrLabel` OR any
// of its aliases. Case-insensitive, trims whitespace.
export function storedListMatches(
  pageId: string,
  fnIdOrLabel: string,
  storedList: string[] | undefined,
): boolean {
  if (!storedList?.length) return false;
  const node = findFunction(pageId, fnIdOrLabel);
  const candidates = new Set(
    [
      fnIdOrLabel,
      node?.id,
      ...(node?.aliases ?? []),
    ]
      .filter(Boolean)
      .map((s) => (s as string).trim().toLowerCase()),
  );
  return storedList.some((s) => candidates.has(s.trim().toLowerCase()));
}

// ─── Default selection ────────────────────────────────────────────────────

// The labels the modal should auto-check when the parent page is enabled.
export function defaultFunctionIds(pageId: string): string[] {
  const page = findPage(pageId);
  if (!page) return [];
  return page.functions.filter((f) => f.defaultSelected).map((f) => f.id);
}

// Baseline selection for a brand-new user (Add User → Configure Permissions)
// when we don't yet know the specific role — falls back to every PAGE marked
// `defaultSelected: true` in the tree, scoped to `category` if supplied. When
// the role IS known, prefer `defaultSelectionForRole(roleName)` below.
export function defaultSelectionForNewUser(
  category?: PermissionCategory,
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const p of getFlatPages()) {
    if (category && p.category !== category) continue;
    const isDefault = pageIsDefault(p.id);
    if (!isDefault) continue;
    out[p.id] = new Set(p.functions.filter((f) => f.defaultSelected).map((f) => f.id));
  }
  return out;
}

// Lookup helper: is this page marked `defaultSelected` in the tree?
function pageIsDefault(pageId: string): boolean {
  let hit = false;
  walkTree((n) => {
    if (n.kind === "page" && n.id === pageId && n.defaultSelected) hit = true;
  });
  return hit;
}

// ─── Role-based defaults ──────────────────────────────────────────────────
//
// When Add User is submitted, the newly-created account is auto-granted a
// minimal permission set matching what its role would need to sign in and be
// productive. The admin then extends this via Assign Permission.

export type RoleClassification = "admin" | "poc" | "trainer" | "student";

// Free-form role labels (renameRole / originalRole / roleValue) from the DB
// resolve to one of four buckets. "Everything else" (LMS admin, super admin,
// HR, manager, coordinator, program coordinator, …) falls into `admin`, so a
// newly-added coordinator gets the same admin baseline as an admin does.
//
// POC is matched EXACTLY (after stripping separators), never by substring —
// same rule as `isPocRoleValue` in lib/session.ts. A role literally named
// "POC Manager" is not this role and must not inherit the POC baseline.
export function classifyRole(roleName: string | undefined): RoleClassification {
  const r = (roleName || "").toLowerCase();
  const exact = r.trim().replace(/[\s\-_]/g, "");
  if (exact === "poc" || exact === "pointofcontact") return "poc";
  if (r.includes("student")) return "student";
  if (r.includes("trainer")) return "trainer";
  return "admin";
}

// The page ids we pre-grant per role. Keep in sync with the user's spec:
//   - admin / program coordinator → Admin Dashboard + Profile
//   - POC                         → POC Dashboard + Profile. NOT the Admin
//                                   Dashboard: a POC's rail is derived from
//                                   exactly these grants now, and seeding
//                                   `admindashboard` is what used to put a POC
//                                   on a page its own gate refuses. Everything
//                                   else (Course Management, Attendance,
//                                   Business Management, …) is granted
//                                   deliberately in Assign Permission.
//   - trainer                     → Staff Dashboard + Courses + Profile
//                                   (Log Activity is opt-in — admin must
//                                   grant it explicitly)
//   - student                     → Student Dashboard + Courses + Profile
const ROLE_DEFAULT_PAGE_IDS: Record<RoleClassification, string[]> = {
  admin: ["admin-dashboard", "admin-profile"],
  poc: ["admin-poc-dashboard", "admin-profile"],
  trainer: ["staff-dashboard", "staff-courses", "staff-profile"],
  student: ["student-dashboard", "student-courses", "student-profile"],
};

export function defaultSelectionForRole(
  roleName: string | undefined,
): Record<string, Set<string>> {
  const cls = classifyRole(roleName);
  const out: Record<string, Set<string>> = {};
  for (const pageId of ROLE_DEFAULT_PAGE_IDS[cls]) {
    const page = findPage(pageId);
    if (!page) continue;
    // Include each page's own default-selected functions (e.g. Student
    // Dashboard's function defaults, if any).
    out[page.id] = new Set(
      page.functions.filter((f) => f.defaultSelected).map((f) => f.id),
    );
  }
  return out;
}

// Emit the storage shape directly for a role's baseline — ready to PUT to
// /user-permission/update/{userId} right after creation.
export function defaultPermissionsForRole(
  roleName: string | undefined,
): Array<{
  id: string;
  permissionName: string;
  permissionKey: string;
  permissionFunctionality: string[];
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  order: number;
}> {
  const selection = defaultSelectionForRole(roleName);
  const out: Array<any> = [];
  let order = 0;
  for (const pageId of Object.keys(selection)) {
    const page = findPage(pageId);
    if (!page) continue;
    out.push({
      id: page.id,
      permissionName: page.name,
      permissionKey: page.key || page.id,
      permissionFunctionality: Array.from(selection[pageId]),
      icon: page.icon || "Shield",
      color: page.color || "slate",
      description: page.description || "",
      isActive: true,
      order: order++,
    });
  }
  return out;
}

// ─── Auto-derived PERMISSION_IDS ──────────────────────────────────────────

// A `Record<UPPER_SNAKE, id>` derived from the tree. Consumers import from
// `@/components/permissions` (which re-exports this) as `PERMISSION_IDS`.
export function buildPermissionIds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of getFlatPages()) {
    const key = p.id
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    out[key] = p.id;
  }
  return out;
}

export const PERMISSION_IDS: Record<string, string> = buildPermissionIds();
