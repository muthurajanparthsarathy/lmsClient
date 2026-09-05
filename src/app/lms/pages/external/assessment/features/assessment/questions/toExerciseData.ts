// Shape an ExternalAssessment into the `exerciseData` object the shared
// AddQuestionForm expects.
//
// AddQuestionForm and its child forms read the LMS exercise document to decide
// what to render: which authoring types are offered, whether a difficulty
// popup appears, which source buttons are enabled, how many questions are left
// and what each is worth. Producing that shape here is what lets External
// reuse the LMS authoring UI.
//
// The mapping is deliberately explicit rather than a spread: the LMS document
// has many fields External has no equivalent for, and quietly passing an
// external assessment through as if it were an exercise is how a form ends up
// reading a field that means something different on this side.

import type { ExternalAssessment, ExternalQuestion } from '@/apiServices/externalAssessment';
import { EXTERNAL_ENTITY, toLmsQuestionShape } from '@/apiServices/externalQuestionAdapter';
import { configuredCounts, configuredMarks } from './quota';

/**
 * The LMS `questionSource` vocabulary.
 *
 * External stores a SET (`questionSources: ['scratch','ai',…]`); the LMS form
 * reads a single value plus a `customSources[]` array when that value is
 * `custom`. One ticked source maps to that source directly; several map to
 * `custom` + the list, which is exactly how the LMS expresses the same thing.
 */
function toLmsSource(sources: string[] = []): { questionSource: string; customSources: string[] } {
  const list = sources.length ? sources : ['scratch'];
  if (list.length === 1) return { questionSource: list[0], customSources: [] };
  return { questionSource: 'custom', customSources: list };
}

/** External strategy names happen to match the LMS ones — kept explicit so a rename on either side is caught here. */
function toLmsConfigType(t?: string): 'general' | 'levelBased' | 'selectionLevel' {
  if (t === 'levelBased') return 'levelBased';
  if (t === 'selectionLevel') return 'selectionLevel';
  return 'general';
}

export interface ExerciseDataForForm {
  exerciseId: string;
  exerciseName: string;
  exerciseType: string;
  entityType: typeof EXTERNAL_ENTITY;
  entityId: string;
  tabType: string;
  subcategory: string;
  remainingQuestions: number;
  marksPerQuestion: number;
  totalQuestions: number;
  totalMarks: number;
  fullExerciseData: any;
}

/**
 * @param assessment the External assessment being authored
 * @param questions  what has already been written (drives remaining counts)
 * @param kind       which half of a Combined paper this form is authoring
 */
