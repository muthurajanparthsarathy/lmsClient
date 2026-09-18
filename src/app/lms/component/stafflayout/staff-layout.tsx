"use client"

/**
 * Staff (trainer) shell — floating-workspace layout, matching the admin,
 * student and L&D shells: one continuous gray canvas, the sidebar flat on it,
 * and the page content inside a white rounded panel inset by a gray gutter on
 * its top, right and bottom.
 *
 * The h-14 StaffTopBar is GONE. Its jobs moved:
 *   • theme toggle → staff sidebar footer (next-themes owns html.dark now,
 *     mounted in app/layout.tsx with the same "theme" storage key)
 *   • notifications → bell inside the panel's top-right corner
 *   • role switch (Switch to Student / Back) → sidebar footer account menu
 *   • pathname breadcrumbs → retired (the lit sidebar item orients instead)
 * …EXCEPT the route-scoped URL-contract widgets, which live on in a slim
 * contextual strip at the top of the panel, rendered ONLY where they work:
 *   • /lms/pages/logs → the User/Course Logs ?tab= segmented control
 *   • /lms/pages/logs/report → the back-to-logs button
 *   • workspace pages passing `sidebar`+`onMenuToggle`/`breadcrumb`
 *     (e.g. upload course resources) → hamburger + contextual trail
 * Every other trainer page gets the clean no-navbar panel.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Poppins } from "next/font/google"
import { ArrowLeft, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { StaffSidebar } from "./staff-sidebar"
import { useSyncPermissions } from "@/hooks/useSyncPermissions"
import NotificationBell from "../NotificationBell"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
})

interface StaffLayoutProps {
  children: React.ReactNode
  /**
   * Workspace pages (e.g. upload course resources) own their internal scroll
   * and want the full content box: no padding wrapper, no main scrollbar.
   */
  fullBleed?: boolean
  /**
   * Contextual sidebar override. A workspace page (e.g. the course-content
   * editor) can put its own navigation tree in the shell's sidebar slot so the
   * page has ONE left rail instead of the trainer menu plus a second panel.
   */
  sidebar?: React.ReactNode
  /**
   * Pairs with `sidebar`: the strip's hamburger calls this instead of
   * collapsing the (absent) trainer menu.
   */
  onMenuToggle?: () => void
  /**
   * Contextual breadcrumb rendered in the strip (e.g.
   * "Dashboard › Courses › <course> · LIVE"). Pathname-derived trails are
   * retired; only page-supplied context still renders.
   */
  breadcrumb?: React.ReactNode
  /**
   * A page whose own top row already hosts a NotificationBell (e.g. the
   * course-content editor's tab bar) sets this so the shell's floating
   * corner bell doesn't double up or straddle that row's divider.
   */
  hideCornerBell?: boolean
  /**
   * Skip the shell's built-in `p-4 md:px-6 md:py-5` padding wrapper around
   * children while still letting main scroll (unlike `fullBleed`, which also
   * hides the scrollbar). Pass this when the page already carries its own
   * outer padding — otherwise the two paddings stack and the extra ~2.5rem
   * pushes viewport-tuned tables (User Management's `100dvh - Xrem` calc)
   * past the visible area, forcing a page-level scroll that the admin shell
   * (which has no such wrapper) does not have.
   */
  noBuiltInPadding?: boolean
}

/* Slim contextual strip at the top of the workspace panel. Only rendered on
   routes that genuinely need chrome (URL-contract widgets / workspace pages);
   it also hosts the bell there so the floating corner bell never collides
   with the strip's own controls. */
