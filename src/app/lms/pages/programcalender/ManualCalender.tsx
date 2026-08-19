"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Trash2, Calendar, Clock, MapPin, User, AlertCircle, ChevronDown, ChevronRight, BookOpen, FileText, List, Hash, Layers, FolderOpen, Target, Zap } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/components/permissions'

interface Course {
  _id: string
  courseName: string
  courseCode: string
  courseLevel: string
  courseDuration: string
  clientName: string
  serviceType: string
  courseDescription: string
}

interface DetailedCourse extends Course {
  courseHierarchy: string[]
  I_Do: string[]
  We_Do: string[]
  You_Do: string[]
  modules: Module[]
}

interface Module {
  _id: string
  title: string
  description: string
  duration: number
  level: string
  topics: Topic[]
  subModules?: SubModule[]
}

interface SubModule {
  _id: string
  title: string
  description: string
  duration: number
  level: string
  topics: Topic[]
}

interface Topic {
  _id: string
  title: string
  description: string
  duration: number
  level: string
  subTopics: SubTopic[]
}

interface SubTopic {
  _id: string
  title: string
  description: string
  duration: number
  level: string
}

interface CalendarSession {
  id: string
  date: string
  startTime: string
  endTime: string
  sessionTitle: string
  location: string
  instructor: string
  description: string
  hierarchyLevel: string
  hierarchyId: string
  duration: number
  parentPath: string
}

interface Holiday {
  id: string
  date: string
  name: string
  type: "national" | "local" | "custom"
}

interface HierarchyItem {
  id: string
  title: string
  description: string
  duration: number
  level: string
  parentPath: string
  fullPath: string
  type: "module" | "submodule" | "topic" | "subtopic"
}

interface HierarchyGroup {
  moduleId: string
  moduleName: string
  subModules?: {
    subModuleId: string
    subModuleName: string
    topics: {
      topicId: string
      topicName: string
      items: HierarchyItem[]
    }[]
  }[]
  topics?: {
    topicId: string
    topicName: string
    items: HierarchyItem[]
  }[]
  items?: HierarchyItem[]
}

interface ManualCalendarSetupProps {
  course: Course
  onBack: () => void
  onClose: () => void
}

