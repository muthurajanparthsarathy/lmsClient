import { srcToBucket } from '../../uploadcourseresources/components/youdo/assessments/questionsource/quotaModel';

export type AllocationLevel = 'easy' | 'medium' | 'hard';
export type AllocationSource = 'manual' | 'bank' | 'ai' | 'thirdParty' | 'document';
const levels: AllocationLevel[] = ['easy', 'medium', 'hard'];
const count = (value: unknown) => Math.max(0, Number(value) || 0);

/** The chooser reads persisted allocations; opening it never reserves a slot. */
export function questionAllocation(exercise: any, questions: any[], part: 'mcq' | 'programming' = 'programming') {
  const mcq = part === 'mcq';
  const config = mcq ? exercise.questionConfiguration?.mcqQuestionConfiguration
    : exercise.questionConfiguration?.othersQuestionConfiguration || exercise.questionConfiguration?.programmingQuestionConfiguration;
  const levelBased = !mcq && ['levelBased', 'selectionLevel'].includes(config?.questionConfigType);
  const configuredCounts = config?.questionConfigType === 'selectionLevel' ? config.selectionLevelCounts : config?.levelBasedCounts;
  const active = questions.filter(q => q.isActive !== false && (mcq ? q.questionType === 'mcq' : q.questionType !== 'mcq'));
  const ownMcqSource = mcq && exercise.exerciseType === 'Combined' && exercise.questionSourceMcq;
  const source = ownMcqSource || exercise.questionSource;
  const customSources = (ownMcqSource ? exercise.customSourcesMcq : exercise.customSources) || [];
  const distribution = ownMcqSource ? exercise.customDistributionMcq : exercise.customDistribution;
  const allowed = (key: string) => !source || source === key || (source === 'custom' && customSources.includes(key));
  const quota = (level: AllocationLevel | null, key: string, total: number) => {
    if (!allowed(key)) return 0;
    if (source !== 'custom') return total;
    if (level) return count(distribution?.[level]?.[key]);
    if (ownMcqSource) return count(distribution?.[key]);
    return levels.reduce((sum, d) => sum + count(distribution?.[d]?.[key]), 0);
  };
  const row = (level: AllocationLevel | null) => {
    const total = level ? count(configuredCounts?.[level]) : count(mcq ? config?.totalMcqQuestions : config?.generalQuestionCount);
    const matching = level ? active.filter(q => (q.difficulty || q.mcqQuestionDifficulty || 'medium').toLowerCase() === level) : active;
    const added = matching.length;
    const remaining = Math.max(0, total - added);
    const buckets = (['scratch', 'ai', 'thirdParty'] as const).map(key => {
      const bucket = key === 'scratch' ? 'manual' : key === 'thirdParty' ? 'otherPlatform' : 'ai';
      const configured = quota(level, key, total);
      const used = matching.filter(q => srcToBucket(q.source) === bucket).length;
      return { key, configured, used, remaining: Math.max(0, Math.min(remaining, configured - used)), enabled: allowed(key) };
    });
    const scoring = level && config?.scoreSettings?.levelScoringConfiguration?.[level];
    const marks = scoring ? scoring.type === 'question_specific' ? `${count(scoring.totalMarks)} marks, assigned individually` : `${count(scoring.marksPerQuestion)} marks per question` : null;
    return { level, total, added, remaining, buckets, marks };
  };
  return { levelBased, rows: levelBased ? levels.map(row) : [row(null)] };
}
