import { getToken } from "@/lib/session";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QuestionApprovalBanner, RequestApproveButton, deriveApprovalContext } from '../QuestionApprovalBanner';
import {
  X, Code, Plus, Trash2, Save, Loader2, Loader, Check, AlertCircle,
  Eye, BookOpen, Clock, Database, Target, Award, CloudUpload,
  CheckCircle2, ArrowRight, Zap, Edit2, Info, Layers,
  ChevronLeft, ChevronRight, Flag, Sparkles, ChevronDown, ChevronUp,
  AlertTriangle, ArrowLeftRight, FileText, Settings, BarChart3,
  GraduationCap, Hash, Image, Play, Bold, Italic, Underline,


  ChevronDown as ChevronDownIcon,

  Library
} from 'lucide-react';
import QuestionBankSelector from './mcq/QuestionBankSelector';
import GenerateProgFamilyAI from './GenerateProgFamilyAI';
import DocQuestionPicker from './DocQuestionPicker';
import { parseProgrammingFile } from '@/app/lms/component/questionforms/parseQuestionsTxt';
import { CodeSetupSection, isStringSolutionEmpty } from './CodeSetupSection';
import { toast } from 'react-toastify';
// Execution playground shares the SAME auth-gated Piston proxy the student
// multi-file editor uses, so results here match what students see on Submit.
// The endpoint enforces auth + per-user rate limits and uses the same runtime
// pins as the server codeJudge.
import { runOnPiston, type RunResult } from '@/lib/pistonClient';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/codeLanguages';

// ─── Extracted 2026-08-30 into `./programming/` — see also
// `programming/types.ts`, `programming/styles.ts`, `programming/constants.ts`,
// `programming/utils/*`. The prelude that used to live here has been split.
import { injectFonts } from './programming/styles';
import { DS } from './programming/constants';
import type {
  Diff, TC, FunctionParam, FunctionContract, ProgContentBlock, FlowQuestion,
  ProgrammingQuestionFormProps,
} from './programming/types';
import { QUESTION_CATEGORIES } from './programming/types';
import {
  mkProgTextBlock, mkProgCodeBlock, descToBlocks, blocksToDescription,
  titleToBlocks, getTitleText, fmtMark,
} from './programming/utils/blocksHelpers';
import {
  EXEC_DATA_TYPES, normalizeExecLang, execDataTypesFor,
  mkFunctionContract, mkFunctionParam,
  execSignatureFor, jType, cppType, cType,
  execGeneratedStarter, jDefault, cppDefault, cDefault,
  execDriverPreview, execBuildFunctionRunPayload,
  coerceTcInput, tcInputsToPayload,
} from './programming/utils/execHelpers';
import { mkLocalId, mkTC } from './programming/utils/factories';
import { dbQuestionToFlow } from './programming/utils/dbAdapter';
import { TA, NI } from './programming/components/Inputs';
import { QuestionFormBreadcrumb } from './programming/components/Breadcrumb';
import {
  CloseConfirmDialog, EditExerciseConfirmDialog, DiffSwitchDialog,
  DeleteConfirmDialog, DifficultyPopup,
} from './programming/modals/Dialogs';
import { ProgImageUploadModal } from './programming/modals/ProgImageUploadModal';
import { PROG_CODE_THEMES, PROG_CODE_THEMES_MCQ } from './programming/components/codeThemes';
import { ProgImageBlock } from './programming/components/ProgImageBlock';
import { ProgCodeBlock, highlightAutoP } from './programming/components/ProgCodeBlock';
import { ProgCodeBlockMCQ } from './programming/components/ProgCodeBlockMCQ';
import { ProgDescEditor } from './programming/components/ProgDescEditor';
import { ProgTitleEditor } from './programming/components/ProgTitleEditor';
import { ProgrammingMockModal } from './programming/modals/ProgrammingMockModal';
import { PreviewModal } from './programming/modals/PreviewModal';
import { RunTestCasesModal } from './programming/modals/RunTestCasesModal';
import { TryFunctionModal } from './programming/modals/TryFunctionModal';
import { CustomInputModal } from './programming/modals/CustomInputModal';
import { TitleEditor } from './programming/components/TitleEditor';
import { ExecutionSetupSection } from './programming/components/ExecutionSetupSection';
import type { RunOutcome, RunOutcomeRow } from './programming/utils/pistonHelpers';
import {
  resolveSupportedLang, runOne, classifyRun, compareFunctionReturn,
  buildFunctionRunSource, buildFullProgramRunSource,
} from './programming/utils/pistonHelpers';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ProgrammingQuestionForm: React.FC<ProgrammingQuestionFormProps> = ({
  exerciseData, tabType, initialData, isEditing = false,
  onClose, onSave, onDeleteQuestion, isSaving, saveProgress, saveMessage,
  lockedDifficulty, onEditExercise, sectionData, initialBankQuestions,
  initialBankSource,
  approval, approvalContext, onQueryResolved,
  autoOpenSource,
}) => {
  injectFonts();

  const [isEditMode, setIsEditMode] = useState(true); // always editable
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showEditExerciseConfirm, setShowEditExerciseConfirm] = useState(false);

  const [showTitleImgModal, setShowTitleImgModal] = useState(false);

  const returnIndexRef = useRef<number | null>(null);
  const returnDiffRef = useRef<Diff | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
const [showAddDropdown, setShowAddDropdown] = useState(false);
// Which source the teacher last picked from the + dropdown. Used as a
// fallback tag when a currently-loaded FlowQuestion has no source of its
// own (e.g. a brand-new manual question), so mkPayload can stamp the
// correct source on the save.
const pendingSourceRef = useRef<string>('scratch-manual');
const addDropdownRef = useRef<HTMLDivElement>(null);
const [showBankSelector, setShowBankSelector] = useState(false);
const [showAIModal, setShowAIModal] = useState(false);
// Auto-open source modal on mount when the caller (Add-Question popup)
// asks for a specific source. Fires once — subsequent renders don't
// re-open. Skips edit mode (teacher is editing an existing question).
const autoOpenFiredRef = useRef(false);
useEffect(() => {
  if (autoOpenFiredRef.current) return;
  if (isEditing) return;
  // Bank picks already preloaded for review — opening another source modal
  // on top would hide the review flow. Mark fired so it never opens late.
  if (initialBankQuestions && initialBankQuestions.length > 0) { autoOpenFiredRef.current = true; return; }
  if (!autoOpenSource || autoOpenSource === 'manual') return;
  autoOpenFiredRef.current = true;
  if (autoOpenSource === 'ai') {
    pendingSourceRef.current = 'ai';
    // Mark this as an auto-open so the modal's onClose knows it may cascade.
    sourceModalAutoOpenedRef.current = true;
    setShowAIModal(true);
  } else if (autoOpenSource === 'bank' || autoOpenSource === 'thirdParty') {
    pendingSourceRef.current = autoOpenSource === 'thirdParty' ? 'thirdParty' : 'scratch-bank';
    sourceModalAutoOpenedRef.current = true;
    setShowBankSelector(true);
  }
}, [autoOpenSource, isEditing, initialBankQuestions]);
// Whether the currently-open source modal (AI generator / bank picker) handed
// any questions to the flow. Set synchronously in handleBankSelectedQuestions —
// the AI modal calls onGenerated then onClose in the same tick, so React state
// is too stale to answer this at close time. Resets every time a modal opens.
const sourceModalAddedRef = useRef(false);
useEffect(() => {
  if (showAIModal || showBankSelector) sourceModalAddedRef.current = false;
}, [showAIModal, showBankSelector]);
// Distinguishes an AUTO-OPENED source modal (mounted by the auto-open effect
// or re-popped after Save & Next) from one the teacher opened by hand via the
// in-form "+" dropdown. Only auto-opened modals may cascade-close the whole
// form; a dropdown-opened modal must never tear the form down on dismiss.
const sourceModalAutoOpenedRef = useRef(false);
// Set by any INTENTIONAL close of the AI / Bank / Other-Platform modal — the
// user clicked X / Cancel / Escape / clicked the backdrop. Gates the
// blank-slot auto-reopen so an explicit close cannot re-trigger the same
// modal. Cleared whenever the user re-enters the flow (opens the source
// dropdown, changes difficulty, or Save & Continue lands them on a fresh
// slot). See the Add Question UX contract:
//   "An intentional close must not trigger logic that automatically reopens
//    the same modal or another blank form."
const intentionalCloseRef = useRef(false);
// Once the teacher dismisses an auto-opened modal with manual slots still to
// fill, suppress the re-pop so the AI/bank modal doesn't reappear after every
// manually-authored Save & Next. Re-armed only by explicitly re-opening the
// modal from the in-form "+" dropdown.
const autoReopenSuppressedRef = useRef(false);
// Tracks the deferred setTimeout(...) call in reopenSourceModalForBlankSlot so
// (a) dismissing the modal before the timer fires cancels it, and (b) unmount
// cannot leave a pending setState on an unmounted component.
const reopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => {
  if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
}, []);
// "Add Question via" dropdown — robust outside-click close (capture phase + ref
// containment) so it fires even when the click lands on a stopPropagation element.
useEffect(() => {
  if (!showAddDropdown) return;
  const close = (e: MouseEvent) => {
    if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
      setShowAddDropdown(false);
    }
  };
  document.addEventListener('mousedown', close, true);
  return () => document.removeEventListener('mousedown', close, true);
}, [showAddDropdown]);
  const exerciseDbId = exerciseData?.exerciseId || exerciseData?.fullExerciseData?._id || exerciseData?.id || '';
  const entityId = exerciseData?.nodeId || '';

  const progCfg = exerciseData.fullExerciseData?.questionConfiguration?.programmingQuestionConfiguration;
  const cfgType = (progCfg?.questionConfigType as string) || 'general';
  const isGeneral = cfgType === 'general';

  // ── Question Source enforcement (single source of truth) ─────────────────
  // The `questionSource` field on the exercise decides which "+" dropdown items
  // are rendered. Buttons that shouldn't appear are removed from the DOM — not
  // shown-and-disabled — so the teacher never sees dimmed options they can't use.
  //   scratch     → Manual + Question Bank + Upload Document
  //   ai          → Generate AI only
  //   thirdParty  → Third-Party import only (Question Bank stands in until the
  //                 dedicated provider modal ships; provider list is in settings)
  //   custom      → all four allowed (Custom = mix any source)
  //   null/undef  → all allowed (back-compat for pre-Phase-2 exercises)
  const questionSourceRaw = exerciseData.fullExerciseData?.questionSource;
  const customSourcesRaw: string[] = Array.isArray(exerciseData.fullExerciseData?.customSources) ? exerciseData.fullExerciseData.customSources : [];
  const allowedSources = (() => {
    const s = questionSourceRaw || null;
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      // Custom = only the sub-sources the teacher ticked in Settings.
      const has = (x: string) => customSourcesRaw.includes(x);
      return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
    }
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  })();
  // Generic "Question Bank" is scratch's second entry point. Other Platform
  // (thirdParty) gets its OWN dropdown item that opens the same picker but
  // stamps imports with the thirdParty tag + its own quota slice — so the
  // generic item only shows when scratch itself is allowed.
  const bankViaScratch = (() => {
    const s = questionSourceRaw || null;
    if (!s) return true; // legacy exercises — allow all
    if (s === 'scratch') return true;
    if (s === 'custom') return customSourcesRaw.includes('scratch');
    return false;
  })();
  // isGraded: selectionLevel is always non-graded; general/levelBased respect the stored flag
  const isSelectionLevelType = cfgType === 'selectionLevel';
  const exerciseIsGraded = !isSelectionLevelType && (exerciseData.fullExerciseData?.isGraded !== false);

  const generalQuestionCount: number = progCfg?.generalQuestionCount || 0;
  const generalTotalMarks: number =
    exerciseData.fullExerciseData?.exerciseInformation?.totalMarksProgramming ||
    exerciseData.fullExerciseData?.exerciseInformation?.totalMarks || 0;
  const generalMPQ: number =
    progCfg?.generalMarksPerQuestion ||
    progCfg?.scoreSettings?.evenMarks ||
    Math.floor(generalTotalMarks / Math.max(1, generalQuestionCount));

  const getConfiguredDiffs = useCallback((): Diff[] => {
    if (isGeneral) return [];
    if (cfgType === 'levelBased') {
      const lsc = progCfg?.scoreSettings?.levelScoringConfiguration || {};
      return (['easy', 'medium', 'hard'] as Diff[]).filter(d => lsc[d]?.questionCount > 0);
    }
    if (cfgType === 'selectionLevel') {
      const sel = progCfg?.selectionLevelCounts || {};
      return (['easy', 'medium', 'hard'] as Diff[]).filter(d => (sel[d] || 0) > 0);
    }
    return [];
  }, [isGeneral, cfgType, progCfg]);
// Read from the exercise's questionSource (Phase 2). Hardcoded `true` removed.
const isAIAvailable = () => allowedSources.ai;




