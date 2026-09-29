// The hints a question is SAVED with, from the form's main Hint box plus its
// "Additional Hints" rows.
//
// Only hints with text are sent: an Additional Hint row that was added but
// never filled in is not a hint (an empty one used to crash the save —
// "Cast to string failed … at path hintText"). Hints carry no points
// deduction; `pointsDeduction` is always 0 so older readers still find it.
export type SavedHint = {
  hintText: string
  isPublic: boolean
  pointsDeduction: 0
  sequence: number
}

export const buildQuestionHints = (
  mainHint: string,
  extraHints: Array<{ hintText?: string | null; isPublic?: boolean }>,
): SavedHint[] =>
  [
    ...(mainHint.trim() ? [{ hintText: mainHint.trim(), isPublic: true }] : []),
    ...extraHints
      .filter((h) => (h.hintText || '').trim())
      .map((h) => ({ hintText: (h.hintText || '').trim(), isPublic: h.isPublic !== false })),
  ].map((h, sequence) => ({ ...h, pointsDeduction: 0 as const, sequence }))
