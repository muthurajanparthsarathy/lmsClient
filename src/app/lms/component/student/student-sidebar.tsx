"use client"

/**
 * Student rail — the SAME sidebar design as the admin/L&D rail
 * (`src/app/lms/component/sidebar.tsx`). Only the menu CONTENT differs: the
 * items here are permission-driven student routes (plus the always-injected
 * Feedback entry) instead of the admin nav tree.
 *
 * Every visual decision below is copied from the admin rail on purpose —
 * geometry (268 / 64 rail, 36px rows, 12px gutters), the semantic design
 * tokens (`bg-surface`, `border-hairline`, `text-heading` …), the 18px Lucide
 * icons at their default stroke, the raised-white active pill, the collapsed
 * tooltips and the identity footer. The old student-only look (Phosphor
 * duotone icons, hardcoded #F97316 label colour, per-shell gray hexes,
 * uppercase section headings) is gone: there is one sidebar design system now,
 * and this file is a second instance of it, not a variant.
 */

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import { notificationsService, notificationKeys } from "@/apiServices/notifications"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as LucideIcons from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  ShieldCheck, Home, User, Bell, BookOpen, FileText, Trophy,
  GraduationCap, Calendar, MessageSquare, MessageCircle, BarChart3, Settings2,
  Clock, Users, Bookmark, Target, Zap, Layers, Award,
  LayoutDashboard, FolderOpen, ClipboardCheck, Video,
  Activity, TrendingUp, Brain, Sparkles, Flame, X, ChevronDown,
  Search, LogOut, Code2,
} from "lucide-react"

interface SidebarItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: string | number
  isActive?: boolean
  permissionKey?: string
  color?: string
  progress?: number
  count?: number
}

interface StudentSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  activeRoute?: string
  /** Renders inside a parent-controlled container (no fixed positioning, no logo duplication issues). */
  embedded?: boolean
  /** When provided, a Sign Out entry is added to the identity menu. */
  onLogout?: () => void
  /** Course syllabus tree, nested under the "Courses" nav item (embedded course-detail view). */
  courseTree?: React.ReactNode
}

