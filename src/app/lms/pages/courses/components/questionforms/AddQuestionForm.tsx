import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader, Code, ListChecks, Info, Plus, Database, Check } from 'lucide-react';
import { questionApi } from '@/apiServices/question';
import FrontendQuestionForm from './FrontendQuestionForm';
import DatabaseQuestionForm from './DatabaseQuestionForm';
import ProgrammingQuestionForm from './ProgrammingQuestionForm';
import MCQQuestionForm from './mcq/MCQQuestionForm';
import QuestionBankSelector from './mcq/QuestionBankSelector';
import OthersAddQuestionForm from './others/OthersAddQuestionForm';
import { toast } from 'react-toastify';
import { exerciseApi } from '@/app/lms/pages/courses/api/exercise'; // add this
import ExerciseSettings from '@/app/lms/pages/courses/components/ExerciseSettings';
// Shared "Add a question" chooser chrome — the same modal the We_Do
// (QuestionsView) and You_Do (QuestionsTest) surfaces render, so the Combined
// MCQ step no longer shows its own drifted popup.
import {
  AQ, AddQuestionModalShell, AddQuestionSourceRow,
  AQIconScratch, AQIconDocument, AQIconAI, AQMostFlexibleTag, AQNewBadge,
} from './AddQuestionChooserUI';
// ─── Types ─────────────────────────────────────────────────────────────────────
interface AddQuestionFormProps {
  exerciseData: any;
  breadcrumbs?: Array<{ name: string; type: string }>;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  initialQuestionId?: string;          // ← ADD THIS

