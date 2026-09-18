import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader, Code, ListChecks, ChevronRight, Info, Plus, Database, Check, FileText } from 'lucide-react';
import { questionApi } from '@/apiServices/question';
import FrontendQuestionForm from './FrontendQuestionForm';
import DatabaseQuestionForm from './DatabaseQuestionForm';
import ProgrammingQuestionForm from './ProgrammingQuestionForm';
import MCQQuestionForm from './mcq/MCQQuestionForm';
// Unified with We_Do — use the rich picker from the shared questionforms path.
import QuestionBankSelector from '@/app/lms/component/questionforms/mcq/QuestionBankSelector';
import OthersAddQuestionForm from './others/OthersAddQuestionForm';
import { toast } from 'react-toastify';
import { exerciseApi } from '@/apiServices/exercise';
// ─── Types ─────────────────────────────────────────────────────────────────────
interface AddQuestionFormProps {
  exerciseData: any;
  breadcrumbs?: Array<{ name: string; type: string }>;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  initialQuestionId?: string;          // ← ADD THIS
  // Questions chosen in the external Question Bank — forwarded to the MCQ form to
  // pre-fill for review (Save & Next through each).
  initialBankQuestions?: any[];
  // Source tag stamped on those preloaded questions ('scratch-bank' | 'thirdParty'
  // | 'scratch-manual' etc.). Matches the We_Do AddQuestionForm's prop so parents
  // can route through the same review-then-save funnel.
  initialBankSource?: string;
  // When set, the child form skips its blank-editor / difficulty-popup default and
  // opens the matching source modal on mount (AI generator / bank picker) so the
  // trainer lands on the right authoring surface. Only 'manual' is a no-op.
  autoOpenSource?: 'manual' | 'ai' | 'bank' | 'thirdParty';

  onClose: () => void;
  onSave: (data: any) => void;
  onOpenQuestionBank?: (type: string) => void;
  onOpenDocumentUpload?: () => void;
  onMCQBankSelect?: (questions: any[]) => void;
  showTypeSelector?: boolean;
  onEditExercise?: () => void;
  remainingQuestions?: number;
  marksPerQuestion?: number;
  shouldRefreshOnMount?: boolean;
  // Optional — only provided for section-based assessments. When present,
  // child forms render a "Section Details" button in their sidebar.
  sectionData?: any;
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
}

