"use client"

import { Loading } from "@/components/loading-ui/loading"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  User, Mail, Phone, Calendar, BookOpen,
  GraduationCap, Building, Users, FileText,
  Clock, Edit, Shield, Award,
  CheckCircle, Activity, Briefcase,
  ChevronRight, Home, Star,
  TrendingUp, Bell, Flame, School,
  UserCheck, BadgeCheck, MoreVertical, Zap
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"

import { StudentLayout } from "@/app/lms/component/student/student-layout"
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout"
import DashboardLayout from "@/app/lms/component/layout"
import { useProfileUserStatsQuery } from "@/queries/profileStats"
import { courseStructuresSummaryQuery } from "@/apiServices/createCourseStucture"
import EditProfileModal from "./EditProfileModal"

// The Performance tab is the student dashboard's OWN metrics engine, re-read
// on this page — not a second implementation of the same numbers. Everything
// it renders comes out of buildDashboard(), so Profile → Performance and the
// dashboard can never drift apart or disagree about a percentage.
import { useCurrentUserQuery } from "@/queries/auth"
import {
  useStudentAnalyticsQuery,
  useMyAttendanceQuery,
  useMyLearningTimeQuery,
  attendanceWindow,
  getUserSpecificAnalytics,
} from "@/queries/studentDashboard"
import {
  buildDashboard,
  idStr,
  shortDuration,
  type DashboardModel,
  type StageStats,
  type CourseModel,
} from "@/app/lms/pages/studentdashboard/_lib/metrics"

interface UserData {
  _id: string; email: string; firstName: string; lastName: string;
  phone: string; gender: string; profile: string; degree: string;
  department: string; year: string; semester: string; batch: string;
  status: string; institution: { $oid: string };
  role: { _id: string; originalRole: string; renameRole: string; roleValue: string };
  createdAt: string; updatedAt: string; createdBy: string;
  notes: any[]; permissions: any[]; notifications: any[]; courses: any[]; __v?: number;
}

interface DashboardStats {
  users: {
    total: number;
    students: number;
    staff: number;
    admin: number;
  };
  courses: {
    total: number;
    active: number;
    inactive: number;
  };
  recentActivities: {
    newUsers: number;
    newCourses: number;
    activeUsers: number;
  };
  institution: string;
}

const USER_DATA_KEY = "smartcliff_userData"
const ROLE_VALUE_KEY = "smartcliff_roleValue"

// Admin roles - users with these roles get admin access
const ADMIN_ROLES = ['admin', 'ldhead', 'subhead', 'programcoordinator']

// Staff roles - users with these roles get staff access
const STAFF_ROLES = ['poc', 'trainer']

const getUserRole = (): string => {
  try {
    const roleValue = localStorage.getItem(ROLE_VALUE_KEY)
    if (roleValue) {
      const normalizedRole = roleValue.toLowerCase()
      
      // Check for admin roles first
      if (ADMIN_ROLES.includes(normalizedRole)) {
        return 'admin'
      }
      
      // Check for staff roles
      if (STAFF_ROLES.includes(normalizedRole)) {
        return 'staff'
      }
      
      if (normalizedRole === 'student') {
        return 'student'
      }
      
      console.log(`Unrecognized role: ${normalizedRole}, defaulting to staff check`)
    }
    
    const userDataStr = localStorage.getItem(USER_DATA_KEY)
    if (userDataStr) {
      const userData: UserData = JSON.parse(userDataStr)
      if (userData.role) {
        const roleFromData = (userData.role.roleValue || 
                             userData.role.originalRole || 
                             userData.role.renameRole || '').toLowerCase()
        
        // Check for admin roles
        if (ADMIN_ROLES.includes(roleFromData)) {
          return 'admin'
        }
        
        // Check for staff roles
        if (STAFF_ROLES.includes(roleFromData)) {
          return 'staff'
        }
        
        if (roleFromData === 'student') {
          return 'student'
        }
      }
    }
    
    return 'student'
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'student'
  }
}

const getOriginalRoleName = (): string => {
  try {
    const roleValue = localStorage.getItem(ROLE_VALUE_KEY)
    if (roleValue) {
      return roleValue
    }
    
    const userDataStr = localStorage.getItem(USER_DATA_KEY)
    if (userDataStr) {
      const userData: UserData = JSON.parse(userDataStr)
      if (userData.role) {
        return userData.role.renameRole || userData.role.originalRole || userData.role.roleValue || 'Staff'
      }
    }
    
    return 'Staff Member'
  } catch (error) {
    console.error('Error getting original role name:', error)
    return 'Staff Member'
  }
}

const getCurrentUser = (): { valid: boolean; user: UserData | null } => {
  try {
    const userDataStr = localStorage.getItem(USER_DATA_KEY)
    if (!userDataStr) return { valid: false, user: null }
    
    const userData: UserData = JSON.parse(userDataStr)
    return { valid: true, user: userData }
  } catch (error) {
    console.error('Error getting current user:', error)
    return { valid: false, user: null }
  }
}

const calcProgress = (course: any) => {
  const assignments = course.answers?.We_Do?.assignments || []
  if (!assignments.length) return 0
  let total = 0, attempted = 0, solved = 0
  assignments.forEach((a: any) => a.questions?.forEach((q: any) => {
    total++
    if (['attempted','solved','submitted'].includes(q.status)) attempted++
    if (q.status === 'solved') solved++
  }))
  return total === 0 ? 0 : Math.round((attempted / total) * 60 + (solved / total) * 40)
}

