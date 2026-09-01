"use client"
import { getToken } from "@/lib/session";

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Trophy, Target, Clock, CheckCircle, XCircle,
  TrendingUp, Calendar, ChevronRight, Home,
  Play, Zap, Brain, AlertCircle, ArrowRight,
  Loader2, RefreshCw, BarChart3, FileText,
  Percent, Hash, Award, Check, X, Circle, ExternalLink,
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  ArrowLeft, ChevronLeft, Folder, File, FolderOpen, Layers, Activity,
  BookOpen, GraduationCap
} from "lucide-react"
import { Loading } from "@/components/loading-ui/loading"

// Import Google Fonts
import { Montserrat, Inter } from 'next/font/google'

// Configure Google Fonts
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
  name: string
  email: string
}

interface Exercise {
  _id: string
  name: string
  totalQuestions: number
  foundInCategory: string
  foundInSubcategory: string
  entity: {
    type: string
    id: string
    title: string
    category?: string
    subcategory?: string
  }
  passingMarks?: number
  totalMarks?: number
}

interface Summary {
  totalQuestions: number
  attemptedQuestions: number
  evaluatedQuestions: number
  correctQuestions: number
  totalScore: string
  maxPossibleScore: number
  overallPercentage: string
  completionRate: string
  averageScore: string
}

interface UserAttempt {
  status: string
  attempts: number
  score: number
  totalScore: number
  feedback: string
  language: string
  submittedAt: string
  matchedBy: string
}

interface Question {
  _id: string
  sequence: number
  title: string
  difficulty: "easy" | "medium" | "hard"
  maxScore: number
  userScore: number
  totalScore: number
  percentage: string
  isCorrect: boolean
  userAttempt: UserAttempt | null
}

interface Grade {
  obtained: number
  outOf: number
  percentage: string
  letterGrade: string
  isPassing: boolean
  passingMarksRequired?: number
}

// API Response Interface
interface ApiResponse {
  success: boolean
  data?: {
    user: User
    exercise: Exercise
    summary: Summary
    questions: Question[]
    grade: Grade
    debug?: any
  }
  message?: string
}

type SortKey = 'userScore' | 'maxScore' | 'difficulty' | 'sequence' | 'percentage';
type SortDirection = 'asc' | 'desc';

