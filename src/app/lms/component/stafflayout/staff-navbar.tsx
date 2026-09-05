"use client"

/**
 * Staff (trainer) top bar — pixel-matched to the admin navbar
 * (`component/navbar.tsx`): h-14 token-based header with sidebar toggle,
 * pathname breadcrumb, notification dropdown and the avatar account menu.
 *
 * Preserved trainer contracts from the previous top bar:
 *   • Courses page search writes `?q=` via router.replace (the courses page
 *     reads its filter from the URL).
 *   • Log Activity tabs write `?tab=login|course`.
 *   • Report page gets a back button to `/lms/pages/logs?tab=course`.
 *   • The theme toggle keeps writing localStorage "theme" and flipping the
 *     `dark` class on <html> — every page's dark detection depends on it.
 *   • Switch to Student / Back to role via the shared useAccountMenu hook.
 */

import {
  Bell, User, Settings, Menu, LogOut, HelpCircle,
  Sun, Moon, UserCheck2, Search, X, ArrowLeft, ChevronRight, Loader2,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { getToken } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { notificationsService, notificationKeys } from "@/app/lms/pages/notifications/api/notifications"
import { useAccountMenu } from "../useAccountMenu"

// Known route keys → display names for the breadcrumb; anything unknown is
// title-cased from the raw segment.
const BREADCRUMB_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  uploadcourseresources: "Course Content",
  coursesdetailedview: "Course",
  grades: "Grades",
  notifications: "Notifications",
  logs: "Log Activity",
  report: "Report",
  profile: "Profile",
  attendancemanagement: "Attendance",
  questionbanks: "Question Banks",
  usermanagement: "User Management",
  coursestructure: "Course Management",
  feedback: "Feedback",
  users: "Participants",
}

const titleCaseSegment = (segment: string): string =>
  segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

// Intermediate path segments that are NOT routes of their own (no page.tsx) —
// rendered as plain text instead of a link so the breadcrumb never 404s.
const NON_ROUTE_SEGMENTS = new Set(["users", "coursesdetailedview"])

interface StaffTopBarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  /** When the page overrides the shell sidebar, the hamburger calls this instead. */
  onMenuToggle?: () => void
  /** Contextual breadcrumb that replaces the pathname-derived trail. */
  breadcrumb?: ReactNode
}

