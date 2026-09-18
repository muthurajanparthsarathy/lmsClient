// sampleInput.ts
// ─────────────────────────────────────────────────────────────────────────────
// Where the Terminal's stdin box starts from.
//
// Under Manual evaluation the student editors are a plain workspace: a Run
// button and a Terminal. Run pipes whatever sits in the stdin box straight to
// the program and prints the raw output — nothing is compared, counted or
// scored. Seeding that box with the question's own example input means Run
// does something useful on the first press instead of feeding the program an
// empty stdin.
//
// Only NON-hidden cases are ever used as a seed: a hidden case is the
// trainer's held-back check, and pre-filling it into an editable box the
// student can read would hand it over.

/**
 * First visible example input for a question, or '' when it has none.
 * Tolerates every shape the authoring surfaces have produced over time:
 * `testCases[]` rows, a legacy `sampleInput` string, or already-converted
 * `examples[]` rows.
 */
export function firstSampleInput(question: any): string {
  if (!question) return '';

  const cases = Array.isArray(question.testCases) ? question.testCases : [];
  const visible = cases.find((tc: any) => tc && !tc.isHidden);
  if (visible && typeof visible.input === 'string' && visible.input !== '') {
    return visible.input;
  }

  if (typeof question.sampleInput === 'string' && question.sampleInput !== '') {
    return question.sampleInput;
  }

  const examples = Array.isArray(question.examples) ? question.examples : [];
  const firstExample = examples.find((e: any) => e && typeof e.input === 'string' && e.input !== '');
  if (firstExample) return firstExample.input;

  return '';
}
