// page.tsx - Complete with Progress Tracking
"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import ReactDOM from "react-dom"
import {
  ChevronLeft, ChevronRightIcon, ChevronRight, Folder, File, Target, BookOpen, Code,
  Loader2, LayoutDashboard, BookMarked, GraduationCap, ChevronLeft as ChevronLeftIcon,
  X, Sparkles, Hash, Layers, Eye, CheckCircle, Clock, Search, Filter, LayoutGrid, List, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, Type, FileDigit, FolderOpen, Users, Zap,
  GripVertical, Bookmark, ArrowRight, User, Info, Network, Link2, Pencil,
} from "lucide-react"
import VideoPlayer from "../../../../component/student/video-player"
import PDFViewer from "../../../../component/student/pdf-viewer"
import PPTViewer from "../../../../component/student/ppt-viewer"
import { clearAllStorage } from "@/lib/session"
import { useParams, useRouter } from "next/navigation"
import React from "react"
import NotesPanel from "../../../../component/student/notes-panel"
import AIPanel from "../../../../component/student/ai-panel"
import CodeEditor from "../../../../component/student/code-editor"
import MultiFileCodeEditor from "../../../../component/student/multi-file-code-editor"
import ZipViewer from "../../../../component/student/zipViewer"
import ImageViewer from "../../../../component/student/ImageViewer"
import WordViewer from "../../../../component/student/word-viewer"
import Exercises from "../../../../component/student/exercises"
import Assessments from "../../../../component/student/assessments"
import { useTheme as useNextTheme } from "next-themes"
import AIChat from "@/app/lms/component/student/ai-chat"
import SummaryChat from "@/app/lms/component/student/summary-chat"
import DBQueryEditor from "@/app/lms/component/student/db-queryEditor"
import { toast, ToastContainer } from 'react-toastify'
import { toast as hotToast } from 'react-hot-toast'
import 'react-toastify/dist/ReactToastify.css'
import { userPermission } from "@/apiServices/tokenVerify"
import { injectTryItButtons } from '../../utils/injectTryItButtons'
import TxtViewer from "../../../../component/student/textdoc"

// Import progress tracking functions
import {
  recordResourceOpen,
  recordResourceClose,
  recordMethodSelect,
  recordActivitySelect,
  fetchStudentProgress,
  StudentProgress
} from '../../../../../../apiServices/progress';

import { T, METHOD_CFG, RES_LABEL, FONT_PRIMARY, FONT_INTER_IMPORT } from "../components/types/constants"
import { TopBar } from "../components/TopBar"
import { Sidebar, LogoutModal, buildHoursMap } from "../components/Sidebar"
import { CourseSidebar } from "../components/CourseSidebar"
import { postLogout } from "@/apiServices/activityLog"
import { TabBar, MainTabs } from "../components/TabBar"
import InlineAIChat from "../components/InlineAIChat"
import InlineSummaryChat from "../components/InlineSummaryChat"
import { ResourceCard, ResourceSkeleton, ResourceItem, ResourceGroupRow, EmptyCard, ResIcon, ResourceTableHeader, SidebarSkeleton, TableSkeleton } from "../components/ResourceComponents"
import {
  CourseData, SelectedItem, SelectedItemType, Resource, ResourceType,
  PedagogyPage, PedagogyFolder, PedagogyFile, LearningElement,
  PedagogySubItem
} from "../components/types/types"
import {
  getFileType, getFileUrl, getFileUrlString, formatSubItemName, normalizeKey,
  hasChildItems, hasPedagogyData, shouldShowDownload, downloadFile, openPageInNewTab,
  groupResources,
  fmtSize, parseSize, parseDate, stampActiveTabOnPlaygrounds, detectUrlType
} from "../components/types/utils"


import { fetchAllPedagogyViews, fetchPedagogyViewById } from '../.../../../../../../../apiServices/pedagogyAndModuleAdd/pedagogy';
import StudentTestYourSkillsMCQQuestion from "@/app/lms/component/student/YouDo/testYourSkillMcqquestion"
import { Loading } from "@/components/loading-ui/loading"
import { useCourseDetailQuery } from "@/queries/courses"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"

// You Do → Assessment subcategory key variants (handles legacy spellings).
const ASSESSMENT_SUBCATEGORY_KEYS = new Set(["assessment", "assessments", "assesment", "assesments"])
// Mock vs Final classification, read from exerciseInformation.testType
// ('practice' | 'mock' | 'final'). Anything that isn't explicitly "final"
// is treated as Mock so no assessment ever disappears from both lists.
const isFinalAssessment = (ex: any) =>
  String(ex?.exerciseInformation?.testType || '').toLowerCase() === 'final'

// ── Course Structure accordion helpers (image 3 design) ──────────────────────
// Per-module folder accent, cycled by index to mirror the reference's varied colors.
const MODULE_PALETTE = [
  { icon: '#F59E0B', bg: '#FEF3C7' }, // amber
  { icon: '#8B5CF6', bg: '#EDE9FE' }, // purple
  { icon: '#3B82F6', bg: '#DBEAFE' }, // blue
  { icon: '#10B981', bg: '#D1FAE5' }, // green
  { icon: '#06B6D4', bg: '#CFFAFE' }, // cyan
  { icon: '#EC4899', bg: '#FCE7F3' }, // pink
]
// Format decimal hours → "2h 30m" / "45m".
const fmtDuration = (h: number): string => {
  const mins = Math.round((h || 0) * 60)
  if (!mins) return ''
  const hr = Math.floor(mins / 60), mn = mins % 60
  return hr ? (mn ? `${hr}h ${mn}m` : `${hr}h`) : `${mn}m`
}
// All leaf node ids under a module (used for real completion from visitedNodes).
const collectLeafIds = (m: any): string[] => {
  const ids: string[] = []
  const walkTopic = (t: any) => {
    if (t.subTopics?.length) t.subTopics.forEach((st: any) => ids.push(st._id))
    else ids.push(t._id)
  }
  if (m.subModules?.length) m.subModules.forEach((sm: any) => {
    if (sm.topics?.length) sm.topics.forEach(walkTopic)
    else ids.push(sm._id)
  })
  else if (m.topics?.length) m.topics.forEach(walkTopic)
  else ids.push(m._id)
  return ids
}
// First real level found among a module's descendants, else the course level.
const deriveLevel = (m: any, courseLevel?: string): string => {
  const scan = (t: any): string => {
    if (t.level) return t.level
    if (t.subTopics?.length) for (const st of t.subTopics) { if (st.level) return st.level }
    return ''
  }
  if (m.subModules?.length) for (const sm of m.subModules) if (sm.topics?.length) for (const t of sm.topics) { const l = scan(t); if (l) return l }
  if (m.topics?.length) for (const t of m.topics) { const l = scan(t); if (l) return l }
  return courseLevel || ''
}
// Direct-child count + label for the module's pill.
const moduleChildInfo = (m: any): { n: number; label: string } => {
  if (m.subModules?.length) return { n: m.subModules.length, label: m.subModules.length === 1 ? 'Sub-module' : 'Sub-modules' }
  if (m.topics?.length) return { n: m.topics.length, label: m.topics.length === 1 ? 'Topic' : 'Topics' }
  return { n: 0, label: '' }
}

// ── Submodule Details page palette (premium redesign) ────────────────────────
const DETAIL_UI = {
  navy: '#101A35',
  slate: '#42516F',
  orange: '#F45116',
  orangeDeep: '#F0440A',
  orangeLight: '#FFF0E8',
  peach: '#FFE4D5',
  mint: '#DDF7EF',
  green: '#16805C',
  blueLight: '#DDF0FF',
  blue: '#1670C5',
  tableHeaderBg: '#F3F6FC',
}
// Icon representing each hierarchy node type in the redesigned detail header/table.
const detailTypeIcon = (type: string) =>
  type === 'module' ? Folder : type === 'submodule' ? Layers : type === 'topic' ? Hash : Bookmark

export default function LMSPage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useNextTheme()
  const courseId = params?.id as string
  const queryClient = useQueryClient()
  const courseDetailQuery = useCourseDetailQuery(courseId)
  const save = (k: string, v: string) => { if (typeof window !== 'undefined') localStorage.setItem(k, v) }
  const load = (k: string) => { if (typeof window !== 'undefined') return localStorage.getItem(k); return null }

  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>(() => load('lms_student_selected_method') || "")
  const [selectedActivity, setSelectedActivity] = useState<string>(() => load('lms_student_selected_activity') || "")
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedSubModules, setExpandedSubModules] = useState<Set<string>>(new Set())
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [currentHierarchy, setCurrentHierarchy] = useState<string[]>([])
  const [activeViewer, setActiveViewer] = useState<{
    type: "video" | "pdf" | "ppt" | "zip" | "image" | "word" | "txt" | null;
    resource: Resource | null
  }>({ type: null, resource: null })
  const [imagePlaylist, setImagePlaylist] = useState<Array<{ id: string; title: string; fileUrl: string }>>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [currentFolder, setCurrentFolder] = useState<Resource | null>(null)
  const [folderPath, setFolderPath] = useState<Resource[]>([])
  const [selectedResourceType, setSelectedResourceType] = useState<ResourceType | "all">("all")
  const [userSelectedResourceType, setUserSelectedResourceType] = useState<boolean>(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedExercise, setSelectedExercise] = useState<any>(null)
  const [exerciseResetProgress, setExerciseResetProgress] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState("")
  const [inlinePageIndex, setInlinePageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<string | null>("Overview")
  const [activeSubcategory, setActiveSubcategory] = useState<string>("")
  // Student view → You Do → Assessment splits into Mock / Final lists.
  const [assessmentTestType, setAssessmentTestType] = useState<'mock' | 'final'>('mock')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [descriptionHasMoreContent, setDescriptionHasMoreContent] = useState(false)
  const [resourceSearch, setResourceSearch] = useState("")
  const [showResourceFilters, setShowResourceFilters] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [resourceView, setResourceView] = useState<"grid" | "list">("list")
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "size_desc" | "size_asc">("newest")
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)
  const canToggleHeader = activeTab !== "Overview"
const sortDropdownRef = useRef<HTMLDivElement>(null)
// True while we're restoring node+tab+activity after returning from an exercise,
// so the full-screen loader stays up until the whole view is in place.
const isRestoringRef = useRef(false)
const [showTestComponent, setShowTestComponent] = useState(false);
const [testQuestions, setTestQuestions] = useState<any[]>([]);
const [testConfig, setTestConfig] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  // Add this temporarily in your student view render section
useEffect(() => {
  if (selectedMethod && selectedActivity) {
    const folders = getFolders();
    console.log('🔍 FOLDERS DEBUG:', {
      totalFolders: folders.length,
      foldersWithGroupId: folders.filter(f => f.groupId).map(f => ({ name: f.title, groupId: f.groupId })),
      allFolders: folders.map(f => ({ name: f.title, hasGroupId: !!f.groupId, groupId: f.groupId }))
    });
  }
}, [selectedMethod, selectedActivity, selectedItem]);
const handleCloseQuiz = () => {
  setShowTestComponent(false);
  setTestQuestions([]);
  setTestConfig(null);
  // No additional navigation - just close the modal/component
};
const handleOpenTestYourSkills = useCallback(async (testData: any) => {
  if (!testData?.questions || testData.questions.length === 0) {
    toast.warning("No questions available for this test");
    return;
  }

  // Transform the test data to match what StudentTestYourSkillsMCQQuestion expects
  const transformedQuestions = testData.questions.map((q: any, idx: number) => ({
    id: q._id,
    testItemKey: q._id,
    title: q.mcqQuestionTitle,
    type: q.mcqQuestionType || "multiple_choice",
    duration: testData.timeLimit || 60,
    marks: q.mcqQuestionScore || testData.pointsPerQuestion || 1,
    level: q.mcqQuestionDifficulty || "medium",
    status: "active",
    createdAt: q.createdAt || new Date().toISOString(),
    sequence: q.sequence || idx,
    questionData: q,
  }));

  setTestQuestions(transformedQuestions);
  setTestConfig({
    timeLimit: testData.timeLimit || 60,
    passingScore: testData.passingScore || 70,
    attemptLimit: testData.attemptLimit || 1,
    shuffleQuestions: testData.shuffleQuestions || false,
    showResults: testData.showResults !== false,
    totalPoints: testData.totalPoints || transformedQuestions.length,
  });
  setShowTestComponent(true);
}, []);
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
      setShowSortDropdown(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])
  // Progress tracking state
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null)

  // Loading states
  const [isLoadingResources, setIsLoadingResources] = useState(false)

  // Helper function to get current user ID from JWT token
  const getCurrentUserId = (): string | null => {
    try {
      const { valid, user: tokenUser } = userPermission();
      if (valid && tokenUser?._id) {
        return tokenUser._id;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }

    // Fallback to localStorage
    const userId = localStorage.getItem('smartcliff_userId');
    if (userId) return userId;

    try {
      const raw = localStorage.getItem('smartcliff_userData');
      if (raw) {
        const userData = JSON.parse(raw);
        return userData?._id || null;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }

    return null;
  };

  // Helper function to count total nodes in course
  const countTotalNodes = (modules: any[]): number => {
    let count = 0;
    modules.forEach(module => {
      count++; // module itself
      if (module.subModules?.length) {
        module.subModules.forEach((submodule: any) => {
          count++; // submodule
          if (submodule.topics?.length) {
            submodule.topics.forEach((topic: any) => {
              count++; // topic
              if (topic.subTopics?.length) {
                count += topic.subTopics.length; // subtopics
              }
            });
          }
        });
      } else if (module.topics?.length) {
        module.topics.forEach((topic: any) => {
          count++; // topic
          if (topic.subTopics?.length) {
            count += topic.subTopics.length; // subtopics
          }
        });
      }
    });
    return count;
  };

  /**
   * The AI Chat / AI Summary / Notes switches Course Setup stores per resource
   * type (`resourcesType.iDo.<type>.aiChat` etc.) — the sub-rows under each
   * type's "Max file size" field. Every viewer reads its own type's row, so
   * turning AI Summary on for PDF doesn't light it up inside the PPT viewer.
   *
   * Defaults to off: a switch the course never turned on must not surface a
   * button, and a course with no saved config has enabled nothing.
   */
  const viewerFeaturesFor = (type: "ppt" | "pdf" | "video" | "image" | "zip") => {
    const cfg = courseData?.resourcesType?.iDo?.[type];
    return {
      aiChatEnabled: !!cfg?.aiChat,
      aiSummaryEnabled: !!cfg?.aiSummary,
      notesEnabled: !!cfg?.notes,
    };
  };

  // Helper function to find node title by ID
  const findNodeTitleById = (nodeId: string, courseData: CourseData | null): string => {
    if (!courseData?.modules) return 'Unknown';

    for (const module of courseData.modules) {
      if (module._id === nodeId) return module.title;
      if (module.subModules) {
        for (const submodule of module.subModules) {
          if (submodule._id === nodeId) return submodule.title;
          if (submodule.topics) {
            for (const topic of submodule.topics) {
              if (topic._id === nodeId) return topic.title;
              if (topic.subTopics) {
                for (const subtopic of topic.subTopics) {
                  if (subtopic._id === nodeId) return subtopic.title;
                }
              }
            }
          }
        }
      }
      if (module.topics) {
        for (const topic of module.topics) {
          if (topic._id === nodeId) return topic.title;
          if (topic.subTopics) {
            for (const subtopic of topic.subTopics) {
              if (subtopic._id === nodeId) return subtopic.title;
            }
          }
        }
      }
    }
    return 'Unknown';
  };

  useEffect(() => {
    if (courseData?.courseDescription) {
      const plainText = courseData.courseDescription.replace(/<[^>]*>/g, '')
      const wordCount = plainText.split(/\s+/).length
      setDescriptionHasMoreContent(plainText.length > 350 || wordCount > 60)
    }
  }, [courseData?.courseDescription])

  // Fetch student progress on page load — cached so re-visits hit cache.
  const progressUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!courseId) return
    const userId = getCurrentUserId()
    progressUserIdRef.current = userId
    if (!userId) {
      console.warn('No user ID found, cannot load progress')
      return
    }
    const cacheKey = queryKeys.progress.forUserCourse(userId, courseId)
    const cached = queryClient.getQueryData<StudentProgress | null>(cacheKey)
    if (cached) {
      setStudentProgress(cached)
      return
    }
    queryClient
      .fetchQuery({
        queryKey: cacheKey,
        queryFn: () => fetchStudentProgress(userId, courseId),
        staleTime: 3 * 60 * 1000,
      })
      .then((progress) => {
        if (progress) {
          setStudentProgress(progress as StudentProgress)
        }
      })
      .catch((e) => { console.error('Progress fetch failed:', e) })
  }, [courseId, queryClient])

  // ── Pedagogy counter helpers ──────────────────────────────────────────────
  const countPedActivities = (pedagogy: any, method: "I_Do" | "We_Do" | "You_Do"): number => {
    if (!pedagogy?.[method]) return 0
    const cat = pedagogy[method]
    if (Array.isArray(cat)) return cat.length
    if (typeof cat === 'object') return Object.keys(cat).length
    return 0
  }

  const expandAll = useCallback(() => {
    if (!courseData?.modules) return
    const allModuleIds = new Set<string>()
    const allSubModuleIds = new Set<string>()
    const allTopicIds = new Set<string>()
    courseData.modules.forEach(m => {
      allModuleIds.add(m._id)
      if (m.subModules) {
        m.subModules.forEach(sm => {
          allSubModuleIds.add(sm._id)
          if (sm.topics) sm.topics.forEach(t => { allTopicIds.add(t._id) })
        })
      }
      if (m.topics) m.topics.forEach(t => { allTopicIds.add(t._id) })
    })
    setExpandedModules(allModuleIds)
    setExpandedSubModules(allSubModuleIds)
    setExpandedTopics(allTopicIds)
  }, [courseData])

  const collapseAll = useCallback(() => {
    setExpandedModules(new Set())
    setExpandedSubModules(new Set())
    setExpandedTopics(new Set())
  }, [])

  // Course Structure (Overview) — search filter + course bookmark toggle.
  const [structureSearch, setStructureSearch] = useState('')
  const [courseBookmarked, setCourseBookmarked] = useState(false)

  // Add this state to store pedagogy view data
  const [pedagogyViewData, setPedagogyViewData] = useState<any>(null);
  const [selectedPedagogyEntry, setSelectedPedagogyEntry] = useState<any>(null);
  const hoursMap = useMemo(() => {
    if (!pedagogyViewData) return {}
    return buildHoursMap([pedagogyViewData], courseId)
  }, [pedagogyViewData, courseId])

  // Fetch pedagogy view data through the cache so repeat visits are instant.
  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    const cacheKey = queryKeys.pedagogy.viewForCourse(courseId)
    const cached = queryClient.getQueryData<any>(cacheKey)
    if (cached) {
      setPedagogyViewData(cached)
      return () => { cancelled = true }
    }
    queryClient
      .fetchQuery({
        queryKey: cacheKey,
        staleTime: 3 * 60 * 1000,
        queryFn: async () => {
          const allViews = await fetchAllPedagogyViews()
          const match = allViews.find(view => {
            const viewCourseId = typeof view.courses === 'string'
              ? view.courses
              : (view.courses as any)?.toString()
            return viewCourseId === courseId
          })
          if (!match) return null
          return await fetchPedagogyViewById(match._id)
        },
      })
      .then((detailedView) => {
        if (!cancelled && detailedView) setPedagogyViewData(detailedView)
      })
      .catch((e) => { console.error('Pedagogy view fetch failed:', e) })
    return () => { cancelled = true }
  }, [courseId, queryClient])

  // ── FIXED: Find description for any node (module, submodule, topic, subtopic) ──
  const findNodeDescription = useCallback((nodeId: string): string | null => {
    if (!courseData?.modules) return null

    for (const module of courseData.modules) {
      // Check module
      if (module._id === nodeId) {
        return module.description || null
      }

      // Check submodules
      if (module.subModules) {
        for (const submodule of module.subModules) {
          if (submodule._id === nodeId) {
            return submodule.description || null
          }

          // Check topics in submodule
          if (submodule.topics) {
            for (const topic of submodule.topics) {
              if (topic._id === nodeId) {
                return topic.description || null
              }

              // Check subtopics
              if (topic.subTopics) {
                for (const subtopic of topic.subTopics) {
                  if (subtopic._id === nodeId) {
                    return subtopic.description || null
                  }
                }
              }
            }
          }
        }
      }

      // Check direct topics in module
      if (module.topics) {
        for (const topic of module.topics) {
          if (topic._id === nodeId) {
            return topic.description || null
          }

          // Check subtopics
          if (topic.subTopics) {
            for (const subtopic of topic.subTopics) {
              if (subtopic._id === nodeId) {
                return subtopic.description || null
              }
            }
          }
        }
      }
    }

    return null
  }, [courseData])

  const learningElements = (): LearningElement[] => {
    const cp = { I_Do: courseData?.I_Do, We_Do: courseData?.We_Do, You_Do: courseData?.You_Do }
    if (!cp || (!cp.I_Do && !cp.We_Do && !cp.You_Do)) return []
    const create = (type: "i-do" | "we-do" | "you-do", ped: Record<string, any> | string[] | undefined): LearningElement => {
      const subs: PedagogySubItem[] = []
      if (ped) {
        if (Array.isArray(ped)) {
          ped.forEach((item, i) => {
            const key = typeof item === 'string' ? item.toLowerCase().replace(/\s+/g, '_') : `item_${i}`
            const name = typeof item === 'string' ? item : `Activity ${i + 1}`
            let ar: PedagogySubItem = { key, name, description: '', files: [], folders: [], links: [] }
            if (selectedItem?.pedagogy) {
              const pk = type === 'i-do' ? 'I_Do' : type === 'we-do' ? 'We_Do' : 'You_Do'
              const tp = selectedItem.pedagogy[pk]
              if (tp && typeof tp === 'object' && !Array.isArray(tp)) {
                const ak = Object.keys(tp).find(k => normalizeKey(k) === normalizeKey(key))
                if (ak) {
                  const ad = tp[ak]
                  if (ad && typeof ad === 'object' && (ad.files || ad.folders || ad.links)) {
                    ar = { key, name, description: ad.description || '', files: ad.files || [], folders: ad.folders || [], links: ad.links || [] }
                  }
                }
              }
            }
            subs.push(ar)
          })
        } else if (typeof ped === 'object') {
          if (type === 'we-do' && Array.isArray(courseData?.We_Do)) {
            courseData!.We_Do.forEach((n: string) => subs.push({ key: n.toLowerCase().replace(/\s+/g, '_'), name: n, description: '', files: [], folders: [], links: [] }))
          } else {
            Object.entries(ped).forEach(([key, item]) => {
              if (item) subs.push({ key, name: formatSubItemName(key), description: item.description || '', files: item.files || [], folders: item.folders || [], links: item.links || [] })
            })
          }
        }
      }
      const mc = METHOD_CFG[type]
      return { id: type, title: mc.label, type, icon: Target, color: mc.color, subItems: subs }
    }
    return [create("i-do", cp.I_Do), create("we-do", cp.We_Do), create("you-do", cp.You_Do)]
  }

