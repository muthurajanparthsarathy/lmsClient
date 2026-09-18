// ─────────────────────────────────────────────────────────────────────────────
// Shared question-document parser — used by the "Add Question via → Document"
// flow in BOTH question-form folders (component/questionforms and
// student/YouDo/assessment/questionforms) so the parsing logic isn't duplicated.
//
// Input is plain text with its line structure intact; `docTextExtract.ts` turns
// an uploaded .txt / .docx / .pdf into that.
//
// Expected format (one blank line between questions):
//
//   Q: What is 2 + 2?
//   A) 3
//   B) 4
//   C) 5
//   D) 6
//   Answer: B
//   Difficulty: Easy
//
// Tolerant of: "Question:" instead of "Q:", "A." / "1)" option markers,
// multi-answer ("Answer: B, C"), and a missing Difficulty (defaults to medium).
// The output shape matches the `GeneratedQuestion` objects the forms already
// consume via `handleAIGeneratedQuestions`, so parsed questions drop straight
// into the editor by difficulty.
// ─────────────────────────────────────────────────────────────────────────────

import { extractDocumentText } from './docTextExtract';
import { normalizeStdinInput, normalizeStdinOutput } from './testCaseStdin';

export interface ParsedQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  type: 'multiple-choice';
  title: string;
  description: string;          // the question text (plain)
  options: ParsedQuestionOption[];
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string;
}

const DIFF_MAP: Record<string, 'easy' | 'medium' | 'hard'> = {
  easy: 'easy', beginner: 'easy', simple: 'easy',
  medium: 'medium', intermediate: 'medium', moderate: 'medium',
  hard: 'hard', advanced: 'hard', difficult: 'hard', expert: 'hard',
};

const normalizeDifficulty = (raw?: string): 'easy' | 'medium' | 'hard' => {
  if (!raw) return 'medium';
  const k = raw.trim().toLowerCase();
  return DIFF_MAP[k] || 'medium';
};

// Turn an option marker letter (A/B/C/D…) or number (1/2/3…) into a 0-based index.
const markerToIndex = (marker: string): number => {
  const m = marker.trim().toUpperCase();
  if (/^[A-Z]$/.test(m)) return m.charCodeAt(0) - 65;
  const n = parseInt(m, 10);
  return Number.isNaN(n) ? -1 : n - 1;
};

let uid = 0;
const nid = (p: string) => `${p}-${Date.now()}-${uid++}`;

/**
 * Parse raw .txt content into questions. Returns [] when nothing parseable is
 * found (caller should surface a friendly message).
 */
export function parseQuestionsTxt(raw: string): ParsedQuestion[] {
  if (!raw || !raw.trim()) return [];

  // Split into blocks on one-or-more blank lines.
  const blocks = raw
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .filter(Boolean);

  const out: ParsedQuestion[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let questionText = '';
    const optionLines: { marker: string; text: string }[] = [];
    let answerRaw = '';
    let difficultyRaw = '';
    let explanation = '';

    for (const line of lines) {
      // Question — "Q:" or "Question:" (also a bare first line fallback below).
      const qm = line.match(/^(?:q|question)\s*[:.)-]\s*(.+)$/i);
      if (qm) { questionText = qm[1].trim(); continue; }

      // Answer — "Answer: B" / "Ans: B, C" / "Correct: B".
      const am = line.match(/^(?:answer|ans|correct)\s*[:.)-]\s*(.+)$/i);
      if (am) { answerRaw = am[1].trim(); continue; }

      // Difficulty — "Difficulty: Easy" / "Level: Hard".
      const dm = line.match(/^(?:difficulty|level)\s*[:.)-]\s*(.+)$/i);
      if (dm) { difficultyRaw = dm[1].trim(); continue; }

      // Explanation — optional.
      const em = line.match(/^(?:explanation|explain|reason)\s*[:.)-]\s*(.+)$/i);
      if (em) { explanation = em[1].trim(); continue; }

      // Option — "A) text" / "A. text" / "1) text" / "(A) text".
      const om = line.match(/^\(?\s*([A-Za-z]|\d{1,2})\s*[).:\-]\s*(.+)$/);
      if (om) { optionLines.push({ marker: om[1], text: om[2].trim() }); continue; }

      // First non-tagged line with no question yet → treat as the question text.
      if (!questionText) { questionText = line; continue; }
    }

    if (!questionText || optionLines.length < 2) continue; // not a usable MCQ

    // Resolve correct answer indices (supports "B" or "B, C" or "2").
    const correctIdx = new Set<number>();
    answerRaw
      .split(/[,\s/]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(tok => { const i = markerToIndex(tok); if (i >= 0) correctIdx.add(i); });

    const options: ParsedQuestionOption[] = optionLines.map((o, i) => ({
      id: nid('opt'),
      text: o.text,
      isCorrect: correctIdx.has(i) || correctIdx.has(markerToIndex(o.marker)),
    }));

    out.push({
      type: 'multiple-choice',
      title: questionText.slice(0, 80),
      description: questionText,
      options,
      difficulty: normalizeDifficulty(difficultyRaw),
      ...(explanation ? { explanation } : {}),
    });
  }

  return out;
}

