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
    // External → Assessment / Event. Both live under the /lms/pages/external
    // route group rather than at folders named after their keys, so the two
    // screens sit together the way the rail groups them.
    externalassessment: "/lms/pages/external/assessment",
    externalevent: "/lms/pages/external/event",
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
    // External Assessment owns its whole subtree — the list, the create/edit
    // wizard, an assessment's Questions and Participants tabs. Declaring the
    // group here means adding a screen under it needs no gate change.
    externalassessment: ["/lms/pages/external/assessment"],
    externalevent: ["/lms/pages/external/event"],
};

/** Every route prefix a permission key opens (its page + any owned group). */
export const routePrefixesForPermissionKey = (key: string | undefined): string[] => {
    const canon = canonicalPermissionKey(key);
    return [routeForPermissionKey(canon), ...(PERMISSION_ROUTE_GROUPS[canon] ?? [])];
};

// ─── Section-mirrored screens ─────────────────────────────────────────────
//
// A handful of screens are mounted TWICE — once under /lms/pages/courses and
// once under /lms/pages/coursestructure — and the second mount is a
// passthrough that re-exports the first (see
// app/lms/pages/coursestructure/reviewSubmission/page.tsx). Which prefix you
// end up on is a matter of which section you walked in through, not of what
// you are allowed to do.
//
// The gate did not know that. `coursestructure` (what Course Management
// grants an admin and a POC) resolves to /lms/pages/coursestructure only, so
// an admin handed a /lms/pages/courses/reviewSubmission link — which is
// exactly what the Live Dashboard's "Check Answer" used to push — hit Access
// Restricted on a page their own rail had just sent them to. `courses` (what
// Trainer Courses grants) had the mirror-image hole on the coursestructure
// side.
//
// So each section key also opens the OTHER section's copy of these screens —
// and only these screens. It is not a widening: both routes render the same
// component, so this grants the second door to a room the key already opens,
// not a new room. The rest of each section's subtree stays gated as before.
//
// `sectionRoute.ts` re-exports the three constants below so client components
// keep importing them from there; they live here because this file is the one
// the route gate and the login redirects can import (no React, no icons).
export const SECTION_COURSES = "/lms/pages/courses";
export const SECTION_COURSE_STRUCTURE = "/lms/pages/coursestructure";

/** Screens that have a route under BOTH section prefixes. */
export const SHARED_SECTION_SCREENS = [
    "uploadcourseresources",
    "reviewSubmission",
    "manageUsers",
    "manageUsers/reports",
    "liveDashboard",
    // Grades detail is mounted under both prefixes as well, so the per-course
    // Grade drill can stay inside whichever section the trainer arrived from.
    // The route is `grades/[id]`; sectionHref concatenates the id.
    "grades",
] as const;

/** The shared screens' routes under one section base. */
export const sharedScreenRoutesUnder = (base: string): string[] =>
    SHARED_SECTION_SCREENS.map((screen) => `${base}/${screen}`);

/**
 * Routes a section permission key opens in the OTHER section.
 *
 * Keys are CANONICAL (`coursemanagement` and friends normalize to
 * `coursestructure` before the lookup).
 */
export const MIRRORED_SECTION_ROUTES: Record<string, string[]> = {
    coursestructure: sharedScreenRoutesUnder(SECTION_COURSES),
    courses: sharedScreenRoutesUnder(SECTION_COURSE_STRUCTURE),
};

/** Does `pathname` sit on a shared screen the given key mirrors into? */
export const isMirroredSectionRoute = (
    pathname: string,
    permissionKey: string | undefined,
): boolean =>
    (MIRRORED_SECTION_ROUTES[canonicalPermissionKey(permissionKey)] ?? []).some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
    );

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

// External → Assessment / Event. Same merged-section shape as Question Bank
// above: one expandable rail entry over two separately granted pages, with
// only the children the account actually holds rendered. The parent carries
// `externalassessment` as its key so an account holding just Event still gets
// the section (grantedSectionChildren decides the children, not the parent).
export const EXTERNAL_SECTION: MergedSection = {
    title: "External",
    iconName: "Globe",
    parentKey: "externalassessment",
    children: [
        { key: "externalassessment", title: "Assessment", iconName: "ClipboardList" },
        { key: "externalevent", title: "Event", iconName: "CalendarDays" },
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