const ManualCalendarSetup: React.FC<ManualCalendarSetupProps> = ({ course, onBack, onClose }) => {
  // Program-calendar permissions — Add covers create/save; Delete covers the
  // per-row remove buttons. Read-only users still see the schedule they scroll
  // through, minus the mutating controls.
  const { can } = usePermissions()
  const canAdd = can(PERMISSION_IDS.ADMIN_PROGRAM_CALENDAR, 'Add')
  const canDelete = can(PERMISSION_IDS.ADMIN_PROGRAM_CALENDAR, 'Delete')

  const [detailedCourse, setDetailedCourse] = useState<DetailedCourse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedHierarchy, setSelectedHierarchy] = useState<string>("")
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [scheduleSettings, setScheduleSettings] = useState({
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "17:00",
    lunchBreakStart: "12:00",
    lunchBreakEnd: "13:00",
    breakTime: "15:00",
    breakDuration: 15,
    defaultLocation: "",
    defaultInstructor: "",
    includeWeekends: false,
    dailyHours: 8,
  })

  // Fetch detailed course data
  useEffect(() => {
    const fetchDetailedCourse = async () => {
      try {
        setLoading(true)
        const response = await fetch(`https://lmsserver-yeve.onrender.com/getAll/courses-data/${course._id}`)
        const data = await response.json()
        if (data.success) {
          setDetailedCourse(data.data)
        }
      } catch (error) {
        console.error("Error fetching course details:", error)
      } finally {
        setTimeout(() => setLoading(false), 300)
      }
    }
    fetchDetailedCourse()
  }, [course._id])

  // Add default holidays
  useEffect(() => {
    const defaultHolidays: Holiday[] = [
      { id: "1", date: "2024-01-01", name: "New Year's Day", type: "national" },
      { id: "2", date: "2024-12-25", name: "Christmas Day", type: "national" },
    ]
    setHolidays(defaultHolidays)
  }, [])

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const handleHierarchySelect = (level: string) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setSelectedHierarchy(level)
      setExpandedItems(new Set())
      setIsTransitioning(false)
    }, 100)
  }

  const getHierarchyItems = (): HierarchyItem[] => {
    if (!detailedCourse || !selectedHierarchy) return []
    const items: HierarchyItem[] = []

    switch (selectedHierarchy) {
      case "Module":
        detailedCourse.modules.forEach((module) => {
          items.push({
            id: module._id,
            title: module.title,
            description: module.description,
            duration: module.duration,
            level: module.level,
            parentPath: "",
            fullPath: module.title,
            type: "module",
          })
        })
        break
      case "Sub Module":
        detailedCourse.modules.forEach((module) => {
          if (module.subModules && module.subModules.length > 0) {
            module.subModules.forEach((subModule) => {
              items.push({
                id: subModule._id,
                title: subModule.title,
                description: subModule.description,
                duration: subModule.duration,
                level: subModule.level,
                parentPath: module.title,
                fullPath: `${module.title} → ${subModule.title}`,
                type: "submodule",
              })
            })
          }
        })
        break
      case "Topic":
        detailedCourse.modules.forEach((module) => {
          if (module.topics && module.topics.length > 0) {
            module.topics.forEach((topic) => {
              items.push({
                id: topic._id,
                title: topic.title,
                description: topic.description,
                duration: topic.duration,
                level: topic.level,
                parentPath: module.title,
                fullPath: `${module.title} → ${topic.title}`,
                type: "topic",
              })
            })
          }
          if (module.subModules && module.subModules.length > 0) {
            module.subModules.forEach((subModule) => {
              if (subModule.topics && subModule.topics.length > 0) {
                subModule.topics.forEach((topic) => {
                  items.push({
                    id: topic._id,
                    title: topic.title,
                    description: topic.description,
                    duration: topic.duration,
                    level: topic.level,
                    parentPath: `${module.title} → ${subModule.title}`,
                    fullPath: `${module.title} → ${subModule.title} → ${topic.title}`,
                    type: "topic",
                  })
                })
              }
            })
          }
        })
        break
      case "Sub Topic":
        detailedCourse.modules.forEach((module) => {
          if (module.topics && module.topics.length > 0) {
            module.topics.forEach((topic) => {
              if (topic.subTopics && topic.subTopics.length > 0) {
                topic.subTopics.forEach((subTopic) => {
                  items.push({
                    id: subTopic._id,
                    title: subTopic.title,
                    description: subTopic.description,
                    duration: subTopic.duration,
                    level: subTopic.level,
                    parentPath: `${module.title} → ${topic.title}`,
                    fullPath: `${module.title} → ${topic.title} → ${subTopic.title}`,
                    type: "subtopic",
                  })
                })
              }
            })
          }
          if (module.subModules && module.subModules.length > 0) {
            module.subModules.forEach((subModule) => {
              if (subModule.topics && subModule.topics.length > 0) {
                subModule.topics.forEach((topic) => {
                  if (topic.subTopics && topic.subTopics.length > 0) {
                    topic.subTopics.forEach((subTopic) => {
                      items.push({
                        id: subTopic._id,
                        title: subTopic.title,
                        description: subTopic.description,
                        duration: subTopic.duration,
                        level: subTopic.level,
                        parentPath: `${module.title} → ${subModule.title} → ${topic.title}`,
                        fullPath: `${module.title} → ${subModule.title} → ${topic.title} → ${subTopic.title}`,
                        type: "subtopic",
                      })
                    })
                  }
                })
              }
            })
          }
        })
        break
      default:
        return []
    }
    return items
  }

  const getGroupedHierarchy = (): HierarchyGroup[] => {
    if (!detailedCourse || !selectedHierarchy) return []
    
    const groups: HierarchyGroup[] = []

    detailedCourse.modules.forEach((module) => {
      const group: HierarchyGroup = {
        moduleId: module._id,
        moduleName: module.title,
      }

      switch (selectedHierarchy) {
        case "Module":
          group.items = [{
            id: module._id,
            title: module.title,
            description: module.description,
            duration: module.duration,
            level: module.level,
            parentPath: "",
            fullPath: module.title,
            type: "module",
          }]
          break

        case "Sub Module":
          if (module.subModules && module.subModules.length > 0) {
            group.items = module.subModules.map(subModule => ({
              id: subModule._id,
              title: subModule.title,
              description: subModule.description,
              duration: subModule.duration,
              level: subModule.level,
              parentPath: module.title,
              fullPath: `${module.title} → ${subModule.title}`,
              type: "submodule" as const,
            }))
          }
          break

        case "Topic":
          group.topics = []
          
          if (module.topics && module.topics.length > 0) {
            group.topics.push({
              topicId: `${module._id}-direct`,
              topicName: "Direct Topics",
              items: module.topics.map(topic => ({
                id: topic._id,
                title: topic.title,
                description: topic.description,
                duration: topic.duration,
                level: topic.level,
                parentPath: module.title,
                fullPath: `${module.title} → ${topic.title}`,
                type: "topic" as const,
              }))
            })
          }

          if (module.subModules && module.subModules.length > 0) {
            module.subModules.forEach(subModule => {
              if (subModule.topics && subModule.topics.length > 0) {
                group.topics!.push({
                  topicId: subModule._id,
                  topicName: subModule.title,
                  items: subModule.topics.map(topic => ({
                    id: topic._id,
                    title: topic.title,
                    description: topic.description,
                    duration: topic.duration,
                    level: topic.level,
                    parentPath: `${module.title} → ${subModule.title}`,
                    fullPath: `${module.title} → ${subModule.title} → ${topic.title}`,
                    type: "topic" as const,
                  }))
                })
              }
            })
          }
          break

        case "Sub Topic":
          group.topics = []
          
          if (module.topics && module.topics.length > 0) {
            module.topics.forEach(topic => {
              if (topic.subTopics && topic.subTopics.length > 0) {
                group.topics!.push({
                  topicId: topic._id,
                  topicName: topic.title,
                  items: topic.subTopics.map(subTopic => ({
                    id: subTopic._id,
                    title: subTopic.title,
                    description: subTopic.description,
                    duration: subTopic.duration,
                    level: subTopic.level,
                    parentPath: `${module.title} → ${topic.title}`,
                    fullPath: `${module.title} → ${topic.title} → ${subTopic.title}`,
                    type: "subtopic" as const,
                  }))
                })
              }
            })
          }

          if (module.subModules && module.subModules.length > 0) {
            module.subModules.forEach(subModule => {
              if (subModule.topics && subModule.topics.length > 0) {
                subModule.topics.forEach(topic => {
                  if (topic.subTopics && topic.subTopics.length > 0) {
                    group.topics!.push({
                      topicId: topic._id,
                      topicName: `${subModule.title} → ${topic.title}`,
                      items: topic.subTopics.map(subTopic => ({
                        id: subTopic._id,
                        title: subTopic.title,
                        description: subTopic.description,
                        duration: subTopic.duration,
                        level: subTopic.level,
                        parentPath: `${module.title} → ${subModule.title} → ${topic.title}`,
                        fullPath: `${module.title} → ${subModule.title} → ${topic.title} → ${subTopic.title}`,
                        type: "subtopic" as const,
                      }))
                    })
                  }
                })
              }
            })
          }
          break
      }

      if (group.items?.length || group.topics?.some(t => t.items.length > 0)) {
        groups.push(group)
      }
    })

    return groups
  }

  const getHierarchyStats = () => {
    if (!detailedCourse) return { modules: 0, subModules: 0, topics: 0, subTopics: 0 }
    let subModules = 0
    let topics = 0
    let subTopics = 0

    detailedCourse.modules.forEach((module) => {
      if (module.subModules) {
        subModules += module.subModules.length
        module.subModules.forEach((subModule) => {
          if (subModule.topics) {
            topics += module.topics.length
            subModule.topics.forEach((topic) => {
              if (topic.subTopics) {
                subTopics += topic.subTopics.length
              }
            })
          }
        })
      }
      if (module.topics) {
        topics += module.topics.length
        module.topics.forEach((topic) => {
          if (topic.subTopics) {
            subTopics += topic.subTopics.length
          }
        })
      }
    })

    return {
      modules: detailedCourse.modules.length,
      subModules,
      topics,
      subTopics,
    }
  }

  const generateSchedule = () => {
    const hierarchyItems = getHierarchyItems()
    if (hierarchyItems.length === 0) return

    const newSessions: CalendarSession[] = []
    let sessionCounter = 1

    hierarchyItems.forEach((item) => {
      const session: CalendarSession = {
        id: `session-${sessionCounter++}`,
        date: "",
        startTime: scheduleSettings.startTime,
        endTime: scheduleSettings.endTime,
        sessionTitle: item.title,
        location: scheduleSettings.defaultLocation,
        instructor: scheduleSettings.defaultInstructor,
        description: item.description,
        hierarchyLevel: selectedHierarchy,
        hierarchyId: item.id,
        duration: item.duration,
        parentPath: item.parentPath,
      }
      newSessions.push(session)
    })

    setSessions(newSessions)
    setShowScheduleModal(true)
  }

  const addHoliday = () => {
    const newHoliday: Holiday = {
      id: Date.now().toString(),
      date: "",
      name: "",
      type: "custom",
    }
    setHolidays([...holidays, newHoliday])
  }

  const removeHoliday = (id: string) => {
    setHolidays(holidays.filter((holiday) => holiday.id !== id))
  }

  const updateHoliday = (id: string, field: keyof Holiday, value: string) => {
    setHolidays(holidays.map((holiday) => (holiday.id === id ? { ...holiday, [field]: value } : holiday)))
  }

  const updateSession = (id: string, field: keyof CalendarSession, value: string | number) => {
    setSessions(sessions.map((session) => (session.id === id ? { ...session, [field]: value } : session)))
  }

  const removeSession = (id: string) => {
    setSessions(sessions.filter((session) => session.id !== id))
  }

  const isHoliday = (date: string) => {
    return holidays.some((holiday) => holiday.date === date)
  }

  const getHolidayName = (date: string) => {
    const holiday = holidays.find((holiday) => holiday.date === date)
    return holiday?.name || ""
  }

  const handleSaveCalendar = () => {
    const calendarData = {
      course: detailedCourse,
      selectedHierarchy,
      scheduleSettings,
      sessions,
      holidays,
    }
    console.log("Saving manual calendar:", calendarData)
    alert("Manual calendar has been created successfully!")
    onClose()
  }

  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    const start = new Date(`2000-01-01T${startTime}:00`)
    const end = new Date(`2000-01-01T${endTime}:00`)
    let diff = (end.getTime() - start.getTime()) / (1000 * 60)
    if (diff < 0) {
      diff += 24 * 60
    }
    const lunchStart = new Date(`2000-01-01T${scheduleSettings.lunchBreakStart}:00`)
    const lunchEnd = new Date(`2000-01-01T${scheduleSettings.lunchBreakEnd}:00`)
    if (start < lunchStart && end > lunchEnd) {
      const lunchDuration = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60)
      diff -= lunchDuration
    }
    return Math.max(0, diff)
  }

  const getGroupedSessions = () => {
    const groups: { [key: string]: CalendarSession[] } = {}
    sessions.forEach((session) => {
      const groupKey = session.parentPath || "Root Level"
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(session)
    })
    return Object.entries(groups).map(([parentPath, sessions]) => ({
      hierarchy: parentPath,
      sessions,
    }))
  }

  const getHierarchyIcon = (level: string) => {
    switch (level) {
      case "Module":
        return <Layers className="w-3.5 h-3.5" />
      case "Sub Module":
        return <FolderOpen className="w-3.5 h-3.5" />
      case "Topic":
        return <Target className="w-3.5 h-3.5" />
      case "Sub Topic":
        return <Zap className="w-3.5 h-3.5" />
      default:
        return <BookOpen className="w-3.5 h-3.5" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "module":
        return <BookOpen className="w-3 h-3" />
      case "submodule":
        return <FileText className="w-3 h-3" />
      case "topic":
        return <List className="w-3 h-3" />
      case "subtopic":
        return <Hash className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "module":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "submodule":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "topic":
        return "bg-green-100 text-green-800 border-green-200"
      case "subtopic":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
            <div className="absolute inset-0 w-10 h-10 border-3 border-transparent border-r-blue-400 rounded-full animate-ping mx-auto"></div>
          </div>
          <p className="text-blue-600 text-sm font-medium animate-pulse">Loading course details...</p>
        </div>
      </div>
    )
  }

  if (!detailedCourse) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3 mx-auto">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-red-600 text-sm font-medium mb-3">Failed to load course details. Please try again.</p>
          <button 
            onClick={onBack} 
            className="bg-red-600 text-white px-4 py-1.5 text-sm rounded-lg hover:bg-red-700 transition-all duration-200 transform hover:scale-105"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const stats = getHierarchyStats()
  const groupedHierarchy = getGroupedHierarchy()

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <h1 className="text-lg font-bold text-gray-900">Manual Calendar Setup</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              <span>{stats.modules} Modules</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{detailedCourse.courseDuration} Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Main Content */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* Fixed Left Panel - Hierarchy Selection */}
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Hierarchy Levels</h3>
            <p className="text-xs text-gray-600">Select a level to view</p>
          </div>
          
          <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
            {detailedCourse.courseHierarchy.map((level, index) => {
              let count = 0
              switch (level) {
                case "Module":
                  count = stats.modules
                  break
                case "Sub Module":
                  count = stats.subModules
                  break
                case "Topic":
                  count = stats.topics
                  break
                case "Sub Topic":
                  count = stats.subTopics
                  break
              }
              
              const isSelected = selectedHierarchy === level
              
              return (
                <button
                  key={level}
                  onClick={() => handleHierarchySelect(level)}
                  className={`w-full p-2.5 rounded-lg text-left transition-all duration-300 transform hover:scale-[1.02] ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md scale-[1.02]"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700 hover:shadow-sm"
                  }`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: loading ? 'none' : 'slideInLeft 0.3s ease-out forwards'
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-1 rounded ${isSelected ? 'bg-white/20' : 'bg-white'}`}>
                      <div className={isSelected ? 'text-white' : 'text-blue-600'}>
                        {getHierarchyIcon(level)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {level}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                        {count} {level.toLowerCase()}{count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="flex items-center justify-between text-xs text-blue-100">
                      <span>Ready to schedule</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Fixed Right Panel - Data Display */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {!selectedHierarchy ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1.5">Select a Hierarchy Level</h3>
                <p className="text-sm text-gray-600">Choose a hierarchy level from the left panel to view and schedule course content.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Fixed Content Header */}
              <div className="bg-white border-b border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      {getHierarchyIcon(selectedHierarchy)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {selectedHierarchy} Content
                      </h3>
                      <p className="text-xs text-gray-600">
                        {getHierarchyItems().length} items available
                      </p>
                    </div>
                  </div>
                  {canAdd && (
                    <button
                      onClick={generateSchedule}
                      disabled={getHierarchyItems().length === 0}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1.5 text-sm rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-1.5 font-medium"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Create Schedule
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 p-3 overflow-y-auto">
                <div 
                  className={`transition-all duration-200 ${
                    isTransitioning ? 'opacity-0 transform translate-y-2' : 'opacity-100 transform translate-y-0'
                  }`}
                >
                  {groupedHierarchy.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                          <AlertCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No {selectedHierarchy.toLowerCase()} items found in this course.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupedHierarchy.map((group, groupIndex) => (
                        <div 
                          key={group.moduleId} 
                          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                          style={{
                            animationDelay: `${groupIndex * 50}ms`,
                            animation: 'slideInUp 0.3s ease-out forwards'
                          }}
                        >
                          {/* Module Header */}
                          <div 
                            className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 p-2.5 cursor-pointer hover:from-purple-100 hover:to-indigo-100 transition-all duration-200"
                            onClick={() => toggleExpanded(group.moduleId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="transition-transform duration-200">
                                  {expandedItems.has(group.moduleId) ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-purple-600" />
                                  )}
                                </div>
                                <div className="p-1 bg-purple-100 rounded">
                                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                                <div>
                                  <span className="text-sm font-semibold text-purple-900">{group.moduleName}</span>
                                  <div className="text-xs text-purple-600">Module Content</div>
                                </div>
                              </div>
                              <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                                Module
                              </span>
                            </div>
                          </div>

                          {/* Module Content */}
                          <div className={`transition-all duration-200 overflow-hidden ${
                            expandedItems.has(group.moduleId) ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                          }`}>
                            <div className="bg-white">
                              {/* Direct Items */}
                              {group.items && group.items.length > 0 && (
                                <div className="p-2.5 space-y-2">
                                  {group.items.map((item, itemIndex) => (
                                    <div 
                                      key={item.id} 
                                      className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-all duration-200 transform hover:scale-[1.01]"
                                      style={{
                                        animationDelay: `${itemIndex * 30}ms`,
                                        animation: expandedItems.has(group.moduleId) ? 'fadeInUp 0.2s ease-out forwards' : 'none'
                                      }}
                                    >
                                      <div className={`p-1 rounded border ${getTypeColor(item.type)}`}>
                                        {getTypeIcon(item.type)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-900 mb-0.5">{item.title}</div>
                                        {item.description && (
                                          <div className="text-xs text-gray-600 mb-1.5 line-clamp-2">{item.description}</div>
                                        )}
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          <span className="flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" />
                                            {item.duration} min
                                          </span>
                                          <span className="flex items-center gap-0.5">
                                            <User className="w-2.5 h-2.5" />
                                            {item.level}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Topics */}
                              {group.topics && group.topics.length > 0 && (
                                <div className="space-y-1">
                                  {group.topics.map((topicGroup, topicIndex) => (
                                    <div key={topicGroup.topicId} className="border-t border-gray-100">
                                      {/* Topic Header */}
                                      <div 
                                        className="bg-green-50 p-2 cursor-pointer hover:bg-green-100 transition-all duration-200"
                                        onClick={() => toggleExpanded(topicGroup.topicId)}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div className="transition-transform duration-200">
                                              {expandedItems.has(topicGroup.topicId) ? (
                                                <ChevronDown className="w-3 h-3 text-green-600" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-green-600" />
                                              )}
                                            </div>
                                            <div className="p-0.5 bg-green-100 rounded">
                                              <List className="w-3 h-3 text-green-600" />
                                            </div>
                                            <span className="text-xs font-semibold text-green-900">{topicGroup.topicName}</span>
                                          </div>
                                          <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-medium">
                                            {topicGroup.items.length} {selectedHierarchy.toLowerCase()}{topicGroup.items.length !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Topic Items */}
                                      <div className={`transition-all duration-200 overflow-hidden ${
                                        expandedItems.has(topicGroup.topicId) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                      }`}>
                                        <div className="p-2 space-y-1.5 bg-gray-50">
                                          {topicGroup.items.map((item, itemIndex) => (
                                            <div 
                                              key={item.id} 
                                              className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 hover:shadow-sm transition-all duration-200 transform hover:scale-[1.01]"
                                              style={{
                                                animationDelay: `${itemIndex * 20}ms`,
                                                animation: expandedItems.has(topicGroup.topicId) ? 'fadeInUp 0.2s ease-out forwards' : 'none'
                                              }}
                                            >
                                              <div className={`p-0.5 rounded border ${getTypeColor(item.type)}`}>
                                                {getTypeIcon(item.type)}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold text-gray-900 mb-0.5">{item.title}</div>
                                                {item.description && (
                                                  <div className="text-xs text-gray-600 mb-1 line-clamp-1">{item.description}</div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                  <span className="flex items-center gap-0.5">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {item.duration} min
                                                  </span>
                                                  <span className="flex items-center gap-0.5">
                                                    <User className="w-2.5 h-2.5" />
                                                    {item.level}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Schedule Setup - {selectedHierarchy}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Creating schedule for {sessions.length} {selectedHierarchy.toLowerCase()} items
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-lg font-bold">✕</div>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-4 gap-4 h-full p-4">
                {/* Holidays Panel */}
                <div className="col-span-1">
                  <div className="bg-gray-50 rounded-lg p-3 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">Holidays & Breaks</h4>
                      {canAdd && (
                        <button
                          onClick={addHoliday}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-all duration-200 transform hover:scale-105"
                        >
                          <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                          Add
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(85vh - 200px)" }}>
                      {holidays.map((holiday) => (
                        <div key={holiday.id} className="border border-gray-200 rounded p-2 bg-white">
                          <div className="flex items-center justify-between mb-1">
                            <input
                              type="text"
                              value={holiday.name}
                              onChange={(e) => updateHoliday(holiday.id, "name", e.target.value)}
                              placeholder="Holiday name"
                              className="flex-1 px-1.5 py-1 text-xs border border-gray-300 rounded mr-1"
                            />
                            {canDelete && (
                              <button
                                onClick={() => removeHoliday(holiday.id)}
                                className="text-red-600 hover:text-red-700 p-0.5 hover:bg-red-50 rounded transition-all duration-200"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={holiday.date}
                            onChange={(e) => updateHoliday(holiday.id, "date", e.target.value)}
                            className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sessions Panel */}
                <div className="col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {selectedHierarchy} Sessions ({sessions.length})
                    </h4>
                    <div className="text-xs text-gray-600">Duration auto-calculated</div>
                  </div>
                  <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "calc(85vh - 150px)" }}>
                    {getGroupedSessions().map((group, groupIndex) => (
                      <div key={groupIndex} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                        {/* Group Header */}
                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-2 border-b border-gray-200 rounded-t-lg">
                          <h5 className="text-sm font-semibold text-gray-900">{group.hierarchy}</h5>
                          <div className="text-xs text-gray-600">
                            {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        {/* Group Sessions */}
                        <div className="p-3 space-y-2.5">
                          {group.sessions.map((session, sessionIndex) => (
                            <div key={session.id} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50 hover:bg-gray-100 transition-all duration-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                    Session {sessionIndex + 1}
                                  </span>
                                  <h6 className="text-sm font-semibold text-gray-900">{session.sessionTitle}</h6>
                                </div>
                                {canDelete && (
                                  <button
                                    onClick={() => removeSession(session.id)}
                                    className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-all duration-200"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-6 gap-2.5">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    <Calendar className="w-3 h-3 inline mr-0.5" />
                                    Date
                                  </label>
                                  <input
                                    type="date"
                                    value={session.date}
                                    onChange={(e) => updateSession(session.id, "date", e.target.value)}
                                    className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200 ${
                                      isHoliday(session.date) ? "bg-yellow-100 border-yellow-400" : "border-gray-300"
                                    }`}
                                  />
                                  {isHoliday(session.date) && (
                                    <div className="flex items-center mt-0.5 text-xs text-yellow-700">
                                      <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                      Holiday: {getHolidayName(session.date)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={session.startTime}
                                    onChange={(e) => {
                                      updateSession(session.id, "startTime", e.target.value)
                                      if (session.endTime) {
                                        const duration = calculateDuration(e.target.value, session.endTime)
                                        updateSession(session.id, "duration", duration)
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={session.endTime}
                                    onChange={(e) => {
                                      updateSession(session.id, "endTime", e.target.value)
                                      if (session.startTime) {
                                        const duration = calculateDuration(session.startTime, e.target.value)
                                        updateSession(session.id, "duration", duration)
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                                  <input
                                    type="text"
                                    value={`${session.duration} min`}
                                    readOnly
                                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-gray-100 text-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    <MapPin className="w-3 h-3 inline mr-0.5" />
                                    Location
                                  </label>
                                  <input
                                    type="text"
                                    value={session.location}
                                    onChange={(e) => updateSession(session.id, "location", e.target.value)}
                                    placeholder="Room/Location"
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    <User className="w-3 h-3 inline mr-0.5" />
                                    Instructor
                                  </label>
                                  <input
                                    type="text"
                                    value={session.instructor}
                                    onChange={(e) => updateSession(session.id, "instructor", e.target.value)}
                                    placeholder="Instructor name"
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                  />
                                </div>
                              </div>
                              <div className="mt-2.5">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Session Description
                                </label>
                                <textarea
                                  value={session.description}
                                  onChange={(e) => updateSession(session.id, "description", e.target.value)}
                                  placeholder="Session objectives, materials needed, activities..."
                                  rows={2}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <div className="flex gap-3">
                {canAdd && (
                  <button
                    onClick={handleSaveCalendar}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 text-sm rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02] font-semibold shadow-lg"
                  >
                    Save Calendar ({sessions.length} Sessions)
                  </button>
                )}
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-15px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

export default ManualCalendarSetup