/** Read an uploaded document (.txt / .docx / .pdf) and parse it. */
export async function parseQuestionsFile(file: File): Promise<ParsedQuestion[]> {
  return parseQuestionsTxt(await extractDocumentText(file));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMMING parser — fields differ from MCQ (test cases instead of options).
//
//   Title: Reverse a String
//   Description: Return the reverse of the input string.
//   Difficulty: Easy
//   Constraint: 1 <= length <= 1000
//   Input: abc
//   Output: cba
//   Input: hello
//   Output: olleh
//   Hidden Test Cases:
//   Input: world
//   Output: dlrow
//   ... (e.g. 5 hidden cases)
//
// Each consecutive Input/Output pair → one test case. Hidden cases (used for
// grading, not shown to students) can be declared two ways:
//   • a "Hidden Test Cases:" (or "Hidden:") section header — every Input/Output
//     pair after it is hidden, until a "Sample/Visible/Public Test Cases:" header;
//   • inline per pair via "Hidden Input:" / "Hidden Output:".
// Visible cases are emitted first (the first one is the sample), hidden after.
// Output shape matches the objects the programming form's
// `handleIncomingProgQuestions` maps (questionType + title + description +
// constraints[] + testCases[] with isSample/isHidden flags).
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedTestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
  points: number;
  explanation: string;
  sequence: number;
}

export interface ParsedProgrammingQuestion {
  questionType: 'programming';
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  constraints: string[];
  testCases: ParsedTestCase[];
  /** Marks declared on the paper's header line, when it carries one. */
  marks?: number;
}

/**
 * Visible cases first (so the form's "Test Case 1 · Sample" is a real,
 * student-visible sample), hidden cases after for grading; then renumber and
 * label. Only the first visible case is flagged as the sample. A label the
 * document supplied of its own is kept.
 */
function orderTestCases(testCases: ParsedTestCase[]): ParsedTestCase[] {
  return [
    ...testCases.filter(tc => !tc.isHidden),
    ...testCases.filter(tc => tc.isHidden),
  ].map((tc, i) => ({
    ...tc,
    sequence: i,
    isSample: i === 0 && !tc.isHidden,
    explanation: tc.explanation?.trim() || (tc.isHidden ? `Hidden Test Case ${i + 1}` : `Test Case ${i + 1}`),
  }));
}

