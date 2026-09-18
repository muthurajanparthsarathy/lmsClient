// Small factory helpers shared by the Programming form's flow state.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.

import type { TC } from '../types';

export const mkLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const mkTC = (i: number): TC => ({
  id: `tc-${Date.now()}-${i}`,
  input: '',
  expectedOutput: '',
  isHidden: false,
  isSample: i === 0,
  description: `Test Case ${i + 1}`,
});
