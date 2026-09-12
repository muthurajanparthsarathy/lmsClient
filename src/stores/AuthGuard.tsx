'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showSuccessToast } from '@/components/ui/toastUtils';

interface AuthGuardProps {
    children: React.ReactNode;
    redirectTo?: string;
    showWelcomeMessage?: boolean;
}

export default function AuthGuard({ 
    children, 
    redirectTo = '/login', 
    showWelcomeMessage = false 
}: AuthGuardProps) {
    const router = useRouter();
    const { isAuthenticated, verifyToken } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const isValid = await verifyToken();
                if (!isValid) {
                    router.push(redirectTo);
                } else {
                    // Show welcome message if enabled and flag is set
                    if (showWelcomeMessage) {
                        const showWelcomeToast = localStorage.getItem("showWelcomeToast");
                        if (showWelcomeToast) {
                            const userData = JSON.parse(localStorage.getItem("userData") || "{}");
                            showSuccessToast(`Welcome back, ${userData.firstName || "Admin"}!`);
                            localStorage.removeItem("showWelcomeToast");
                        }
                    }
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                router.push(redirectTo);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [router, verifyToken, redirectTo, showWelcomeMessage]);

    // Show loading spinner while checking authentication
    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Render children if authenticated
    return <>{children}</>;
}