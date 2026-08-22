"use client"

import {
  Bell, User, Settings, Menu, Sparkles, ChevronDown,
  Search, X, LogOut, HelpCircle, MessageSquare, Zap,
  Sun, Moon, UserCheck2
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { notificationsService } from "@/apiServices/notifications"
import { postLogout } from "@/apiServices/activityLog"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { staffRouteForCurrentCourse, studentRouteForCurrentCourse } from "../useAccountMenu"
import { notificationKeys } from "@/apiServices/notifications"
import { getCurrentUser } from "@/apiServices/tokenVerify"
import { cn } from "@/lib/utils"
import { clearAllStorage } from "@/lib/session"

interface StudentNavbarProps {
  onMenuClick?: () => void
  onAIClick?: () => void
  onSummaryClick?: () => void
  isSidebarOpen?: boolean
  activeRoute?: string
}

interface CurrentUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  role: { roleName: string; renameRole: string }
  institution: { institutionName: string }
  isActive: boolean
}

interface RoleSwitchState {
  isDummyStudent: boolean
  originalRole?: string
  originalRenameRole?: string
  switchTimestamp?: number
}

// Brand accent (matches reference dashboard design)
const ACCENT = "#F97316"

const ROUTE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  assignments: "Assignments",
  grades: "Grades",
  notifications: "Notifications",
  messages: "Messages",
  resources: "Resources",
  schedule: "Schedule",
  progress: "Progress",
  profile: "Profile",
  settings: "Settings",
  ai: "AI Assistant",
}

export function StudentNavbar({ onMenuClick, onAIClick, onSummaryClick, isSidebarOpen = true, activeRoute }: StudentNavbarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showAISubmenu, setShowAISubmenu] = useState(false)
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isDummyStudent, setIsDummyStudent] = useState(false)
  const [originalRoleInfo, setOriginalRoleInfo] = useState<{ roleName: string; renameRole: string } | null>(null)

  const notificationRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const pageTitle = ROUTE_TITLES[activeRoute || 'dashboard'] || 'Dashboard'

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    if (initialTheme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    checkDummyStudentStatus()
  }, [])

  const checkDummyStudentStatus = () => {
    try {
      const storedRoleSwitch = localStorage.getItem('smartcliff_roleSwitch')
      if (storedRoleSwitch) {
        const roleSwitchData: RoleSwitchState = JSON.parse(storedRoleSwitch)
        setIsDummyStudent(roleSwitchData.isDummyStudent || false)
        if (roleSwitchData.originalRole || roleSwitchData.originalRenameRole) {
          setOriginalRoleInfo({ roleName: roleSwitchData.originalRole || '', renameRole: roleSwitchData.originalRenameRole || '' })
        }
      }
    } catch (error) {}
  }

  useEffect(() => {
    const handleStorageChange = () => checkDummyStudentStatus()
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    if (newTheme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', newTheme)
  }

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem("smartcliff_token"),
  })
  const user: CurrentUser | null = userData?.user || null

  const { data: notificationsData } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.markAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotificationsDropdown(false)
      if (aiRef.current && !aiRef.current.contains(event.target as Node)) setShowAISubmenu(false)
      if (userRef.current && !userRef.current.contains(event.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

// Helper function to clear all localStorage items including React Query cache
const clearLocalStorage = () => {
  // Sign-out wipe. The old hand-maintained key list only covered
  // `smartcliff_*` and cache keys, so everything else the app writes
  // survived into the next session. See clearAllStorage in lib/session.
  clearAllStorage()
}

// Helper function to clear React Query cache
const clearReactQueryCache = () => {
  try {
    // Clear the React Query client cache
    queryClient.clear()
    queryClient.cancelQueries()
    queryClient.removeQueries()

    // Remove React Query persisted cache from localStorage
    const reactQueryKeys = [
      "smartcliff:rq-cache:v1",
      "rq-cache:v1",
      "react-query:cache",
      "tanstack:cache",
      "smartcliff:rq-cache",
      "smartcliff_persist_cache",
      "persist:smartcliff:rq-cache",
      "smartcliff:react-query",
      "REACT_QUERY_OFFLINE_CACHE"
    ]

    reactQueryKeys.forEach(key => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key) // Also check sessionStorage
    })

    // Remove any other cache items that might be in localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.includes('rq-cache') ||
        key.includes('react-query') ||
        key.includes('tanstack') ||
        key.includes('smartcliff:rq') ||
        key.includes('persist') ||
        key.includes('cache') ||
        key.includes('offline')
      )) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // Clear sessionStorage too
    const sessionKeysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (
        key.includes('rq-cache') ||
        key.includes('react-query') ||
        key.includes('tanstack') ||
        key.includes('smartcliff') ||
        key.includes('cache')
      )) {
        sessionKeysToRemove.push(key)
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key))

    console.log('React Query cache cleared successfully')
  } catch (error) {
    console.error('Error clearing React Query cache:', error)
  }
}

