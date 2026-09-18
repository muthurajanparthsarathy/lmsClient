// ─────────────────────────────────────────────────────────────────────────────
// Test-case literal → STDIN normaliser.
//
// Assessment papers write test-case inputs the way LeetCode does — a list of
// named argument literals on one line:
//
//     nums = [90,80,70,60,50], k = 2
//
// But every runner in this app feeds `testCase.input` to the program as raw
// STDIN (RunTestCasesModal → runOne → Piston, the student code-editor, the
// multi-file editor, and the server judge). So that literal has to be rewritten
// as the values a program would actually read — one value per line, arrays
// flattened to a space-separated row:
//
//     90 80 70 60 50
//     2
//
// Rules:
//   • `nums = [1,7,3]`                        → "1 7 3"
//   • `ranges = [[1,2],[3,4]], left = 2`      → "1 2\n3 4\n2"   (one row per line)
//   • `s = "ab#c", t = "ad#c"`                → "ab#c\nad#c"    (quotes stripped)
//   • anything that isn't a recognisable assignment list is returned untouched,
//     so a document that already writes raw stdin keeps working.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Value literals ──────────────────────────────────────────────────────────

type LiteralNode =
  | { kind: 'scalar'; value: string }
  | { kind: 'list'; items: LiteralNode[] };

const isSpace = (c: string | undefined) => !!c && /\s/.test(c);

const skipWs = (src: string, i: number): number => {
  while (i < src.length && isSpace(src[i])) i++;
  return i;
};

const CLOSERS: Record<string, string> = { '[': ']', '(': ')', '{': '}' };

/**
 * Parse one value literal starting at `i` — a bracketed list, a quoted string,
 * or a bare token. Returns null when the text isn't a well-formed literal (the
 * caller then leaves the original text alone).
 */
function parseLiteral(src: string, i: number): { node: LiteralNode; next: number } | null {
  i = skipWs(src, i);
  if (i >= src.length) return null;
  const ch = src[i];

  const close = CLOSERS[ch];
  if (close) {
    const items: LiteralNode[] = [];
    i = skipWs(src, i + 1);
    if (src[i] === close) return { node: { kind: 'list', items }, next: i + 1 };
    while (i < src.length) {
      const parsed = parseLiteral(src, i);
      if (!parsed) return null;
      items.push(parsed.node);
      i = skipWs(src, parsed.next);
      if (src[i] === ',') { i = skipWs(src, i + 1); continue; }
      if (src[i] === close) return { node: { kind: 'list', items }, next: i + 1 };
      return null; // junk between items → not a literal
    }
    return null; // unterminated
  }

  if (ch === '"' || ch === "'") {
    let out = '';
    i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        const n = src[i + 1];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : (n ?? '');
        i += 2;
        continue;
      }
      if (c === ch) return { node: { kind: 'scalar', value: out }, next: i + 1 };
      out += c;
      i++;
    }
    return null; // unterminated
  }

  // Bare token — number, boolean, identifier… runs until a structural delimiter.
  const start = i;
  while (i < src.length && !/[,\])}]/.test(src[i])) i++;
  const value = src.slice(start, i).trim();
  if (!value) return null;
  return { node: { kind: 'scalar', value }, next: i };
}

/**
 * One literal → the stdin lines a program would read for it. A flat list is a
 * single space-separated row; a nested list keeps one row per inner list, which
 * is how a 2-D array is normally fed to a solution.
 */
function literalToLines(node: LiteralNode): string[] {
  if (node.kind === 'scalar') return [node.value];
  if (node.items.every(it => it.kind === 'scalar')) {
    return [node.items.map(it => (it as { value: string }).value).join(' ')];
  }
  return node.items.flatMap(literalToLines);
}

/** Format a single value literal as the stdin text for it. */
export function formatValueForStdin(raw: string): string {
  const v = (raw ?? '').trim().replace(/,+$/, '').trim();
  if (!v) return '';
  const parsed = parseLiteral(v, 0);
  // Only rewrite when the literal accounts for the WHOLE value — a partial
  // match means this is prose (or already-shaped stdin) and stays verbatim.
  if (parsed && skipWs(v, parsed.next) >= v.length) return literalToLines(parsed.node).join('\n');
  return v;
}

// ─── Argument lists ──────────────────────────────────────────────────────────

export interface StdinAssignment { name: string; value: string }

/**
 * Split `nums = [1,2], k = 2` into its named arguments. Commas inside brackets
 * or quotes don't split, and `==` / `<=` / `>=` / `!=` are not assignments.
 * Returns null when the text isn't an argument list at all.
 */
export function splitAssignments(src: string): StdinAssignment[] | null {
  const marks: { name: string; nameStart: number; eq: number }[] = [];
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[' || ch === '(' || ch === '{') { depth++; continue; }
    if (ch === ']' || ch === ')' || ch === '}') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0 || ch !== '=') continue;
    // Comparison / compound operators are not assignments.
    if (src[i + 1] === '=' || '=!<>+-*/%'.includes(src[i - 1] ?? '')) continue;

    let j = i - 1;
    while (j >= 0 && /[ \t]/.test(src[j])) j--;
    const nameEnd = j + 1;
    while (j >= 0 && /[A-Za-z0-9_$]/.test(src[j])) j--;
    const nameStart = j + 1;
    const name = src.slice(nameStart, nameEnd);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) continue;

    // The name must open a new argument: start of text, or just past a
    // top-level comma / newline / semicolon. Anything else is prose.
    let k = nameStart - 1;
    while (k >= 0 && /[ \t]/.test(src[k])) k--;
    if (k >= 0 && !',;\n'.includes(src[k])) continue;

    marks.push({ name, nameStart, eq: i });
  }

  if (!marks.length) return null;
  // Text ahead of the first argument means this is a sentence that happens to
  // contain an "=", not an argument list.
  if (src.slice(0, marks[0].nameStart).trim()) return null;

  return marks.map((m, idx) => ({
    name: m.name,
    value: src.slice(m.eq + 1, idx + 1 < marks.length ? marks[idx + 1].nameStart : src.length),
  }));
}

/**
 * Test-case INPUT literal → stdin. Each named argument becomes its own line
 * (arrays flattened); non-assignment text is returned as written.
 */
export function normalizeStdinInput(raw: string): string {
  const text = (raw ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const args = splitAssignments(text);
  if (!args) return text;
  return args.map(a => formatValueForStdin(a.value)).join('\n');
}

/**
 * Test-case OUTPUT literal → the exact text the program is expected to print.
 * Arrays/strings are unwrapped the same way, and Python's `True`/`False` is
 * lowered to the literal every supported runtime actually prints — papers mix
 * the two casings and an unlowered `False` can never match.
 */
export function normalizeStdinOutput(raw: string): string {
  const text = (raw ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const args = splitAssignments(text);
  const value = args
    ? args.map(a => formatValueForStdin(a.value)).join('\n')
    : formatValueForStdin(text);
  return /^(true|false)$/i.test(value) ? value.toLowerCase() : value;
}
