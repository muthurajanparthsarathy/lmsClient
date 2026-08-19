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
// Value import, but `features/poc/nav` imports only the SidebarItem TYPE back
// from here — type imports are erased, so there is no runtime cycle.
import { POC_NAV_ITEMS } from "@/features/poc/nav";
import * as LucideIcons from "lucide-react";

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

// Admin / Super Admin sidebars show ONLY these modules, in this order.
// (Other roles keep their full permission-driven list.)
export const ADMIN_SIDEBAR_KEYS = [
    "admindashboard",       // Admin Dashboard
    "usermanagement",       // User Management
    "coursestructure",      // Course Management
    "approvals",            // Approvals (assessment/assignment review queue)
    "dynamicfieldsettings", // Dynamic Field Settings
    "questionbanks",        // Question Banks
    "grades",               // Grades
    "notifications",        // Notification
    "profile",              // Profiles
    "calendar",             // Calendar
    "attendancemanagement", // Attendance Management
    "clientmanagement",     // Business Management (Client Management tab)
    "servicemapping",       // Business Management (Service Mapping tab)
    "logs",                 // Audit Logs
];

// Stored permission keys that mean the same module as a canonical key.
//
// The key is what the route is built from (`/lms/pages/<key>`), so a grant
// carrying a variant spelling lands on a page that does not exist. Course
// Management is the case that bites: the module's ROUTE key is
// "coursestructure", but hand-made and pre-catalog grants spelled it after the
// module's NAME ("course_management"), which routed to a 404.
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
        // Admin / Super Admin: whitelist + fixed order. Matched on the CANONICAL
        // key so a variant spelling still finds its whitelist slot instead of
        // dropping the module out of the sidebar entirely.
        sortedPermissions = ADMIN_SIDEBAR_KEYS
            .map(key => sortedPermissions.find(p => canonicalPermissionKey(p.permissionKey) === key))
            .filter((p): p is UserPermission => !!p);
    }

    // Permissions whose real page does NOT live at /lms/pages/<key>.
    // `feedback` opens the per-course feedback manager (it shows a
    // pick-a-course state when opened without a courseId).
    const ROUTE_OVERRIDES: Record<string, string> = {
        feedback: "/lms/pages/coursestructure/feedback",
    };

    // Sidebar label overrides — the permission catalog's names are chosen for
    // the assign-permission modal (e.g. the scope-prefixed "Trainer Profile"
    // that disambiguates from "Profile"), but the sidebar reads better with the
    // route's plain user-facing name. Applied AFTER the whitelist so the
    // trainer/student sidebar still sees its own scope's entry, just under the
    // friendlier label.
    //
    // `coursestructure` is the ROUTE key only (/lms/pages/coursestructure); the
    // module is called Course Management everywhere a human reads it, so the
    // override is here to pin that name even on older grants that still carry
    // the pre-rename "Manage" in storage.
    const TITLE_OVERRIDES: Record<string, string> = {
        coursestructure: "Course Management",
        courses: "Courses",
        profile: "Profile",
        notifications: "Notification",
        attendancemanagement: "Attendance Management",
        grades: "Grade",
        "log-activity": "Log Activity",
    };

    sortedPermissions.forEach((permission) => {
        if (permission.isActive) {
            const IconComponent = getIconByName(permission.icon || "ShieldCheck");
            const routeKey = canonicalPermissionKey(permission.permissionKey);
            const route = ROUTE_OVERRIDES[routeKey] || `/lms/pages/${routeKey}`;

            items.push({
                title: TITLE_OVERRIDES[routeKey] || permission.permissionName,
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
    // Question Bank splits into Internal (institution-scoped, one doc per
    // tenant) and External (the shared platform-imported bank at
    // /lms/pages/questionbanks/external). Only ONE permission — questionbanks
    // — exists, so anyone who currently sees the entry keeps seeing it and
    // simply gains a second tab. The External page role-gates itself on
    // admin / super_admin, so surfacing the tab to non-admins is harmless.
    const qbIdx = items.findIndex(
        (i) => (i.permissionKey || "").toLowerCase() === "questionbanks",
    );
    if (qbIdx !== -1) {
        const qb = items[qbIdx];
        const qbChildren: SidebarItem[] = [
            {
                title: "Internal Questions",
                href: "/lms/pages/questionbanks",
                icon: getIconByName("Library"),
                iconName: "Library",
                color: qb.color,
                permissionKey: "questionbanks",
            },
            {
                title: "External Questions",
                href: "/lms/pages/questionbanks/external",
                icon: getIconByName("Globe"),
                iconName: "Globe",
                color: qb.color,
                permissionKey: "questionbanks",
            },
        ];
        qb.children = qbChildren;
        // Parent link opens Internal — the page every existing bookmark and
        // in-app link (Course Setup, exercise authoring, ...) already targets.
        qb.href = qbChildren[0].href;
    }

    const MERGED_KEYS = ["clientmanagement", "servicemapping", "businessmanagement"];
    const firstIdx = items.findIndex(i => MERGED_KEYS.includes((i.permissionKey || "").toLowerCase()));
    if (firstIdx !== -1) {
        // Both tabs point at fixed pages that always exist. The section itself
        // is already permission-gated (it only appears because the user holds a
        // Business Management permission), so surface BOTH tabs rather than
        // depending on each key being individually present — that dependency is
        // exactly what made the submenu vanish when the two keys drifted apart.
        const sectionColor = items[firstIdx].color;
        const children: SidebarItem[] = [
            {
                title: "Client Management",
                href: "/lms/pages/clientmanagement",
                icon: getIconByName("Building"),
                iconName: "Building",
                color: sectionColor,
                permissionKey: "clientmanagement",
            },
            {
                title: "Service Mapping",
                href: "/lms/pages/servicemapping",
                icon: getIconByName("Layers"),
                iconName: "Layers",
                color: sectionColor,
                permissionKey: "servicemapping",
            },
        ];
        const merged: SidebarItem = {
            title: "Business Management",
            // The parent opens the first tab — the two are separate pages, there
            // is no combined landing page any more.
            href: children[0].href,
            icon: getIconByName("Briefcase"),
            iconName: "Briefcase",
            color: sectionColor,
            hasChevron: false,
            permissionKey: "businessmanagement",
            children,
        };
        const filtered = items.filter(i => !MERGED_KEYS.includes((i.permissionKey || "").toLowerCase()));
        filtered.splice(firstIdx, 0, merged);
        return filtered;
    }

    return items;
};

/**
 * Mirror of `isAdminRole` for the Point-of-Contact role.
 *
 * Exact matches only — no substring test. A role literally named "POC Manager"
 * is not necessarily this role, and the loose `.includes('poc')` used by a few
 * older call sites is a bug we are not propagating here.
 */
export const isPocRole = (userData: UserData | null): boolean => {
    const r = userData?.role;
    if (!r) return false;
    return [r.roleValue, r.originalRole, r.renameRole]
        .map(v => (v || "").toLowerCase().replace(/[\s\-_]/g, ""))
        .some(v => v === "poc" || v === "pointofcontact");
};

/**
 * The nav for a STORED user — what the shells that read localStorage (Sidebar,
 * CommandPalette) should call instead of `buildSidebarItems` directly.
 *
 * A role with a dedicated static console returns that console's nav. POC is the
 * case this exists for: its permission documents still carry admin keys, so the
 * permission-derived path would hand it the entire admin rail — and the command
 * palette, which shares this derivation, would offer the very routes the rail
 * is hiding.
 */
export const buildNavForStoredUser = (userData: UserData | null): SidebarItem[] => {
    if (isPocRole(userData)) return POC_NAV_ITEMS;
    return buildSidebarItems(userData?.permissions || [], isAdminRole(userData));
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
    approvals: "Learning",
    questionbanks: "Learning",
    feedback: "Learning",
    grades: "Learning",
    calendar: "Learning",
    schedule: "Learning",
    assignments: "Learning",
    resources: "Learning",
    progress: "Learning",
    attendancemanagement: "Learning",
    dynamicfieldsettings: "System",
    notifications: "System",
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