export function StaffTopBar({ isCollapsed, setIsCollapsed, onMenuToggle, breadcrumb }: StaffTopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const isCoursesPage = pathname === "/lms/pages/courses"
  const isLogsPage = pathname === "/lms/pages/logs"
  const isReportPage = pathname === "/lms/pages/logs/report"

  // ── Courses search (?q contract) ──────────────────────────────────────────
  const [navSearch, setNavSearch] = useState("")
  const [currentLogsTab, setCurrentLogsTab] = useState<"login" | "course">("login")

  useEffect(() => {
    if (isCoursesPage) {
      const q = new URLSearchParams(window.location.search).get("q") || ""
      setNavSearch(q)
    }
    if (isLogsPage) {
      const t = new URLSearchParams(window.location.search).get("tab") || "login"
      setCurrentLogsTab(t as "login" | "course")
    }
  }, [pathname, isCoursesPage, isLogsPage])

  const handleNavSearch = (val: string) => {
    setNavSearch(val)
    const params = new URLSearchParams()
    if (val) params.set("q", val)
    const query = params.toString()
    router.replace(pathname + (query ? "?" + query : ""), { scroll: false } as any)
  }

  const handleLogsTab = (tab: "login" | "course") => {
    setCurrentLogsTab(tab)
    router.replace(`${pathname}?tab=${tab}`, { scroll: false } as any)
  }

  // ── Theme toggle (localStorage "theme" + html.dark — do not change) ───────
  const [theme, setTheme] = useState<"light" | "dark">("light")
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches
    const init = saved || (sys ? "dark" : "light")
    setTheme(init)
    document.documentElement.classList.toggle("dark", init === "dark")
  }, [])
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    localStorage.setItem("theme", next)
  }

  // ── Account (shared hook: user, role switch, sign-out) ────────────────────
  const {
    user,
    userLoading,
    getUserInitials,
    getFullName,
    isLoggingOut,
    handleLogout,
    isDummyStudent,
    originalRoleInfo,
    isActualStudent,
    switchToStudent,
    switchBackToOriginal,
  } = useAccountMenu()

  // ── Notifications ─────────────────────────────────────────────────────────
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    // Background freshness now that the notifications service no longer
    // self-polls every 5s (shared entry — one interval serves every bell).
    refetchInterval: 30 * 1000,
    enabled: typeof window !== "undefined" && !!getToken(),
  })
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
  const notifications = notificationsData?.notifications || []
  const unreadCount = notificationsData?.unreadCount || 0

  const handleNotificationClick = (notification: any) => {
    markAsReadMutation.mutate(notification._id)
    if (notification.link) router.push(notification.link)
  }

  // ── Breadcrumb from the pathname ──────────────────────────────────────────
  const breadcrumbs = useMemo(() => {
    if (!pathname) return []
    const marker = "/lms/pages/"
    const idx = pathname.indexOf(marker)
    if (idx === -1) return []
    const segments = pathname.slice(idx + marker.length).split("/").filter(Boolean)
    let acc = pathname.slice(0, idx + marker.length - 1)
    return segments.map((segment) => {
      acc += `/${segment}`
      const key = segment.toLowerCase()
      const label = BREADCRUMB_NAMES[key]
        ?? (/^[0-9a-f]{16,}$/i.test(segment) ? "Details" : titleCaseSegment(segment))
      return { label, href: acc, linkable: !NON_ROUTE_SEGMENTS.has(key) }
    })
  }, [pathname])

  const displayRole = isDummyStudent
    ? "Student (preview)"
    : user?.role?.renameRole || originalRoleInfo?.renameRole || "User"

  return (
    <header className="bg-surface border-b border-hairline h-14 flex items-center gap-3 px-4 relative flex-shrink-0">
      {/* Left — sidebar toggle + contextual breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0 relative z-10">
        <button
          onClick={() => (onMenuToggle ? onMenuToggle() : setIsCollapsed(!isCollapsed))}
          className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors duration-150 flex items-center justify-center text-body flex-shrink-0"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        {isReportPage && (
          <button
            onClick={() => router.push("/lms/pages/logs?tab=course")}
            className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors duration-150 flex items-center justify-center text-subtle flex-shrink-0"
            title="Back to Log Activity"
          >
            <ArrowLeft className="w-[16px] h-[16px]" />
          </button>
        )}

        {breadcrumb ? (
          <div className="hidden md:flex items-center min-w-0 ml-1">{breadcrumb}</div>
        ) : breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 min-w-0 ml-1">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                  {index > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                  )}
                  {isLast ? (
                    <span className="text-sm font-medium text-heading truncate">
                      {crumb.label}
                    </span>
                  ) : crumb.linkable ? (
                    <Link
                      href={crumb.href}
                      className="text-sm text-subtle hover:text-heading transition-colors duration-150 truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-subtle truncate">{crumb.label}</span>
                  )}
                </span>
              )
            })}
            {isReportPage && searchParams?.get("student") && (
              <span className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                <span className="text-sm font-medium text-heading truncate">Student</span>
              </span>
            )}
          </nav>
        )}

        {/* Log Activity tabs — writes ?tab= (the logs page reads it) */}
        {isLogsPage && (
          <div className="ml-3 inline-flex items-center rounded-control border border-hairline-strong bg-surface p-0.5 flex-shrink-0">
            {([["login", "User Logs"], ["course", "Course Logs"]] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => handleLogsTab(tab)}
                className={cn(
                  "h-7 px-3 rounded-[7px] text-xs font-medium transition-colors duration-150",
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

      <div className="flex-1" />

      {/* Right — search (courses), theme, notifications, user menu */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Courses search — writes ?q= (the courses page reads it) */}
        {isCoursesPage && (
          <div className="hidden md:flex items-center gap-2.5 w-64 h-9 pl-3 pr-1.5 rounded-control border border-hairline-strong bg-surface focus-within:border-brand-500 transition-colors duration-150">
            <Search className="w-[15px] h-[15px] text-faint flex-shrink-0" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => handleNavSearch(e.target.value)}
              placeholder="Search courses…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-heading placeholder:text-faint"
            />
            {navSearch && (
              <button
                onClick={() => handleNavSearch("")}
                className="p-1 rounded hover:bg-row-hover flex-shrink-0"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5 text-subtle" />
              </button>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light"
            ? <Moon className="w-[18px] h-[18px]" />
            : <Sun className="w-[18px] h-[18px]" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-2xs font-bold bg-danger-500 text-white border-2 border-surface rounded-full p-0 min-w-5">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[340px] bg-surface border border-hairline-strong shadow-lg rounded-xl p-0 overflow-hidden z-popover"
            align="end"
            sideOffset={8}
            forceMount
          >
            <div className="px-4 py-3 border-b border-hairline flex justify-between items-center bg-canvas">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-heading">Notifications</span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-wash px-1.5 text-2xs font-semibold text-brand-strong">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-brand-strong hover:text-brand-800 text-xs font-medium transition-colors duration-150"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto [scrollbar-width:thin]">
              {notificationsLoading ? (
                <div className="p-6 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-subtle" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-tile bg-brand-wash">
                    <Bell className="h-5 w-5 text-brand-strong" />
                  </div>
                  <p className="text-sm font-medium text-heading">All caught up</p>
                  <p className="mt-0.5 text-xs text-subtle">No notifications right now.</p>
                </div>
              ) : (
                notifications.map((notification: any) => (
                  <DropdownMenuItem
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-none transition-colors duration-150 cursor-pointer border-b border-hairline last:border-b-0",
                      !notification.isRead
                        ? "bg-brand-wash hover:bg-brand-wash-hover"
                        : "hover:bg-row-hover"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                      !notification.isRead ? "bg-brand" : "bg-ink-300"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        !notification.isRead ? "text-heading" : "text-body"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-subtle mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.createdAt && (
                        <p className="text-2xs text-faint mt-1">
                          {new Date(notification.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2 border-t border-hairline bg-canvas">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs font-medium text-subtle hover:text-heading"
                  onClick={() => router.push("/lms/pages/notifications")}
                >
                  View all notifications
                </Button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full hover:bg-row-hover transition-colors p-0 ml-0.5"
              disabled={userLoading}
            >
              {userLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="relative inline-flex">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(user as any)?.profile} alt={getFullName()} />
                    <AvatarFallback className="bg-brand-strong text-white font-semibold text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 rounded-full ring-2 ring-surface" />
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 bg-surface border border-hairline-strong shadow-lg rounded-tile p-2 z-popover"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal p-0 mb-2">
              <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-chip">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={(user as any)?.profile} alt={getFullName()} />
                  <AvatarFallback className="bg-brand-strong text-white font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-semibold text-heading truncate">{getFullName()}</p>
                  <p className="text-xs text-subtle truncate">{user?.email || "Loading..."}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-success-500 rounded-full" />
                    <span className="text-xs" style={{ color: "var(--color-success-700)" }}>
                      {displayRole}
                    </span>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            {/* Role switch — preview as student / back to original role */}
            {!isActualStudent && !isDummyStudent && (
              <DropdownMenuItem
                onClick={switchToStudent}
                className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <UserCheck2 className="w-4 h-4 text-subtle" />
                <span className="text-sm text-body">Switch to Student</span>
              </DropdownMenuItem>
            )}
            {isDummyStudent && (
              <DropdownMenuItem
                onClick={switchBackToOriginal}
                className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <UserCheck2 className="w-4 h-4 text-subtle" />
                <span className="text-sm text-body">
                  Back to {originalRoleInfo?.renameRole || "original role"}
                </span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              onClick={() => router.push("/lms/pages/profile")}
            >
              <User className="w-4 h-4 text-subtle" />
              <span className="text-sm text-body">My Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
              <Settings className="w-4 h-4 text-subtle" />
              <span className="text-sm text-body">Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
              <HelpCircle className="w-4 h-4 text-subtle" />
              <span className="text-sm text-body">Help & Support</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-hairline-strong" />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 p-3 rounded-chip hover:bg-danger-50 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-danger-700" />
              )}
              <span className="text-sm text-body">
                {isLoggingOut ? "Signing Out..." : "Sign Out"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
