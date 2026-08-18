"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import { notificationsService, notificationKeys } from "@/apiServices/notifications"
import { useQuery } from "@tanstack/react-query"
import * as LucideIcons from "lucide-react"

import {
  ShieldCheck, Home, User, Bell, BookOpen, FileText, Trophy,
  GraduationCap, Calendar, MessageSquare, BarChart3, Settings2,
  Clock, Users, Bookmark, Target, Zap, Layers, Award,
  LayoutDashboard, FolderOpen, ClipboardCheck, Video,
  Activity, TrendingUp, Brain, Sparkles, Flame, X, ChevronDown, ChevronUp,
  Crown, Search, LogOut, Sun, Moon, Code2
} from "lucide-react"
import { useTheme } from "next-themes"

import {
  SquaresFour, Books, ClipboardText, Trophy as TrophyDuo, Bell as BellDuo,
  ChatCircleText, FolderOpen as FolderOpenDuo, CalendarBlank, UserCircle,
  ChartBar, House, Code as CodeDuo,
} from "@phosphor-icons/react"

// Colorful duotone icons for known nav routes — falls back to the plain
// (possibly admin-configured) Lucide icon for anything not in this map.
const DUOTONE_ICON_MAP: Record<string, any> = {
  dashboard: SquaresFour,
  courses: Books,
  codinganalytics: CodeDuo,
  assignments: ClipboardText,
  grades: TrophyDuo,
  notifications: BellDuo,
  messages: ChatCircleText,
  resources: FolderOpenDuo,
  schedule: CalendarBlank,
  profile: UserCircle,
  progress: ChartBar,
}

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
  /** When provided, a Logout row is rendered at the very bottom. */
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
const THEME_KEY = "theme"

// Brand accent (matches reference dashboard design)
const ACCENT = "#F97316"

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

const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  const storedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark'
  if (storedTheme) return storedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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

// Section grouping config — first group renders without a heading (like the reference design)
const SECTION_GROUPS: Record<string, string[]> = {
  "": ["dashboard"],
  "Learning": ["courses", "codinganalytics", "assignments", "grades", "resources"],
  "Connect": ["messages", "notifications", "schedule"],
  "Account": ["profile", "settings", "help", "progress"],
}

/* Light/dark control — lived in the removed StudentNavbar. next-themes is
   mounted in app/layout.tsx, so this stays in sync with the other shells. */
