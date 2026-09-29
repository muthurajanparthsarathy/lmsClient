'use client'
import { getToken } from "@/lib/session";

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// One map decides where a permission key's page lives — see navItems.ts.
// Without it, a module whose page is not at /lms/pages/<key> (POC Dashboard,
// Feedback) lands the user on a route that does not exist.
import { routeForPermissionKey } from '@/app/lms/shared/navRoutes'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = getToken()
    const permissionsStr = localStorage.getItem('smartcliff_permissions')

    // Not logged in — send to login, preserving any ?redirect= param that may
    // already be in the current URL (unlikely on the home route, but safe to
    // forward it just in case).
    if (!token) {
      const searchParams = new URLSearchParams(window.location.search)
      const redirectTo = searchParams.get('redirect')
      const loginUrl = redirectTo
        ? `/login?redirect=${encodeURIComponent(redirectTo)}`
        : '/login'
      router.replace(loginUrl)
      return
    }

    // Logged in — figure out where to send the user
    try {
      // Priority 1: stored first permission key (fastest path)
      const firstPermissionKey = localStorage.getItem('smartcliff_firstPermissionKey')
      if (firstPermissionKey) {
        router.replace(routeForPermissionKey(firstPermissionKey))
        return
      }

      // Priority 2: derive from full permissions array
      if (permissionsStr) {
        const permissions = JSON.parse(permissionsStr)

        if (Array.isArray(permissions) && permissions.length > 0) {
          // Sort by order, pick first active one
          const sorted = [...permissions]
            .filter((p) => p.isActive)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

          const first = sorted[0] ?? permissions[0]
          const permissionKey = first?.permissionKey

          if (permissionKey) {
            // Cache it for next time
            localStorage.setItem('smartcliff_firstPermissionKey', permissionKey)
            router.replace(routeForPermissionKey(permissionKey))
            return
          }
        }
      }

      // Priority 3: role-based fallback
      const originalRole = localStorage.getItem('smartcliff_originalRole') || ''
      const roleValue = localStorage.getItem('smartcliff_roleValue') || ''
      const isStudent =
        originalRole.toLowerCase().includes('student') ||
        roleValue.toLowerCase().includes('student')

      router.replace(isStudent ? '/lms/pages/studentdashboard' : '/lms/pages/admindashboard')
    } catch (error) {
      console.error('Error determining redirect:', error)
      router.replace('/login')
    }
  }, [router])

  // Blank screen while redirecting
  return null
}