export default function ProfilePage() {
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [userDataLoading, setUserDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("personal")
  const [editOpen, setEditOpen] = useState(false)
  const [userRole, setUserRole] = useState<string>("")
  const [originalRoleName, setOriginalRoleName] = useState<string>("")

  useEffect(() => {
    const loadUserData = () => {
      try {
        const role = getUserRole()
        const originalRole = getOriginalRoleName()
        setUserRole(role)
        setOriginalRoleName(originalRole)

        const { valid, user } = getCurrentUser()

        if (!valid || !user) {
          router.push("/login")
          return
        }

        setUserData(user)
      } catch (error) {
        console.error('Error loading user data:', error)
        router.push("/login")
      } finally {
        setUserDataLoading(false)
      }
    }

    loadUserData()

    const handleStorageChange = () => {
      const newRole = getUserRole()
      const newOriginalRole = getOriginalRoleName()
      setUserRole(newRole)
      setOriginalRoleName(newOriginalRole)

      const { valid, user } = getCurrentUser()
      if (valid && user) {
        setUserData(user)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router])

  // Admin-only dashboard stats. Both reads are independent (RQ fires them in
  // parallel, unlike the old sequential `await` pair) and share their cache
  // with the rest of the app: the courses summary rides the same
  // ['courseStructures','summary'] key as the coursestructure page,
  // servicemapping wizard, and grades — a repeat Profile visit within the
  // staleTime window paints instantly instead of re-fetching.
  const isAdminRole = userRole === 'admin'
  const usersQuery = useProfileUserStatsQuery(isAdminRole ? (userData?.institution as any) : null)
  const coursesQuery = useQuery({
    ...courseStructuresSummaryQuery(),
    enabled: isAdminRole && !!userData?.institution,
  })

  // ── Student performance ───────────────────────────────────────────────────
  // Same four reads the student dashboard makes, in the same order, off the
  // same cache keys — so opening Profile after the dashboard costs nothing and
  // the two surfaces always show identical figures.
  //
  // Gated on the role the way the admin block above is: every one of these
  // queries is `enabled: !!userId`, so passing null for staff/admin keeps them
  // from ever firing. The hooks themselves stay unconditional, which is what
  // the rules of hooks require — only their inputs change.
  const isStudentRole = userRole === 'student'
  const { data: meUser, isLoading: meLoading } = useCurrentUserQuery()
  const perfStudentId = isStudentRole ? idStr((meUser as any)?.user?._id) : ''

  const { data: perfAnalytics, isLoading: perfAnalyticsLoading } =
    useStudentAnalyticsQuery(perfStudentId || null)

  const perfCourses = useMemo(
    () => (perfAnalytics && perfStudentId
      ? getUserSpecificAnalytics(perfAnalytics, perfStudentId)?.userCourses || []
      : []),
    [perfAnalytics, perfStudentId],
  )

  // Stable for the life of the page — recomputing per render would mint a new
  // query key every time.
  const perfWindow = useMemo(() => attendanceWindow(), [])
  const perfCourseIds = useMemo(() => perfCourses.map((c: any) => idStr(c?._id)), [perfCourses])
  const { records: perfAttendance } = useMyAttendanceQuery(perfCourseIds, perfStudentId || null, perfWindow)
  const { data: perfLearningTime = null } = useMyLearningTimeQuery(perfStudentId || null)

  const performance: DashboardModel | null = useMemo(
    () => (isStudentRole && meUser
      ? buildDashboard(meUser, perfCourses, perfAttendance, perfLearningTime)
      : null),
    [isStudentRole, meUser, perfCourses, perfAttendance, perfLearningTime],
  )

  // Attendance and study time fill in after; only the analytics read gates the
  // panel, exactly as on the dashboard.
  const perfLoading = isStudentRole && (meLoading || (!!perfStudentId && perfAnalyticsLoading))

  const dashboardStats: DashboardStats | null = (() => {
    if (!isAdminRole || !usersQuery.data || !coursesQuery.data) return null
    // The user figures are counted in Mongo now (`?stats=1`) instead of by
    // walking the whole roster here — see queries/profileStats.ts. The bucket
    // rules, the raw-status test for activeUsers and the 30-day window are all
    // ports of the loop that used to live here, checked against it over live
    // data: identical on all six numbers.
    const userStats = usersQuery.data
    const allCourses = coursesQuery.data as any[]

    const activeCourses = allCourses.filter((c: any) => c.status === 'active').length
    const inactiveCourses = allCourses.filter((c: any) => c.status === 'inactive').length

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const newCourses = allCourses.filter((c: any) => new Date(c.createdAt) >= thirtyDaysAgo).length

    return {
      users: {
        total: userStats.total,
        students: userStats.students,
        staff: userStats.staff,
        admin: userStats.admin
      },
      courses: {
        total: allCourses.length,
        active: activeCourses,
        inactive: inactiveCourses
      },
      recentActivities: {
        newUsers: userStats.newUsers,
        newCourses,
        activeUsers: userStats.activeUsers
      },
      institution: String(userData?.institution || '')
    }
  })()

  // Preserves the page's original behavior: for admin users the full-page
  // spinner used to block until both stats calls resolved (they were
  // sequential `await`s in the old code). Cold loads still block the same
  // way; a repeat visit within the queries' staleTime has cached data
  // already, so isLoading is false immediately and the block disappears —
  // that's the actual win here, not a change to what's shown.
  const loading = userDataLoading || (isAdminRole && (usersQuery.isLoading || coursesQuery.isLoading))

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  // Companion to `fmt` for the activity rail, which shows "Aug 23, 2026 · 10:30 AM".
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  const statusPill = (s: string) => ({
    active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    inactive: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    pending: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  }[s.toLowerCase()] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')
  const navigateToDashboard = () => {
    switch(userRole) {
      case 'admin':
        router.push("/lms/pages/admindashboard")
        break
      case 'student':
        router.push("/lms/pages/studentdashboard")
        break
      case 'staff':
        router.push("/lms/pages/dashboard")
        break
      default:
        router.push("/login")
    }
  }

  const getStats = () => {
    if (userRole === 'student') {
      // The dashboard's model is the source of truth for anything progress-
      // shaped. `calcProgress` below only ever looked at We Do assignments on
      // the cached user record, so a learner who had opened resources and sat
      // assessments still read 0% here while the dashboard read 15% — the two
      // surfaces contradicted each other on the same screen. It stays as the
      // fallback for the moment before analytics resolve, and the completed
      // threshold follows the dashboard's rule (100) rather than 90.
      const completed = performance
        ? performance.completed
        : userData?.courses?.filter(c => calcProgress(c) >= 90).length || 0
      const active = performance
        ? performance.inProgress
        : userData?.courses?.filter(c => {
            const p = calcProgress(c)
            return p > 0 && p < 90
          }).length || 0
      const overall = performance
        ? performance.overallProgress
        : userData?.courses?.length
          ? Math.round(userData.courses.reduce((s, c) => s + calcProgress(c), 0) / userData.courses.length)
          : 0
      return { 
        totalCourses: performance ? performance.activeCourses : (userData?.courses?.length || 0),
        completed, 
        active, 
        overall,
        totalNotes: userData?.notes?.length || 0,
        totalNotifications: userData?.notifications?.length || 0,
        unread: userData?.notifications?.filter(n => !n.isRead).length || 0, 
        totalPermissions: 0, 
        totalAssignments: 0, 
        totalEvaluations: 0, 
        totalEnrollments: 0 
      }
    }
    
    if (userRole === 'admin' && dashboardStats) {
      return {
        totalCourses: dashboardStats.courses.total,
        totalAssignments: 0,
        totalEvaluations: 0,
        totalEnrollments: 0,
        totalNotes: userData?.notes?.length || 0,
        totalPermissions: userData?.permissions?.length || 0,
        totalNotifications: userData?.notifications?.length || 0,
        unread: userData?.notifications?.filter(n => !n.isRead).length || 0,
        completed: 0,
        active: 0,
        overall: 0,
        totalUsers: dashboardStats.users.total,
        totalStudents: dashboardStats.users.students,
        totalStaff: dashboardStats.users.staff,
        activeCourses: dashboardStats.courses.active,
        inactiveCourses: dashboardStats.courses.inactive,
        newUsers: dashboardStats.recentActivities.newUsers,
        newCourses: dashboardStats.recentActivities.newCourses,
        activeUsers: dashboardStats.recentActivities.activeUsers
      }
    }
    
    return {
      totalCourses: userData?.courses?.length || 0,
      totalAssignments: userData?.courses?.reduce((s, c) => s + (c.answers?.We_Do?.assignments || []).length, 0) || 0,
      totalEvaluations: userData?.notifications?.filter(n => n.title === "Evaluation Completed").length || 0,
      totalEnrollments: userData?.notifications?.filter(n => n.title === "New Course Enrollment").length || 0,
      totalNotes: userData?.notes?.length || 0, 
      totalPermissions: userData?.permissions?.length || 0,
      totalNotifications: userData?.notifications?.length || 0,
      unread: userData?.notifications?.filter(n => !n.isRead).length || 0, 
      completed: 0, 
      active: 0, 
      overall: 0
    }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA] dark:bg-gray-950">
        <Loading size="size-12" label="Loading Profile..." />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA] dark:bg-gray-950">
        <div className="text-center bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 max-w-xs">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <User className="h-7 w-7 text-orange-500" />
          </div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-1">No User Found</h2>
          <p className="text-gray-400 text-sm mb-4">Please log in to continue.</p>
          <button 
            onClick={() => router.push("/login")}
            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-200 dark:shadow-orange-900/30 hover:shadow-xl transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  const getLayout = () => {
    switch(userRole) {
      case 'admin':
        return DashboardLayout
      case 'student':
        return StudentLayout
      case 'staff':
        return StaffLayout
      default:
        return StaffLayout
    }
  }

  const Layout = getLayout()
  
  const getDisplayRoleName = () => {
    if (userRole === 'admin') {
      // Check if it's a specific admin sub-role
      const originalRole = originalRoleName.toLowerCase()
      if (originalRole === 'ldhead') return 'LD Head'
      if (originalRole === 'subhead') return 'Sub Head'
      if (originalRole === 'programcoordinator') return 'Program Coordinator'
      return 'Administrator'
    }
    if (userRole === 'student') return 'Student'
    const roleDisplay = originalRoleName.charAt(0).toUpperCase() + originalRoleName.slice(1)
    return roleDisplay
  }
  
  const roleName = getDisplayRoleName()
  
  const getRoleBadgeClass = () => {
    if (userRole === 'admin') {
      const originalRole = originalRoleName.toLowerCase()
      if (originalRole === 'ldhead') return 'from-purple-500 to-indigo-500'
      if (originalRole === 'subhead') return 'from-blue-500 to-cyan-500'
      if (originalRole === 'programcoordinator') return 'from-rose-500 to-orange-500'
      return 'from-rose-500 to-orange-500'
    }
    if (userRole === 'staff') {
      const originalRole = originalRoleName.toLowerCase()
      if (originalRole === 'poc') return 'from-orange-500 to-amber-500'
      if (originalRole === 'trainer') return 'from-amber-400 to-yellow-500'
      return 'from-orange-500 to-amber-500'
    }
    return 'from-amber-400 to-orange-400'
  }

  const roleBadge = getRoleBadgeClass()

  const getStatCards = () => {
    if (userRole === 'student') {
      return [
        { icon: BookOpen, label: "Enrolled", value: stats.totalCourses, sub: "Courses", accent: "#f97316" },
        { icon: CheckCircle, label: "Done", value: stats.completed, sub: "Completed", accent: "#22c55e" },
        { icon: Flame, label: "Active", value: stats.active, sub: "In Progress", accent: "#f59e0b" },
        { icon: TrendingUp, label: "Progress", value: `${stats.overall}%`, sub: "Overall", accent: "#fb923c" },
      ]
    }
    
    if (userRole === 'admin' && dashboardStats) {
      return [
        { icon: Users, label: "Total Users", value: stats.totalUsers, sub: "All registered users", accent: "#F97316" },
        { icon: GraduationCap, label: "Students", value: stats.totalStudents, sub: "Enrolled students", accent: "#22C55E" },
        { icon: Users, label: "Faculty & Staff", value: stats.totalStaff, sub: "Total staff members", accent: "#7C4DD1" },
        { icon: BookOpen, label: "Courses", value: stats.totalCourses, sub: "Total courses", accent: "#F59E0B" },
      ]
    }
    
    return [
      { icon: BookOpen, label: "Courses", value: stats.totalCourses, sub: "Total", accent: "#f97316" },
      { icon: FileText, label: "Tasks", value: stats.totalAssignments, sub: "Assignments", accent: "#f59e0b" },
      { icon: Award, label: "Evals", value: stats.totalEvaluations, sub: "Completed", accent: "#fb923c" },
      { icon: Users, label: "Students", value: stats.totalEnrollments, sub: "Enrolled", accent: "#fdba74" },
    ]
  }

  const statCards = getStatCards()

  const getSecondaryStats = () => {
    if (userRole === 'admin' && dashboardStats) {
      return [
        { icon: UserCheck, label: "Active Users", value: stats.activeUsers, sub: `of ${stats.totalUsers} registered`, accent: "#7C4DD1", of: stats.totalUsers || 0 },
        { icon: TrendingUp, label: "New Users", value: stats.newUsers, sub: "added in the last 30 days", accent: "#F97316", of: stats.totalUsers || 0 },
        { icon: BookOpen, label: "New Courses", value: stats.newCourses, sub: "added in the last 30 days", accent: "#7C4DD1", of: stats.totalCourses || 0 },
      ]
    }
    return []
  }

  const secondaryStats: { icon: any; label: string; value: number; sub: string; accent: string; of: number }[] =
    getSecondaryStats().map((s) => ({ ...s, value: Number(s.value ?? 0), of: Number(s.of ?? 0) }))

  const tabs = [
    { id: "personal", label: "Personal", icon: User },
    { id: "academic", label: userRole === 'admin' ? "Institution" : userRole === 'student' ? "Academic" : "Professional", 
      icon: userRole === 'admin' ? School : userRole === 'student' ? GraduationCap : Briefcase },
    // Students only: their own overall performance, read from the dashboard's
    // metrics. Staff and admin have no learner record to summarise here.
    ...(isStudentRole ? [{ id: "performance", label: "Performance", icon: TrendingUp }] : []),
    { id: "notes", label: "Notes", icon: FileText, badge: stats.totalNotes },
    { id: "activity", label: "Activity", icon: Activity },
    ...((userRole === 'staff' || userRole === 'admin') ? [{ id: "teaching", label: userRole === 'admin' ? "Manage" : "Teaching", icon: BookOpen }] : [])
  ]

  // ── Right-rail: recent account activity ───────────────────────────────────
  // Built from what the user record actually carries — the profile's own
  // timestamps plus the newest notifications — rather than an invented feed.
  const activityFeed = [
    { icon: UserCheck, tone: '#7C4DD1', label: 'Profile updated', at: userData.updatedAt },
    { icon: Calendar, tone: '#F97316', label: 'Account created', at: userData.createdAt },
    ...(userData.notifications || [])
      .slice()
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2)
      .map((n: any) => ({ icon: Bell, tone: '#22C55E', label: n.title || 'Notification', at: n.createdAt })),
  ].filter((a) => a.at)

  // Quick actions go only to destinations that exist. Anything that would need
  // a screen this app doesn't have yet (change password, privacy) is left out
  // rather than rendered as a dead tile.
  const quickActions = [
    { icon: Edit, label: 'Edit', sub: 'Profile', tone: '#F97316', onClick: () => setEditOpen(true) },
    { icon: Bell, label: 'View', sub: 'Notifications', tone: '#7C4DD1', onClick: () => router.push('/lms/pages/notifications') },
    { icon: FileText, label: 'My', sub: 'Notes', tone: '#22C55E', onClick: () => setActiveTab('notes') },
    { icon: Activity, label: 'Full', sub: 'Activity', tone: '#3B82F6', onClick: () => setActiveTab('activity') },
  ]

  const content = (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-gray-950">
      <div className="mx-auto max-w-[1320px] px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3">

        {/* ── Breadcrumb + page actions ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <nav className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-orange-100 text-orange-500 dark:bg-orange-950/40">
              <Home className="h-3 w-3" />
            </span>
            <button onClick={navigateToDashboard} className="font-semibold text-gray-500 hover:text-orange-600 transition-colors dark:text-gray-400">
              Dashboard
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700" />
            <span className="font-bold text-orange-500 truncate">Profile</span>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white shadow-sm shadow-orange-500/25 hover:brightness-105 transition-[filter]"
              style={{ background: 'linear-gradient(135deg,#F97316,#FB8C3C)' }}
            >
              <Edit className="h-3.5 w-3.5" /> Edit Profile
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-orange-600 hover:border-orange-200 transition-colors dark:bg-gray-900 dark:border-gray-800"
                  aria-label="More profile actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Edit className="h-3.5 w-3.5" /> Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={navigateToDashboard}>
                  <Home className="h-3.5 w-3.5" /> Go to dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/lms/pages/notifications')}>
                  <Bell className="h-3.5 w-3.5" /> Notifications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('activity')}>
                  <Activity className="h-3.5 w-3.5" /> Recent activity
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Hero card: identity, headline stats, trend strip ────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-[0_2px_12px_-6px_rgba(16,24,40,0.10)] dark:bg-gray-900 dark:border-gray-800"
        >
          {/* Decorative orbit + wash, matching the reference. Purely visual, so
              it is aria-hidden and never intercepts a click. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] hidden lg:block" aria-hidden>
            <div
              className="absolute -right-20 -top-20 h-[320px] w-[320px] rounded-full opacity-70"
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(251,146,60,0.14), rgba(139,92,246,0.10) 45%, transparent 70%)' }}
            />
            <svg viewBox="0 0 420 300" className="absolute right-4 top-2 h-[180px] w-[280px]">
              <g fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-800">
                <circle cx="250" cy="140" r="38" />
                <circle cx="250" cy="140" r="72" />
                <circle cx="250" cy="140" r="108" />
              </g>
              <circle cx="168" cy="42" r="15" fill="#8B5CF6" />
              <circle cx="352" cy="88" r="10" fill="#C4B5FD" />
              <circle cx="120" cy="150" r="7" fill="#FDBA74" />
              <circle cx="330" cy="168" r="8" fill="#A78BFA" />
              <circle cx="292" cy="196" r="9" fill="#8B5CF6" />
              <circle cx="392" cy="26" r="5" fill="#FB923C" />
            </svg>
          </div>

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
            {/* Avatar with gradient ring + presence dot */}
            <div className="relative flex-shrink-0">
              <div
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full p-[3px] shadow-md shadow-orange-500/20"
                style={{ background: 'linear-gradient(135deg,#C4B5FD,#FDBA74 55%,#F97316)' }}
              >
                <div className="h-full w-full rounded-full bg-white p-[2px] dark:bg-gray-900">
                  <div className="h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-orange-200 to-orange-400 grid place-items-center">
                    {userData.profile && userData.profile !== 'default' ? (
                      <Image src={userData.profile} alt={userData.firstName} width={112} height={112} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl sm:text-3xl font-black text-white">
                        {userData.firstName?.[0]?.toUpperCase()}{userData.lastName?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  'absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900',
                  userData.status?.toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
                )}
                title={userData.status}
              />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-gray-900 dark:text-white truncate">
                  {userData.firstName} {userData.lastName}
                </h1>
                {userData.status?.toLowerCase() === 'active' && (
                  <BadgeCheck className="h-4 w-4 flex-shrink-0 text-orange-500" fill="currentColor" stroke="white" />
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold', statusPill(userData.status))}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', userData.status?.toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-gray-400')} />
                  {userData.status.charAt(0).toUpperCase() + userData.status.slice(1)}
                </span>
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                  {roleName}
                </span>
                {(userRole === 'staff' || userRole === 'admin') && (
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                    {userRole === 'admin'
                      ? originalRoleName.charAt(0).toUpperCase() + originalRoleName.slice(1)
                      : userData.role?.renameRole || userData.role?.originalRole || originalRoleName}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{userData.email}</span>
                </span>
                {userData.phone && (
                  <>
                    <span className="hidden sm:inline h-3.5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      {userData.phone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Headline stats */}
          <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {statCards.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/70 p-3 backdrop-blur-sm transition-shadow hover:shadow-[0_4px_14px_-8px_rgba(16,24,40,0.18)] dark:bg-gray-900/60 dark:border-gray-800"
                >
                  <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full" style={{ background: `${s.accent}1F` }}>
                    <Icon className="h-4 w-4" style={{ color: s.accent }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-none text-gray-900 dark:text-white">{s.value}</p>
                    <p className="mt-0.5 text-xs font-bold truncate" style={{ color: s.accent }}>{s.label}</p>
                    <p className="text-[10px] text-gray-400 truncate">{s.sub}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Trend strip — admin only. Every figure below is a real count; the
              chip is that count as a share of the matching total, which is the
              only comparison this data supports (no prior-period series). */}
          {secondaryStats.length > 0 && (
            <div className="relative mt-2.5 grid grid-cols-1 lg:grid-cols-3 rounded-xl border border-gray-100 bg-white/70 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:bg-gray-900/60 dark:border-gray-800 dark:divide-gray-800">
              {secondaryStats.map((s, i) => {
                const Icon = s.icon
                const pct = s.of > 0 ? Math.round((Number(s.value) / s.of) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full" style={{ background: `${s.accent}1F` }}>
                      <Icon className="h-4 w-4" style={{ color: s.accent }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{s.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-lg font-black text-gray-900 dark:text-white">{s.value}</p>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                          <TrendingUp className="h-2.5 w-2.5" />{pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{s.sub}</p>
                      <div className="mt-1 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pct)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: s.accent }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.section>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-white px-1.5 shadow-[0_2px_8px_-6px_rgba(16,24,40,0.10)] dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-bold transition-colors duration-150',
                    active ? 'text-orange-500' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                      active ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {tab.badge}
                    </span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="profileTabUnderline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-orange-500"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Body: tab panel + right rail ────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_312px] gap-3 items-start">

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 space-y-3"
            >

              {activeTab === 'personal' && (
                <Panel icon={User} title="Personal Information" color="#F97316">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { icon: User, label: 'Full Name', value: `${userData.firstName} ${userData.lastName}`, tone: '#7C4DD1' },
                      { icon: Mail, label: 'Email', value: userData.email, tone: '#7C4DD1' },
                      { icon: Phone, label: 'Phone', value: userData.phone, tone: '#F97316' },
                      { icon: Users, label: 'Gender', value: userData.gender, tone: '#F97316' },
                      { icon: Calendar, label: 'Created', value: fmt(userData.createdAt), tone: '#7C4DD1' },
                      { icon: Clock, label: 'Updated', value: fmt(userData.updatedAt), tone: '#7C4DD1' },
                      { icon: User, label: 'Created By', value: userData.createdBy, tone: '#F97316' },
                    ].map((item, idx) => <FieldTile key={idx} idx={idx} {...item} />)}
                  </div>
                </Panel>
              )}

              {activeTab === 'academic' && (
                <>
                  <Panel
                    icon={userRole === 'admin' ? School : userRole === 'student' ? GraduationCap : Briefcase}
                    title={userRole === 'admin' ? 'Institution Details' : userRole === 'student' ? 'Academic Details' : 'Professional Details'}
                    color="#F97316"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { icon: GraduationCap, label: 'Degree', value: userData.degree, tone: '#7C4DD1' },
                        { icon: Building, label: 'Department', value: userData.department, tone: '#7C4DD1' },
                        ...(userRole === 'student' ? [
                          { icon: Calendar, label: 'Year', value: userData.year, tone: '#F97316' },
                          { icon: BookOpen, label: 'Semester', value: userData.semester, tone: '#F97316' },
                          { icon: Calendar, label: 'Batch', value: userData.batch, tone: '#7C4DD1' },
                          { icon: Activity, label: 'Courses', value: String(stats.totalCourses), tone: '#22C55E' },
                        ] : userRole === 'staff' ? [
                          { icon: Briefcase, label: 'Staff ID', value: userData._id.substring(0, 12) + '…', tone: '#F97316' },
                          { icon: Shield, label: 'Permissions', value: `${stats.totalPermissions} Active`, tone: '#7C4DD1' },
                          { icon: BookOpen, label: 'Courses', value: String(stats.totalCourses), tone: '#22C55E' },
                          { icon: FileText, label: 'Assignments', value: String(stats.totalAssignments), tone: '#F97316' },
                        ] : userRole === 'admin' && dashboardStats ? [
                          { icon: School, label: 'Institution ID', value: dashboardStats.institution, tone: '#7C4DD1' },
                          { icon: Users, label: 'Total Users', value: String(dashboardStats.users.total), tone: '#F97316' },
                          { icon: GraduationCap, label: 'Students', value: String(dashboardStats.users.students), tone: '#22C55E' },
                          { icon: Briefcase, label: 'Staff', value: String(dashboardStats.users.staff), tone: '#7C4DD1' },
                          { icon: BookOpen, label: 'Total Courses', value: String(dashboardStats.courses.total), tone: '#F97316' },
                          { icon: UserCheck, label: 'Active Users', value: String(dashboardStats.recentActivities.activeUsers), tone: '#22C55E' },
                        ] : [
                          { icon: Briefcase, label: 'Role', value: originalRoleName, tone: '#F97316' },
                          { icon: Building, label: 'Department', value: userData.department, tone: '#7C4DD1' },
                          { icon: BookOpen, label: 'Courses', value: String(stats.totalCourses), tone: '#22C55E' },
                          { icon: FileText, label: 'Assignments', value: String(stats.totalAssignments), tone: '#F97316' },
                        ])
                      ].map((item, idx) => <FieldTile key={idx} idx={idx} {...item} />)}
                    </div>
                  </Panel>

                  {(userRole === 'staff' || userRole === 'admin') && userData.courses?.length > 0 && (
                    <Panel icon={BookOpen} title={userRole === 'admin' ? 'Course Summary' : 'Teaching Summary'} color="#7C4DD1">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {userData.courses.map((course, i) => {
                          const asgns = course.answers?.We_Do?.assignments || []
                          const totalQ = asgns.reduce((s: number, a: any) => s + (a.questions?.length || 0), 0)
                          return (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.06 }}
                              className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{course.courseId?.name || `Course ${i + 1}`}</p>
                                <span className="flex-shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                                  {asgns.length} tasks
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{totalQ} questions total</p>
                            </motion.div>
                          )
                        })}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {activeTab === 'notes' && (
                <Panel
                  icon={FileText}
                  title="My Notes"
                  color="#F97316"
                  action={
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                      {stats.totalNotes} • {userData.notes?.filter((n) => n.isPinned).length || 0} pinned
                    </span>
                  }
                >
                  {userData.notes?.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {userData.notes.map((note, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }}
                          className={cn(
                            'cursor-pointer rounded-xl border p-3 transition-all duration-200',
                            note.isPinned
                              ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-orange-950/20'
                              : 'border-gray-100 bg-gray-50/70 hover:border-orange-200 dark:border-gray-800 dark:bg-gray-800/40'
                          )}>
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <h4 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                              {note.isPinned && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                              {note.title}
                            </h4>
                            <span className="flex-shrink-0 text-[10px] text-gray-400">{fmt(note.lastEdited)}</span>
                          </div>
                          <div className="mb-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400"
                            dangerouslySetInnerHTML={{ __html: note.content }} />
                          {note.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.slice(0, 3).map((tag: string, ti: number) => (
                                <span key={ti} className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyBlock icon={FileText} text="No notes yet!" />
                  )}
                </Panel>
              )}

              {activeTab === 'activity' && (
                <>
                  <Panel icon={Activity} title="Recent Activity" color="#F97316">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { icon: Bell, label: 'Total', value: stats.totalNotifications, accent: '#F97316' },
                        { icon: Bell, label: 'Unread', value: stats.unread || 0, accent: '#EF4444' },
                        { icon: CheckCircle, label: 'Read', value: (stats.totalNotifications || 0) - (stats.unread || 0), accent: '#22C55E' },
                        { icon: Shield, label: 'Role', value: roleName, accent: '#7C4DD1' },
                      ].map((item, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                          <span className="mb-1.5 inline-grid h-8 w-8 place-items-center rounded-full" style={{ background: `${item.accent}1F` }}>
                            <item.icon className="h-4 w-4" style={{ color: item.accent }} />
                          </span>
                          <p className="text-lg font-black leading-none text-gray-900 dark:text-white">{item.value}</p>
                          <p className="mt-1 text-[11px] font-semibold text-gray-400">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {userData.notifications?.length > 0 && (
                    <Panel icon={Bell} title="Notifications" color="#7C4DD1">
                      <div className="custom-scroll max-h-96 space-y-2 overflow-y-auto pr-1">
                        {userData.notifications.slice(0, 10).map((n, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={cn(
                              'rounded-xl border p-3 transition-all',
                              n.isRead
                                ? 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900/50'
                                : 'border-orange-200 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/10'
                            )}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="mb-0.5 flex items-center gap-1.5">
                                  <h5 className="text-xs font-bold text-gray-900 dark:text-white">{n.title}</h5>
                                  {!n.isRead && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                              </div>
                              <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                n.type === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : n.type === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400')}>
                                {n.type || 'info'}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-gray-400">{fmt(n.createdAt)}</p>
                          </motion.div>
                        ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {activeTab === 'performance' && isStudentRole && (
                <>
                  {perfLoading && (
                    <Panel icon={TrendingUp} title="Overall Performance" color="#F97316">
                      <div className="py-10 flex justify-center"><Loading size="size-8" /></div>
                    </Panel>
                  )}

                  {!perfLoading && (!performance || performance.courses.length === 0) && (
                    <Panel icon={TrendingUp} title="Overall Performance" color="#F97316">
                      <EmptyBlock icon={TrendingUp} text="No enrolled courses yet — your performance appears here once you start learning." />
                    </Panel>
                  )}

                  {!perfLoading && performance && performance.courses.length > 0 && (
                    <>
                      {/* ── Headline: the four numbers the dashboard leads with ── */}
                      <Panel
                        icon={TrendingUp}
                        title="Overall Performance"
                        color="#F97316"
                        action={
                          <button
                            onClick={() => router.push('/lms/pages/studentdashboard')}
                            className="text-[11px] font-bold text-orange-500 hover:underline"
                          >
                            Open dashboard
                          </button>
                        }
                      >
                        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                          <MetricTile
                            idx={0} icon={TrendingUp} tone="#F97316" label="Overall Progress"
                            value={`${performance.overallProgress}%`}
                            sub={`${performance.activeCourses} active · ${performance.completed} completed`}
                            pct={performance.overallProgress}
                          />
                          <MetricTile
                            idx={1} icon={Award} tone="#7C4DD1" label="Grade"
                            value={performance.scorePct === null ? '—' : performance.grade.letter}
                            sub={performance.scorePct === null ? 'Nothing graded yet' : `${performance.scorePct}% · ${performance.grade.caption}`}
                            pct={performance.scorePct}
                          />
                          <MetricTile
                            idx={2} icon={CheckCircle} tone="#22C55E" label="Attendance"
                            value={performance.attendance.pct === null ? '—' : `${performance.attendance.pct}%`}
                            sub={performance.attendance.hasData
                              ? `${performance.attendance.present} present of ${performance.attendance.totalDays} days`
                              : 'Not marked yet'}
                            pct={performance.attendance.pct}
                          />
                          <MetricTile
                            idx={3} icon={Clock} tone="#3B82F6" label="Study Time"
                            value={performance.time.tracked ? shortDuration(performance.time.totalSeconds) : '—'}
                            sub={performance.time.tracked
                              ? `${shortDuration(performance.time.exerciseSeconds)} on exercises`
                              : 'No measured sessions yet'}
                            pct={null}
                          />
                        </div>
                      </Panel>

                      {/* ── Stage breakdown: the Learn → Practice → Assess pipeline ── */}
                      <Panel icon={Zap} title="Learning Journey" color="#7C4DD1">
                        <div className="space-y-3">
                          <StageRow
                            idx={0} title="I Do · Learning Resources" tone="#7C4DD1"
                            hasContent={performance.totals.learn.hasContent}
                            pct={performance.totals.learn.completionPct}
                            meterLabel="opened"
                            cells={[
                              { label: 'Resources', value: `${performance.totals.learn.opened}/${performance.totals.learn.total}`, sub: 'opened' },
                              { label: 'Checkpoints', value: `${performance.totals.learn.mcqCompleted}/${performance.totals.learn.mcqDocs}`, sub: 'completed' },
                              { label: 'Content', value: `${Math.round(performance.totals.learn.completedMinutes)}/${performance.totals.learn.contentMinutes}`, sub: 'minutes' },
                              { label: 'Done', value: `${performance.totals.learn.completionPct}%`, sub: 'of resources' },
                            ]}
                          />
                          <StageRow
                            idx={1} title="We Do · Assignments" tone="#22C55E"
                            hasContent={performance.totals.practice.hasContent}
                            pct={performance.totals.practice.completionPct}
                            meterLabel="started"
                            cells={stageCells(performance.totals.practice)}
                          />
                          <StageRow
                            idx={2} title="You Do · Assessments" tone="#F97316"
                            hasContent={performance.totals.assess.hasContent}
                            pct={performance.totals.assess.completionPct}
                            meterLabel="started"
                            cells={stageCells(performance.totals.assess)}
                          />
                        </div>
                      </Panel>

                      {/* ── Per course: where the blended figure above comes from ── */}
                      <Panel icon={BookOpen} title="Course Progress" color="#22C55E">
                        <div className="space-y-2">
                          {performance.courses.map((c, i) => (
                            <CourseProgressRow key={c.id || i} idx={i} course={c} />
                          ))}
                        </div>
                      </Panel>

                      {/* ── Momentum ── */}
                      <Panel icon={Flame} title="Momentum" color="#22C55E">
                        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                          <MetricTile
                            idx={0} icon={Flame} tone="#F97316" label="Current Streak"
                            value={`${performance.momentum.streak}`}
                            sub={performance.momentum.streak === 1 ? 'day in a row' : 'days in a row'}
                            pct={null}
                          />
                          <MetricTile
                            idx={1} icon={Activity} tone="#3B82F6" label="Active Days"
                            value={`${performance.momentum.activeDays30}`} sub="in the last 30 days" pct={null}
                          />
                          <MetricTile
                            idx={2} icon={CheckCircle} tone="#22C55E" label="Solved This Month"
                            value={`${performance.solvedThisMonth}`}
                            sub={performance.monthDeltaPct === null
                              ? 'no earlier baseline'
                              : `${performance.monthDeltaPct >= 0 ? '+' : ''}${performance.monthDeltaPct}% vs previous 30d`}
                            pct={null}
                          />
                          <MetricTile
                            idx={3} icon={Calendar} tone="#7C4DD1" label="Due This Week"
                            value={`${performance.pendingThisWeek}`} sub="pending deadlines" pct={null}
                          />
                        </div>
                      </Panel>

                      {/* ── Insights: the dashboard's own read of these numbers ── */}
                      {performance.insights.length > 0 && (
                        <Panel icon={Star} title="Insights" color="#3B82F6">
                          <div className="space-y-2">
                            {performance.insights.map((ins, i) => {
                              const tone = ins.tone === 'good' ? '#22C55E' : ins.tone === 'warn' ? '#F97316' : '#3B82F6'
                              return (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                                >
                                  <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full" style={{ background: `${tone}1F` }}>
                                    <Star className="h-3 w-3" style={{ color: tone }} />
                                  </span>
                                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{ins.text}</p>
                                </motion.div>
                              )
                            })}
                          </div>
                        </Panel>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === 'teaching' && (userRole === 'staff' || userRole === 'admin') && (
                <>
                  {userData.permissions?.length > 0 && (
                    <Panel icon={Shield} title="Permissions" color="#F97316">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {userData.permissions.slice(0, 6).map((p, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-800/40">
                            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-orange-100 dark:bg-orange-950/40">
                              <Shield className="h-3.5 w-3.5 text-orange-500" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{p.permissionName}</p>
                              <p className="truncate text-[11px] text-gray-400">{p.description}</p>
                            </div>
                            {p.isActive && <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />}
                          </motion.div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {userData.courses?.length > 0 && (
                    <Panel icon={BookOpen} title="Course Assignments" color="#7C4DD1">
                      <div className="space-y-3">
                        {userData.courses.slice(0, 5).map((course, i) => {
                          const asgns = course.answers?.We_Do?.assignments || []
                          const totalQ = asgns.reduce((s: number, a: any) => s + (a.questions?.length || 0), 0)
                          const submitted = asgns.filter((a: any) => a.questions?.some((q: any) => q.status === 'submitted')).length
                          const comp = asgns.length ? Math.round((submitted / asgns.length) * 100) : 0
                          return (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
                                <h5 className="text-sm font-bold text-gray-900 dark:text-white">{course.courseId?.name || `Course ${i + 1}`}</h5>
                                <span className="text-[11px] text-gray-400">Updated {fmt(course.updatedAt)}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-3 px-4 py-3">
                                {[
                                  { label: 'Tasks', value: asgns.length, color: '#F97316' },
                                  { label: 'Questions', value: totalQ, color: '#F59E0B' },
                                  { label: 'Submitted', value: submitted, color: '#22C55E' },
                                  { label: 'Done', value: `${comp}%`, color: '#7C4DD1' },
                                ].map((s, si) => (
                                  <div key={si}>
                                    <p className="text-[10px] text-gray-400">{s.label}</p>
                                    <p className="mt-0.5 text-base font-black" style={{ color: s.color }}>{s.value}</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </Panel>
                  )}

                  {!userData.permissions?.length && !userData.courses?.length && (
                    <Panel icon={BookOpen} title={userRole === 'admin' ? 'System Management' : 'Teaching Materials'} color="#F97316">
                      <EmptyBlock icon={BookOpen} text="Nothing assigned yet." />
                    </Panel>
                  )}
                </>
              )}

            </motion.div>
          </AnimatePresence>

          {/* ── Right rail ─────────────────────────────────────────────────── */}
          <aside className="space-y-3 xl:sticky xl:top-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_-6px_rgba(16,24,40,0.10)] dark:bg-gray-900 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-orange-50 dark:bg-orange-950/40">
                    <Activity className="h-3.5 w-3.5 text-orange-500" />
                  </span>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Activity Summary</h3>
                </div>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600 transition-colors hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  View All
                </button>
              </div>

              {activityFeed.length > 0 ? (
                <div className="space-y-2.5">
                  {activityFeed.map((a, i) => {
                    const Icon = a.icon
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full" style={{ background: `${a.tone}1F` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: a.tone }} />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-xs font-bold text-gray-900 dark:text-white">{a.label}</p>
                        <p className="flex-shrink-0 text-[10px] text-gray-400">
                          {fmt(a.at)} <span className="text-gray-300 dark:text-gray-700">·</span> {fmtTime(a.at)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyBlock icon={Activity} text="No activity recorded yet." />
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_-6px_rgba(16,24,40,0.10)] dark:bg-gray-900 dark:border-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-orange-50 dark:bg-orange-950/40">
                  <Zap className="h-3.5 w-3.5 text-orange-500" />
                </span>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                {quickActions.map((a, i) => {
                  const Icon = a.icon
                  return (
                    <button
                      key={i}
                      onClick={a.onClick}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_6px_14px_-10px_rgba(249,115,22,0.55)] dark:border-gray-800 dark:bg-gray-900"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${a.tone}1F` }}>
                        <Icon className="h-4 w-4" style={{ color: a.tone }} />
                      </span>
                      <span className="text-[11px] font-bold leading-tight text-gray-700 dark:text-gray-300">
                        {a.label}<br />{a.sub}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Self-service editor — photo and password only. Everything else on this
          page is owned by User Management. */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={userData}
        onUpdated={(patch) => {
          // Reflect the new photo immediately, and persist it to the same
          // localStorage record the whole app reads its identity from —
          // otherwise the sidebar avatar would stay stale until re-login.
          setUserData((prev) => {
            if (!prev) return prev
            const merged = {
              ...prev,
              ...(patch.profile ? { profile: patch.profile } : {}),
              ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {}),
            }
            try { localStorage.setItem(USER_DATA_KEY, JSON.stringify(merged)) } catch { /* quota / private mode */ }
            return merged
          })
        }}
      />

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #fed7aa; border-radius: 4px; }
        .dark .custom-scroll::-webkit-scrollbar-track { background: #1c1917; }
        .dark .custom-scroll::-webkit-scrollbar-thumb { background: #7c2d12; }
      `}</style>
    </div>
  )

  return <Layout>{content}</Layout>
}

// ─── Presentational pieces ────────────────────────────────────────────────────

/** A content card: tinted icon tile, title, a rule that fades out, and an
 *  optional right-aligned action. Every tab panel is built from these so the
 *  page reads as one surface rather than five different ones. */
function Panel({
  icon: Icon, title, color, action, children,
}: { icon: any; title: string; color: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_-6px_rgba(16,24,40,0.10)] dark:bg-gray-900 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md" style={{ background: `${color}1F` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <h3 className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">{title}</h3>
        <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}45, transparent)` }} />
        {action}
      </div>
      {children}
    </section>
  )
}

/** One labelled value inside a panel. */
function FieldTile({ idx, icon: Icon, label, value, tone = '#F97316' }: { idx: number; icon: any; label: string; value: string; tone?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.035 }}
      className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 transition-colors hover:border-orange-200 dark:border-gray-800 dark:bg-gray-800/40"
    >
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md" style={{ background: `${tone}1F` }}>
        <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-[13px] font-bold text-gray-900 dark:text-white">{value || '—'}</p>
      </div>
    </motion.div>
  )
}

/** The four cells every graded stage (We Do / You Do) reports. Shared so the
 *  two rows can never fall out of step with each other. */
function stageCells(s: StageStats) {
  return [
    { label: 'Exercises', value: `${s.submitted}/${s.assigned}`, sub: 'submitted' },
    { label: 'Questions', value: `${s.questionsSolved}/${s.questionsTotal}`, sub: 'solved' },
    { label: 'Attempted', value: `${s.questionsAttempted}/${s.questionsTotal}`, sub: 'questions tried' },
    {
      label: 'Score',
      value: s.scorePct === null ? '—' : `${s.scorePct}%`,
      sub: s.scorePct === null ? 'not graded yet' : `${s.scoreObtained}/${s.scoreMax} marks`,
    },
  ]
}

/** A headline number with its own meter. `pct` null → no meter (the metric has
 *  no 0-100 scale, or nothing has been recorded to place it on one yet). */
function MetricTile({
  idx, icon: Icon, label, value, sub, tone, pct,
}: { idx: number; icon: any; label: string; value: string; sub: string; tone: string; pct: number | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 transition-colors hover:border-orange-200 dark:border-gray-800 dark:bg-gray-800/40"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: `${tone}1F` }}>
          <Icon className="h-4 w-4" style={{ color: tone }} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-xl font-black leading-tight text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-gray-400">{sub}</p>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            transition={{ delay: idx * 0.05 + 0.15, duration: 0.5 }}
            className="h-full rounded-full"
            style={{ background: tone }}
          />
        </div>
      )}
    </motion.div>
  )
}

/** One stage of the Learn → Practice → Assess pipeline: a titled header with
 *  its completion meter, over a four-cell figure strip. Mirrors the course-row
 *  treatment in the Teaching tab so the page keeps one vocabulary. */
function StageRow({
  idx, title, tone, hasContent, pct, meterLabel, cells,
}: {
  idx: number; title: string; tone: string; hasContent: boolean; pct: number
  /** What the header meter is a percentage OF — without it "20%" next to an
   *  "Exercises 3/15" cell reads as though it were the question figure. */
  meterLabel: string
  cells: { label: string; value: string; sub: string }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
      className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800"
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
        <h5 className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-white">{title}</h5>
        {hasContent ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700/60">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                transition={{ delay: idx * 0.06 + 0.15, duration: 0.5 }}
                className="block h-full rounded-full"
                style={{ background: tone }}
              />
            </span>
            <span className="text-[11px] font-bold" style={{ color: tone }}>{pct}%</span>
            <span className="text-[11px] text-gray-400">{meterLabel}</span>
          </div>
        ) : (
          <span className="flex-shrink-0 text-[11px] text-gray-400">Nothing configured</span>
        )}
      </div>
      {hasContent && (
        <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">
          {cells.map((c, ci) => (
            <div key={ci}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{c.label}</p>
              <p className="mt-0.5 text-base font-black leading-tight text-gray-900 dark:text-white">{c.value}</p>
              <p className="text-[10px] text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

/** One course in the Academic tab's Course Progress list.
 *
 *  Driven by the dashboard's CourseModel, not by the cached user record. The
 *  old version read `course.answers.We_Do.assignments` straight off
 *  localStorage and scored it 60% attempted / 40% solved — which meant a
 *  learner who had opened resources and sat assessments but had no We Do
 *  submission read 0%, and the course title fell back to "Course 1" because
 *  the cached row carries only an id. Both numbers now come from the same
 *  blend the dashboard shows, so Profile and Dashboard agree.
 */
function CourseProgressRow({ idx, course }: { idx: number; course: CourseModel }) {
  const p = Math.max(0, Math.min(100, Math.round(course.progress)))
  const done = p >= 100
  const started = p > 0 || course.hasActivity
  const status = done ? 'Completed' : started ? 'In progress' : 'Not started'
  const statusCls = done ? 'text-emerald-500' : started ? 'text-orange-500' : 'text-gray-400'

  // Only the stages this course actually configured. A course with no You Do
  // content should show two meters, not a third one stuck at 0%.
  const stages = [
    { label: 'I Do', on: course.learn.hasContent, pct: course.learn.completionPct, detail: `${course.learn.opened}/${course.learn.total}`, tone: '#7C4DD1' },
    { label: 'We Do', on: course.practice.hasContent, pct: course.practice.completionPct, detail: `${course.practice.started}/${course.practice.assigned}`, tone: '#22C55E' },
    { label: 'You Do', on: course.assess.hasContent, pct: course.assess.completionPct, detail: `${course.assess.started}/${course.assess.assigned}`, tone: '#F97316' },
  ].filter((s) => s.on)

  const lastSeen = course.lastAccessed
    ? course.lastAccessed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Never'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06 }}
      className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{course.name}</p>
          {(course.code || course.level) && (
            <p className="mt-0.5 truncate text-[11px] text-gray-400">
              {[course.code, course.level].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs font-black" style={{ color: done ? '#22C55E' : '#F97316' }}>{p}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 1, delay: idx * 0.08, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: done ? 'linear-gradient(90deg,#22C55E,#4ADE80)' : 'linear-gradient(90deg,#F97316,#FBBF24)' }}
        />
      </div>

      {/* Where the blended number above actually comes from. */}
      {stages.length > 0 && (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {stages.map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-900/60">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</span>
                <span className="text-[11px] font-bold" style={{ color: s.tone }}>{s.pct}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.08 + 0.2 }}
                  className="h-full rounded-full"
                  style={{ background: s.tone }}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
        <span className="truncate">Last: {lastSeen}</span>
        <span className="flex-shrink-0">
          {course.scorePct !== null && <span className="mr-2 text-gray-500 dark:text-gray-300">Score {course.scorePct}%</span>}
          <span className={statusCls}>{status}</span>
        </span>
      </div>
    </motion.div>
  )
}

function EmptyBlock({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-xl bg-orange-50 dark:bg-orange-950/20">
        <Icon className="h-5 w-5 text-orange-300" />
      </span>
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  )
}
