// Mark-allocation resolution for the student pre-start pages.
//
// Teachers can score an exercise in several different ways (ExerciseSettings >
// Question Configuration + Grade Settings), and the resulting document stores
// each of them in a different shape:
//
//   questionConfigType   general | levelBased | selectionLevel
//   scoreType            evenMarks     — one mark applies to every question
//                        levelBasedMarks — a mark per difficulty band
//                        separateMarks   — an explicit mark per question
//
// Students only ever see the summary, so this module flattens all of those
// shapes into one table of rows ({label, count, perQuestion, total}) plus the
// pass criteria, and every caller renders that instead of re-deriving the maths.
//
// Everything here is pure and defensive: the raw exercise document is `any`
// (the schema is `strict: false` in several places) and any field may be
// missing on older records.
 
export type MarkRow = {
  /** Stable key — 'easy' | 'medium' | 'hard' | 'general' | 'mcq' | 'others' */
  key: string
  label: string
  /** Number of questions in this band. */
  count: number
  /** Marks awarded per question, or null when they differ question to question. */
  perQuestion: number | null
  /** Marks contributed by this band. */
  total: number
  /** Explicit per-question marks, present only for the "separate marks" mode. */
  perQuestionMarks?: number[]
}
 
export type SectionRow = {
  name: string
  exerciseType: string
  questions: number
  marks: number
  duration: number
}
 
export type MarkPlan = {
  isGraded: boolean
  /** How the teacher split the paper. */
  allocation: 'general' | 'level' | 'section' | 'none'
  /** Human label for the scoring rule, e.g. "Equal marks per question". */
  scoreLabel: string
  /** One-line explanation of the rule, shown under the table. */
  scoreNote: string
  rows: MarkRow[]
  sections: SectionRow[]
  totalQuestions: number
  totalMarks: number
  /** Marks needed to pass, when the teacher set one. */
  passMark: number | null
  passPercent: number | null
  /** Per-difficulty pass marks (Grade Settings > difficulty-based pass). */
  levelPassMarks: { easy: number | null; medium: number | null; hard: number | null } | null
  /** MCQ / Programming pass marks kept apart (Grade Settings > separate marks). */
  separatePass: { mcq: number | null; programming: number | null } | null
  gradeBands: { label: string; fromPercent: number; toPercent: number }[]
  /** Marks-per-question when a single value covers the whole paper. */
  uniformPerQuestion: number | null
}
 
type Level = 'easy' | 'medium' | 'hard'
const LEVELS: Level[] = ['easy', 'medium', 'hard']
const LEVEL_LABEL: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
 
const num = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: any): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const sum = (list: any[]): number => list.reduce((s: number, v: any) => s + num(v), 0)
 
/** Question counts for one question-configuration block, keyed by level. */
function countsFor(cfg: any): { general: number; levels: Record<Level, number> } {
  const type = cfg?.questionConfigType || 'general'
  const bucket = type === 'selectionLevel' ? cfg?.selectionLevelCounts : cfg?.levelBasedCounts
  const levels: Record<Level, number> = {
    easy: num(bucket?.easy),
    medium: num(bucket?.medium),
    hard: num(bucket?.hard),
  }
  return { general: num(cfg?.generalQuestionCount), levels }
}
 
/**
 * Rows for one programming-shaped configuration block (Programming or Others —
 * both use `scoreSettings` with the same three scoring modes).
 */
function rowsForConfig(cfg: any, questions: any[], keyPrefix = '', generalLabel = 'All questions'): MarkRow[] {
  if (!cfg) return []
  const ss = cfg.scoreSettings || {}
  const scoreType = ss.scoreType || (ss.evenMarks ? 'evenMarks' : '')
  const isLevel = cfg.questionConfigType === 'levelBased' || cfg.questionConfigType === 'selectionLevel'
  const { general, levels } = countsFor(cfg)
 
  // Served questions win over configured counts — once questions are attached
  // the real paper is what the student will actually sit.
  const servedByLevel = (l: Level) =>
    questions.filter((q: any) => String(q?.difficulty || '').toLowerCase() === l).length
 
  if (isLevel) {
    const rows: MarkRow[] = []
    for (const l of LEVELS) {
      const count = servedByLevel(l) || levels[l]
      if (count <= 0) continue
 
      if (scoreType === 'separateMarks') {
        const marks: number[] = (ss.separateMarks?.levelBased?.[l] || []).map(num)
        const uniform = marks.length > 0 && marks.every((m) => m === marks[0])
        rows.push({
          key: keyPrefix + l,
          label: LEVEL_LABEL[l],
          count,
          perQuestion: uniform ? marks[0] : null,
          total: sum(marks),
          perQuestionMarks: marks,
        })
        continue
      }
 
      // evenMarks / levelBasedMarks both resolve to a per-question figure —
      // levelScoringConfiguration is the newer, richer source and wins.
      const lsc = ss.levelScoringConfiguration?.[l]
      const perQuestion =
        scoreType === 'evenMarks'
          ? numOrNull(ss.evenMarks)
          : numOrNull(lsc?.marksPerQuestion) ?? numOrNull(ss.levelBasedMarks?.[l])
      const explicitTotal = lsc?.type === 'question_specific' ? numOrNull(lsc?.totalMarks) : null
      const total = explicitTotal ?? (perQuestion != null ? perQuestion * count : num(lsc?.totalMarks))
      rows.push({
        key: keyPrefix + l,
        label: LEVEL_LABEL[l],
        count,
        perQuestion: explicitTotal != null ? null : perQuestion,
        total,
      })
    }
    return rows
  }
 
  // ── General (no difficulty split) ──
  const count = questions.length || general
  if (count <= 0) return []
 
  if (scoreType === 'separateMarks') {
    const marks: number[] = (ss.separateMarks?.general || []).map(num)
    const uniform = marks.length > 0 && marks.every((m) => m === marks[0])
    return [{
      key: keyPrefix + 'general',
      label: generalLabel,
      count,
      perQuestion: uniform ? marks[0] : null,
      total: sum(marks),
      perQuestionMarks: marks,
    }]
  }
 
  const perQuestion =
    numOrNull(ss.evenMarks) ??
    numOrNull(ss.equalDistribution) ??
    numOrNull(cfg.generalMarksPerQuestion)
  return [{
    key: keyPrefix + 'general',
    label: generalLabel,
    count,
    perQuestion,
    total: perQuestion != null ? perQuestion * count : num(ss.totalMarks),
  }]
}
 
