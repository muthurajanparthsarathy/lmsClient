"use client"

import { Loading } from "@/components/loading-ui/loading"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User, Mail, Phone, Calendar, BookOpen,
  GraduationCap, Building, Users, FileText,
  Clock, Edit, Shield, Award,
  CheckCircle, Activity, Briefcase,
  ChevronRight, Home, Star,
  TrendingUp, Bell, Flame, School,
  BarChart, PieChart, UserCheck, UserX
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"

import { StudentLayout } from "@/app/lms/component/student/student-layout"
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout"
import DashboardLayout from "@/app/lms/component/layout"
import { useProfileUserStatsQuery } from "@/queries/profileStats"
import { courseStructuresSummaryQuery } from "@/apiServices/createCourseStucture"

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

  const statusCls = (s: string) => ({
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    inactive: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  }[s.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700')

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
      const completed = userData?.courses?.filter(c => calcProgress(c) >= 90).length || 0
      const active = userData?.courses?.filter(c => { 
        const p = calcProgress(c); 
        return p > 0 && p < 90 
      }).length || 0
      const overall = userData?.courses?.length
        ? Math.round(userData.courses.reduce((s, c) => s + calcProgress(c), 0) / userData.courses.length) 
        : 0
      return { 
        totalCourses: userData?.courses?.length || 0, 
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
        <Loading size="size-12" label="Loading Profile..." />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
        <div className="text-center bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-orange-100 dark:border-orange-900/30 max-w-xs">
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
        { icon: Users, label: "Total Users", value: stats.totalUsers, sub: "All Users", accent: "#f97316" },
        { icon: GraduationCap, label: "Students", value: stats.totalStudents, sub: "Enrolled", accent: "#22c55e" },
        { icon: Briefcase, label: "Staff", value: stats.totalStaff, sub: "Faculty & Staff", accent: "#f59e0b" },
        { icon: BookOpen, label: "Courses", value: stats.totalCourses, sub: "Total", accent: "#fb923c" },
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
        { icon: UserCheck, label: "Active Users", value: stats.activeUsers, sub: "Active", accent: "#3b82f6" },
        { icon: TrendingUp, label: "New Users", value: stats.newUsers, sub: "Last 30 Days", accent: "#f97316" },
        { icon: BookOpen, label: "New Courses", value: stats.newCourses, sub: "Last 30 Days", accent: "#8b5cf6" },
      ]
    }
    return []
  }

  const secondaryStats = getSecondaryStats()

  const tabs = [
    { id: "personal", label: "Personal", icon: User },
    { id: "academic", label: userRole === 'admin' ? "Institution" : userRole === 'student' ? "Academic" : "Professional", 
      icon: userRole === 'admin' ? School : userRole === 'student' ? GraduationCap : Briefcase },
    { id: "notes", label: "Notes", icon: FileText, badge: stats.totalNotes },
    { id: "activity", label: "Activity", icon: Activity },
    ...((userRole === 'staff' || userRole === 'admin') ? [{ id: "teaching", label: userRole === 'admin' ? "Manage" : "Teaching", icon: BookOpen }] : [])
  ]

  const content = (
    <div className="min-h-screen" style={{ background: 'linear-gradient(150deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)' }}>
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fb923c, #f97316)' }} />
        <div className="absolute bottom-0 -left-32 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fbbf24, #f59e0b)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-5 lg:px-6 py-5">

        <div className="flex items-center justify-between mb-5">
          <nav className="flex items-center gap-1.5 text-xs">
            <button onClick={navigateToDashboard} className="flex items-center gap-1 text-orange-400 hover:text-orange-600 font-semibold transition-colors">
              <Home className="h-3.5 w-3.5" /> Dashboard
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-orange-300" />
            <span className="text-orange-500 font-bold">Profile</span>
          </nav>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-white hover:bg-orange-50 text-orange-600 text-xs font-bold transition-all shadow-sm group dark:bg-gray-900 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/30">
            <Edit className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" /> Edit
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-2xl overflow-hidden mb-4 shadow-lg shadow-orange-100 dark:shadow-orange-950/20 border border-orange-100 dark:border-orange-900/20 bg-white dark:bg-gray-900/80"
        >
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24, #f97316)' }} />
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, #fb923c, transparent)' }} />

          <div className="p-5 md:p-6 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

              <div className="relative flex-shrink-0">
                <div className="h-20 w-20 rounded-xl shadow-md shadow-orange-200 dark:shadow-orange-900/30 overflow-hidden" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)', padding: 2 }}>
                  <div className="h-full w-full rounded-[10px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    {userData.profile && userData.profile !== "default" ? (
                      <Image src={userData.profile} alt={userData.firstName} width={76} height={76} className="object-cover rounded-[10px]" />
                    ) : (
                      <span className="text-3xl font-black text-orange-500">{userData.firstName[0].toUpperCase()}</span>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                  {userData.firstName} <span style={{ color: '#f97316' }}>{userData.lastName}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", statusCls(userData.status))}>
                    ● {userData.status.charAt(0).toUpperCase() + userData.status.slice(1)}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold text-white bg-gradient-to-r", roleBadge)}>
                    {roleName}
                  </span>
                  {(userRole === 'staff' || userRole === 'admin') && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                      {userRole === 'admin' 
                        ? originalRoleName.charAt(0).toUpperCase() + originalRoleName.slice(1)
                        : userData.role?.renameRole || userData.role?.originalRole || originalRoleName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <Mail className="h-3 w-3" />{userData.email}
                  {userData.phone && <><span className="text-gray-300 dark:text-gray-700">·</span><Phone className="h-3 w-3" />{userData.phone}</>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-5">
              {statCards.map((s, i) => {
                const Icon = s.icon
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.06 }}
                    className="relative rounded-xl p-3 border border-orange-100 dark:border-orange-900/20 bg-orange-50/60 dark:bg-orange-950/10 hover:border-orange-300 dark:hover:border-orange-800 hover:shadow-md transition-all group cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg" style={{ background: `${s.accent}18` }}>
                        <Icon className="h-3.5 w-3.5" style={{ color: s.accent }} />
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{s.sub}</span>
                    </div>
                    <p className="text-xl font-black text-gray-900 dark:text-white leading-none">{s.value}</p>
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: s.accent }}>{s.label}</p>
                  </motion.div>
                )
              })}
            </div>

            {secondaryStats.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {secondaryStats.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + (i + statCards.length) * 0.06 }}
                      className="relative rounded-xl p-3 border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10 hover:border-orange-300 dark:hover:border-orange-800 hover:shadow-md transition-all group cursor-default">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 rounded-lg" style={{ background: `${s.accent}18` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: s.accent }} />
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{s.sub}</span>
                      </div>
                      <p className="text-xl font-black text-gray-900 dark:text-white leading-none">{s.value}</p>
                      <p className="text-[11px] font-semibold mt-0.5" style={{ color: s.accent }}>{s.label}</p>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-white dark:bg-gray-900/80 border border-orange-100 dark:border-orange-900/20 shadow-sm overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0",
                  active ? "text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30" : "text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                )}
                style={active ? { background: 'linear-gradient(135deg, #f97316, #fb923c)' } : {}}>
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn("px-1.5 py-0.5 text-[10px] rounded-full font-black",
                    active ? "bg-white/25 text-white" : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400")}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-orange-100 dark:border-orange-900/20 bg-white dark:bg-gray-900/80 shadow-lg shadow-orange-50 dark:shadow-orange-950/10 overflow-hidden">
            <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24, #fb923c)' }} />
            <div className="p-5 md:p-6">

              {activeTab === "personal" && (
                <div>
                  <TabHeader icon={User} title="Personal Information" color="#f97316" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {[
                      { icon: User, label: "Full Name", value: `${userData.firstName} ${userData.lastName}` },
                      { icon: Mail, label: "Email", value: userData.email },
                      { icon: Phone, label: "Phone", value: userData.phone },
                      { icon: Users, label: "Gender", value: userData.gender },
                      { icon: Calendar, label: "Created", value: fmt(userData.createdAt) },
                      { icon: Clock, label: "Updated", value: fmt(userData.updatedAt) },
                      { icon: User, label: "Created By", value: userData.createdBy },
                    ].map((item, idx) => <CompactRow key={idx} idx={idx} {...item} />)}
                  </div>
                </div>
              )}

              {activeTab === "academic" && (
                <div>
                  <TabHeader 
                    icon={userRole === 'admin' ? School : userRole === 'student' ? GraduationCap : Briefcase}
                    title={userRole === 'admin' ? "Institution Details" : userRole === 'student' ? "Academic Details" : "Professional Details"}
                    color="#f97316" 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {[
                      { icon: GraduationCap, label: "Degree", value: userData.degree },
                      { icon: Building, label: "Department", value: userData.department },
                      ...(userRole === 'student' ? [
                        { icon: Calendar, label: "Year", value: userData.year },
                        { icon: BookOpen, label: "Semester", value: userData.semester },
                        { icon: Calendar, label: "Batch", value: userData.batch },
                        { icon: Activity, label: "Courses", value: String(stats.totalCourses) },
                      ] : userRole === 'staff' ? [
                        { icon: Briefcase, label: "Staff ID", value: userData._id.substring(0,12)+"…" },
                        { icon: Shield, label: "Permissions", value: `${stats.totalPermissions} Active` },
                        { icon: BookOpen, label: "Courses", value: String(stats.totalCourses) },
                        { icon: FileText, label: "Assignments", value: String(stats.totalAssignments) },
                      ] : userRole === 'admin' && dashboardStats ? [
                        { icon: School, label: "Institution ID", value: dashboardStats.institution },
                        { icon: Users, label: "Total Users", value: String(dashboardStats.users.total) },
                        { icon: GraduationCap, label: "Students", value: String(dashboardStats.users.students) },
                        { icon: Briefcase, label: "Staff", value: String(dashboardStats.users.staff) },
                        { icon: BookOpen, label: "Total Courses", value: String(dashboardStats.courses.total) },
                        { icon: UserCheck, label: "Active Users", value: String(dashboardStats.recentActivities.activeUsers) },
                      ] : [
                        { icon: Briefcase, label: "Role", value: originalRoleName },
                        { icon: Building, label: "Department", value: userData.department },
                        { icon: BookOpen, label: "Courses", value: String(stats.totalCourses) },
                        { icon: FileText, label: "Assignments", value: String(stats.totalAssignments) },
                      ])
                    ].map((item, idx) => <CompactRow key={idx} idx={idx} {...item} />)}
                  </div>

                  {userRole === 'student' && userData.courses?.length > 0 && (
                    <div className="mt-6">
                      <TabHeader icon={TrendingUp} title="Course Progress" color="#fb923c" />
                      <div className="space-y-2.5 mt-3">
                        {userData.courses.map((course, i) => {
                          const p = calcProgress(course)
                          return (
                            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10 hover:shadow-sm transition-all">
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{course.courseId?.name || `Course ${i+1}`}</p>
                                <span className="text-xs font-black" style={{ color: p >= 90 ? '#22c55e' : '#f97316' }}>{p}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }}
                                  transition={{ duration: 1, delay: i * 0.08, ease: "easeOut" }}
                                  className="h-1.5 rounded-full"
                                  style={{ background: p >= 90 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#f97316,#fbbf24)' }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
                                <span>Last: {course.lastAccessed ? fmt(course.lastAccessed) : 'Never'}</span>
                                <span className={p >= 90 ? "text-emerald-500" : "text-orange-500"}>
                                  {p >= 90 ? '✓ Done' : 'Active'}
                                </span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {(userRole === 'staff' || userRole === 'admin') && userData.courses?.length > 0 && (
                    <div className="mt-6">
                      <TabHeader icon={BookOpen} title={userRole === 'admin' ? "Course Summary" : "Teaching Summary"} color="#fb923c" />
                      <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        {userData.courses.map((course, i) => {
                          const asgns = course.answers?.We_Do?.assignments || []
                          const totalQ = asgns.reduce((s: number, a: any) => s + (a.questions?.length || 0), 0)
                          return (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.06 }}
                              className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{course.courseId?.name || `Course ${i+1}`}</p>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold">
                                  {asgns.length} tasks
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{totalQ} questions total</p>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <TabHeader icon={FileText} title="My Notes" color="#f97316" noMargin />
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold">
                      {stats.totalNotes} • {userData.notes?.filter(n => n.isPinned).length || 0} pinned
                    </span>
                  </div>
                  {userData.notes?.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {userData.notes.map((note, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }}
                          className={cn(
                            "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                            note.isPinned
                              ? "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20"
                              : "border-orange-100 dark:border-orange-900/20 bg-white dark:bg-gray-900/50 hover:border-orange-300 dark:hover:border-orange-800"
                          )}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                              {note.isPinned && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                              {note.title}
                            </h4>
                            <span className="text-[10px] text-gray-400">{fmt(note.lastEdited)}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2"
                            dangerouslySetInnerHTML={{ __html: note.content }} />
                          {note.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.slice(0,3).map((tag: string, ti: number) => (
                                <span key={ti} className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md text-[10px] font-semibold">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                        <FileText className="h-7 w-7 text-orange-300 dark:text-orange-700" />
                      </div>
                      <p className="text-gray-400 text-sm">No notes yet!</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div>
                  <TabHeader icon={Activity} title="Recent Activity" color="#f97316" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      { icon: Bell, label: "Total", value: stats.totalNotifications, accent: "#f97316" },
                      { icon: Bell, label: "Unread", value: stats.unread || 0, accent: "#ef4444" },
                      { icon: CheckCircle, label: "Read", value: (stats.totalNotifications || 0) - (stats.unread || 0), accent: "#22c55e" },
                      { icon: Shield, label: "Role", value: roleName, accent: "#fb923c" },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10">
                        <div className="p-1.5 rounded-lg inline-flex mb-2" style={{ background: `${item.accent}15` }}>
                          <item.icon className="h-3.5 w-3.5" style={{ color: item.accent }} />
                        </div>
                        <p className="text-lg font-black text-gray-900 dark:text-white leading-none">{item.value}</p>
                        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {userData.notifications?.length > 0 && (
                    <div className="mt-5">
                      <TabHeader icon={Bell} title="Notifications" color="#fb923c" />
                      <div className="space-y-2 mt-3 max-h-80 overflow-y-auto pr-1 custom-scroll">
                        {userData.notifications.slice(0,10).map((n, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all hover:shadow-sm",
                              n.isRead
                                ? "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50"
                                : "border-orange-200 dark:border-orange-900/30 bg-orange-50/60 dark:bg-orange-950/10"
                            )}>
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h5 className="font-bold text-xs text-gray-900 dark:text-white">{n.title}</h5>
                                  {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                              </div>
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0",
                                n.type === 'success' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                n.type === 'warning' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400")}>
                                {n.type || 'info'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5">{fmt(n.createdAt)}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "teaching" && (userRole === 'staff' || userRole === 'admin') && (
                <div>
                  <TabHeader icon={BookOpen} title={userRole === 'admin' ? "System Management" : "Teaching Materials"} color="#f97316" />

                  {userData.permissions?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-orange-400 dark:text-orange-600 mb-3">Permissions</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {userData.permissions.slice(0,6).map((p, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-3 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10 hover:shadow-sm transition-all">
                            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex-shrink-0">
                              <Shield className="h-3.5 w-3.5 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.permissionName}</p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{p.description}</p>
                            </div>
                            {p.isActive && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userData.courses?.length > 0 && (
                    <div className="mt-5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-orange-400 dark:text-orange-600 mb-3">Course Assignments</p>
                      <div className="space-y-3">
                        {userData.courses.slice(0,5).map((course, i) => {
                          const asgns = course.answers?.We_Do?.assignments || []
                          const totalQ = asgns.reduce((s: number, a: any) => s + (a.questions?.length || 0), 0)
                          const submitted = asgns.filter((a: any) => a.questions?.some((q: any) => q.status === 'submitted')).length
                          const comp = asgns.length ? Math.round((submitted / asgns.length) * 100) : 0
                          return (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="rounded-xl border border-orange-100 dark:border-orange-900/20 overflow-hidden hover:shadow-md transition-all">
                              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100 dark:border-orange-900/20 bg-orange-50/60 dark:bg-orange-950/10">
                                <h5 className="text-sm font-bold text-gray-900 dark:text-white">{course.courseId?.name || `Course ${i+1}`}</h5>
                                <span className="text-[11px] text-gray-400">Updated {fmt(course.updatedAt)}</span>
                              </div>
                              <div className="px-4 py-3 grid grid-cols-4 gap-3">
                                {[
                                  { label: "Tasks", value: asgns.length, color: "#f97316" },
                                  { label: "Questions", value: totalQ, color: "#f59e0b" },
                                  { label: "Submitted", value: submitted, color: "#22c55e" },
                                  { label: "Done", value: `${comp}%`, color: "#fb923c" },
                                ].map((s, si) => (
                                  <div key={si}>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.label}</p>
                                    <p className="text-base font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: #fff7ed; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #fed7aa; border-radius: 4px; }
        .dark .custom-scroll::-webkit-scrollbar-track { background: #1c1917; }
        .dark .custom-scroll::-webkit-scrollbar-thumb { background: #7c2d12; }
      `}</style>
    </div>
  )

  return <Layout>{content}</Layout>
}

function TabHeader({ icon: Icon, title, color, noMargin }: { icon: any; title: string; color: string; noMargin?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}35, transparent)` }} />
    </div>
  )
}

function CompactRow({ idx, icon: Icon, label, value }: { idx: number; icon: any; label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20 bg-orange-50/40 dark:bg-orange-950/10 hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-sm transition-all group"
    >
      <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-orange-100 dark:border-orange-900/20 shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-orange-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate mt-0.5">{value || '—'}</p>
      </div>
    </motion.div>
  )
}