export function toExerciseData(
  assessment: ExternalAssessment,
  questions: ExternalQuestion[] = [],
  kind: 'mcq' | 'programming' = 'mcq',
): ExerciseDataForForm {
  const counts = configuredCounts(assessment);
  const marks = configuredMarks(assessment);
  const { questionSource, customSources } = toLmsSource(assessment.questionSources as string[]);

  // A Combined paper's two halves have separate quotas, so the form must be
  // told about its own half only — otherwise the MCQ form would report the
  // programming questions as part of its remaining count.
  const written = questions.filter((q) => (q.questionKind || 'mcq') === kind).length;
  const target = kind === 'programming' ? counts.programming : counts.mcq;
  const marksTarget = kind === 'programming' ? marks.programming : marks.mcq;

  const codeCfg = assessment.exerciseType === 'Other'
    ? assessment.othersConfig
    : assessment.programmingConfig;

  // The LMS exercise shape the child forms read.
  const fullExerciseData = {
    _id: assessment._id,
    exerciseType: assessment.exerciseType || 'MCQ',
    exerciseInformation: {
      exerciseId: assessment.assessmentCode || assessment._id,
      exerciseName: assessment.assessmentName,
      description: assessment.description || '',
      exerciseLevel: assessment.exerciseLevel || 'beginner',
      totalDuration: assessment.durationMinutes || 60,
      totalMarks: marks.total,
      totalMarksMCQ: marks.mcq,
      totalMarksProgramming: marks.programming,
      selectedModule: assessment.selectedModule || '',
      selectedLanguages: assessment.selectedLanguages || [],
      isSectionBased: !!assessment.isSectionBased,
    },
    questionConfiguration: {
      mcqQuestionConfiguration: {
        totalMcqQuestions: counts.mcq,
        marksPerQuestion: assessment.questionConfiguration?.marksPerQuestion ?? 1,
        mcqTotalMarks: marks.mcq,
        attemptLimitEnabled: !!assessment.questionConfiguration?.attemptLimitEnabled,
        submissionAttempts: assessment.questionConfiguration?.submissionAttempts ?? 1,
        scoringType: assessment.questionConfiguration?.scoringType || 'equalDistribution',
      },
      programmingQuestionConfiguration: {
        questionConfigType: toLmsConfigType(codeCfg?.questionConfigType),
        generalQuestionCount: codeCfg?.generalQuestionCount ?? 0,
        levelBasedCounts: codeCfg?.levelBasedCounts ?? { easy: 0, medium: 0, hard: 0 },
        selectionLevelCounts: codeCfg?.selectionLevelCounts ?? { easy: 0, medium: 0, hard: 0 },
        questionFlow: codeCfg?.questionFlow || 'freeFlow',
        attemptLimitEnabled: !!codeCfg?.attemptLimitEnabled,
        submissionAttempts: codeCfg?.submissionAttempts ?? 1,
      },
    },
    // Source gating — the forms use these to decide which of Manual / Bank /
    // AI / Other Platform to surface.
    questionSource,
    customSources,
    evaluationMethod: assessment.evaluationMethod || { method: 'testcase' },
    // External assessments never run the LMS approval workflow: there is no
    // course, so nobody to route an approval to. Explicitly null so the forms
    // take their "no approval configured" path instead of inferring one.
    approvalWorkflow: null,
    securitySettings: assessment.securitySettings || {},
    sections: assessment.sections || [],
    // Mapped into the LMS question shape so the form's own counters see them —
    // it filters on `questionType` / `difficulty` / `score`, none of which
    // exist under those names on an ExternalQuestion. Same mapper the refetch
    // path uses, so mount and refresh can never disagree.
    questions: (questions as any[]).map(toLmsQuestionShape),
  };

  return {
    exerciseId: assessment._id,
    exerciseName: assessment.assessmentName,
    exerciseType: assessment.exerciseType || 'MCQ',
    // The sentinel that makes questionApi delegate to the External adapter.
    entityType: EXTERNAL_ENTITY,
    // Unused by the External routes (the assessment id is the whole address),
    // but the forms pass it through their URL builders, so it must be a
    // harmless non-empty string rather than undefined.
    entityId: assessment._id,
    // External assessments are their own thing — not We_Do / You_Do — but the
    // forms branch on this string in places, and You_Do is the behaviour we
    // want (a graded assessment rather than a practice assignment).
    tabType: 'You_Do',
    subcategory: 'assesment',
    remainingQuestions: Math.max(0, target - written),
    marksPerQuestion: target > 0 && marksTarget > 0
      ? Math.round((marksTarget / target) * 100) / 100
      : 1,
    totalQuestions: target,
    totalMarks: marksTarget,
    fullExerciseData,
  };
}

/**
 * Which authoring type AddQuestionForm should open with, given the exercise
 * type. Returning a concrete kind (rather than null) is what skips the
 * intermediate "MCQ or Programming?" chooser — the assessment already said.
 */
export function initialTypeFor(assessment: ExternalAssessment | null | undefined): 'mcq' | 'programming' | null {
  switch (assessment?.exerciseType) {
    case 'Programming':
      return 'programming';
    case 'Combined':
      // Genuinely ambiguous — the paper holds both, so the chooser is correct
      // here and is the only case where it appears.
      return null;
    case 'MCQ':
    case 'Other':
    default:
      return 'mcq';
  }
}