const subcategories = useMemo(() => {
  const elements = learningElements()
  const youDoSubItems = elements.find(e => e.id === "you-do")?.subItems || []
  
  // Add test_your_skills if it exists in the pedagogy
  if (selectedItem?.pedagogy?.You_Do?.test_your_skills) {
    const existingTestSkill = youDoSubItems.find(s => s.key === "test_your_skills")
    if (!existingTestSkill) {
      youDoSubItems.push({
        key: "test_your_skills",
        name: "Test Your Skills",
        description: "",
        files: [],
        folders: [],
        links: []
      })
    }
  }
  
  return {
    I_Do: elements.find(e => e.id === "i-do")?.subItems.map(s => ({ 
      key: s.key, 
      label: s.name, 
      icon: <div />, 
      component: s 
    })) || [],
    We_Do: elements.find(e => e.id === "we-do")?.subItems.map(s => ({ 
      key: s.key, 
      label: s.name, 
      icon: <div />, 
      component: s 
    })) || [],
    You_Do: youDoSubItems.map(s => ({ 
      key: s.key, 
      label: s.name, 
      icon: <div />, 
      component: s 
    })),
  }
}, [selectedItem])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === "Overview") { setSelectedMethod(""); setSelectedActivity(""); return }
    const method = tab === "I_Do" ? "i-do" : tab === "We_Do" ? "we-do" : "you-do"
    setSelectedMethod(method)
    setSelectedActivity("")
    setUserSelectedResourceType(false)
    // Track method selection
    const userId = getCurrentUserId()
    if (userId && courseId && selectedItem) {
      recordMethodSelect(userId, courseId, tab, selectedItem.id, selectedItem.title)
    }
  }

  const handleSubcategoryChange = (sub: string, component: any) => {
    setActiveSubcategory(sub)
    setSelectedActivity(sub)
    setUserSelectedResourceType(false)
    // Track activity/subcategory selection
    const userId = getCurrentUserId()
    if (userId && courseId && selectedItem && selectedMethod) {
      recordActivitySelect(userId, courseId, selectedMethod, sub, selectedItem.id, selectedItem.title)
    }
  }

  useEffect(() => {
    if (selectedMethod) {
      const tab = selectedMethod === "i-do" ? "I_Do" : selectedMethod === "we-do" ? "We_Do" : "You_Do"
      setActiveTab(tab)
    } else {
      setActiveTab(prev => prev === "Overview" ? "Overview" : null)
    }
    setActiveSubcategory(selectedActivity)
  }, [selectedMethod, selectedActivity])

  useEffect(() => {
    setResourceSearch("")
    setShowResourceFilters(false)
    setShowSortDropdown(false)
  }, [selectedMethod, selectedActivity, selectedItem?.id])

  useEffect(() => {
    if (!canToggleHeader && isHeaderCollapsed) setIsHeaderCollapsed(false)
  }, [canToggleHeader, isHeaderCollapsed])

  // ── Resource view-duration tracking (I Do only, for now) ───────────────────
  // Holds the currently-open I Do resource so we can stamp a close time / duration.
  const openResourceRef = useRef<{ logId: string | null; resourceId: string; openedAt: number; pending: Promise<string | null> | null } | null>(null)

  const flushResourceClose = (opts?: { keepalive?: boolean }) => {
    const cur = openResourceRef.current
    if (!cur) return
    openResourceRef.current = null   // clear first so we never send twice
    const userId = getCurrentUserId()
    if (!userId || !courseId) return
    const durationSec = Math.max(0, Math.round((Date.now() - cur.openedAt) / 1000))
    const send = (logId: string | null) => { if (logId) recordResourceClose(userId, courseId, logId, durationSec, opts) }
    if (cur.logId) send(cur.logId)
    else if (cur.pending) cur.pending.then(send).catch(() => {})
  }

  // Keep a stable handle to the latest flush for unload listeners.
  const flushRef = useRef(flushResourceClose)
  flushRef.current = flushResourceClose

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushRef.current({ keepalive: true }) }
    const onPageHide = () => flushRef.current({ keepalive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      flushRef.current({ keepalive: true })   // flush on unmount / navigation away
    }
  }, [])

  const closeAllViewers = () => {
    flushResourceClose()   // stamp close time on the resource being closed
    setActiveViewer({ type: null, resource: null })
    setShowNotesPanel(false)   // ← ADD THIS
  }
  const openViewer = (type: "video" | "pdf" | "ppt" | "zip" | "image" | "word", resource: Resource) => setActiveViewer({ type, resource })

  // Invalidate this course's cache (and the legacy ["course", id] cache used by
  // sibling features) so the next render reflects fresh server state.
  const refreshCourseData = useCallback(() => {
    if (!courseId) return
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) })
    queryClient.invalidateQueries({ queryKey: ["course", courseId] })
  }, [courseId, queryClient])

  // Tests now open in a SEPARATE TAB, so a submission made there never refreshes
  // this list tab — the Start → Submitted state (driven by courseData's
  // participant answers) stayed stale. Refetch course data whenever this tab
  // regains visibility/focus, so returning after submitting reflects it without
  // a manual reload. Lightly throttled to avoid refetching on every tab flick.
  const lastReturnRefetchRef = useRef(0)
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastReturnRefetchRef.current < 1500) return
      lastReturnRefetchRef.current = now
      refreshCourseData()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [refreshCourseData])

  // Show the "submitted successfully" toast handed over by the exam page after
  // it redirected back here (survives the navigation reliably via sessionStorage).
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('lms_submit_toast')
      if (msg) { sessionStorage.removeItem('lms_submit_toast'); setTimeout(() => hotToast.success(msg), 300) }
    } catch { /* ignore */ }
  }, [])

  // Bridge useQuery → existing local state model. The TanStack cache is the
  // source of network truth; courseData is the rendering source the tree below
  // already binds to. This avoids touching the deep tree wiring.
  useEffect(() => {
    if (!courseId) { setError("No course ID."); setIsLoading(false); return }
    if (courseDetailQuery.error) {
      const e = courseDetailQuery.error as { message?: string }
      setError(e.message || "Error")
      setIsLoading(false)
      return
    }
    const payload = courseDetailQuery.data
    if (!payload) return
    const info = (payload.data ?? payload) as CourseData
    setCourseData(info)
    const hasRestore = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('restoreNodeId')
    if (!hasRestore && !load('lms_student_selected_node_id')) {
      setIsLoading(false)
      if (info?.modules?.length && info.modules.length > 0) setExpandedModules(prev => prev.size === 0 ? new Set([info.modules![0]._id]) : prev)
    }
  }, [courseId, courseDetailQuery.data, courseDetailQuery.error])

  // ── Re-sync selectedItem.pedagogy when courseData refetches ─────────────────
  // selectedItem.pedagogy is captured ONCE at click time (in handleItemSelect)
  // and is what every downstream consumer reads — including the You Do
  // assessment list and its availabilityPeriod (start/end dates). When a
  // teacher edits an exercise's Schedule via the settings modal, the modal
  // calls refreshCourseData → React Query refetches → courseData updates with
  // the new availabilityPeriod. Without this effect, selectedItem.pedagogy
  // would stay frozen on the old snapshot, so the assessment row would keep
  // rendering the previous Start/End dates (and the "Inactive" badge derived
  // from them) until the user manually clicked the tree node again.
  useEffect(() => {
    if (!selectedItem?.id || !courseData?.modules) return
    const findPedagogy = (modules: any[]): any | null => {
      for (const m of modules) {
        if (m._id === selectedItem.id) return m.pedagogy
        if (Array.isArray(m.subModules)) {
          for (const sub of m.subModules) {
            if (sub._id === selectedItem.id) return sub.pedagogy
            if (Array.isArray(sub.topics)) {
              for (const t of sub.topics) {
                if (t._id === selectedItem.id) return t.pedagogy
                if (Array.isArray(t.subTopics)) {
                  for (const st of t.subTopics) {
                    if (st._id === selectedItem.id) return st.pedagogy
                  }
                }
              }
            }
          }
        }
        if (Array.isArray(m.topics)) {
          for (const t of m.topics) {
            if (t._id === selectedItem.id) return t.pedagogy
            if (Array.isArray(t.subTopics)) {
              for (const st of t.subTopics) {
                if (st._id === selectedItem.id) return st.pedagogy
              }
            }
          }
        }
      }
      return null
    }
    const fresh = findPedagogy(courseData.modules as any)
    if (!fresh) return
    setSelectedItem(prev => {
      // Reference compare avoids a no-op render on every courseData tick — the
      // refetched object will be a different reference whenever the server
      // payload actually changed.
      if (!prev || prev.pedagogy === fresh) return prev
      return { ...prev, pedagogy: fresh }
    })
  }, [courseData, selectedItem?.id])

  const getStudentAnswers = useCallback((): Record<string, any> | undefined => {
    if (!courseData?.batchAndParticipants || !Array.isArray(courseData.batchAndParticipants)) return undefined
    let currentUserId: string | undefined
    try {
      const { valid, user: tokenUser } = userPermission()
      if (valid && tokenUser?._id) currentUserId = tokenUser._id
    } catch { }
    if (!currentUserId) currentUserId = localStorage.getItem('smartcliff_userId') || undefined
    if (!currentUserId) {
      try {
        const raw = localStorage.getItem('smartcliff_userData')
        if (raw) { const u = JSON.parse(raw); currentUserId = u?._id }
      } catch { }
    }
    if (!currentUserId) return undefined
    const participant = courseData.batchAndParticipants
      .flatMap((b: any) => b?.users || [])
      .find((p: any) => p.user?._id === currentUserId)
    if (!participant) return undefined
    const courseEntry = participant.user?.courses?.find((c: any) => c.courseId === courseId)
    return courseEntry?.answers ?? undefined
  }, [courseData, courseId])

  // UPDATED: handleItemSelect with progress tracking
  const handleItemSelect = useCallback(async (itemId: string, itemTitle: string, itemType: SelectedItemType, hierarchyIds: string[], pedagogy?: any) => {
    if (selectedItem?.id === itemId) return
    save('lms_student_selected_node_id', itemId)
    const findLabel = (id: string): string => {
      if (!courseData?.modules) return "Unknown"
      for (const m of courseData.modules) {
        if (m._id === id) return m.title
        if (m.subModules) for (const sm of m.subModules) { if (sm._id === id) return sm.title; if (sm.topics) for (const t of sm.topics) { if (t._id === id) return t.title; if (t.subTopics) for (const st of t.subTopics) if (st._id === id) return st.title } }
        if (m.topics) for (const t of m.topics) { if (t._id === id) return t.title; if (t.subTopics) for (const st of t.subTopics) if (st._id === id) return st.title }
      }
      return "Unknown"
    }
    setCurrentHierarchy(hierarchyIds.map(findLabel))
    setSelectedItem({ id: itemId, title: itemTitle, type: itemType, hierarchy: hierarchyIds, pedagogy })
    // Selecting any node resets to its Overview (below), so the method/activity
    // must clear too — otherwise a stale You-Do→Assessment selection leaves the
    // Mock/Final third-level row showing under the Overview tab when switching
    // to a sibling topic in the same module.
    setSelectedMethod(""); setSelectedActivity("")
    setActiveTab("Overview")
    setCurrentFolder(null)
    setFolderPath([])
    closeAllViewers()
    setUserSelectedResourceType(false)
    setSortOption("newest")
    // Node-visit tracking removed — selecting a module/submodule/topic/subtopic is no longer stored as "visited".
  }, [courseData, selectedItem, courseId])

  // UPDATED: handleResourceClick with progress tracking
  const handleResourceClick = async (resource: Resource) => {
    closeAllViewers()
    if (resource.isFolder && resource.folderContents) {
      // If navigating from root, always start a fresh path to prevent stale accumulation
      setFolderPath(currentFolder ? (p => [...p, resource]) : [resource])
      setCurrentFolder(resource)
      return
    }
    if (resource.type === "page") { openPageInNewTab(resource._combinedCode || ""); return }
    if (resource.isReference) {
      const aft = getFileType(resource.fileUrl || '', resource.fileName || '')
      if (aft === "video") { openViewer("video", resource); }
      else if (aft === "ppt") { openViewer("ppt", resource); }
      else if (aft === "pdf") { openViewer("pdf", resource); }
      else if (aft === "zip") { openViewer("zip", resource); }
      else if (aft === "image") {
        const playlist = getResourcesByType("image").map(r => ({ id: r.id, title: r.title, fileUrl: getFileUrl(r.fileUrl || '') }))
        const idx = playlist.findIndex(p => p.id === resource.id)
        setImagePlaylist(playlist)
        setCurrentImageIndex(Math.max(0, idx))
        openViewer("image", resource)
      }
      else if (aft === "word") { openViewer("word", resource) }
      else if (aft === "txt") { openViewer("txt", resource) }  // ← ADD THIS

      else {
        let u = resource.externalUrl
        if (!u && resource.fileUrl) {
          if (typeof resource.fileUrl === 'object' && resource.fileUrl.base) u = resource.fileUrl.base
          else if (typeof resource.fileUrl === 'string') u = resource.fileUrl
        }
        if (u) window.open(u, '_blank', 'noopener,noreferrer')
      }
    } else {
      if (resource.type === "video") { openViewer("video", resource); }
      else if (resource.type === "ppt") { openViewer("ppt", resource); }
      else if (resource.type === "pdf") { openViewer("pdf", resource); }
      else if (resource.type === "zip") { openViewer("zip", resource); }
      else if (resource.type === "image") {
        const playlist = getResourcesByType("image").map(r => ({ id: r.id, title: r.title, fileUrl: getFileUrl(r.fileUrl || '') }))
        const idx = playlist.findIndex(p => p.id === resource.id)
        setImagePlaylist(playlist)
        setCurrentImageIndex(Math.max(0, idx))
        openViewer("image", resource)
      }
      else if (resource.type === "word") { openViewer("word", resource) }
      else if (resource.type === "txt") { openViewer("txt", resource) }  // ← ADD THIS

      else if (resource.type === "link") {
        let u = resource.externalUrl
        if (!u && resource.fileUrl) {
          if (typeof resource.fileUrl === 'object' && resource.fileUrl.base) u = resource.fileUrl.base
          else if (typeof resource.fileUrl === 'string') u = resource.fileUrl
        }
        if (u) {
          const ut = detectUrlType(u)
          if (ut === "video") openViewer("video", { ...resource, fileUrl: u, type: "video" })
          else if (ut === "ppt") openViewer("ppt", { ...resource, fileUrl: u, type: "ppt" })
          else if (ut === "pdf") openViewer("pdf", { ...resource, fileUrl: u, type: "pdf" })
          else window.open(u, '_blank', 'noopener,noreferrer')
        }
      }
    }

    // ── PROGRESS TRACKING: Record resource open (for non-exercise resources) ──
    // Don't track exercises here - they have their own answer submission system
    if (resource.id && resource.type !== 'exercise') {
      const userId = getCurrentUserId()
      if (userId && courseId && resource.id) {
        const isIDo = selectedMethod === 'i-do'
        const openedAt = Date.now()
        // Fire and forget — resolves to the created log id (for close-time stamping)
        const pending = recordResourceOpen(
          userId, courseId, resource.id, resource.title, resource.type, isIDo ? 'I_Do' : undefined,
          selectedItem?.title, selectedItem?.type
        ).then(result => {
          if (result.success) {
            // Update local state
            setStudentProgress(prev => {
              if (!prev) return prev
              const updatedOpenedResources = prev.openedResources.includes(resource.id)
                ? prev.openedResources
                : [...prev.openedResources, resource.id]
              return {
                ...prev,
                openedResources: updatedOpenedResources
              }
            })
          }
          return result.logId ?? null
        })
        // I Do only (for now): remember this open so its close time / duration is stamped.
        if (isIDo) {
          openResourceRef.current = { logId: null, resourceId: resource.id, openedAt, pending }
          pending.then(id => {
            if (openResourceRef.current && openResourceRef.current.resourceId === resource.id) {
              openResourceRef.current.logId = id
            }
          }).catch(() => {})
        }
      }
    }
  }

  useEffect(() => {
    if (!courseData?.modules) return
    // While a restore is in flight, keep the loader up; restore() turns it off
    // once the tab + activity are applied (otherwise this would flash early).
    if (selectedItem) { if (!isRestoringRef.current) setIsLoading(false); return }

    // Restore the EXACT node + method + activity. Two sources, in priority order:
    //   1) URL query params (?restoreNodeId/method/activity) — sent by exam
    //      pages on their way back, so they "win" by being explicit.
    //   2) localStorage — the auto-persist effect writes the user's last
    //      sidebar selection here so a bare reload of /coursesdetailedview/{id}
    //      also restores the same node + tab + subcategory.
    const restoreParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
    let nid: string | null = restoreParams.get('restoreNodeId')
    let sm: string | null = restoreParams.get('method')    // 'i-do' | 'we-do' | 'you-do'
    let sa: string | null = restoreParams.get('activity')  // e.g. 'Assignments'
    const fromUrl = !!nid
    if (!nid && typeof window !== 'undefined') {
      nid = localStorage.getItem('lms_student_selected_node_id')
      if (!sm) sm = localStorage.getItem('lms_student_selected_method')
      if (!sa) sa = localStorage.getItem('lms_student_selected_activity')
    }
    if (nid) {
      const restore = (id: string, title: string, type: SelectedItemType, hier: string[], ped?: any) => {
        isRestoringRef.current = true
        // handleItemSelect resets method/activity/tab to Overview as part of
        // its normal "click a node" flow. It's `async` but contains no awaits,
        // so all its state setters run synchronously in this block. By IMMEDIATELY
        // re-applying the saved method/activity/tab/subcategory in the SAME
        // batched update (no setTimeout), React 18 collapses everything into a
        // single render — the page reveals with the sidebar, tab AND subcategory
        // already in place, no Overview flash.
        handleItemSelect(id, title, type, hier, ped)
        if (sm) {
          setSelectedMethod(sm)
          setActiveTab(sm === "i-do" ? "I_Do" : sm === "we-do" ? "We_Do" : "You_Do")
        }
        if (sa) {
          setSelectedActivity(sa)
          setActiveSubcategory(sa)
        }
        isRestoringRef.current = false
        setIsLoading(false)
      }
      const walk = (modules: any[]): boolean => {
        for (const m of modules) {
          if (m._id === nid) { restore(m._id, m.title, "module", [m._id], m.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); return true }
          if (m.subModules) for (const sub of m.subModules) {
            if (sub._id === nid) { restore(sub._id, sub.title, "submodule", [m._id, sub._id], sub.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); setExpandedSubModules(p => new Set(p).add(sub._id)); return true }
            if (sub.topics) for (const t of sub.topics) {
              if (t._id === nid) { restore(t._id, t.title, "topic", [m._id, sub._id, t._id], t.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); setExpandedSubModules(p => new Set(p).add(sub._id)); setExpandedTopics(p => new Set(p).add(t._id)); return true }
              if (t.subTopics) for (const st of t.subTopics) if (st._id === nid) { restore(st._id, st.title, "subtopic", [m._id, sub._id, t._id, st._id], st.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); setExpandedSubModules(p => new Set(p).add(sub._id)); setExpandedTopics(p => new Set(p).add(t._id)); return true }
            }
          }
          if (m.topics) for (const t of m.topics) {
            if (t._id === nid) { restore(t._id, t.title, "topic", [m._id, t._id], t.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); setExpandedTopics(p => new Set(p).add(t._id)); return true }
            if (t.subTopics) for (const st of t.subTopics) if (st._id === nid) { restore(st._id, st.title, "subtopic", [m._id, t._id, st._id], st.pedagogy); setExpandedModules(p => new Set(p).add(m._id)); setExpandedTopics(p => new Set(p).add(t._id)); return true }
          }
        }
        return false
      }
      const found = walk(courseData.modules as any)
      // Strip the restore params ONLY when they came from the URL — otherwise
      // there's nothing to strip (the bare-reload path uses localStorage).
      if (fromUrl) router.replace(`/lms/pages/courses/coursesdetailedview/${courseId}`)
      // When a node was found, the restore() helper turns off the loader after
      // the tab + activity are applied. If nothing matched, fall through below.
      if (found) return
    }
    setIsLoading(false)
  }, [courseData, handleItemSelect, selectedItem])

  // ── Auto-persist sidebar/tab selection ──────────────────────────────────────
  // The restore effect above can pull these back on reload only if we save them
  // somewhere durable. The node id is already saved by handleItemSelect (line
  // 782); this effect mirrors that for the tab (method) and subcategory
  // (activity). When the value is EMPTY (e.g. user clicked Overview), we
  // remove the key — unless a restore is mid-flight, in which case the
  // transient '' from handleItemSelect clearing state would wipe our cache.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedMethod) localStorage.setItem('lms_student_selected_method', selectedMethod)
    else if (!isRestoringRef.current) localStorage.removeItem('lms_student_selected_method')
    if (selectedActivity) localStorage.setItem('lms_student_selected_activity', selectedActivity)
    else if (!isRestoringRef.current) localStorage.removeItem('lms_student_selected_activity')
  }, [selectedMethod, selectedActivity])

  useEffect(() => {
    if (selectedMethod && selectedActivity && selectedItem?.pedagogy) {
      if (!userSelectedResourceType) setSelectedResourceType("all")
    }
  }, [selectedMethod, selectedActivity, selectedItem?.pedagogy])

 const getFolders = (): Resource[] => {
  if (!selectedMethod || !selectedActivity || !selectedItem?.pedagogy) return []
  const mk: Record<string, 'I_Do' | 'We_Do' | 'You_Do'> = {
    'i-do': 'I_Do',
    'we-do': 'We_Do',
    'you-do': 'You_Do',
  }
  const tk = mk[selectedMethod]
  if (!tk) return []
  const cat = selectedItem.pedagogy[tk]
  if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return []
  const fk = Object.keys(cat).find(
    k => normalizeKey(k) === normalizeKey(selectedActivity)
  )
  if (!fk) return []
  const ad = (cat as any)[fk] as any
  if (!ad?.folders?.length) return []

  const toIso = (value: any): string => {
    if (!value) return ""
    if (typeof value === "string") return value
    if (value instanceof Date) return value.toISOString()
    if (typeof value === "object" && value.$date) return value.$date
    return ""
  }

  return ad.folders
    .filter((folder: any) => !folder.parentId)  // only root-level folders
    .map((folder: any) => {
      const directFiles = folder.files?.length || 0
      const directSubfolders = folder.subfolders?.length || 0
      const directPages = folder.pages?.length || 0
      const totalItems = directFiles + directSubfolders + directPages

      return {
        id: folder._id || `folder-${folder.name}-${Math.random().toString(36).substr(2, 5)}`,
        title: folder.name,
        type: 'folder' as ResourceType,
        isFolder: true,
        folderContents: extractAllFilesFromFolders([folder]),
        fileSize: `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`,
        uploadedAt: toIso(folder.uploadedAt) || toIso(folder.updatedAt) || toIso(folder.createdAt),
        tags: folder.tags || [],
        // CRITICAL: Preserve group properties from the API response.
        // Folders inside a group carry `parentGroupId` (set by the teacher upload flow,
        // see Coursecontent.tsx:978) — files use `groupId`. Accept either for safety.
        groupId: folder.parentGroupId || folder.groupId || undefined,
        groupName: folder.groupName || undefined,
      } as Resource
    })
}
const extractAllFilesFromFolders = (folders: any[]): Resource[] => {
  const all: Resource[] = []

  const proc = (folder: any) => {
    // Process subfolders — only carry their OWN group membership.
    // CRITICAL: Do NOT inherit `folder.parentGroupId` here. Group membership is
    // a root-level concept (depth = 1) — nested subfolders are plain folders
    // inside their parent. Inheriting would make children re-render under the
    // parent group accordion when the user drills past Level 1, matching the
    // teacher-side rule in FileUploadModal.tsx (`isTopLevelGroupMember = relPath.length === 1`).
    if (folder.subfolders?.length) {
      folder.subfolders.forEach((sf: any) => {
        const sfId = sf._id || `sf-${Math.random().toString(36).substr(2, 5)}`
        const sfContents = extractAllFilesFromFolders([sf])

        const sfItem: Resource = {
          id: sfId,
          title: sf.name,
          type: 'folder' as ResourceType,
          isFolder: true,
          folderContents: sfContents,
          fileSize: `${(sf.files?.length || 0) + (sf.subfolders?.length || 0) + (sf.pages?.length || 0)} items`,
          uploadedAt: (typeof sf.uploadedAt === 'object' && sf.uploadedAt?.$date) ? sf.uploadedAt.$date : (sf.uploadedAt || sf.updatedAt || sf.createdAt || ""),
          tags: sf.tags || [],
          // Only the subfolder's OWN parentGroupId/groupId — never inherited from the wrapping folder.
          groupId: sf.parentGroupId || sf.groupId || undefined,
          groupName: sf.groupName || undefined,
        }
        all.push(sfItem)
      })
    }

    // Process files — only carry their OWN group membership.
    // Same reasoning as above: a file nested inside a folder inside a group is
    // NOT directly in the group. The teacher-side upload flow only stamps
    // parentGroupId on files when they sit at group root (path.length === 0),
    // so inheriting from folder.groupId here would re-introduce the leak.
    folder.files?.forEach((file: any) => {
      const ft = getFileType(file.fileUrl, file.fileType, file.fileName)
      const r: Resource = {
        id: file._id || `f-${Math.random().toString(36).substr(2, 5)}`,
        title: file.fileName || 'Untitled',
        type: file.isReference ? 'reference' : ft,
        fileName: file.fileName,
        fileSize: fmtSize(file.size),
        uploadedAt: (typeof file.uploadedAt === 'object' && file.uploadedAt?.$date) ? file.uploadedAt.$date : (file.uploadedAt || file.updatedAt || ""),
        isReference: file.isReference || false,
        fileSettings: file.fileSettings,
        isVideo: file.isVideo,
        isArchive: file.isArchive,
        availableResolutions: file.availableResolutions || [],
        fileUrlMap: typeof file.fileUrl === 'object' && file.fileUrl !== null ? file.fileUrl : {},
        mcqQuestions: (file as any).mcqQuestions || [],
        tags: file.tags || [],
        // Only the file's OWN groupId — never inherited from the wrapping folder.
        groupId: file.groupId || undefined,
        groupName: file.groupName || undefined,
        parentGroupId: file.parentGroupId || undefined,
      }
      if (ft === 'link') r.externalUrl = getFileUrl(file.fileUrl)
      else r.fileUrl = getFileUrl(file.fileUrl)
      all.push(r)
    })

    // Process pages stored inside this folder (pages[])
    folder.pages?.forEach((page: any) => {
      if (!page?.combinedCode) return
      const rawId = page._id
      const pid = (typeof rawId === 'object' && rawId?.$oid) ? rawId.$oid : rawId ? String(rawId) : `p-${Math.random().toString(36).substr(2, 5)}`
      const r: Resource = {
        id: pid,
        title: page.title || 'Untitled Page',
        type: 'page' as ResourceType,
        fileUrl: '',
        fileSize: page.pageCount ? `${page.pageCount} pg` : '1 pg',
        uploadedAt: (typeof page.createdAt === 'object' && page.createdAt?.$date) ? page.createdAt.$date : (page.createdAt || ''),
        _combinedCode: page.combinedCode,
        _pageCount: page.pageCount || 1,
        groupId: page.groupId || undefined,
        groupName: page.groupName || undefined,
        tags: page.tags || [],
      }
      all.push(r)
    })
  }

  folders.forEach(f => proc(f))
  return all
}
  const getResourcesByType = (type: ResourceType): Resource[] => {
    if (!selectedMethod || !selectedActivity || !selectedItem?.pedagogy) return []
    if (type === "page") {
      return getPagesForActivity().map(p => ({
        id: p._id, title: p.title, type: "page" as ResourceType, fileUrl: "",
        fileSize: p.pageCount ? `${p.pageCount} pg` : "1 pg",
        uploadedAt: (typeof p.createdAt === 'object' && (p.createdAt as any)?.$date) ? (p.createdAt as any).$date : (p.createdAt || ""),
        _combinedCode: p.combinedCode, _pageCount: p.pageCount || 1,
        groupId: p.groupId || undefined,
        groupName: p.groupName || undefined,
      }))
    }
    const mk: Record<string, "I_Do" | "We_Do" | "You_Do"> = { "i-do": "I_Do", "we-do": "We_Do", "you-do": "You_Do" }
    const tk = mk[selectedMethod]
    if (!tk) return []
    const cat = selectedItem.pedagogy[tk]
    if (!cat || typeof cat !== "object" || Array.isArray(cat)) return []
    const fk = Object.keys(cat).find(k => normalizeKey(k) === normalizeKey(selectedActivity))
    if (!fk) return []
    const ad = (cat as any)[fk] as any
    if (!ad) return []
    const dfs: Resource[] = (ad.files || [])
      .filter((f: any) => !f.folderId &&  // files inside folders surface via getFolders(), not at root
        (!f.fileSettings || f.fileSettings.showToStudents !== false) &&
        (type === "reference" ? f.isReference === true : getFileType(f.fileUrl, f.fileType, f.fileName) === type && !f.isReference)).map((f: any) => {
          const ft = getFileType(f.fileUrl, f.fileType, f.fileName)
          const r: Resource = {
            id: f._id || `f-${Math.random().toString(36).substr(2, 5)}`,
            title: f.fileName || "Untitled", type: f.isReference ? "reference" : ft,
            fileName: f.fileName,
            fileSize: fmtSize(f.size),
            uploadedAt: (typeof f.uploadedAt === 'object' && f.uploadedAt?.$date) ? f.uploadedAt.$date : (f.uploadedAt || f.updatedAt || ""),
            isReference: f.isReference || false, fileSettings: f.fileSettings,
            isVideo: f.isVideo, isArchive: f.isArchive,
            availableResolutions: f.availableResolutions || [],
            fileUrlMap: typeof f.fileUrl === 'object' && f.fileUrl !== null ? f.fileUrl : {},
            mcqQuestions: (f as any).mcqQuestions || [], tags: f.tags || [],
            groupId: (f as any).groupId || undefined,
            groupName: (f as any).groupName || undefined,
            parentGroupId: (f as any).parentGroupId || undefined,
          }
          if (ft === "link") r.externalUrl = getFileUrl(f.fileUrl)
          else r.fileUrl = getFileUrl(f.fileUrl)
          return r
        })
    const links: Resource[] = type === "link" ? (ad.links || []).map((l: any) => ({
      id: l._id || `l-${Math.random().toString(36).substr(2, 5)}`, title: l.name, type: "link" as ResourceType,
      externalUrl: l.url,
      uploadedAt: (typeof l.uploadedAt === 'object' && l.uploadedAt?.$date) ? l.uploadedAt.$date : (l.uploadedAt || l.updatedAt || ""),
      fileSettings: { showToStudents: true, allowDownload: true },
    })) : []
    if (type === "link") return [...dfs.filter(f => f.type === "link"), ...links]
    return dfs
  }

  const getPagesForActivity = (): PedagogyPage[] => {
    if (!selectedMethod || !selectedActivity || !selectedItem?.pedagogy) return []
    const mk: Record<string, "I_Do" | "We_Do" | "You_Do"> = { "i-do": "I_Do", "we-do": "We_Do", "you-do": "You_Do" }
    const tk = mk[selectedMethod]; if (!tk) return []
    const cat = selectedItem.pedagogy[tk]
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return []
    const fk = Object.keys(cat).find(k => normalizeKey(k) === normalizeKey(selectedActivity))
    if (!fk) return []
    const ad = (cat as any)[fk]
    if (!ad || typeof ad !== 'object' || Array.isArray(ad)) return []
    return Array.isArray(ad.pages) ? ad.pages.filter((p: PedagogyPage) => p?._id && p?.title && p?.combinedCode) : []
  }