function PanelStrip({
  onBurger,
  breadcrumb,
  isLogsPage,
  isReportPage,
}: {
  onBurger: () => void
  breadcrumb?: React.ReactNode
  isLogsPage: boolean
  isReportPage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  // ── Logs tab (?tab contract) ──────────────────────────────────────────────
  const [currentLogsTab, setCurrentLogsTab] = useState<"login" | "course">("login")

  useEffect(() => {
    if (isLogsPage) {
      const t = new URLSearchParams(window.location.search).get("tab") || "login"
      setCurrentLogsTab(t as "login" | "course")
    }
  }, [pathname, isLogsPage])

  const handleLogsTab = (tab: "login" | "course") => {
    setCurrentLogsTab(tab)
    router.replace(`${pathname}?tab=${tab}`, { scroll: false } as any)
  }

  return (
    // Two-row header on logs pages: Row 1 carries the "Logs" heading + the
    // notification bell corner; Row 2 carries the User Logs / Course Logs
    // segmented control. Non-logs strips (workspace / report) stay a single
    // row — nothing to stack there.
    // pl-6 (vs the strip's usual px-3) nudges the heading and the switch a
    // bit further from the panel edge; the right side keeps pr-3 so the
    // notification bell stays where it was.
    <div className={cn(
      "flex flex-shrink-0 pl-6 pr-3",
      isLogsPage
        ? "flex-col gap-1.5 pt-2 pb-2"
        : "h-12 items-center gap-1.5"
    )}>
      {/* `w-full` on the inner row so the internal `flex-1` spacer can push
          the notification bell to the far right on non-logs strips (report /
          workspace). Without it the wrapper sizes to its content and the
          bell sits next to the burger instead of the right corner. */}
      <div className="flex w-full items-center gap-1.5">
        {/* Burger stays on mobile so the sidebar overlay can still be
            reopened; hidden on md+ where the sidebar rail is visible and the
            button is just noise next to the "Logs" heading. */}
        <button
          onClick={onBurger}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-body transition-colors duration-150 hover:bg-row-hover md:hidden"
          title="Toggle sidebar"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        {isReportPage && (
          <button
            onClick={() => router.push("/lms/pages/logs?tab=course")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-row-hover"
            title="Back to Log Activity"
          >
            <ArrowLeft className="h-[16px] w-[16px]" />
          </button>
        )}

        {/* Page heading — same size as the User Management title
            (`text-xl sm:text-2xl`) so the baseline reads identically. */}
        {isLogsPage && (
          <h1 className="ml-1 text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em] whitespace-nowrap">
            Logs
          </h1>
        )}

        {breadcrumb ? (
          <div className="ml-1 hidden min-w-0 items-center md:flex">{breadcrumb}</div>
        ) : null}

        <div className="flex-1" />

        <NotificationBell />
      </div>

      {/* Log Activity tabs — writes ?tab= (the logs page reads it). Sits on
          its own row directly under the "Logs" heading rather than inline
          with it. `ml-1` matches the heading's own ml-1 so the switch's left
          edge lines up with the title's left edge on desktop (the burger is
          md:hidden there); mobile keeps the extra 4 px too, which is the
          least of anyone's worries. */}
      {isLogsPage && (
        <div className="ml-1 inline-flex w-fit items-center rounded-control border border-hairline-strong bg-surface p-0.5">
          {([["login", "User Logs"], ["course", "Course Logs"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => handleLogsTab(tab)}
              className={cn(
                "h-7 rounded-[7px] px-3 text-xs font-medium transition-colors duration-150",
                currentLogsTab === tab
                  ? "bg-brand-wash text-brand-strong"
                  : "text-subtle hover:text-body"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function StaffLayout({ children, fullBleed = false, sidebar, onMenuToggle, breadcrumb, hideCornerBell = false, noBuiltInPadding = false }: StaffLayoutProps) {
  // Expanded by default on desktop; collapsed on mobile (admin shell behavior).
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  // Re-fetch this session's permissions on every staff-shell mount so a
  // just-issued grant (from an admin) shows up without a re-login.
  useSyncPermissions()

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsCollapsed(true)
    }
  }, [])

  // On mobile the sidebar is an overlay — close it after navigating.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsCollapsed(true)
    }
  }, [pathname])

  const isLogsPage = pathname === "/lms/pages/logs"
  const isReportPage = pathname === "/lms/pages/logs/report"
  const hasStrip =
    isLogsPage || isReportPage || !!breadcrumb || (!!sidebar && !!onMenuToggle)

  return (
    <div
      className={`${poppins.variable} h-screen flex bg-surface-sunken`}
      style={{ fontFamily: "var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* Full-height sidebar — the trainer menu, or a page-supplied override */}
      <aside className="flex-shrink-0 h-full">
        {sidebar ?? <StaffSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      </aside>

      {/* Floating white workspace on the gray canvas */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3.5 pl-0 max-md:p-2.5 max-md:pl-2.5">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-xs">

          {hasStrip ? (
            <PanelStrip
              onBurger={() => (onMenuToggle ? onMenuToggle() : setIsCollapsed(!isCollapsed))}
              breadcrumb={breadcrumb}
              isLogsPage={isLogsPage}
              isReportPage={isReportPage}
            />
          ) : (
            <>
              {/* Mobile only: reopens the sidebar overlay. */}
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                aria-label="Open navigation"
                className="absolute top-3 left-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body shadow-xs md:hidden"
              >
                <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              {/* Notifications sit inside the panel's top-right corner.
                  z-40: must beat in-page chrome like the uploadcourseresources
                  tab bar, which stacks at z-30 with a solid background.
                  fullBleed pages own their own scroll, so the bell stays
                  pinned (absolute on the panel); non-fullBleed pages get the
                  bell inside the scroll flow so it scrolls up with content
                  instead of hovering over it. */}
              {!hideCornerBell && fullBleed && (
                <div className="absolute top-3 right-4 z-40">
                  <NotificationBell />
                </div>
              )}
            </>
          )}

          {fullBleed ? (
            <main className="min-h-0 flex-1 overflow-hidden">
              {children}
            </main>
          ) : (
            <main className="sc-panel-scroll min-h-0 flex-1 overflow-y-auto">
              {/* Built-in outer padding is opt-out: pages that already handle
                  their own padding (e.g. User Management, whose table sizes
                  itself with a viewport-relative calc) pass noBuiltInPadding
                  so the two paddings don't stack. */}
              {noBuiltInPadding ? (
                !hideCornerBell ? (
                  <div className="relative h-full">
                    <div className="absolute top-3 right-4 z-40">
                      <NotificationBell />
                    </div>
                    {children}
                  </div>
                ) : (
                  children
                )
              ) : (
                <div className="p-4 md:px-6 md:py-5">
                  {!hideCornerBell ? (
                    <div className="relative min-h-full">
                      <div className="absolute -top-1 right-0 z-40">
                        <NotificationBell />
                      </div>
                      {children}
                    </div>
                  ) : (
                    children
                  )}
                </div>
              )}
            </main>
          )}
        </div>
      </div>
    </div>
  )
}
