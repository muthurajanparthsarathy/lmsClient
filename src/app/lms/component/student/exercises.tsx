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

// ─── Assignment-state resolver ───────────────────────────────────────────────
// Reduces the raw availability + submission signals to ONE of seven states
// so the Status pill and Action cell always agree on what the row is doing.
// Ordering is important: higher-priority terminal states (submitted/graded)
// win over transient window states (upcoming/active).
export type AssignmentStateKind =
  | 'upcoming' | 'active' | 'in-progress'
  | 'submitted' | 'graded' | 'missed' | 'closed'

export interface AssignmentStateInfo {
  kind: AssignmentStateKind
  label: string
  Icon: any
  tone: { bg: string; fg: string }
  /** Short hint the Upcoming action cell shows next to the lock icon. */
  actionHint?: string
}

function resolveAssignmentState(
  exercise: Exercise,
  studentAnswers?: ExercisesProps['studentAnswers'],
  method?: string,
  subcategory?: string,
): AssignmentStateInfo {
  const testSubs = getTestSubmissions(exercise, studentAnswers, method, subcategory)
  const isCompleted = testSubs >= 1
  const availability = getExerciseAvailability(exercise)

  // Terminal (post-submission) states win. Server doesn't currently expose
  // a per-student "graded" flag on this shape — treat all submissions as
  // Submitted for now; the resolver stays ready to promote to Graded once
  // that field lands (check `exercise.answers?.[i]?.gradedAt` etc.).
  if (isCompleted) {
    return {
      kind: 'submitted',
      label: 'Submitted',
      Icon: CheckCircle,
      tone: { bg: '#ECFDF3', fg: '#15803D' },
    }
  }

  // Availability window drives the pre-submission states.
  if (availability.status === 'upcoming') {
    const startDate = (exercise as any)?.availabilityPeriod?.startDate
    const openHint = startDate ? `Opens ${formatShortDate(startDate)}` : 'Not yet open'
    return {
      kind: 'upcoming',
      label: 'Upcoming',
      Icon: Clock,
      tone: { bg: '#EEF2F7', fg: '#475569' },
      actionHint: openHint,
    }
  }
  if (availability.status === 'expired') {
    return {
      kind: 'missed',
      label: 'Missed',
      Icon: AlertCircle,
      tone: { bg: '#FEF2F2', fg: '#B91C1C' },
    }
  }

  // Available now — split Active vs In Progress on whether the student
  // has started but not submitted yet (localStorage marker from the editor).
  if (availability.canStart) {
    const inProgress = getExerciseAttemptData(exercise._id).inProgress
    if (inProgress) {
      return {
        kind: 'in-progress',
        label: 'In Progress',
        Icon: Zap,
        tone: { bg: '#FFF4EC', fg: '#C2410C' },
      }
    }
    return {
      kind: 'active',
      label: 'Active',
      Icon: Zap,
      tone: { bg: '#ECFDF3', fg: '#15803D' },
    }
  }

  // Anything else — closed for any reason we don't have a specific name for.
  return {
    kind: 'closed',
    label: 'Closed',
    Icon: Lock,
    tone: { bg: '#F1F5F9', fg: '#64748B' },
  }
}

// Short "23 Aug" style date for the Upcoming action hint. Falls back to the
// full formatter when the input is unparseable.
function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  } catch { return formatDate(iso) }
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
  // Pedagogy method drives the CTA noun — We_Do → assignment, You_Do →
  // assessment, I_Do → exercise. The launcher already has it as `method`
  // (any casing / separator), so accept any string here and normalise below.
  method?: string
}

