"use client"
import { getToken } from "@/lib/session";
import { useAttemptSession } from "../useAttemptSession";
import ConnectionStatusBanner from "../ConnectionStatusBanner";

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  Flag, AlertCircle,
  CheckCircle, LayoutList, Code2, HelpCircle, Send, X,
  ShieldCheck, Shield, Lock, AlertTriangle, Maximize2,
} from "lucide-react"

import CodeEditor from "./code-editor"
import TestMessageBell from "./TestMessageBell"
import DbQueryEditor from "./db-queryEditor"
import FrontendCompiler from "./frontendCompiler"
import ScreenShareGuard from "./ScreenShareGuard"
import MCQ from "./mcq"
import { useAssessmentSecurity, normalizeSecurityConfig } from "./useAssessmentSecurity"
import { useFaceProctor } from "./useFaceProctor"
import { toast } from "react-toastify"
import { useExamLiveEmitter } from "./useExamLiveEmitter"

// ─── EmbeddedMCQ ──────────────────────────────────────────────────────────────
// MCQ's root div is position:fixed / inset:0.  A CSS transform on a parent
// makes it the containing block for fixed descendants (CSS Transforms spec),
// so the MCQ stays inside this box instead of covering the whole viewport.
// overflow:hidden clips LoadingScreen / CompletionScreen's minHeight:100vh.
function EmbeddedMCQ(props: React.ComponentProps<typeof MCQ>) {
  return (
    <div style={{
      position: "relative",
      height: "100%",
      overflow: "hidden",
      transform: "translateZ(0)",   // traps position:fixed children
    }}>
      {/* embedded=true → MCQ skips its own per-question API saves;
          courseId is forwarded so it has it when needed               */}
      <MCQ {...props} embedded={true} />
    </div>
  )
}

// ─── EmbeddedProgComp ─────────────────────────────────────────────────────────
// CodeEditor / DbQueryEditor / FrontendCompiler use position:fixed when the
// user clicks their fullscreen toggle.  The CSS transform traps that fixed
// element inside this box so it never escapes the section test container.
// overflow:hidden prevents any 100vh internal elements from scrolling out.
function EmbeddedProgComp({ Comp, ...props }: { Comp: React.ComponentType<any>; [k: string]: any }) {
  return (
    <div style={{
      position: "relative",
      height: "100%",
      width: "100%",
      overflow: "hidden",
      transform: "translateZ(0)",   // traps position:fixed children
    }}>
      <Comp {...props} embedded={true} />
    </div>
  )
}

// ─── Raw section shape coming from the API ────────────────────────────────────
interface RawSection {
  id?: string
  sectionId?: string
  name?: string
  sectionName?: string
  order?: number
  sectionNumber?: number
  exerciseType?: "MCQ" | "Programming" | "Combined" | "Database" | "Frontend" | string
  totalMarks?: number
  totalDuration?: number
  duration?: number
  questionCount?: number
  marksPerQuestion?: number
  mcqConfig?: any
  programmingConfig?: any
  mcqSectionMarks?: number
  [key: string]: any
}

// ─── Normalised section used internally ───────────────────────────────────────
interface NormSection {
  key: string           // primary lookup key (name, or id if no name)
  name: string          // display name
  id: string            // raw id field (may equal name)
  order: number
  exerciseType: string  // "MCQ" | "Programming" | "Combined" | …
  totalMarks: number
  totalDuration: number
  raw: RawSection       // keep original for passing to child components
}

interface TestQuestion {
  _id: string
  questionType?: string  // "mcq" | "programming" | "database" | …
  sectionId?: string
  sequence?: number
  isActive?: boolean
  [key: string]: any
}

interface SectionBasedExercise {
  _id: string
  // API may provide either an array or Record<string, RawSection>
  sectionConfigs?: RawSection[] | Record<string, RawSection>
  // Legacy field name — some exercises use this instead
  sections?: RawSection[] | Record<string, RawSection>
  exerciseInformation: {
    exerciseId: string
    exerciseName: string
    totalDuration?: number
    totalMarks?: number
    selectedLanguages?: string[]
    selectedModule?: string
    [key: string]: any
  }
  questions?: TestQuestion[]
  programmingSettings?: {
    selectedLanguages?: string[]
    selectedModule?: string
    [key: string]: any
  }
  securitySettings?: {
    shuffleQuestions?: boolean
    [key: string]: any
  }
  [key: string]: any
}

interface SectionTestPageProps {
  exercise: SectionBasedExercise
  onClose: () => void
  onSubmit: (answers: Record<string, any>) => void
  courseId?: string | number
  nodeId?: string
  category?: string
  subcategory?: string
  /** When true: skip the security-agreement modal and start directly (the
   *  You-Do instructions page already showed the rules and engaged fullscreen). */
  skipSecurityModal?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rawToArray(value: RawSection[] | Record<string, RawSection> | undefined | null): RawSection[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "object") {
    // Preserve the Record key as `_recordKey` so normaliseSections can use it.
    // Questions store sectionId = Record key (e.g. "dsfdsf"), NOT the display name
    // (e.g. "Part A dsfdsf"), so we must not lose this key.
    return Object.entries(value).map(([key, sec]) => ({ ...sec, _recordKey: key }))
  }
  return []
}

