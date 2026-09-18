// ─────────────────────────────────────────────────────────────────────────────
// Exercise templates → a SEED DOCUMENT for the existing wizard.
//
// This file contains NO business logic. It is a pure mapping from a
// human-authored template spec into the exact server-document shape that
// ExerciseSettings' existing hydration effect already knows how to read
// (ExerciseSettings.tsx:526-916). Every rule — validation, marks allocation,
// grade calculation, save — still runs inside ExerciseSettings against the
// hydrated formData, unchanged.
//
// The one genuinely tricky conversion is level marks, and it is called out at
// `levelScoring` below: this file speaks in LEVEL TOTALS (what a person
// authoring a template thinks in), production stores MARKS PER QUESTION.
// ─────────────────────────────────────────────────────────────────────────────

export type SeedExerciseType = 'MCQ' | 'Programming' | 'Combined' | 'Other'
export type SeedLevel = 'beginner' | 'intermediate' | 'expert'
export type SeedStrategy = 'general' | 'levelBased' | 'selectionLevel'
export type SeedEvaluation = 'manual' | 'testcase' | 'ai'
export type SeedFlow = 'freeFlow' | 'controlled'

/** Per-level authoring shape: `marks` is the LEVEL TOTAL, not per question. */
export interface LevelSpec { q: number; marks: number }

export interface TemplateSpec {
    id: string
    name: string
    icon: string
    blurb: string
    who: string
    /** Usage count shown on the gallery card ("Used N times"). Display only. */
    uses?: number
    type: SeedExerciseType
    graded: boolean
    level: SeedLevel
    duration: number
    /** Non-Combined total. For Combined, use mcqMarks + programmingMarks. */
    totalMarks?: number
    mcqMarks?: number
    programmingMarks?: number
    strategy: SeedStrategy
    generalCount?: number
    levels?: Record<'easy' | 'medium' | 'hard', LevelSpec>
    /** MCQ question count — used by type MCQ and by Combined's MCQ half. */
    mcqCount?: number
    flow: SeedFlow
    evaluation: SeedEvaluation
    attemptLimit: boolean
    attempts: number
    allRequired: boolean
    /** Optional pass mark. Fanned out to the right type-scoped key below. */
    passMark?: number
}

// ── Level marks: the one conversion that can corrupt data ────────────────────
//
// Production stores `marksPerQuestion` for a `level_specific` level and derives
// the level total as `count × marksPerQuestion`. A template authored as "Easy is
// worth 20 across 2 questions" must therefore become marksPerQuestion = 10.
//
// When that division is NOT exact, `level_specific` cannot represent the intent
// without drift, and the existing programmingLevelMismatch check would reject
// the template with "Level totals sum to X but total is Y". So a non-integer
// level falls back to `question_specific`, which stores the level TOTAL
// directly — exact by construction, and a real production configuration.
const levelScoring = (q: number, levelTotal: number) => {
    if (q <= 0) {
        return { type: 'level_specific' as const, marksPerQuestion: 0, questionCount: 0 }
    }
    const mpq = levelTotal / q
    if (Number.isInteger(mpq)) {
        return { type: 'level_specific' as const, marksPerQuestion: mpq, questionCount: q }
    }
    return { type: 'question_specific' as const, totalMarks: levelTotal, questionCount: q }
}

const isoAt = (daysFromNow: number, hour: number, minute: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
}

export interface SeedOptions {
    /** Course-configured languages, used to fill the UI-less Programming fields. */
    configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] }
    /** Overrides the template's name when the user typed one. */
    exerciseName?: string
}

/**
 * Build the server-document-shaped seed. The keys below are exactly the ones
 * ExerciseSettings' hydration reads — `exerciseInformation`,
 * `questionConfiguration.{mcqQuestionConfiguration,programmingQuestionConfiguration,
 * othersQuestionConfiguration}`, `availabilityPeriod`, `notificationSettings`,
 * `gradeSettings`, `additionalOptions`, `questionBehavior`.
 */
