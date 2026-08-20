"use client"

/**
 * Staff (trainer) sidebar — pixel-matched to the admin sidebar
 * (`component/sidebar.tsx`): 244/64px spring-animated rail, h-14 workspace
 * block, brand-wash active rows with the sliding left rail, collapsed
 * tooltips, and the bordered user card at the bottom.
 *
 * What stays trainer-specific: the menu is still built from the user's
 * permission documents (`smartcliff_userData.permissions`, filtered isActive,
 * ordered), routed through the same keyToRoute mapping the old staff sidebar
 * used, with Log Activity injected for non-student roles and the live unread
 * badge on the Notifications item.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as LucideIcons from "lucide-react"
import {
  ShieldCheck, Home, User as UserIcon, Bell, BookOpen, FileText, Trophy,
  GraduationCap, Calendar, MessageSquare, BarChart3, Settings2,
  Clock, Users, Bookmark, Target, Zap, Layers, Award,
  LayoutDashboard, FolderOpen, ClipboardCheck, Video,
  Activity, TrendingUp, Brain, Sparkles, Flame, X,
  HelpCircle, ChevronDown, LogOut, Loader2, Sun, Moon, UserCheck2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAccountMenu } from "../useAccountMenu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery } from "@tanstack/react-query"
import { notificationsService, notificationKeys } from "@/apiServices/notifications"
import { getToken } from "@/lib/session"
import { logoutUser } from "@/apiServices/tokenVerify"
import { postLogout } from "@/apiServices/activityLog"
// ONE grouping for every shell. This rail used to carry its own copy, which is
// why the same nav rendered in a different order with items in different
// sections depending on which page you were on.
import {
  groupSidebarItems,
  canonicalPermissionKey,
  makeSidebarTitler,
  grantedSectionChildren,
  QUESTION_BANK_SECTION,
  PERMISSION_ROUTES,
} from "@/app/lms/shared/ui/navItems"

// ─── Types + user data ───────────────────────────────────────────────────────

interface SidebarItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: string | number
  permissionKey?: string
  // Nested submenu items (Question Bank → Internal / External). Same shape as
  // the parent so the render loop can reuse the row template. Only used by
  // items that split into tabs; every other item leaves this undefined.
  children?: SidebarItem[]
}

interface UserPermission {
  _id: string; permissionName: string; permissionKey: string
  permissionFunctionality: string[]; icon: string; color: string
  description: string; isActive: boolean; order: number
}

interface UserData {
  _id: string; email: string; firstName: string; lastName: string
  courses: any[]; permissions: UserPermission[]
  role?: { _id: string; originalRole: string; renameRole: string; roleValue: string }
  status?: string
}

const USER_DATA_KEY = "smartcliff_userData"
const BASE_PATH = "/lms/pages/"

const getCurrentUserLocal = (): { valid: boolean; user: UserData | null } => {
  try {
    const s = localStorage.getItem(USER_DATA_KEY)
    if (!s) return { valid: false, user: null }
    return { valid: true, user: JSON.parse(s) }
  } catch {
    return { valid: false, user: null }
  }
}

// ─── Icon + route derivation (carried over from the previous staff sidebar) ──

const getIconByName = (iconName: string): any => {
  if (!iconName) return ShieldCheck
  if (LucideIcons[iconName as keyof typeof LucideIcons]) return LucideIcons[iconName as keyof typeof LucideIcons]
  const m: Record<string, any> = {
    dashboard: LayoutDashboard, home: Home, courses: BookOpen, assignments: ClipboardCheck,
    grades: Trophy, messages: MessageSquare, notifications: Bell, resources: FolderOpen,
    schedule: Calendar, settings: Settings2, users: Users, profile: UserIcon, book: BookOpen,
    "book-open": BookOpen, "file-text": FileText, "bar-chart-3": BarChart3, chart: BarChart3,
    "graduation-cap": GraduationCap, "message-square": MessageSquare, folder: FolderOpen,
    clock: Clock, bookmark: Bookmark, target: Target, zap: Zap, layers: Layers, award: Award,
    "clipboard-check": ClipboardCheck, video: Video, activity: Activity, "trending-up": TrendingUp,
    brain: Brain, sparkles: Sparkles, flame: Flame, students: Users, analytics: BarChart3,
    "help-circle": HelpCircle,
  }
  return m[iconName.toLowerCase()] || ShieldCheck
}

const keyToRoute = (k: string): string => {
  if (!k) return `${BASE_PATH}dashboard`
  // Modules whose page is NOT at /lms/pages/<key> resolve through the SHARED
  // map first. This rail's own table below knows nothing about them — it would
  // dash-normalize "pocdashboard" into /lms/pages/poc-dashboard, a 404, for
  // any POC who lands on a StaffLayout page (Courses, Feedback, …) while
  // holding the POC Dashboard module.
  const shared = PERMISSION_ROUTES[canonicalPermissionKey(k)]
  if (shared) return shared
  // Canonicalize first: "course_management" is a legacy spelling of the
  // "coursestructure" ROUTE key, and the dash-normalizer below would otherwise
  // turn it into /lms/pages/course-management — a page that does not exist.
  let r = canonicalPermissionKey(k).replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "").replace(/[_\s]/g, "-")
  const m: Record<string, string> = {
    "student-dashboard": "dashboard", dashboard: "dashboard",
    "course-overview": "courses", courses: "courses", "my-courses": "courses",
    "assignment-submission": "assignments", assignments: "assignments",
    "performance-analytics": "progress", analytics: "analytics", progress: "progress",
    grades: "grades", messages: "messages", "message-center": "messages",
    "resource-library": "resources", resources: "resources",
    "study-schedule": "schedule", schedule: "schedule", calendar: "schedule",
    "user-profile": "profile", profile: "profile",
    notifications: "notifications", alerts: "notifications",
    students: "students", settings: "settings", help: "help",
    logs: "logs", "log-activity": "logs", "activity-log": "logs",
  }
  if (m[r]) r = m[r]
  return `${BASE_PATH}${r}`
}

// Sections come from `navItems.ts` — see `groupSidebarItems` there. The private
// table that used to live here is gone deliberately: two tables meant two
// answers to "which section is Course Management in?".

// Rail geometry + the one spring every width/pill move shares (admin values).
const EXPANDED_W = 244
const COLLAPSED_W = 64
const sidebarSpring = { type: "spring" as const, stiffness: 400, damping: 34 }

/* Light/dark control — lived in the removed StaffTopBar, which was the only
   writer of html.dark. next-themes (mounted in app/layout.tsx with the same
   "theme" storage key) owns the class now, so saved preferences carry over. */