/** Rows for the MCQ block, which stores its marks in its own flat shape. */
function rowsForMcq(mc: any, questions: any[]): MarkRow[] {
  if (!mc) return []
  const served = questions.filter((q: any) => String(q?.questionType || '').toLowerCase() === 'mcq')
  const count = served.length || num(mc.totalMcqQuestions)
  if (count <= 0) return []
  const perQuestion = numOrNull(mc.marksPerQuestion)
  const total =
    num(mc.mcqTotalMarks) ||
    (perQuestion != null ? perQuestion * count : 0) ||
    sum(served.map((q: any) => q?.mcqQuestionScore ?? q?.score ?? 0))
  return [{
    key: 'mcq',
    label: 'Multiple choice',
    count,
    perQuestion: mc.scoringType === 'questionSpecific' ? null : perQuestion,
    total,
  }]
}
 
/** Part A / Part B … rows for section-based papers. */
function sectionRows(exercise: any): SectionRow[] {
  const raw = exercise?.sections || exercise?.sectionConfigs
  const list: any[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.entries(raw).map(([key, sec]: [string, any]) => ({ ...(sec as object), name: (sec as any)?.name || key }))
      : []
  const questions: any[] = Array.isArray(exercise?.questions) ? exercise.questions : []
  return list
    .map((s: any) => {
      const name = s?.name || s?.sectionName || s?.id || ''
      const mcqCount = num(s?.mcqConfig?.generalQuestionCount)
      const progCounts = countsFor(s?.programmingConfig)
      const configured =
        mcqCount + progCounts.general + progCounts.levels.easy + progCounts.levels.medium + progCounts.levels.hard
      const served = questions.filter((q: any) => {
        const sid = q?.sectionId != null ? String(q.sectionId) : ''
        return sid && (sid === name || sid === s?.id)
      }).length
      return {
        name,
        exerciseType: s?.exerciseType || '',
        questions: served || configured,
        marks: num(s?.totalMarks) || num(s?.mcqSectionMarks) + num(s?.programmingSectionMarks),
        duration: num(s?.totalDuration ?? s?.duration),
      }
    })
    .filter((s) => s.name)
    .sort((a, b) => a.name.localeCompare(b.name))
}
 
function scoreCopy(scoreType: string, allocation: MarkPlan['allocation']): { label: string; note: string } {
  if (allocation === 'section') {
    return {
      label: 'Section-wise marks',
      note: 'Each section carries its own marks; your final score is the sum of every section.',
    }
  }
  switch (scoreType) {
    case 'levelBasedMarks':
      return {
        label: 'Level-based marks',
        note: 'Marks depend on question difficulty — harder questions are worth more.',
      }
    case 'separateMarks':
      return {
        label: 'Per-question marks',
        note: 'Each question carries its own mark, shown beside the question while you work.',
      }
    case 'evenMarks':
    case 'equalDistribution':
      return {
        label: 'Equal marks per question',
        note: 'Every question is worth the same number of marks.',
      }
    default:
      return {
        label: allocation === 'level' ? 'Level-based marks' : 'Standard marks',
        note: 'Marks for each question are shown beside it while you work.',
      }
  }
}
 
/**
 * Flatten an exercise document into the mark table + pass criteria the student
 * pre-start page renders. Safe to call with a partially-loaded exercise.
 */
export function resolveMarkPlan(exercise: any): MarkPlan {
  const info = exercise?.exerciseInformation || {}
  const qc = exercise?.questionConfiguration || {}
  const grade = exercise?.gradeSettings || {}
  const questions: any[] = Array.isArray(exercise?.questions) ? exercise.questions : []
  const isGraded = exercise?.isGraded !== false
 
  const progCfg = qc.programmingQuestionConfiguration
  const othersCfg = qc.othersQuestionConfiguration
  const mcqCfg = qc.mcqQuestionConfiguration
 
  // Split the served questions so each config block only counts its own.
  const mcqQuestions = questions.filter((q: any) => String(q?.questionType || '').toLowerCase() === 'mcq')
  const codeQuestions = questions.filter((q: any) => String(q?.questionType || '').toLowerCase() !== 'mcq')
 
  const sections = sectionRows(exercise)
  // With more than one block in play, "All questions" is ambiguous — name each
  // block instead so a combined paper reads MCQ / Programming / Other.
  const mcqRows = rowsForMcq(mcqCfg, mcqQuestions)
  const mixed = mcqRows.length > 0 || (!!progCfg && !!othersCfg)
  const rows: MarkRow[] = [
    ...mcqRows,
    ...rowsForConfig(progCfg, codeQuestions, '', mixed ? 'Programming' : 'All questions'),
    ...rowsForConfig(othersCfg, progCfg ? [] : codeQuestions, 'other-', mixed ? 'Other questions' : 'All questions'),
  ]
 
  // Last resort: no usable configuration, but the served questions carry their
  // own scores — group them by difficulty so the student still sees a table.
  if (rows.length === 0 && questions.length > 0) {
    const byLevel = LEVELS.map((l) => {
      const qs = questions.filter((q: any) => String(q?.difficulty || '').toLowerCase() === l)
      const marks = qs.map((q: any) => num(q?.score ?? q?.points))
      const uniform = marks.length > 0 && marks.every((m) => m === marks[0])
      return { key: l, label: LEVEL_LABEL[l], count: qs.length, perQuestion: uniform ? marks[0] : null, total: sum(marks) }
    }).filter((r) => r.count > 0)
    if (byLevel.length > 0) rows.push(...byLevel)
    else {
      const marks = questions.map((q: any) => num(q?.score ?? q?.points))
      const uniform = marks.length > 0 && marks.every((m) => m === marks[0])
      rows.push({
        key: 'general', label: 'All questions', count: questions.length,
        perQuestion: uniform ? marks[0] : null, total: sum(marks),
      })
    }
  }
 
  const scoreType =
    progCfg?.scoreSettings?.scoreType ||
    othersCfg?.scoreSettings?.scoreType ||
    (mcqCfg?.scoringType === 'questionSpecific' ? 'separateMarks' : mcqCfg ? 'evenMarks' : '')
 
  const allocation: MarkPlan['allocation'] =
    sections.length > 0 ? 'section'
      : rows.some((r) => r.key === 'easy' || r.key === 'medium' || r.key === 'hard') ? 'level'
        : rows.length > 0 ? 'general'
          : 'none'
 
  const totalQuestions =
    questions.length ||
    rows.reduce((s, r) => s + r.count, 0) ||
    num(info.totalQuestions)
 
  const totalMarks =
    num(info.totalMarks) ||
    num(info.totalMarksProgramming) + num(info.totalMarksMCQ) ||
    num(progCfg?.scoreSettings?.totalMarks) ||
    num(othersCfg?.scoreSettings?.totalMarks) ||
    sections.reduce((s, x) => s + x.marks, 0) ||
    rows.reduce((s, r) => s + r.total, 0)
 
  const passMark = grade.overallMarkToPassEnabled
    ? numOrNull(grade.overallMarkToPass)
    : numOrNull(grade.combinedGradeToPass) ??
      numOrNull(grade.programmingGradeToPass) ??
      numOrNull(grade.mcqGradeToPass)
 
  const passPercent = passMark != null && totalMarks > 0 ? Math.round((passMark / totalMarks) * 100) : null
 
  const levelPassMarks = grade.difficultyPassEnabled
    ? {
        easy: numOrNull(grade.easyPassMark),
        medium: numOrNull(grade.mediumPassMark),
        hard: numOrNull(grade.hardPassMark),
      }
    : null
 
  const separatePass = grade.separateMarks
    ? { mcq: numOrNull(grade.mcqGradeToPass), programming: numOrNull(grade.programmingGradeToPass) }
    : null
 
  const gradeBands = Array.isArray(grade.gradeBands)
    ? grade.gradeBands
        .filter((b: any) => b && (b.label || b.toPercent))
        .map((b: any) => ({ label: b.label || '', fromPercent: num(b.fromPercent), toPercent: num(b.toPercent) }))
        .sort((a: any, b: any) => b.fromPercent - a.fromPercent)
    : []
 
  const uniformPerQuestion =
    rows.length > 0 && rows.every((r) => r.perQuestion != null && r.perQuestion === rows[0].perQuestion)
      ? rows[0].perQuestion
      : null
 
  const copy = scoreCopy(scoreType, allocation)
 
  return {
    isGraded,
    allocation,
    scoreLabel: copy.label,
    scoreNote: copy.note,
    rows,
    sections,
    totalQuestions,
    totalMarks,
    passMark,
    passPercent,
    levelPassMarks,
    separatePass,
    gradeBands,
    uniformPerQuestion,
  }
}
 
 