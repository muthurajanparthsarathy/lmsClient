"use client"
import { getToken } from "@/lib/session";

import React,{ useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Trophy, Target, CheckCircle, XCircle, Circle,
  Activity, Search, RefreshCw, Filter,
  ArrowUpDown, Loader2, Users, Award,
  FileText, BarChart, Info, AlertCircle,
  Folder, ChevronRight, X, Check, Percent,
  Home, GraduationCap, Dumbbell
} from "lucide-react"
import { Toaster, toast } from "react-hot-toast"
import { Montserrat, Inter } from 'next/font/google'

// --- Font Configuration ---
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
})

// --- Interfaces ---
interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
}

interface QuestionDetail {
  _id: string
  sequence: number
  title: string
  difficulty: "easy" | "medium" | "hard"
  maxScore: number
  userScore: number
  isCorrect: boolean
  attempts: number
  submittedAt?: string
}

interface Exercise {
  _id: string
  exerciseName: string
  section: string
  subcategory: string
  totalQuestions: number
  totalPoints: number
  entity: { 
    title: string
    type: string
    id: string
  }
  userProgress: {
    status: string
    completionRate: number
    totalScore: number
    averageScore: number
    lastAccessed: string | null
  }
  questions: QuestionDetail[]
  statistics: {
    totalScore: number
    accuracy: number
    attemptedQuestions: number
    solvedQuestions: number
    averageScore: number
  }
  difficultyCount?: {
    easy: number
    medium: number
    hard: number
  }
  exerciseLevel?: string
  estimatedTime?: number
  programmingLanguages?: string[]
}

interface Course {
  _id: string
  courseCode: string
  courseName?: string
}

interface ApiResponse {
  success: boolean
  data?: {
    user: User
    course: Course
    exercises: Exercise[]
    statistics?: {
      totalExercises: number
      totalQuestions: number
      totalPoints: number
      completedExercises: number
      inProgressExercises: number
      notStartedExercises: number
      overallScore: number
      overallAverage: number
      overallCompletion: number
    }
    summary?: {
      fetchedAt: string
      totalEntities: number
      exercisesFound: number
      userProgressAvailable: boolean
    }
  }
  message?: string
}

type SortKey = 'userScore' | 'maxScore' | 'difficulty' | 'sequence';
type SortDirection = 'asc' | 'desc';
type ExerciseStatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started';
type ExerciseDifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

