// Adapter that lets the SHARED question-authoring forms
// (`component/questionforms/*` — MCQQuestionForm, ProgrammingQuestionForm,
// FrontendQuestionForm, DatabaseQuestionForm, OthersAddQuestionForm) write to
// an External Assessment without any change to those forms.
//
// WHY THIS EXISTS
// The forms persist through `questionApi`, which builds LMS pedagogy-tree URLs
// (/mcq-question-add/<entityType>/<entityId>/exercise/<exerciseId>). An
// external assessment has no entity and no course, so those URLs cannot serve
// it. Rather than fork ~20k lines of authoring UI, `questionApi` recognises
// the sentinel entityType `EXTERNAL_ENTITY` and delegates here.
//
// Routing happens two ways, because one is not enough — see the
// "Active-authoring context" note below.
//
// This module owns the two translations that make the reuse possible:
//   1. LMS question payload  →  ExternalQuestion
//   2. External API envelope →  the `{ success, message:[{key,value}], data }`
//      envelope the forms expect back

import { api } from '@/app/lms/pages/clientmanagement/lib/apiClient';
import type { ExternalQuestion, ExternalTestCase } from './externalAssessment';

/** Sentinel passed as `entityType` to route a call to an external assessment. */
export const EXTERNAL_ENTITY = 'external' as const;

const ADMIN = '/api/admin/external';

// ─── Active-authoring context ─────────────────────────────────────────────
//
// The entityType sentinel alone is not enough to route every call. Several
// child forms do NOT read `exerciseData.entityType`; ProgrammingQuestionForm,
// for instance, derives it from `nodeType` and falls back to a hardcoded
// 'topics' when that is absent (ProgrammingQuestionForm.tsx:2565):
//
//   const entityType = map[(exerciseData.nodeType || '')…] || 'topics';
//   const entityId   = exerciseData.nodeId || '';
//
// which is exactly how a save reached /question-add/topics/undefined/… and
// 500'd. Passing a different entityType cannot fix that, because the value is
// never consulted.
//
// So External declares itself for the duration of an authoring session: the
// Questions panel sets this while the shared form is mounted and clears it on
// close. Any questionApi call in that window routes to the External API
// regardless of what entityType the form invented.
//
// This is safe because the External authoring surface takes over the whole
// screen — no LMS question authoring can be in flight at the same time. It is
// deliberately a single id rather than a boolean, so a stale flag routes
// nowhere instead of misrouting to the wrong assessment.
let activeExternalAssessmentId: string | null = null;

/**
 * Every id that has been an External authoring context in this page's life.
 *
 * The active flag alone leaves a race: AddQuestionForm refetches its exercise
 * after each save (refreshExerciseData → exerciseApi.getExerciseById), and when
 * the form closes on that same save the context is cleared before the refetch
 * resolves. The in-flight call then took the LMS path and 404'd on
 * `/exercise/<assessmentId>` — an id that is not on the pedagogy tree.
 *
 * This set is never pruned, and that is deliberate: it only ever contains ids
 * External has claimed, so a late call routes to the API that can actually
 * answer it, while no LMS exercise id can ever match.
 */
const knownExternalAssessmentIds = new Set<string>();

/** Begin/end an External authoring session. Pass null to clear. */
export function setExternalAssessmentContext(assessmentId: string | null): void {
  activeExternalAssessmentId = assessmentId || null;
  if (assessmentId) knownExternalAssessmentIds.add(String(assessmentId));
}

/** Is this id an External assessment, whether or not a session is open now? */
export const isExternalAssessmentId = (id?: string | null): boolean =>
  !!id && knownExternalAssessmentIds.has(String(id));

/** Where the External section lives. Everything under it is External-only. */
const EXTERNAL_ROUTE_PREFIX = '/lms/pages/external';

/**
 * Is the browser on the External section right now?
 *
 * The last line of defence for a call that beats every other signal — a hard
 * reload straight onto the page, or a form that fetches before any session is
 * open. On this route there are no LMS exercises to confuse it with: the
 * External surface owns the whole screen, so an exercise lookup here can only
 * be about an external assessment.
 *
 * Guarded for SSR, where there is no location and no in-flight authoring.
 */