const getExercisesForActivity = (): any[] => {
  if (!selectedMethod || !selectedActivity) return []
  try {
    const mk: Record<string, "I_Do" | "We_Do" | "You_Do"> = {
      "i-do": "I_Do",
      "we-do": "We_Do",
      "you-do": "You_Do"
    }
    const tk = mk[selectedMethod]
    if (!tk) return []

    const tKey = normalizeKey(selectedActivity)

    // ── You Do → Assessment: shared common list across the whole course ──
    // By design, the student should see every assessment in the course
    // without having to drill into each hierarchy node looking for assigned
    // work. So when the student lands on any hierarchy node and opens
    // You Do → Assessment, we walk the entire course tree and aggregate
    // every node's pedagogy.You_Do.assessments (incl. the legacy spelling
    // variants) into one de-duplicated list. All other subcategories keep
    // the existing per-node behaviour below.
    const ASSESSMENT_KEYS = new Set(["assessment", "assessments", "assesment", "assesments"])
    if (tk === "You_Do" && ASSESSMENT_KEYS.has(tKey)) {
      const collected: any[] = []
      const seen = new Set<string>()
      const walk = (node: any) => {
        if (!node) return
        const yd = node?.pedagogy?.You_Do
        if (yd && typeof yd === 'object' && !Array.isArray(yd)) {
          // Buckets are stored under the tab label as typed ("Assesment",
          // "assessments", ...) — match by normalized key, not literal access.
          for (const key of Object.keys(yd)) {
            if (!ASSESSMENT_KEYS.has(normalizeKey(key))) continue
            const arr = (yd as any)[key]
            if (Array.isArray(arr)) {
              for (const ex of arr) {
                const id = ex?._id ? String(ex._id) : ''
                if (id && !seen.has(id)) {
                  seen.add(id)
                  collected.push(ex)
                }
              }
            }
          }
        }
        ;(node.subModules || []).forEach(walk)
        ;(node.topics || []).forEach(walk)
        ;(node.subTopics || []).forEach(walk)
      }
      ;(courseData?.modules || []).forEach(walk)
      return collected
    }

    if (!selectedItem?.pedagogy) return []
    const cat = selectedItem.pedagogy[tk]
    if (!cat || typeof cat !== 'object') return []

    // Check if it's "test_your_skills" in You Do
    if (tk === "You_Do" && tKey === "test_your_skills") {
      const testData = (cat as any)["test_your_skills"]
      if (testData && testData.questions && testData.questions.length) {
        return [{ 
          _id: "test_your_skills",
          exerciseType: "TestYourSkills",
          testData: testData,
          isTestYourSkills: true
        }]
      }
      return []
    }
    
    if (Array.isArray((cat as any)[tKey])) return (cat as any)[tKey]
    const fk = Object.keys(cat).find(k => normalizeKey(k) === tKey)
    if (fk) { 
      const d = (cat as any)[fk]
      if (Array.isArray(d)) return d
      // Check for test_your_skills in the activity object
      if (d && d.test_your_skills) {
        return [{ 
          _id: "test_your_skills",
          exerciseType: "TestYourSkills", 
          testData: d.test_your_skills,
          isTestYourSkills: true
        }]
      }
      return []
    }
    return []
  } catch { return [] }
}


  const getAllResources = (): Resource[] => {
    const all: Resource[] = []
    const types: ResourceType[] = ["page", "pdf", "ppt", "video", "zip", "link", "image", "word", "reference", "txt"]
    types.forEach(t => all.push(...getResourcesByType(t)))
    return all
  }

  // Resolve the EXACT server locator for the file currently open in a viewer.
  // The server's findFileInPedagogy does an exact `pedagogy[tabType].get(subcategory)`
  // and matches folder names — so we must send the real pedagogy key (not the
  // normalized display value) and the in-activity folder names (NOT the course
  // breadcrumb in `currentHierarchy`).
  const getFileMcqLocator = () => {
    const mk: Record<string, "I_Do" | "We_Do" | "You_Do"> = { "i-do": "I_Do", "we-do": "We_Do", "you-do": "You_Do" }
    const tabType = mk[selectedMethod] || "I_Do"
    let subcategory = selectedActivity
    const cat = (selectedItem?.pedagogy as any)?.[tabType]
    if (cat && typeof cat === "object" && !Array.isArray(cat)) {
      const fk = Object.keys(cat).find(k => normalizeKey(k) === normalizeKey(selectedActivity))
      if (fk) subcategory = fk
    }
    return {
      tabType,
      subcategory,
      folderPath: folderPath.map(f => f.title || f.fileName || "").filter(Boolean),
    }
  }

  const getAvailableResourceTypes = (): ResourceType[] => {
    if (!selectedMethod || !selectedActivity || !selectedItem?.pedagogy) return []
    const types: ResourceType[] = []
    if (getPagesForActivity().length > 0) types.push("page")
    if (getFolders().length > 0) types.push("folder")
    const resourceTypes: ResourceType[] = ["pdf", "ppt", "video", "zip", "link", "image", "word", "reference", "txt"]
    resourceTypes.forEach(t => { if (getResourcesByType(t).length > 0) types.push(t) })
    return types
  }

 const resourcesToDisplay = (() => {
  if (selectedResourceType === "folder") return getFolders()
  if (selectedResourceType === "all") {
    // Merge files and folders together so groupResources handles grouping for both
    const allFiles = getAllResources()
    const allFolders = getFolders()
    // Folders without groupId go at the end; folders with groupId merge in with files
    // so groupResources can bucket them correctly
    return [...allFiles, ...allFolders]
  }
  return getResourcesByType(selectedResourceType)
})()
  const normalizedResourceSearch = resourceSearch.trim().toLowerCase()
  const matchesResourceSearch = (resource: Resource) => {
    if (!normalizedResourceSearch) return true
    const title = (resource.title || "").toLowerCase()
    const type = (resource.type || "").toLowerCase()
    return title.includes(normalizedResourceSearch) || type.includes(normalizedResourceSearch)
  }

  const filteredResourcesToDisplay = resourcesToDisplay.filter(matchesResourceSearch)
  const filteredPages = getResourcesByType("page").filter(matchesResourceSearch)
  const selectedFilterCount = selectedResourceType === "all" ? 0 : 1

  const sortResources = useCallback((items: Resource[]) => {
    return [...items].sort((a, b) => {
      if (sortOption === "name_asc") return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      if (sortOption === "name_desc") return b.title.toLowerCase().localeCompare(a.title.toLowerCase())
      if (sortOption === "size_desc") return parseSize(b.fileSize || "-") - parseSize(a.fileSize || "-")
      if (sortOption === "size_asc") return parseSize(a.fileSize || "-") - parseSize(b.fileSize || "-")
      const aDate = parseDate(a.uploadedAt || "")
      const bDate = parseDate(b.uploadedAt || "")
      return sortOption === "newest" ? bDate - aDate : aDate - bDate
    })
  }, [sortOption])

  useEffect(() => {
    if (inlinePageIndex > 0 && inlinePageIndex >= filteredPages.length) setInlinePageIndex(0)
  }, [inlinePageIndex, filteredPages.length])

  const getFilteredFolderContents = (): Resource[] => {
    if (!currentFolder?.folderContents) return []
    return [...currentFolder.folderContents].filter(matchesResourceSearch)
  }

  const handleDownloadClick = async (resource: Resource, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!resource.isReference || resource.fileSettings?.allowDownload === false) return
    await downloadFile(resource)
  }

  const handleExerciseSelect = async (exercise: any, options?: { resetProgress?: boolean }) => {
    let qs: any[] = []
    if (exercise.isTestYourSkills || exercise.exerciseType === "TestYourSkills") {
      handleOpenTestYourSkills(exercise.testData);
      return;
    }
    if (exercise.questions && Array.isArray(exercise.questions)) qs = exercise.questions
    else if (exercise.exerciseInformation?.questions) qs = exercise.exerciseInformation.questions
    else if (exercise.data?.questions) qs = exercise.data.questions

    // Section-based exercises store questions in sectionConfigs, not questions[] — skip guard
    const isSecBased = exercise?.exerciseType === 'SectionBased' || exercise?.isSectionBased === true
    if (!qs.length && !isSecBased) { toast.warning("Exercise not yet configured."); return }

    const mk: Record<string, string> = { 'i-do': 'I_Do', 'we-do': 'We_Do', 'you-do': 'You_Do' }
    const catP = mk[selectedMethod] || 'We_Do'
    const eid = exercise?._id
    const cname = courseData?.courseName || "Course"
    const stored = { ...exercise, questions: qs, courseId, courseName: cname, context: { courseId, nodeId: selectedItem?.id, nodeTitle: selectedItem?.title, method: selectedMethod, activity: selectedActivity }, storedAt: new Date().toISOString() }

    // You Do → route to youdo/* pages; We Do / I Do → existing pages
    const prefix = selectedMethod === 'you-do' ? 'youdo/' : ''

    const nav = (path: string, key: string, extra: Record<string, string> = {}) => {
      localStorage.setItem(key, JSON.stringify(stored))
      router.push(`/lms/pages/courses/coursesdetailedview/${prefix}${path}?${new URLSearchParams({ courseId, courseName: cname, exerciseId: eid || '', subcategory: selectedActivity || '', category: catP, questionCount: qs.length.toString(), ...extra })}`)
    }

    if (exercise.exerciseType === "Combined") nav('combined', 'currentCombinedExercise', { exerciseName: exercise.exerciseInformation?.exerciseName || 'Combined Exercise', nodeId: selectedItem?.id || '', nodeName: selectedItem?.title || '', nodeType: selectedItem?.type || '', hierarchy: currentHierarchy.join(',') })
    else if (exercise.programmingSettings?.selectedModule === 'Frontend') nav('frontend', 'currentFrontendExercise', { exerciseName: exercise.exerciseInformation?.exerciseName || 'Frontend Exercise', nodeId: selectedItem?.id || '', nodeName: selectedItem?.title || '', nodeType: selectedItem?.type || '', hierarchy: currentHierarchy.join(',') })
    else if (exercise.programmingSettings?.selectedModule === 'Database') { toast.info("Opening SQL Exercise...", { autoClose: 2000 }); nav('sql', 'currentSQLExercise', { exerciseName: exercise.exerciseInformation?.exerciseName || 'SQL Exercise' }) }
    else if (exercise.exerciseType === "MCQ") nav('mcq', 'currentMCQExercise', { exerciseName: exercise.exerciseInformation?.exerciseName || 'MCQ Exercise', nodeId: selectedItem?.id || '', nodeName: selectedItem?.title || '', nodeType: selectedItem?.type || '', hierarchy: currentHierarchy.join(',') })
    else if (exercise.exerciseType === "Other") nav('others', 'currentOthersExercise', { exerciseName: exercise.exerciseInformation?.exerciseName || 'Other Exercise', nodeId: selectedItem?.id || '', nodeName: selectedItem?.title || '', nodeType: selectedItem?.type || '', hierarchy: currentHierarchy.join(',') })
    else {
      // Programming / Core exercise
      if (selectedMethod === 'you-do') {
        // You Do → route to youdo/programming page (uses YouDo CodeEditor)
        nav('programming', 'currentProgrammingExercise', {
          exerciseName: exercise.exerciseInformation?.exerciseName || 'Programming Exercise',
          nodeId: selectedItem?.id || '',
          nodeName: selectedItem?.title || '',
          nodeType: selectedItem?.type || '',
          hierarchy: currentHierarchy.join(','),
        })
      } else {
        // We Do / I Do programming.
        //
        // MULTI-FILE → route to a dedicated reload-safe URL (mirrors the You Do
        // /youdo/programming pattern). Refresh on that page restores files from
        // the draft and keeps the same exercise/question open.
        //
        // Single-file → keep the existing inline overlay behaviour.
        setExerciseResetProgress(options?.resetProgress ?? false)
        const isMultiFile = exercise?.questionConfiguration?.programmingQuestionConfiguration?.compilerFileMode === 'multiple'
        if (isMultiFile) {
          const routePrefix = selectedMethod === 'i-do' ? 'ido/' : 'wedo/'
          // Fetch the full exercise document so the stashed blob has totalMarks,
          // settings, etc. — same as the inline path used to.
          let stash: any = { ...exercise, questions: qs, courseId, courseName: cname, context: { courseId, nodeId: selectedItem?.id, nodeTitle: selectedItem?.title, method: selectedMethod, activity: selectedActivity }, storedAt: new Date().toISOString() }
          try {
            const token = localStorage.getItem('smartcliff_token') || localStorage.getItem('token') || ''
            const res = await fetch(`https://lmsserver-yeve.onrender.com/exercise/${exercise._id}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            })
            if (res.ok) {
              const data = await res.json()
              const full = data.data || data.exercise || data
              if (full?._id) stash = { ...full, questions: qs, courseId, courseName: cname, context: stash.context, storedAt: stash.storedAt }
            }
          } catch { /* fall through with the partial exercise */ }

          localStorage.setItem('currentProgrammingExercise', JSON.stringify(stash))
          router.push(
            `/lms/pages/courses/coursesdetailedview/${routePrefix}programming?` +
            new URLSearchParams({
              courseId,
              courseName: cname,
              exerciseId: eid || '',
              exerciseName: exercise.exerciseInformation?.exerciseName || 'Programming Exercise',
              subcategory: selectedActivity || '',
              category: catP,
              nodeId: selectedItem?.id || '',
              nodeName: selectedItem?.title || '',
              nodeType: selectedItem?.type || '',
              hierarchy: currentHierarchy.join(','),
            }).toString()
          )
          return
        }

        // Single-file (existing inline path) — fetch full document and render inline.
        try {
          const token = localStorage.getItem('smartcliff_token') || localStorage.getItem('token') || ''
          const res = await fetch(`https://lmsserver-yeve.onrender.com/exercise/${exercise._id}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
          if (res.ok) {
            const data = await res.json()
            const full = data.data || data.exercise || data
            if (full?._id) {
              setSelectedExercise({ ...full, questions: qs })
              return
            }
          }
        } catch {
          // Fall through to use the partial exercise object
        }
        setSelectedExercise(exercise)
      }
    }
  }

  const handleFolderBack = () => {
    const p = [...folderPath]
    p.pop()
    setFolderPath(p)
    if (p.length === 0) {
      setCurrentFolder(null)
    } else {
      setCurrentFolder(p[p.length - 1])
    }
  }

  /** Navigate directly to a specific level in the folder path.
   *  index = -1 → go back to root (no folder open)
   *  index = 0..n-1 → go to that folder in folderPath */
  const handleFolderNavigateToLevel = (index: number) => {
    if (index < 0) {
      setCurrentFolder(null)
      setFolderPath([])
    } else {
      const newPath = folderPath.slice(0, index + 1)
      setFolderPath(newPath)
      setCurrentFolder(newPath[newPath.length - 1])
    }
  }

  const buildBreadcrumbs = () => {
    const items: Array<{ label: string; icon?: React.ComponentType<any>; onClick?: () => void; isLast?: boolean }> = []

    const clear = () => {
      localStorage.removeItem('lms_student_selected_node_id')
      localStorage.removeItem('lms_student_selected_method')
      localStorage.removeItem('lms_student_selected_activity')
      setSelectedItem(null); setSelectedMethod(""); setSelectedActivity("")
      setCurrentFolder(null); setFolderPath([]); closeAllViewers()
    }

    items.push({ label: "Dashboard", icon: LayoutDashboard, onClick: () => { clear(); router.push('/lms/pages/studentdashboard') } })
    items.push({ label: "Courses", icon: BookMarked, onClick: () => router.push('/lms/pages/courses') })
    if (courseData) items.push({ label: courseData.courseName, icon: GraduationCap, onClick: clear })

    return items
  }

  const toggleModule = (id: string) => { const n = new Set(expandedModules); n.has(id) ? n.delete(id) : n.add(id); setExpandedModules(n) }
  const toggleSubModule = (id: string) => { const n = new Set(expandedSubModules); n.has(id) ? n.delete(id) : n.add(id); setExpandedSubModules(n) }
  const toggleTopic = (id: string) => { const n = new Set(expandedTopics); n.has(id) ? n.delete(id) : n.add(id); setExpandedTopics(n) }

  const preparePageContent = (page: PedagogyPage): string => {
    if (!page._combinedCode) return ''
    const stamped = stampActiveTabOnPlaygrounds(page._combinedCode, [page as any])
    return injectTryItButtons(stamped)
  }

  // ── countPedResources / countPedExercises ─────────────────────────────────
  const countPedResources = (pedagogy: any, method: "I_Do" | "We_Do" | "You_Do"): number => {
    if (!pedagogy?.[method]) return 0
    const cat = pedagogy[method]
    if (typeof cat !== 'object' || Array.isArray(cat)) return 0
    let n = 0
    Object.values(cat).forEach((act: any) => {
      if (act && typeof act === 'object') n += (act.files?.length || 0) + (act.folders?.length || 0) + (act.pages?.length || 0) + (act.links?.length || 0)
    })
    return n
  }

  const countPedExercises = (pedagogy: any, method: "I_Do" | "We_Do" | "You_Do"): number => {
    if (!pedagogy?.[method]) return 0
    const cat = pedagogy[method]
    if (Array.isArray(cat)) return cat.length
    if (typeof cat === 'object') {
      let exerciseCount = 0
      Object.values(cat).forEach((act: any) => {
        if (act) {
          const hasExerciseFiles = act.files?.some((f: any) => f.exerciseType || f.isExercise) || false
          const hasExercisePages = act.pages?.some((p: any) => p.exerciseType || p.isExercise) || false
          const dedicatedExercises = act.exercises?.length || 0
          if (hasExerciseFiles || hasExercisePages) exerciseCount += 1
          exerciseCount += dedicatedExercises
        }
      })
      return exerciseCount
    }
    return 0
  }

  // ── NEW: Filtered Hierarchy Table Renderer ──────────────────────────────────
  const renderFilteredHierarchyTable = () => {
    if (!selectedItem || !courseData?.modules) return null

    const baseTdCls = "align-middle px-3.5 py-3 border-b border-[#EEF1F6]"

    // ── Premium cell renderers (icons, pills, action chevron) ────────────────
    const LeadCell = ({ icon: Icon, title, hrs, rowSpan }: { icon: any; title: string; hrs?: number; rowSpan?: number }) => (
      <td rowSpan={rowSpan} className={`${baseTdCls} border-r border-[#EEF1F6]`} style={{ background: '#FAFBFD' }}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: DETAIL_UI.peach }}>
            <Icon size={15} strokeWidth={2.2} style={{ color: DETAIL_UI.orange }} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold truncate" style={{ color: DETAIL_UI.navy, fontSize: 13.5 }}>{title}</span>
            {!!hrs && (
              <span className="flex-shrink-0 rounded font-bold" style={{ fontSize: 9.5, padding: '1px 4px', background: 'rgba(244,81,22,0.12)', color: DETAIL_UI.orange, border: '1px solid rgba(244,81,22,0.3)' }}>
                {hrs}h
              </span>
            )}
          </div>
        </div>
      </td>
    )

    const PlainCell = ({ title, hrs, rowSpan, dashedRight }: { title: string; hrs?: number; rowSpan?: number; dashedRight?: boolean }) => (
      <td rowSpan={rowSpan} className={`${baseTdCls} ${dashedRight ? 'border-r border-dashed border-[#E2E6EE]' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold truncate" style={{ color: DETAIL_UI.navy, fontSize: 13 }}>{title}</span>
          {!!hrs && (
            <span className="flex-shrink-0 rounded font-bold" style={{ fontSize: 9.5, padding: '1px 4px', background: 'rgba(99,102,241,0.10)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
              {hrs}h
            </span>
          )}
        </div>
      </td>
    )

    const SubCell = ({ title }: { title: string }) => (
      <td className={baseTdCls}>
        <span className="font-semibold" style={{ color: '#334155', fontSize: 13 }}>{title}</span>
      </td>
    )

    const DashCell = () => (
      <td className={`${baseTdCls} text-center`}>
        <span className="inline-flex items-center justify-center rounded-full font-bold" style={{ minWidth: 40, height: 28, background: DETAIL_UI.mint, color: DETAIL_UI.green, fontSize: 12.5 }}>–</span>
      </td>
    )

    const PillCell = ({ val, icon: Icon, bg, color }: { val: number; icon: any; bg: string; color: string }) => (
      <td className={`${baseTdCls} text-center`}>
        {val > 0 ? (
          <span className="inline-flex items-center justify-center gap-1 rounded-full font-bold" style={{ minWidth: 50, height: 28, padding: '0 10px', background: bg, color, fontSize: 12.5 }}>
            <Icon size={12} strokeWidth={2.3} />
            {val}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded-full font-bold" style={{ minWidth: 40, height: 28, background: DETAIL_UI.mint, color: DETAIL_UI.green, fontSize: 12.5 }}>–</span>
        )}
      </td>
    )
    const IDoCell = ({ val }: { val: number }) => <PillCell val={val} icon={BookOpen} bg={DETAIL_UI.blueLight} color={DETAIL_UI.blue} />
    const WeDoCell = ({ val }: { val: number }) => <PillCell val={val} icon={Pencil} bg="#FFF0E8" color={DETAIL_UI.orange} />
    const YouDoCell = ({ val }: { val: number }) => <PillCell val={val} icon={Target} bg="#FDE8E8" color="#DC4545" />

    const ActionCell = ({ onNavigate }: { onNavigate?: () => void }) => (
      <td className={`${baseTdCls} text-center`} style={{ width: 56 }}>
        {onNavigate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate() }}
            className="inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ width: 32, height: 32, background: '#F3F5F9', border: '1px solid #E7EAF1' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = DETAIL_UI.orangeLight }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F3F5F9' }}
            title="Open"
          >
            <ChevronRight size={15} strokeWidth={2.3} style={{ color: DETAIL_UI.navy }} />
          </button>
        )}
      </td>
    )

    // Helper to find node by ID
    const findNodeById = (id: string): any => {
      for (const m of courseData.modules) {
        if (m._id === id) return { ...m, type: 'module', module: m }
        if (m.subModules) {
          for (const sm of m.subModules) {
            if (sm._id === id) return { ...sm, type: 'submodule', module: m, submodule: sm }
            if (sm.topics) {
              for (const t of sm.topics) {
                if (t._id === id) return { ...t, type: 'topic', module: m, submodule: sm, topic: t }
                if (t.subTopics) {
                  for (const st of t.subTopics) {
                    if (st._id === id) return { ...st, type: 'subtopic', module: m, submodule: sm, topic: t, subtopic: st }
                  }
                }
              }
            }
          }
        }
        if (m.topics) {
          for (const t of m.topics) {
            if (t._id === id) return { ...t, type: 'topic', module: m, topic: t }
            if (t.subTopics) {
              for (const st of t.subTopics) {
                if (st._id === id) return { ...st, type: 'subtopic', module: m, topic: t, subtopic: st }
              }
            }
          }
        }
      }
      return null
    }

    const selectedNode = findNodeById(selectedItem.id)
    if (!selectedNode) return null

    const goToNode = (id: string, title: string, type: SelectedItemType, hierarchy: string[], pedagogy?: any) => () =>
      handleItemSelect(id, title, type, hierarchy, pedagogy)

    // Generate rows based on selection type
    const generateRows = (): JSX.Element[] => {
      const rows: JSX.Element[] = []
      let rowIndex = 0

      if (selectedItem.type === 'module') {
        // Show only the selected module's hierarchy
        const module = selectedNode.module
        const moduleTotalRows = (() => {
          let count = 0
          if (module.subModules?.length) {
            module.subModules.forEach((sm: any) => {
              if (sm.topics?.length) sm.topics.forEach((t: any) => { count += t.subTopics?.length || 1 })
              else count += 1
            })
          } else if (module.topics?.length) {
            module.topics.forEach((t: any) => { count += t.subTopics?.length || 1 })
          } else { count = 1 }
          return count
        })()

        if (module.subModules?.length) {
          module.subModules.forEach((submodule: any) => {
            const topics = submodule.topics || []
            if (topics.length) {
              const submoduleTotalRows = topics.reduce((acc: number, t: any) => acc + (t.subTopics?.length || 1), 0)
              topics.forEach((topic: any) => {
                const subtopics = topic.subTopics || []
                const topicRowSpan = subtopics.length || 1
                if (subtopics.length) {
                  subtopics.forEach((subtopic: any, stIdx: number) => {
                    const currentRowIndex = rowIndex++
                    const isFirstRowOfModule = currentRowIndex === 0
                    const isFirstRowOfSubmodule = topics.indexOf(topic) === 0 && stIdx === 0
                    const isFirstRowOfTopic = stIdx === 0
                    rows.push(
                      <tr key={`${module._id}-${submodule._id}-${topic._id}-${subtopic._id || stIdx}`} className="ov-tr bg-white">
                        {isFirstRowOfModule && <LeadCell icon={detailTypeIcon('module')} title={module.title} hrs={hoursMap[module._id]} rowSpan={moduleTotalRows} />}
                        {isFirstRowOfSubmodule && <PlainCell title={submodule.title} hrs={hoursMap[submodule._id]} rowSpan={submoduleTotalRows} />}
                        {isFirstRowOfTopic && <PlainCell title={topic.title} rowSpan={topicRowSpan} dashedRight />}
                        <SubCell title={subtopic.title} />
                        <IDoCell val={countPedResources(subtopic.pedagogy, "I_Do")} />
                        <WeDoCell val={countPedExercises(subtopic.pedagogy, "We_Do")} />
                        <YouDoCell val={countPedResources(subtopic.pedagogy, "You_Do")} />
                        <ActionCell onNavigate={goToNode(subtopic._id, subtopic.title, 'subtopic', [module._id, submodule._id, topic._id, subtopic._id], subtopic.pedagogy)} />
                      </tr>
                    )
                  })
                } else {
                  const currentRowIndex = rowIndex++
                  const isFirstRowOfModule = currentRowIndex === 0
                  const isFirstRowOfSubmodule = topics.indexOf(topic) === 0
                  rows.push(
                    <tr key={`${module._id}-${submodule._id}-${topic._id}`} className="ov-tr bg-white">
                      {isFirstRowOfModule && <LeadCell icon={detailTypeIcon('module')} title={module.title} hrs={hoursMap[module._id]} rowSpan={moduleTotalRows} />}
                      {isFirstRowOfSubmodule && <PlainCell title={submodule.title} hrs={hoursMap[submodule._id]} rowSpan={submoduleTotalRows} />}
                      <PlainCell title={topic.title} dashedRight />
                      <DashCell />
                      <IDoCell val={countPedResources(topic.pedagogy, "I_Do")} />
                      <WeDoCell val={countPedExercises(topic.pedagogy, "We_Do")} />
                      <YouDoCell val={countPedResources(topic.pedagogy, "You_Do")} />
                      <ActionCell onNavigate={goToNode(topic._id, topic.title, 'topic', [module._id, submodule._id, topic._id], topic.pedagogy)} />
                    </tr>
                  )
                }
              })
            } else {
              const currentRowIndex = rowIndex++
              rows.push(
                <tr key={`${module._id}-${submodule._id}`} className="ov-tr bg-white">
                  {currentRowIndex === 0 && <LeadCell icon={detailTypeIcon('module')} title={module.title} hrs={hoursMap[module._id]} rowSpan={moduleTotalRows} />}
                  <PlainCell title={submodule.title} />
                  <DashCell />
                  <DashCell />
                  <IDoCell val={countPedResources(submodule.pedagogy, "I_Do")} />
                  <WeDoCell val={countPedExercises(submodule.pedagogy, "We_Do")} />
                  <YouDoCell val={countPedResources(submodule.pedagogy, "You_Do")} />
                  <ActionCell onNavigate={goToNode(submodule._id, submodule.title, 'submodule', [module._id, submodule._id], submodule.pedagogy)} />
                </tr>
              )
            }
          })
        } else if (module.topics?.length) {
          module.topics.forEach((topic: any) => {
            const subtopics = topic.subTopics || []
            const topicRowSpan = subtopics.length || 1
            if (subtopics.length) {
              subtopics.forEach((subtopic: any, stIdx: number) => {
                const currentRowIndex = rowIndex++
                const isFirstRowOfTopic = stIdx === 0
                rows.push(
                  <tr key={`${module._id}-${topic._id}-${subtopic._id || stIdx}`} className="ov-tr bg-white">
                    {currentRowIndex === 0 && <LeadCell icon={detailTypeIcon('module')} title={module.title} hrs={hoursMap[module._id]} rowSpan={moduleTotalRows} />}
                    <DashCell />
                    {isFirstRowOfTopic && <PlainCell title={topic.title} rowSpan={topicRowSpan} dashedRight />}
                    <SubCell title={subtopic.title} />
                    <IDoCell val={countPedResources(subtopic.pedagogy, "I_Do")} />
                    <WeDoCell val={countPedExercises(subtopic.pedagogy, "We_Do")} />
                    <YouDoCell val={countPedResources(subtopic.pedagogy, "You_Do")} />
                    <ActionCell onNavigate={goToNode(subtopic._id, subtopic.title, 'subtopic', [module._id, topic._id, subtopic._id], subtopic.pedagogy)} />
                  </tr>
                )
              })
            } else {
              const currentRowIndex = rowIndex++
              rows.push(
                <tr key={`${module._id}-${topic._id}`} className="ov-tr bg-white">
                  {currentRowIndex === 0 && <LeadCell icon={detailTypeIcon('module')} title={module.title} hrs={hoursMap[module._id]} rowSpan={moduleTotalRows} />}
                  <DashCell />
                  <PlainCell title={topic.title} dashedRight />
                  <DashCell />
                  <IDoCell val={countPedResources(topic.pedagogy, "I_Do")} />
                  <WeDoCell val={countPedExercises(topic.pedagogy, "We_Do")} />
                  <YouDoCell val={countPedResources(topic.pedagogy, "You_Do")} />
                  <ActionCell onNavigate={goToNode(topic._id, topic.title, 'topic', [module._id, topic._id], topic.pedagogy)} />
                </tr>
              )
            }
          })
        }
      } else if (selectedItem.type === 'submodule') {
        // Show only the selected submodule's hierarchy
        const module = selectedNode.module
        const submodule = selectedNode.submodule

        if (submodule.topics?.length) {
          submodule.topics.forEach((topic: any) => {
            const subtopics = topic.subTopics || []
            if (subtopics.length) {
              subtopics.forEach((subtopic: any, stIdx: number) => {
                rowIndex++
                rows.push(
                  <tr key={`${submodule._id}-${topic._id}-${subtopic._id || stIdx}`} className="ov-tr bg-white">
                    {stIdx === 0 && <LeadCell icon={detailTypeIcon('topic')} title={topic.title} hrs={hoursMap[topic._id]} rowSpan={subtopics.length} />}
                    <SubCell title={subtopic.title} />
                    <IDoCell val={countPedResources(subtopic.pedagogy, "I_Do")} />
                    <WeDoCell val={countPedExercises(subtopic.pedagogy, "We_Do")} />
                    <YouDoCell val={countPedResources(subtopic.pedagogy, "You_Do")} />
                    <ActionCell onNavigate={goToNode(subtopic._id, subtopic.title, 'subtopic', [module._id, submodule._id, topic._id, subtopic._id], subtopic.pedagogy)} />
                  </tr>
                )
              })
            } else {
              rowIndex++
              rows.push(
                <tr key={`${submodule._id}-${topic._id}`} className="ov-tr bg-white">
                  <LeadCell icon={detailTypeIcon('topic')} title={topic.title} hrs={hoursMap[topic._id]} />
                  <DashCell />
                  <IDoCell val={countPedResources(topic.pedagogy, "I_Do")} />
                  <WeDoCell val={countPedExercises(topic.pedagogy, "We_Do")} />
                  <YouDoCell val={countPedResources(topic.pedagogy, "You_Do")} />
                  <ActionCell onNavigate={goToNode(topic._id, topic.title, 'topic', [module._id, submodule._id, topic._id], topic.pedagogy)} />
                </tr>
              )
            }
          })
        }
      } else if (selectedItem.type === 'topic') {
        // Show only the selected topic's subtopics
        const module = selectedNode.module
        const submodule = selectedNode.submodule
        const topic = selectedNode.topic
        const subtopics = topic.subTopics || []
        const hierBase = submodule ? [module._id, submodule._id, topic._id] : [module._id, topic._id]

        if (subtopics.length) {
          subtopics.forEach((subtopic: any) => {
            rowIndex++
            rows.push(
              <tr key={`${topic._id}-${subtopic._id}`} className="ov-tr bg-white">
                <LeadCell icon={detailTypeIcon('subtopic')} title={subtopic.title} />
                <IDoCell val={countPedResources(subtopic.pedagogy, "I_Do")} />
                <WeDoCell val={countPedExercises(subtopic.pedagogy, "We_Do")} />
                <YouDoCell val={countPedResources(subtopic.pedagogy, "You_Do")} />
                <ActionCell onNavigate={goToNode(subtopic._id, subtopic.title, 'subtopic', [...hierBase, subtopic._id], subtopic.pedagogy)} />
              </tr>
            )
          })
        } else {
          // Show just the topic itself — already the selected node, nothing to drill into
          rows.push(
            <tr key={topic._id} className="ov-tr bg-white">
              <DashCell />
              <IDoCell val={countPedResources(topic.pedagogy, "I_Do")} />
              <WeDoCell val={countPedExercises(topic.pedagogy, "We_Do")} />
              <YouDoCell val={countPedResources(topic.pedagogy, "You_Do")} />
              <ActionCell />
            </tr>
          )
        }
      } else if (selectedItem.type === 'subtopic') {
        // Show just the subtopic itself — already the selected node
        const subtopic = selectedNode.subtopic
        rows.push(
          <tr key={subtopic._id} className="ov-tr bg-white">
            <IDoCell val={countPedResources(subtopic.pedagogy, "I_Do")} />
            <WeDoCell val={countPedExercises(subtopic.pedagogy, "We_Do")} />
            <YouDoCell val={countPedResources(subtopic.pedagogy, "You_Do")} />
            <ActionCell />
          </tr>
        )
      }

      return rows
    }

    const rows = generateRows()

    // ── Premium table header cell ─────────────────────────────────────────────
    const Th = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
      <th
        className="whitespace-nowrap font-bold uppercase"
        style={{ padding: '12px 14px', fontSize: 11, letterSpacing: '0.03em', color: DETAIL_UI.navy, textAlign: center ? 'center' : 'left', borderBottom: '1.5px solid #E7EAF1' }}
      >
        {children}
      </th>
    )
    const ThIconLabel = ({ icon: Icon, color, label, suffix }: { icon: any; color: string; label: string; suffix?: string }) => (
      <span className="inline-flex items-center gap-1.5">
        <Icon size={13} strokeWidth={2.3} style={{ color }} />
        {label}{suffix && <span style={{ color: DETAIL_UI.orange }}>&nbsp;{suffix}</span>}
      </span>
    )

    // Render table headers based on selection type
    const renderTableHeaders = () => {
      const cols: React.ReactElement[] = []
      if (selectedItem.type === 'module') {
        cols.push(<Th key="mod"><ThIconLabel icon={Folder} color="#64748B" label="Module" /></Th>)
        cols.push(<Th key="sub"><ThIconLabel icon={Layers} color="#64748B" label="Submodule" /></Th>)
        cols.push(<Th key="top"><ThIconLabel icon={Layers} color="#64748B" label="Topic" /></Th>)
        cols.push(<Th key="sut"><ThIconLabel icon={Link2} color="#64748B" label="Sub-topic" /></Th>)
      } else if (selectedItem.type === 'submodule') {
        cols.push(<Th key="top"><ThIconLabel icon={Layers} color="#64748B" label="Topic" /></Th>)
        cols.push(<Th key="sut"><ThIconLabel icon={Link2} color="#64748B" label="Sub-topic" /></Th>)
      } else if (selectedItem.type === 'topic') {
        cols.push(<Th key="sut"><ThIconLabel icon={Link2} color="#64748B" label="Sub-topic" /></Th>)
      }
      cols.push(<Th key="ido" center><ThIconLabel icon={BookMarked} color={DETAIL_UI.green} label="I Do" suffix="(Resources)" /></Th>)
      cols.push(<Th key="wedo" center><ThIconLabel icon={Pencil} color="#C77800" label="We Do" suffix="(Exercises)" /></Th>)
      cols.push(<Th key="ydo" center><ThIconLabel icon={Target} color="#DC4545" label="You Do" /></Th>)
      cols.push(<th key="act" style={{ padding: '12px', borderBottom: '1.5px solid #E7EAF1', width: 56 }} />)
      return <tr style={{ background: DETAIL_UI.tableHeaderBg }}>{cols}</tr>
    }

    return (
      <div className="rounded-2xl overflow-x-auto bg-white" style={{ border: '1px solid #EEF1F6', boxShadow: '0 8px 24px rgba(30,45,80,0.05)' }}>
        <table className="w-full border-collapse" style={{ minWidth: 560 }}>
          <thead>
            {renderTableHeaders()}
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    )
  }
  // ── Logout action (sidebar Logout → confirm modal) ────────────────────────
  const handleLogout = async () => {
    try {
      // Record logout time / session duration before the token is cleared.
      await postLogout()
    } catch { /* best effort */ }
    // Wipes sessionStorage too, which localStorage.clear() alone left behind.
    clearAllStorage()
    setShowLogoutModal(false)
    router.push('/login')
  }

  // ── Logout button (reused in both sidebars) ───────────────────────────────
  const LogoutBtn = ({ onClick }: { onClick: () => void }) => (
    <div
      onClick={onClick}
      className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-t border-[#eef0f3] bg-white cursor-pointer text-gray-600 hover:text-[#F97316] transition-colors"
    >
      <div className="w-[26px] h-[26px] rounded-lg flex-shrink-0 flex items-center justify-center bg-orange-50">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>
      <span className="text-[14px] font-semibold">Logout</span>
    </div>
  )

  // ── Submodule Details "Back" button — steps up one hierarchy level ────────
  const findNodeMeta = useCallback((id: string): { id: string; title: string; type: SelectedItemType; hierarchy: string[]; pedagogy?: any } | null => {
    if (!courseData?.modules) return null
    for (const m of courseData.modules) {
      if (m._id === id) return { id: m._id, title: m.title, type: "module", hierarchy: [m._id], pedagogy: (m as any).pedagogy }
      if (m.subModules) for (const sm of m.subModules) {
        if (sm._id === id) return { id: sm._id, title: sm.title, type: "submodule", hierarchy: [m._id, sm._id], pedagogy: (sm as any).pedagogy }
        if (sm.topics) for (const t of sm.topics) {
          if (t._id === id) return { id: t._id, title: t.title, type: "topic", hierarchy: [m._id, sm._id, t._id], pedagogy: (t as any).pedagogy }
          if (t.subTopics) for (const st of t.subTopics) if (st._id === id) return { id: st._id, title: st.title, type: "subtopic", hierarchy: [m._id, sm._id, t._id, st._id], pedagogy: (st as any).pedagogy }
        }
      }
      if (m.topics) for (const t of m.topics) {
        if (t._id === id) return { id: t._id, title: t.title, type: "topic", hierarchy: [m._id, t._id], pedagogy: (t as any).pedagogy }
        if (t.subTopics) for (const st of t.subTopics) if (st._id === id) return { id: st._id, title: st.title, type: "subtopic", hierarchy: [m._id, t._id, st._id], pedagogy: (st as any).pedagogy }
      }
    }
    return null
  }, [courseData])

  const resetToCourseOverview = () => {
    setSelectedItem(null)
    setSelectedMethod("")
    setSelectedActivity("")
    setCurrentFolder(null)
    setFolderPath([])
    closeAllViewers()
    localStorage.removeItem('lms_student_selected_node_id')
    localStorage.removeItem('lms_student_selected_method')
    localStorage.removeItem('lms_student_selected_activity')
  }

  const handleBackClick = () => {
    if (!selectedItem) return
    const hier = selectedItem.hierarchy
    if (hier && hier.length > 1) {
      const parent = findNodeMeta(hier[hier.length - 2])
      if (parent) { handleItemSelect(parent.id, parent.title, parent.type, parent.hierarchy, parent.pedagogy); return }
    }
    resetToCourseOverview()
  }

  if (error) return <div className="p-6 text-red-500">Error: {error}</div>
  if (isLoading) return (
    <div className="flex justify-center items-center h-screen">
      <Loading size="size-12" color="blue" />
    </div>
  )

  return (
    <div
      className="bg-[#F5F6F8] overflow-clip h-screen flex flex-col"
      style={{ fontFamily: FONT_PRIMARY, WebkitFontSmoothing: 'antialiased' }}
    >
      <style>{`
        ${FONT_INTER_IMPORT}
        .sb-row{transition:background .12s ease;cursor:pointer}
        .sb-row:not([data-selected="true"]):hover{background:rgba(0,0,0,.02)}
        .sb-scroll{scrollbar-width:thin;scrollbar-color:#2a3048 transparent}
        .sb-scroll::-webkit-scrollbar-thumb{background:#2a3048;border-radius:3px}
        @keyframes sbSlide{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sbPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes filterContainerSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes chipSlideIn{from{opacity:0;transform:scale(0.9) translateY(-10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes subcategorySlide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pillSlideIn{from{opacity:0;transform:scale(0.85) translateX(-15px)}to{opacity:1;transform:scale(1) translateX(0)}}
        @keyframes gridCardIn{from{opacity:0;transform:scale(0.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .ov-tr:hover td{background:rgba(249,115,22,0.05)!important}
        @media(min-width:1024px){.mobile-sidebar-overlay,.mobile-sidebar{display:none!important}}
        @media(max-width:1023px){.desktop-sidebar{display:none!important}}
        /* Custom Toast Styling */
        .Toastify__toast-container--top-right{top:16px;right:16px}
        .Toastify__toast{background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 10px 40px rgba(0,0,0,0.12);padding:0;min-height:64px;font-family:${FONT_PRIMARY}}
        .Toastify__toast--success{background:linear-gradient(135deg,#fff7ed 0%,#fff 100%);border-left:4px solid #f97316}
        .Toastify__toast--error{background:linear-gradient(135deg,#fef2f2 0%,#fff 100%);border-left:4px solid #dc2626}
        .Toastify__toast--warning{background:linear-gradient(135deg,#fffbeb 0%,#fff 100%);border-left:4px solid #f59e0b}
        .Toastify__toast--info{background:linear-gradient(135deg,#fff7ed 0%,#fff 100%);border-left:4px solid #f97316}
        .Toastify__toast-body{padding:14px 16px;font-size:14.5px;font-weight:500;color:#1e293b;gap:10px}
        .Toastify__toast-icon{width:22px;height:22px}
        .Toastify__toast--success .Toastify__toast-icon{color:#f97316}
        .Toastify__toast--info .Toastify__toast-icon{color:#f97316}
        .Toastify__close-button{opacity:0.4;transition:opacity 0.2s;padding:8px}
        .Toastify__close-button:hover{opacity:1}
        .Toastify__progress-bar{height:3px;border-radius:0 0 0 2px}
        .Toastify__progress-bar--success{background:#f97316}
        .Toastify__progress-bar--info{background:#f97316}
        /* Mobile Experience Improvements */
        @media(max-width:1023px){
          .mobile-touch-target{min-height:44px;min-width:44px}
          .mobile-card{padding:16px}
          .mobile-text-base{font-size:15.5px}
          .mobile-grid{grid-template-columns:1fr!important}
          .mobile-swipe-hint{animation:swipeHint 2s ease-in-out 3}
        }
        @keyframes swipeHint{0%,100%{transform:translateX(0)}50%{transform:translateX(10px)}}
        .touch-friendly{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
        .touch-friendly:active{transform:scale(0.98)}
        .mobile-bottom-sheet{border-radius:20px 20px 0 0;max-height:85vh}
        .mobile-sidebar-swipe{position:absolute;right:0;top:50%;transform:translateY(-50%);width:20px;height:60px;background:rgba(255,255,255,0.1);border-radius:10px 0 0 10px;display:flex;align-items:center;justify-content:center}
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/35 z-40 mobile-sidebar-overlay"
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`mobile-sidebar fixed inset-y-0 left-0 w-[280px] z-50 flex flex-col bg-white border-r border-[#eef0f3] shadow-[4px_0_24px_rgba(0,0,0,0.10)] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Course sidebar — image3 look, hierarchy only */}
        <CourseSidebar
          courseName={courseData?.courseName || "Course"}
          moduleCount={courseData?.modules?.length || 0}
          sidebarSearch={sidebarSearch}
          onSearchChange={setSidebarSearch}
          onLogout={() => { setSidebarOpen(false); setShowLogoutModal(true) }}
          onCollapse={() => setSidebarOpen(false)}
        >
          {isLoading || !courseData ? <SidebarSkeleton /> : (
            <Sidebar
              courseData={courseData}
              selectedItem={selectedItem}
              expandedModules={expandedModules}
              expandedSubModules={expandedSubModules}
              expandedTopics={expandedTopics}
              sidebarSearch={sidebarSearch}
              onItemSelect={handleItemSelect}
              onToggleModule={toggleModule}
              onToggleSubModule={toggleSubModule}
              onToggleTopic={toggleTopic}
              onSearchChange={setSidebarSearch}
              courseId={courseId}
              studentProgress={studentProgress}
              topicProgress={courseData?.topicProgress}
            />
          )}
        </CourseSidebar>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Desktop sidebar — FLAT on the gray canvas (no card, no border),
            matching the upload-resources / floating-workspace shells. */}
        <div
          className="desktop-sidebar flex flex-col relative flex-shrink-0 self-stretch overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ width: sidebarOpen ? 280 : 0, minWidth: 0 }}
        >
          <div className="w-[280px] flex-1 min-h-0 flex flex-col relative">
            {/* Course sidebar — image3 look, hierarchy only */}
            <CourseSidebar
              courseName={courseData?.courseName || "Course"}
              moduleCount={courseData?.modules?.length || 0}
              sidebarSearch={sidebarSearch}
              onSearchChange={setSidebarSearch}
              onLogout={() => setShowLogoutModal(true)}
              onCollapse={() => setSidebarOpen(false)}
            >
              {isLoading || !courseData ? <SidebarSkeleton /> : (
                <Sidebar
                  courseData={courseData}
                  selectedItem={selectedItem}
                  expandedModules={expandedModules}
                  expandedSubModules={expandedSubModules}
                  expandedTopics={expandedTopics}
                  sidebarSearch={sidebarSearch}
                  onItemSelect={handleItemSelect}
                  onToggleModule={toggleModule}
                  onToggleSubModule={toggleSubModule}
                  onToggleTopic={toggleTopic}
                  onSearchChange={setSidebarSearch}
                  courseId={courseId}
                  studentProgress={studentProgress}
                  topicProgress={courseData?.topicProgress}
                />
              )}
            </CourseSidebar>
          </div>
        </div>

        {/* Sidebar open tab — appears flush on left edge when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            style={{
              position: 'fixed',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 100,
              width: 20,
              height: 56,
              borderRadius: '0 8px 8px 0',
              background: '#f5f6f8',
              border: '1px solid #eef0f3',
              borderLeft: 'none',
              boxShadow: '2px 0 8px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'background 0.15s, color 0.15s, width 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#FFF7ED'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#F97316'
              ;(e.currentTarget as HTMLButtonElement).style.width = '24px'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f5f6f8'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
              ;(e.currentTarget as HTMLButtonElement).style.width = '20px'
            }}
          >
            <ChevronRight size={12} strokeWidth={2.5} />
          </button>
        )}

        {/* Right side — a floating white workspace panel on the gray canvas
            (18px radius, gray gutter top/right/bottom), the same geometry as
            the upload-resources and dashboard shells. */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-3.5 pl-0 max-lg:p-2 max-lg:pl-2">
        <div className="relative flex-1 flex flex-col overflow-clip min-h-0 rounded-[18px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {!isHeaderCollapsed && (
            <TopBar
              items={buildBreadcrumbs()}
              onAIClick={() => setShowAIChat(v => !v)}
              onSummaryClick={() => setShowSummary(v => !v)}
              onMenuClick={() => setSidebarOpen(v => !v)}
              onNotesClick={() => setShowNotesPanel(v => !v)}
              onHideHeader={canToggleHeader ? () => setIsHeaderCollapsed(true) : undefined}
              tabs={(
                <MainTabs
                  selectedNode={!!selectedItem}
                  activeTab={activeTab}
                  subcategories={subcategories}
                  onTabChange={handleTabChange}
                  onSubcategoryChange={handleSubcategoryChange}
                  onOverviewClick={() => { setSelectedMethod(""); setSelectedActivity("") }}
                />
              )}
            />
          )}

          {/* 3-column split row */}
          <div className="flex-1 flex overflow-clip min-h-0">

            {/* Main content column - full white solid background */}
            <div className="flex-1 flex flex-col overflow-clip min-h-0 bg-white">
              {/* Secondary tab rows only — the main pedagogy tabs live in the
                  TopBar's left slot (single header row). */}
              {!isHeaderCollapsed && (
                <TabBar
                  selectedNode={!!selectedItem}
                  activeTab={activeTab}
                  activeSubcategory={activeSubcategory}
                  subcategories={subcategories}
                  onTabChange={handleTabChange}
                  onSubcategoryChange={handleSubcategoryChange}
                  onOverviewClick={() => { setSelectedMethod(""); setSelectedActivity("") }}
                  thirdLevel={(() => {
                    const yda = selectedMethod === 'you-do' && ASSESSMENT_SUBCATEGORY_KEYS.has(normalizeKey(selectedActivity))
                    if (!yda) return undefined
                    const ydaExs = getExercisesForActivity()
                    return {
                      tabs: [
                        // Both share the brand-blue accent so the row reads as its own
                        // level (distinct from the blue "Assessment" subcategory tab).
                        { key: 'mock', label: 'Mock', color: '#F97316', count: ydaExs.filter((e: any) => !isFinalAssessment(e)).length },
                        { key: 'final', label: 'Final', color: '#F97316', count: ydaExs.filter((e: any) => isFinalAssessment(e)).length },
                      ],
                      active: assessmentTestType,
                      onChange: (k: string) => setAssessmentTestType(k as 'mock' | 'final'),
                    }
                  })()}
                />
              )}

              {/* ── COURSE-LEVEL OVERVIEW ── */}
              {!selectedItem && (
                <div className="sb-scroll flex-1 overflow-y-auto px-8 py-8 animate-[fadeIn_.4s_ease_both]">
                  {/* Course Header */}
                  <div className="mb-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-sm  tracking-widest bg-orange-50 text-orange-700 border border-orange-200">
                          Course Overview
                        </span>
                        {(() => {
                          const totalHrs = courseData?.modules?.reduce((sum: number, m: any) => {
                            return sum + (hoursMap[m._id] || 0)
                          }, 0) || 0
                          if (!totalHrs) return null
                          return (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                              <Clock size={12} className="mr-1.5" />
                              {totalHrs} hours
                            </span>
                          )
                        })()}
                      </div>
                      {/* Bookmark + Continue Learning */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <button
                          onClick={() => setCourseBookmarked(v => !v)}
                          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[14.5px] font-semibold transition-colors"
                          style={{ background: courseBookmarked ? '#FFF7ED' : '#fff', border: '1.5px solid #F97316', color: '#F97316' }}
                        >
                          <Bookmark size={15} fill={courseBookmarked ? '#F97316' : 'transparent'} />
                          Bookmark
                        </button>
                        <button
                          onClick={() => {
                            const first = courseData?.modules?.[0]
                            if (first) handleItemSelect(first._id, first.title, 'module', [first._id], (first as any).pedagogy)
                          }}
                          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[14.5px] font-semibold text-white transition-colors"
                          style={{ background: '#F97316' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EA580C' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F97316' }}
                        >
                          Continue Learning
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                    <h2 className="m-0 text-xl  text-black-700 leading-tight mb-2">{courseData?.courseName}</h2>
                    <p className="m-0 text-base text-gray-500">Complete learning path with structured modules and interactive content</p>
                  </div>

                  {/* Stats Cards */}
                  {(() => {
                    const modCount = courseData?.modules?.length || 0
                    const topicCount = courseData?.modules?.reduce((a: number, m: any) =>
                      a + (m.topics?.length || 0) + (m.subModules?.reduce((b: number, sm: any) => b + (sm.topics?.length || 0), 0) || 0), 0) || 0
                    const subModCount = courseData?.modules?.reduce((a: number, m: any) => a + (m.subModules?.length || 0), 0) || 0
                    const subTopicCount = courseData?.modules?.reduce((a: number, m: any) =>
                      a + (m.topics?.reduce((b: number, t: any) => b + (t.subTopics?.length || 0), 0) || 0) +
                      (m.subModules?.reduce((b: number, sm: any) => b + (sm.topics?.reduce((c: number, t: any) => c + (t.subTopics?.length || 0), 0) || 0), 0) || 0), 0) || 0

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFEDD5' }}>
                            <Layers size={22} style={{ color: '#F97316' }} />
                          </div>
                          <div>
                            <p className="m-0 text-2xl font-extrabold text-gray-900 leading-none">{modCount}</p>
                            <p className="m-0 mt-1 text-[14.5px] font-bold text-gray-800">Modules</p>
                            <p className="m-0 text-[12.5px] text-gray-400">Across all sections</p>
                          </div>
                        </div>
                        {subModCount > 0 && (
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EDE9FE' }}>
                              <Folder size={22} style={{ color: '#8B5CF6' }} />
                            </div>
                            <div>
                              <p className="m-0 text-2xl font-extrabold text-gray-900 leading-none">{subModCount}</p>
                              <p className="m-0 mt-1 text-[14.5px] font-bold text-gray-800">Sub-modules</p>
                              <p className="m-0 text-[12.5px] text-gray-400">Detailed learning units</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFEDD5' }}>
                            <BookOpen size={22} style={{ color: '#FB923C' }} />
                          </div>
                          <div>
                            <p className="m-0 text-2xl font-extrabold text-gray-900 leading-none">{topicCount}</p>
                            <p className="m-0 mt-1 text-[14.5px] font-bold text-gray-800">Topics</p>
                            <p className="m-0 text-[12.5px] text-gray-400">Core topics covered</p>
                          </div>
                        </div>
                        {subTopicCount > 0 && (
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#D1FAE5' }}>
                              <Hash size={22} style={{ color: '#10B981' }} />
                            </div>
                            <div>
                              <p className="m-0 text-2xl font-extrabold text-gray-900 leading-none">{subTopicCount}</p>
                              <p className="m-0 mt-1 text-[14.5px] font-bold text-gray-800">Sub-topics</p>
                              <p className="m-0 text-[12.5px] text-gray-400">Deep dive areas</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Description */}
                  <h3 className="mt-2.5 mb-2.5 text-base  text-black-700">Course Description</h3>
                  {courseData?.courseDescription && (
                    <>
                      <div
                        className="mb-3 text-[13.5px] text-black-600 leading-[1.8] rounded-xl transition-all duration-300"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: isDescriptionExpanded ? 'unset' : 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        dangerouslySetInnerHTML={{ __html: courseData.courseDescription }}
                      />
                      {descriptionHasMoreContent && (
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="bg-transparent border-none text-orange-500 text-[14.5px] font-semibold cursor-pointer py-1 mb-5 inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                        >
                          {isDescriptionExpanded ? 'View less' : 'View more'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: isDescriptionExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}

                  {/* Course Structure — accordion (image 3 design) */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="m-0 text-lg font-bold text-gray-900">Course Structure</h3>
                      <p className="m-0 text-base text-gray-500">Click any row to explore content and resources</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          value={structureSearch}
                          onChange={(e) => setStructureSearch(e.target.value)}
                          placeholder="Search in course content..."
                          className="h-11 w-72 pl-10 pr-4 rounded-xl text-base bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 text-gray-700"
                        />
                      </div>
                      {(() => {
                        const allExpanded = !!courseData?.modules?.length && courseData.modules.every((m: any) => expandedModules.has(m._id))
                        return (
                          <button
                            onClick={() => (allExpanded ? collapseAll() : expandAll())}
                            className="h-11 px-5 rounded-xl text-base font-semibold whitespace-nowrap transition-colors"
                            style={{ background: '#fff', border: '1.5px solid #F97316', color: '#F97316' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFF7ED' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
                          >
                            {allExpanded ? 'Collapse All' : 'Expand All'}
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  {isLoading || !courseData ? (
                    <TableSkeleton />
                  ) : (
                    <div className="flex flex-col gap-3 mb-6">
                      {(courseData?.modules || [])
                        .filter((m: any) => !structureSearch.trim() || (m.title || '').toLowerCase().includes(structureSearch.trim().toLowerCase()))
                        .map((module: any, idx: number) => {
                          const c = MODULE_PALETTE[idx % MODULE_PALETTE.length]
                          const info = moduleChildInfo(module)
                          const dur = fmtDuration(hoursMap[module._id] || 0)
                          const level = deriveLevel(module, (courseData as any)?.courseLevel)
                          const leaves = collectLeafIds(module)
                          const visited = new Set((studentProgress as any)?.visitedNodes || [])
                          const pct = leaves.length ? Math.round(leaves.filter((id: string) => visited.has(id)).length / leaves.length * 100) : 0
                          const isOpen = expandedModules.has(module._id)
                          const children: any[] = module.subModules?.length ? module.subModules : (module.topics || [])
                          const childType: 'submodule' | 'topic' = module.subModules?.length ? 'submodule' : 'topic'
                          return (
                            <div key={module._id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                              <div
                                className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => handleItemSelect(module._id, module.title, 'module', [module._id], (module as any).pedagogy)}
                              >
                                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleModule(module._id) }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: '#FFF7ED', color: '#F97316' }}
                                >
                                  <ChevronRight className="w-4 h-4" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                                </button>
                                <Folder className="w-6 h-6 flex-shrink-0" style={{ color: c.icon, fill: c.icon }} />
                                <span className="font-bold text-[16.5px] text-gray-800 truncate">{idx + 1}. {module.title}</span>
                                {info.n > 0 && (
                                  <span className="text-[12.5px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#FFEDD5', color: '#F97316' }}>
                                    {info.n} {info.label}
                                  </span>
                                )}
                                <div className="flex-1" />
                                {dur && (
                                  <span className="flex items-center gap-1.5 text-[14.5px] text-gray-500 flex-shrink-0">
                                    <Clock className="w-4 h-4 text-gray-400" />{dur}
                                  </span>
                                )}
                                {level && (
                                  <span className="flex items-center gap-1.5 text-[14.5px] text-gray-500 flex-shrink-0 w-28">
                                    <User className="w-4 h-4 text-gray-400" />{level}
                                  </span>
                                )}
                                <span className="text-[14.5px] font-bold flex-shrink-0 w-32 text-right" style={{ color: pct > 0 ? '#059669' : '#9ca3af' }}>
                                  {pct}% Completed
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                              </div>
                              {isOpen && children.length > 0 && (
                                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2">
                                  {children.map((ch: any) => (
                                    <div
                                      key={ch._id}
                                      onClick={() => handleItemSelect(ch._id, ch.title, childType, [module._id, ch._id], (ch as any).pedagogy)}
                                      className="flex items-center gap-3 pl-11 pr-3 py-2.5 rounded-lg cursor-pointer hover:bg-white transition-colors"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.icon }} />
                                      <span className="text-[14.5px] text-gray-600 truncate">{ch.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      {!!structureSearch.trim() && !(courseData?.modules || []).some((m: any) => (m.title || '').toLowerCase().includes(structureSearch.trim().toLowerCase())) && (
                        <div className="text-center text-base text-gray-400 py-8">No modules match &ldquo;{structureSearch}&rdquo;.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── ITEM SELECTED — Overview tab (premium Submodule Details redesign) ── */}
              {selectedItem && activeTab === "Overview" && (() => {
                const typeLabel = selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)
                const TypeBadgeIcon = detailTypeIcon(selectedItem.type)
                const hrs = hoursMap[selectedItem.id] || 0
                const desc = findNodeDescription(selectedItem.id)
                const escapeHtml = (text: string) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                const descHeading = `${typeLabel} Description`
                const hierarchyHeading = `${typeLabel} Hierarchy`

                return (
                  <div className="sb-scroll flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-6 animate-[fadeIn_.3s_ease_both]">

                    {/* Top nav row: back + type/duration pills … Course Overview CTA */}
                    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <button
                          onClick={handleBackClick}
                          title="Back"
                          className="inline-flex items-center justify-center rounded-xl transition-colors cursor-pointer flex-shrink-0"
                          style={{ width: 36, height: 36, background: '#F3F5F9', border: '1px solid #E7EAF1' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EAEDF3' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F3F5F9' }}
                        >
                          <ChevronLeft size={16} strokeWidth={2.3} style={{ color: DETAIL_UI.navy }} />
                        </button>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full font-semibold flex-shrink-0"
                          style={{ height: 30, padding: '0 12px', background: DETAIL_UI.peach, color: DETAIL_UI.orange, fontSize: 12 }}
                        >
                          <TypeBadgeIcon size={13} strokeWidth={2.3} />
                          {typeLabel}
                        </span>
                        {hrs > 0 && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full font-semibold flex-shrink-0"
                            style={{ height: 30, padding: '0 12px', background: '#FFF7F0', color: DETAIL_UI.orange, fontSize: 12, border: '1px solid rgba(244,81,22,0.25)' }}
                          >
                            <Clock size={12} strokeWidth={2.3} />
                            {hrs} hours
                          </span>
                        )}
                      </div>

                      {/* Course Overview Button */}
                      <button
                        onClick={resetToCourseOverview}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl text-white font-semibold cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ height: 36, padding: '0 16px', fontSize: 12.5, background: `linear-gradient(135deg, ${DETAIL_UI.orangeDeep}, ${DETAIL_UI.orange})`, boxShadow: '0 6px 14px rgba(244,81,22,0.25)' }}
                      >
                        <BookOpen size={14} />
                        Course Overview
                      </button>
                    </div>

                    {/* Identity: hero icon + title/subtitle … Active status badge */}
                    <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, background: DETAIL_UI.peach }}>
                          <BookOpen size={22} strokeWidth={1.8} style={{ color: DETAIL_UI.orange }} />
                        </div>
                        <div className="min-w-0">
                          <h1 className="m-0 font-bold leading-tight truncate" style={{ color: DETAIL_UI.navy, fontSize: 21 }}>{selectedItem.title}</h1>
                          <p className="mt-1 mb-0" style={{ color: DETAIL_UI.slate, fontSize: 12.5 }}>Detailed overview with hierarchy and resources</p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full font-semibold flex-shrink-0"
                        style={{ height: 30, padding: '0 14px', background: DETAIL_UI.mint, color: DETAIL_UI.green, fontSize: 12 }}
                      >
                        <CheckCircle size={13} strokeWidth={2.3} />
                        Active {typeLabel}
                      </span>
                    </div>

                    {/* Description card */}
                    <div className="rounded-2xl bg-white mb-6" style={{ border: '1px solid #EEF1F6', boxShadow: '0 8px 24px rgba(30,45,80,0.05)', padding: '16px 18px' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="rounded-full flex-shrink-0" style={{ width: 4, height: 22, background: `linear-gradient(${DETAIL_UI.orangeDeep}, ${DETAIL_UI.orange})` }} />
                        <File size={16} strokeWidth={2} style={{ color: DETAIL_UI.slate }} />
                        <h3 className="m-0 font-bold" style={{ color: DETAIL_UI.navy, fontSize: 15.5 }}>{descHeading}</h3>
                      </div>
                      {desc ? (
                        <div
                          className="rounded-xl whitespace-pre-wrap"
                          style={{ padding: '12px 16px', background: '#F8FAFC', border: '1px solid #EEF1F6', color: DETAIL_UI.navy, fontSize: 13, lineHeight: 1.7 }}
                          dangerouslySetInnerHTML={{ __html: escapeHtml(desc) }}
                        />
                      ) : (
                        <div className="rounded-xl flex items-center gap-2" style={{ minHeight: 40, padding: '0 16px', background: DETAIL_UI.orangeLight, border: '1px solid #FFD9BF' }}>
                          <Info size={14} strokeWidth={2.2} style={{ color: DETAIL_UI.orange }} className="flex-shrink-0" />
                          <span className="italic" style={{ color: DETAIL_UI.slate, fontSize: 12.5 }}>No description available for this {selectedItem.type}.</span>
                        </div>
                      )}
                    </div>

                    {/* Hierarchy section heading */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Network size={17} strokeWidth={2.2} style={{ color: DETAIL_UI.orange }} />
                        <h3 className="m-0 font-bold" style={{ color: DETAIL_UI.navy, fontSize: 16.5 }}>{hierarchyHeading}</h3>
                      </div>
                      <p className="m-0" style={{ color: DETAIL_UI.slate, fontSize: 12.5, marginLeft: 25 }}>View the structure and content of this {selectedItem.type}</p>
                    </div>
                    {renderFilteredHierarchyTable()}

                    {/* Empty state for subtopic with no resources */}
                    {selectedItem.type === 'subtopic' &&
                      countPedResources(selectedItem.pedagogy, "I_Do") === 0 &&
                      countPedExercises(selectedItem.pedagogy, "We_Do") === 0 &&
                      countPedResources(selectedItem.pedagogy, "You_Do") === 0 && (
                        <div className="text-center rounded-2xl mt-4" style={{ padding: '20px 16px', background: '#FAFBFD', border: '1px solid #EEF1F6' }}>
                          <Hash size={20} className="mx-auto mb-2 block" style={{ color: '#CBD5E1' }} />
                          <p className="m-0 mb-1 font-semibold" style={{ fontSize: 13, color: DETAIL_UI.navy }}>No resources configured</p>
                          <p className="m-0" style={{ fontSize: 12, color: '#94A3B8' }}>Content will appear here once the instructor adds resources.</p>
                        </div>
                      )}
                  </div>
                )
              })()}

              {/* ── ITEM SELECTED — I Do / We Do / You Do tab content ── */}
              {selectedItem && activeTab !== "Overview" && (
                <div className="flex-1 overflow-clip min-h-0 flex flex-col p-3.5 gap-3">
                  {currentFolder && (() => {
                    // If the root folder of this path belongs to a group, inject a group crumb
                    const rootGroupId   = folderPath[0]?.groupId
                    const rootGroupName = folderPath[0]?.groupName

                    const crumbBtn = (label: string, onClick: () => void, key: string) => (
                      <button
                        key={key}
                        type="button"
                        onClick={onClick}
                        className="text-[13px] font-semibold leading-snug transition-colors cursor-pointer"
                        style={{ color: '#f97316', background: 'transparent', border: 'none', padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ea580c'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#f97316'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                        title={label}
                      >{label}</button>
                    )

                    const sep = (key: string) => (
                      <span key={key} className="text-[12.5px] flex-shrink-0 select-none" style={{ color: '#cbd5e1' }}>{'>'}</span>
                    )

                    return (
                      <div
                        className="flex-shrink-0 flex flex-wrap items-center gap-1.5 px-4 py-2"
                        style={{
                          borderBottom: '1px solid #eef0f4',
                          background: '#fafafb',
                          fontFamily: FONT_PRIMARY,
                        }}
                      >
                        {/* Root crumb = subcategory */}
                        {crumbBtn(
                          (selectedActivity || '').replace(/_/g, ' '),
                          () => handleFolderNavigateToLevel(-1),
                          'crumb-root'
                        )}

                        {/* Group crumb — only when root folder belongs to a group */}
                        {rootGroupId && rootGroupName && (
                          <>
                            {sep('sep-grp')}
                            {crumbBtn(
                              rootGroupName,
                              () => {
                                // Navigate back to root resource list and auto-expand this group
                                handleFolderNavigateToLevel(-1)
                                setExpandedGroups(prev => new Set([...prev, rootGroupId]))
                              },
                              'crumb-grp'
                            )}
                          </>
                        )}

                        {/* Folder path crumbs */}
                        {folderPath.map((f, i) => {
                          const isLast = i === folderPath.length - 1
                          return (
                            <React.Fragment key={`${f.id}-${i}`}>
                              {sep(`sep-${i}`)}
                              {!isLast
                                ? crumbBtn(f.title, () => handleFolderNavigateToLevel(i), `crumb-f-${i}`)
                                : <span className="text-[13px] font-semibold leading-snug" style={{ color: '#1a1a2e' }} title={f.title}>{f.title}</span>
                              }
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )
                  })()}

{selectedMethod && selectedActivity && !currentFolder && (
  <div className="flex flex-col flex-1 overflow-clip min-h-0">
    {(() => {
      const exs = getExercisesForActivity()
      // Check if it's Test Your Skills
      const testSkillExercise = exs.find(e => e.isTestYourSkills)
      
      if (testSkillExercise) {
        // Show a special card for Test Your Skills
        return (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <div 
              className="max-w-md w-full p-8 text-center rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white cursor-pointer hover:shadow-xl transition-all duration-300"
              onClick={() => handleOpenTestYourSkills(testSkillExercise.testData)}
            >
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Target size={36} className="text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Test Your Skills</h3>
              <p className="text-gray-500 mb-4">
                {testSkillExercise.testData?.questions?.length || 0} questions • {testSkillExercise.testData?.timeLimit || 60} minutes
              </p>
              <p className="text-base text-gray-400 mb-6">
                Passing score: {testSkillExercise.testData?.passingScore || 70}%
              </p>
              <button className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors">
                Start Test
              </button>
            </div>
          </div>
        )
      }

                        // ── Full-screen code editor overlay (unchanged) ─────────────────────────
                        if (exs.length > 0 && selectedExercise) {
                          return ReactDOM.createPortal(
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              {selectedExercise?.programmingSettings?.selectedModule === 'Core Programming' && (
                                (selectedExercise?.questionConfiguration?.programmingQuestionConfiguration?.compilerFileMode === 'multiple')
                                  ? <MultiFileCodeEditor exercise={selectedExercise} theme={resolvedTheme as "light" | "dark"} courseId={courseId} nodeId={selectedItem?.id || ""} nodeName={selectedItem?.title || ""} nodeType={selectedItem?.type || ""} subcategory={selectedActivity} category={selectedMethod === 'i-do' ? "I_Do" : selectedMethod === 'we-do' ? "We_Do" : "You_Do"} onBack={() => { setSelectedExercise(null); refreshCourseData() }} onCloseExercise={() => { setSelectedExercise(null); refreshCourseData() }} courseName={courseData?.courseName || ''} hierarchy={currentHierarchy} onNavigateToBreadcrumb={(level) => { setSelectedExercise(null); refreshCourseData(); if (level === 'course') { setSelectedItem(null); setSelectedMethod(''); setSelectedActivity(''); } else if (level === 'hierarchy') { setSelectedMethod(''); setSelectedActivity(''); } }} />
                                  : <CodeEditor exercise={selectedExercise} theme={resolvedTheme as "light" | "dark"} breadcrumbCollapsed={false} onBreadcrumbCollapseToggle={() => { }} courseId={courseId} nodeId={selectedItem?.id || ""} nodeName={selectedItem?.title || ""} nodeType={selectedItem?.type || ""} subcategory={selectedActivity} category={selectedMethod === 'i-do' ? "I_Do" : selectedMethod === 'we-do' ? "We_Do" : "You_Do"} onBack={() => { setSelectedExercise(null); refreshCourseData() }} onCloseExercise={() => { setSelectedExercise(null); refreshCourseData() }} courseName={courseData?.courseName || ''} hierarchy={currentHierarchy} resetProgress={exerciseResetProgress} onNavigateToBreadcrumb={(level) => { setSelectedExercise(null); refreshCourseData(); if (level === 'course') { setSelectedItem(null); setSelectedMethod(''); setSelectedActivity(''); } else if (level === 'hierarchy') { setSelectedMethod(''); setSelectedActivity(''); } }} />
                              )}
                              {selectedExercise?.programmingSettings?.selectedModule === 'Database' && (
                                <DBQueryEditor exercise={selectedExercise} theme={resolvedTheme as "light" | "dark"} courseId={courseId} nodeId={selectedItem?.id || ""} nodeName={selectedItem?.title || ""} nodeType={selectedItem?.type || ""} subcategory={selectedActivity} category={selectedMethod === 'i-do' ? "I_Do" : selectedMethod === 'we-do' ? "We_Do" : "You_Do"} onBack={() => { setSelectedExercise(null); refreshCourseData() }} onCloseExercise={() => { setSelectedExercise(null); refreshCourseData() }} />
                              )}
                            </div>,
                            document.body
                          )
                        }

                        // ── Exercise list ───────────────────────────────────────────────────────
                        if (exs.length > 0) {
                          const regularExercises = exs.filter((ex: any) => ex?.exerciseType !== 'SectionBased' && !ex?.isSectionBased)
                          const sharedProps = {
                            courseId,
                            onExerciseSelect: handleExerciseSelect,
                            method: selectedMethod,
                            category: selectedMethod === 'i-do' ? 'I_Do' : selectedMethod === 'you-do' ? 'You_Do' : 'We_Do',
                            subcategory: selectedActivity || '',
                            topic: selectedItem?.title || '',
                            module: currentHierarchy.length > 0 ? currentHierarchy[0] : selectedItem?.title || '',
                            nodeType: selectedItem?.type || '',
                            hierarchy: currentHierarchy,
                            selectedItem,
                            currentHierarchy,
                            studentAnswers: getStudentAnswers(),
                          }

                          // We Do → regular exercises only
                          if (selectedMethod === 'we-do') {
                            return (
                              <div className="exercises-portal-host flex-1 min-h-0 flex flex-col overflow-visible">
                                <Exercises
                                  exercises={regularExercises}
                                  {...sharedProps}
                                  isHeaderHidden={isHeaderCollapsed}
                                  onShowHeader={() => setIsHeaderCollapsed(false)}
                                />
                              </div>
                            )
                          }

                          // You Do → Assessments component (handles both regular + section-based internally).
                          // Student view: when the subcategory is "Assessment", the TabBar shows a
                          // Mock / Final third-level row; filter the list to the selected type here.
                          const isAssessmentSub =
                            selectedMethod === 'you-do' &&
                            ASSESSMENT_SUBCATEGORY_KEYS.has(normalizeKey(selectedActivity))
                          const shownExs = isAssessmentSub
                            ? exs.filter((e: any) => assessmentTestType === 'final' ? isFinalAssessment(e) : !isFinalAssessment(e))
                            : exs

                          return (
                            <div className="exercises-portal-host flex-1 min-h-0 flex flex-col overflow-visible">
                              <Assessments exercises={shownExs} {...sharedProps} onSectionSubmit={refreshCourseData} />
                            </div>
                          )
                        }

                        // ── Resource list fallback (unchanged) ──────────────────────────────────
                        const avail = getAvailableResourceTypes()
                        if (avail.length === 0) return <EmptyCard icon={File} title="No resources yet" sub="This activity has no content yet." color="gray" />
                        return (
                          <div className="flex flex-col flex-1 overflow-clip min-h-0 gap-2.5">
                            <div className="flex items-center gap-2 justify-between flex-wrap">
                              <div
                                className={`flex items-center gap-2 h-9 px-3 flex-1 min-w-[200px] rounded-lg border bg-white transition-all duration-200 ${isSearchFocused ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'
                                  }`}
                              >
                                <Search size={14} className="flex-shrink-0 text-gray-400" />
                                <input
                                  value={resourceSearch}
                                  onChange={(e) => setResourceSearch(e.target.value)}
                                  onFocus={() => setIsSearchFocused(true)}
                                  onBlur={() => setIsSearchFocused(false)}
                                  placeholder="Search files and folders..."
                                  className="w-full bg-transparent border-none outline-none text-[13.5px] text-gray-700 placeholder:text-gray-400"
                                />
                                {resourceSearch && (
                                  <button
                                    onClick={() => setResourceSearch("")}
                                    className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Clear search"
                                  >
                                    <X size={12} className="text-gray-500" />
                                  </button>
                                )}
                                {isLoadingResources && (
                                  <Loader2 size={14} className="flex-shrink-0 text-gray-400 animate-spin" />
                                )}
                              </div>

                              <div className="flex items-center gap-2 ml-auto">
                                {canToggleHeader && isHeaderCollapsed && (
                                  <button
                                    onClick={() => setIsHeaderCollapsed(false)}
                                    className="h-9 px-3 rounded-lg border border-[#e3e8f2] bg-white flex items-center gap-1.5 text-[12.5px] font-semibold cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors"
                                    title="Show header"
                                  >
                                    <ChevronDown size={14} />
                                    <span>Show</span>
                                  </button>
                                )}

                                <div className="h-9 rounded-lg border border-[#e3e8f2] bg-[#f8fafc] p-0.5 inline-flex items-center gap-0.5">
                                  <button
                                    onClick={() => setResourceView("grid")}
                                    className="w-8 h-8 rounded-md inline-flex items-center justify-center border-none cursor-pointer touch-friendly mobile-touch-target"
                                    style={{ background: resourceView === "grid" ? '#FFF7ED' : 'transparent', color: resourceView === "grid" ? '#F97316' : '#64748b' }}
                                    title="Grid view"
                                  >
                                    <LayoutGrid size={14} />
                                  </button>
                                  <button
                                    onClick={() => setResourceView("list")}
                                    className="w-8 h-8 rounded-md inline-flex items-center justify-center border-none cursor-pointer touch-friendly mobile-touch-target"
                                    style={{ background: resourceView === "list" ? '#FFF7ED' : 'transparent', color: resourceView === "list" ? '#F97316' : '#64748b' }}
                                    title="List view"
                                  >
                                    <List size={14} />
                                  </button>
                                </div>

                                <div style={{ position: 'relative' } } ref={sortDropdownRef}>
                                  <button
                                    onClick={() => {
                                      setShowSortDropdown(v => !v)
                                    }}
                                    className="h-9 px-3 rounded-lg border border-[#e3e8f2] bg-white flex items-center gap-1.5 text-[12.5px] font-medium cursor-pointer touch-friendly"
                                    style={{ color: showSortDropdown ? '#F97316' : '#475569' }}
                                  >
                                    <ArrowUpDown size={13} />
                                    <span>Sort by:</span>
                                    <span className="font-semibold text-[#334155]">
                                      {sortOption === "newest" && "Newest"}
                                      {sortOption === "oldest" && "Oldest"}
                                      {sortOption === "name_asc" && "Name A-Z"}
                                      {sortOption === "name_desc" && "Name Z-A"}
                                      {sortOption === "size_desc" && "Size Large-Small"}
                                      {sortOption === "size_asc" && "Size Small-Large"}
                                    </span>
                                    <ChevronDown size={12} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                                  </button>

                                  {showSortDropdown && (
                                    <div
                                      className="absolute top-full left-0 mt-1 w-[180px] rounded-lg border border-[#e3e8f2] bg-white shadow-lg overflow-hidden z-50"
                                      style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}
                                    >
                                      {[
                                        { value: "newest", label: "Newest", icon: Calendar },
                                        { value: "oldest", label: "Oldest", icon: Calendar },
                                        { value: "name_asc", label: "Name A-Z", icon: ArrowDown },
                                        { value: "name_desc", label: "Name Z-A", icon: ArrowUp },
                                        { value: "size_desc", label: "Size Large-Small", icon: FileDigit },
                                        { value: "size_asc", label: "Size Small-Large", icon: FileDigit },
                                      ].map((opt) => {
                                        const Icon = opt.icon
                                        const isSelected = sortOption === opt.value
                                        return (
                                          <button
                                            key={opt.value}
                                            onClick={() => {
                                              setSortOption(opt.value as any)
                                              setShowSortDropdown(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-gray-50 cursor-pointer"
                                            style={{
                                              color: isSelected ? '#F97316' : '#475569',
                                              background: isSelected ? '#FFF7ED' : 'transparent',
                                            }}
                                          >
                                            <Icon size={14} style={{ color: isSelected ? '#F97316' : '#94a3b8' }} />
                                            <span>{opt.label}</span>
                                            {isSelected && (
                                              <CheckCircle size={12} className="ml-auto" style={{ color: '#F97316' }} />
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => {
                                    setShowResourceFilters(v => !v)
                                    setShowSortDropdown(false)
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#e3e8f2] bg-white flex items-center gap-1.5 text-[12.5px] font-medium cursor-pointer touch-friendly"
                                  style={{ color: showResourceFilters ? '#F97316' : '#475569' }}
                                >
                                  <Filter size={13} />
                                  <span>Filters</span>
                                  {selectedFilterCount > 0 && (
                                    <span className="px-1.5 h-[16px] rounded-full text-[11.5px] font-bold inline-flex items-center justify-center bg-[#F97316] text-white">
                                      {selectedFilterCount}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>

                            {(() => {
                              const FILTER_PNG: Record<string, string> = {
                                page: '/icons/page.png', folder: '/icons/folder.png',
                                pdf: '/active-images/pdfFile.png', ppt: '/icons/ppt.png', link: '/icons/link.png',
                              }
                              const FilterIcon = ({ type, sel }: { type: string; sel: boolean }) => {
                                const src = FILTER_PNG[type]
                                if (src) {
                                  const isPdf = type === "pdf"
                                  return (
                                    <img
                                      src={src}
                                      alt={type}
                                      className={`${isPdf ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]'} object-contain block flex-shrink-0 transition-[filter]`}
                                      style={{ filter: sel ? 'brightness(0) saturate(100%) invert(33%) sepia(79%) saturate(1954%) hue-rotate(207deg) brightness(98%) contrast(94%)' : 'grayscale(1) brightness(0.55)' }}
                                    />
                                  )
                                }
                                return <ResIcon type={type} size={12} />
                              }
                              const chipBase = (delay: number) => ({
                                className: `flex items-center gap-1.5 px-3 py-[6px] rounded-md text-[12.5px] font-medium cursor-pointer transition-all flex-shrink-0 border filter-chip`,
                                style: {
                                  animation: showResourceFilters ? `chipSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both` : 'none',
                                }
                              })
                              if (!showResourceFilters) return null
                              const types = ["page", "folder", "pdf", "ppt", "video", "zip", "link", "image", "word", "reference"] as ResourceType[]
                              const visibleTypes = types.filter(type => {
                                if (type === "folder") return getFolders().length > 0
                                else if (type === "page") return getPagesForActivity().length > 0
                                else return getResourcesByType(type).length > 0
                              })
                              return (
                                <div
                                  className="sb-scroll flex-shrink-0 flex items-center gap-1 py-0 overflow-x-auto"
                                  style={{ animation: 'filterContainerSlide 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
                                >
                                  <button
                                    onClick={() => { setSelectedResourceType("all"); setUserSelectedResourceType(true) }}
                                    {...chipBase(0)}
                                    style={{
                                      background: '#ffffff',
                                      borderColor: selectedResourceType === "all" ? '#cbd5e1' : '#e2e8f0',
                                      color: selectedResourceType === "all" ? '#f97316' : '#334155',
                                      boxShadow: selectedResourceType === "all" ? 'inset 0 -2px 0 #f97316' : 'none',
                                    }}
                                  >
                                    <File size={12} />
                                    All
                                    <span
                                      className="px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold"
                                      style={{ background: '#f1f5f9', color: selectedResourceType === "all" ? '#f97316' : '#64748b' }}
                                    >
                                      {getAllResources().length + getFolders().length}
                                    </span>
                                  </button>
                                  {visibleTypes.map((type, idx) => {
                                    const isSel = selectedResourceType === type
                                    let count = 0
                                    if (type === "folder") count = getFolders().length
                                    else if (type === "page") count = getPagesForActivity().length
                                    else count = getResourcesByType(type).length
                                    return (
                                      <button
                                        key={type}
                                        onClick={() => { setSelectedResourceType(type); setUserSelectedResourceType(true) }}
                                        {...chipBase((idx + 1) * 50)}
                                        style={{
                                          background: '#ffffff',
                                          borderColor: isSel ? '#cbd5e1' : '#e2e8f0',
                                          color: isSel ? '#f97316' : '#334155',
                                          boxShadow: isSel ? 'inset 0 -2px 0 #f97316' : 'none',
                                        }}
                                      >
                                        <FilterIcon type={type} sel={isSel} />
                                        {type === "folder" ? "Folders" : RES_LABEL[type]}
                                        <span
                                          className="px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold"
                                          style={{ background: '#f1f5f9', color: isSel ? '#f97316' : '#64748b' }}
                                        >
                                          {count}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )
                            })()}

                            <div className="flex-1 overflow-hidden border-[1.5px] border-gray-200 flex flex-col">
                              {selectedResourceType === "page" ? (() => {
                                const pages = filteredPages
                                if (!pages.length) return null
                                const page = pages[inlinePageIndex]
                                const processedContent = preparePageContent(page)
                                return (
                                  <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100 bg-white flex-shrink-0">
                                      <button
                                        disabled={inlinePageIndex === 0}
                                        onClick={() => setInlinePageIndex(i => i - 1)}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:text-gray-300 disabled:bg-gray-50 cursor-pointer"
                                      >
                                        <ChevronLeft size={13} />Prev
                                      </button>
                                      <span className="text-[13.5px] font-semibold text-gray-500">{page.title}&nbsp;·&nbsp;{inlinePageIndex + 1} / {pages.length}</span>
                                      <button
                                        disabled={inlinePageIndex === pages.length - 1}
                                        onClick={() => setInlinePageIndex(i => i + 1)}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:text-gray-300 disabled:bg-gray-50 cursor-pointer"
                                      >
                                        Next<ChevronRightIcon size={13} />
                                      </button>
                                    </div>
                                    <iframe key={page.id} srcDoc={processedContent} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="flex-1 border-none w-full bg-white" title={page.title} />
                                  </div>
                                )
                              })() : (
                                isLoadingResources ? (
                                  <div className="sb-scroll flex-1 overflow-y-auto">
                                    <ResourceTableHeader />
                                    {[...Array(6)].map((_, i) => (
                                      <ResourceSkeleton key={`skeleton-${i}`} />
                                    ))}
                                  </div>
                                ) : filteredResourcesToDisplay.length > 0 ? (
                                  resourceView === "grid" ? (
                                    <div className="sb-scroll flex-1 overflow-y-auto p-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {sortResources(filteredResourcesToDisplay).map((r, idx) => (
                                          <div
                                            key={r.id}
                                            className="group relative rounded-xl border border-gray-200 bg-white p-4 cursor-pointer transition-all duration-300 hover:border-orange-300 hover:shadow-lg hover:-translate-y-1 touch-friendly mobile-card"
                                            style={{ animation: `gridCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 80}ms both` }}
                                            onClick={() => handleResourceClick(r)}
                                          >
                                            <div className="flex items-start gap-3 mb-3">
                                              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 touch-friendly"
                                                style={{
                                                  background: r.type === 'pdf' ? 'rgba(239,68,68,0.1)' :
                                                    r.type === 'video' ? 'rgba(37,99,235,0.1)' :
                                                      r.type === 'ppt' ? 'rgba(245,158,11,0.1)' :
                                                        r.type === 'folder' ? 'rgba(100,116,139,0.1)' :
                                                          'rgba(16,185,129,0.1)',
                                                }}
                                              >
                                                <ResIcon type={r.type} size={20} />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="m-0 text-[14.5px] font-bold text-gray-800 truncate leading-tight">{r.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                                                    style={{
                                                      background: r.type === 'pdf' ? '#fef2f2' : r.type === 'video' ? '#eff6ff' : r.type === 'ppt' ? '#fffbeb' : r.type === 'folder' ? '#f1f5f9' : '#f0fdf4',
                                                      color: r.type === 'pdf' ? '#dc2626' : r.type === 'video' ? '#2563eb' : r.type === 'ppt' ? '#d97706' : r.type === 'folder' ? '#64748b' : '#16a34a',
                                                    }}
                                                  >
                                                    {r.type === 'folder' ? 'Folder' : RES_LABEL[r.type] || r.type.toUpperCase()}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px] text-gray-500 mt-2">
                                              <span>{r.fileSize}</span>
                                              <span>{new Date(r.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-orange-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="sb-scroll flex-1 overflow-y-auto">
                                      <ResourceTableHeader />
                                      {(() => {
                                        const animType = selectedMethod === "i-do" ? "resource" : selectedMethod === "we-do" ? "wedo" : "none"
                                        const sorted = sortResources(filteredResourcesToDisplay)
                                        const grouped = groupResources(sorted)
                                        return grouped.map((row, i) => row.kind === "group"
                                          ? <ResourceGroupRow key={`g-${row.groupId}`} groupId={row.groupId} groupName={row.groupName} items={row.items} subGroups={row.subGroups} index={i} onClick={handleResourceClick} onDownload={handleDownloadClick} animType={animType} defaultExpanded={expandedGroups.has(row.groupId)} />
                                          : <ResourceItem key={row.resource.id} resource={row.resource} index={i} onClick={handleResourceClick} onDownload={handleDownloadClick} animType={animType} />
                                        )
                                      })()}
                                    </div>
                                  )
                                ) : (
                                  <div className="flex-1 flex items-center justify-center p-8">
                                    <div className="text-center" style={{ padding: '36px 44px', borderRadius: 24, background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)', border: '1.5px solid #e2e8f0', maxWidth: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                                      <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.25) 100%)', border: '1px solid rgba(249,115,22,0.25)', boxShadow: '0 2px 8px rgba(249,115,22,0.12)' }}>
                                        <Search size={24} style={{ color: '#f97316' }} />
                                      </div>
                                      <p className="font-bold text-[15.5px] text-gray-800 m-0 mb-1.5">No matching resources</p>
                                      <p className="text-[14px] text-gray-500 m-0 mb-3">Try adjusting your search or filters</p>
                                      <button
                                        onClick={() => { setResourceSearch(""); setSelectedResourceType("all"); }}
                                        className="px-4 py-2 rounded-xl text-[13.5px] font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all cursor-pointer"
                                        style={{ boxShadow: '0 2px 8px rgba(249,115,22,0.25)' }}
                                      >
                                        Clear filters
                                      </button>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {currentFolder && (
                    <div className="flex-1 overflow-hidden rounded-xl bg-white flex flex-col" style={{ border: '1px solid #eef0f4' }}>
                      {getFilteredFolderContents().length > 0 ? (
                        <div className="sb-scroll flex-1 overflow-y-auto">
                          {resourceView === "list" && <ResourceTableHeader />}
                          {resourceView === "grid" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                              {sortResources(getFilteredFolderContents()).map((r, idx) => (
                                <div
                                  key={r.id}
                                  className="group relative rounded-xl border border-gray-200 bg-white p-4 cursor-pointer transition-all duration-300 hover:border-orange-300 hover:shadow-lg hover:-translate-y-1 touch-friendly mobile-card"
                                  style={{
                                    animation: `gridCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 80}ms both`,
                                  }}
                                  onClick={() => handleResourceClick(r)}
                                >
                                  {/* Top section with icon and title */}
                                  <div className="flex items-start gap-3 mb-3">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 touch-friendly"
                                      style={{
                                        background: r.type === 'pdf' ? 'rgba(239,68,68,0.1)' :
                                          r.type === 'video' ? 'rgba(37,99,235,0.1)' :
                                            r.type === 'ppt' ? 'rgba(245,158,11,0.1)' :
                                              r.type === 'folder' ? 'rgba(100,116,139,0.1)' :
                                                'rgba(16,185,129,0.1)',
                                      }}
                                    >
                                      <ResIcon type={r.type} size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="m-0 text-[14.5px] font-bold text-gray-800 truncate leading-tight">{r.title}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                                          style={{
                                            background: r.type === 'pdf' ? '#fef2f2' :
                                              r.type === 'video' ? '#eff6ff' :
                                                r.type === 'ppt' ? '#fffbeb' :
                                                  r.type === 'folder' ? '#f1f5f9' :
                                                    '#f0fdf4',
                                            color: r.type === 'pdf' ? '#dc2626' :
                                              r.type === 'video' ? '#2563eb' :
                                                r.type === 'ppt' ? '#d97706' :
                                                  r.type === 'folder' ? '#64748b' :
                                                    '#16a34a',
                                          }}
                                        >
                                          {r.type === 'folder' ? 'Folder' : RES_LABEL[r.type] || r.type.toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* File info */}
                                  <div className="flex items-center justify-between text-[12px] text-gray-500 mt-2">
                                    <span>{r.fileSize}</span>
                                    <span>{new Date(r.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>

                                  {/* Hover action overlay */}
                                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-orange-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            (() => {
                              const animType = selectedMethod === "i-do" ? "resource" : selectedMethod === "we-do" ? "wedo" : "none"
                              const sorted = sortResources(getFilteredFolderContents())
                              // INSIDE A FOLDER: render direct children as flat list.
                              // Groups are a ROOT-LEVEL concept only — never render a group accordion
                              // inside a folder, otherwise the parent group leaks into the folder view
                              // (mirrors the teacher-side `isAtRootLevel` guard in Coursecontent.tsx).
                              return sorted.map((r, i) => (
                                <ResourceItem
                                  key={r.id}
                                  resource={r}
                                  index={i}
                                  onClick={handleResourceClick}
                                  onDownload={handleDownloadClick}
                                  animType={animType}
                                />
                              ))
                            })()
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-8 text-center">
                          <div style={{
                            padding: '36px 44px',
                            borderRadius: 24,
                            background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
                            border: '1.5px solid #e2e8f0',
                            maxWidth: 280,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                          }}>
                            <div style={{
                              width: 56, height: 56, borderRadius: 16,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              margin: '0 auto 16px',
                              background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(100,116,139,0.2) 100%)',
                              border: '1px solid rgba(100,116,139,0.2)',
                              boxShadow: '0 2px 8px rgba(100,116,139,0.1)',
                            }}>
                              <Folder size={24} style={{ color: '#64748b' }} />
                            </div>
                            <p className="font-bold text-[15.5px] text-gray-800 m-0 mb-1.5">Folder is empty</p>
                            <p className="text-[14px] text-gray-500 m-0 mb-3">No files in this folder yet</p>
                            <button
                              onClick={() => setCurrentFolder(null)}
                              className="px-4 py-2 rounded-xl text-[13.5px] font-semibold text-white bg-gray-500 hover:bg-gray-600 transition-all cursor-pointer"
                              style={{ boxShadow: '0 2px 8px rgba(100,116,139,0.25)' }}
                            >
                              Go back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMethod && !selectedActivity && !currentFolder && learningElements().length > 0 && <EmptyCard icon={Target} title="Select an Activity" sub="Pick one of the activity pills above to view resources" color="orange" />}
                  {!selectedMethod && !selectedActivity && !currentFolder && learningElements().length > 0 && <EmptyCard icon={Target} title="Choose a Learning Method" sub="Click I Do, We Do, or You Do to get started" color="blue" />}
                  {learningElements().length === 0 && selectedItem && !currentFolder && <EmptyCard icon={File} title="No Learning Methods" sub="This topic hasn't been configured yet." color="gray" />}
                </div>
              )}

              {/* Ask AI side panel */}
              {showAIChat && (
                <div className="w-[380px] flex-shrink-0 flex flex-col overflow-clip border-l border-gray-200 animate-[fadeIn_.22s_ease_both]">
                  <InlineAIChat
                    onClose={() => setShowAIChat(false)}
                    context={{ topicTitle: selectedItem?.title, fileName: activeViewer.resource?.title }}
                  />
                </div>
              )}

              {/* Summary side panel */}
              {showSummary && (
                <div className="w-[380px] flex-shrink-0 flex flex-col overflow-clip border-l border-gray-200 animate-[fadeIn_.22s_ease_both]">
                  <InlineSummaryChat
                    onClose={() => setShowSummary(false)}
                    context={{ topicTitle: selectedItem?.title, fileName: activeViewer.resource?.title, hierarchy: currentHierarchy }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Logout confirmation */}
      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {/* Panels and Viewers */}
      <NotesPanel
        isOpen={showNotesPanel}
        onClose={() => setShowNotesPanel(false)}
        isDraggable={true}
      />
      <AIPanel
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        fileUrl={activeViewer.resource?.fileUrl || ""}
        title={activeViewer.resource?.title || selectedItem?.title || ""}
        fileType={activeViewer.type === 'video' ? 'video' : activeViewer.type === 'ppt' ? 'ppt' : 'pdf'}
        courseContext={!activeViewer.resource && selectedItem ? { topicTitle: selectedItem.title, isDocumentView: false } : undefined}
      />
      {activeViewer.type === "zip" && activeViewer.resource && (
        <ZipViewer
          fileUrl={getFileUrl(activeViewer.resource.fileUrl || "")}
          fileName={activeViewer.resource.title}
          onClose={closeAllViewers}
          isOpen={true}
        />
      )}
      {activeViewer.type === "word" && activeViewer.resource && (
        <WordViewer
          isOpen={true}
          fileUrl={getFileUrl(activeViewer.resource.fileUrl || '')}
          fileName={activeViewer.resource.title}
          onClose={closeAllViewers}
          aiChatEnabled={courseData?.resourcesType?.iDo?.word?.aiChat ?? true}
          aiSummaryEnabled={courseData?.resourcesType?.iDo?.word?.aiSummary ?? true}
          notesEnabled={courseData?.resourcesType?.iDo?.notes?.enabled ?? true}
          hierarchy={[courseData?.courseName, ...currentHierarchy].filter(Boolean)}
          currentItemTitle={selectedItem?.title}
          onNotesClick={() => setShowNotesPanel(true)}
          onNotesStateChange={v => setShowNotesPanel(v)}
          showNotesPanel={showNotesPanel}
        />
      )}


      {activeViewer.type === "txt" && activeViewer.resource && (
        <TxtViewer
          isOpen={true}
          fileUrl={getFileUrlString(activeViewer.resource.fileUrl || '')}
          fileName={activeViewer.resource.title}
          onClose={closeAllViewers}
          notesEnabled={courseData?.resourcesType?.iDo?.notes?.enabled ?? true}

          hierarchy={[courseData?.courseName, ...currentHierarchy].filter(Boolean)}
          currentItemTitle={selectedItem?.title}
          onNotesClick={() => setShowNotesPanel(true)}
          onNotesStateChange={v => setShowNotesPanel(v)}
          showNotesPanel={showNotesPanel}
        />
      )}


      {activeViewer.type === "image" && activeViewer.resource && (
        <ImageViewer
          isOpen={true}
          imageUrl={getFileUrl(activeViewer.resource.fileUrl || '')}
          title={activeViewer.resource.title}
          fileId={activeViewer.resource.id}
          onClose={closeAllViewers}
          
          hierarchy={[courseData?.courseName, ...currentHierarchy].filter(Boolean)}
          allImages={imagePlaylist}
          currentImageIndex={currentImageIndex}
          onImageChange={idx => {
            setCurrentImageIndex(idx)
            const img = imagePlaylist[idx]
            if (img) setActiveViewer({ type: "image", resource: { ...activeViewer.resource!, id: img.id, title: img.title, fileUrl: img.fileUrl } })
          }}
        />
      )}
      {activeViewer.type === "video" && activeViewer.resource && (
        <VideoPlayer
          isOpen={true}
          onClose={closeAllViewers}
          videoUrl={getFileUrlString(activeViewer.resource.fileUrl)}
          title={activeViewer.resource.title}
          onNotesClick={() => setShowNotesPanel(true)}
          onNotesStateChange={v => setShowNotesPanel(v)}
          showNotesPanel={showNotesPanel}
          hierarchy={currentHierarchy}
          currentItemTitle={selectedItem?.title}
          fileId={activeViewer.resource.id}
          mcqQuestions={activeViewer.resource.mcqQuestions || []}
          availableResolutions={activeViewer.resource.availableResolutions || []}
          fileUrlMap={activeViewer.resource.fileUrlMap || {}}
          {...viewerFeaturesFor("video")}
          onResolutionChange={(resolution, url) => {
            if (activeViewer.resource) setActiveViewer({ ...activeViewer, resource: { ...activeViewer.resource, fileUrl: url, currentResolution: resolution } })
          }}
        />
      )}
      {activeViewer.type === "ppt" && activeViewer.resource && (() => {
        const loc = getFileMcqLocator()
        return (
          <PPTViewer
            isOpen={true}
            onClose={closeAllViewers}
            pptUrl={getFileUrlString(activeViewer.resource.fileUrl)}
            title={activeViewer.resource.title}
            onNotesClick={() => setShowNotesPanel(true)}
            onNotesStateChange={v => setShowNotesPanel(v)}
            showNotesPanel={showNotesPanel}
            {...viewerFeaturesFor("ppt")}
            hierarchy={currentHierarchy}
            currentItemTitle={selectedItem?.title}
            initialMcqs={activeViewer.resource.mcqQuestions || []}
            fileId={activeViewer.resource.id}
            entityType={selectedItem?.type || "subtopic"}
            entityId={selectedItem?.id || ""}
            tabType={loc.tabType}
            subcategory={loc.subcategory}
            folderPath={loc.folderPath}
            courseId={courseId}
            apiBaseUrl="https://lmsserver-yeve.onrender.com"
          />
        )
      })()}
      {activeViewer.type === "pdf" && activeViewer.resource && (() => {
        const loc = getFileMcqLocator()
        return (
          <PDFViewer
            fileUrl={getFileUrlString(activeViewer.resource.fileUrl)}
            fileName={activeViewer.resource.title || "document.pdf"}
            onClose={closeAllViewers}
            initialMcqs={activeViewer.resource.mcqQuestions || []}
            entityType={selectedItem?.type || "subtopic"}
            entityId={selectedItem?.id || ""}
            tabType={loc.tabType}
            subcategory={loc.subcategory}
            folderPath={loc.folderPath}
            fileId={activeViewer.resource.id}
            courseId={courseId}
            {...viewerFeaturesFor("pdf")}
            hierarchy={[courseData?.courseName, ...currentHierarchy].filter(Boolean)}
            currentItemTitle={selectedItem?.title}
            onNotesClick={() => setShowNotesPanel(true)}
            onNotesStateChange={v => setShowNotesPanel(v)}
            // Was hardcoded true, which force-opened the Notes panel on every
            // PDF open — including when the course had Notes switched off.
            showNotesPanel={showNotesPanel}
          />
        )
      })()}

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        toastStyle={{
          borderRadius: '12px',
          fontSize: '14.5px',
          fontWeight: 500,
        }}
      />


      {showTestComponent && testQuestions.length > 0 && ReactDOM.createPortal(
  <div className="fixed inset-0 z-[9999]">
    <StudentTestYourSkillsMCQQuestion
      nodeId={selectedItem?.id || ""}
      nodeName={selectedItem?.title || "Test Your Skills"}
      subcategory="test_your_skills"
      subcategoryLabel="Test Your Skills"
      nodeType={selectedItem?.type || "topic"}
      studentId={getCurrentUserId() || ""}
      onCloseExercise={handleCloseQuiz}
      studentName={(() => {
        try {
          const { user: tokenUser } = userPermission();
          if (tokenUser?.name) return tokenUser.name;
        } catch {}
        return localStorage.getItem('smartcliff_userName') || "Student";
      })()}
      testTitle="Test Your Skills"
      onComplete={(results) => {
        console.log("Test completed:", results);
        toast.success("Test submitted successfully!");
        handleCloseQuiz(); // Use the same close function
        refreshCourseData();
      }}
      onClose={handleCloseQuiz}
      onBack={handleCloseQuiz}
      hierarchyData={{
        courseName: courseData?.courseName || "",
        moduleName: currentHierarchy[0] || "",
        submoduleName: currentHierarchy[1] || "",
        topicName: currentHierarchy[2] || "",
        subtopicName: currentHierarchy[3] || "",
        nodeType: selectedItem?.type || "",
        level: currentHierarchy.length,
      }}
    />
  </div>,
  document.body
)}
    </div>
  )
}