const getQuotaForDiff = useCallback((d: Diff): number => {
    if (cfgType === 'levelBased') {
      // levelBasedCounts is always the source of truth
      // levelScoringConfiguration.questionCount is stale — only use as last fallback
      return progCfg?.levelBasedCounts?.[d]
        || progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.questionCount
        || 0;
    }
    if (cfgType === 'selectionLevel') return progCfg?.selectionLevelCounts?.[d] || 0;
    return generalQuestionCount;
  }, [cfgType, progCfg, generalQuestionCount]);
  // AFTER (fixed)
  const getTotalMarksForDiff = useCallback((d: Diff): number => {
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    const actualCount = getQuotaForDiff(d);

    if (!lsc) return 0;

    if (lsc.type === 'level_specific') {
      // DB may store totalMarks: 0 — always recalculate
      if (lsc.totalMarks && lsc.totalMarks > 0) return lsc.totalMarks;
      return (lsc.marksPerQuestion || progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0) * actualCount;
    }

    if (lsc.type === 'question_specific') {
      return lsc.totalMarks || 0;
    }

    // Final fallback
    return (progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0) * actualCount;
  }, [progCfg, getQuotaForDiff]);
  const getScoringType = useCallback((d: Diff): 'level_specific' | 'question_specific' | 'fixed' => {
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'question_specific') return 'question_specific';
    if (lsc?.type === 'level_specific') return 'level_specific';
    return 'fixed';
  }, [progCfg]);

  const getFixedScore = useCallback((d: Diff): number => {
    if (isGeneral) return generalMPQ;
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'level_specific') return lsc.marksPerQuestion || 0;
    return progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0;
  }, [isGeneral, generalMPQ, progCfg]);

  const isScoreEditable = useCallback((d: Diff) =>
    !isGeneral && progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.type === 'question_specific',
    [isGeneral, progCfg]);

  const getDbQuestionsForDiff = useCallback((d?: Diff) => {
    const all = (exerciseData.fullExerciseData?.questions || [])
      .filter((q: any) => q.questionType === 'programming' && q.isActive !== false);
    if (!d) return all;
    return all.filter((q: any) => q.difficulty === d);
  }, [exerciseData]);

  const getDbIdSet = useCallback((d?: Diff): Set<string> => {
    const dbQs = getDbQuestionsForDiff(d);
    return new Set(dbQs.map((q: any) => q._id?.toString?.() || q._id).filter(Boolean));
  }, [getDbQuestionsForDiff]);

  const getDbMarksUsedForDiff = useCallback((d: Diff): number =>
    getDbQuestionsForDiff(d).reduce((s: number, q: any) => s + (q.score || q.points || 0), 0),
    [getDbQuestionsForDiff]);

  const getRemainingMarksForDiff = useCallback((d: Diff): number =>
    Math.max(0, getTotalMarksForDiff(d) - getDbMarksUsedForDiff(d)),
    [getTotalMarksForDiff, getDbMarksUsedForDiff]);

  const initialDiff: Diff = useMemo(() => {
    if (isEditing && initialData?.difficulty) return initialData.difficulty as Diff;
    if (lockedDifficulty) return lockedDifficulty;

    const configured = getConfiguredDiffs();
    if (configured.length === 0) return 'easy';

    // "Has open slots" = existing-in-DB count for this difficulty is below quota.
    const hasOpen = (d: Diff): boolean => {
      try {
        return getDbQuestionsForDiff(d).length < getQuotaForDiff(d);
      } catch { return false; }
    };

    // If the teacher arrived here from the Question Bank with selected questions,
    // prefer to START on a difficulty that BOTH matches one of those bank picks
    // AND still has open slots — so they aren't dumped on an "Easy Questions
    // Complete!" popup just because easy is full and the bank pick was a medium.
    // Walk in canonical order so the sequence remains easy → medium → hard.
    if (initialBankQuestions && initialBankQuestions.length > 0) {
      const bankDiffs = new Set<Diff>(
        initialBankQuestions.map((q: any) => {
          const d = String(q?.difficulty ?? 'medium').toLowerCase();
          return (d === 'easy' || d === 'hard') ? (d as Diff) : 'medium';
        })
      );
      for (const d of configured) {
        if (bankDiffs.has(d) && hasOpen(d)) return d;
      }
    }

    // Otherwise, just start on the first configured difficulty that still has
    // open slots (also walking in canonical easy → medium → hard order).
    for (const d of configured) {
      if (hasOpen(d)) return d;
    }

    // All quotas are already full — fall back to the first configured difficulty.
    return configured[0] || 'easy';
  }, [isEditing, initialData, lockedDifficulty, getConfiguredDiffs, getDbQuestionsForDiff, getQuotaForDiff, initialBankQuestions]);

  const buildInitialFlow = useCallback((): { questions: FlowQuestion[]; startIndex: number } => {
    if ((isEditing || initialData?._id) && initialData) {
      // ── Edit mode: load ALL saved questions across all difficulties ──────────
      // so that question numbering, navigation and difficulty switching all work
      let allPreExisting: FlowQuestion[] = [];
      if (isGeneral) {
        allPreExisting = getDbQuestionsForDiff().map(dbQuestionToFlow);
      } else {
        const diffs = getConfiguredDiffs();
        if (diffs.length > 0) {
          diffs.forEach(d => {
            allPreExisting.push(...getDbQuestionsForDiff(d).map(dbQuestionToFlow));
          });
        }
        // Fallback: load without difficulty filter if per-diff returned nothing
        if (allPreExisting.length === 0) {
          allPreExisting = getDbQuestionsForDiff().map(dbQuestionToFlow);
        }
      }
      // Guarantee the question being edited is present in the list
      if (allPreExisting.length === 0) {
        allPreExisting = [dbQuestionToFlow(initialData)];
      } else if (!allPreExisting.some(q => q._id === initialData._id)) {
        allPreExisting.unshift(dbQuestionToFlow(initialData));
      }
      const startIdx = Math.max(0, allPreExisting.findIndex(q => q._id === initialData._id));
      return { questions: allPreExisting, startIndex: startIdx };
    }
    if (isGeneral) {
      const preExisting: FlowQuestion[] = getDbQuestionsForDiff().map(dbQuestionToFlow);
      // Same clamp the level-based branch below has always had: when the
      // General quota is already met, land on the LAST saved question — not
      // on an out-of-quota blank slot. Without this, a plain Save on the
      // final question remounted the form (AddQuestionForm bumps refreshKey
      // after refetch) onto an empty "Question N+1" that could never be
      // saved. Reported with a 1-question exercise: save → blank Q2.
      const startIndex = (generalQuestionCount > 0 && preExisting.length >= generalQuestionCount)
        ? Math.max(0, preExisting.length - 1)
        : preExisting.length;
      return { questions: preExisting, startIndex };
    }
    // Load ALL configured difficulties so preview shows every existing question
    const allDiffs = getConfiguredDiffs();
    const preExisting: FlowQuestion[] = [];
    if (allDiffs.length > 0) {
      allDiffs.forEach(d => {
        preExisting.push(...getDbQuestionsForDiff(d).map(dbQuestionToFlow));
      });
    } else {
      const diff = lockedDifficulty || initialDiff;
      preExisting.push(...getDbQuestionsForDiff(diff).map(dbQuestionToFlow));
    }
    // startIndex = preExisting.length means "next empty slot for new question".
    // But if ALL difficulty quotas are already met, clamp to the last existing question
    // to avoid showing an empty out-of-bounds form (Q6 when quota is 5).
    const totalQuota = allDiffs.length > 0
      ? allDiffs.reduce((sum, d) => sum + getQuotaForDiff(d), 0)
      : getQuotaForDiff(lockedDifficulty || initialDiff);
    const startIndex = (totalQuota > 0 && preExisting.length >= totalQuota)
      ? Math.max(0, preExisting.length - 1)   // all full → land on last question
      : preExisting.length;                    // still room → land on next empty slot
    return { questions: preExisting, startIndex };
  }, [isEditing, initialData, isGeneral, generalQuestionCount, lockedDifficulty, initialDiff, getDbQuestionsForDiff, getConfiguredDiffs]);

  const initialFlow = useMemo(() => buildInitialFlow(), []);
  const [flowQuestions, setFlowQuestions] = useState<FlowQuestion[]>(initialFlow.questions);
  const [currentIndex, setCurrentIndex] = useState(initialFlow.startIndex);
  const [currentDiff, setCurrentDiff] = useState<Diff>(initialDiff);

  const flowQuestionsRef = useRef<FlowQuestion[]>(initialFlow.questions);
  const currentIndexRef = useRef<number>(initialFlow.startIndex);

  useEffect(() => { flowQuestionsRef.current = flowQuestions; }, [flowQuestions]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const serverIdMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    initialFlow.questions.forEach(q => {
      if (q._id && q.__localId) serverIdMap.current.set(q.__localId, q._id);
    });
  }, []);



  const getServerId = useCallback((q: FlowQuestion | null | undefined): string | undefined => {
    if (!q) return undefined;
    const mapped = serverIdMap.current.get(q.__localId);
    if (mapped) return mapped;
    if (q._id) return q._id;
    if (isEditing && initialData?._id) return initialData._id;
    return undefined;
  }, [isEditing, initialData]);

  const registerSavedId = useCallback((localId: string, serverId: string) => {
    serverIdMap.current.set(localId, serverId);
    setFlowQuestions(prev => {
      const next = prev.map(q =>
        q.__localId === localId ? { ...q, _id: serverId, isSaved: true, isDirty: false, isPreExisting: true } : q
      );
      flowQuestionsRef.current = next;
      return next;
    });
  }, []);

  // ── Form Fields ───────────────────────────────────────────────────────────
  const [titleBlocks, setTitleBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);
  const [desc, setDesc] = useState(''); // kept for backward compat
  const [descBlocks, setDescBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);
  const [constraints, setConstr] = useState<string[]>(['']);
  const [hint, setHint] = useState('');
  const [extraHints, setExtraH] = useState<Array<{ hintText: string; pointsDeduction: number; isPublic: boolean }>>([]);
  const [score, setScore] = useState(0);
  const [timeLimit, setTL] = useState(2000);
  const [memLimit, setML] = useState(256);
  const [tcs, setTcs] = useState<TC[]>([mkTC(0)]);
  // Per-question AI test case count — only relevant when the exercise's
  // evaluationMethod is 'ai' and testCasesCountMode is 'perQuestion'.
  // Otherwise stored-but-unused (harmless). null = not set (legacy questions).
  const [aiTestCasesCount, setAiTestCasesCount] = useState<number | null>(null);
  // Link-question mode: the toolbar radio switches the WHOLE form down to one
  // URL input; only that link is required to save. Students then get the URL
  // in an iframe instead of the question+compiler workspace.
  const [isLinkQuestion, setIsLinkQuestion] = useState(false);
  const [questionLink, setQuestionLink] = useState('');
  // Code Setup — starter shown to students, solution used for validation.
  const [starterCode, setStarterCode] = useState('');
  const [solutionCode, setSolutionCode] = useState('');
  // ─── Question details taxonomy (2026-08-30 UI redesign) ────────────────
  // `category` = single value from QUESTION_CATEGORIES (or '' = uncategorised).
  // `tags` = arbitrary short strings, deduped case-insensitively on add.
  // Both persist through snapshotForm + mkPayload; server persistence is
  // subject to the addQuestion/updateQuestion Object.assign whitelist in
  // `server/controllers/courses/moduleStructure/exerciseAndQuestion.js`.
  const [category, setCategory] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<string>('');
  // Collapsible "6. Hints & advanced settings" open/closed state.
  // Default OPEN — the reference showed hints as a permanently visible
  // sub-section, and collapsing by default hid the Add-Hint affordance
  // so teachers couldn't tell how to add one. loadQuestionIntoForm keeps
  // it in sync with each loaded question.
  const [hintsOpen, setHintsOpen] = useState<boolean>(true);
  const [codeSetupLanguage, setCodeSetupLanguage] = useState<string>(() => {
    const langs: string[] = (exerciseData as any)?.fullExerciseData?.programmingSettings?.selectedLanguages || [];
    return langs[0] || 'Python';
  });

  // ─── Execution Setup state (author-side, per-question) ─────────────────
  // Backward-compat default is 'fullProgram' so existing stdin/stdout test
  // cases keep grading the same way with no author action required.
  const [executionType, setExecutionType] = useState<'function' | 'fullProgram'>('fullProgram');
  const [functionContract, setFunctionContract] = useState<FunctionContract>(mkFunctionContract());
  const [startingExperience, setStartingExperience] = useState<'blank' | 'generated' | 'custom'>('blank');
  const [showDriverPreview, setShowDriverPreview] = useState<boolean>(false);
  // Modal flags for the execution playground surfaces
  const [showRunTestsModal, setShowRunTestsModal] = useState<boolean>(false);
  const [showTryFunctionModal, setShowTryFunctionModal] = useState<boolean>(false);
  const [showCustomInputModal, setShowCustomInputModal] = useState<boolean>(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [showDiffPopup, setShowDiffPopup] = useState(false);
  const [completedDiff, setCompletedDiff] = useState<Diff | null>(null);

  // On mount: if the component remounted after a plain Save and the current difficulty
  // quota is already full (startIndex is out-of-bounds), show DiffPopup immediately
  // instead of leaving the user staring at a blank Q6 form.
  useEffect(() => {
    if (isGeneral) return;
    if (lockedDifficulty) return; // user already picked a difficulty from the selector — don't re-show "complete" popup
    // If the form was opened with bank questions, the bank-preload effect will
    // place us on the right difficulty (matching the picks). Showing the
    // "Easy Questions Complete!" popup here would interrupt that flow — skip it.
    if (initialBankQuestions && initialBankQuestions.length > 0) return;
    const flow = flowQuestionsRef.current;
    const idx = currentIndexRef.current;
    if (idx < flow.length || flow.length === 0) return; // normal case — nothing to do
    const allDiffs = getConfiguredDiffs();
    for (const d of allDiffs) {
      const cnt = flow.filter(q =>
        q.difficulty === d &&
        !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
      ).length;
      if (cnt >= getQuotaForDiff(d)) {
        const remaining = allDiffs.filter(od => {
          if (od === d) return false;
          const oc = flow.filter(q =>
            q.difficulty === od &&
            !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
          ).length;
          return oc < getQuotaForDiff(od);
        });
        if (remaining.length > 0) {
          setCompletedDiff(d);
          setShowDiffPopup(true);
        }
        return;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [saveOk, setSaveOk] = useState(false);
  const [diffSwitchTarget, setDiffSwitchTarget] = useState<Diff | null>(null);
  const [editorState, setEditorState] = useState<{
    activeElement: HTMLElement | null;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
  }>({
    activeElement: null,
    isBold: false,
    isItalic: false,
    isUnderline: false,
  });

  // Toggle formatting functions
  const toggleBold = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('bold', false);
      setEditorState(prev => ({ ...prev, isBold: !prev.isBold }));
    }
  };

  const toggleItalic = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('italic', false);
      setEditorState(prev => ({ ...prev, isItalic: !prev.isItalic }));
    }
  };

  const toggleUnderline = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('underline', false);
      setEditorState(prev => ({ ...prev, isUnderline: !prev.isUnderline }));
    }
  };

  // Update toolbar button states based on cursor position
  const updateFormattingState = () => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
      setEditorState({
        activeElement: activeElement as HTMLElement,
        isBold: document.queryCommandState('bold'),
        isItalic: document.queryCommandState('italic'),
        isUnderline: document.queryCommandState('underline'),
      });
    }
  };

  // Handle selection change to update button states
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        updateFormattingState();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);





  const titleRef = useRef<HTMLTextAreaElement>(null);

  // ── Section refs for scroll-to-error ──────────────────────────────────────
  const scoreSectionRef = useRef<HTMLDivElement>(null);
  const titleSectionRef = useRef<HTMLDivElement>(null);
  const descSectionRef = useRef<HTMLDivElement>(null);
  const codeSetupSectionRef = useRef<HTMLDivElement>(null);
  const constraintsSectionRef = useRef<HTMLDivElement>(null);
  const testcasesSectionRef = useRef<HTMLDivElement>(null);
  const stickyToolbarRef = useRef<HTMLDivElement>(null);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [validationToast, setValidationToast] = useState<string[]>([]);

  const scrollToFirstError = (errors: Record<string, string>) => {
    // Score lives in the sticky toolbar (always visible) — no need to scroll to it.
    // Scroll only to content fields in top-to-bottom order.
    const order: { key: string; ref: React.RefObject<HTMLDivElement | null> }[] = [
      { key: 'title', ref: titleSectionRef },
      { key: 'description', ref: descSectionRef },
      { key: 'solutionCode', ref: codeSetupSectionRef },
      { key: 'starterCode',  ref: codeSetupSectionRef },
      { key: 'constraints', ref: constraintsSectionRef },
      { key: 'testcases', ref: testcasesSectionRef },
    ];
    for (const { key, ref } of order) {
      if (errors[key] && ref.current) {
        const container = formScrollRef.current;
        if (container) {
          // Offset scroll by the sticky toolbar height so the label is not hidden behind it
          const stickyHeight = (stickyToolbarRef.current?.offsetHeight ?? 60) + 8;
          const containerRect = container.getBoundingClientRect();
          const elementRect = ref.current.getBoundingClientRect();
          const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - stickyHeight;
          container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        } else {
          ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
    }
    // Show toast listing all missing fields
    const messages = Object.values(errors);
    if (messages.length > 0) {
      setValidationToast(messages);
      setTimeout(() => setValidationToast([]), 3000);
    }
  };


  const getRemainingSlots = useCallback((d?: Diff, withFlow?: FlowQuestion[]): number => {
    const flow = withFlow ?? flowQuestionsRef.current;
    if (isGeneral) {
      const quota = generalQuestionCount; if (quota <= 0) return 0;
      const dbQuestions = getDbQuestionsForDiff(); const dbIdSetAll = getDbIdSet();
      const newInSession = flow.filter(q => { const sid = serverIdMap.current.get(q.__localId) || q._id; if (!sid) return false; if (dbIdSetAll.has(sid.toString())) return false; return true; }).length;
      return Math.max(0, quota - (dbQuestions.length + newInSession));
    }
    if (!d) return 0;
    const quota = getQuotaForDiff(d); if (quota <= 0) return 0;
    const dbQsForDiff = getDbQuestionsForDiff(d); const dbIdSetForDiff = getDbIdSet(d);
    const newInSession = flow.filter(q => { if (q.difficulty !== d) return false; const sid = serverIdMap.current.get(q.__localId) || q._id; if (!sid) return false; if (dbIdSetForDiff.has(sid.toString())) return false; return true; }).length;
    return Math.max(0, quota - (dbQsForDiff.length + newInSession));
  }, [isGeneral, generalQuestionCount, getDbQuestionsForDiff, getDbIdSet, getQuotaForDiff, flowQuestions]);

  const getCreatedCount = useCallback((d?: Diff, withFlow?: FlowQuestion[]): number => {
    const quota = isGeneral ? generalQuestionCount : (d ? getQuotaForDiff(d) : 0);
    return quota - getRemainingSlots(d, withFlow);
  }, [isGeneral, generalQuestionCount, getQuotaForDiff, getRemainingSlots]);

  // ── Custom-mix quota (per-source × per-difficulty) ─────────────────────────
  // When the exercise's source is Custom with a distribution matrix, each
  // source only owns its slice of every difficulty's slots. Used counts mirror
  // getRemainingSlots: DB questions + flow entries saved this session.
  const customDist: any = exerciseData.fullExerciseData?.customDistribution;
  const useCustomDist = useMemo(() => {
    if (isGeneral) return false; // matrix only exists for level-based patterns
    if ((questionSourceRaw || null) !== 'custom' || !customDist) return false;
    const total = (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
      s + (customDist[r]?.scratch || 0) + (customDist[r]?.ai || 0) + (customDist[r]?.thirdParty || 0), 0);
    return total > 0;
  }, [isGeneral, questionSourceRaw, customDist]);
  const srcOfTag = (tag: any): 'scratch' | 'ai' | 'thirdParty' | 'unknown' => {
    const s = (tag ?? '').toString();
    if (s.startsWith('scratch')) return 'scratch';
    if (s === 'ai') return 'ai';
    if (s.startsWith('thirdParty')) return 'thirdParty';
    return 'unknown';
  };
  // Staged flow entries: imported/generated but not yet saved. They already
  // hold a slot in the review queue, so quota math must count them — otherwise
  // reopening the AI modal / bank picker lets the teacher stack past the quota.
  // Blank editor placeholders (no title) are NOT staged work.
  // `excludeLocalId` drops one flow entry from the staged tally — the save-time
  // Manual gate passes the question BEING saved, whose own typed title would
  // otherwise count against `open` and block a legitimate save by one.
  const getStagedCount = useCallback((d: Diff, src?: 'scratch' | 'ai' | 'thirdParty', excludeLocalId?: string): number =>
    flowQuestionsRef.current.filter(q => {
      if (q.difficulty !== d) return false;
      if (excludeLocalId && q.__localId === excludeLocalId) return false;
      const sid = serverIdMap.current.get(q.__localId) || q._id;
      if (sid) return false; // saved / db-loaded — counted by getRemainingSlots
      const titleText = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
      if (!titleText.toString().trim()) return false;
      if (src) return srcOfTag((q as any).source) === src;
      return true;
    }).length, []);
  const getSourceRemaining = useCallback((src: 'scratch' | 'ai' | 'thirdParty', d: Diff, excludeLocalId?: string): number => {
    const open = Math.max(0, getRemainingSlots(d) - getStagedCount(d, undefined, excludeLocalId));
    if (!useCustomDist) return open;
    const quota = customDist?.[d]?.[src] || 0;
    const dbUsed = getDbQuestionsForDiff(d).filter((q: any) => srcOfTag(q.source) === src).length;
    const dbIdSetForDiff = getDbIdSet(d);
    const savedInSession = flowQuestionsRef.current.filter(q => {
      if (q.difficulty !== d) return false;
      if (srcOfTag((q as any).source) !== src) return false;
      const sid = serverIdMap.current.get(q.__localId) || q._id;
      if (!sid) return false;
      return !dbIdSetForDiff.has(sid.toString());
    }).length;
    return Math.max(0, Math.min(open, quota - (dbUsed + savedInSession + getStagedCount(d, src, excludeLocalId))));
  }, [useCustomDist, customDist, getRemainingSlots, getStagedCount, getDbQuestionsForDiff, getDbIdSet]);
  const getSourceRemainingTotal = useCallback((src: 'scratch' | 'ai' | 'thirdParty'): number => {
    if (isGeneral) return getRemainingSlots();
    return getConfiguredDiffs().reduce((s, d) => s + getSourceRemaining(src, d), 0);
  }, [isGeneral, getRemainingSlots, getConfiguredDiffs, getSourceRemaining]);

  const isExistingQuestion = useMemo(() => {
    const q = flowQuestions[currentIndex]; if (!q) return false;
    return !!(getServerId(q) || isEditing);
  }, [flowQuestions, currentIndex, isEditing, getServerId]);

  const hasUnsavedFormChanges = useMemo((): boolean => {
    const currentQ = flowQuestions[currentIndex];
    if (!currentQ || (!currentQ._id && !currentQ.isSaved && !currentQ.isPreExisting)) return !!(getTitleText(titleBlocks) || desc.trim() || category || tags.length > 0);
    if (isEditMode && currentQ) {
      const existingDesc = typeof currentQ.description === 'object' ? currentQ.description?.text || '' : currentQ.description || '';
      const existingTags: string[] = Array.isArray((currentQ as any).tags) ? (currentQ as any).tags : [];
      const tagsChanged = tags.length !== existingTags.length || tags.some((t, i) => t !== existingTags[i]);
      return getTitleText(titleBlocks) !== (Array.isArray(currentQ.title) ? getTitleText(currentQ.title as any) : currentQ.title || '') || desc !== existingDesc || score !== (currentQ.score || 0) || timeLimit !== (currentQ.timeLimit || 2000) || memLimit !== (currentQ.memoryLimit || 256)
        || isLinkQuestion !== (currentQ.isLinkQuestion === true) || questionLink.trim() !== (currentQ.questionLink || '')
        || category !== ((currentQ as any).category || '') || tagsChanged;
    }
    return false;
  }, [flowQuestions, currentIndex, isEditMode, titleBlocks, desc, score, timeLimit, memLimit, isLinkQuestion, questionLink, category, tags]);

  const hasSavedQuestionsInSession = useMemo((): boolean =>
    flowQuestions.some(q => q.isSaved || q._id || serverIdMap.current.has(q.__localId)),
    [flowQuestions]);

  const shouldConfirmClose = useMemo((): boolean => hasUnsavedFormChanges || hasSavedQuestionsInSession, [hasUnsavedFormChanges, hasSavedQuestionsInSession]);

  const handleCloseRequest = useCallback(() => { if (shouldConfirmClose) setShowCloseConfirm(true); else onClose(); }, [shouldConfirmClose, onClose]);
  const handleCloseConfirmed = useCallback(() => { setShowCloseConfirm(false); onClose(); }, [onClose]);


  // Handle selection change to update button states
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        updateFormattingState();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);


  useEffect(() => {
    const startQ = flowQuestions[initialFlow.startIndex];
    if (startQ) loadQuestionIntoForm(startQ);
    else resetForm(isGeneral ? generalMPQ : isScoreEditable(initialDiff) ? 0 : getFixedScore(initialDiff));
    setTimeout(() => titleRef.current?.focus(), 80);
  }, []);

  const loadQuestionIntoForm = (q: FlowQuestion) => {
    setTitleBlocks(titleToBlocks(q.title));

    // description is already a clean ProgContentBlock[] after dbQuestionToFlow normalizes it
    // but handle edge cases defensively
    let descBlocksLoaded: ProgContentBlock[];

    if (Array.isArray(q.description) && (q.description as any[]).length > 0) {
      descBlocksLoaded = (q.description as any[]).map((b: any) => ({
        ...b,
        id: b.id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
    } else {
      descBlocksLoaded = descToBlocks(q.description);
    }

    const plainText = descBlocksLoaded
      .filter(b => b.type === 'text')
      .map(b => (b as any).value)
      .join('\n');

    setDesc(plainText);
    setDescBlocks(descBlocksLoaded);

    setConstr(q.constraints?.length ? [...q.constraints] : ['']);
    setHint(q.hints?.[0]?.hintText || '');
    setExtraH(
      (q.hints || []).slice(1).map((h: any) => ({
        hintText: h.hintText,
        pointsDeduction: h.pointsDeduction || 0,
        isPublic: h.isPublic !== false,
      }))
    );
    setScore(q.score || 0);
    setTL(q.timeLimit || 2000);
    setML(q.memoryLimit || 256);
    setTcs(
      q.testCases?.length
        ? q.testCases.map((tc: any, i: number) => ({
          id: tc._id || `tc-${Date.now()}-${i}`,
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: tc.isHidden || false,
          isSample: tc.isSample ?? i === 0,
          description: tc.explanation || `Test Case ${i + 1}`,
          functionInputs: (tc.functionInputs && typeof tc.functionInputs === 'object')
            ? { ...tc.functionInputs } : undefined,
        }))
        : [mkTC(0)]
    );
    setCurrentDiff((q.difficulty as Diff) || currentDiff);
    // Per-question AI count — null if the field is absent (legacy questions).
    // The resolver falls back to the exercise's count when null; the form
    // requires a value only when the exercise is in perQuestion mode.
    const rawAiCount = (q as any)?.aiTestCasesCount;
    setAiTestCasesCount(
      typeof rawAiCount === 'number' && rawAiCount >= 0 ? Math.min(50, Math.floor(rawAiCount)) : null,
    );
    setIsLinkQuestion(q.isLinkQuestion === true);
    setQuestionLink(q.questionLink || '');
    // Code Setup — starter/solution/lang round-trip cleanly.
    setStarterCode(typeof (q as any).starterCode === 'string' ? (q as any).starterCode : '');
    setSolutionCode(typeof (q as any).solutionCode === 'string' ? (q as any).solutionCode : '');
    if (typeof (q as any).codeSetupLanguage === 'string' && (q as any).codeSetupLanguage) {
      setCodeSetupLanguage((q as any).codeSetupLanguage);
    }
    // ── Execution setup — hydrate w/ backward-compat defaults ──────────────
    const et = ((q as any).executionType === 'function' || (q as any).executionType === 'fullProgram')
      ? (q as any).executionType
      : 'fullProgram';
    setExecutionType(et);
    const rawFc = (q as any).functionContract;
    setFunctionContract(
      rawFc && typeof rawFc === 'object'
        ? {
            functionName: typeof rawFc.functionName === 'string' ? rawFc.functionName : '',
            returnType: typeof rawFc.returnType === 'string' ? rawFc.returnType : 'integer',
            params: Array.isArray(rawFc.params) ? rawFc.params.map((p: any, i: number) => ({
              id: p?.id || `fp-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`,
              name: typeof p?.name === 'string' ? p.name : `p${i+1}`,
              type: typeof p?.type === 'string' ? p.type : 'integer',
            })) : [],
          }
        : mkFunctionContract()
    );
    const rawSe = (q as any).startingExperience;
    setStartingExperience(
      (rawSe === 'blank' || rawSe === 'generated' || rawSe === 'custom')
        ? rawSe
        : (et === 'function' ? 'generated' : 'blank')
    );
    // ── Taxonomy (2026-08-30 UI redesign): category is one preset or ''
    //     tags is an array of trimmed strings; keep the collapsible open
    //     when the loaded question already has a hint / extra hints. ──
    setCategory(typeof (q as any).category === 'string' ? (q as any).category : '');
    setTags(Array.isArray((q as any).tags)
      ? ((q as any).tags as any[]).filter((t) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
      : []);
    setTagDraft('');
    // Hints are always visible on load — teachers expect the Add-Hint
    // affordance to be reachable without clicking a mystery toggle. The
    // toggle in the header still lets a teacher hide the panel if they
    // want to shorten the form on a question that will never have hints.
    setHintsOpen(true);
    setErrs({});
    setTouched(new Set());
    setIsEditMode(!!(getServerId(q)));
  };

  const resetForm = (defaultScore?: number) => {
    setTitleBlocks([mkProgTextBlock()]); setDesc(''); setDescBlocks([mkProgTextBlock()]); setConstr(['']); setHint(''); setExtraH([]);
    setScore(defaultScore ?? (isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
    setTL(2000); setML(256); setTcs([mkTC(0)]); setErrs({}); setTouched(new Set()); setIsEditMode(false);
    setAiTestCasesCount(null);
    setIsLinkQuestion(false); setQuestionLink('');
    setStarterCode(''); setSolutionCode('');
    // Execution setup back to defaults (fullProgram + blank editor)
    setExecutionType('fullProgram');
    setFunctionContract(mkFunctionContract());
    setStartingExperience('blank');
    // Taxonomy defaults + close hints panel on a fresh blank form.
    setCategory(''); setTags([]); setTagDraft('');
    setHintsOpen(true);
  };

  const snapshotForm = (overrides?: Partial<FlowQuestion>): FlowQuestion => {
    const existing = flowQuestionsRef.current[currentIndexRef.current];
    const allHints = hint.trim()
      ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 },
      ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))]
      : extraHints.map((h, i) => ({ ...h, sequence: i }));
    const finalScore = isGeneral
      ? generalMPQ
      : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);
    const serverId = getServerId(existing) || overrides?._id;

    return {
      __localId: existing?.__localId || mkLocalId(),
      _id: serverId,
      sectionId: exerciseData?.currentSectionId || null,  // ✅ ADD THIS
      title: getTitleText(titleBlocks) || '',
      description: descBlocks, // ← pure ProgContentBlock[] array, normalized on save via mkPayload
      difficulty: isGeneral ? 'medium' : currentDiff,
      score: finalScore,
      testCases: tcs.map((tc, i) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        points: 1,
        explanation: tc.description || `Test Case ${i + 1}`,
        sequence: i,
        ...(tc.functionInputs ? { functionInputs: tc.functionInputs } : {}),
      })),
      constraints: constraints.filter(c => c.trim()),
      hints: allHints,
      timeLimit,
      memoryLimit: memLimit,
      questionType: 'programming',
      isSaved: !!(serverId) || existing?.isSaved || false,
      isDirty: !!(serverId),
      isPreExisting: existing?.isPreExisting || !!(serverId) || false,
      // Per-question AI test case count — only meaningful when the exercise's
      // evaluationMethod is 'ai' + testCasesCountMode 'perQuestion'.
      aiTestCasesCount,
      isLinkQuestion,
      questionLink: questionLink.trim(),
      starterCode,
      solutionCode,
      codeSetupLanguage,
      executionType,
      functionContract,
      startingExperience,
      // Author-provided taxonomy — see [[lms-questionforms-unification]] Phase 3.
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      ...overrides,
    };
  };


  const mkPayload = () => {
    const safeTitle = getTitleText(titleBlocks) || '';
    const allHints = hint.trim()
      ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 },
      ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))]
      : extraHints.map((h, i) => ({ ...h, sequence: i }));
    const finalScore = isGeneral
      ? generalMPQ
      : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);

    // Source tag: prefer the FlowQuestion's own source (set when it was
    // imported from bank / AI / doc), else fall back to the last-clicked
    // source in the + dropdown (manual by default).
    const currentQ = flowQuestionsRef.current[currentIndexRef.current];
    const questionSourceTag = (currentQ as any)?.source || pendingSourceRef.current || 'scratch-manual';

    return {
      questionType: 'programming',
      sectionId: exerciseData?.currentSectionId || null,  // ✅ ADD THIS
      source: questionSourceTag,
      // Bank-origin id rides to the DB so the same bank question can't be
      // imported twice (picker disable + server duplicate rejection).
      bankQuestionId: (currentQ as any)?.bankQuestionId || null,

      title: safeTitle,
      // Always serialize as { contentBlocks, text, imageUrl, ... } for DB
      description: {
        contentBlocks: descBlocks,
        text: descBlocks
          .filter(b => b.type === 'text')
          .map(b => (b as any).value)
          .join('\n')
          .trim(),
        imageUrl: (descBlocks.find(b => b.type === 'image') as any)?.url || null,
        imageAlignment: (descBlocks.find(b => b.type === 'image') as any)?.alignment || 'left',
        imageSizePercent: (descBlocks.find(b => b.type === 'image') as any)?.sizePercent || 100,
      },
      difficulty: isGeneral ? 'medium' : currentDiff,
      score: finalScore,
      points: finalScore,
      constraints: constraints.filter(c => c.trim()),
      hints: allHints,
      testCases: tcs.map((tc, i) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        points: 1,
        explanation: tc.description || `Test Case ${i + 1}`,
        sequence: i,
        ...(tc.functionInputs ? { functionInputs: tc.functionInputs } : {}),
      })),
      solutions: { startedCode: '', functionName: functionContract.functionName || 'main', language: (codeSetupLanguage || 'python').toLowerCase() },
      timeLimit,
      memoryLimit: memLimit,
      isActive: true,
      // Per-question AI test case count. Server persists as-is; falls back to
      // the exercise's count for legacy questions where this is null. Only
      // ENFORCED at Save-time in the form when the exercise is in
      // 'perQuestion' mode (see validate()).
      aiTestCasesCount,
      // Link questions: only these two + a title (the URL) matter; the server
      // skips title/description validation when isLinkQuestion is true.
      isLinkQuestion,
      questionLink: questionLink.trim(),
      ...(isLinkQuestion && !safeTitle ? { title: questionLink.trim() } : {}),
      // Code Setup — starterCode goes to the student attempt UI on load;
      // solutionCode is author-only and MUST be filtered on the student-facing
      // pedagogy response by the server layer.
      // In Blank Editor mode we send an empty starter regardless of what the
      // teacher previously typed — otherwise a stale Custom Starter would leak
      // through and pre-fill the student editor.
      // In Generated Starter mode we materialise the skeleton at save time so
      // the student attempt UI can render it without knowing about the
      // contract; the client-side render can still recompute it live for
      // preview parity.
      starterCode: isLinkQuestion
        ? ''
        : (startingExperience === 'blank'
            ? ''
            : startingExperience === 'generated'
              ? execGeneratedStarter(codeSetupLanguage || 'Python', functionContract)
              : (starterCode || '')),
      solutionCode: isLinkQuestion ? '' : (solutionCode || ''),
      codeSetupLanguage: isLinkQuestion ? undefined : (codeSetupLanguage || undefined),
      // ── Execution setup — persist alongside legacy fields ──────────────
      // The server should whitelist these on the programming-question schemas
      // so they round-trip through /addQuestion and /updateQuestion; until it
      // does, they will be silently dropped (matches the memory note on the
      // step-scoped payload whitelist gotcha).
      executionType: isLinkQuestion ? undefined : executionType,
      functionContract: isLinkQuestion ? undefined : functionContract,
      startingExperience: isLinkQuestion ? undefined : startingExperience,
      // Author-provided taxonomy. Sent whether or not the exercise's
      // question-source is scratch/AI/bank so bank imports carry their
      // origin tags forward if they had any. NOTE: server persistence
      // requires `category` and `tags` in the addQuestion/updateQuestion
      // Object.assign whitelist in
      // `server/controllers/courses/moduleStructure/exerciseAndQuestion.js`
      // — until that lands, these are effectively client-side only.
      category: (category || '').trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
  };
  const handleEditClick = () => setIsEditMode(true);
  const handleCancelEdit = () => { setIsEditMode(false); if (flowQuestions[currentIndex]) loadQuestionIntoForm(flowQuestions[currentIndex]); };
  const handleEditExerciseClick = () => setShowEditExerciseConfirm(true);
  const handleEditExerciseConfirm = () => { setShowEditExerciseConfirm(false); onEditExercise?.(); };
  const handleDiffRowClick = (d: Diff) => { if (d === currentDiff) return; setDiffSwitchTarget(d); };

  const confirmDiffSwitch = (overrideDiff?: Diff) => {
    // Guard: only accept a real Diff string — never a MouseEvent or other non-string value
    const d = (typeof overrideDiff === 'string' ? overrideDiff : null) ?? diffSwitchTarget;
    if (!d) return;
    setDiffSwitchTarget(null);

    // ── 1. Snapshot current form into flow synchronously (single setFlowQuestions call) ──
    const snap = snapshotForm({ isSaved: flowQuestions[currentIndex]?.isSaved || false, _id: getServerId(flowQuestions[currentIndex]) });
    const snapFlow = [...flowQuestionsRef.current];
    if (currentIndex < snapFlow.length) snapFlow[currentIndex] = snap;
    flowQuestionsRef.current = snapFlow; // keep ref in sync before using it below
    setFlowQuestions(snapFlow);

    // ── 2. Load DB questions for target diff if not yet in flow ──
    const alreadyInFlow = snapFlow.some(q => q.difficulty === d);
    let questionsToAdd: FlowQuestion[] = [];
    if (!alreadyInFlow) {
      const dbQs = getDbQuestionsForDiff(d);
      questionsToAdd = dbQs.map(dbQuestionToFlow);
      questionsToAdd.forEach(q => { if (q._id) serverIdMap.current.set(q.__localId, q._id); });
    }
    const flowAfterDbLoad = [...snapFlow, ...questionsToAdd];
    const remainingAfterLoad = getRemainingSlots(d, flowAfterDbLoad);

    // ── 3. Difficulty is full → navigate to last question of that specific difficulty ──
    if (remainingAfterLoad <= 0) {
      flowQuestionsRef.current = flowAfterDbLoad; setFlowQuestions(flowAfterDbLoad);
      const dIndices = flowAfterDbLoad.reduce<number[]>((acc, q, i) => { if (q.difficulty === d) acc.push(i); return acc; }, []);
      const lastDIdx = dIndices.length > 0 ? dIndices[dIndices.length - 1] : flowAfterDbLoad.length - 1;
      currentIndexRef.current = lastDIdx; setCurrentIndex(lastDIdx); setCurrentDiff(d);
      if (flowAfterDbLoad[lastDIdx]) loadQuestionIntoForm(flowAfterDbLoad[lastDIdx]);
      setTimeout(() => titleRef.current?.focus(), 80); return;
    }

    const defaultScore = isScoreEditable(d) ? 0 : getFixedScore(d);

    // ── 4. Reuse existing unsaved empty question for this diff rather than creating a duplicate ──
    const existingEmptyIdx = flowAfterDbLoad.findIndex(
      q => q.difficulty === d && !q.isSaved && !q._id && !serverIdMap.current.get(q.__localId)
    );
    if (existingEmptyIdx >= 0) {
      flowQuestionsRef.current = flowAfterDbLoad; setFlowQuestions(flowAfterDbLoad);
      currentIndexRef.current = existingEmptyIdx; setCurrentIndex(existingEmptyIdx); setCurrentDiff(d);
      resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80); return;
    }

    // ── 5. Create a new empty question for difficulty d ──
    const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: d, score: defaultScore, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false, starterCode: '', solutionCode: '' };
    const newFlow = [...flowAfterDbLoad, newQ];
    flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const newIdx = newFlow.length - 1; currentIndexRef.current = newIdx; setCurrentIndex(newIdx); setCurrentDiff(d);
    resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80);
  };

  const handleDeleteQuestion = async (localId: string) => {
    const targetQ = flowQuestionsRef.current.find(q => q.__localId === localId);
    const serverId = serverIdMap.current.get(localId) || targetQ?._id;

    // If it exists in the DB, call the delete API first
    if (serverId && onDeleteQuestion) {
      try {
        await onDeleteQuestion(serverId as string);
      } catch (err) {
        console.error('Failed to delete question from DB:', err);
        return; // Don't remove from UI if DB delete failed
      }
    }

    // Remove from local flow
    setFlowQuestions(prev => { const next = prev.filter(q => q.__localId !== localId); flowQuestionsRef.current = next; return next; });
    serverIdMap.current.delete(localId);
    const deletedIdx = flowQuestionsRef.current.findIndex(q => q.__localId === localId);
    const remainingFlow = flowQuestionsRef.current.filter(q => q.__localId !== localId);
    const newIdx = Math.min(currentIndex, remainingFlow.length - 1);
    if (newIdx >= 0 && remainingFlow[newIdx]) { setCurrentIndex(newIdx); currentIndexRef.current = newIdx; loadQuestionIntoForm(remainingFlow[newIdx]); }
    else { setCurrentIndex(0); currentIndexRef.current = 0; resetForm(isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)); }
  };


  const handleDeleteCurrentQuestion = async () => {
    const currentQ = flowQuestions[currentIndex];
    if (!currentQ) return;

    const serverId = serverIdMap.current.get(currentQ.__localId) || currentQ._id;
    const currentIdx = currentIndex;

    // If it exists in the DB, call the delete API first
    if (serverId && onDeleteQuestion) {
      try {
        await onDeleteQuestion(serverId as string);
      } catch (err) {
        console.error('Failed to delete question from DB:', err);
        setShowDeleteConfirm(false);
        return;
      }
    }

    // Remove from local flow
    setFlowQuestions(prev => {
      const newFlow = prev.filter(q => q.__localId !== currentQ.__localId);
      flowQuestionsRef.current = newFlow;

      // Determine new index
      let newIndex = currentIdx;
      if (newFlow.length === 0) {
        // No questions left, create a new empty question
        const emptyQ: FlowQuestion = {
          __localId: mkLocalId(),
          _id: undefined,
          title: '',
          description: [mkProgTextBlock()],
          difficulty: isGeneral ? 'medium' : currentDiff,
          score: isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)),
          testCases: [mkTC(0)],
          constraints: [],
          hints: [],
          timeLimit: 2000,
          memoryLimit: 256,
          questionType: 'programming',
          isSaved: false,
          isDirty: false,
          isPreExisting: false,
          starterCode: '',
          solutionCode: '',
        };
        newFlow.push(emptyQ);
        newIndex = 0;
      } else if (currentIdx >= newFlow.length) {
        newIndex = newFlow.length - 1;
      } else if (currentIdx > 0) {
        newIndex = currentIdx - 1; // Go to previous
      } else {
        newIndex = 0;
      }

      // Load the question at new index
      setTimeout(() => {
        if (newFlow[newIndex]) {
          setCurrentIndex(newIndex);
          currentIndexRef.current = newIndex;
          loadQuestionIntoForm(newFlow[newIndex]);
          if (!isGeneral && newFlow[newIndex]?.difficulty) {
            setCurrentDiff(newFlow[newIndex].difficulty as Diff);
          }
        } else {
          resetForm(isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
        }
        setTimeout(() => titleRef.current?.focus(), 80);
      }, 0);

      return newFlow;
    });

    serverIdMap.current.delete(currentQ.__localId);
    setShowDeleteConfirm(false);
  };

  const handleClearCurrentQuestion = () => {
    // Reset all form fields
    setTitleBlocks([mkProgTextBlock()]);
    setDesc('');
    setDescBlocks([mkProgTextBlock()]);
    setConstr(['']);
    setHint('');
    setExtraH([]);
    setScore(isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
    setTL(2000);
    setML(256);
    setTcs([mkTC(0)]);
    setStarterCode('');
    setSolutionCode('');
    setExecutionType('fullProgram');
    setFunctionContract(mkFunctionContract());
    setStartingExperience('blank');
    setErrs({});
    setTouched(new Set());
    setIsEditMode(false);

    // Update the flow
    const currentQ = flowQuestions[currentIndex];
    if (currentQ) {
      const clearedQ = {
        ...currentQ,
        title: '',
        description: [mkProgTextBlock()],
        testCases: [mkTC(0)],
        constraints: [],
        hints: [],
        isDirty: false,
        isSaved: false,
      };
      setFlowQuestions(prev => {
        const newFlow = [...prev];
        newFlow[currentIndex] = clearedQ;
        flowQuestionsRef.current = newFlow;
        return newFlow;
      });
    }

    setShowClearConfirm(false);
    setTimeout(() => titleRef.current?.focus(), 80);
  };
  const handlePrevious = () => {
    const idx = currentIndexRef.current; const flow = flowQuestionsRef.current; if (idx <= 0) return;
    const existingQ = flow[idx];
    const snap = snapshotForm({ isSaved: existingQ?.isSaved || !!(getServerId(existingQ)), _id: getServerId(existingQ), isDirty: !!(getServerId(existingQ)), isPreExisting: existingQ?.isPreExisting });
    const newFlow = [...flow]; newFlow[idx] = snap; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const prevIdx = idx - 1; currentIndexRef.current = prevIdx; setCurrentIndex(prevIdx);
    // Switch difficulty if the previous question lives in a different one (level mode only)
    if (!isGeneral && newFlow[prevIdx]?.difficulty) {
      setCurrentDiff(newFlow[prevIdx].difficulty as Diff);
    }
    loadQuestionIntoForm(newFlow[prevIdx]);
    setTimeout(() => titleRef.current?.focus(), 80);
  };
const handleBankSelectedQuestions = useCallback((selected: any[], sourceTag?: string) => {
  // Tag EVERY imported question with the source it came from so mkPayload
  // emits the right `source` field on save. Callers pass an explicit tag
  // (e.g. 'ai', 'scratch-bank'); default to the ref (Manual by default).
  const tag = sourceTag || pendingSourceRef.current || 'scratch-bank';
  // Accept the whole programming family — core programming, frontend and database.
  const programmingQuestions = selected.filter(q =>
    ['programming', 'frontend', 'database'].includes((q.questionType || '').toLowerCase())
  );
  
  if (!selected.length) {
    toast.info('No questions selected', 'Please select questions from the bank.');
    return;
  }
  
  if (programmingQuestions.length === 0) {
    toast.warning('No programming questions selected', 
      'Please select programming questions from the bank. Only programming questions can be added to this exercise.');
    return;
  }
  
  // Log if some questions were filtered out
  if (programmingQuestions.length < selected.length) {
    const filteredOut = selected.length - programmingQuestions.length;
    toast.info(`${filteredOut} non-programming question${filteredOut > 1 ? 's were' : ' was'} skipped`, 
      'Only programming questions can be added to this exercise.');
  }

  // Map bank question to Programming question format
  const bankToProgrammingQuestion = (q: any): Partial<FlowQuestion> => {
    // Extract title - handle different formats
    let titleText = '';
    if (typeof q.title === 'string') {
      titleText = q.title;
    } else if (q.mcqQuestionTitle) {
      if (typeof q.mcqQuestionTitle === 'string') titleText = q.mcqQuestionTitle;
      else if (Array.isArray(q.mcqQuestionTitle)) {
        titleText = q.mcqQuestionTitle.filter((b: any) => b.type === 'text').map((b: any) => b.value).join(' ').trim();
      }
    }
    
    // Extract description - handle different formats
    let descriptionBlocks: ProgContentBlock[] = [];
    let descriptionText = '';
    
    if (q.description) {
      if (typeof q.description === 'string') {
        descriptionText = q.description;
      } else if (q.description.contentBlocks) {
        descriptionBlocks = q.description.contentBlocks;
      } else if (q.description.text) {
        descriptionText = q.description.text;
      } else {
        descriptionText = q.description;
      }
    }
    
    // If no description blocks, create one from description text
    if (descriptionBlocks.length === 0 && descriptionText) {
      descriptionBlocks = [{ id: `pb-${Date.now()}`, type: 'text' as const, value: descriptionText }];
    } else if (descriptionBlocks.length === 0) {
      descriptionBlocks = [mkProgTextBlock()];
    }
    
    // Extract constraints
    let constraintsList: string[] = [];
    if (q.constraints && Array.isArray(q.constraints)) {
      constraintsList = q.constraints;
    } else if (q.constraints && typeof q.constraints === 'string') {
      constraintsList = [q.constraints];
    }
    
    // Extract test cases
    let testCasesList: any[] = [];
    if (q.testCases && Array.isArray(q.testCases)) {
      testCasesList = q.testCases.map((tc: any) => ({
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isSample: tc.isSample || false,
        isHidden: tc.isHidden || false,
        points: tc.points || 1,
        explanation: tc.explanation || `Test Case`,
        sequence: tc.sequence || 0,
      }));
    } else if (q.sampleInput && q.sampleOutput) {
      testCasesList = [{
        input: q.sampleInput,
        expectedOutput: q.sampleOutput,
        isSample: true,
        isHidden: false,
        points: 1,
        explanation: 'Sample Test Case',
        sequence: 0,
      }];
    }
    
    // If no test cases, create a default one
    if (testCasesList.length === 0) {
      testCasesList = [mkTC(0)];
    }
    
    // Get difficulty
    let difficulty: Diff = 'medium';
    if (q.difficulty) {
      const diffLower = q.difficulty.toLowerCase();
      if (diffLower === 'easy') difficulty = 'easy';
      else if (diffLower === 'hard') difficulty = 'hard';
      else difficulty = 'medium';
    } else if (q.mcqQuestionDifficulty) {
      const diffLower = q.mcqQuestionDifficulty.toLowerCase();
      if (diffLower === 'easy') difficulty = 'easy';
      else if (diffLower === 'hard') difficulty = 'hard';
      else difficulty = 'medium';
    }
    
    // Extract hints
    let hintsList: any[] = [];
    if (q.hints && Array.isArray(q.hints)) {
      hintsList = q.hints;
    } else if (q.hint) {
      hintsList = [{ hintText: q.hint, pointsDeduction: 0, isPublic: true, sequence: 0 }];
    }
    
    // Get score
    let questionScore = 0;
    if (q.score !== undefined && q.score !== null) {
      questionScore = q.score;
    } else if (q.mcqQuestionScore !== undefined && q.mcqQuestionScore !== null) {
      questionScore = q.mcqQuestionScore;
    } else {
      // Try to get from exercise configuration
      if (isGeneral) {
        questionScore = generalMPQ;
      } else if (typeof isScoreEditable === 'function' && isScoreEditable(currentDiff as Diff)) {
        questionScore = 0;
      } else if (typeof getFixedScore === 'function') {
        questionScore = getFixedScore(currentDiff as Diff);
      }
    }
    
    return {
      title: titleText || 'Untitled Programming Question',
      description: descriptionBlocks,
      difficulty: difficulty,
      score: questionScore,
      constraints: constraintsList,
      testCases: testCasesList,
      hints: hintsList,
      timeLimit: q.timeLimit || 2000,
      memoryLimit: q.memoryLimit || 256,
      starterCode: typeof q.starterCode === 'string' ? q.starterCode : '',
      solutionCode: typeof q.solutionCode === 'string' ? q.solutionCode : '',
      codeSetupLanguage: typeof q.codeSetupLanguage === 'string' ? q.codeSetupLanguage : undefined,
      // ── Execution setup — pass through with backward-compat defaults ──
      executionType: (q.executionType === 'function' || q.executionType === 'fullProgram')
        ? q.executionType : 'fullProgram',
      functionContract: q.functionContract && typeof q.functionContract === 'object'
        ? {
            functionName: typeof q.functionContract.functionName === 'string' ? q.functionContract.functionName : '',
            returnType: typeof q.functionContract.returnType === 'string' ? q.functionContract.returnType : 'integer',
            params: Array.isArray(q.functionContract.params)
              ? q.functionContract.params.map((p: any, i: number) => ({
                  id: p?.id || `fp-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`,
                  name: typeof p?.name === 'string' ? p.name : `p${i+1}`,
                  type: typeof p?.type === 'string' ? p.type : 'integer',
                }))
              : [],
          }
        : mkFunctionContract(),
      startingExperience: (q.startingExperience === 'blank' || q.startingExperience === 'generated' || q.startingExperience === 'custom')
        ? q.startingExperience
        : (q.executionType === 'function' ? 'generated' : 'blank'),
    };
  };

  // Auto-distribute marks for question-specific scoring
  const autoScore = (() => {
    if (isGeneral) return undefined;
    if (typeof isScoreEditable === 'function' && !isScoreEditable(currentDiff as Diff)) return undefined;
    if (typeof getRemainingMarksForDiff === 'function') {
      const remainingMarks = getRemainingMarksForDiff(currentDiff as Diff);
      if (remainingMarks > 0 && selected.length > 0) {
        return parseFloat((remainingMarks / selected.length).toFixed(2));
      }
    }
    return undefined;
  })();

  // Add questions from bank
  const newQuestions: FlowQuestion[] = selected.map((q, i) => {
    const base = bankToProgrammingQuestion(q);
    const newId = mkLocalId();
    
    // Calculate score
    let questionScore = base.score;
    if (autoScore !== undefined) {
      questionScore = autoScore;
    } else if (isGeneral) {
      questionScore = generalMPQ;
    } else if (typeof isScoreEditable === 'function' && isScoreEditable(currentDiff as Diff)) {
      questionScore = 0;
    } else if (typeof getFixedScore === 'function') {
      questionScore = getFixedScore(currentDiff as Diff);
    }
    
    const newQ: FlowQuestion = {
      __localId: newId,
      _id: undefined,
      title: base.title || '',
      description: base.description || [mkProgTextBlock()],
      difficulty: base.difficulty || (typeof currentDiff === 'string' ? currentDiff as Diff : 'medium'),
      score: questionScore,
      testCases: base.testCases || [mkTC(0)],
      constraints: base.constraints || [],
      hints: base.hints || [],
      timeLimit: base.timeLimit || 2000,
      memoryLimit: base.memoryLimit || 256,
      questionType: 'programming',
      // Preserve the incoming question's stored source if any, else stamp
      // with the caller-provided tag ('scratch-bank' / 'ai' / …).
      source: (q as any)?.source || tag,
      // Bank imports keep their origin id (the emitted bank row's own _id);
      // AI/doc questions come through here with no id and stay null.
      bankQuestionId: (q as any)?._id || (q as any)?.bankQuestionId || null,
      isSaved: false,
      isDirty: false,
      isPreExisting: false,
      starterCode: (base as any).starterCode || '',
      solutionCode: (base as any).solutionCode || '',
      codeSetupLanguage: (base as any).codeSetupLanguage,
      executionType: (base as any).executionType || 'fullProgram',
      functionContract: (base as any).functionContract || mkFunctionContract(),
      startingExperience: (base as any).startingExperience || 'blank',
    };
    return newQ;
  });

  if (newQuestions.length === 0) {
    toast.warning('No questions to add', 'No valid programming questions were selected.');
    return;
  }

  // Fill the CURRENT blank slot in place when there is one — a difficulty
  // switch materializes an empty slot (e.g. Medium #1), and unconditionally
  // appending put the imported question at #2 while #1 stayed empty forever.
  // Otherwise append and navigate to the FIRST new one. Use the live ref (not
  // the closure's stale `flowQuestions.length`) — the closure-captured value
  // can lag behind a freshly-saved Q on Save & Continue, which would otherwise
  // put currentIndex one slot AHEAD of the first new question and skip it.
  const liveFlow = flowQuestionsRef.current;
  const idxNow = currentIndexRef.current;
  const curSlot = liveFlow[idxNow];
  const curTitle = curSlot ? (Array.isArray(curSlot.title) ? getTitleText(curSlot.title as any) : (curSlot.title || '')) : '';
  const curIsBlank = !!curSlot
    && !(serverIdMap.current.get(curSlot.__localId) || curSlot._id || curSlot.isSaved || curSlot.isPreExisting)
    && !curTitle.toString().trim()
    && !(curSlot as any).source;
  const fillInPlace = curIsBlank && (isGeneral || newQuestions[0].difficulty === curSlot.difficulty);
  const merged = fillInPlace
    ? [...liveFlow.slice(0, idxNow), newQuestions[0], ...newQuestions.slice(1), ...liveFlow.slice(idxNow + 1)]
    : [...liveFlow, ...newQuestions];
  flowQuestionsRef.current = merged;
  setFlowQuestions(merged);
  sourceModalAddedRef.current = true;

  const newStartIndex = fillInPlace ? idxNow : liveFlow.length; // position of the FIRST new question
  currentIndexRef.current = newStartIndex;
  setCurrentIndex(newStartIndex);

  // Load the first new question into the form
  if (newQuestions[0]) {
    setTimeout(() => {
      loadQuestionIntoForm(newQuestions[0]);
    }, 100);
  }

  toast.success(`${newQuestions.length} programming question${newQuestions.length > 1 ? 's' : ''} added from bank`);
  
  if (autoScore !== undefined && autoScore > 0) {
    toast.info('Marks distributed', `Each question assigned ${autoScore} mark${autoScore !== 1 ? 's' : ''} from remaining balance.`);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentDiff, isGeneral, isScoreEditable, getFixedScore, getRemainingMarksForDiff, generalMPQ, flowQuestions.length, loadQuestionIntoForm]);

  // ─── UPLOAD VIA DOCUMENT (.txt) ──────────────────────────────────────────────
  // Programming docs carry test cases / constraints (not A–D options). Parsed
  // questions are routed through the SAME inject path the Bank + AI use, so they
  // land in the flow with their test cases by difficulty.
  const docInputRef = useRef<HTMLInputElement>(null);
  // Parsed doc questions awaiting the trainer's quota-capped selection — the
  // DocQuestionPicker sits between parse and inject so a doc with more
  // questions than open Manual slots can't flood the flow.
  const [docPickerQs, setDocPickerQs] = useState<any[] | null>(null);
  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseProgrammingFile(file);
      if (!parsed.length) {
        toast.warning('No questions found', 'Could not parse any questions — check the .txt format (Title:, Description:, Difficulty:, Input:/Output:).');
        return;
      }
      setDocPickerQs(parsed.map((q, i) => ({ ...q, _previewId: `doc-${i}` })));
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Could not read the file.');
    }
  };

  // Pre-load bank questions handed in from the Question Bank selector (run once on open).
  const bankPreloadedRef = useRef(false);
  useEffect(() => {
    if (!bankPreloadedRef.current && initialBankQuestions && initialBankQuestions.length > 0) {
      bankPreloadedRef.current = true;
      // Stamp with the caller's tag — Other Platform imports carry 'thirdParty'.
      handleBankSelectedQuestions(initialBankQuestions, initialBankSource || 'scratch-bank');
    }
  }, [initialBankQuestions, initialBankSource, handleBankSelectedQuestions]);
  