const handleLogout = async () => {
  setIsLoggingOut(true)
  try {
    // Clear React Query cache first
    clearReactQueryCache()

    // Call logout API
    await postLogout()

    // Clear all localStorage items (this will remove everything)
    clearLocalStorage()

    // Clear sessionStorage as well
    sessionStorage.clear()

    // One more pass to ensure everything is cleared
    setTimeout(() => {
      clearReactQueryCache()
      clearLocalStorage()
    }, 100)

    toast.success("Logged out successfully")

    // Use window.location for a full page reload to ensure clean state
    window.location.href = "/login"
    // router.push("/login") // Replace with the above if you want a full reload

  } catch (error) {
    // Ensure cache is cleared even on error
    clearReactQueryCache()
    clearLocalStorage()
    sessionStorage.clear()
    toast.error("Logout failed")

    // Still redirect on error
    setTimeout(() => {
      window.location.href = "/login"
    }, 1000)
  } finally {
    setIsLoggingOut(false)
  }
}

 const handleProfileClick = () => {
    setShowUserMenu(false)
    router.push("/lms/pages/studentdashboard/student/profile")
  }

  const handleSwitchToStudent = () => {
    try {
      const roleSwitchData: RoleSwitchState = {
        isDummyStudent: true,
        originalRole: user?.role?.roleName || '',
        originalRenameRole: user?.role?.renameRole || '',
        switchTimestamp: Date.now()
      }
      localStorage.setItem('smartcliff_roleSwitch', JSON.stringify(roleSwitchData))
      localStorage.setItem('smartcliff_isDummyStudent', 'true')
      setIsDummyStudent(true)
      setOriginalRoleInfo({ roleName: user?.role?.roleName || '', renameRole: user?.role?.renameRole || '' })
      setShowUserMenu(false)
      toast.success("Switched to Student View")
      router.push(studentRouteForCurrentCourse())
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch (error) {
      toast.error("Failed to switch role")
    }
  }

  const handleSwitchBackToOriginal = () => {
    try {
      localStorage.removeItem('smartcliff_roleSwitch')
      localStorage.removeItem('smartcliff_isDummyStudent')
      setIsDummyStudent(false)
      setOriginalRoleInfo(null)
      setShowUserMenu(false)
      toast.success(`Switched back to ${originalRoleInfo?.renameRole || 'your original role'}`)
      const backToCourse = staffRouteForCurrentCourse()
      if (backToCourse) router.push(backToCourse)
      else {
        const originalRole = originalRoleInfo?.renameRole?.toLowerCase() || ''
        if (originalRole.includes('poc')) router.push("/lms/pages/poc/dashboard")
        else if (originalRole.includes('admin')) router.push("/lms/pages/admin/dashboard")
        else router.push("/lms/pages/dashboard")
      }
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch (error) {
      toast.error("Failed to switch role")
    }
  }

  const getUserInitials = () => {
    if (!user) return "SC"
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase()
  }

  const isActualStudent = () => {
    if (!user) return false
    if (user.role?.roleName?.toLowerCase().includes('student')) return true
    if (user.role?.renameRole?.toLowerCase().includes('student')) return true
    return false
  }

  const actualStudent = isActualStudent()
  const notifications = notificationsData?.notifications || []
  const unreadCount = notificationsData?.unreadCount || 0

  return (
    <>
      {/* Mobile search overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex items-center px-4 border-b border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search anything..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400"
          />
          <button onClick={() => setShowMobileSearch(false)} className="p-1.5 ml-2">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      <header className={cn(
        "fixed top-0 right-0 z-40 h-[64px] bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800/80 transition-[left] duration-300 ease-out",
        isSidebarOpen ? "left-0 md:left-[224px]" : "left-0"
      )}>
        <div className="flex h-full items-center px-4 lg:px-5 gap-4">

          {/* LEFT: hamburger + page title */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
            {/* <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
              {pageTitle}
            </h1> */}
          </div>

          {/* CENTER: Search */}
          <div className="flex-1 max-w-lg mx-auto hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                type="text"
                placeholder="Search anything..."
                className="w-full h-9 pl-9 pr-9 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:bg-white dark:focus:bg-gray-800 focus:border-orange-300 dark:focus:border-orange-600 focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center text-2xs text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 font-mono">
                /
              </kbd>
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">

            {/* Mobile Search */}
            <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setShowMobileSearch(true)}>
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* AI Button */}
            <div className="relative hidden sm:block" ref={aiRef}>
              <button
                onClick={() => setShowAISubmenu(!showAISubmenu)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border",
                  showAISubmenu
                    ? "text-white border-transparent"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:text-orange-600 dark:hover:border-orange-600 dark:hover:text-orange-400"
                )}
                style={showAISubmenu ? { background: `linear-gradient(135deg, ${ACCENT}, #FDBA74)` } : undefined}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask AI
                <ChevronDown className={cn("w-3 h-3 opacity-60 transition-transform", showAISubmenu ? "rotate-180" : "")} />
              </button>

              {showAISubmenu && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-lg shadow-gray-100 dark:shadow-gray-950 ring-1 ring-gray-100 dark:ring-gray-800 p-1.5 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                  <button onClick={onAIClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-left group transition-colors">
                    <div className="w-7 h-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-white">Chat Assistant</p>
                      <p className="text-2xs text-gray-400">Ask anything instantly</p>
                    </div>
                  </button>
                  <button onClick={onSummaryClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left group transition-colors">
                    <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-white">Summarize</p>
                      <p className="text-2xs text-gray-400">Condense current content</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors hidden sm:flex"
            >
              {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            </button>

            {/* Notifications */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className={cn(
                  "relative p-2 rounded-lg transition-colors",
                  showNotificationsDropdown
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-0 right-0 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full text-white text-2xs font-bold"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-lg shadow-gray-100 dark:shadow-gray-950 ring-1 ring-gray-100 dark:ring-gray-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && <p className="text-2xs text-gray-400 mt-0.5">{unreadCount} unread</p>}
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllAsReadMutation.mutate()} className="text-2xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-6 h-6 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No notifications</p>
                      </div>
                    ) : notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markAsReadMutation.mutate(n._id)}
                        className={cn(
                          "px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 cursor-pointer transition-colors flex gap-3",
                          !n.isRead ? "bg-orange-50/40 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        )}
                      >
                        <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0", !n.isRead ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-600")} />
                        <div className="min-w-0">
                          <p className={cn("text-xs leading-tight", !n.isRead ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-500 dark:text-gray-400")}>
                            {n.title}
                          </p>
                          <p className="text-2xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

            {/* User Menu */}
            <div ref={userRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={cn(
                  "flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl transition-colors",
                  showUserMenu ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {userLoading ? (
                  <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                ) : (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-2xs font-bold shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
                  >
                    {getUserInitials()}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-800 dark:text-white hidden lg:block">
                  {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Student'}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 hidden lg:block transition-transform", showUserMenu ? "rotate-180" : "")} />
              </button>

              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-lg shadow-gray-100 dark:shadow-gray-950 ring-1 ring-gray-100 dark:ring-gray-800 z-50 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
                      >
                        {getUserInitials()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
                        <p className="text-2xs text-gray-400 truncate">{user?.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={cn(
                            "inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md",
                            isDummyStudent ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                          )}>
                            {isDummyStudent ? '⚡ Student View' : user?.role?.renameRole || 'Account'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5">
                    {/* Switch to Student */}
                    {!actualStudent && !isDummyStudent && (
                      <button
                        onClick={handleSwitchToStudent}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-left transition-colors mb-1 group"
                      >
                        <div className="w-7 h-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                          <UserCheck2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Switch to Student</p>
                          <p className="text-2xs text-gray-400">Preview student experience</p>
                        </div>
                      </button>
                    )}

                    {/* Switch back */}
                    {isDummyStudent && originalRoleInfo && (
                      <button
                        onClick={handleSwitchBackToOriginal}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left transition-colors mb-1 group"
                      >
                        <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Back to {originalRoleInfo.renameRole}</p>
                          <p className="text-2xs text-gray-400">Return to original role</p>
                        </div>
                      </button>
                    )}

                    <div className="h-px bg-gray-100 dark:bg-gray-800 mx-1 my-1" />

                    <button onClick={handleProfileClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">My Profile</span>
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors">
                      <Settings className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Settings</span>
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Help & Support</span>
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-left transition-colors group"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-400 group-hover:text-red-500" />
                      <span className="text-xs font-semibold text-red-500 dark:text-red-400">
                        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
