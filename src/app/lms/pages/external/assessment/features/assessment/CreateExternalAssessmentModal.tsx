'use client';

/**
 * Create / edit an External Assessment — the full 8-step wizard.
 *
 * Mirrors the You_Do Create Assessment wizard step-for-step and field-for-
 * field, so an admin who knows one knows the other:
 *
 *   1. Exercise Details          — Info & Time
 *   2. Question Configuration    — Configure Questions
 *   3. Question Source           — Where questions come from
 *   4. Schedule                  — Dates & Times
 *   5. Security Settings         — Test Security
 *   6. Notifications             — Alerts & Notify
 *   7. Grade Settings            — Marks & Grading
 *   8. Assessment Content        — Instructions & Review
 *
 * Same chrome: blurred scrim, cream numbered rail with active / saved / locked
 * states, "Step N/M" header, inline Back · Save · Next · Finish footer.
 *
 * The one structural difference from You_Do is step 8. There, it is "Select
 * Assessment Content" over the course's topic tree — an external assessment
 * belongs to no course, so that step carries the instructions and a review of
 * everything entered instead.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ChevronLeft, ChevronRight, Lock, X, Loader2, Monitor, ClipboardList,
  PenLine, Library, Sparkles, Shuffle, Terminal, Layers, ListChecks, Boxes,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TipTapEditor from '@/app/lms/component/tiptopEditor';
import {
  externalAssessmentApi,
  type ExternalAssessment,
  type ExternalSourceKey,
  type ExternalCustomDistribution,
} from '@/apiServices/externalAssessment';
import {
  D, OInput, OSelect, OToggle, ToggleRow, RadioCard, Chip, SectionLabel, StepGroup,
  InfoTooltip, CodeConfigBlock, AllocatedBadge, EvaluationMethodBlock, PillChoice,
  codeAllocatedMarks,
} from './wizard/ui';
import QuestionSourceStep from './wizard/QuestionSourceStep';

// Step titles double as the `stepsSaved[]` values persisted on the record —
// same contract the You_Do wizard uses, so reopening an assessment restores
// the ticks.
const STEPS = [
  { id: 1, title: 'Exercise Details', subtitle: 'Info & Time' },
  { id: 2, title: 'Question Configuration', subtitle: 'Configure Questions' },
  { id: 3, title: 'Question Source', subtitle: 'Where questions come from' },
  { id: 4, title: 'Schedule', subtitle: 'Dates & Times' },
  { id: 5, title: 'Security Settings', subtitle: 'Test Security' },
  { id: 6, title: 'Notifications', subtitle: 'Alerts & Notify' },
  { id: 7, title: 'Grade Settings', subtitle: 'Marks & Grading' },
  { id: 8, title: 'Assessment Content', subtitle: 'Instructions & Review' },
] as const;

// Only Mock and Final are offered, matching the You_Do step — `practice`
// exists in the model but that wizard never surfaces it either.
const TEST_TYPES = [
  { value: 'mock', label: 'Mock Test', description: 'Simulates real exam conditions', icon: Monitor },
  { value: 'final', label: 'Final Test', description: 'End of course/term final assessment', icon: ClipboardList },
] as const;

// All four types the You_Do wizard offers, with the same wording.
const EXERCISE_TYPES = [
  { value: 'MCQ', label: 'MCQ — Multiple Choice Questions (auto-graded)' },
  { value: 'Programming', label: 'Programming — Code challenges with test cases' },
  { value: 'Combined', label: 'Combined — MCQ + Programming (hybrid)' },
  { value: 'Other', label: 'Other — Custom exercise with module & language config' },
];

// Which config blocks Step 2 shows for a given exercise type.
const showsMcqConfig = (t: string) => t === 'MCQ' || t === 'Combined';
const showsProgrammingConfig = (t: string) => t === 'Programming' || t === 'Combined';
const showsOthersConfig = (t: string) => t === 'Other';

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

// Skill Set — same module → languages map the You_Do wizard uses
// (assessments/constants.tsx `moduleLanguages`).
const MODULE_LANGUAGES: Record<string, string[]> = {
  'Core Programming': ['C', 'C++', 'Java', 'Python', 'C#'],
  Frontend: ['HTML', 'CSS', 'JavaScript', 'Bootstrap', 'TypeScript', 'React'],
  Database: ['SQL', 'MongoDB'],
};

// Source labels for the review table. The picker itself lives in
// wizard/QuestionSourceStep.tsx, which owns the multi-select and the matrix.
const SOURCE_LABELS: Record<string, string> = {
  scratch: 'Manual',
  ai: 'AI Automation',
  thirdParty: 'Other Platform',
};

const DEFAULT_GRADE_BANDS = [
  { label: 'Poor', fromPercent: 0, toPercent: 40 },
  { label: 'Average', fromPercent: 40, toPercent: 60 },
  { label: 'Good', fromPercent: 60, toPercent: 80 },
  { label: 'Excellent', fromPercent: 80, toPercent: 100 },
];

type Form = {
  assessmentName: string;
  description: string;
  instructions: string;
  testType: 'mock' | 'final';
  exerciseType: string;
  exerciseLevel: string;
  selectedModule: string;
  selectedLanguages: string[];
  isSectionBased: boolean;
  sectionBasedDuration: boolean;
  sections: Array<{ name: string; totalMarks: number; totalDuration: number }>;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  questionConfiguration: {
    scoringType: 'equalDistribution' | 'questionSpecific';
    totalQuestions: number;
    marksPerQuestion: number;
    attemptLimitEnabled: boolean;
    submissionAttempts: number;
    questionFlow: 'freeFlow' | 'controlled';
    levelBasedEnabled: boolean;
    levelCounts: { easy: number; medium: number; hard: number };
  };
  programmingConfig: Record<string, any>;
  othersConfig: Record<string, any>;
  evaluationMethod: { method: 'manual' | 'testcase' | 'ai'; ai: Record<string, any> };
  additionalOptions: Record<string, any>;
  totalMarksMCQ: number;
  totalMarksProgramming: number;
  questionSources: ExternalSourceKey[];
  customDistribution: ExternalCustomDistribution;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  scheduleExtras: {
    cutOffEnabled: boolean;
    cutOffDate: string;
    cutOffTime: string;
    gracePeriodEnabled: boolean;
    gracePeriodMinutes: number;
  };
  securitySettings: Record<string, any>;
  notificationSettings: Record<string, any>;
  gradeSettings: {
    enablePassMark: boolean;
    gradeBandsEnabled: boolean;
    gradeBands: Array<{ label: string; fromPercent: number; toPercent: number }>;
  };
  settings: Record<string, any>;
  status: 'draft' | 'published';
};

const EMPTY: Form = {
  assessmentName: '',
  description: '',
  instructions: '',
  testType: 'mock',
  exerciseType: 'MCQ',
  exerciseLevel: 'beginner',
  selectedModule: '',
  selectedLanguages: [],
  isSectionBased: false,
  sectionBasedDuration: false,
  sections: [],
  durationMinutes: 60,
  totalMarks: 0,
  passingMarks: 0,
  questionConfiguration: {
    scoringType: 'equalDistribution',
    totalQuestions: 0,
    marksPerQuestion: 1,
    attemptLimitEnabled: false,
    submissionAttempts: 1,
    questionFlow: 'freeFlow',
    levelBasedEnabled: false,
    levelCounts: { easy: 0, medium: 0, hard: 0 },
  },
  programmingConfig: {
    questionConfigType: 'general', generalQuestionCount: 0,
    levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
    selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
    levelMarks: { easy: 0, medium: 0, hard: 0 },
    levelScoring: {
      easy: { scoreType: 'level_specific', marks: 0 },
      medium: { scoreType: 'level_specific', marks: 0 },
      hard: { scoreType: 'level_specific', marks: 0 },
    },
    questionFlow: 'freeFlow', attemptLimitEnabled: false, submissionAttempts: 1,
  },
  othersConfig: {
    questionConfigType: 'general', generalQuestionCount: 0,
    levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
    selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
    levelMarks: { easy: 0, medium: 0, hard: 0 },
    levelScoring: {
      easy: { scoreType: 'level_specific', marks: 0 },
      medium: { scoreType: 'level_specific', marks: 0 },
      hard: { scoreType: 'level_specific', marks: 0 },
    },
    questionFlow: 'freeFlow', attemptLimitEnabled: false, submissionAttempts: 1,
  },
  evaluationMethod: {
    method: 'testcase',
    ai: { criteria: [], testCasesCountMode: 'common', testCasesCount: 20 },
  },
  additionalOptions: { anonymousSubmissions: false, hideGraderIdentity: false },
  totalMarksMCQ: 0,
  totalMarksProgramming: 0,
  questionSources: ['scratch'],
  customDistribution: {
    general: { scratch: 0, ai: 0, thirdParty: 0 },
    easy: { scratch: 0, ai: 0, thirdParty: 0 },
    medium: { scratch: 0, ai: 0, thirdParty: 0 },
    hard: { scratch: 0, ai: 0, thirdParty: 0 },
  },
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  scheduleExtras: {
    cutOffEnabled: false,
    cutOffDate: '',
    cutOffTime: '',
    gracePeriodEnabled: false,
    gracePeriodMinutes: 0,
  },
  securitySettings: {
    preventTabSwitch: false, maxTabSwitches: 3,
    preventCopyPaste: false, preventBrowserClose: false,
    enableFaceVerification: false, multipleFaceDetection: false, faceWarningLimit: 3,
    recordScreen: false,
    autoSubmitOnTimeout: true, warnBeforeTimeout: true, warningSeconds: 300,
    requireFullscreen: false, preventDevTools: false, preventRightClick: false,
    preventPrinting: false, preventPageRefresh: false, preventBackNavigation: false,
  },
  notificationSettings: {
    notifyOnInvite: true, notifyOnSubmission: false,
    notifyBeforeStart: false, reminderHoursBefore: 24, notifyOnResult: false,
  },
  gradeSettings: { enablePassMark: true, gradeBandsEnabled: false, gradeBands: DEFAULT_GRADE_BANDS },
  settings: {
    shuffleQuestions: false, shuffleOptions: false, maxAttempts: 1,
    negativeMarking: false, negativeMarkPerWrong: 0,
    showResultToParticipant: false, autoSubmitOnTimeout: true,
  },
  status: 'draft',
};

// ISO → yyyy-mm-dd from LOCAL parts. toISOString() shifts to UTC and lands an
// evening date on the previous day east of Greenwich.
const toDateInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CreateExternalAssessmentModal({
  open, editing, onClose, onSaved,
}: {
  open: boolean;
  editing?: ExternalAssessment | null;
  onClose: () => void;
  onSaved: (a: ExternalAssessment) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Which steps the author has explicitly saved this session (plus whatever
  // the record already carried). Drives the rail's green ticks.
  const [savedSteps, setSavedSteps] = useState<Set<string>>(new Set());
  // The id to PUT against — set after the first save so Next-then-Save on a
  // new assessment updates rather than creating a second row.
  const [draftId, setDraftId] = useState<string | null>(null);
  // Which half of a Combined assessment Step 2 is showing.
  const [combinedTab, setCombinedTab] = useState<'mcq' | 'programming'>('mcq');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErrors({});
    if (editing) {
      setDraftId(editing._id);
      setSavedSteps(new Set(editing.stepsSaved || []));
      setForm({
        ...EMPTY,
        assessmentName: editing.assessmentName || '',
        description: editing.description || '',
        instructions: editing.instructions || '',
        testType: (editing.testType === 'final' ? 'final' : 'mock'),
        exerciseType: editing.exerciseType || 'MCQ',
        exerciseLevel: editing.exerciseLevel || 'beginner',
        selectedModule: editing.selectedModule || '',
        selectedLanguages: editing.selectedLanguages || [],
        isSectionBased: !!editing.isSectionBased,
        sectionBasedDuration: !!editing.sectionBasedDuration,
        sections: (editing.sections || []).map((s) => ({
          name: s.name, totalMarks: s.totalMarks ?? 0, totalDuration: s.totalDuration ?? 0,
        })),
        durationMinutes: editing.durationMinutes ?? 60,
        totalMarks: editing.totalMarks ?? 0,
        passingMarks: editing.passingMarks ?? 0,
        questionConfiguration: { ...EMPTY.questionConfiguration, ...(editing.questionConfiguration || {}) } as Form['questionConfiguration'],
        programmingConfig: { ...EMPTY.programmingConfig, ...(editing.programmingConfig || {}) },
        othersConfig: { ...EMPTY.othersConfig, ...(editing.othersConfig || {}) },
        evaluationMethod: {
          ...EMPTY.evaluationMethod,
          ...(editing.evaluationMethod || {}),
          ai: { ...EMPTY.evaluationMethod.ai, ...(editing.evaluationMethod?.ai || {}) },
        } as Form['evaluationMethod'],
        additionalOptions: { ...EMPTY.additionalOptions, ...(editing.additionalOptions || {}) },
        totalMarksMCQ: editing.totalMarksMCQ ?? 0,
        totalMarksProgramming: editing.totalMarksProgramming ?? 0,
        questionSources: editing.questionSources?.length ? editing.questionSources : ['scratch'],
        customDistribution: { ...EMPTY.customDistribution, ...(editing.customDistribution || {}) },
        startDate: toDateInput(editing.startDate),
        endDate: toDateInput(editing.endDate),
        startTime: editing.startTime || '',
        endTime: editing.endTime || '',
        scheduleExtras: {
          ...EMPTY.scheduleExtras,
          ...(editing.scheduleExtras || {}),
          cutOffDate: toDateInput(editing.scheduleExtras?.cutOffDate),
        },
        securitySettings: { ...EMPTY.securitySettings, ...(editing.securitySettings || {}) },
        notificationSettings: { ...EMPTY.notificationSettings, ...(editing.notificationSettings || {}) },
        gradeSettings: {
          ...EMPTY.gradeSettings,
          ...(editing.gradeSettings || {}),
          gradeBands: editing.gradeSettings?.gradeBands?.length
            ? editing.gradeSettings.gradeBands
            : DEFAULT_GRADE_BANDS,
        },
        settings: { ...EMPTY.settings, ...(editing.settings || {}) },
        status: editing.status === 'archived' ? 'draft' : (editing.status as 'draft' | 'published'),
      });
    } else {
      setDraftId(null);
      setSavedSteps(new Set());
      setForm(EMPTY);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: '' }));
  };
  const setGroup = (group: keyof Form, key: string, value: any) =>
    setForm((f) => ({ ...f, [group]: { ...(f[group] as any), [key]: value } }));

  const instantOf = (date: string, time: string): number | null => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
  };

  /**
   * What the Question Source matrix has to add up to, derived from Step 2.
   *
   * A level-based configuration gives three difficulty rows with their own
   * counts; anything else gives one "Questions" row targeting the total. This
   * is what keeps the two steps honest with each other — the split can only
   * describe a paper Step 2 actually configured.
   *
   * Declared BEFORE validateStep because that callback depends on it: leaving
   * it below would have the validator close over a binding declared later and
   * silently miss it in its dependency array.
   */
  const sourceRowTargets = useMemo((): Partial<Record<'general' | 'easy' | 'medium' | 'hard', number>> => {
    const type = form.exerciseType;

    // MCQ (or the MCQ half of Combined) with a level split.
    if (showsMcqConfig(type) && form.questionConfiguration.levelBasedEnabled) {
      const lc = form.questionConfiguration.levelCounts;
      return { easy: lc.easy || 0, medium: lc.medium || 0, hard: lc.hard || 0 };
    }

    // Programming / Other with a level-based or selection-level strategy.
    const codeCfg = showsOthersConfig(type) ? form.othersConfig
      : showsProgrammingConfig(type) ? form.programmingConfig
        : null;
    if (codeCfg && codeCfg.questionConfigType !== 'general') {
      const counts = codeCfg.questionConfigType === 'selectionLevel'
        ? codeCfg.selectionLevelCounts
        : codeCfg.levelBasedCounts;
      return {
        easy: Number(counts?.easy || 0),
        medium: Number(counts?.medium || 0),
        hard: Number(counts?.hard || 0),
      };
    }

    // Single row. Combined counts BOTH halves, since the matrix covers the
    // whole paper rather than one side of it.
    let total = 0;
    if (showsMcqConfig(type)) total += Number(form.questionConfiguration.totalQuestions || 0);
    if (showsProgrammingConfig(type)) total += Number(form.programmingConfig.generalQuestionCount || 0);
    if (showsOthersConfig(type)) total += Number(form.othersConfig.generalQuestionCount || 0);
    return { general: total };
  }, [
    form.exerciseType, form.questionConfiguration, form.programmingConfig, form.othersConfig,
  ]);

  // Marks the MCQ half is worth — the whole total, or just the MCQ slice of a
  // Combined paper. This is the numerator of the Auto marks-per-question sum.
  const mcqMarksBasis = form.exerciseType === 'Combined'
    ? Number(form.totalMarksMCQ || 0)
    : Number(form.totalMarks || 0);

  // Equal Distribution derives marks/question rather than asking for it.
  // Rounded to 2dp so 100 ÷ 3 reads 33.33 instead of 33.333333333333336.
  const autoMarksPerQuestion = (() => {
    const q = Number(form.questionConfiguration.totalQuestions || 0);
    if (!q || !mcqMarksBasis) return 0;
    return Math.round((mcqMarksBasis / q) * 100) / 100;
  })();

  const validateStep = useCallback((which: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (which === 1) {
      if (!form.assessmentName.trim()) e.assessmentName = 'Assessment name is required';
      if (form.durationMinutes <= 0) e.durationMinutes = 'Duration must be greater than 0';
      if (!form.isSectionBased && form.totalMarks < 0) e.totalMarks = 'Total marks cannot be negative';
      if (form.isSectionBased) {
        if (!form.sections.length) e.sections = 'Add at least one section';
        else if (form.sections.some((s) => !s.name.trim())) e.sections = 'Every section needs a name';
      }
    }
    if (which === 2 && !form.isSectionBased) {
      // MCQ half — validated for MCQ and Combined.
      // AI evaluation is unusable without at least one criterion — the grader
      // would have nothing to score against.
      if (form.evaluationMethod.method === 'ai' && !form.evaluationMethod.ai.criteria?.length) {
        e.evaluationMethod = 'Select at least one criterion for the AI evaluator.';
      }
      if (showsMcqConfig(form.exerciseType)) {
        const qc = form.questionConfiguration;
        if (qc.totalQuestions < 0) e.totalQuestions = 'Cannot be negative';
        // Equal Distribution derives the per-question mark, so only the
        // Question Specific path can have an invalid one entered by hand.
        if (qc.scoringType === 'questionSpecific' && qc.marksPerQuestion <= 0) {
          e.marksPerQuestion = 'Marks per question must be greater than 0';
        }
        if (qc.levelBasedEnabled) {
          const sum = qc.levelCounts.easy + qc.levelCounts.medium + qc.levelCounts.hard;
          if (qc.totalQuestions > 0 && sum !== qc.totalQuestions) {
            e.levelCounts = `Level counts (${sum}) must add up to Total Questions (${qc.totalQuestions})`;
          }
        }
      }
      // Combined splits the total between the two halves — they must add up,
      // or the paper is worth a different number of marks than Step 1 says.
      if (form.exerciseType === 'Combined' && form.totalMarks > 0) {
        const split = Number(form.totalMarksMCQ || 0) + Number(form.totalMarksProgramming || 0);
        if (Math.abs(split - form.totalMarks) > 0.01) {
          e.totalMarksMCQ = `MCQ (${form.totalMarksMCQ}) + Programming (${form.totalMarksProgramming}) must equal Total Marks (${form.totalMarks})`;
        }
      }
      // ── Marks must add up to Step 1's Total Marks ──
      // The whole point of Step 1 asking for a total is that Step 2 has to
      // account for it. A level grid summing to 48 against a 100-mark paper is
      // a paper that cannot be scored, so it must not pass.
      for (const [key, cfg, basis] of ([
        ['programmingConfig', form.programmingConfig,
          form.exerciseType === 'Combined' ? Number(form.totalMarksProgramming || 0) : Number(form.totalMarks || 0)],
        ['othersConfig', form.othersConfig, Number(form.totalMarks || 0)],
      ] as Array<[string, any, number]>)) {
        const relevant =
          (key === 'programmingConfig' && showsProgrammingConfig(form.exerciseType)) ||
          (key === 'othersConfig' && showsOthersConfig(form.exerciseType));
        if (!relevant) continue;

        if (cfg.questionConfigType !== 'general') {
          const counts = cfg.questionConfigType === 'selectionLevel' ? cfg.selectionLevelCounts : cfg.levelBasedCounts;
          const questionSum = Number(counts?.easy || 0) + Number(counts?.medium || 0) + Number(counts?.hard || 0);
          if (questionSum === 0) {
            e.levelCounts = 'Set at least one question across the difficulty levels';
          } else if (basis > 0) {
            // Same helper the block uses to render "Allocated N/total", so the
            // badge and this check can never disagree.
            const allocated = codeAllocatedMarks(cfg, basis);
            if (Math.abs(allocated - basis) > 0.01) {
              e.levelCounts = `Level totals sum to ${allocated} but total is ${basis}.`;
            }
          }
        } else if (basis > 0 && Number(cfg.generalQuestionCount || 0) <= 0) {
          e.generalQuestionCount = 'Set how many questions this paper holds';
        }
      }

      // MCQ under Question Specific: the author enters the per-question mark
      // by hand, so it can drift from the total. Equal Distribution derives it
      // and is balanced by construction.
      if (showsMcqConfig(form.exerciseType) && mcqMarksBasis > 0) {
        const qc = form.questionConfiguration;
        if (qc.scoringType === 'questionSpecific' && qc.totalQuestions > 0) {
          const allocated = Math.round(qc.totalQuestions * qc.marksPerQuestion * 100) / 100;
          if (Math.abs(allocated - mcqMarksBasis) > 0.01) {
            e.marksPerQuestion = `${qc.totalQuestions} × ${qc.marksPerQuestion} = ${allocated}, but the total is ${mcqMarksBasis}.`;
          }
        }
      }
    }
    if (which === 3) {
      if (!form.questionSources.length) {
        e.questionSources = 'Pick at least one question source';
      } else if (form.questionSources.length > 1) {
        // Multiple sources means the split has to account for every question,
        // or the paper is under-specified: the author has said "some from AI"
        // without saying how many.
        const rows = Object.keys(sourceRowTargets) as Array<keyof typeof sourceRowTargets>;
        const unbalanced = rows.find((r) => {
          const target = sourceRowTargets[r] ?? 0;
          const sum = form.questionSources.reduce(
            (acc, s) => acc + Number((form.customDistribution?.[r] as any)?.[s] ?? 0), 0,
          );
          return sum !== target;
        });
        if (unbalanced && (sourceRowTargets[unbalanced] ?? 0) > 0) {
          e.questionSources = `The ${unbalanced === 'general' ? 'question' : unbalanced} row must add up to ${sourceRowTargets[unbalanced]} — use Split evenly if you are unsure.`;
        }
      }
    }
    if (which === 4) {
      const start = instantOf(form.startDate, form.startTime);
      const end = instantOf(form.endDate, form.endTime);
      if (start !== null && end !== null && end <= start) e.endDate = 'The end must be after the start';
      if (form.status === 'published') {
        if (!form.startDate || !form.startTime) e.startDate = 'A published assessment needs a start date and time';
        if (!form.endDate || !form.endTime) e.endDate = 'A published assessment needs an end date and time';
      }
    }
    if (which === 7) {
      if (form.passingMarks < 0) e.passingMarks = 'Passing marks cannot be negative';
      if (form.gradeSettings.enablePassMark && form.totalMarks > 0 && form.passingMarks > form.totalMarks) {
        e.passingMarks = `Cannot exceed total marks (${form.totalMarks})`;
      }
    }
    return e;
  }, [form, sourceRowTargets]);

  const stepComplete = useCallback(
    (id: number) => Object.keys(validateStep(id)).length === 0,
    [validateStep],
  );

  // Everything the wizard knows, in server shape. Sent whole on every save —
  // the server merges nested groups, so a later step cannot blank an earlier
  // one, and one payload keeps the two sides simpler than per-step diffs.
  const buildPayload = (): Partial<ExternalAssessment> => ({
    assessmentName: form.assessmentName.trim(),
    description: form.description.trim(),
    instructions: form.instructions.trim(),
    testType: form.testType,
    exerciseType: form.isSectionBased ? 'SectionBased' : (form.exerciseType as any),
    exerciseLevel: form.exerciseLevel as any,
    selectedModule: form.selectedModule,
    selectedLanguages: form.selectedLanguages,
    isSectionBased: form.isSectionBased,
    sectionBasedDuration: form.sectionBasedDuration,
    sections: form.sections.map((s, i) => ({ ...s, order: i + 1 })),
    durationMinutes: Number(form.durationMinutes) || 60,
    totalMarks: Number(form.totalMarks) || 0,
    passingMarks: Number(form.passingMarks) || 0,
    questionConfiguration: {
      ...form.questionConfiguration,
      // Persist the DERIVED value under Equal Distribution so the grader and
      // the Questions panel both see a real number, not the stale one the
      // read-only field never wrote back.
      marksPerQuestion: form.questionConfiguration.scoringType === 'equalDistribution'
        ? autoMarksPerQuestion
        : form.questionConfiguration.marksPerQuestion,
    },
    programmingConfig: form.programmingConfig,
    othersConfig: form.othersConfig,
    evaluationMethod: form.evaluationMethod as any,
    additionalOptions: form.additionalOptions,
    totalMarksMCQ: Number(form.totalMarksMCQ) || 0,
    totalMarksProgramming: Number(form.totalMarksProgramming) || 0,
    questionSources: form.questionSources,
    customDistribution: form.customDistribution,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    startTime: form.startTime,
    endTime: form.endTime,
    scheduleExtras: {
      ...form.scheduleExtras,
      cutOffDate: form.scheduleExtras.cutOffDate || null,
    },
    securitySettings: form.securitySettings,
    notificationSettings: form.notificationSettings,
    gradeSettings: form.gradeSettings,
    settings: form.settings,
    status: form.status,
  });

  /**
   * Persist. `finish` marks every step saved and closes; otherwise this is the
   * footer's Save, which keeps the modal open on the current step — the same
   * incremental-save behaviour the You_Do wizard has.
   */
  const persist = async (finish: boolean) => {
    const failing = STEPS.find((s) => Object.keys(validateStep(s.id)).length > 0);
    if (failing) {
      const e = validateStep(failing.id);
      setErrors(e);
      setStep(failing.id);
      toast.error(Object.values(e)[0], { position: 'top-right' });
      return;
    }

    setSaving(true);
    try {
      const nextSaved = finish
        ? new Set(STEPS.map((s) => s.title))
        : new Set([...savedSteps, STEPS[step - 1].title]);

      const payload = { ...buildPayload(), stepsSaved: Array.from(nextSaved) };
      const saved = draftId
        ? await externalAssessmentApi.update(draftId, payload)
        : await externalAssessmentApi.create(payload);

      setDraftId(saved._id);
      setSavedSteps(nextSaved);
      onSaved(saved);

      if (finish) {
        toast.success(editing ? 'Assessment updated' : 'Assessment created', {
          position: 'top-right', duration: 1800, id: 'external-assessment-save-ok',
        });
        onClose();
      } else {
        toast.success('Saved', { position: 'top-right', duration: 1400, id: 'external-step-save' });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the assessment', {
        position: 'top-right', duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error(Object.values(e)[0], { position: 'top-right' });
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const languages = useMemo(
    () => (form.selectedModule ? MODULE_LANGUAGES[form.selectedModule] || [] : []),
    [form.selectedModule],
  );

  if (!open || !mounted) return null;

  const sec = form.securitySettings;
  const notif = form.notificationSettings;
  const qc = form.questionConfiguration;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(6px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-6xl bg-white overflow-hidden flex"
          style={{ height: '94vh', borderRadius: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}
        >
          {/* ── Step rail ── */}
          <aside
            className="hidden md:flex w-72 shrink-0 flex-col overflow-y-auto"
            style={{ background: '#faf3ea' }}
          >
            <div className="flex items-center gap-3 px-5 pt-6 pb-5">
              <span
                className="flex size-9 items-center justify-center rounded-xl text-white shrink-0"
                style={{ background: D.orange }}
              >
                <Sparkles size={18} />
              </span>
              <h2 className="text-base font-extrabold" style={{ color: D.textMain }}>
                {editing ? 'Edit Assessment' : 'Create Assessment'}
              </h2>
            </div>

            <ol className="flex-1 px-3 pb-5 space-y-0.5">
              {STEPS.map((s) => {
                const active = s.id === step;
                const saved = savedSteps.has(s.title);
                const locked = s.id > step && !STEPS.slice(0, s.id - 1).every((p) => stepComplete(p.id));
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setStep(s.id)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                        active ? 'bg-white shadow-sm' : locked ? 'opacity-45 cursor-not-allowed' : 'hover:bg-white/60'
                      }`}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={
                          active
                            ? { background: D.orange, color: '#fff' }
                            : saved
                              ? { background: 'transparent', color: D.orange, border: `1.5px solid ${D.orange}` }
                              : { background: 'transparent', color: '#9ca3af', border: '1.5px solid #d6d3d1' }
                        }
                      >
                        {saved && !active ? <Check size={13} strokeWidth={3} /> : locked ? <Lock size={11} /> : s.id}
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block text-[13px] font-bold truncate"
                          style={{ color: active ? D.textMain : locked ? '#9ca3af' : D.textSub }}
                        >
                          {s.title}
                        </span>
                        <span className="block text-[10px] truncate" style={{ color: D.textHint }}>
                          {s.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* ── Pane ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            <header className="flex items-start justify-between px-8 pt-6 pb-3 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: D.textMuted }}>
                  Step {step}/{STEPS.length}
                </p>
                <h3 className="text-2xl font-extrabold truncate" style={{ color: D.textMain }}>
                  {STEPS[step - 1].title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Saved pill — green tick once this step has been persisted,
                    matching the You_Do wizard's header indicator. */}
                {savedSteps.has(STEPS[step - 1].title) && (
                  <span
                    className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', color: D.emerald }}
                  >
                    <Check size={12} strokeWidth={3} /> Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => !saving && onClose()}
                  aria-label="Close"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6" style={{ borderTop: `1px solid ${D.border}` }}>
              <div className="pt-5 space-y-6">

                {/* ══ 1. Exercise Details ══ */}
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <SectionLabel info="Auto-generated unique identifier for this assessment">
                          Assessment ID
                        </SectionLabel>
                        <div className="relative">
                          <OInput
                            value={editing?.assessmentCode || 'Assigned on save'}
                            onChange={() => {}}
                            readOnly disabled
                            className="cursor-not-allowed bg-slate-50 pr-9"
                          />
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <Lock size={14} className="text-slate-400" />
                          </span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
                          Unique identifier automatically assigned to this assessment
                        </p>
                      </div>
                      <div>
                        <SectionLabel required info="The name participants see in their invitation email">
                          Assessment Name
                        </SectionLabel>
                        <OInput
                          value={form.assessmentName}
                          onChange={(v) => set('assessmentName', v)}
                          placeholder="e.g. Java Programming Assessment"
                          error={errors.assessmentName}
                        />
                      </div>
                    </div>

                    <div>
                      <SectionLabel required info="Mock simulates exam conditions; Final is the end-of-term assessment.">
                        Test Type
                      </SectionLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {TEST_TYPES.map((t) => (
                          <RadioCard
                            key={t.value}
                            selected={form.testType === t.value}
                            onClick={() => set('testType', t.value)}
                            icon={t.icon}
                            title={t.label}
                            description={t.description}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: D.textMuted }}>
                        Current selection:{' '}
                        <span style={{ color: D.orange, fontWeight: 600 }}>
                          {TEST_TYPES.find((t) => t.value === form.testType)?.label}
                        </span>
                      </p>
                    </div>

                    <div className="pt-4" style={{ borderTop: `1px solid ${D.border}` }}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold" style={{ color: D.textSub }}>Section Based</span>
                          <InfoTooltip content="Split the assessment into parts (Part A, Part B…). Disables the single Exercise Type picker." />
                        </div>
                        <OToggle on={form.isSectionBased} onChange={(v) => set('isSectionBased', v)} />
                        {form.isSectionBased && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: D.orangeLight, color: D.orange }}>
                            Exercise Type Disabled
                          </span>
                        )}
                      </div>

                      {form.isSectionBased && (
                        <>
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold" style={{ color: D.textSub }}>Section Based Duration</span>
                              <InfoTooltip content="Set a duration per section instead of one duration for the whole assessment." />
                            </div>
                            <OToggle on={form.sectionBasedDuration} onChange={(v) => set('sectionBasedDuration', v)} />
                          </div>

                          <div className="mt-4">
                            <SectionLabel required info="Each part of the assessment.">Sections</SectionLabel>
                            <div className="space-y-2">
                              {form.sections.map((s, i) => (
                                <div key={i} className="grid grid-cols-[1fr_110px_110px_36px] gap-2 items-start">
                                  <OInput
                                    value={s.name}
                                    onChange={(v) => set('sections', form.sections.map((x, idx) => idx === i ? { ...x, name: v } : x))}
                                    placeholder={`Part ${String.fromCharCode(65 + i)}`}
                                  />
                                  <OInput
                                    type="number" min={0} value={s.totalMarks}
                                    onChange={(v) => set('sections', form.sections.map((x, idx) => idx === i ? { ...x, totalMarks: Number(v) } : x))}
                                    placeholder="Marks"
                                  />
                                  <OInput
                                    type="number" min={0} value={s.totalDuration}
                                    onChange={(v) => set('sections', form.sections.map((x, idx) => idx === i ? { ...x, totalDuration: Number(v) } : x))}
                                    placeholder="Minutes"
                                    disabled={!form.sectionBasedDuration}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => set('sections', form.sections.filter((_, idx) => idx !== i))}
                                    className="h-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            {errors.sections && (
                              <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{errors.sections}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => set('sections', [...form.sections, { name: '', totalMarks: 0, totalDuration: 0 }])}
                              className="mt-2 inline-flex items-center gap-1 h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors"
                              style={{ borderColor: D.border2, color: D.textSub }}
                            >
                              + Add section
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <SectionLabel required info="What kind of questions this assessment holds.">
                          Exercise Type
                        </SectionLabel>
                        <OSelect
                          value={form.exerciseType}
                          onChange={(v) => set('exerciseType', v)}
                          options={EXERCISE_TYPES}
                          disabled={form.isSectionBased}
                        />
                      </div>
                      <div>
                        <SectionLabel info="Optional. Tags the assessment with a skill area.">Skill Set</SectionLabel>
                        <OSelect
                          value={form.selectedModule}
                          onChange={(v) => { set('selectedModule', v); set('selectedLanguages', []); }}
                          options={[
                            { value: '', label: 'None' },
                            ...Object.keys(MODULE_LANGUAGES).map((m) => ({ value: m, label: m })),
                          ]}
                        />
                        {languages.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {languages.map((lang) => {
                              const on = form.selectedLanguages.includes(lang);
                              return (
                                <Chip
                                  key={lang}
                                  on={on}
                                  onClick={() =>
                                    set('selectedLanguages', on
                                      ? form.selectedLanguages.filter((l) => l !== lang)
                                      : [...form.selectedLanguages, lang])
                                  }
                                >
                                  {lang}
                                </Chip>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <SectionLabel info="Guidance only — it does not filter questions.">Difficulty Level</SectionLabel>
                        <OSelect value={form.exerciseLevel} onChange={(v) => set('exerciseLevel', v)} options={LEVELS} />
                      </div>
                      <div>
                        <SectionLabel required info="How long one sitting may run. Always clamped to the end time.">
                          Duration (min)
                        </SectionLabel>
                        <OInput
                          type="number" min={1} max={1440}
                          value={form.durationMinutes}
                          onChange={(v) => set('durationMinutes', Number(v))}
                          error={errors.durationMinutes}
                        />
                      </div>
                      <div>
                        <SectionLabel required info="Leave 0 to sum from the questions you add.">Total Marks</SectionLabel>
                        <OInput
                          type="number" min={0}
                          value={form.totalMarks}
                          onChange={(v) => set('totalMarks', Number(v))}
                          error={errors.totalMarks}
                        />
                      </div>
                    </div>

                    <div>
                      <SectionLabel info="A short summary included in the invitation email.">Description</SectionLabel>
                      {/* Same rich-text editor the You_Do wizard uses for this
                          field, so formatting carries across identically. */}
                      <TipTapEditor
                        value={form.description}
                        onChange={(v: string) => set('description', v)}
                        placeholder="Enter description here..."
                        minHeight="120px"
                        maxHeight="160px"
                        showToolbar
                        editable
                      />
                    </div>
                  </>
                )}

                {/* ══ 2. Question Configuration ══
                    Branches on Exercise Type, exactly as the You_Do wizard does:
                      MCQ        → the MCQ block
                      Programming→ the code block
                      Combined   → a Marks split + BOTH blocks behind tabs
                      Other      → the code block, labelled Other       */}
                {step === 2 && (
                  <>
                    {form.isSectionBased ? (
                      <div className="rounded-xl border p-4" style={{ borderColor: D.border2, background: D.surface }}>
                        <p className="text-xs" style={{ color: D.textMuted }}>
                          This assessment is <strong>section based</strong> — question counts and marks are
                          configured per section on Step 1. Nothing to set here.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Combined — split the total between the two halves first. */}
                        {form.exerciseType === 'Combined' && (
                          <StepGroup title="Marks split" hint="How the total is divided between the MCQ and programming halves.">
                            <div className="grid grid-cols-3 gap-4 items-end">
                              <div>
                                <SectionLabel required>MCQ Marks</SectionLabel>
                                <OInput type="number" min={0} value={form.totalMarksMCQ}
                                  onChange={(v) => set('totalMarksMCQ', Number(v))} error={errors.totalMarksMCQ} />
                              </div>
                              <div>
                                <SectionLabel required>Programming Marks</SectionLabel>
                                <OInput type="number" min={0} value={form.totalMarksProgramming}
                                  onChange={(v) => set('totalMarksProgramming', Number(v))} />
                              </div>
                              <div className="pb-1">
                                <AllocatedBadge
                                  allocated={Number(form.totalMarksMCQ || 0) + Number(form.totalMarksProgramming || 0)}
                                  total={form.totalMarks}
                                />
                              </div>
                            </div>
                          </StepGroup>
                        )}

                        {/* Combined shows both halves; the tab strip keeps the
                            step from becoming one very long scroll. */}
                        {form.exerciseType === 'Combined' && (
                          <div className="flex items-center gap-1 -mb-2" style={{ borderBottom: `1px solid ${D.border}` }}>
                            {([
                              { k: 'mcq' as const, label: 'MCQ', icon: ListChecks },
                              { k: 'programming' as const, label: 'Programming', icon: Terminal },
                            ]).map((t) => {
                              const on = combinedTab === t.k;
                              const Icon = t.icon;
                              return (
                                <button
                                  key={t.k}
                                  type="button"
                                  onClick={() => setCombinedTab(t.k)}
                                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] transition-all"
                                  style={{
                                    color: on ? D.orange : D.textMuted,
                                    fontWeight: on ? 700 : 500,
                                    borderBottom: `2px solid ${on ? D.orange : 'transparent'}`,
                                    marginBottom: -1,
                                  }}
                                >
                                  <Icon size={13} /> {t.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* ── MCQ half ── */}
                        {showsMcqConfig(form.exerciseType) &&
                         (form.exerciseType !== 'Combined' || combinedTab === 'mcq') && (
                          <div className="rounded-xl border bg-white" style={{ borderColor: D.border, padding: '16px 18px' }}>
                            <div className="mb-4 flex items-center gap-3">
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: D.orangeLight, color: D.orange }}>
                                <ListChecks size={16} />
                              </span>
                              <h4 className="text-[15px] font-bold leading-tight" style={{ color: D.textMain }}>
                                MCQ Configuration
                              </h4>
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <SectionLabel required info="How many MCQ questions the paper should hold.">
                                    Total Questions
                                  </SectionLabel>
                                  <OInput type="number" min={0} value={qc.totalQuestions}
                                    onChange={(v) => setGroup('questionConfiguration', 'totalQuestions', Number(v))}
                                    error={errors.totalQuestions} />
                                </div>
                                <div>
                                  <SectionLabel info="Equal Distribution derives this from the marks and question count; Question Specific lets each question carry its own.">
                                    Marks Per Question
                                  </SectionLabel>
                                  {/* Equal Distribution shows the DERIVED value read-only with
                                      an "Auto" badge and the division that produced it —
                                      the You_Do behaviour. Typing into it there would
                                      only be overwritten on the next recompute. */}
                                  {qc.scoringType === 'equalDistribution' ? (
                                    <>
                                      <div className="relative">
                                        <OInput
                                          value={autoMarksPerQuestion}
                                          onChange={() => {}}
                                          readOnly disabled
                                          className="cursor-not-allowed bg-slate-50 pr-16"
                                        />
                                        <span
                                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-[11px] font-bold pointer-events-none"
                                          style={{ color: D.orange }}
                                        >
                                          Auto
                                        </span>
                                      </div>
                                      {mcqMarksBasis > 0 && qc.totalQuestions > 0 && (
                                        <p className="text-[11px] mt-1" style={{ color: D.textMuted }}>
                                          {mcqMarksBasis} ÷ {qc.totalQuestions} ={' '}
                                          <strong style={{ color: D.textMain }}>{autoMarksPerQuestion}</strong>
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <OInput type="number" min={0} step={0.5} value={qc.marksPerQuestion}
                                      onChange={(v) => setGroup('questionConfiguration', 'marksPerQuestion', Number(v))}
                                      error={errors.marksPerQuestion} />
                                  )}
                                </div>
                              </div>

                              <div>
                                <SectionLabel info="Equal gives every question the same mark; Question Specific lets each carry its own.">
                                  Scoring Type
                                </SectionLabel>
                                <div className="max-w-sm">
                                  <OSelect
                                    value={qc.scoringType}
                                    onChange={(v) => setGroup('questionConfiguration', 'scoringType', v)}
                                    options={[
                                      { value: 'equalDistribution', label: 'Equal Distribution' },
                                      { value: 'questionSpecific', label: 'Question Specific' },
                                    ]}
                                  />
                                </div>
                              </div>

                              <div>
                                <SectionLabel info="Free Flow lets participants jump around; Controlled forces a sequence.">
                                  Question Flow
                                </SectionLabel>
                                <PillChoice
                                  value={qc.questionFlow}
                                  onChange={(v) => setGroup('questionConfiguration', 'questionFlow', v)}
                                  options={[
                                    { value: 'freeFlow', label: 'Free Flow', icon: Shuffle },
                                    { value: 'controlled', label: 'Controlled Flow', icon: Shuffle },
                                  ]}
                                />
                              </div>

                              {/* Evaluation Method sits INSIDE Question Configuration,
                                  where the You_Do wizard puts it — it describes how this
                                  paper is judged, not a separate concern. */}
                              <div className="pt-1">
                                <EvaluationMethodBlock
                                  value={form.evaluationMethod as any}
                                  onChange={(patch) => setForm((f) => ({
                                    ...f, evaluationMethod: { ...f.evaluationMethod, ...patch } as any,
                                  }))}
                                  error={errors.evaluationMethod}
                                />
                              </div>

                              <ToggleRow
                                title="Attempt Limit" hint="Restrict the number of submission attempts"
                                on={qc.attemptLimitEnabled}
                                onChange={(v) => setGroup('questionConfiguration', 'attemptLimitEnabled', v)}
                              >
                                <div className="max-w-[180px]">
                                  <SectionLabel>Attempts allowed</SectionLabel>
                                  <OInput type="number" min={1} max={10} value={qc.submissionAttempts}
                                    onChange={(v) => setGroup('questionConfiguration', 'submissionAttempts', Number(v))} />
                                </div>
                              </ToggleRow>

                              <ToggleRow
                                title="Level-based split"
                                hint="Fix how many easy / medium / hard questions the paper holds."
                                on={qc.levelBasedEnabled}
                                onChange={(v) => setGroup('questionConfiguration', 'levelBasedEnabled', v)}
                              >
                                <div className="grid grid-cols-3 gap-3">
                                  {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                                    <div key={lvl}>
                                      <SectionLabel>{lvl[0].toUpperCase() + lvl.slice(1)}</SectionLabel>
                                      <OInput type="number" min={0} value={qc.levelCounts[lvl]}
                                        onChange={(v) => setGroup('questionConfiguration', 'levelCounts', {
                                          ...qc.levelCounts, [lvl]: Number(v),
                                        })} />
                                    </div>
                                  ))}
                                </div>
                                {errors.levelCounts && (
                                  <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{errors.levelCounts}</p>
                                )}
                              </ToggleRow>
                            </div>
                          </div>
                        )}

                        {/* ── Programming half ── */}
                        {showsProgrammingConfig(form.exerciseType) &&
                         (form.exerciseType !== 'Combined' || combinedTab === 'programming') && (
                          <>
                            <CodeConfigBlock
                              title="Programming Configuration"
                              icon={Terminal}
                              config={form.programmingConfig}
                              onChange={(k, v) => setGroup('programmingConfig', k, v)}
                              totalMarks={form.exerciseType === 'Combined' ? form.totalMarksProgramming : form.totalMarks}
                              errors={errors}
                            />

                            {/* Combined already showed Evaluation on the MCQ tab —
                                one paper has one evaluation method, so don't ask
                                for it twice. */}
                            {form.exerciseType !== 'Combined' && (
                              <StepGroup title="Evaluation" hint="How code answers are judged.">
                                <EvaluationMethodBlock
                                  value={form.evaluationMethod as any}
                                  onChange={(patch) => setForm((f) => ({
                                    ...f, evaluationMethod: { ...f.evaluationMethod, ...patch } as any,
                                  }))}
                                  error={errors.evaluationMethod}
                                  // A code paper is never marked by hand here —
                                  // there is no trainer behind an external sitting.
                                  allowManual={false}
                                />
                              </StepGroup>
                            )}
                          </>
                        )}

                        {/* ── Other ── */}
                        {showsOthersConfig(form.exerciseType) && (
                          <CodeConfigBlock
                            title="Other Configuration"
                            icon={Boxes}
                            config={form.othersConfig}
                            onChange={(k, v) => setGroup('othersConfig', k, v)}
                            totalMarks={form.totalMarks}
                            errors={errors}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ══ 3. Question Source ══ */}
                {step === 3 && (
                  <QuestionSourceStep
                    sources={form.questionSources}
                    onSourcesChange={(next) => set('questionSources', next)}
                    distribution={form.customDistribution}
                    onDistributionChange={(next) => set('customDistribution', next)}
                    rowTargets={sourceRowTargets}
                    error={errors.questionSources}
                  />
                )}

                {/* ══ 4. Schedule ══ */}
                {step === 4 && (
                  <>
                    <div className="rounded-xl border px-4 py-3" style={{ borderColor: D.border2, background: D.surface }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: D.textMuted }}>
                        The invitation link only works between these two instants. Before the start participants
                        see <strong>Assessment Not Started</strong>; after the end, <strong>Assessment Expired</strong>.
                      </p>
                    </div>

                    <StepGroup title="Assessment window">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <SectionLabel required={form.status === 'published'}>Start Date</SectionLabel>
                          <OInput type="date" value={form.startDate} onChange={(v) => set('startDate', v)} error={errors.startDate} />
                        </div>
                        <div>
                          <SectionLabel required={form.status === 'published'}>Start Time</SectionLabel>
                          <OInput type="time" value={form.startTime} onChange={(v) => set('startTime', v)} />
                        </div>
                        <div>
                          <SectionLabel required={form.status === 'published'}>End Date</SectionLabel>
                          <OInput type="date" value={form.endDate} onChange={(v) => set('endDate', v)} error={errors.endDate} />
                        </div>
                        <div>
                          <SectionLabel required={form.status === 'published'}>End Time</SectionLabel>
                          <OInput type="time" value={form.endTime} onChange={(v) => set('endTime', v)} />
                        </div>
                      </div>
                    </StepGroup>

                    <StepGroup title="Optional limits">
                      <div className="space-y-2">
                        <ToggleRow
                          title="Cut-off date & time"
                          hint="A hard stop after which no submission is accepted, even a late one."
                          on={form.scheduleExtras.cutOffEnabled}
                          onChange={(v) => setGroup('scheduleExtras', 'cutOffEnabled', v)}
                        >
                          <div className="grid grid-cols-2 gap-3 max-w-md">
                            <div>
                              <SectionLabel>Cut-off Date</SectionLabel>
                              <OInput type="date" value={form.scheduleExtras.cutOffDate}
                                onChange={(v) => setGroup('scheduleExtras', 'cutOffDate', v)} />
                            </div>
                            <div>
                              <SectionLabel>Cut-off Time</SectionLabel>
                              <OInput type="time" value={form.scheduleExtras.cutOffTime}
                                onChange={(v) => setGroup('scheduleExtras', 'cutOffTime', v)} />
                            </div>
                          </div>
                        </ToggleRow>

                        <ToggleRow
                          title="Grace period"
                          hint="Extra minutes allowed past the end for someone already mid-attempt."
                          on={form.scheduleExtras.gracePeriodEnabled}
                          onChange={(v) => setGroup('scheduleExtras', 'gracePeriodEnabled', v)}
                        >
                          <div className="max-w-[180px]">
                            <SectionLabel>Grace (minutes)</SectionLabel>
                            <OInput type="number" min={0} value={form.scheduleExtras.gracePeriodMinutes}
                              onChange={(v) => setGroup('scheduleExtras', 'gracePeriodMinutes', Number(v))} />
                          </div>
                        </ToggleRow>
                      </div>
                    </StepGroup>
                  </>
                )}

                {/* ══ 5. Security Settings ══ */}
                {step === 5 && (
                  <>
                    <StepGroup title="Lockdown" hint="Restrict what the participant can do during the sitting.">
                      <div className="space-y-2">
                        <ToggleRow
                          title="Prevent tab switching" hint="Warn and count when they leave the tab."
                          on={sec.preventTabSwitch} onChange={(v) => setGroup('securitySettings', 'preventTabSwitch', v)}
                        >
                          <div className="max-w-[180px]">
                            <SectionLabel>Max tab switches</SectionLabel>
                            <OInput type="number" min={0} value={sec.maxTabSwitches}
                              onChange={(v) => setGroup('securitySettings', 'maxTabSwitches', Number(v))} />
                          </div>
                        </ToggleRow>
                        <ToggleRow title="Prevent copy & paste" hint="Block clipboard use inside the assessment."
                          on={sec.preventCopyPaste} onChange={(v) => setGroup('securitySettings', 'preventCopyPaste', v)} />
                        <ToggleRow title="Prevent browser close" hint="Warn before the tab is closed mid-attempt."
                          on={sec.preventBrowserClose} onChange={(v) => setGroup('securitySettings', 'preventBrowserClose', v)} />
                      </div>
                    </StepGroup>

                    <StepGroup title="Proctoring & recording">
                      <div className="space-y-2">
                        <ToggleRow title="Camera proctoring" hint="Verify the participant's face before starting."
                          on={sec.enableFaceVerification} onChange={(v) => setGroup('securitySettings', 'enableFaceVerification', v)} />
                        <ToggleRow
                          title="Multiple face detection" hint="Flag when more than one face is visible."
                          on={sec.multipleFaceDetection} onChange={(v) => setGroup('securitySettings', 'multipleFaceDetection', v)}
                        >
                          <div className="max-w-[180px]">
                            <SectionLabel>Warning limit</SectionLabel>
                            <OInput type="number" min={0} value={sec.faceWarningLimit}
                              onChange={(v) => setGroup('securitySettings', 'faceWarningLimit', Number(v))} />
                          </div>
                        </ToggleRow>
                        <ToggleRow title="Record screen" hint="Capture the participant's screen for later review."
                          on={sec.recordScreen} onChange={(v) => setGroup('securitySettings', 'recordScreen', v)} />
                      </div>
                    </StepGroup>

                    <StepGroup title="Timing">
                      <div className="space-y-2">
                        <ToggleRow title="Auto-submit on timeout" hint="Submit whatever has been answered when time runs out."
                          on={sec.autoSubmitOnTimeout} onChange={(v) => setGroup('securitySettings', 'autoSubmitOnTimeout', v)} />
                        <ToggleRow
                          title="Warn before timeout" hint="Show a countdown warning near the end."
                          on={sec.warnBeforeTimeout} onChange={(v) => setGroup('securitySettings', 'warnBeforeTimeout', v)}
                        >
                          <div className="max-w-[180px]">
                            <SectionLabel>Warn at (seconds left)</SectionLabel>
                            <OInput type="number" min={0} value={sec.warningSeconds}
                              onChange={(v) => setGroup('securitySettings', 'warningSeconds', Number(v))} />
                          </div>
                        </ToggleRow>
                      </div>
                    </StepGroup>

                    <StepGroup title="Extra restrictions">
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['requireFullscreen', 'Require fullscreen'],
                          ['preventDevTools', 'Prevent dev tools'],
                          ['preventRightClick', 'Prevent right click'],
                          ['preventPrinting', 'Prevent printing'],
                          ['preventPageRefresh', 'Prevent page refresh'],
                          ['preventBackNavigation', 'Prevent back navigation'],
                        ] as Array<[string, string]>).map(([key, title]) => (
                          <ToggleRow
                            key={key} title={title}
                            on={!!sec[key]} onChange={(v) => setGroup('securitySettings', key, v)}
                          />
                        ))}
                      </div>
                    </StepGroup>
                  </>
                )}

                {/* ══ 6. Notifications ══ */}
                {step === 6 && (
                  <StepGroup title="Who gets told, and when" hint="Emails are sent to participants; summaries come to you.">
                    <div className="space-y-2">
                      <ToggleRow
                        title="Send invitation on add"
                        hint="Email the participant their assessment link as soon as they are added. Only sends once the assessment is published."
                        on={notif.notifyOnInvite} onChange={(v) => setGroup('notificationSettings', 'notifyOnInvite', v)} />
                      <ToggleRow
                        title="Remind before the start"
                        hint="Send a reminder ahead of the opening time."
                        on={notif.notifyBeforeStart} onChange={(v) => setGroup('notificationSettings', 'notifyBeforeStart', v)}
                      >
                        <div className="max-w-[180px]">
                          <SectionLabel>Hours before</SectionLabel>
                          <OInput type="number" min={0} value={notif.reminderHoursBefore}
                            onChange={(v) => setGroup('notificationSettings', 'reminderHoursBefore', Number(v))} />
                        </div>
                      </ToggleRow>
                      <ToggleRow title="Notify me on submission" hint="Email you each time a participant submits."
                        on={notif.notifyOnSubmission} onChange={(v) => setGroup('notificationSettings', 'notifyOnSubmission', v)} />
                      <ToggleRow title="Email result to participant" hint="Send their score once the paper is marked."
                        on={notif.notifyOnResult} onChange={(v) => setGroup('notificationSettings', 'notifyOnResult', v)} />
                    </div>
                  </StepGroup>
                )}

                {/* ══ 7. Grade Settings ══ */}
                {step === 7 && (
                  <>
                    <StepGroup title="Marks & pass mark">
                      <div className="grid grid-cols-2 gap-4 max-w-lg">
                        <div>
                          <SectionLabel info="Leave 0 to sum from the questions.">Total Mark</SectionLabel>
                          <OInput type="number" min={0} value={form.totalMarks}
                            onChange={(v) => set('totalMarks', Number(v))} />
                        </div>
                        <div>
                          <SectionLabel info="Score at or above this counts as a pass.">Mark to Pass</SectionLabel>
                          <OInput type="number" min={0} value={form.passingMarks}
                            onChange={(v) => set('passingMarks', Number(v))}
                            disabled={!form.gradeSettings.enablePassMark}
                            error={errors.passingMarks} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <ToggleRow
                          title="Enable pass mark"
                          hint="Off means the paper is scored but never marked pass or fail."
                          on={form.gradeSettings.enablePassMark}
                          onChange={(v) => setGroup('gradeSettings', 'enablePassMark', v)} />
                      </div>
                    </StepGroup>

                    <StepGroup title="Grade bands" hint="Optional labels applied to a score percentage.">
                      <ToggleRow
                        title="Use grade bands" hint="Poor / Average / Good / Excellent, or your own."
                        on={form.gradeSettings.gradeBandsEnabled}
                        onChange={(v) => setGroup('gradeSettings', 'gradeBandsEnabled', v)}
                      >
                        <div className="space-y-2">
                          {form.gradeSettings.gradeBands.map((b, i) => (
                            <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2">
                              <OInput value={b.label}
                                onChange={(v) => setGroup('gradeSettings', 'gradeBands',
                                  form.gradeSettings.gradeBands.map((x, idx) => idx === i ? { ...x, label: v } : x))} />
                              <OInput type="number" min={0} max={100} value={b.fromPercent}
                                onChange={(v) => setGroup('gradeSettings', 'gradeBands',
                                  form.gradeSettings.gradeBands.map((x, idx) => idx === i ? { ...x, fromPercent: Number(v) } : x))} />
                              <OInput type="number" min={0} max={100} value={b.toPercent}
                                onChange={(v) => setGroup('gradeSettings', 'gradeBands',
                                  form.gradeSettings.gradeBands.map((x, idx) => idx === i ? { ...x, toPercent: Number(v) } : x))} />
                            </div>
                          ))}
                          <p className="text-[10px]" style={{ color: D.textMuted }}>Label · From % · To %</p>
                        </div>
                      </ToggleRow>
                    </StepGroup>

                    <StepGroup title="Marking options">
                      <div className="space-y-2">
                        <ToggleRow title="Shuffle questions" hint="Each participant sees a different order."
                          on={!!form.settings.shuffleQuestions} onChange={(v) => setGroup('settings', 'shuffleQuestions', v)} />
                        <ToggleRow title="Shuffle options" hint="Randomise answer choices within each question."
                          on={!!form.settings.shuffleOptions} onChange={(v) => setGroup('settings', 'shuffleOptions', v)} />
                        <ToggleRow title="Show result to participant" hint="Off means only you see the score."
                          on={!!form.settings.showResultToParticipant} onChange={(v) => setGroup('settings', 'showResultToParticipant', v)} />
                        <ToggleRow
                          title="Negative marking" hint="Deduct marks for a wrong answer. Blanks are never penalised."
                          on={!!form.settings.negativeMarking} onChange={(v) => setGroup('settings', 'negativeMarking', v)}
                        >
                          <div className="max-w-[200px]">
                            <SectionLabel>Marks deducted per wrong answer</SectionLabel>
                            <OInput type="number" min={0} step={0.25} value={form.settings.negativeMarkPerWrong ?? 0}
                              onChange={(v) => setGroup('settings', 'negativeMarkPerWrong', Number(v))} />
                          </div>
                        </ToggleRow>
                      </div>
                    </StepGroup>

                    <StepGroup title="Additional options" hint="How submissions are presented when you mark them.">
                      <div className="space-y-2">
                        <ToggleRow
                          title="Anonymous submissions"
                          hint="Hide participant names while marking, so scores are given blind."
                          on={!!form.additionalOptions.anonymousSubmissions}
                          onChange={(v) => setGroup('additionalOptions', 'anonymousSubmissions', v)} />
                        <ToggleRow
                          title="Hide grader identity"
                          hint="Do not show participants who marked their paper."
                          on={!!form.additionalOptions.hideGraderIdentity}
                          onChange={(v) => setGroup('additionalOptions', 'hideGraderIdentity', v)} />
                      </div>
                    </StepGroup>
                  </>
                )}

                {/* ══ 8. Assessment Content ══ */}
                {step === 8 && (
                  <>
                    <StepGroup title="Instructions" hint="Shown on the landing screen and included in the invitation email.">
                      <TipTapEditor
                        value={form.instructions}
                        onChange={(v: string) => set('instructions', v)}
                        placeholder="Rules participants must read before starting — what is allowed, what is not, how long they have."
                        minHeight="160px"
                        maxHeight="240px"
                        showToolbar
                        editable
                      />
                    </StepGroup>

                    <StepGroup title="Review">
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: D.border2 }}>
                        {([
                          ['Name', form.assessmentName || '—'],
                          ['Test type', TEST_TYPES.find((t) => t.value === form.testType)?.label],
                          ['Type', form.isSectionBased ? `Section based · ${form.sections.length} section(s)` : form.exerciseType],
                          ['Skill set', form.selectedModule ? `${form.selectedModule}${form.selectedLanguages.length ? ` · ${form.selectedLanguages.join(', ')}` : ''}` : '—'],
                          ['Duration', `${form.durationMinutes} minutes`],
                          ['Starts', form.startDate ? `${form.startDate} ${form.startTime || ''}`.trim() : 'Not set'],
                          ['Ends', form.endDate ? `${form.endDate} ${form.endTime || ''}`.trim() : 'Not set'],
                          ['Total marks', form.exerciseType === 'Combined'
                            ? `${form.totalMarks || 0} (MCQ ${form.totalMarksMCQ} + Prog ${form.totalMarksProgramming})`
                            : (form.totalMarks || 'Summed from questions')],
                          ['Mark to pass', form.gradeSettings.enablePassMark ? (form.passingMarks || '—') : 'Disabled'],
                          ['Question source', form.questionSources.map((s) => SOURCE_LABELS[s]).join(' · ') || '—'],
                          ...(showsProgrammingConfig(form.exerciseType)
                            ? [['Evaluation', form.evaluationMethod.method === 'ai' ? 'AI evaluation' : 'Test cases']] as Array<[string, React.ReactNode]>
                            : []),
                        ] as Array<[string, React.ReactNode]>).map(([k, v], i) => (
                          <div key={k} className="flex items-center justify-between px-3.5 py-2 text-xs"
                            style={{ background: i % 2 ? D.surface : '#fff' }}>
                            <span style={{ color: D.textMuted }}>{k}</span>
                            <span className="font-semibold text-right" style={{ color: D.textMain }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </StepGroup>

                    <StepGroup title="Save as">
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { v: 'draft' as const, t: 'Draft', d: 'Keep editing. No invitations can be sent.' },
                          { v: 'published' as const, t: 'Published', d: 'Live. Participants can be invited.' },
                        ]).map((o) => {
                          const on = form.status === o.v;
                          return (
                            <button key={o.v} type="button" onClick={() => set('status', o.v)}
                              className="p-3.5 rounded-xl border-2 text-left transition-all"
                              style={{ borderColor: on ? D.orange : D.border, background: on ? D.orangeLight : '#fff' }}>
                              <span className="block text-sm font-bold" style={{ color: on ? D.orange : D.textSub }}>{o.t}</span>
                              <span className="block text-[11px] mt-0.5" style={{ color: D.textMuted }}>{o.d}</span>
                            </button>
                          );
                        })}
                      </div>
                      {form.status === 'published' && (
                        <p className="mt-2.5 text-[11px] rounded-lg p-2.5 leading-relaxed"
                          style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
                          Publishing requires a start and end date/time <strong>and at least one question</strong>.
                          Add questions from the list once this is saved.
                        </p>
                      )}
                    </StepGroup>
                  </>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <footer
              className="flex items-center gap-2 px-8 py-4 shrink-0"
              style={{ borderTop: `1px solid ${D.border}` }}
            >
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1 || saving}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: D.border2, color: D.textSub }}
              >
                <ChevronLeft size={15} /> Back
              </button>

              <span className="ml-auto flex items-center gap-2">
                {/* Save keeps the modal open and ticks the current step —
                    matching the You_Do wizard's incremental save. */}
                <button
                  type="button"
                  onClick={() => persist(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: D.orange, color: D.orange }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />} Save
                </button>

                {step < STEPS.length ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1 h-9 px-5 rounded-lg text-white text-xs font-bold shadow-sm transition-colors"
                    style={{ background: D.orange }}
                  >
                    Next <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => persist(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-white text-xs font-bold shadow-sm disabled:opacity-60 transition-colors"
                    style={{ background: D.orange }}
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? 'Saving…' : 'Finish'}
                  </button>
                )}
              </span>
            </footer>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