export const buildSeedDocument = (t: TemplateSpec, opts: SeedOptions = {}): Record<string, unknown> => {
    const isCombined = t.type === 'Combined'
    const progMarks = isCombined ? (t.programmingMarks ?? 0) : (t.totalMarks ?? 0)
    const mcqMarks = isCombined ? (t.mcqMarks ?? 0) : (t.type === 'MCQ' ? (t.totalMarks ?? 0) : 0)
    const total = isCombined ? (t.mcqMarks ?? 0) + (t.programmingMarks ?? 0) : (t.totalMarks ?? 0)

    const lv = t.levels ?? { easy: { q: 0, marks: 0 }, medium: { q: 0, marks: 0 }, hard: { q: 0, marks: 0 } }
    const counts = { easy: lv.easy.q, medium: lv.medium.q, hard: lv.hard.q }
    const levelSum = counts.easy + counts.medium + counts.hard

    // Programming/Others block. `generalMarksPerQuestion` is what hydration
    // reads first for the general strategy (`evenMarksVal`).
    const typedConfig = {
        questionConfigType: t.strategy,
        // patternTotal is an OPT-IN quota. Setting it for level strategies keeps
        // the E+M+H === total check satisfied from the first render.
        patternTotal: t.strategy === 'general' ? 0 : levelSum,
        generalQuestionCount: t.strategy === 'general' ? (t.generalCount ?? 0) : 0,
        generalMarksPerQuestion:
            t.strategy === 'general' && (t.generalCount ?? 0) > 0 ? progMarks / (t.generalCount as number) : 0,
        levelBasedCounts: t.strategy === 'levelBased' ? counts : { easy: 0, medium: 0, hard: 0 },
        selectionLevelCounts: t.strategy === 'selectionLevel' ? counts : { easy: 0, medium: 0, hard: 0 },
        scoreSettings: {
            scoreType: t.strategy === 'general' ? 'evenMarks' : 'levelBasedMarks',
            evenMarks: t.strategy === 'general' && (t.generalCount ?? 0) > 0 ? progMarks / (t.generalCount as number) : 0,
            levelScoringConfiguration: {
                easy: levelScoring(lv.easy.q, lv.easy.marks),
                medium: levelScoring(lv.medium.q, lv.medium.marks),
                hard: levelScoring(lv.hard.q, lv.hard.marks),
            },
            totalMarks: progMarks,
        },
        questionFlow: t.flow,
        attemptLimitEnabled: t.attemptLimit,
        submissionAttempts: t.attempts,
        compilerFileMode: 'multiple',
    }

    const mcqCount = t.mcqCount ?? 0
    const mcqBlock = {
        totalMcqQuestions: mcqCount,
        marksPerQuestion: mcqCount > 0 ? mcqMarks / mcqCount : 0,
        mcqTotalMarks: mcqMarks,
        scoringType: 'equalDistribution',
        attemptLimitEnabled: t.attemptLimit,
        submissionAttempts: t.attempts,
    }

    // Languages have NO UI in production — they are auto-filled from the course.
    // Mirroring that here keeps a Programming template savable on a configured
    // course; on an unconfigured one the launcher warns before you get this far.
    const flat = [
        ...(opts.configuredLanguages?.coreProgram ?? []),
        ...(opts.configuredLanguages?.frontend ?? []),
        ...(opts.configuredLanguages?.database ?? []),
    ].filter(Boolean)
    const selectedModule = (opts.configuredLanguages?.coreProgram ?? []).length ? 'Core Programming'
        : (opts.configuredLanguages?.frontend ?? []).length ? 'Frontend'
            : (opts.configuredLanguages?.database ?? []).length ? 'Database' : ''

    // Pass mark fans out to the type-scoped key. Production has three separate
    // fields and reads a different one per exercise type.
    const grade: Record<string, unknown> = {
        separateMarks: false,
        difficultyPassEnabled: false,
        overallMarkToPassEnabled: false,
    }
    if (t.graded && t.passMark != null) {
        if (t.type === 'MCQ') grade.mcqGradeToPass = t.passMark
        else if (t.type === 'Combined') grade.combinedGradeToPass = t.passMark
        else grade.programmingGradeToPass = t.passMark   // Programming AND Other
    }

    return {
        exerciseType: t.type,
        isGraded: t.graded,
        // Empty on purpose: a seeded exercise has saved nothing yet, so every
        // step still reads as pending and the user must Save as usual.
        stepsSaved: [],
        exerciseInformation: {
            exerciseName: opts.exerciseName ?? '',
            description: '',
            exerciseLevel: t.level,
            totalDuration: t.duration,
            totalMarks: t.graded ? total : 0,
            totalMarksMCQ: t.graded && isCombined ? (t.mcqMarks ?? 0) : 0,
            totalMarksProgramming: t.graded && isCombined ? (t.programmingMarks ?? 0) : 0,
        },
        programmingSettings: { selectedModule, selectedLanguages: flat },
        questionConfiguration: {
            mcqQuestionConfiguration: mcqBlock,
            programmingQuestionConfiguration: t.type === 'Other' ? {} : typedConfig,
            othersQuestionConfiguration: t.type === 'Other' ? typedConfig : {},
        },
        evaluationMethod: {
            method: t.evaluation,
            ai: { criteria: ['correctness'], testCasesCountMode: 'common', testCasesCount: 20 },
        },
        questionBehavior: { allQuestionsRequired: t.allRequired },
        availabilityPeriod: {
            startDate: isoAt(0, 9, 0),
            endDate: isoAt(7, 23, 59),
            cutOffEnabled: false,
            remindGradeByEnabled: false,
            gracePeriodEnabled: false,
            requiresAdminApproval: false,
            approvalScope: 'settings',
        },
        notificationSettings: {
            notifyUsers: true, notifyGmail: false, notifyWhatsApp: false, gradeSheet: true,
            notifyGradersSubmissions: false,
            notifyGradersSubmissionsChannels: { dashboard: false, gmail: false, whatsapp: false },
            notifyGradersLateSubmissions: false,
            notifyGradersLateSubmissionsChannels: { dashboard: false, gmail: false, whatsapp: false },
            notifyStudent: true,
            notifyStudentChannels: { dashboard: true, gmail: false, whatsapp: false },
        },
        gradeSettings: grade,
        additionalOptions: { anonymousSubmissions: false, hideGraderIdentity: false },
        // Single source keeps the distribution matrix out of the fast path —
        // it only appears for 'custom' (2+ sources), which the user can still
        // switch to inside the wizard.
        questionSource: 'scratch',
        customSources: [],
        saveToBank: false,
    }
}

