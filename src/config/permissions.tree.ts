// Single source of truth for the LMS permission catalog.
//
// The tree drives every consumer:
//   1. PermissionModal / BulkPermissionModal render this shape as an expandable
//      selector (containers → pages → functions).
//   2. usePermissions.can(pageId, fn?) resolves the current user's storage
//      entry against a leaf function AND its `aliases[]` so legacy stored
//      labels ("Toggle Client Status") keep resolving after a rename
//      ("Deactivate") — no migration required.
//   3. PERMISSION_IDS is auto-derived from the tree so pages don't invent ids
//      by hand.
//   4. The sidebar / navigation reads the tree to hide inaccessible menu items
//      automatically (wired in a follow-up).
//
// Storage stays flat and backend-compatible: only PAGE nodes create an entry
// in `smartcliff_permissions`; a page's granted leaf-function ids serialize
// into that entry's `permissionFunctionality[]`. CONTAINER nodes
// (e.g. "Business Management") are UI-only groupings and never persist.

// ─── Types ────────────────────────────────────────────────────────────────

export type PermissionCategory = "admin" | "staff" | "student";
export type PermissionKind = "container" | "page" | "function";

export interface PermissionNode {
  /** Unique identifier. For pages, this is the storage `id` (what the modal
   *  writes and `usePermissions.can(id, ...)` reads). For containers it is
   *  UI-only. For functions, it is the leaf id / storage label. */
  id: string;

  /** Display label. */
  name: string;

  /** container = UI-only group (no storage entry); page = a screen the user
   *  can be granted; function = a single action inside a page (a button,
   *  menu item, toggle, etc). */
  kind: PermissionKind;

  /** Route/URL key. Only pages carry one; used by the sidebar/nav layer to
   *  match menu items to permissions and by `usePermissions.canKey`. */
  key?: string;

  /** Legacy labels that should also count as this node when found in stored
   *  data. Lets us rename functions without breaking already-issued
   *  permissions. Applies to functions (matched against the storage array
   *  entries) and pages (matched against the storage entry `id`). */
  aliases?: string[];

  /** When the parent page is enabled the modal pre-checks this function. Per
   *  spec: "Export User", "View Details", "View Client Mapping",
   *  "My Calendar", "Manage Holidays", "Mark", "Analytics", "Manage",
   *  "View Details", "Start" — all default-selected in their groups. */
  defaultSelected?: boolean;

  /** Which top-level role bucket this node lives under (admin/staff/student).
   *  Inherited from the root ancestor when not set on a node itself. */
  categories?: PermissionCategory[];

  /** Optional metadata mirrored into storage on save for the modal card UI. */
  icon?: string;
  color?: string;
  description?: string;

  children?: PermissionNode[];
}

// ─── Small helpers used inside the tree literal ───────────────────────────

const fn = (id: string, opts: {
  aliases?: string[]; defaultSelected?: boolean; description?: string;
} = {}): PermissionNode => ({ id, name: id, kind: "function", ...opts });

const page = (
  id: string, key: string, name: string,
  opts: {
    icon?: string; color?: string; description?: string;
    aliases?: string[]; children?: PermissionNode[];
    /** Pre-select this page when the modal opens for a user who has no
     *  existing permissions yet (Add User → Configure Permissions). */
    defaultSelected?: boolean;
  } = {},
): PermissionNode => ({
  id, key, name, kind: "page",
  icon: opts.icon, color: opts.color, description: opts.description,
  aliases: opts.aliases, defaultSelected: opts.defaultSelected,
  children: opts.children,
});

const container = (
  id: string, name: string,
  opts: { icon?: string; children?: PermissionNode[] } = {},
): PermissionNode => ({
  id, name, kind: "container", icon: opts.icon, children: opts.children,
});

// ─── The tree ─────────────────────────────────────────────────────────────

