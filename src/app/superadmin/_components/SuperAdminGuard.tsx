'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSuperAdminAuthStore } from '@/stores/superAdminAuthStore';

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, verifySession } = useSuperAdminAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const isValid = await verifySession();
      if (!isValid) {
        router.push('/superadmin/login');
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router, verifySession]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
