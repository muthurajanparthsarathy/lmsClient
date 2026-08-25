"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import ReactDOM from "react-dom"
import {
  Clock, AlertCircle, X, Play, Zap, Trophy, Star,
  CheckSquare, Code2, Layers, HelpCircle, BookOpen,
  Calendar, Hourglass, Lock, CheckCircle, Code,
  Info, Target, Settings, FileText, BarChart2, Shield, Cpu,
  Search, SlidersHorizontal, Filter, ChevronDown, ChevronLeft, ChevronRight, Eye,
  MoreVertical, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react"
import { useRouter } from "next/navigation"
// The exercise description is trainer-authored TipTap HTML, so it is sanitised
// before it reaches dangerouslySetInnerHTML in the start popup.
import DOMPurify from "dompurify"
import DataTable, { type Column as DTColumn } from "@/app/lms/shared/listing/DataTable"
import TableFooter from "@/app/lms/shared/listing/TableFooter"
import SmartCliffRingLoader from "@/components/SmartCliffRingLoader"

// Shared Poppins-first font stack for this roster-style list.
const LIST_FONT = "'Poppins','Poppins','Segoe UI','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif"

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface ExerciseInformation {
  exerciseId: string
  exerciseName: string
  description: string
  exerciseLevel: "beginner" | "medium" | "hard" | "intermediate" | "advanced"
  totalDuration?: number
  totalPoints?: number
  totalQuestions?: number
  _id?: string
}

interface McqQuestionConfiguration {
  totalQuestions?: number
  marksPerQuestion?: number
  totalMarks?: number
  easyCount?: number
  mediumCount?: number
  hardCount?: number
  submissionAttempts?: number
  [key: string]: any
}

interface QuestionConfiguration {
  mcqQuestionConfiguration?: McqQuestionConfiguration
  programmingQuestionConfiguration?: {
    submissionAttempts?: number
    [key: string]: any
  }
  othersQuestionConfiguration?: {
    submissionAttempts?: number
    [key: string]: any
  }
  [key: string]: any
}

interface ConfigurationType {
  mcqMode: boolean
  programmingMode: boolean
  combinedMode: boolean
  _id?: string
}

interface LevelConfiguration {
  levelType: "levelBased" | "general"
  levelBased?: { easy: number; medium: number; hard: number }
  general?: number
}

interface ProgrammingSettings {
  selectedModule?: string
  selectedLanguages?: string[]
  _id?: string
  levelConfiguration?: LevelConfiguration
}

interface AvailabilityPeriod {
  startDate: string
  endDate: string
  gracePeriodAllowed: boolean
  gracePeriodDate: string | null
  cutOffEnabled?: boolean
  cutOffDate?: string | null
  extendedDays?: number
  _id?: string
}

interface QuestionBehavior {
  shuffleQuestions?: boolean
  allowNext?: boolean
  allowSkip?: boolean
  attemptLimitEnabled?: boolean
  maxAttempts?: number
  _id?: string
}

interface EvaluationSettings {
  practiceMode?: boolean
  manualEvaluation?: { enabled: boolean; submissionNeeded: boolean; _id?: string }
  aiEvaluation?: boolean
  automationEvaluation?: boolean
  _id?: string
}

interface McqQuestion {
  questionType: string
  mcqQuestionTitle?: string
  mcqQuestionDifficulty?: string
  mcqQuestionType?: string
  [key: string]: any
}

interface Exercise {
  _id: string
  exerciseType?: "MCQ" | "Programming" | "Combined" | string
  exerciseInformation: ExerciseInformation
  configurationType?: ConfigurationType
  questionConfiguration?: QuestionConfiguration
  programmingSettings?: ProgrammingSettings
  availabilityPeriod: AvailabilityPeriod
  questionBehavior?: QuestionBehavior
  evaluationSettings?: EvaluationSettings
  questions?: McqQuestion[]
  createdAt: string
  updatedAt: string
  version?: number
  createdBy?: string
  isGraded?: boolean
}

interface StudentAnswer {
  exerciseId: string
  status: string
  _id: string
}

interface ExerciseSelectOptions {
  resetProgress?: boolean
}

interface ExercisesProps {
  courseId?: number | string
  exercises: Exercise[]
  onExerciseSelect: (exercise: Exercise, options?: ExerciseSelectOptions) => void
  method?: string
  category?: string
  subcategory?: string
  topic?: string
  module?: string
  nodeType?: string
  hierarchy?: string[]
  selectedItem?: any
  currentHierarchy?: string[]
  studentAnswers?: { [section: string]: any }
  isHeaderHidden?: boolean
  onShowHeader?: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getTotalQuestions(exercise: Exercise): number {
  if (exercise.questions && exercise.questions.length > 0) return exercise.questions.length
  return getConfiguredQuestionCount(exercise)
}
function getConfiguredQuestionCount(exercise: Exercise): number {
  const qc = exercise.questionConfiguration as any
  const progCfg = qc?.programmingQuestionConfiguration
  const mcqCfg = qc?.mcqQuestionConfiguration
  const othersCfg = qc?.othersQuestionConfiguration

  const countFromLevelCfg = (cfg: any): number => {
    if (!cfg) return 0
    const configType = cfg.questionConfigType

    if (configType === 'levelBased') {
      const lbc = cfg.levelBasedCounts
      return (lbc?.easy || 0) + (lbc?.medium || 0) + (lbc?.hard || 0)
    }
    if (configType === 'general') {
      return cfg.generalQuestionCount || 0
    }
    // backend uses 'selectionLevel'; keep 'selection' for back-compat
    if (configType === 'selectionLevel' || configType === 'selection') {
      const slc = cfg.selectionLevelCounts
      return (slc?.easy || 0) + (slc?.medium || 0) + (slc?.hard || 0)
    }

    // fallback: try all three and take whichever is non-zero
    const lbc = cfg.levelBasedCounts
    const levelSum = (lbc?.easy || 0) + (lbc?.medium || 0) + (lbc?.hard || 0)
    if (levelSum > 0) return levelSum
    const slc = cfg.selectionLevelCounts
    const selSum = (slc?.easy || 0) + (slc?.medium || 0) + (slc?.hard || 0)
    if (selSum > 0) return selSum
    if (cfg.generalQuestionCount > 0) return cfg.generalQuestionCount
    return 0
  }

  const progCount = countFromLevelCfg(progCfg)
  const othersCount = countFromLevelCfg(othersCfg)
  // backend stores MCQ count as totalMcqQuestions; keep totalQuestions as fallback
  const mcqCount = mcqCfg?.totalMcqQuestions || mcqCfg?.totalQuestions || 0

  const sum = progCount + othersCount + mcqCount
  if (sum > 0) return sum

  if (exercise.exerciseInformation?.totalQuestions) return exercise.exerciseInformation.totalQuestions

  return 0
}

// Compute how many questions of a given level-based config are allocated.
function levelConfigCount(cfg: any): number {
  if (!cfg) return 0
  const t = cfg.questionConfigType
  if (t === 'general') return cfg.generalQuestionCount || 0
  if (t === 'levelBased') {
    const c = cfg.levelBasedCounts
    return (c?.easy || 0) + (c?.medium || 0) + (c?.hard || 0)
  }
  if (t === 'selectionLevel' || t === 'selection') {
    const c = cfg.selectionLevelCounts
    return (c?.easy || 0) + (c?.medium || 0) + (c?.hard || 0)
  }
  // fallback: any populated bucket
  const lbc = cfg.levelBasedCounts
  const lvl = (lbc?.easy || 0) + (lbc?.medium || 0) + (lbc?.hard || 0)
  if (lvl > 0) return lvl
  const slc = cfg.selectionLevelCounts
  const sel = (slc?.easy || 0) + (slc?.medium || 0) + (slc?.hard || 0)
  if (sel > 0) return sel
  return cfg.generalQuestionCount || 0
}

// An exercise is listed only when every configured bucket (mcq / programming /
// others) has questions[] actually filled per its allocation. For Combined,
// BOTH the mcq side and the programming side must be filled.
function isExerciseFullyConfigured(exercise: Exercise): boolean {
  const qc = exercise.questionConfiguration as any
  const mcqCfg = qc?.mcqQuestionConfiguration
  const progCfg = qc?.programmingQuestionConfiguration
  const othersCfg = qc?.othersQuestionConfiguration

  const mcqConfigured =
    mcqCfg?.totalMcqQuestions ||
    mcqCfg?.totalQuestions ||
    ((mcqCfg?.easyCount || 0) + (mcqCfg?.mediumCount || 0) + (mcqCfg?.hardCount || 0)) ||
    0
  const progConfigured = levelConfigCount(progCfg)
  const othersConfigured = levelConfigCount(othersCfg)

  // No allocation at all → nothing to show.
  if (!mcqConfigured && !progConfigured && !othersConfigured) return false

  // Bucket the actual questions by type (case-insensitive). Unknown/missing
  // questionType is treated as "programming" for back-compat with older data.
  const buckets = { mcq: 0, programming: 0, others: 0 }
  for (const q of exercise.questions || []) {
    const t = String((q as any)?.questionType || '').toLowerCase()
    if (t === 'mcq') buckets.mcq++
    else if (t === 'others' || t === 'other') buckets.others++
    else if (t === 'programming') buckets.programming++
    else buckets.programming++  // fallback
  }

  // Each configured bucket must be fully filled.
  if (mcqConfigured && buckets.mcq < mcqConfigured) return false
  if (progConfigured && buckets.programming < progConfigured) return false
  if (othersConfigured && buckets.others < othersConfigured) return false

  return true
}

function getTotalMarks(exercise: Exercise): number | null {
  if (exercise.isGraded === false) return null
  const mcqConfig = exercise.questionConfiguration?.mcqQuestionConfiguration
  if (mcqConfig?.totalMarks) return mcqConfig.totalMarks
  if (mcqConfig?.marksPerQuestion && exercise.questions?.length)
    return mcqConfig.marksPerQuestion * exercise.questions.length
  if (exercise.exerciseInformation.totalPoints) return exercise.exerciseInformation.totalPoints
  return null
}

function getMarksPerQuestion(exercise: Exercise): number | null {
  if (exercise.isGraded === false) return null
  return exercise.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion ?? null
}

function getSubmissionAttempts(exercise: Exercise): number {
  return (
    exercise.questionConfiguration?.programmingQuestionConfiguration?.submissionAttempts ??
    exercise.questionConfiguration?.mcqQuestionConfiguration?.submissionAttempts ??
    (exercise.questionConfiguration as any)?.othersQuestionConfiguration?.submissionAttempts ??
    1
  )
}

function getTestSubmissions(
  exercise: Exercise,
  studentAnswers?: ExercisesProps['studentAnswers'],
  method?: string,
  subcategory?: string
): number {
  if (!studentAnswers || !method) return 0
  try {
    const matchId = (a: any) =>
      a?.exerciseId === exercise._id || a?._id === exercise._id || a?.id === exercise._id
    const deepFind = (node: any): number => {
      if (!node || typeof node !== 'object') return 0
      if (Array.isArray(node)) {
        const found = node.find(matchId)
        if (found) return found.testSubmissions ?? 0
        for (const item of node) { const r = deepFind(item); if (r > 0) return r }
        return 0
      }
      for (const arr of ['assignments', 'assessments', 'exercises', 'submissions']) {
        if (Array.isArray(node[arr])) {
          const found = node[arr].find(matchId)
          if (found) return found.testSubmissions ?? 0
        }
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object') { const r = deepFind(v); if (r > 0) return r }
      }
      return 0
    }
    const ml = method.toLowerCase().replace(/[-_\s]/g, '')
    const candidates: string[] = []
    if (ml.includes('ido')) candidates.push('I_Do', 'i_do', 'IDo', 'i-do', 'ido')
    if (ml.includes('wedo')) candidates.push('We_Do', 'we_do', 'WeDo', 'we-do', 'wedo')
    if (ml.includes('youdo')) candidates.push('You_Do', 'you_do', 'YouDo', 'you-do', 'youdo')
    candidates.push(method, method.replace(/-/g, '_'), method.replace(/_/g, '-'))
    const tried = new Set<string>()
    for (const key of candidates) {
      if (tried.has(key)) continue
      tried.add(key)
      const sec = studentAnswers[key]
      if (!sec) continue
      const r = deepFind(sec)
      if (r > 0) return r
    }
    for (const key of Object.keys(studentAnswers)) {
      const r = deepFind(studentAnswers[key])
      if (r > 0) return r
    }
    return 0
  } catch (err) {
    console.error('getTestSubmissions error:', err)
    return 0
  }
}

function getExerciseTypeInfo(exercise: Exercise): { label: string; color: string; bg: string; icon: React.ReactNode } {
  const type = exercise.exerciseType?.toLowerCase() || ''
  const cfg = exercise.configurationType
  if (type === 'mcq' || cfg?.mcqMode)
    return { label: 'MCQ', color: '#f97316', bg: '#fff7ed', icon: <CheckSquare className="w-3 h-3" /> }
  if (type === 'programming' || cfg?.programmingMode)
    return { label: 'Coding', color: '#7c3aed', bg: '#f5f3ff', icon: <Code2 className="w-3 h-3" /> }
  if (type === 'combined' || cfg?.combinedMode)
    return { label: 'Mixed', color: '#0891b2', bg: '#ecfeff', icon: <Layers className="w-3 h-3" /> }
  if (type === 'other' || cfg?.otherMode)
    return { label: 'Other', color: '#0d9488', bg: '#f0fdfa', icon: <HelpCircle className="w-3 h-3" /> }
  return { label: 'Exercise', color: '#475569', bg: '#f8fafc', icon: <HelpCircle className="w-3 h-3" /> }
}

function getDifficultyStyle(level: string = 'intermediate') {
  switch (level.toLowerCase()) {
    case 'beginner': return { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981', emoji: '🌱', label: 'Beginner' }
    case 'medium': return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', emoji: '⚡', label: 'Medium' }
    case 'intermediate': return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', emoji: '⚡', label: 'Intermediate' }
    case 'hard': return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', emoji: '🔥', label: 'Hard' }
    case 'advanced': return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', emoji: '🔥', label: 'Advanced' }
    default: return { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', emoji: '📝', label: 'General' }
  }
}

function formatDate(dateString: string) {
  if (!dateString) return 'No Date'
  try {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return dateString }
}

function formatDateTime(dateString: string) {
  if (!dateString) return 'No Date'
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateString }
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60); const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getDifficultyBreakdown(exercise: Exercise): { easy: number; medium: number; hard: number } | null {
  const mcqCfg = exercise.questionConfiguration?.mcqQuestionConfiguration
  if (mcqCfg?.easyCount !== undefined || mcqCfg?.mediumCount !== undefined || mcqCfg?.hardCount !== undefined)
    return { easy: mcqCfg.easyCount || 0, medium: mcqCfg.mediumCount || 0, hard: mcqCfg.hardCount || 0 }

  // Try levelBasedCounts from programming config
  const progCfg = (exercise.questionConfiguration as any)?.programmingQuestionConfiguration
  const lbc = progCfg?.levelBasedCounts
  if (lbc && (lbc.easy > 0 || lbc.medium > 0 || lbc.hard > 0))
    return { easy: lbc.easy || 0, medium: lbc.medium || 0, hard: lbc.hard || 0 }

  if (exercise.questions && exercise.questions.length > 0) {
    const counts = { easy: 0, medium: 0, hard: 0 }
    exercise.questions.forEach(q => {
      const d = (q.mcqQuestionDifficulty || q.difficulty || '').toLowerCase()
      if (d === 'easy') counts.easy++
      else if (d === 'medium') counts.medium++
      else if (d === 'hard') counts.hard++
    })
    if (counts.easy + counts.medium + counts.hard > 0) return counts
  }
  return null
}

function getExerciseAvailability(exercise: Exercise): {
  status: 'upcoming' | 'available' | 'expired' | 'grace-period' | 'late-attempt'
  message: string
  canStart: boolean
  startTime?: Date
  endTime?: Date
  graceTime?: Date | null
  cutOffTime?: Date | null
} {
  const now = new Date()
  const startDate = exercise.availabilityPeriod?.startDate ? new Date(exercise.availabilityPeriod.startDate) : null
  const endDate = exercise.availabilityPeriod?.endDate ? new Date(exercise.availabilityPeriod.endDate) : null
  const graceDate = exercise.availabilityPeriod?.gracePeriodAllowed && exercise.availabilityPeriod?.gracePeriodDate
    ? new Date(exercise.availabilityPeriod.gracePeriodDate) : null
  const cutOffDate = exercise.availabilityPeriod?.cutOffEnabled && exercise.availabilityPeriod?.cutOffDate
    ? new Date(exercise.availabilityPeriod.cutOffDate) : null

  if (startDate && now < startDate)
    return { status: 'upcoming', message: `Starts ${formatDateTime(startDate.toISOString())}`, canStart: false, startTime: startDate, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate }
  if (graceDate && now <= graceDate && endDate && now > endDate)
    return { status: 'grace-period', message: `Grace period until ${formatDateTime(graceDate.toISOString())}`, canStart: true, startTime: startDate || undefined, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate }
  if (endDate && now <= endDate)
    return { status: 'available', message: `Ends ${formatDateTime(endDate.toISOString())}`, canStart: true, startTime: startDate || undefined, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate }
  // ── Late-attempt window: end < now ≤ cutOffDate ──
  if (cutOffDate && endDate && now > endDate && now <= cutOffDate)
    return { status: 'late-attempt', message: `Late submission allowed until ${formatDateTime(cutOffDate.toISOString())}`, canStart: true, startTime: startDate || undefined, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate }
  if (graceDate && endDate && now > endDate && now < graceDate)
    return { status: 'grace-period', message: `Grace period starts ${formatDateTime(endDate.toISOString())}`, canStart: false, startTime: startDate || undefined, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate }
  return {
    status: 'expired',
    message: cutOffDate && now > cutOffDate
      ? `Expired ${formatDateTime(cutOffDate.toISOString())}`
      : graceDate && now > graceDate
        ? `Expired ${formatDateTime(graceDate.toISOString())}`
        : endDate ? `Expired ${formatDateTime(endDate.toISOString())}` : 'Expired',
    canStart: false, startTime: startDate || undefined, endTime: endDate || undefined, graceTime: graceDate, cutOffTime: cutOffDate
  }
}

function hasExerciseBeenAttempted(
  exercise: Exercise,
  studentAnswers?: ExercisesProps['studentAnswers'],
  method?: string,
  subcategory?: string
): boolean {
  if (!studentAnswers || !method) return false
  try {
    const matchId = (a: any) =>
      a?.exerciseId === exercise._id || a?._id === exercise._id || a?.id === exercise._id
    const deepScan = (node: any): boolean => {
      if (!node || typeof node !== 'object') return false
      if (Array.isArray(node)) return node.some(matchId)
      if (Array.isArray(node.assignments) && node.assignments.some(matchId)) return true
      if (Array.isArray(node.assessments) && node.assessments.some(matchId)) return true
      if (Array.isArray(node.exercises) && node.exercises.some(matchId)) return true
      if (Array.isArray(node.submissions) && node.submissions.some(matchId)) return true
      for (const v of Object.values(node)) { if (Array.isArray(v) && v.some(matchId)) return true }
      return false
    }
    const ml = method.toLowerCase().replace(/[-_\s]/g, '')
    const candidates: string[] = []
    if (ml.includes('ido')) candidates.push('I_Do', 'i_do', 'IDo', 'i-do', 'ido')
    if (ml.includes('wedo')) candidates.push('We_Do', 'we_do', 'WeDo', 'we-do', 'wedo')
    if (ml.includes('youdo')) candidates.push('You_Do', 'you_do', 'YouDo', 'you-do', 'youdo')
    candidates.push(method, method.replace(/-/g, '_'), method.replace(/_/g, '-'))
    const tried = new Set<string>()
    for (const key of candidates) {
      if (tried.has(key)) continue
      tried.add(key)
      const sec = studentAnswers[key]
      if (!sec) continue
      if (deepScan(sec)) return true
    }
    for (const key of Object.keys(studentAnswers)) { if (deepScan(studentAnswers[key])) return true }
    return false
  } catch (err) {
    console.error('hasExerciseBeenAttempted error:', err)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Per-row three-dot menu — currently exposes the Grade action only. Grade is
// enabled once the student has at least one submission for this exercise;
// the option stays in the menu but is greyed out + tooltipped before that.
// ═══════════════════════════════════════════════════════════════════════════════
function RowActionsMenu({
  exercise, onGrade, isGradeEnabled,
}: {
  exercise: Exercise;
  onGrade: (exercise: Exercise, e: React.MouseEvent) => void;
  isGradeEnabled: boolean;
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const update = () => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    update()
    const close = (e: MouseEvent) => {
      const t = e.target as Element
      if (btnRef.current && !btnRef.current.contains(t) && !t.closest?.('.row-actions-menu')) {
        setOpen(false)
      }
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('mousedown', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        title="More actions"
        style={{
          padding: 4, borderRadius: 6, border: 'none', lineHeight: 0,
          color: '#94a3b8', background: open ? '#f1f5f9' : 'transparent', cursor: 'pointer',
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}
        onMouseLeave={e => { e.currentTarget.style.background = open ? '#f1f5f9' : 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
      >
        <MoreVertical size={15} />
      </button>
      {open && pos && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          className="row-actions-menu"
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 100000,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 4, minWidth: 172,
          }}
        >
          <button
            disabled={!isGradeEnabled}
            title={isGradeEnabled ? 'Open grading' : 'Available after at least one answer is submitted'}
            onClick={(e) => {
              if (!isGradeEnabled) return
              setOpen(false)
              onGrade(exercise, e)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: 'none', textAlign: 'left',
              color: isGradeEnabled ? '#7c3aed' : '#cbd5e1',
              background: 'transparent', cursor: isGradeEnabled ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => { if (isGradeEnabled) e.currentTarget.style.background = '#faf5ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trophy size={13} />
            Grade
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

function getTimeRemaining(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  if (diffMs <= 0) return '0m'
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

function getExerciseAttemptData(exerciseId: string): { inProgress: boolean } {
  if (typeof window === 'undefined') return { inProgress: false }
  return { inProgress: localStorage.getItem('ex_in_progress_' + exerciseId) === '1' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Start Exercise Popup — fully rebuilt
// ═══════════════════════════════════════════════════════════════════════════════

interface PopupProps {
  exercise: Exercise
  onConfirm: () => void
  onClose: () => void
  availability: ReturnType<typeof getExerciseAvailability>
  hasAttempted?: boolean
  limitReached?: boolean
  testSubmissions?: number
  submissionAttempts?: number
  isRetake?: boolean
  breadcrumb?: string[]
}

function StartExercisePopup({
  exercise, onConfirm, onClose, availability,
  hasAttempted, limitReached, testSubmissions, submissionAttempts, isRetake, breadcrumb,
}: PopupProps) {
  const ex = exercise as any
  const typeInfo = getExerciseTypeInfo(exercise)
  const totalQ = getTotalQuestions(exercise)
  const isPractice = exercise.evaluationSettings?.practiceMode
  const canProceed = availability.canStart && !limitReached
  const isGraded = exercise.isGraded !== false

  const totalMarks: number | null = isGraded
    ? (ex.exerciseInformation?.totalMarksProgramming ||
       ex.exerciseInformation?.totalMarks ||
       ex.exerciseInformation?.totalPoints || null)
    : null

  const passMark: number | null = isGraded
    ? (ex.gradeSettings?.programmingGradeToPass ??
       ex.gradeSettings?.combinedGradeToPass ??
       ex.gradeSettings?.mcqGradeToPass ?? null)
    : null

  const duration: number | null = ex.exerciseInformation?.totalDuration ?? null
  const languages: string[] = ex.programmingSettings?.selectedLanguages ?? []
  const selectedModule: string | null = ex.programmingSettings?.selectedModule ?? null

  const progCfg = ex.questionConfiguration?.programmingQuestionConfiguration
  const allowCodeExecution = progCfg?.allowCodeExecution ?? false
  const showSampleCases = progCfg?.showSampleCases ?? false
  const questionFlow = progCfg?.questionFlow ?? null

  const statusConfig = limitReached
    ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', text: `All ${submissionAttempts} attempt${(submissionAttempts ?? 1) > 1 ? 's' : ''} used — completed` }
    : availability.status === 'available'
    ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', text: availability.message }
    : availability.status === 'late-attempt'
    ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', text: `⚠ ${availability.message}` }
    : availability.status === 'grace-period'
    ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', text: availability.message }
    : availability.status === 'upcoming'
    ? { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', text: availability.message }
    : { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', text: availability.message }

  // ── Right-column content, resolved from what the exercise actually carries ──
  // The column is only rendered when at least one of these exists — an empty
  // "Details" pane next to a full left column reads as a broken layout.
  const description: string = ex.exerciseInformation?.description || ''
  const instructions: string = ex.assessmentContent?.instructions || ex.instructions || ''
  // Tags are DERIVED, never authored: the languages the exercise is configured
  // for, its module, its difficulty, and the pedagogy path it was filed under
  // (the last two breadcrumb crumbs — "we do" / "assignment").
  const tags: string[] = Array.from(new Set([
    ...languages,
    ...(selectedModule ? [selectedModule] : []),
    ...(ex.exerciseInformation?.exerciseLevel
      ? [String(ex.exerciseInformation.exerciseLevel).replace(/^./, (c: string) => c.toUpperCase())]
      : []),
    ...((breadcrumb ?? []).slice(-2).map(c => c.replace(/\b\w/g, m => m.toUpperCase()))),
  ].filter(Boolean)))
  const hasDetails = !!(selectedModule || description || instructions || tags.length)

  // Author-written HTML from the TipTap description field. Sanitised before it
  // reaches dangerouslySetInnerHTML — the field is trainer-authored, not
  // trusted markup.
  const safeHtml = (html: string) =>
    typeof window === 'undefined'
      ? ''
      : DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'code', 'pre', 'blockquote'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
        })

  // ── Building blocks ────────────────────────────────────────────────────────

  const IconBadge = ({ icon: Icon, tint, size = 30 }: { icon: any; tint: string; size?: number }) => (
    <span style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${tint}1a`, color: tint,
    }}>
      <Icon style={{ width: size * 0.47, height: size * 0.47 }} />
    </span>
  )

  const SectionHead = ({ icon, children }: { icon: any; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
      <IconBadge icon={icon} tint="#f97316" size={24} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{children}</span>
    </div>
  )

  // Icon · label · value row (left column)
  const R = ({ icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <IconBadge icon={icon} tint="#6366f1" size={26} />
      <span style={{ fontSize: 12, color: '#64748b', flex: 1, minWidth: 0 }}>{label}</span>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )

  // Stat / date tile — the paired cards under Questions Overview and Schedule
  const Tile = ({ icon, tint, label, value }: { icon: any; tint: string; label: string; value: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '10px 11px', border: '1px solid #e8ecf2', borderRadius: 10, background: '#fff',
    }}>
      <IconBadge icon={icon} tint={tint} size={30} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      </div>
    </div>
  )

  const DetailLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>{children}</div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="sep-shell"
        style={{
          width: '100%', maxWidth: hasDetails ? 720 : 440,
          borderRadius: 16, background: '#ffffff',
          boxShadow: '0 24px 60px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.05)',
          animation: 'popIn .22s cubic-bezier(.34,1.56,.64,1)',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div style={{ height: 3, flexShrink: 0, background: isGraded ? '#f97316' : '#0891b2' }} />

        {/* Header — type glyph + breadcrumb + title + close */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #eef1f5',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isGraded ? '#f97316' : '#0891b2', color: '#fff',
          }}>
            <Code2 className="w-4 h-4" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {breadcrumb && breadcrumb.filter(Boolean).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {breadcrumb.filter(Boolean).map((crumb, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>&gt;</span>}
                    <span style={{
                      fontSize: 11.5, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap',
                      maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{crumb}</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{
              fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {exercise.exerciseInformation.exerciseName}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: '50%', border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — two columns; collapses to one on a narrow viewport */}
        <div
          className={hasDetails ? 'sep-body sep-body--split' : 'sep-body'}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
        >
          {/* ── Left: the exercise's own facts ── */}
          <div style={{ padding: '14px 16px' }}>
            <SectionHead icon={FileText}>Assignment Information</SectionHead>
            <div style={{ marginBottom: 16 }}>
              <R icon={Info} label="Assignment ID" value={exercise.exerciseInformation.exerciseId || exercise._id} />
              <R icon={FileText} label="Assignment Name" value={exercise.exerciseInformation.exerciseName} />
              <R
                icon={Target}
                label="Graded"
                value={
                  <span style={{
                    padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                    background: isGraded ? '#ecfdf5' : '#eff6ff',
                    color: isGraded ? '#15803d' : '#1d4ed8',
                    border: `1px solid ${isGraded ? '#bbf7d0' : '#bfdbfe'}`,
                  }}>
                    {isGraded ? 'Graded' : 'Non-Graded'}
                  </span>
                }
              />
            </div>

            <SectionHead icon={HelpCircle}>Questions Overview</SectionHead>
            <div className="sep-pair" style={{ marginBottom: 16 }}>
              <Tile icon={FileText} tint="#6366f1" label="Total Questions" value={totalQ || '—'} />
              <Tile icon={Clock} tint="#10b981" label="Duration" value={duration ? formatDuration(duration) : '—'} />
            </div>

            <SectionHead icon={Calendar}>Schedule</SectionHead>
            <div className="sep-pair">
              <Tile
                icon={Calendar} tint="#6366f1" label="Start Date"
                value={exercise.availabilityPeriod?.startDate ? formatDateTime(exercise.availabilityPeriod.startDate) : '—'}
              />
              <Tile
                icon={Calendar} tint="#6366f1" label="End Date"
                value={exercise.availabilityPeriod?.endDate ? formatDateTime(exercise.availabilityPeriod.endDate) : '—'}
              />
            </div>
            {exercise.availabilityPeriod?.gracePeriodAllowed && exercise.availabilityPeriod?.gracePeriodDate && (
              <div style={{ marginTop: 12 }}>
                <Tile
                  icon={Hourglass} tint="#f97316" label="Grace Period"
                  value={formatDateTime(exercise.availabilityPeriod.gracePeriodDate)}
                />
              </div>
            )}
          </div>

          {/* ── Right: module, description, instructions, tags ── */}
          {hasDetails && (
            <div className="sep-right" style={{ padding: '14px 16px' }}>
              <SectionHead icon={BookOpen}>Details</SectionHead>

              {selectedModule && (
                <div style={{ marginBottom: 18 }}>
                  <DetailLabel>Module</DetailLabel>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedModule}</div>
                </div>
              )}

              {description && (
                <div style={{ marginBottom: 18, paddingTop: 16, borderTop: '1px solid #eef1f5' }}>
                  <DetailLabel>Description</DetailLabel>
                  <div
                    className="sep-rich"
                    style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65 }}
                    dangerouslySetInnerHTML={{ __html: safeHtml(description) }}
                  />
                </div>
              )}

              {instructions && (
                <div style={{ marginBottom: 18, paddingTop: 16, borderTop: '1px solid #eef1f5' }}>
                  <DetailLabel>Instructions</DetailLabel>
                  <div
                    className="sep-rich"
                    style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65 }}
                    dangerouslySetInnerHTML={{ __html: safeHtml(instructions) }}
                  />
                </div>
              )}

              {tags.length > 0 && (
                <div style={{ paddingTop: 16, borderTop: '1px solid #eef1f5' }}>
                  <DetailLabel>Tags</DetailLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {tags.map((t, i) => {
                      const palette = [
                        { bg: '#eef2ff', fg: '#4338ca' },
                        { bg: '#fff7ed', fg: '#c2410c' },
                        { bg: '#eff6ff', fg: '#1d4ed8' },
                        { bg: '#ecfdf5', fg: '#15803d' },
                      ][i % 4]
                      return (
                        <span key={`${t}-${i}`} style={{
                          padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                          background: palette.bg, color: palette.fg,
                        }}>
                          {t}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — availability banner, then the actions */}
        <div style={{
          padding: '10px 16px 13px', borderTop: '1px solid #eef1f5',
          background: '#fafbfc', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 12, fontWeight: 600,
            padding: '8px 12px', borderRadius: 8, marginBottom: 10,
            background: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}`,
          }}>
            <Calendar className="w-4 h-4" style={{ flexShrink: 0 }} />
            {statusConfig.text}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: '0 0 auto', minWidth: 118, padding: '10px 0', borderRadius: 9,
                fontSize: 12.5, fontWeight: 600,
                color: '#475569', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canProceed}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed',
                opacity: canProceed ? 1 : 0.5,
                background: !canProceed ? '#94a3b8'
                  : availability.status === 'late-attempt' ? '#f97316'
                  : availability.status === 'grace-period' ? '#f97316'
                  : isGraded ? '#f97316' : '#0891b2',
              }}
            >
              {limitReached
                ? <><CheckCircle className="w-4 h-4" />Already Completed</>
                : availability.status === 'late-attempt' && availability.canStart
                ? <><Play className="w-4 h-4" style={{ fill: 'white' }} />Start Late Attempt</>
                : availability.canStart
                ? <><Play className="w-4 h-4" style={{ fill: 'white' }} />{isRetake ? (isPractice ? 'Retake Practice' : isGraded ? 'Retake Graded Exercise' : 'Retake Exercise') : (isPractice ? 'Start Practice' : isGraded ? 'Begin Graded Exercise' : 'Start Exercise')}</>
                : availability.status === 'upcoming'
                ? <><Calendar className="w-4 h-4" />Not Yet Open</>
                : <><Lock className="w-4 h-4" />Expired</>
              }
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity:0; transform:scale(.92) translateY(8px) }
          to   { opacity:1; transform:scale(1) translateY(0) }
        }
        .sep-body--split { display: grid; grid-template-columns: 1.65fr 1fr; align-items: start; }
        .sep-right { border-left: 1px solid #eef1f5; }
        .sep-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sep-rich p { margin: 0 0 8px }
        .sep-rich p:last-child { margin-bottom: 0 }
        .sep-rich ul, .sep-rich ol { margin: 0; padding-left: 18px }
        .sep-rich li { margin-bottom: 5px }
        /* One column once the split stops earning its keep — the right pane
           moves below the left instead of squeezing both. */
        @media (max-width: 720px) {
          .sep-body--split { grid-template-columns: 1fr; }
          .sep-right { border-left: none; border-top: 1px solid #eef1f5; }
        }
        @media (max-width: 520px) {
          .sep-pair { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Resume / Start Fresh Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface ResumeModalProps {
  exercise: Exercise
  onResume: () => void
  onStartFresh: () => void
  onClose: () => void
}

function ResumeModal({ exercise, onResume, onStartFresh, onClose }: ResumeModalProps) {
  const typeInfo = getExerciseTypeInfo(exercise)
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 420,
          borderRadius: 20, overflow: 'hidden', background: 'white',
          boxShadow: '0 30px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'popIn .28s cubic-bezier(.34,1.56,.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#f97316)' }} />
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: typeInfo.bg, color: typeInfo.color, flexShrink: 0,
            }}>
              {typeInfo.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                {exercise.exerciseInformation.exerciseName}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Resume or start over?</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 16px', borderRadius: 12,
            background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 20,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💾</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Saved progress found</div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                You have in-progress code for this exercise. Resume from where you left off or clear it and start fresh.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onResume}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
              }}
            >
              <Play style={{ width: 14, height: 14, fill: 'white' }} />
              Resume Where I Left Off
            </button>
            <button
              onClick={onStartFresh}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Star style={{ width: 14, height: 14 }} />
              Start Fresh (Clear Saved Code)
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
        <style>{`@keyframes popIn{from{opacity:0;transform:scale(.88) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Exercises Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function Exercises({
  category, subcategory, courseId, exercises, onExerciseSelect,
  method, topic = '', module = '', nodeType = '',
  hierarchy = [], selectedItem = null, currentHierarchy = [],
  studentAnswers, isHeaderHidden = false, onShowHeader,
}: ExercisesProps) {
  const router = useRouter()
  const filterRef    = useRef<HTMLDivElement>(null)
  const cardRef      = useRef<HTMLDivElement>(null)
  const tableAreaRef = useRef<HTMLDivElement>(null)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [popupExercise, setPopupExercise] = useState<{ exercise: Exercise; isRetake?: boolean } | null>(null)
  const [resumeModalExercise, setResumeModalExercise] = useState<Exercise | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' } | null>(null)
  // Full-screen brand loader shown from the moment the student confirms
  // Start (or Resume) until the target compiler / exercise page mounts.
  // Without this the list stays visible for the brief moment between
  // router.push() and the destination route's own loading state — which
  // read as "nothing happened" on a slow route transition.
  const [isStartingExercise, setIsStartingExercise] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  // Column sorting (null = default newest-first by createdAt).
  const [sortColumn, setSortColumn] = useState<'name' | 'start' | 'end' | 'level' | 'status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const handleSort = (col: 'name' | 'start' | 'end' | 'level' | 'status') => {
    if (sortColumn === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortColumn(col); setSortDir('asc') }
    setCurrentPage(1)
  }

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false)
      }
    }
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterDropdown])

const showToast = (message: string, type: 'error' | 'warning' = 'error') => {
  setToast({ message, type })
  setTimeout(() => setToast(null), 3500)
}

const filteredExercises = useMemo(
  () => {
    let result = [...exercises].filter(ex => isExerciseFullyConfigured(ex))
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(ex =>
        ex.exerciseInformation.exerciseName.toLowerCase().includes(query) ||
        ex.exerciseInformation.exerciseId.toLowerCase().includes(query)
      )
    }
    
    // Apply level filter
    if (filterLevel !== "all") {
      result = result.filter(ex => ex.exerciseInformation.exerciseLevel === filterLevel)
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      result = result.filter(ex => {
        const availability = getExerciseAvailability(ex)
        const submissionAttempts = getSubmissionAttempts(ex)
        const testSubmissions = getTestSubmissions(ex, studentAnswers, method, subcategory)
        const isCompleted = testSubmissions >= 1
        const limitReached = testSubmissions >= submissionAttempts

        if (filterStatus.length > 0) {
          const checks: boolean[] = []
          if (filterStatus.includes("active"))       checks.push(availability.canStart)
          if (filterStatus.includes("inactive"))     checks.push(!availability.canStart)
          if (filterStatus.includes("submitted"))    checks.push(isCompleted)
          if (filterStatus.includes("not-submitted"))checks.push(!isCompleted)
          return checks.some(Boolean)
        }
        return true
      })
    }
    
    // Default ordering: newest first.
    if (!sortColumn) {
      return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    // Column sort. Level uses a difficulty rank; status sorts by Active first.
    const levelRank: Record<string, number> = { beginner: 0, easy: 0, medium: 1, intermediate: 1, advanced: 2, hard: 2 }
    const sortVal = (ex: Exercise): string | number => {
      switch (sortColumn) {
        case 'name': return (ex.exerciseInformation.exerciseName || '').toLowerCase()
        case 'start': return ex.availabilityPeriod?.startDate ? new Date(ex.availabilityPeriod.startDate).getTime() : 0
        case 'end': return ex.availabilityPeriod?.endDate ? new Date(ex.availabilityPeriod.endDate).getTime() : 0
        case 'level': return levelRank[(ex.exerciseInformation.exerciseLevel || '').toLowerCase()] ?? 1
        case 'status': return getExerciseAvailability(ex).canStart ? 1 : 0
        default: return 0
      }
    }
    return result.sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b)
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') cmp = va.localeCompare(vb)
      else cmp = (va as number) - (vb as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  },
  [exercises, searchQuery, filterLevel, filterStatus, studentAnswers, method, subcategory, sortColumn, sortDir]
)

// Dynamically compute rows per page from the actual table-body area height.
// tableAreaRef wraps DataTable + TableFooter, so budget must subtract the
// h-8 header (32) AND the h-11 footer (44) before dividing by the h-11
// row height. Half-row safety keeps the last row from clipping right at
// the pager edge (which used to silently roll to page 2).
useEffect(() => {
  const el = tableAreaRef.current
  if (!el) return
  const HEAD_H = 32
  const FOOT_H = 44
  const ROW_H = 44
  const SAFETY = Math.round(ROW_H / 2)
  const compute = () => {
    const budget = Math.max(0, el.clientHeight - HEAD_H - FOOT_H - SAFETY)
    setItemsPerPage(Math.max(3, Math.min(50, Math.floor(budget / ROW_H))))
  }
  compute()
  const ro = new ResizeObserver(compute)
  ro.observe(el)
  return () => ro.disconnect()
}, [])

// Reset to page 1 when filters change
useEffect(() => { setCurrentPage(1) }, [searchQuery, filterLevel, filterStatus.join(',')])

const ITEMS_PER_PAGE = itemsPerPage
const totalPages   = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE))
const safePage     = Math.min(currentPage, totalPages)
const startIdx     = (safePage - 1) * ITEMS_PER_PAGE
const pagedExercises = filteredExercises.slice(startIdx, startIdx + ITEMS_PER_PAGE)

const getPageNums = (): (number | '...')[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const p: (number | '...')[] = []
  if (safePage <= 4) p.push(1, 2, 3, 4, 5, '...', totalPages)
  else if (safePage >= totalPages - 3) p.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  else p.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages)
  return p
}

const handleStartClick = (exercise: Exercise, e: React.MouseEvent) => {
  e.stopPropagation()
  
  // ← ADD THIS BLOCK
  const totalQ = getTotalQuestions(exercise)
  if (totalQ === 0) {
    showToast('This exercise has not been configured yet. Please contact your instructor.')
    return
  }
  
  const submissionAttempts = getSubmissionAttempts(exercise)
  const testSubmissions = getTestSubmissions(exercise, studentAnswers, method, subcategory)
  const isCompleted = testSubmissions >= 1
  const limitReached = testSubmissions >= submissionAttempts
  const isRetake = isCompleted && !limitReached

  if (limitReached) {
    // All attempts used — no more starts.
    return
  }

  if (isRetake) {
    setPopupExercise({ exercise, isRetake: true })
  } else {
    const { inProgress } = getExerciseAttemptData(exercise._id)
    if (inProgress) {
      setResumeModalExercise(exercise)
    } else {
      setPopupExercise({ exercise, isRetake: false })
    }
  }
}

  const handleConfirmStart = () => {
    if (!popupExercise) return
    if (popupExercise.isRetake) {
      setIsStartingExercise(true)
      onExerciseSelect(popupExercise.exercise, { resetProgress: true })
    } else {
      const { inProgress } = getExerciseAttemptData(popupExercise.exercise._id)
      if (inProgress) {
        setResumeModalExercise(popupExercise.exercise)
        setPopupExercise(null)
        return
      }
      setIsStartingExercise(true)
      onExerciseSelect(popupExercise.exercise)
    }
    setPopupExercise(null)
  }

  const handleConfirmResume = (resetProgress: boolean) => {
    if (!resumeModalExercise) return
    setIsStartingExercise(true)
    onExerciseSelect(resumeModalExercise, { resetProgress })
    setResumeModalExercise(null)
  }

  const handleGradeClick = (exercise: Exercise, e: React.MouseEvent) => {
    e.stopPropagation()
    const hierarchyString = encodeURIComponent(JSON.stringify({
      hierarchy: hierarchy.length > 0 ? hierarchy : currentHierarchy,
      topic: topic || selectedItem?.title || '',
      module: module || currentHierarchy[0] || '',
      nodeType: nodeType || selectedItem?.type || ''
    }))
    const queryParams = new URLSearchParams({
      category: category || '', subcategory: subcategory || '',
      courseId: courseId?.toString() || '', exerciseId: exercise._id,
      exerciseName: exercise.exerciseInformation.exerciseName,
      exerciseLevel: exercise.exerciseInformation.exerciseLevel,
      totalPoints: getTotalMarks(exercise)?.toString() || '0',
      totalQuestions: getTotalQuestions(exercise).toString(),
      startDate: exercise.availabilityPeriod?.startDate || '',
      endDate: exercise.availabilityPeriod?.endDate || '',
      practiceMode: exercise.evaluationSettings?.practiceMode?.toString() || 'false',
      method: method || '', hierarchy: hierarchyString,
      topic: encodeURIComponent(topic || selectedItem?.title || ''),
      module: encodeURIComponent(module || currentHierarchy[0] || '')
    })
    router.push(`/lms/pages/courses/coursesdetailedview/exercisegrade?${queryParams.toString()}`)
  }

  // ── Filter/toolbar bookkeeping shared with the DataTable render ──
  const hasActiveFilters = !!searchQuery || filterLevel !== "all" || filterStatus.length > 0
  const activeFilterCount = (filterLevel !== "all" ? 1 : 0) + filterStatus.length
  const hasAnyExercises = !!exercises && exercises.filter(ex => isExerciseFullyConfigured(ex)).length > 0

  // ── Columns for the shared DataTable (matches Client Management styling) ──
  // Column widths tuned so full date+time strings (e.g. "21/08/2026 07:11 PM")
  // fit without wrapping and without eating into the Name column — the
  // earlier 14% dates were too narrow and pushed onto the neighbours,
  // which read as columns "overlapping". All cell text is text-[12px] so
  // the row has one consistent font size (matches ProblemSolving.tsx).
  const columns: DTColumn<Exercise>[] = [
    {
      key: 'num',
      label: '#',
      className: 'w-[4%] pl-4 pr-2 text-left text-[12px] text-faint tabular-nums align-middle whitespace-nowrap',
      skeletonWidth: '20px',
      render: (_ex, i) => startIdx + i + 1,
    },
    {
      key: 'id',
      label: 'ID',
      className: 'w-[9%] px-3 text-left align-middle text-[12px] text-subtle',
      skeletonWidth: '40px',
      render: (ex) => (
        <span className="font-mono truncate block" title={ex.exerciseInformation.exerciseId}>
          {ex.exerciseInformation.exerciseId}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Assignment Name',
      sortKey: 'name',
      className: 'w-[22%] px-3 text-left align-middle text-[12px] text-body',
      skeletonWidth: '80%',
      render: (ex) => {
        const name = ex.exerciseInformation.exerciseName || 'N/A'
        // Font-weight dropped from `font-medium text-heading` to plain
        // row-body weight so the row reads as one uniform line — same
        // rhythm the We_Do assignments list uses. Description subtitle
        // dropped: it was making the row taller than the other cells
        // and produced the mixed-font look the trainer complained about.
        return (
          <span className="block truncate" title={name}>{name}</span>
        )
      },
    },
    {
      key: 'start',
      label: 'Start Date',
      sortKey: 'start',
      className: 'w-[18%] px-3 text-left align-middle text-[12px] text-body',
      skeletonWidth: '75%',
      render: (ex) => (
        <span className="flex items-center gap-1 whitespace-nowrap"
          title={ex.availabilityPeriod?.startDate ? formatDateTime(ex.availabilityPeriod.startDate) : ''}>
          <Calendar size={11} className="text-faint flex-shrink-0" />
          {ex.availabilityPeriod?.startDate
            ? `${new Date(ex.availabilityPeriod.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(ex.availabilityPeriod.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'end',
      label: 'End Date',
      sortKey: 'end',
      className: 'w-[18%] px-3 text-left align-middle text-[12px] text-body',
      skeletonWidth: '75%',
      render: (ex) => (
        <span className="flex items-center gap-1 whitespace-nowrap"
          title={ex.availabilityPeriod?.endDate ? formatDateTime(ex.availabilityPeriod.endDate) : ''}>
          <Clock size={11} className="text-faint flex-shrink-0" />
          {ex.availabilityPeriod?.endDate
            ? `${new Date(ex.availabilityPeriod.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(ex.availabilityPeriod.endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      sortKey: 'level',
      className: 'w-[8%] px-3 text-left align-middle text-[12px] text-body',
      render: (ex) => {
        const d = getDifficultyStyle(ex.exerciseInformation.exerciseLevel)
        return (
          <span className="inline-flex items-center text-2xs font-semibold tracking-wide px-2 py-0.5 rounded-full border"
            style={{ background: d.bg, color: d.color, borderColor: d.border }}>
            {d.label}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      // Wider so "Not Submitted" fits without wrapping.
      className: 'w-[10%] px-3 text-left align-middle text-[12px] text-body',
      render: (ex) => {
        const canStart = getExerciseAvailability(ex).canStart
        const testSubmissions = getTestSubmissions(ex, studentAnswers, method, subcategory)
        const isCompleted = testSubmissions >= 1
        // Status communicates state via ICON + label — the shape is the
        // primary cue (accessible to colour-blind viewers) and colour is
        // secondary. Same rule as the You_Do assessments list:
        //   • Submitted     → CheckCircle (green)
        //   • Active        → Zap        (green)
        //   • Not Submitted → Lock       (grey)
        const state = isCompleted
          ? 'submitted'
          : canStart
            ? 'active'
            : 'not-submitted'
        const label = state === 'submitted'
          ? 'Submitted'
          : state === 'active'
            ? 'Active'
            : 'Not Submitted'
        const Icon = state === 'submitted' ? CheckCircle : state === 'active' ? Zap : Lock
        const isGreen = state !== 'not-submitted'
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={isGreen
              ? { background: '#ecfdf3', color: '#15803d' }
              : { background: '#f1f5f9', color: '#64748b' }}>
            <Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            {label}
          </span>
        )
      },
    },
    {
      key: 'action',
      label: 'Action',
      // Action column carries JUST the primary write action (Start / Re
      // Submit) and the three-dot menu. The "Submitted / Not Submitted"
      // text that used to sit here is dropped — that state already reads
      // off the Status column above, and repeating it here squashed the
      // three-dot menu and made the cell feel cramped.
      className: 'w-[11%] pl-2 pr-4 text-center align-middle text-[12px] text-body whitespace-nowrap',
      render: (ex) => {
        const availability = getExerciseAvailability(ex)
        const isGraded = ex.isGraded !== false
        const submissionAttempts = getSubmissionAttempts(ex)
        const testSubmissions = getTestSubmissions(ex, studentAnswers, method, subcategory)
        const isCompleted = testSubmissions >= 1
        const limitReached = testSubmissions >= submissionAttempts
        const canRetake = isCompleted && !limitReached && availability.canStart

        // A single primary control (or nothing) sits on the left; the
        // three-dot menu always sits on the right so it lands in the
        // same visual slot for every row. `justify-end` with a small
        // gap keeps the layout tidy — earlier `flex-col` per-row
        // stacking made "Not Submitted" rows shorter than others.
        return (
          <div className="flex items-center justify-end gap-1.5">
            {availability.canStart && !limitReached && (
              <button
                type="button"
                onClick={e => handleStartClick(ex, e)}
                className="inline-flex items-center h-7 px-2.5 text-2xs font-semibold rounded-control transition-colors duration-150"
                style={canRetake
                  ? { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', cursor: 'pointer' }
                  : isGraded
                    ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', cursor: 'pointer' }
                    : { background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', cursor: 'pointer' }}
              >
                {canRetake ? 'Re Submit' : 'Start'}
              </button>
            )}
            <RowActionsMenu
              exercise={ex}
              onGrade={handleGradeClick}
              isGradeEnabled={hasExerciseBeenAttempted(ex, studentAnswers, method, subcategory)}
            />
          </div>
        )
      },
    },
  ]

  // ── Table ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Full-screen brand loader between clicking Start and the target
          compiler / exercise page mounting. Portalled to <body> so it sits
          above every list / modal in the page. Cleared automatically when
          this component unmounts on the route change. */}
      {isStartingExercise && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-white">
          <SmartCliffRingLoader title="Loading" subtitle="Preparing your exercise…" />
        </div>,
        document.body,
      )}

      {/* Thin, subtle scrollbar for the table body (only shows when needed) */}
      <style>{`
        .roster-scroll { scrollbar-width: thin; scrollbar-color: #94a3b8 transparent; }
        .roster-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .roster-scroll::-webkit-scrollbar-track { background: transparent; }
        .roster-scroll::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
        .roster-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; background-clip: content-box; }
      `}</style>
      {/* Toast notification */}
   {toast && (
  <div style={{
    position: 'fixed', top: 24, right: 24,          // ← top-right
    // remove: bottom: 24, left: '50%', transform: 'translateX(-50%)'
    zIndex: 999999, padding: '12px 20px', borderRadius: 12,
    background: toast.type === 'error' ? '#fef2f2' : '#fffbeb',
    border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#fde68a'}`,
    color: toast.type === 'error' ? '#b91c1c' : '#92400e',
    fontSize: 13, fontWeight: 600,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', gap: 8,
    animation: 'slideDown 0.3s cubic-bezier(.34,1.56,.64,1)',  // ← slideDown
    whiteSpace: 'nowrap',
  }}>
    <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
    {toast.message}
  </div>
)}

      {/* Start popup portal */}
      {popupExercise && typeof document !== 'undefined' && ReactDOM.createPortal(
        <StartExercisePopup
          exercise={popupExercise.exercise}
          onConfirm={handleConfirmStart}
          onClose={() => setPopupExercise(null)}
          availability={getExerciseAvailability(popupExercise.exercise)}
          hasAttempted={hasExerciseBeenAttempted(popupExercise.exercise, studentAnswers, method, subcategory)}
          limitReached={
            getTestSubmissions(popupExercise.exercise, studentAnswers, method, subcategory) >=
            getSubmissionAttempts(popupExercise.exercise)
          }
          testSubmissions={getTestSubmissions(popupExercise.exercise, studentAnswers, method, subcategory)}
          submissionAttempts={getSubmissionAttempts(popupExercise.exercise)}
          isRetake={popupExercise.isRetake}
          breadcrumb={[
            ...(hierarchy.length > 0 ? hierarchy : currentHierarchy),
            method ? method.replace(/_/g, ' ') : undefined,
            subcategory || undefined,
          ].filter(Boolean) as string[]}
        />,
        document.body
      )}

      {/* Resume modal portal */}
      {resumeModalExercise && typeof document !== 'undefined' && ReactDOM.createPortal(
        <ResumeModal
          exercise={resumeModalExercise}
          onResume={() => handleConfirmResume(false)}
          onStartFresh={() => handleConfirmResume(true)}
          onClose={() => setResumeModalExercise(null)}
        />,
        document.body
      )}

      {/* ── Assignments listing: flat panel. Tight horizontal gutter
             (`px-2 sm:px-3`) plus tight vertical padding on the toolbar
             so nothing wastes space around the search / list. ── */}
      <div
        ref={cardRef}
        className="flex flex-col h-full min-h-0 bg-surface overflow-hidden px-2 sm:px-3"
        style={{ fontFamily: LIST_FONT }}
      >

        {/* ── Toolbar — small vertical padding so the search row hugs
             the list header below it instead of floating with a big gap. ── */}
        <div className="flex-none flex items-center gap-2 pt-1.5 pb-1.5 flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments…"
              className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilterDropdown((v) => !v)}
              aria-expanded={showFilterDropdown}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border text-xs font-medium transition-colors duration-150 ${
                activeFilterCount > 0 || showFilterDropdown
                  ? 'border-brand text-brand-strong bg-brand-wash'
                  : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full right-0 mt-1.5 w-64 rounded-xl bg-surface z-40 p-3 space-y-3 border border-hairline-strong shadow-lg">
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wider mb-2 text-subtle">Level</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'beginner', 'intermediate', 'advanced', 'hard', 'medium'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFilterLevel(level)}
                        className={`px-2 py-0.5 rounded-md text-2xs font-medium border transition-colors duration-150 ${
                          filterLevel === level
                            ? 'bg-brand-strong text-white border-brand-strong'
                            : 'bg-surface text-body border-hairline-strong hover:border-line-hover hover:text-heading'
                        }`}
                      >
                        {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wider mb-2 text-subtle">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { val: 'active', label: 'Active' },
                      { val: 'inactive', label: 'Inactive' },
                      { val: 'submitted', label: 'Submitted' },
                      { val: 'not-submitted', label: 'Not Submitted' },
                    ].map(({ val, label }) => {
                      const selected = filterStatus.includes(val)
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setFilterStatus((prev) => (selected ? prev.filter((s) => s !== val) : [...prev, val]))
                          }
                          className={`px-2 py-0.5 rounded-md text-2xs font-medium border transition-colors duration-150 ${
                            selected
                              ? 'bg-brand-strong text-white border-brand-strong'
                              : 'bg-surface text-body border-hairline-strong hover:border-line-hover hover:text-heading'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {(filterLevel !== 'all' || filterStatus.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterLevel('all')
                      setFilterStatus([])
                    }}
                    className="w-full py-1.5 rounded-control text-2xs font-medium border border-hairline-strong text-subtle bg-canvas hover:text-heading transition-colors duration-150"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {isHeaderHidden && onShowHeader && (
            <button
              type="button"
              onClick={onShowHeader}
              title="Show header"
              className="inline-flex items-center justify-center size-8 rounded-control border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors duration-150"
            >
              <Eye size={13} />
            </button>
          )}
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (
          <div className="flex-none flex flex-wrap items-center gap-2 px-4 py-2 border-b border-hairline bg-brand-wash/50">
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
                “{searchQuery}”
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {filterLevel !== 'all' && (
              <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong capitalize">
                {filterLevel}
                <button
                  type="button"
                  aria-label="Clear level filter"
                  onClick={() => setFilterLevel('all')}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {filterStatus.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong"
              >
                {s === 'not-submitted' ? 'Not Submitted' : s.charAt(0).toUpperCase() + s.slice(1)}
                <button
                  type="button"
                  aria-label={`Remove ${s} filter`}
                  onClick={() => setFilterStatus((prev) => prev.filter((x) => x !== s))}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setFilterLevel('all')
                setFilterStatus([])
              }}
              className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Table + pagination ── */}
        <div ref={tableAreaRef} className="flex flex-1 min-h-0 flex-col">
          <DataTable
            rows={pagedExercises}
            columns={columns}
            rowKey={(ex) => ex._id}
            sortKey={sortColumn}
            sortDir={sortDir}
            onSort={(key) => handleSort(key as 'name' | 'start' | 'end' | 'level' | 'status')}
            isLoading={false}
            isFiltered={hasActiveFilters}
            fixedLayout
            fillHeight
            emptyTitle={hasAnyExercises ? 'No exercises found' : 'No exercises yet'}
            emptyHint={
              hasAnyExercises
                ? 'Try adjusting your search or clearing the filters.'
                : "Exercises for this section haven't been added yet."
            }
            emptyAction={hasActiveFilters ? 'Clear filters' : undefined}
            onEmptyAction={
              hasActiveFilters
                ? () => {
                    setSearchQuery('')
                    setFilterLevel('all')
                    setFilterStatus([])
                  }
                : undefined
            }
          />

          {filteredExercises.length > 0 && (
            // No border-t on the pager — the DataTable's last row already
            // omits its own border via `last:border-0`, so wrapping the
            // pager in a top border stacked TWO adjacent lines that read
            // like a double divider.
            <div className="bg-surface">
              {/* Pagination shows whenever there are rows — dropped the
                  `totalPages > 1` gate so the "Showing X of Y" count and
                  the pager itself are always in the same spot, even with
                  a single page of results. */}
              <TableFooter
                from={startIdx + 1}
                to={Math.min(startIdx + ITEMS_PER_PAGE, filteredExercises.length)}
                total={filteredExercises.length}
                pageSize={ITEMS_PER_PAGE}
                onPageSize={() => {}}
                currentPage={safePage}
                totalPages={totalPages}
                onPage={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}