const onExternalRoute = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.location?.pathname === 'string'
  && window.location.pathname.startsWith(EXTERNAL_ROUTE_PREFIX);

/** The assessment being authored, or null when no External session is open. */
export function externalAssessmentContext(): string | null {
  return activeExternalAssessmentId;
}

/**
 * True when a questionApi call should be served by the External API — either
 * because the caller tagged it, or because an External authoring session is
 * open.
 */
export const isExternalEntity = (entityType: unknown, exerciseId?: string | null): boolean =>
  String(entityType || '') === EXTERNAL_ENTITY
  || activeExternalAssessmentId !== null
  // Late calls from a form that has already closed — see knownExternalAssessmentIds.
  || isExternalAssessmentId(exerciseId)
  // Early calls that beat the session being opened — see onExternalRoute.
  || onExternalRoute();

/**
 * The assessment id to address.
 *
 * Forms pass the real assessment `_id` as `exerciseId` (that part they do get
 * from exerciseData), so it is preferred; the session id is the fallback for
 * any call that loses it.
 */
export const resolveExternalId = (exerciseId?: string): string =>
  exerciseId || activeExternalAssessmentId || '';

// ─── Envelope helpers ─────────────────────────────────────────────────────
// The forms read `res.data.question` / `res.data.questionId` and surface
// `res.message[0].value` in toasts, so responses must be re-shaped even though
// the External API already returns a perfectly good envelope of its own.

const ok = (message: string, question?: any) => ({
  success: true,
  message: [{ key: 'success', value: message }],
  data: { question: question ?? null, questionId: question?._id ?? '' },
});

