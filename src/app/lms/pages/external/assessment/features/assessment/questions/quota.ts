// Question quota — how many questions an assessment still expects, in total
// and per source.
//
// The numbers come from Step 2's configuration (how many questions the paper
// holds) and Step 3's source distribution (how many of them come from Manual /
// AI / Other Platform). Both the "3 left" badges on the Add Question picker
// and the right-hand Exercise Overview panel read from here, so a badge can
// never disagree with the panel beside it.

import type {
  ExternalAssessment,
  ExternalQuestion,
  ExternalQuestionOrigin,
} from '@/apiServices/externalAssessment';

const LEVELS = ['easy', 'medium', 'hard'] as const;

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
  return LEVELS.reduce((sum, l) => sum + Number(counts?.[l] || 0), 0);
}

/**
 * How many questions the assessment is configured to hold, split by kind.
 *
 * Combined counts BOTH halves; the MCQ and Programming totals are what the
 * per-form quota panels show.
 */
export function configuredCounts(a: ExternalAssessment | null | undefined): {
  mcq: number;
  programming: number;
  total: number;
} {
  if (!a) return { mcq: 0, programming: 0, total: 0 };
  const type = a.exerciseType || 'MCQ';

  const mcq = type === 'MCQ' || type === 'Combined'
    ? Number(a.questionConfiguration?.totalQuestions || 0)
    : 0;

  const programming =
    type === 'Programming' || type === 'Combined' ? codeQuestionCount(a.programmingConfig)
      : type === 'Other' ? codeQuestionCount(a.othersConfig)
        : 0;

  return { mcq, programming, total: mcq + programming };
}

/**
 * Marks the paper is worth, split the same way. `Combined` uses the explicit
 * split from Step 2; everything else is the single total.
 */
export function configuredMarks(a: ExternalAssessment | null | undefined): {
  mcq: number;
  programming: number;
  total: number;
} {
  if (!a) return { mcq: 0, programming: 0, total: 0 };
  const total = Number(a.totalMarks || 0);
  if (a.exerciseType === 'Combined') {
    return {
      mcq: Number(a.totalMarksMCQ || 0),
      programming: Number(a.totalMarksProgramming || 0),
      total,
    };
  }
  const isCode = a.exerciseType === 'Programming' || a.exerciseType === 'Other';
  return { mcq: isCode ? 0 : total, programming: isCode ? total : 0, total };
}

export interface SourceQuota {
  source: ExternalQuestionOrigin;
  /** How many the distribution allots to this source. 0 = unlimited/unset. */
  allowed: number;
  used: number;
  left: number;
}

/**
 * Per-source quota.
 *
 * Step 3's `customDistribution` says how many questions each source
 * contributes. When only ONE source is ticked it takes the whole count — the
 * matrix is not shown in that case, so there is no per-source figure to read.
 *
 * `bank` and `document` both draw on the Other Platform / Manual allotments
 * respectively, matching how the You_Do picker counts them.
 */
export function sourceQuotas(
  a: ExternalAssessment | null | undefined,
  questions: ExternalQuestion[] = [],
): Record<string, SourceQuota> {
  const total = configuredCounts(a).total;
  const sources = a?.questionSources?.length ? a.questionSources : ['scratch'];
  const dist = a?.customDistribution || {};

  // Sum a source's allotment across every difficulty row.
  const allottedFor = (src: string): number => {
    if (sources.length <= 1) return total;
    const rows = ['general', 'easy', 'medium', 'hard'] as const;
    const sum = rows.reduce((acc, r) => acc + Number((dist as any)?.[r]?.[src] ?? 0), 0);
    return sum;
  };

  // Bank and Document are authoring ROUTES rather than distribution columns:
  // a bank pick is Manual sourcing by another name, and a document import is
  // too. All three draw on Manual's allotment.
  const columnOf = (src: string) => (src === 'bank' || src === 'document' ? 'scratch' : src);

  // Usage is counted PER COLUMN, not per route. Counting per route let each of
  // the three read Manual's full allotment as its own: with 4 of 5 written
  // manually, Scratch correctly showed "1 left" while Bank and Document both
  // showed "5 left", because neither had any questions of its own name.
  const usedInColumn = (column: string) =>
    questions.filter((q) => columnOf(q.source || 'scratch') === column).length;

  const out: Record<string, SourceQuota> = {};
  for (const src of ['scratch', 'ai', 'thirdParty', 'bank', 'document'] as ExternalQuestionOrigin[]) {
    const column = columnOf(src);
    const allowed = sources.includes(column as any) ? allottedFor(column) : 0;
    const used = usedInColumn(column);
    out[src] = { source: src, allowed, used, left: Math.max(0, allowed - used) };
  }
  return out;
}