function StartExercisePopup({
  exercise, onConfirm, onClose, availability,
  hasAttempted, limitReached, testSubmissions, submissionAttempts, isRetake, breadcrumb, method,
}: PopupProps) {
  // Normalise pedagogy method → CTA noun. Accepts every casing/separator
  // the codebase uses (We_Do / we-do / wedo / "we do").
  const methodKey = (method || '').toLowerCase().replace(/[_\s-]+/g, '')
  const activityNoun: 'assignment' | 'assessment' | 'exercise' =
    methodKey === 'wedo' ? 'assignment'
    : methodKey === 'youdo' ? 'assessment'
    : 'exercise'
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

  // ── Details-card content, resolved from what the exercise actually carries.
  // The prior "Topics" chip row conflated four different fields (languages,
  // module, difficulty, pedagogy method + activity) into one dense strip
  // that read as random tags. Splitting each into its own labeled row makes
  // the pane meaningful: Module (Core Programming), Language (Python),
  // Difficulty (Beginner). Method + activity are already conveyed by the
  // pedagogy chip beside the assignment title, so they're dropped here.
  const languageLabel = languages.length
    ? languages.map((l) => l.replace(/\b\w/g, (m) => m.toUpperCase())).join(', ')
    : ''
  const difficultyLabel = ex.exerciseInformation?.exerciseLevel
    ? String(ex.exerciseInformation.exerciseLevel).replace(/^./, (c: string) => c.toUpperCase())
    : ''

  // ── Building blocks (spec-matched: 40px icon squares, larger label/value) ─

  const IconBadge = ({ icon: Icon, tint, size = 34 }: { icon: any; tint: string; size?: number }) => (
    <span style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: `${tint}1a`, color: tint,
    }}>
      <Icon style={{ width: Math.round(size * 0.46), height: Math.round(size * 0.46) }} />
    </span>
  )

  const StatItem = ({ icon, tint, label, value }: { icon: any; tint: string; label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <IconBadge icon={icon} tint={tint} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#667085', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#101828', marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  )

  // Labeled row used in the Details card: compact 2-line block with a
  // tiny gray label above a heavier dark value. Uniform typography with
  // the header StatItems so the two cards read as one system.
  const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div style={{ fontSize: 11.5, color: '#667085', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#101828', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )

  // Topic-chip palette. Two specific slugs get the accent tints called out in
  // the spec ("Core Programming" → orange, "We-Do" → green); everything else
  // uses a restrained pale-neutral treatment so the row does not read as a
  // rainbow.
  const chipStyle = (kind: 'neutral' | 'orange' | 'green'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '5px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 500,
    border: kind === 'neutral'
      ? '1px solid #E4E7EC'
      : `1px solid ${kind === 'orange' ? '#FFE0CC' : '#BBF7D0'}`,
    background: kind === 'neutral' ? '#F4F5F7' : kind === 'orange' ? '#FFF4EC' : '#ECFDF3',
    color: kind === 'neutral' ? '#344054' : kind === 'orange' ? '#B23A00' : '#046C4E',
  })
  const topicKindFor = (t: string): 'neutral' | 'orange' | 'green' => {
    const lc = t.toLowerCase()
    if (lc.includes('core')) return 'orange'
    if (lc === 'we-do' || lc === 'we do' || lc === 'wedo') return 'green'
    return 'neutral'
  }

  const breadCrumbLine = (breadcrumb ?? []).filter(Boolean).join(' / ')

  // Availability drives the primary button's label and disabled state, so
  // there is no separate footer banner — the label carries the story.
  type BtnState = { label: string; icon: React.ReactNode; disabled: boolean }
  const buttonState: BtnState = limitReached
    ? { label: 'Already Completed', icon: <CheckCircle style={{ width: 16, height: 16 }} />, disabled: true }
    : availability.status === 'late-attempt' && availability.canStart
    ? { label: 'Start Late Attempt', icon: <Play style={{ width: 16, height: 16, fill: 'white' }} />, disabled: false }
    : availability.canStart
    ? {
        // The "Graded" chip beside the name already conveys grading, so
        // the CTA drops that adjective. The noun follows pedagogy method:
        // We_Do → assignment, You_Do → assessment, I_Do → exercise.
        label: isRetake
          ? (isPractice ? 'Retake practice' : `Retake ${activityNoun}`)
          : (isPractice ? 'Start practice'  : `Start ${activityNoun}`),
        icon: <Play style={{ width: 16, height: 16, fill: 'white' }} />,
        disabled: false,
      }
    : availability.status === 'upcoming'
    ? { label: 'Not Yet Open', icon: <Calendar style={{ width: 16, height: 16 }} />, disabled: true }
    : { label: 'Expired', icon: <Lock style={{ width: 16, height: 16 }} />, disabled: true }

  // ── Escape dismiss + return focus. The ResumeModal that ships alongside
  // does not wire Escape, but the launch modal is graded and the primary
  // action is destructive-adjacent, so we handle it here explicitly. Focus
  // returns to the element that opened the modal — a StrictMode-safe pattern
  // that just re-focuses whatever was active before mount.
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const opener = typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    primaryBtnRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      // Give the caller a beat to unmount before restoring focus, otherwise
      // React re-renders can steal it back.
      setTimeout(() => opener?.focus?.(), 0)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sap-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        fontFamily: LIST_FONT,
      }}
      onClick={onClose}
    >
      <div
        className="sap-shell"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 'min(1120px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '1px solid #E4E7EC',
          boxShadow: '0 20px 48px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.04)',
          display: 'flex', flexDirection: 'column',
          animation: 'sapPopIn .22s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {/* HEADER — compact: orange code glyph + breadcrumb + title + chips + close */}
        <div className="sap-header" style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
          borderBottom: '1px solid #E4E7EC', background: '#fff', flexShrink: 0,
        }}>
          <span aria-hidden="true" style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#FF641A', color: '#fff',
          }}>
            <Code2 style={{ width: 20, height: 20 }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {breadCrumbLine && (
              <div className="sap-breadcrumb" style={{
                fontSize: 12, color: '#667085', lineHeight: 1.3, marginBottom: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {breadCrumbLine}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 id="sap-title" style={{
                fontSize: 17, fontWeight: 700, color: '#101828', lineHeight: 1.2,
                margin: 0, wordBreak: 'break-word',
              }}>
                {exercise.exerciseInformation.exerciseName}
              </h2>
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
                fontSize: 11, fontWeight: 600,
                background: isGraded ? '#ECFDF3' : '#EFF6FF', color: isGraded ? '#12B76A' : '#175CD3',
                border: `1px solid ${isGraded ? '#BBF7D0' : '#BFDBFE'}`,
              }}>
                {isGraded ? 'Graded' : 'Non-Graded'}
              </span>
              {exercise.exerciseInformation.exerciseId && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
                  fontSize: 11, fontWeight: 500, color: '#344054', background: '#F4F5F7',
                  border: '1px solid #E4E7EC',
                }}>
                  {exercise.exerciseInformation.exerciseId}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assignment details"
            className="sap-close"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid #E4E7EC', background: '#fff', color: '#667085',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* BODY — 12-col grid; no inner scroll at standard desktop, the compact
            paddings keep everything inside the viewport. `min-height: 0` still
            lets the modal scroll if the viewport is genuinely too small. */}
        <div className="sap-body" style={{
          // No inner scroll — the labeled Details rows are compact enough
          // that everything fits inside the 100vh - 32px shell at any
          // sensible viewport. Overflow stays 'auto' as a defensive
          // fallback for extremely short viewports (< ~500px tall).
          minHeight: 0, overflow: 'visible',
          background: '#F7F8FA', padding: 16,
        }}>
          <div className="sap-grid" style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 14, alignItems: 'stretch',
          }}>
            {/* ── Assignment overview (8-col) ── */}
            <section className="sap-card" style={{
              background: '#fff', border: '1px solid #E4E7EC', borderRadius: 12,
              padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText style={{ width: 16, height: 16, color: '#FF641A' }} aria-hidden="true" />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#101828', margin: 0 }}>
                  Assignment overview
                </h3>
              </header>

              <div className="sap-stat-row" style={{
                display: 'grid', gridTemplateColumns: '1fr 1px 1fr', columnGap: 18, alignItems: 'center',
              }}>
                <StatItem icon={FileText} tint="#6C63FF" label="Total questions" value={totalQ || '—'} />
                <div className="sap-vdiv" style={{ height: '60%', minHeight: 26, width: 1, background: '#E4E7EC', margin: '0 auto' }} aria-hidden="true" />
                <StatItem icon={Clock} tint="#12B76A" label="Duration" value={duration ? formatDuration(duration) : '—'} />
              </div>

              <div style={{ height: 1, background: '#E4E7EC' }} aria-hidden="true" />

              <div>
                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: '#101828', margin: '0 0 12px' }}>
                  Schedule
                </h4>
                <div className="sap-stat-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1px 1fr', columnGap: 18, alignItems: 'center',
                }}>
                  <StatItem
                    icon={Calendar} tint="#6C63FF" label="Starts"
                    value={exercise.availabilityPeriod?.startDate ? formatDateTime(exercise.availabilityPeriod.startDate) : '—'}
                  />
                  <div className="sap-vdiv" style={{ height: '60%', minHeight: 26, width: 1, background: '#E4E7EC', margin: '0 auto' }} aria-hidden="true" />
                  <StatItem
                    icon={Calendar} tint="#12B76A" label="Ends"
                    value={exercise.availabilityPeriod?.endDate ? formatDateTime(exercise.availabilityPeriod.endDate) : '—'}
                  />
                </div>
              </div>
            </section>

            {/* ── Details (4-col) ── */}
            <section className="sap-card" style={{
              background: '#fff', border: '1px solid #E4E7EC', borderRadius: 12,
              padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen style={{ width: 16, height: 16, color: '#FF641A' }} aria-hidden="true" />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#101828', margin: 0 }}>
                  Details
                </h3>
              </header>

              {/* Two-column labeled rows — Module + Language + Difficulty
                  each get their own row instead of collapsing into a mixed
                  Topics chip strip. Empty fields drop out entirely so a
                  language-agnostic MCQ exercise doesn't render an empty
                  "Language: —" placeholder. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <DetailRow label="Module" value={selectedModule || '—'} />
                {languageLabel && <DetailRow label="Language" value={languageLabel} />}
                {difficultyLabel && <DetailRow label="Difficulty" value={difficultyLabel} />}
              </div>
              <div style={{ height: 1, background: '#E4E7EC' }} aria-hidden="true" />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconBadge icon={Calendar} tint="#12B76A" size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: '#667085' }}>Available until</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#101828', marginTop: 1 }}>
                    {exercise.availabilityPeriod?.endDate ? formatDateTime(exercise.availabilityPeriod.endDate) : '—'}
                  </div>
                </div>
              </div>

              {exercise.availabilityPeriod?.gracePeriodAllowed && exercise.availabilityPeriod?.gracePeriodDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconBadge icon={Hourglass} tint="#FF641A" size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: '#667085' }}>Grace period ends</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#101828', marginTop: 1 }}>
                      {formatDateTime(exercise.availabilityPeriod.gracePeriodDate)}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* FOOTER — Cancel + primary Begin. The button label carries any
            availability story ("Not Yet Open" / "Expired") — no separate banner
            is repeated here per the launch-modal spec. */}
        <div className="sap-footer" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '10px 20px', background: '#fff',
          borderTop: '1px solid #E4E7EC', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            className="sap-btn-cancel"
            style={{
              minWidth: 96, height: 38, padding: '0 16px', borderRadius: 8,
              border: '1px solid #E4E7EC', background: '#fff', color: '#344054',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            ref={primaryBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={buttonState.disabled}
            className="sap-btn-primary"
            style={{
              minWidth: 200, height: 38, padding: '0 18px', borderRadius: 8,
              background: buttonState.disabled ? '#94A3B8' : '#FF641A',
              color: '#fff', border: 'none',
              fontSize: 13.5, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: buttonState.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {buttonState.icon}
            {buttonState.label}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sapPopIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);   }
        }
        .sap-close:hover { background: #F9FAFB; }
        .sap-close:focus-visible { outline: 2px solid #FF641A; outline-offset: 2px; }
        .sap-btn-cancel:hover { background: #F9FAFB; }
        .sap-btn-cancel:focus-visible { outline: 2px solid #FF641A; outline-offset: 2px; }
        .sap-btn-primary:not(:disabled):hover { background: #E45510; }
        .sap-btn-primary:focus-visible { outline: 2px solid #101828; outline-offset: 2px; }

        /* Tablet — trim padding further; two columns still fit while width allows */
        @media (max-width: 1080px) {
          .sap-body { padding: 14px !important; }
          .sap-card { padding: 16px !important; }
        }

        /* Stack the two cards below 900px */
        @media (max-width: 900px) {
          .sap-grid { grid-template-columns: 1fr !important; }
        }

        /* Mobile — nearly full-screen, stacked stat rows, full-width footer */
        @media (max-width: 640px) {
          .sap-shell { max-width: 100% !important; max-height: 100vh !important; border-radius: 0 !important; }
          .sap-header { padding: 12px !important; gap: 10px !important; }
          .sap-body { padding: 12px !important; }
          .sap-card { padding: 14px !important; gap: 12px !important; }
          .sap-stat-row { grid-template-columns: 1fr !important; row-gap: 12px !important; }
          .sap-vdiv { display: none !important; }
          .sap-footer { flex-direction: column-reverse !important; padding: 12px !important; }
          .sap-footer button { width: 100% !important; min-width: 0 !important; }
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
  // Due-date scope for the Filter popover. `any` = no restriction.
  // `week` = end date within the next 7 days from now (inclusive).
  // `later` = end date more than 7 days out or no end date at all.
  const [filterDue, setFilterDue] = useState<'any' | 'week' | 'later'>('any')
  // Staged copies used inside the Filter popover so chip clicks don't
  // update the list until the student hits Apply filters. Reset from
  // the applied values whenever the popover opens. Cancel discards.
  const [stagedLevel, setStagedLevel] = useState<string>('all')
  const [stagedDue, setStagedDue] = useState<'any' | 'week' | 'later'>('any')
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

  // Sync staged filter state from the applied values whenever the
  // popover opens. Cancel closes without touching applied; Apply
  // commits staged → applied. This is the "don't change the list until
  // you press Apply" behaviour the user asked for.
  useEffect(() => {
    if (showFilterDropdown) {
      setStagedLevel(filterLevel)
      setStagedDue(filterDue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Apply due-date filter — `week` = end within 7 days from now,
    // `later` = end more than 7 days out (or no end date at all).
    if (filterDue !== "any") {
      const now = Date.now()
      const weekOut = now + 7 * 24 * 60 * 60 * 1000
      result = result.filter((ex) => {
        const endRaw = ex.availabilityPeriod?.endDate
        const end = endRaw ? new Date(endRaw).getTime() : null
        if (filterDue === "week") {
          return end != null && end >= now && end <= weekOut
        }
        // 'later'
        return end == null || end > weekOut
      })
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
  [exercises, searchQuery, filterLevel, filterStatus, filterDue, studentAnswers, method, subcategory, sortColumn, sortDir]
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
useEffect(() => { setCurrentPage(1) }, [searchQuery, filterLevel, filterStatus.join(','), filterDue])

// Status chip counts for the toolbar — computed off the same base list
// the table renders from (config-gated + search-scoped) so the chip
// totals always match the number of rows the user will actually see.
// "Active" = row Status column reads Active. "Submitted" = row Status
// reads Submitted. "Pending" = row Status reads Not Submitted (upcoming
// / expired / never attempted).
const statusCounts = useMemo(() => {
  const scoped = exercises.filter(ex => isExerciseFullyConfigured(ex)).filter((ex) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      ex.exerciseInformation.exerciseName?.toLowerCase().includes(q) ||
      ex.exerciseInformation.exerciseId?.toLowerCase().includes(q)
    )
  })
  let active = 0
  let submitted = 0
  let pending = 0
  scoped.forEach((ex) => {
    const availability = getExerciseAvailability(ex)
    const testSubs = getTestSubmissions(ex, studentAnswers, method, subcategory)
    if (testSubs >= 1) submitted++
    else if (availability.canStart) active++
    else pending++
  })
  return { all: scoped.length, active, submitted, pending }
}, [exercises, searchQuery, studentAnswers, method, subcategory])

// Which chip is currently pressed. Derived from filterStatus so the
// dropdown Filter panel and the chip row stay in sync — a chip click
// replaces the multi-select entirely, and clicking All clears it.
const activeChip: 'all' | 'active' | 'submitted' | 'pending' = (() => {
  if (filterStatus.length === 0) return 'all'
  if (filterStatus.length === 1) {
    if (filterStatus[0] === 'active') return 'active'
    if (filterStatus[0] === 'submitted') return 'submitted'
    if (filterStatus[0] === 'not-submitted') return 'pending'
  }
  return 'all'
})()
const setChip = (chip: 'all' | 'active' | 'submitted' | 'pending') => {
  if (chip === 'all') setFilterStatus([])
  else if (chip === 'active') setFilterStatus(['active'])
  else if (chip === 'submitted') setFilterStatus(['submitted'])
  else setFilterStatus(['not-submitted'])
}

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

  // Fresh We_Do start → the standalone pre-start page replaces the old
  // StartExercisePopup modal. Retake / in-progress-resume still go through
  // the popup / resume dialog because they carry a confirmation payload
  // (reset progress / resume the draft) that only the modal exposes.
  const methodKey = (method || '').toLowerCase().replace(/[_\s-]+/g, '')
  const isFreshWeDoStart = methodKey === 'wedo' && !isRetake
  if (isFreshWeDoStart) {
    const { inProgress } = getExerciseAttemptData(exercise._id)
    if (inProgress) {
      setResumeModalExercise(exercise)
      return
    }
    try {
      const stash = {
        exercise,
        context: {
          courseId,
          courseName: (exercise as any)?.courseName || '',
          nodeId: (selectedItem as any)?.id || '',
          nodeName: (selectedItem as any)?.title || '',
          nodeType: (selectedItem as any)?.type || '',
          method: method || 'we-do',
          category: 'We_Do',
          subcategory: subcategory || '',
          hierarchy: (currentHierarchy && currentHierarchy.length > 0 ? currentHierarchy : hierarchy) || [],
        },
      }
      localStorage.setItem('wedo_test_intro_' + exercise._id, JSON.stringify(stash))
    } catch { /* quota */ }
    const qs = new URLSearchParams({ exerciseId: exercise._id })
    // Open the pre-start instructions page in a NEW TAB so the
    // course list stays where the student left it, matching the
    // "Start opens a fresh workspace" flow the user asked for.
    // `noopener,noreferrer` prevents the new tab from having a
    // reference back to this window.
    if (typeof window !== 'undefined') {
      window.open(
        `/lms/pages/courses/coursesdetailedview/wedo/instructions?${qs.toString()}`,
        '_blank',
        'noopener,noreferrer',
      )
    } else {
      router.push(`/lms/pages/courses/coursesdetailedview/wedo/instructions?${qs.toString()}`)
    }
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
  // Active-filter strip visibility. Status filtering moved to the
  // segmented control (which shows its own selected state), so it no
  // longer counts as an "applied filter" for the summary strip. Level
  // and Due Date are the two popover-applied filters that the strip
  // surfaces with removable chips.
  const hasActiveFilters = !!searchQuery || filterLevel !== "all" || filterDue !== "any"
  // Status filter lives OUTSIDE the popover now (segmented control),
  // so the "1 active filter" badge on the Filter button only counts the
  // in-popover filters (Level + Due Date).
  const activeFilterCount = (filterLevel !== "all" ? 1 : 0) + (filterDue !== "any" ? 1 : 0)
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
      className: 'w-[4%] pl-4 pr-2 text-left text-[13px] text-faint tabular-nums align-middle whitespace-nowrap',
      skeletonWidth: '20px',
      render: (_ex, i) => startIdx + i + 1,
    },
    {
      key: 'id',
      label: 'ID',
      className: 'w-[9%] px-3 text-left align-middle text-[13px] text-subtle',
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
      className: 'w-[18%] px-3 text-left align-middle text-[13.5px]',
      skeletonWidth: '80%',
      render: (ex) => {
        const name = ex.exerciseInformation.exerciseName || 'N/A'
        // Assignment name is the primary label in the row — kept the
        // heading color + slight size bump, but dropped semibold →
        // medium. Weight + color + size stacked all three of the same
        // hierarchy signals, which read as "the whole column is bold".
        // Medium is enough to distinguish it from the regular-weight
        // ID / date cells without over-emphasising.
        return (
          <span className="block truncate font-medium text-heading" title={name}>{name}</span>
        )
      },
    },
    {
      key: 'start',
      label: 'Available From',
      sortKey: 'start',
      className: 'w-[18%] px-3 text-left align-middle text-[13px] text-body',
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
      label: 'Due Date',
      sortKey: 'end',
      className: 'w-[18%] px-3 text-left align-middle text-[13px] text-body',
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
      className: 'w-[8%] px-3 text-left align-middle text-[13px] text-body',
      render: (ex) => {
        // Quiet neutral outlined badge — the difficulty tint used to
        // paint the row green (Beginner) five times in a row, which was
        // the loudest thing in the list even though it conveyed nothing
        // actionable. Neutral slate keeps the label readable without
        // stealing focus from Status / Action.
        const d = getDifficultyStyle(ex.exerciseInformation.exerciseLevel)
        return (
          <span className="inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full border"
            style={{ background: '#FFFFFF', color: '#475569', borderColor: '#E2E8F0' }}>
            {d.label}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      // Wider so "In Progress" fits without wrapping.
      className: 'w-[11%] px-3 text-left align-middle text-[13px] text-body',
      render: (ex) => {
        const s = resolveAssignmentState(ex, studentAnswers, method, subcategory)
        // Semantic colours per state — restrained pale backgrounds so
        // five rows in a column don't shout. Every state uses an icon +
        // label so meaning isn't carried by colour alone.
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: s.tone.bg, color: s.tone.fg }}>
            <s.Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            {s.label}
          </span>
        )
      },
    },
    {
      key: 'action',
      label: 'Action',
      // Fixed width, centred content, uniform button footprint so every
      // row's action lands in the same visual slot.
      className: 'w-[13%] pl-6 pr-6 text-center align-middle text-[13px] text-body whitespace-nowrap',
      render: (ex) => {
        const s = resolveAssignmentState(ex, studentAnswers, method, subcategory)

        // Shared button classes so Start / Continue / View Submission /
        // View Feedback all render at identical dimensions. Bumped from
        // h-7/w-112/text-2xs → h-9/w-[128px]/text-[13px] so the row CTA
        // sits at a comfortable click target and matches the toolbar
        // rhythm (36px controls) instead of looking shrunken.
        const btnBase = 'inline-flex items-center justify-center gap-1.5 h-9 w-[128px] text-[13px] font-semibold rounded-control transition-colors duration-150'
        const primary: React.CSSProperties = { background: '#F97316', color: '#FFFFFF', border: 'none', cursor: 'pointer' }
        const secondary: React.CSSProperties = { background: '#FFFFFF', color: '#F97316', border: '1px solid #F97316', cursor: 'pointer' }

        // "Upcoming" — no interaction yet, just a quiet lock + open-date
        // reminder so the empty cell doesn't look like missing data.
        if (s.kind === 'upcoming') {
          return (
            <div className="flex items-center justify-center gap-1.5 text-2xs text-subtle whitespace-nowrap">
              <Lock size={12} style={{ flexShrink: 0 }} />
              <span>{s.actionHint || 'Not yet open'}</span>
            </div>
          )
        }
        if (s.kind === 'active') {
          return (
            <div className="flex items-center justify-center">
              <button type="button" onClick={e => handleStartClick(ex, e)} className={btnBase} style={primary}>
                Start
              </button>
            </div>
          )
        }
        if (s.kind === 'in-progress') {
          return (
            <div className="flex items-center justify-center">
              <button type="button" onClick={e => handleStartClick(ex, e)} className={btnBase} style={primary}>
                Continue
              </button>
            </div>
          )
        }
        if (s.kind === 'submitted' || s.kind === 'graded') {
          // Both submitted + graded route to the same grader screen —
          // labelled "Grade" per the user's rename.
          return (
            <div className="flex items-center justify-center">
              <button type="button" onClick={e => handleGradeClick(ex, e)} className={btnBase} style={secondary}>
                Grade
              </button>
            </div>
          )
        }
        // 'missed' | 'closed' — centred muted em dash so students see
        // "no action possible" rather than a suspicious empty cell.
        return (
          <div className="flex items-center justify-center text-subtle" aria-label="No action available">
            —
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
          method={method}
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
        // Shared responsive gutter matching TopBar + TabBar so the
        // search field's left edge aligns with Overview and the
        // Assignment tab across every viewport width. Container fills
        // the viewport — no fixed max-width, no centred narrow column.
        className="flex flex-col h-full min-h-0 bg-surface overflow-hidden"
        style={{
          fontFamily: LIST_FONT,
          paddingInline: 'clamp(16px, 2vw, 32px)',
          width: '100%', maxWidth: 'none', marginInline: 0,
          boxSizing: 'border-box',
        }}
      >

        {/* ── Toolbar — one clean row, 36px controls, 12px gaps.
             Search left · status segmented control middle · Filter right.
             Status filtering lives ONLY in the segmented control; the
             Filter popover carries Level + Due Date. ── */}
        <div className="flex-none flex items-center gap-3 pt-2 pb-2 min-w-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments…"
              className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-[12.5px] text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
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

          {/* Status segmented control — 36px, one continuous rounded
              container with hairline dividers between segments and
              circular count badges. Selected = pale-orange bg + orange
              text + orange-tinted badge. */}
          <div
            role="tablist" aria-label="Filter by status"
            className="inline-flex items-stretch h-9 rounded-control border border-hairline-strong bg-surface overflow-hidden shrink-0"
          >
            {([
              { key: 'all' as const,       label: 'All',       count: statusCounts.all },
              { key: 'active' as const,    label: 'Active',    count: statusCounts.active },
              { key: 'submitted' as const, label: 'Submitted', count: statusCounts.submitted },
              { key: 'pending' as const,   label: 'Pending',   count: statusCounts.pending },
            ]).map((c, i) => {
              const selected = activeChip === c.key
              return (
                <button
                  key={c.key}
                  type="button" role="tab" aria-selected={selected}
                  onClick={() => setChip(c.key)}
                  className={`inline-flex items-center gap-1.5 px-3 text-[12.5px] font-semibold transition-colors duration-150 ${
                    selected ? 'text-brand-strong' : 'text-subtle hover:text-heading'
                  } ${i > 0 ? 'border-l border-hairline' : ''}`}
                  style={selected ? { background: '#FFF4EC' } : undefined}
                >
                  <span>{c.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10.5px] font-semibold tabular-nums ${
                      selected ? 'text-brand-strong' : 'text-subtle'
                    }`}
                    style={{ background: selected ? '#FFE4CC' : '#F1F5F9' }}
                  >
                    {c.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative shrink-0 ml-auto" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilterDropdown((v) => !v)}
              aria-expanded={showFilterDropdown}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control text-[12.5px] font-semibold transition-colors duration-150"
              style={{
                border: '1px solid #F97316',
                background: '#FFFFFF',
                color: '#F97316',
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white tabular-nums"
                  style={{ background: '#F97316' }}
                >
                  {activeFilterCount}
                </span>
              )}
              {showFilterDropdown
                ? <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
                : <ChevronDown className="w-3.5 h-3.5 transition-transform" />}
            </button>

            {showFilterDropdown && (
              <div
                className="absolute top-full right-0 mt-2 z-40 bg-surface rounded-xl border border-hairline-strong"
                style={{
                  width: 360,
                  boxShadow: '0 14px 36px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)',
                }}
              >
                {/* Header — Clear all now resets STAGED values only; the
                    list stays as-is until the student hits Apply. */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <span className="text-[15px] font-semibold text-heading">Filters</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedLevel('all')
                      setStagedDue('any')
                    }}
                    className="text-[13px] font-semibold transition-colors duration-150"
                    style={{ color: '#F97316', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    Clear all
                  </button>
                </div>

                {/* Level — chip clicks write to STAGED state so the list
                    doesn't move until Apply. */}
                <div className="px-5 pt-2">
                  <div className="text-[11px] font-semibold text-faint tracking-wide mb-2">LEVEL</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: 'all',          label: 'Any' },
                      { val: 'beginner',     label: 'Beginner' },
                      { val: 'intermediate', label: 'Intermediate' },
                      { val: 'advanced',     label: 'Advanced' },
                    ].map(({ val, label }) => {
                      const selected = stagedLevel === val
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setStagedLevel(val)}
                          className="inline-flex items-center h-9 px-3.5 rounded-control text-[12.5px] font-semibold transition-colors duration-150"
                          style={selected
                            ? { border: '1px solid #F97316', background: '#FFF4EC', color: '#F97316' }
                            : { border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569' }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Due date — same staged pattern. */}
                <div className="px-5 pt-4">
                  <div className="text-[11px] font-semibold text-faint tracking-wide mb-2">DUE DATE</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: 'any' as const,  label: 'Any time' },
                      { val: 'week' as const, label: 'Due this week' },
                      { val: 'later' as const,label: 'Due later' },
                    ].map(({ val, label }) => {
                      const selected = stagedDue === val
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setStagedDue(val)}
                          className="inline-flex items-center h-9 px-3.5 rounded-control text-[12.5px] font-semibold transition-colors duration-150"
                          style={selected
                            ? { border: '1px solid #F97316', background: '#FFF4EC', color: '#F97316' }
                            : { border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569' }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer — Cancel discards staged; Apply commits it. */}
                <div className="mt-4 border-t border-hairline flex items-center justify-end gap-2 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setShowFilterDropdown(false)}
                    className="inline-flex items-center justify-center h-10 px-4 rounded-control text-[13px] font-semibold text-body bg-surface border border-hairline-strong hover:bg-row-hover transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterLevel(stagedLevel)
                      setFilterDue(stagedDue)
                      setShowFilterDropdown(false)
                    }}
                    className="inline-flex items-center justify-center h-10 px-6 rounded-control text-[13px] font-semibold text-white transition-colors duration-150"
                    style={{ background: '#F97316', border: 'none' }}
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {isHeaderHidden && onShowHeader && (
            <button
              type="button"
              onClick={onShowHeader}
              title="Show header"
              className="inline-flex items-center justify-center size-9 rounded-control border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors duration-150"
            >
              <Eye size={14} />
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
            {filterDue !== 'any' && (
              <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
                {filterDue === 'week' ? 'Due this week' : 'Due later'}
                <button
                  type="button"
                  aria-label="Clear due date filter"
                  onClick={() => setFilterDue('any')}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setFilterLevel('all')
                setFilterDue('any')
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
            // `fillHeight` restored — the panel is a flex column, the
            // table needs flex:1 so the "Showing X of Y" + pager row
            // stays pinned to the panel's bottom (standard listing
            // behaviour). Empty space between the last row and the
            // pager is expected when the current page has fewer rows
            // than the viewport can show.
            fillHeight
            // All rows stay white. Only the CURRENTLY-ACTIVE assignment
            // (available to start now, not yet submitted) gets a subtle
            // 3px orange left rail so a student's eye lands on their
            // next thing to do. Submitted / Not Submitted rows carry no
            // background tint — the Status badge conveys the state.
            rowClassName={(ex) => {
              const availability = getExerciseAvailability(ex)
              const testSubs = getTestSubmissions(ex, studentAnswers, method, subcategory)
              const isActive = availability.canStart && testSubs === 0
              return isActive ? 'border-l-[3px] border-l-[#F97316]' : 'border-l-[3px] border-l-transparent'
            }}
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