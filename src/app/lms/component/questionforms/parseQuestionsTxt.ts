// ─────────────────────────────────────────────────────────────────────────────
// Shared .txt question parser — used by the "Add Question via → Document" flow
// in BOTH question-form folders (component/questionforms and
// student/YouDo/assessment/questionforms) so the parsing logic isn't duplicated.
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

/** Read a File (txt) and parse it. Rejects non-text files gracefully. */
export async function parseQuestionsFile(file: File): Promise<ParsedQuestion[]> {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
    throw new Error('Only .txt files are supported.');
  }
  const text = await file.text();
  return parseQuestionsTxt(text);
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
}

export function parseProgrammingTxt(raw: string): ParsedProgrammingQuestion[] {
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

    // Visible cases first (so the form's "Test Case 1 · Sample" is a real,
    // student-visible sample), hidden cases after for grading; then renumber +
    // label. Only the first visible case is flagged as the sample.
    const orderedTCs: ParsedTestCase[] = [
      ...testCases.filter(tc => !tc.isHidden),
      ...testCases.filter(tc => tc.isHidden),
    ].map((tc, i) => ({
      ...tc,
      sequence: i,
      isSample: i === 0 && !tc.isHidden,
      explanation: tc.isHidden ? `Hidden Test Case ${i + 1}` : `Test Case ${i + 1}`,
    }));

    out.push({
      questionType: 'programming',
      title: title || 'Untitled Programming Question',
      description,
      difficulty: normalizeDifficulty(difficultyRaw),
      constraints,
      testCases: orderedTCs,
    });
  }

  return out;
}

export async function parseProgrammingFile(file: File): Promise<ParsedProgrammingQuestion[]> {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
    throw new Error('Only .txt files are supported.');
  }
  const text = await file.text();
  return parseProgrammingTxt(text);
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

export async function parseDatabaseFile(file: File): Promise<ParsedDatabaseQuestion[]> {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
    throw new Error('Only .txt files are supported.');
  }
  const text = await file.text();
  return parseDatabaseTxt(text);
}
