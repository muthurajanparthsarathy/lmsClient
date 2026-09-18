"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  User, Mail, Phone, Calendar, BookOpen, 
  GraduationCap, Building, Users, FileText, 
  Clock, Edit, Shield, Award, Target, 
  CheckCircle, XCircle, Activity,
  ChevronRight,
  Home,
  Moon,
  Sun
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { StudentLayout } from "@/app/lms/component/student/student-layout"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index"

interface UserData {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: string;
  profile: string;
  degree: string;
  department: string;
  year: string;
  semester: string;
  batch: string;
  status: string;
  institution: {
    $oid: string;
  };
  role: {
    _id: string;
    originalRole: string;
    renameRole: string;
    roleValue: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  notes: Array<{
    _id: string;
    title: string;
    content: string;
    tags: string[];
    isPinned: boolean;
    color: string;
    lastEdited: string;
    createdAt: string;
    updatedAt: string;
  }>;
  permissions: Array<{
    _id: string;
    permissionName: string;
    permissionKey: string;
    permissionFunctionality: string[];
    icon: string;
    color: string;
    description: string;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
  notifications: Array<any>;
  courses: Array<any>;
  __v?: number;
}

const USER_DATA_KEY = "smartcliff_userData"

// Define calculateCourseProgress function BEFORE using it
const calculateCourseProgress = (course: any) => {
  if (!course.answers?.We_Do?.practical || !Array.isArray(course.answers.We_Do.practical)) {
    return 0;
  }
  
  const practicalExercises = course.answers.We_Do.practical;
  if (practicalExercises.length === 0) return 0;
  
  let attemptedExercises = 0;
  let attemptedQuestions = 0;
  
  practicalExercises.forEach((exercise: any) => {
    if (exercise.questions && Array.isArray(exercise.questions) && exercise.questions.length > 0) {
      attemptedExercises++;
      const attemptedQs = exercise.questions.filter((q: any) => 
        q.status === 'attempted' || q.status === 'evaluated' || q.submittedAt
      ).length;
      attemptedQuestions += attemptedQs;
    }
  });
  
  const totalExercises = practicalExercises.length || 10;
  const totalQuestions = attemptedExercises * 4;
  
  const exerciseProgress = totalExercises > 0 ? (attemptedExercises / totalExercises) * 100 : 0;
  const questionProgress = totalQuestions > 0 ? (attemptedQuestions / totalQuestions) * 100 : 0;
  
  return Math.round((exerciseProgress * 0.4) + (questionProgress * 0.6));
}

const getCurrentUser = (): { valid: boolean; user: UserData | null } => {
  try {
    const userDataString = localStorage.getItem(USER_DATA_KEY);
    if (!userDataString) {
      console.log("No user data found in localStorage");
      return { valid: false, user: null };
    }
    
    const userData: UserData = JSON.parse(userDataString);
    return { valid: true, user: userData };
  } catch (error) {
    console.error("Error getting user data from localStorage:", error);
    return { valid: false, user: null };
  }
};

export default function StudentProfilePage() {
  const router = useRouter()
  // Page-level gate only — a student always edits their own profile fields, so
  // no per-functionality checks below. If STUDENT_PROFILE isn't granted, the
  // whole page is replaced with an empty state.
  const { can, isReady: permsReady } = usePermissions()
  const canAccessProfile = can(PERMISSION_IDS.STUDENT_PROFILE)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("personal")
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check initial theme
    const isDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(isDark)

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark')
          setIsDarkMode(isDark)
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const fetchUserData = () => {
      try {
        const userDataResponse = getCurrentUser();
        
        if (!userDataResponse.valid || !userDataResponse.user) {
          console.error("No user data found in localStorage");
          router.push("/login")
          return
        }

        setUserData(userDataResponse.user)
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [router])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
      case 'inactive':
        return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
    }
  }

  // Handle Dashboard click
  const handleDashboardClick = () => {
    router.push("/lms/pages/studentdashboard")
  }


  if (loading || !permsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 dark:border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!canAccessProfile) {
    return (
      <StudentLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No access</h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don&apos;t have permission to view your profile.
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Required permission: <span className="font-medium">student-profile</span>
            </p>
          </div>
        </div>
      </StudentLayout>
    )
  }

  if (!userData) {
    return (
      <StudentLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No User Data Found</h2>
            <p className="text-gray-600 dark:text-gray-400">Please log in to view your profile.</p>
            <button 
              onClick={() => router.push("/login")}
              className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </StudentLayout>
    )
  }

  // Calculate statistics
  const completedCourses = userData.courses?.filter(course => {
    const progress = calculateCourseProgress(course)
    return progress >= 90
  }).length || 0

  const activeCourses = userData.courses?.filter(course => {
    const progress = calculateCourseProgress(course)
    return progress > 0 && progress < 90
  }).length || 0

  const totalNotifications = userData.notifications?.length || 0
  const unreadNotifications = userData.notifications?.filter(n => !n.isRead).length || 0
  const totalNotes = userData.notes?.length || 0
  const pinnedNotes = userData.notes?.filter(note => note.isPinned).length || 0

  const overallProgress = userData.courses?.length > 0 
    ? Math.round(userData.courses.reduce((sum, course) => sum + calculateCourseProgress(course), 0) / userData.courses.length)
    : 0

  return (
    <StudentLayout>
      <div >
        <div className="max-w-7xl mx-auto">
          {/* Header with Theme Toggle */}
          <div className="mb-6">
            <nav className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
              <button
                onClick={handleDashboardClick}
                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span className="font-medium">Dashboard</span>
              </button>
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400 dark:text-gray-600" />
              <span className="text-gray-400 dark:text-gray-500">Profile</span>
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400 dark:text-gray-600" />
              <span className="font-semibold text-gray-800 dark:text-white">{userData.firstName} {userData.lastName}</span>
            </nav>
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Student Profile</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage your personal information and academic details</p>
              </div>
             
            </div>
          </div>

          {/* Profile Header Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Profile Image */}
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-indigo-500 p-1">
                  <div className="h-full w-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                    {userData.profile && userData.profile !== "default" ? (
                      <Image 
                        src={userData.profile} 
                        alt={`${userData.firstName} ${userData.lastName}`}
                        width={96}
                        height={96}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {userData.firstName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"></div>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {userData.firstName} {userData.lastName}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        getStatusColor(userData.status)
                      )}>
                        {userData.status}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-xs font-bold border border-orange-200 dark:border-orange-800">
                        {userData.role?.renameRole || userData.role?.originalRole || "Student"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Enrolled Courses</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {userData.courses?.length || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                      {completedCourses}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {activeCourses}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Progress</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                      {overallProgress}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("personal")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "personal"
                    ? "border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Personal Information
              </button>
              <button
                onClick={() => setActiveTab("academic")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "academic"
                    ? "border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Academic Details
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "notes"
                    ? "border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Notes ({totalNotes})
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "activity"
                    ? "border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Activity
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            {activeTab === "personal" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {userData.firstName} {userData.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Phone Number</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Users className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Gender</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.gender}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Account Created</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(userData.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Clock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(userData.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Created By</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.createdBy}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "academic" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Academic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <BookOpen className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Degree</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.degree}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <GraduationCap className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Department</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Year</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.year}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <BookOpen className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Semester</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.semester}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Batch</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.batch}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                      <Activity className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enrolled Courses</p>
                        <p className="font-medium text-gray-900 dark:text-white">{userData.courses?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Course Progress */}
                {userData.courses && userData.courses.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Course Progress</h4>
                    <div className="space-y-3">
                      {userData.courses.map((course, index) => {
                        const progress = calculateCourseProgress(course)
                        const courseName = course.courseId?.name || `Course ${index + 1}`
                        const lastAccessed = course.lastAccessed 
                          ? formatDate(course.lastAccessed)
                          : 'Never accessed'
                        
                        return (
                          <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 transition-colors duration-200">
                            <div className="flex justify-between items-center mb-2">
                              <p className="font-medium text-gray-900 dark:text-white">{courseName}</p>
                              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                              <div 
                                className="bg-orange-600 dark:bg-orange-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                              <span>Last accessed: {lastAccessed}</span>
                              <span>{progress >= 90 ? 'Completed' : 'In Progress'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Notes ({totalNotes})</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {pinnedNotes} pinned • {totalNotes - pinnedNotes} regular
                  </span>
                </div>
                {userData.notes && userData.notes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userData.notes.map((note, index) => (
                      <div 
                        key={index} 
                        className={cn(
                          "p-4 rounded-xl border transition-all duration-200 hover:shadow-sm dark:hover:shadow-gray-900/20",
                          note.isPinned 
                            ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20" 
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        )}
                        style={{ 
                          backgroundColor: note.color !== '#ffffff' && !isDarkMode ? note.color : 
                                         note.color !== '#000000' && isDarkMode ? note.color : undefined 
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {note.title}
                            {note.isPinned && (
                              <Award className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                            )}
                          </h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(note.lastEdited)}
                          </span>
                        </div>
                        <div 
                          className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: note.content }}
                        />
                        <div className="flex flex-wrap gap-2">
                          {note.tags && note.tags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex} 
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No notes found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Notifications</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Notifications</span>
                        <span className="font-bold text-gray-900 dark:text-white">{totalNotifications}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Unread</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{unreadNotifications}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Read</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{totalNotifications - unreadNotifications}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">System Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">User ID</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-300">
                          {userData._id.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Account Version</span>
                        <span className="font-bold text-gray-900 dark:text-white">v{userData.__v || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Active Since</span>
                        <span className="text-gray-900 dark:text-gray-300">{formatDate(userData.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Notifications */}
                {userData.notifications && userData.notifications.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Notifications</h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {userData.notifications.slice(0, 10).map((notification, index) => (
                        <div 
                          key={index} 
                          className={cn(
                            "p-4 rounded-xl border transition-all duration-200",
                            notification.isRead 
                              ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" 
                              : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-gray-900 dark:text-white">{notification.title}</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{notification.message}</p>
                            </div>
                            {!notification.isRead && (
                              <span className="h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400"></span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
                            <span>{formatDate(notification.createdAt)}</span>
                            <span className={cn(
                              "px-2 py-1 rounded text-xs",
                              notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                              notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                              'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                            )}>
                              {notification.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Custom scrollbar styles for dark/light mode */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(251, 146, 60, 0.6) transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 2px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, #FB923C, #F97316);
          border-radius: 2px;
          box-shadow: 0 0 4px rgba(251, 146, 60, 0.3);
          transition: all 0.3s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, #F97316, #EA580C);
          box-shadow: 0 0 8px rgba(251, 146, 60, 0.6);
        }

        /* Dark mode scrollbar */
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, #FDBA74, #FB923C);
          box-shadow: 0 0 4px rgba(253, 186, 116, 0.4);
        }
        
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, #FB923C, #F97316);
          box-shadow: 0 0 8px rgba(253, 186, 116, 0.6);
        }

        /* Smooth transitions */
        * {
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        /* Line clamp utility */
        .line-clamp-3 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
      `}</style>
    </StudentLayout>
  )
}