interface UserPermission {
  _id: string
  permissionName: string
  permissionKey: string
  permissionFunctionality: string[]
  icon: string
  color: string
  description: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

interface UserData {
  _id: string
  email: string
  firstName: string
  lastName: string
  courses: any[]
  permissions: UserPermission[]
  lastAccessed?: string
  createdAt?: string
  updatedAt?: string
  role?: { _id: string; originalRole: string; renameRole: string; roleValue: string }
  status?: string
}

const USER_DATA_KEY = "smartcliff_userData"

// Rail geometry + the one spring every width/pill move shares. Identical to
// the admin rail (see the note there on why 268 and not 244).
const EXPANDED_W = 268
const COLLAPSED_W = 64
const sidebarSpring = { type: "spring" as const, stiffness: 400, damping: 34 }

const getCurrentUserLocal = (): { valid: boolean; user: UserData | null } => {
  try {
    const userDataString = localStorage.getItem(USER_DATA_KEY)
    if (!userDataString) return { valid: false, user: null }
    const userData: UserData = JSON.parse(userDataString)
    return { valid: true, user: userData }
  } catch {
    return { valid: false, user: null }
  }
}

const getIconByName = (iconName: string): any => {
  if (!iconName) return ShieldCheck
  if (LucideIcons[iconName as keyof typeof LucideIcons]) {
    return LucideIcons[iconName as keyof typeof LucideIcons]
  }
  const iconMappings: Record<string, any> = {
    "dashboard": LayoutDashboard, "home": Home, "courses": BookOpen,
    "assignments": ClipboardCheck, "grades": Trophy, "messages": MessageSquare,
    "notifications": Bell, "resources": FolderOpen, "schedule": Calendar,
    "settings": Settings2, "users": Users, "profile": User,
    "book": BookOpen, "book-open": BookOpen, "file-text": FileText,
    "bar-chart-3": BarChart3, "chart": BarChart3,
    "graduation-cap": GraduationCap, "message-square": MessageSquare,
    "folder": FolderOpen, "clock": Clock, "bookmark": Bookmark,
    "target": Target, "zap": Zap, "layers": Layers, "award": Award,
    "clipboard-check": ClipboardCheck, "video": Video, "activity": Activity,
    "trending-up": TrendingUp, "brain": Brain, "sparkles": Sparkles, "flame": Flame,
  }
  return iconMappings[iconName.toLowerCase()] || ShieldCheck
}

const BASE_PATH = "/lms/pages/"

const routeKeyOf = (href: string) => {
  const route = href.replace(BASE_PATH, '').split('/')[0]
  return route.includes('dashboard') ? 'dashboard' : route
}

// Section grouping config. Like the admin rail, the group HEADINGS are never
// rendered — grouping only fixes the order of a flat list.
const SECTION_GROUPS: Record<string, string[]> = {
  "": ["dashboard"],
  "Learning": ["courses", "codinganalytics", "assignments", "grades", "resources", "feedback"],
  "Connect": ["messages", "notifications", "studentcalendar"],
  "Account": ["profile", "settings", "help", "progress"],
}

// Theme toggle removed — the admin rail carries no theme control at all, so
// keeping one here was the last visible asymmetry between the two shells. Dark
// mode still switches via next-themes if any other UI turns it on; this rail
// simply no longer offers the switch. The Sun/Moon lucide icons and the
// next-themes hook stopped being used in this file with the row's removal.

// Hoisted to module scope so it keeps a stable identity across renders — otherwise
// the nested course tree (passed as children) would remount on every selection.
// The markup below is the admin rail's nav row, verbatim, plus the student's
// unread-count badge.
const SidebarNavItem = ({ item, collapsed, onNavigate, expandable, expanded, onToggle, children }: {
  item: SidebarItem
  collapsed: boolean
  onNavigate: (href: string) => void
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  children?: React.ReactNode
}) => {
  const Icon = item.icon
  const badgeCount = Number(item.badge || 0)
  const isActive = !!item.isActive
  // The collapsed rail has no room for a submenu, so there the parent stays a
  // plain link and the tree is reached through it instead — same rule as admin.
  const isParentToggle = !!expandable && !collapsed

  const row = (
    <div
      onClick={() => (isParentToggle ? onToggle?.() : onNavigate(item.href))}
      role="button"
      tabIndex={0}
      aria-label={item.label}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          isParentToggle ? onToggle?.() : onNavigate(item.href)
        }
      }}
      className={cn(
        "relative flex items-center rounded-[10px] cursor-pointer group transition-colors duration-150 border",
        collapsed
          ? "justify-center w-9 h-9 mx-auto"
          : "justify-between gap-3 pl-3 pr-2 h-9",
        // White raised pill on the gray rail; hover one step darker than the
        // canvas so it stays visible there.
        isActive
          ? "bg-surface border-hairline shadow-xs"
          : "border-transparent hover:bg-line"
      )}
    >
      <div className={cn("flex items-center", collapsed ? "" : "gap-3 min-w-0")}>
        <Icon className={cn(
          "w-[18px] h-[18px] flex-shrink-0",
          isActive ? "text-heading" : "text-subtle group-hover:text-body"
        )} />
        {!collapsed && (
          <span className={cn(
            "text-sm truncate whitespace-nowrap flex items-center gap-1",
            // Both states read in normal weight — the raised white pill +
            // shadow already carries "selected".
            isActive ? "text-heading font-medium" : "text-body font-normal"
          )}>
            {item.label}
          </span>
        )}
      </div>

      {!collapsed && (badgeCount > 0 || isParentToggle) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {badgeCount > 0 && (
            <span className="min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-2xs font-semibold leading-none bg-brand-600 text-white">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
          {isParentToggle && (
            <button
              type="button"
              aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
              aria-expanded={!!expanded}
              onClick={(e) => {
                // Without this the parent row's own click handler fires twice.
                e.stopPropagation()
                onToggle?.()
              }}
              className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
            >
              <ChevronDown className={cn(
                "w-3.5 h-3.5 transition-transform duration-150",
                expanded && "rotate-180",
                isActive ? "text-heading" : "text-faint"
              )} />
            </button>
          )}
        </div>
      )}
    </div>
  )

  // <div>, not <li> — the admin rail (component/sidebar.tsx) uses <div>s here
  // too, and mixing <ul>/<li> in was the last remaining structural asymmetry
  // between the two rails after the class strings were matched. Even with
  // Tailwind preflight, list markup can add a subpixel bit of vertical
  // rhythm from user-agent defaults and inherits `list-style` from any
  // container that redeclares it — enough to make labels read slightly
  // heavier in some browsers, which is exactly what the parity screenshots
  // showed.
  return (
    <div>
      {collapsed ? (
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

      {/* Submenu geometry copied from the admin rail: the rule down the left
          ties the tree to its parent so a long list still reads as one group. */}
      {isParentToggle && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: expanded ? "1fr" : "0fr",
            transition: "grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="mt-0.5 mb-1 ml-[27px] pl-2.5 border-l border-hairline space-y-0.5">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function StudentSidebar({ isOpen = true, onClose, activeRoute, embedded = false, onLogout, courseTree }: StudentSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [menuSearch, setMenuSearch] = useState("")
  const [coursesExpanded, setCoursesExpanded] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  // Desktop rail collapse — same interaction as the admin shell's brand-card
  // chevron. Mobile keeps the drawer behaviour (X button), untouched.
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [studentInfo, setStudentInfo] = useState({
    name: "Loading...",
    role: "Student",
    avatarLetter: "S",
    overallProgress: 0,
    streak: 0,
    enrolledCourses: 0,
  })

  // Collapse only ever applies to the desktop rail; the mobile drawer is
  // always full width (matches the admin rail's isMobile handling).
  const collapsed = !embedded && !isMobile && railCollapsed

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const fetchData = () => {
      try {
        const userDataResponse = getCurrentUserLocal()
        if (!userDataResponse.valid || !userDataResponse.user) {
          setLoading(false)
          return
        }
        const user = userDataResponse.user
        const userCourses = user?.courses || []
        const userAnalytics = calculateUserAnalytics(user, userCourses)
        const items = buildSidebarItems(user, userAnalytics)
        setSidebarItems(items)

        setStudentInfo({
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Student",
          role: user.role?.renameRole || "Student",
          avatarLetter: user.firstName?.charAt(0).toUpperCase() || "S",
          overallProgress: userAnalytics.overallProgress,
          streak: calculateLearningStreak(userCourses),
          enrolledCourses: userAnalytics.enrolledCourses,
        })
      } catch (error) {
        console.error("Error fetching sidebar data:", error)
        setSidebarItems(getDefaultSidebarItems({ enrolledCourses: 0, completedCourses: 0, activeCourses: 0, overallProgress: 0, totalModules: 0, totalTopics: 0, attemptedExercises: 0, attemptedQuestions: 0 }))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const calculateUserAnalytics = (user: UserData | null, userCourses: any[]) => {
    const enrolledCourses = userCourses.length
    const completedCourses = userCourses.filter(c => calculateCourseProgress(c) >= 90).length
    const activeCourses = userCourses.filter(c => { const p = calculateCourseProgress(c); return p > 0 && p < 90 }).length
    const totalProgress = userCourses.reduce((sum, c) => sum + calculateCourseProgress(c), 0)
    const overallProgress = enrolledCourses > 0 ? Math.round(totalProgress / enrolledCourses) : 0
    let totalModules = 0, totalTopics = 0, attemptedExercises = 0, attemptedQuestions = 0
    userCourses.forEach(course => {
      totalModules += course.modules?.length || 0
      totalTopics += course.topics?.length || 0
      course.answers?.We_Do?.practical?.forEach((ex: any) => {
        if (ex.questions?.length) {
          attemptedExercises++
          attemptedQuestions += ex.questions.filter((q: any) => q.status === 'attempted' || q.status === 'evaluated' || q.submittedAt).length
        }
      })
    })
    return { enrolledCourses, completedCourses, activeCourses, overallProgress, totalModules, totalTopics, attemptedExercises, attemptedQuestions }
  }

  const calculateCourseProgress = (course: any) => {
    const practicals = course.answers?.We_Do?.practical
    if (!practicals?.length) return 0
    let attempted = 0, questions = 0
    practicals.forEach((ex: any) => {
      if (ex.questions?.length) {
        attempted++
        questions += ex.questions.filter((q: any) => q.status === 'attempted' || q.status === 'evaluated' || q.submittedAt).length
      }
    })
    return Math.round(((attempted / practicals.length) * 0.4 + (attempted > 0 ? questions / (attempted * 4) : 0) * 0.6) * 100)
  }

  const calculateLearningStreak = (userCourses: any[]) => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return Math.min(userCourses.filter(c => new Date(c.lastAccessed || c.updatedAt || Date.now()) >= lastWeek).length, 7)
  }

  // Rename the label for scope-disambiguated pages (Student Courses /
  // Student Notification / My Profile / …) back to their plain user-facing
  // form for the sidebar — the student's shell doesn't need to see
  // "Student" prefixed on every item.
  const STUDENT_LABEL_OVERRIDES: Record<string, string> = {
    courses: "Courses",
    notifications: "Notification",
    profile: "My Profile",
    codinganalytics: "Coding Analytics",
    grade: "Grade",
    feedback: "Feedback",
    // Every spelling an admin might have seeded for the same module — they
    // all route to the student calendar below, so they must all read the
    // same way in the rail.
    calendar: "Calendar",
    schedule: "Calendar",
    studentcalendar: "Calendar",
  }

  const buildSidebarItems = (user: UserData, userAnalytics: any): SidebarItem[] => {
    if (!user?.permissions?.length) return getDefaultSidebarItems(userAnalytics)
    const sorted = [...user.permissions].filter(p => p.isActive).sort((a, b) => (a.order || 0) - (b.order || 0))
    if (!sorted.length) return getDefaultSidebarItems(userAnalytics)
    const items = sorted.map(permission => {
      const route = permissionKeyToRoute(permission.permissionKey)
      const { count, progress } = getDynamicDataForPermission(permission.permissionKey, userAnalytics)
      // The dashboard permission should always read "Dashboard" and link to the
      // real student dashboard page, regardless of how it's named/keyed in admin data.
      const isDashboard = routeKeyOf(route) === 'dashboard'
      const keyLower = permission.permissionKey?.toLowerCase() || ''
      return {
        icon: getIconByName(permission.icon || "ShieldCheck"),
        label: isDashboard
          ? "Dashboard"
          : STUDENT_LABEL_OVERRIDES[keyLower] || permission.permissionName,
        href: route,
        permissionKey: permission.permissionKey,
        isActive: getIsActive(route),
        count, progress,
        color: permission.color || "orange"
      }
    })
    // Coding Analytics is now a permission-backed tree page
    // (`student-codinganalytics`), so it appears only when granted — the old
    // always-inject shim is gone. If a `codinganalytics` permission is
    // present it flows through the map above naturally.
    //
    // Feedback IS always injected for students: the "Feedback" entry lists
    // every open feedback form on the student's own courses and mirrors the
    // per-course Give-feedback button, so it should never depend on a
    // separate permission being seeded on the user doc. If the admin later
    // seeds a `feedback` permission we still show the item once (dedup by
    // route key), so this never doubles up.
    const feedbackRoute = `${BASE_PATH}feedback`
    const hasFeedback = items.some((it) => it.href === feedbackRoute)
    if (!hasFeedback) {
      items.push({
        icon: MessageCircle,
        label: STUDENT_LABEL_OVERRIDES.feedback || "Feedback",
        href: feedbackRoute,
        permissionKey: "feedback",
        isActive: getIsActive(feedbackRoute),
        count: 0,
        progress: 0,
        color: "orange",
      })
    }

    // Calendar is injected on the same terms as Feedback: the route gate
    // grants /lms/pages/studentcalendar on the student ROLE (providers.tsx)
    // because knowing when there is no class is reference data, not a
    // privilege — and most learner user docs seed only `studentdashboard`,
    // so a permission-gated entry would be missing for everyone already in
    // the system. If a `calendar` / `schedule` / `studentcalendar` grant IS
    // present it flows through the map above to the SAME route, and the
    // dedup below keeps the rail from showing it twice.
    const calendarRoute = `${BASE_PATH}studentcalendar`
    if (!items.some((it) => it.href === calendarRoute)) {
      items.push({
        icon: Calendar,
        label: STUDENT_LABEL_OVERRIDES.studentcalendar,
        href: calendarRoute,
        permissionKey: "studentcalendar",
        isActive: getIsActive(calendarRoute),
        count: 0,
        progress: 0,
        color: "orange",
      })
    }
    return items
  }

  const getDynamicDataForPermission = (key: string, analytics: any) => {
    const k = key.toLowerCase()
    if (k.includes('dashboard')) return { count: 0, progress: analytics.overallProgress }
    if (k.includes('course')) return { count: analytics.enrolledCourses, progress: analytics.overallProgress }
    if (k.includes('assignment') || k.includes('task')) return { count: analytics.attemptedExercises, progress: 0 }
    if (k.includes('progress') || k.includes('analytics')) return { count: analytics.completedCourses, progress: analytics.overallProgress }
    if (k.includes('message') || k.includes('chat')) return { count: 3, progress: 0 }
    if (k.includes('resource') || k.includes('material')) return { count: analytics.totalModules + analytics.totalTopics, progress: 0 }
    if (k.includes('schedule') || k.includes('calendar')) return { count: 2, progress: 0 }
    return { count: 0, progress: 0 }
  }

  const getDefaultSidebarItems = (analytics: any): SidebarItem[] => [
    { icon: LayoutDashboard, label: "Dashboard", href: `${BASE_PATH}studentdashboard`, count: 0, progress: analytics.overallProgress },
    { icon: BookOpen, label: "My Courses", href: `${BASE_PATH}courses`, progress: analytics.overallProgress },
    { icon: Code2, label: "Coding Analytics", href: `${BASE_PATH}codinganalytics`, count: 0, progress: 0 },
    { icon: ClipboardCheck, label: "Assignments", href: `${BASE_PATH}assignments`, count: analytics.attemptedExercises, progress: 0 },
    { icon: Trophy, label: "Grades", href: `${BASE_PATH}grades`, count: analytics.completedCourses, progress: analytics.overallProgress },
    // Student feedback list — every open feedback form on the student's
    // courses, with Give feedback / Done actions. Route: /lms/pages/feedback.
    { icon: MessageCircle, label: "Feedback", href: `${BASE_PATH}feedback`, count: 0, progress: 0 },
    { icon: Bell, label: "Notifications", href: `${BASE_PATH}notifications`, count: 0, progress: 0 },
    { icon: MessageSquare, label: "Messages", href: `${BASE_PATH}messages`, count: 0, progress: 0 },
    { icon: FolderOpen, label: "Resources", href: `${BASE_PATH}resources`, count: analytics.totalModules + analytics.totalTopics, progress: 0 },
    // Calendar, not "Schedule": /lms/pages/schedule has never existed, so the
    // old entry was a dead link. This is the read-only institute + enrolled
    // client holiday calendar.
    { icon: Calendar, label: "Calendar", href: `${BASE_PATH}studentcalendar`, count: 0, progress: 0 },
    { icon: User, label: "Profile", href: `${BASE_PATH}profile`, count: 0, progress: 0 },
  ]

  const permissionKeyToRoute = (permissionKey: string): string => {
    if (!permissionKey) return `${BASE_PATH}studentdashboard`
    let routeKey = permissionKey.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/[_\s]/g, '-')
    const routeMappings: Record<string, string> = {
      // Student sidebar always links its dashboard entry to the real
      // student dashboard page, never the staff dashboard at /lms/pages/dashboard.
      'student-dashboard': 'studentdashboard', 'dashboard': 'studentdashboard',
      'course-overview': 'courses', 'courses': 'courses', 'my-courses': 'courses',
      'assignment-submission': 'assignments', 'assignments': 'assignments',
      'performance-analytics': 'progress', 'analytics': 'progress', 'progress': 'progress',
      'grades': 'grades', 'messages': 'messages', 'message-center': 'messages',
      'resource-library': 'resources', 'resources': 'resources',
      // Calendar/schedule grants all land on the student calendar. They used
      // to route to /lms/pages/schedule, a page that does not exist.
      'study-schedule': 'studentcalendar', 'schedule': 'studentcalendar',
      'calendar': 'studentcalendar', 'student-calendar': 'studentcalendar',
      'studentcalendar': 'studentcalendar',
      'user-profile': 'profile', 'profile': 'profile',
      'notifications': 'notifications', 'alerts': 'notifications',
      // Student feedback list (Give feedback / Done actions per course).
      'feedback': 'feedback', 'student-feedback': 'feedback', 'feedbacks': 'feedback',
    }
    if (routeMappings[routeKey]) routeKey = routeMappings[routeKey]
    return `${BASE_PATH}${routeKey}`
  }

  const { data: notificationsData } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (notificationsData) {
      const unreadCount = notificationsData.unreadCount || 0
      setSidebarItems(prev => prev.map(item => {
        const isNotif = item.label.toLowerCase().includes('notification') || item.permissionKey?.toLowerCase().includes('notification')
        return isNotif ? { ...item, badge: unreadCount > 0 ? unreadCount : undefined } : item
      }))
    }
  }, [notificationsData])

  // Any route containing "dashboard" (dashboard, studentdashboard, ...) counts as the dashboard route
  const normalizeRoute = (route: string) => route.includes('dashboard') ? 'dashboard' : route

  const getIsActive = (href: string) => {
    if (activeRoute) {
      const routePart = href.replace(BASE_PATH, '').split('/')[0]
      return normalizeRoute(routePart) === normalizeRoute(activeRoute.toLowerCase())
    }
    return pathname === href || (href !== '/' && pathname?.startsWith(href))
  }

  useEffect(() => {
    setSidebarItems(prev => prev.map(item => ({ ...item, isActive: getIsActive(item.href) })))
  }, [pathname, activeRoute])

  const handleNavigation = (href: string) => {
    router.push(href)
    if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) onClose()
  }

  // Group existing (permission-driven) items into sections so the order is
  // stable; the headings themselves are never rendered.
  const groupedSections = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    const pool = q ? sidebarItems.filter(i => i.label.toLowerCase().includes(q)) : sidebarItems
    const routeOf = (item: SidebarItem) => normalizeRoute(item.href.replace(BASE_PATH, '').split('/')[0])
    const used = new Set<SidebarItem>()
    const sections = Object.entries(SECTION_GROUPS).map(([title, keys]) => {
      const items = pool.filter(item => {
        if (used.has(item)) return false
        const match = keys.includes(routeOf(item))
        if (match) used.add(item)
        return match
      })
      return { title, items }
    }).filter(s => s.items.length > 0)
    const rest = pool.filter(item => !used.has(item))
    if (rest.length > 0) sections.push({ title: "More", items: rest })
    return sections
  }, [sidebarItems, menuSearch])

  const renderSections = () => (
    groupedSections.map((section, si) => (
      <div key={section.title || si}>
        {/* <div>, not <ul> — matches the admin rail's grouping wrapper so no
            list-style resets need to leak past the sidebar's own scope. */}
        <div className="space-y-0.5">
          {section.items.map(item => {
            const isCoursesTree = embedded && !!courseTree && !menuSearch && routeKeyOf(item.href) === 'courses'
            return (
              <SidebarNavItem
                key={item.permissionKey || item.href}
                item={item}
                collapsed={collapsed}
                onNavigate={handleNavigation}
                expandable={isCoursesTree}
                expanded={isCoursesTree ? coursesExpanded : undefined}
                onToggle={isCoursesTree ? () => setCoursesExpanded(v => !v) : undefined}
              >
                {isCoursesTree ? courseTree : undefined}
              </SidebarNavItem>
            )
          })}
        </div>
      </div>
    ))
  )

  // ── Brand card ────────────────────────────────────────────────────────────
  // A raised white block on the gray rail. It also hosts the collapse toggle,
  // exactly as the admin rail does.
  const brandCard = (withToggle: boolean) => (
    <div className={cn("flex-shrink-0 overflow-hidden", collapsed ? "px-2 pt-3 pb-1" : "px-3 pt-3 pb-1")}>
      <div className={cn(
        "flex items-center rounded-[14px] border border-hairline bg-surface shadow-xs",
        collapsed ? "flex-col gap-1.5 px-1 py-2" : "gap-2.5 px-3 py-2"
      )}>
        <div className="w-8 h-8 bg-gradient-to-b from-brand-400 to-brand-600 rounded-tile flex items-center justify-center flex-shrink-0 shadow-sm">
          <BookOpen className="w-[17px] h-[17px] text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 whitespace-nowrap">
            <p className="text-md font-bold tracking-[-0.01em] text-heading leading-tight">
              SmartCliff
            </p>
            <p className="text-2xs text-subtle truncate leading-tight">
              {studentInfo.role}
            </p>
          </div>
        )}
        {withToggle && (
          <button
            type="button"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            onClick={() => setRailCollapsed(v => !v)}
            className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-body transition-colors"
          >
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-150",
              collapsed ? "-rotate-90" : "rotate-90"
            )} />
          </button>
        )}
      </div>
    </div>
  )

  // ── Nav body ──────────────────────────────────────────────────────────────
  const navBody = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-3 [scrollbar-width:thin]">
      {loading ? (
        <div className="px-4 py-2">
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-ink-100 rounded-lg flex-shrink-0" />
                {!collapsed && <div className="h-3.5 bg-ink-100 rounded w-28" />}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <nav className="px-3 space-y-0.5">
          {renderSections()}
        </nav>
      )}
    </div>
  )

  // ── Identity footer ───────────────────────────────────────────────────────
  const userCard = (
    <div className={cn("flex-shrink-0 border-t border-hairline", collapsed ? "p-2" : "p-3")}>
      <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
        <DropdownMenuTrigger asChild>
          <button
            // Flat identity row (no card box), same as the admin rail.
            className={cn(
              "w-full flex items-center rounded-tile transition-colors duration-150",
              collapsed
                ? "justify-center p-1.5 hover:bg-line"
                : "gap-2.5 p-2 hover:bg-line"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">{studentInfo.avatarLetter}</span>
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left whitespace-nowrap">
                  <p className="text-sm font-semibold text-heading truncate leading-tight">
                    {studentInfo.name}
                  </p>
                  <p className="text-2xs text-subtle truncate leading-tight mt-0.5">
                    {studentInfo.role}
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
          <DropdownMenuItem
            onClick={() => { setShowUserMenu(false); handleNavigation('/lms/pages/studentdashboard/student/profile') }}
            className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
          >
            <User className="w-4 h-4 text-subtle" />
            Profile
          </DropdownMenuItem>
          {onLogout && (
            <>
              <DropdownMenuSeparator className="my-1 bg-hairline" />
              <DropdownMenuItem
                onClick={() => { setShowUserMenu(false); onLogout() }}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-danger-700 rounded-chip hover:bg-danger-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-danger-700" />
                Sign Out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // ── Embedded shell (course-detail view) ───────────────────────────────────
  if (embedded) {
    return (
      <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
        <div className="h-full w-full flex flex-col bg-surface overflow-hidden">
          {brandCard(false)}

          {/* Menu search */}
          <div className="flex-shrink-0 px-3 pb-1 pt-1">
            <div className="flex items-center gap-2 h-9 px-3 rounded-tile bg-surface-sunken border border-hairline focus-within:border-hairline-strong transition-colors">
              <Search className="w-3.5 h-3.5 text-faint flex-shrink-0" />
              <input
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search menu..."
                className="flex-1 min-w-0 bg-transparent text-sm text-body placeholder:text-faint outline-none"
              />
              <kbd className="flex-shrink-0 text-2xs font-semibold text-faint bg-surface border border-hairline rounded-chip px-1.5 py-0.5 leading-none">⌘K</kbd>
            </div>
          </div>

          {navBody}
          {userCard}
        </div>
      </TooltipPrimitive.Provider>
    )
  }

  // ── Standalone shell (dashboard / courses list / etc.) ────────────────────
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={sidebarSpring}
        className={cn(
          // Flat on the gray canvas (floating-workspace shell): no surface, no
          // right border. The mobile drawer keeps a solid surface so content
          // can't bleed through it.
          "relative z-40 h-screen flex flex-col overflow-hidden",
          "md:static md:z-auto md:shrink-0 md:bg-transparent",
          isMobile
            ? cn(
                "fixed top-0 left-0 z-50 shadow-xl bg-surface transition-transform duration-300 ease-out",
                isOpen ? "translate-x-0" : "-translate-x-full"
              )
            : "bg-transparent"
        )}
      >
        {brandCard(!isMobile)}
        {navBody}
        {userCard}
      </motion.aside>

      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface shadow-lg hover:bg-row-hover z-overlay border border-hairline-strong md:hidden"
        >
          <X className="h-5 w-5 text-body" />
        </button>
      )}
    </TooltipPrimitive.Provider>
  )
}

export { getCurrentUserLocal as getCurrentUser }