function normaliseSections(raw: RawSection[]): NormSection[] {
  return raw
    .map((s): NormSection => {
      // _recordKey is the key used when sectionConfigs is a Record<string, …>.
      // Questions are saved with sectionId = this key, so it must become the
      // canonical lookup key even if the section also has a longer display name.
      const recordKey = (s as any)._recordKey as string | undefined
      const name = s.name || s.sectionName || recordKey || s.id || s.sectionId || ""
      const id   = s.id   || s.sectionId   || recordKey || name
      return {
        // key = recordKey first so the filter q.sectionId === sec.key always matches
        key:           recordKey || name || id,
        name:          name,
        id:            id,
        order:         s.order ?? s.sectionNumber ?? 0,
        exerciseType:  s.exerciseType || "",
        totalMarks:    s.totalMarks ?? 0,
        totalDuration: s.totalDuration ?? s.duration ?? 0,
        raw:           s,
      }
    })
    .sort((a, b) => a.order - b.order)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SectionBasedTestPage({
  exercise,
  onClose,
  onSubmit,
  courseId: propCourseId,
  nodeId = "",
  category = "Course",
  subcategory = "Assessment",
  skipSecurityModal = false,
}: SectionTestPageProps) {
  // Resolve courseId: explicit prop → field on the exercise object → ""
  const courseId = String(propCourseId ?? (exercise as any).courseId ?? "")

  // ── Live Dashboard emitter — joined on mount; submitted on final submit.
  // assessmentId = the section-based exercise _id (shared across all sections).
  const live = useExamLiveEmitter(
    exercise?._id ? String(exercise._id) : "",
    Array.isArray((exercise as any).questions) ? (exercise as any).questions.length : 0,
  )

  // Recovery & Resume — parent-owned attempt lifecycle for section-based
  // tests. Embedded children (MCQ / Programming / Frontend / SQL) all pass
  // embedded=true and skip their own useAttemptSession, deferring to this
  // parent's server timer + offline queue.
  const attemptSession = useAttemptSession({
    exerciseId: (exercise as any)?._id ? String((exercise as any)._id) : "",
    courseId: courseId || "",
    nodeId: nodeId || "",
    nodeType: (exercise as any)?.nodeType || "topics",
    subcategory: subcategory || "",
    category: "You_Do",
    totalQuestions: Array.isArray((exercise as any)?.questions) ? (exercise as any).questions.length : undefined,
    durationMinutesHint: (exercise as any)?.exerciseInformation?.totalDuration || (exercise as any)?.totalDuration || undefined,
    enabled: !!((exercise as any)?._id) && !!courseId,
  });

  // ── Normalise sections ─────────────────────────────────────────────────────
  const sections: NormSection[] = useMemo(() => {
    // rawToArray(undefined) returns [] which is truthy — use conditional, not ||
    const rawArr = exercise.sectionConfigs
      ? rawToArray(exercise.sectionConfigs)
      : rawToArray((exercise as any).sections)
    const normalised = normaliseSections(rawArr)

    // Per-section durations live ONLY in the `sections` array (SectionItem[]),
    // never in `sectionConfigs`. When sections were built from sectionConfigs
    // (no duration), merge the durations in by matching name / id / key.
    const durationArr = rawToArray((exercise as any).sections)
    if (durationArr.length > 0) {
      const durByKey = new Map<string, number>()
      for (const d of durationArr) {
        const dur = (d as any).totalDuration ?? (d as any).duration ?? 0
        if (dur > 0) {
          const nm = d.name || d.sectionName || (d as any)._recordKey || d.id || d.sectionId
          if (nm)   durByKey.set(String(nm), dur)
          if (d.id) durByKey.set(String(d.id), dur)
        }
      }
      for (const s of normalised) {
        if (s.totalDuration > 0) continue
        s.totalDuration = durByKey.get(s.name) ?? durByKey.get(s.id) ?? durByKey.get(s.key) ?? 0
      }
    }
    return normalised
  }, [exercise])

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  // Per-section answers: { sectionKey: { questionId: answer } }
  const [sectionAnswers, setSectionAnswers] = useState<Record<string, Record<string, any>>>({})
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  // For Combined sections, track which sub-tab is active per section key
  const [combinedSubTab, setCombinedSubTab] = useState<Record<string, "mcq" | "programming">>({})
  // Track which sections have been submitted
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())

  // ── Timer mode ──────────────────────────────────────────────────────────────
  // Mode A: per-section timers — driven by the exerciseInformation flag.
  // Mode B: single exercise-level totalDuration (or no timer).
  const hasSectionDurations = !!(exercise.exerciseInformation as any)?.sectionBasedDuration
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0)  // Mode A — current section seconds
  const [totalTimeLeft,   setTotalTimeLeft]   = useState(0)  // Mode B — whole exercise seconds

  // Stable refs so timer callbacks never read stale closure values.
  // Initialised with safe defaults; useEffects (declared after currentSectionKey
  // is in scope) keep them current.
  const activeSectionIndexRef = useRef(activeSectionIndex)
  const currentSectionKeyRef  = useRef("")
  const sectionsLenRef        = useRef(sections.length)

  // ── Security ───────────────────────────────────────────────────────────────
  const isYouDo = (category || '').replace(/_/g, ' ').toLowerCase().trim() === 'you do'
  const [securityAgreed, setSecurityAgreed] = useState(!isYouDo)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const securityConfig = useMemo(() => normalizeSecurityConfig(exercise.securitySettings || {}), [exercise.securitySettings])

  // Show the security modal on You-Do — unless the instructions page already
  // covered the rules (skipSecurityModal), in which case start directly.
  useEffect(() => {
    if (isYouDo && !securityAgreed) {
      if (skipSecurityModal) setSecurityAgreed(true)
      else setShowSecurityModal(true)
    }
  }, [isYouDo, skipSecurityModal])

  // Reason for an auto-submit (null = manual USER submit); read in handleFinalSubmit.
  const autoReasonRef = useRef<string | null>(null)

  useAssessmentSecurity({
    config: securityConfig,
    isActive: isYouDo && securityAgreed,
    // This page owns the countdown (per-section in Mode A, whole-exercise in
    // Mode B), so the hook only fires the timeout warning — never a second
    // submit on top of the one the timers below already do.
    externalSecondsLeft: hasSectionDurations ? sectionTimeLeft : totalTimeLeft,
    // The parent terminates, not the children: child components suppress their
    // own tab handling while embedded, so without this nothing enforced the
    // limit on a section test.
    onTabSwitchViolation: (count, max) => {
      toast.warning(`⚠️ Tab switch detected (${count}/${max}). Continued violations will auto-submit.`, { toastId: 'sec-tab-sw', autoClose: 4000 })
      if (count >= max) {
        toast.error('Maximum tab switches exceeded — submitting.', { toastId: 'sec-tab-term' })
        autoReasonRef.current = 'Tab switch limit reached'
        handleFinalSubmit()
      }
    },
    onTimeWarning: (secs) => {
      toast.warning(`⏰ Only ${secs} seconds remaining!`, { toastId: 'sec-time-warn', autoClose: 8000 })
    },
  })

  // ── Face proctoring (whole section test): warn, then auto-submit & close ──
  useFaceProctor({
    isActive: isYouDo && securityAgreed,
    multiFaceEnabled: !!(securityConfig as any).multipleFaceDetection,
    multiFaceLimit: (securityConfig as any).faceWarningLimit ?? 3,
    noFaceEnabled: !!(securityConfig as any).faceMonitoringDetection,
    noFaceLimit: (securityConfig as any).faceMonitoringWarningLimit ?? 3,
    intervalSeconds: 10,
    onWarning: ({ reason, count, limit }) => {
      toast.warning(`⚠️ ${reason} (${count}/${limit}). Continued violations will auto-submit.`, { toastId: `sec-face-${count}`, autoClose: 4000 })
    },
    onLimitReached: (reason) => {
      autoReasonRef.current = reason
      handleFinalSubmit()
    },
  })

  // ── Current section ────────────────────────────────────────────────────────
  const currentSection = sections[activeSectionIndex]
  const currentSectionKey = currentSection?.key ?? ""
  const sectionExerciseType = (currentSection?.exerciseType ?? "Programming").toLowerCase()
  const currentAnswers = sectionAnswers[currentSectionKey] ?? {}

  // Keep timer refs in sync (declared here so currentSectionKey is in scope)
  useEffect(() => { activeSectionIndexRef.current = activeSectionIndex }, [activeSectionIndex])
  useEffect(() => { currentSectionKeyRef.current  = currentSectionKey  }, [currentSectionKey])
  useEffect(() => { sectionsLenRef.current        = sections.length    }, [sections.length])

  // ── Pre-compute questions per section (for progress badges on tabs) ────────
  const allSectionQuestions = useMemo(() => {
    const map: Record<string, TestQuestion[]> = {}
    for (const sec of sections) {
      const type = (sec.exerciseType ?? "").toLowerCase()
      map[sec.key] = (exercise.questions ?? [])
        .filter(q => {
          if (q.isActive === false) return false
          // sectionId may match section name, id, OR the Record key
          if (q.sectionId) {
            return (
              q.sectionId === sec.name ||
              q.sectionId === sec.id   ||
              q.sectionId === sec.key
            )
          }
          // Fallback: assign by matching questionType to exerciseType (case-insensitive)
          const qType = (q.questionType ?? "").toLowerCase()
          if (type === "mcq")         return qType === "mcq"
          if (type === "programming") return qType === "programming"
          if (type === "combined")    return qType === "mcq" || qType === "programming"
          if (type === "database")    return qType === "database"
          if (type === "frontend")    return qType === "frontend"
          return false
        })
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    }
    return map
  }, [sections, exercise.questions])

  // Questions for the currently visible section
  const currentSectionQuestions = allSectionQuestions[currentSectionKey] ?? []

  // ── Answered count per section ────────────────────────────────────────────
  const getAnsweredCount = useCallback(
    (sectionKey: string) => {
      const answers = sectionAnswers[sectionKey] ?? {}
      return (allSectionQuestions[sectionKey] ?? []).filter(q => answers[q._id] !== undefined).length
    },
    [sectionAnswers, allSectionQuestions],
  )

  // ── Progress for current section ──────────────────────────────────────────
  const answeredCount  = getAnsweredCount(currentSectionKey)
  const totalForSection = currentSectionQuestions.length
  const sectionProgress = totalForSection > 0 ? Math.round((answeredCount / totalForSection) * 100) : 0

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((questionId: string, answer: any) => {
    setSectionAnswers(prev => ({
      ...prev,
      [currentSectionKey]: { ...(prev[currentSectionKey] ?? {}), [questionId]: answer },
    }))
  }, [currentSectionKey])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToSection = (idx: number) => {
    if (idx >= 0 && idx < sections.length) setActiveSectionIndex(idx)
  }

  // Called when a section is submitted (MCQ via onCloseExercise, others via button)
  const handleSectionComplete = useCallback(() => {
    // Exit browser-native fullscreen that a sub-component (e.g. code-editor)
    // may have requested, so it doesn't bleed into the next section.
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    setCompletedSections(prev => new Set([...prev, currentSectionKey]))
    const nextIdx = activeSectionIndex + 1
    if (nextIdx < sections.length) {
      setActiveSectionIndex(nextIdx)
    } else {
      // Last section — open the final submit confirmation
      setShowSubmitConfirm(true)
    }
  }, [currentSectionKey, activeSectionIndex, sections.length])

  // ── Final submit ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    const flatAnswers: Record<string, any> = {}
    for (const sec of sections) {
      Object.assign(flatAnswers, sectionAnswers[sec.key] ?? {})
    }

    const payload = {
      courseId,
      exerciseId:   exercise._id,
      exerciseName: exercise.exerciseInformation?.exerciseName,
      sections:     sectionAnswers,
      answers:      flatAnswers,
      nodeId,
      category,
      subcategory,
    }

    try {
      const token = getToken() || localStorage.getItem("token") || ""

      // Individual question answers are already saved by each sub-component
      // during the test.  We only need to fire the isTestSubmission flag so
      // that assessments.tsx correctly shows "Submitted" status.
      // Backend only accepts I_Do | We_Do | You_Do — map any other value to You_Do
      // since section-based assessments are always assessment-grade exercises.
      const validCategories = ["I_Do", "We_Do", "You_Do"]
      const safeCategory = validCategories.includes(category) ? category : "You_Do"

      const fd = new FormData()
      fd.append("courseId",         courseId)
      fd.append("exerciseId",       exercise._id)
      fd.append("questionId",       exercise._id)
      fd.append("code",             "")
      fd.append("score",            "0")
      fd.append("status",           "submitted")
      fd.append("category",         safeCategory)
      fd.append("subcategory",      subcategory || "Assessment")
      fd.append("nodeId",           nodeId || "")
      fd.append("nodeName",         exercise.exerciseInformation?.exerciseName || "Section Assessment")
      fd.append("nodeType",         "section")
      fd.append("language",         "text")
      fd.append("isTestSubmission", "true")
      const _secAuto = autoReasonRef.current
      fd.append("submitType",       _secAuto ? "AUTO" : "USER")
      fd.append("autoSubmitReason", _secAuto || "")

      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com')}/courses/answers/submit`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body:    fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Server error ${res.status}`)
      }

      // Recovery hook: mark attempt terminal so a reopen doesn't resume.
      try { await attemptSession.submit({ submitType: autoReasonRef.current ? "AUTO" : "USER" }); } catch {}
      live.submitted()
      onSubmit(payload)
      setShowSubmitConfirm(false)
    } catch (e: any) {
      setSubmitError(e?.message ?? "Submission failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Mode A: per-section countdown ─────────────────────────────────────────
  // Reset & start a fresh countdown whenever the active section changes.
  useEffect(() => {
    if (!hasSectionDurations) return
    const secs = (currentSection?.totalDuration ?? 0) * 60
    if (secs <= 0) return
    setSectionTimeLeft(secs)
    const iv = setInterval(() => setSectionTimeLeft(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(iv)
  }, [activeSectionIndex, hasSectionDurations]) // eslint-disable-line

  // When section timer reaches 0 → auto-advance to next section or auto-submit last.
  // Fire ONLY on a positive→0 transition so the initial 0 state never triggers it.
  const prevSectionTimeRef = useRef(sectionTimeLeft)
  useEffect(() => {
    const prev = prevSectionTimeRef.current
    prevSectionTimeRef.current = sectionTimeLeft
    if (!hasSectionDurations) return
    if (!(prev > 0 && sectionTimeLeft === 0)) return        // genuine countdown expiry only
    const idx  = activeSectionIndexRef.current
    const key  = currentSectionKeyRef.current
    const last = sectionsLenRef.current - 1
    setCompletedSections(prev => new Set([...prev, key]))
    if (idx < last) {
      setActiveSectionIndex(idx + 1)
    } else if (securityConfig.autoSubmitOnTimeout !== false) {
      // Last section expired — auto-submit without dialog
      handleFinalSubmit()
    }
  }, [sectionTimeLeft, hasSectionDurations]) // eslint-disable-line

  // ── Mode B: total exercise countdown ──────────────────────────────────────
  useEffect(() => {
    if (hasSectionDurations) return
    const secs = (exercise.exerciseInformation?.totalDuration ?? 0) * 60
    if (secs <= 0) return
    setTotalTimeLeft(secs)
    const iv = setInterval(() => setTotalTimeLeft(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(iv)
  }, [hasSectionDurations]) // eslint-disable-line

  // When total timer reaches 0 → auto-submit.
  // Fire ONLY on a positive→0 transition so the initial 0 state never triggers it.
  const prevTotalTimeRef = useRef(totalTimeLeft)
  useEffect(() => {
    const prev = prevTotalTimeRef.current
    prevTotalTimeRef.current = totalTimeLeft
    if (hasSectionDurations) return
    if (!(prev > 0 && totalTimeLeft === 0)) return          // genuine countdown expiry only
    if (securityConfig.autoSubmitOnTimeout === false) return
    handleFinalSubmit()
  }, [totalTimeLeft, hasSectionDurations]) // eslint-disable-line

  // ── Helpers for rendering ─────────────────────────────────────────────────
  const selectedLanguages: string[] =
    exercise.programmingSettings?.selectedLanguages ??
    exercise.exerciseInformation?.selectedLanguages ??
    ["Python"]

  const selectedModule: string =
    exercise.programmingSettings?.selectedModule ??
    exercise.exerciseInformation?.selectedModule ??
    ""

  // Build a section-specific exercise object for the MCQ component.
  // Always reads from mcqConfig regardless of section exerciseType
  // (MCQ sections use mcqConfig; Combined MCQ sub-tab also uses mcqConfig).
  const buildMcqExercise = (questions: TestQuestion[], sec: NormSection) => {
    const mcqCfg = sec.raw.mcqConfig || {}
    return {
      ...exercise,
      questions,
      // The embedded MCQ shows its OWN "Time Left" (QuestionPanel) — that is the
      // single visible countdown. Feed it the right duration:
      //   Mode A → this section's duration | Mode B → whole-exercise duration.
      exerciseInformation: {
        ...exercise.exerciseInformation,
        totalDuration: hasSectionDurations
          ? (sec.totalDuration || 0)
          : (exercise.exerciseInformation?.totalDuration || 0),
      },
      questionConfiguration: {
        mcqQuestionConfiguration: {
          totalMcqQuestions:   questions.length,
          generalQuestionCount: questions.length,
          marksPerQuestion:
            mcqCfg?.scoreSettings?.equalDistribution ??
            sec.raw.marksPerQuestion ??
            10,
          mcqTotalMarks:
            sec.raw.mcqSectionMarks ??
            sec.totalMarks ??
            0,
          attemptLimitEnabled: mcqCfg?.attemptLimitEnabled ?? false,
          submissionAttempts:  mcqCfg?.submissionAttempts  ?? 1,
          shuffleQuestions:    exercise.securitySettings?.shuffleQuestions ?? false,
        },
      },
    }
  }

  // Build a section-specific exercise object for programming components.
  // Reads from programmingConfig of the section.
  const buildProgrammingExercise = (questions: TestQuestion[], sec: NormSection) => {
    const pc = sec.raw.programmingConfig || {}
    const progSectionMarks = sec.raw.programmingSectionMarks ?? sec.totalMarks ?? 0
    const genCount: number  = pc.generalQuestionCount || questions.length
    const genMPQ: number    = pc.scoreSettings?.equalDistribution || (genCount > 0 ? Math.floor(progSectionMarks / genCount) : 0)
    // Build level scoring
    const lvlScoring  = pc.levelScoring  || {}
    const lvlCounts   = pc.levelBasedCounts    || { easy: 0, medium: 0, hard: 0 }
    const selCounts   = pc.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 }
    const cfgType     = pc.questionConfigType || 'general'
    const levelScoringConfiguration: any = {}
    const levelBasedMarks: any = {}
    ;(['easy', 'medium', 'hard'] as const).forEach(d => {
      const s     = lvlScoring[d] || {}
      const count = (cfgType === 'selectionLevel' ? selCounts[d] : lvlCounts[d]) || 0
      const mpq   = s.marksPerQuestion || 0
      levelScoringConfiguration[d] = { type: s.type || 'level_specific', marksPerQuestion: mpq, questionCount: count, totalMarks: mpq * count }
      levelBasedMarks[d] = mpq
    })
    return {
      ...exercise,
      questions,
      exerciseInformation: exercise.exerciseInformation,
      questionConfiguration: {
        programmingQuestionConfiguration: {
          questionConfigType:   cfgType,
          generalQuestionCount: genCount,
          generalMarksPerQuestion: genMPQ,
          levelBasedCounts:     lvlCounts,
          selectionLevelCounts: selCounts,
          questionFlow:         pc.questionFlow || 'freeFlow',
          attemptLimitEnabled:  pc.attemptLimitEnabled,
          submissionAttempts:   pc.submissionAttempts,
          scoreSettings: {
            ...(pc.scoreSettings || {}),
            levelScoringConfiguration,
            levelBasedMarks,
            evenMarks: genMPQ,
          },
        },
      },
    }
  }

  const pickProgrammingComponent = () => {
    const mod  = selectedModule.toLowerCase()
    const langs = selectedLanguages.map(l => l.toLowerCase())
    if (mod === "frontend" || langs.some(l => ["html","css","javascript","typescript","react","jsx","tsx"].includes(l)))
      return FrontendCompiler
    if (mod === "database" || langs.some(l => ["sql","mysql","postgresql","mongodb"].includes(l)))
      return DbQueryEditor
    return CodeEditor
  }

  // ── Memoised per-section exercise objects ──────────────────────────────────
  // CRITICAL: the parent re-renders every second (timer tick). Building these
  // inline would hand the embedded children a NEW object reference each tick,
  // re-triggering their init effect → re-shuffle / reset to Q1 every second
  // ("questions auto-changing"). Memoising on the stable section + questions
  // keeps the reference constant until the user actually switches section.
  const mcqExercise = useMemo(
    () => (currentSection ? buildMcqExercise(currentSectionQuestions, currentSection) : null),
    [currentSection, currentSectionQuestions], // eslint-disable-line
  )
  const progExercise = useMemo(
    () => (currentSection ? buildProgrammingExercise(currentSectionQuestions, currentSection) : null),
    [currentSection, currentSectionQuestions], // eslint-disable-line
  )
  const combinedMcqExercise = useMemo(() => {
    if (!currentSection) return null
    const mcqQs = currentSectionQuestions.filter(q => (q.questionType ?? "").toLowerCase() === "mcq")
    return buildMcqExercise(mcqQs, currentSection)
  }, [currentSection, currentSectionQuestions]) // eslint-disable-line
  const combinedProgExercise = useMemo(() => {
    if (!currentSection) return null
    const progQs = currentSectionQuestions.filter(q => (q.questionType ?? "").toLowerCase() === "programming")
    return buildProgrammingExercise(progQs, currentSection)
  }, [currentSection, currentSectionQuestions]) // eslint-disable-line
  const combinedCounts = useMemo(() => ({
    mcq:  currentSectionQuestions.filter(q => (q.questionType ?? "").toLowerCase() === "mcq").length,
    prog: currentSectionQuestions.filter(q => (q.questionType ?? "").toLowerCase() === "programming").length,
  }), [currentSectionQuestions])

  // ── Render section content ────────────────────────────────────────────────
  const renderSectionContent = () => {
    if (currentSectionQuestions.length === 0) {
      return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:8 }}>
          <HelpCircle size={32} style={{ color:"#cbd5e1" }} />
          <p style={{ fontSize:14, color:"#94a3b8", fontWeight:500 }}>No questions in this section yet.</p>
          <p style={{ fontSize:12, color:"#cbd5e1" }}>Please contact your instructor.</p>
        </div>
      )
    }

    const type = sectionExerciseType

    // Last question of a section → this button advances (saving first).
    // On the final section it submits the whole test instead.
    const isLastSection = activeSectionIndex >= sections.length - 1
    const crossLabel    = isLastSection ? "Submit Test" : "Next Section"

    // ── MCQ ────────────────────────────────────────────────────────────────
    if (type === "mcq") {
      return (
        <div style={{ height:"100%", overflow:"hidden" }}>
          <EmbeddedMCQ
            exercise={mcqExercise as any}
            courseId={courseId}
            nodeId={nodeId}
            category={category}
            subcategory={subcategory}
            onCrossNext={handleSectionComplete}
            crossNextLabel={crossLabel}
          />
        </div>
      )
    }

    // ── Programming ────────────────────────────────────────────────────────
    if (type === "programming") {
      const ProgComp = pickProgrammingComponent()
      return (
        <div style={{ height:"100%", overflow:"hidden" }}>
          <EmbeddedProgComp
            Comp={ProgComp}
            exercise={progExercise as any}
            courseId={courseId}
            category={category}
            subcategory={subcategory}
            nodeId={nodeId}
            onCrossNext={handleSectionComplete}
            crossNextLabel={crossLabel}
          />
        </div>
      )
    }

    // ── Combined ───────────────────────────────────────────────────────────
    if (type === "combined") {
      const ProgComp = pickProgrammingComponent()
      const activeSubTab = combinedSubTab[currentSectionKey] ?? "mcq"

      const tabStyle = (active: boolean, color: string) => ({
        padding: "10px 20px",
        fontWeight: 700 as const,
        fontSize: 13,
        border: "none",
        borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
        background: "transparent",
        color: active ? color : "#94a3b8",
        cursor: "pointer" as const,
        transition: "all 0.15s",
        display: "flex" as const,
        alignItems: "center" as const,
        gap: 6,
      })

      return (
        <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
          {/* Sub-tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid #e2e8f0", background:"#f8fafc", padding:"0 20px", flexShrink:0 }}>
            <button
              style={tabStyle(activeSubTab === "mcq", "#7c3aed")}
              onClick={() => setCombinedSubTab(prev => ({ ...prev, [currentSectionKey]: "mcq" }))}
            >
              <HelpCircle size={13} /> MCQ
              <span style={{ fontSize:11, padding:"1px 7px", borderRadius:10, background: activeSubTab === "mcq" ? "#ede9fe" : "#f1f5f9", color: activeSubTab === "mcq" ? "#7c3aed" : "#64748b" }}>
                {combinedCounts.mcq}
              </span>
            </button>
            <button
              style={tabStyle(activeSubTab === "programming", "#16a34a")}
              onClick={() => setCombinedSubTab(prev => ({ ...prev, [currentSectionKey]: "programming" }))}
            >
              <Code2 size={13} /> Programming
              <span style={{ fontSize:11, padding:"1px 7px", borderRadius:10, background: activeSubTab === "programming" ? "#dcfce7" : "#f1f5f9", color: activeSubTab === "programming" ? "#16a34a" : "#64748b" }}>
                {combinedCounts.prog}
              </span>
            </button>
          </div>

          {/* Sub-tab content */}
          <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
            {activeSubTab === "mcq" ? (
              combinedCounts.mcq > 0 ? (
                <EmbeddedMCQ exercise={combinedMcqExercise as any} courseId={courseId} nodeId={nodeId} category={category} subcategory={subcategory} onCrossNext={() => setCombinedSubTab(prev => ({ ...prev, [currentSectionKey]: "programming" }))} />
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
                  <p style={{ fontSize:14, color:"#94a3b8" }}>No MCQ questions in this section.</p>
                </div>
              )
            ) : (
              combinedCounts.prog > 0 ? (
                <EmbeddedProgComp
                  Comp={ProgComp}
                  exercise={combinedProgExercise as any}
                  courseId={courseId}
                  category={category}
                  subcategory={subcategory}
                  nodeId={nodeId}
                  onCrossPrev={() => setCombinedSubTab(prev => ({ ...prev, [currentSectionKey]: "mcq" }))}
                  onCrossNext={handleSectionComplete}
                  crossNextLabel={isLastSection ? "Submit Test" : "Next Section"}
                />
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
                  <p style={{ fontSize:14, color:"#94a3b8" }}>No programming questions in this section.</p>
                </div>
              )
            )}
          </div>

        </div>
      )
    }

    // ── Database ───────────────────────────────────────────────────────────
    if (type === "database") {
      return (
        <div style={{ height:"100%", overflow:"hidden" }}>
          <EmbeddedProgComp
            Comp={DbQueryEditor}
            exercise={progExercise as any}
            courseId={courseId}
            category={category}
            subcategory={subcategory}
            nodeId={nodeId}
            onCrossNext={handleSectionComplete}
            crossNextLabel={crossLabel}
          />
        </div>
      )
    }

    // ── Frontend ───────────────────────────────────────────────────────────
    if (type === "frontend") {
      return (
        <div style={{ height:"100%", overflow:"hidden" }}>
          <EmbeddedProgComp
            Comp={FrontendCompiler}
            exercise={progExercise as any}
            courseId={courseId}
            category={category}
            subcategory={subcategory}
            nodeId={nodeId}
            onCrossNext={handleSectionComplete}
            crossNextLabel={crossLabel}
          />
        </div>
      )
    }

    // ── Fallback: CodeEditor ───────────────────────────────────────────────
    return (
      <div style={{ height:"100%", overflow:"hidden" }}>
        <EmbeddedProgComp
          Comp={CodeEditor}
          exercise={progExercise as any}
          courseId={courseId}
          category={category}
          subcategory={subcategory}
          nodeId={nodeId}
          onCrossNext={handleSectionComplete}
          crossNextLabel={crossLabel}
        />
      </div>
    )
  }

  // ── No sections ────────────────────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"calc(100vh * var(--ui-scale-inv, 1))", flexDirection:"column", gap:12 }}>
        <AlertCircle size={40} style={{ color:"#94a3b8" }} />
        <p style={{ fontSize:15, color:"#64748b", fontWeight:500 }}>No sections configured for this exercise.</p>
        <button
          onClick={onClose}
          style={{ padding:"8px 20px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, color:"#64748b" }}
        >
          Close
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (showSecurityModal) {
    const secItems = [
      { label: `Timed: ${securityConfig.sessionTimeoutMinutes} min`, active: !!securityConfig.sessionTimeoutMinutes },
      { label: 'Fullscreen Required',              active: !!securityConfig.requireFullscreen },
      { label: `Tab Switch Restricted (max ${securityConfig.maxTabSwitches ?? 3})`, active: !!securityConfig.preventTabSwitch },
      { label: 'Copy / Paste Disabled',            active: !!securityConfig.preventCopyPaste },
      { label: 'Right-click Disabled',             active: !!securityConfig.preventRightClick },
      { label: 'Dev Tools Blocked',                active: !!securityConfig.preventDevTools },
      { label: 'Refresh Blocked',                  active: !!securityConfig.preventRefresh },
      { label: 'Browser Close Warning',            active: !!securityConfig.preventBrowserClose },
    ].filter(i => i.active)
    return (
      <div style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
        <div style={{ background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',width:'100%',maxWidth:460,padding:26,fontFamily:"'Poppins',sans-serif" }}>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:18 }}>
            <div style={{ width:40,height:40,borderRadius:10,background:'#fff7ed',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <ShieldCheck size={20} style={{ color:'#f97316' }} />
            </div>
            <div>
              <div style={{ fontSize:17,fontWeight:800,color:'#111827' }}>Section Assessment Security</div>
              <div style={{ fontSize:12,color:'#6b7280',marginTop:1 }}>Review restrictions before starting</div>
            </div>
          </div>
          {secItems.length > 0 ? (
            <div style={{ background:'#f9fafb',borderRadius:10,padding:14,marginBottom:16 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8 }}>Active Restrictions</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 10px' }}>
                {secItems.map((it,i) => (
                  <div key={i} style={{ fontSize:12,color:'#374151',fontWeight:500 }}>• {it.label}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background:'#f0fdf4',borderRadius:10,padding:14,marginBottom:16,fontSize:13,color:'#16a34a',fontWeight:500 }}>
              No special security restrictions.
            </div>
          )}
          <div style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:10,marginBottom:18,fontSize:12,color:'#92400e' }}>
            By clicking "Start" you agree to all security restrictions. Violations may result in automatic submission.
          </div>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={() => { setShowSecurityModal(false); onClose(); }}
              style={{ flex:1,padding:'10px 16px',borderRadius:8,border:'1.5px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { setShowSecurityModal(false); setSecurityAgreed(true); }}
              style={{ flex:2,padding:'10px 16px',borderRadius:8,border:'none',background:'#f97316',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
              <ShieldCheck size={14} /> Start Assessment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      background: "#fff",
      fontFamily: "var(--lms-font, 'Poppins', sans-serif)",
    }}>
      {/* Recovery banner — always shown at parent level (children are embedded). */}
      <ConnectionStatusBanner netStatus={attemptSession.netStatus} queueCount={attemptSession.queueCount} />

      {/* ── Live Screen Monitoring — parent owns sharing for all sections ──
           Only active when proctoring screen recording is ON: live monitoring shares the
           same getDisplayMedia stream, so if recording is OFF we must NOT prompt for it. */}
      <ScreenShareGuard
        assessmentId={exercise?._id ? String(exercise._id) : ""}
        active={isYouDo && securityAgreed && !!securityConfig.screenRecordingEnabled}
        courseId={courseId}
        waitForSharedStream={!!securityConfig.screenRecordingEnabled}
      />

      {/* Proctor → student messaging is now a header bell (see COMPACT HEADER). */}

      {/* ── COMPACT HEADER ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 14px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
        flexShrink: 0,
        gap: 10,
        minHeight: 48,
      }}>

        {/* Left: icon + title stack */}
        <div style={{ display:"flex", alignItems:"center", gap:7, minWidth:0, flex:"0 1 auto" }}>
          <LayoutList size={15} style={{ color:"#7c3aed", flexShrink:0 }} />
          <div style={{ minWidth:0 }}>
            <div style={{
              fontSize:13, fontWeight:700, color:"#0f172a",
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              maxWidth: 260,
            }}>
              {exercise.exerciseInformation.exerciseName}
            </div>
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:1, whiteSpace:"nowrap" }}>
              {exercise.exerciseInformation.exerciseId}
              {" · "}
              {sections.length} section{sections.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Centre: section select — disabled in Mode A (per-section timers) */}
        <div style={{ display:"flex", alignItems:"center", gap:5, flex:"0 0 auto" }}>
          <span style={{ fontSize:10, fontWeight:600, color:"#64748b", whiteSpace:"nowrap" }}>
            Section:
          </span>
          <select
            value={activeSectionIndex}
            onChange={e => goToSection(Number(e.target.value))}
            disabled={hasSectionDurations}
            style={{
              fontSize: 12, fontWeight: 600,
              color: hasSectionDurations ? "#94a3b8" : "#0f172a",
              padding: "4px 6px",
              borderRadius: 6,
              border: `1px solid ${hasSectionDurations ? "#e2e8f0" : "#c4b5fd"}`,
              background: hasSectionDurations ? "#f8fafc" : "#f5f3ff",
              cursor: hasSectionDurations ? "not-allowed" : "pointer",
              maxWidth: 200,
              outline: "none",
              opacity: hasSectionDurations ? 0.7 : 1,
            }}
          >
            {sections.map((sec, idx) => {
              const answered  = getAnsweredCount(sec.key)
              const total     = (allSectionQuestions[sec.key] ?? []).length
              const typeTag   = sec.exerciseType ? ` [${sec.exerciseType}]` : ""
              const progTag   = total > 0 ? ` · ${answered}/${total}` : ""
              const doneTag   = completedSections.has(sec.key) ? " ✓" : ""
              return (
                <option key={sec.key} value={idx}>
                  {idx + 1}. {sec.name || `Section ${idx + 1}`}{typeTag}{progTag}{doneTag}
                </option>
              )
            })}
          </select>
        </div>

        {/* Right: progress pill + timer + next-section + submit + exit */}
        <div style={{ display:"flex", alignItems:"center", gap:5, flex:"0 0 auto" }}>

          {/* Proctor message notification (ephemeral, test-only) */}
          <TestMessageBell assessmentId={exercise?._id ? String(exercise._id) : ""} />

          {/* answered / total pill */}
          {totalForSection > 0 && (
            <span style={{
              fontSize:10, fontWeight:700,
              padding:"2px 6px", borderRadius:10,
              background: answeredCount === totalForSection ? "#dcfce7" : "#f1f5f9",
              color:       answeredCount === totalForSection ? "#16a34a" : "#64748b",
              border:      `1px solid ${answeredCount === totalForSection ? "#bbf7d0" : "#e2e8f0"}`,
              whiteSpace: "nowrap",
            }}>
              {answeredCount}/{totalForSection}
            </span>
          )}

          {/* (Timer intentionally NOT shown here — the existing "Time Left"
              inside the question panel is the single visible countdown. The parent
              still tracks time below for auto-advance / auto-submit.)
              Next Section now lives beside "Submit Question" inside each section's
              last question; in Mode B the dropdown above also allows free switching. */}

          {/* Submit Test — opens the "are you done?" confirm dialog */}
          <button
            onClick={() => setShowSubmitConfirm(true)}
            style={{
              display:"flex", alignItems:"center", gap:3,
              padding:"3px 8px", borderRadius:6,
              border:"none", background:"#16a34a", color:"#fff",
              cursor:"pointer", fontSize:11, fontWeight:600,
              whiteSpace:"nowrap",
            }}
          >
            <Send size={10} /> Submit Test
          </button>

          {/* Exit — also confirms; Yes submits & closes, No stays */}
          <button
            onClick={() => setShowSubmitConfirm(true)}
            style={{
              display:"flex", alignItems:"center", gap:3,
              padding:"3px 7px", borderRadius:6,
              border:"1px solid #e2e8f0", background:"#fff",
              cursor:"pointer", fontSize:11, fontWeight:600, color:"#64748b",
            }}
          >
            <X size={10} /> Exit
          </button>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{ height:3, background:"#e2e8f0", flexShrink:0 }}>
        <div style={{
          height:"100%", background:"#7c3aed",
          width:`${sectionProgress}%`,
          transition:"width 0.3s ease",
          borderRadius:"0 2px 2px 0",
        }} />
      </div>

      {/* ── SECTION CONTENT (max space) ── */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {renderSectionContent()}
      </div>

      {/* ── SUBMIT CONFIRMATION MODAL ── */}
      {showSubmitConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)",
        }}>
          <div style={{
            background: "#fff", borderRadius:12, padding:"24px 28px",
            maxWidth:440, width:"90%",
            boxShadow:"0 20px 50px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"#fef9c3", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <AlertCircle size={18} style={{ color:"#a16207" }} />
              </div>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#0f172a", margin:0 }}>Are you done with the assessment?</h3>
            </div>

            <p style={{ fontSize:13, color:"#475569", marginBottom:14, lineHeight:1.6 }}>
              Selecting <strong>Yes</strong> will submit your assessment and close it — you cannot change your answers afterwards.
            </p>

            {/* Per-section summary */}
            <div style={{ marginBottom:18, display:"flex", flexDirection:"column", gap:6 }}>
              {sections.map(sec => {
                const answered = getAnsweredCount(sec.key)
                const total    = (allSectionQuestions[sec.key] ?? []).length
                const done     = total > 0 && answered === total
                return (
                  <div key={sec.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {done
                        ? <CheckCircle size={14} style={{ color:"#16a34a" }} />
                        : <Flag size={14} style={{ color:"#f59e0b" }} />
                      }
                      <span style={{ fontSize:13, fontWeight:600, color: done ? "#15803d" : "#0f172a" }}>
                        {sec.name}
                      </span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color: done ? "#16a34a" : "#f59e0b" }}>
                      {answered}/{total} answered
                    </span>
                  </div>
                )
              })}
            </div>

            {submitError && (
              <div style={{ marginBottom:12, padding:"8px 12px", borderRadius:8, background:"#fef2f2", border:"1px solid #fecaca", fontSize:12, color:"#b91c1c", fontWeight:600 }}>
                {submitError}
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={() => { setShowSubmitConfirm(false); setSubmitError(null) }}
                disabled={isSubmitting}
                style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", cursor: isSubmitting ? "not-allowed" : "pointer", fontSize:13, fontWeight:600, color:"#64748b", opacity: isSubmitting ? 0.6 : 1 }}
              >
                No
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background: isSubmitting ? "#86efac" : "#16a34a", color:"#fff", cursor: isSubmitting ? "not-allowed" : "pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
              >
                {isSubmitting
                  ? <><span style={{ width:13, height:13, border:"2px solid #fff", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin .6s linear infinite" }} /> Submitting…</>
                  : <><Send size={13} /> Yes, Submit</>
                }
              </button>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          </div>
        </div>
      )}
    </div>
  )
}