function StaffThemeRow() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"
  const btn = (on: boolean) => cn(
    "inline-flex h-6 w-7 items-center justify-center rounded-full transition-colors",
    on ? "bg-surface text-brand-strong shadow-xs" : "text-faint hover:text-body"
  )
  return (
    <div className="mb-2 flex items-center justify-between px-2">
      <span className="text-2xs font-semibold uppercase tracking-wide text-faint">Theme</span>
      <div className="inline-flex gap-0.5 rounded-full bg-line p-0.5" role="group" aria-label="Colour theme">
        <button type="button" aria-pressed={mounted ? !isDark : undefined} onClick={() => setTheme("light")} className={btn(mounted && !isDark)}>
          <Sun className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="sr-only">Light</span>
        </button>
        <button type="button" aria-pressed={mounted ? isDark : undefined} onClick={() => setTheme("dark")} className={btn(isDark)}>
          <Moon className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="sr-only">Dark</span>
        </button>
      </div>
    </div>
  )
}

interface StaffSidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

export function StaffSidebar({ isCollapsed, setIsCollapsed }: StaffSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // Open state for expandable parents (e.g. Question Bank → Internal /
  // External). Default per parent is "open" so the tabs are visible without
  // having to expand them first — same behavior as the admin sidebar.
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  // Role preview (Switch to Student / Back to role) — used to live in the
  // removed top bar's avatar menu; the footer account menu absorbs it.
  const { isDummyStudent, originalRoleInfo, isActualStudent, switchToStudent, switchBackToOriginal } = useAccountMenu()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Build the menu from the user's permission docs (same rules as before the
  // restyle: isActive filter, order sort, keyToRoute mapping, Log Activity
  // injected for non-student roles).
  useEffect(() => {
    try {
      const r = getCurrentUserLocal()
      if (!r.valid || !r.user) return
      const u = r.user
      setCurrentUser(u)

      const perms = [...(u.permissions || [])]
        .filter((p) => p.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      // Labels come from the SHARED override map (shared/navRoutes.ts), the
      // same one the admin rail uses. It strips the scope prefix the catalog
      // needs for the permission modal — "Trainer Profile" → "Profile",
      // "Staff Dashboard" → "Dashboard" — because this shell already tells you
      // whose console you are in. This rail used to keep a private copy of the
      // map, which is how a module ended up under two different names
      // depending on which page you were on.
      const titleFor = makeSidebarTitler(perms.map((p) => p.permissionKey))

      const items: SidebarItem[] = perms.map((p) => ({
        icon: getIconByName(p.icon || "ShieldCheck"),
        label: titleFor(p.permissionKey, p.permissionName),
        href: keyToRoute(p.permissionKey),
        permissionKey: p.permissionKey,
      }))

      // Log Activity is now a permission-driven sidebar item — the tree page
      // `staff-logactivity` (key "log-activity") appears here only when the
      // trainer was granted it. No hardcoded injection.

      // Question Bank → one expandable entry over its two grantable pages.
      // The children come from the SHARED section spec (shared/navRoutes.ts),
      // the same one the admin rail builds from, and only the pages this
      // account actually holds are listed. Both shells used to hardcode this
      // submenu separately, with both children pinned on regardless of grants.
      const qbChildren = grantedSectionChildren(
        QUESTION_BANK_SECTION,
        perms.map((p) => p.permissionKey),
      )
      if (qbChildren.length > 0) {
        const qbKeys = QUESTION_BANK_SECTION.children.map((c) => c.key)
        const qbIdx = items.findIndex((i) =>
          qbKeys.includes(canonicalPermissionKey(i.permissionKey)),
        )
        const merged: SidebarItem = {
          icon: getIconByName(QUESTION_BANK_SECTION.iconName),
          label: QUESTION_BANK_SECTION.title,
          // Parent opens the first child held — Internal when granted, which
          // is what every existing bookmark and in-app link (Course Setup,
          // exercise authoring, …) already targets.
          href: qbChildren[0].href,
          permissionKey: QUESTION_BANK_SECTION.parentKey,
          children: qbChildren.map((c) => ({
            icon: getIconByName(c.iconName),
            label: c.title,
            href: c.href,
            permissionKey: c.key,
          })),
        }
        const rest = items.filter(
          (i) => !qbKeys.includes(canonicalPermissionKey(i.permissionKey)),
        )
        rest.splice(qbIdx, 0, merged)
        items.length = 0
        items.push(...rest)
      }

      // "Report" — the standalone Performance Report (the same report the L&D
      // console owns, rendered without the L&D shell). Injected for every
      // staff-shell account rather than permission-driven: the trainer's
      // client/course pickers are scoped to their own enrolled courses on the
      // page itself, so there is nothing here an extra grant would guard.
      if (!items.some((i) => i.href === "/lms/pages/reports/performance")) {
        const notifIdx = items.findIndex((i) =>
          canonicalPermissionKey(i.permissionKey).includes("notification"),
        )
        const reportItem: SidebarItem = {
          icon: getIconByName("bar-chart-3"),
          label: "Report",
          href: "/lms/pages/reports/performance",
          permissionKey: "reports",
        }
        if (notifIdx >= 0) items.splice(notifIdx, 0, reportItem)
        else items.push(reportItem)
      }

      setSidebarItems(items)
    } catch (e) {
      console.error("Error loading user data for sidebar:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Live unread badge on the Notifications item.
  const { data: nData } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    // Background freshness now that the notifications service no longer
    // self-polls every 5s (shared entry — one interval serves every bell).
    refetchInterval: 30_000,
    enabled: typeof window !== "undefined" && !!getToken(),
  })
  useEffect(() => {
    if (!nData) return
    const u = nData.unreadCount || 0
    setSidebarItems((prev) =>
      prev.map((i) => {
        const isNotif =
          i.label.toLowerCase().includes("notification") ||
          i.permissionKey?.toLowerCase().includes("notification")
        return isNotif ? { ...i, badge: u > 0 ? u : undefined } : i
      })
    )
  }, [nData])

  const onRoute = (href: string) => pathname === href || pathname?.startsWith(href + "/")

  const handleItemClick = (item: SidebarItem) => {
    if (isMobile) setIsCollapsed(true)
    router.push(item.href)
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    const token = getToken()
    try {
      // postLogout must run while the token is still stored — it records the
      // session duration in the activity log.
      await postLogout()
      if (token) await logoutUser(token)
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith("smartcliff") || key.includes("rq-cache") || key.includes("react-query") || key.includes("tanstack"))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
      window.location.href = "/login"
    }
  }

  const userFullName = currentUser
    ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "User"
    : "User"
  const userRoleLabel = currentUser?.role?.renameRole || currentUser?.role?.originalRole || "User"
  const userInitial = (currentUser?.firstName?.charAt(0) || "U").toUpperCase()

  // Same sections, same order, same buckets as the admin sidebar — one shared
  // implementation, keeping permission order inside each group and dropping
  // empty ones.
  const navGroups = groupSidebarItems(sidebarItems)

  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
      <motion.div
        initial={false}
        animate={{ width: isCollapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={sidebarSpring}
        className={cn(
          // Flat on the gray canvas (floating-workspace shell): no surface, no
          // right border. The mobile overlay keeps a solid surface.
          "relative z-40 h-full flex flex-col overflow-hidden",
          isMobile && !isCollapsed ? "fixed top-0 left-0 shadow-xl bg-surface" : "bg-transparent"
        )}
      >
        {/* Brand card — a raised white block on the gray rail. It also hosts
            the collapse toggle (previously the navbar's hamburger). */}
        <div className={cn("flex-shrink-0 overflow-hidden", isCollapsed ? "px-2 pt-3 pb-1" : "px-3 pt-3 pb-1")}>
          <div className={cn(
            "flex items-center rounded-[14px] border border-hairline bg-surface shadow-xs",
            isCollapsed ? "flex-col gap-1.5 px-1 py-2" : "gap-2.5 px-3 py-2"
          )}>
            <div className="w-8 h-8 bg-gradient-to-b from-brand-400 to-brand-600 rounded-tile flex items-center justify-center flex-shrink-0 shadow-sm">
              <BookOpen className="w-[17px] h-[17px] text-white" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 whitespace-nowrap">
                <p className="text-md font-bold tracking-[-0.01em] text-heading leading-tight">
                  SmartCliff
                </p>
                <p className="text-2xs text-subtle truncate leading-tight">
                  {userRoleLabel}
                </p>
              </div>
            )}
            <button
              type="button"
              aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-body transition-colors"
            >
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform duration-150",
                isCollapsed ? "-rotate-90" : "rotate-90"
              )} />
            </button>
          </div>
        </div>

        {/* Scrollable middle: grouped nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-3 [scrollbar-width:thin]">
          {loading ? (
            <div className="px-4 py-2">
              <div className="animate-pulse space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-ink-100 rounded-lg flex-shrink-0" />
                    {!isCollapsed && <div className="h-3.5 bg-ink-100 rounded w-28" />}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <nav className="px-3 space-y-0.5">
              {/* Group labels are not rendered — a flat list, matching the
                  app's other rails. groupSidebarItems still orders the items. */}
              {navGroups.map((group) => (
                <div key={group.label}>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      // Children carry real routes, so the parent counts as
                      // active when ANY of its pages is open — its own href
                      // only points at the first child.
                      const isActive = onRoute(item.href) ||
                        (item.children || []).some((c) => onRoute(c.href))
                      const itemKey = item.permissionKey || item.href
                      const badge = item.badge !== undefined && Number(item.badge) > 0
                        ? (Number(item.badge) > 99 ? "99+" : item.badge)
                        : undefined
                      // The collapsed rail has no room for a submenu — pages
                      // are reached via the parent link there.
                      const subItems = isCollapsed ? [] : (item.children || [])
                      // Section tabs (Internal / External) show by default so
                      // the submenu is visible without expanding; the chevron
                      // still lets the user collapse it.
                      const submenuOpen = subItems.length > 0 && (openMenus[itemKey] ?? true)

                      const row = (
                        <div
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "relative flex items-center rounded-[10px] cursor-pointer group transition-colors duration-150 border",
                            isCollapsed
                              ? "justify-center w-9 h-9 mx-auto"
                              : "justify-between gap-3 pl-3 pr-2 h-9",
                            // White raised pill carries selection alone now —
                            // the sliding left rail and the trailing dot are
                            // retired with it.
                            isActive
                              ? "bg-surface border-hairline shadow-xs"
                              : "border-transparent hover:bg-line"
                          )}
                        >
                          <div className={cn("flex items-center", isCollapsed ? "" : "gap-3 min-w-0")}>
                            <Icon className={cn(
                              "w-[18px] h-[18px] flex-shrink-0",
                              isActive
                                ? "text-brand-strong"
                                : "text-subtle group-hover:text-body"
                            )} />
                            {!isCollapsed && (
                              <span className={cn(
                                "text-sm truncate whitespace-nowrap",
                                isActive
                                  ? "text-brand-strong font-semibold"
                                  : "text-body font-medium"
                              )}>
                                {item.label}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && subItems.length > 0 && (
                            <button
                              type="button"
                              aria-label={submenuOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                              aria-expanded={submenuOpen}
                              onClick={(e) => {
                                // Without this the parent row's own click
                                // handler would navigate away as it opens.
                                e.stopPropagation()
                                setOpenMenus((prev) => ({ ...prev, [itemKey]: !submenuOpen }))
                              }}
                              className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
                            >
                              <ChevronDown className={cn(
                                "w-3.5 h-3.5 transition-transform duration-150",
                                submenuOpen && "rotate-180",
                                isActive ? "text-brand-strong" : "text-faint"
                              )} />
                            </button>
                          )}
                          {!isCollapsed && subItems.length === 0 && badge !== undefined && (
                            <span className={cn(
                              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold flex-shrink-0",
                              isActive
                                ? "bg-brand text-white"
                                : "bg-brand-wash text-brand-strong"
                            )}>
                              {badge}
                            </span>
                          )}
                        </div>
                      )

                      return (
                        <div key={itemKey}>
                          {isCollapsed ? (
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                {row}
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content
                                  side="right"
                                  sideOffset={12}
                                  className="z-popover rounded-chip bg-ink-800 px-3 py-1.5 text-xs font-medium text-white shadow-md whitespace-nowrap select-none"
                                >
                                  {item.label}
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          ) : (
                            row
                          )}

                          {/* Section tabs — same border-l treatment as the
                              admin sidebar so both shells present submenus
                              identically. */}
                          {submenuOpen && (
                            <div className="mt-0.5 mb-1 ml-[27px] pl-2.5 border-l border-hairline space-y-0.5">
                              {subItems.map((child) => {
                                const ChildIcon = child.icon
                                const childActive = onRoute(child.href)
                                return (
                                  <div
                                    key={child.href}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleItemClick(child)
                                    }}
                                    className={cn(
                                      "flex items-center gap-2.5 h-8 px-2 rounded-[8px] cursor-pointer group transition-colors duration-150 border",
                                      childActive
                                        ? "bg-surface border-hairline shadow-xs"
                                        : "border-transparent hover:bg-line"
                                    )}
                                  >
                                    <ChildIcon className={cn(
                                      "w-[15px] h-[15px] flex-shrink-0",
                                      childActive
                                        ? "text-brand-strong"
                                        : "text-faint group-hover:text-body"
                                    )} />
                                    <span className={cn(
                                      "text-sm truncate whitespace-nowrap",
                                      childActive
                                        ? "text-brand-strong font-semibold"
                                        : "text-body font-medium"
                                    )}>
                                      {child.label}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* Footer — theme control + flat identity row, reference-style */}
        <div className={cn("flex-shrink-0 border-t border-hairline", isCollapsed ? "p-2" : "p-3")}>
          {!isCollapsed && <StaffThemeRow />}
          <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center rounded-tile transition-colors duration-150",
                  isCollapsed
                    ? "justify-center p-1.5 hover:bg-line"
                    : "gap-2.5 p-2 hover:bg-line"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">{userInitial}</span>
                </div>
                {!isCollapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left whitespace-nowrap">
                      <p className="text-sm font-semibold text-heading truncate leading-tight">
                        {userFullName}
                      </p>
                      <p className="text-2xs text-subtle truncate leading-tight mt-0.5">
                        {userRoleLabel}
                      </p>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-faint flex-shrink-0 transition-transform duration-150",
                      showUserMenu && "rotate-180"
                    )} />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-52 bg-surface border border-hairline-strong rounded-tile shadow-lg p-1.5 z-popover"
            >
              {/* Role preview — relocated from the removed top bar. */}
              {!isActualStudent && !isDummyStudent && (
                <DropdownMenuItem
                  onClick={() => { setShowUserMenu(false); switchToStudent() }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
                >
                  <UserCheck2 className="w-4 h-4 text-brand-strong" />
                  Switch to Student
                </DropdownMenuItem>
              )}
              {isDummyStudent && originalRoleInfo && (
                <DropdownMenuItem
                  onClick={() => { setShowUserMenu(false); switchBackToOriginal() }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-brand-strong" />
                  Back to {originalRoleInfo.renameRole || "your role"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => { setShowUserMenu(false); router.push("/lms/pages/profile") }}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-subtle" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-hairline" />
              <DropdownMenuItem
                onSelect={(e) => {
                  // Keep the menu open so the signing-out spinner is visible
                  // until the redirect lands.
                  e.preventDefault()
                  handleSignOut()
                }}
                disabled={isLoggingOut}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-danger-700 rounded-chip hover:bg-danger-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isLoggingOut
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <LogOut className="w-4 h-4 text-danger-700" />}
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {isMobile && !isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 right-4 w-10 h-10 rounded-full bg-surface shadow-lg hover:bg-row-hover z-overlay border border-hairline-strong"
          onClick={() => setIsCollapsed(true)}
        >
          <X className="h-5 w-5" />
        </Button>
      )}

      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </TooltipPrimitive.Provider>
  )
}

export { getCurrentUserLocal as getCurrentUser }
