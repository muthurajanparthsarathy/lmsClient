// Instruction resolution for the student pre-start page.
//
// If the exercise's author-written `instructions` (rich-text HTML from
// ExerciseSettings > Step 1 > Instructions) has visible content, use it as-is.
// Otherwise, synthesise a plain, factual paragraph from the exercise's own
// settings (duration, question count, primary language, evaluation method)
// so students always see something useful. This mirrors what a thoughtful
// author would have typed themselves.

export type InstructionResolution = {
  html: string
  source: 'authored' | 'auto'
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

const capitalise = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s

/**
 * Given a raw exercise document (any shape — the resolver is defensive), return
 * the HTML that the pre-start page should render, plus a hint of where it came
 * from ("authored" vs "auto") so callers can style differently if they want.
 */
export function resolveExerciseInstructions(exercise: any): InstructionResolution {
  const authored: string = typeof exercise?.instructions === 'string' ? exercise.instructions : ''
  if (stripHtml(authored).length > 0) {
    return { html: authored, source: 'authored' }
  }

  const info = exercise?.exerciseInformation || {}
  const name = info.exerciseName || 'this exercise'
  const totalQ =
    (Array.isArray(exercise?.questions) && exercise.questions.length) ||
    info.totalQuestions || 0
  const duration = info.totalDuration || 0
  const languages: string[] = Array.isArray(exercise?.programmingSettings?.selectedLanguages)
    ? exercise.programmingSettings.selectedLanguages : []
  const primaryLang = languages[0] ? capitalise(languages[0]) : ''
  const isPractice = exercise?.evaluationSettings?.practiceMode === true

  // Evaluation method — mirrors resolveEvaluationMethod's public labels
  // (Manual / Test Case / AI).
  const evalMethod: string = (() => {
    const m = (exercise?.evaluationMethod?.method || exercise?.evaluationMethod || '').toString().toLowerCase()
    if (m === 'ai') return 'AI'
    if (m === 'testcase' || m === 'test-case') return 'Test cases'
    return ''
  })()

  const bits: string[] = []
  bits.push(
    `Read each problem carefully before writing your solution.`,
  )
  if (primaryLang) {
    bits.push(
      `Use ${escape(primaryLang)} in the provided editor${
        totalQ > 0 ? ` and complete all ${totalQ} problem${totalQ === 1 ? '' : 's'}` : ''
      }${duration > 0 ? ` within ${duration} minutes` : ''}.`,
    )
  } else if (totalQ > 0 || duration > 0) {
    bits.push(
      `Complete${totalQ > 0 ? ` all ${totalQ} problem${totalQ === 1 ? '' : 's'}` : ' the exercise'}${duration > 0 ? ` within ${duration} minutes` : ''}.`,
    )
  }
  if (evalMethod === 'Test cases') {
    bits.push(
      `Run the sample test cases before submitting; hidden test cases will be used for final evaluation.`,
    )
  } else if (evalMethod === 'AI') {
    bits.push(
      `Your solution is graded by an AI reviewer against the trainer's criteria. Focus on correctness and readability.`,
    )
  }
  bits.push(
    `Your work is saved automatically, but all answers must be submitted before the timer expires.`,
  )
  if (!isPractice) {
    bits.push(
      `If you experience a device or connectivity issue, contact your trainer before starting.`,
    )
  }

  return {
    html: `<p>${bits.join(' ')}</p>`,
    source: 'auto',
  }
}
