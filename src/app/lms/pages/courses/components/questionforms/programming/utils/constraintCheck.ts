// Constraint parser + validator for the Programming form's "Run Tests" flow.
// New 2026-08-30 — the run flow historically ignored the Constraints list
// entirely (they were display-only text for the student). Teachers can now
// see, before + after running, which test cases violate the declared
// constraints so they can catch mistakes like `n = 200000` when the
// constraint is `1 ≤ n ≤ 10⁵`.
//
// SCOPE (intentionally limited — free-form math strings are hard):
//   Supported shapes (whitespace tolerant, both ASCII and Unicode ops):
//     <lower> ≤ <var> ≤ <upper>          (bounded range)
//     <lower> <= <var> <= <upper>
//     <lower> <  <var> <  <upper>        (strict range)
//     <var>   ≤  <upper>                 (upper bound only)
//     <var>   ≥  <lower>                 (lower bound only)
//     <var>   ==  <value>                (equality)
//     <var>   !=  <value>                (inequality)
//   Numbers: plain (100, 3.14, -5), Unicode superscript power (10⁵), and
//     JS-style power (10^5). Both are canonicalised to the same JS number.
//   Variables: any identifier or dotted / bracketed accessor. Only
//     top-level identifiers (matching a function-contract param NAME) are
//     validated against — accessor forms like `arr[i]` or `s.length` are
//     accepted syntactically but skipped at validation time because we
//     don't have their runtime value.
//
// NOT SUPPORTED (fail open — return no violation, so the run proceeds):
//   Multi-var relations (`arr[i] ≤ arr[j]`), floor/ceil/mod, ternaries,
//   piecewise constraints, English prose ("all inputs are non-negative").
//   If we can't parse a constraint we log it once and move on. A false
//   negative here is better than a false positive that blocks the teacher.
//
// The validators are pure — no side effects — so calling them per test
// case in a tight loop is cheap.

// ─── Number parsing ────────────────────────────────────────────────────────
// Convert a superscript digit like "⁵" to "5". Runs on every char so any
// mix of ASCII + superscript ("10⁵" or "1⁰⁰⁰") is handled the same way.
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const desuperscript = (s: string) =>
  s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => String(SUP.indexOf(ch)));

// Parse a number literal, respecting `10^5` and `10⁵` power notation.
// Returns null when the string isn't a recognisable numeric literal so
// the caller can decide whether to error, warn, or skip.
export function parseNum(raw: string): number | null {
  const s = desuperscript(raw.trim());
  const pow = s.match(/^(-?\d+(?:\.\d+)?)\s*\^\s*(-?\d+)$/);
  if (pow) return Math.pow(parseFloat(pow[1]), parseInt(pow[2], 10));
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
  return null;
}

// ─── Constraint model ──────────────────────────────────────────────────────
export interface ParsedConstraint {
  raw: string;              // original text — echoed back in violation messages
  variable: string;         // the identifier being constrained
  min?: number;             // lower bound (inclusive if minInclusive)
  minInclusive?: boolean;
  max?: number;             // upper bound (inclusive if maxInclusive)
  maxInclusive?: boolean;
  eq?: number;              // exact equality target
  neq?: number;             // inequality target
}

// Match: <expr> <op1> <var> <op2> <expr>  (two-sided range)
// Match: <var>   <op>  <expr>              (one-sided)
// Ops:  <= >= < > = == != ≤ ≥
const OP_RE = /(<=|>=|==|!=|<|>|=|≤|≥)/;

// Normalise all comparison ops to their ASCII forms + inclusiveness flag.
function opInfo(op: string): { lt: boolean; gt: boolean; eq: boolean; neq: boolean; inclusive: boolean } {
  const o = op.trim();
  if (o === '<=' || o === '≤')            return { lt: true,  gt: false, eq: false, neq: false, inclusive: true  };
  if (o === '<')                          return { lt: true,  gt: false, eq: false, neq: false, inclusive: false };
  if (o === '>=' || o === '≥')            return { lt: false, gt: true,  eq: false, neq: false, inclusive: true  };
  if (o === '>')                          return { lt: false, gt: true,  eq: false, neq: false, inclusive: false };
  if (o === '==' || o === '=')            return { lt: false, gt: false, eq: true,  neq: false, inclusive: true  };
  if (o === '!=')                         return { lt: false, gt: false, eq: false, neq: true,  inclusive: false };
  return { lt: false, gt: false, eq: false, neq: false, inclusive: false };
}

