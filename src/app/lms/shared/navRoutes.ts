// Permission key → route. Pure strings, no React and no icon library.
//
// Split out of `shared/ui/navItems.ts` on purpose: the route gate
// (app/providers.tsx) and the two landing-page redirects (app/page.tsx,
// app/login/page.tsx) need this map, and all three sit above the LMS shell in
// the tree. navItems does `import * as LucideIcons` — pulling it into the root
// bundle would ship every lucide icon to /login. navItems re-exports
// everything here, so existing importers keep their import path.
//
// The rule this file encodes: a permission key is the ROUTE key, so a module's
// page is /lms/pages/<key> unless PERMISSION_ROUTES says otherwise. Sidebar,
// command palette and route gate all resolve through these functions, which is
// what stops the rail offering a link the gate refuses.

// Stored permission keys that mean the same module as a canonical key.
//
// The key is what the route is built from, so a grant carrying a variant
// spelling lands on a page that does not exist. Course Management is the case
// that bites: the module's ROUTE key is "coursestructure", but hand-made and
// pre-catalog grants spelled it after the module's NAME ("course_management"),
// which routed to a 404.
//
// Normalizing here rather than renaming the folder keeps every existing
// /lms/pages/coursestructure link — deep links, breadcrumbs, the Actions menu —
// working untouched.
const KEY_ALIASES: Record<string, string> = {
    coursemanagement: "coursestructure",
    course_management: "coursestructure",
    "course-management": "coursestructure",
};

/** The canonical permission key for a stored one. Case/separator insensitive. */
export const canonicalPermissionKey = (key: string | undefined): string => {
    const lower = (key || "").toLowerCase();
    return KEY_ALIASES[lower] ?? KEY_ALIASES[lower.replace(/[-_\s]/g, "")] ?? lower;
};

// Permissions whose real page does NOT live at /lms/pages/<key>.
//
// `feedback` opens the per-course feedback manager (it shows a pick-a-course
// state when opened without a courseId). `pocdashboard` is the POC console's
// landing page, which lives under the /lms/pages/poc route group rather than
// at a folder named after its key.
export const PERMISSION_ROUTES: Record<string, string> = {
    feedback: "/lms/pages/coursestructure/feedback",
    // There is no /lms/pages/reports landing page — the module IS the
    // performance report, which lives one level down.
    reports: "/lms/pages/reports/performance",
    pocdashboard: "/lms/pages/poc/dashboard",
    questionbanksexternal: "/lms/pages/questionbanks/external",
};

/** Where a permission key's page lives. Defaults to /lms/pages/<key>. */
export const routeForPermissionKey = (key: string | undefined): string => {
    const canon = canonicalPermissionKey(key);
    return PERMISSION_ROUTES[canon] || `/lms/pages/${canon}`;
};

// Route prefixes a module owns BEYOND its own landing page, for every role.
// The route gate reads this so a whole route group can belong to one module
// without listing each page in it.
export const PERMISSION_ROUTE_GROUPS: Record<string, string[]> = {
    // /lms/pages/poc/* is the POC console; the POC Dashboard module owns all
    // of it, including any page added there later.
    pocdashboard: ["/lms/pages/poc"],
    // Likewise the Report module owns /lms/pages/reports/*, so a second report
    // added there is covered by the same grant without touching the gate.
    reports: ["/lms/pages/reports"],
};

/** Every route prefix a permission key opens (its page + any owned group). */
export const routePrefixesForPermissionKey = (key: string | undefined): string[] => {
    const canon = canonicalPermissionKey(key);
    return [routeForPermissionKey(canon), ...(PERMISSION_ROUTE_GROUPS[canon] ?? [])];
};

// ─── Merged rail sections ─────────────────────────────────────────────────
//
// A section that renders as ONE expandable rail entry over several separately
// granted modules. The spec lives here, lucide-free and shell-agnostic, so the
// admin rail and the staff rail build the same submenu from the same keys,
// names and routes — each just wraps them in its own item shape. Both shells
// previously hardcoded the Question Bank submenu, in two places, with the
// children pinned on regardless of what was actually granted.
export interface MergedSectionChild {
    /** Canonical permission key that must be granted for this child to show. */
    key: string;
    title: string;
    /** Lucide icon name; resolved per shell by its own getIconByName. */
    iconName: string;
}

export interface MergedSection {
    title: string;
    iconName: string;
    /** The key the merged PARENT carries, for grouping and highlighting. */
    parentKey: string;
    children: MergedSectionChild[];
}

