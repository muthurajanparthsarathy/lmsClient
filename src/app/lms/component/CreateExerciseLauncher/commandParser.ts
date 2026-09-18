// ─────────────────────────────────────────────────────────────────────────────
// Natural-language command → TemplateSpec.
//
// The parser only ever produces a TemplateSpec, which buildSeedDocument then
// turns into a seed for the existing wizard. It therefore CANNOT bypass any
// validation: whatever it produces is hydrated into formData and checked by
// production's own validators exactly like anything else.
//
// The one thing this does beyond the reference prototype is guarantee the
// marks it emits survive production's `isApproximatelyEqual(…, 0.01)` check —
// see `balanceMarks`. The prototype rounded per-level marks and dumped the
// rounding drift onto Easy, which can leave the level sum off the total.
// ─────────────────────────────────────────────────────────────────────────────

import type { TemplateSpec, SeedEvaluation, SeedFlow, SeedLevel } from './templates'

export interface ParseResult {
    spec: TemplateSpec
    /** What was actually recognised, for the green "detected" chips. */
    detected: string[]
    /** What was defaulted rather than read, for the amber "assumed" chips. */
    assumed: string[]
}

const LEVELS = ['easy', 'medium', 'hard'] as const

/**
 * Split `total` marks across the given per-level question counts so that the
 * per-level totals sum EXACTLY to `total`. Whole marks are distributed
 * proportionally and the remainder goes to the largest level, so the result is
 * always integral and always exact — which is what keeps
 * programmingLevelMismatch quiet.
 */
const balanceMarks = (counts: Record<'easy' | 'medium' | 'hard', number>, total: number) => {
    const q = counts.easy + counts.medium + counts.hard
    const out = { easy: 0, medium: 0, hard: 0 }
    if (q <= 0 || total <= 0) return out
    let assigned = 0
    LEVELS.forEach((l) => {
        if (!counts[l]) return
        const share = Math.floor((total * counts[l]) / q)
        out[l] = share
        assigned += share
    })
    // Remainder to the level with the most questions (ties → first non-empty).
    let drift = total - assigned
    if (drift > 0) {
        const target = LEVELS.filter((l) => counts[l] > 0)
            .sort((a, b) => counts[b] - counts[a])[0]
        if (target) out[target] += drift
        else drift = 0
    }
    return out
}