// ── The template library ─────────────────────────────────────────────────────
// Code-defined for now: production has no template store, so "Save as template"
// would have nowhere to persist to.

export const TEMPLATES: TemplateSpec[] = [
    {
        id: 'prog', name: 'Programming Assessment', icon: '</>', who: 'Team preset · v3', uses: 41,
        blurb: 'Balanced coding test across three difficulty levels.',
        type: 'Programming', graded: true, level: 'intermediate', duration: 60, totalMarks: 50,
        strategy: 'levelBased',
        levels: { easy: { q: 2, marks: 20 }, medium: { q: 2, marks: 20 }, hard: { q: 1, marks: 10 } },
        flow: 'freeFlow', evaluation: 'manual', attemptLimit: true, attempts: 2, allRequired: false,
        passMark: 25,
    },
    {
        id: 'mcq', name: 'MCQ Assessment', icon: '☰', who: 'Team preset · v2', uses: 88,
        blurb: 'Auto-graded quiz, one attempt, every question required.',
        type: 'MCQ', graded: true, level: 'beginner', duration: 30, totalMarks: 20,
        strategy: 'general', mcqCount: 20,
        flow: 'controlled', evaluation: 'manual', attemptLimit: true, attempts: 1, allRequired: true,
        passMark: 10,
    },
    {
        id: 'coding', name: 'Coding Test', icon: '</>', who: 'Standard', uses: 210,
        blurb: 'Harder, test-case evaluated, single attempt.',
        type: 'Programming', graded: true, level: 'expert', duration: 120, totalMarks: 60,
        strategy: 'levelBased',
        levels: { easy: { q: 1, marks: 10 }, medium: { q: 1, marks: 20 }, hard: { q: 1, marks: 30 } },
        flow: 'controlled', evaluation: 'testcase', attemptLimit: true, attempts: 1, allRequired: true,
        passMark: 30,
    },
    {
        id: 'practice', name: 'Practice Exercise', icon: '</>', who: 'Standard', uses: 156,
        blurb: 'Non-graded practice with unlimited attempts.',
        type: 'Programming', graded: false, level: 'beginner', duration: 45,
        strategy: 'levelBased',
        levels: { easy: { q: 2, marks: 0 }, medium: { q: 1, marks: 0 }, hard: { q: 0, marks: 0 } },
        flow: 'freeFlow', evaluation: 'testcase', attemptLimit: false, attempts: 1, allRequired: false,
    },
    {
        id: 'placement', name: 'Placement Assessment', icon: '◆', who: 'Team preset · v1', uses: 12,
        blurb: 'Combined MCQ + coding, anonymised, approval required.',
        type: 'Combined', graded: true, level: 'intermediate', duration: 150,
        mcqMarks: 20, programmingMarks: 50, mcqCount: 10,
        strategy: 'levelBased',
        levels: { easy: { q: 2, marks: 20 }, medium: { q: 2, marks: 20 }, hard: { q: 1, marks: 10 } },
        flow: 'controlled', evaluation: 'testcase', attemptLimit: true, attempts: 1, allRequired: false,
        passMark: 35,
    },
    {
        id: 'interview', name: 'Interview Coding Test', icon: '</>', who: 'Team preset · v1', uses: 7,
        blurb: 'Two hard problems, AI evaluated, marks set per question.',
        type: 'Programming', graded: true, level: 'expert', duration: 90, totalMarks: 100,
        // selectionLevel, NOT levelBased: production's levelBased branch requires
        // all three levels > 0 ("Easy count required"), and this template
        // deliberately has no Easy questions. selectionLevel allows zeros.
        strategy: 'selectionLevel',
        levels: { easy: { q: 0, marks: 0 }, medium: { q: 1, marks: 40 }, hard: { q: 1, marks: 60 } },
        flow: 'freeFlow', evaluation: 'ai', attemptLimit: true, attempts: 1, allRequired: false,
        passMark: 50,
    },
    {
        id: 'combined', name: 'Combined MCQ + Programming', icon: '◆', who: 'Standard', uses: 64,
        blurb: 'Ten MCQs plus three coding questions.',
        type: 'Combined', graded: true, level: 'intermediate', duration: 90,
        mcqMarks: 20, programmingMarks: 30, mcqCount: 10,
        strategy: 'levelBased',
        levels: { easy: { q: 1, marks: 10 }, medium: { q: 1, marks: 10 }, hard: { q: 1, marks: 10 } },
        flow: 'freeFlow', evaluation: 'manual', attemptLimit: true, attempts: 2, allRequired: false,
        passMark: 25,
    },
    // NOTE: there is deliberately no "Custom / blank" template here. A template
    // that pre-fills nothing would carry totalMarks 0 while graded, which
    // production rejects on save ("Total marks must be greater than 0"). The
    // blank path is "Start from scratch" on the entry screen, which opens the
    // wizard with no seed at all — genuinely untouched behaviour.
]

