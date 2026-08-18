"use client"

/**
 * Student shell — floating-workspace layout (matches the L&D console shell):
 * one continuous gray canvas, the sidebar flat on it (no card, no border on
 * desktop), and the page content inside a white rounded panel inset by a gray
 * gutter on its top, right and bottom. There is NO top navbar — the old
 * StudentNavbar's jobs moved: notifications → bell pinned inside the panel's
 * top-right corner; theme toggle → sidebar footer; logo → sidebar brand card;
 * the mobile hamburger → a floating button inside the panel (mobile only).
 * Content scrolls INSIDE the panel; the gray frame stays fixed.
 */

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { StudentSidebar } from "./student-sidebar"
import NotificationBell from "../NotificationBell"
import { cn } from "@/lib/utils"
import { useSyncPermissions } from "@/hooks/useSyncPermissions"

interface StudentLayoutProps {
  children: React.ReactNode
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  // Re-fetch this session's permissions on every student-shell mount so a
  // just-issued grant (from an admin) shows up without a re-login.
  useSyncPermissions()

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [pathname])

  const getActiveRoute = () => {
    if (pathname.includes('/notifications')) return 'notifications'
    if (pathname.includes('/codinganalytics')) return 'codinganalytics'
    if (pathname.includes('/courses')) return 'courses'
    if (pathname.includes('/dashboard')) return 'dashboard'
    if (pathname.includes('/profile')) return 'profile'
    if (pathname.includes('/grades')) return 'grades'
    if (pathname.includes('/assignments')) return 'assignments'
    if (pathname.includes('/messages')) return 'messages'
    if (pathname.includes('/resources')) return 'resources'
    if (pathname.includes('/schedule')) return 'schedule'
    if (pathname.includes('/progress')) return 'progress'
    if (pathname.includes('/settings')) return 'settings'
    if (pathname.includes('/ai') || pathname.includes('/chat')) return 'ai'
    return 'dashboard'
  }

  const activeRoute = getActiveRoute()

  return (
    <div className="flex min-h-screen bg-[#F5F6F8] dark:bg-[#0E0F12]">

      <StudentSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute={activeRoute}
      />

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden p-3.5 pl-0 max-md:p-2.5">
        {/* White workspace card — the gray gutter around it is the canvas
            showing through, flowing from the sidebar. */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)] dark:border-[#2A2D34] dark:bg-[#17181C]">

          {/* Mobile only: reopens the sidebar drawer (the old navbar's burger). */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="absolute top-3 left-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E7EC] bg-white text-gray-600 shadow-sm md:hidden dark:border-[#2A2D34] dark:bg-[#17181C] dark:text-gray-300"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>

          <div className={cn(
            "min-h-0 flex-1 overflow-y-auto p-4 md:p-6",
            "sc-panel-scroll",
            "animate-in fade-in slide-in-from-bottom-2 duration-400"
          )}>
            {/* Notifications sit inside the panel's top-right corner, but as
                an absolute anchored to a relative wrapper INSIDE the scroll
                flow — the bell scrolls up with the content instead of staying
                pinned over it. Matches the admin shell's behavior. */}
            <div className="relative min-h-full">
              <div className="absolute top-3 right-4 z-30">
                <NotificationBell />
              </div>
              {children}
            </div>
          </div>

          {/* Slim trackless scrollbar, inset from the rounded corners. */}
          <style dangerouslySetInnerHTML={{ __html: `
            .sc-panel-scroll{scrollbar-width:thin; scrollbar-color:#CBD1D9 transparent;}
            .sc-panel-scroll::-webkit-scrollbar{width:8px}
            .sc-panel-scroll::-webkit-scrollbar-track{background:transparent; margin:18px 0}
            .sc-panel-scroll::-webkit-scrollbar-thumb{background:#CBD1D9; border-radius:99px; border:2px solid transparent; background-clip:padding-box}
            .sc-panel-scroll::-webkit-scrollbar-thumb:hover{background:#B4BBC6; background-clip:padding-box}
            .dark .sc-panel-scroll{scrollbar-color:#3A3E46 transparent}
            .dark .sc-panel-scroll::-webkit-scrollbar-thumb{background:#3A3E46; background-clip:padding-box}
            .dark .sc-panel-scroll::-webkit-scrollbar-thumb:hover{background:#4A4F58; background-clip:padding-box}
          `}} />
        </div>
      </main>
    </div>
  )
}
