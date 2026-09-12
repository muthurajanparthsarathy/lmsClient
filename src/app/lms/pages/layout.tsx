"use client";

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '../component/layout';
import ClientWorkspaceSkeleton from '@/features/businessmanagement/ClientWorkspaceSkeleton';
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

  if (role === null && isPersistentDashboardRoute(pathname)) return <ClientWorkspaceSkeleton showTabs={false} />;
  if (!persistent) return <>{children}</>;

  return (
    <DashboardLayout>
      <Suspense fallback={<ClientWorkspaceSkeleton showTabs={false} />}>
        {children}
      </Suspense>
    </DashboardLayout>
  );
}
