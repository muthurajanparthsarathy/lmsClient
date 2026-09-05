"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import ReactDOM from "react-dom"
import {
  Clock, AlertCircle, X, Play, Zap, Trophy, Star,
  CheckSquare, Code2, Layers, HelpCircle, BookOpen,
  Calendar, Hourglass, Lock, CheckCircle, Code,
  Info, Target, Settings, FileText, BarChart2, Shield, Cpu,
  Search, Filter, ChevronDown, LayoutList,
} from "lucide-react"
import SectionBasedTestPage from "./YouDo/assessment/components/SectionBasedTestPage"
// Shared 12-hour formatter so the section-based cards read the same as
// the We_Do / You_Do list rows: "Sep 3, 2026, 6:09 PM" (no leading
// zero on hour). Section-based cards previously showed date-only,
// dropping the time the student needed to plan a window submission.
import { formatDateTime12 } from "@/app/lms/shared/time12"

// ─── Re-use the same interfaces as exercises.tsx ──────────────────────────────

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

interface EvaluationSettings {
  practiceMode?: boolean
  manualEvaluation?: { enabled: boolean; submissionNeeded: boolean; _id?: string }
  aiEvaluation?: boolean
  automationEvaluation?: boolean
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

// ─── Section-specific types ───────────────────────────────────────────────────

interface SectionConfig {
  sectionId: string
  sectionName: string
  sectionType?: string          // "MCQ" | "Programming" | "Other" | …
  questionCount?: number        // target count for this section
  marksPerQuestion?: number
  totalMarks?: number
  duration?: number             // section-level time limit (minutes)
  submissionAttempts?: number
  [key: string]: any
}

interface SectionQuestion {
  sectionId?: string
  questionType?: string
  [key: string]: any
}

interface SectionBasedExercise {
  _id: string
  exerciseType?: string         // "SectionBased" or anything
  isSectionBased?: boolean
  exerciseInformation: ExerciseInformation
  availabilityPeriod: AvailabilityPeriod
  evaluationSettings?: EvaluationSettings
  questionBehavior?: QuestionBehavior
  sectionConfigs?: SectionConfig[]
  questions?: SectionQuestion[]
  isGraded?: boolean
  createdAt: string
  updatedAt: string
  [key: string]: any
}

interface ExerciseSelectOptions {
  resetProgress?: boolean
}

interface SectionBasedAssessmentsProps {
  courseId?: number | string
  exercises: SectionBasedExercise[]
  onExerciseSelect: (exercise: SectionBasedExercise, options?: ExerciseSelectOptions) => void
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSectionBasedExercise(ex: any): boolean {
  return ex?.exerciseType === "SectionBased" || ex?.isSectionBased === true
}

/**
 * An exercise is "fully configured" when every sectionConfig has at least
 * the expected number of questions with a matching sectionId in questions[].
 * Legacy questions (no sectionId) are ignored.
 */
function isSectionExerciseConfigured(exercise: SectionBasedExercise): boolean {
  // Get sectionConfigs and normalize to array
  let configs = exercise.sectionConfigs
  
  // If configs is an object, convert to array
  if (configs && typeof configs === 'object' && !Array.isArray(configs)) {
    configs = Object.values(configs)
  }
  
  // Check if configs exists and is an array
  if (!configs || !Array.isArray(configs) || configs.length === 0) return false

  // Build a count map: sectionId → how many questions have that sectionId
  const questionsBySectionId: Record<string, number> = {}
  for (const q of exercise.questions || []) {
    if (q.sectionId) {
      questionsBySectionId[q.sectionId] = (questionsBySectionId[q.sectionId] || 0) + 1
    }
  }

  // For section-based exercises, check if ANY section has questions
  // or if the exercise has questions at all
  let hasConfiguredSections = false
  
  for (const cfg of configs) {
    // Try to get questionCount from different possible locations
    let target = cfg.questionCount ?? 0
    
    // If not found, check mcqConfig and programmingConfig
    if (target === 0 && cfg.mcqConfig) {
      target = cfg.mcqConfig.generalQuestionCount || 
               (cfg.mcqConfig.levelBasedCounts?.easy + cfg.mcqConfig.levelBasedCounts?.medium + cfg.mcqConfig.levelBasedCounts?.hard) || 0
    }
    if (target === 0 && cfg.programmingConfig) {
      target = cfg.programmingConfig.generalQuestionCount ||
               (cfg.programmingConfig.levelBasedCounts?.easy + cfg.programmingConfig.levelBasedCounts?.medium + cfg.programmingConfig.levelBasedCounts?.hard) || 0
    }
    
    if (target > 0) {
      hasConfiguredSections = true
      // Check if this section has enough questions
      const sectionId = cfg.id || cfg.sectionId
      const actual = questionsBySectionId[sectionId] || 0
      if (actual < target) return false
    }
  }

  // Also check if there are any questions at all (even without section mapping)
  const hasAnyQuestions = (exercise.questions?.length || 0) > 0
  
  // Return true if either:
  // 1. Sections are configured and have questions, OR
  // 2. There are questions but no section configs (fallback)
  return hasConfiguredSections || hasAnyQuestions
}

function normalizeSectionConfigs(exercise: SectionBasedExercise): SectionConfig[] {
  const sc = exercise.sectionConfigs
  if (!sc) return []
  if (Array.isArray(sc)) return sc
  if (typeof sc === 'object') return Object.values(sc) as SectionConfig[]
  return []
}

function getSectionCount(exercise: SectionBasedExercise): number {
  return normalizeSectionConfigs(exercise).length
}

function getTotalSectionQuestions(exercise: SectionBasedExercise): number {
  const configs = normalizeSectionConfigs(exercise)
  let configTotal = 0
  if (configs.length > 0) {
    configTotal = configs.reduce((sum, cfg: any) => {
      const mcqQ = cfg.mcqConfig?.generalQuestionCount ?? 0
      // Programming count depends on the config type — general uses a single count,
      // level-based / selection-level use per-difficulty counts (easy+medium+hard).
      const pc = cfg.programmingConfig || {}
      let progQ = 0
      if (pc.questionConfigType === 'levelBased') {
        const lb = pc.levelBasedCounts || {}
        progQ = (lb.easy || 0) + (lb.medium || 0) + (lb.hard || 0)
      } else if (pc.questionConfigType === 'selectionLevel') {
        const sl = pc.selectionLevelCounts || {}
        progQ = (sl.easy || 0) + (sl.medium || 0) + (sl.hard || 0)
      } else {
        progQ = pc.generalQuestionCount ?? 0
      }
      return sum + (cfg.questionCount ?? mcqQ + progQ)
    }, 0)
  }
  if (configTotal > 0) return configTotal
  // Fallback — count the actual questions on the exercise so a configured (but e.g.
  // level-based) exercise is never wrongly reported as having no questions.
  const withSection = exercise.questions?.filter((q: any) => q.sectionId || q.sectionName).length ?? 0
  return withSection > 0 ? withSection : (exercise.questions?.length ?? 0)
}

function getSubmissionAttempts(exercise: SectionBasedExercise): number {
  // Try each section config first, fall back to top-level
  const fromSection = exercise.sectionConfigs?.[0]?.submissionAttempts
  return fromSection ?? (exercise as any)?.questionConfiguration?.submissionAttempts ?? 1
}

function getTestSubmissions(
  exercise: SectionBasedExercise,
  studentAnswers?: SectionBasedAssessmentsProps["studentAnswers"],
  method?: string
): number {
  if (!studentAnswers || !method) return 0
  try {
    const matchId = (a: any) =>
      a?.exerciseId === exercise._id || a?._id === exercise._id || a?.id === exercise._id
    const deepFind = (node: any): number => {
      if (!node || typeof node !== "object") return 0
      if (Array.isArray(node)) {
        const found = node.find(matchId)
        if (found) return found.testSubmissions ?? 0
        for (const item of node) { const r = deepFind(item); if (r > 0) return r }
        return 0
      }
      for (const arr of ["assignments", "assessments", "exercises", "submissions"]) {
        if (Array.isArray(node[arr])) {
          const found = node[arr].find(matchId)
          if (found) return found.testSubmissions ?? 0
        }
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") { const r = deepFind(v); if (r > 0) return r }
      }
      return 0
    }
    const ml = method.toLowerCase().replace(/[-_\s]/g, "")
    const candidates: string[] = []
    if (ml.includes("youdo")) candidates.push("You_Do", "you_do", "YouDo", "you-do", "youdo")
    candidates.push(method, method.replace(/-/g, "_"), method.replace(/_/g, "-"))
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
  } catch {
    return 0
  }
}

function getDifficultyStyle(level: string = "intermediate") {
  switch (level.toLowerCase()) {
    case "beginner":    return { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Beginner" }
    case "medium":      return { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Medium" }
    case "intermediate":return { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Intermediate" }
    case "hard":        return { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Hard" }
    case "advanced":    return { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Advanced" }
    default:            return { color: "#475569", bg: "#f8fafc", border: "#e2e8f0", label: "General" }
  }
}

function getExerciseAvailability(exercise: SectionBasedExercise): {
  status: "upcoming" | "available" | "expired" | "grace-period" | "late-attempt"
  message: string
  canStart: boolean
} {
  const now = new Date()
  const startDate = exercise.availabilityPeriod?.startDate ? new Date(exercise.availabilityPeriod.startDate) : null
  const endDate   = exercise.availabilityPeriod?.endDate   ? new Date(exercise.availabilityPeriod.endDate)   : null
  const graceDate = exercise.availabilityPeriod?.gracePeriodAllowed && exercise.availabilityPeriod?.gracePeriodDate
    ? new Date(exercise.availabilityPeriod.gracePeriodDate) : null
  const cutOffDate = exercise.availabilityPeriod?.cutOffEnabled && exercise.availabilityPeriod?.cutOffDate
    ? new Date(exercise.availabilityPeriod.cutOffDate) : null

  if (startDate && now < startDate)
    return { status: "upcoming",      message: `Starts ${formatDateTime12(startDate)}`, canStart: false }
  if (graceDate && endDate && now > endDate && now <= graceDate)
    return { status: "grace-period",  message: `Grace until ${formatDateTime12(graceDate)}`, canStart: true }
  if (endDate && now <= endDate)
    return { status: "available",     message: `Ends ${formatDateTime12(endDate)}`, canStart: true }
  if (cutOffDate && endDate && now > endDate && now <= cutOffDate)
    return { status: "late-attempt",  message: `Late until ${formatDateTime12(cutOffDate)}`, canStart: true }
  return { status: "expired", message: "Expired", canStart: false }
}

// ─── Start Popup (section-aware variant) ─────────────────────────────────────

interface SectionPopupProps {
  exercise: SectionBasedExercise
  onConfirm: () => void
  onClose: () => void
  availability: ReturnType<typeof getExerciseAvailability>
  testSubmissions: number
  submissionAttempts: number
  limitReached: boolean
}

export function SectionStartPopup({
  exercise, onConfirm, onClose, availability,
  testSubmissions, submissionAttempts, limitReached,
}: SectionPopupProps) {
  const diff = getDifficultyStyle(exercise.exerciseInformation.exerciseLevel)
  const isGraded = exercise.isGraded !== false
  const isPractice = exercise.evaluationSettings?.practiceMode
  const canProceed = availability.canStart && !limitReached
  
  const sections = normalizeSectionConfigs(exercise)
  
  const totalQ = getTotalSectionQuestions(exercise)
  
  // Calculate total marks — prefer top-level totalMarks, then sum across sections
  const totalMarks = (exercise as any).exerciseInformation?.totalMarks
    || sections.reduce((s, c: any) => {
        if (c.totalMarks) return s + c.totalMarks
        const marksPerQ = c.marksPerQuestion ?? c.mcqConfig?.marksPerQuestion ?? 0
        const questionCount = c.questionCount ?? c.mcqConfig?.generalQuestionCount ?? c.programmingConfig?.generalQuestionCount ?? 0
        return s + (marksPerQ * questionCount)
      }, 0)

  const statusConfig = limitReached
    ? { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", text: `All ${submissionAttempts} attempt${submissionAttempts > 1 ? "s" : ""} used` }
    : availability.status === "available"
    ? { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", text: availability.message }
    : availability.status === "late-attempt"
    ? { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", text: `⚠ ${availability.message}` }
    : availability.status === "grace-period"
    ? { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", text: availability.message }
    : availability.status === "upcoming"
    ? { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", text: availability.message }
    : { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", text: "Expired" }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <tr>
      <td style={{ padding: "5px 0", fontSize: 12, color: "#64748b", borderBottom: "1px solid #f1f5f9", paddingRight: 8, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "5px 0", fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "right", borderBottom: "1px solid #f1f5f9" }}>{value}</td>
    </tr>
  )

  const SecLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{children}</div>
  )

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 620, borderRadius: 14, background: "#ffffff", boxShadow: "0 20px 50px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)", animation: "popIn .22s cubic-bezier(.34,1.56,.64,1)", height: "90vh", maxHeight: 600, display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, borderRadius: "14px 14px 0 0", flexShrink: 0, background: "#7c3aed" }} />

        {/* Header */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🗂️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {exercise.exerciseInformation.exerciseName}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f5f3ff", color: "#7c3aed", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <LayoutList className="w-2.5 h-2.5" />Section-Based
              </span>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: diff.bg, color: diff.color, fontWeight: 700 }}>{diff.label}</span>
              {isGraded
                ? <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#fdf4ff", color: "#7c3aed", fontWeight: 700 }}>Graded</span>
                : <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#ecfeff", color: "#0891b2", fontWeight: 700 }}>Non-Graded</span>}
              {isPractice && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#fef9c3", color: "#854d0e", fontWeight: 700 }}>Practice</span>}
              {limitReached && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f0fdf4", color: "#15803d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}><CheckCircle className="w-2 h-2" />Completed</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "grid", gridTemplateColumns: "1fr 190px", alignItems: "start", scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 #f1f5f9" }}>

          {/* Left — Summary + Sections list */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <SecLabel>Summary</SecLabel>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Total sections" value={sections.length || "—"} />
                  <Row label="Total questions" value={totalQ || "—"} />
                  {isGraded && <Row label="Total marks" value={totalMarks > 0 ? totalMarks : "—"} />}
                  <Row label="Attempts used" value={`${testSubmissions} / ${submissionAttempts}`} />
                </tbody>
              </table>
            </div>

            {sections.length > 0 && (
              <div>
                <SecLabel>Sections</SecLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sections.map((sec: any, i: number) => (
                    <div key={sec.id || sec.sectionId || i} style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.name || sec.sectionName}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {sec.exerciseType && (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, background: "#fff7ed", color: "#f97316", fontWeight: 700 }}>{sec.exerciseType}</span>
                        )}
                        {(sec.questionCount ?? 0) > 0 && (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", fontWeight: 700 }}>{sec.questionCount}Q</span>
                        )}
                        {isGraded && sec.marksPerQuestion && (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, background: "#fdf4ff", color: "#7c3aed", fontWeight: 700 }}>{sec.marksPerQuestion}m/q</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <SecLabel>Schedule</SecLabel>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Opens" value={<span style={{ fontSize: 11 }}>{exercise.availabilityPeriod?.startDate ? formatDateTime12(new Date(exercise.availabilityPeriod.startDate)) : "—"}</span>} />
                  <Row label="Closes" value={<span style={{ fontSize: 11 }}>{exercise.availabilityPeriod?.endDate ? formatDateTime12(new Date(exercise.availabilityPeriod.endDate)) : "—"}</span>} />
                  {exercise.availabilityPeriod?.gracePeriodAllowed && exercise.availabilityPeriod.gracePeriodDate && (
                    <Row label="Grace" value={<span style={{ fontSize: 11 }}>{formatDateTime12(new Date(exercise.availabilityPeriod.gracePeriodDate))}</span>} />
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <SecLabel>Details</SecLabel>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <Row label="Level" value={<span style={{ color: diff.color, textTransform: "capitalize" }}>{exercise.exerciseInformation.exerciseLevel}</span>} />
                  <Row label="Type" value="Section-Based" />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #f1f5f9", background: "#fafafa", borderRadius: "0 0 14px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", padding: "5px 10px", borderRadius: 6, marginBottom: 8, background: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}` }}>
            {statusConfig.text}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#64748b", border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}>Cancel</button>
            <button
              onClick={onConfirm}
              disabled={!canProceed}
              style={{ flex: 3, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", cursor: canProceed ? "pointer" : "not-allowed", opacity: canProceed ? 1 : 0.5, background: !canProceed ? "#94a3b8" : availability.status === "late-attempt" ? "#f97316" : "#7c3aed" }}
            >
              {limitReached
                ? <><CheckCircle className="w-3.5 h-3.5" />Completed</>
                : !availability.canStart
                ? <><Lock className="w-3.5 h-3.5" />{availability.status === "upcoming" ? "Not Yet Open" : "Expired"}</>
                : <><Play className="w-3.5 h-3.5" style={{ fill: "white" }} />{availability.status === "late-attempt" ? "Start Late Attempt" : "Begin Assessment"}</>
              }
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SectionBasedAssessments({
  courseId, exercises, onExerciseSelect,
  method, category, subcategory, studentAnswers,
}: SectionBasedAssessmentsProps) {
  const filterRef = useRef<HTMLDivElement>(null)
  const [popupExercise, setPopupExercise] = useState<SectionBasedExercise | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "error" | "warning" } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterLevel, setFilterLevel] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
const [activeTest, setActiveTest] = useState<SectionBasedExercise | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false)
    }
    if (showFilterDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showFilterDropdown])

  const showToast = (message: string, type: "error" | "warning" = "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Filter to only section-based exercises — show all that have an id and exerciseInformation
  const filteredExercises = useMemo(() => {
    let result = exercises
      .filter(ex => isSectionBasedExercise(ex) && !!ex._id && !!ex.exerciseInformation)

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(ex =>
        ex.exerciseInformation.exerciseName.toLowerCase().includes(q) ||
        ex.exerciseInformation.exerciseId.toLowerCase().includes(q)
      )
    }
    if (filterLevel !== "all") result = result.filter(ex => ex.exerciseInformation.exerciseLevel === filterLevel)
    if (filterStatus !== "all") {
      result = result.filter(ex => {
        const avail = getExerciseAvailability(ex)
        const sub = getSubmissionAttempts(ex)
        const done = getTestSubmissions(ex, studentAnswers, method)
        const completed = done >= 1
        const limited = done >= sub
        if (filterStatus === "completed") return completed
        if (filterStatus === "available") return avail.canStart && !completed
        if (filterStatus === "expired") return avail.status === "expired"
        if (filterStatus === "upcoming") return avail.status === "upcoming"
        return true
      })
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [exercises, searchQuery, filterLevel, filterStatus, studentAnswers, method])

  const handleStartClick = (exercise: SectionBasedExercise, e: React.MouseEvent) => {
    e.stopPropagation()
    const totalQ = getTotalSectionQuestions(exercise)
    if (totalQ === 0) {
      showToast("This assessment has no questions configured. Please contact your instructor.")
      return
    }
    const sub = getSubmissionAttempts(exercise)
    const done = getTestSubmissions(exercise, studentAnswers, method)
    if (done >= sub) return  // limit reached — button is disabled, belt-and-suspenders
    setPopupExercise(exercise)
  }

const handleConfirmStart = () => {
  if (!popupExercise) return
  setActiveTest(popupExercise)  // ✅ Set the test to render
  setPopupExercise(null)
}
if (activeTest) {
  return (
    <SectionBasedTestPage
      exercise={activeTest}
      courseId={courseId}
      category={category}
      subcategory={subcategory}
      onClose={() => setActiveTest(null)}
      onSubmit={(answers) => {
        // API call is handled inside SectionBasedTestPage; this fires after success.
        setActiveTest(null)
      }}
    />
  )
}
  // ── Empty state ────────────────────────────────────────────────────────────
  if (!filteredExercises.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[300px] rounded-xl bg-white border border-gray-200">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-purple-50 border border-purple-200">
          <LayoutList className="w-6 h-6 text-purple-500" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">No Section-Based Assessments</h3>
        <p className="text-sm text-gray-500 max-w-xs">Section-based assessments for this activity haven't been added yet.</p>
      </div>
    )
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999999, padding: "12px 20px", borderRadius: 12, background: toast.type === "error" ? "#fef2f2" : "#fffbeb", border: `1px solid ${toast.type === "error" ? "#fecaca" : "#fde68a"}`, color: toast.type === "error" ? "#b91c1c" : "#92400e", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          {toast.message}
        </div>
      )}

      {/* Popup portal */}
      {popupExercise && typeof document !== "undefined" && ReactDOM.createPortal(
        <SectionStartPopup
          exercise={popupExercise}
          onConfirm={handleConfirmStart}
          onClose={() => setPopupExercise(null)}
          availability={getExerciseAvailability(popupExercise)}
          testSubmissions={getTestSubmissions(popupExercise, studentAnswers, method)}
          submissionAttempts={getSubmissionAttempts(popupExercise)}
          limitReached={getTestSubmissions(popupExercise, studentAnswers, method) >= getSubmissionAttempts(popupExercise)}
        />,
        document.body
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold text-gray-900">
            Section-Based Assessments ({filteredExercises.length})
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
            You Do
          </span>
        </div>

        {/* Search + Filter bar — identical pattern to exercises.tsx */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assessments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X size={12} className="text-gray-500" />
              </button>
            )}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white flex items-center gap-2 text-sm font-medium hover:bg-gray-50"
            >
              <Filter size={14} />
              <span>Filter</span>
              {(filterLevel !== "all" || filterStatus !== "all") && (
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-2xs font-bold flex items-center justify-center">
                  {(filterLevel !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0)}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform ${showFilterDropdown ? "rotate-180" : ""}`} />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-50 p-4">
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Level</label>
                  <div className="flex flex-wrap gap-2">
                    {["all", "beginner", "intermediate", "advanced", "hard", "medium"].map(level => (
                      <button
                        key={level}
                        onClick={() => setFilterLevel(level)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${filterLevel === level ? "bg-purple-500 text-white border-purple-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                      >
                        {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {["all", "available", "completed", "expired", "upcoming"].map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${filterStatus === status ? "bg-purple-500 text-white border-purple-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {(filterLevel !== "all" || filterStatus !== "all") && (
                  <button onClick={() => { setFilterLevel("all"); setFilterStatus("all") }} className="w-full mt-4 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div
          className="exercises-scroll flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#94a3b8 #f1f5f9" }}
        >
          <style>{`
            .exercises-scroll::-webkit-scrollbar{width:6px}
            .exercises-scroll::-webkit-scrollbar-track{background:#f1f5f9;border-radius:3px}
            .exercises-scroll::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:3px}
            .exercises-scroll::-webkit-scrollbar-thumb:hover{background:#64748b}
          `}</style>

          {/* Column headers — same pattern + extra "Sections" column */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200 text-2xs font-semibold text-gray-600 sticky top-0 z-10">
            <div className="flex-[0.5] text-center">#</div>
            <div className="flex-[1.5] text-center">ID</div>
            <div className="flex-[2] text-left">Assessment Name</div>
            <div className="flex-[0.8] text-center">Level</div>
            <div className="flex-[0.7] text-center">Sections</div>
            <div className="flex-[1] text-center">Start Date</div>
            <div className="flex-[1] text-center">End Date</div>
            <div className="flex-[0.8] text-center">Status</div>
            <div className="flex-[0.8] text-center">Action</div>
          </div>

          <div className="space-y-1">
            {filteredExercises.map((exercise, index) => {
              const availability = getExerciseAvailability(exercise)
              const sub = getSubmissionAttempts(exercise)
              const done = getTestSubmissions(exercise, studentAnswers, method)
              const isCompleted = done >= 1
              const limitReached = done >= sub
              const canStart = availability.canStart && !limitReached
              const sectionCount = getSectionCount(exercise)
              const diff = getDifficultyStyle(exercise.exerciseInformation.exerciseLevel)

              return (
                <div
                  key={exercise._id}
                  className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* # */}
                  <div className="flex-[0.5] flex justify-center">
                    <div className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                  </div>

                  {/* ID */}
                  <span className="flex-[1.5] text-xs font-medium text-gray-500 text-center truncate">
                    {exercise.exerciseInformation.exerciseId}
                  </span>

                  {/* Name */}
                  <h4 className="flex-[2] font-medium text-sm text-gray-900 truncate text-left">
                    {exercise.exerciseInformation.exerciseName}
                  </h4>

                  {/* Level */}
                  <div className="flex-[0.8] flex justify-center">
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold border" style={{ background: diff.bg, color: diff.color, borderColor: diff.border }}>
                      {diff.label}
                    </span>
                  </div>

                  {/* Sections — the extra column */}
                  <div className="flex-[0.7] flex justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-purple-50 text-purple-600 border border-purple-200">
                      <LayoutList size={10} />
                      {sectionCount}
                    </span>
                  </div>

                  {/* Start Date */}
                  <div className="flex-[1] flex items-center justify-center gap-1 text-xs text-gray-500">
                    <Calendar size={11} />
                    <span className="truncate">
                      {exercise.availabilityPeriod?.startDate
                        ? formatDateTime12(new Date(exercise.availabilityPeriod.startDate))
                        : "N/A"}
                    </span>
                  </div>

                  {/* End Date */}
                  <div className="flex-[1] flex items-center justify-center gap-1 text-xs text-gray-500">
                    <Clock size={11} />
                    <span className="truncate">
                      {exercise.availabilityPeriod?.endDate
                        ? formatDateTime12(new Date(exercise.availabilityPeriod.endDate))
                        : "N/A"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex-[0.8] flex justify-center">
                    <span className={`px-2 py-0.5 rounded-full text-2xs font-medium border ${
                      isCompleted ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : availability.status === "expired"    ? "bg-red-50 text-red-600 border-red-200"
                      : availability.status === "late-attempt" ? "bg-orange-50 text-orange-700 border-orange-300"
                      : availability.status === "grace-period" ? "bg-orange-50 text-orange-600 border-orange-200"
                      : availability.status === "upcoming"  ? "bg-gray-100 text-gray-600 border-gray-200"
                      : "bg-purple-50 text-purple-600 border-purple-200"
                    }`}>
                      {isCompleted ? "Completed"
                      : availability.status === "expired"    ? "Expired"
                      : availability.status === "late-attempt" ? "Late"
                      : availability.status === "grace-period" ? "Grace"
                      : availability.status === "upcoming"  ? "Soon"
                      : "Ready"}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex-[0.8] flex justify-center">
                    <button
                      onClick={e => handleStartClick(exercise, e)}
                      disabled={!canStart}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        !canStart
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : availability.status === "late-attempt"
                            ? "bg-orange-500 text-white hover:bg-orange-600"
                            : "bg-purple-500 text-white hover:bg-purple-600"
                      }`}
                    >
                      {limitReached ? "View"
                      : !availability.canStart ? "Locked"
                      : availability.status === "late-attempt" ? "Late"
                      : "Start"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}