export const parseCommand = (raw: string): ParseResult => {
    const t = raw.toLowerCase()
    const detected: string[] = []
    const assumed: string[] = []
    const num = (m: RegExpMatchArray | null) => (m ? Number(m[1]) : null)

    // ── Exercise type ────────────────────────────────────────────────────────
    let type: TemplateSpec['type'] = 'Programming'
    if (/\bcombined\b|mcq\s*\+\s*prog|both mcq/.test(t)) { type = 'Combined'; detected.push('Combined type') }
    else if (/\bmcqs?\b|multiple choice|\bquiz\b/.test(t)) { type = 'MCQ'; detected.push('MCQ type') }
    else if (/\bprogramming\b|\bcoding\b|\bcode\b|\bjava\b|\bpython\b|\bdsa\b|\bsql\b/.test(t)) {
        type = 'Programming'; detected.push('Programming type')
    } else assumed.push('Programming type')

    // ── Difficulty split (drives strategy) ───────────────────────────────────
    const e = num(t.match(/(\d+)\s*easy/))
    const m = num(t.match(/(\d+)\s*medium/))
    const h = num(t.match(/(\d+)\s*hard/))
    const hasSplit = e != null || m != null || h != null
    const counts = { easy: e ?? 0, medium: m ?? 0, hard: h ?? 0 }

    // ── Counts ───────────────────────────────────────────────────────────────
    const mcqAsked = num(t.match(/(\d+)\s*mcqs?/))
    const questionsAsked = num(t.match(/(\d+)\s*(?:coding\s*|programming\s*)?questions?/))

    // ── Marks / duration / attempts ──────────────────────────────────────────
    let totalMarks = num(t.match(/(\d+)\s*(?:total\s*)?marks?/))
    if (totalMarks != null) detected.push(`${totalMarks} marks`); else assumed.push('total marks')

    let duration = num(t.match(/(\d+)\s*(?:min|minute|minutes)\b/))
    if (duration == null) {
        const hrs = t.match(/(\d+|one|two|an)\s*(?:-|\s)?hours?/)
        if (hrs) {
            const w = hrs[1]
            duration = w === 'two' ? 120 : w === 'one' || w === 'an' ? 60 : Number(w) * 60
        }
    }
    if (duration != null) detected.push(`${duration} min`); else assumed.push('duration')

    let attemptLimit = true
    let attempts = 1
    const att = num(t.match(/(\d+)\s*attempts?/))
    if (/unlimited attempts|any number of attempts/.test(t)) {
        attemptLimit = false; detected.push('Unlimited attempts')
    } else if (att != null) {
        attempts = att; detected.push(`${att} attempt${att > 1 ? 's' : ''}`)
    } else assumed.push('attempts')

    // ── Evaluation ───────────────────────────────────────────────────────────
    let evaluation: SeedEvaluation = 'manual'
    if (/\bai[- ]?(based|evaluat|grad)/.test(t)) { evaluation = 'ai'; detected.push('AI based') }
    else if (/test\s?case|auto.?grad|automatic/.test(t) && type !== 'MCQ') {
        evaluation = 'testcase'; detected.push('Test case based')
    } else if (/manual(ly)?\s*(evaluat|grad|mark)/.test(t)) { evaluation = 'manual'; detected.push('Manual evaluation') }
    else if (type !== 'MCQ') assumed.push('evaluation method')

    // ── Flow / graded / level ────────────────────────────────────────────────
    let flow: SeedFlow = 'freeFlow'
    if (/controlled|one at a time|locked|in order/.test(t)) { flow = 'controlled'; detected.push('Controlled flow') }
    else if (/free flow|any order/.test(t)) { flow = 'freeFlow'; detected.push('Free flow') }

    let graded = true
    if (/non.?graded|ungraded|\bpractice\b/.test(t)) { graded = false; detected.push('Non-graded') }

    let level: SeedLevel = 'intermediate'
    if (/\bbeginner\b|\bbasic\b|easy level/.test(t)) { level = 'beginner'; detected.push('Beginner') }
    else if (/\bexpert\b|\badvanced\b/.test(t)) { level = 'expert'; detected.push('Expert') }
    else if (/\bintermediate\b|\bmoderate\b/.test(t)) { level = 'intermediate'; detected.push('Intermediate') }
    else assumed.push('difficulty level')

    // ── Resolve counts and strategy ──────────────────────────────────────────
    const isCombined = type === 'Combined'
    const mcqCount = isCombined ? (mcqAsked ?? 10) : type === 'MCQ' ? (mcqAsked ?? questionsAsked ?? 10) : 0
    if (type === 'MCQ' || isCombined) {
        if (mcqAsked != null || questionsAsked != null) detected.push(`${mcqCount} MCQ`)
        else assumed.push('MCQ count')
    }

    let strategy: TemplateSpec['strategy'] = 'general'
    let generalCount = 0
    if (type !== 'MCQ') {
        if (hasSplit) {
            strategy = 'levelBased'
            detected.push(`Easy ${counts.easy} · Medium ${counts.medium} · Hard ${counts.hard}`)
            // A level-based config needs all three > 0 in production; a split
            // that names only some levels becomes selectionLevel instead, which
            // legitimately allows zeros.
            if (counts.easy <= 0 || counts.medium <= 0 || counts.hard <= 0) strategy = 'selectionLevel'
        } else {
            strategy = 'general'
            generalCount = questionsAsked ?? 5
            if (questionsAsked != null) detected.push(`${generalCount} questions`)
            else assumed.push('question count')
        }
    }

    // ── Marks ────────────────────────────────────────────────────────────────
    if (totalMarks == null) totalMarks = graded ? 50 : 0
    const progMarks = isCombined ? Math.max(0, totalMarks - Math.round(totalMarks * 0.3)) : totalMarks
    const mcqMarks = isCombined ? Math.round(totalMarks * 0.3) : type === 'MCQ' ? totalMarks : 0
    if (isCombined) assumed.push('MCQ / programming marks split')

    const levelMarks = graded && strategy !== 'general'
        ? balanceMarks(counts, progMarks)
        : { easy: 0, medium: 0, hard: 0 }

    assumed.push('question source', 'schedule', 'notifications')

    const spec: TemplateSpec = {
        id: 'command',
        name: 'From command',
        icon: '⌘',
        who: 'Parsed from your description',
        blurb: raw.trim(),
        type,
        graded,
        level,
        duration: duration ?? 60,
        totalMarks: isCombined ? undefined : (graded ? totalMarks : 0),
        mcqMarks: isCombined ? mcqMarks : undefined,
        programmingMarks: isCombined ? progMarks : undefined,
        strategy,
        generalCount,
        levels: {
            easy: { q: counts.easy, marks: levelMarks.easy },
            medium: { q: counts.medium, marks: levelMarks.medium },
            hard: { q: counts.hard, marks: levelMarks.hard },
        },
        mcqCount,
        flow,
        evaluation,
        attemptLimit,
        attempts,
        allRequired: false,
        passMark: graded ? Math.round(totalMarks * 0.5) : undefined,
    }

    return { spec, detected, assumed: Array.from(new Set(assumed)) }
}

export const COMMAND_EXAMPLES = [
    'Programming exercise with 10 questions, 4 easy, 4 medium, 2 hard, 100 marks, 2 attempts, test case based',
    'Create 20 beginner Python MCQs for 30 minutes with 50 marks',
    'Combined assessment with 10 MCQs and 3 programming questions, 90 minutes',
    'Java practice test, 5 coding questions, 50 marks, manual evaluation, non-graded',
]
