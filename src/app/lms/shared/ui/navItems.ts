// Pure, shared navigation logic for the admin shell.
// Both the Sidebar and the CommandPalette derive their items from the SAME
// permission data in localStorage, so the derivation lives here exactly once.
// The bodies of getIconByName / isAdminRole / buildSidebarItems were moved
// verbatim from sidebar.tsx — do not fork them.

import {
    ShieldCheck,
    Home,
    UserCircle,
    Settings,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
    canonicalPermissionKey,
    routeForPermissionKey,
    makeSidebarTitler,
    grantedSectionChildren,
    QUESTION_BANK_SECTION,
} from "../navRoutes";
import { isPocRoleValue } from "@/lib/session";

// Define types for permissions
export interface UserPermission {
    _id: string;
    permissionName: string;
    permissionKey: string;
    permissionFunctionality: string[];
    icon: string;
    color: string;
    description: string;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface UserData {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    permissions: UserPermission[];
    role?: { originalRole?: string; renameRole?: string; roleValue?: string };
    // Other user fields...
}

export interface SidebarItem {
    title: string;
    href: string;
    // Moved verbatim from sidebar.tsx: lucide's namespace export mixes
    // components with helpers, so a stricter type would reject the lookup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
    iconName: string;
    color: string;
    hasChevron?: boolean;
    hasDropdown?: boolean;
    permissionKey?: string;
    children?: SidebarItem[];
}

// Local storage key for user data
export const USER_DATA_KEY = "smartcliff_userData";

// The admin / super admin rail's PREFERRED ORDER — not a filter.
//
// This was a whitelist, and any granted module missing from it was silently
// dropped: an account holding Approvals, Grades and Attendance Management saw
// twelve rail entries for fifteen stored grants, with nothing to explain the
// gap. The rail is now driven by the grants themselves — every active
// permission renders — and this list only decides WHERE the modules it names
// sit. Anything granted but unlisted follows them in its stored `order`.
//
// So hiding a module from someone's rail is done by revoking it in Assign
// Permission, which is where an admin would look for it, rather than by
// editing a constant in this file.
export const ADMIN_SIDEBAR_KEYS = [
    "admindashboard",       // Dashboard (labelled "Dashboard" on the rail —
                            //            see SIDEBAR_TITLE_OVERRIDES)
    "pocdashboard",         // POC Dashboard — only for an admin explicitly
                            //                 granted it; kept beside the other
                            //                 dashboard so the two group.
    "usermanagement",       // User Management
    "clientmanagement",     // ─┐ Business Management. The merger splices the
    "servicemapping",       // ─┘ group in at the FIRST of these two, so their
                            //    position here is the group's position.
    "coursestructure",      // Course Management — a standalone top-level entry
                            //                    (peer of Approvals / Report /
                            //                    Calendar, NOT nested under
                            //                    Business Management).
    "notifications",        // Notification
    "approvals",            // Approvals
    "attendancemanagement", // Attendance Management
    "grades",               // Grade
    "reports",              // Report — the standalone Performance Report. The
                            //          staff rails inject their own copy; here
                            //          it is a grant like any other.
    "calendar",             // Calendar
    "questionbanks",        // ─┐ Question Bank › Internal / External. Same
    "questionbanksexternal",// ─┘ splice-at-the-first rule as above.
    "dynamicfieldsettings", // ─┐ System Settings › Dynamic Settings / Audit
    "logs",                 // ─┘ Logs. Same rule again.
    "profile",              // Profile
];

// Permission key → route lives in ONE lucide-free module so the route gate and
// the landing-page redirects (which sit above the LMS shell) can import it
// without pulling this file's `import * as LucideIcons` into the root bundle.
// Re-exported here so every existing importer of navItems keeps working.
export {
    canonicalPermissionKey,
    routeForPermissionKey,
    routePrefixesForPermissionKey,
    sidebarTitleFor,
    makeSidebarTitler,
    grantedSectionChildren,
    QUESTION_BANK_SECTION,
    PERMISSION_ROUTES,
    PERMISSION_ROUTE_GROUPS,
    SIDEBAR_TITLE_OVERRIDES,
} from "../navRoutes";

export const isAdminRole = (userData: UserData | null): boolean => {
    const r = userData?.role;
    if (!r) return false;
    return [r.roleValue, r.originalRole, r.renameRole]
        .map(v => (v || "").toLowerCase().replace(/\s+/g, ""))
        .some(v => v === "admin" || v.includes("superadmin") || v.includes("superadministrator"));
};

// Get icon by name from lucide-icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getIconByName = (iconName: string): any => {
    if (!iconName) return ShieldCheck;

