"use client";

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '../component/layout';
import ClientWorkspaceSkeleton from '@/features/businessmanagement/ClientWorkspaceSkeleton';
import BusinessWorkspaceChrome, { isBusinessWorkspaceRoute } from '@/features/businessmanagement/BusinessWorkspaceChrome';
import { isPersistentDashboardRoute, usesPersistentDashboardRole } from '@/lib/dashboardRoutes';
import { SESSION_KEYS } from '@/lib/session';
import { useNavigationLoader } from '@/components/navigation-loader/NavigationLoaderProvider';

export default function LmsPagesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const { setContentOnly } = useNavigationLoader();

  useEffect(() => {
    const readRole = () => {
      try {
        const roleValue = localStorage.getItem(SESSION_KEYS.roleValue);
        if (roleValue) { setRole(roleValue); return; }
        const user = JSON.parse(localStorage.getItem(SESSION_KEYS.userData) || 'null');
        const storedRole = user?.role;
        setRole((typeof storedRole === 'string' ? storedRole : storedRole?.roleValue || storedRole?.originalRole) ||
          localStorage.getItem(SESSION_KEYS.originalRole) || '');
      } catch { setRole(''); }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || [SESSION_KEYS.userData, SESSION_KEYS.roleValue, SESSION_KEYS.originalRole].some(key => key === event.key)) readRole();
    };
    readRole();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persistent = role !== null && usesPersistentDashboardRole(role) && isPersistentDashboardRoute(pathname);
  useEffect(() => {
    setContentOnly(persistent);
    return () => setContentOnly(false);
  }, [persistent, setContentOnly]);

  // Business Management's three routes (Client Management / Service Mapping /
  // Reports) share one tab strip. It is mounted HERE rather than by each page
  // so switching tabs is a plain content swap — the strip itself never
  // unmounts, so it cannot blink, re-animate its active underline, or be
  // replaced by a route-level skeleton.
  const workspace = isBusinessWorkspaceRoute(pathname);

  if (role === null && isPersistentDashboardRoute(pathname)) return <ClientWorkspaceSkeleton showTabs={false} />;
  // Roles outside the persistent shell still need the workspace chrome, since
  // the pages no longer carry it themselves.
  if (!persistent && !workspace) return <>{children}</>;

  // Route-level `loading.tsx` renders inside this boundary, which sits BELOW
  // the tab strip — a slow page skeletons its own content area only.
  const content = (
    <Suspense fallback={<ClientWorkspaceSkeleton showTabs={false} />}>
      {children}
    </Suspense>
  );

  return (
    <DashboardLayout>
      {workspace ? <BusinessWorkspaceChrome>{content}</BusinessWorkspaceChrome> : content}
    </DashboardLayout>
  );
}