// ─── FormData → object ────────────────────────────────────────────────────
// The MCQ form posts multipart when a question or option carries an image.
// Files cannot ride the JSON question API, so they are dropped here and the
// scalar fields are recovered. An image-bearing question still saves; it
// simply saves without the image rather than failing the whole submit.
function fromFormData(fd: FormData): { data: any; droppedFiles: number } {
  const out: any = {};
  let droppedFiles = 0;
  fd.forEach((value, key) => {
    if (value instanceof File) { droppedFiles += 1; return; }
    const raw = String(value);
    // Nested structures arrive JSON-encoded (options, correct answers, …).
    if (/^[[{]/.test(raw.trim())) {
      try { out[key] = JSON.parse(raw); return; } catch { /* fall through */ }
    }
    if (raw === 'true' || raw === 'false') { out[key] = raw === 'true'; return; }
    out[key] = raw;
  });
  return { data: out, droppedFiles };
}

/**
 * Pull the question object(s) out of a form submit envelope.
 *
 * MCQQuestionForm does not post the question at the top level — it wraps it
 * (MCQQuestionForm.tsx:4906):
 *
 *   fd.append('questionsData',    JSON.stringify([question]));
 *   fd.append('questionsData[0]', JSON.stringify(question));
 *   fd.append('tabType', …); fd.append('subcategory', …);
 *
 * so the flattened FormData is `{ questionsData: [ {...} ], tabType, … }` and
 * the question's fields are one level down. Reading the envelope as if it were
 * the question is what produced "Question title is required" on a filled-in
 * form: every candidate key was checked against the WRAPPER, which has none of
 * them.
 *
 * Note `questionsData` — plural. The earlier singular spelling here matched
 * nothing and silently fell through to treating the envelope as the question.
 */
function unwrapQuestions(payload: any): any[] {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object') return [payload];

  // Both spellings, plus the generic one, so a form that renames its field
  // does not silently regress to posting the envelope.
  for (const key of ['questionsData', 'questionData', 'questions', 'question']) {
    const raw = (payload as any)[key];
    if (raw == null) continue;
    let val = raw;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch { continue; }
    }
    // `question` is only an envelope key when it holds an object/array — some
    // payloads use it for the question TEXT, which must not be unwrapped.
    if (typeof val === 'object') return Array.isArray(val) ? val : [val];
  }

  // Indexed fallback (`questionsData[0]`, `questionsData[1]`, …) for a submit
  // that posted only the per-index copies.
  const indexed = Object.keys(payload)
    .filter((k) => /^questions?Data\[\d+\]$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((k) => (payload as any)[k]);
  if (indexed.length) return indexed;

  return [payload];
}

// ─── Raw editor block → mcq* field names ──────────────────────────────────
//
// The MCQ editor's working shape (`QuestionBlock`) is NOT the persisted shape.
// The add path converts it via buildQuestionPayload() before posting, but the
// UPDATE path posts the block verbatim:
//
//   questionApi.updateMCQQuestion(…, withNormalizedScore(currentBlock), …)
//
// and questionApi does that conversion itself, further down the function —
// after the External branch has already routed away. So the adapter has to do
// the same conversion, or an edit would save with a hyphenated type the enum
// rejects AND an empty `mcqQuestionCorrectAnswers`, quietly wiping the answer
// key of every question the author touched.

/** Editor's internal type vocabulary → the persisted enum. */
const EDITOR_TYPE_TO_API: Record<string, string> = {
  'multiple-choice': 'multiple_choice',
  'multiple-select': 'multiple_select',
  'true-false': 'true_false',
  'short-answer': 'short_answer',
  paragraph: 'essay',
  matching: 'matching',
  ordering: 'ordering',
  numeric: 'numeric',
  dropdown: 'dropdown',
  checkboxes: 'checkboxes',
};

const OPTION_BASED = ['multiple-choice', 'multiple-select', 'dropdown', 'checkboxes'];

/**
 * Derive the answer key from an editor block, mirroring
 * MCQQuestionForm.buildQuestionPayload exactly — each question type keeps its
 * answer in a different field, and only the type says which.
 */
function editorCorrectAnswers(b: any): string[] {
  const type = String(b?.type || '');
  if (OPTION_BASED.includes(type)) {
    const correct = asArray(b?.options).filter((o: any) => o?.isCorrect);
    if (type === 'multiple-select' || type === 'checkboxes') {
      return correct.map((o: any) => extractText(o?.text)).filter(Boolean);
    }
    return correct.length ? [extractText(correct[0]?.text)].filter(Boolean) : [];
  }
  if (type === 'short-answer' || type === 'paragraph') {
    const a = extractText(b?.shortAnswer);
    return a ? [a] : [];
  }
  if (type === 'true-false') {
    return b?.trueFalseAnswer == null ? [] : [String(b.trueFalseAnswer)];
  }
  if (type === 'numeric') {
    return b?.numericAnswer == null || b.numericAnswer === '' ? [] : [String(b.numericAnswer)];
  }
  if (type === 'matching') {
    return asArray(b?.matchingPairs).map((p: any) => `${p?.left ?? ''}|${p?.right ?? ''}`);
  }
  if (type === 'ordering') {
    return asArray(b?.orderingItems)
      .slice()
      .sort((x: any, y: any) => Number(x?.order ?? 0) - Number(y?.order ?? 0))
      .map((i: any) => extractText(i?.text))
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalise a raw editor block into the persisted mcq* naming, leaving an
 * already-persisted payload untouched.
 *
 * Detection is on the editor's own signature: a hyphenated `type` it recognises
 * and no `mcqQuestionType`. Anything else passes through unchanged.
 */
function normaliseEditorBlock(q: any): any {
  if (!q || typeof q !== 'object') return q;
  const type = String(q.type || '');
  if (q.mcqQuestionType || !EDITOR_TYPE_TO_API[type]) return q;

  return {
    ...q,
    mcqQuestionType: EDITOR_TYPE_TO_API[type],
    mcqQuestionTitle: q.questionContent?.length ? q.questionContent : q.questionText,
    mcqQuestionDescription: q.description ?? q.mcqQuestionDescription,
    mcqQuestionDifficulty: q.difficulty ?? q.mcqQuestionDifficulty,
    mcqQuestionScore: q.score ?? q.mcqQuestionScore,
    mcqQuestionOptions: asArray(q.options).filter((o: any) => extractText(o?.text)),
    mcqQuestionCorrectAnswers: editorCorrectAnswers(q),
  };
}

// ─── Payload translation ──────────────────────────────────────────────────

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asArray = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

/**
 * LMS source tag → the External `source` enum.
 *
 * The forms stamp COMPOUND tags — `scratch-manual`, `scratch-bank`,
 * `thirdParty`, `ai` — and re-send whatever a question already carried when it
 * is edited. Passing those through unmapped is what produced:
 *
 *   questions.4.source: `scratch-manual` is not a valid enum value
 *
 * Note the ordering: `scratch-bank` must be read as `bank`, not `scratch`,
 * so the bank prefix is tested before the generic scratch one — otherwise a
 * bank pick would be counted against the Manual quota.
 */
export function normaliseSource(raw: any): ExternalQuestion['source'] {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'scratch';
  if (s.includes('bank')) return 'bank';
  if (s.includes('document') || s.includes('upload') || s.includes('doc')) return 'document';
  if (s.includes('thirdparty') || s.includes('other')) return 'thirdParty';
  if (s === 'ai' || s.startsWith('ai') || s.includes('generate')) return 'ai';
  if (s.startsWith('scratch') || s === 'manual') return 'scratch';
  // Unknown tag: default to manual rather than rejecting the save. Losing the
  // provenance of one question is a far smaller failure than losing the
  // question the author just wrote.
  return 'scratch';
}

/**
 * Pull plain text out of whatever the authoring forms call a "title".
 *
 * The MCQ editor is rich-text, so a question's text can arrive as:
 *   • a plain string
 *   • an HTML string  ("<p>What is …?</p>")
 *   • a ProseMirror/TipTap node tree  ({ content: [{ text: "…" }] })
 *   • an array of blocks  (questionContent[])
 *
 * Reading only the plain-string case is why a filled-in question still
 * produced "Question title is required" — the text was there, just not as a
 * string at the key being checked.
 */
export function extractText(v: any, depth = 0): string {
  if (v == null || depth > 6) return '';
  if (typeof v === 'string') {
    // Strip tags, decode the handful of entities a rich-text editor emits,
    // and collapse the whitespace that leaves behind.
    return v
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v.map((x) => extractText(x, depth + 1)).filter(Boolean).join(' ').trim();
  }
  if (typeof v === 'object') {
    // Node shapes, most specific first.
    if (typeof v.text === 'string') return extractText(v.text, depth + 1);
    if (v.content) return extractText(v.content, depth + 1);
    if (typeof v.html === 'string') return extractText(v.html, depth + 1);
    if (typeof v.value === 'string') return extractText(v.value, depth + 1);
    if (typeof v.label === 'string') return extractText(v.label, depth + 1);
  }
  return '';
}

/**
 * The question's text, from whichever field this form happens to use.
 *
 * Order matters: the persisted name first, then the editor's working fields,
 * then the generic ones. `question` is last because some payloads use it for
 * the whole object rather than the text.
 */
function resolveQuestionText(q: any): string {
  const candidates = [
    q?.mcqQuestionTitle,
    q?.questionText,
    q?.questionContent,
    q?.title,
    q?.questionTitle,
    q?.text,
    q?.name,
    q?.question,
  ];
  for (const c of candidates) {
    const t = extractText(c);
    if (t) return t;
  }
  return '';
}

/** Does this payload describe a code question rather than an objective one? */
function looksProgramming(q: any): boolean {
  if (!q) return false;
  const t = String(q.questionType || q.type || '').toLowerCase();
  if (t === 'programming' || t === 'frontend' || t === 'database') return true;
  if (t === 'mcq') return false;
  // No discriminator: infer from the fields present. An MCQ payload always
  // carries mcqQuestionTitle; a programming one carries a title + testCases
  // or solution code.
  if (q.mcqQuestionTitle) return false;
  return !!(q.title && (q.testCases || q.solutions || q.solutionCode));
}

function toTestCases(raw: any): ExternalTestCase[] {
  return asArray(raw).map((c: any) => ({
    input: String(c?.input ?? ''),
    expectedOutput: String(c?.expectedOutput ?? c?.output ?? ''),
    isSample: !!(c?.isSample ?? c?.isPublic),
    isHidden: !!c?.isHidden,
    points: toNum(c?.points ?? c?.score, 0),
    explanation: String(c?.explanation ?? ''),
  }));
}

/**
 * LMS question payload → ExternalQuestion.
 *
 * `source` is stamped by the caller; it defaults to `scratch` so a direct form
 * save is counted as manual.
 */
export function toExternalQuestion(raw: any, source: ExternalQuestion['source'] = 'scratch'): ExternalQuestion {
  const q = raw || {};

  if (looksProgramming(q)) {
    const sol = q.solutions || {};
    return {
      questionKind: 'programming',
      source: normaliseSource(source),
      // The objective fields still carry the marks and difficulty — the
      // External model keeps ONE score field across both kinds so the grader
      // and every counter read the same place.
      mcqQuestionType: 'short_answer',
      mcqQuestionTitle: resolveQuestionText(q),
      mcqQuestionLevel: (q.difficulty || q.mcqQuestionDifficulty || 'easy') as any,
      mcqQuestionScore: toNum(q.score ?? q.points ?? q.mcqQuestionScore, 1),

      title: resolveQuestionText(q),
      description: extractText(q.description),
      category: String(q.category ?? ''),
      tags: asArray(q.tags).map(String),
      executionMode: q.executionMode === 'function' || sol.functionName ? 'function' : 'fullProgram',
      starterMode: (q.starterCode || sol.startedCode) ? 'custom' : 'blank',
      starterCode: String(sol.startedCode ?? q.starterCode ?? ''),
      solutionCode: String(sol.solutionCode ?? q.solutionCode ?? sol.code ?? ''),
      functionName: String(sol.functionName ?? q.functionName ?? ''),
      language: String(sol.language ?? q.language ?? ''),
      constraints: asArray(q.constraints).map(String),
      hints: asArray(q.hints).map(String),
      sampleInput: String(q.sampleInput ?? ''),
      sampleOutput: String(q.sampleOutput ?? ''),
      testCases: toTestCases(q.testCases),
      timeLimit: toNum(q.timeLimit, 2),
      memoryLimit: toNum(q.memoryLimit, 256),
      sequence: toNum(q.sequence, 0),
    };
  }

  // Objective question. The External model mirrors the LMS mcq* field names,
  // so this is mostly a pass-through with coercion.
  const options = asArray(q.mcqQuestionOptions ?? q.options).map((o: any) => ({
    text: extractText(o?.text ?? o?.optionText ?? o),
    isCorrect: !!o?.isCorrect,
    imageUrl: o?.imageUrl ?? null,
  }));

  return {
    questionKind: 'mcq',
    source: normaliseSource(source),
    mcqQuestionType: (q.mcqQuestionType || q.type || 'multiple_choice') as any,
    // Rich-text aware — see resolveQuestionText.
    mcqQuestionTitle: resolveQuestionText(q),
    mcqQuestionDescription: extractText(q.mcqQuestionDescription ?? q.description),
    mcqQuestionLevel: (q.mcqQuestionDifficulty || q.difficulty || 'easy') as any,
    mcqQuestionScore: toNum(q.mcqQuestionScore ?? q.score ?? q.points, 1),
    mcqQuestionOptions: options,
    mcqQuestionCorrectAnswers: asArray(q.mcqQuestionCorrectAnswers).map((x: any) => extractText(x)).filter(Boolean),
    trueFalseAnswer: typeof q.trueFalseAnswer === 'boolean' ? q.trueFalseAnswer : null,
    shortAnswer: String(q.shortAnswer ?? ''),
    essayAnswer: String(q.essayAnswer ?? ''),
    numericAnswer: q.numericAnswer == null || q.numericAnswer === '' ? null : toNum(q.numericAnswer),
    numericTolerance: q.numericTolerance == null || q.numericTolerance === '' ? null : toNum(q.numericTolerance),
    matchingPairs: asArray(q.matchingPairs).map((p: any) => ({
      left: String(p?.left ?? ''), right: String(p?.right ?? ''),
    })),
    orderingItems: asArray(q.orderingItems).map((i: any, idx: number) => ({
      text: String(i?.text ?? i ?? ''), order: toNum(i?.order, idx + 1),
    })),
    sequence: toNum(q.sequence, 0),
  };
}

// ─── The delegated operations ─────────────────────────────────────────────
// Signatures mirror questionApi's so the router can forward its arguments
// unchanged. `exerciseId` is the External assessment's _id.

/**
 * Add one question, or a batch.
 *
 * The MCQ form posts an ARRAY when several questions are saved at once (bank
 * picks, AI batches, document imports). The External API takes one question
 * per call, so a batch is sequential — not Promise.all, because each POST
 * mutates the same parent document and concurrent writes would race on the
 * embedded array.
 */
export async function addExternalQuestion(
  exerciseId: string,
  questionData: any,
  source: ExternalQuestion['source'] = 'scratch',
): Promise<any> {
  const isFormData = typeof FormData !== 'undefined' && questionData instanceof FormData;
  let payload = questionData;
  let droppedFiles = 0;

  if (isFormData) {
    const parsed = fromFormData(questionData);
    payload = parsed.data;
    droppedFiles = parsed.droppedFiles;
  }

  // Unwrap the submit envelope, then convert any raw editor block into the
  // persisted naming. Both steps are needed: the add path posts a wrapped,
  // already-converted question, the update path posts an unwrapped raw block.
  const batch = unwrapQuestions(payload).map(normaliseEditorBlock);
  const saved: any[] = [];
  for (const item of batch) {
    const res = await api.post<{ success: boolean; message?: string; data: any }>(
      `${ADMIN}/assessments/${resolveExternalId(exerciseId)}/questions`,
      toExternalQuestion(item, source),
    );
    saved.push(res?.data?.question);
  }

  const note = droppedFiles > 0
    ? ` (${droppedFiles} image${droppedFiles === 1 ? '' : 's'} skipped — images are not supported on external assessments yet)`
    : '';
  return ok(
    `${saved.length} question${saved.length === 1 ? '' : 's'} added${note}`,
    saved[saved.length - 1],
  );
}

export async function updateExternalQuestion(
  exerciseId: string,
  questionId: string,
  questionData: any,
): Promise<any> {
  let payload = questionData;
  if (typeof FormData !== 'undefined' && questionData instanceof FormData) {
    payload = fromFormData(questionData).data;
  }
  // An update addresses ONE question, so only the first is meaningful even if
  // the form wrapped it in a batch envelope.
  payload = normaliseEditorBlock(unwrapQuestions(payload)[0] ?? {});

  const res = await api.put<{ success: boolean; message?: string; data: any }>(
    `${ADMIN}/assessments/${resolveExternalId(exerciseId)}/questions/${questionId}`,
    // Preserve whatever origin the question already carried — an edit is not
    // a re-sourcing, and re-stamping it would move a bank question into the
    // manual quota.
    toExternalQuestion(payload, normaliseSource(payload?.source)),
  );
  return ok('Question updated successfully', res?.data?.question);
}

export async function deleteExternalQuestion(
  exerciseId: string,
  questionId: string,
): Promise<any> {
  await api.del(`${ADMIN}/assessments/${resolveExternalId(exerciseId)}/questions/${questionId}`);
  return ok('Question deleted successfully');
}

export async function getExternalQuestions(exerciseId: string): Promise<any> {
  const res = await api.get<{ success: boolean; data: any }>(
    `${ADMIN}/assessments/${resolveExternalId(exerciseId)}/questions`,
  );
  const questions = res?.data?.questions ?? [];
  return {
    success: true,
    message: [{ key: 'success', value: 'Questions retrieved' }],
    data: { questions, totalQuestions: questions.length },
  };
}

// ─── External assessment → LMS exercise document ──────────────────────────

/** Questions one code config (programming / other) describes. */
function codeQuestionCount(config: any): number {
  if (!config) return 0;
  if ((config.questionConfigType || 'general') === 'general') {
    return Number(config.generalQuestionCount || 0);
  }
  const counts =
    (config.questionConfigType === 'selectionLevel'
      ? config.selectionLevelCounts
      : config.levelBasedCounts) || {};
  return (['easy', 'medium', 'hard'] as const)
    .reduce((sum, l) => sum + Number(counts?.[l] || 0), 0);
}

/**
 * External `questionSources` (a set) → the LMS `questionSource` + `customSources`
 * pair. One ticked source maps directly; several map to `custom` + the list.
 */
function toLmsSource(sources: string[] = []): { questionSource: string; customSources: string[] } {
  const list = sources.length ? sources : ['scratch'];
  if (list.length === 1) return { questionSource: list[0], customSources: [] };
  return { questionSource: 'custom', customSources: list };
}

/**
 * ExternalQuestion → the LMS question shape the forms read back.
 *
 * The forms filter and count existing questions on LMS field names, e.g.
 * ProgrammingQuestionForm.getDbQuestionsForDiff:
 *
 *   questions.filter(q => q.questionType === 'programming' && q.isActive !== false)
 *   …then groups by `q.difficulty` and sums `q.score || q.points`
 *
 * External stores `questionKind` / `mcqQuestionLevel` / `mcqQuestionScore`, so
 * none of those predicates matched and the form's panel read "Created 0/5"
 * beside a list of four. Emitting BOTH namings keeps the forms counting while
 * leaving the External fields intact for anything reading them directly.
 */
export function toLmsQuestionShape(q: any): any {
  if (!q) return q;
  const isCode = q.questionKind === 'programming';
  const score = Number(q.mcqQuestionScore ?? q.score ?? q.points ?? 0);

  const base = {
    ...q,
    _id: q._id,
    // What the forms filter on — and, on edit, what AddQuestionForm's type
    // inference checks FIRST (line 209). Without it the dispatcher falls
    // through to its MCQ heuristic, which matches any payload carrying
    // `mcqQuestionScore` — and External programming questions carry exactly
    // that, since one score field serves both kinds. A programming question
    // therefore opened in the MCQ form.
    questionType: isCode ? 'programming' : 'mcq',
    difficulty: q.mcqQuestionLevel || 'easy',
    score,
    points: score,
    // Soft-delete flag the LMS filter checks; External hard-deletes, so every
    // question that still exists is active.
    isActive: true,
    title: isCode ? (q.title || q.mcqQuestionTitle || '') : (q.mcqQuestionTitle || ''),
    description: isCode ? (q.description || '') : (q.mcqQuestionDescription || ''),
  };

  if (!isCode) return base;

  // Programming questions need their code fields under the LMS names too, or
  // the editor opens with empty starter/solution boxes.
  return {
    ...base,
    solutions: {
      startedCode: q.starterCode || '',
      solutionCode: q.solutionCode || '',
      functionName: q.functionName || '',
      language: q.language || '',
    },
    starterCode: q.starterCode || '',
    solutionCode: q.solutionCode || '',
    functionName: q.functionName || '',
    language: q.language || '',
    testCases: Array.isArray(q.testCases) ? q.testCases : [],
    constraints: Array.isArray(q.constraints) ? q.constraints : [],
    hints: Array.isArray(q.hints) ? q.hints : [],
    sampleInput: q.sampleInput || '',
    sampleOutput: q.sampleOutput || '',
    timeLimit: Number(q.timeLimit ?? 2),
    memoryLimit: Number(q.memoryLimit ?? 256),
    category: q.category || '',
    tags: Array.isArray(q.tags) ? q.tags : [],
    // The MCQ heuristic (line 237) matches on the mere PRESENCE of these keys,
    // so they must be absent rather than empty on a code question.
    mcqQuestionTitle: undefined,
    mcqQuestionType: undefined,
    mcqQuestionOptions: undefined,
    mcqQuestionDifficulty: undefined,
    mcqQuestionScore: undefined,
  };
}

/**
 * Map an ExternalAssessment onto the LMS exercise document the shared forms
 * read (`exerciseData.fullExerciseData`).
 *
 * ONE definition, used by both `toExerciseData()` when the form mounts and
 * `getExternalExercise()` when the form refetches after a save — otherwise the
 * two shapes drift and the refetch silently changes what the form believes
 * about its own configuration.
 */
export function toLmsExerciseShape(assessment: any, questions: any[] = []): any {
  const a = assessment || {};
  const type = a.exerciseType || 'MCQ';

  const mcqCount = type === 'MCQ' || type === 'Combined'
    ? Number(a.questionConfiguration?.totalQuestions || 0)
    : 0;
  const codeCfg = type === 'Other' ? a.othersConfig : a.programmingConfig;
  const codeCount = type === 'Programming' || type === 'Combined' || type === 'Other'
    ? codeQuestionCount(codeCfg)
    : 0;

  const totalMarks = Number(a.totalMarks || 0);
  const marksMCQ = type === 'Combined' ? Number(a.totalMarksMCQ || 0)
    : (type === 'MCQ' ? totalMarks : 0);
  const marksProgramming = type === 'Combined' ? Number(a.totalMarksProgramming || 0)
    : (type === 'Programming' || type === 'Other' ? totalMarks : 0);

  const { questionSource, customSources } = toLmsSource(a.questionSources);

  return {
    _id: a._id,
    exerciseType: type,
    exerciseInformation: {
      exerciseId: a.assessmentCode || a._id,
      exerciseName: a.assessmentName,
      description: a.description || '',
      exerciseLevel: a.exerciseLevel || 'beginner',
      totalDuration: a.durationMinutes || 60,
      totalMarks,
      totalMarksMCQ: marksMCQ,
      totalMarksProgramming: marksProgramming,
      selectedModule: a.selectedModule || '',
      selectedLanguages: a.selectedLanguages || [],
      isSectionBased: !!a.isSectionBased,
    },
    questionConfiguration: {
      mcqQuestionConfiguration: {
        totalMcqQuestions: mcqCount,
        marksPerQuestion: a.questionConfiguration?.marksPerQuestion ?? 1,
        mcqTotalMarks: marksMCQ,
        attemptLimitEnabled: !!a.questionConfiguration?.attemptLimitEnabled,
        submissionAttempts: a.questionConfiguration?.submissionAttempts ?? 1,
        scoringType: a.questionConfiguration?.scoringType || 'equalDistribution',
      },
      programmingQuestionConfiguration: {
        questionConfigType: codeCfg?.questionConfigType || 'general',
        generalQuestionCount: codeCfg?.generalQuestionCount ?? 0,
        levelBasedCounts: codeCfg?.levelBasedCounts ?? { easy: 0, medium: 0, hard: 0 },
        selectionLevelCounts: codeCfg?.selectionLevelCounts ?? { easy: 0, medium: 0, hard: 0 },
        questionFlow: codeCfg?.questionFlow || 'freeFlow',
        attemptLimitEnabled: !!codeCfg?.attemptLimitEnabled,
        submissionAttempts: codeCfg?.submissionAttempts ?? 1,
      },
    },
    questionSource,
    customSources,
    evaluationMethod: a.evaluationMethod || { method: 'testcase' },
    // No course means nobody to route an approval to. Explicitly null so the
    // forms take their "no approval configured" path rather than inferring one.
    approvalWorkflow: null,
    securitySettings: a.securitySettings || {},
    sections: a.sections || [],
    // Mapped, not passed through — see toLmsQuestionShape.
    questions: (questions.length ? questions : (a.questions || [])).map(toLmsQuestionShape),
    // Counters the forms read directly off the exercise.
    totalQuestions: mcqCount + codeCount,
    totalPoints: totalMarks,
  };
}

/**
 * Serve `exerciseApi.getExerciseById` from the External API.
 *
 * The shared form refetches its exercise after every save
 * (AddQuestionForm.refreshExerciseData → exerciseApi.getExerciseById), which
 * hits the LMS route `/exercise/:id` and 404s for an external assessment —
 * that id is not an exercise on the pedagogy tree. Returning the assessment in
 * the LMS envelope keeps the form's counters live instead of leaving it on the
 * stale copy it mounted with.
 */
export async function getExternalExercise(exerciseId: string): Promise<any> {
  const id = resolveExternalId(exerciseId);
  const res = await api.get<{ success: boolean; data: any }>(`${ADMIN}/assessments/${id}`);
  const assessment = res?.data;
  return {
    success: true,
    message: [{ key: 'success', value: 'Assessment retrieved' }],
    // The caller reads `data.exercise` first, then falls back to `data`.
    data: { exercise: toLmsExerciseShape(assessment, assessment?.questions || []) },
  };
}