    if (LucideIcons[iconName as keyof typeof LucideIcons]) {
        return LucideIcons[iconName as keyof typeof LucideIcons];
    }

    const pascalCaseName = iconName
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');

    if (LucideIcons[pascalCaseName as keyof typeof LucideIcons]) {
        return LucideIcons[pascalCaseName as keyof typeof LucideIcons];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconMappings: Record<string, any> = {
        "user": LucideIcons.Users,
        "users": LucideIcons.Users,
        "user-circle": UserCircle,
        "usercircle": UserCircle,
        "book": LucideIcons.BookOpen,
        "book-open": LucideIcons.BookOpen,
        "bookopen": LucideIcons.BookOpen,
        "file": LucideIcons.FileText,
        "file-text": LucideIcons.FileText,
        "filetext": LucideIcons.FileText,
        "chart": LucideIcons.BarChart3,
        "bar-chart": LucideIcons.BarChart3,
        "barchart": LucideIcons.BarChart3,
        "bar-chart-3": LucideIcons.BarChart3,
        "barchart3": LucideIcons.BarChart3,
        "settings": Settings,
        "setting": Settings,
        "gear": Settings,
        "cog": Settings,
        "dashboard": Home,
        "home": Home,
        "graduation-cap": LucideIcons.GraduationCap,
        "graduationcap": LucideIcons.GraduationCap,
        "calendar": LucideIcons.Calendar,
        "message": LucideIcons.MessageSquare,
        "message-square": LucideIcons.MessageSquare,
        "messagesquare": LucideIcons.MessageSquare,
        "landmark": LucideIcons.Landmark,
        "sliders": LucideIcons.Sliders,
        "globe": LucideIcons.Globe,
        "wrench": LucideIcons.Wrench,
        "layout": LucideIcons.Layout,
        "database": LucideIcons.Database,
        "bell": LucideIcons.Bell,
        "help-circle": LucideIcons.HelpCircle,
        "helpcircle": LucideIcons.HelpCircle,
        "shield": ShieldCheck,
        "shield-check": ShieldCheck,
        "shieldcheck": ShieldCheck,
        "folder": LucideIcons.Folder,
    };

    const lowerIconName = iconName.toLowerCase();
    if (iconMappings[lowerIconName]) {
        return iconMappings[lowerIconName];
    }

    return ShieldCheck;
};

// Build sidebar items from user permissions
export const buildSidebarItems = (permissions: UserPermission[], adminOnly: boolean): SidebarItem[] => {
    const items: SidebarItem[] = [];
    let sortedPermissions = [...permissions].sort((a, b) => a.order - b.order);

    if (adminOnly) {
        // Admin / Super Admin: the curated order above, applied as a SORT.
        //
        // It used to be applied as a map-and-filter, which meant a granted
        // module the list did not name never reached the rail at all. Sorting
        // instead keeps the curated positions for the modules it names and
        // lets everything else the account holds follow, in its stored order —
        // so the rail is the grants, and the list is only their arrangement.
        //
        // Matched on the CANONICAL key so a variant spelling still finds its
        // slot rather than falling to the tail.
        const rank = new Map(ADMIN_SIDEBAR_KEYS.map((key, i) => [key, i]));
        sortedPermissions = [...sortedPermissions].sort((a, b) => {
            const ra = rank.get(canonicalPermissionKey(a.permissionKey));
            const rb = rank.get(canonicalPermissionKey(b.permissionKey));
            if (ra !== undefined && rb !== undefined) return ra - rb;
            if (ra !== undefined) return -1;
            if (rb !== undefined) return 1;
            return a.order - b.order;   // already the incoming sort
        });
    }

    // Rail labels come from the shared map in ../navRoutes — the staff rail
    // reads the same one, so a module cannot show under two different names
    // depending on which shell you are in. Built from THIS rail's keys (after
    // the whitelist, so it reflects what will actually render) because the
    // short "Dashboard" label is conditional on there being only one.
    const titleFor = makeSidebarTitler(
        sortedPermissions.filter(p => p.isActive).map(p => p.permissionKey),
    );

    sortedPermissions.forEach((permission) => {
        if (permission.isActive) {
            const IconComponent = getIconByName(permission.icon || "ShieldCheck");
            const routeKey = canonicalPermissionKey(permission.permissionKey);
            const route = routeForPermissionKey(routeKey);

            items.push({
                title: titleFor(routeKey, permission.permissionName),
                href: route,
                icon: IconComponent,
                iconName: permission.icon || "ShieldCheck",
                color: permission.color || "orange",
                hasChevron: false,
                permissionKey: permission.permissionKey,
            });
        }
    });

    // Client Management + Service Mapping live under one "Business Management"
    // section with two tabs. Collapse whichever of these keys the user holds
    // into a single parent at the first one's position. (An older data shape
    // may already carry a single "businessmanagement" permission — treat it the
    // same so it, too, gets the two tabs.)
    // Question Bank → one expandable entry over its two grantable pages,
    // Internal (institution-scoped, one doc per tenant) and External (the
    // shared platform-imported bank). Both children are PERMISSION-DRIVEN now:
    // the submenu carries only the pages this account was actually granted, so
    // ticking "External Questions" in the modal is what puts that row in the
    // rail. It used to pin both children on whenever `questionbanks` was held.
    const qbItems = grantedSectionChildren(
        QUESTION_BANK_SECTION,
        items.map(i => i.permissionKey),
    );
    if (qbItems.length > 0) {
        const qbIdx = items.findIndex(i =>
            QUESTION_BANK_SECTION.children.some(
                c => c.key === canonicalPermissionKey(i.permissionKey),
            ),
        );
        const sectionColor = items[qbIdx].color;
        const children: SidebarItem[] = qbItems.map(c => ({
            title: c.title,
            href: c.href,
            icon: getIconByName(c.iconName),
            iconName: c.iconName,
            color: sectionColor,
            permissionKey: c.key,
        }));
        const merged: SidebarItem = {
            title: QUESTION_BANK_SECTION.title,
            // Parent opens the first child held — Internal when it is granted,
            // which is what every existing bookmark and in-app link (Course
            // Setup, exercise authoring, …) already targets.
            href: children[0].href,
            icon: getIconByName(QUESTION_BANK_SECTION.iconName),
            iconName: QUESTION_BANK_SECTION.iconName,
            color: sectionColor,
            hasChevron: false,
            permissionKey: QUESTION_BANK_SECTION.parentKey,
            children,
        };
        const qbKeys = QUESTION_BANK_SECTION.children.map(c => c.key);
        const rest = items.filter(
            i => !qbKeys.includes(canonicalPermissionKey(i.permissionKey)),
        );
        rest.splice(qbIdx, 0, merged);
        items.length = 0;
        items.push(...rest);
    }

    // ── Business Management umbrella ──
    // Business Management wraps Client Management + Service Mapping only.
    // Course Management (coursestructure) is a peer top-level rail entry —
    // the user reads it as a sibling of Approvals, Report, Calendar, not as
    // something living under a Business heading. Its slot in the admin
    // rail's order comes from ADMIN_SIDEBAR_KEYS above.
    //
    //   Business Management ▾
    //     ├─ Client Management     → /lms/pages/clientmanagement
    //     └─ Service Mapping       → /lms/pages/servicemapping
    //   Course Management          → /lms/pages/coursestructure   (top-level)
    //
    // Only children the user is actually granted appear (permission gates
    // are unchanged). If NEITHER key is granted, no Business heading
    // appears at all. If Business Management is the umbrella but a user
    // only has one of the two, the umbrella still renders with the one
    // child so the module isn't hidden behind a missing parent — matches
    // the existing "no action hidden" pattern used for the Question Bank
    // and System Settings mergers.
    const BUSINESS_KEYS = ["clientmanagement", "servicemapping", "businessmanagement"];
    const firstBusinessIdx = items.findIndex(
        i => BUSINESS_KEYS.includes(canonicalPermissionKey(i.permissionKey)),
    );
    if (firstBusinessIdx !== -1) {
        const sectionColor = items[firstBusinessIdx].color;

        // Build children only for the keys this user actually holds.
        // Order is fixed (Client → Service) so the section reads
        // consistently regardless of grant order.
        const held = new Set(items.map(i => canonicalPermissionKey(i.permissionKey)));
        const businessChildren: SidebarItem[] = [];
        if (held.has("clientmanagement")) {
            businessChildren.push({
                title: "Client Management",
                href: "/lms/pages/clientmanagement",
                icon: getIconByName("Building"),
                iconName: "Building",
                color: sectionColor,
                permissionKey: "clientmanagement",
            });
        }
        if (held.has("servicemapping")) {
            businessChildren.push({
                title: "Service Mapping",
                href: "/lms/pages/servicemapping",
                icon: getIconByName("Layers"),
                iconName: "Layers",
                color: sectionColor,
                permissionKey: "servicemapping",
            });
        }

        if (businessChildren.length > 0) {
            const merged: SidebarItem = {
                title: "Business Management",
                // Parent opens the first granted child (Client → Service)
                // since there's no combined landing page.
                href: businessChildren[0].href,
                icon: getIconByName("Briefcase"),
                iconName: "Briefcase",
                color: sectionColor,
                hasChevron: false,
                permissionKey: "businessmanagement",
                children: businessChildren,
            };
            // Strip every underlying key + any old top-level Business
            // Management entry, then splice the merged section in at the
            // position of the first Business-scoped item so ordering
            // relative to unrelated items (Course Management, Question
            // Bank, System Settings, etc.) is preserved.
            const filtered = items.filter(
                i => !BUSINESS_KEYS.includes(canonicalPermissionKey(i.permissionKey)),
            );
            filtered.splice(firstBusinessIdx, 0, merged);
            return systemSettingsMerge(filtered);
        }
    }

    return systemSettingsMerge(items);
};

// System Settings parent — collapses Dynamic Field Settings + Audit Logs into
// a single expandable rail item so the sidebar's tail reads as "settings
// grouped under one heading" instead of two loose system-level entries.
// Same pattern as the Business Management merger above: build children off
// whichever of the two source keys the user actually holds, splice them in
// at the position of the first source item.
const SYSTEM_SETTINGS_KEYS = ["dynamicfieldsettings", "logs"];
function systemSettingsMerge(items: SidebarItem[]): SidebarItem[] {
    const firstIdx = items.findIndex(i => SYSTEM_SETTINGS_KEYS.includes((i.permissionKey || "").toLowerCase()));
    if (firstIdx === -1) return items;
    const dfs = items.find(i => (i.permissionKey || "").toLowerCase() === "dynamicfieldsettings");
    const logs = items.find(i => (i.permissionKey || "").toLowerCase() === "logs");
    const sectionColor = items[firstIdx].color;
    const children: SidebarItem[] = [];
    if (dfs) {
        children.push({
            title: "Dynamic Settings",
            href: "/lms/pages/dynamicfieldsettings",
            icon: getIconByName("Settings2"),
            iconName: "Settings2",
            color: sectionColor,
            permissionKey: "dynamicfieldsettings",
        });
    }
    if (logs) {
        children.push({
            title: "Audit Logs",
            href: "/lms/pages/logs",
            icon: getIconByName("ScrollText"),
            iconName: "ScrollText",
            color: sectionColor,
            permissionKey: "logs",
        });
    }
    if (children.length === 0) return items;
    const merged: SidebarItem = {
        title: "System Settings",
        // Parent opens whichever child is first (both are real pages; there is
        // no combined landing page under this heading).
        href: children[0].href,
        icon: getIconByName("Settings"),
        iconName: "Settings",
        color: sectionColor,
        hasChevron: false,
        permissionKey: "systemsettings",
        children,
    };
    const filtered = items.filter(i => !SYSTEM_SETTINGS_KEYS.includes((i.permissionKey || "").toLowerCase()));
    filtered.splice(firstIdx, 0, merged);
    return filtered;
}

// (A POC role test used to live here, purely to branch this module's nav
// derivation onto a hardcoded POC list. Nav no longer branches on role, so it
// is gone — `isPocRoleValue` / `isPocSession` in lib/session.ts remain the one
// place that answers "is this a POC?", for the route gate and login landing.)

/**
 * The nav for a STORED user — what the shells that read localStorage (Sidebar,
 * CommandPalette) should call instead of `buildSidebarItems` directly.
 *
 * EVERY role derives its rail the same way: from the permissions that role's
 * account actually holds. There is no hardcoded per-role nav any more — POC
 * used to return a static list from `features/poc/nav.ts`, which meant an
 * admin could grant a POC a module in the permission modal and the rail would
 * ignore it. Adding, removing or reordering a POC's (or anyone's) sidebar is
 * now purely an Assign Permission action.
 *
 * Only ONE role-derived rule survives, and it no longer hides anything: admin
 * / super admin get the curated ADMIN_SIDEBAR_KEYS ORDER, so the modules those
 * accounts hold appear in a deliberate arrangement rather than by stored
 * `order` alone. What appears is still exactly what was granted.
 */
export const buildNavForStoredUser = (userData: UserData | null): SidebarItem[] => {
    // Detect POC first — its permissions get a small role-scoped patch
    // BEFORE the sidebar is built, so the Question Bank collapse logic
    // (which reads directly from the granted permission set) picks up
    // any synthetic entries as if the trainer had granted them.
    const role: any = userData?.role;
    const isPoc = [role?.roleValue, role?.originalRole, role?.renameRole, typeof role === "string" ? role : null]
        .some(isPocRoleValue);

    // POCs get External Questions on the rail whenever they hold the
    // Internal question bank grant. Live POC accounts predate the split
    // (the External page shipped later) and never had the extra
    // `questionbanksexternal` seeded on their user doc, which is why the
    // External Questions row was missing from their Question Bank submenu.
    // The External page is read-only for POCs (role-gated in-file), so
    // exposing it here is safe and lets a POC browse the shared platform
    // library the same way admins do.
    let effectivePermissions = userData?.permissions || [];
    if (isPoc) {
        const keys = new Set(
            effectivePermissions.map((p) => canonicalPermissionKey(p.permissionKey)),
        );
        if (keys.has("questionbanks") && !keys.has("questionbanksexternal")) {
            const now = new Date().toISOString();
            const internal = effectivePermissions.find(
                (p) => canonicalPermissionKey(p.permissionKey) === "questionbanks",
            );
            effectivePermissions = [
                ...effectivePermissions,
                {
                    _id: "synthetic-poc-qb-external",
                    permissionName: "External Questions",
                    permissionKey: "questionbanksexternal",
                    permissionFunctionality: [],
                    // Match the Internal row's icon / colour metadata so the
                    // submenu reads as one section.
                    icon: internal?.icon || "Globe",
                    color: internal?.color || "slate",
                    description: "Shared platform-imported bank",
                    isActive: true,
                    order: (internal?.order ?? 0) + 1,
                    createdAt: now,
                    updatedAt: now,
                },
            ];
        }
    }

    const items = buildSidebarItems(effectivePermissions, isAdminRole(userData));

    // ── POC rail adjustments (role-scoped presentation, not permissions) ────
    // The POC console doesn't surface Attendance Management or Grades even
    // when the account still carries those admin-era grants, and it gets a
    // "Report" entry — the same Performance Report the L&D console owns,
    // rendered standalone at /lms/pages/reports/performance (no L&D shell).
    // The route gate allows it via POC_COMPANION_ROUTES in providers.tsx.
    if (!isPoc) return items;

    const HIDDEN_FOR_POC = new Set(["attendancemanagement", "grades", "grade"]);
    const kept = items.filter(i => !HIDDEN_FOR_POC.has(canonicalPermissionKey(i.permissionKey)));
    if (!kept.some(i => i.href === "/lms/pages/reports/performance")) {
        kept.push({
            title: "Report",
            href: "/lms/pages/reports/performance",
            icon: LucideIcons.BarChart3,
            iconName: "bar-chart-3",
            color: "indigo",
            hasChevron: false,
            permissionKey: "reports",
        });
    }
    return kept;
};

/* ── Grouping (design-brief §4) ──────────────────────────────────────────────
   OVERVIEW / MANAGEMENT / LEARNING / SYSTEM by permissionKey; any key not in
   the map lands in WORKSPACE so no role's item is ever dropped on the floor. */

export interface NavGroup {
    label: string;
    items: SidebarItem[];
}

// THE section order, for every shell. Exported because the staff shell renders
// its own rail: it used to carry a private copy of this list with Learning and
// Management the other way round, and a private key map that knew none of this
// app's real routes — so Course Management and Admin Dashboard fell into
// "Workspace" there while sitting in Learning/Overview on the admin sidebar.
// Same nav, two shapes, depending on which page you happened to be on.
export const NAV_GROUP_ORDER = ["Overview", "Management", "Learning", "System", "Workspace"];

const GROUP_BY_KEY: Record<string, string> = {
    admindashboard: "Overview",
    lddashboard: "Overview",
    dashboard: "Overview",
    studentdashboard: "Overview",
    usermanagement: "Management",
    businessmanagement: "Management",
    clientmanagement: "Management",
    servicemapping: "Management",
    students: "Management",
    coursestructure: "Learning",
    courses: "Learning",
    // Standalone Performance Report (POC + trainer rails).
    reports: "Learning",
    approvals: "Learning",
    questionbanks: "Learning",
    questionbanksexternal: "Learning",
    feedback: "Learning",
    grades: "Learning",
    calendar: "Learning",
    schedule: "Learning",
    assignments: "Learning",
    resources: "Learning",
    progress: "Learning",
    attendancemanagement: "Learning",
    dynamicfieldsettings: "System",
    // System Settings — merged parent for Dynamic Settings + Audit Logs.
    // Lives in the System bucket so it sits with other system-level tools.
    systemsettings: "System",
    // Notifications sits next to Admin Dashboard in Overview so the sidebar's
    // second row is always Notification — the corner bell was retired and
    // the red pulse on this row now carries "you have unread activity".
    notifications: "Overview",
    // Audit Logs reaches the staff rail as a synthetic item with no permission
    // key, so it is matched on its route instead — see navGroupLabelFor.
    logs: "System",
    auditlogs: "System",
    profile: "System",
    settings: "System",
    // POC console. Without these every POC item falls into "Workspace".
    pocdashboard: "Overview",
    poccourses: "Learning",
    pocattendance: "Learning",
    pocclients: "Management",
    pocservices: "Management",
    pocreports: "System",
};

/**
 * Which section an item belongs to.
 *
 * Resolved from the permission key first; failing that, from the item's route.
 * The route fallback exists because not every item comes from a permission —
 * the staff rail injects "Log Activity" itself — and an unmatched item would
 * otherwise be exiled to Workspace, which is how this drifted apart before.
 */
export const navGroupLabelFor = (item: { permissionKey?: string; href?: string }): string => {
    const key = canonicalPermissionKey(item.permissionKey).replace(/[-_\s]/g, "");
    if (GROUP_BY_KEY[key]) return GROUP_BY_KEY[key];
    const segment = (item.href || "")
        .split("?")[0]
        .split("/")
        .filter(Boolean)
        .pop()
        ?.toLowerCase()
        .replace(/[-_\s]/g, "") || "";
    return GROUP_BY_KEY[segment] ?? "Workspace";
};

/** Bucket items into the shared sections, keeping their order inside each. */
export const groupSidebarItems = <T extends { permissionKey?: string; href?: string }>(
    items: T[],
): Array<{ label: string; items: T[] }> => {
    const buckets = new Map<string, T[]>();
    items.forEach((item) => {
        const label = navGroupLabelFor(item);
        const bucket = buckets.get(label);
        if (bucket) {
            bucket.push(item);
        } else {
            buckets.set(label, [item]);
        }
    });
    return NAV_GROUP_ORDER
        .filter((label) => buckets.has(label))
        .map((label) => ({ label, items: buckets.get(label)! }));
};

// Read the stored user EXACTLY the way the sidebar does (same key, same parse).
export const readStoredUserData = (): UserData | null => {
    try {
        const userDataString = localStorage.getItem(USER_DATA_KEY);
        return userDataString ? JSON.parse(userDataString) : null;
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
};