function ThemeRow() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"
  const btn = (on: boolean) => cn(
    "inline-flex h-6 w-7 items-center justify-center rounded-full transition-colors",
    on ? "bg-white dark:bg-[#17181C] text-[#F97316] shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
  )
  return (
    <div className="flex items-center justify-between px-4 pt-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">Theme</span>
      <div className="inline-flex gap-0.5 rounded-full bg-[#E7E9EE] p-0.5 dark:bg-gray-800" role="group" aria-label="Colour theme">
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

// Hoisted to module scope so it keeps a stable identity across renders — otherwise
// the nested course tree (passed as children) would remount on every selection.
const SidebarNavItem = ({ item, onNavigate, expandable, expanded, onToggle, children }: {
  item: SidebarItem
  onNavigate: (href: string) => void
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  children?: React.ReactNode
}) => {
  const Icon = item.icon
  const DuoIcon = DUOTONE_ICON_MAP[routeKeyOf(item.href)]
  const badgeCount = item.badge || 0
  return (
    <li>
      <button
        onClick={() => (expandable ? onToggle?.() : onNavigate(item.href))}
        className={cn(
          "group w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] border transition-all duration-150 text-left",
          item.isActive
            // White raised pill on the gray rail (floating-workspace language)
            ? "bg-white dark:bg-[#17181C] border-[#E4E7EC] dark:border-[#2A2D34] shadow-[0_1px_2px_rgba(16,24,40,.06)]"
            : "border-transparent text-gray-600 dark:text-gray-300 hover:bg-[#E9EBF0] dark:hover:bg-[#1C1E23] hover:text-gray-900 dark:hover:text-gray-100"
        )}
      >
        {DuoIcon ? (
          <DuoIcon
            size={19}
            weight="duotone"
            className="flex-shrink-0 transition-colors"
            color={item.isActive ? "#F97316" : "#9CA3AF"}
          />
        ) : (
          <Icon
            className={cn(
              "flex-shrink-0 w-[17px] h-[17px] transition-colors",
              item.isActive ? "text-[#F97316] dark:text-orange-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
            )}
            strokeWidth={item.isActive ? 2.2 : 2}
          />
        )}

        <span className={cn(
          "flex-1 text-[13px] transition-colors truncate",
          item.isActive ? "font-semibold text-[#F97316] dark:text-orange-300" : "font-medium"
        )}>
          {item.label}
        </span>

        {Number(badgeCount) > 0 && (
          <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold bg-[#F97316] text-white shadow-sm">
            {Number(badgeCount) > 99 ? '99+' : badgeCount}
          </span>
        )}

        {expandable && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0 text-[#F97316]" strokeWidth={2.4} />
            : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" strokeWidth={2.4} />
        )}
      </button>

      {expandable && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: expanded ? "1fr" : "0fr",
            transition: "grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="mt-1">{children}</div>
          </div>
        </div>
      )}
    </li>
  )
}

export function StudentSidebar({ isOpen = true, onClose, activeRoute, embedded = false, onLogout, courseTree }: StudentSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [menuSearch, setMenuSearch] = useState("")
  const [coursesExpanded, setCoursesExpanded] = useState(true)
  // Desktop rail collapse — same interaction as the L&D shell's brand-card
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
    { icon: Bell, label: "Notifications", href: `${BASE_PATH}notifications`, count: 0, progress: 0 },
    { icon: MessageSquare, label: "Messages", href: `${BASE_PATH}messages`, count: 0, progress: 0 },
    { icon: FolderOpen, label: "Resources", href: `${BASE_PATH}resources`, count: analytics.totalModules + analytics.totalTopics, progress: 0 },
    { icon: Calendar, label: "Schedule", href: `${BASE_PATH}schedule`, count: 2, progress: 0 },
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
      'study-schedule': 'schedule', 'schedule': 'schedule', 'calendar': 'schedule',
      'user-profile': 'profile', 'profile': 'profile',
      'notifications': 'notifications', 'alerts': 'notifications',
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

  // Group existing (permission-driven) items into titled sections like the reference design.
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

  // Thin scrollbar shared by both shells
  const ScrollStyle = (
    <style dangerouslySetInnerHTML={{ __html: `
      .sc-sb-scroll::-webkit-scrollbar{width:5px}
      .sc-sb-scroll::-webkit-scrollbar-track{background:transparent}
      .sc-sb-scroll::-webkit-scrollbar-thumb{background:#e2e5ea;border-radius:8px}
      .sc-sb-scroll::-webkit-scrollbar-thumb:hover{background:#cbd0d8}
    `}} />
  )

  if (loading) {
    const skeleton = (
      <>
        <div className="flex h-[60px] items-center flex-shrink-0 px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl shadow-sm" style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }} />
            <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </>
    )
    if (embedded) return <div className="h-full w-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">{skeleton}</div>
    return (
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[224px] flex-col border-r border-gray-100 bg-white md:static md:z-auto md:shrink-0 md:border-r-0 md:bg-transparent dark:border-gray-800 dark:bg-gray-950 md:dark:bg-transparent">
        {skeleton}
      </aside>
    )
  }


  const renderSections = () => (
    groupedSections.map((section, si) => (
      // Group HEADINGS are not rendered (matches the L&D rail) — the grouping
      // only orders the items; a flat list keeps the rail clean and short.
      <div key={section.title || si} className={cn(si > 0 && "mt-1")}>
        <ul className="space-y-0.5">
          {section.items.map(item => {
            const isCoursesTree = embedded && !!courseTree && !menuSearch && routeKeyOf(item.href) === 'courses'
            return (
              <SidebarNavItem
                key={item.permissionKey || item.href}
                item={item}
                onNavigate={handleNavigation}
                expandable={isCoursesTree}
                expanded={isCoursesTree ? coursesExpanded : undefined}
                onToggle={isCoursesTree ? () => setCoursesExpanded(v => !v) : undefined}
              >
                {isCoursesTree ? courseTree : undefined}
              </SidebarNavItem>
            )
          })}
        </ul>
      </div>
    ))
  )

  // (The "Start your streak" promo card was removed from the rail — the space
  // goes to navigation; streak data still powers the dashboard stats.)

  const userCard = (
    <div className="px-4 pt-2">
      <button
        onClick={() => handleNavigation('/lms/pages/studentdashboard/student/profile')}
        // Flat identity row (no card box) pinned at the rail's bottom-left,
        // matching the reference's avatar + name + chevron footer.
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-[#E9EBF0] dark:hover:bg-[#1C1E23] transition-colors"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
        >
          {studentInfo.avatarLetter}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate leading-tight">{studentInfo.name}</p>
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{studentInfo.role}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
    </div>
  )

  const logoutRow = onLogout ? (
    <div className="px-4 pt-1.5 pb-3">
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
      >
        <LogOut className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-medium">Logout</span>
      </button>
    </div>
  ) : (
    <div className="h-4" />
  )

  // Brand card — a raised white block on the gray rail, like the reference.
  // `withToggle` adds the collapse chevron (standalone shell only; the
  // embedded course rail has its own geometry) — same 24px ghost button and
  // 14px chevron as the L&D shell's brand card.
  const logoRow = (withToggle = false) => (
    <div className="flex-shrink-0 px-3 pt-3 pb-1">
      <div className={cn(
        "flex items-center gap-2.5 rounded-[14px] border border-[#E4E7EC] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,.04)] dark:border-[#2A2D34] dark:bg-[#17181C]",
        withToggle && railCollapsed && "md:flex-col md:gap-1.5 md:px-1.5 md:py-2"
      )}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
        >
          <BookOpen className="w-[18px] h-[18px] text-white" />
        </div>
        {!(withToggle && railCollapsed) && (
          <div className="min-w-0">
            <span className="block text-[15px] font-extrabold tracking-tight leading-tight text-gray-900 dark:text-white">
              SmartCliff
            </span>
            <span className="block text-[10.5px] leading-tight text-gray-400 dark:text-gray-500">
              Student
            </span>
          </div>
        )}
        {withToggle && (
          <button
            type="button"
            onClick={() => setRailCollapsed(v => !v)}
            aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!railCollapsed}
            className={cn(
              "hidden md:inline-grid place-items-center w-6 h-6 rounded-[7px] flex-shrink-0 text-gray-400 hover:bg-[#E9EBF0] hover:text-gray-600 dark:hover:bg-[#1C1E23] dark:hover:text-gray-300 transition-colors",
              !railCollapsed && "ml-auto"
            )}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {railCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
            </svg>
          </button>
        )}
      </div>
    </div>
  )

  // Collapsed rail — icon-only items, tooltip = label, same active pill.
  const renderCollapsedRail = () => (
    <ul className="space-y-1">
      {groupedSections.flatMap(s => s.items).map(item => {
        const Icon = item.icon
        return (
          <li key={item.permissionKey || item.href}>
            <button
              onClick={() => handleNavigation(item.href)}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "w-full flex items-center justify-center py-2.5 rounded-[10px] border transition-all duration-150",
                item.isActive
                  ? "bg-white dark:bg-[#17181C] border-[#E4E7EC] dark:border-[#2A2D34] shadow-[0_1px_2px_rgba(16,24,40,.06)]"
                  : "border-transparent hover:bg-[#E9EBF0] dark:hover:bg-[#1C1E23]"
              )}
            >
              <Icon
                className={cn("w-[17px] h-[17px]", item.isActive ? "text-[#F97316] dark:text-orange-400" : "text-gray-400 dark:text-gray-500")}
                strokeWidth={item.isActive ? 2.2 : 2}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )

  // ── Embedded shell (course-detail view): logo + menu search + nested course tree + logout ──
  if (embedded) {
    return (
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
        {ScrollStyle}
        {logoRow()}

        {/* Menu search */}
        <div className="px-4 pb-1 pt-0.5 flex-shrink-0">
          <div className="flex items-center gap-2 h-9 px-3 rounded-[10px] bg-[#f5f6f8] dark:bg-gray-900 border border-[#eef0f3] dark:border-gray-800 focus-within:border-orange-300 dark:focus-within:border-orange-700 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
            <input
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder="Search menu..."
              className="flex-1 min-w-0 bg-transparent text-[12.5px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none"
            />
            <kbd className="flex-shrink-0 text-[10px] font-semibold text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 leading-none">⌘K</kbd>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-2 sc-sb-scroll">
          {renderSections()}
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 pt-0.5">
          {userCard}
          {logoutRow}
        </div>
      </div>
    )
  }

  // ── Standalone shell (dashboard / courses list / etc.) ──
  return (
    <>
      {ScrollStyle}
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/30 z-40 md:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={cn(
        // Mobile: overlay drawer with a solid surface. Desktop (md+): static
        // and FLAT on the gray canvas — no card, no border — so the gray
        // flows uninterrupted from the rail around the white workspace panel.
        "fixed left-0 top-0 z-50 h-screen w-[224px]",
        railCollapsed && "md:w-[76px]",
        "flex flex-col transform transition-all duration-300 ease-out",
        "bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800",
        "md:static md:z-auto md:shrink-0 md:transform-none md:border-r-0 md:bg-transparent md:dark:bg-transparent",
        isOpen ? "translate-x-0" : "max-md:-translate-x-full"
      )}>

        {/* Logo header (desktop) — carries the collapse chevron */}
        <div className="hidden md:block">{logoRow(true)}</div>

        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
            >
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">SmartCliff</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation (permission-driven items; flat, no group headings) */}
        <div className={cn("flex-1 overflow-y-auto py-2 sc-sb-scroll", railCollapsed ? "px-4 md:px-2.5" : "px-4")}>
          <div className={railCollapsed ? "max-md:block md:hidden" : undefined}>{renderSections()}</div>
          {railCollapsed && <div className="hidden md:block">{renderCollapsedRail()}</div>}
        </div>

        {railCollapsed ? (
          <>
            {/* Collapsed footer: avatar only (mobile drawer keeps the full footer) */}
            <div className="md:hidden"><ThemeRow />{userCard}</div>
            <div className="hidden md:flex justify-center pb-3 pt-2">
              <button
                onClick={() => handleNavigation('/lms/pages/studentdashboard/student/profile')}
                title={studentInfo.name}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shadow-sm"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
              >
                {studentInfo.avatarLetter}
              </button>
            </div>
          </>
        ) : (
          <>
            <ThemeRow />
            {userCard}
          </>
        )}
        <div className="h-4" />
      </aside>
    </>
  )
}

export { getCurrentUserLocal as getCurrentUser }
