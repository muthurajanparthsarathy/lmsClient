import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  Building2,
  ClipboardCheck,
  CheckCircle2,
  Library,
  Globe,
  Bell,
  UserCircle,
} from "lucide-react";
import type { SidebarItem } from "@/app/lms/shared/ui/navItems";

/**
 * The POC sidebar.
 *
 * STATIC — derived from role, never from stored permission keys. Existing POC
 * accounts still hold admin keys (admindashboard, usermanagement, …) that would
 * otherwise render the whole admin rail.
 *
 * The rail points into the EXISTING admin routes. The server already scopes
 * every read behind these routes to the POC's enrolled courses (see
 * server/utils/pocScope.js), so a POC on `/lms/pages/coursestructure` sees only
 * its own courses on the real Course Management page, with the real action set,
 * and every write is refused unless the target is inside its scope. The POC
 * dashboard sits at its own address for its scoped landing view; every other
 * entry reuses the admin page it belongs to.
 *
 * Exported (rather than inlined in a POC sidebar) because CommandPalette shares
 * this derivation: the palette can never offer a route the rail does not.
 */
export const POC_NAV_ITEMS: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/lms/pages/poc/dashboard",
    icon: LayoutDashboard,
    iconName: "LayoutDashboard",
    color: "orange",
    permissionKey: "pocdashboard",
  },
  {
    title: "Course Management",
    href: "/lms/pages/coursestructure",
    icon: BookOpen,
    iconName: "BookOpen",
    color: "blue",
    permissionKey: "coursestructure",
  },
  {
    title: "Attendance Management",
    href: "/lms/pages/attendancemanagement",
    icon: CalendarCheck,
    iconName: "CalendarCheck",
    color: "green",
    permissionKey: "attendancemanagement",
  },
  {
    title: "Business Management",
    href: "/lms/pages/businessmanagement",
    icon: Building2,
    iconName: "Building2",
    color: "purple",
    permissionKey: "businessmanagement",
  },
  {
    title: "Grades",
    href: "/lms/pages/grades",
    icon: ClipboardCheck,
    iconName: "ClipboardCheck",
    color: "amber",
    permissionKey: "grades",
  },
  {
    // The approvals queue is inherently per-user (server gates each item on
    // pinned userId or role match), and its list endpoints are already
    // POC-scoped via attachPocScope.
    title: "Approvals",
    href: "/lms/pages/approvals",
    icon: CheckCircle2,
    iconName: "CheckCircle2",
    color: "emerald",
    permissionKey: "approvals",
  },
  {
    // Internal bank is one document per institution (per-tenant); External
    // bank is intentionally global — a shared library of ~5k Exercism/CP
    // imports, admin/superadmin only for writes.
    title: "Question Banks",
    href: "/lms/pages/questionbanks",
    icon: Library,
    iconName: "Library",
    color: "indigo",
    permissionKey: "questionbanks",
    children: [
      {
        title: "Internal Questions",
        href: "/lms/pages/questionbanks",
        icon: Library,
        iconName: "Library",
        color: "indigo",
        permissionKey: "questionbanks",
      },
      {
        title: "External Questions",
        href: "/lms/pages/questionbanks/external",
        icon: Globe,
        iconName: "Globe",
        color: "indigo",
        permissionKey: "questionbanks",
      },
    ],
  },
  {
    // User-owned records — the endpoint keys off the caller's own id.
    title: "Notifications",
    href: "/lms/pages/notifications",
    icon: Bell,
    iconName: "Bell",
    color: "rose",
    permissionKey: "notifications",
  },
  {
    // The Profile page already skips the admin-only trainer-wide stats when
    // the caller is a POC (STAFF_ROLES = ['poc','trainer']), so nothing
    // institution-wide runs for this role.
    title: "Profile",
    href: "/lms/pages/profile",
    icon: UserCircle,
    iconName: "UserCircle",
    color: "cyan",
    permissionKey: "profile",
  },
];