export default function ExerciseGradeDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [apiData, setApiData] = useState<ApiResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all")
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null)

  // Hierarchy state from URL params
  const [hierarchyData, setHierarchyData] = useState<any>(null)
  const [contextInfo, setContextInfo] = useState<any>(null)

  // Parse hierarchy from URL params
  useEffect(() => {
    if (searchParams) {
      const hierarchyParam = searchParams.get('hierarchy')
      const topicParam = searchParams.get('topic')
      const moduleParam = searchParams.get('module')
      
      if (hierarchyParam) {
        try {
          const decodedHierarchy = JSON.parse(decodeURIComponent(hierarchyParam))
          setHierarchyData(decodedHierarchy)
        } catch (error) {
          console.error('Error parsing hierarchy:', error)
        }
      }
      
      setContextInfo({
        topic: decodeURIComponent(topicParam || ''),
        module: decodeURIComponent(moduleParam || ''),
        category: searchParams.get('category'),
        subcategory: searchParams.get('subcategory'),
        courseId: searchParams.get('courseId'),
        courseName: searchParams.get('courseName'),
        exerciseId: searchParams.get('exerciseId'),
        exerciseName: searchParams.get('exerciseName'),
        exerciseLevel: searchParams.get('exerciseLevel'),
        method: searchParams.get('method'),
        nodeType: searchParams.get('nodeType')
      })
    }
  }, [searchParams])

  // Fetch Data
  const fetchExerciseAnalytics = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else if (!apiData) setLoading(true)

    try {
      const token = getToken() || localStorage.getItem('token') || ''
      const courseId = searchParams.get("courseId")
      const category = searchParams.get("category")
      const subcategory = searchParams.get("subcategory")
      const exerciseId = searchParams.get("exerciseId")

      if (!exerciseId) {
        throw new Error('Exercise ID is required')
      }

      const params = new URLSearchParams()
      if (courseId) params.append('courseId', courseId)
      if (category) params.append('category', category || '')
      if (subcategory) params.append('subcategory', subcategory || '')
      
      const response = await fetch(
        `http://localhost:5533/analytics/exercise/${exerciseId}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ApiResponse = await response.json()

      if (data.success && data.data) {
        setApiData(data.data)
        setError(null)
      } else {
        throw new Error(data.message || 'Failed to fetch exercise analytics')
      }
    } catch (err) {
      console.error("Failed to fetch exercise analytics:", err)
      setError(err instanceof Error ? err.message : 'Failed to load exercise analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchExerciseAnalytics()
  }, [])

  // Breadcrumb function
  const renderBreadcrumb = () => {
    const breadcrumbItems: Array<{
      title: string;
      icon: React.ComponentType<any>;
      onClick: (() => void) | null;
      color: string;
      isActive?: boolean;
    }> = []

    breadcrumbItems.push({
      title: "Dashboard",
      icon: Home,
      onClick: () => router.push('/lms/pages/studentdashboard'),
      color: "text-orange-600 hover:text-orange-700"
    })

    if (contextInfo?.courseId) {
      breadcrumbItems.push({
        title: contextInfo.courseName || "Course",
        icon: GraduationCap,
        onClick: () => {
          localStorage.removeItem('lms_student_selected_node_id')
          localStorage.removeItem('lms_student_selected_method')
          localStorage.removeItem('lms_student_selected_activity')
          router.push(`/lms/pages/courses/coursesdetailedview/${contextInfo.courseId}`)
        },
        color: "text-gray-600 hover:text-orange-600"
      })
    }

    if (hierarchyData?.hierarchy && Array.isArray(hierarchyData.hierarchy)) {
      hierarchyData.hierarchy.forEach((item: string, index: number) => {
        breadcrumbItems.push({
          title: item,
          icon: index === 0 ? BookOpen : File,
          onClick: null,
          color: "text-gray-600",
          isActive: false
        })
      })
    }

    if (apiData?.exercise?.foundInCategory) {
      const methodName = apiData.exercise.foundInCategory === "I_Do" ? "I Do" : 
                         apiData.exercise.foundInCategory === "We_Do" ? "We Do" : 
                         apiData.exercise.foundInCategory === "You_Do" ? "You Do" : 
                         apiData.exercise.foundInCategory.replace(/_/g, " ")
      
      breadcrumbItems.push({
        title: methodName,
        icon: Target,
        onClick: null,
        color: "text-orange-600",
        isActive: false
      })
    }

    if (apiData?.exercise?.foundInSubcategory) {
      breadcrumbItems.push({
        title: apiData.exercise.foundInSubcategory.replace(/_/g, " "),
        icon: Activity,
        onClick: null,
        color: "text-orange-600",
        isActive: false
      })
    }

    if (apiData?.exercise?.name) {
      breadcrumbItems.push({
        title: apiData.exercise.name,
        icon: FileText,
        onClick: null,
        color: "text-gray-600",
        isActive: false
      })
    }

    breadcrumbItems.push({
      title: "Grade",
      icon: Trophy,
      onClick: null,
      color: "text-orange-600 font-semibold",
      isActive: true
    })

    const truncateText = (text: string, maxLength: number = 20) => {
      if (text.length <= maxLength) return text
      return text.substring(0, maxLength) + "..."
    }

    // Compact chrome: a Back chip on the far left, then only the FINAL
    // trail (course → exercise name → Grade). The old nav pushed six+
    // icon chips horizontally scrollable — visually noisy and dwarfed the
    // Back affordance. Trimmed titles cap at 24 chars. We drop Dashboard,
    // hierarchy tail (module/topic), method, and subcategory because the
    // Back button already handles walking backward.
    const shortTrail = [
      // Course (if we have it)
      ...breadcrumbItems.filter((it) => it.icon === GraduationCap).slice(0, 1),
      // Exercise name
      ...breadcrumbItems.filter((it) => it.icon === FileText).slice(0, 1),
      // Final "Grade" pill
      ...breadcrumbItems.filter((it) => it.isActive).slice(0, 1),
    ]
    return (
      <div className="bg-white">
        <nav className="flex items-center gap-2 px-3 py-2 text-xs">
          <button
            onClick={() => router.back()}
            title="Back"
            aria-label="Back"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="font-medium">Back</span>
          </button>
          <span aria-hidden="true" className="text-slate-300">/</span>
          {shortTrail.map((item, index) => (
            <div key={index} className="flex items-center gap-2 min-w-0">
              {index > 0 && <span aria-hidden="true" className="text-slate-300">/</span>}
              <div
                onClick={item.onClick || undefined}
                title={item.title}
                className={`flex items-center gap-1 whitespace-nowrap
                  ${item.onClick ? "text-slate-500 hover:text-orange-700 cursor-pointer" : "text-slate-900 font-semibold cursor-default"}`}
              >
                <span className="font-medium truncate max-w-[24ch]">{truncateText(item.title, 24)}</span>
              </div>
            </div>
          ))}
        </nav>
      </div>
    )
  }

  // --- Statistics Logic - Fixed to properly calculate totals ---
  const detailedStats = useMemo(() => {
    if (!apiData?.questions) return null;

    const stats = {
      easy: { 
        total: 0, 
        attempted: 0, 
        earnedScore: 0, 
        possibleScore: 0 
      },
      medium: { 
        total: 0, 
        attempted: 0, 
        earnedScore: 0, 
        possibleScore: 0 
      },
      hard: { 
        total: 0, 
        attempted: 0, 
        earnedScore: 0, 
        possibleScore: 0 
      },
      totalAttempted: 0,
      totalQuestions: apiData.questions.length,
      totalEarnedScore: 0,
      totalPossibleScore: 0
    };

    apiData.questions.forEach(q => {
      const diff = q.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard';
      
      if (stats[diff]) {
        // Count total questions per difficulty
        stats[diff].total++;
        stats[diff].possibleScore += q.maxScore;
        
        // Check if attempted
        if (q.userAttempt) {
          stats[diff].attempted++;
          stats[diff].earnedScore += q.userScore;
          stats.totalAttempted++;
        }
        
        // Add to totals
        stats.totalEarnedScore += q.userScore;
        stats.totalPossibleScore += q.maxScore;
      }
    });

    return stats;
  }, [apiData]);

  // --- Filtering & Sorting Logic ---
  const processedQuestions = useMemo(() => {
    if (!apiData?.questions) return [];
    
    let result = [...apiData.questions];

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(q => 
        q.title.toLowerCase().includes(lowerQuery)
      );
    }

    if (difficultyFilter !== 'all') {
      result = result.filter(q => 
        q.difficulty.toLowerCase() === difficultyFilter
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Question];
        let bValue: any = b[sortConfig.key as keyof Question];

        if (sortConfig.key === 'difficulty') {
          const order = { easy: 1, medium: 2, hard: 3 };
          aValue = order[a.difficulty as keyof typeof order] || 0;
          bValue = order[b.difficulty as keyof typeof order] || 0;
        }

        if (sortConfig.key === 'percentage') {
          aValue = parseFloat(a.percentage);
          bValue = parseFloat(b.percentage);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [apiData, searchQuery, difficultyFilter, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // --- UI Helpers ---
  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return 'text-emerald-600'
    if (percentage >= 60) return 'text-amber-600'
    if (percentage > 0) return 'text-blue-600'
    return 'text-rose-600'
  }

  const getPercentageColor = (percentage: string) => {
    const num = parseFloat(percentage);
    if (num >= 80) return 'text-emerald-600'
    if (num >= 60) return 'text-amber-600'
    if (num > 0) return 'text-blue-600'
    return 'text-rose-600'
  }

  const getAttemptStatus = (question: Question) => {
    if (question.userAttempt === null) {
      return { 
        text: 'Not Attempted', 
        color: 'text-slate-500', 
        bg: 'bg-slate-100', 
        icon: <Circle className="w-3.5 h-3.5" />,
        border: 'border-slate-200'
      }
    }
    return { 
      text: question.userAttempt.status === 'evaluated' ? 'Evaluated' : 'Attempted', 
      color: question.userScore > 0 ? 'text-emerald-700' : 'text-rose-700',
      bg: question.userScore > 0 ? 'bg-emerald-50' : 'bg-rose-50',
      border: question.userScore > 0 ? 'border-emerald-100' : 'border-rose-100',
      icon: question.userScore > 0 ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />
    }
  }

  const getAccuracy = () => {
    if (!apiData?.summary) return "0.00"
    const attempted = apiData.summary.attemptedQuestions
    const correct = apiData.summary.correctQuestions
    if (attempted === 0) return "0.00"
    return ((correct / attempted) * 100).toFixed(2)
  }

  const SortIcon = ({ active, direction }: { active: boolean, direction: SortDirection }) => {
    if (!active) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />
    return direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-orange-600 ml-1" />
      : <ArrowDown className="w-3 h-3 text-orange-600 ml-1" />
  }

  if (loading) return (
    <div className={`h-screen w-screen flex items-center justify-center bg-slate-50 ${inter.variable} font-sans`}>
      <Loading size="size-10" color="blue" />
    </div>
  )

  if (error || !apiData) return (
    <div className={`h-screen w-screen flex flex-col items-center justify-center bg-slate-50 ${inter.variable} font-sans`}>
      <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
      <p className="text-lg text-slate-600">{error || 'No data available'}</p>
      <button onClick={() => fetchExerciseAnalytics(true)} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg">Retry</button>
    </div>
  )

  const accuracy = getAccuracy()

  return (
    <div className={`h-screen flex flex-col bg-slate-50 ${montserrat.variable} ${inter.variable} font-sans overflow-hidden`}>
      <style jsx global>{`
        :root {
          --font-montserrat: ${montserrat.style.fontFamily};
          --font-inter: ${inter.style.fontFamily};
        }
        h1, h2, h3, h4, h5, h6, .font-heading { font-family: var(--font-montserrat); }
        body, .font-body { font-family: var(--font-inter); }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #94a3b8;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 transparent;
        }
      `}</style>

      <div className="bg-white border-b border-slate-200 flex-shrink-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="mb-3">
            {renderBreadcrumb()}
          </div>
          
          <div className="flex items-center justify-between mt-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-heading">
                Exercise Grade Analysis
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {apiData.exercise.name} • {apiData.exercise.foundInCategory?.replace(/_/g, " ")} • {apiData.exercise.foundInSubcategory?.replace(/_/g, " ")}
              </p>
            </div>
            <button 
              onClick={() => fetchExerciseAnalytics(true)} 
              disabled={refreshing} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 md:px-6 py-4">
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            
            {/* LEFT COLUMN: Table — L/R borders dropped, corners squared,
                shadow removed to match the We_Do assignment list panel
                (edge-to-edge white surface separated only by top/bottom
                hairlines). Header font sizes stepped down so the title +
                subtitle share the same rhythm as the assignments toolbar. */}
            <div className="lg:col-span-3 flex flex-col h-full order-2 lg:order-1 bg-white border-y border-slate-200 overflow-hidden">

              <div className="p-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Question Details</h3>
                  <div className="text-2xs text-slate-500 mt-0.5">
                    Showing {processedQuestions.length} of {apiData.questions.length} questions
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    {(['all', 'easy', 'medium', 'hard'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setDifficultyFilter(filter)}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-md capitalize transition-all ${
                          difficultyFilter === filter
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search questions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full sm:w-44 bg-slate-50"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto min-h-0 custom-scrollbar">
                <table className="w-full text-left font-body">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                    <tr className="text-xs font-semibold text-slate-600 uppercase">
                      <th className="px-6 py-3.5 w-16">#</th>
                      <th className="px-6 py-3.5 w-32">Status</th>
                      <th className="px-6 py-3.5">Question</th>
                      <th 
                        className="px-6 py-3.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSort('difficulty')}
                      >
                        <div className="flex items-center">
                          Difficulty
                          <SortIcon active={sortConfig?.key === 'difficulty'} direction={sortConfig?.direction || 'asc'} />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSort('userScore')}
                      >
                        <div className="flex items-center">
                          My Mark
                          <SortIcon active={sortConfig?.key === 'userScore'} direction={sortConfig?.direction || 'asc'} />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSort('maxScore')}
                      >
                        <div className="flex items-center">
                          Possible
                          <SortIcon active={sortConfig?.key === 'maxScore'} direction={sortConfig?.direction || 'asc'} />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSort('percentage')}
                      >
                        <div className="flex items-center">
                          Score %
                          <SortIcon active={sortConfig?.key === 'percentage'} direction={sortConfig?.direction || 'asc'} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedQuestions.length > 0 ? (
                      processedQuestions.map((question, index) => {
                        const attemptStatus = getAttemptStatus(question)
                        return (
                          <tr key={question._id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900 font-mono bg-slate-100 w-8 h-8 rounded-md flex items-center justify-center">
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${attemptStatus.bg} ${attemptStatus.color} ${attemptStatus.border}`}>
                                {attemptStatus.icon}
                                <span className="font-semibold">{attemptStatus.text}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-orange-600 transition-colors">
                              {question.title}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize border ${
                                question.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                question.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {question.difficulty}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`text-sm font-bold ${getScoreColor(question.userScore, question.maxScore)}`}>
                                {question.userScore}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-500 font-medium">
                                {question.maxScore}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`text-sm font-semibold ${getPercentageColor(question.percentage)}`}>
                                {question.percentage}%
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Search className="w-8 h-8 text-slate-300 mb-2" />
                            <p>No questions found matching your filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN: Stats Cards */}
            <div className="lg:col-span-1 h-full overflow-y-auto custom-scrollbar order-1 lg:order-2 space-y-4 pb-4">
              {/* Grade Summary Card */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-300" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Your Grade</h3>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    apiData.grade.letterGrade === 'A' ? 'bg-green-500' :
                    apiData.grade.letterGrade === 'B' ? 'bg-blue-500' :
                    apiData.grade.letterGrade === 'C' ? 'bg-yellow-500' :
                    apiData.grade.letterGrade === 'D' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}>
                    {apiData.grade.letterGrade}
                  </span>
                </div>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold">{apiData.grade.percentage}%</div>
                  <div className="text-sm opacity-90 mt-1">
                    {apiData.grade.obtained} / {apiData.grade.outOf} points
                  </div>
                  {apiData.grade.passingMarksRequired && (
                    <div className="text-xs opacity-75 mt-1">
                      Passing: {apiData.grade.passingMarksRequired} points
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-sm">
                  <div>
                    <div className="opacity-75">Accuracy</div>
                    <div className="font-bold text-lg">{accuracy}%</div>
                  </div>
                  <div>
                    <div className="opacity-75">Passing</div>
                    <div className={`font-bold text-lg ${apiData.grade.isPassing ? 'text-green-300' : 'text-red-300'}`}>
                      {apiData.grade.isPassing ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Breakdown Card - Fixed to show correct totals */}
              {detailedStats && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 font-body">
                  <h3 className="text-slate-500 text-xs font-semibold uppercase mb-4 tracking-wider">Question Breakdown</h3>
                  
                  <div className="space-y-4">
                    {/* Easy */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-600 font-medium">Easy</span>
                        <span className="text-slate-600">
                          {detailedStats.easy.attempted}/{detailedStats.easy.total} attempted
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Score:</span>
                        <span className={`font-semibold ${detailedStats.easy.earnedScore > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {detailedStats.easy.earnedScore}/{detailedStats.easy.possibleScore}
                        </span>
                      </div>
                    </div>

                    {/* Medium */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-amber-500 font-medium">Medium</span>
                        <span className="text-slate-600">
                          {detailedStats.medium.attempted}/{detailedStats.medium.total} attempted
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Score:</span>
                        <span className={`font-semibold ${detailedStats.medium.earnedScore > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {detailedStats.medium.earnedScore}/{detailedStats.medium.possibleScore}
                        </span>
                      </div>
                    </div>

                    {/* Hard */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-rose-500 font-medium">Hard</span>
                        <span className="text-slate-600">
                          {detailedStats.hard.attempted}/{detailedStats.hard.total} attempted
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Score:</span>
                        <span className={`font-semibold ${detailedStats.hard.earnedScore > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {detailedStats.hard.earnedScore}/{detailedStats.hard.possibleScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Total Attempted</span>
                    <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                      {detailedStats.totalAttempted}/{detailedStats.totalQuestions}
                    </span>
                  </div>
                  
                  <div className="mt-2 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Total Score</span>
                    <span className="text-slate-900 font-bold">
                      {detailedStats.totalEarnedScore}/{detailedStats.totalPossibleScore}
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs text-slate-500 font-semibold uppercase mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Questions:</span>
                    <span className="font-semibold">{apiData.summary.totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Attempted:</span>
                    <span className="font-semibold text-emerald-600">{apiData.summary.attemptedQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Evaluated:</span>
                    <span className="font-semibold text-orange-600">{apiData.summary.evaluatedQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Correct (70%+):</span>
                    <span className="font-semibold text-emerald-600">{apiData.summary.correctQuestions}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Total Score:</span>
                    <span className="font-bold text-lg">{apiData.summary.totalScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Possible:</span>
                    <span className="font-semibold">{apiData.summary.maxPossibleScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Average Score:</span>
                    <span className="font-semibold">{apiData.summary.averageScore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}