"use client"

/**
 * Student shell — floating-workspace layout (matches the L&D console shell):
 * one continuous gray canvas, the sidebar flat on it (no card, no border on
 * desktop), and the page content inside a white rounded panel inset by a gray
 * gutter on its top, right and bottom. There is NO top navbar — the old
 * StudentNavbar's jobs moved: notifications → the rail's Notification entry
 * (which carries its own unread count); theme toggle → sidebar footer; logo →
 * sidebar brand card; the mobile hamburger → a floating button inside the
 * panel (mobile only).
 * Content scrolls INSIDE the panel; the gray frame stays fixed.
 */

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Poppins } from "next/font/google"
import { StudentSidebar } from "./student-sidebar"
import { cn } from "@/lib/utils"
import { useSyncPermissions } from "@/hooks/useSyncPermissions"

// The SAME next/font declaration the admin shell makes (component/layout.tsx),
// weight list included. It is not cosmetic duplication: without it this shell
// inherited only the body's `font-sans`, whose 'Poppins' is served by the
// Google Fonts <link> in app/layout.tsx and degrades to ui-sans-serif /
// system-ui (Segoe UI on Windows) whenever that copy has not loaded. Segoe UI
// carries a noticeably larger x-height than Poppins at the same size, so the
// student rail rendered visibly bigger than the admin rail even though every
// one of its type classes is identical — and it also flashed the fallback on
// every cold load. next/font self-hosts the file and ships a metric-adjusted
// fallback, so both shells now resolve to the same faces at the same metrics.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
})

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
    if (pathname.includes('/studentcalendar')) return 'studentcalendar'
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
    // Outer flex shell — matched to the admin shell so both rails sit in the
    // same containment context. `h-screen` (not min-h-screen) mirrors admin's
    // dashboard-shell so the whole page is a fixed-height frame with content
    // scrolling INSIDE the workspace panel, not the outer div.
    <div
      className={`${poppins.variable} flex h-screen bg-[#F5F6F8] dark:bg-[#0E0F12]`}
      style={{ fontFamily: "var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >

      {/* <aside flex-shrink-0 h-full> wrapper — matches admin's DashboardLayout
          exactly (its <Sidebar/> is wrapped the same way). Puts the rail in
          the SAME flex context on both shells: `flex-shrink-0` guarantees the
          268px width can never be squeezed by long content elsewhere, and
          `h-full` makes the aside inherit the frame's height rather than
          declaring its own `h-screen` — which is what admin does. Without
          this wrapper, framer motion animates width from inside a flex
          container that HAD been allowing shrink until `md:shrink-0` kicked
          in, and mid-animation widths differed by a subpixel between the two
          shells. Purely a structural fix, no visible change beyond that. */}
      <aside className="flex-shrink-0 h-full max-md:h-auto">
        <StudentSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeRoute={activeRoute}
        />
      </aside>

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
            {/* No notification bell in the student shell: the rail's
                Notification entry already carries the unread count, and the
                floating bell duplicated it on every page. Notifications live
                at /lms/pages/notifications. */}
            <div className="relative min-h-full">
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