  onClose: () => void;
  onSave: (data: any) => void;
  onOpenQuestionBank?: (type: string) => void;
  onOpenDocumentUpload?: () => void;
  onMCQBankSelect?: (questions: any[]) => void;
  // Bank questions to pre-load into the dispatched form (review-then-save).
  initialBankQuestions?: any[];
  // Source tag stamped on those preloaded questions ('scratch-bank' | 'thirdParty').
  initialBankSource?: string;
  showTypeSelector?: boolean;
  onEditExercise?: () => void;
  remainingQuestions?: number;
  marksPerQuestion?: number;
  shouldRefreshOnMount?: boolean;
  // Optional — only provided for section-based assessments. When present,
  // child forms render a "Section Details" button in their sidebar.
  sectionData?: any;
  // Approval workflow integration
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
  /**
   * When set, the child form auto-opens the matching source modal on mount
   * so the teacher lands on the right authoring surface (AI generator / bank
   * picker) instead of a blank editor. Forwarded to ProgrammingQuestionForm.
   */
  autoOpenSource?: 'manual' | 'ai' | 'bank' | 'thirdParty';
  /**
   * Difficulty already chosen by the caller (the host now asks "which level?"
   * BEFORE "which source?"). Seeds `lockedDiff`, which makes the internal
   * difficulty popup skip itself — the teacher is not asked the same question
   * twice. Omit it and the popup behaves exactly as before.
   */
  initialDifficulty?: 'easy' | 'medium' | 'hard';
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const AddQuestionForm: React.FC<AddQuestionFormProps> = ({
  exerciseData,
  breadcrumbs,
  tabType,
  initialData,
  isEditing = false,
  initialQuestionId,
  onClose,
  onSave,
  onOpenQuestionBank,
  onOpenDocumentUpload,
  onMCQBankSelect,
  initialBankQuestions,
  initialBankSource,
  showTypeSelector,
  onEditExercise,
  shouldRefreshOnMount,
  sectionData,
  approval, approvalContext, onQueryResolved,
  autoOpenSource,
  initialDifficulty,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<'mcq' | 'programming' | null>(null);
  const [showMCQOpts, setShowMCQOpts] = useState(false);
  const [showInlineQBank, setShowInlineQBank] = useState(false);
  // Combined → Programming source chooser, and the route it picked. The route
  // is forwarded to ProgrammingQuestionForm as autoOpenSource, so each row uses
  // the same machinery the pure-Programming surface already drives.
  const [showProgOpts, setShowProgOpts] = useState(false);
  const [progSource, setProgSource] = useState<'manual' | 'ai' | 'bank' | 'thirdParty' | null>(null);

  // Difficulty popup (level / selectionLevel only — NOT general)
  const [showDiffPopup, setShowDiffPopup] = useState(false);
  const [lockedDiff, setLockedDiff] = useState<'easy' | 'medium' | 'hard' | null>(initialDifficulty ?? null);
const [diffRefreshTrigger, setDiffRefreshTrigger] = useState(0);

  // Combined limits
  const [qCounts, setQCounts] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [localExerciseData, setLocalExerciseData] = useState(exerciseData);
  const [showExerciseSettings, setShowExerciseSettings] = useState(false);
  const localExerciseDataRef = useRef(exerciseData); // ← ADD THIS
  const settingsSaveInProgress = useRef(false); // guards against double-fetch when save path calls onClose then onSave

  useEffect(() => {
    localExerciseDataRef.current = localExerciseData;
  }, [localExerciseData]);
  // ✅ Track whether we are mid Save-and-Next flow — use ref so it survives
  // re-renders without causing them, and is NOT reset by state updates
  const isInSaveAndContinueFlow = useRef(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  useEffect(() => {
    setLocalExerciseData(exerciseData);
  }, [exerciseData.exerciseId]);
  // ── Exercise config ────────────────────────────────────────────────────────
  const fullEx = exerciseData.fullExerciseData;
  const progCfg = fullEx?.questionConfiguration?.programmingQuestionConfiguration;
  const cfgType = progCfg?.questionConfigType || 'general';
  const isGeneral = cfgType === 'general';
  const isLevelMode = cfgType === 'levelBased' || cfgType === 'selectionLevel';

  // ── Question Source enforcement (single source of truth) ─────────────────
  // The `questionSource` set in Exercise Settings decides which entry points
  // are surfaced here. See ProgrammingQuestionForm for the full rule table.
  // This table only gates the MCQ sub-options here, so a Combined exercise
  // with a separated MCQ source (questionSourceMcq) uses that part's rules —
  // but only while the exercise is actually Combined (stale trios from a
  // mid-creation type switch must not gate other types).
  const _isCombinedForSource = fullEx?.exerciseType?.toLowerCase?.() === 'combined' ||
    exerciseData.exerciseType?.toLowerCase?.() === 'combined' ||
    showTypeSelector === true;
  const _mcqPartSrc = _isCombinedForSource ? fullEx?.questionSourceMcq : null;
  const questionSourceRaw = _mcqPartSrc || fullEx?.questionSource;
  const customSourcesRaw: string[] = _mcqPartSrc
    ? (Array.isArray(fullEx?.customSourcesMcq) ? fullEx.customSourcesMcq : [])
    : (Array.isArray(fullEx?.customSources) ? fullEx.customSources : []);
  const _resolveAllowed = (src: any, custom: string[]) => {
    const s = src || null;
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      const has = (x: string) => custom.includes(x);
      return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
    }
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  };
  const allowedSources = _resolveAllowed(questionSourceRaw, customSourcesRaw);

  // The Programming half of a Combined exercise is NOT covered by
  // questionSourceMcq — it reads the exercise-level questionSource, exactly as
  // ProgrammingQuestionForm does internally. Resolving it separately keeps the
  // chooser's rows and the form's own gating from disagreeing.
  const _progSourceRaw = fullEx?.questionSource;
  const _progCustomRaw: string[] = Array.isArray(fullEx?.customSources) ? fullEx.customSources : [];
  const allowedSourcesProg = _resolveAllowed(_progSourceRaw, _progCustomRaw);
  // Generic "Question Bank" is scratch's second entry point; Other Platform has
  // its own row that stamps imports thirdParty. Mirrors ProgrammingQuestionForm.
  const bankViaScratchProg = (() => {
    const s = _progSourceRaw || null;
    if (!s) return true;              // legacy exercises — allow all
    if (s === 'scratch') return true;
    if (s === 'custom') return _progCustomRaw.includes('scratch');
    return false;
  })();
  const progRoutes = {
    manual: allowedSourcesProg.manual,
    bank: bankViaScratchProg,
    thirdParty: allowedSourcesProg.thirdParty,
    ai: allowedSourcesProg.ai,
  };
  const progRouteCount = Object.values(progRoutes).filter(Boolean).length;
  // A source picked in the Combined chooser outranks the caller's prop — both
  // feed ProgrammingQuestionForm's autoOpenSource and the difficulty-popup gate
  // (AI / bank / Other Platform carry their own difficulty, so no level step).
  const effectiveAutoOpen = progSource ?? autoOpenSource;

  const isCombined =
    showTypeSelector === true ||
    fullEx?.exerciseType?.toLowerCase() === 'combined' ||
    fullEx?.configurationType?.combinedMode === true ||
    exerciseData.exerciseType?.toLowerCase() === 'combined';

  // ── Module type ────────────────────────────────────────────────────────────
  // In AddQuestionForm.tsx, replace the getModuleType function:

  const getModuleType = (): string | null => {
    const fullEx = exerciseData?.fullExerciseData;

    // For editing mode, check initialData thoroughly
    if (isEditing && initialData) {
      // Check 1: Explicit questionType field
      if (initialData.questionType) {
        if (initialData.questionType === 'mcq') return 'mcq';
        if (initialData.questionType === 'frontend') return 'frontend';
        if (initialData.questionType === 'database') return 'database';
        if (initialData.questionType === 'programming') {
          // Frontend & Database questions are persisted with questionType:'programming'
          // (the FrontendQuestionForm saves as 'programming', and the server only tags
          // database questions with moduleType:'Database'). So a stored 'programming'
          // type is ambiguous on edit — refine it exactly the way the "add" path does:
          // via the question's own module markers, falling back to the exercise's module.
          const mod = (
            initialData.moduleType ||
            fullEx?.programmingSettings?.selectedModule ||
            exerciseData.programmingSettings?.selectedModule ||
            ''
          ).toString().toLowerCase();
          if (initialData.isFrontend === true || mod === 'frontend') return 'frontend';
          if (
            initialData.isDatabase === true ||
            mod === 'database' ||
            ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(mod)
          ) return 'database';
          return 'programming';
        }
      }

      // Check 2: MCQ-specific fields (most reliable for MCQ)
      if (
        initialData.mcqQuestionTitle !== undefined ||
        initialData.mcqQuestionType !== undefined ||
        initialData.mcqQuestionOptions !== undefined ||
        initialData.mcqQuestionDifficulty !== undefined ||
        initialData.mcqQuestionScore !== undefined ||
        Array.isArray(initialData.mcqQuestionOptions)
      ) {
        return 'mcq';
      }

      // Check 3: Module type indicators
      const moduleIndicator = (
        initialData.moduleType ||
        initialData.isFrontend ||
        initialData.isDatabase ||
        fullEx?.programmingSettings?.selectedModule ||
        exerciseData.programmingSettings?.selectedModule ||
        ''
      ).toString().toLowerCase();

      if (moduleIndicator.includes('frontend') || initialData.isFrontend === true) {
        return 'frontend';
      }

      if (moduleIndicator.includes('database') ||
        ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(moduleIndicator) ||
        initialData.isDatabase === true) {
        return 'database';
      }

      // Check 4: Programming-specific fields
      if (
        initialData.testCases !== undefined ||
        initialData.sampleInput !== undefined ||
        initialData.sampleOutput !== undefined ||
        initialData.constraints !== undefined ||
        initialData.solutions !== undefined
      ) {
        return 'programming';
      }

      // Default to programming if we can't determine
      return 'programming';
    }

    // ── ADD via Question Bank — route by the BANK QUESTION's own type ──
    // The form picker for a brand-new question normally relies on the
    // exercise's selectedModule. But when the teacher comes from the bank,
    // the question they picked carries its own `questionType` (e.g. a
    // question stored as questionCategory:"Programming" with questionType:
    // "frontend" must open the FrontendQuestionForm — NOT ProgrammingQuestionForm
    // — because frontend questions don't have constraints / test-cases
    // fields and would fill the wrong form). This check mirrors the edit-path
    // logic above so the bank flow stays in sync.
    if (!isEditing && initialBankQuestions && initialBankQuestions.length > 0) {
      const bankQ: any = initialBankQuestions[0] || {};
      const bankType = (bankQ.questionType || '').toString().toLowerCase();
      if (bankType === 'mcq') return 'mcq';
      if (bankType === 'frontend') return 'frontend';
      if (bankType === 'database') return 'database';
      if (bankType === 'programming') {
        // "programming" is sometimes used as a catch-all by the bank — refine
        // it via the question's module markers, falling back to the exercise's.
        const mod = (
          bankQ.moduleType ||
          bankQ.module ||
          (bankQ.metadata && bankQ.metadata.moduleType) ||
          fullEx?.programmingSettings?.selectedModule ||
          exerciseData.programmingSettings?.selectedModule ||
          ''
        ).toString().toLowerCase();
        if (bankQ.isFrontend === true || mod === 'frontend') return 'frontend';
        if (
          bankQ.isDatabase === true ||
          mod === 'database' ||
          ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(mod)
        ) return 'database';
        return 'programming';
      }
      // bankType is empty / unknown — fall through to the existing exercise-based logic
    }

    // For combined exercises, use selectedType
    if (isCombined) {
      if (selectedType === 'mcq') return 'mcq';
      if (selectedType === 'programming') {
        const mod = (
          fullEx?.programmingSettings?.selectedModule ||
          exerciseData.programmingSettings?.selectedModule ||
          ''
        ).toLowerCase();
        if (mod === 'frontend') return 'frontend';
        if (mod === 'database' || ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(mod)) return 'database';
        return 'programming';
      }
      return null;
    }

    // For non-combined exercises, determine by exercise type
    const exType = (fullEx?.exerciseType || exerciseData?.exerciseType || '').toLowerCase();

    if (exType === 'other') return 'others';

    if (exType === 'mcq' || fullEx?.configurationType?.mcqMode) {
      return 'mcq';
    }

    const mod = (
      fullEx?.programmingSettings?.selectedModule ||
      exerciseData.programmingSettings?.selectedModule ||
      fullEx?.selectedModule ||
      ''
    ).toLowerCase();

    if (mod === 'frontend') return 'frontend';
    if (mod === 'database' || ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(mod)) return 'database';

    return 'programming';
  };
  const moduleType = getModuleType();
  const isMCQ = moduleType === 'mcq';
  const isFrontend = moduleType === 'frontend';
  const isDatabase = moduleType === 'database';
  const isOthers = moduleType === 'others';

  // ── Entity type for API calls ──────────────────────────────────────────────
  const entityType = (() => {
    const m: Record<string, string> = {
      module: 'modules', modules: 'modules',
      submodule: 'submodules', submodules: 'submodules',
      topic: 'topics', topics: 'topics',
      subtopic: 'subtopics', subtopics: 'subtopics',
    };
    return (m[exerciseData.nodeType?.toLowerCase()?.trim()] || 'topics') as any;
  })();

  // ── Combined counts ────────────────────────────────────────────────────────
  const calculateCombinedCounts = useCallback(async () => {
    setLoading(true);
    try {
      let freshExercise: any = null;
      try {
        const exerciseId = exerciseData.exerciseId || exerciseData._id;
        const freshResponse = await questionApi.getExerciseById(exerciseId);
        if (freshResponse?.data?.exercise) {
          freshExercise = freshResponse.data.exercise;
        } else if (freshResponse?.data) {
          freshExercise = freshResponse.data;
        } else if (freshResponse?.exercise) {
          freshExercise = freshResponse.exercise;
        } else {
          freshExercise = freshResponse;
        }
      } catch (fetchErr) {
        console.warn('⚠️ API fetch failed, using cached data:', fetchErr);
        freshExercise = exerciseData.fullExerciseData || exerciseData;
      }

      if (!freshExercise) {
        toast.error('Could not load question counts');
        setLoading(false);
        return;
      }

      const questions = freshExercise?.questions ||
        freshExercise?.data?.questions ||
        exerciseData.fullExerciseData?.questions ||
        [];

      const mcqCfg = freshExercise?.questionConfiguration?.mcqQuestionConfiguration;

      const freshProgCfg = freshExercise?.questionConfiguration?.programmingQuestionConfiguration ||
        freshExercise?.questionConfiguration?.programmingConfig;

      const freshCfgType = freshProgCfg?.questionConfigType || 'general';
      const freshIsGeneral = freshCfgType === 'general';

      // ── MCQ counts ──────────────────────────────────────────────────────────
      const mcqQs = questions.filter((q: any) => q.questionType === 'mcq');
      const mcqCount = mcqQs.length;
      const mcqTotalScore = mcqQs.reduce((sum: number, q: any) => sum + (q.mcqQuestionScore || 0), 0);

      let mcqCanAdd = true;
      let mcqReason = '';

      if (mcqCfg) {
        const maxMcq = mcqCfg.totalMcqQuestions || 0;
        const maxMcqMarks = mcqCfg.mcqTotalMarks || 0;
        if (maxMcq > 0 && mcqCount >= maxMcq) {
          mcqCanAdd = false;
          mcqReason = `MCQ limit reached (${mcqCount}/${maxMcq})`;
        } else if (maxMcqMarks > 0 && mcqTotalScore >= maxMcqMarks) {
          // Only enforce the marks cap when one is actually configured.
          // Non-graded MCQs have mcqTotalMarks=0 — slot availability alone
          // decides whether another question can be added.
          mcqCanAdd = false;
          mcqReason = `MCQ marks limit reached (${mcqTotalScore}/${maxMcqMarks})`;
        }
      }

      // ── Programming counts ──────────────────────────────────────────────────
      const progQs = questions.filter((q: any) => q.questionType === 'programming');
      let anyProgOk = false;
      let levelSlots: Record<string, any> = {};
      let generalSlot: any = null;

      if (freshIsGeneral) {
        const maxQ = freshProgCfg?.generalQuestionCount || 0;
        const cur = progQs.length;
        const ok = cur < maxQ;
        generalSlot = { count: cur, maxCount: maxQ, canAdd: ok };
        anyProgOk = ok;
      } else {
        const counts =
          freshCfgType === 'levelBased'
            ? freshProgCfg?.levelBasedCounts
            : freshProgCfg?.selectionLevelCounts;

        (['easy', 'medium', 'hard'] as const).forEach(d => {
          const max = counts?.[d] || 0;
          if (!max) return;
          const cur = progQs.filter((q: any) => q.difficulty === d).length;
          const ok = cur < max;
          if (ok) anyProgOk = true;
          levelSlots[d] = { count: cur, maxCount: max, canAdd: ok };
        });
      }

      setQCounts({
        mcq: {
          count: mcqCount,
          totalScore: mcqTotalScore,
          maxCount: mcqCfg?.totalMcqQuestions || 0,
          maxMarks: mcqCfg?.mcqTotalMarks || 0,
          canAdd: mcqCanAdd,
          reason: mcqReason,
        },
        programming: {
          isGeneral: freshIsGeneral,
          levelSlots,
          generalSlot,
          anyCanAdd: anyProgOk,
        },
      });

    } catch (err) {
      console.error('calculateCombinedCounts error:', err);
      toast.error('Failed to load question counts');
    } finally {
      setLoading(false);
    }
  }, [exerciseData.exerciseId, exerciseData._id, exerciseData.fullExerciseData]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isEditing) return;

    if (isCombined) {
      calculateCombinedCounts();
      return;
    }

    if (['programming', 'frontend', 'database'].includes(moduleType || '') && isLevelMode) {
      // Only manual authoring needs a difficulty picked up front. AI generation
      // (per-difficulty sliders) and bank / Other Platform imports (each pick
      // carries its own difficulty) handle difficulty themselves — asking here
      // would just be an extra step before their modal.
      if (autoOpenSource && autoOpenSource !== 'manual') return;
      setShowDiffPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditing || !isCombined || selectedType !== 'programming') return;
    if (isLevelMode && lockedDiff === null) {
      setShowDiffPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  useEffect(() => {
    return () => {
      isInSaveAndContinueFlow.current = false;
    };
  }, []);
// Auto-select type when in Manage Test mode with Combined section
useEffect(() => {
  // If we're in Manage Test (sectionData exists) and it's a Combined section
  if (sectionData && sectionData.exerciseType === 'Combined' && !selectedType && !isEditing) {
    // Default to MCQ when in Manage Test
    setSelectedType('mcq');
  }
}, [sectionData, selectedType, isEditing]);
  // ── Difficulty options for popup ───────────────────────────────────────────
 // Replace your existing getDiffOptions with this useCallback version
const getDiffOptions = useCallback(() => {
  // Use localExerciseData instead of exerciseData for latest data
  const currentFullEx = localExerciseData?.fullExerciseData || exerciseData?.fullExerciseData;
  const currentProgCfg = currentFullEx?.questionConfiguration?.programmingQuestionConfiguration;
  const currentCfgType = currentProgCfg?.questionConfigType || 'general';
  const currentCounts = currentCfgType === 'levelBased'
    ? currentProgCfg?.levelBasedCounts
    : currentProgCfg?.selectionLevelCounts;
  
  const progQs = (currentFullEx?.questions || []).filter((q: any) => q.questionType === 'programming');

  // ── Manual (scratch) slice of the distribution matrix ────────────────────
  // A level can have open slots overall and STILL be closed to hand-authoring,
  // because the distribution assigned those slots to AI / Other Platform. This
  // popup is the "From Scratch" entry point, so it must respect that column —
  // otherwise it offers a level the editor will then refuse to save into.
  // Mirrors ProgrammingQuestionForm's getSourceRemaining, minus the staged /
  // in-session bookkeeping (nothing is staged before the editor opens).
  const customDist: any = currentFullEx?.customDistribution;
  const usesCustomDist = (() => {
    if ((currentFullEx?.questionSource || null) !== 'custom' || !customDist) return false;
    const t = (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
      s + (customDist[r]?.scratch || 0) + (customDist[r]?.ai || 0) + (customDist[r]?.thirdParty || 0), 0);
    return t > 0;
  })();
  const isScratchTag = (tag: any) => (tag ?? '').toString().startsWith('scratch');

  return (['easy', 'medium', 'hard'] as const)
    .filter(d => (currentCounts?.[d] || 0) > 0)
    .map(d => {
      const total = currentCounts?.[d] || 0;
      const created = progQs.filter((q: any) => q.difficulty === d).length;
      const remaining = Math.max(0, total - created);

      // How this level is SCORED, so the popup can say what a question here
      // is worth instead of only how many are left.
      const lc = currentProgCfg?.scoreSettings?.levelScoringConfiguration?.[d];
      const marks = lc
        ? {
            perQuestion: lc.type === 'question_specific' ? null : (lc.marksPerQuestion ?? null),
            total: lc.totalMarks ?? null,
            perQuestionVaries: lc.type === 'question_specific',
          }
        : null;

      // Where this level's questions are meant to come from. Only meaningful
      // under a custom distribution; otherwise every slot is open to any
      // source and there is no split to show.
      const sources = usesCustomDist
        ? {
            scratch: customDist?.[d]?.scratch || 0,
            ai: customDist?.[d]?.ai || 0,
            thirdParty: customDist?.[d]?.thirdParty || 0,
          }
        : null;

      if (!usesCustomDist) {
        return {
          level: d, remaining, total, canAdd: remaining > 0,
          manualQuota: null as number | null,
          created, levelTotal: total, marks, sources,
        };
      }
      const manualQuota = customDist?.[d]?.scratch || 0;
      const manualUsed = progQs.filter((q: any) => q.difficulty === d && isScratchTag(q.source)).length;
      const manualRemaining = Math.max(0, Math.min(remaining, manualQuota - manualUsed));
      return {
        level: d,
        remaining: manualRemaining,
        total: manualQuota,
        canAdd: manualRemaining > 0,
        manualQuota,
        // `created`/`levelTotal` describe the LEVEL; `total`/`remaining` above
        // describe the manual column within it. The popup shows both, because
        // "3 of 5 done" and "you may hand-write 1 of those" are different
        // facts and conflating them is what made the old copy confusing.
        created: manualUsed,
        levelTotal: total,
        marks, sources,
      };
    });
}, [localExerciseData, exerciseData, diffRefreshTrigger]); // Add diffRefreshTrigger as dependency

  // ── handleSubmit ─────────────────────────────────────────────────────────────────────────
 const handleSubmit = async (questionData: any): Promise<any> => {
  // Child form (e.g. OthersAddQuestionForm) already saved the question — skip API, just close
  if (questionData?.__skipApiCall) {
    onSave(questionData);
    onClose();
    return questionData;
  }

  const isFormData = typeof FormData !== 'undefined' && questionData instanceof FormData;

  const isSaveAndNext = !isFormData && questionData.__saveAndNext === true;

  const cleanData = isFormData
    ? questionData
    : (() => { const { __saveAndNext: _a, __editLocalId: _b, ...rest } = questionData; return rest; })();

  if (isSaveAndNext) {
    isInSaveAndContinueFlow.current = true;
  }

  const isMCQSave =
    isFormData ||
    cleanData.questionType === 'mcq' ||
    questionData.questionType === 'mcq' ||
    !!cleanData.mcqQuestionTitle ||
    !!questionData.mcqQuestionTitle ||
    getModuleType() === 'mcq';

  const isServerEdit = !!(isEditing || initialData?._id || questionData._id || questionData.__questionId);
  
  setIsSaving(true);
  if (!isSaveAndNext) setShowOverlay(true);
  setSaveMessage(isServerEdit ? 'Updating question…' : 'Saving question…');
  setSaveProgress(20);

  try {
    setSaveProgress(50);
    let result: any;
    const questionId = initialData?._id || questionData._id || questionData.__questionId;

    if (isServerEdit && questionId) {
      // UPDATE existing question
      result = await questionApi.updateQuestion(
        entityType,
        exerciseData.nodeId,
        exerciseData.exerciseId,
        questionId,
        cleanData,
        tabType,
        exerciseData.subcategory || 'Practical'
      );
      setSaveMessage('Question updated!');
    } else if (isMCQSave) {
      // ADD new MCQ question
      const mcqData = isFormData
        ? cleanData
        : { ...cleanData, questionType: 'mcq' };
      result = await questionApi.addQuestion(
        entityType,
        exerciseData.nodeId,
        exerciseData.exerciseId,
        mcqData,
        tabType,
        exerciseData.subcategory || 'Practical'
      );
      setSaveMessage('Question saved!');
    } else {
      // ADD new Programming/Frontend/Database question
      result = await questionApi.addQuestion(
        entityType,
        exerciseData.nodeId,
        exerciseData.exerciseId,
        cleanData,
        tabType,
        exerciseData.subcategory || 'Practical'
      );
      setSaveMessage('Question saved!');
    }

    setSaveProgress(90);

    // ✅ CRITICAL FIX: Refresh exercise data after successful save
    // This ensures fullEx?.questions has the latest data for difficulty slot calculations
    await refreshExerciseData();
    
    // ✅ Force difficulty popup to recalculate remaining slots
    setDiffRefreshTrigger(prev => prev + 1);

    const saved =
      result?.question ??
      result?.data?.question ??
      result?.data?.addedQuestions?.[0]?.question ??
      result?.data?.addedQuestions?.[0] ??
      result?.data ??
      result;

    const enriched = {
      ...saved,
      exerciseId: exerciseData.exerciseId,
      savedAt: new Date().toISOString(),
      _id: saved?._id || questionId,
    };

    setSaveProgress(100);

    if (isSaveAndNext) {
      // Notify parent (QuestionsView) — it just shows a toast, does NOT remount
      onSave({
        ...enriched,
        __saveAndNext: true,
        __isUpdate: isServerEdit,
        __questionId: enriched._id,
      });

      // ✅ Return enriched so child forms can update their local state
      return enriched;

    } else {
      const preventClose = !isFormData && questionData.__preventClose === true;

      saveTimer.current = setTimeout(() => {
        // ✅ Only notify parent if we're actually closing
        // When preventClose=true (plain Save button), skip onSave+onClose
        // so QuestionsView doesn't remount this form
        if (!preventClose) {
          onSave(enriched);
          onClose();
          isInSaveAndContinueFlow.current = false;
          setSelectedType(null);
        }
        // When preventClose=true, child forms handle their own state update
      }, 700);

      return enriched;
    }
  } catch (err: any) {
    console.error('handleSubmit error:', err);
    const msg =
      err?.response?.data?.message?.[0]?.value ||
      err?.message ||
      'Please try again.';
    toast.error(`Failed to ${isServerEdit ? 'update' : 'save'} question: ${msg}`);
    isInSaveAndContinueFlow.current = false;
    throw err; // re-throw so child forms can catch it
  } finally {
    setIsSaving(false);
    if (!isSaveAndNext) {
      setTimeout(() => setShowOverlay(false), 800);
    }
  }
};
const refreshExerciseData = useCallback(async () => {
  try {
    const exerciseId = exerciseData.exerciseId || exerciseData._id;
    const freshResponse = await exerciseApi.getExerciseById(exerciseId);
    const freshExercise = freshResponse?.data?.exercise || freshResponse?.data || freshResponse;
    
    if (freshExercise) {
      const updatedExerciseData = {
        ...exerciseData,
        fullExerciseData: freshExercise,
        exerciseType: freshExercise.exerciseType || exerciseData.exerciseType,
        programmingSettings: freshExercise.programmingSettings || exerciseData.programmingSettings,
      };
      localExerciseDataRef.current = updatedExerciseData;
      setLocalExerciseData(updatedExerciseData);
      // Don't remount ProgrammingQuestionForm during Save & Continue — it loses all flow state
      if (!isInSaveAndContinueFlow.current) setRefreshKey(k => k + 1);
      setDiffRefreshTrigger(prev => prev + 1); // ✅ Trigger diff options refresh
    }
  } catch (err) {
    console.warn('Refetch failed:', err);
    if (!isInSaveAndContinueFlow.current) setRefreshKey(k => k + 1);
    setDiffRefreshTrigger(prev => prev + 1);
  }
}, [exerciseData]);
// Called by ExerciseSettings X button — always re-fetch so any step-saves are reflected.
// Guard flag prevents a double-fetch when the save path calls onClose then onSave.
const handleExerciseSettingsClose = useCallback(async () => {
  setShowExerciseSettings(false);
  if (settingsSaveInProgress.current) {
    settingsSaveInProgress.current = false;
    return; // onSave will handle the refresh
  }
  await refreshExerciseData();
}, [refreshExerciseData]);

// Called only when the user completes the full save flow inside ExerciseSettings.
const handleExerciseSettingsSave = useCallback(async (_updatedPayload: any) => {
  settingsSaveInProgress.current = true; // signal handleExerciseSettingsClose to skip
  setShowExerciseSettings(false);
  await refreshExerciseData();
}, [refreshExerciseData]);
  // ─── DIFFICULTY POPUP ──────────────────────────────────────────────────────
const DiffPopup = () => {
  const opts = getDiffOptions();
  
  useEffect(() => {
    const available = opts.filter(opt => opt.canAdd);
    if (opts.length > 0 && available.length === 0) {
      setShowDiffPopup(false);
    } else if (available.length === 1) {
      setLockedDiff(available[0].level);
      setShowDiffPopup(false);
    }
  }, [opts]);
  
  // Roll the per-level numbers up once: the header answers "how far along is
  // this exercise?" before the cards answer "where can I add?".
  const totalSlots = opts.reduce((n, o) => n + (o.levelTotal ?? o.total ?? 0), 0);
  const totalDone = opts.reduce((n, o) => n + (o.created ?? 0), 0);
  const pct = totalSlots > 0 ? Math.round((totalDone / totalSlots) * 100) : 0;

  // Each level owns a colour throughout, not only on hover. The old cards were
  // grey until you pointed at them, so "which level is nearly full?" could not
  // be answered by looking.
  const TONE: Record<string, { ring: string; text: string; dot: string; bar: string; soft: string; chip: string }> = {
    easy:   { ring: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500', soft: 'bg-emerald-50', chip: 'bg-emerald-100 text-emerald-700' },
    medium: { ring: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   soft: 'bg-amber-50',   chip: 'bg-amber-100 text-amber-700' },
    hard:   { ring: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500',    bar: 'bg-rose-500',    soft: 'bg-rose-50',    chip: 'bg-rose-100 text-rose-700' },
  };

  const modeLabel = cfgType === 'levelBased' ? 'Level based'
    : cfgType === 'selectionLevel' ? 'Selection level'
    : 'General';

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">

        {/* Header - what this asks, and which exercise it is asking about */}
        <div className="px-5 pt-4 pb-3.5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Which level are you adding?</h2>
              <p className="text-[11.5px] text-gray-500 mt-1 truncate" title={exerciseData?.exerciseName}>
                {exerciseData?.exerciseName || 'This exercise'}
                <span className="mx-1.5 text-gray-300">|</span>
                <span className="font-medium text-gray-600">{modeLabel}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0" aria-label="Close">
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Overall progress. Without it the cards give three local numbers
              and no sense of whether the exercise is nearly done. */}
          {totalSlots > 0 && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium text-gray-500">Questions authored</span>
                <span className="text-[11px] font-bold text-gray-900 tabular-nums">
                  {totalDone} <span className="font-medium text-gray-400">of {totalSlots}</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* One card per configured level */}
        <div className="p-3.5 space-y-2 max-h-[52vh] overflow-y-auto">
          {opts.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-sm font-semibold text-gray-500">No difficulty levels configured</p>
              <p className="text-[11.5px] text-gray-400 mt-1.5 leading-relaxed">
                Open Exercise Settings then Question Configuration, and give at least one
                level a question count.
              </p>
            </div>
          )}

          {opts.map(({ level, remaining, total, canAdd, manualQuota, created, levelTotal, marks, sources }) => {
            const t = TONE[level] ?? TONE.easy;
            // Two different reasons a level can be closed, and they need
            // different words: the quota is spent, vs the distribution never
            // gave Manual any slots here in the first place.
            const notConfiguredForManual = manualQuota === 0;
            const done = created ?? 0;
            const cap = levelTotal ?? total ?? 0;
            const levelPct = cap > 0 ? Math.round((done / cap) * 100) : 0;

            return (
              <button
                key={level}
                type="button"
                disabled={!canAdd}
                onClick={() => { setLockedDiff(level); setShowDiffPopup(false); }}
                title={notConfiguredForManual
                  ? `Manual authoring is not configured for ${level}. In Exercise Settings, Add Questions, give ${level} at least one question in the Manual column.`
                  : undefined}
                className={`w-full text-left rounded-xl border p-3 transition-all
                  ${canAdd
                    ? `bg-white ${t.ring} hover:shadow-md hover:-translate-y-px active:translate-y-0 cursor-pointer`
                    : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70'}`}
              >
                {/* Row 1 - the level, and whether it is open */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${canAdd ? t.dot : 'bg-gray-300'}`} />
                    <span className={`text-[13.5px] font-bold capitalize ${canAdd ? t.text : 'text-gray-400'}`}>
                      {level}
                    </span>
                  </div>
                  {notConfiguredForManual ? (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium shrink-0">
                      Not open to manual
                    </span>
                  ) : !canAdd ? (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium flex items-center gap-1 shrink-0">
                      <Check size={9} /> Complete
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${t.chip}`}>
                      {remaining} to write
                    </span>
                  )}
                </div>

                {/* Row 2 - progress against this level's own quota */}
                {cap > 0 && (
                  <div className="mt-2.5">
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${canAdd ? t.bar : 'bg-gray-300'}`}
                        style={{ width: `${levelPct}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] text-gray-500 mt-1.5 tabular-nums">
                      {done} of {cap} written
                    </p>
                  </div>
                )}

                {/* Row 3 - what the configuration says about this level: what a
                    question is worth, and where the questions may come from.
                    This is the part the popup never showed, which is why the
                    quota looked arbitrary. */}
                {(marks || sources) && (
                  <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {marks?.perQuestionVaries && (
                      <span className="text-[10.5px] text-gray-600">
                        <span className="text-gray-400">Marks</span> set per question
                      </span>
                    )}
                    {!marks?.perQuestionVaries && marks?.perQuestion != null && (
                      <span className="text-[10.5px] text-gray-600">
                        <span className="text-gray-400">Marks</span> {marks.perQuestion} each
                      </span>
                    )}
                    {marks?.total != null && (
                      <span className="text-[10.5px] text-gray-600">
                        <span className="text-gray-400">Level total</span> {marks.total}
                      </span>
                    )}
                    {sources && (
                      <span className="text-[10.5px] text-gray-600 flex items-center gap-1.5">
                        <span className="text-gray-400">From</span>
                        {sources.scratch > 0 && <span className={`px-1.5 py-px rounded ${t.soft} ${t.text} font-medium`}>{sources.scratch} manual</span>}
                        {sources.ai > 0 && <span className="px-1.5 py-px rounded bg-violet-50 text-violet-700 font-medium">{sources.ai} AI</span>}
                        {sources.thirdParty > 0 && <span className="px-1.5 py-px rounded bg-sky-50 text-sky-700 font-medium">{sources.thirdParty} imported</span>}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer - names the rule the numbers above are obeying */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-start gap-2 text-[11px] text-gray-500 leading-relaxed">
            <Info size={11} className="text-gray-400 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold text-gray-600">{modeLabel}</span> - every difficulty
              carries its own question quota, and a level closes as soon as its quota is filled.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
  // Add this useEffect in AddQuestionForm for debugging (remove in production)
  useEffect(() => {
    if (isEditing && initialData) {
      console.log('AddQuestionForm - Editing mode:', {
        moduleType: moduleType,
        initialDataKeys: Object.keys(initialData),
        hasMCQFields: !!(initialData.mcqQuestionTitle || initialData.mcqQuestionOptions),
        questionType: initialData.questionType,
        isMCQ: isMCQ,
        isFrontend: isFrontend,
        isDatabase: isDatabase
      });
    }
  }, [isEditing, initialData, moduleType, isMCQ, isFrontend, isDatabase]);
  // ─── COMBINED TYPE SELECTOR ────────────────────────────────────────────────
  const CombinedSelector = () => {
    if (loading) return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 flex flex-col items-center gap-3">
          <Loader className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Checking question limits…</p>
        </div>
      </div>
    );

    const mcqOk = qCounts?.mcq?.canAdd ?? true;
    const progOk = qCounts?.programming?.anyCanAdd ?? true;

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">Add Question</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-2">
            {/* MCQ */}
            <button
              onClick={() => mcqOk && setShowMCQOpts(true)}
              disabled={!mcqOk}
              className={`w-full p-3 rounded-lg border text-left transition-all ${!mcqOk ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-blue-500 hover:shadow-sm'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${!mcqOk ? 'bg-gray-100' : 'bg-blue-50'}`}>
                  <ListChecks className={`h-4 w-4 ${!mcqOk ? 'text-gray-400' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${!mcqOk ? 'text-gray-400' : 'text-gray-900'}`}>
                      Multiple Choice (MCQ)
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${!mcqOk ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {!mcqOk ? 'Full' : `${qCounts?.mcq.count ?? 0}/${qCounts?.mcq.maxCount ?? '?'}`}
                    </span>
                  </div>
                  {!mcqOk
                    ? <p className="text-xs text-red-500 mt-0.5">{qCounts?.mcq.reason}</p>
                    : (qCounts?.mcq.maxMarks ?? 0) > 0
                      ? <p className="text-xs text-gray-500 mt-0.5">{qCounts?.mcq.totalScore ?? 0}/{qCounts?.mcq.maxMarks ?? 0} marks used</p>
                      : <p className="text-xs text-gray-500 mt-0.5">Non-graded</p>
                  }
                </div>
              </div>
            </button>

            {/* Programming */}
            <button
              onClick={() => {
                if (!progOk) return;
                // Nothing legal to choose between → keep the old direct route
                // rather than dead-ending the teacher in an empty popup.
                if (progRouteCount > 0) setShowProgOpts(true);
                else setSelectedType('programming');
              }}
              disabled={!progOk}
              className={`w-full p-3 rounded-lg border text-left transition-all ${!progOk ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-green-500 hover:shadow-sm'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${!progOk ? 'bg-gray-100' : 'bg-green-50'}`}>
                  <Code className={`h-4 w-4 ${!progOk ? 'text-gray-400' : 'text-green-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${!progOk ? 'text-gray-400' : 'text-gray-900'}`}>
                      Programming
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isGeneral && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">General</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${!progOk ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {!progOk ? 'Full' : 'Available'}
                      </span>
                    </div>
                  </div>
                  {isGeneral && qCounts?.programming?.generalSlot && (
                    <p className="text-xs text-gray-500 mt-1">
                      {qCounts.programming.generalSlot.count}/{qCounts.programming.generalSlot.maxCount} added
                    </p>
                  )}
                  {!isGeneral && qCounts?.programming?.levelSlots && Object.keys(qCounts.programming.levelSlots).length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {Object.entries(qCounts.programming.levelSlots).map(([d, ls]: any) => (
                        <div key={d} className="flex justify-between text-xs">
                          <span className="capitalize text-gray-500">{d}:</span>
                          <span className={ls.canAdd ? 'text-green-600 font-medium' : 'text-red-500'}>
                            {ls.count}/{ls.maxCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!progOk && <p className="text-xs text-red-500 mt-1">All programming slots are filled.</p>}
                </div>
              </div>
            </button>
          </div>

          {/* ── MCQ sub-options — the shared "Add a question" source chooser.
              This was a bespoke pre-2026-09 popup ("Add MCQ Question / Choose
              how to add the MCQ") that offered Bank and Upload only: `manual`
              was computed in `allowedSources` but never rendered, so on a
              Combined exercise there was no way to hand-write an MCQ at all.
              It now renders the same chrome as the We_Do / You_Do choosers via
              AddQuestionChooserUI, with Start-from-scratch restored. */}
          {showMCQOpts && (
            <AddQuestionModalShell
              title="Add a question"
              contextName={exerciseData.exerciseName || exerciseData.nodeName || null}
              contextSub={exerciseData.exerciseName ? (exerciseData.nodeName || null) : null}
              onClose={() => setShowMCQOpts(false)}
            >
              <div className="space-y-2" style={{ padding: '4px 0 16px' }}>
                {/* The type was picked on the previous step — show which one,
                    and let the teacher walk back without closing the flow. */}
                <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
                  <span className="text-[10.5px]" style={{ color: '#8b8b9e' }}>
                    Adding a <span className="font-semibold" style={{ color: '#1a1a2e' }}>Multiple Choice (MCQ)</span> question
                  </span>
                  <button onClick={() => setShowMCQOpts(false)}
                    className="text-[10.5px] font-semibold" style={{ color: '#F27757', cursor: 'pointer' }}>
                    Change type
                  </button>
                </div>

                {/* Start from scratch — opens MCQQuestionForm; MCQ picks its
                    own difficulty inside the form, so no level step here. */}
                {allowedSources.manual && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowMCQOpts(false); setSelectedType('mcq'); }}
                    tileBg={AQ.violetTile1} tileColor={AQ.violetPrimary}
                    accent={AQ.violetHover} wash={AQ.violetWash}
                    icon={AQIconScratch}
                    title="Start from scratch"
                    tag={AQMostFlexibleTag}
                    sub="Write a new question and configure the answer."
                  />
                )}

                {allowedSources.bank && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowMCQOpts(false); setShowInlineQBank(true); }}
                    tileBg={AQ.violetTile2} tileColor={AQ.violetAlt}
                    accent={AQ.violetHover} wash={AQ.violetWash}
                    icon={<Database size={16} strokeWidth={2} />}
                    title="Choose from question bank"
                    sub="Reuse a reviewed question from your shared library."
                  />
                )}

                {allowedSources.upload && onOpenDocumentUpload && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowMCQOpts(false); onOpenDocumentUpload(); }}
                    tileBg={AQ.tealTile} tileColor={AQ.teal}
                    accent={AQ.teal} wash="#F5FBFC"
                    icon={AQIconDocument}
                    title="Import from document"
                    sub="Bulk import from JSON · CSV · TXT · DOCX · PDF."
                  />
                )}

                {!allowedSources.manual && !allowedSources.bank && !(allowedSources.upload && onOpenDocumentUpload) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px]" style={{ color: '#92400e' }}>
                    <p className="font-semibold mb-1">No matching add-question option for MCQ.</p>
                    <p className="text-[11px]">
                      This exercise&apos;s MCQ Source (in Exercise Settings) doesn&apos;t map to any option that works here. Change the Source to allow Scratch, Question Bank or Document import.
                    </p>
                  </div>
                )}
              </div>
            </AddQuestionModalShell>
          )}

          {/* ── Programming sub-options — the same shared chooser the MCQ step
              renders. Programming previously jumped straight from the type
              tile into the form (or the difficulty popup), so the teacher
              never got to pick a source on a Combined exercise. Each row maps
              to ProgrammingQuestionForm's `autoOpenSource`, which already
              knows how to land on the AI generator / bank picker. */}
          {showProgOpts && (
            <AddQuestionModalShell
              title="Add a question"
              contextName={exerciseData.exerciseName || exerciseData.nodeName || null}
              contextSub={exerciseData.exerciseName ? (exerciseData.nodeName || null) : null}
              onClose={() => setShowProgOpts(false)}
            >
              <div className="space-y-2" style={{ padding: '4px 0 16px' }}>
                <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
                  <span className="text-[10.5px]" style={{ color: '#8b8b9e' }}>
                    Adding a <span className="font-semibold" style={{ color: '#1a1a2e' }}>Programming</span> question
                  </span>
                  <button onClick={() => setShowProgOpts(false)}
                    className="text-[10.5px] font-semibold" style={{ color: '#F27757', cursor: 'pointer' }}>
                    Change type
                  </button>
                </div>

                {/* Manual is the only route that still needs a difficulty up
                    front, so it alone falls through to the level popup. */}
                {progRoutes.manual && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowProgOpts(false); setProgSource('manual'); setSelectedType('programming'); }}
                    tileBg={AQ.violetTile1} tileColor={AQ.violetPrimary}
                    accent={AQ.violetHover} wash={AQ.violetWash}
                    icon={AQIconScratch}
                    title="Start from scratch"
                    tag={AQMostFlexibleTag}
                    sub="Write a new programming question and configure test cases."
                  />
                )}

                {progRoutes.bank && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowProgOpts(false); setProgSource('bank'); setSelectedType('programming'); }}
                    tileBg={AQ.violetTile2} tileColor={AQ.violetAlt}
                    accent={AQ.violetHover} wash={AQ.violetWash}
                    icon={<Database size={16} strokeWidth={2} />}
                    title="Choose from question bank"
                    sub="Reuse a reviewed question from your shared library."
                  />
                )}

                {progRoutes.thirdParty && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowProgOpts(false); setProgSource('thirdParty'); setSelectedType('programming'); }}
                    tileBg="rgba(13,148,136,0.10)" tileColor="#0d9488"
                    accent="#0d9488" wash="rgba(13,148,136,0.05)"
                    icon={<Database size={16} strokeWidth={2} />}
                    title="Import from other platform"
                    sub="Pick platform-imported questions — counted against the Other Platform quota."
                  />
                )}

                {progRoutes.ai && (
                  <AddQuestionSourceRow
                    onClick={() => { setShowProgOpts(false); setProgSource('ai'); setSelectedType('programming'); }}
                    tileBg={AQ.violetTile1} tileColor={AQ.violetPrimary}
                    accent={AQ.violetHover} wash={AQ.violetWash}
                    icon={AQIconAI}
                    title="Generate with AI"
                    badge={AQNewBadge}
                    sub="Let AI draft programming questions from a topic — review and pick per slot."
                  />
                )}
              </div>
            </AddQuestionModalShell>
          )}
        </div>
      </div>
    );
  };

  // ─── DECISION TREE ─────────────────────────────────────────────────────────

  if (showDiffPopup && !isEditing && lockedDiff === null && !isInSaveAndContinueFlow.current && !(initialBankQuestions && initialBankQuestions.length)
    && !(effectiveAutoOpen && effectiveAutoOpen !== 'manual')) {
    return <DiffPopup />;
  }

  if (showInlineQBank) {
    const existingQs: any[] = exerciseData.fullExerciseData?.questions || [];
    return (
      <QuestionBankSelector
        exerciseData={{
          exerciseId: exerciseData.exerciseId || exerciseData._id,
          exerciseName: exerciseData.exerciseName,
          exerciseLevel: exerciseData.exerciseLevel || 'intermediate',
          nodeId: exerciseData.nodeId,
          nodeName: exerciseData.nodeName,
          subcategory: exerciseData.subcategory || exerciseData.subcategoryLabel || '',
          nodeType: exerciseData.nodeType,
          fullExerciseData: exerciseData.fullExerciseData,
          exerciseType: exerciseData.exerciseType || '',
        }}
        tabType={tabType}
        onBack={() => { setShowInlineQBank(false); setShowMCQOpts(true); }}
        onClose={() => { setShowInlineQBank(false); onClose(); }}
        onSelect={(qs) => { setShowInlineQBank(false); onMCQBankSelect?.(qs); onClose(); }}
        existingQuestionIds={existingQs.flatMap((q: any) => [q._id, q.bankQuestionId]).filter(Boolean)}
        existingQuestions={existingQs}
      />
    );
  }
