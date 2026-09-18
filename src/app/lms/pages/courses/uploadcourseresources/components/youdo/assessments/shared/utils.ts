// ── Numeric helpers shared by ExerciseSettings shell and steps ──────────────
export const isApproximatelyEqual = (a: number, b: number, tolerance = 0.01) =>
  Math.abs(a - b) < tolerance;

export const formatDecimal = (v: number) =>
  v % 1 === 0 ? v.toString() : v.toFixed(2);