// Question Bank → Internal / External. Order matters: the parent link opens
// the first child the user actually holds, and Internal is what every existing
// bookmark and in-app link (Course Setup, exercise authoring, …) targets.
export const QUESTION_BANK_SECTION: MergedSection = {
    title: "Question Bank",
    iconName: "MessageCircleQuestion",
    parentKey: "questionbanks",
    children: [
        { key: "questionbanks", title: "Internal Questions", iconName: "Library" },
        { key: "questionbanksexternal", title: "External Questions", iconName: "Globe" },
    ],
};

/**
 * Which of a section's children this permission set actually grants.
 *
 * Returns them in spec order, each with its resolved route. An empty result
 * means the section should not appear in the rail at all.
 */
export const grantedSectionChildren = (
    section: MergedSection,
    permissionKeys: Array<string | undefined>,
): Array<MergedSectionChild & { href: string }> => {
    const held = new Set(permissionKeys.map(canonicalPermissionKey));
    return section.children
        .filter((c) => held.has(c.key))
        .map((c) => ({ ...c, href: routeForPermissionKey(c.key) }));
};

// ─── Sidebar labels ───────────────────────────────────────────────────────
//
// What a module is called IN THE RAIL, when that differs from its catalog
// name. The catalog names are written for the Assign Permission modal, where
// an admin is picking between scopes and needs them spelled out — "Staff
// Dashboard", "POC Dashboard", "Trainer Profile". In the rail you already know
// whose console you are in (the brand card names your role), so the qualifier
// is noise and the plain route name reads better.
//
// ONE map, read by BOTH shells — the admin rail (shared/ui/navItems.ts) and
// the staff rail (component/stafflayout/staff-sidebar.tsx). Each used to carry
// its own private copy, which is exactly how the two drifted apart before:
// the same permission showed under two different names depending on which page
// you happened to be on.
//
// Keys are CANONICAL permission keys. `coursestructure` is a route key only
// (/lms/pages/coursestructure); the module is Course Management everywhere a
// human reads it, so the override pins that name even on older grants that
// still carry the pre-rename "Manage" in storage.
export const SIDEBAR_TITLE_OVERRIDES: Record<string, string> = {
    coursestructure: "Course Management",
    courses: "Courses",
    profile: "Profile",
    notifications: "Notification",
    attendancemanagement: "Attendance Management",
    grades: "Grade",
    "log-activity": "Log Activity",
    // A console's own landing page is just "Dashboard" in its rail — the role
    // is already on screen above it. All of them keep their distinct CATALOG
    // names in the permission modal, where an admin does have to tell "Admin
    // Dashboard" from "POC Dashboard" and "Staff Dashboard".
    //
    // These overrides only apply when the rail carries ONE dashboard:
    // makeSidebarTitler below falls back to the full name as soon as an
    // account holds two, so an admin who also has the POC console still sees
    // them apart. (studentdashboard stays out — that rail reads "Student
    // Dashboard".)
    admindashboard: "Dashboard",
    pocdashboard: "Dashboard",
    dashboard: "Dashboard",
};

/** The rail label for a permission: its override, else its catalog name. */
export const sidebarTitleFor = (
    key: string | undefined,
    permissionName: string | undefined,
): string =>
    SIDEBAR_TITLE_OVERRIDES[canonicalPermissionKey(key)] || permissionName || "";

// Every module that is somebody's landing dashboard.
const DASHBOARD_KEYS = new Set([
    "admindashboard",
    "pocdashboard",
    "dashboard",        // Staff / trainer
    "studentdashboard",
    "lddashboard",
]);

/**
 * A labeller for ONE rail, aware of what else is on it.
 *
 * Shortening a dashboard to plain "Dashboard" only works while the rail has a
 * single dashboard on it — then it is obviously *yours*. Two of them and the
 * short name stops identifying anything: an admin granted the POC console
 * would read "Admin Dashboard" followed by a bare "Dashboard" and have no way
 * to tell where the second one goes. So when a rail carries more than one,
 * every dashboard falls back to its full catalog name and they stay
 * distinguishable. Non-dashboard entries are unaffected either way.
 */
export const makeSidebarTitler = (
    permissionKeys: Array<string | undefined>,
): ((key: string | undefined, permissionName: string | undefined) => string) => {
    const dashboards = permissionKeys.filter((k) =>
        DASHBOARD_KEYS.has(canonicalPermissionKey(k)),
    ).length;
    if (dashboards <= 1) return sidebarTitleFor;
    return (key, permissionName) =>
        DASHBOARD_KEYS.has(canonicalPermissionKey(key))
            ? permissionName || ""
            : sidebarTitleFor(key, permissionName);
};
