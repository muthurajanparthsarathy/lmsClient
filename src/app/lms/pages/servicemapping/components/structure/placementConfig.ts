// The fixed vocabulary of the Placement Training structure step.
// ─────────────────────────────────────────────────────────────────────────────
// Two different things on this screen are called "batch", and keeping them apart
// is why the naming helpers live together in one file:
//
//   • the ACADEMIC batch — an intake YEAR, "2026". One per course configuration.
//   • a TRAINING batch — a parallel group sitting the course, "Batch I". Many,
//     and the same name may appear under two different phases.
//
// The wizard's own state (page.tsx) is the source of truth for the structure;
// this file holds only the constants and default names both it and the form
// need to agree on.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** "Phase I", "Phase II", … — what a new phase is called. */
export const defaultPhaseName = (index: number): string =>
    `Phase ${ROMAN[index] || index + 1}`

/** "Batch I", "Batch II", … for the batches inside a phase. */
export const defaultPhaseBatchName = (index: number): string =>
    `Batch ${ROMAN[index] || index + 1}`

/** "Batch 1", "Batch 2", … when the course runs without phases. */
export const defaultBatchName = (index: number): string => `Batch ${index + 1}`

/**
 * Academic batch options: THIS year's intake through the next few.
 *
 * The window used to open a year early, which offered an intake that has
 * already started as if it were still being planned. It now starts at the
 * current year, matching the two other year pickers in the wizard (the degree
 * Start year and Step 1's service providing year), so the three cannot disagree
 * about what a selectable year is. The upper end is unchanged.
 *
 * A stored year outside that window is prepended rather than dropped — without
 * it, reopening an older mapping would show a blank field and lose the year on
 * the next save.
 */
export const academicBatchOptions = (stored?: string): string[] => {
    const now = new Date().getFullYear()
    const years = Array.from({ length: 6 }, (_, i) => String(now + i))
    return stored && !years.includes(stored) ? [stored, ...years] : years
}

/** Placement has no degree to take a length from, so the list is fixed. */
export const SEMESTER_OPTIONS = ROMAN.slice(0, 8).map((r) => `Sem ${r}`)

export const MAX_PHASES = 10
export const MAX_BATCHES = 20
/** Phases start at two: one phase is not a phased training. */
export const MIN_PHASES = 2
/**
 * Training batches start at two, for the same reason phases do: one batch is
 * not a split, it is the whole course wearing a batch's name. The checkbox is
 * how you say "no batches" — the stepper is not, so it stops at two rather than
 * walking down to a count that means nothing.
 */
export const MIN_BATCHES = 2