/** Human-readable summary rows for the preview card. */
export const templateSummary = (t: TemplateSpec): Array<[string, string]> => {
    const rows: Array<[string, string]> = []
    const isCombined = t.type === 'Combined'
    const total = isCombined ? (t.mcqMarks ?? 0) + (t.programmingMarks ?? 0) : (t.totalMarks ?? 0)
    const lv = t.levels
    const progQ = t.strategy === 'general' ? (t.generalCount ?? 0)
        : (lv ? lv.easy.q + lv.medium.q + lv.hard.q : 0)
    const qTotal = progQ + (isCombined ? (t.mcqCount ?? 0) : 0)

    rows.push(['Exercise Type', t.type])
    rows.push(['Graded', t.graded ? 'Graded' : 'Non-Graded'])
    rows.push(['Questions', t.type === 'MCQ' ? String(t.mcqCount ?? 0) : String(qTotal)])
    if (t.graded) rows.push(['Total Marks', String(total)])
    if (lv && t.strategy !== 'general') {
        rows.push(['Difficulty', `Easy ${lv.easy.q} · Medium ${lv.medium.q} · Hard ${lv.hard.q}`])
    }
    rows.push(['Difficulty Level', t.level.charAt(0).toUpperCase() + t.level.slice(1)])
    rows.push(['Duration', `${t.duration} minutes`])
    if (t.type !== 'MCQ') {
        rows.push(['Evaluation', t.evaluation === 'testcase' ? 'Test Case Based'
            : t.evaluation === 'ai' ? 'AI Based' : 'Manual'])
        rows.push(['Question Flow', t.flow === 'controlled' ? 'Controlled Flow' : 'Free Flow'])
    }
    rows.push(['Attempts', t.attemptLimit ? String(t.attempts) : 'Unlimited'])
    if (t.graded && t.passMark != null) rows.push(['Mark to Pass', String(t.passMark)])
    return rows
}