// ─── Difficulty styles ─────────────────────────────────────────────────────────
const DStyle: Record<string, any> = {
  easy: { 
    bg: 'bg-gray-50', 
    border: 'border-gray-200', 
    text: 'text-gray-700', 
    badge: 'bg-gray-100 text-gray-600', 
    dot: 'bg-gray-400', 
    hoverBg: 'hover:bg-emerald-50', 
    hoverBorder: 'hover:border-emerald-400',
    hoverText: 'group-hover:text-emerald-700',
    hoverDot: 'group-hover:bg-emerald-500',
    hoverBadge: 'group-hover:bg-emerald-100 group-hover:text-emerald-700'
  },
  medium: { 
    bg: 'bg-gray-50', 
    border: 'border-gray-200', 
    text: 'text-gray-700', 
    badge: 'bg-gray-100 text-gray-600', 
    dot: 'bg-gray-400', 
    hoverBg: 'hover:bg-amber-50', 
    hoverBorder: 'hover:border-amber-400',
    hoverText: 'group-hover:text-amber-700',
    hoverDot: 'group-hover:bg-amber-500',
    hoverBadge: 'group-hover:bg-amber-100 group-hover:text-amber-700'
  },
  hard: { 
    bg: 'bg-gray-50', 
    border: 'border-gray-200', 
    text: 'text-gray-700', 
    badge: 'bg-gray-100 text-gray-600', 
    dot: 'bg-gray-400', 
    hoverBg: 'hover:bg-rose-50', 
    hoverBorder: 'hover:border-rose-400',
    hoverText: 'group-hover:text-rose-700',
    hoverDot: 'group-hover:bg-rose-500',
    hoverBadge: 'group-hover:bg-rose-100 group-hover:text-rose-700'
  },
};
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
  initialBankQuestions,
  initialBankSource,
  autoOpenSource,
  onClose,
  onSave,
  onOpenQuestionBank,
  onOpenDocumentUpload,
  onMCQBankSelect,
  showTypeSelector,
  onEditExercise,
  shouldRefreshOnMount,
  sectionData,
  approval, approvalContext, onQueryResolved,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<'mcq' | 'programming' | null>(null);
  const [showMCQOpts, setShowMCQOpts] = useState(false);
  const [showInlineQBank, setShowInlineQBank] = useState(false);

  // Difficulty popup (level / selectionLevel only — NOT general)
  const [showDiffPopup, setShowDiffPopup] = useState(false);
  const [lockedDiff, setLockedDiff] = useState<'easy' | 'medium' | 'hard' | null>(null);
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
  const localExerciseDataRef = useRef(exerciseData);

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

  // Question Source enforcement (see component/questionforms/ProgrammingQuestionForm)
  // Combined assessments may separate the MCQ part's source — this table
  // gates the MCQ sub-options here, so that part's rules win when present,
  // but only while the exercise is actually Combined (stale trios from a
  // type switch must not gate other types).
  const _isCombinedForSource = fullEx?.exerciseType?.toLowerCase?.() === 'combined' ||
    exerciseData.exerciseType?.toLowerCase?.() === 'combined' ||
    showTypeSelector === true;
  const _mcqPartSrc = _isCombinedForSource ? fullEx?.questionSourceMcq : null;
  const questionSourceRaw = _mcqPartSrc || fullEx?.questionSource;
  const customSourcesRaw: string[] = _mcqPartSrc
    ? (Array.isArray(fullEx?.customSourcesMcq) ? fullEx.customSourcesMcq : [])
    : (Array.isArray(fullEx?.customSources) ? fullEx.customSources : []);
  const allowedSources = (() => {
    const s = questionSourceRaw || null;
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      const has = (x: string) => customSourcesRaw.includes(x);
      return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
    }
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  })();

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
        if (initialData.questionType === 'programming') return 'programming';
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
  
  return (['easy', 'medium', 'hard'] as const)
    .filter(d => (currentCounts?.[d] || 0) > 0)
    .map(d => {
      const total = currentCounts?.[d] || 0;
      const created = progQs.filter((q: any) => q.difficulty === d).length;
      const remaining = Math.max(0, total - created);
      return { level: d, remaining, total, canAdd: remaining > 0 };
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
      // For section-based exercises, the raw DB exercise does NOT contain
      // section-specific questionConfiguration or exerciseInformation.
      // Replacing fullExerciseData wholesale would corrupt generalMPQ
      // (e.g. totalMarks = 100 whole-exercise instead of 50 per-section).
      // → Only update the questions array; preserve all section-computed config.
      const currentSectionId: string | null = exerciseData.currentSectionId || null;
      const currentSectionName: string | null = exerciseData.currentSectionName || null;

      const allFreshQuestions: any[] = freshExercise.questions || [];
      const sectionQuestions = currentSectionId
        ? allFreshQuestions.filter((q: any) => {
            if (q.sectionId && q.sectionId === currentSectionId) return true;
            if (!q.sectionId && q.sectionName && q.sectionName === currentSectionName) return true;
            return false;
          })
        : allFreshQuestions;

      const prevFull = localExerciseDataRef.current?.fullExerciseData;
      const updatedExerciseData = {
        ...exerciseData,
        fullExerciseData: {
          ...freshExercise,
          questions: sectionQuestions,
          // Preserve section-specific computed values — never let raw DB overwrite them
          questionConfiguration: prevFull?.questionConfiguration ?? freshExercise.questionConfiguration,
          exerciseInformation: prevFull?.exerciseInformation ?? freshExercise.exerciseInformation,
        },
        // Keep the type that was set by buildAddQExerciseData (section-effective type)
        exerciseType: exerciseData.exerciseType,
        programmingSettings: freshExercise.programmingSettings || exerciseData.programmingSettings,
      };
      localExerciseDataRef.current = updatedExerciseData;
      setLocalExerciseData(updatedExerciseData);
      // Don't remount ProgrammingQuestionForm during Save & Continue — it loses all flow state
      if (!isInSaveAndContinueFlow.current) setRefreshKey(k => k + 1);
      setDiffRefreshTrigger(prev => prev + 1);
    }
  } catch (err) {
    console.warn('Refetch failed:', err);
    if (!isInSaveAndContinueFlow.current) setRefreshKey(k => k + 1);
    setDiffRefreshTrigger(prev => prev + 1);
  }
}, [exerciseData]);
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
  
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-gray-900">Select Difficulty Level</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={14} className="text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-500">Each difficulty has its own slot quota. Choose which level to add for.</p>
        </div>

        <div className="p-4 space-y-2">
          {opts.length === 0 && (
            <p className="text-sm text-center text-gray-400 py-4">No difficulty levels configured.</p>
          )}
          {opts.map(({ level, remaining, total, canAdd }) => {
            const s = DStyle[level];
            return (
              <button
                key={level}
                type="button"
                disabled={!canAdd}
                onClick={() => { setLockedDiff(level); setShowDiffPopup(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all group
                  ${!canAdd
                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-55'
                    : `${s.bg} ${s.border} hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                       hover:${s.hoverBg} hover:${s.hoverBorder}`
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${!canAdd ? 'bg-gray-300' : s.dot}`} />
                  <div className="text-left">
                    <div className={`text-sm font-bold capitalize ${!canAdd ? 'text-gray-400' : s.text}`}>{level}</div>
                    <div className="text-2xs text-gray-500 mt-0.5">
                      {!canAdd ? '✓ All slots filled' : `${remaining} of ${total} questions remaining`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!canAdd
                    ? <span className="text-2xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full flex items-center gap-1"><Check size={8} /> Done</span>
                    : <>
                        <span className={`text-2xs px-2.5 py-1 rounded-full font-semibold ${s.badge}`}>{remaining} left</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <span className="text-2xs font-medium text-gray-500">Select</span>
                          <ChevronRight size={13} className={s.text} />
                        </div>
                      </>
                  }
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-2 text-2xs text-gray-500">
            <Info size={11} className="text-gray-400 shrink-0" />
            <span>Mode: {cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'} — each difficulty has its own quota.</span>
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
              onClick={() => progOk && setSelectedType('programming')}
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
                        <span className="text-2xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">General</span>
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

          {/* MCQ sub-options modal */}
          {showMCQOpts && (
            <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-bold text-gray-900">Add MCQ Question</h2>
                    <button onClick={() => setShowMCQOpts(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-gray-400 text-sm">Choose how to add the MCQ</p>
                </div>
                <div className="px-5 pb-5 space-y-2">
                  {allowedSources.bank && (
                  <button
                    onClick={() => { setShowMCQOpts(false); setShowInlineQBank(true); }}
                    className="group p-4 border-2 border-gray-200 hover:border-purple-500 hover:shadow-md rounded-xl w-full text-left transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100">
                        <Database className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">Question Bank</h3>
                        <p className="text-gray-400 text-xs mt-0.5">Select existing questions</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                  )}
                  {allowedSources.upload && onOpenDocumentUpload && (
                    <button
                      onClick={() => { setShowMCQOpts(false); onOpenDocumentUpload(); }}
                      className="group p-4 border-2 border-gray-200 hover:border-cyan-500 hover:shadow-md rounded-xl w-full text-left transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-cyan-50 rounded-lg group-hover:bg-cyan-100">
                          <FileText className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm">Upload Document</h3>
                          <p className="text-gray-400 text-xs mt-0.5">Bulk import from JSON · CSV · TXT</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 opacity-0 group-hover:opacity-100" />
                      </div>
                    </button>
                  )}
                  {!allowedSources.bank && !allowedSources.upload && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500">
                      This exercise's source setting doesn't allow adding MCQs via bank or upload. Change the source in Exercise Settings, or use the Add Question form directly.
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t">
                  <button
                    onClick={() => setShowMCQOpts(false)}
                    className="w-full px-4 py-2 border-2 border-gray-200 bg-white text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── DECISION TREE ─────────────────────────────────────────────────────────

  if (showDiffPopup && !isEditing && lockedDiff === null && !isInSaveAndContinueFlow.current
      && !(initialBankQuestions && initialBankQuestions.length)
      && !(autoOpenSource && autoOpenSource !== 'manual')) {
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
if (isCombined && !isEditing && !selectedType && !isInSaveAndContinueFlow.current && !sectionData
    && !(initialBankQuestions && initialBankQuestions.length)) {
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
    approval,
    approvalContext,
    onQueryResolved,
  }
  const renderForm = () => {
    if (isMCQ) return (
      <MCQQuestionForm
        breadcrumbs={breadcrumbs}
        initialQuestionId={initialQuestionId}
        initialBankQuestions={initialBankQuestions}
        initialBankSource={initialBankSource}
        {...formProps}
        onEditExercise={onEditExercise}
      />
    );
    if (isOthers) return (
      <OthersAddQuestionForm
        breadcrumbs={breadcrumbs}
        initialQuestionId={initialQuestionId}
        initialData={initialData}
        isEditing={isEditing}
        {...formProps}
        onEditExercise={onEditExercise}
      />
    );

    if (isFrontend) return <FrontendQuestionForm {...formProps}
      lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
      onEditExercise={onEditExercise}
    />;
    if (isDatabase) return <DatabaseQuestionForm {...formProps}
      onEditExercise={onEditExercise}
      onDeleteQuestion={handleDeleteProgrammingQuestion}
      lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
    />;
   return (
  <ProgrammingQuestionForm
    key={`prog-form-${refreshKey}`}
    {...formProps}
    onDeleteQuestion={handleDeleteProgrammingQuestion}
    lockedDifficulty={isLevelMode ? (lockedDiff ?? undefined) : undefined}
    onEditExercise={onEditExercise}
    autoOpenSource={autoOpenSource}
    initialBankSource={initialBankSource}
    // Forward bank preload so ProgrammingQuestionForm's mount-time seeding
    // effect populates the review queue. Without this, picks routed via
    // QuestionsTest → picker → form landed on a blank editor.
    initialBankQuestions={initialBankQuestions}
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
    </>
  );
};

export default AddQuestionForm;