/** Overall progress for the Exercise Overview panel. */
export function questionProgress(
  a: ExternalAssessment | null | undefined,
  questions: ExternalQuestion[] = [],
) {
  const counts = configuredCounts(a);
  const marks = configuredMarks(a);

  const created = questions.length;
  const usedMarks = questions.reduce((s, q) => s + (Number(q.mcqQuestionScore) || 0), 0);

  const mcqCreated = questions.filter((q) => (q.questionKind || 'mcq') === 'mcq').length;
  const progCreated = questions.filter((q) => q.questionKind === 'programming').length;

  return {
    total: counts.total,
    created,
    remaining: Math.max(0, counts.total - created),
    mcq: { total: counts.mcq, created: mcqCreated, remaining: Math.max(0, counts.mcq - mcqCreated) },
    programming: {
      total: counts.programming,
      created: progCreated,
      remaining: Math.max(0, counts.programming - progCreated),
    },
    marks: {
      total: marks.total,
      used: usedMarks,
      remaining: Math.round((marks.total - usedMarks) * 100) / 100,
      // Per-question figure the MCQ form pre-fills with.
      perQuestion: counts.mcq > 0 && marks.mcq > 0
        ? Math.round((marks.mcq / counts.mcq) * 100) / 100
        : 0,
    },
  };
}

/**
 * Is the paper configured BY LEVEL, so the author must say which difficulty a
 * new question belongs to?
 *
 * True when the code config uses a level strategy, or the MCQ config has its
 * level split switched on. A flat `general` config has one undifferentiated
 * pool and nothing to ask.
 */
export function isLevelBased(a: ExternalAssessment | null | undefined): boolean {
  if (!a) return false;
  const type = a.exerciseType || 'MCQ';
  if ((type === 'MCQ' || type === 'Combined') && a.questionConfiguration?.levelBasedEnabled) {
    return true;
  }
  const codeCfg = type === 'Other' ? a.othersConfig : a.programmingConfig;
  const usesCode = type === 'Programming' || type === 'Combined' || type === 'Other';
  return usesCode && (codeCfg?.questionConfigType || 'general') !== 'general';
}

/**
 * Per-level allotment and usage, for the difficulty picker.
 *
 * Counts come from whichever config governs the kind being authored, so a
 * Combined paper asks about the right half rather than summing the two.
 */
export function levelSlots(
  a: ExternalAssessment | null | undefined,
  questions: ExternalQuestion[] = [],
  kind: 'mcq' | 'programming' = 'mcq',
): Array<{ level: 'easy' | 'medium' | 'hard'; allowed: number; used: number }> {
  const type = a?.exerciseType || 'MCQ';

  let counts: Record<string, number> = {};
  if (kind === 'mcq') {
    counts = (a?.questionConfiguration?.levelCounts as any) || {};
  } else {
    const codeCfg = type === 'Other' ? a?.othersConfig : a?.programmingConfig;
    counts = ((codeCfg?.questionConfigType === 'selectionLevel'
      ? codeCfg?.selectionLevelCounts
      : codeCfg?.levelBasedCounts) as any) || {};
  }

  // Only questions of the SAME kind consume a level's allotment — an MCQ and a
  // programming question can both be "easy" without competing for one slot.
  const ofKind = questions.filter((q) => (q.questionKind || 'mcq') === kind);

  return (LEVELS as readonly ('easy' | 'medium' | 'hard')[]).map((level) => ({
    level,
    allowed: Number(counts?.[level] || 0),
    used: ofKind.filter((q) => (q.mcqQuestionLevel || 'easy') === level).length,
  }));
}

/** Which authoring forms this assessment's exercise type allows. */
export function allowedKinds(a: ExternalAssessment | null | undefined): Array<'mcq' | 'programming'> {
  const type = a?.exerciseType || 'MCQ';
  if (type === 'Combined') return ['mcq', 'programming'];
  if (type === 'Programming') return ['programming'];
  // MCQ and Other both author through the objective-question form — "Other"
  // in the LMS is a custom exercise with module/language config, not a third
  // question shape.
  return ['mcq'];
}