// Parse ONE constraint line. Returns null when the line is empty, a comment
// (starts with #), or too complex for the parser. `console.debug` on skip
// so a teacher can inspect why in devtools if a constraint isn't enforced.
export function parseConstraint(raw: string): ParsedConstraint | null {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // Split on comparison operators, preserving the ops so we can inspect them.
  // Two-sided: parts.length === 5 → [expr, op, var, op, expr]
  // One-sided: parts.length === 3 → [lhs, op, rhs]
  const parts = trimmed.split(OP_RE).map(p => p.trim()).filter(Boolean);

  // ── Two-sided range: <lower> op <var> op <upper> ────────────────────────
  if (parts.length === 5) {
    const [lStr, op1, varName, op2, rStr] = parts;
    const lo = parseNum(lStr);
    const hi = parseNum(rStr);
    if (lo === null || hi === null) return null;
    if (!/^[A-Za-z_][\w.\[\]]*$/.test(varName)) return null;
    const a = opInfo(op1);
    const b = opInfo(op2);
    // Only bounded-range shapes make sense here (lo < var < hi and friends).
    if (a.lt && b.lt) {
      return {
        raw: trimmed, variable: varName,
        min: lo, minInclusive: a.inclusive,
        max: hi, maxInclusive: b.inclusive,
      };
    }
    if (a.gt && b.gt) {
      // hi > var > lo — flip so min < max
      return {
        raw: trimmed, variable: varName,
        min: hi, minInclusive: a.inclusive,
        max: lo, maxInclusive: b.inclusive,
      };
    }
    return null;
  }

  // ── One-sided: <lhs> op <rhs> ────────────────────────────────────────────
  if (parts.length === 3) {
    const [lhs, op, rhs] = parts;
    const info = opInfo(op);
    const isVarLhs = /^[A-Za-z_][\w.\[\]]*$/.test(lhs);
    const isVarRhs = /^[A-Za-z_][\w.\[\]]*$/.test(rhs);
    const numLhs = parseNum(lhs);
    const numRhs = parseNum(rhs);

    // Standard shape: `var op number` (e.g. `n <= 100`).
    if (isVarLhs && numRhs !== null) {
      const c: ParsedConstraint = { raw: trimmed, variable: lhs };
      if (info.eq)  { c.eq = numRhs; return c; }
      if (info.neq) { c.neq = numRhs; return c; }
      if (info.lt)  { c.max = numRhs; c.maxInclusive = info.inclusive; return c; }
      if (info.gt)  { c.min = numRhs; c.minInclusive = info.inclusive; return c; }
    }
    // Reversed shape: `number op var` (e.g. `100 >= n`). Flip the op.
    if (numLhs !== null && isVarRhs) {
      const c: ParsedConstraint = { raw: trimmed, variable: rhs };
      if (info.eq)  { c.eq = numLhs; return c; }
      if (info.neq) { c.neq = numLhs; return c; }
      if (info.lt)  { c.min = numLhs; c.minInclusive = info.inclusive; return c; } // numLhs < var → var > numLhs
      if (info.gt)  { c.max = numLhs; c.maxInclusive = info.inclusive; return c; } // numLhs > var → var < numLhs
    }
    return null;
  }

  return null;
}

// Coerce any test-case value into a number for constraint checking. Strings
// like "100" become 100; arrays are checked by length; booleans and objects
// are skipped (return null) so the validator can decide to no-op.
function toNum(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(v)) return v.length; // treat array constraints as length checks
  return null;
}

export interface ConstraintViolation {
  constraint: string; // the raw constraint text
  variable: string;
  value: number | string; // the actual value that failed
  detail: string;     // human-readable message for the UI
}

// Validate ONE test case's inputs against the full parsed-constraint list.
// Only constraints whose `variable` is a top-level param name AND whose
// value is coercible to a number contribute — accessors and non-numeric
// inputs are skipped silently. Returns [] when clean.
export function checkConstraintsForInput(
  parsed: ParsedConstraint[],
  paramValues: Record<string, any>,
): ConstraintViolation[] {
  const out: ConstraintViolation[] = [];
  for (const c of parsed) {
    // Only enforce constraints on top-level params we can actually read.
    if (!(c.variable in paramValues)) continue;
    const raw = paramValues[c.variable];
    const num = toNum(raw);
    if (num === null) continue;

    if (c.eq !== undefined && num !== c.eq) {
      out.push({ constraint: c.raw, variable: c.variable, value: num,
        detail: `${c.variable} = ${num} but constraint requires ${c.variable} == ${c.eq}` });
    }
    if (c.neq !== undefined && num === c.neq) {
      out.push({ constraint: c.raw, variable: c.variable, value: num,
        detail: `${c.variable} = ${num} but constraint requires ${c.variable} != ${c.neq}` });
    }
    if (c.min !== undefined) {
      const ok = c.minInclusive ? num >= c.min : num > c.min;
      if (!ok) out.push({ constraint: c.raw, variable: c.variable, value: num,
        detail: `${c.variable} = ${num} is below ${c.minInclusive ? '' : 'or equal to '}minimum ${c.min}` });
    }
    if (c.max !== undefined) {
      const ok = c.maxInclusive ? num <= c.max : num < c.max;
      if (!ok) out.push({ constraint: c.raw, variable: c.variable, value: num,
        detail: `${c.variable} = ${num} is above ${c.maxInclusive ? '' : 'or equal to '}maximum ${c.max}` });
    }
  }
  return out;
}

// Convenience: parse an array of raw constraint strings, dropping unparseable
// entries. Returns { parsed, skipped } so callers can UI-warn about skips.
export function parseConstraintsList(raws: string[]): { parsed: ParsedConstraint[]; skipped: string[] } {
  const parsed: ParsedConstraint[] = [];
  const skipped: string[] = [];
  for (const r of raws) {
    if (!r || !r.trim()) continue;
    const p = parseConstraint(r);
    if (p) parsed.push(p); else skipped.push(r);
  }
  return { parsed, skipped };
}