const executeSave = async (localId: string, payload: any, isSaveAndNext: boolean): Promise<string | undefined> => {
    const flow = flowQuestionsRef.current; const currentQ = flow.find(q => q.__localId === localId);
    const serverId = serverIdMap.current.get(localId) || currentQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);
    const result = await onSave({ ...payload, __saveAndNext: isSaveAndNext, __isUpdate: !!serverId, __questionId: serverId, __editLocalId: localId });
    const savedId = result?._id || result?.data?._id || result?.questionId || result?.data?.questionId || serverId;
    if (savedId) registerSavedId(localId, savedId);
    // Update flow question with saved data so navigating back (Previous) shows updated content
    const updatedFlow = flowQuestionsRef.current.map(q =>
      q.__localId === localId
        ? { ...q, ...payload, _id: savedId || q._id, isSaved: true, isDirty: false, isPreExisting: true }
        : q
    );
    flowQuestionsRef.current = updatedFlow;
    setFlowQuestions(updatedFlow);
    return savedId;
  };

  const ensureCurrentInFlow = (): string => {
    let currentQ = flowQuestionsRef.current[currentIndexRef.current]; if (currentQ) return currentQ.__localId;
    const newQ: FlowQuestion = {
      __localId: mkLocalId(), _id: undefined, title: getTitleText(titleBlocks) || '', description: descBlocks,
      difficulty: isGeneral ? 'medium' : currentDiff, score: isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff),
      testCases: tcs.map((tc, i) => ({ input: tc.input, expectedOutput: tc.expectedOutput, isSample: tc.isSample, isHidden: tc.isHidden, points: 1, explanation: tc.description || `Test Case ${i + 1}`, sequence: i })),
      constraints: constraints.filter(c => c.trim()),
      hints: hint.trim() ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }, ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))] : extraHints.map((h, i) => ({ ...h, sequence: i })),
      timeLimit, memoryLimit: memLimit, questionType: 'programming', isSaved: false, isDirty: false, isPreExisting: false,
    };
    const newFlow = [...flowQuestionsRef.current, newQ]; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const newIdx = newFlow.length - 1; currentIndexRef.current = newIdx; setCurrentIndex(newIdx);
    return newQ.__localId;
  };

  const handleSave = async () => {
    const { valid, errors } = validate();
    if (!valid) { scrollToFirstError(errors); return; }
    const localId = ensureCurrentInFlow(); const latestQ = flowQuestionsRef.current[currentIndexRef.current];
    const serverId = serverIdMap.current.get(localId) || latestQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);
    if (serverId && !hasUnsavedFormChanges) { return; }
    // ⚡ Cell-level Manual gate — a brand-new manually-authored question may
    // only save into a cell whose Manual (scratch) slice still has room. The
    // blank editor stays mounted under a re-popped source picker, so without
    // this the teacher could type past the quota and only find out from the
    // server's 400. Staged bank/AI/doc imports carry a source tag and already
    // hold a picker-capped review slot — they pass untouched.
    if (!serverId && srcOfTag((latestQ as any)?.source) === 'unknown') {
      const dGate: Diff = isGeneral ? 'medium' : (((latestQ?.difficulty) as Diff) || currentDiff);
      if (!allowedSources.manual || getSourceRemaining('scratch', dGate, localId) <= 0) {
        const dl = isGeneral ? '' : `${dGate.charAt(0).toUpperCase()}${dGate.slice(1)} `;
        toast.error(`${dl}Manual quota is already full — this slot can't take a manually-written question. Fill it from the source picker instead.`, { toastId: 'manual-cell-full' });
        reopenSourceModalForBlankSlot();
        return;
      }
    }
    try { await executeSave(localId, { ...mkPayload(), __preventClose: true }, false); } catch (err) { console.error('handleSave error:', err); return; }
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: Check if the just-saved question completes its difficulty's quota.
  // If yes → show DiffPopup (or close if no other diffs available).
  // Returns true if a popup/close happened (caller should NOT proceed further).
  // ──────────────────────────────────────────────────────────────────────────
  const checkDiffComplete = (savedLocalId: string | undefined): boolean => {
    if (isGeneral) return false;
    const flowNow = flowQuestionsRef.current;
    const idxNow  = currentIndexRef.current;
    const savedQ  = flowNow[idxNow];
    const diff    = (savedQ?.difficulty as Diff | undefined) || currentDiff;
    if (!diff) return false;

    // Count saved/created questions for this difficulty (NOT counting blank Q6-type entries)
    const savedCount = flowNow.filter(q =>
      q.difficulty === diff &&
      !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || (savedLocalId && q.__localId === savedLocalId))
    ).length;
    const quota = getQuotaForDiff(diff);

    if (savedCount < quota) return false;

    // Quota met for this difficulty
    if (isEditing) { onClose(); return true; }

    // Find any OTHER difficulty that still has remaining slots
    const otherDiffs = getConfiguredDiffs().filter(d => {
      if (d === diff) return false;
      const otherSaved = flowNow.filter(q =>
        q.difficulty === d &&
        !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
      ).length;
      return otherSaved < getQuotaForDiff(d);
    });

    if (otherDiffs.length > 0) {
      setCompletedDiff(diff);
      setShowDiffPopup(true);
    } else {
      onClose();
    }
    return true; // popup or close was triggered
  };

  const handleSaveAndContinue = async () => {
    const flow = flowQuestionsRef.current;
    const idx = currentIndexRef.current;
    let currentQ = flow[idx];

    // Case 1: no current question (out-of-bounds index) — typically when initial
    // flow had quota already met and form opened on a blank slot.
    if (!currentQ) {
      if (!isGeneral) {
        const cnt = flow.filter(q => q.difficulty === currentDiff).length;
        if (cnt >= getQuotaForDiff(currentDiff)) {
          // Don't create new — show popup directly
          if (checkDiffComplete(undefined)) return;
          advanceAfterSave(undefined, undefined);
          return;
        }
      }
      const { valid: v0, errors: e0 } = validate();
      if (!v0) { scrollToFirstError(e0); return; }
      const lid = ensureCurrentInFlow();
      currentQ = flowQuestionsRef.current[currentIndexRef.current];
    }

    const latestQ = flowQuestionsRef.current[currentIndexRef.current];
    const localId = latestQ?.__localId ?? currentQ.__localId;
    const serverId = serverIdMap.current.get(localId) || latestQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);

    // Case 2: already saved, no changes — skip executeSave but still check quota
    if (serverId && !isEditMode && !hasUnsavedFormChanges) {
      if (checkDiffComplete(localId)) return;
      advanceAfterSave(serverId, localId);
      return;
    }

    // ⚡ Cell-level Manual gate — same rule as handleSave: a new untagged
    // (manually-authored) question can't bill a cell whose scratch slice is
    // full. `localId` is excluded from the staged tally so the question being
    // saved never blocks itself.
    if (!serverId && srcOfTag((latestQ as any)?.source) === 'unknown') {
      const dGate: Diff = isGeneral ? 'medium' : (((latestQ?.difficulty) as Diff) || currentDiff);
      if (!allowedSources.manual || getSourceRemaining('scratch', dGate, localId) <= 0) {
        const dl = isGeneral ? '' : `${dGate.charAt(0).toUpperCase()}${dGate.slice(1)} `;
        toast.error(`${dl}Manual quota is already full — this slot can't take a manually-written question. Fill it from the source picker instead.`, { toastId: 'manual-cell-full' });
        reopenSourceModalForBlankSlot();
        return;
      }
    }

    // Case 3: validate + save
    const { valid, errors } = validate();
    if (!valid) { scrollToFirstError(errors); return; }

    let savedId: string | undefined;
    try {
      savedId = await executeSave(localId, mkPayload(), true);
    } catch (err) {
      console.error('handleSaveAndContinue error:', err);
      return;
    }

    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
    setIsEditMode(false);

    // ⚡ HARD QUOTA GUARD: check immediately after save
    if (checkDiffComplete(localId)) return;

    advanceAfterSave(savedId, localId);

    // When the caller set autoOpenSource (e.g. AI-alone exercise), the teacher
    // should keep landing on the SAME source modal after every save — but ONLY
    // when the advance landed on a fresh BLANK slot. If it landed on an
    // already-staged question (e.g. the 2nd of a generated batch awaiting
    // review) or the difficulty-handover popup took over, the teacher keeps
    // reviewing; the modal returns when an empty slot opens up.
    if (!landedOnBlankSlot()) return;
    reopenSourceModalForBlankSlot();
  };

  // True when the editor's current slot is a blank placeholder (no title yet).
  // The only state in which the auto-open source modal should (re)appear.
  const landedOnBlankSlot = () => {
    const q = flowQuestionsRef.current[currentIndexRef.current];
    if (!q) return true;
    const t = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
    return !t.toString().trim();
  };

  // The blank slot the teacher lands on has a FIXED difficulty, so a source
  // must have room in THAT CELL — not merely somewhere in the matrix. With
  // Easy Manual 1/1 and Medium/Hard still open, the summed total read
  // "2 remaining" and dropped the teacher onto a second Easy manual slot the
  // configuration never allowed. Shared by the Save-&-Next re-pop and both
  // source-modal onClose handlers.
  const blankSlotDiff = (): Diff | null => {
    const q = flowQuestionsRef.current[currentIndexRef.current];
    // No flow entry = the VIRTUAL blank slot (mount lands one past the array;
    // the FlowQuestion only materializes at save time) — its difficulty is
    // whatever currentDiff was seeded to, not "unknown".
    const d = (q?.difficulty || currentDiff || '').toString().toLowerCase();
    return d === 'easy' || d === 'medium' || d === 'hard' ? (d as Diff) : null;
  };
  const srcHasRoomHere = (src: 'scratch' | 'ai' | 'thirdParty') => {
    if (isGeneral) return getSourceRemainingTotal(src) > 0;
    const d = blankSlotDiff();
    return d
      ? getSourceRemaining(src, d) > 0
      : getConfiguredDiffs().some(x => getSourceRemaining(src, x) > 0);
  };
  const manualHasRoomHere = () => allowedSources.manual && srcHasRoomHere('scratch');

  // Route the teacher after landing on a blank slot — shared by Save & Continue
  // and the difficulty-switch popup. The configuration decides the landing:
  //   manual fits this cell           → blank editor (type away, Save & Next)
  //   one other source fits           → that source's modal, directly
  //   several fit / teacher dismissed → the "+" add-source dropdown (the
  //                                     existing chooser — never a dead editor)
  //   nothing fits this cell          → stay put (review state; other cells are
  //                                     reachable via the difficulty switch)
  const reopenSourceModalForBlankSlot = () => {
    if (isEditing) return;

    // Intentional close wins over every other reason to reopen. If the user
    // clicked X / Cancel / Escape / backdrop, the modal must NOT come back
    // by itself — they get to return to Choose Source and pick differently.
    // The flag is single-shot: we clear it here so a legitimate re-entry
    // (a Save & Continue landing, a difficulty change, etc.) is unaffected.
    if (intentionalCloseRef.current) {
      intentionalCloseRef.current = false;
      return;
    }

    // The teacher explicitly dismissed the picker for THIS slot. The re-pop
    // rule below ("its modal IS the flow") is meant to stop someone drifting
    // into a dead editor by accident — it is not meant to trap them: without
    // this check an explicit close re-opens instantly and the modal cannot be
    // escaped at all. The flag is cleared on every slot / difficulty change,
    // so the guidance returns the moment they move on.
    if (autoReopenSuppressedRef.current) return;

    // Manual can still take a question in this very cell — the blank editor is
    // the correct landing, no modal on top of it.
    if (manualHasRoomHere()) return;

    // Bank picks bill the scratch slice, so when scratch's cell is full the
    // bank can't fill this cell either — only AI / Other Platform remain.
    const usable: Array<'ai' | 'thirdParty'> = [];
    if (allowedSources.ai && srcHasRoomHere('ai')) usable.push('ai');
    if (allowedSources.thirdParty && srcHasRoomHere('thirdParty')) usable.push('thirdParty');
    const d = blankSlotDiff();
    const dl = d ? `${d.charAt(0).toUpperCase()}${d.slice(1)} ` : '';
    if (usable.length === 0) {
      toast.warning(`${dl}slots are fully allocated — switch difficulty or finish the exercise.`, { toastId: 'slot-src-repop' });
      return;
    }

    // Single legal source → its modal IS the flow: it returns on every dismiss
    // (with the toast spelling out why) until the slot is filled — trainer's
    // rule; dismiss-suppression deliberately does NOT apply here, a dead
    // editor would be worse. Several usable → the dropdown chooser.
    const preferred: 'ai' | 'thirdParty' | null =
      autoOpenSource === 'ai' && usable.includes('ai') ? 'ai'
      : autoOpenSource === 'thirdParty' && usable.includes('thirdParty') ? 'thirdParty'
      : usable.length === 1 ? usable[0]
      : null;

    if (!preferred) {
      toast.warning(`${dl}Manual questions are full — pick one of the remaining sources to fill this slot.`, { toastId: 'slot-src-repop' });
      setShowAddDropdown(true);
      return;
    }
    toast.warning(
      `${dl}Manual questions are full — this slot must be filled from ${preferred === 'ai' ? 'AI Automation' : 'Other Platform'}. The picker will reopen until it's filled.`,
      { toastId: 'slot-src-repop' },
    );

    pendingSourceRef.current = preferred === 'ai' ? 'ai' : 'thirdParty';
    sourceModalAutoOpenedRef.current = true;
    // Defer to next tick so the advance's state updates settle first
    // (otherwise the modal opens against a stale currentIndex).
    if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
    reopenTimerRef.current = setTimeout(() => {
      reopenTimerRef.current = null;
      if (preferred === 'ai') setShowAIModal(true);
      else setShowBankSelector(true);
    }, 0);
  };

  // Mount landing: the initial blank slot may be VIRTUAL (opened straight onto
  // a difficulty whose Manual cell is already full) — route it exactly like a
  // Save-&-Next landing. Pure auto-open flows keep their own mount effect;
  // reopen no-ops when manual legitimately has room, so normal manual
  // authoring is untouched.
  useEffect(() => {
    if (isEditing) return;
    if (autoOpenSource && autoOpenSource !== 'manual') return; // their effect owns the mount
    if (!landedOnBlankSlot()) return;
    reopenSourceModalForBlankSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceAfterSave = (savedId: string | undefined, savedLocalId?: string) => {
    const flow = flowQuestionsRef.current;
    const idx  = currentIndexRef.current;

    // Moving to a different slot ends the dismissal: the teacher opted out of
    // the picker for the slot they were ON, not for the rest of the exercise.
    autoReopenSuppressedRef.current = false;

    // Handle Previous → Return-to-original-position case
    if (returnIndexRef.current !== null) {
      const returnIdx = returnIndexRef.current;
      const returnDiff = returnDiffRef.current;
      returnIndexRef.current = null;
      returnDiffRef.current = null;
      if (returnDiff && !isGeneral) setCurrentDiff(returnDiff);
      if (returnIdx < flow.length) {
        setCurrentIndex(returnIdx); currentIndexRef.current = returnIdx;
        loadQuestionIntoForm(flow[returnIdx]);
        if (!isGeneral && flow[returnIdx]?.difficulty) setCurrentDiff(flow[returnIdx].difficulty as Diff);
        setTimeout(() => titleRef.current?.focus(), 80);
        return;
      }
    }

    // ── PRIORITY: completed-current-difficulty handover ─────────────────────
    // If the question we just saved was the LAST open slot for its difficulty
    // AND any OTHER configured difficulty still has open slots, show the
    // DifficultyPopup so the teacher chooses where to continue. This prevents
    // the previous flat "go to nextIdx in flow" behaviour, which would silently
    // jump backward from Medium 2/2 to an empty Easy 4 slot.
    // Within the same difficulty (e.g. Medium 1 → Medium 2), this check
    // doesn't fire — the quota isn't met yet, so the form continues to the
    // next medium slot naturally.
    if (!isGeneral && !isEditing) {
      const savedQ_priority = flow[idx];
      const justDiff = (savedQ_priority?.difficulty as Diff | undefined) || currentDiff;
      if (justDiff) {
        const savedCountForJustDiff = flow.filter(q =>
          q.difficulty === justDiff &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
        ).length;
        if (savedCountForJustDiff >= getQuotaForDiff(justDiff)) {
          const otherDiffsWithOpenSlots = getConfiguredDiffs().filter(d => {
            if (d === justDiff) return false;
            const c = flow.filter(q =>
              q.difficulty === d &&
              !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
            ).length;
            return c < getQuotaForDiff(d);
          });
          if (otherDiffsWithOpenSlots.length > 0) {
            setCompletedDiff(justDiff);
            setShowDiffPopup(true);
            return;
          }
          // else: all other diffs are also full — fall through to the existing
          //       "everything done → onClose" path below.
        }
      }
    }

    // Try to navigate to the next slot in the flow (if it exists and quota allows)
    const nextIdx = idx + 1;
    if (nextIdx < flow.length) {
      const nextQ = flow[nextIdx];
      const nextDiff = nextQ?.difficulty as Diff | undefined;
      if (!isGeneral && nextDiff) {
        // Count actually-saved questions for nextDiff (not blank slots)
        const savedCountForNextDiff = flow.filter(q =>
          q.difficulty === nextDiff &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
        ).length;
        const quotaForNextDiff = getQuotaForDiff(nextDiff);
        if (savedCountForNextDiff < quotaForNextDiff) {
          setCurrentIndex(nextIdx); currentIndexRef.current = nextIdx;
          setCurrentDiff(nextDiff); loadQuestionIntoForm(nextQ);
          setTimeout(() => titleRef.current?.focus(), 80);
          return;
        }
        // else: quota met for nextDiff → fall through to popup logic
      } else {
        setCurrentIndex(nextIdx); currentIndexRef.current = nextIdx;
        if (!isGeneral && nextDiff) setCurrentDiff(nextDiff);
        loadQuestionIntoForm(nextQ);
        setTimeout(() => titleRef.current?.focus(), 80);
        return;
      }
    }

    if (isEditing) { onClose(); return; }

    if (isGeneral) {
      if (getRemainingSlots(undefined, flow) > 0) {
        const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: 'medium', score: generalMPQ, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
        const newFlow = [...flow, newQ]; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
        setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
        resetForm(generalMPQ);
        setTimeout(() => titleRef.current?.focus(), 80);
      } else {
        onClose();
      }
      return;
    }

    // Level-based / selection-level: decide between creating new Q or showing popup
    const savedQ_inAdv = flow[idx];
    const diffToUse = (savedQ_inAdv?.difficulty as Diff | undefined) || currentDiff;

    // Count SAVED questions for this difficulty (don't include blank Q6 entries)
    const savedCountForDiff = flow.filter(q =>
      q.difficulty === diffToUse &&
      !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
    ).length;
    const diffQuota = getQuotaForDiff(diffToUse);

    if (savedCountForDiff < diffQuota) {
      // Still room → create the next blank question for this difficulty
      const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: diffToUse, score: isScoreEditable(diffToUse) ? 0 : getFixedScore(diffToUse), testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
      const newFlow = [...flow, newQ];
      flowQuestionsRef.current = newFlow;
      setFlowQuestions(newFlow);
      setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
      resetForm(isScoreEditable(diffToUse) ? 0 : getFixedScore(diffToUse));
      setTimeout(() => titleRef.current?.focus(), 80);
    } else {
      // Quota met → show DiffPopup if other diffs have remaining slots, else close
      const otherDiffs = getConfiguredDiffs().filter(d => {
        if (d === diffToUse) return false;
        const otherSavedCount = flow.filter(q =>
          q.difficulty === d &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
        ).length;
        return otherSavedCount < getQuotaForDiff(d);
      });
      if (otherDiffs.length > 0) {
        setCompletedDiff(diffToUse);
        setShowDiffPopup(true);
      } else {
        onClose();
      }
    }
  };

  const handleJumpTo = (idx: number) => {
    const curIdx = currentIndexRef.current; const flow = flowQuestionsRef.current;
    returnIndexRef.current = curIdx; returnDiffRef.current = currentDiff;
    const snap = snapshotForm({ isSaved: flow[curIdx]?.isSaved || false, _id: getServerId(flow[curIdx]), isDirty: true, isPreExisting: flow[curIdx]?.isPreExisting });
    const newFlow = [...flow]; newFlow[curIdx] = snap; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const targetQ = newFlow[idx]; if (targetQ?.difficulty && !isGeneral) setCurrentDiff(targetQ.difficulty as Diff);
    currentIndexRef.current = idx; setCurrentIndex(idx); loadQuestionIntoForm(newFlow[idx]); setTimeout(() => titleRef.current?.focus(), 80);
  };

  const handleDiffSelect = (d: Diff) => {
    setShowDiffPopup(false); setCurrentDiff(d);
    const alreadyInFlow = flowQuestionsRef.current.some(q => q.difficulty === d);
    let questionsToAdd: FlowQuestion[] = [];
    if (!alreadyInFlow) { const dbQs = getDbQuestionsForDiff(d); questionsToAdd = dbQs.map(dbQuestionToFlow); questionsToAdd.forEach(q => { if (q._id) serverIdMap.current.set(q.__localId, q._id); }); }
    const flowWithDb = [...flowQuestionsRef.current, ...questionsToAdd];
    const remainingAfterLoad = getRemainingSlots(d, flowWithDb);
    if (remainingAfterLoad <= 0) {
      flowQuestionsRef.current = flowWithDb; setFlowQuestions(flowWithDb);
      // Navigate to the last question of difficulty d specifically
      const dIndices = flowWithDb.reduce<number[]>((acc, q, i) => { if (q.difficulty === d) acc.push(i); return acc; }, []);
      const lastDIdx = dIndices.length > 0 ? dIndices[dIndices.length - 1] : flowWithDb.length - 1;
      currentIndexRef.current = lastDIdx; setCurrentIndex(lastDIdx); setCurrentDiff(d);
      if (flowWithDb[lastDIdx]) loadQuestionIntoForm(flowWithDb[lastDIdx]); setTimeout(() => titleRef.current?.focus(), 80); return;
    }
    const defaultScore = isScoreEditable(d) ? 0 : getFixedScore(d);
    // Look for an unsaved slot for this difficulty. Two cases:
    //   • CONTENT slot — a bank / AI / third-party pick that was injected into
    //     the flow (via handleBankSelectedQuestions) but never saved. Has a
    //     title / description / test cases already populated. Must be LOADED
    //     into the form so the teacher sees what they picked — the previous
    //     code called resetForm() here, wiping the pick from the visible form
    //     and effectively discarding it on the next save.
    //   • BLANK slot — created by Save & Next when the next quota position is
    //     opened as an empty scaffold. resetForm() is correct for these.
    // Prefer the CONTENT slot so bank picks always surface first; only fall
    // back to a blank slot if there's no pending pick to review.
    const hasContent = (q: FlowQuestion): boolean => {
      const t = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
      if (t.toString().trim()) return true;
      const src = (q.source ?? '').toString();
      // Any explicit non-manual source tag means this slot came from a picker.
      return src === 'ai' || src.startsWith('scratch-bank') || src.startsWith('thirdParty');
    };
    const isUnsavedSlot = (q: FlowQuestion) =>
      q.difficulty === d && !q.isSaved && !q._id && !serverIdMap.current.get(q.__localId);
    const contentIdx = flowWithDb.findIndex(q => isUnsavedSlot(q) && hasContent(q));
    const blankIdx = contentIdx < 0
      ? flowWithDb.findIndex(q => isUnsavedSlot(q) && !hasContent(q))
      : -1;
    const existingIdx = contentIdx >= 0 ? contentIdx : blankIdx;
    if (existingIdx >= 0) {
      flowQuestionsRef.current = flowWithDb; setFlowQuestions(flowWithDb);
      currentIndexRef.current = existingIdx; setCurrentIndex(existingIdx); setCurrentDiff(d);
      if (contentIdx >= 0) {
        // Bank/AI/third-party pick waiting to be reviewed — show its content.
        loadQuestionIntoForm(flowWithDb[existingIdx]);
      } else {
        resetForm(defaultScore);
      }
      setTimeout(() => titleRef.current?.focus(), 80);
      // Only offer the source modal when the slot is genuinely empty — a
      // content slot IS the source's contribution, nothing more to fetch.
      if (contentIdx < 0 && landedOnBlankSlot()) reopenSourceModalForBlankSlot();
      return;
    }
    const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: d, score: defaultScore, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
    const newFlow2 = [...flowWithDb, newQ]; flowQuestionsRef.current = newFlow2; setFlowQuestions(newFlow2);
    const newIdx2 = newFlow2.length - 1; currentIndexRef.current = newIdx2; setCurrentIndex(newIdx2); setCurrentDiff(d);
    resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80);
    if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
  };

  const validate = (): { valid: boolean; errors: Record<string, string> } => {
    const e: Record<string, string> = {};
    // Link mode: the URL is the whole question — nothing else is required.
    if (isLinkQuestion) {
      if (!/^https?:\/\/\S+$/i.test(questionLink.trim())) e.questionLink = 'Paste a valid http(s) link';
      return { valid: Object.keys(e).length === 0, errors: e };
    }
    const titleText = getTitleText(titleBlocks);
    if (!titleText && !titleBlocks.some(b => b.type === 'image' || b.type === 'code')) e.title = 'Title is required';
    const descText = descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    if (!descText && !descBlocks.some(b => b.type === 'image' || b.type === 'code')) e.description = 'Description is required';
    // Solution code is optional at save-time — the evaluator (testcase/manual/AI)
    // handles its absence at runtime. Run Test Cases still blocks at click-time
    // if solution is empty (operational precondition, not a save-time rule).
    //
    // Starter code is required ONLY in 'custom' starter mode where the trainer
    // opted to write their own template. 'blank' is intentionally empty and
    // 'generated' auto-populates from the language, so neither needs a check.
    if (startingExperience === 'custom' && isStringSolutionEmpty(starterCode)) {
      e.starterCode = 'Starter code is required in Custom starter mode';
    }
    if (!constraints.some(c => c.trim())) e.constraints = 'At least one constraint is required';
    if (executionType === 'function') {
      if (!functionContract.functionName.trim()) e.functionName = 'Function name is required';
      // Function-mode test cases must supply an expected return; parameter
      // input fields are allowed to be empty (represents the default value).
      const hasValidFnTc = tcs.some(tc => (tc.expectedOutput || '').toString().trim() || Object.values(tc.functionInputs || {}).some(v => (v || '').toString().trim()));
      if (!hasValidFnTc) e.testcases = 'At least one function test case with an expected return is required';
    } else {
      if (!tcs.some(tc => tc.input.trim() && tc.expectedOutput.trim())) e.testcases = 'At least one test case with input & output is required';
    }
    const currentQ = flowQuestions[currentIndex]; const dbQsForDiff = getDbQuestionsForDiff(currentDiff);
    if (!isGeneral && isScoreEditable(currentDiff)) {
      const sType = getScoringType(currentDiff);
      if (sType === 'question_specific') {
        const totalAllowed = getTotalMarksForDiff(currentDiff); const existingServerId = getServerId(currentQ);
        const isEditingExist = !!(existingServerId || isEditing);
        const totalQuestionsForDiff = getQuotaForDiff(currentDiff);
        if (isEditingExist && existingServerId) {
          const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
          const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
          // Reserve 1 mark for each remaining question that hasn't been created yet
          const questionsWithMarks = otherQs.length + 1; // other saved + this one
          const futureQuestions = Math.max(0, totalQuestionsForDiff - questionsWithMarks);
          const rawMax = totalAllowed - otherSum - futureQuestions;
          const maxForThis = rawMax > 0 ? Math.max(1, rawMax) : 0;
          if (score > maxForThis + 0.01) e.score = `Max for this question: ${fmtMark(maxForThis)} (reserving 1 mark each for ${futureQuestions} remaining question${futureQuestions !== 1 ? 's' : ''})`;
        } else {
          const used = getDbMarksUsedForDiff(currentDiff);
          const createdSoFar = getCreatedCount(currentDiff);
          // Reserve 1 mark for each remaining question after this one
          const futureQuestions = Math.max(0, totalQuestionsForDiff - createdSoFar - 1);
          const rawMax2 = totalAllowed - used - futureQuestions;
          const maxForThis = rawMax2 > 0 ? Math.max(1, rawMax2) : 0;
          if (score > maxForThis + 0.01) e.score = `Max for this question: ${fmtMark(maxForThis)} (reserving 1 mark each for ${futureQuestions} remaining question${futureQuestions !== 1 ? 's' : ''})`;
        }
        if (!e.score && score <= 0) e.score = 'Score must be greater than 0';
      }
    }
    // ── Per-question AI test case count — required in perQuestion mode ────
    // Legacy questions with null are OK on read (resolver falls back to the
    // exercise's count) but a trainer saving in perQuestion mode must set it.
    // Zero is allowed and means "skip AI generation, only judge the question's
    // own testCases" — same semantics as the exercise-level 0.
    const exEvm: any = exerciseData?.fullExerciseData?.evaluationMethod;
    const perQuestionMode = exEvm?.method === 'ai' && exEvm?.ai?.testCasesCountMode === 'perQuestion';
    if (perQuestionMode) {
      if (aiTestCasesCount === null || aiTestCasesCount === undefined || Number.isNaN(aiTestCasesCount)) {
        e.aiTestCasesCount = 'AI test case count is required';
      } else if (aiTestCasesCount < 0 || aiTestCasesCount > 50) {
        e.aiTestCasesCount = 'AI test case count must be between 0 and 50';
      }
    }
    setErrs(e); setTouched(new Set(Object.keys(e))); return { valid: Object.keys(e).length === 0, errors: e };
  };

  const handleScoreBlur = () => {
    if (!isScoreEditable(currentDiff) || isGeneral) return;
    if (getScoringType(currentDiff) !== 'question_specific') return;
    const totalAllowed = getTotalMarksForDiff(currentDiff); const currentQ = flowQuestions[currentIndex];
    const existingServerId = getServerId(currentQ); const isEditExist = isEditing || !!existingServerId;
    const dbQsForDiff = getDbQuestionsForDiff(currentDiff); const tempErrors: Record<string, string> = {};
    const totalQuestionsForDiff = getQuotaForDiff(currentDiff);
    if (isEditExist && existingServerId) {
      const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
      const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
      const questionsWithMarks = otherQs.length + 1;
      const futureQuestions = Math.max(0, totalQuestionsForDiff - questionsWithMarks);
      const rawBlur1 = totalAllowed - otherSum - futureQuestions;
      const maxForThis = rawBlur1 > 0 ? Math.max(1, rawBlur1) : 0;
      if (score > maxForThis + 0.01) tempErrors.score = `Max allowed: ${fmtMark(maxForThis)} marks (reserving 1 each for ${futureQuestions} remaining)`;
    } else {
      const used = getDbMarksUsedForDiff(currentDiff);
      const createdSoFar = getCreatedCount(currentDiff);
      const futureQuestions = Math.max(0, totalQuestionsForDiff - createdSoFar - 1);
      const rawBlur2 = totalAllowed - used - futureQuestions;
      const maxForThis = rawBlur2 > 0 ? Math.max(1, rawBlur2) : 0;
      if (score > maxForThis + 0.01) tempErrors.score = `Max allowed: ${fmtMark(maxForThis)} marks (reserving 1 each for ${futureQuestions} remaining)`;
    }
    if (score <= 0 && !tempErrors.score) tempErrors.score = 'Score must be > 0';
    if (tempErrors.score) { setErrs(p => ({ ...p, score: tempErrors.score })); setTouched(p => new Set(p).add('score')); }
    else { setErrs(p => { const n = { ...p }; delete n.score; return n; }); }
  };

  const availableNextDiffs = useMemo((): { diff: Diff; remaining: number }[] => {
    if (isGeneral) return [];
    return getConfiguredDiffs().filter(d => d !== currentDiff && getRemainingSlots(d) > 0).map(d => ({ diff: d, remaining: getRemainingSlots(d) }));
  }, [currentDiff, getConfiguredDiffs, getRemainingSlots, isGeneral]);

  const s = DS[currentDiff] || DS.medium;
  const currentQ = flowQuestions[currentIndex];
  const isEditingExistingQ = !!(getServerId(currentQ)) || isEditing;
  const isCurrentPreExisting = !!(currentQ?.isPreExisting || (getServerId(currentQ)));
  const isFormDisabled = false; // Temporarily set to false to test typing

  const dbQsAll = getDbQuestionsForDiff();
  const totalSlots = isGeneral ? generalQuestionCount : getQuotaForDiff(currentDiff);
  const createdCount = getCreatedCount(isGeneral ? undefined : currentDiff);
  const remainingSlots = isGeneral ? getRemainingSlots() : getRemainingSlots(currentDiff);

  // ── Overall Questions (all difficulties combined) ──────────────────────────
  const totalSlotsAll = isGeneral
    ? generalQuestionCount
    : getConfiguredDiffs().reduce((s, d) => s + getQuotaForDiff(d), 0);
  const createdCountAll = isGeneral
    ? getCreatedCount()
    : getConfiguredDiffs().reduce((s, d) => s + getCreatedCount(d), 0);
  const remainingSlotsAll = Math.max(0, totalSlotsAll - createdCountAll);

  // Last question = once THIS slot is filled, no free slot remains anywhere.
  // Counted from real occupancy (saved + content-bearing entries), NOT from
  // currentIndex — pure index math broke whenever the flow carried a blank
  // placeholder or DB/staged entries interleaved out of quota order, flipping
  // Save & Continue / Save & Finish at the wrong moments.
  const isLastQuestion = useMemo((): boolean => {
    if (totalSlotsAll <= 0) return currentIndex >= flowQuestions.length - 1;
    const cur = flowQuestions[currentIndex];
    const t = cur ? (Array.isArray(cur.title) ? getTitleText(cur.title as any) : (cur.title || '')) : '';
    const curOccupies = !!cur && (
      !!(cur._id || cur.isSaved || cur.isPreExisting || serverIdMap.current.get(cur.__localId))
      || !!t.toString().trim()
    );
    const free = isGeneral
      ? Math.max(0, getRemainingSlots() - getStagedCount('medium' as Diff))
      : getConfiguredDiffs().reduce((s, d) => s + Math.max(0, getRemainingSlots(d) - getStagedCount(d)), 0);
    // Blank current slot: it is itself one of the free slots — last when it's
    // the only one. Occupied current slot: last when nothing else is free.
    return curOccupies ? free <= 0 : free <= 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, totalSlotsAll, flowQuestions, isGeneral, currentDiff]);

  // Continuous global question number across all difficulties (easy→medium→hard).
  // In level mode this is the position WITHIN the current difficulty so e.g. the
  // second medium question shows "2" not "3" (its global flow index would be 3
  // if Easy 1+2 sit before it).
  const globalQuestionNumber = useMemo((): number => {
    if (isGeneral) return currentIndex + 1;

    // Normalise difficulty comparisons — bank/AI questions sometimes arrive
    // with "Medium" or "MEDIUM" casing that wouldn't match the lowercase
    // currentDiff state, which would silently fall to the +1 branch and over-count.
    const normDiff = (d: any): string => String(d || 'medium').toLowerCase();
    const cur = normDiff(currentDiff);
    const dQuestions = flowQuestions.filter(q => normDiff(q.difficulty) === cur);
    const currentQ = flowQuestions[currentIndex];
    if (currentQ) {
      const posInDiff = dQuestions.findIndex(q => q.__localId === currentQ.__localId);
      if (posInDiff !== -1) return posInDiff + 1;
    }
    // Current index is past the end of the flow (new blank question being added)
    // → it's the slot after the last one of this difficulty.
    return dQuestions.length + 1;
  }, [isGeneral, currentDiff, currentIndex, flowQuestions]);

  const totalMarksForDiff = isGeneral ? 0 : getTotalMarksForDiff(currentDiff);
  const usedMarks = isGeneral ? 0 : getDbMarksUsedForDiff(currentDiff);
  const remainingMarks = isGeneral ? 0 : getRemainingMarksForDiff(currentDiff);
  const totalMarksAll = exerciseData.fullExerciseData?.exerciseInformation?.totalMarksProgramming > 0
    ? exerciseData.fullExerciseData.exerciseInformation.totalMarksProgramming
    : exerciseData.fullExerciseData?.exerciseInformation?.totalMarks || 0;
  const usedMarksAll = isGeneral ? 0 : getConfiguredDiffs().reduce((acc, d) => acc + getDbMarksUsedForDiff(d), 0);
  const scoringType = isGeneral ? 'fixed' : getScoringType(currentDiff);
  const displayScore = isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);

  // Max assignable marks for the current question (question_specific mode) — reserves 1 mark per future question
  const maxAssignableForCurrentQ = useMemo((): number | null => {
    if (isGeneral || !isScoreEditable(currentDiff)) return null;
    const totalAllowed = getTotalMarksForDiff(currentDiff);
    const totalQForDiff = getQuotaForDiff(currentDiff);
    const currentQ = flowQuestions[currentIndex];
    const existingServerId = getServerId(currentQ);
    const dbQsForDiff = getDbQuestionsForDiff(currentDiff);
    if (existingServerId) {
      const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
      const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
      const futureQs = Math.max(0, totalQForDiff - otherQs.length - 1);
      const raw1 = totalAllowed - otherSum - futureQs;
      return raw1 > 0 ? Math.max(1, raw1) : 0;
    }
    const used = getDbMarksUsedForDiff(currentDiff);
    const created = getCreatedCount(currentDiff);
    const futureQs = Math.max(0, totalQForDiff - created - 1);
    const raw2 = totalAllowed - used - futureQs;
    return raw2 > 0 ? Math.max(1, raw2) : 0;
  }, [isGeneral, currentDiff, currentIndex, flowQuestions, isScoreEditable, getTotalMarksForDiff, getQuotaForDiff, getServerId, getDbQuestionsForDiff, getDbMarksUsedForDiff, getCreatedCount]);

  const hierarchyData = exerciseData.fullExerciseData?.hierarchyData || {};
  const subcategory = exerciseData.subcategory;
  const subcategoryLabel = exerciseData.subcategoryLabel;
  const exerciseName = exerciseData.exerciseName || exerciseData.fullExerciseData?.exerciseInformation?.exerciseName || '';
  const actionLabel = 'Add Question';
  const questionLabel = isEditing ? '' : getServerId(flowQuestions[currentIndex]) ? `Q#${globalQuestionNumber}` : `Question #${globalQuestionNumber}`;

  // Mock enabled logic
  const totalRequiredQuestions = isGeneral
    ? generalQuestionCount
    : getConfiguredDiffs().reduce((s, d) => s + getQuotaForDiff(d), 0);
  // Mock enabled logic

  // Current form content check — title + description + score filled
  const currentFormHasContent = (() => {
    const titleFilled = !!(getTitleText(titleBlocks) || titleBlocks.some(b => b.type === 'image' || b.type === 'code'));
    const descFilled = !!(
      descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim() ||
      descBlocks.some(b => b.type === 'image' || b.type === 'code')
    );
    const scoreFilled = (isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff)) > 0;
    return titleFilled && descFilled && scoreFilled;
  })();

  const anyFormFieldHasContent = !!(
    getTitleText(titleBlocks) || titleBlocks.some(b => b.type === 'image' || b.type === 'code') ||
    descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim() ||
    descBlocks.some(b => b.type === 'image' || b.type === 'code')
  );

  // Count saved from flowQuestions
  const savedFromFlow = flowQuestions.filter(q =>
    q.isSaved || q._id || serverIdMap.current.has(q.__localId)
  ).length;

  // Count saved from DB directly (source of truth)
  const savedFromDb = getDbQuestionsForDiff().length; // all diffs, all saved in DB

  // Best count — whichever is higher
  const savedQuestionsCount = Math.max(savedFromFlow, savedFromDb);

  // Current question saved?
  const currentQ_forMock = flowQuestions[currentIndex];
  const currentAlreadySaved_forMock = !!(
    currentQ_forMock?.isSaved ||
    currentQ_forMock?._id ||
    serverIdMap.current.has(currentQ_forMock?.__localId)
  );

  // Effective filled = saved + current unsaved form if has content
  const effectiveTotalFilled = savedQuestionsCount + (
    currentFormHasContent && !currentAlreadySaved_forMock ? 1 : 0
  );

  // Mock: enabled only when ALL required questions are saved (not just filled in form)
  const isMockEnabled = (() => {
    if (totalSlotsAll <= 0) return savedQuestionsCount > 0;
    return savedQuestionsCount >= totalSlotsAll;
  })();

  const addTC = () => setTcs(p => [...p, mkTC(p.length)]);
  const updTC = (id: string, f: string, v: any) => {
    setTcs(p => {
      const updated = p.map(tc => tc.id === id ? { ...tc, [f]: v } : tc);
      if (errs.testcases && updated.some(tc => tc.input.trim() && tc.expectedOutput.trim()))
        setErrs(prev => { const n = { ...prev }; delete n.testcases; return n; });
      return updated;
    });
  };
  const delTC = (id: string) => { if (tcs.length > 1) setTcs(p => p.filter(t => t.id !== id)); };




  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isFormDisabled) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
          switch (e.key) {
            case 'b':
              e.preventDefault();
              toggleBold();
              break;
            case 'i':
              e.preventDefault();
              toggleItalic();
              break;
            case 'u':
              e.preventDefault();
              toggleUnderline();
              break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormDisabled]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isFormDisabled) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            applyFormatting('bold');
            break;
          case 'i':
            e.preventDefault();
            applyFormatting('italic');
            break;
          case 'u':
            e.preventDefault();
            applyFormatting('underline');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormDisabled, titleBlocks, descBlocks]);
  // Rich text formatting helpers
  const applyFormatting = (command: 'bold' | 'italic' | 'underline') => {
    const activeElement = document.activeElement as HTMLElement;

    // Check if we're editing a textarea/input
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      const textarea = activeElement as HTMLTextAreaElement | HTMLInputElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== end) {
        const selectedText = textarea.value.substring(start, end);
        let wrappedText = '';

        switch (command) {
          case 'bold':
            wrappedText = `**${selectedText}**`;
            break;
          case 'italic':
            wrappedText = `*${selectedText}*`;
            break;
          case 'underline':
            wrappedText = `_${selectedText}_`;
            break;
        }

        const newValue = textarea.value.substring(0, start) + wrappedText + textarea.value.substring(end);
        textarea.value = newValue;

        // Trigger onChange for the specific field
        if (textarea.id === 'title-textarea') {
          const titleBlock = titleBlocks.find(b => b.type === 'text');
          if (titleBlock) {
            setTitleBlocks(prev => prev.map(b =>
              b.id === titleBlock.id ? { ...b, value: newValue } : b
            ));
          }
        } else if (textarea.id === 'desc-textarea') {
          const descBlock = descBlocks.find(b => b.type === 'text');
          if (descBlock) {
            setDescBlocks(prev => prev.map(b =>
              b.id === descBlock.id ? { ...b, value: newValue } : b
            ));
          }
          setDesc(newValue);
        }

        // Restore selection
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + wrappedText.length, start + wrappedText.length);
        }, 0);
      }
    }
  };
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="prog-root" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(26,26,46,0.55)', backdropFilter: 'blur(2px)', overflow: 'hidden', fontFamily: 'var(--lms-font)' }}>

      {/* ── Validation Toast (top-right corner) ── */}
      {validationToast.length > 0 && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          minWidth: 260, maxWidth: 340,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fff',
          border: '1.5px solid var(--lms-danger-bdr)',
          borderLeft: '4px solid var(--lms-danger)',
          borderRadius: 'var(--lms-radius-md)',
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: 'lms-toast-slide-in 0.22s cubic-bezier(.4,0,.2,1)',
        }}>
          <AlertCircle size={15} style={{ color: 'var(--lms-danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)', margin: '0 0 4px 0' }}>
              Please fix before saving:
            </p>
            <ul style={{ margin: 0, paddingLeft: 15 }}>
              {validationToast.map((msg, i) => (
                <li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: '#555', fontWeight: 600, lineHeight: 1.6 }}>{msg}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setValidationToast([])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#aaa', flexShrink: 0, lineHeight: 1 }}>
            <X size={13} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, background: 'var(--lms-bg-white)', overflow: 'hidden' }}>

        {/* ── Approval banner (inside the card so its padding is white, not the overlay) ── */}
        {(() => {
          const effApproval = approval || initialData?.approval || null;
          let effContext: any = approvalContext || null;
          if (!effContext && initialData?._id && exerciseData) {
            const map: any = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
            const entityType = map[(exerciseData.nodeType || '').toLowerCase().trim()] || 'topics';
            const entityId = exerciseData.nodeId || '';
            const exerciseId = exerciseData.exerciseId || exerciseData.fullExerciseData?._id || exerciseData.id || '';
            const subcategory = exerciseData.subcategory || 'assignments';
            if (entityId && exerciseId) {
              effContext = {
                entityType,
                entityId: String(entityId),
                tabType: (tabType === 'We_Do' ? 'We_Do' : 'You_Do'),
                subcategory,
                exerciseId: String(exerciseId),
                questionId: String(initialData._id),
              };
            }
          }
          if (!effApproval || !effContext) return null;
          return (
            <div className="px-4 pt-2">
              <QuestionApprovalBanner
                approval={effApproval}
                context={effContext}
                onResolved={onQueryResolved || onClose}
              />
            </div>
          );
        })()}

        {/* ── HEADER ── */}
      <div style={{ background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
    {/* Logo mark + graduation-cap icon removed 2026-08-30 per user request —
        the breadcrumb now owns the entire left side of the header. */}

    {/* Edit mode indicators */}
    {isCurrentPreExisting && !isEditMode && !isEditing && (
      <button onClick={handleEditClick}
        className="lms-btn lms-btn-ghost-orange"
        style={{ padding: '5px 12px', fontSize: 12 }}>
        <Edit2 size={12} /> Edit Exercise
      </button>
    )}
    {/* Breadcrumb wrapper — flex: 1 with min-width: 0 lets it shrink to fit
        the header row; the inner <ol> scrolls horizontally if the rail is
        wider than the viewport. Prevents the breadcrumb from wrapping into
        the second line and pushing the header taller. */}
    <div style={{ minWidth: 0, flex: 1, overflowX: 'auto', overflowY: 'visible' }} className="lms-sidebar-scroll">
      <QuestionFormBreadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel={actionLabel} questionLabel={questionLabel} />
    </div>
  </div>

  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
    
    {/* Preview button */}
    {(() => {
      const dbCount = getDbQuestionsForDiff().length;
      const flowSavedCount = flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length;
      const savedCount = Math.max(dbCount, flowSavedCount);
      return savedCount > 0 && (
        <button onClick={() => setShowPreview(true)} className="lms-btn lms-btn-ghost-violet" style={{ marginRight: 8 }}>
          <Eye size={12} /> Preview
          <span style={{ background: 'var(--lms-violet)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20 }}>
            {savedCount}
          </span>
        </button>
      );
    })()}

    {/* ADD QUESTION VIA DROPDOWN BUTTON */}
    <div ref={addDropdownRef} className="relative" style={{ marginRight: 8 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowAddDropdown(v => !v)}
        className="inline-flex items-center justify-between gap-2"
        style={{ 
          minWidth: 150, 
          height: 32, 
          padding: '0 10px', 
          borderRadius: 8, 
          border: '1.5px solid #e4e4ed', 
          background: '#fff', 
          color: '#1a1a2e', 
          fontSize: 12.5, 
          fontWeight: 600, 
          fontFamily: 'var(--lms-font)', 
          cursor: 'pointer' 
        }}
      >
        Add Question via
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
      </button>
      
      {showAddDropdown && (
        <div
          className="absolute top-full right-0 mt-1.5 z-[9999] overflow-hidden"
          style={{ 
            width: 220, 
            background: '#fff', 
            borderRadius: 12, 
            border: '1px solid #e4e4ed', 
            boxShadow: '0 8px 32px rgba(26,26,46,0.14)', 
            fontFamily: 'var(--lms-font)'
          }}
        >
          {/* 2. Question Bank (scratch entry point) — hidden when scratch is not allowed */}
          {bankViaScratch && (() => {
            const quotaFull = getSourceRemainingTotal('scratch') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'scratch-bank';
              setShowAddDropdown(false);
              // Dropdown-opened modal — must not cascade-close the form.
              sourceModalAutoOpenedRef.current = false;
              // Re-arm the auto-reopen guard: opening a source modal by hand
              // reflects a fresh intent, so the suppression from an earlier
              // dismiss should not carry over to the next Save & Next.
              autoReopenSuppressedRef.current = false;
              setShowBankSelector(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(168,85,247,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.1)' }}>
              <Database size={14} style={{ color: '#a855f7' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Question Bank</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Manual quota full' : 'Import from bank'}</div>
            </div>
          </button>
            );
          })()}

          {bankViaScratch && allowedSources.thirdParty && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 3. Other Platform — bank picker that stamps imports as thirdParty */}
          {allowedSources.thirdParty && (() => {
            const quotaFull = getSourceRemainingTotal('thirdParty') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'thirdParty';
              setShowAddDropdown(false);
              sourceModalAutoOpenedRef.current = false;
              autoReopenSuppressedRef.current = false;
              setShowBankSelector(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(13,148,136,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,148,136,0.1)' }}>
              <Database size={14} style={{ color: '#0d9488' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Other Platform</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Other Platform quota full' : 'Import platform questions'}</div>
            </div>
          </button>
            );
          })()}

          {(bankViaScratch || allowedSources.thirdParty) && allowedSources.ai && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 4. Generate AI — hidden when questionSource forbids AI */}
          {allowedSources.ai && (() => {
            const quotaFull = getSourceRemainingTotal('ai') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'ai';
              setShowAddDropdown(false);
              sourceModalAutoOpenedRef.current = false;
              autoReopenSuppressedRef.current = false;
              setShowAIModal(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(242,119,87,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(242,119,87,0.1)' }}>
              <Sparkles size={14} style={{ color: '#F27757' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Generate AI</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'AI quota full' : 'Auto-generate'}</div>
            </div>
          </button>
            );
          })()}

          {(bankViaScratch || allowedSources.thirdParty || allowedSources.ai) && allowedSources.upload && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 4. Upload via Document — hidden when questionSource forbids upload;
              disabled when the Manual quota slice is exhausted (uploads are
              stamped 'scratch-manual', so they bill the Manual slice). */}
          {allowedSources.upload && (() => {
            const quotaFull = getSourceRemainingTotal('scratch') <= 0;
            return (
          <button
            onClick={() => { if (quotaFull) return; pendingSourceRef.current = 'scratch-manual'; setShowAddDropdown(false); docInputRef.current?.click(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8,145,178,0.1)' }}>
              <CloudUpload size={14} style={{ color: '#0891b2' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Upload via Document</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Manual quota full' : 'Import from .txt file'}</div>
            </div>
          </button>
            );
          })()}
        </div>
      )}
      {/* Hidden file input for "Upload via Document" (.txt only) */}
      <input ref={docInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleDocumentSelected} />
      {/* Quota-capped selection step for uploaded documents — the confirmed
          subset re-enters the normal Bank/AI inject path ('scratch-manual'). */}
      {docPickerQs && (
        <DocQuestionPicker
          questions={docPickerQs}
          selectionQuota={isGeneral
            ? { mode: 'general' as const, remainingTotal: getRemainingSlots() }
            : {
                mode: 'difficulty' as const,
                remainingByDifficulty: {
                  easy: getSourceRemaining('scratch', 'easy' as Diff),
                  medium: getSourceRemaining('scratch', 'medium' as Diff),
                  hard: getSourceRemaining('scratch', 'hard' as Diff),
                },
              }}
          onClose={() => setDocPickerQs(null)}
          onConfirm={(selected) => {
            setDocPickerQs(null);
            handleBankSelectedQuestions(selected as any[], 'scratch-manual');
          }}
        />
      )}
    </div>

    {/* Edit Exercise button */}
    {onEditExercise && (
      <button onClick={handleEditExerciseClick} className="lms-btn lms-btn-ghost-orange" style={{ marginRight: 8 }}>
        <Settings size={12} /> Edit Exercise
      </button>
    )}

    {/* Close button */}
    <button onClick={handleCloseRequest} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer', color: 'var(--lms-danger)', transition: 'all 0.15s' }}>
      <X size={15} />
    </button>
  </div>
</div>

        {/* ── DIFFICULTY SELECT BAR ── */}
        {!isGeneral && getConfiguredDiffs().length > 0 && (
          <div style={{ background: 'var(--lms-bg-surface)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-text-sec)', flexShrink: 0 }}>Switch Difficulty:</span>
            <div style={{ position: 'relative', minWidth: 160 }}>
              <select
                value={currentDiff}
                onChange={e => {
                  const d = e.target.value as Diff;
                  if (d === currentDiff) return;
                  // Show dialog only when current question is a new unsaved question with data
                  const cq = flowQuestions[currentIndex];
                  setDiffSwitchTarget(d);
                }}
                style={{
                  fontFamily: 'var(--lms-font)',
                  fontSize: 12,
                  fontWeight: 700,
                  border: `2px solid ${s.border}`,
                  borderRadius: 'var(--lms-radius-md)',
                  padding: '6px 32px 6px 12px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: s.bg,
                  color: s.text,
                  width: '100%',
                  appearance: 'none'
                }}>
                {/* Every difficulty is listed so the teacher can see the shape
                    of the exercise at a glance. Levels this exercise did not
                    configure stay in the list but are DISABLED and say so —
                    silently omitting them made it look like the dropdown was
                    broken ("where did Medium go?"). */}
                {(['easy', 'medium', 'hard'] as Diff[]).map(d => {
                  if (!getConfiguredDiffs().includes(d)) {
                    return (
                      <option key={d} value={d} disabled>
                        {d.charAt(0).toUpperCase() + d.slice(1)} — not configured
                      </option>
                    );
                  }
                  const quota = getQuotaForDiff(d);
                  const rem = getRemainingSlots(d);
                  const used = quota - rem;
                  return <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)} ({used}/{quota}){rem <= 0 && d !== currentDiff ? ' ✓' : ''}</option>;
                })}
              </select>
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: s.text,
                fontSize: '12px'
              }}>
                ▼
              </div>
            </div>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: remainingSlots > 0 ? s.text : 'var(--lms-success)' }}>
              {remainingSlots > 0 ? `${remainingSlots} question${remainingSlots !== 1 ? 's' : ''} remaining` : '✓ All Questions filled'}
            </span>
            {/* Name the greyed-out levels explicitly — a disabled <option> is
                easy to miss, and the reason it is disabled lives on the
                exercise's Question Configuration, not on this screen. */}
            {(() => {
              const configured = getConfiguredDiffs();
              const missing = (['easy', 'medium', 'hard'] as Diff[]).filter(d => !configured.includes(d));
              if (!missing.length || configured.length === 0) return null;
              return (
                <span style={{
                  fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600,
                  color: 'var(--lms-text-muted)', background: 'var(--lms-bg-surface2)',
                  border: '1px solid var(--lms-border)', borderRadius: 8,
                  padding: '3px 9px', flexShrink: 0,
                }}
                  title="Set question counts for these levels in the exercise's Question Configuration to enable them.">
                  {missing.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' & ')} not configured
                </span>
              );
            })()}
            {/* {totalSlots > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--lms-bg-surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.bar, width: `${Math.min(100, (createdCount / totalSlots) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{createdCount}/{totalSlots}</span>
              </div>
            )} */}
            <div style={{ flex: 1 }} />
            {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setShowDetailsModal(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 'var(--lms-radius-md)',
          fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 600,
          border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)',
          color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <FileText size={12} /> Exercise Details
      </button>
      <button
        type="button"
        onClick={() => setShowOverviewModal(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 'var(--lms-radius-md)',
          fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 600,
          border: '1.5px solid var(--lms-info-bdr)', background: 'var(--lms-info-bg)',
          color: 'var(--lms-info)', cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <BarChart3 size={12} /> Exercise Overview
      </button>
    </div> */}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>

          {/* ── MAIN FORM ── */}
          <div ref={formScrollRef} className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--lms-bg-white)' }}>

            {/* Sticky Toolbar */}
            <div ref={stickyToolbarRef} style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--lms-bg-white)',
              paddingTop: 8,
              paddingBottom: 8,
              marginTop: -8,

            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {/* Q# badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: isCurrentPreExisting ? 'var(--lms-success)' : 'var(--lms-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 800,
                  fontFamily: 'var(--lms-font)', flexShrink: 0,
                  boxShadow: `0 2px 8px ${isCurrentPreExisting ? 'rgba(22,163,74,0.25)' : 'var(--lms-orange-glow)'}`,
                }}>
                  {globalQuestionNumber}
                </div>

                {/* B I U format buttons — hidden in link mode (no editors to format) */}
                <div style={{ display: isLinkQuestion ? 'none' : 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand('bold', false);
                      updateFormattingState();
                    }}
                    className="lms-fmt-btn"
                    disabled={isCurrentPreExisting && !isEditMode}
                    style={{
                      opacity: (isCurrentPreExisting && !isEditMode) ? 0.4 : 1,
                      cursor: (isCurrentPreExisting && !isEditMode) ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isBold ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Bold (Ctrl+B)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleItalic();
                    }}
                    className="lms-fmt-btn"
                    disabled={isFormDisabled}
                    style={{
                      opacity: isFormDisabled ? 0.4 : 1,
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isItalic ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Italic (Ctrl+I)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="4" x2="10" y2="4" />
                      <line x1="14" y1="20" x2="5" y2="20" />
                      <line x1="15" y1="4" x2="9" y2="20" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleUnderline();
                    }}
                    className="lms-fmt-btn"
                    disabled={isFormDisabled}
                    style={{
                      opacity: isFormDisabled ? 0.4 : 1,
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isUnderline ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Underline (Ctrl+U)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
                      <line x1="4" y1="20" x2="20" y2="20" />
                    </svg>
                  </button>
                </div>

                {/* ── Question link mode ─────────────────────────────────────
                    Radio toggle: ON = the whole form collapses to ONE URL
                    input (paste a LeetCode/HackerRank/etc. problem link) and
                    only that link is required to save. Students then get the
                    link in an iframe instead of the question + compiler.
                    Clicking the active radio switches back to the full form. */}
                <label
                  onClick={(e) => {
                    // preventDefault stops the label from forwarding a second
                    // synthetic click to the radio (which bubbles back here
                    // and would toggle the state right back — "nothing
                    // happens" from the user's seat).
                    e.preventDefault();
                    if (!isFormDisabled) { setIsLinkQuestion(v => !v); setErrs({}); }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    marginLeft: 8, padding: '5px 10px', borderRadius: 8,
                    border: `1.5px solid ${isLinkQuestion ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                    background: isLinkQuestion ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                    cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                    opacity: isFormDisabled ? 0.4 : 1,
                    transition: 'all 0.15s', userSelect: 'none',
                  }}
                  title="Paste an external problem link instead of authoring the question here"
                >
                  <input
                    type="radio"
                    checked={isLinkQuestion}
                    onChange={() => { /* handled by the label onClick so re-clicking untoggles */ }}
                    disabled={isFormDisabled}
                    style={{ accentColor: 'var(--lms-orange)', width: 13, height: 13, margin: 0, pointerEvents: 'none' }}
                  />
                  <span style={{ fontSize: 11.5, fontWeight: 650, fontFamily: 'var(--lms-font)', color: isLinkQuestion ? 'var(--lms-orange)' : 'var(--lms-text-sec)', whiteSpace: 'nowrap' }}>
                    Question link
                  </span>
                </label>

                <div style={{ flex: 1 }} />

                {/* Score — graded: editable/fixed input; non-graded: label only */}
                {!exerciseIsGraded && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    padding: '4px 10px', borderRadius: 8,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-surface)',
                  }}>
                    <Award size={12} style={{ color: 'var(--lms-text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>Non-graded</span>
                  </div>
                )}
                {exerciseIsGraded && (
                  <span ref={scoreSectionRef} style={{
                    display: 'inline',
                    whiteSpace: 'nowrap'
                  }}>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={(() => {
                        const v = isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);
                        return v === 0 ? '' : String(v);
                      })()}
                      placeholder="Enter the mark"
                      onChange={e => {
                        if (!isScoreEditable(currentDiff) || isGeneral || isFormDisabled) return;
                        const r = e.target.value;
                        if (/^\d*\.?\d*$/.test(r)) {
                          const n = parseFloat(r);
                          if (!isNaN(n) && n >= 0) setScore(n);
                          if (r === '') setScore(0);
                        }
                      }}
                      onBlur={handleScoreBlur}
                      disabled={isGeneral || !isScoreEditable(currentDiff) || isFormDisabled}
                      style={{
                        width: 120,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 'inherit',
                        fontWeight: 400,
                        color: errs.score && touched.has('score') ? 'var(--lms-danger)' : 'var(--lms-text-main)',
                        fontFamily: 'var(--lms-font)',
                        textAlign: 'left',
                        padding: '0 0 2px 0',
                        margin: 0,
                        borderBottom: '1.5px solid #333',
                        lineHeight: 'inherit',
                        cursor: (isGeneral || !isScoreEditable(currentDiff) || isFormDisabled) ? 'not-allowed' : 'text',
                        borderRadius: 0,
                      }}
                    />
                    {(!isScoreEditable(currentDiff) || isGeneral) && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--lms-font)',
                        padding: '1px 6px',
                        borderRadius: 20,
                        background: 'var(--lms-bg-surface2)',
                        color: 'var(--lms-text-muted)',
                        border: '1px solid var(--lms-border)',
                        marginLeft: 6,
                        verticalAlign: 'middle'
                      }}>Fixed</span>
                    )}
                  </span>
                )}
              </div>

              {/* Problem Title label */}

            </div>
            {/* ── Link mode: the ONE input that replaces the whole form ── */}
            {isLinkQuestion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="prog-label" style={{ margin: 0 }}>
                    Question Link <span style={{ color: 'var(--lms-danger)' }}>*</span>
                  </label>
                  {errs.questionLink && touched.has('questionLink') && (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.questionLink}</span>
                  )}
                </div>
                <input
                  type="url"
                  value={questionLink}
                  onChange={e => {
                    setQuestionLink(e.target.value);
                    if (errs.questionLink && /^https?:\/\/\S+$/i.test(e.target.value.trim())) {
                      setErrs(p => { const n = { ...p }; delete n.questionLink; return n; });
                    }
                  }}
                  onBlur={() => setTouched(p => new Set(p).add('questionLink'))}
                  placeholder="https://leetcode.com/problems/add-two-numbers/description/"
                  disabled={isFormDisabled}
                  className={`lms-input${errs.questionLink && touched.has('questionLink') ? ' err' : ''}`}
                  style={{ width: '100%', fontSize: 13 }}
                  autoFocus
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', margin: 0 }}>
                    Students get an "Open the problem" button — the site opens in a new tab, they solve
                    it there and press Submit Question here. Only the link is required to save.
                  </p>
                  {/^https?:\/\/\S+$/i.test(questionLink.trim()) && (
                    <a
                      href={questionLink.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: 'var(--lms-orange)', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Open in new tab ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {!isLinkQuestion && (<>
            {/* ─── 1. Question details ─────────────────────────────────────
                Numbered section header + Problem Title + Category + Tags +
                Problem Description live under one logical section. The Marks
                input stays in the sticky toolbar above (it depends on score
                editability / fixed-marks state that already lives there),
                but "Question details" is the semantic wrapper. */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">1</span>
              Question details
              <span className="lms-num-header-sub">Title, category, tags, and description</span>
            </div>

            {/* Problem Title section */}
            <div ref={titleSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="prog-label" style={{ margin: 0 }}>
                  Problem Title <span style={{ color: 'var(--lms-danger)' }}>*</span>
                </label>
                {errs.title && touched.has('title') && (
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.title}</span>
                )}
              </div>

              {/* Title Editor - ContentEditable */}
              <div onBlur={() => setTouched(p => new Set(p).add('title'))}>
                {titleBlocks.map((b, bi) => {
                  if (b.type === 'text') {
                    return <TitleEditor
                      key={b.id}
                      titleBlocks={titleBlocks}
                      setTitleBlocks={(blocks) => {
                        setTitleBlocks(blocks);
                        if (errs.title && getTitleText(blocks)) setErrs(p => { const n = { ...p }; delete n.title; return n; });
                      }}
                      isDisabled={isCurrentPreExisting && !isEditMode}
                      hasError={!!(errs.title && touched.has('title'))}
                      setTouched={setTouched}
                    />;
                  }
                  if (b.type === 'image') {
                    return (
                      <ProgImageBlock
                        key={b.id}
                        block={b as any}
                        onUpdate={patch => setTitleBlocks(prev => prev.map(tb => tb.id === b.id ? { ...tb, ...patch } as ProgContentBlock : tb))}
                        onRemove={() => setTitleBlocks(prev => { const n = prev.filter(tb => tb.id !== b.id); return n.length ? n : [mkProgTextBlock()]; })}
                        disabled={isFormDisabled}
                      />
                    );
                  }
                  if (b.type === 'code') {
                    return (
                      <ProgCodeBlockMCQ
                        key={b.id}
                        block={b as any}
                        onUpdate={patch => setTitleBlocks(prev => prev.map(tb => tb.id === b.id ? { ...tb, ...patch } as ProgContentBlock : tb))}
                        onRemove={() => setTitleBlocks(prev => { const n = prev.filter(tb => tb.id !== b.id); return n.length ? n : [mkProgTextBlock()]; })}
                        disabled={isFormDisabled}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>{/* end titleSectionRef wrapper */}

            {/* ─── Category + Tags row (12-col grid) ─────────────────────
                Category is a single preset from QUESTION_CATEGORIES; Tags
                are free-form short strings the teacher types in and the UI
                renders as removable chips. Both persist through snapshotForm
                / mkPayload / hasUnsavedFormChanges; server persistence
                requires whitelisting `category` + `tags` in the
                addQuestion/updateQuestion Object.assign in
                `exerciseAndQuestion.js`. See [[lms-questionforms-unification]]. */}
            <div className="lms-qdet-grid">
              <div className="lms-qdet-col-6">
                <label className="lms-field-label" htmlFor="prog-category">
                  Category
                </label>
                <select
                  id="prog-category"
                  className="lms-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  disabled={isFormDisabled}
                >
                  <option value="">— Uncategorised —</option>
                  {QUESTION_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="lms-qdet-col-6">
                <label className="lms-field-label" htmlFor="prog-tags-input">
                  Tags
                  <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', marginLeft: 4 }}>
                    (Enter to add, × to remove)
                  </span>
                </label>
                <div className="lms-tags-wrap">
                  {tags.map((t, i) => (
                    <span key={`${t}-${i}`} className="lms-tag-chip">
                      {t}
                      <button
                        type="button"
                        className="lms-tag-chip-x"
                        onClick={() => !isFormDisabled && setTags(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={isFormDisabled}
                        aria-label={`Remove tag ${t}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    id="prog-tags-input"
                    type="text"
                    className="lms-tag-input"
                    value={tagDraft}
                    placeholder={tags.length ? '+ Add tag' : 'Type a tag and press Enter…'}
                    onChange={e => setTagDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const t = tagDraft.trim().replace(/,+$/, '');
                        if (!t) return;
                        // Case-insensitive dedupe so "Math" and "math" don't both stick.
                        if (tags.some(x => x.toLowerCase() === t.toLowerCase())) { setTagDraft(''); return; }
                        setTags(prev => [...prev, t]);
                        setTagDraft('');
                      } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
                        // Backspace on an empty draft removes the last chip — standard chip-input UX.
                        setTags(prev => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      // Commit any half-typed tag on blur so it isn't lost when the teacher
                      // clicks Save without hitting Enter first.
                      const t = tagDraft.trim();
                      if (t && !tags.some(x => x.toLowerCase() === t.toLowerCase())) {
                        setTags(prev => [...prev, t]);
                      }
                      setTagDraft('');
                    }}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>
            </div>

            {/* ── Description ── */}
            <div ref={descSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="prog-label" style={{ margin: 0 }}>Problem Description <span style={{ color: 'var(--lms-danger)' }}>*</span></label>
                {errs.description && touched.has('description') && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.description}</span>}
              </div>
              <div onBlur={() => setTouched(p => new Set(p).add('description'))}>
                <ProgDescEditor
                  blocks={descBlocks}
                  onChange={blocks => {
                    setDescBlocks(blocks);
                    setDesc(blocks.filter(b => b.type === 'text').map(b => (b as any).value).join('\n'));
                  }}
                  disabled={isFormDisabled}
                  hasError={!!(errs.description && touched.has('description'))}
                  resetKey={currentIndex}
                />
              </div>
              {/* Editor meta strip — advisory only, does NOT affect what
                  the editor stores (still ProgContentBlock[]). The counter
                  reflects the visible text content across all text blocks,
                  not the raw HTML. 5,000 is a soft cap consistent with the
                  reference design; nothing enforces it in mkPayload. */}
              <div className="lms-editor-meta">
                <span>Markdown supported</span>
                <span>{desc.replace(/<[^>]*>/g, '').length.toLocaleString()} / 5,000</span>
              </div>
            </div>

            {/* ─── 2. Execution setup ────────────────────────────────── */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">2</span>
              Execution setup
              <span className="lms-num-header-sub">Choose how student submissions are executed and evaluated</span>
            </div>

            {/* ── Execution Setup (Function vs Full Program + starter experience) ── */}
            <ExecutionSetupSection
              executionType={executionType}
              setExecutionType={setExecutionType}
              functionContract={functionContract}
              setFunctionContract={setFunctionContract}
              startingExperience={startingExperience}
              setStartingExperience={setStartingExperience}
              language={codeSetupLanguage}
              showDriverPreview={showDriverPreview}
              setShowDriverPreview={setShowDriverPreview}
              disabled={isFormDisabled}
              functionNameError={touched.has('functionName') ? errs.functionName : undefined}
            />

            {/* ─── 3. Code ────────────────────────────────────────────── */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">3</span>
              Code
              <span className="lms-num-header-sub">Starter code ({startingExperience === 'custom' ? 'required' : 'optional'}) and Solution code (optional)</span>
            </div>

            {/* ── Code Setup ── */}
            <div ref={codeSetupSectionRef}>
              <CodeSetupSection
                variant="programming"
                hideHeader
                starterCode={starterCode}
                onStarterChange={setStarterCode}
                solutionCode={solutionCode}
                onSolutionChange={v => {
                  setSolutionCode(v);
                  if (errs.solutionCode && v.trim()) setErrs(p => { const n = { ...p }; delete n.solutionCode; return n; });
                }}
                disabled={isFormDisabled}
                languages={(exerciseData as any)?.fullExerciseData?.programmingSettings?.selectedLanguages}
                language={codeSetupLanguage}
                onLanguageChange={setCodeSetupLanguage}
                solutionError={touched.has('solutionCode') ? errs.solutionCode : undefined}
                onSolutionBlur={() => setTouched(p => new Set(p).add('solutionCode'))}
                startingExperience={startingExperience}
                generatedStarter={execGeneratedStarter(codeSetupLanguage || 'Python', functionContract)}
                customStarterWarning={
                  (executionType === 'function' && startingExperience === 'custom' && starterCode && functionContract.functionName &&
                    !starterCode.includes(functionContract.functionName))
                    ? (
                      <div style={{
                        margin: '6px 10px 10px', padding: '8px 10px', background: '#FFFBEB',
                        border: '1px solid #FDE68A', borderRadius: 8, color: '#92400E', fontSize: 11.5,
                      }}>
                        Custom starter does not contain the configured function name &ldquo;{functionContract.functionName}&rdquo;. Students may not know where to write their solution.
                      </div>
                    )
                    : null
                }
              />
            </div>

            {/* ─── 4. Constraints ─────────────────────────────────────── */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">4</span>
              Constraints
              <span className="lms-num-header-sub">Add any constraints on input values</span>
            </div>

            {/* ── Constraints ── */}
            <div ref={constraintsSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="prog-label" style={{ margin: 0 }}>
                    Constraints <span style={{ color: 'var(--lms-danger)' }}>*</span>
                  </label>
                  {errs.constraints && touched.has('constraints') && (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.constraints}</span>
                  )}
                </div>
                <button onClick={() => setConstr(p => [...p, ''])} disabled={isFormDisabled}
                  className={`lms-btn ${isFormDisabled ? 'lms-btn-slate' : 'lms-btn-ghost-orange'}`}
                  style={{ padding: '4px 10px', fontSize: 11, opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {constraints.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input value={c} onChange={e => { const a = [...constraints]; a[i] = e.target.value; setConstr(a); if (errs.constraints && a.some(x => x.trim())) setErrs(p => { const n = { ...p }; delete n.constraints; return n; }); }}
                      placeholder="e.g. 1 ≤ n ≤ 10⁵" disabled={isFormDisabled} className={`lms-input${errs.constraints && touched.has('constraints') ? ' err' : ''}`} style={{ flex: 1 }} />
                    {constraints.length > 1 && (
                      <button onClick={() => setConstr(p => p.filter((_, idx) => idx !== i))} disabled={isFormDisabled}
                        className="lms-icon-btn lms-icon-btn-red" style={{ opacity: isFormDisabled ? 0.4 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 5. Test cases ──────────────────────────────────────── */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">5</span>
              Test cases
              <span className="lms-num-header-sub">Sample cases are visible; hidden cases grade the submission</span>
            </div>

            {/* ── Test Cases (branch on Execution Setup mode) ── */}
            <div ref={testcasesSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <label className="prog-label" style={{ margin: 0 }}>
                      Test Cases <span style={{ color: 'var(--lms-danger)' }}>*</span>
                    </label>
                    {errs.testcases && touched.has('testcases') && (
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.testcases}</span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>Test Case 1 is the sample and cannot be deleted. Add hidden cases for grading.</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {executionType === 'function' ? (
                    <button
                      type="button"
                      className="lms-btn lms-btn-ghost-orange"
                      style={{ padding: '5px 12px', fontSize: 11 }}
                      disabled={isFormDisabled}
                      onClick={() => setShowTryFunctionModal(true)}
                    ><Play size={11} /> Try Function</button>
                  ) : (
                    <button
                      type="button"
                      className="lms-btn lms-btn-ghost-orange"
                      style={{ padding: '5px 12px', fontSize: 11 }}
                      disabled={isFormDisabled}
                      onClick={() => setShowCustomInputModal(true)}
                    ><Play size={11} /> Custom Input</button>
                  )}
                  {(() => {
                    // Evaluation-method gated Run Test Cases button.
                    //   testcase  → render (existing behaviour, Piston execution)
                    //   manual    → not rendered (manual evaluator needs no auto-run)
                    //   ai        → not rendered (AI evaluator runs on student submit
                    //               via the multi-file editor flow, not from authoring)
                    //   undefined → treated as 'testcase' to preserve legacy behaviour
                    //               (no invented fallback — matches the project's
                    //               existing pattern of direct evaluationMethod?.method
                    //               reads without a resolver).
                    const evalMethod = (exerciseData as any)?.fullExerciseData?.evaluationMethod?.method;
                    if (evalMethod === 'manual' || evalMethod === 'ai') return null;
                    return (
                      <button
                        type="button"
                        className="lms-btn lms-btn-orange"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        disabled={isFormDisabled}
                        onClick={() => {
                          // Cheap pre-flight — surface obvious problems without a round trip.
                          if (isStringSolutionEmpty(solutionCode)) {
                            setErrs(p => ({ ...p, solutionCode: 'Solution code is required to run tests' }));
                            setTouched(p => new Set(p).add('solutionCode'));
                            setValidationToast(['Solution Code is empty']);
                            setTimeout(() => setValidationToast([]), 3000);
                            return;
                          }
                          setShowRunTestsModal(true);
                        }}
                      ><Play size={11} /> Run Test Cases</button>
                    );
                  })()}
                </div>
              </div>

              <div style={{
                padding: '8px 12px', background: '#ECFEFF', border: '1px solid #A5F3FC',
                borderRadius: 8, color: '#0E7490', fontSize: 12, lineHeight: 1.5,
              }}>
                {executionType === 'function'
                  ? `Your platform creates a hidden driver, loads the student submission, calls ${functionContract.functionName || 'the configured function'} with each test case, and compares the returned value.`
                  : 'Stored Input is sent to stdin automatically. Program stdout is compared with Expected Output.'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tcs.map((tc, i) => {
                  const rowStyle: React.CSSProperties = { border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: 12, background: i === 0 ? 'var(--lms-bg-white)' : 'var(--lms-bg-surface)', transition: 'all 0.15s' };
                  const headerRow = (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: i === 0 ? 'var(--lms-orange-100)' : 'var(--lms-bg-surface2)', color: i === 0 ? '#c85a30' : 'var(--lms-text-sec)' }}>
                          Test Case {i + 1}{i === 0 ? ' · Sample' : ''}
                        </span>
                        {tc.isHidden && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-muted)' }}>Hidden</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {i > 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                            <input type="checkbox" checked={tc.isSample} onChange={e => updTC(tc.id, 'isSample', e.target.checked)} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />Sample
                          </label>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={tc.isHidden} onChange={e => updTC(tc.id, 'isHidden', e.target.checked)} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />Hidden
                        </label>
                        {i > 0 && (
                          <button onClick={() => delTC(tc.id)} disabled={isFormDisabled}
                            className="lms-icon-btn lms-icon-btn-red"
                            style={{ width: 26, height: 26, opacity: isFormDisabled ? 0.4 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  if (executionType === 'function') {
                    // Structured inputs per parameter + expected return value.
                    const fnInputs = tc.functionInputs || {};
                    return (
                      <div key={tc.id} style={rowStyle} className="group">
                        {headerRow}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {functionContract.params.length === 0 && (
                            <div style={{ fontSize: 11.5, color: 'var(--lms-text-muted)' }}>
                              This function has no parameters. Enter only the expected return below.
                            </div>
                          )}
                          {functionContract.params.map(p => (
                            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 8, alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{p.name}</div>
                                <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#64748B' }}>{p.type}</div>
                              </div>
                              <input
                                className="lms-input mono"
                                value={fnInputs[p.name] || ''}
                                placeholder={`value for ${p.name}`}
                                disabled={isFormDisabled}
                                onChange={e => {
                                  const nextInputs = { ...(fnInputs || {}), [p.name]: e.target.value };
                                  setTcs(prev => prev.map(x => x.id === tc.id ? { ...x, functionInputs: nextInputs } : x));
                                }}
                                style={{ fontSize: 12 }}
                              />
                            </div>
                          ))}
                          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 8, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>Expected Return</div>
                              <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#64748B' }}>{functionContract.returnType}</div>
                            </div>
                            <input
                              className="lms-input mono"
                              value={tc.expectedOutput}
                              placeholder="expected return value (JSON-encoded)"
                              disabled={isFormDisabled}
                              onChange={e => updTC(tc.id, 'expectedOutput', e.target.value)}
                              style={{ fontSize: 12 }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <label className="prog-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Explanation <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                          <input value={tc.description} onChange={e => updTC(tc.id, 'description', e.target.value)}
                            placeholder="Briefly explain what this test case verifies…"
                            disabled={isFormDisabled} className="lms-input" style={{ fontSize: 12 }} />
                        </div>
                      </div>
                    );
                  }
                  // Full-program mode — original stdin / stdout inputs.
                  return (
                    <div key={tc.id} style={rowStyle} className="group">
                      {headerRow}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label className="prog-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Input (Click Enter to give multiple inputs)</label>
                          <TA value={tc.input} onChange={v => updTC(tc.id, 'input', v)} placeholder="stdin…" rows={3} mono disabled={isFormDisabled} />
                        </div>
                        <div>
                          <label className="prog-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Expected Output</label>
                          <TA value={tc.expectedOutput} onChange={v => updTC(tc.id, 'expectedOutput', v)} placeholder="expected stdout…" rows={3} mono disabled={isFormDisabled} />
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label className="prog-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Explanation <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                        <input value={tc.description} onChange={e => updTC(tc.id, 'description', e.target.value)}
                          placeholder="Briefly explain what this test case verifies…"
                          disabled={isFormDisabled} className="lms-input" style={{ fontSize: 12 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={addTC} disabled={isFormDisabled}
                  className="lms-btn"
                  style={{ padding: '5px 12px', fontSize: 11, background: 'var(--lms-success-bg)', color: 'var(--lms-success)', borderColor: 'var(--lms-success-bdr)', opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add Test Case
                </button>
              </div>
            </div>

            {/* ── AI Test Cases count — visible ONLY when this exercise runs in
                AI evaluation mode with per-question count. Required in that mode
                (validate() blocks Save without a value); harmlessly hidden and
                skipped otherwise. Kept adjacent to Test Cases because that's
                where the concept lives conceptually. */}
            {(() => {
              const exEvm: any = exerciseData?.fullExerciseData?.evaluationMethod;
              const show = exEvm?.method === 'ai' && exEvm?.ai?.testCasesCountMode === 'perQuestion';
              if (!show) return null;
              const err = errs.aiTestCasesCount;
              const shown = touched.has('aiTestCasesCount') && err;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className="prog-label" style={{ margin: 0 }}>
                      AI Test Cases <span style={{ color: 'var(--lms-danger)' }}>*</span>
                    </label>
                    {shown && (
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {err}</span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', margin: 0 }}>
                    Count of NEW test cases the AI generates + evaluates for this question at Submit time.
                    Cached after the first student's Submit — every subsequent student sees the same set. Max 50.
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={aiTestCasesCount ?? ''}
                    disabled={isFormDisabled}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setAiTestCasesCount(null);
                      } else {
                        const n = Math.max(0, Math.min(50, Math.floor(Number(val) || 0)));
                        setAiTestCasesCount(n);
                        setErrs(p => { const x = { ...p }; delete x.aiTestCasesCount; return x; });
                      }
                    }}
                    onBlur={() => setTouched(p => new Set(p).add('aiTestCasesCount'))}
                    placeholder="e.g. 20"
                    style={{
                      width: 160,
                      padding: '6px 10px',
                      fontFamily: 'var(--lms-font)',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 'var(--lms-radius-md)',
                      border: `1.5px solid ${shown ? 'var(--lms-danger)' : 'var(--lms-border)'}`,
                      outline: 'none',
                      background: isFormDisabled ? 'var(--lms-bg-surface)' : 'var(--lms-bg-white)',
                    }}
                  />
                </div>
              );
            })()}

            {/* ─── 6. Hints & advanced settings ─────────────────────────
                Numbered header + Hint textarea + Additional Hints array,
                shown flat (no collapsible). Earlier revision wrapped this
                in a `.lms-collapsible` with a toggle — that made the
                section appear as just a header + thin border and the body
                looked missing on the page (2026-08-30 user report).
                Reverting to the old flat layout matches teacher expectations. */}
            <div className="lms-num-header">
              <span className="lms-num-header-badge">6</span>
              Hints &amp; advanced settings
              <span className="lms-num-header-sub">
                {(hint.trim() || extraHints.length > 0)
                  ? `${(hint.trim() ? 1 : 0) + extraHints.length} hint${((hint.trim() ? 1 : 0) + extraHints.length) === 1 ? '' : 's'} configured`
                  : 'Optional — add hints below if you want to guide the student'}
              </span>
            </div>

            {/* ── Hint (primary) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="prog-label" style={{ margin: 0 }}>
                Hint <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Optional)</span>
              </label>
              <TA value={hint} onChange={setHint} placeholder="Give students a helpful hint…" rows={2} disabled={isFormDisabled} />
            </div>

            {/* ── Additional Hints ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="prog-label" style={{ margin: 0 }}>Additional Hints</label>
                <button onClick={() => setExtraH(p => [...p, { hintText: '', pointsDeduction: 0, isPublic: true }])} disabled={isFormDisabled}
                  className={`lms-btn ${isFormDisabled ? 'lms-btn-slate' : 'lms-btn-ghost-orange'}`}
                  style={{ padding: '4px 10px', fontSize: 11, opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add Hint
                </button>
              </div>
              {extraHints.map((h, i) => (
                <div key={i} style={{ border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: 12, background: 'var(--lms-bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-sec)' }}>Hint {i + 2}</span>
                    <button onClick={() => setExtraH(p => p.filter((_, idx) => idx !== i))} disabled={isFormDisabled}
                      style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', background: 'none', border: 'none', cursor: isFormDisabled ? 'not-allowed' : 'pointer', opacity: isFormDisabled ? 0.4 : 1 }}>Remove</button>
                  </div>
                  <TA value={h.hintText} onChange={v => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, hintText: v } : x))} placeholder="Hint text…" rows={2} disabled={isFormDisabled} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)' }}>
                      Deduction:
                      <NI value={h.pointsDeduction} onChange={v => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, pointsDeduction: v } : x))}
                        min={0} max={10} disabled={isFormDisabled} cls="w-16" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={h.isPublic} onChange={e => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, isPublic: e.target.checked } : x))} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />
                      Public
                    </label>
                  </div>
                </div>
              ))}
            </div>
            </>)}{/* end !isLinkQuestion form sections */}

            {/* ── Validation errors ── */}
            {Object.keys(errs).length > 0 && touched.size > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 'var(--lms-radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AlertCircle size={14} style={{ color: 'var(--lms-danger)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)' }}>Fix before saving:</span>
                </div>
                <ul style={{ marginLeft: 16, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.values(errs).map((e, i) => <li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-danger)' }}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* 8px was the pre-redesign trailing spacer; it lived when the
                whole form was shorter. The scroll container above now has
                paddingBottom: 120 so the last visible section (Hints /
                validation strip) always clears the sticky footer — this
                spacer is just a soft finish before that padding kicks in. */}
            <div style={{ height: 8 }} />
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Two action buttons */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                  fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                  border: '1.5px solid var(--lms-border)',
                  background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-orange)'; b.style.background = 'var(--lms-orange-50)'; b.style.color = '#c85a30'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={14} style={{ color: 'var(--lms-orange)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Details</div>
                  <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>ID, type, config, duration</div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
              </button>

              {!isGeneral && (
                <button
                  type="button"
                  onClick={() => setShowOverviewModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                    fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-info-bdr)'; b.style.background = 'var(--lms-info-bg)'; b.style.color = 'var(--lms-info)'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Overview</div>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>Quota, marks, progress</div>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
              )}
              {sectionData && (
                <button
                  type="button"
                  onClick={() => setShowSectionModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                    fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    marginTop: 8,
                  }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-violet-bdr)'; b.style.background = 'var(--lms-violet-bg)'; b.style.color = 'var(--lms-violet)'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Section Details</div>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>{sectionData.name || 'Current section'}</div>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
              )}
            </div>

            {/* Stats summary — Questions + Marks */}
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

              {/* ── Current Difficulty Questions ── */}
              {!isGeneral && (
                <div style={{ marginBottom: 14 }}>
                  <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                    <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span style={{ textTransform: 'capitalize' }}>{currentDiff} Questions</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlots}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Created</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                      {createdCount}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlots}</span>
                    </span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Remaining</span>
                    <span className="lms-marks-value" style={{ color: remainingSlots === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlots}</span>
                  </div>
                  {totalSlots > 0 && (
                    <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                      <div className="lms-progress-fill" style={{
                        width: `${Math.min(100, (createdCount / totalSlots) * 100)}%`,
                        background: remainingSlots === 0 ? 'var(--lms-success)' : 'var(--lms-orange)'
                      }} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Overall Questions ── */}
              <div style={{ marginBottom: 14, borderTop: isGeneral ? 'none' : '1px dashed var(--lms-border)', paddingTop: isGeneral ? 0 : 14 }}>
                <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                  <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                  <span>Overall Questions</span>
                </div>
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Total Questions</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
                </div>
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Created</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                    {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
                  </span>
                </div>
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Remaining</span>
                  <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span>
                </div>
                {totalSlotsAll > 0 && (
                  <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                    <div className="lms-progress-fill" style={{
                      width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`,
                      background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)'
                    }} />
                  </div>
                )}
              </div>

              {/* ── Current Difficulty Marks ── */}
              {exerciseIsGraded && !isGeneral && totalMarksForDiff > 0 && (
                <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14, marginBottom: 14 }}>
                  <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                    <Award size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span style={{ textTransform: 'capitalize' }}>{currentDiff} Marks</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Mark</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMarksForDiff}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Mark Per Question</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>
                      {displayScore}
                      {isScoreEditable(currentDiff)
                        ? <span className="lms-badge lms-badge-violet" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3 }}>Custom</span>
                        : <span className="lms-badge" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3, background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>Fixed</span>}
                    </span>
                  </div>
                  {maxAssignableForCurrentQ !== null && (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Max Assignable</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-info)', fontSize: 12 }}>
                        {fmtMark(maxAssignableForCurrentQ)}
                        {remainingSlots > 0 && (
                          <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 9, marginLeft: 4 }}>
                            (1 reserved × {remainingSlots})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Used Marks</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                      {fmtMark(usedMarks)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksForDiff}</span>
                    </span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Remaining Marks</span>
                    <span className="lms-marks-value" style={{ color: remainingMarks <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{fmtMark(remainingMarks)}</span>
                  </div>
                  <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                    <div className="lms-progress-fill" style={{
                      width: `${Math.min(100, (usedMarks / totalMarksForDiff) * 100)}%`,
                      background: usedMarks >= totalMarksForDiff ? 'var(--lms-success)' : 'var(--lms-orange)'
                    }} />
                  </div>
                </div>
              )}

              {/* ── Overall Marks ── */}
              {exerciseIsGraded && (isGeneral ? generalMPQ > 0 : totalMarksAll > 0) && (
                <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                  <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                    <Award size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span>Overall Marks</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Marks Per Question</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{isGeneral ? generalMPQ : displayScore}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Questions</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Marks</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{isGeneral ? generalTotalMarks : totalMarksAll}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
          {/* ── Exercise Details Modal ── */}
          {showDetailsModal && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
                  </div>
                  <button type="button" onClick={() => setShowDetailsModal(false)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <X size={15} />
                  </button>
                </div>

                {/* Body — label:value rows */}
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                  {exerciseData.fullExerciseData?.exerciseInformation?.exerciseId && (
                    <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                      <span className="lms-detail-label">Exercise ID</span>
                      <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>
                        {exerciseData.fullExerciseData.exerciseInformation.exerciseId}
                      </span>
                    </div>
                  )}
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Exercise Name</span>
                    <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exerciseName || 'Untitled'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Exercise Type</span>
                    <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                      {exerciseData.fullExerciseData?.exerciseType || 'programming'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Configuration</span>
                    <span className="lms-detail-value" style={{ fontSize: 11 }}>
                      {isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Assessment Type</span>
                    <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: exerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                      {exerciseIsGraded ? 'Graded' : 'Non-Graded'}
                    </span>
                  </div>
                  {(exerciseData.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData.fullExerciseData?.exerciseInformation?.duration) && (
                    <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                      <span className="lms-detail-label">Duration</span>
                      <span className="lms-detail-value" style={{ fontSize: 11 }}>
                        {exerciseData.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData.fullExerciseData?.exerciseInformation?.duration} mins
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setShowDetailsModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Exercise Overview Modal ── */}
          {/* ── Exercise Overview Modal ── */}
          {showOverviewModal && (() => {
            // exerciseIsGraded from component level — graded = show marks, non-graded = questions only
            const configuredDiffs = getConfiguredDiffs();

            return (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
                onClick={e => { if (e.target === e.currentTarget) setShowOverviewModal(false); }}>
                <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
                    </div>
                    <button type="button" onClick={() => setShowOverviewModal(false)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                      <X size={15} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>

                    {/* ── Overall Questions section ── */}
                    <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                      </div>



                      {/* Overall totals */}
                      <div style={{ marginTop: !isGeneral && configuredDiffs.length > 0 ? 12 : 0, paddingTop: !isGeneral && configuredDiffs.length > 0 ? 12 : 0, borderTop: !isGeneral && configuredDiffs.length > 0 ? '1px solid var(--lms-border)' : 'none' }}>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Total Questions</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12, fontWeight: 700 }}>{totalSlotsAll}</span>
                        </div>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Created</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12, fontWeight: 700 }}>
                            {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
                          </span>
                        </div>
                        <div className="lms-marks-row ">
                          <span className="lms-marks-label">Remaining</span>
                          <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12, fontWeight: 700 }}>
                            {remainingSlotsAll}
                          </span>
                        </div>
                        {totalSlotsAll > 0 && (
                          <div className="lms-progress-bar" style={{ marginTop: 8, marginBottom: 15 }}>
                            <div className="lms-progress-fill mb-3" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                          </div>
                        )}
                      </div>
                      {/* Per-difficulty question breakdown — current difficulty only */}
                      {!isGeneral && configuredDiffs.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          {configuredDiffs.filter(d => d === currentDiff).map(d => {
                            const quota = getQuotaForDiff(d);
                            const created = getCreatedCount(d);
                            const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                            return (
                              <div key={d} style={{ marginBottom: 8 }}>
                                <div className="lms-marks-row" style={{ marginBottom: 4 }}>
                                  <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor, fontWeight: 700 }}>
                                    {d} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--lms-text-muted)' }}>({quota} question{quota !== 1 ? 's' : ''})</span>
                                  </span>
                                  <span className="lms-marks-value" style={{ fontSize: 12 }}>
                                    <span style={{ color: 'var(--lms-violet)', fontWeight: 700 }}>{created}</span>
                                    <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{quota}</span>
                                    <span style={{
                                      color: created >= quota ? 'var(--lms-success)' : 'var(--lms-text-muted)',
                                      fontSize: 10,
                                      marginLeft: 6,
                                      fontWeight: 500
                                    }}>
                                      {created >= quota ? '✓ Complete' : `${quota - created} remaining`}
                                    </span>
                                  </span>
                                </div>
                                {quota > 0 && (
                                  <div className="lms-progress-bar" style={{ marginTop: 2 }}>
                                    <div className="lms-progress-fill" style={{
                                      width: `${Math.min(100, (created / quota) * 100)}%`,
                                      background: created >= quota ? 'var(--lms-success)' : diffColor
                                    }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                    {/* ── Overall Marks section — graded only ── */}
                    {exerciseIsGraded && (isGeneral ? (generalTotalMarks > 0 || generalMPQ > 0) : totalMarksAll > 0) && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                        </div>

                        {isGeneral ? (
                          <>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Marks per Question</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{generalMPQ}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Questions</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{generalQuestionCount}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{generalTotalMarks}</span>
                            </div>
                          </>
                        ) : (
                          // levelBased
                          <>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Marks Used</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                                {fmtMark(usedMarksAll)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining Marks</span>
                              <span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                                {fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}
                              </span>
                            </div>
                            {totalMarksAll > 0 && (
                              <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                                <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                              </div>
                            )}

                            {/* Per-difficulty marks breakdown */}
                            {configuredDiffs.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lms-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  By Difficulty
                                </div>
                                {configuredDiffs.filter(d => d === currentDiff).map(d => {
                                  const levelMarks = getTotalMarksForDiff(d);
                                  const usedD = getDbMarksUsedForDiff(d);
                                  const isQuestSpecific = getScoringType(d) === 'question_specific';
                                  const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                                  return (
                                    <div key={d} style={{
                                      marginBottom: 10,
                                      padding: '8px 10px',
                                      background: 'var(--lms-bg-surface)',
                                      borderRadius: 'var(--lms-radius-sm)',
                                      borderLeft: `3px solid ${diffColor}`,
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: 12, color: diffColor }}>
                                          {d}
                                        </span>
                                        {!isQuestSpecific && (
                                          <span style={{ fontSize: 10, color: 'var(--lms-text-muted)' }}>
                                            {getFixedScore(d)} per question
                                          </span>
                                        )}
                                        {isQuestSpecific && (
                                          <span style={{ fontSize: 10, color: 'var(--lms-violet)', fontStyle: 'italic' }}>
                                            custom per question
                                          </span>
                                        )}
                                      </div>
                                      <div className="lms-marks-row" style={{ marginBottom: 2 }}>
                                        <span className="lms-marks-label" style={{ fontSize: 11 }}>Total Marks</span>
                                        <span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--lms-violet)' }}>
                                          {levelMarks || 0}
                                        </span>
                                      </div>
                                      <div className="lms-marks-row">
                                        <span className="lms-marks-label" style={{ fontSize: 11 }}>Used Marks</span>
                                        <span className="lms-marks-value" style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: usedD >= levelMarks && levelMarks > 0 ? 'var(--lms-success)' : 'var(--lms-warning)'
                                        }}>
                                          {fmtMark(usedD)}
                                        </span>
                                      </div>
                                      {levelMarks > 0 && (
                                        <div className="lms-progress-bar" style={{ marginTop: 4 }}>
                                          <div className="lms-progress-fill" style={{
                                            width: `${Math.min(100, (usedD / levelMarks) * 100)}%`,
                                            background: usedD >= levelMarks ? 'var(--lms-success)' : diffColor
                                          }} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button type="button" onClick={() => setShowOverviewModal(false)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Section Details Modal ── */}
          {showSectionModal && sectionData && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowSectionModal(false); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-violet-bg)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Section Details</span>
                  </div>
                  <button type="button" onClick={() => setShowSectionModal(false)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <X size={15} />
                  </button>
                </div>
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--lms-text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lms-text-main)' }}>{sectionData.name || '—'}</div>
                    {sectionData.description && (
                      <div style={{ fontSize: 11.5, color: 'var(--lms-text-sec)', marginTop: 4 }}>{sectionData.description}</div>
                    )}
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Order</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.order || sectionData.sectionNumber || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Exercise Type</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{sectionData.exerciseType || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Marks</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{sectionData.totalMarks ?? '—'}</span>
                  </div>
                  {sectionData.difficulty && (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Difficulty</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12, textTransform: 'capitalize' }}>{sectionData.difficulty}</span>
                    </div>
                  )}
                  {sectionData.mcqConfig && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-info)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MCQ Config</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Questions</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.mcqConfig.generalQuestionCount ?? 0}</span>
                      </div>
                      {sectionData.mcqSectionMarks !== undefined && (
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">MCQ Marks</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{sectionData.mcqSectionMarks}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {sectionData.programmingConfig && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Programming Config</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Mode</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.questionConfigType || '—'}</span>
                      </div>
                      {sectionData.programmingConfig.questionConfigType === 'general' ? (
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Questions</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.generalQuestionCount ?? 0}</span>
                        </div>
                      ) : (
                        (['easy', 'medium', 'hard'] as const).map(level => (
                          <div key={level} className="lms-marks-row">
                            <span className="lms-marks-label" style={{ textTransform: 'capitalize' }}>{level}</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.levelBasedCounts?.[level] || 0}</span>
                          </div>
                        ))
                      )}
                      {sectionData.programmingSectionMarks !== undefined && (
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Programming Marks</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-success)', fontSize: 12 }}>{sectionData.programmingSectionMarks}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setShowSectionModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ── FOOTER ── */}
        {/* ── FOOTER ── */}
        {/* ── FOOTER ── */}
        <div style={{ background: 'var(--lms-bg-white)', borderTop: '1.5px solid var(--lms-border)', padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, flexShrink: 0 }}>

          {/* Left: saving indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSaving && (
              <>
                <Loader2 size={13} style={{ color: 'var(--lms-orange)' }} className="animate-spin" />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-orange)' }}>{saveMessage || 'Saving…'}</span>
                <div style={{ width: 80, height: 4, background: 'var(--lms-bg-surface2)', borderRadius: 2, overflow: 'hidden', marginLeft: 4 }}>
                  <div style={{ height: '100%', background: 'var(--lms-orange)', borderRadius: 2, transition: 'width 0.3s', width: `${saveProgress}%` }} />
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Previous — show whenever there's any earlier question in the flow,
                regardless of difficulty. Clicking will auto-switch the form's
                current difficulty if the previous question lives in a different one. */}
            {currentIndex > 0 && (
              <button onClick={handlePrevious} disabled={isSaving} className="lms-nav-btn"
                style={{ opacity: isSaving ? 0.5 : 1 }}>
                <ChevronLeft size={13} /> Previous
              </button>
            )}

            {/* Next — show when not on last question in flow */}
            {currentIndex < flowQuestions.length - 1 && (
              <button onClick={() => {
                const snap = snapshotForm({
                  isSaved: flowQuestions[currentIndex]?.isSaved || false,
                  _id: getServerId(flowQuestions[currentIndex])
                });
                const newFlow = [...flowQuestionsRef.current];
                newFlow[currentIndex] = snap;
                flowQuestionsRef.current = newFlow;
                setFlowQuestions(newFlow);
                const nextIdx = currentIndex + 1;
                currentIndexRef.current = nextIdx;
                setCurrentIndex(nextIdx);
                if (!isGeneral && newFlow[nextIdx]?.difficulty) {
                  setCurrentDiff(newFlow[nextIdx].difficulty as Diff);
                }
                loadQuestionIntoForm(newFlow[nextIdx]);
                setTimeout(() => titleRef.current?.focus(), 80);
              }} disabled={isSaving} className="lms-nav-btn"
                style={{ opacity: isSaving ? 0.5 : 1 }}>
                Next <ChevronRight size={13} />
              </button>
            )}

            {/* Save — always show */}
            <button onClick={handleSave} disabled={isSaving}
              className="lms-btn lms-btn-slate"
              style={{ opacity: isSaving ? 0.5 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>

            {/* Save & Continue / Finish */}
            {(() => {
              const currentQ = flowQuestions[currentIndex];
              const isSaved = !!(getServerId(currentQ) || currentQ?.isSaved || currentQ?.isPreExisting);
              const isFinish = isLastQuestion;
              const hasChanges = hasUnsavedFormChanges;

              let label: string;
              if (!isSaved) {
                label = isFinish ? 'Save & Finish' : 'Save & Continue';
              } else if (isFinish) {
                label = hasChanges ? 'Update & Finish' : 'Finish';
              } else {
                label = 'Update & Continue';
              }

              const isGreen = isFinish;

              return (
                <button onClick={handleSaveAndContinue} disabled={isSaving}
                  className="lms-btn lms-btn-orange"
                  style={{
                    opacity: isSaving ? 0.6 : 1,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    background: isGreen ? 'var(--lms-success)' : 'var(--lms-orange)',
                    boxShadow: isGreen
                      ? '0 2px 8px rgba(22,163,74,0.25)'
                      : '0 2px 8px var(--lms-orange-glow)',
                  }}>
                  {isSaving
                    ? <Loader2 size={13} className="animate-spin" />
                    : isGreen ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                  {label}
                  {isGreen ? <Flag size={11} /> : <ArrowRight size={11} />}
                </button>
              );
            })()}

            {/* Request Approve — only when this question has an open query */}
            {(() => {
              const ap = approval || initialData?.approval || null;
              const ctx = approvalContext || deriveApprovalContext(initialData, exerciseData, tabType);
              if (!ap || !ctx) return null;
              return (
                <RequestApproveButton approval={ap} context={ctx} onResolved={onQueryResolved || onClose} />
              );
            })()}

            {/* Delete */}
            {flowQuestions.length > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="lms-btn"
                style={{
                  background: 'var(--lms-danger-bg)',
                  color: 'var(--lms-danger)',
                  borderColor: 'var(--lms-danger-bdr)',
                  opacity: isSaving ? 0.5 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}>
                <Trash2 size={12} /> Delete
              </button>
            )}

            {/* Clear */}
            {anyFormFieldHasContent && (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isSaving}
                className="lms-btn"
                style={{
                  background: 'var(--lms-warning-bg)',
                  color: 'var(--lms-warning)',
                  borderColor: 'var(--lms-warning-bdr)',
                  opacity: isSaving ? 0.5 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
          {/* Right: Mock + Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowMockModal(true)}
              disabled={!isMockEnabled}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)',
                fontSize: 12, fontWeight: 600, cursor: isMockEnabled ? 'pointer' : 'not-allowed',
                border: `1.5px solid ${isMockEnabled ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`,
                background: isMockEnabled ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)',
                color: isMockEnabled ? 'var(--lms-violet)' : 'var(--lms-text-hint)',
                transition: 'all 0.15s', opacity: isMockEnabled ? 1 : 0.55,
              }}
            >
              <Eye size={13} /> Mock
            </button>
            <button
              type="button"
              onClick={handleCloseRequest}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)',
                color: 'var(--lms-text-sec)', transition: 'all 0.15s',
              }}
            >
              <X size={13} /> Close
            </button>
          </div>

        </div>

      </div>
      {/* ── DIALOGS ── */}
      {/* Suppress the "All difficulties complete!" branch (see the student-
          copy for the full rationale): the popup was firing bogusly when
          another difficulty still had customDistribution slots available
          but zero programming per-difficulty quota. Only render when
          there's actually a next difficulty to jump to. */}
      {showDiffPopup && completedDiff && availableNextDiffs.length > 0 && (
        <DifficultyPopup completedDiff={completedDiff} availableNext={availableNextDiffs}
          onSelect={handleDiffSelect} onClose={() => { setShowDiffPopup(false); setCompletedDiff(null); }} />
      )}
      {diffSwitchTarget && (
        <DiffSwitchDialog fromDiff={currentDiff} toDiff={diffSwitchTarget} remainingInTo={getRemainingSlots(diffSwitchTarget)}
          onConfirm={confirmDiffSwitch} onCancel={() => setDiffSwitchTarget(null)} />
      )}
      {showPreview && (
        <PreviewModal
          questions={(() => {
            // Always start from DB as source of truth
            const dbQuestions = getDbQuestionsForDiff().map(dbQuestionToFlow);
            const dbIdSet = new Set(dbQuestions.map(q => q._id).filter(Boolean));

            // Add any newly saved questions from this session not yet in DB
            const sessionSaved = flowQuestions.filter(q => {
              const sid = serverIdMap.current.get(q.__localId) || q._id;
              return sid && !dbIdSet.has(sid);
            });

            return [...dbQuestions, ...sessionSaved];
          })()}
          currentIndex={currentIndex}
          isGeneral={isGeneral}
          exerciseData={exerciseData}
          onJump={handleJumpTo}
          onDelete={handleDeleteQuestion}
          onClose={() => setShowPreview(false)}
          onDone={handleCloseRequest}
          hierarchyData={hierarchyData}
          tabType={tabType}
          subcategory={subcategory}
          subcategoryLabel={subcategoryLabel}
          exerciseName={exerciseName}
          actionLabel="Preview"
          questionLabel={`${Math.max(getDbQuestionsForDiff().length, flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length)} Question${Math.max(getDbQuestionsForDiff().length, flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length) !== 1 ? 's' : ''}`}
          currentDiff={currentDiff}
          score={score}
          generalMPQ={generalMPQ}
          totalSlots={totalSlots}
          createdCount={createdCount}
          remainingSlots={remainingSlots}
          isScoreEditable={isScoreEditable}
          getFixedScore={getFixedScore}
          getConfiguredDiffs={getConfiguredDiffs}
          getRemainingSlots={getRemainingSlots}
          getDbQuestionsForDiff={getDbQuestionsForDiff}
          getQuotaForDiff={getQuotaForDiff}
          getCreatedCount={getCreatedCount}
          getTotalMarksForDiff={getTotalMarksForDiff}
          usedMarks={usedMarks}
          onDiffRowClick={handleDiffRowClick}
          cfgType={cfgType}
          totalMarksAll={totalMarksAll}
          usedMarksAll={usedMarksAll}
          displayScore={displayScore}
          remainingMarks={remainingMarks}
          totalMarksForDiff={totalMarksForDiff}
          totalSlotsAll={totalSlotsAll}
          createdCountAll={createdCountAll}
          remainingSlotsAll={remainingSlotsAll}
        />
      )}
      {showEditExerciseConfirm && (
        <EditExerciseConfirmDialog exerciseName={exerciseName}
          onConfirm={handleEditExerciseConfirm} onCancel={() => setShowEditExerciseConfirm(false)} />
      )}
      {showCloseConfirm && (
        <CloseConfirmDialog hasUnsavedChanges={hasUnsavedFormChanges} hasSavedQuestions={hasSavedQuestionsInSession}
          onConfirm={handleCloseConfirmed} onCancel={() => setShowCloseConfirm(false)} />
      )}
      {showMockModal && (
        <ProgrammingMockModal
          questions={(() => {
            // Get all saved questions from DB across ALL difficulties
            const allDbQuestions: FlowQuestion[] = getDbQuestionsForDiff().map(dbQuestionToFlow);

            // Get saved questions from flow that are NOT already in DB (newly saved in this session)
            const dbIds = new Set(allDbQuestions.map(q => q._id).filter(Boolean));
            const sessionSaved = flowQuestions.filter(q => {
              const sid = serverIdMap.current.get(q.__localId) || q._id;
              return sid && !dbIds.has(sid);
            }).map(q => ({
              ...q,
              _id: serverIdMap.current.get(q.__localId) || q._id,
            }));

            // Combine DB + session saved
            const allSaved = [...allDbQuestions, ...sessionSaved];

            // Check if current question is unsaved but has content — append it
            const currentQ = flowQuestions[currentIndex];
            const currentAlreadySaved = currentQ && (
              currentQ.isSaved ||
              currentQ._id ||
              serverIdMap.current.has(currentQ.__localId)
            );

            if (currentFormHasContent && !currentAlreadySaved) {
              const previewQ: FlowQuestion = {
                __localId: 'mock-preview-current',
                _id: undefined,
                title: getTitleText(titleBlocks) || '',
                description: descBlocks,
                difficulty: isGeneral ? 'medium' : currentDiff,
                score: isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff),
                testCases: tcs.map((tc, i) => ({
                  input: tc.input,
                  expectedOutput: tc.expectedOutput,
                  isSample: tc.isSample,
                  isHidden: tc.isHidden,
                  points: 1,
                  explanation: tc.description || `Test Case ${i + 1}`,
                  sequence: i,
                })),
                constraints: constraints.filter(c => c.trim()),
                hints: hint.trim()
                  ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }]
                  : [],
                timeLimit,
                memoryLimit: memLimit,
                questionType: 'programming',
                isSaved: false,
                isDirty: false,
              };
              return [...allSaved, previewQ];
            }

            return allSaved;
          })()}
          selectedLanguages={
            exerciseData.fullExerciseData?.programmingSettings?.selectedLanguages || ['Python']
          }
          exerciseIsGraded={exerciseIsGraded}
          onClose={() => setShowMockModal(false)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>
                  "{getTitleText(titleBlocks) || 'this question'}"</strong>?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>
                This will permanently remove it from the exercise.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowDeleteConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleDeleteCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <Trash2 size={13} /> Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Execution playground modals — Run / Try / Custom Input ── */}
      {showRunTestsModal && (
        <RunTestCasesModal
          language={codeSetupLanguage || 'Python'}
          executionType={executionType}
          functionContract={functionContract}
          solutionCode={solutionCode}
          testCases={tcs}
          constraints={constraints}
          onClose={() => setShowRunTestsModal(false)}
        />
      )}
      {showTryFunctionModal && executionType === 'function' && (
        <TryFunctionModal
          language={codeSetupLanguage || 'Python'}
          functionContract={functionContract}
          solutionCode={solutionCode}
          onClose={() => setShowTryFunctionModal(false)}
        />
      )}
      {showCustomInputModal && executionType === 'fullProgram' && (
        <CustomInputModal
          language={codeSetupLanguage || 'Python'}
          solutionCode={solutionCode}
          onClose={() => setShowCustomInputModal(false)}
        />
      )}

      {/* Clear Confirm Dialog */}
      {showClearConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-warning-bg)', borderBottom: '1.5px solid var(--lms-warning-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
                <AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Clear All Fields?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will reset the current question</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to clear all fields for this question?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)', fontWeight: 600 }}>
                Any unsaved content will be lost.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowClearConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleClearCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-warning)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <X size={13} /> Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Clear Confirm Dialog */}
      {showClearConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-warning-bg)', borderBottom: '1.5px solid var(--lms-warning-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
                <AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Clear All Fields?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will reset the current question</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to clear all fields for this question?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)', fontWeight: 600 }}>
                Any unsaved content will be lost.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowClearConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleClearCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-warning)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <X size={13} /> Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
           {/* ── Question Bank Selector ── */}
{showBankSelector && (
  <div className="fixed inset-0 z-[9999]">
    <QuestionBankSelector
      exerciseData={{
        exerciseId: exerciseDbId,
        exerciseName: exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '',
        exerciseLevel: exerciseData?.fullExerciseData?.exerciseInformation?.exerciseLevel || 'intermediate',
        nodeId: entityId,
        nodeName: exerciseData?.nodeName || '',
        subcategory,
        nodeType: exerciseData?.nodeType || '',
        fullExerciseData: exerciseData?.fullExerciseData,
        exerciseType: exerciseData?.exerciseType || exerciseData?.fullExerciseData?.exerciseType || '',
      }}
      
      tabType={tabType}
      onClose={() => {
        setShowBankSelector(false);
        // Cancel any pending reopen timer so a dismiss can't race the re-pop.
        if (reopenTimerRef.current) { clearTimeout(reopenTimerRef.current); reopenTimerRef.current = null; }
        // Intentional close: same contract as the AI modal — no auto-reopen
        // when the picker delivered no content.
        if (!sourceModalAddedRef.current) {
          intentionalCloseRef.current = true;
        }
        // Bank/Other-Platform-alone flow: closing the auto-opened picker with
        // no picks made and no manual work in progress exits the form —
        // otherwise (Custom exercise with a manual slice still to fill, or a
        // dropdown-opened picker) leave the form mounted so the teacher can
        // finish authoring the remaining slots by hand. Also suppress the
        // Save-&-Next re-pop so this picker doesn't reappear after every
        // manually-authored question.
        const isBankLike = autoOpenSource === 'bank' || autoOpenSource === 'thirdParty';
        const srcKey = autoOpenSource === 'thirdParty' ? 'thirdParty' as const : 'scratch' as const;
        // "Manual slots remain" is only computable per source when allowedSources.manual
        // is true (Custom mode with a 'scratch' sub-source). In pure-bank / pure-thirdParty
        // exercises manual is false, so the check collapses to false and the historical
        // "close the form" behaviour is preserved.
        const manualSlotsRemain = allowedSources.manual && getSourceRemainingTotal('scratch') > 0;
        if (
          isBankLike
          && sourceModalAutoOpenedRef.current
          && !sourceModalAddedRef.current
          && !hasUnsavedFormChanges
          && !manualSlotsRemain
        ) {
          onClose();
          return; // form is tearing down — no re-route on top of it
        } else if (isBankLike && sourceModalAutoOpenedRef.current) {
          // Auto-opened picker dismissed with manual work still available: keep
          // the form, suppress the re-pop loop, and hand the current blank
          // slot back to manual so the source tag it saves under is correct.
          autoReopenSuppressedRef.current = true;
          pendingSourceRef.current = 'scratch-manual';
        }
        // Whatever closed the picker: a blank slot manual can't fill must be
        // re-routed immediately — single usable source re-pops its modal
        // (trainer's rule: it returns until the slot is filled), several open
        // the dropdown. reopen no-ops when manual has room, so the legitimate
        // blank-editor landing is untouched.
        if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
      }}
      onBack={() => { setShowBankSelector(false); setShowAddDropdown(true); }}
      onSelect={(qs) => { setShowBankSelector(false); handleBankSelectedQuestions(qs); }}
      // Both the question's own id AND its bank-origin id: bank imports get a
      // fresh _id on save, so without bankQuestionId the picker's duplicate
      // check could never match a previously imported question.
      existingQuestionIds={(exerciseData?.fullExerciseData?.questions || []).flatMap((q: any) => [q._id, q.bankQuestionId]).filter(Boolean)}
      existingQuestions={exerciseData?.fullExerciseData?.questions || []}
      // ✅ ADD THIS LINE - filter to show only programming questions
      filterByType="programming"
      // Other Platform imports read the SEPARATE platform bank collection.
      bankSource={srcOfTag(pendingSourceRef.current) === 'thirdParty' ? 'otherPlatform' : 'bank'}
      // Open-slot quota — blocks over-selection at tick time. In Custom mode
      // the slots are further narrowed to the slice owned by the source that
      // opened this picker (scratch-bank vs thirdParty).
      selectionQuota={(() => {
        if (isGeneral) return { mode: 'general' as const, remainingTotal: getRemainingSlots() };
        const srcKey = srcOfTag(pendingSourceRef.current) === 'thirdParty' ? 'thirdParty' as const : 'scratch' as const;
        return {
          mode: 'difficulty' as const,
          remainingByDifficulty: {
            easy: getSourceRemaining(srcKey, 'easy' as Diff),
            medium: getSourceRemaining(srcKey, 'medium' as Diff),
            hard: getSourceRemaining(srcKey, 'hard' as Diff),
          },
        };
      })()}
    onEditQuestion={(question) => {
    setShowQuestionBank(false);
    setSelectedProgrammingQuestion(question);
    setShowProgrammingForm(true);
  }}
/>
  </div>
)}

{/* AI Generation — uses Gemini to author programming questions, then funnels
    them through the same `handleBankSelectedQuestions` path the bank uses. */}
<GenerateProgFamilyAI
  formType="programming"
  isOpen={showAIModal}
  onClose={() => {
    setShowAIModal(false);
    // Cancel any pending reopen timer so a dismiss can't race the re-pop.
    if (reopenTimerRef.current) { clearTimeout(reopenTimerRef.current); reopenTimerRef.current = null; }
    // Add Question UX contract: closing an UNTOUCHED AI modal returns to
    // Choose Source silently — no auto-reopen. Scoped to the "no content
    // was produced" case (`!sourceModalAddedRef.current`) so that
    // post-save routing after a successful generate is unaffected — that
    // path still lets `reopenSourceModalForBlankSlot` walk pending slots.
    if (!sourceModalAddedRef.current) {
      intentionalCloseRef.current = true;
    }
    // Only an AUTO-OPENED AI modal may cascade-close the form, and only when
    // the exercise has no manual-authoring slice left to fill. Dismissing an
    // AI modal that was opened by hand from the "+" dropdown never tears down
    // the form (a real bug — teachers were losing their work). Also protects
    // the "AI generated some, manual slots remain" case: instead of unmounting
    // the whole editor, keep the blank slot mounted so the teacher can type
    // the remaining manual questions in place.
    const manualSlotsRemain = allowedSources.manual && getSourceRemainingTotal('scratch') > 0;
    if (
      autoOpenSource === 'ai'
      && sourceModalAutoOpenedRef.current
      && !sourceModalAddedRef.current
      && !hasUnsavedFormChanges
      && !manualSlotsRemain
    ) {
      onClose();
      return; // form is tearing down — no re-route on top of it
    }
    // Dismissed with nothing generated. The teacher is backing out of the
    // whole "add a question" step, not just this one source — so close the
    // editor too and let the HOST show its Add Question chooser. Landing on a
    // blank editor they never asked for is the thing being fixed here.
    //
    // The one exception is unsaved work: tearing the form down would discard
    // it (the bug the narrow branch above was written for), so in that case
    // the editor stays and the in-place source menu opens instead.
    if (!sourceModalAddedRef.current) {
      autoReopenSuppressedRef.current = true;
      if (!hasUnsavedFormChanges) {
        onClose();
        return; // form is tearing down — no re-route on top of it
      }
      setShowAddDropdown(true);
    }
    if (autoOpenSource === 'ai' && sourceModalAutoOpenedRef.current) {
      // Keep the form on screen and stop re-popping. Reset the pending source
      // to scratch-manual so anything the teacher types now is stamped as a
      // manual question (mkPayload reads pendingSourceRef.current at 3878) —
      // without this the manual question would be billed to the AI slice.
      autoReopenSuppressedRef.current = true;
      pendingSourceRef.current = 'scratch-manual';
    }
    // Same re-route as the bank picker's onClose: a blank slot whose cell
    // manual can't fill re-pops the single usable source (until filled) or
    // opens the dropdown when several remain.
    if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
  }}
  initialDifficulty={(isGeneral ? 'medium' : currentDiff) as any}
  maxCount={isGeneral
    ? Math.max(1, getRemainingSlots(undefined, flowQuestionsRef.current) || 10)
    : Math.max(1, getRemainingSlots(currentDiff, flowQuestionsRef.current) || 10)}
  // Level-Based / Selection-Level → hand the popup the remaining slots per
  // difficulty so it renders three sliders (Easy/Medium/Hard) each capped at
  // the respective value. General mode omits this and keeps the single slider.
  perDifficultyQuotas={!isGeneral ? {
    // In Custom mode each slider is additionally capped by the AI column of
    // the distribution matrix (getSourceRemaining min's with open slots).
    easy: Math.max(0, getSourceRemaining('ai', 'easy' as Diff) || 0),
    medium: Math.max(0, getSourceRemaining('ai', 'medium' as Diff) || 0),
    hard: Math.max(0, getSourceRemaining('ai', 'hard' as Diff) || 0),
  } : undefined}
  contextHint={exerciseData?.selectedLanguages?.join(', ')}
  breadcrumbs={[
    hierarchyData?.courseName    && { name: hierarchyData.courseName,    type: 'course' },
    hierarchyData?.moduleName    && { name: hierarchyData.moduleName,    type: 'module' },
    hierarchyData?.submoduleName && { name: hierarchyData.submoduleName, type: 'submodule' },
    hierarchyData?.topicName     && { name: hierarchyData.topicName,     type: 'topic' },
    hierarchyData?.subtopicName  && { name: hierarchyData.subtopicName,  type: 'subtopic' },
  ].filter(Boolean) as { name: string; type: string }[]}
  exerciseName={exerciseName}
  onGenerated={(qs) => handleBankSelectedQuestions(qs as any, 'ai')}
/>

    </div>
  );
};

export default ProgrammingQuestionForm;