// Skip CombinedSelector when we're in Manage Test (sectionData provided)
if (isCombined && !isEditing && !selectedType && !isInSaveAndContinueFlow.current && !sectionData && !(initialBankQuestions && initialBankQuestions.length)) {
  return <CombinedSelector />;
}

  // ─── Delete question handler ───────────────────────────────────────────────
  const handleDeleteProgrammingQuestion = async (questionId: string): Promise<any> => {
    const exerciseId = exerciseData.exerciseId || exerciseData._id;
    const subcategory = exerciseData.subcategory || exerciseData.subCategory || '';
    return questionApi.deleteQuestion(
      entityType,
      exerciseData.nodeId,
      exerciseId,
      questionId,
      tabType,
      subcategory,
    );
  };

  // ─── Build form props ──────────────────────────────────────────────────────
  const formProps = {
    exerciseData: localExerciseDataRef.current,
    tabType,
    initialData,
    isEditing,
    onClose,
    onSave: handleSubmit,
    isSaving,
    saveProgress,
    saveMessage,
    sectionData,
    initialBankQuestions,
    approval,
    approvalContext,
    onQueryResolved,
  }
  const renderForm = () => {
    if (isMCQ) return (
      <MCQQuestionForm
        breadcrumbs={breadcrumbs}
        initialQuestionId={initialQuestionId}
        {...formProps}
        initialBankSource={initialBankSource}
        onEditExercise={() => setShowExerciseSettings(true)}
      />
    );
    if (isOthers) return (
      <OthersAddQuestionForm
        breadcrumbs={breadcrumbs}
        initialQuestionId={initialQuestionId}
        initialData={initialData}  // ← ADD THIS LINE
        isEditing={isEditing}       // ← ADD THIS LINE
        {...formProps}
        onEditExercise={() => setShowExerciseSettings(true)}
      />
    );

    if (isFrontend) return <FrontendQuestionForm {...formProps}
      lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
      onEditExercise={() => setShowExerciseSettings(true)}
    />;
    if (isDatabase) return <DatabaseQuestionForm {...formProps}
      onEditExercise={onEditExercise}
      onDeleteQuestion={handleDeleteProgrammingQuestion}
      lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
    />;
   return (
  <ProgrammingQuestionForm
    key={`prog-form-${refreshKey}`}  // ← prefixed, never collides with numeric 0
    {...formProps}
    onDeleteQuestion={handleDeleteProgrammingQuestion}
    lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
    onEditExercise={() => setShowExerciseSettings(true)}
    autoOpenSource={effectiveAutoOpen}
    // Only when the Combined chooser drove the route: backing out of the
    // auto-opened picker returns to that chooser. Undefined elsewhere, so the
    // pure-Programming surface keeps its existing close behaviour. The
    // difficulty popup is cleared too — a stale `showDiffPopup` from this
    // route would otherwise render on top of the chooser we're going back to.
    onSourceDismissed={progSource && progSource !== 'manual' ? () => {
      setShowDiffPopup(false);
      setProgSource(null);
      setSelectedType(null);
      setShowProgOpts(true);
    } : undefined}
    initialBankSource={initialBankSource}
  />
);
  };
  return (
    <>
      {/* Save overlay — only shown for normal Save, not Save & Next */}
      {showOverlay && (
        <div className="fixed inset-0 z-[100] bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white/95 p-6 rounded-xl shadow-2xl border border-gray-200 max-w-xs mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 text-sm">Saving Question</h3>
                <p className="text-xs text-gray-500 mt-1">{saveMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {renderForm()}

      {showExerciseSettings && (
        <ExerciseSettings
          hierarchyData={localExerciseData.fullExerciseData?.hierarchyData || {}}
          nodeId={exerciseData.nodeId}
          nodeName={exerciseData.nodeName}
          nodeType={exerciseData.nodeType}
          subcategory={exerciseData.subcategory || ''}
          tabType={tabType as any}
          isEditing={true}
          initialData={localExerciseData.fullExerciseData}
          exercise_Id={exerciseData.exerciseId || exerciseData._id}
          onSave={handleExerciseSettingsSave}
          onClose={handleExerciseSettingsClose}
        />
      )}
    </>
  );
};

export default AddQuestionForm;