export const PERMISSION_TREE: PermissionNode[] = [

  // ══════════ ADMIN ══════════
  container("admin", "Admin", { icon: "ShieldCheck", children: [
    page("admin-dashboard", "admindashboard", "Admin Dashboard",
      { icon: "Home", color: "indigo", aliases: ["admindashboard"], defaultSelected: true }),

    // POC console landing page.
    //
    // It sits in the ADMIN bucket because that is the tab an admin uses when
    // assigning a Point of Contact its modules — classifyRole() files POC
    // alongside admin/coordinator — and because the page itself IS an admin
    // dashboard, just scoped server-side to the courses, clients and services
    // that POC is enrolled in (server/utils/pocScope.js).
    //
    // `pocdashboard` is the ROUTE key, but the page does NOT live at
    // /lms/pages/pocdashboard. PERMISSION_ROUTES in
    // app/lms/shared/ui/navItems.ts maps it to /lms/pages/poc/dashboard, and
    // the sidebar, the command palette and the route guard all read that one
    // map — so granting this permission is the whole wiring: the rail entry
    // appears, it navigates to the real page, and the gate lets it through.
    // No `children` — deliberately a flat, non-expandable row in the modal,
    // exactly like Admin Dashboard above it. The dashboard is one screen you
    // either have or don't; splitting it into per-section toggles gave admins
    // four checkboxes that only ever hid parts of a page they had already
    // granted.
    page("admin-poc-dashboard", "pocdashboard", "POC Dashboard", {
      icon: "LayoutDashboard", color: "orange",
      description: "Point-of-Contact console — courses, learners, clients and services inside the POC's own scope",
      aliases: ["pocdashboard", "poc-dashboard", "admin-pocdashboard"],
    }),

    page("admin-usermanagement", "usermanagement", "User Management", {
      icon: "Users", color: "blue",
      description: "Manage users and access",
      children: [
        fn("Add User"),
        fn("Edit User",         { aliases: ["Edit"] }),
        fn("Assign Permission", { aliases: ["Permissions"] }),
        fn("Deactivate User",   { aliases: ["Toggle User Status"] }),
        fn("Delete User",       { aliases: ["Delete"] }),
        fn("Bulk Permission"),
        fn("Import User",       { aliases: ["Bulk Upload"] }),
        fn("Export User",       { defaultSelected: true }),
      ],
    }),

    container("admin-businessmanagement", "Business Management", {
      icon: "Briefcase", children: [
        page("admin-clientmanagement", "clientmanagement", "Client Management", {
          icon: "Users", color: "indigo",
          description: "Manage client organizations",
          children: [
            fn("Add Client"),
            fn("Edit"),
            fn("Deactivate", { aliases: ["Toggle Client Status"] }),
            fn("Delete"),
          ],
        }),
        page("admin-servicemapping", "servicemapping", "Service Mapping", {
          icon: "Layers", color: "indigo",
          description: "Configure client-service mappings",
          children: [
            fn("New Mapping"),
            fn("View Details",        { defaultSelected: true, aliases: ["View Full Details"] }),
            fn("View Client Mapping", { defaultSelected: true }),
            fn("Edit"),
            fn("Delete This Service", { aliases: ["Delete"] }),
            fn("Delete Several"),
            fn("Map Service"),
          ],
        }),
      ],
    }),

    // Course Management is a single page, so it sits at the top level rather
    // than inside a same-named container — the name here is what
    // storedFromSelection() writes to `permissionName`, and what the sidebar
    // shows. `coursestructure` stays the ROUTE key (/lms/pages/coursestructure)
    // and the page id stays `admin-course-manage`, so already-issued grants
    // keep resolving through resolvePage()'s id/alias lookup.
    page("admin-course-manage", "coursestructure", "Course Management", {
      icon: "BookOpen", color: "emerald",
      description: "Course structure, resources, calendar, enrollment, feedback",
      // Pre-tree ids for old grants: the flattened container and the
      // "Manage"-era page both land here.
      aliases: ["admin-coursemanagement"],
      children: [
        fn("View Course Details",  { defaultSelected: true, aliases: ["View Full Details"] }),
        fn("Edit Course"),
        fn("Add Course Structure"),
        fn("Upload Resources",     { aliases: ["Upload Resourses"] }),
        fn("Program Calendar"),
        fn("Enrollment",           { aliases: ["Add Participants"] }),
        fn("Feedback",             { aliases: ["Add Feedback"] }),
      ],
    }),

    page("admin-approvals", "approvals", "Approvals",
      { icon: "ClipboardCheck", color: "amber" }),

    // Question Bank is a CONTAINER with two grantable pages under it, so the
    // modal reads the same shape the sidebar renders:
    //
    //   Question Bank
    //     Internal Questions   → Create Question · View Details · Edit ·
    //                            Delete · Deactivate
    //     External Questions
    //
    // It used to be a single page with those five functions directly on it,
    // which meant the two banks could not be granted separately even though
    // they are separate screens with separate rail entries. The Internal page
    // deliberately keeps the OLD page id (`admin-question-banks`) and the old
    // key (`questionbanks`): every `can(PERMISSION_IDS.ADMIN_QUESTION_BANKS,
    // …)` call in features/questionbanks and every already-issued grant
    // resolves to it unchanged. Only the display name moved, from
    // "Question Bank" to "Internal Questions".
    container("admin-question-banks-group", "Question Bank", {
      icon: "MessageCircleQuestion", children: [
        page("admin-question-banks", "questionbanks", "Internal Questions", {
          icon: "Library", color: "slate",
          description: "Institution's own question bank — one document per tenant",
          aliases: ["Question Bank"],
          children: [
            fn("Create Question"),
            fn("View Details", { defaultSelected: true }),
            fn("Edit"),
            fn("Delete"),
            fn("Deactivate"),
          ],
        }),
        // No functions: the External bank is a shared, platform-imported
        // library (~5k Exercism/CP questions) that every tenant reads and only
        // admin / super_admin may write — the page role-gates its own actions
        // in-file. This permission decides whether the rail entry appears.
        page("admin-question-banks-external", "questionbanksexternal", "External Questions", {
          icon: "Globe", color: "slate",
          description: "Shared platform-imported bank, common to every institution",
        }),
      ],
    }),

    page("admin-grades", "grades", "Grades",
      { icon: "GraduationCap", color: "emerald" }),

    page("admin-calendar", "calendar", "Calendar", {
      icon: "Calendar", color: "emerald", aliases: ["calendar"],
      children: [
        fn("My Calendar",     { defaultSelected: true }),
        fn("Manage Holidays", { defaultSelected: true }),
      ],
    }),

    page("admin-attendancemanagement", "attendancemanagement", "Attendance Management",
      { icon: "UserCheck", color: "indigo" }),

    page("admin-dynamic-field-settings", "dynamicfieldsettings", "Dynamic Field Setting", {
      icon: "Settings2", color: "slate",
      children: [
        fn("Service Modal"),
        fn("Course Category"),
        fn("Pedagogy"),
        fn("Degree Management"),
      ],
    }),

    page("admin-notification", "notifications", "Notification",
      { icon: "Bell", color: "amber" }),

    page("admin-auditlogs", "logs", "Audit Logs",
      { icon: "Activity", color: "slate" }),

    page("admin-profile", "profile", "Profile",
      { icon: "GraduationCap", color: "emerald" }),
  ]}),

  // ══════════ TRAINER ══════════
  container("trainer", "Trainer", { icon: "GraduationCap", children: [
    page("staff-dashboard", "dashboard", "Staff Dashboard",
      { icon: "Home", color: "indigo", aliases: ["staffdashboard"], defaultSelected: true }),

    page("staff-courses", "courses", "Trainer Courses", {
      icon: "BookOpen", color: "emerald",
      aliases: ["Courses"],
      children: [
        fn("Analytics", { defaultSelected: true, aliases: ["view_schedule"] }),
        fn("Manage",    { defaultSelected: true, aliases: ["access_materials"] }),
        fn("Enroll Courses", { aliases: ["enroll_courses"] }),
      ],
    }),

    page("staff-grades", "grades", "Trainer Grade",
      { icon: "GraduationCap", color: "emerald", aliases: ["staff-grade", "Grade"] }),

    page("staff-attendancemanagement", "attendancemanagement", "Trainer Attendance",
      { icon: "UserCheck", color: "indigo", aliases: ["Attendance Management"] }),

    page("staff-notification", "notifications", "Trainer Notification",
      { icon: "Bell", color: "amber", aliases: ["Notification"] }),

    page("staff-profile", "profile", "Trainer Profile",
      { icon: "GraduationCap", color: "emerald", aliases: ["Profile"] }),

    page("staff-logactivity", "log-activity", "Log Activity",
      { icon: "Activity", color: "amber" }),
  ]}),

  // ══════════ STUDENT ══════════
  container("student", "Student", { icon: "Users", children: [
    page("student-dashboard", "studentdashboard", "Student Dashboard", {
      icon: "Home", color: "indigo", defaultSelected: true,
      children: [
        fn("View Courses",       { aliases: ["view_courses"] }),
        fn("View Grades",        { aliases: ["view_grades"] }),
        fn("Submit Assignments", { aliases: ["submit_assignments"] }),
      ],
    }),

    page("student-courses", "courses", "Student Courses", {
      icon: "BookOpen", color: "emerald",
      aliases: ["Courses"],
      children: [
        fn("View Details", { defaultSelected: true, aliases: ["access_materials"] }),
        fn("Start",        { defaultSelected: true, aliases: ["enroll_courses"] }),
        fn("View Schedule",{ aliases: ["view_schedule"] }),
        fn("Feedback",     { defaultSelected: true, aliases: ["feedback"] }),
      ],
    }),

    page("student-codinganalytics", "codinganalytics", "Coding Analytics",
      { icon: "Activity", color: "slate" }),

    page("student-notification", "notifications", "Student Notification",
      { icon: "Bell", color: "amber", aliases: ["Notification"] }),

    page("student-profile", "profile", "My Profile",
      { icon: "GraduationCap", color: "emerald" }),

    page("student-grade", "grade", "Grade",
      { icon: "GraduationCap", color: "emerald" }),
  ]}),
];
