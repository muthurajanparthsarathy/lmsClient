import {
  LayoutDashboard, Users, Landmark, CreditCard, BarChart3, Bell,
  ScrollText, Settings, Building2, LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// A top-level sidebar entry is either a direct link (has `href`) or a
// collapsible parent (has `children`). Client Management is the only parent.
export interface NavEntry {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavItem[];
}

// A labeled sidebar section (MAIN, CLIENT MANAGEMENT, ...) holding one or more
// entries. Roles, Users, Resources and Permissions are intentionally NOT in the
// sidebar — reached per-client from the 3-dot menu on the Clients list.
export interface NavSection {
  label: string;
  items: NavEntry[];
}

export const NAV_SECTIONS: NavSection[] = [
  { label: 'Main', items: [{ label: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard }] },
  {
    label: 'Client Management',
    items: [{
      label: 'Client Management',
      icon: Landmark,
      children: [
        { label: 'Clients', href: '/superadmin/clients', icon: Building2 },
        { label: 'Payment & Subscriptions', href: '/superadmin/subscriptions', icon: CreditCard },
      ],
    }],
  },
  { label: 'Analytics', items: [{ label: 'Report & Analytics', href: '/superadmin/reports', icon: BarChart3 }] },
  { label: 'Communication', items: [{ label: 'Notification', href: '/superadmin/notifications', icon: Bell }] },
  { label: 'Audit & Security', items: [{ label: 'Audit Log', href: '/superadmin/audit-logs', icon: ScrollText }] },
  { label: 'System', items: [{ label: 'System Setting', href: '/superadmin/settings', icon: Settings }] },
];

// Every reachable leaf route (sidebar links + the per-client pages reached via
// the Client 3-dot menu + profile). Used by the topbar breadcrumb and command
// palette to resolve the current page.
export const flatNav: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items).flatMap((e) => (e.children ? e.children : e.href ? [{ label: e.label, href: e.href, icon: e.icon }] : [])),
  { label: 'Roles', href: '/superadmin/roles', icon: Users },
  { label: 'Users', href: '/superadmin/users', icon: Users },
  { label: 'Resources', href: '/superadmin/resources', icon: Users },
  { label: 'Permissions', href: '/superadmin/permissions', icon: Users },
  { label: 'Profile', href: '/superadmin/profile', icon: Users },
  { label: 'Super Admins', href: '/superadmin/admins', icon: Users },
];

// Note: '/superadmin/clients' is the single client page — Add Client lives in
// its header (the old '/superadmin/institutions' route was merged into it and
// removed), and each row's 3-dot menu opens the per-client Roles/Users/
// Resources pages plus activate/deactivate/delete.

// One-line context shown under the topbar breadcrumb — purely presentational.
export const NAV_SUBTITLES: Record<string, string> = {
  '/superadmin/dashboard': 'Platform-wide overview across all tenant institutions',
  // '/superadmin/clients' intentionally has no subtitle — the page shows the
  // bare "Clients" title alone.
  '/superadmin/subscriptions': 'Plans, storage quotas and payment status',
  '/superadmin/roles': 'Manage roles for the selected client',
  '/superadmin/users': 'Manage users for the selected client',
  '/superadmin/permissions': 'Control which modules each role can access',
  '/superadmin/resources': 'Upload and storage governance for the selected client',
  '/superadmin/reports': 'Usage and login insights',
  '/superadmin/notifications': 'Broadcast messages to users',
  '/superadmin/audit-logs': 'Every action taken in this console',
  '/superadmin/settings': 'Platform-level configuration',
  '/superadmin/profile': 'Your platform owner account',
  '/superadmin/admins': 'Manage the accounts that can sign in to this console',
};