function parseProgrammingBlocks(raw: string): ParsedProgrammingQuestion[] {
  if (!raw || !raw.trim()) return [];

  const blocks = raw
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .filter(Boolean);

  const out: ParsedProgrammingQuestion[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let title = '';
    let description = '';
    let difficultyRaw = '';
    const constraints: string[] = [];
    const testCases: ParsedTestCase[] = [];
    let hiddenSection = false;   // toggled on by a "Hidden Test Cases:" section header

    // A test case is assembled across lines so multi-line stdin/stdout works:
    // continuation lines after an "Input:"/"Output:" are appended until the next
    // marker, then flushed into one test case. A case is emitted only once it
    // has an Output (matches the original "push on Output" behaviour).
    let curInput: string[] | null = null;
    let curOutput: string[] | null = null;
    let curHidden = false;
    let mode: 'input' | 'output' | null = null;

    const flush = () => {
      if (curOutput !== null) {
        testCases.push({
          input: (curInput ?? []).join('\n'),
          expectedOutput: curOutput.join('\n'),
          isSample: false,
          isHidden: curHidden,
          points: 1,
          explanation: '',
          sequence: 0,
        });
      }
      curInput = null; curOutput = null; curHidden = false; mode = null;
    };

    for (const line of lines) {
      const tm = line.match(/^(?:title|name)\s*[:.)-]\s*(.+)$/i);
      if (tm) { flush(); title = tm[1].trim(); continue; }

      const dm = line.match(/^(?:description|desc|problem)\s*[:.)-]\s*(.+)$/i);
      if (dm) { flush(); description = dm[1].trim(); continue; }

      const lm = line.match(/^(?:difficulty|level)\s*[:.)-]\s*(.+)$/i);
      if (lm) { flush(); difficultyRaw = lm[1].trim(); continue; }

      const cm = line.match(/^(?:constraint|constraints)\s*[:.)-]\s*(.+)$/i);
      if (cm) { flush(); constraints.push(cm[1].trim()); continue; }

      // ── Section headers (whole line, no value) switch which bucket the
      //    following Input/Output pairs land in. ──
      //    "Hidden Test Cases:" / "Hidden Tests:" / "Hidden:"      → hidden
      //    "Sample/Visible/Public Test Cases:" (or "…Tests:")      → visible
      if (/^hidden(?:\s*(?:test\s*cases?|tests?))?\s*:?\s*$/i.test(line)) { flush(); hiddenSection = true; continue; }
      if (/^(?:sample|visible|public)(?:\s*(?:test\s*cases?|tests?))?\s*:?\s*$/i.test(line)) { flush(); hiddenSection = false; continue; }

      // ── Inline hidden markers: "Hidden Input:" / "Hidden Output:" force a
      //    single pair hidden regardless of the current section. ──
      const him = line.match(/^(?:hidden\s*input|h\s*input|hinput)\s*[:.)-]\s*(.*)$/i);
      if (him) { flush(); curInput = [him[1]]; curHidden = true; mode = 'input'; continue; }

      const hom = line.match(/^(?:hidden\s*(?:output|expected)|h\s*output|houtput)\s*[:.)-]\s*(.*)$/i);
      if (hom) { curOutput = [hom[1]]; curHidden = true; mode = 'output'; continue; }

      // A new "Input:" starts a fresh test case (flush the previous one first);
      // "Output:" belongs to the input currently being assembled.
      const im = line.match(/^(?:input|in)\s*[:.)-]\s*(.*)$/i);
      if (im) { flush(); curInput = [im[1]]; curHidden = hiddenSection; mode = 'input'; continue; }

      const om = line.match(/^(?:output|out|expected)\s*[:.)-]\s*(.*)$/i);
      if (om) { curOutput = [om[1]]; if (!curHidden) curHidden = hiddenSection; mode = 'output'; continue; }

      // Untagged line → continuation of the current Input/Output (multi-line
      // stdin/stdout), else the title (if none yet), else the description.
      if (mode === 'input' && curInput) { curInput.push(line); continue; }
      if (mode === 'output' && curOutput) { curOutput.push(line); continue; }
      if (!title) { title = line; continue; }
      description = description ? `${description} ${line}` : line;
    }
    flush(); // emit the trailing test case

    if (!title && !description) continue;

    out.push({
      questionType: 'programming',
      title: title || 'Untitled Programming Question',
      description,
      difficulty: normalizeDifficulty(difficultyRaw),
      constraints,
      testCases: orderTestCases(testCases),
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT-PAPER parser — the shape trainers actually hand us as .docx / .pdf:
//
//   Minimum Difference Between Highest and Lowest of K Scores | Easy | 10 Marks
//   Problem Statement: You are given an integer array nums, ...
//   Input Format
//   An integer array nums.
//   An integer k.
//   Output Format
//   A single integer: the minimum possible difference ...
//   Constraints
//   1 <= k <= nums.length <= 1000
//   Test Cases
//   Test Case 1
//   Input:
//   nums = [90,80,70,60,50], k = 2
//   Output:
//   10
//   Expected Complexity: O (n log n) time and O (1) extra space
//
// Questions are split on the "Title | Difficulty | Marks" header line — or, for
// a paper without those, on each "Problem Statement" with the line above it as
// the title — so the exam preamble (Topic / Date / Total Marks) is dropped.
//
// The test-case literal is rewritten into real stdin by testCaseStdin.ts, since
// that is what every runner feeds the program:
//   "nums = [90,80,70,60,50], k = 2"  →  "90 80 70 60 50\n2"
// ─────────────────────────────────────────────────────────────────────────────

type DocSection = 'statement' | 'inputFormat' | 'outputFormat' | 'constraints' | 'complexity' | 'notes' | 'cases';

interface DocHeader { title: string; difficulty?: string; marks?: number }

const HEADER_DIFF = /^(easy|medium|hard|beginner|intermediate|advanced|simple|moderate|difficult|expert)$/i;
const HEADER_MARKS = /^(\d+(?:\.\d+)?)\s*(?:marks?|points?|pts?)$/i;

/** "Find Pivot Index | Easy | 10 Marks" → title + difficulty + marks, order-insensitive. */
function parseDocHeader(line: string): DocHeader | null {
  if (!line.includes('|')) return null;
  const parts = line.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let difficulty: string | undefined;
  let marks: number | undefined;
  const rest: string[] = [];
  for (const p of parts) {
    if (difficulty === undefined && HEADER_DIFF.test(p)) { difficulty = p.toLowerCase(); continue; }
    const m = marks === undefined ? p.match(HEADER_MARKS) : null;
    if (m) { marks = parseFloat(m[1]); continue; }
    rest.push(p);
  }
  // A pipe inside prose (or a table row) is not a question header.
  if (difficulty === undefined && marks === undefined) return null;
  const title = rest.join(' | ').trim();
  return title ? { title, difficulty, marks } : null;
}

const SECTION_RES: Array<[RegExp, DocSection]> = [
  [/^problem\s*statement\b/i,                         'statement'],
  [/^(?:problem|description|question)(?=\s*[:.\-])/i, 'statement'],
  [/^input\s*format\b/i,                              'inputFormat'],
  [/^output\s*format\b/i,                             'outputFormat'],
  [/^constraints?\b/i,                                'constraints'],
  [/^expected\s*(?:time\s*|space\s*)?complexity\b/i,  'complexity'],
  [/^(?:notes?|explanation)(?=\s*[:.\-]|\s*$)/i,      'notes'],
];

const CASES_HEADER  = /^(?:test\s*cases?|sample\s*test\s*cases?|examples?)\s*[:.]?\s*$/i;
const HIDDEN_HEADER = /^hidden\s*(?:test\s*cases?|tests?)\s*[:.]?\s*$/i;
const TC_HEADER     = /^(hidden\s+)?(?:test\s*case|example|case)\s*#?\s*\d*\s*[:.]?\s*$/i;
const TC_INPUT      = /^(?:sample\s*|hidden\s*)?inputs?\s*\d*\s*:\s*(.*)$/i;
const TC_OUTPUT     = /^(?:sample\s*|hidden\s*)?(?:expected\s*)?outputs?\s*\d*\s*:\s*(.*)$/i;
const TC_EXPL       = /^(?:explanation|note)s?\s*:\s*(.*)$/i;

/** Leading bullet / numbering a paper (or a PDF text layer) puts on list items. */
const BULLET_RE = /^\s*(?:[•·▪◦●‣⁃*+]|-\s|\(?\d+[.)]\s|\(?[a-z][.)]\s)/i;
const isBulleted = (s: string): boolean => BULLET_RE.test(s);
const stripBullet = (s: string): string => s.replace(BULLET_RE, '').trim();

// ── Word wrap repair ─────────────────────────────────────────────────────────
// A .docx gives us one line per paragraph, but a PDF gives one line per RENDERED
// line, so a paragraph or a bullet arrives pre-chopped. These re-join it. Both
// are no-ops on .docx/.txt input, where the lines are already whole.

/** A bulleted item runs until the next bullet. */
function joinBulletWrapped(lines: string[]): string[] {
  return lines.reduce<string[]>((out, l) => {
    if (out.length && isBulleted(out[out.length - 1]) && !isBulleted(l)) out[out.length - 1] += ` ${l}`;
    else out.push(l);
    return out;
  }, []);
}

/** A prose line that doesn't finish a sentence continues on the next one. */
function joinProseWrapped(lines: string[]): string[] {
  return lines.reduce<string[]>((out, l) => {
    if (out.length && !/[.!?:;]$/.test(out[out.length - 1])) out[out.length - 1] += ` ${l}`;
    else out.push(l);
    return out;
  }, []);
}

interface DocSectionHit { section: DocSection; hidden: boolean; rest: string }

function matchDocSection(line: string): DocSectionHit | null {
  if (HIDDEN_HEADER.test(line)) return { section: 'cases', hidden: true, rest: '' };
  if (CASES_HEADER.test(line)) return { section: 'cases', hidden: false, rest: '' };
  for (const [re, section] of SECTION_RES) {
    const m = line.match(re);
    if (!m) continue;
    // Keep whatever followed the header on the same line ("Problem Statement: You are…").
    const rest = line.slice(m[0].length).replace(/^\s*[:.–—-]?\s*/, '').trim();
    return { section, hidden: false, rest };
  }
  return null;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The Problem Description is stored as an HTML content block (the editor is a
 * contentEditable and the student view renders it with dangerouslySetInnerHTML),
 * so the paper's sections are rebuilt as real markup rather than a run-on line.
 */
function buildDescriptionHtml(d: {
  statement: string[]; inputFormat: string[]; outputFormat: string[]; complexity: string[]; notes: string[];
}): string {
  const out: string[] = [];
  const para = (lines: string[]) => joinProseWrapped(lines).map(l => `<p>${escapeHtml(l)}</p>`).join('');
  const list = (lines: string[]) =>
    `<ul>${joinBulletWrapped(lines).map(l => `<li>${escapeHtml(stripBullet(l))}</li>`).join('')}</ul>`;

  out.push(para(d.statement));
  if (d.inputFormat.length) out.push('<p><b>Input Format</b></p>', list(d.inputFormat));
  if (d.outputFormat.length) out.push('<p><b>Output Format</b></p>', list(d.outputFormat));
  if (d.notes.length) out.push('<p><b>Notes</b></p>', para(d.notes));
  if (d.complexity.length) out.push(`<p><b>Expected Complexity:</b> ${escapeHtml(d.complexity.join(' '))}</p>`);
  return out.join('');
}

interface RawDocCase { input: string[]; output: string[]; explanation: string[]; hidden: boolean }

function parseDocChunk(header: DocHeader, body: string[]): ParsedProgrammingQuestion | null {
  const statement: string[] = [];
  const inputFormat: string[] = [];
  const outputFormat: string[] = [];
  const constraints: string[] = [];
  const complexity: string[] = [];
  const notes: string[] = [];
  const cases: RawDocCase[] = [];

  let section: DocSection = 'statement';
  let hiddenDefault = false;
  let cur: RawDocCase | null = null;
  let capture: 'input' | 'output' | 'explanation' | null = null;

  const bucket = (): string[] =>
    section === 'inputFormat' ? inputFormat
      : section === 'outputFormat' ? outputFormat
      : section === 'constraints' ? constraints
      : section === 'complexity' ? complexity
      : section === 'notes' ? notes
      : statement;

  const openCase = (hidden: boolean): RawDocCase => {
    cur = { input: [], output: [], explanation: [], hidden };
    cases.push(cur);
    capture = null;
    return cur;
  };

  // Test-case markers are matched before the section headers so a per-case
  // "Explanation:" stays with its case instead of ending the Test Cases block.
  const takeCaseMarker = (line: string): boolean => {
    const head = line.match(TC_HEADER);
    if (head) { openCase(hiddenDefault || !!head[1]); return true; }

    const inp = line.match(TC_INPUT);
    if (inp) {
      const c = cur ?? openCase(hiddenDefault || /^hidden/i.test(line));
      capture = 'input';
      if (inp[1].trim()) c.input.push(inp[1].trim());
      return true;
    }
    const outp = line.match(TC_OUTPUT);
    if (outp) {
      const c = cur ?? openCase(hiddenDefault);
      capture = 'output';
      if (outp[1].trim()) c.output.push(outp[1].trim());
      return true;
    }
    const expl = line.match(TC_EXPL);
    if (expl && cur) {
      capture = 'explanation';
      if (expl[1].trim()) cur.explanation.push(expl[1].trim());
      return true;
    }
    return false;
  };

  // An untagged line inside the Test Cases block continues the value currently
  // being collected — that's how a multi-line stdin survives. Lives in its own
  // closure so `cur` reads at its declared type (flow analysis can't see the
  // assignments `openCase` makes from inside a nested function).
  const takeCaseContinuation = (line: string): boolean => {
    if (!cur || !capture) return false;
    cur[capture].push(line);
    return true;
  };

  for (const rawLine of body) {
    const line = rawLine.trim();
    // A blank line closes the value being collected but not the question.
    if (!line) { capture = null; continue; }

    if (section === 'cases' && takeCaseMarker(line)) continue;

    const hit = matchDocSection(line);
    if (hit) {
      section = hit.section;
      if (hit.section === 'cases') { hiddenDefault = hit.hidden; cur = null; }
      capture = null;
      if (hit.rest && hit.section !== 'cases') bucket().push(hit.rest);
      continue;
    }

    // A paper that jumps straight to "Test Case 1" without a "Test Cases" header.
    if (section !== 'cases' && (TC_HEADER.test(line) || TC_INPUT.test(line))) {
      section = 'cases';
      hiddenDefault = false;
      cur = null;
      if (takeCaseMarker(line)) continue;
    }

    if (section === 'cases') {
      if (takeCaseContinuation(line)) continue;
      // Stray prose between cases — keep it rather than drop it silently.
      statement.push(line);
      continue;
    }

    bucket().push(line);
  }

  const testCases: ParsedTestCase[] = cases
    .map(c => ({
      input: normalizeStdinInput(c.input.join('\n')),
      expectedOutput: normalizeStdinOutput(c.output.join('\n')),
      isSample: false,
      isHidden: c.hidden,
      points: 1,
      explanation: c.explanation.join(' ').trim(),
      sequence: 0,
    }))
    .filter(tc => tc.input !== '' || tc.expectedOutput !== '');

  const description = buildDescriptionHtml({ statement, inputFormat, outputFormat, complexity, notes });
  if (!header.title && !description) return null;

  return {
    questionType: 'programming',
    // A PDF renders Word's auto-numbering as literal text ("1. Find Pivot Index").
    title: stripBullet(header.title) || 'Untitled Programming Question',
    description,
    difficulty: normalizeDifficulty(header.difficulty),
    constraints: joinBulletWrapped(constraints).map(stripBullet).filter(Boolean),
    testCases: orderTestCases(testCases),
    ...(header.marks !== undefined ? { marks: header.marks } : {}),
  };
}

/**
 * Split a paper into one chunk per question. Returns [] when the text carries
 * none of the assessment-paper landmarks, which is the caller's signal to fall
 * back to the simpler `Title:/Input:/Output:` block format.
 */
function splitDocChunks(lines: string[]): { header: DocHeader; body: string[] }[] {
  const found: { at: number; header: DocHeader; bodyStart: number }[] = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const single = parseDocHeader(line);
    // A PDF wraps a long header, stranding the tail ("… | Easy | 10" / "Marks")
    // on the next line. Re-join when doing so recovers the marks.
    const next = (lines[i + 1] ?? '').trim();
    const canJoin = !!next && next.split(/\s+/).length <= 3 && !/[|:]/.test(next);
    const joined = canJoin ? parseDocHeader(`${line} ${next}`) : null;

    if (joined && (!single || (single.marks === undefined && joined.marks !== undefined))) {
      found.push({ at: i, header: joined, bodyStart: i + 2 });
    } else if (single) {
      found.push({ at: i, header: single, bodyStart: i + 1 });
    }
  });

  if (found.length) {
    return found.map((f, n) => ({
      header: f.header,
      body: lines.slice(f.bodyStart, n + 1 < found.length ? found[n + 1].at : lines.length),
    }));
  }

  // No "Title | Difficulty | Marks" line — anchor on "Problem Statement" and
  // take the nearest non-blank line above it as the title.
  const stmtIdx: number[] = [];
  lines.forEach((l, i) => { if (/^\s*problem\s*statement\b/i.test(l)) stmtIdx.push(i); });
  if (!stmtIdx.length) return [];

  const titleIdx = stmtIdx.map((s, n) => {
    let t = s - 1;
    while (t >= 0 && !lines[t].trim()) t--;
    // Don't reach back into the previous question for a title.
    return t > (n === 0 ? -1 : stmtIdx[n - 1]) ? t : -1;
  });

  return stmtIdx.map((s, n) => ({
    header: { title: titleIdx[n] >= 0 ? lines[titleIdx[n]].trim() : '' },
    body: lines.slice(s, n + 1 < stmtIdx.length ? (titleIdx[n + 1] >= 0 ? titleIdx[n + 1] : stmtIdx[n + 1]) : lines.length),
  }));
}

/** Parse an assessment paper. Returns [] when the text isn't in that shape. */
export function parseProgrammingDoc(raw: string): ParsedProgrammingQuestion[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  return splitDocChunks(lines)
    .map(c => parseDocChunk(c.header, c.body))
    .filter((q): q is ParsedProgrammingQuestion => !!q);
}

/**
 * Parse programming questions out of a document. Assessment papers
 * ("Problem Statement" / "Test Cases" sections) are tried first; anything else
 * falls back to the simpler `Title:/Description:/Input:/Output:` block format.
 */
export function parseProgrammingTxt(raw: string): ParsedProgrammingQuestion[] {
  const fromDoc = parseProgrammingDoc(raw);
  return fromDoc.length ? fromDoc : parseProgrammingBlocks(raw);
}

/** Read an uploaded document (.txt / .docx / .pdf) and parse it. */
export async function parseProgrammingFile(file: File): Promise<ParsedProgrammingQuestion[]> {
  return parseProgrammingTxt(await extractDocumentText(file));
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE parser — SQL questions carry a sample query + expected result.
//
//   Title: Top customers
//   Description: Find the top 5 customers by revenue.
//   Difficulty: Medium
//   Query: SELECT name FROM customers ORDER BY revenue DESC LIMIT 5;
//   Result: Alice | Bob | Carol
//   Constraint: read-only
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedDatabaseQuestion {
  questionType: 'database';
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sampleQuery: string;
  sampleResult: string;
  constraints: string[];
}

export function parseDatabaseTxt(raw: string): ParsedDatabaseQuestion[] {
  if (!raw || !raw.trim()) return [];

  const blocks = raw
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .filter(Boolean);

  const out: ParsedDatabaseQuestion[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let title = '';
    let description = '';
    let difficultyRaw = '';
    let sampleQuery = '';
    let sampleResult = '';
    const constraints: string[] = [];

    for (const line of lines) {
      const tm = line.match(/^(?:title|name)\s*[:.)-]\s*(.+)$/i);
      if (tm) { title = tm[1].trim(); continue; }
      const dm = line.match(/^(?:description|desc|problem)\s*[:.)-]\s*(.+)$/i);
      if (dm) { description = dm[1].trim(); continue; }
      const lm = line.match(/^(?:difficulty|level)\s*[:.)-]\s*(.+)$/i);
      if (lm) { difficultyRaw = lm[1].trim(); continue; }
      const qm = line.match(/^(?:query|sql|sample\s*query)\s*[:.)-]\s*(.+)$/i);
      if (qm) { sampleQuery = qm[1].trim(); continue; }
      const rm = line.match(/^(?:result|output|expected|sample\s*result)\s*[:.)-]\s*(.+)$/i);
      if (rm) { sampleResult = rm[1].trim(); continue; }
      const cm = line.match(/^(?:constraint|constraints)\s*[:.)-]\s*(.+)$/i);
      if (cm) { constraints.push(cm[1].trim()); continue; }
      if (!title) { title = line; continue; }
      description = description ? `${description} ${line}` : line;
    }

    if (!title && !description) continue;

    out.push({
      questionType: 'database',
      title: title || 'Untitled Database Question',
      description,
      difficulty: normalizeDifficulty(difficultyRaw),
      sampleQuery,
      sampleResult,
      constraints,
    });
  }

  return out;
}

/** Read an uploaded document (.txt / .docx / .pdf) and parse it. */
export async function parseDatabaseFile(file: File): Promise<ParsedDatabaseQuestion[]> {
  return parseDatabaseTxt(await extractDocumentText(file));
}