// --- Fixed Circular Stats Component ---
const SolvedStatsCard = ({ exercise }: { exercise: Exercise }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  
  // Count questions by difficulty
  const easyQuestions = exercise.questions?.filter(q => q.difficulty === 'easy') || []
  const mediumQuestions = exercise.questions?.filter(q => q.difficulty === 'medium') || []
  const hardQuestions = exercise.questions?.filter(q => q.difficulty === 'hard') || []
  
  // Count ATTEMPTED questions by difficulty (attempts > 0 means attempted)
  const easyAttempted = easyQuestions.filter(q => q.attempts > 0).length
  const mediumAttempted = mediumQuestions.filter(q => q.attempts > 0).length
  const hardAttempted = hardQuestions.filter(q => q.attempts > 0).length
  
  // Count SOLVED questions by difficulty (attempts > 0 means solved - as per requirement)
  const easySolved = easyQuestions.filter(q => q.attempts > 0).length
  const mediumSolved = mediumQuestions.filter(q => q.attempts > 0).length
  const hardSolved = hardQuestions.filter(q => q.attempts > 0).length
  
  const totalAttempted = easyAttempted + mediumAttempted + hardAttempted
  const totalSolved = easySolved + mediumSolved + hardSolved
  const totalQuestions = exercise.totalQuestions || exercise.questions?.length || 0

  // Calculate percentages for the circle
  const easyPercentage = totalQuestions > 0 ? (easySolved / totalQuestions) : 0
  const mediumPercentage = totalQuestions > 0 ? (mediumSolved / totalQuestions) : 0
  const hardPercentage = totalQuestions > 0 ? (hardSolved / totalQuestions) : 0
  
  const easyStroke = easyPercentage * circumference
  const mediumStroke = mediumPercentage * circumference
  const hardStroke = hardPercentage * circumference

  const easyOffset = 0
  const mediumOffset = -easyStroke
  const hardOffset = -(easyStroke + mediumStroke)

  return (
    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
            {easySolved > 0 && <circle cx="50" cy="50" r={radius} fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${easyStroke} ${circumference}`} strokeDashoffset={easyOffset} strokeLinecap="round" />}
            {mediumSolved > 0 && <circle cx="50" cy="50" r={radius} fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray={`${mediumStroke} ${circumference}`} strokeDashoffset={mediumOffset} strokeLinecap="round" />}
            {hardSolved > 0 && <circle cx="50" cy="50" r={radius} fill="none" stroke="#f43f5e" strokeWidth="8" strokeDasharray={`${hardStroke} ${circumference}`} strokeDashoffset={hardOffset} strokeLinecap="round" />}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <span className="text-xl font-bold text-slate-800 leading-none">{totalSolved}</span>
             <span className="text-xs text-slate-400 font-medium">/{totalQuestions}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 pr-2">
            <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-700 font-medium">Easy</span>
                </div>
                <span className="text-slate-900 font-bold text-sm">
                  {easySolved}<span className="text-slate-400">/{easyQuestions.length}</span>
                </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-slate-700 font-medium">Medium</span>
                </div>
                <span className="text-slate-900 font-bold text-sm">
                  {mediumSolved}<span className="text-slate-400">/{mediumQuestions.length}</span>
                </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-slate-700 font-medium">Hard</span>
                </div>
                <span className="text-slate-900 font-bold text-sm">
                  {hardSolved}<span className="text-slate-400">/{hardQuestions.length}</span>
                </span>
            </div>
            <div className="pt-2 mt-1 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-600 text-center">
                Attempted: <span className="font-bold text-slate-800">{totalAttempted}/{totalQuestions}</span>
              </div>
            </div>
        </div>
    </div>
  )
}

// --- Compact Statistics Panel Component ---
const StatisticsPanel = ({ exercises, user, course }: { 
  exercises: Exercise[], 
  user: User, 
  course: Course 
}) => {
  const stats = useMemo(() => {
    const totalExercises = exercises.length
    const totalQuestions = exercises.reduce((sum, ex) => sum + (ex.totalQuestions || 0), 0)
    
    // Count solved questions as those with attempts > 0
    const totalSolved = exercises.reduce((sum, ex) => {
      return sum + (ex.questions?.filter(q => q.attempts > 0).length || 0)
    }, 0)
    
    const totalAttempted = exercises.reduce((sum, ex) => {
      return sum + (ex.questions?.filter(q => q.attempts > 0).length || 0)
    }, 0)
    
    const totalScore = exercises.reduce((sum, ex) => sum + (ex.statistics?.totalScore || 0), 0)
    const maxPossibleScore = exercises.reduce((sum, ex) => sum + (ex.totalPoints || 0), 0)
    const overallAccuracy = totalAttempted > 0 ? (totalSolved / totalAttempted) * 100 : 0
    
    // Calculate completion based on completionRate
    const completedExercises = exercises.filter(ex => ex.userProgress.completionRate >= 100).length
    const inProgressExercises = exercises.filter(ex => ex.userProgress.completionRate > 0 && ex.userProgress.completionRate < 100).length
    const notStartedExercises = exercises.filter(ex => ex.userProgress.completionRate === 0).length
    
    return {
      totalExercises,
      totalQuestions,
      totalSolved,
      totalAttempted,
      totalScore,
      maxPossibleScore,
      overallAccuracy,
      completedExercises,
      inProgressExercises,
      notStartedExercises
    }
  }, [exercises])

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 h-full overflow-y-auto custom-scrollbar">
      <h3 className="text-base font-bold text-slate-900 font-heading mb-4">Performance Overview</h3>
      
      {/* User Info */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-orange-600" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-slate-500 truncate">{course.courseCode}</div>
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-2xs text-slate-500 font-semibold mb-0.5">Exercises</div>
          <div className="text-base font-bold text-slate-900">{stats.totalExercises}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-2xs text-slate-500 font-semibold mb-0.5">Questions</div>
          <div className="text-base font-bold text-slate-900">{stats.totalQuestions}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-2xs text-slate-500 font-semibold mb-0.5">Solved</div>
          <div className="text-base font-bold text-slate-900">{stats.totalSolved}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-2xs text-slate-500 font-semibold mb-0.5">Accuracy</div>
          <div className={`text-base font-bold ${
            stats.overallAccuracy >= 80 ? 'text-emerald-600' :
            stats.overallAccuracy >= 60 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {stats.overallAccuracy.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Score Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700">Total Score</span>
          <span className="text-xs font-bold text-slate-900">
            {stats.totalScore.toFixed(1)}/{stats.maxPossibleScore}
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${(stats.totalScore / stats.maxPossibleScore) * 100}%` }}
          />
        </div>
      </div>

      {/* Status Distribution */}
      <div>
        <div className="text-xs font-medium text-slate-700 mb-2">Progress Status</div>
        <div className="space-y-1.5">
          {[
            { status: 'Completed', count: stats.completedExercises, color: 'bg-emerald-500' },
            { status: 'In Progress', count: stats.inProgressExercises, color: 'bg-amber-500' },
            { status: 'Not Started', count: stats.notStartedExercises, color: 'bg-slate-300' }
          ].map(item => {
            const percentage = stats.totalExercises > 0 ? (item.count / stats.totalExercises) * 100 : 0
            return (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                  <span className="text-xs font-medium text-slate-700">{item.status}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{item.count}</span>
                  <span className="text-xs text-slate-500 w-8 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DetailedGradePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [apiData, setApiData] = useState<ApiResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [exerciseSearch, setExerciseSearch] = useState("")
  const [questionSort, setQuestionSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'sequence',
    direction: 'asc'
  })

  // New Filter States
  const [statusFilter, setStatusFilter] = useState<ExerciseStatusFilter>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<ExerciseDifficultyFilter>("all")
  const [sectionFilter, setSectionFilter] = useState<string>("all")
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)

  const fetchCourseExercises = async (forceRefresh = false) => {
    const courseId = searchParams.get('courseId')
    
    if (!courseId) {
        setError("Course ID not found in URL")
        setLoading(false)
        toast.error("Course ID not found in URL")
        return
    }

    if (forceRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const token = getToken() || localStorage.getItem('token') || ''
      const response = await fetch(
        `http://localhost:5533/course/${courseId}/exercises-with-scores`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data: ApiResponse = await response.json()

      if (data.success && data.data) {
        // Sort exercises: those with questions first, then by name
        const sortedExercises = [...data.data.exercises].sort((a, b) => {
          const aHasQuestions = a.questions && a.questions.length > 0
          const bHasQuestions = b.questions && b.questions.length > 0
          
          if (aHasQuestions && !bHasQuestions) return -1
          if (!aHasQuestions && bHasQuestions) return 1
          
          // If both have or don't have questions, sort by exercise name
          return a.exerciseName.localeCompare(b.exerciseName)
        })
        
        setApiData({
          ...data.data,
          exercises: sortedExercises
        })
        
        if (sortedExercises.length > 0) {
          // Select first exercise that has questions, if any
          const firstWithQuestions = sortedExercises.find(ex => ex.questions && ex.questions.length > 0)
          if (firstWithQuestions) {
            setSelectedExerciseId(firstWithQuestions._id)
          } else {
            setSelectedExerciseId(sortedExercises[0]._id)
          }
        }
        
        // Check for exercises without questions and show toast
        const exercisesWithoutQuestions = sortedExercises.filter(
          ex => !ex.questions || ex.questions.length === 0
        )
        
        if (exercisesWithoutQuestions.length > 0) {
          toast(
            (t) => (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">Some exercises have no questions</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {exercisesWithoutQuestions.length} exercise(s) don't have any questions available.
                  </p>
                </div>
                <button 
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Dismiss
                </button>
              </div>
            ),
            { duration: 5000, icon: '⚠️' }
          )
        }
      } else {
        throw new Error(data.message || 'Failed to fetch')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load course exercises'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCourseExercises()
  }, [searchParams])

  // Get all unique sections and subcategories for filters
  const filterOptions = useMemo(() => {
    if (!apiData?.exercises) return { sections: [], subcategories: [] }
    
    const sections = new Set<string>()
    const subcategories = new Set<string>()
    
    apiData.exercises.forEach(exercise => {
      if (exercise.section) sections.add(exercise.section)
      if (exercise.subcategory) subcategories.add(exercise.subcategory)
    })
    
    return {
      sections: Array.from(sections),
      subcategories: Array.from(subcategories)
    }
  }, [apiData])

  // Calculate exercise difficulty based on questions
  const getExerciseDifficulty = (exercise: Exercise): 'easy' | 'medium' | 'hard' => {
    if (!exercise.questions || exercise.questions.length === 0) return 'medium'
    
    const difficultyMap = { easy: 1, medium: 2, hard: 3 }
    const avgDifficulty = exercise.questions.reduce((sum, q) => {
      return sum + (difficultyMap[q.difficulty] || 2)
    }, 0) / exercise.questions.length
    
    if (avgDifficulty < 1.5) return 'easy'
    if (avgDifficulty < 2.5) return 'medium'
    return 'hard'
  }

  // Get exercise status based on completion
  const getExerciseStatus = (exercise: Exercise): { text: string, color: string, bg: string } => {
    const completion = exercise.userProgress.completionRate
    
    if (completion >= 100) return {
      text: 'Completed',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50'
    }
    if (completion > 0) return {
      text: 'In Progress',
      color: 'text-amber-700',
      bg: 'bg-amber-50'
    }
    return {
      text: 'Not Started',
      color: 'text-slate-700',
      bg: 'bg-slate-50'
    }
  }

  // Filter exercises based on all filters
  const filteredExercises = useMemo(() => {
    if (!apiData?.exercises) return []
    
    let result = [...apiData.exercises]

    // 1. Filter by Search
    if (exerciseSearch) {
      const lowerQuery = exerciseSearch.toLowerCase()
      result = result.filter(ex => 
        ex.exerciseName.toLowerCase().includes(lowerQuery) ||
        ex.entity?.title?.toLowerCase().includes(lowerQuery) ||
        ex.section.toLowerCase().includes(lowerQuery) ||
        ex.subcategory?.toLowerCase().includes(lowerQuery)
      )
    }

    // 2. Filter by Status
    if (statusFilter !== 'all') {
      result = result.filter(ex => {
        const actualStatus = ex.userProgress.completionRate >= 100 ? 'completed' : 
                           ex.userProgress.completionRate > 0 ? 'in_progress' : 'not_started'
        return actualStatus === statusFilter
      })
    }

    // 3. Filter by Difficulty
    if (difficultyFilter !== 'all') {
      result = result.filter(ex => {
        const exerciseDifficulty = getExerciseDifficulty(ex)
        return exerciseDifficulty === difficultyFilter
      })
    }

    // 4. Filter by Section
    if (sectionFilter !== 'all') {
      result = result.filter(ex => ex.section === sectionFilter)
    }

    // 5. Filter by Subcategory
    if (subcategoryFilter !== 'all') {
      result = result.filter(ex => ex.subcategory === subcategoryFilter)
    }

    return result
  }, [apiData, exerciseSearch, statusFilter, difficultyFilter, sectionFilter, subcategoryFilter])

  const selectedExercise = useMemo(() => {
    return apiData?.exercises.find(e => e._id === selectedExerciseId)
  }, [apiData, selectedExerciseId])

  const sortedQuestions = useMemo(() => {
    if (!selectedExercise?.questions) return []
    const q = [...selectedExercise.questions]
    
    q.sort((a, b) => {
        let aValue: any = a[questionSort.key];
        let bValue: any = b[questionSort.key];
        if (questionSort.key === 'difficulty') {
            const map = { easy: 1, medium: 2, hard: 3 }
            aValue = map[a.difficulty] || 0
            bValue = map[b.difficulty] || 0
        }
        if (aValue < bValue) return questionSort.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return questionSort.direction === 'asc' ? 1 : -1
        return 0
    })
    return q
  }, [selectedExercise, questionSort])

  const handleQuestionSort = (key: SortKey) => {
    setQuestionSort(curr => ({
        key,
        direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getAttemptStatus = (q: QuestionDetail) => {
    if (!q.attempts || q.attempts === 0) {
      return { 
        text: 'Not Attempted', 
        color: 'text-slate-500', 
        bg: 'bg-slate-100', 
        icon: <Circle className="w-3 h-3" />,
        border: 'border-slate-200'
      }
    }
    
    // If attempts > 0, consider as solved (as per requirement)
    if (q.attempts > 0) {
      return { 
        text: 'Solved', 
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        icon: <CheckCircle className="w-3 h-3" />
      }
    }
    
    // Fallback for any other cases
    return { 
      text: 'Not Attempted', 
      color: 'text-slate-500', 
      bg: 'bg-slate-100', 
      icon: <Circle className="w-3 h-3" />,
      border: 'border-slate-200'
    }
  }

  const getScoreColor = (score: number, max: number) => {
    if (max === 0) return 'text-slate-400'
    const p = (score / max) * 100
    if (p >= 80) return 'text-emerald-600'
    if (p >= 50) return 'text-amber-600'
    return 'text-rose-600'
  }

  const resetFilters = () => {
    setExerciseSearch("")
    setStatusFilter("all")
    setDifficultyFilter("all")
    setSectionFilter("all")
    setSubcategoryFilter("all")
  }

  const handleExerciseSelect = (exercise: Exercise) => {
    if (!exercise.questions || exercise.questions.length === 0) {
      toast.error("No questions available for this exercise", {
        duration: 2000,
        icon: '⚠️'
      })
      return
    }
    setSelectedExerciseId(exercise._id)
  }

  // Render breadcrumb navigation
  const renderBreadcrumb = () => {
    const breadcrumbItems = [];

    // Dashboard link
    breadcrumbItems.push({
      title: "Dashboard",
      icon: Home,
      onClick: () => router.push('/lms/pages/studentdashboard'),
    });
    const courseId = searchParams.get('courseId')


     breadcrumbItems.push({
      title: "courses",
      icon: GraduationCap,
      onClick: () => router.push(`/lms/pages/courses`),
    });

    // Grades link
    breadcrumbItems.push({
      title: "course view",
      icon: GraduationCap,
      onClick: () => router.push(`/lms/pages/grade`),
    });

    // Current Course (always visible)
    if (apiData?.course) {
      breadcrumbItems.push({
        title: apiData.course.courseCode,
        icon: GraduationCap,
        onClick: null,
      });
    }

    // Exercise (if selected)
    if (selectedExercise) {
      breadcrumbItems.push({
        title: selectedExercise.exerciseName,
        icon: Dumbbell,
        onClick: null,
      });
    }

    return (
      <div className="mb-4">
        <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={index}>
              {/* Breadcrumb Item */}
              <div
                className={`flex items-center gap-1 px-3 py-1 transition-all duration-200 rounded-full border flex-shrink-0 ${
                  index === breadcrumbItems.length - 1
                    ? "text-white font-semibold bg-orange-600 shadow-md border-orange-600"
                    : item.onClick
                    ? "text-slate-600 hover:text-orange-600 cursor-pointer hover:bg-orange-50 border-slate-200 hover:border-orange-200 bg-white"
                    : "text-slate-500 bg-slate-100 border-slate-200"
                }`}
                onClick={item.onClick || undefined}
              >
                <item.icon className={`w-3 h-3 ${
                  index === breadcrumbItems.length - 1 ? "text-white" : ""
                }`} />
                <span className="text-xs">{item.title}</span>
              </div>

              {/* Separator (except for last item) */}
              {index < breadcrumbItems.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-400 mx-1 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>
    );
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#FDFBF7]">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  )

  if (error) return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FDFBF7] text-slate-500">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          <p className="mb-4">{error}</p>
          <button onClick={() => fetchCourseExercises(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Retry</button>
      </div>
  )

  return (
    <div className={`flex flex-col h-screen w-full bg-[#FDFBF7] overflow-hidden ${inter.variable} ${montserrat.variable} font-sans`}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#333',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
          },
        }}
      />
      
      {/* Breadcrumb Navigation */}
      <div className="px-4 md:px-6 pt-4">
        {renderBreadcrumb()}
      </div>
      
      {/* Main Area - Grid with 3 columns */}
      <main className={`flex-1 p-4 md:p-6 pt-0 grid gap-4 h-full overflow-hidden ${
        showStatsPanel ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'
      }`}>
        
        {/* LEFT COLUMN: Exercise List - Ultra Compact */}
        <div className="flex flex-col h-full min-h-0 min-w-0 bg-white rounded-lg border border-slate-200 shadow-sm p-3">
          {/* Header */}
          <div className="mb-3 flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-sm font-bold text-slate-900 font-heading">
                Exercises ({filteredExercises.length}/{apiData?.exercises?.length || 0})
              </h1>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowStatsPanel(!showStatsPanel)}
                  className={`p-1 rounded ${showStatsPanel ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500'}`}
                  title="Toggle Statistics Panel"
                >
                  <BarChart className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1 rounded ${showFilters ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500'}`}
                  title="Toggle Filters"
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => fetchCourseExercises(true)} 
                  disabled={refreshing}
                  className="p-1 rounded text-slate-400 hover:text-orange-500 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all text-xs"
              />
            </div>
          </div>

          {/* Minimal Exercise List - Row Layout */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
            {filteredExercises.map((exercise) => {
              const isActive = selectedExerciseId === exercise._id
              const hasQuestions = exercise.questions && exercise.questions.length > 0
              const exerciseDifficulty = getExerciseDifficulty(exercise)
              const exerciseStatus = getExerciseStatus(exercise)
              
              return (
                <div 
                  key={exercise._id}
                  onClick={() => handleExerciseSelect(exercise)}
                  className={`
                    group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all duration-150 border mb-1
                    ${isActive 
                      ? 'bg-orange-500 border-orange-500 text-white' 
                      : `bg-white border-slate-200 hover:border-orange-200 hover:bg-slate-50 ${!hasQuestions ? 'opacity-60' : ''}`
                    }
                  `}
                >
                  {/* Left side: Exercise info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        exerciseDifficulty === 'easy' ? 'bg-emerald-500' :
                        exerciseDifficulty === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      <h3 className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {exercise.exerciseName || "Unnamed"}
                      </h3>
                      {!hasQuestions && (
                        <span className="text-2xs italic text-slate-400">(no q)</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-2xs">
                      <span className={`truncate ${isActive ? 'text-orange-100' : 'text-slate-500'}`}>
                        {exercise.entity?.title?.slice(0, 12) || 'Unknown'}
                      </span>
                      <span className={isActive ? 'text-orange-100' : 'text-slate-300'}>•</span>
                      <span className={`capitalize ${isActive ? 'text-orange-100' : 'text-slate-500'}`}>
                        {exercise.section.split('_').join(' ').slice(0, 10)}
                      </span>
                      <span className={isActive ? 'text-orange-100' : 'text-slate-300'}>•</span>
                      <span className={isActive ? 'text-orange-100' : 'text-slate-500'}>
                        {exercise.totalQuestions || 0} Qs
                      </span>
                    </div>
                  </div>
                  
                  {/* Right side: Stats */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div className="text-right">
                      <div className={`text-xs font-medium ${isActive ? 'text-white' : 'text-slate-700'}`}>
                        {exercise.statistics?.totalScore || 0} pts
                      </div>
                      <div className={`text-2xs ${isActive ? 'text-orange-100' : 'text-slate-500'}`}>
                        {exercise.userProgress.completionRate.toFixed(0)}%
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-white/20' : 
                      exerciseStatus.text === 'Completed' ? 'bg-emerald-100' :
                      exerciseStatus.text === 'In Progress' ? 'bg-amber-100' : 'bg-slate-100'
                    }`}>
                      <Activity className={`w-3 h-3 ${
                        isActive ? 'text-white' : 
                        exerciseStatus.text === 'Completed' ? 'text-emerald-600' :
                        exerciseStatus.text === 'In Progress' ? 'text-amber-600' : 'text-slate-400'
                      }`} />
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredExercises.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-xs">
                No exercises found
                <button 
                  onClick={resetFilters}
                  className="mt-1 block text-orange-600 hover:text-orange-800 text-xs font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Filters Panel - Now at bottom */}
          {showFilters && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-1.5">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ExerciseStatusFilter)}
                  className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Done</option>
                  <option value="in_progress">In Prog</option>
                  <option value="not_started">Not Started</option>
                </select>

                <select 
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as ExerciseDifficultyFilter)}
                  className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                >
                  <option value="all">All Diff</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <select 
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                >
                  <option value="all">All Sections</option>
                  {filterOptions.sections.map(section => (
                    <option key={section} value={section}>
                      {section.replace('_', ' ').slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Reset button */}
              {(statusFilter !== 'all' || difficultyFilter !== 'all' || sectionFilter !== 'all') && (
                <button 
                  onClick={resetFilters}
                  className="w-full mt-1.5 text-2xs text-orange-600 hover:text-orange-800 font-medium text-center"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* MIDDLE COLUMN: Question List */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col h-full min-h-0 border border-slate-100">
          {selectedExercise ? (
            <>
              {/* Compact Header */}
              <div className="flex justify-between items-start mb-4 flex-shrink-0">
                <div className="pr-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                      {selectedExercise.entity?.title || 'Unknown'}
                    </span>
                    {selectedExercise.subcategory && (
                      <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                        {selectedExercise.subcategory}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 font-heading leading-tight mb-1.5 truncate">
                    {selectedExercise.exerciseName || "Unnamed Exercise"}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-orange-500" />
                      <span>Accuracy: <b className="text-slate-700">{selectedExercise.statistics?.accuracy?.toFixed(0) || 0}%</b></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-orange-500" />
                      <span>Score: <b className="text-slate-700">{selectedExercise.statistics?.totalScore || 0}</b></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-orange-500" />
                      <span>Questions: <b className="text-slate-700">{selectedExercise.totalQuestions || 0}</b></span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <SolvedStatsCard exercise={selectedExercise} />
                </div>
              </div>

              {/* Table Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar -mx-4 px-4 min-h-0">
                {selectedExercise.questions && selectedExercise.questions.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-2xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="py-2 pr-3 w-10">#</th>
                        <th className="py-2 px-2">Question</th>
                        <th className="py-2 px-2 w-24">Status</th>
                        <th className="py-2 px-2 w-20 cursor-pointer hover:text-orange-500" onClick={() => handleQuestionSort('difficulty')}>
                          <div className="flex items-center gap-0.5">Diff <ArrowUpDown className="w-2.5 h-2.5"/></div>
                        </th>
                        <th className="py-2 px-2 w-16 text-right cursor-pointer hover:text-orange-500" onClick={() => handleQuestionSort('userScore')}>
                          <div className="flex items-center justify-end gap-0.5">Score <ArrowUpDown className="w-2.5 h-2.5"/></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {sortedQuestions.map((q, idx) => {
                        const status = getAttemptStatus(q)
                        const diffColor = q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 
                                        q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        
                        return (
                          <tr key={q._id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-2 pr-3 font-mono text-slate-400 text-xs">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2 font-medium text-slate-700 group-hover:text-slate-900 text-xs truncate max-w-[200px]">
                              {q.title || `Question ${idx + 1}`}
                            </td>
                            <td className="py-2 px-2">
                              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold border ${status.bg} ${status.color} ${status.border}`}>
                                {status.icon}
                                {status.text}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${diffColor}`}>
                                {q.difficulty}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className={`font-bold ${getScoreColor(q.userScore, q.maxScore)}`}>
                                {q.userScore}
                              </span>
                              <span className="text-slate-400 text-xs">/{q.maxScore}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Info className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-500 mb-0.5">No questions available</p>
                    <p className="text-2xs text-slate-400">This exercise doesn't have any questions to display.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p className="text-sm font-medium text-slate-500">Select an exercise</p>
              <p className="text-xs text-slate-400 mt-0.5">Choose from the list on the left</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Statistics Panel (Conditional) */}
        {showStatsPanel && apiData && (
          <div className="hidden lg:block">
            <StatisticsPanel 
              exercises={apiData.exercises} 
              user={apiData.user} 
              course={apiData.course} 
            />
          </div>
        )}
      </main>

      <style jsx global>{`
        :root {
          --font-montserrat: ${montserrat.style.fontFamily};
          --font-inter: ${inter.style.fontFamily};
        }
        .font-heading { font-family: var(--font-montserrat); }
        body { font-family: var(--font-inter); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  )
}