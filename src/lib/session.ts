// Canonical session accessor.
//
// Single source of truth for reading/writing the `smartcliff_*` values the app
// persists in localStorage. Features should import from here instead of touching
// localStorage directly, so the storage mechanism (token in localStorage, no
// cookies) lives in exactly one place.
//
// Behavior is intentionally identical to the pre-existing ad-hoc reads:
//   - `getToken` returns the raw token string (SSR-safe: null on the server).
//   - `clearToken` removes ONLY the token (matches authStore.clearToken and the
//     per-service axios 401 handlers).
//   - `clearSession` removes the full auth key set (matches the historical list
//     in queryClient.clearAuthAndRedirect) — used on logout / 401-redirect.

const isBrowser = (): boolean => typeof window !== "undefined";

// Every known session key, named. Add new keys here rather than inline strings.
export const SESSION_KEYS = {
  token: "smartcliff_token",
  user: "smartcliff_user",
  userData: "smartcliff_userData",
  userId: "smartcliff_userId",
  userName: "smartcliff_userName",
  userEmail: "smartcliff_user_email",
  userRole: "smartcliff_userRole",
  role: "smartcliff_role",
  roleId: "smartcliff_roleId",
  roleValue: "smartcliff_roleValue",
  roleSwitch: "smartcliff_roleSwitch",
  originalRole: "smartcliff_originalRole",
  renameRole: "smartcliff_renameRole",
  institution: "smartcliff_institution",
  institutionName: "smartcliff_institutionname",
  basedOn: "smartcliff_basedOn",
  permissions: "smartcliff_permissions",
  firstPermissionKey: "smartcliff_firstPermissionKey",
  isDummyStudent: "smartcliff_isDummyStudent",
} as const;

// Keys cleared on full logout / 401-redirect. This list matches, exactly, the
// historical array in queryClient.clearAuthAndRedirect — do not expand it
// without confirming the behavior change (some cache keys are intentionally
// left in place today).
export const AUTH_STORAGE_KEYS: readonly string[] = [
  SESSION_KEYS.token,
  SESSION_KEYS.institution,
  SESSION_KEYS.institutionName,
  SESSION_KEYS.basedOn,
  SESSION_KEYS.userId,
  SESSION_KEYS.userData,
  SESSION_KEYS.role,
  SESSION_KEYS.roleId,
  SESSION_KEYS.roleValue,
  SESSION_KEYS.originalRole,
  SESSION_KEYS.renameRole,
  SESSION_KEYS.firstPermissionKey,
  SESSION_KEYS.permissions,
];

// ─── Token ────────────────────────────────────────────────────────────────
export const getToken = (): string | null =>
  isBrowser() ? localStorage.getItem(SESSION_KEYS.token) : null;

export const setToken = (token: string): void => {
  if (isBrowser()) localStorage.setItem(SESSION_KEYS.token, token);
};

// Token-only removal (parity with authStore.clearToken + axios 401 handlers).
export const clearToken = (): void => {
  if (isBrowser()) localStorage.removeItem(SESSION_KEYS.token);
};

// Full auth clear (parity with queryClient.clearAuthAndRedirect).
export const clearSession = (): void => {
  if (!isBrowser()) return;
  AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
};

/**
 * Sign-out wipe: empties localStorage AND sessionStorage completely.
 *
 * Deliberately broader than `clearSession`. Signing out has to leave nothing of
 * the previous user behind, and the app writes plenty outside the
 * `smartcliff_*` namespace — `lms_student_selected_*`, `mcq_question_form_draft`,
 * `qb:programming-workspace:v1`, `sa-sidebar-collapsed`, third-party analytics
 * keys. Every named-key list drifts as features add keys; clearing everything
 * cannot.
 *
 * Use this ONLY for an explicit sign-out. `clearSession` stays the right call
 * for a 401 redirect or a failed token verify, where a transient error must not
 * cost the user unrelated local state.
 */
export const clearAllStorage = (): void => {
  if (!isBrowser()) return;
  try {
    localStorage.clear();
  } catch {
    /* storage disabled or full — nothing further we can do */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* same */
  }
};

// ─── Generic readers ──────────────────────────────────────────────────────
export const getSessionItem = (key: string): string | null =>
  isBrowser() ? localStorage.getItem(key) : null;

export const getSessionJSON = <T>(key: string): T | null => {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

// ─── Common named getters (the most frequently read fields) ───────────────
export const getUserData = <T = unknown>(): T | null =>
  getSessionJSON<T>(SESSION_KEYS.userData);
export const getPermissions = <T = unknown>(): T | null =>
  getSessionJSON<T>(SESSION_KEYS.permissions);
export const getUserId = (): string | null => getSessionItem(SESSION_KEYS.userId);
export const getRole = (): string | null => getSessionItem(SESSION_KEYS.role);
export const getInstitution = (): string | null =>
  getSessionItem(SESSION_KEYS.institution);

// ─── Point of Contact ─────────────────────────────────────────────────────
//
// WHAT a POC can see is decided by its granted permissions, like every other
// role: the sidebar, the command palette and the route gate all derive from
// `smartcliff_permissions` (see app/lms/shared/ui/navItems.ts). The helpers
// below answer only WHO — "is this session a POC?" — which two things still
// need: the post-login landing page, and the fact that a POC's allowlist is
// evaluated strictly from its own grants instead of the blanket
// "any non-student" rules other roles fall through to.

const normalizeRole = (v: unknown): string =>
  String(v ?? "").trim().toLowerCase().replace(/[\s\-_]/g, "");

/**
 * Exact match, deliberately not `.includes("poc")`. Several pre-existing call
 * sites use a substring test, which would also match an unrelated role named
 * e.g. "POC Manager" and silently put it in the read-only console.
 */
export const isPocRoleValue = (v: unknown): boolean => {
  const n = normalizeRole(v);
  return n === "poc" || n === "pointofcontact";
};

/**
 * Is THIS session a Point of Contact? SSR-safe (false on the server).
 *
 * `roleValue` is canonical; `originalRole` and `renameRole` are also checked
 * because `renameRole` is free text an admin sets and some role documents
 * carry the value only there.
 */
export const isPocSession = (): boolean => {
  if (!isBrowser()) return false;
  return [SESSION_KEYS.roleValue, SESSION_KEYS.originalRole, SESSION_KEYS.renameRole]
    .map((k) => getSessionItem(k))
    .some(isPocRoleValue);
};

/**
 * The POC console's landing route — the page behind the `pocdashboard`
 * permission (Assign Permission ▸ Admin ▸ POC Dashboard). A POC must hold that
 * module to open it; the route map that pairs the two lives in
 * app/lms/shared/ui/navItems.ts as PERMISSION_ROUTES.
 */
export const POC_HOME = "/lms/pages/poc/dashboard";

/** Does this path belong to the POC console? */
export const isPocRoute = (href: string): boolean =>
  href.split("?")[0].startsWith("/lms/pages/poc");
